import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canProduceExternalSequenceEffect,
  classifyExternalSequenceResponse,
  type ExternalSequenceEffectPathGate,
  type ExternalSequenceResponseClass,
  type ExternalSequenceResponseStatus,
} from "./externalSequenceGate.ts";

type Fixture = {
  schemaVersion: 1;
  supportCases: Array<{
    name: string;
    facts: {
      validBoundary: boolean;
      validGraph: boolean;
      boundaryCovered: boolean;
      initializationCovered: boolean;
      nodeCountCovered: boolean;
    };
    expected: boolean;
  }>;
  responseCases: Array<{
    name: string;
    expectedSupported: boolean;
    status: ExternalSequenceResponseStatus;
    expected: ExternalSequenceResponseClass;
  }>;
  effectCases: Array<{
    name: string;
    paths: ExternalSequenceEffectPathGate[];
    expected: boolean;
  }>;
};

const fixture = JSON.parse(
  readFileSync(new URL("../../../formal/TestVectors/external-sequence-gate.json", import.meta.url), "utf8"),
) as Fixture;

const expectedSupported = (facts: Fixture["supportCases"][number]["facts"]) =>
  facts.validBoundary &&
  facts.validGraph &&
  facts.boundaryCovered &&
  facts.initializationCovered &&
  facts.nodeCountCovered;

describe("Lean/TypeScript external sequence gate conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.supportCases)("support: $name", ({ facts, expected }) => {
    expect(expectedSupported(facts)).toBe(expected);
  });

  it.each(fixture.responseCases)("response: $name", ({ status, expectedSupported, expected }) => {
    expect(classifyExternalSequenceResponse(status, expectedSupported)).toBe(expected);
  });

  it.each(fixture.effectCases)("effect: $name", ({ paths, expected }) => {
    expect(canProduceExternalSequenceEffect(paths)).toBe(expected);
  });
});
