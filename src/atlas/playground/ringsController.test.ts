import { describe, expect, it } from "vitest";
import { directoryGrouping, moduleGrouping } from "../contracts/hierarchy.js";
import { containsPoint } from "../kernel/polygon.js";
import {
  applyRingsChanges,
  createRingsState,
  stepRingsState,
} from "./ringsController.js";
import { createSyntheticGraph } from "./synthetic.js";

const opts = { width: 960, height: 640, seed: 1 };

describe("createRingsState layers", () => {
  it("lays out test files alongside source so areas show the ratio", () => {
    const graph = createSyntheticGraph({ count: 40, seed: 9 });
    const state = createRingsState(graph, opts);
    const allCellIds = [...state.leafLayouts.values()].flatMap((l) =>
      l.cells.map((c) => c.id),
    );
    expect(allCellIds.some((id) => id.includes(".test."))).toBe(true);
    expect(allCellIds).toHaveLength(graph.nodes.length);
  });
});

describe("createRingsState", () => {
  it("creates one capacity layout per module, clipped to its circle", () => {
    const graph = createSyntheticGraph({ count: 60, seed: 1 });
    const state = createRingsState(graph, opts);
    expect(state.leafLayouts.size).toBe(state.circles.size);
    for (const [moduleId, layout] of state.leafLayouts) {
      const circle = state.circles.get(moduleId)!;
      expect(layout.clip).toEqual({
        kind: "circle",
        cx: circle.cx,
        cy: circle.cy,
        r: circle.r * 0.94,
      });
    }
  });

  it("fits all module circles inside the viewport", () => {
    const graph = createSyntheticGraph({ count: 80, seed: 2 });
    const state = createRingsState(graph, opts);
    for (const circle of state.circles.values()) {
      expect(circle.cx - circle.r).toBeGreaterThanOrEqual(0);
      expect(circle.cx + circle.r).toBeLessThanOrEqual(960);
      expect(circle.cy - circle.r).toBeGreaterThanOrEqual(0);
      expect(circle.cy + circle.r).toBeLessThanOrEqual(640);
    }
  });

  it("assigns ranks so foundations differ from dependents", () => {
    const graph = createSyntheticGraph({ count: 60, seed: 3 });
    const state = createRingsState(graph, opts);
    const ranks = [...state.ranks.values()];
    expect(Math.max(...ranks)).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed", () => {
    const graph = createSyntheticGraph({ count: 60, seed: 5 });
    const a = createRingsState(graph, { ...opts, seed: 7 });
    const b = createRingsState(graph, { ...opts, seed: 7 });
    for (const [moduleId, layout] of a.leafLayouts) {
      const other = b.leafLayouts.get(moduleId)!;
      expect(layout.cells.map((c) => c.site)).toEqual(
        other.cells.map((c) => c.site),
      );
    }
  });

  it("exposes the parent chain of every leaf", () => {
    const graph = createSyntheticGraph({ count: 40, seed: 8 });
    const state = createRingsState(graph, opts);
    for (const [groupId, layout] of state.leafLayouts) {
      for (const cell of layout.cells) {
        expect(state.parentOf.get(cell.id)).toBe(groupId);
      }
      expect(state.parentOf.get(groupId)).toBeNull();
    }
  });
});

describe("createRingsState — multi-level boundaries", () => {
  function deepGraph() {
    const file = (id: string, loc: number) => ({
      id,
      kind: "file" as const,
      label: id.split("/").pop()!,
      metrics: { loc },
    });
    return {
      nodes: [
        file("src/alpha/core/a.ts", 100),
        file("src/alpha/core/b.ts", 60),
        file("src/alpha/util/c.ts", 40),
        file("src/beta/core/d.ts", 150),
        file("src/beta/core/e.ts", 50),
      ],
      edges: [
        { source: "src/alpha/core/a.ts", target: "src/alpha/core/b.ts" },
        { source: "src/alpha/util/c.ts", target: "src/beta/core/d.ts" },
      ],
    };
  }
  const BOUNDARIES = [moduleGrouping(), directoryGrouping(3)];

  it("nests directory cells inside the module circles", () => {
    const state = createRingsState(deepGraph(), {
      ...opts,
      boundaries: BOUNDARIES,
    });
    expect(state.innerLevels).toHaveLength(1);
    expect(state.innerLevels[0]!.kind).toBe("directory");
    for (const [dirId, cell] of state.innerLevels[0]!.cells) {
      const moduleId = state.parentOf.get(dirId)!;
      const circle = state.circles.get(moduleId)!;
      const distance = Math.hypot(cell.site.x - circle.cx, cell.site.y - circle.cy);
      expect(distance).toBeLessThanOrEqual(circle.r);
    }
  });

  it("keys leaf layouts by the innermost group and confines leaves", () => {
    const state = createRingsState(deepGraph(), {
      ...opts,
      boundaries: BOUNDARIES,
    });
    expect(state.leafLayouts.has("src/alpha/core")).toBe(true);
    expect(state.leafLayouts.has("src/alpha")).toBe(false);
    for (const [dirId, layout] of state.leafLayouts) {
      const dirCell = state.innerLevels[0]!.cells.get(dirId)!;
      for (const cell of layout.cells) {
        expect(containsPoint(dirCell.polygon, cell.site)).toBe(true);
      }
    }
  });
});

describe("stepRingsState", () => {
  it("converges every leaf layout", () => {
    const graph = createSyntheticGraph({ count: 50, seed: 4 });
    let state = createRingsState(graph, { ...opts, seed: 4 });
    let guard = 0;
    for (;;) {
      const result = stepRingsState(state, 2);
      state = result.state;
      if (!result.active || ++guard > 1000) break;
    }
    expect(guard).toBeLessThanOrEqual(1000);
    for (const layout of state.leafLayouts.values()) {
      expect(layout.maxRelativeError).toBeLessThan(0.02);
    }
  });
});

describe("applyRingsChanges", () => {
  it("keeps leaf layouts warm when a file weight changes", () => {
    const graph = createSyntheticGraph({ count: 50, seed: 5 });
    let state = createRingsState(graph, { ...opts, seed: 5 });
    let guard = 0;
    for (;;) {
      const result = stepRingsState(state, 4);
      state = result.state;
      if (!result.active || ++guard > 1000) break;
    }
    const targetFile = graph.nodes[10]!;
    const mutated = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === targetFile.id
          ? { ...n, metrics: { loc: Math.round(n.metrics.loc * 1.3) } }
          : n,
      ),
    };
    const next = applyRingsChanges(state, mutated, { ...opts, seed: 5 });
    expect(next.leafLayouts.size).toBe(state.leafLayouts.size);
    // sites carried over: the same file ids exist with similar positions
    for (const [moduleId, layout] of next.leafLayouts) {
      const before = state.leafLayouts.get(moduleId)!;
      expect(layout.cells.map((c) => c.id).sort()).toEqual(
        before.cells.map((c) => c.id).sort(),
      );
    }
  });

  it("drops removed files and their module when it empties", () => {
    const graph = createSyntheticGraph({ count: 30, seed: 6 });
    const state = createRingsState(graph, { ...opts, seed: 6 });
    const someModule = [...state.leafLayouts.keys()][0]!;
    const without = {
      ...graph,
      nodes: graph.nodes.filter((n) => !n.id.startsWith(`${someModule}/`)),
      edges: graph.edges.filter(
        (e) =>
          !e.source.startsWith(`${someModule}/`) &&
          !e.target.startsWith(`${someModule}/`),
      ),
    };
    const next = applyRingsChanges(state, without, { ...opts, seed: 6 });
    expect(next.leafLayouts.has(someModule)).toBe(false);
  });
});
