import { describe, expect, it } from "vitest";
import type { CfgAnchor } from "./CfgLayer.tsx";
import { makeEdgeEndpointResolver } from "./edgeEndpoints.ts";

const pos = new Map([
  ["a", { x: 0, y: 0 }],
  ["b", { x: 10, y: 0 }],
]);
const positionOf = (id: string) => pos.get(id);

describe("makeEdgeEndpointResolver", () => {
  it("resolves source/target to their positions", () => {
    const resolve = makeEdgeEndpointResolver({
      positionOf,
      cfgAnchors: new Map(),
      symbolNameOf: () => undefined,
    });
    expect(resolve({ source: "a", target: "b" })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("returns null when either endpoint has no position", () => {
    const resolve = makeEdgeEndpointResolver({
      positionOf,
      cfgAnchors: new Map(),
      symbolNameOf: () => undefined,
    });
    expect(resolve({ source: "a", target: "missing" })).toBeNull();
  });

  it("re-anchors the source to the CFG call site for the target's name", () => {
    const cfg: CfgAnchor = {
      entry: { x: -1, y: -1 },
      calls: new Map([["beta", { x: 3, y: 4 }]]),
    };
    const resolve = makeEdgeEndpointResolver({
      positionOf,
      cfgAnchors: new Map([["a", cfg]]),
      symbolNameOf: (id) => (id === "b" ? "beta" : undefined),
    });
    // source 'a' has a CFG; the call to 'beta' (target's name) anchors a
    expect(resolve({ source: "a", target: "b" })).toEqual([
      { x: 3, y: 4 },
      { x: 10, y: 0 },
    ]);
  });

  it("re-anchors the target to the CFG entry terminal", () => {
    const cfg: CfgAnchor = { entry: { x: 7, y: 8 }, calls: new Map() };
    const resolve = makeEdgeEndpointResolver({
      positionOf,
      cfgAnchors: new Map([["b", cfg]]),
      symbolNameOf: () => undefined,
    });
    expect(resolve({ source: "a", target: "b" })).toEqual([
      { x: 0, y: 0 },
      { x: 7, y: 8 },
    ]);
  });

  it("keeps the base position when the CFG has no matching call", () => {
    const cfg: CfgAnchor = { entry: { x: 0, y: 0 }, calls: new Map() };
    const resolve = makeEdgeEndpointResolver({
      positionOf,
      cfgAnchors: new Map([["a", cfg]]),
      symbolNameOf: () => "nope",
    });
    expect(resolve({ source: "a", target: "b" })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });
});
