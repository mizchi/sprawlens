import { apply, invert, layerTransform, sub, type Affine, type Vec2 } from "@sprawlens/layout";
import { anyPlaneShown, type TiltParams } from "./Controls.tsx";

/**
 * Peak elevation lift as a fraction of viewport height (at full tilt): the
 * summit module rises this far above sea level. Shared so the renderer and the
 * breadcrumb hit-test agree on how far a node is displaced.
 */
const ELEV_SPAN_FRAC = 0.37;

/** How much the stacked-plane tilt is engaged: 0 flat, 1 edge-on. */
export function tiltStrengthOf(tilt: TiltParams | undefined): number {
  return tilt ? Math.sin(Math.abs(tilt.pitch)) : 0;
}

/**
 * The affine the map's content group carries (`<g transform>`), or undefined
 * when the view is flat top-down. Built from the tilt params plus the map size
 * — identical inputs to what RingsMapSvg renders with, so anything outside the
 * component (App's crosshair breadcrumb) can map between world and tilted space.
 */
export function mapTiltAffine(
  tilt: TiltParams | undefined,
  width: number,
  height: number,
): Affine | undefined {
  if (!tilt) return undefined;
  const active = !!tilt.enabled && (tilt.theta !== 0 || tilt.pitch !== 0 || anyPlaneShown(tilt));
  if (!active) return undefined;
  const squash = Math.cos(tilt.pitch);
  // at pitch ≈ 90° the plane is edge-on: squash → 0 makes the affine singular
  // (det = squash), so invert() would throw. Nothing is visible there anyway —
  // degrade to flat (undefined) rather than crash the whole map.
  if (Math.abs(squash) < 1e-3) return undefined;
  return layerTransform({
    theta: tilt.theta,
    squash,
    center: { x: width / 2, y: height / 2 },
    gap: 0,
    index: 0,
  });
}

/**
 * Pre-tilt world displacement for one unit of elevation (height 1.0): a node at
 * elevation `e` is drawn at `position + unitLift * e`. Defined so that after
 * `tiltAffine` it reads as a straight `(0, -height * ELEV_SPAN_FRAC * strength)`
 * rise on screen. Zero vector when there's no tilt to rise into.
 */
export function elevationUnitLift(
  tiltAffine: Affine | undefined,
  height: number,
  tiltStrength: number,
): Vec2 {
  if (!tiltAffine || tiltStrength <= 0) return { x: 0, y: 0 };
  const inv = invert(tiltAffine);
  const origin = apply(inv, { x: 0, y: 0 });
  const up = apply(inv, { x: 0, y: -height * ELEV_SPAN_FRAC * tiltStrength });
  return sub(up, origin);
}
