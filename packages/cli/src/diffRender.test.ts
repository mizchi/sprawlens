import { describe, expect, it } from "vitest";
import type { WorkingDiff } from "@sprawlens/server";
import { toDiffOverlay } from "./diffRender.ts";

describe("toDiffOverlay", () => {
  it("splits changed entries into added/modified and counts removed", () => {
    const diff: WorkingDiff = {
      changed: { "src/a.ts": "modified", "src/b.ts": "added", "src/c.ts": "added" },
      removed: ["src/old.ts", "src/gone.ts"],
    };
    const { changed, diffSummary } = toDiffOverlay(diff);
    expect(changed.get("src/a.ts")).toBe("modified");
    expect(changed.get("src/b.ts")).toBe("added");
    expect(diffSummary).toEqual({ added: 2, modified: 1, removed: 2 });
  });

  it("handles an empty diff", () => {
    const { changed, diffSummary } = toDiffOverlay({ changed: {}, removed: [] });
    expect(changed.size).toBe(0);
    expect(diffSummary).toEqual({ added: 0, modified: 0, removed: 0 });
  });
});
