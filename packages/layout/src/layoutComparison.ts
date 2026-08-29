import type { AtlasEdge } from "@sprawlens/contracts";
import { centroid, polygonIoU, type Ring } from "./polygon.ts";
import type { Vec2 } from "./vec.ts";

export type ComparableCell = {
  id: string;
  site: Vec2;
  polygon: Ring;
};

export type TemporalGeometryMetrics = {
  centroidDisplacement: number;
  polygonIoULoss: number;
  relativeDirectionChange: number;
};

export type ConstraintGraphDistanceMetrics = {
  constraintPathMedian: number;
  constraintPathMax: number;
  constraintDisconnectedRate: number;
  constraintEdgeCount: number;
};

/** Evaluation-only temporal metrics; none participate in layout selection. */
export function compareLayoutGeometry(
  before: readonly ComparableCell[],
  after: readonly ComparableCell[],
  scale: number,
): TemporalGeometryMetrics {
  const beforeById = new Map(before.map((cell) => [cell.id, cell] as const));
  const surviving = after
    .flatMap((cell) => {
      const previous = beforeById.get(cell.id);
      return previous ? [{ before: previous, after: cell }] : [];
    })
    .sort((left, right) => left.after.id.localeCompare(right.after.id));
  let centroidDisplacement = 0;
  let polygonIoULoss = 0;
  for (const pair of surviving) {
    const previousCentroid = centroid(pair.before.polygon);
    const currentCentroid = centroid(pair.after.polygon);
    centroidDisplacement +=
      Math.hypot(currentCentroid.x - previousCentroid.x, currentCentroid.y - previousCentroid.y) /
      Math.max(scale, 1e-12);
    polygonIoULoss += 1 - polygonIoU(pair.before.polygon, pair.after.polygon);
  }
  centroidDisplacement /= Math.max(1, surviving.length);
  polygonIoULoss /= Math.max(1, surviving.length);

  let relativeDirectionChange = 0;
  let relativePairs = 0;
  for (let leftIndex = 0; leftIndex < surviving.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < surviving.length; rightIndex++) {
      const left = surviving[leftIndex]!;
      const right = surviving[rightIndex]!;
      const beforeVector = {
        x: right.before.site.x - left.before.site.x,
        y: right.before.site.y - left.before.site.y,
      };
      const afterVector = {
        x: right.after.site.x - left.after.site.x,
        y: right.after.site.y - left.after.site.y,
      };
      const beforeLength = Math.hypot(beforeVector.x, beforeVector.y);
      const afterLength = Math.hypot(afterVector.x, afterVector.y);
      if (beforeLength <= 1e-12 || afterLength <= 1e-12) continue;
      const cosine =
        (beforeVector.x * afterVector.x + beforeVector.y * afterVector.y) /
        (beforeLength * afterLength);
      relativeDirectionChange += Math.acos(Math.max(-1, Math.min(1, cosine))) / Math.PI;
      relativePairs++;
    }
  }
  relativeDirectionChange /= Math.max(1, relativePairs);
  return { centroidDisplacement, polygonIoULoss, relativeDirectionChange };
}

const shortestPath = (
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  source: string,
  target: string,
): number | undefined => {
  const visited = new Set([source]);
  let frontier = [source];
  let distance = 0;
  while (frontier.length > 0) {
    distance++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (neighbor === target) return distance;
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return undefined;
};

/** Topological severity of dependency constraints on the realized cell graph. */
export function constraintGraphDistance(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  edges: readonly AtlasEdge[],
): ConstraintGraphDistanceMetrics {
  const distances: number[] = [];
  let disconnected = 0;
  const sentinel = adjacency.size;
  for (const edge of edges) {
    if (edge.source === edge.target || !adjacency.has(edge.source) || !adjacency.has(edge.target)) {
      continue;
    }
    const distance = shortestPath(adjacency, edge.source, edge.target);
    if (distance === undefined) disconnected++;
    distances.push(distance ?? sentinel);
  }
  if (distances.length === 0) {
    return {
      constraintPathMedian: 0,
      constraintPathMax: 0,
      constraintDisconnectedRate: 0,
      constraintEdgeCount: 0,
    };
  }
  distances.sort((left, right) => left - right);
  const middle = Math.floor(distances.length / 2);
  const constraintPathMedian =
    distances.length % 2 === 0
      ? (distances[middle - 1]! + distances[middle]!) / 2
      : distances[middle]!;
  return {
    constraintPathMedian,
    constraintPathMax: distances.at(-1)!,
    constraintDisconnectedRate: disconnected / distances.length,
    constraintEdgeCount: distances.length,
  };
}
