import type {
  AtlasEdge,
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutCellV1,
  ExternalLayoutGraphV1,
  ExternalLayoutPointV1,
  ExternalLayoutRunV1,
} from "@sprawlens/contracts";
import { realizedEdgeRate } from "./neighborhood.ts";
import { signedArea } from "./polygon.ts";

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
    steps: run.steps,
    converged: run.converged,
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
    before: commonMetrics(response.before, request.before, beforeAnchors, boundaryArea, scale),
    after: commonMetrics(response.after, request.after, beforeAnchors, boundaryArea, scale),
  };
}
