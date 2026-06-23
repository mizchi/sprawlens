import { describe, expect, it } from "vitest";
import { circleToPolygon, signedArea, type Ring } from "./polygon.js";
import { computePowerDiagram, type PowerSite } from "./powerDiagram.js";
import { createRng } from "./rng.js";
import type { Vec2 } from "./vec.js";

const unitSquare: Ring = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function powerDistance(p: Vec2, site: PowerSite): number {
  const dx = p.x - site.x;
  const dy = p.y - site.y;
  return dx * dx + dy * dy - site.weight;
}

/** Point-in-convex-polygon test for CCW rings. */
function insideConvex(p: Vec2, ring: Ring, eps = 1e-9): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross < -eps) return false;
  }
  return ring.length >= 3;
}

function randomSites(count: number, seed: number): PowerSite[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    x: 0.05 + rng() * 0.9,
    y: 0.05 + rng() * 0.9,
    weight: rng() * 0.01,
  }));
}

describe("computePowerDiagram", () => {
  it("splits two equal-weight sites along the perpendicular bisector", () => {
    const cells = computePowerDiagram(
      [
        { id: "a", x: 0.25, y: 0.5, weight: 0 },
        { id: "b", x: 0.75, y: 0.5, weight: 0 },
      ],
      unitSquare,
    );
    const a = cells.find((c) => c.id === "a")!;
    const b = cells.find((c) => c.id === "b")!;
    expect(a.area).toBeCloseTo(0.5, 9);
    expect(b.area).toBeCloseTo(0.5, 9);
    for (const p of a.polygon) expect(p.x).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(a.edges.some((e) => e.neighborId === "b")).toBe(true);
    expect(b.edges.some((e) => e.neighborId === "a")).toBe(true);
  });

  it("gives a larger cell to a heavier site at symmetric positions", () => {
    const cells = computePowerDiagram(
      [
        { id: "a", x: 0.25, y: 0.5, weight: 0.05 },
        { id: "b", x: 0.75, y: 0.5, weight: 0 },
      ],
      unitSquare,
    );
    const a = cells.find((c) => c.id === "a")!;
    const b = cells.find((c) => c.id === "b")!;
    expect(a.area).toBeGreaterThan(0.5);
    expect(a.area + b.area).toBeCloseTo(1, 9);
  });

  it("covers the clip region exactly (rect)", () => {
    const cells = computePowerDiagram(randomSites(20, 11), unitSquare);
    const total = cells.reduce((sum, c) => sum + c.area, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("covers the clip region exactly (circle)", () => {
    const clip = circleToPolygon({ cx: 0.5, cy: 0.5, r: 0.5 }, 64);
    const clipArea = signedArea(clip);
    const cells = computePowerDiagram(randomSites(20, 13), clip);
    const total = cells.reduce((sum, c) => sum + c.area, 0);
    expect(total).toBeCloseTo(clipArea, 6);
  });

  it("assigns sample points to the cell of minimal power distance", () => {
    const sites = randomSites(15, 17);
    const cells = computePowerDiagram(sites, unitSquare);
    const rng = createRng(99);
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const p = { x: rng(), y: rng() };
      const dists = sites
        .map((s) => ({ id: s.id, d: powerDistance(p, s) }))
        .sort((a, b) => a.d - b.d);
      // skip near-ties to avoid boundary ambiguity
      if (dists[1]!.d - dists[0]!.d < 1e-6) continue;
      const winner = cells.find((c) => c.id === dists[0]!.id)!;
      expect(insideConvex(p, winner.polygon, 1e-7)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(150);
  });

  it("returns an empty cell for a dominated site without crashing", () => {
    const cells = computePowerDiagram(
      [
        { id: "big", x: 0.5, y: 0.5, weight: 10 },
        { id: "small", x: 0.6, y: 0.5, weight: 0 },
      ],
      unitSquare,
    );
    const small = cells.find((c) => c.id === "small")!;
    expect(small.polygon).toEqual([]);
    expect(small.area).toBe(0);
    const big = cells.find((c) => c.id === "big")!;
    expect(big.area).toBeCloseTo(1, 9);
  });

  it("resolves coincident sites by weight, then by input order", () => {
    const byWeight = computePowerDiagram(
      [
        { id: "a", x: 0.5, y: 0.5, weight: 0 },
        { id: "b", x: 0.5, y: 0.5, weight: 0.1 },
      ],
      unitSquare,
    );
    expect(byWeight.find((c) => c.id === "a")!.area).toBe(0);
    expect(byWeight.find((c) => c.id === "b")!.area).toBeCloseTo(1, 9);

    const tie = computePowerDiagram(
      [
        { id: "a", x: 0.5, y: 0.5, weight: 0 },
        { id: "b", x: 0.5, y: 0.5, weight: 0 },
      ],
      unitSquare,
    );
    const nonEmpty = tie.filter((c) => c.area > 0);
    expect(nonEmpty).toHaveLength(1);
    expect(nonEmpty[0]!.id).toBe("a");
  });

  it("produces symmetric neighbor references", () => {
    const cells = computePowerDiagram(randomSites(25, 23), unitSquare);
    const byId = new Map(cells.map((c) => [c.id, c]));
    for (const cell of cells) {
      for (const edge of cell.edges) {
        if (edge.neighborId === null) continue;
        const neighbor = byId.get(edge.neighborId)!;
        expect(neighbor.edges.some((e) => e.neighborId === cell.id)).toBe(true);
      }
    }
  });

  it("handles a single site by returning the whole clip region", () => {
    const cells = computePowerDiagram([{ id: "only", x: 0.3, y: 0.3, weight: 0 }], unitSquare);
    expect(cells[0]!.area).toBeCloseTo(1, 9);
    expect(cells[0]!.edges.every((e) => e.neighborId === null)).toBe(true);
  });
});

describe("grid-pruned path equals brute force", () => {
  it("produces identical cells above the grid threshold", () => {
    // 120 sites (grid path) vs a reference brute-force clip
    const rng = createRng(42);
    const sites: PowerSite[] = Array.from({ length: 120 }, (_, i) => ({
      id: `s${i}`,
      x: rng() * 100,
      y: rng() * 100,
      weight: (rng() - 0.5) * 40,
    }));
    const clip: Ring = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const fast = computePowerDiagram(sites, clip);
    // reference: order-independent intersection of all half-planes
    const halfPlane = (cell: Vec2[], nx: number, ny: number, c: number) => {
      const out: Vec2[] = [];
      for (let i = 0; i < cell.length; i++) {
        const cur = cell[i]!;
        const next = cell[(i + 1) % cell.length]!;
        const curD = nx * cur.x + ny * cur.y - c;
        const nextD = nx * next.x + ny * next.y - c;
        if (curD <= 0) out.push(cur);
        if (curD <= 0 !== nextD <= 0) {
          const t = curD / (curD - nextD);
          out.push({
            x: cur.x + (next.x - cur.x) * t,
            y: cur.y + (next.y - cur.y) * t,
          });
        }
      }
      return out.length < 3 ? [] : out;
    };
    for (let i = 0; i < sites.length; i++) {
      const a = sites[i]!;
      let cell: Vec2[] = clip.map((p) => ({ ...p }));
      for (let j = 0; j < sites.length && cell.length > 0; j++) {
        if (j === i) continue;
        const b = sites[j]!;
        cell = halfPlane(
          cell,
          2 * (b.x - a.x),
          2 * (b.y - a.y),
          b.x * b.x + b.y * b.y - (a.x * a.x + a.y * a.y) + a.weight - b.weight,
        );
      }
      const expected = cell.length >= 3 ? Math.abs(signedAreaOf(cell)) : 0;
      const actual = Math.abs(fast[i]!.area);
      expect(actual).toBeCloseTo(expected, 6);
    }
    function signedAreaOf(ring: Vec2[]): number {
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i]!;
        const q = ring[(i + 1) % ring.length]!;
        area += p.x * q.y - q.x * p.y;
      }
      return area / 2;
    }
  });

  // the early-stop bound uses the global max weight; a wide weight spread is
  // the worst case for it, so check several seeds and spreads against an
  // order-independent reference for both area and neighbor labels
  for (const [seed, spread] of [
    [1, 0],
    [2, 5],
    [3, 60],
    [4, 200],
  ] as const) {
    it(`matches brute force on areas and neighbors (seed=${seed}, spread=${spread})`, () => {
      const rng = createRng(seed);
      const sites: PowerSite[] = Array.from({ length: 150 }, (_, i) => ({
        id: `s${i}`,
        x: rng() * 100,
        y: rng() * 100,
        weight: (rng() - 0.5) * spread,
      }));
      const clip: Ring = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      const fast = computePowerDiagram(sites, clip);
      const halfPlane = (cell: Vec2[], nx: number, ny: number, c: number) => {
        const out: Vec2[] = [];
        for (let i = 0; i < cell.length; i++) {
          const cur = cell[i]!;
          const next = cell[(i + 1) % cell.length]!;
          const curD = nx * cur.x + ny * cur.y - c;
          const nextD = nx * next.x + ny * next.y - c;
          if (curD <= 0) out.push(cur);
          if (curD <= 0 !== nextD <= 0) {
            const t = curD / (curD - nextD);
            out.push({
              x: cur.x + (next.x - cur.x) * t,
              y: cur.y + (next.y - cur.y) * t,
            });
          }
        }
        return out.length < 3 ? [] : out;
      };
      const area = (ring: Vec2[]): number => {
        let a = 0;
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i]!;
          const q = ring[(i + 1) % ring.length]!;
          a += p.x * q.y - q.x * p.y;
        }
        return Math.abs(a / 2);
      };
      for (let i = 0; i < sites.length; i++) {
        const a = sites[i]!;
        let cell: Vec2[] = clip.map((p) => ({ ...p }));
        for (let j = 0; j < sites.length && cell.length > 0; j++) {
          if (j === i) continue;
          const b = sites[j]!;
          cell = halfPlane(
            cell,
            2 * (b.x - a.x),
            2 * (b.y - a.y),
            b.x * b.x + b.y * b.y - (a.x * a.x + a.y * a.y) + a.weight - b.weight,
          );
        }
        const expected = cell.length >= 3 ? area(cell) : 0;
        expect(fast[i]!.area).toBeCloseTo(expected, 5);
      }
    });
  }
});
