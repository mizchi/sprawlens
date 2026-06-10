import { describe, expect, it } from "vitest";
import {
  applyRingsChanges,
  createRingsState,
  stepRingsState,
} from "./ringsController.js";
import { createSyntheticGraph } from "./synthetic.js";

const opts = { width: 960, height: 640, seed: 1 };

describe("createRingsState", () => {
  it("creates one capacity layout per module, clipped to its circle", () => {
    const graph = createSyntheticGraph({ count: 60, seed: 1 });
    const state = createRingsState(graph, opts);
    expect(state.moduleLayouts.size).toBe(state.circles.size);
    for (const [moduleId, layout] of state.moduleLayouts) {
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
});

describe("stepRingsState", () => {
  it("converges every module layout", () => {
    const graph = createSyntheticGraph({ count: 50, seed: 4 });
    let state = createRingsState(graph, { ...opts, seed: 4 });
    let guard = 0;
    for (;;) {
      const result = stepRingsState(state, 2);
      state = result.state;
      if (!result.active || ++guard > 1000) break;
    }
    expect(guard).toBeLessThanOrEqual(1000);
    for (const layout of state.moduleLayouts.values()) {
      expect(layout.maxRelativeError).toBeLessThan(0.02);
    }
  });
});

describe("applyRingsChanges", () => {
  it("keeps module layouts warm when a file weight changes", () => {
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
    expect(next.moduleLayouts.size).toBe(state.moduleLayouts.size);
    // sites carried over: the same file ids exist with similar positions
    for (const [moduleId, layout] of next.moduleLayouts) {
      const before = state.moduleLayouts.get(moduleId)!;
      expect(layout.cells.map((c) => c.id).sort()).toEqual(
        before.cells.map((c) => c.id).sort(),
      );
    }
  });

  it("drops removed files and their module when it empties", () => {
    const graph = createSyntheticGraph({ count: 30, seed: 6 });
    const state = createRingsState(graph, { ...opts, seed: 6 });
    const someModule = [...state.moduleLayouts.keys()][0]!;
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
    expect(next.moduleLayouts.has(someModule)).toBe(false);
  });
});
