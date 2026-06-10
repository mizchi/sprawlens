import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";
import { ringLayout, type RingModule } from "./ringLayout.js";

function modulesFixture(): RingModule[] {
  return [
    { id: "core", area: 4000, rank: 0 },
    { id: "utils", area: 1500, rank: 0 },
    { id: "ui", area: 6000, rank: 1 },
    { id: "cli", area: 800, rank: 1 },
    { id: "app", area: 2500, rank: 2 },
  ];
}

const edges = [
  { source: "ui", target: "core" },
  { source: "cli", target: "core" },
  { source: "app", target: "ui" },
];

describe("ringLayout", () => {
  it("places every module without overlap", () => {
    const placed = ringLayout(modulesFixture(), edges);
    const list = [...placed.circles.values()];
    expect(list).toHaveLength(5);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(d).toBeGreaterThanOrEqual(a.r + b.r - 1e-9);
      }
    }
  });

  it("gives areas proportional radii", () => {
    const placed = ringLayout(modulesFixture(), edges);
    const core = placed.circles.get("core")!;
    const utils = placed.circles.get("utils")!;
    expect(core.r / utils.r).toBeCloseTo(Math.sqrt(4000 / 1500), 9);
  });

  it("orders rings by rank from the center outward", () => {
    const placed = ringLayout(modulesFixture(), edges);
    const distOf = (id: string) => {
      const c = placed.circles.get(id)!;
      return Math.hypot(c.cx, c.cy);
    };
    const rank0Max = Math.max(distOf("core"), distOf("utils"));
    const rank1Min = Math.min(distOf("ui"), distOf("cli"));
    const rank2 = distOf("app");
    expect(rank1Min).toBeGreaterThan(rank0Max);
    expect(rank2).toBeGreaterThan(Math.max(distOf("ui"), distOf("cli")));
  });

  it("puts a sole rank-0 module exactly at the center", () => {
    const placed = ringLayout(
      [
        { id: "core", area: 1000, rank: 0 },
        { id: "a", area: 500, rank: 1 },
        { id: "b", area: 600, rank: 1 },
      ],
      [],
    );
    const core = placed.circles.get("core")!;
    expect(core.cx).toBe(0);
    expect(core.cy).toBe(0);
  });

  it("inverts ring order when requested", () => {
    const placed = ringLayout(modulesFixture(), edges, { invert: true });
    const distOf = (id: string) => {
      const c = placed.circles.get(id)!;
      return Math.hypot(c.cx, c.cy);
    };
    // rank2 (app) now innermost, rank0 outermost
    expect(distOf("app")).toBeLessThan(distOf("core"));
    expect(distOf("app")).toBeLessThan(distOf("utils"));
  });

  it("is deterministic", () => {
    const a = ringLayout(modulesFixture(), edges);
    const b = ringLayout(modulesFixture(), edges);
    expect([...a.circles.entries()]).toEqual([...b.circles.entries()]);
  });

  it("survives many modules with extreme area spread", () => {
    const rng = createRng(5);
    const modules: RingModule[] = Array.from({ length: 40 }, (_, i) => ({
      id: `m${i}`,
      area: 10 + 10000 * rng() ** 3,
      rank: Math.floor(rng() * 5),
    }));
    const placed = ringLayout(modules, []);
    const list = [...placed.circles.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(d).toBeGreaterThanOrEqual(a.r + b.r - 1e-9);
      }
    }
    expect(placed.totalRadius).toBeGreaterThan(0);
  });
});
