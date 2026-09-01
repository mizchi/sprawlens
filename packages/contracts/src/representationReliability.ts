export const representationReliabilityMetricContractV1 = {
  schemaVersion: 1,
  status: "target-confirmatory-contract",
  inputEndpoint: {
    schemaVersion: 1,
    graphSchema: "ordered-layout-sequence-graph-v1",
    nodeFields: ["id", "weight", "hint-presence", "hint-x", "hint-y"],
    edgeFields: ["source", "target"],
    order: "node-and-edge-array-order-significant",
    hierarchy: "not-represented-by-layout-sequence-graph-v1",
    mismatch: "fail-closed-before-layout",
  },
  observation: {
    identityDomain: "same-stable-cell-id-set",
    boundaryDomain: "nonempty-polygon-boundaries",
    canonicalization: "boundary-set",
    representationEquivalence: {
      exactBoundarySet: ["cyclic-seam-rotation", "winding-reversal", "on-edge-vertex-insertion"],
      fixedEdgeSampler:
        "zero-distance-preserved-but-interval-width-may-change-after-on-edge-vertex-insertion",
      adaptiveEdgeSampler: "target-width-preserved-not-bitwise-identical-interval",
    },
    transformationLaws: {
      commonRigidTransform: "exact-distance-and-normalized-interval-invariant",
      commonUniformScale:
        "exact-distance-and-absolute-interval-scale-by-absolute-factor-normalized-interval-invariant",
      zeroScale: "outside-domain-fail-closed",
    },
    discrepancy: "exact-polygon-boundary-hausdorff",
    estimator: {
      kind: "edge-local-polygon-boundary-sampling",
      subdivisionsPerEdge: 8,
      report: "lower-estimate-plus-additive-upper-bound",
    },
    cellAggregation: "arithmetic-mean-sorted-by-stable-id",
    normalization: "divide-by-max-clip-extent",
    unit: "fraction-of-max-clip-extent",
  },
  adaptivePrecisionSelection: {
    status: "pending-preregistered-sesoi",
    candidateTargets: [0.03, 0.02, 0.01],
    derivedWidthUpperBound: "path-target-plus-noise-target",
    uncertaintyBudget: "derived-sampling-width-at-most-sesoi-half",
    eligibilityRule: "target-at-most-sesoi-quarter",
    selectionRule: "largest-eligible-preregistered-target",
    observedEffectDependence: "forbidden",
  },
  metrics: {
    D_comm: { leftPath: ["A", "B"], rightPath: ["B", "A"] },
    D_loop: { leftPath: [], rightPath: ["A", "A^-1"] },
    D_repeat: {
      construction: "independent-rerun-pairs-of-same-path",
      quantile: {
        probability: 0.95,
        method: "nearest-rank",
        scope: "condition-within-repository-across-sequence-seed-path",
      },
    },
    D_excess: {
      formula: "max(0,D_path-Q_0.95(D_repeat)-margin)",
      margin: 0,
      marginUnit: "fraction-of-max-clip-extent",
    },
  },
  aggregationOrder: [
    "seed-mean-within-sequence",
    "sequence-mean-within-repository",
    "repository-bootstrap-mean-ci",
  ],
  outerUnit: "repository",
  confidenceLevel: 0.95,
  missingness: "fail-closed-before-confirmatory-aggregation",
} as const;

export type RepresentationReliabilityMetricContractV1 =
  typeof representationReliabilityMetricContractV1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertExactShape = (value: unknown, expected: unknown, path: string): void => {
  if (Array.isArray(expected)) {
    if (!Array.isArray(value) || value.length !== expected.length) {
      throw new TypeError(`${path} must contain ${expected.length} entries`);
    }
    expected.forEach((entry, index) => assertExactShape(value[index], entry, `${path}[${index}]`));
    return;
  }
  if (isRecord(expected)) {
    if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
    const expectedFields = Object.keys(expected);
    for (const field of expectedFields) {
      if (!(field in value)) throw new TypeError(`${path}.${field} is required`);
      assertExactShape(value[field], expected[field], `${path}.${field}`);
    }
    for (const field of Object.keys(value)) {
      if (!expectedFields.includes(field))
        throw new TypeError(`${path} has unexpected field ${field}`);
    }
    return;
  }
  if (value !== expected) {
    throw new TypeError(`${path} must be ${JSON.stringify(expected)}`);
  }
};

export function parseRepresentationReliabilityMetricContractV1(
  value: unknown,
): RepresentationReliabilityMetricContractV1 {
  assertExactShape(value, representationReliabilityMetricContractV1, "contract");
  return value as RepresentationReliabilityMetricContractV1;
}

const assertFiniteNonnegative = (value: number, name: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative`);
  }
};

/** Empirical nearest-rank quantile: sortedValues[ceil(probability * n) - 1]. */
export function empiricalNearestRankQuantile(values: readonly number[], probability: number) {
  if (values.length === 0) throw new RangeError("values must be non-empty");
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
    throw new RangeError("probability must be in (0, 1]");
  }
  values.forEach((value) => assertFiniteNonnegative(value, "repeatability defect"));
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(probability * sorted.length) - 1]!;
}

export type AdaptiveHausdorffSesoiSelection = {
  sesoi: number;
  maximumDerivedSamplingUncertainty: number;
  maximumPerIntervalTarget: number;
  selectedTarget: number;
  eligibleTargets: number[];
};

/**
 * Result-independent precision selection for the certified derived defect.
 *
 * Lean proves that the derived interval width is at most twice the per-input
 * target. Requiring that uncertainty to consume at most half the SESOI gives
 * `target <= SESOI / 4`. The coarsest eligible preregistered target minimizes
 * work without consulting observed effects.
 */
export function selectAdaptiveHausdorffTargetFromSesoi(
  sesoi: number,
  preregisteredTargets: readonly number[],
): AdaptiveHausdorffSesoiSelection {
  if (!Number.isFinite(sesoi) || sesoi <= 0) {
    throw new RangeError("requires a positive finite SESOI");
  }
  if (preregisteredTargets.length === 0) {
    throw new RangeError("requires at least one preregistered adaptive target");
  }
  if (preregisteredTargets.some((target) => !Number.isFinite(target) || target <= 0)) {
    throw new RangeError("requires positive finite adaptive targets");
  }
  if (new Set(preregisteredTargets).size !== preregisteredTargets.length) {
    throw new RangeError("preregistered adaptive targets must be unique");
  }

  const maximumDerivedSamplingUncertainty = sesoi / 2;
  const maximumPerIntervalTarget = sesoi / 4;
  const eligibleTargets = [...preregisteredTargets]
    .filter((target) => target <= maximumPerIntervalTarget)
    .sort((left, right) => right - left);
  const selectedTarget = eligibleTargets[0];
  if (selectedTarget === undefined) {
    throw new RangeError("no preregistered adaptive target satisfies SESOI / 4");
  }
  return {
    sesoi,
    maximumDerivedSamplingUncertainty,
    maximumPerIntervalTarget,
    selectedTarget,
    eligibleTargets,
  };
}

/** Executable counterpart of Lean `SameEndpointConsistency.excessDefect`. */
export function computeExcessDefect(
  pathDefect: number,
  repeatabilityQuantile: number,
  margin: number,
) {
  assertFiniteNonnegative(pathDefect, "pathDefect");
  assertFiniteNonnegative(repeatabilityQuantile, "repeatabilityQuantile");
  assertFiniteNonnegative(margin, "margin");
  return Math.max(0, pathDefect - repeatabilityQuantile - margin);
}

export type CertifiedNonnegativeInterval = {
  lowerBound: number;
  upperBound: number;
};

const assertCertifiedInterval = (interval: CertifiedNonnegativeInterval, name: string): void => {
  if (
    !Number.isFinite(interval.lowerBound) ||
    interval.lowerBound < 0 ||
    !Number.isFinite(interval.upperBound) ||
    interval.upperBound < 0
  ) {
    throw new RangeError(`${name} interval bounds must be finite and non-negative`);
  }
  if (interval.lowerBound > interval.upperBound) {
    throw new RangeError(`${name} interval lowerBound must not exceed upperBound`);
  }
};

/**
 * Conservative interval extension of `computeExcessDefect`.
 *
 * The lower result subtracts the upper repeatability quantile, while the upper
 * result subtracts the lower quantile. Nearest-rank quantiles are monotone in
 * their samples, so any exact values contained in the inputs remain contained
 * in the output under exact real arithmetic.
 */
export function computeExcessDefectInterval(
  pathDefect: CertifiedNonnegativeInterval,
  repeatability: readonly CertifiedNonnegativeInterval[],
  margin: number,
) {
  assertCertifiedInterval(pathDefect, "pathDefect");
  if (repeatability.length === 0) {
    throw new RangeError("repeatability intervals must be non-empty");
  }
  repeatability.forEach((interval) => assertCertifiedInterval(interval, "repeatability"));
  assertFiniteNonnegative(margin, "margin");

  const probability =
    representationReliabilityMetricContractV1.metrics.D_repeat.quantile.probability;
  const repeatabilityQuantileLowerBound = empiricalNearestRankQuantile(
    repeatability.map((interval) => interval.lowerBound),
    probability,
  );
  const repeatabilityQuantileUpperBound = empiricalNearestRankQuantile(
    repeatability.map((interval) => interval.upperBound),
    probability,
  );
  return {
    lowerBound: computeExcessDefect(pathDefect.lowerBound, repeatabilityQuantileUpperBound, margin),
    upperBound: computeExcessDefect(pathDefect.upperBound, repeatabilityQuantileLowerBound, margin),
    repeatabilityQuantileLowerBound,
    repeatabilityQuantileUpperBound,
  };
}
