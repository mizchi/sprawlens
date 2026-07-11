import { describe, expect, it } from "vitest";
import {
  initialView,
  normalizeViewState,
  parseViewState,
  serializeViewState,
  type ViewState,
} from "./viewState.ts";

describe("ViewState wire contract", () => {
  it("round-trips every render-affecting and evidence cursor field", () => {
    const view: ViewState = {
      version: 1,
      layout: "treemap",
      granularity: "symbol",
      hierarchy: {
        boundaries: ["module", "directory", "class"],
        displayLevels: ["module", "directory", "class", "symbol", "cfg"],
      },
      weight: "complexity",
      stableLayout: true,
      theme: "dark",
      viewport: { width: 1440, height: 900 },
      seed: 42,
      selection: ["symbol:src/main.ts:function:main:1"],
      camera: { target: "src", center: { x: 12.5, y: 9 }, zoom: 2.25 },
      hiddenLayers: ["test", "deps"],
      showEdges: true,
      showDiff: true,
      trace: { id: "trace-7", timeUs: 123_456 },
      tilt: { enabled: true, theta: 0.3, pitch: 0.6 },
    };

    expect(parseViewState(serializeViewState(view))).toEqual(view);
  });

  it("migrates the old partial state and rejects invalid enum/numeric values", () => {
    expect(
      normalizeViewState({
        layout: "bad",
        granularity: "file",
        selection: ["a", 1, "a"],
        camera: { target: "a", center: { x: "bad", y: 2 }, zoom: -4 },
        seed: Number.NaN,
        tilt: { enabled: true, theta: Number.POSITIVE_INFINITY, pitch: 0.4 },
      }),
    ).toEqual({
      ...initialView,
      granularity: "file",
      selection: ["a"],
      camera: { target: "a", center: null, zoom: null },
      tilt: { enabled: true, theta: 0, pitch: 0.4 },
    });
  });

  it("returns a fresh normalized object rather than sharing mutable arrays", () => {
    const normalized = normalizeViewState(initialView);
    expect(normalized).toEqual(initialView);
    expect(normalized).not.toBe(initialView);
    expect(normalized.selection).not.toBe(initialView.selection);
    expect(normalized.hiddenLayers).not.toBe(initialView.hiddenLayers);
  });
});
