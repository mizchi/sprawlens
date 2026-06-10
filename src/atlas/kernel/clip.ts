import { centroid, circleToPolygon, type Ring } from "./polygon.js";
import type { Rng } from "./rng.js";
import type { Vec2 } from "./vec.js";

export type ClipRegion =
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  /** Arbitrary convex CCW ring — e.g. an outer cell hosting a nested layout. */
  | { kind: "polygon"; ring: Ring };

export function clipToRing(clip: ClipRegion, circleSegments: number): Ring {
  if (clip.kind === "rect") {
    return [
      { x: clip.x, y: clip.y },
      { x: clip.x + clip.width, y: clip.y },
      { x: clip.x + clip.width, y: clip.y + clip.height },
      { x: clip.x, y: clip.y + clip.height },
    ];
  }
  if (clip.kind === "polygon") return clip.ring;
  return circleToPolygon(clip, circleSegments);
}

function insideConvex(ring: Ring, p: Vec2): boolean {
  if (ring.length < 3) return false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false;
  }
  return true;
}

export function randomPointIn(clip: ClipRegion, rng: Rng): Vec2 {
  if (clip.kind === "rect") {
    return {
      x: clip.x + rng() * clip.width,
      y: clip.y + rng() * clip.height,
    };
  }
  if (clip.kind === "polygon") {
    // area-weighted triangle-fan sampling from the centroid (convex ring)
    const c = centroid(clip.ring);
    const areas: number[] = [];
    let totalArea = 0;
    for (let i = 0; i < clip.ring.length; i++) {
      const a = clip.ring[i]!;
      const b = clip.ring[(i + 1) % clip.ring.length]!;
      const area = Math.abs(
        (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y),
      );
      areas.push(area);
      totalArea += area;
    }
    let pick = rng() * totalArea;
    let index = 0;
    while (index < areas.length - 1 && pick > areas[index]!) {
      pick -= areas[index]!;
      index++;
    }
    const a = clip.ring[index]!;
    const b = clip.ring[(index + 1) % clip.ring.length]!;
    const s = Math.sqrt(rng());
    const t = rng();
    return {
      x: (1 - s) * c.x + s * (1 - t) * a.x + s * t * b.x,
      y: (1 - s) * c.y + s * (1 - t) * a.y + s * t * b.y,
    };
  }
  const angle = rng() * Math.PI * 2;
  const radius = clip.r * Math.sqrt(rng());
  return {
    x: clip.cx + Math.cos(angle) * radius,
    y: clip.cy + Math.sin(angle) * radius,
  };
}

export function clampInto(clip: ClipRegion, p: Vec2): Vec2 {
  if (clip.kind === "rect") {
    const inset = Math.min(clip.width, clip.height) * 1e-3;
    return {
      x: Math.min(Math.max(p.x, clip.x + inset), clip.x + clip.width - inset),
      y: Math.min(Math.max(p.y, clip.y + inset), clip.y + clip.height - inset),
    };
  }
  if (clip.kind === "polygon") {
    if (insideConvex(clip.ring, p)) return p;
    // pull the point onto the centroid→p ray, just inside the boundary
    const c = centroid(clip.ring);
    let bestT = Infinity;
    for (let i = 0; i < clip.ring.length; i++) {
      const a = clip.ring[i]!;
      const b = clip.ring[(i + 1) % clip.ring.length]!;
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const denom = dx * ey - dy * ex;
      if (Math.abs(denom) < 1e-12) continue;
      const t = ((a.x - c.x) * ey - (a.y - c.y) * ex) / denom;
      const u = (dx * (a.y - c.y) - dy * (a.x - c.x)) / -denom;
      if (t > 0 && u >= 0 && u <= 1 && t < bestT) bestT = t;
    }
    if (!Number.isFinite(bestT)) return c;
    const f = bestT * 0.99;
    return { x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f };
  }
  const dx = p.x - clip.cx;
  const dy = p.y - clip.cy;
  const dist = Math.hypot(dx, dy);
  const maxDist = clip.r * 0.995;
  if (dist <= maxDist) return p;
  const f = maxDist / dist;
  return { x: clip.cx + dx * f, y: clip.cy + dy * f };
}

export function clipScale(clip: ClipRegion): number {
  if (clip.kind === "rect") return Math.max(clip.width, clip.height);
  if (clip.kind === "polygon") {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of clip.ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return Math.max(maxX - minX, maxY - minY);
  }
  return clip.r * 2;
}

export function clipCenter(clip: ClipRegion): Vec2 {
  if (clip.kind === "rect") {
    return { x: clip.x + clip.width / 2, y: clip.y + clip.height / 2 };
  }
  if (clip.kind === "polygon") return centroid(clip.ring);
  return { x: clip.cx, y: clip.cy };
}
