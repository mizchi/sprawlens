import { describe, expect, it } from "vitest";
import {
  relatedNodeIds,
  selectedEdgeDirection,
  selectedDependencyEdgeIds,
  syncedSelectedNodeId,
  shouldShowSymbolLabel,
  stableInspectorNode,
  symbolDependencyEdgesForMap,
  symbolDependencyRelatedNodeIds,
  visibleSymbolEdgesForSelection,
} from "./SymbolMapView.js";
import type { SymbolMapEdge, SymbolMapFrame, SymbolMapNode } from "../core/symbolMap.js";
import type { SymbolDependencyResult } from "../core/symbolDependencies.js";

function symbol(overrides: Partial<SymbolMapNode> = {}): SymbolMapNode {
  return {
    id: "symbol:file.ts:api",
    kind: "symbol",
    parentId: "file:file.ts",
    moduleId: "module:pkg",
    fileId: "file:file.ts",
    path: "file.ts",
    label: "api",
    loc: 4,
    exported: true,
    surface: "exported",
    fanIn: 0,
    fanOut: 0,
    crossModuleFanIn: 0,
    crossModuleFanOut: 0,
    status: "stable",
    x: 0,
    y: 0,
    r: 8,
    visibleAtZoom: 1,
    ...overrides,
  };
}

function moduleNode(overrides: Partial<SymbolMapNode> = {}): SymbolMapNode {
  return {
    id: "module:pkg",
    kind: "module",
    path: "pkg",
    label: "pkg",
    loc: 100,
    exported: false,
    surface: "internal",
    fanIn: 0,
    fanOut: 0,
    crossModuleFanIn: 0,
    crossModuleFanOut: 0,
    status: "stable",
    x: 0,
    y: 0,
    r: 20,
    visibleAtZoom: 0,
    ...overrides,
  };
}

function frame(nodes: SymbolMapNode[], edges: SymbolMapEdge[]): SymbolMapFrame {
  return {
    schemaVersion: 1,
    commitHash: "test",
    nodes,
    edges,
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    stats: { moduleCount: 1, fileCount: 1, symbolCount: nodes.length, publicSymbolCount: 0, edgeCount: edges.length },
  };
}

function edge(from: string, to: string, overrides: Partial<SymbolMapEdge> = {}): SymbolMapEdge {
  return {
    id: `edge:${from}->${to}`,
    scope: "symbol",
    from,
    to,
    fromModuleId: "module:pkg",
    toModuleId: "module:pkg",
    importCount: 1,
    crossModule: false,
    status: "stable",
    visibleAtZoom: 1,
    ...overrides,
  };
}

function dependencies(selectedId: string, incomingId: string, outgoingId: string): SymbolDependencyResult {
  return {
    schemaVersion: 1,
    source: "typescript-language-service",
    repoPath: "/repo",
    symbolId: selectedId,
    diagnostics: [],
    nodes: [],
    edges: [
      {
        id: `call:${incomingId}->${selectedId}:incoming`,
        kind: "call",
        direction: "incoming",
        fromSymbolId: incomingId,
        toSymbolId: selectedId,
        callCount: 1,
        locations: [],
      },
      {
        id: `call:${selectedId}->${outgoingId}:outgoing`,
        kind: "call",
        direction: "outgoing",
        fromSymbolId: selectedId,
        toSymbolId: outgoingId,
        callCount: 2,
        locations: [],
      },
    ],
  };
}

describe("symbol map visibility", () => {
  it("shows public labels early", () => {
    expect(shouldShowSymbolLabel(symbol({ surface: "public", crossModuleFanIn: 1 }), 0.8, false, false)).toBe(true);
  });

  it("hides low-fan exported labels at medium zoom", () => {
    expect(shouldShowSymbolLabel(symbol({ surface: "exported", fanIn: 0, fanOut: 0 }), 1.95, false, false)).toBe(false);
  });

  it("shows selected, related, and high-zoom labels", () => {
    expect(shouldShowSymbolLabel(symbol(), 1, true, false)).toBe(true);
    expect(shouldShowSymbolLabel(symbol(), 1, false, true)).toBe(true);
    expect(shouldShowSymbolLabel(symbol({ surface: "exported" }), 3.5, false, false)).toBe(true);
  });

  it("keeps inspector content stable while hovering another node", () => {
    const selected = symbol({ id: "symbol:selected", label: "selected" });
    const hovered = symbol({ id: "symbol:hovered", label: "hovered" });
    expect(stableInspectorNode(selected, hovered)).toBe(selected);
  });

  it("keeps a selected symbol when module focus updates to the same module", () => {
    const selected = symbol({ id: "symbol:file.ts:Page", moduleId: "module:pkg", label: "Page" });
    const map = frame([moduleNode({ id: "module:pkg" }), moduleNode({ id: "module:other", label: "other" }), selected], []);

    expect(syncedSelectedNodeId(map, selected.id, "module:pkg")).toBe(selected.id);
    expect(syncedSelectedNodeId(map, selected.id, "module:other")).toBe("module:other");
  });

  it("focuses only direct dependency edges for a selected symbol", () => {
    const selected = symbol({ id: "symbol:selected", label: "selected" });
    const incoming = symbol({ id: "symbol:incoming", label: "incoming" });
    const outgoing = symbol({ id: "symbol:outgoing", label: "outgoing" });
    const secondHop = symbol({ id: "symbol:secondHop", label: "secondHop" });
    const map = frame(
      [selected, incoming, outgoing, secondHop],
      [edge(incoming.id, selected.id), edge(selected.id, outgoing.id), edge(outgoing.id, secondHop.id)],
    );

    expect([...selectedDependencyEdgeIds(map, selected.id)].sort()).toEqual([`edge:${incoming.id}->${selected.id}`, `edge:${selected.id}->${outgoing.id}`].sort());
    expect(relatedNodeIds(map, selected.id)).toEqual(new Set([selected.id, incoming.id, outgoing.id]));
  });

  it("keeps selected dependency edges visible regardless of zoom", () => {
    const selected = symbol({ id: "symbol:selected", label: "selected" });
    const incoming = symbol({ id: "symbol:incoming", label: "incoming" });
    const outgoing = symbol({ id: "symbol:outgoing", label: "outgoing" });
    const far = symbol({ id: "symbol:far", label: "far" });
    const hiddenIncoming = edge(incoming.id, selected.id, { visibleAtZoom: 3 });
    const hiddenOutgoing = edge(selected.id, outgoing.id, { visibleAtZoom: 4 });
    const hiddenUnrelated = edge(outgoing.id, far.id, { visibleAtZoom: 2 });
    const map = frame([selected, incoming, outgoing, far], [hiddenIncoming, hiddenOutgoing, hiddenUnrelated]);
    const focusIds = selectedDependencyEdgeIds(map, selected.id);

    expect(visibleSymbolEdgesForSelection(map.edges, new Set(map.nodes.map((node) => node.id)), focusIds, 0.4)).toEqual({
      background: [],
      focus: [hiddenIncoming, hiddenOutgoing],
    });
    expect(selectedEdgeDirection(hiddenIncoming, selected.id)).toBe("incoming");
    expect(selectedEdgeDirection(hiddenOutgoing, selected.id)).toBe("outgoing");
    expect(selectedEdgeDirection(hiddenUnrelated, selected.id)).toBe("neutral");
  });

  it("suppresses background edges while a symbol is selected", () => {
    const selected = symbol({ id: "symbol:selected", label: "selected" });
    const incoming = symbol({ id: "symbol:incoming", label: "incoming" });
    const outgoing = symbol({ id: "symbol:outgoing", label: "outgoing" });
    const unrelatedA = symbol({ id: "symbol:unrelatedA", label: "unrelatedA" });
    const unrelatedB = symbol({ id: "symbol:unrelatedB", label: "unrelatedB" });
    const focus = edge(incoming.id, selected.id, { visibleAtZoom: 4 });
    const visibleUnrelated = edge(unrelatedA.id, unrelatedB.id, { visibleAtZoom: 1 });
    const map = frame([selected, incoming, outgoing, unrelatedA, unrelatedB], [focus, visibleUnrelated]);

    expect(
      visibleSymbolEdgesForSelection(map.edges, new Set(map.nodes.map((node) => node.id)), selectedDependencyEdgeIds(map, selected.id), 6, {
        selectedNodeId: selected.id,
        nodeById: new Map(map.nodes.map((node) => [node.id, node])),
      }),
    ).toEqual({
      background: [],
      focus: [focus],
    });
  });

  it("limits high-zoom background edges to the current viewport", () => {
    const nearA = symbol({ id: "symbol:nearA", label: "nearA", x: 0, y: 0 });
    const nearB = symbol({ id: "symbol:nearB", label: "nearB", x: 12, y: 8 });
    const farA = symbol({ id: "symbol:farA", label: "farA", x: 1000, y: 1000 });
    const farB = symbol({ id: "symbol:farB", label: "farB", x: 1020, y: 1020 });
    const nearEdge = edge(nearA.id, nearB.id, { visibleAtZoom: 1 });
    const farEdge = edge(farA.id, farB.id, { visibleAtZoom: 1 });
    const map = frame([nearA, nearB, farA, farB], [nearEdge, farEdge]);

    expect(
      visibleSymbolEdgesForSelection(map.edges, new Set(map.nodes.map((node) => node.id)), new Set(), 5, {
        nodeById: new Map(map.nodes.map((node) => [node.id, node])),
        view: { x: 0, y: 0, zoom: 5 },
        size: { width: 300, height: 240 },
      }),
    ).toEqual({
      background: [nearEdge],
      focus: [],
    });
  });

  it("turns on-demand symbol dependencies into focused map edges", () => {
    const selected = symbol({ id: "symbol:selected", label: "selected", moduleId: "module:app" });
    const incoming = symbol({ id: "symbol:incoming", label: "incoming", moduleId: "module:test" });
    const outgoing = symbol({ id: "symbol:outgoing", label: "outgoing", moduleId: "module:app" });
    const nodeById = new Map([selected, incoming, outgoing].map((node) => [node.id, node]));
    const result = dependencies(selected.id, incoming.id, outgoing.id);

    expect(symbolDependencyRelatedNodeIds(result, selected.id)).toEqual(new Set([incoming.id, outgoing.id]));
    expect(symbolDependencyEdgesForMap(result, nodeById)).toEqual([
      expect.objectContaining({
        id: `lsp-call:${incoming.id}->${selected.id}`,
        from: incoming.id,
        to: selected.id,
        crossModule: true,
        importCount: 1,
      }),
      expect.objectContaining({
        id: `lsp-call:${selected.id}->${outgoing.id}`,
        from: selected.id,
        to: outgoing.id,
        crossModule: false,
        importCount: 2,
      }),
    ]);
  });
});
