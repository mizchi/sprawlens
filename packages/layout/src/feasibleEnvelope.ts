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

/**
 * Selects the minimum-cost valid candidate subject to a baseline-relative
 * constraint floor. The declared baseline is a total fallback, so callers can
 * distinguish an empty feasible set without inventing a second policy.
 */
export function selectFeasibleEnvelope<T>(
  policy: FeasibleEnvelopePolicy<T>,
): FeasibleEnvelopeSelection<T> {
  if (!policy.candidates.includes(policy.baseline)) {
    throw new Error("feasible-envelope baseline must be included in candidates");
  }
  const tolerance = policy.tolerance ?? 0;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("feasible-envelope tolerance must be a finite non-negative number");
  }
  const constraintEpsilon = policy.constraintEpsilon ?? 1e-12;
  if (!Number.isFinite(constraintEpsilon) || constraintEpsilon < 0) {
    throw new Error("feasible-envelope constraint epsilon must be a finite non-negative number");
  }

  const measured = policy.candidates.map((candidate, index) => {
    const constraint = policy.constraintScore(candidate);
    const cost = policy.selectionCost(candidate);
    if (!Number.isFinite(constraint)) {
      throw new Error(`feasible-envelope constraint score must be finite (candidate ${index})`);
    }
    if (!Number.isFinite(cost)) {
      throw new Error(`feasible-envelope selection cost must be finite (candidate ${index})`);
    }
    return { candidate, constraint, cost, index };
  });
  const baselineIndex = policy.candidates.indexOf(policy.baseline);
  const minimumConstraint = measured[baselineIndex]!.constraint - tolerance;
  const eligibleMeasured = measured.filter(
    ({ candidate, constraint }) =>
      policy.isValid(candidate) && constraint + constraintEpsilon >= minimumConstraint,
  );
  const usedFallback = eligibleMeasured.length === 0;
  const pool = usedFallback ? [measured[baselineIndex]!] : eligibleMeasured;
  const selected = [...pool].sort((left, right) => {
    const primary = left.cost - right.cost || right.constraint - left.constraint;
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
    minimumConstraint,
    usedFallback,
  };
}
