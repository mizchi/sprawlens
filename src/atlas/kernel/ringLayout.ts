export type RingModule = {
  id: string;
  /** Target visual area; circle radius = sqrt(area / pi). */
  area: number;
  /** Topological rank; rank 0 sits at the center. */
  rank: number;
};

export type RingEdge = { source: string; target: string; weight?: number };

export type RingOptions = {
  /** Minimum clearance between circles, as a fraction of the mean radius. */
  gapRatio?: number;
};

export type PlacedCircle = { cx: number; cy: number; r: number; rank: number };

export type RingLayoutResult = {
  circles: Map<string, PlacedCircle>;
  /** Outer extent of the layout (max center distance + radius). */
  totalRadius: number;
};

/**
 * Concentric-ring placement: one ring per topological rank, circles sized by
 * area. Angular order inside a ring follows the barycenter of already-placed
 * linked modules so dependency edges stay short.
 */
export function ringLayout(
  modules: readonly RingModule[],
  edges: readonly RingEdge[],
  options?: RingOptions,
): RingLayoutResult {
  const { gapRatio = 0.25 } = options ?? {};
  const circles = new Map<string, PlacedCircle>();
  if (modules.length === 0) return { circles, totalRadius: 0 };

  const radii = new Map(
    modules.map((m) => [m.id, Math.sqrt(Math.max(m.area, 1e-12) / Math.PI)]),
  );
  const meanRadius =
    [...radii.values()].reduce((s, r) => s + r, 0) / radii.size;
  const gap = meanRadius * gapRatio;


  const rings = new Map<number, RingModule[]>();
  for (const module of modules) {
    const index = module.rank;
    const ring = rings.get(index);
    if (ring) ring.push(module);
    else rings.set(index, [module]);
  }

  const neighborAngles = new Map<string, number[]>();
  const noteNeighbor = (id: string, angle: number) => {
    const list = neighborAngles.get(id);
    if (list) list.push(angle);
    else neighborAngles.set(id, [angle]);
  };

  let previousOuter = 0; // outer extent of the previous ring
  let totalRadius = 0;
  const ringIndices = [...rings.keys()].sort((a, b) => a - b);
  for (const ringIndex of ringIndices) {
    const ring = rings.get(ringIndex)!;
    const maxR = Math.max(...ring.map((m) => radii.get(m.id)!));

    if (ringIndex === ringIndices[0] && ring.length === 1) {
      const module = ring[0]!;
      const r = radii.get(module.id)!;
      circles.set(module.id, { cx: 0, cy: 0, r, rank: module.rank });
      totalRadius = r;
      previousOuter = r;
      continue;
    }

    // preferred angle = mean angle of already-placed linked modules
    const placedEdgeAngle = (id: string): number | null => {
      const angles: number[] = [];
      for (const edge of edges) {
        const other =
          edge.source === id ? edge.target : edge.target === id ? edge.source : null;
        if (!other) continue;
        const placed = circles.get(other);
        if (!placed) continue;
        if (placed.cx === 0 && placed.cy === 0) continue; // center has no angle
        angles.push(Math.atan2(placed.cy, placed.cx));
      }
      const noted = neighborAngles.get(id) ?? [];
      angles.push(...noted);
      if (angles.length === 0) return null;
      let sx = 0;
      let sy = 0;
      for (const a of angles) {
        sx += Math.cos(a);
        sy += Math.sin(a);
      }
      if (sx === 0 && sy === 0) return null;
      return Math.atan2(sy, sx);
    };

    const ordered = [...ring].sort((a, b) => {
      const pa = placedEdgeAngle(a.id);
      const pb = placedEdgeAngle(b.id);
      if (pa === null && pb === null) return a.id < b.id ? -1 : 1;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    });

    // angular slot width proportional to diameter + gap
    const widths = ordered.map((m) => 2 * radii.get(m.id)! + gap);
    const circumference = widths.reduce((s, w) => s + w, 0);
    let radius = Math.max(
      circumference / (2 * Math.PI),
      previousOuter + maxR + gap,
    );

    const angles: number[] = [];
    let cursor = 0;
    for (const width of widths) {
      angles.push(((cursor + width / 2) / circumference) * 2 * Math.PI);
      cursor += width;
    }
    // rotate the whole ring toward the modules' preferred angles
    let dx = 0;
    let dy = 0;
    ordered.forEach((m, i) => {
      const preferred = placedEdgeAngle(m.id);
      if (preferred === null) return;
      const delta = preferred - angles[i]!;
      dx += Math.cos(delta);
      dy += Math.sin(delta);
    });
    const rotation = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);

    // ensure adjacent circles on the ring cannot touch (chord check); the
    // angular gaps are fixed, so scaling the radius fixes all pairs at once
    for (let i = 0; i < ordered.length && ordered.length > 1; i++) {
      const j = (i + 1) % ordered.length;
      const needed = radii.get(ordered[i]!.id)! + radii.get(ordered[j]!.id)! + gap;
      let deltaAngle = Math.abs(angles[j]! - angles[i]!);
      deltaAngle = Math.min(deltaAngle, 2 * Math.PI - deltaAngle);
      const chord = 2 * radius * Math.sin(deltaAngle / 2);
      if (chord < needed && chord > 0) {
        radius *= needed / chord;
      }
    }

    ordered.forEach((m, i) => {
      const angle = angles[i]! + rotation;
      const r = radii.get(m.id)!;
      circles.set(m.id, {
        cx: Math.cos(angle) * radius,
        cy: Math.sin(angle) * radius,
        r,
        rank: m.rank,
      });
      noteNeighbor(m.id, angle);
    });
    previousOuter = radius + maxR;
    totalRadius = Math.max(totalRadius, previousOuter);
  }

  return { circles, totalRadius };
}
