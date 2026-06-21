import { describe, expect, it } from "vitest";
import { parseVitestReport } from "./testReport.js";

// vitest --reporter=json shape (one file, three cases)
const report = {
  numTotalTests: 3,
  testResults: [
    {
      name: "/repo/src/math.test.ts",
      assertionResults: [
        {
          ancestorTitles: ["math"],
          title: "adds two numbers",
          fullName: "math > adds two numbers",
          status: "passed",
          duration: 12,
          location: { line: 5, column: 3 },
        },
        {
          ancestorTitles: ["math"],
          title: "throws on NaN",
          status: "failed",
          duration: 4,
          failureMessages: ["AssertionError: expected …"],
          location: { line: 9, column: 3 },
        },
        {
          ancestorTitles: [],
          title: "todo later",
          status: "skipped",
        },
      ],
    },
  ],
};

describe("parseVitestReport", () => {
  it("maps each assertion to a TestCaseResult with a tree-shaped id", () => {
    const run = parseVitestReport(report, "/repo");
    expect(run.results).toHaveLength(3);
    const add = run.results[0]!;
    expect(add.testId).toBe("test:src/math.test.ts:5:adds two numbers");
    expect(add.file).toBe("src/math.test.ts");
    expect(add.name).toBe("math › adds two numbers");
    expect(add.status).toBe("pass");
    expect(add.durationMs).toBe(12);
  });

  it("normalizes statuses and carries the failure message", () => {
    const run = parseVitestReport(report, "/repo");
    expect(run.results[1]!.status).toBe("fail");
    expect(run.results[1]!.message).toBe("AssertionError: expected …");
    expect(run.results[2]!.status).toBe("skip");
  });

  it("falls back to a line-less id when no location is reported", () => {
    const run = parseVitestReport(report, "/repo");
    // the third case has no location → id keeps the title, line unknown
    expect(run.results[2]!.testId).toBe("test:src/math.test.ts:?:todo later");
    expect(run.results[2]!.name).toBe("todo later");
  });
});
