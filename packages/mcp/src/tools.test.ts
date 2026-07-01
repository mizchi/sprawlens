import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { indexGraph } from "@sprawlens/agent";
import { Session, TOOLS } from "./index.ts";

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

describe("TOOLS listing", () => {
  it("advertises the query tools plus get_view, each with an object schema", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "dependencies",
        "impact",
        "find",
        "describe",
        "lens",
        "focus",
        "get_view",
      ]),
    );
    for (const t of TOOLS) expect(t.inputSchema.type).toBe("object");
  });

  it("marks required params", () => {
    expect(TOOLS.find((t) => t.name === "dependencies")?.inputSchema.required).toEqual(["target"]);
  });
});

describe("Session", () => {
  it("answers a query tool with data", () => {
    const r = new Session(idx).call("impact", { target: "src/db/store.ts" });
    if (r.kind !== "data") throw new Error("expected data");
    expect((r.data as { count: number }).count).toBe(2);
  });

  it("focus advances the carried view state", () => {
    const s = new Session(idx);
    expect(s.view.selection).toEqual([]);
    const r = s.call("focus", { target: "src/core/lib.ts" });
    expect(r.kind).toBe("navigated");
    expect(s.view.selection).toEqual(["src/core/lib.ts"]);
    expect(s.view.camera.target).toBe("src/core/lib.ts");
  });

  it("get_view reflects the navigated state", () => {
    const s = new Session(idx);
    s.call("focus", { target: "src/app/main.ts" });
    const r = s.call("get_view");
    if (r.kind !== "data") throw new Error("expected data");
    expect((r.data as { selection: string[] }).selection).toEqual(["src/app/main.ts"]);
  });

  it("render returns an SVG document for the current view", () => {
    const s = new Session(idx);
    s.call("focus", { target: "src/core/lib.ts" });
    const r = s.call("render");
    if (r.kind !== "data") throw new Error("expected data");
    expect(typeof r.data).toBe("string");
    expect(r.data as string).toContain("<svg");
  });

  it("reports an error for an unknown tool", () => {
    expect(new Session(idx).call("nope").kind).toBe("error");
  });

  it("see_repo renders a focused lens SVG without changing the carried view", () => {
    const s = new Session(idx);
    const r = s.call("see_repo", { target: "src/core/lib.ts", direction: "both" });
    if (r.kind !== "data") throw new Error("expected data");
    expect(r.data as string).toContain("<svg");
    expect(r.data as string).toContain("Agent Lens");
    expect(s.view.selection).toEqual([]);
  });

  it("surfaces an unresolvable target as an error result", () => {
    expect(new Session(idx).call("describe", { target: "ghost" }).kind).toBe("error");
  });
});
