import { describe, expect, it } from "vitest";
import { drillZoomForNode, edgeRelationToSelection, nodeRelationToSelection, shouldShowNodeLabel } from "./DependencyGraphView.js";
import type { DependencyGraphEdge, DependencyGraphFrame, DependencyGraphNode } from "../core/dependencyGraph.js";

function edge(from: string, to: string, scope: DependencyGraphEdge["scope"] = "detail", modules?: { fromModuleId: string; toModuleId: string }): DependencyGraphEdge {
  return {
    id: `edge:${from}->${to}`,
    scope,
    from,
    to,
    importCount: 1,
    status: "stable",
    ...modules,
  };
}

function frame(edges: DependencyGraphEdge[], nodes: DependencyGraphNode[] = []): DependencyGraphFrame {
  return {
    schemaVersion: 1,
    commitHash: "abc",
    nodes,
    edges,
    breakdowns: {},
    bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  };
}

function node(kind: DependencyGraphNode["kind"], overrides: Partial<DependencyGraphNode> = {}): DependencyGraphNode {
  return {
    id: `${kind}:node`,
    kind,
    expanded: false,
    path: `${kind}.ts`,
    label: `${kind}.ts`,
    loc: 10,
    fileCount: kind === "module" ? 10 : 1,
    symbolCount: 0,
    fanIn: 0,
    fanOut: 0,
    inCycle: false,
    exported: true,
    status: "stable",
    hotspotScore: 0,
    x: 0,
    y: 0,
    r: 40,
    previewNodes: [],
    ...overrides,
  };
}

describe("dependency graph selection relations", () => {
  it("classifies outgoing edges as dependencies and incoming edges as dependents", () => {
    expect(edgeRelationToSelection(edge("api:selected.ts", "api:target.ts"), "api:selected.ts")).toBe("depends-on");
    expect(edgeRelationToSelection(edge("api:source.ts", "api:selected.ts"), "api:selected.ts")).toBe("used-by");
    expect(edgeRelationToSelection(edge("api:source.ts", "api:target.ts"), "api:selected.ts")).toBe("unrelated");
  });

  it("classifies neighbor nodes around the selected node", () => {
    const selectedFrame = frame([edge("api:selected.ts", "api:target.ts"), edge("api:source.ts", "api:selected.ts")]);

    expect(nodeRelationToSelection(selectedFrame, "api:selected.ts", "api:selected.ts")).toBe("selected");
    expect(nodeRelationToSelection(selectedFrame, "api:target.ts", "api:selected.ts")).toBe("dependency");
    expect(nodeRelationToSelection(selectedFrame, "api:source.ts", "api:selected.ts")).toBe("dependent");
    expect(nodeRelationToSelection(selectedFrame, "api:other.ts", "api:selected.ts")).toBe("unrelated");
  });

  it("treats module routes as the external contract boundary for selected API nodes", () => {
    const selectedFrame = frame([
      edge("port:out:module:pkg/a->module:pkg/b", "port:in:module:pkg/b->module:pkg/a", "module", {
        fromModuleId: "module:pkg/a",
        toModuleId: "module:pkg/b",
      }),
      edge("port:out:module:pkg/c->module:pkg/a", "port:in:module:pkg/a->module:pkg/c", "module", {
        fromModuleId: "module:pkg/c",
        toModuleId: "module:pkg/a",
      }),
      edge("api:selected.ts", "api:internal.ts"),
    ], [
      node("module", { id: "module:pkg/a" }),
      node("module", { id: "module:pkg/b" }),
      node("module", { id: "module:pkg/c" }),
      node("port", { id: "port:out:module:pkg/a->module:pkg/b", parentId: "module:pkg/a", peerModuleId: "module:pkg/b", portDirection: "out" }),
      node("port", { id: "port:in:module:pkg/b->module:pkg/a", parentId: "module:pkg/b", peerModuleId: "module:pkg/a", portDirection: "in" }),
      node("port", { id: "port:out:module:pkg/c->module:pkg/a", parentId: "module:pkg/c", peerModuleId: "module:pkg/a", portDirection: "out" }),
      node("port", { id: "port:in:module:pkg/a->module:pkg/c", parentId: "module:pkg/a", peerModuleId: "module:pkg/c", portDirection: "in" }),
    ]);

    expect(edgeRelationToSelection(edge("port:out:module:pkg/a->module:pkg/b", "port:in:module:pkg/b->module:pkg/a", "module", {
      fromModuleId: "module:pkg/a",
      toModuleId: "module:pkg/b",
    }), "api:selected.ts", "module:pkg/a")).toBe("depends-on");
    expect(edgeRelationToSelection(edge("port:out:module:pkg/c->module:pkg/a", "port:in:module:pkg/a->module:pkg/c", "module", {
      fromModuleId: "module:pkg/c",
      toModuleId: "module:pkg/a",
    }), "api:selected.ts", "module:pkg/a")).toBe("used-by");
    expect(nodeRelationToSelection(selectedFrame, "module:pkg/b", "api:selected.ts", "module:pkg/a")).toBe("dependency");
    expect(nodeRelationToSelection(selectedFrame, "module:pkg/c", "api:selected.ts", "module:pkg/a")).toBe("dependent");
    expect(nodeRelationToSelection(selectedFrame, "port:in:module:pkg/b->module:pkg/a", "api:selected.ts", "module:pkg/a")).toBe("dependency");
    expect(nodeRelationToSelection(selectedFrame, "port:out:module:pkg/c->module:pkg/a", "api:selected.ts", "module:pkg/a")).toBe("dependent");
  });

  it("uses a readable drill zoom for expanded modules", () => {
    expect(drillZoomForNode(node("module"), 0.65)).toBeGreaterThanOrEqual(3);
  });

  it("shows focused module child API labels even when fan is low", () => {
    expect(shouldShowNodeLabel(node("api", { fanIn: 0, fanOut: 0 }), 1.8, false, true, "unrelated")).toBe(true);
  });

  it("keeps port labels quiet until the contract is selected or deeply zoomed", () => {
    const port = node("port", { parentId: "module:pkg/a", peerModuleId: "module:pkg/b", portDirection: "out" });
    expect(shouldShowNodeLabel(port, 2.5, false, true, "dependency")).toBe(false);
    expect(shouldShowNodeLabel(port, 3.3, false, true, "dependency")).toBe(true);
    expect(shouldShowNodeLabel(port, 1, true, false, "selected")).toBe(true);
  });
});
