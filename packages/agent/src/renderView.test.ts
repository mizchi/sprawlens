import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { indexGraph } from "./graphQuery.ts";
import { renderView } from "./renderView.ts";
import { initialView } from "./viewState.ts";

const file = (id: string, loc = 10) => ({
  id,
  kind: "file" as const,
  label: id.split("/").pop()!,
  metrics: { loc },
});
const graph: AtlasGraph = {
  nodes: [
    file("src/app/main.ts"),
    file("src/app/util.ts"),
    file("src/core/lib.ts"),
    file("src/db/store.ts"),
  ],
  edges: [
    { source: "src/app/main.ts", target: "src/core/lib.ts" },
    { source: "src/app/util.ts", target: "src/core/lib.ts" },
    { source: "src/core/lib.ts", target: "src/db/store.ts" },
  ],
};
const idx = indexGraph(graph);

const viewBoxOf = (svg: string) => /viewBox="([^"]+)"/.exec(svg)?.[1];
const rectCount = (svg: string) => (svg.match(/<rect /g) ?? []).length;

describe("renderView", () => {
  it("emits an svg document with the full canvas viewBox by default", () => {
    const svg = renderView(idx, initialView);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    expect(viewBoxOf(svg)).toBe("0 0 960 640");
  });

  it("draws a rect for the background, every module, and every file", () => {
    // 1 bg + 3 modules (app/core/db) + 4 files
    expect(rectCount(renderView(idx, initialView))).toBe(1 + 3 + 4);
  });

  it("labels the modules", () => {
    const svg = renderView(idx, initialView);
    expect(svg).toContain(">src/app<");
    expect(svg).toContain(">src/core<");
  });

  it("is deterministic", () => {
    expect(renderView(idx, initialView)).toBe(renderView(idx, initialView));
  });

  it("crops the viewBox to a focused module", () => {
    const view = { ...initialView, selection: ["src/core"], camera: { target: "src/core" } };
    expect(viewBoxOf(renderView(idx, view))).not.toBe("0 0 960 640");
  });

  it("outlines the selection with the select color", () => {
    const view = { ...initialView, selection: ["src/core/lib.ts"], camera: { target: null } };
    expect(renderView(idx, view)).toContain(THEME_SELECT_LIGHT);
  });

  it("tints a focus target's dependencies and dependents", () => {
    // focus lib.ts: it depends on store.ts (dep tint) and main/util depend on it (dependent tint)
    const view = { ...initialView, camera: { target: "src/core/lib.ts" } };
    const svg = renderView(idx, view);
    expect(svg).toContain("hsl(21 90% 86%)"); // downstream/dependency fill
    expect(svg).toContain("hsl(193 70% 86%)"); // upstream/dependent fill
  });

  it("honors the dark theme background", () => {
    expect(renderView(idx, initialView, { theme: "dark" })).toContain('fill="#111827"');
  });
});

const THEME_SELECT_LIGHT = "#1d4ed8";
