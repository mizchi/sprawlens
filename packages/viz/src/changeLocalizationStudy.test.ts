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
  it("derives completion, first-relevant-symbol, and navigation counts", () => {
    expect(
      summarizeChangeLocalizationEvents([
        { type: "task-started", monotonicMs: 100 },
        { type: "navigation", monotonicMs: 250 },
        { type: "relevant-symbol-opened", monotonicMs: 400 },
        { type: "navigation", monotonicMs: 550 },
        { type: "answer-submitted", monotonicMs: 900 },
      ]),
    ).toEqual({
      completionMs: 800,
      firstRelevantSymbolMs: 300,
      navigationCount: 2,
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
});
