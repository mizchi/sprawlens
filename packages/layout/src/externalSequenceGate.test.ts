import { describe, expect, it } from "vitest";
import {
  canProduceExternalSequenceEffect,
  classifyExternalSequenceResponse,
} from "./externalSequenceGate.ts";

describe("external sequence evidence gate", () => {
  it.each([
    ["unsupported", true, "unexpected-unsupported"],
    ["unsupported", false, "expected-missingness"],
    ["ok", false, "capability-violation"],
    ["ok", true, "accepted"],
    ["failed", true, "failed"],
    ["execution-failed", false, "execution-failed"],
  ] as const)("classifies %s with expectedSupported=%s", (status, expected, classification) => {
    expect(classifyExternalSequenceResponse(status, expected)).toBe(classification);
  });

  it("retains legacy exploratory classification when no manifest is supplied", () => {
    expect(classifyExternalSequenceResponse("unsupported", null)).toBe("unsupported");
    expect(classifyExternalSequenceResponse("ok", null)).toBe("accepted");
  });

  it("allows confirmatory effects only when every registered path passes every gate", () => {
    const eligible = {
      responseOk: true,
      hostValid: true,
      expectedSupported: true,
      metadataMatches: true,
    };
    expect(canProduceExternalSequenceEffect([eligible, eligible])).toBe(true);

    for (const gate of Object.keys(eligible) as Array<keyof typeof eligible>) {
      expect(canProduceExternalSequenceEffect([eligible, { ...eligible, [gate]: false }])).toBe(
        false,
      );
    }
  });
});
