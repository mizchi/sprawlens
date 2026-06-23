import type { Vec2 } from "./vec.ts";

/**
 * A 2x3 affine transform stored row-major as the six numbers that SVG's
 * `matrix(a, b, c, d, e, f)` expects:
 *
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 *
 * Layer planes in the multi-level view are built by composing rotation,
 * a vertical squash (the "lying flat" pitch), and a per-layer offset into
 * one of these. The same matrix drives both the SVG `<g transform>` and the
 * JS-side projection of cross-layer edge endpoints, so the two never drift.
 */
export type Affine = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function apply(m: Affine, p: Vec2): Vec2 {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** Compose two transforms so that `apply(compose(m, n), p) === apply(m, apply(n, p))`. */
export function compose(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function translate(tx: number, ty: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

/** In-plane rotation by `theta` radians about `center` (default origin). */
export function rotate(theta: number, center: Vec2 = { x: 0, y: 0 }): Affine {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // translate(center) ∘ R ∘ translate(-center)
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: center.x - (cos * center.x - sin * center.y),
    f: center.y - (sin * center.x + cos * center.y),
  };
}

/** Scale the y axis by `s` about `cy` (the pitch / "lying flat" squash). */
export function squashY(s: number, cy = 0): Affine {
  return { a: 1, b: 0, c: 0, d: s, e: 0, f: cy - s * cy };
}

/** Horizontal shear about `cy`: `x' = x + k·(y - cy)`. Leans the plane into
 * the sketch's right-tilted parallelogram (k < 0 pushes the far/top edge
 * right). y is untouched. */
export function skewX(k: number, cy = 0): Affine {
  return { a: 1, b: 0, c: k, d: 1, e: -k * cy, f: 0 };
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) throw new Error("affine: singular matrix has no inverse");
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv,
  };
}

export function toMatrixString(m: Affine): string {
  return `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
}

/**
 * Transform string that pins a label's anchor to where `m` places it on the
 * plane, while keeping the glyphs upright and unscaled. The element renders
 * at local (0,0) so its own x/y become upright screen offsets:
 *
 *   element screen transform = m · uprightAt(m, anchor)
 *                            = m · m⁻¹ · translate(m·anchor)
 *                            = translate(m·anchor)   // linear part is identity
 *
 * With `m` undefined it degrades to a plain translate to the anchor, so the
 * untilted view is unchanged.
 */
export function uprightAt(m: Affine | undefined, anchor: Vec2): string {
  if (!m) return `translate(${anchor.x},${anchor.y})`;
  const p = apply(m, anchor);
  return toMatrixString(compose(invert(m), translate(p.x, p.y)));
}

/**
 * The transform for layer `index` (0 = top plane): rotate the layout about
 * `center` by `theta`, squash the y axis by `s` about the same center to lay
 * the plane flat, then drop the plane down by `index * gap` screen-y. All
 * outputs share the pre-viewBox world frame, so cross-layer edge endpoints
 * computed via `apply` line up with what the `<g transform>` renders.
 */
export function layerTransform(opts: {
  theta: number;
  squash: number;
  /** Horizontal shear coefficient for the rightward lean (0 = none). */
  skew?: number;
  gap: number;
  index: number;
  center: Vec2;
}): Affine {
  const squashAndRotate = compose(
    squashY(opts.squash, opts.center.y),
    rotate(opts.theta, opts.center),
  );
  const tilt = opts.skew
    ? compose(skewX(opts.skew, opts.center.y), squashAndRotate)
    : squashAndRotate;
  return compose(translate(0, opts.index * opts.gap), tilt);
}
