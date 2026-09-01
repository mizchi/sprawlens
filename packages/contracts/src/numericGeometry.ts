export const pointSegmentProjectionPropertiesV1 = [
  "endpoint-reversal-invariance",
  "translation-invariance",
  "positive-uniform-scale-equivariance",
] as const;

export const pointSegmentProjectionBoundaryCasesV1 = [
  "zero-length-segment",
  "projection-before-start",
  "projection-after-finish",
  "squared-length-overflow",
  "squared-length-underflow",
  "endpoint-difference-overflow",
] as const;

export type PointSegmentProjectionContractV1 = {
  schemaVersion: 1;
  operation: "point-to-segment-distance";
  coordinateDomain: "finite-number";
  nonFiniteInput: "unsupported";
  output: "euclidean-distance";
  degenerateSegment: "distance-to-start";
  parameterClamp: [0, 1];
  oracle: {
    fixture: "formal/TestVectors/point-segment-projection.json";
    exactValue: "squared-distance-rational";
  };
  comparison: {
    fixtureSquaredDistanceDecimalDigits: 12;
    boundaryRatioDecimalDigits: 12;
    propertyDecimalDigits: 12;
  };
  properties: [...typeof pointSegmentProjectionPropertiesV1];
  requiredBoundaryCases: [...typeof pointSegmentProjectionBoundaryCasesV1];
};

const contractFields = [
  "schemaVersion",
  "operation",
  "coordinateDomain",
  "nonFiniteInput",
  "output",
  "degenerateSegment",
  "parameterClamp",
  "oracle",
  "comparison",
  "properties",
  "requiredBoundaryCases",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
}

const assertExactFields = (
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
) => {
  for (const field of expected) {
    if (!(field in value)) throw new TypeError(`${path}.${field} is required`);
  }
  for (const field of Object.keys(value)) {
    if (!expected.includes(field)) throw new TypeError(`${path} has unexpected field ${field}`);
  }
};

const assertLiteral = (value: unknown, expected: string | number, path: string) => {
  if (value !== expected) throw new TypeError(`${path} must be ${JSON.stringify(expected)}`);
};

const assertExactArray = (value: unknown, expected: readonly unknown[], path: string) => {
  if (!Array.isArray(value) || value.length !== expected.length) {
    throw new TypeError(`${path} must contain ${expected.length} entries`);
  }
  expected.forEach((entry, index) => assertLiteral(value[index], entry as string | number, path));
};

export function parsePointSegmentProjectionContractV1(
  value: unknown,
): PointSegmentProjectionContractV1 {
  assertRecord(value, "contract");
  assertExactFields(value, contractFields, "contract");
  assertLiteral(value.schemaVersion, 1, "contract.schemaVersion");
  assertLiteral(value.operation, "point-to-segment-distance", "contract.operation");
  assertLiteral(value.coordinateDomain, "finite-number", "contract.coordinateDomain");
  assertLiteral(value.nonFiniteInput, "unsupported", "contract.nonFiniteInput");
  assertLiteral(value.output, "euclidean-distance", "contract.output");
  assertLiteral(value.degenerateSegment, "distance-to-start", "contract.degenerateSegment");
  assertExactArray(value.parameterClamp, [0, 1], "contract.parameterClamp");
  assertRecord(value.oracle, "contract.oracle");
  assertExactFields(value.oracle, ["fixture", "exactValue"], "contract.oracle");
  assertLiteral(
    value.oracle.fixture,
    "formal/TestVectors/point-segment-projection.json",
    "contract.oracle.fixture",
  );
  assertLiteral(value.oracle.exactValue, "squared-distance-rational", "contract.oracle.exactValue");
  assertRecord(value.comparison, "contract.comparison");
  assertExactFields(
    value.comparison,
    ["fixtureSquaredDistanceDecimalDigits", "boundaryRatioDecimalDigits", "propertyDecimalDigits"],
    "contract.comparison",
  );
  assertLiteral(
    value.comparison.fixtureSquaredDistanceDecimalDigits,
    12,
    "contract.comparison.fixtureSquaredDistanceDecimalDigits",
  );
  assertLiteral(
    value.comparison.boundaryRatioDecimalDigits,
    12,
    "contract.comparison.boundaryRatioDecimalDigits",
  );
  assertLiteral(
    value.comparison.propertyDecimalDigits,
    12,
    "contract.comparison.propertyDecimalDigits",
  );
  assertExactArray(value.properties, pointSegmentProjectionPropertiesV1, "contract.properties");
  assertExactArray(
    value.requiredBoundaryCases,
    pointSegmentProjectionBoundaryCasesV1,
    "contract.requiredBoundaryCases",
  );
  return value as PointSegmentProjectionContractV1;
}
