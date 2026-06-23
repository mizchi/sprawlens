import { describe, expect, it } from "vitest";
import { distanceToPolyline, pickNearestEdge, type EdgePickCandidate } from "./edgePick.js";

describe("distanceToPolyline", () => {
  it("measures perpendicular distance to the nearest segment", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToPolyline({ x: 5, y: 3 }, line)).toBeCloseTo(3, 9);
  });

  it("clamps to endpoints beyond the segment span", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToPolyline({ x: -3, y: 4 }, line)).toBeCloseTo(5, 9);
  });

  it("takes the closest segment of a bent polyline", () => {
    const bend = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    // near the vertical leg
    expect(distanceToPolyline({ x: 8, y: 6 }, bend)).toBeCloseTo(2, 9);
  });

  it("returns Infinity for an empty polyline", () => {
    expect(distanceToPolyline({ x: 0, y: 0 }, [])).toBe(Infinity);
  });
});

describe("pickNearestEdge", () => {
  const candidates: EdgePickCandidate[] = [
    {
      source: "a",
      target: "b",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
    {
      source: "c",
      target: "d",
      points: [
        { x: 0, y: 10 },
        { x: 100, y: 10 },
      ],
    },
  ];

  it("picks the nearer of two overlapping edges", () => {
    // y=3 is closer to the a→b line (y=0) than c→d (y=10)
    const hit = pickNearestEdge({ x: 50, y: 3 }, candidates, 8);
    expect(hit).not.toBeNull();
    expect(hit!.source).toBe("a");
    expect(hit!.distance).toBeCloseTo(3, 9);
  });

  it("flips to the other edge as the cursor crosses between them", () => {
    const hit = pickNearestEdge({ x: 50, y: 8 }, candidates, 8);
    expect(hit!.source).toBe("c");
  });

  it("returns null when nothing is within range", () => {
    expect(pickNearestEdge({ x: 50, y: 40 }, candidates, 8)).toBeNull();
  });

  it("resolves ties to the first candidate", () => {
    const tied: EdgePickCandidate[] = [
      {
        source: "x",
        target: "y",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      },
      {
        source: "p",
        target: "q",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      },
    ];
    expect(pickNearestEdge({ x: 5, y: 1 }, tied, 8)!.source).toBe("x");
  });

  it("with dominance, grabs a clearly-nearest edge but not a contested one", () => {
    // two parallel edges 10 apart; the wide radius (20) reaches both
    const pair: EdgePickCandidate[] = [
      {
        source: "a",
        target: "b",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
      {
        source: "c",
        target: "d",
        points: [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
      },
    ];
    // clearly closer to a→b (2 vs 8): grabbed
    expect(pickNearestEdge({ x: 50, y: 2 }, pair, 20, 0.8)!.source).toBe("a");
    // near the midline (4.5 vs 5.5): contested → nothing grabbed
    expect(pickNearestEdge({ x: 50, y: 4.5 }, pair, 20, 0.8)).toBeNull();
    // same point with dominance off resolves to the nearest anyway
    expect(pickNearestEdge({ x: 50, y: 4.5 }, pair, 20)!.source).toBe("a");
  });
});
