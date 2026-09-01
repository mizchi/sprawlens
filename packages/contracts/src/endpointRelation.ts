export const controlledEndpointRelationContractV1 = {
  schemaVersion: 1,
  graphSchema: "ordered-layout-sequence-graph-v1",
  relations: [
    {
      id: "serialized-equal",
      status: "supported",
      identity: "stable-id",
      nodeOrder: "significant",
      edgeOrder: "significant",
      witness: "none",
    },
    {
      id: "labeled-graph-equal",
      status: "supported",
      identity: "stable-id",
      nodeOrder: "ignored",
      edgeOrder: "ignored",
      witness: "none",
    },
    {
      id: "rename-equivalent",
      status: "supported-with-witness",
      identity: "explicit-total-bijection",
      nodeOrder: "ignored",
      edgeOrder: "ignored",
      witness: "left-to-right-id-bijection",
    },
    {
      id: "hierarchy-equivalent",
      status: "unsupported-by-graph-schema",
      identity: "not-defined",
      nodeOrder: "not-defined",
      edgeOrder: "not-defined",
      witness: "hierarchy-not-represented",
    },
    {
      id: "isomorphic",
      status: "unsupported-without-isomorphism-witness",
      identity: "existential-bijection",
      nodeOrder: "ignored",
      edgeOrder: "ignored",
      witness: "not-implemented",
    },
  ],
  permutationProbes: [
    "node-array-order",
    "edge-array-order",
    "stable-id-rename",
    "hierarchy-serialization-unsupported",
  ],
  comparisonResult: ["equivalent", "different", "unsupported"],
  mismatch: "fail-closed-before-layout",
} as const;

export type ControlledEndpointRelationContractV1 = typeof controlledEndpointRelationContractV1;

export type ControlledEndpointRelationKind =
  (typeof controlledEndpointRelationContractV1.relations)[number]["id"];

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
      if (!expectedFields.includes(field)) {
        throw new TypeError(`${path} has unexpected field ${field}`);
      }
    }
    return;
  }
  if (value !== expected) {
    throw new TypeError(`${path} must be ${JSON.stringify(expected)}`);
  }
};

export function parseControlledEndpointRelationContractV1(
  value: unknown,
): ControlledEndpointRelationContractV1 {
  assertExactShape(value, controlledEndpointRelationContractV1, "contract");
  return value as ControlledEndpointRelationContractV1;
}
