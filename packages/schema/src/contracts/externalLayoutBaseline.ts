import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutImplementationV1,
  ExternalLayoutPointV1,
  ExternalLayoutRunV1,
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
  label: "before" | "after",
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
  const xs = request.boundary.map(({ x }) => x);
  const ys = request.boundary.map(({ y }) => y);
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
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
