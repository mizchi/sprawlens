import { describe, expect, it } from "vitest";
import { shouldShowSymbolLabel, stableInspectorNode } from "./SymbolMapView.js";
import type { SymbolMapNode } from "../core/symbolMap.js";

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
});
