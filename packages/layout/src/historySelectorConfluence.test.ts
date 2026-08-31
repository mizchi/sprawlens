import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyHistorySelectorEdit,
  createHistorySelectorState,
  selectHistoryCandidate,
} from "./historySelectorConfluence.ts";

type Fixture = {
  schemaVersion: 1;
  selectorCases: Array<{
    name: string;
    editA: boolean;
    editB: boolean;
    previous: boolean;
    expected: boolean;
  }>;
  pathCase: {
    name: string;
    expectedInputA: boolean;
    expectedInputB: boolean;
    expectedAB: boolean;
    expectedBA: boolean;
  };
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/history-selector-confluence.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

const sideToBool = (side: "left" | "right") => side === "right";

describe("history-dependent finite selector confluence", () => {
  it("uses the pinned shared-fixture schema", () => {
    expect(fixture.schemaVersion).toBe(1);
  });

  it.each(fixture.selectorCases)("selects: $name", ({ editA, editB, previous, expected }) => {
    const selected = selectHistoryCandidate(
      { editA, editB },
      previous ? "right" : "left",
    );
    expect(sideToBool(selected.id)).toBe(expected);
  });

  it(fixture.pathCase.name, () => {
    const base = createHistorySelectorState();
    const ab = applyHistorySelectorEdit(
      applyHistorySelectorEdit(base, "enableA"),
      "enableB",
    );
    const ba = applyHistorySelectorEdit(
      applyHistorySelectorEdit(base, "enableB"),
      "enableA",
    );

    expect(ab.input).toEqual({
      editA: fixture.pathCase.expectedInputA,
      editB: fixture.pathCase.expectedInputB,
    });
    expect(ba.input).toEqual(ab.input);
    expect(sideToBool(ab.selected.id)).toBe(fixture.pathCase.expectedAB);
    expect(sideToBool(ba.selected.id)).toBe(fixture.pathCase.expectedBA);
    expect(ab.selected.id).not.toBe(ba.selected.id);
  });
});
