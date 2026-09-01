import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  controlledEndpointRelationContractV1,
  parseControlledEndpointRelationContractV1,
} from "./endpointRelation.ts";

const contractPath = new URL(
  "../../../research/controlled-endpoint-relation-contract.json",
  import.meta.url,
);

describe("parseControlledEndpointRelationContractV1", () => {
  it("accepts the checked-in endpoint relation taxonomy", () => {
    const parsed = parseControlledEndpointRelationContractV1(
      JSON.parse(readFileSync(contractPath, "utf8")),
    );

    expect(parsed).toEqual(controlledEndpointRelationContractV1);
    expect(parsed.relations.map(({ id, status }) => [id, status])).toEqual([
      ["serialized-equal", "supported"],
      ["labeled-graph-equal", "supported"],
      ["rename-equivalent", "supported-with-witness"],
      ["hierarchy-equivalent", "unsupported-by-graph-schema"],
      ["isomorphic", "unsupported-without-isomorphism-witness"],
    ]);
  });

  it("rejects silently treating hierarchy as represented", () => {
    const changed = structuredClone(controlledEndpointRelationContractV1) as unknown as {
      relations: Array<Record<string, unknown>>;
    };
    changed.relations[3]!.status = "supported";

    expect(() => parseControlledEndpointRelationContractV1(changed)).toThrow(/relations\[3\]/);
  });
});
