import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutImplementationV1,
  ExternalLayoutPointV1,
  ExternalLayoutRunV1,
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
  ExternalLayoutSequenceRunV2,
} from "@sprawlens/contracts";

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const nonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

const nonNegativeInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
};

function parseImplementation(value: unknown): ExternalLayoutImplementationV1 {
  const input = record(value, "implementation");
  const parameters = record(input.parameters, "implementation.parameters");
  for (const [key, parameter] of Object.entries(parameters)) {
    if (
      typeof parameter !== "string" &&
      typeof parameter !== "number" &&
      typeof parameter !== "boolean"
    ) {
      throw new Error(`implementation.parameters.${key} must be a JSON primitive`);
    }
  }
  return {
    id: nonEmptyString(input.id, "implementation.id"),
    revision: nonEmptyString(input.revision, "implementation.revision"),
    sourceUrl: nonEmptyString(input.sourceUrl, "implementation.sourceUrl"),
    license: nonEmptyString(input.license, "implementation.license"),
    adapterRevision: nonEmptyString(input.adapterRevision, "implementation.adapterRevision"),
    parameters: parameters as Record<string, string | number | boolean>,
  };
}

function parseSequenceImplementation(value: unknown): ExternalLayoutSequenceImplementationV2 {
  const input = record(value, "implementation");
  const implementation = parseImplementation(value);
  const temporalAccess = input.temporalAccess;
  if (
    temporalAccess !== "current-only" &&
    temporalAccess !== "past-and-present" &&
    temporalAccess !== "full-sequence"
  ) {
    throw new Error("implementation.temporalAccess is invalid");
  }
  const stateModel = input.stateModel;
  if (
    stateModel !== "stateless" &&
    stateModel !== "predecessor-layout" &&
    stateModel !== "sequence-global"
  ) {
    throw new Error("implementation.stateModel is invalid");
  }
  const capabilitiesInput = record(input.capabilities, "implementation.capabilities");
  if (!Array.isArray(capabilitiesInput.initializationModes)) {
    throw new Error("implementation.capabilities.initializationModes must be an array");
  }
  const initializationModes = capabilitiesInput.initializationModes.map((mode) => {
    if (mode !== "native" && mode !== "common-cells") {
      throw new Error("implementation.capabilities.initializationModes is invalid");
    }
    return mode;
  });
  const nodeCountInput = record(
    capabilitiesInput.nodeCount,
    "implementation.capabilities.nodeCount",
  );
  const nodeCount = {
    min: nonNegativeInteger(nodeCountInput.min, "implementation.capabilities.nodeCount.min"),
    max: nonNegativeInteger(nodeCountInput.max, "implementation.capabilities.nodeCount.max"),
  };
  if (nodeCount.min > nodeCount.max) {
    throw new Error("implementation.capabilities.nodeCount min must not exceed max");
  }
  if (capabilitiesInput.boundary !== "convex-polygon") {
    throw new Error("implementation.capabilities.boundary is invalid");
  }
  if (capabilitiesInput.cellGeometry !== "convex-polygons") {
    throw new Error("implementation.capabilities.cellGeometry is invalid");
  }
  const siteSemantics = capabilitiesInput.siteSemantics;
  if (siteSemantics !== "native" && siteSemantics !== "derived" && siteSemantics !== "none") {
    throw new Error("implementation.capabilities.siteSemantics is invalid");
  }
  const dependencySemantics = capabilitiesInput.dependencySemantics;
  if (dependencySemantics !== "ignored" && dependencySemantics !== "undirected-constraints") {
    throw new Error("implementation.capabilities.dependencySemantics is invalid");
  }
  if (typeof capabilitiesInput.deterministicForFixedSeed !== "boolean") {
    throw new Error("implementation.capabilities.deterministicForFixedSeed must be boolean");
  }
  return {
    ...implementation,
    temporalAccess,
    stateModel,
    capabilities: {
      initializationModes,
      nodeCount,
      boundary: "convex-polygon",
      cellGeometry: "convex-polygons",
      siteSemantics,
      dependencySemantics,
      deterministicForFixedSeed: capabilitiesInput.deterministicForFixedSeed,
    },
  };
}

const point = (
  value: unknown,
  label: string,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): ExternalLayoutPointV1 => {
  const input = record(value, label);
  const x = input.x;
  const y = input.y;
  if (typeof x !== "number" || !Number.isFinite(x)) throw new Error(`${label}.x must be finite`);
  if (typeof y !== "number" || !Number.isFinite(y)) throw new Error(`${label}.y must be finite`);
  const epsilon = 1e-6;
  if (
    x < bounds.minX - epsilon ||
    x > bounds.maxX + epsilon ||
    y < bounds.minY - epsilon ||
    y > bounds.maxY + epsilon
  ) {
    throw new Error(`${label} must lie within the normalized boundary bounds`);
  }
  return { x, y };
};

function parseRun(
  value: unknown,
  label: string,
  expectedIds: readonly string[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): ExternalLayoutRunV1 {
  const input = record(value, label);
  if (!Array.isArray(input.cells)) throw new Error(`${label}.cells must be an array`);
  const actualIds = input.cells.map((cell, index) =>
    nonEmptyString(record(cell, `${label}.cells[${index}]`).id, `${label}.cells[${index}].id`),
  );
  const expected = [...expectedIds].sort();
  const actual = [...actualIds].sort();
  if (new Set(actualIds).size !== actualIds.length || actual.join("\0") !== expected.join("\0")) {
    throw new Error(`${label} node ids must exactly match the request graph`);
  }
  const cells = input.cells.map((cell, index) => {
    const parsed = record(cell, `${label}.cells[${index}]`);
    if (!Array.isArray(parsed.polygon) || parsed.polygon.length < 3) {
      throw new Error(`${label}.cells[${index}].polygon must have at least three points`);
    }
    return {
      id: actualIds[index]!,
      site: point(parsed.site, `${label}.cells[${index}].site`, bounds),
      polygon: parsed.polygon.map((entry, pointIndex) =>
        point(entry, `${label}.cells[${index}].polygon[${pointIndex}]`, bounds),
      ),
    };
  });
  if (typeof input.steps !== "number" || !Number.isInteger(input.steps) || input.steps < 0) {
    throw new Error(`${label}.steps must be a non-negative integer`);
  }
  if (typeof input.converged !== "boolean") throw new Error(`${label}.converged must be boolean`);
  return { cells, steps: input.steps, converged: input.converged };
}

function parseSequenceRun(
  value: unknown,
  label: string,
  snapshotId: string,
  expectedIds: readonly string[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): ExternalLayoutSequenceRunV2 {
  const input = record(value, label);
  if (input.snapshotId !== snapshotId) {
    throw new Error(`external sequence snapshot order mismatch at ${label}`);
  }
  if (!Array.isArray(input.cells)) throw new Error(`${label}.cells must be an array`);
  const cells = input.cells.map((cell, index) => {
    const cellLabel = `${label}.cells[${index}]`;
    const parsed = record(cell, cellLabel);
    const id = nonEmptyString(parsed.id, `${cellLabel}.id`);
    if (!Array.isArray(parsed.polygon) || parsed.polygon.length < 3) {
      throw new Error(`${cellLabel}.polygon must have at least three points`);
    }
    return {
      id,
      ...(parsed.site === undefined
        ? {}
        : { site: point(parsed.site, `${cellLabel}.site`, bounds) }),
      polygon: parsed.polygon.map((entry, pointIndex) =>
        point(entry, `${cellLabel}.polygon[${pointIndex}]`, bounds),
      ),
    };
  });
  const actualIds = cells.map(({ id }) => id);
  if (
    new Set(actualIds).size !== actualIds.length ||
    actualIds.join("\0") !== expectedIds.join("\0")
  ) {
    throw new Error(`${label} node ids and order must exactly match the request graph`);
  }
  const workInput = record(input.work, `${label}.work`);
  const work: ExternalLayoutSequenceRunV2["work"] = {};
  for (const key of ["nativeIterations", "weightedSolves", "candidateEvaluations"] as const) {
    const count = workInput[key];
    if (count !== undefined) work[key] = nonNegativeInteger(count, `${label}.work.${key}`);
  }
  if (workInput.algorithmTimeMs !== undefined) {
    if (
      typeof workInput.algorithmTimeMs !== "number" ||
      !Number.isFinite(workInput.algorithmTimeMs) ||
      workInput.algorithmTimeMs < 0
    ) {
      throw new Error(`${label}.work.algorithmTimeMs must be finite and non-negative`);
    }
    work.algorithmTimeMs = workInput.algorithmTimeMs;
  }
  if (typeof input.nativeConverged !== "boolean") {
    throw new Error(`${label}.nativeConverged must be boolean`);
  }
  return { snapshotId, cells, work, nativeConverged: input.nativeConverged };
}

const boundaryBounds = (boundary: readonly ExternalLayoutPointV1[]) => {
  if (boundary.length < 3) throw new Error("normalized boundary requires at least three points");
  const xs = boundary.map(({ x }) => x);
  const ys = boundary.map(({ y }) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

/** Validate untrusted JSON emitted by a separately versioned baseline adapter. */
export function parseExternalLayoutBaselineResponse(
  value: unknown,
  request: ExternalLayoutBaselineRequestV1,
): ExternalLayoutBaselineResponseV1 {
  const input = record(value, "external baseline response");
  if (input.schemaVersion !== 1) throw new Error("external baseline schemaVersion must be 1");
  if (input.requestId !== request.requestId) {
    throw new Error("external baseline requestId does not match the request");
  }
  const status = input.status;
  if (status !== "ok" && status !== "unsupported" && status !== "failed") {
    throw new Error("external baseline status is invalid");
  }
  const implementation = parseImplementation(input.implementation);
  if (status !== "ok") {
    const reason = record(input.reason, "external baseline reason");
    return {
      schemaVersion: 1,
      requestId: request.requestId,
      status,
      implementation,
      reason: {
        code: nonEmptyString(reason.code, "external baseline reason.code"),
        message: nonEmptyString(reason.message, "external baseline reason.message"),
      },
    };
  }
  const bounds = boundaryBounds(request.boundary);
  return {
    schemaVersion: 1,
    requestId: request.requestId,
    status,
    implementation,
    before: parseRun(
      input.before,
      "before",
      request.before.nodes.map(({ id }) => id),
      bounds,
    ),
    after: parseRun(
      input.after,
      "after",
      request.after.nodes.map(({ id }) => id),
      bounds,
    ),
  };
}

/** Validate ordered geometry emitted by a separately versioned sequence adapter. */
export function parseExternalLayoutSequenceResponse(
  value: unknown,
  request: ExternalLayoutSequenceRequestV2,
): ExternalLayoutSequenceResponseV2 {
  const input = record(value, "external layout sequence response");
  if (input.schemaVersion !== 2) throw new Error("external sequence schemaVersion must be 2");
  if (input.requestId !== request.requestId) {
    throw new Error("external sequence requestId does not match the request");
  }
  const status = input.status;
  if (status !== "ok" && status !== "unsupported" && status !== "failed") {
    throw new Error("external sequence status is invalid");
  }
  const implementation = parseSequenceImplementation(input.implementation);
  if (status !== "ok") {
    const reason = record(input.reason, "external sequence reason");
    return {
      schemaVersion: 2,
      requestId: request.requestId,
      status,
      implementation,
      reason: {
        code: nonEmptyString(reason.code, "external sequence reason.code"),
        message: nonEmptyString(reason.message, "external sequence reason.message"),
      },
    };
  }
  if (!Array.isArray(input.runs) || input.runs.length !== request.snapshots.length) {
    throw new Error("external sequence runs must match the requested snapshot count");
  }
  const bounds = boundaryBounds(request.boundary);
  const runs = input.runs.map((value, index) => {
    const snapshot = request.snapshots[index]!;
    return parseSequenceRun(
      value,
      `runs[${index}]`,
      snapshot.snapshotId,
      snapshot.graph.nodes.map(({ id }) => id),
      bounds,
    );
  });
  return {
    schemaVersion: 2,
    requestId: request.requestId,
    status: "ok",
    implementation,
    runs,
  };
}
