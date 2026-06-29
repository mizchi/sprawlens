import { describe, expect, it } from "vitest";
import { oklchToRgb, wedgeColor, wedgeLch, type WedgeProfile } from "./hierarchyColor.ts";

const profile: WedgeProfile = { l: [0.86, 0.95], c: [0.03, 0.09], hueSpread: 22 };

describe("wedgeLch", () => {
  it("is deterministic", () => {
    expect(wedgeLch(200, 7, profile)).toEqual(wedgeLch(200, 7, profile));
  });

  it("keeps lightness and chroma inside the profile bands", () => {
    for (const key of [0, 1, 7, 42, 1000, 999999]) {
      const { l, c } = wedgeLch(200, key, profile);
      expect(l).toBeGreaterThanOrEqual(profile.l[0]);
      expect(l).toBeLessThanOrEqual(profile.l[1]);
      expect(c).toBeGreaterThanOrEqual(profile.c[0]);
      expect(c).toBeLessThanOrEqual(profile.c[1]);
    }
  });

  it("keeps the hue within ±hueSpread of the parent's base hue", () => {
    const base = 200;
    for (const key of [0, 1, 7, 42, 1000, 999999]) {
      const { h } = wedgeLch(base, key, profile);
      expect(h).toBeGreaterThanOrEqual(base - profile.hueSpread - 1e-6);
      expect(h).toBeLessThanOrEqual(base + profile.hueSpread + 1e-6);
    }
  });

  it("wraps hue into [0,360) when the wedge crosses 0", () => {
    for (const key of [0, 1, 7, 42, 1000]) {
      const { h } = wedgeLch(5, key, profile);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it("spreads siblings across the wedge (distinguishable, not all clumped)", () => {
    const hues = Array.from({ length: 20 }, (_, i) => wedgeLch(200, i + 1, profile).h);
    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(profile.hueSpread);
    expect(new Set(hues.map((h) => h.toFixed(1))).size).toBeGreaterThanOrEqual(18);
  });
});

describe("oklchToRgb", () => {
  it("maps the lightness extremes to black and white", () => {
    expect(oklchToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(oklchToRgb(1, 0, 0)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("returns in-range channels and clamps out-of-gamut chroma", () => {
    const c = oklchToRgb(0.6, 0.4, 30); // very high chroma → out of sRGB gamut
    for (const v of [c.r, c.g, c.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("a hue-200 mid color reads blue-dominant", () => {
    const { r, b } = oklchToRgb(0.7, 0.08, 220);
    expect(b).toBeGreaterThan(r);
  });
});

describe("wedgeColor", () => {
  it("emits a plain rgb() string (no oklch in the SVG fill)", () => {
    expect(wedgeColor(200, 12345, profile)).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
  });

  it("is deterministic", () => {
    expect(wedgeColor(200, 7, profile)).toBe(wedgeColor(200, 7, profile));
  });
});
