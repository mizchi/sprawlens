import type { AtlasEdge } from "@sprawlens/contracts";
import { sampledMeanBoundaryDisplacement } from "./boundaryHausdorff.ts";
import { centroid, polygonIoU, type Ring } from "./polygon.ts";
import type { Vec2 } from "./vec.ts";

export type ComparableCell = {
  id: string;
  site: Vec2;
  polygon: Ring;
};

export type TemporalGeometryMetrics = {
  centroidDisplacement: number;
  boundaryDisplacement: number;
  polygonIoULoss: number;
  relativeDirectionChange: number;
};

export type ConstraintGraphDistanceMetrics = {
  constraintPathMedian: number;
  constraintPathMax: number;
  constraintDisconnectedRate: number;
  constraintEdgeCount: number;
};

const indexConfirmatoryCells = (cells: readonly ComparableCell[], side: "before" | "after") => {
  const byId = new Map<string, ComparableCell>();
  for (const cell of cells) {
    if (byId.has(cell.id)) throw new RangeError(`${side} has duplicate stable-cell ID ${cell.id}`);
    if (cell.polygon.length === 0) {
      throw new RangeError(`${side} must contain nonempty polygon boundaries`);
    }
    const coordinates = [cell.site, ...cell.polygon];
    if (coordinates.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {
      throw new RangeError(`${side} cell ${cell.id} contains a non-finite coordinate`);
    }
    byId.set(cell.id, cell);
  }
  return byId;
};

/**
 * Fail-closed domain check for same-endpoint confirmatory comparisons.
 * Unlike exploratory metrics, this contract does not silently intersect IDs
 * or map empty boundaries to zero.
 */
export function requireSameEndpointGeometryDomain(
  before: readonly ComparableCell[],
  after: readonly ComparableCell[],
) {
  const beforeById = indexConfirmatoryCells(before, "before");
  const afterById = indexConfirmatoryCells(after, "after");
  const ids = [...beforeById.keys()].sort((left, right) => left.localeCompare(right));
  if (ids.length === 0)
    throw new RangeError("same-endpoint domain requires at least one stable cell");
  if (ids.length !== afterById.size || ids.some((id) => !afterById.has(id))) {
    throw new RangeError("same-endpoint stable-cell ID sets differ");
  }
  return ids.map((id) => ({ before: beforeById.get(id)!, after: afterById.get(id)! }));
}

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
  let boundaryDisplacement = 0;
  let polygonIoULoss = 0;
  for (const pair of surviving) {
    const previousCentroid = centroid(pair.before.polygon);
    const currentCentroid = centroid(pair.after.polygon);
    centroidDisplacement +=
      Math.hypot(currentCentroid.x - previousCentroid.x, currentCentroid.y - previousCentroid.y) /
      Math.max(scale, 1e-12);
    boundaryDisplacement +=
      sampledMeanBoundaryDisplacement(pair.before.polygon, pair.after.polygon) /
      Math.max(scale, 1e-12);
    polygonIoULoss += 1 - polygonIoU(pair.before.polygon, pair.after.polygon);
  }
  centroidDisplacement /= Math.max(1, surviving.length);
  boundaryDisplacement /= Math.max(1, surviving.length);
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
  return {
    centroidDisplacement,
    boundaryDisplacement,
    polygonIoULoss,
    relativeDirectionChange,
  };
}

const graphAdjacency = (ids: ReadonlySet<string>, edges: readonly AtlasEdge[]) => {
  const adjacency = new Map([...ids].map((id) => [id, new Set<string>()] as const));
  for (const edge of edges) {
    if (edge.source === edge.target || !ids.has(edge.source) || !ids.has(edge.target)) continue;
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }
  return adjacency;
};

const distancesFrom = (adjacency: ReadonlyMap<string, ReadonlySet<string>>, source: string) => {
  const distances = new Map([[source, 0]]);
  let frontier = [source];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const distance = distances.get(id)! + 1;
      for (const neighbor of adjacency.get(id) ?? []) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, distance);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return distances;
};

/**
 * DCQ2-inspired error for persistent cell pairs. Lower is better: graph-distance
 * change and geometric-distance change agree. Disconnected pairs use the unit
 * sentinel so topology loss remains observable.
 */
export function distanceChangeFaithfulness(
  before: readonly ComparableCell[],
  after: readonly ComparableCell[],
  beforeEdges: readonly AtlasEdge[],
  afterEdges: readonly AtlasEdge[],
) {
  const beforeById = new Map(before.map((cell) => [cell.id, cell] as const));
  const afterById = new Map(after.map((cell) => [cell.id, cell] as const));
  const ids = [...beforeById.keys()]
    .filter((id) => afterById.has(id))
    .sort((left, right) => left.localeCompare(right));
  const idSet = new Set(ids);
  const beforeAdjacency = graphAdjacency(idSet, beforeEdges);
  const afterAdjacency = graphAdjacency(idSet, afterEdges);
  const beforePaths = new Map(ids.map((id) => [id, distancesFrom(beforeAdjacency, id)] as const));
  const afterPaths = new Map(ids.map((id) => [id, distancesFrom(afterAdjacency, id)] as const));
  const pairs: Array<{
    source: string;
    target: string;
    beforeGeometry: number;
    afterGeometry: number;
  }> = [];
  let geometricScale = 0;
  for (let left = 0; left < ids.length; left++) {
    for (let right = left + 1; right < ids.length; right++) {
      const source = ids[left]!;
      const target = ids[right]!;
      const beforeSource = centroid(beforeById.get(source)!.polygon);
      const beforeTarget = centroid(beforeById.get(target)!.polygon);
      const afterSource = centroid(afterById.get(source)!.polygon);
      const afterTarget = centroid(afterById.get(target)!.polygon);
      const beforeGeometry = Math.hypot(
        beforeTarget.x - beforeSource.x,
        beforeTarget.y - beforeSource.y,
      );
      const afterGeometry = Math.hypot(
        afterTarget.x - afterSource.x,
        afterTarget.y - afterSource.y,
      );
      geometricScale = Math.max(geometricScale, beforeGeometry, afterGeometry);
      pairs.push({ source, target, beforeGeometry, afterGeometry });
    }
  }
  const graphScale = Math.max(1, ids.length - 1);
  const error =
    pairs.reduce((sum, pair) => {
      const beforePath = beforePaths.get(pair.source)!.get(pair.target);
      const afterPath = afterPaths.get(pair.source)!.get(pair.target);
      const beforeGraph = beforePath === undefined ? 1 : beforePath / graphScale;
      const afterGraph = afterPath === undefined ? 1 : afterPath / graphScale;
      const graphChange = Math.abs(beforeGraph - afterGraph);
      const geometryChange =
        Math.abs(pair.beforeGeometry - pair.afterGeometry) / Math.max(geometricScale, 1e-12);
      return sum + Math.abs(graphChange - geometryChange);
    }, 0) / Math.max(1, pairs.length);
  return {
    distanceChangeFaithfulnessError: Math.abs(error) <= 1e-12 ? 0 : error,
    distanceChangePairCount: pairs.length,
  };
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
