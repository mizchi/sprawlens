import { selectVectorFeasibleEnvelope } from "./feasibleEnvelope.ts";
import type { Vec2 } from "./vec.ts";

export type HistorySelectorSide = "left" | "right";

export type HistorySelectorCandidate = {
  id: HistorySelectorSide;
  site: Vec2;
};

export type HistorySelectorInput = {
  editA: boolean;
  editB: boolean;
};

export type HistorySelectorEdit = "enableA" | "enableB";

export type HistorySelectorState = {
  input: HistorySelectorInput;
  selected: HistorySelectorCandidate;
};

const CANDIDATES: readonly [HistorySelectorCandidate, HistorySelectorCandidate] = [
  { id: "left", site: { x: -1, y: 0 } },
  { id: "right", site: { x: 1, y: 0 } },
];

const candidateIsFeasible = (
  input: HistorySelectorInput,
  candidate: HistorySelectorCandidate,
): boolean => {
  if (input.editA && !input.editB) return candidate.id === "right";
  if (input.editB && !input.editA) return candidate.id === "left";
  return true;
};

const displacementFrom = (
  previous: HistorySelectorCandidate,
  candidate: HistorySelectorCandidate,
): number => Math.hypot(candidate.site.x - previous.site.x, candidate.site.y - previous.site.y);

/**
 * Minimal executable model of predecessor-dependent feasible-envelope selection.
 * The protected score is intentionally equal for both geometries; history enters
 * only through the displacement objective inside the feasible set.
 */
export function selectHistoryCandidate(
  input: HistorySelectorInput,
  previousSide: HistorySelectorSide,
): HistorySelectorCandidate {
  const previous = CANDIDATES.find(({ id }) => id === previousSide)!;
  return selectVectorFeasibleEnvelope({
    baseline: CANDIDATES[0],
    candidates: CANDIDATES,
    constraints: [{ name: "protected-structure", score: () => 1 }],
    isValid: (candidate) => candidateIsFeasible(input, candidate),
    selectionCost: (candidate) => displacementFrom(previous, candidate),
    compareTieBreak: (left, right) => left.id.localeCompare(right.id),
  }).selected;
}

export function createHistorySelectorState(): HistorySelectorState {
  return {
    input: { editA: false, editB: false },
    selected: CANDIDATES[0],
  };
}

export function applyHistorySelectorEdit(
  state: HistorySelectorState,
  edit: HistorySelectorEdit,
): HistorySelectorState {
  const input = {
    editA: state.input.editA || edit === "enableA",
    editB: state.input.editB || edit === "enableB",
  };
  return {
    input,
    selected: selectHistoryCandidate(input, state.selected.id),
  };
}
