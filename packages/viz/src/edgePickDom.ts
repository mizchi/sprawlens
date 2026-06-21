import type { Vec2 } from "@sprawlens/layout";
import {
  EDGE_PICK_DOMINANCE,
  EDGE_PICK_NODE_PX,
  EDGE_PICK_PX,
  pickEdgeAtPoint,
  type EdgePickCandidate,
} from "./edgePick.ts";

/**
 * Resolve the edge under a client point — the DOM-aware half of edge picking,
 * shared by both renderers (the pure geometry lives in edgePick.ts). Edges are
 * paint-through, so `elementFromPoint` reports the node/cell beneath the cursor:
 * over a node shape the grab radius tightens (the node stays selectable), over
 * empty canvas it stays wide. Returns the picked edge's endpoints, or null.
 */
export function resolveEdgeAtClient(
  clientX: number,
  clientY: number,
  clientToWorld: (x: number, y: number) => Vec2 | null,
  candidates: readonly EdgePickCandidate[],
  toViewScale: () => number,
): { source: string; target: string } | null {
  const tag = document.elementFromPoint(clientX, clientY)?.tagName?.toLowerCase();
  const px =
    tag === "circle" || tag === "polygon" ? EDGE_PICK_NODE_PX : EDGE_PICK_PX;
  const hit = pickEdgeAtPoint(
    clientToWorld,
    clientX,
    clientY,
    candidates,
    px * toViewScale(),
    EDGE_PICK_DOMINANCE,
  );
  return hit ? { source: hit.source, target: hit.target } : null;
}
