import { describe, expect, it } from "vitest";
import { createSoloAstDiffAnnotationPasses } from "./astDiffSoloAnnotation.ts";
import {
  completeSoloAstDiffAnnotationSession,
  getSoloAstDiffAnnotationProgress,
  startSoloAstDiffAnnotationSession,
  updateSoloAstDiffAnnotationCase,
} from "./astDiffSoloAnnotationSession.ts";

function createSheet() {
  return createSoloAstDiffAnnotationPasses(
    [
      {
        id: "case-one",
        candidates: [
          { kind: "function", name: "alpha" },
          { kind: "function", name: "beta" },
        ],
      },
      {
        id: "case-two",
        candidates: [{ kind: "class", name: "Gamma" }],
      },
    ],
    {
      datasetId: "holdout",
      passASeed: 1729,
      passBSeed: 2027,
      minimumWashoutDays: 7,
    },
  ).passA.sheet;
}

describe("solo AST diff annotation session", () => {
  it("starts a prediction-blind session without mutating the frozen template", () => {
    const template = createSheet();
    const started = startSoloAstDiffAnnotationSession(template, {
      annotatorId: "solo-author",
      startedOn: "2026-07-13",
      predictionsNotInspected: true,
      otherPassNotInspected: true,
    });

    expect(started.annotation).toEqual({
      annotatorId: "solo-author",
      startedOn: "2026-07-13",
      completedOn: null,
      predictionsInspected: false,
      otherPassInspectedDuringAnnotation: false,
    });
    expect(template.annotation.annotatorId).toBeNull();
    expect(() =>
      startSoloAstDiffAnnotationSession(template, {
        annotatorId: "solo-author",
        startedOn: "2026-07-13",
        predictionsNotInspected: false,
        otherPassNotInspected: true,
      }),
    ).toThrow(/predictions/i);
  });

  it("updates decisions by position while preserving the symbol contract", () => {
    const started = startSoloAstDiffAnnotationSession(createSheet(), {
      annotatorId: "solo-author",
      startedOn: "2026-07-13",
      predictionsNotInspected: true,
      otherPassNotInspected: true,
    });
    const target = started.cases.find((item) => item.decisions.length === 2)!;
    const alias = target.alias;
    const updated = updateSoloAstDiffAnnotationCase(started, {
      alias,
      decisions: ["modified", "none"],
      notes: "Signature changed.",
      reviewed: true,
    });

    expect(updated.cases.find((item) => item.alias === alias)).toEqual({
      ...target,
      reviewed: true,
      decisions: [
        { symbol: { kind: "function", name: "alpha" }, decision: "modified" },
        { symbol: { kind: "function", name: "beta" }, decision: "none" },
      ],
      notes: "Signature changed.",
    });
    expect(target.reviewed).toBe(false);
    expect(() =>
      updateSoloAstDiffAnnotationCase(started, {
        alias,
        decisions: ["modified"],
        notes: "",
        reviewed: true,
      }),
    ).toThrow(/decision count/i);
    expect(() =>
      updateSoloAstDiffAnnotationCase(started, {
        alias,
        decisions: ["modified", "deleted" as "none"],
        notes: "",
        reviewed: true,
      }),
    ).toThrow(/invalid decision/i);
  });

  it("reports progress and completes only after every case is reviewed", () => {
    let sheet = startSoloAstDiffAnnotationSession(createSheet(), {
      annotatorId: "solo-author",
      startedOn: "2026-07-13",
      predictionsNotInspected: true,
      otherPassNotInspected: true,
    });
    expect(getSoloAstDiffAnnotationProgress(sheet)).toEqual({
      cases: 2,
      reviewedCases: 0,
      symbols: 3,
      classifiedSymbols: 0,
      complete: false,
      nextAlias: "A-001",
    });
    expect(() => completeSoloAstDiffAnnotationSession(sheet, "2026-07-13")).toThrow(/unreviewed/i);

    for (const item of sheet.cases) {
      sheet = updateSoloAstDiffAnnotationCase(sheet, {
        alias: item.alias,
        decisions: item.decisions.map((_, index) => (index === 0 ? "modified" : "none")),
        notes: "",
        reviewed: true,
      });
    }
    const completed = completeSoloAstDiffAnnotationSession(sheet, "2026-07-14");

    expect(getSoloAstDiffAnnotationProgress(completed)).toEqual({
      cases: 2,
      reviewedCases: 2,
      symbols: 3,
      classifiedSymbols: 2,
      complete: true,
      nextAlias: null,
    });
    expect(completed.annotation.completedOn).toBe("2026-07-14");
    expect(() =>
      updateSoloAstDiffAnnotationCase(completed, {
        alias: completed.cases[0]!.alias,
        decisions: completed.cases[0]!.decisions.map(({ decision }) => decision),
        notes: "changed after completion",
        reviewed: true,
      }),
    ).toThrow(/completed/i);
  });
});
