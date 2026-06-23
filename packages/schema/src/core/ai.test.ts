import { describe, expect, it } from "vitest";
import { detectAIIndicators } from "./ai.js";

describe("detectAIIndicators", () => {
  it("marks AI-assisted commits heuristically without asserting certainty", () => {
    const info = detectAIIndicators({
      authorName: "Mizchi",
      authorEmail: "mz@example.com",
      message:
        "Add graph UI\n\nGenerated with Claude Code\nCo-authored-by: Claude <noreply@anthropic.com>",
    });

    expect(info.likelyAI).toBe(true);
    expect(info.indicators).toContain("claude-code");
    expect(info.rawMatches.length).toBeGreaterThan(0);
  });

  it("does not flag ordinary commits", () => {
    const info = detectAIIndicators({
      authorName: "Mizchi",
      message: "Fix import resolver",
    });

    expect(info.likelyAI).toBe(false);
    expect(info.indicators).toEqual([]);
  });
});
