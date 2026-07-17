import { describe, expect, it } from "vitest";
import {
  assignChangeLocalizationTasks,
  summarizeChangeLocalizationEvents,
} from "./changeLocalizationStudy.ts";

describe("assignChangeLocalizationTasks", () => {
  it("uses all six orders and balances two tasks per condition", () => {
    const caseIds = Array.from({ length: 30 }, (_, index) => `case-${index}`);
    const assignments = Array.from({ length: 6 }, (_, participantIndex) =>
      assignChangeLocalizationTasks(caseIds, participantIndex, { tasksPerCondition: 2 }),
    );

    expect(
      new Set(
        assignments.map((items) =>
          items
            .slice(0, 3)
            .map((x) => x.condition)
            .join(","),
        ),
      ),
    ).toHaveLength(6);
    for (const items of assignments) {
      expect(items).toHaveLength(6);
      expect(new Set(items.map((item) => item.caseId)).size).toBe(6);
      expect(items.filter((item) => item.condition === "file-level")).toHaveLength(2);
      expect(items.filter((item) => item.condition === "range-overlap")).toHaveLength(2);
      expect(items.filter((item) => item.condition === "parent-aware")).toHaveLength(2);
    }
  });

  it("is deterministic and rejects an undersized case pool", () => {
    expect(assignChangeLocalizationTasks(["a", "b", "c"], 4)).toEqual(
      assignChangeLocalizationTasks(["a", "b", "c"], 4),
    );
    expect(() => assignChangeLocalizationTasks(["a", "b"], 0)).toThrow(/at least 3 cases/);
  });
});

describe("summarizeChangeLocalizationEvents", () => {
  it("derives prerecruitment timing and distinct-context outcomes", () => {
    expect(
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 100 },
        { type: "context-source-opened", monotonicMs: 150, contextSourceOrdinal: 7 },
        { type: "navigation", monotonicMs: 250 },
        { type: "core-change-opened", monotonicMs: 300 },
        { type: "context-source-opened", monotonicMs: 350, contextSourceOrdinal: 7 },
        { type: "context-source-opened", monotonicMs: 375, contextSourceOrdinal: 2 },
        { type: "relevant-symbol-opened", monotonicMs: 400 },
        { type: "dependent-symbol-opened", monotonicMs: 500 },
        { type: "navigation", monotonicMs: 550 },
        { type: "answer-submitted", monotonicMs: 900 },
      ]),
    ).toEqual({
      completionMs: 800,
      firstRelevantSymbolMs: 300,
      firstCoreChangeMs: 200,
      firstDependentSymbolMs: 400,
      distinctContextSourceCount: 2,
      navigationCount: 2,
    });
  });

  it("returns null for optional milestones that were not reached", () => {
    expect(
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 10 },
        { type: "answer-submitted", monotonicMs: 20 },
      ]),
    ).toEqual({
      completionMs: 10,
      firstRelevantSymbolMs: null,
      firstCoreChangeMs: null,
      firstDependentSymbolMs: null,
      distinctContextSourceCount: 0,
      navigationCount: 0,
    });
  });

  it("fails closed on missing boundaries or non-monotonic logs", () => {
    expect(() =>
      summarizeChangeLocalizationEvents([{ type: "navigation", monotonicMs: 1 }]),
    ).toThrow(/task-started/);
    expect(() =>
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 10 },
        { type: "answer-submitted", monotonicMs: 9 },
      ]),
    ).toThrow(/monotonic/);
  });

  it("rejects context identifiers that could not be anonymous ordinals", () => {
    expect(() =>
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 10 },
        { type: "context-source-opened", monotonicMs: 11, contextSourceOrdinal: -1 },
        { type: "answer-submitted", monotonicMs: 20 },
      ]),
    ).toThrow(/context source ordinal/);
  });

  it("rejects unknown categories and payload fields that could leak source context", () => {
    expect(() =>
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 10 },
        { type: "source-text-opened", monotonicMs: 11 },
        { type: "answer-submitted", monotonicMs: 20 },
      ] as never),
    ).toThrow(/event type/);
    expect(() =>
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 10 },
        {
          type: "context-source-opened",
          monotonicMs: 11,
          contextSourceOrdinal: 0,
          sourcePath: "/private/repository/file.ts",
        },
        { type: "answer-submitted", monotonicMs: 20 },
      ] as never),
    ).toThrow(/event fields/);
  });
});
