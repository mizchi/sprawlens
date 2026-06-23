import { bench, describe } from "vitest";
import { computePowerDiagram, type PowerSite } from "./powerDiagram.ts";
import { createRng } from "./rng.ts";
import type { Ring } from "./polygon.ts";

const W = 800;
const H = 600;
const rect: Ring = [
  { x: 0, y: 0 },
  { x: W, y: 0 },
  { x: W, y: H },
  { x: 0, y: H },
];

/** n sites scattered in the rect with equal-area-scale power weights. */
function sites(n: number, seed = 1): PowerSite[] {
  const rng = createRng(seed);
  const weight = (W * H) / n / Math.PI; // inscribed-radius² of a fair cell
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    x: rng() * W,
    y: rng() * H,
    weight: weight * (0.5 + rng()),
  }));
}

describe("computePowerDiagram", () => {
  for (const n of [100, 300, 700]) {
    const input = sites(n);
    bench(`n=${n}`, () => {
      computePowerDiagram(input, rect);
    });
  }
});
