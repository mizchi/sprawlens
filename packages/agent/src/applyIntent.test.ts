import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { applyIntent } from "./applyIntent.ts";
import { indexGraph } from "./graphQuery.ts";
import { initialView } from "./viewState.ts";

const file = (id: string) => ({
  id,
  kind: "file" as const,
  label: id.split("/").pop()!,
  metrics: { loc: 10 },
});
const graph: AtlasGraph = {
  nodes: [file("src/app/main.ts"), file("src/core/lib.ts"), file("src/db/store.ts")],
  edges: [
    { source: "src/app/main.ts", target: "src/core/lib.ts" },
    { source: "src/core/lib.ts", target: "src/db/store.ts" },
  ],
};
const idx = indexGraph(graph);

describe("applyIntent — navigation", () => {
  it("focus selects the target, frames it, and summarizes it", () => {
    const { view, result } = applyIntent(idx, initialView, {
      type: "focus",
      target: "src/core/lib.ts",
    });
    expect(view.selection).toEqual(["src/core/lib.ts"]);
    expect(view.camera.target).toBe("src/core/lib.ts");
    expect(result.kind).toBe("navigated");
    if (result.kind === "navigated") expect(result.summary).toContain("src/core/lib.ts");
  });

  it("does not mutate the input view (pure)", () => {
    const before = structuredClone(initialView);
    applyIntent(idx, initialView, { type: "focus", target: "src/core/lib.ts" });
    expect(initialView).toEqual(before);
  });

  it("rejects an unknown focus target", () => {
    const { view, result } = applyIntent(idx, initialView, { type: "focus", target: "ghost" });
    expect(result.kind).toBe("error");
    expect(view).toBe(initialView);
  });

  it("setLayout / setGranularity / setTilt advance the view", () => {
    let v = initialView;
    v = applyIntent(idx, v, { type: "setLayout", layout: "treemap" }).view;
    v = applyIntent(idx, v, { type: "setGranularity", granularity: "symbol" }).view;
    v = applyIntent(idx, v, { type: "setTilt", tilt: { enabled: true, pitch: 0.5 } }).view;
    expect(v.layout).toBe("treemap");
    expect(v.granularity).toBe("symbol");
    expect(v.tilt).toEqual({ enabled: true, theta: 0, pitch: 0.5 });
  });

  it("additive select unions the selection", () => {
    const a = applyIntent(idx, initialView, { type: "select", ids: ["src/app/main.ts"] }).view;
    const b = applyIntent(idx, a, {
      type: "select",
      ids: ["src/core/lib.ts"],
      additive: true,
    }).view;
    expect(b.selection.sort()).toEqual(["src/app/main.ts", "src/core/lib.ts"]);
  });

  it("home clears selection and frames everything", () => {
    const focused = applyIntent(idx, initialView, {
      type: "focus",
      target: "src/app/main.ts",
    }).view;
    const { view } = applyIntent(idx, focused, { type: "home" });
    expect(view.selection).toEqual([]);
    expect(view.camera.target).toBeNull();
  });
});

describe("applyIntent — queries leave the view unchanged", () => {
  it("dependencies returns data without navigating", () => {
    const { view, result } = applyIntent(idx, initialView, {
      type: "dependencies",
      target: "src/app/main.ts",
    });
    expect(view).toBe(initialView);
    expect(result.kind).toBe("data");
  });

  it("impact reports the upstream closure", () => {
    const { result } = applyIntent(idx, initialView, { type: "impact", target: "src/db/store.ts" });
    if (result.kind !== "data") throw new Error("expected data");
    const r = result.data as { count: number };
    expect(r.count).toBe(2); // main + lib
  });

  it("find returns ranked matches", () => {
    const { result } = applyIntent(idx, initialView, { type: "find", query: "lib" });
    if (result.kind !== "data") throw new Error("expected data");
    expect((result.data as { id: string }[])[0]?.id).toBe("src/core/lib.ts");
  });
});
