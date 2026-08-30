export type FeasibleEnvelopePolicy<T> = {
  /** The current-only reference whose constraint score defines the floor. */
  baseline: T;
  /** A finite candidate set that includes `baseline` by identity. */
  candidates: readonly T[];
  /** Absolute constraint loss permitted relative to the baseline. */
  tolerance?: number;
  /** Numerical slack used only when checking the constraint floor. */
  constraintEpsilon?: number;
  /** Rejects candidates that fail an independent validity contract such as convergence. */
  isValid: (candidate: T) => boolean;
  /** Higher values preserve more of the protected structure. */
  constraintScore: (candidate: T) => number;
  /** Lower values are preferred inside the feasible envelope. */
  selectionCost: (candidate: T) => number;
  /** Optional deterministic ordering after cost and constraint score tie. */
  compareTieBreak?: (left: T, right: T) => number;
};

export type FeasibleEnvelopeSelection<T> = {
  selected: T;
  eligible: T[];
  minimumConstraint: number;
  usedFallback: boolean;
};

export type FeasibleEnvelopeConstraint<T> = {
  /** Stable diagnostic key. Constraint names must be unique within a policy. */
  name: string;
  /** Higher values preserve more of this protected structure. */
  score: (candidate: T) => number;
  /** Absolute score loss permitted relative to the baseline. */
  tolerance?: number;
  /** Numerical slack used only when checking this floor. */
  epsilon?: number;
};

export type VectorFeasibleEnvelopePolicy<T> = {
  baseline: T;
  candidates: readonly T[];
  constraints: readonly FeasibleEnvelopeConstraint<T>[];
  isValid: (candidate: T) => boolean;
  selectionCost: (candidate: T) => number;
  compareTieBreak?: (left: T, right: T) => number;
};

export type VectorFeasibleEnvelopeSelection<T> = {
  selected: T;
  eligible: T[];
  minimumConstraints: Record<string, number>;
  usedFallback: boolean;
};

/** Numeric comparison slack mirrored by the exact Lean adjacency-rate contract. */
export const DEFAULT_CONSTRAINT_EPSILON = 1e-12;

/**
 * Selects the minimum-cost candidate in the intersection of independent,
 * baseline-relative constraint floors. The baseline remains a total fallback.
 */
export function selectVectorFeasibleEnvelope<T>(
  policy: VectorFeasibleEnvelopePolicy<T>,
): VectorFeasibleEnvelopeSelection<T> {
  if (!policy.candidates.includes(policy.baseline)) {
    throw new Error("feasible-envelope baseline must be included in candidates");
  }
  if (policy.constraints.length === 0) {
    throw new Error("vector feasible-envelope requires at least one constraint");
  }
  const names = new Set<string>();
  const constraints = policy.constraints.map((constraint) => {
    if (!constraint.name || names.has(constraint.name)) {
      throw new Error("vector feasible-envelope constraint names must be non-empty and unique");
    }
    names.add(constraint.name);
    const tolerance = constraint.tolerance ?? 0;
    if (!Number.isFinite(tolerance) || tolerance < 0) {
      throw new Error(
        `vector feasible-envelope constraint tolerance must be finite and non-negative (${constraint.name})`,
      );
    }
    const epsilon = constraint.epsilon ?? DEFAULT_CONSTRAINT_EPSILON;
    if (!Number.isFinite(epsilon) || epsilon < 0) {
      throw new Error(
        `vector feasible-envelope constraint epsilon must be finite and non-negative (${constraint.name})`,
      );
    }
    return { ...constraint, tolerance, epsilon };
  });

  const measured = policy.candidates.map((candidate, index) => {
    const scores = constraints.map((constraint) => {
      const score = constraint.score(candidate);
      if (!Number.isFinite(score)) {
        throw new Error(
          `vector feasible-envelope constraint score must be finite (${constraint.name}, candidate ${index})`,
        );
      }
      return score;
    });
    const cost = policy.selectionCost(candidate);
    if (!Number.isFinite(cost)) {
      throw new Error(`feasible-envelope selection cost must be finite (candidate ${index})`);
    }
    return { candidate, scores, cost, index };
  });
  const baselineIndex = policy.candidates.indexOf(policy.baseline);
  const baselineMeasured = measured[baselineIndex]!;
  const floors = constraints.map(
    (constraint, index) => baselineMeasured.scores[index]! - constraint.tolerance,
  );
  const eligibleMeasured = measured.filter(
    ({ candidate, scores }) =>
      policy.isValid(candidate) &&
      constraints.every(
        (constraint, index) => scores[index]! + constraint.epsilon >= floors[index]!,
      ),
  );
  const usedFallback = eligibleMeasured.length === 0;
  const pool = usedFallback ? [baselineMeasured] : eligibleMeasured;
  const selected = [...pool].sort((left, right) => {
    const primary = left.cost - right.cost;
    if (primary !== 0) return primary;
    const tie = policy.compareTieBreak?.(left.candidate, right.candidate) ?? 0;
    if (!Number.isFinite(tie)) {
      throw new Error("feasible-envelope tie-break comparator must return a finite number");
    }
    return tie || left.index - right.index;
  })[0]!.candidate;

  return {
    selected,
    eligible: eligibleMeasured.map(({ candidate }) => candidate),
    minimumConstraints: Object.fromEntries(
      constraints.map((constraint, index) => [constraint.name, floors[index]!]),
    ),
    usedFallback,
  };
}

/**
 * Selects the minimum-cost valid candidate subject to a baseline-relative
 * constraint floor. The declared baseline is a total fallback, so callers can
 * distinguish an empty feasible set without inventing a second policy.
 */
export function selectFeasibleEnvelope<T>(
  policy: FeasibleEnvelopePolicy<T>,
): FeasibleEnvelopeSelection<T> {
  const tolerance = policy.tolerance ?? 0;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("feasible-envelope tolerance must be a finite non-negative number");
  }
  const constraintEpsilon = policy.constraintEpsilon ?? DEFAULT_CONSTRAINT_EPSILON;
  if (!Number.isFinite(constraintEpsilon) || constraintEpsilon < 0) {
    throw new Error("feasible-envelope constraint epsilon must be a finite non-negative number");
  }

  const result = selectVectorFeasibleEnvelope({
    baseline: policy.baseline,
    candidates: policy.candidates,
    constraints: [
      {
        name: "constraint",
        score: policy.constraintScore,
        tolerance,
        epsilon: constraintEpsilon,
      },
    ],
    isValid: policy.isValid,
    selectionCost: policy.selectionCost,
    compareTieBreak: (left, right) => {
      const constraintPreference = policy.constraintScore(right) - policy.constraintScore(left);
      return constraintPreference || policy.compareTieBreak?.(left, right) || 0;
    },
  });

  return {
    selected: result.selected,
    eligible: result.eligible,
    minimumConstraint: result.minimumConstraints.constraint!,
    usedFallback: result.usedFallback,
  };
}
