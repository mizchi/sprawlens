import { describe, expect, it } from "vitest";
import { apply } from "@sprawlens/layout";
import type { TiltParams } from "./Controls.tsx";
import { elevationUnitLift, mapTiltAffine, tiltStrengthOf } from "./tiltElevation.ts";

const tilt = (over: Partial<TiltParams> = {}): TiltParams => ({
  enabled: true,
  theta: 0,
  pitch: Math.PI / 4,
  layers: {},
  gap: 0,
  ...over,
});

const WIDTH = 960;
const HEIGHT = 640;
// must match the renderer's peak-lift fraction (kept private in the module)
const ELEV_SPAN_FRAC = 0.37;

describe("tiltStrengthOf", () => {
  it("is 0 when there is no tilt", () => {
    expect(tiltStrengthOf(undefined)).toBe(0);
  });

  it("is sin(|pitch|) — 0 flat, 1 edge-on", () => {
    expect(tiltStrengthOf(tilt({ pitch: 0 }))).toBe(0);
    expect(tiltStrengthOf(tilt({ pitch: Math.PI / 2 }))).toBeCloseTo(1);
    expect(tiltStrengthOf(tilt({ pitch: Math.PI / 6 }))).toBeCloseTo(0.5);
  });
});

describe("mapTiltAffine", () => {
  it("is undefined with no tilt params", () => {
    expect(mapTiltAffine(undefined, WIDTH, HEIGHT)).toBeUndefined();
  });

  it("is undefined when tilt is disabled", () => {
    expect(mapTiltAffine(tilt({ enabled: false }), WIDTH, HEIGHT)).toBeUndefined();
  });

  it("is undefined when flat and no planes are shown (nothing to tilt)", () => {
    expect(mapTiltAffine(tilt({ theta: 0, pitch: 0, layers: {} }), WIDTH, HEIGHT)).toBeUndefined();
  });

  it("activates from a shown satellite plane even at zero pitch/theta", () => {
    expect(
      mapTiltAffine(tilt({ theta: 0, pitch: 0, layers: { test: true } }), WIDTH, HEIGHT),
    ).toBeDefined();
  });

  it("degrades to undefined at the edge-on singularity (pitch ≈ 90°)", () => {
    // squash = cos(90°) = 0 makes the affine singular; better flat than a throw
    expect(mapTiltAffine(tilt({ pitch: Math.PI / 2 }), WIDTH, HEIGHT)).toBeUndefined();
  });

  it("produces an affine for a normal tilt", () => {
    expect(mapTiltAffine(tilt(), WIDTH, HEIGHT)).toBeDefined();
  });
});

describe("elevationUnitLift", () => {
  it("is the zero vector without an affine", () => {
    expect(elevationUnitLift(undefined, HEIGHT, 0.7)).toEqual({ x: 0, y: 0 });
  });

  it("is the zero vector when the tilt is flat (strength 0)", () => {
    const affine = mapTiltAffine(tilt(), WIDTH, HEIGHT)!;
    expect(elevationUnitLift(affine, HEIGHT, 0)).toEqual({ x: 0, y: 0 });
  });

  it("displaces so a unit-elevation node rises straight up on screen after the tilt", () => {
    // the contract: the lift is a pre-tilt world vector that, once the tilt
    // affine is applied, reads as a pure screen-vertical rise of
    // height * ELEV_SPAN_FRAC * strength — independent of theta.
    const strength = 0.8;
    const affine = mapTiltAffine(tilt({ theta: 0.7, pitch: Math.PI / 3 }), WIDTH, HEIGHT)!;
    const lift = elevationUnitLift(affine, HEIGHT, strength);
    const origin = { x: 100, y: 200 };
    const before = apply(affine, origin);
    const after = apply(affine, { x: origin.x + lift.x, y: origin.y + lift.y });
    const expected = HEIGHT * ELEV_SPAN_FRAC * strength;
    expect(after.x - before.x).toBeCloseTo(0);
    expect(after.y - before.y).toBeCloseTo(-expected);
  });

  it("scales linearly with strength", () => {
    const affine = mapTiltAffine(tilt(), WIDTH, HEIGHT)!;
    const half = elevationUnitLift(affine, HEIGHT, 0.4);
    const full = elevationUnitLift(affine, HEIGHT, 0.8);
    expect(full.x).toBeCloseTo(half.x * 2);
    expect(full.y).toBeCloseTo(half.y * 2);
  });
});
