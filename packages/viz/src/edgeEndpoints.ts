import type { Vec2 } from "@sprawlens/layout";
import type { AtlasEdge } from "@sprawlens/schema";
import type { CfgAnchor } from "./CfgLayer.tsx";

/**
 * Resolve an edge's two endpoints to world positions, shared by both renderers
 * (the logic was copy-pasted as each renderer's `edgeEndpoints`). The caller
 * supplies its own `positionOf` — rings resolves through its multi-map
 * `resolveSite`, the treemap through its `positionOf` map — and this adds the
 * identical CFG re-anchoring: when an endpoint shows an expanded CFG, the source
 * snaps to the call site for the target's name and the target snaps to the CFG
 * entry terminal, so edges land on the call/entry blocks instead of the cell.
 */
export function makeEdgeEndpointResolver(opts: {
  positionOf: (id: string) => Vec2 | undefined;
  cfgAnchors: ReadonlyMap<string, CfgAnchor>;
  symbolNameOf: (id: string) => string | null | undefined;
}): (edge: AtlasEdge) => [Vec2, Vec2] | null {
  const { positionOf, cfgAnchors, symbolNameOf } = opts;
  return (edge) => {
    let a = positionOf(edge.source);
    let b = positionOf(edge.target);
    if (!a || !b) return null;
    const sourceCfg = cfgAnchors.get(edge.source);
    if (sourceCfg) {
      const name = symbolNameOf(edge.target);
      a = (name ? sourceCfg.calls.get(name) : undefined) ?? a;
    }
    const targetCfg = cfgAnchors.get(edge.target);
    if (targetCfg) b = targetCfg.entry;
    return [a, b];
  };
}
