import {
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CapacityOptions,
  type CellInputNode,
  type ClipRegion,
} from "./capacityLayout.ts";
import { signedArea, type Ring } from "./polygon.ts";
import type { Vec2 } from "./vec.ts";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function hilbertCell(order: number, distance: number): { x: number; y: number } {
  const side = 2 ** order;
  let x = 0;
  let y = 0;
  let remaining = distance;
  for (let scale = 1; scale < side; scale *= 2) {
    const rx = 1 & Math.floor(remaining / 2);
    const ry = 1 & (Math.floor(remaining) ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = scale - 1 - x;
        y = scale - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += scale * rx;
    y += scale * ry;
    remaining = Math.floor(remaining / 4);
  }
  return { x, y };
}

function boundsOf(clip: ClipRegion) {
  if (clip.kind === "rect") {
    return {
      minX: clip.x,
      minY: clip.y,
      maxX: clip.x + clip.width,
      maxY: clip.y + clip.height,
    };
  }
  if (clip.kind === "circle") {
    return {
      minX: clip.cx - clip.r,
      minY: clip.cy - clip.r,
      maxX: clip.cx + clip.r,
      maxY: clip.cy + clip.r,
    };
  }
  return {
    minX: Math.min(...clip.ring.map(({ x }) => x)),
    minY: Math.min(...clip.ring.map(({ y }) => y)),
    maxX: Math.max(...clip.ring.map(({ x }) => x)),
    maxY: Math.max(...clip.ring.map(({ y }) => y)),
  };
}

function insideConvex(ring: Ring, point: Vec2): boolean {
  let sign = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index]!;
    const b = ring[(index + 1) % ring.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) <= 1e-12) continue;
    const current = Math.sign(cross);
    if (sign === 0) sign = current;
    else if (current !== sign) return false;
  }
  return true;
}

function contains(clip: ClipRegion, point: Vec2): boolean {
  if (clip.kind === "rect") {
    return (
      point.x >= clip.x &&
      point.x <= clip.x + clip.width &&
      point.y >= clip.y &&
      point.y <= clip.y + clip.height
    );
  }
  if (clip.kind === "circle") {
    return Math.hypot(point.x - clip.cx, point.y - clip.cy) <= clip.r;
  }
  return insideConvex(clip.ring, point);
}

function boundingSquare(clip: ClipRegion): { bounds: Bounds; side: number } {
  const bounds = boundsOf(clip);
  const side = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (!(side > 0)) throw new Error("stable Hilbert initialization requires a non-empty clip");
  return { bounds, side };
}

function hilbertCurve(order: number, bounds: Bounds, squareSide: number): Vec2[] {
  const gridSide = 2 ** order;
  return Array.from({ length: gridSide * gridSide }, (_, distance) => {
    const cell = hilbertCell(order, distance);
    return {
      x: bounds.minX + ((cell.x + 0.5) / gridSide) * squareSide,
      y: bounds.minY + ((cell.y + 0.5) / gridSide) * squareSide,
    };
  });
}

function extendedOrderOneCurve(bounds: Bounds, squareSide: number): Vec2[] {
  const base = hilbertCurve(1, bounds, squareSide);
  const extended: Vec2[] = [];
  for (let index = 0; index < base.length; index++) {
    const point = base[index]!;
    extended.push(point);
    const next = base[index + 1];
    if (next) extended.push({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 });
  }
  return extended;
}

function clipArea(clip: ClipRegion): number {
  if (clip.kind === "rect") return clip.width * clip.height;
  if (clip.kind === "circle") return Math.PI * clip.r * clip.r;
  return Math.abs(signedArea(clip.ring));
}

/**
 * Thesis Algorithm 6: scale a Hilbert curve over the clip, retain curve-cell
 * centers inside the polygon, and assign sites at regular intervals in strict
 * input order. The thesis implementation uses order 8 by default.
 */
export function stableHilbertHints(
  nodes: readonly CellInputNode[],
  clip: ClipRegion,
  order = 8,
): Map<string, Vec2> {
  if (!Number.isInteger(order) || order < 1 || order > 10) {
    throw new Error("Hilbert curve order must be an integer from 1 to 10");
  }
  if (nodes.length === 0) return new Map();
  const { bounds, side } = boundingSquare(clip);
  const curve = hilbertCurve(order, bounds, side).filter((point) => contains(clip, point));
  if (curve.length < nodes.length) {
    throw new Error(
      `Hilbert curve has ${curve.length} in-clip points for ${nodes.length} nodes; increase order`,
    );
  }
  const step = curve.length / nodes.length;
  return new Map(
    nodes.map((node, index) => [
      node.id,
      curve[Math.min(curve.length - 1, Math.floor(step / 2 + index * step))]!,
    ]),
  );
}

export type StableVariableHilbertPlacement = {
  hints: Map<string, Vec2>;
  /** Actual curve order after Algorithm 8 fallback, not merely the initial threshold choice. */
  curveOrderById: Map<string, 1 | 2 | 3 | 8>;
  fallbackCount: number;
};

type CurveSearchResult = { point: Vec2; nextFraction: number; order: 1 | 2 | 3 | 8 };

/** Thesis Algorithm 8 variable, weight-aware Hilbert initialization. */
export function stableVariableHilbertHints(
  nodes: readonly CellInputNode[],
  clip: ClipRegion,
): StableVariableHilbertPlacement {
  if (nodes.length === 0) {
    return { hints: new Map(), curveOrderById: new Map(), fallbackCount: 0 };
  }
  const { bounds, side } = boundingSquare(clip);
  const curves = new Map<1 | 2 | 3 | 8, Vec2[]>([
    [1, extendedOrderOneCurve(bounds, side)],
    [2, hilbertCurve(2, bounds, side)],
    [3, hilbertCurve(3, bounds, side)],
    [8, hilbertCurve(8, bounds, side)],
  ]);
  const areaFraction = clipArea(clip) / (side * side);
  const nonNegative = nodes.map((node) => Math.max(0, node.weight));
  const totalWeight = nonNegative.reduce((sum, weight) => sum + weight, 0);
  const normalized = totalWeight > 0 ? nonNegative : nodes.map(() => 1);
  const denominator = normalized.reduce((sum, weight) => sum + weight, 0);
  let indexFraction = 0;
  let fallbackCount = 0;
  const hints = new Map<string, Vec2>();
  const curveOrderById = new Map<string, 1 | 2 | 3 | 8>();

  const searchCurve = (
    order: 1 | 2 | 3 | 8,
    startFraction: number,
    stepFraction: number,
    maxAttempts: number,
  ): CurveSearchResult | null => {
    const curve = curves.get(order)!;
    const halfStep = (curve.length * stepFraction) / 2;
    let index = curve.length * (startFraction + stepFraction / 2);
    if (order === 1) {
      const firstIndex = Math.floor(index);
      for (const curveIndex of [firstIndex, firstIndex + 1]) {
        const point = curve[curveIndex];
        if (point && contains(clip, point)) {
          return {
            point,
            nextFraction: Math.min(1, startFraction + stepFraction),
            order,
          };
        }
      }
      return null;
    }
    let currentStep = halfStep;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      const curveIndex = Math.floor(index);
      if (curveIndex >= curve.length) return null;
      const point = curve[Math.max(0, curveIndex)]!;
      if (contains(clip, point)) {
        // The printed pseudocode shows the reciprocal, which cannot represent
        // a forward normalized curve position. Preserve the intended invariant.
        return {
          point,
          nextFraction: Math.min(1, (index + halfStep) / curve.length),
          order,
        };
      }
      currentStep = Math.max(1, currentStep / 2);
      index += currentStep;
    }
    return null;
  };

  const findPoint = (
    initialOrder: 1 | 2 | 3 | 8,
    startFraction: number,
    stepFraction: number,
  ): CurveSearchResult => {
    const chain: Array<{ order: 1 | 2 | 3 | 8; attempts: number }> =
      initialOrder === 1
        ? [
            { order: 1, attempts: 1 },
            { order: 2, attempts: 4 },
            { order: 3, attempts: 8 },
            { order: 8, attempts: curves.get(8)!.length },
          ]
        : initialOrder === 2
          ? [
              { order: 2, attempts: 4 },
              { order: 3, attempts: 8 },
              { order: 8, attempts: curves.get(8)!.length },
            ]
          : initialOrder === 3
            ? [
                { order: 3, attempts: 8 },
                { order: 8, attempts: curves.get(8)!.length },
              ]
            : [{ order: 8, attempts: curves.get(8)!.length }];
    for (const candidate of chain) {
      const result = searchCurve(candidate.order, startFraction, stepFraction, candidate.attempts);
      if (result) {
        if (candidate.order !== initialOrder) fallbackCount++;
        return result;
      }
    }
    throw new Error("Algorithm 8 could not place a site inside the clip");
  };

  nodes.forEach((node, index) => {
    const fraction = (normalized[index]! / denominator) * areaFraction;
    const initialOrder: 1 | 2 | 3 | 8 =
      fraction <= 0.05 ? 8 : fraction <= 0.1 ? 3 : fraction <= 0.225 ? 2 : 1;
    const result = findPoint(initialOrder, indexFraction, fraction);
    hints.set(node.id, result.point);
    curveOrderById.set(node.id, result.order);
    indexFraction = result.nextFraction;
  });

  return { hints, curveOrderById, fallbackCount };
}

export type StableVoronoiOptions = CapacityOptions & {
  /** Thesis Algorithm 6 uses order 8 in the implementation. */
  hilbertOrder?: number;
  hilbertVariant?: "algorithm-6-fixed" | "algorithm-8-variable";
  maxIterations?: number;
  tolerance?: number;
};

export type StableVoronoiResult = {
  state: CapacityLayoutState;
  converged: boolean;
  initialization: {
    variant: "algorithm-6-fixed" | "algorithm-8-variable";
    curveOrderById: Map<string, number>;
    fallbackCount: number;
  };
};

/**
 * Paper-derived baseline: Algorithm 6 or 8 Hilbert initialization followed by
 * the Sprawlens capacity power solver. This is not the paper's Algorithm 9 AWP
 * sweep-line implementation and must be reported as a reimplementation.
 */
export function solveStableVoronoi(
  nodes: readonly CellInputNode[],
  clip: ClipRegion,
  options: StableVoronoiOptions = {},
): StableVoronoiResult {
  const {
    hilbertOrder = 8,
    hilbertVariant = "algorithm-6-fixed",
    maxIterations = 5_000,
    tolerance = 0.01,
    ...capacityOptions
  } = options;
  const placement =
    hilbertVariant === "algorithm-8-variable"
      ? stableVariableHilbertHints(nodes, clip)
      : {
          hints: stableHilbertHints(nodes, clip, hilbertOrder),
          curveOrderById: new Map(nodes.map((node) => [node.id, hilbertOrder])),
          fallbackCount: 0,
        };
  let state = createCapacityLayout(
    nodes.map((node) => ({ ...node, hint: placement.hints.get(node.id) })),
    clip,
    capacityOptions,
  );
  while (state.iteration < maxIterations && !isConverged(state, tolerance)) {
    state = capacityStep(state);
  }
  return {
    state,
    converged: isConverged(state, tolerance),
    initialization: {
      variant: hilbertVariant,
      curveOrderById: placement.curveOrderById,
      fallbackCount: placement.fallbackCount,
    },
  };
}
