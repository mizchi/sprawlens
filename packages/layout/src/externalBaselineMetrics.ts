import type {
  AtlasEdge,
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutCellV1,
  ExternalLayoutGraphV1,
  ExternalLayoutPointV1,
  ExternalLayoutRunV1,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
} from "@sprawlens/contracts";
import { realizedEdgeRate } from "./neighborhood.ts";
import { compareLayoutGeometry, type ComparableCell } from "./layoutComparison.ts";
import {
  assessRingValidity,
  containsPointInConvexRing,
  convexPolygonUnionArea,
} from "./externalPolygonValidity.ts";
import { centroid, convexIntersection, signedArea } from "./polygon.ts";

function segmentsOverlap(
  a: ExternalLayoutPointV1,
  b: ExternalLayoutPointV1,
  c: ExternalLayoutPointV1,
  d: ExternalLayoutPointV1,
  epsilon: number,
): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const abLength = Math.hypot(abx, aby);
  const cdLength = Math.hypot(cdx, cdy);
  if (abLength <= epsilon || cdLength <= epsilon) return false;
  const directionCross = Math.abs(abx * cdy - aby * cdx);
  if (directionCross > epsilon * abLength * cdLength) return false;
  const offsetCross = Math.abs(abx * (c.y - a.y) - aby * (c.x - a.x));
  if (offsetCross > epsilon * abLength) return false;
  const useX = Math.abs(abx) >= Math.abs(aby);
  const first = useX ? [a.x, b.x] : [a.y, b.y];
  const second = useX ? [c.x, d.x] : [c.y, d.y];
  const overlap =
    Math.min(Math.max(...first), Math.max(...second)) -
    Math.max(Math.min(...first), Math.min(...second));
  return overlap > epsilon;
}

function shareBoundary(a: ExternalLayoutCellV1, b: ExternalLayoutCellV1, epsilon: number): boolean {
  for (let i = 0; i < a.polygon.length; i++) {
    const a0 = a.polygon[i]!;
    const a1 = a.polygon[(i + 1) % a.polygon.length]!;
    for (let j = 0; j < b.polygon.length; j++) {
      const b0 = b.polygon[j]!;
      const b1 = b.polygon[(j + 1) % b.polygon.length]!;
      if (segmentsOverlap(a0, a1, b0, b1, epsilon)) return true;
    }
  }
  return false;
}

/** Infer symmetric cell adjacency from polygons returned by an external solver. */
function externalCellAdjacency(
  cells: readonly ExternalLayoutCellV1[],
  scale: number,
): Map<string, Set<string>> {
  const adjacency = new Map(cells.map((cell) => [cell.id, new Set<string>()] as const));
  const epsilon = Math.max(scale * 1e-7, 1e-12);
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]!;
      const b = cells[j]!;
      if (!shareBoundary(a, b, epsilon)) continue;
      adjacency.get(a.id)!.add(b.id);
      adjacency.get(b.id)!.add(a.id);
    }
  }
  return adjacency;
}

function commonMetrics(
  run: ExternalLayoutRunV1,
  graph: ExternalLayoutGraphV1,
  anchors: ReadonlyMap<string, ExternalLayoutPointV1>,
  boundaryArea: number,
  scale: number,
) {
  const weightById = new Map(graph.nodes.map((node) => [node.id, Math.max(node.weight, 0)]));
  const totalWeight = [...weightById.values()].reduce((sum, weight) => sum + weight, 0);
  let meanAreaError = 0;
  let maxAreaError = 0;
  for (const cell of run.cells) {
    const targetArea =
      totalWeight > 0 ? (boundaryArea * (weightById.get(cell.id) ?? 0)) / totalWeight : 0;
    const actualArea = Math.abs(signedArea(cell.polygon));
    const error = Math.abs(actualArea - targetArea) / Math.max(targetArea, 1e-12);
    meanAreaError += error;
    maxAreaError = Math.max(maxAreaError, error);
  }
  meanAreaError /= Math.max(1, run.cells.length);
  const adjacency = realizedEdgeRate(
    externalCellAdjacency(run.cells, scale),
    graph.edges as AtlasEdge[],
  );
  const siteOf = new Map(run.cells.map((cell) => [cell.id, cell.site] as const));
  let edgeLength = 0;
  let edgeWeight = 0;
  for (const edge of graph.edges) {
    const source = siteOf.get(edge.source);
    const target = siteOf.get(edge.target);
    if (!source || !target || edge.source === edge.target) continue;
    const weight = Math.max(edge.weight ?? 1, 0);
    edgeLength += (weight * Math.hypot(target.x - source.x, target.y - source.y)) / scale;
    edgeWeight += weight;
  }
  edgeLength = edgeWeight > 0 ? edgeLength / edgeWeight : 0;
  let displacement = 0;
  let surviving = 0;
  for (const [id, anchor] of anchors) {
    const site = siteOf.get(id);
    if (!site) continue;
    displacement += Math.hypot(site.x - anchor.x, site.y - anchor.y) / scale;
    surviving++;
  }
  displacement /= Math.max(1, surviving);
  return {
    maxAreaError,
    meanAreaError,
    adjacency,
    edgeLength,
    displacement,
    objective: meanAreaError + 2 * (1 - adjacency + 0.18 * edgeLength) + 0.7 * displacement,
  };
}

/** Recompute external results with the same metric definitions used by Sprawlens. */
export function evaluateExternalLayoutBaselineResponse(
  response: ExternalLayoutBaselineResponseV1,
  request: ExternalLayoutBaselineRequestV1,
) {
  if (response.status !== "ok") {
    return {
      status: response.status,
      implementation: response.implementation,
      reason: response.reason,
    } as const;
  }
  const boundaryArea = Math.abs(signedArea(request.boundary));
  const xs = request.boundary.map(({ x }) => x);
  const ys = request.boundary.map(({ y }) => y);
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const beforeAnchors = new Map(response.before.cells.map((cell) => [cell.id, cell.site] as const));
  return {
    status: "ok" as const,
    implementation: response.implementation,
    before: {
      ...commonMetrics(response.before, request.before, beforeAnchors, boundaryArea, scale),
      steps: response.before.steps,
      converged: response.before.converged,
    },
    after: {
      ...commonMetrics(response.after, request.after, beforeAnchors, boundaryArea, scale),
      steps: response.after.steps,
      converged: response.after.converged,
    },
  };
}

const comparableCells = (
  cells: Extract<ExternalLayoutSequenceResponseV2, { status: "ok" }>["runs"][number]["cells"],
): {
  cells: Array<ComparableCell & { nativeSite: ExternalLayoutPointV1 | null }>;
  derivedSiteCount: number;
} => {
  let derivedSiteCount = 0;
  return {
    cells: cells.map((cell) => {
      const site = cell.site ?? centroid(cell.polygon);
      if (cell.site === undefined) derivedSiteCount++;
      return { id: cell.id, site, nativeSite: cell.site ?? null, polygon: cell.polygon };
    }),
    derivedSiteCount,
  };
};

const sequenceValidity = (
  cells: readonly (ComparableCell & { nativeSite: ExternalLayoutPointV1 | null })[],
  boundary: readonly ExternalLayoutPointV1[],
  boundaryArea: number,
  requireNativeSite: boolean,
) => {
  const cellAreas = cells.map((cell) => Math.abs(signedArea(cell.polygon)));
  const cellValidity = cells.map((cell) => assessRingValidity(cell.polygon));
  const totalCellArea = cellAreas.reduce((sum, area) => sum + area, 0);
  let overlapArea = 0;
  let outsideBoundaryArea = 0;
  const unionArea = convexPolygonUnionArea(
    cells.map(({ polygon }) => polygon),
    boundary,
  );
  for (let left = 0; left < cells.length; left++) {
    outsideBoundaryArea += Math.max(
      0,
      cellAreas[left]! - Math.abs(signedArea(convexIntersection(cells[left]!.polygon, boundary))),
    );
    for (let right = left + 1; right < cells.length; right++) {
      overlapArea += Math.abs(
        signedArea(convexIntersection(cells[left]!.polygon, cells[right]!.polygon)),
      );
    }
  }
  return {
    degenerateCellCount: cellAreas.filter((area) => area <= Math.max(boundaryArea * 1e-12, 1e-15))
      .length,
    nonConvexCellCount: cellValidity.filter(({ nonConvex }) => nonConvex).length,
    selfIntersectingCellCount: cellValidity.filter(({ selfIntersecting }) => selfIntersecting)
      .length,
    duplicateVertexCellCount: cellValidity.filter(({ duplicateVertex }) => duplicateVertex).length,
    zeroLengthEdgeCellCount: cellValidity.filter(({ zeroLengthEdge }) => zeroLengthEdge).length,
    nativeSiteMissingCount: requireNativeSite
      ? cells.filter(({ nativeSite }) => nativeSite === null).length
      : 0,
    nativeSiteOutsideCellCount: requireNativeSite
      ? cells.filter(
          ({ nativeSite, polygon }) =>
            nativeSite !== null && !containsPointInConvexRing(polygon, nativeSite),
        ).length
      : 0,
    areaCoverageError: Math.abs(totalCellArea - boundaryArea) / Math.max(boundaryArea, 1e-12),
    boundaryGapAreaRatio:
      unionArea === null
        ? null
        : Math.max(0, boundaryArea - unionArea) / Math.max(boundaryArea, 1e-12),
    overlapAreaRatio: overlapArea / Math.max(boundaryArea, 1e-12),
    outsideBoundaryAreaRatio: outsideBoundaryArea / Math.max(boundaryArea, 1e-12),
  };
};

const representativePointDisplacement = (
  before: readonly ComparableCell[],
  after: readonly ComparableCell[],
  scale: number,
) => {
  const beforeById = new Map(before.map((cell) => [cell.id, cell.site] as const));
  const distances = after.flatMap((cell) => {
    const previous = beforeById.get(cell.id);
    return previous
      ? [Math.hypot(cell.site.x - previous.x, cell.site.y - previous.y) / Math.max(scale, 1e-12)]
      : [];
  });
  return distances.reduce((sum, distance) => sum + distance, 0) / Math.max(1, distances.length);
};

/** Recompute sequence quality, validity, and temporal movement on the host side. */
export function evaluateExternalLayoutSequenceResponse(
  response: ExternalLayoutSequenceResponseV2,
  request: ExternalLayoutSequenceRequestV2,
) {
  if (response.status !== "ok") {
    return {
      status: response.status,
      implementation: response.implementation,
      reason: response.reason,
    } as const;
  }
  const boundaryArea = Math.abs(signedArea(request.boundary));
  const xs = request.boundary.map(({ x }) => x);
  const ys = request.boundary.map(({ y }) => y);
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const normalized = response.runs.map((run) => ({ ...run, ...comparableCells(run.cells) }));
  const initial = normalized[0]?.cells ?? [];
  const initialAnchors = new Map(initial.map((cell) => [cell.id, cell.site] as const));
  return {
    status: "ok" as const,
    implementation: response.implementation,
    boundaryValidity: assessRingValidity(request.boundary),
    runs: normalized.map((run, index) => ({
      snapshotId: run.snapshotId,
      derivedSiteCount: run.derivedSiteCount,
      validity: sequenceValidity(
        run.cells,
        request.boundary,
        boundaryArea,
        response.implementation.capabilities.siteSemantics === "native",
      ),
      ...commonMetrics(
        { cells: run.cells, steps: 0, converged: run.nativeConverged },
        request.snapshots[index]!.graph,
        initialAnchors,
        boundaryArea,
        scale,
      ),
      initialToCurrent: {
        representativePointDisplacement: representativePointDisplacement(initial, run.cells, scale),
        ...compareLayoutGeometry(initial, run.cells, scale),
      },
      work: run.work,
      nativeConverged: run.nativeConverged,
    })),
  };
}
