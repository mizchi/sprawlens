export const representationReliabilityMetricContractV1 = {
  schemaVersion: 1,
  status: "target-confirmatory-contract",
  observation: {
    identityDomain: "same-stable-cell-id-set",
    boundaryDomain: "nonempty-polygon-boundaries",
    canonicalization: "boundary-set",
    discrepancy: "exact-polygon-boundary-hausdorff",
    cellAggregation: "arithmetic-mean-sorted-by-stable-id",
    normalization: "divide-by-max-clip-extent",
    unit: "fraction-of-max-clip-extent",
  },
  metrics: {
    D_comm: { leftPath: ["A", "B"], rightPath: ["B", "A"] },
    D_loop: { leftPath: [], rightPath: ["A", "A^-1"] },
    D_repeat: {
      construction: "independent-rerun-pairs-of-same-path",
      quantile: { probability: 0.95, method: "nearest-rank" },
    },
    D_excess: {
      formula: "max(0,D_path-Q_0.95(D_repeat)-margin)",
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
