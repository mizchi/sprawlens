import type { AtlasEdge, Trace, TraceTimeline } from "@sprawlens/schema";
import { traceOverlay } from "@sprawlens/schema";
import type { FocusView } from "./useMapViewport.ts";

export type TraceExtractInput = {
  timeline?: TraceTimeline | null;
  trace?: Trace | null;
  moduleOfId: (id: string) => string;
  parentFileOf: (id: string) => string;
};

export function buildTraceExtractFocus(input: TraceExtractInput): FocusView | null {
  const symbolIds = new Set<string>();
  const edges = new Map<string, AtlasEdge>();
  const addSymbol = (id: string | null | undefined) => {
    if (id) symbolIds.add(id);
  };
  const addEdge = (source: string | null | undefined, target: string | null | undefined) => {
    if (!source || !target || source === target) return;
    edges.set(`${source}\t${target}`, { source, target, kind: "call" });
  };

  for (const step of input.timeline?.steps ?? []) {
    addSymbol(step.symbolId);
    for (const symbolId of step.stack) addSymbol(symbolId);
    for (let i = 0; i < step.stack.length - 1; i++) addEdge(step.stack[i], step.stack[i + 1]);
  }
  const steps = input.timeline?.steps ?? [];
  for (let i = 1; i < steps.length; i++) addEdge(steps[i - 1]!.symbolId, steps[i]!.symbolId);

  if (input.trace) {
    const overlay = traceOverlay(input.trace);
    for (const symbolId of Object.keys(overlay.nodeWeight)) addSymbol(symbolId);
    for (const edge of overlay.edges) addEdge(edge.from, edge.to);
  }

  if (symbolIds.size === 0) return null;

  const fileIds = new Set<string>();
  const moduleIds = new Set<string>();
  for (const symbolId of symbolIds) {
    const fileId = input.parentFileOf(symbolId);
    fileIds.add(fileId);
    moduleIds.add(input.moduleOfId(fileId));
  }

  return {
    level: "symbol",
    moduleIds,
    fileIds,
    symbolIds,
    downstreamEdges: [...edges.values()],
    upstreamEdges: [],
  };
}
