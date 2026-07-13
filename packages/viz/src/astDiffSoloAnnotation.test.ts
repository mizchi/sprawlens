import { describe, expect, it } from "vitest";
import {
  compareSoloAstDiffAnnotationPasses,
  createUniqueSoloAstDiffSelectors,
  createSoloAstDiffAnnotationPasses,
  validateCompletedSoloAstDiffAnnotationPass,
  type SoloAstDiffAnnotationSheet,
} from "./astDiffSoloAnnotation.ts";

const functionSelector = (name: string) => ({ kind: "function", name });

const sourceCases = [
  { id: "source-alpha", candidates: [functionSelector("alpha")] },
  { id: "source-beta", candidates: [functionSelector("beta")] },
  { id: "source-gamma", candidates: [functionSelector("gamma")] },
  { id: "source-delta", candidates: [functionSelector("delta")] },
];

describe("createSoloAstDiffAnnotationPasses", () => {
  it("creates deterministic opaque sheets and a deranged second-pass order", () => {
    const first = createSoloAstDiffAnnotationPasses(sourceCases, {
      datasetId: "holdout",
      passASeed: 1729,
      passBSeed: 2027,
      minimumWashoutDays: 7,
    });
    const second = createSoloAstDiffAnnotationPasses(sourceCases, {
      datasetId: "holdout",
      passASeed: 1729,
      passBSeed: 2027,
      minimumWashoutDays: 7,
    });

    expect(first).toEqual(second);
    expect(first.passA.sheet.cases.map((item) => item.alias)).toEqual([
      "A-001",
      "A-002",
      "A-003",
      "A-004",
    ]);
    expect(first.passB.sheet.cases.map((item) => item.alias)).toEqual([
      "B-001",
      "B-002",
      "B-003",
      "B-004",
    ]);
    expect(JSON.stringify(first.passA.sheet)).not.toContain("source-alpha");
    expect(JSON.stringify(first.passB.sheet)).not.toContain("source-alpha");

    const passAOrder = first.passA.key.cases.map((item) => item.caseId);
    const passBOrder = first.passB.key.cases.map((item) => item.caseId);
    expect(passBOrder.every((caseId, index) => caseId !== passAOrder[index])).toBe(true);
    expect(first.passA.sheet.cases[0]).toMatchObject({
      reviewed: false,
      decisions: [expect.objectContaining({ decision: "none" })],
    });
  });
});

describe("createUniqueSoloAstDiffSelectors", () => {
  it("adds source-order occurrences only when semantic selectors collide", () => {
    expect(
      createUniqueSoloAstDiffSelectors([
        { id: "one", kind: "function", name: "run", loc: 1, startLine: 10, endLine: 10 },
        { id: "other", kind: "function", name: "stop", loc: 1, startLine: 15, endLine: 15 },
        { id: "two", kind: "function", name: "run", loc: 1, startLine: 20, endLine: 20 },
      ]),
    ).toEqual([
      { kind: "function", name: "run", occurrence: 0 },
      { kind: "function", name: "stop" },
      { kind: "function", name: "run", occurrence: 1 },
    ]);
  });
});

describe("compareSoloAstDiffAnnotationPasses", () => {
  it("reports binary and status test-retest agreement with disagreements", () => {
    const generated = createSoloAstDiffAnnotationPasses(
      [
        {
          id: "case-one",
          candidates: [
            functionSelector("first"),
            functionSelector("second"),
            functionSelector("third"),
          ],
        },
        { id: "case-two", candidates: [functionSelector("fourth")] },
      ],
      {
        datasetId: "holdout",
        passASeed: 11,
        passBSeed: 23,
        minimumWashoutDays: 7,
      },
    );
    const passA = completeSheet(
      generated.passA.sheet,
      "2026-07-13",
      "2026-07-13",
      {
        "case-one:first": "modified",
        "case-one:second": "none",
        "case-one:third": "added",
        "case-two:fourth": "none",
      },
      generated.passA.key,
    );
    const passB = completeSheet(
      generated.passB.sheet,
      "2026-07-21",
      "2026-07-21",
      {
        "case-one:first": "modified",
        "case-one:second": "added",
        "case-one:third": "modified",
        "case-two:fourth": "none",
      },
      generated.passB.key,
    );

    expect(validateCompletedSoloAstDiffAnnotationPass(passA, generated.passA.key, "A")).toEqual({
      datasetId: "holdout",
      passId: "A",
      cases: 2,
      symbols: 4,
      startedOn: "2026-07-13",
      completedOn: "2026-07-13",
    });

    const report = compareSoloAstDiffAnnotationPasses(
      passA,
      generated.passA.key,
      passB,
      generated.passB.key,
    );

    expect(report).toMatchObject({
      datasetId: "holdout",
      cases: 2,
      symbols: 4,
      washoutDays: 8,
      binary: { agreements: 3, disagreements: 1, agreement: 0.75 },
      status: { compared: 2, agreements: 1, disagreements: 1, agreement: 0.5 },
    });
    expect(report.disagreements).toEqual([
      expect.objectContaining({ caseId: "case-one", symbol: functionSelector("second") }),
      expect.objectContaining({ caseId: "case-one", symbol: functionSelector("third") }),
    ]);
  });

  it("fails closed on incomplete sheets, inspected predictions, or a short washout", () => {
    const generated = createSoloAstDiffAnnotationPasses(sourceCases.slice(0, 2), {
      datasetId: "holdout",
      passASeed: 11,
      passBSeed: 23,
      minimumWashoutDays: 7,
    });
    const passA = completeSheet(
      generated.passA.sheet,
      "2026-07-13",
      "2026-07-13",
      { "source-alpha:alpha": "none", "source-beta:beta": "modified" },
      generated.passA.key,
    );
    const passB = completeSheet(
      generated.passB.sheet,
      "2026-07-15",
      "2026-07-15",
      { "source-alpha:alpha": "none", "source-beta:beta": "modified" },
      generated.passB.key,
    );

    expect(() =>
      compareSoloAstDiffAnnotationPasses(passA, generated.passA.key, passB, generated.passB.key),
    ).toThrow(/washout/i);

    passB.annotation.predictionsInspected = true;
    expect(() =>
      compareSoloAstDiffAnnotationPasses(passA, generated.passA.key, passB, generated.passB.key),
    ).toThrow(/predictions/i);

    passB.annotation.predictionsInspected = false;
    passB.annotation.startedOn = "2026-07-21";
    passB.annotation.completedOn = "2026-07-21";
    passB.cases[0]!.reviewed = false;
    expect(() =>
      compareSoloAstDiffAnnotationPasses(passA, generated.passA.key, passB, generated.passB.key),
    ).toThrow(/incomplete/i);
  });
});

function completeSheet(
  template: SoloAstDiffAnnotationSheet,
  startedOn: string,
  completedOn: string,
  decisions: Record<string, "added" | "modified" | "none">,
  key: { cases: Array<{ alias: string; caseId: string }> },
): SoloAstDiffAnnotationSheet {
  const caseIdByAlias = new Map(key.cases.map((item) => [item.alias, item.caseId]));
  return {
    ...structuredClone(template),
    annotation: {
      annotatorId: "solo-author",
      startedOn,
      completedOn,
      predictionsInspected: false,
      otherPassInspectedDuringAnnotation: false,
    },
    cases: template.cases.map((item) => {
      const caseId = caseIdByAlias.get(item.alias)!;
      return {
        ...structuredClone(item),
        reviewed: true,
        decisions: item.decisions.map((decision) => ({
          ...structuredClone(decision),
          decision: decisions[`${caseId}:${decision.symbol.name}`]!,
        })),
      };
    }),
  };
}
