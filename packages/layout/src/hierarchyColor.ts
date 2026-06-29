/**
 * Hierarchical fill coloring, adapted from "Dynamic Color Assignment for
 * Hierarchical Data" (arXiv:2407.14742): a child's color sits in a bounded
 * neighborhood of its parent's color so the parent's hue identity reads while
 * siblings stay discriminable. We keep the paper's *shape* — parent hue ± a
 * wedge, in a perceptual space (OKLCh ≈ CIELCh) — but drop its simulated-
 * annealing optimization: a low-discrepancy hash spreads siblings deterministi-
 * cally across the wedge in ~no time, which is what a real-time map with
 * thousands of cells needs.
 *
 * The wedge is computed in OKLCh and converted to sRGB here, so the output is a
 * plain `rgb()` string that every browser renders in an SVG `fill` attribute
 * (CSS Color 4 `oklch()` is not reliably accepted there).
 */

/** The OKLCh box a module's leaves are scattered through, around the module's
 * base hue. Theme-dependent (light tints vs dark shades). */
export type WedgeProfile = {
  /** Lightness band [min, max], 0..1. */
  l: [number, number];
  /** Chroma band [min, max]. */
  c: [number, number];
  /** Half-width of the hue wedge, in degrees, around the parent's base hue. */
  hueSpread: number;
};

// Low-discrepancy (additive-recurrence) multipliers: three mutually irrational
// constants decorrelate the hue / lightness / chroma axes so a sibling that
// lands mid-hue doesn't also always land mid-lightness. φ⁻¹ and two more from
// the same plastic-constant family.
const ALPHA_H = 0.6180339887498949;
const ALPHA_L = 0.7548776662466927;
const ALPHA_C = 0.5698402909980532;

const frac = (x: number): number => x - Math.floor(x);

/** OKLCh position a leaf lands on within its parent module's wedge. `baseHue`
 * is the module hue (degrees); `key` is any integer from the leaf id. */
export function wedgeLch(
  baseHue: number,
  key: number,
  p: WedgeProfile,
): { l: number; c: number; h: number } {
  const uh = frac(key * ALPHA_H);
  const ul = frac(key * ALPHA_L);
  const uc = frac(key * ALPHA_C);
  return {
    l: p.l[0] + (p.l[1] - p.l[0]) * ul,
    c: p.c[0] + (p.c[1] - p.c[0]) * uc,
    h: (((baseHue + (uh * 2 - 1) * p.hueSpread) % 360) + 360) % 360,
  };
}

const gamma = (x: number): number =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** OKLCh → sRGB (0–255), via Björn Ottosson's OKLab matrices. Out-of-gamut
 * results are clamped per channel (the wedges are low-chroma, so rare). */
export function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return {
    r: Math.round(clamp01(gamma(r)) * 255),
    g: Math.round(clamp01(gamma(g)) * 255),
    b: Math.round(clamp01(gamma(bl)) * 255),
  };
}

/**
 * A leaf's fill within its parent module's hue family, as an sRGB `rgb()`
 * string. `baseHue` is the module's hue (degrees); `key` is any integer derived
 * from the leaf's id — `frac(key * α)` turns it into a well-spread wedge
 * position so the same file always lands on the same, distinguishable color.
 */
export function wedgeColor(baseHue: number, key: number, p: WedgeProfile): string {
  const { l, c, h } = wedgeLch(baseHue, key, p);
  const { r, g, b } = oklchToRgb(l, c, h);
  return `rgb(${r} ${g} ${b})`;
}

/** A module's base hue (degrees), hashed from its id so the same module always
 * gets the same color family. Shared by the live map and the headless renderer. */
export function moduleHue(moduleId: string): number {
  let h = 0;
  for (let i = 0; i < moduleId.length; i++) h = (h * 31 + moduleId.charCodeAt(i)) % 360;
  return h;
}

/** Stable uint32 hash of a leaf id (FNV-1a), used as the wedge scatter key so a
 * file always lands on the same color. */
export function hashKey(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
