import { describe, expect, it } from "vitest";
import { buildChangedPreviewFocus } from "./changedPreview.ts";

describe("buildChangedPreviewFocus", () => {
  const moduleOfId = (id: string) => id.split("/").slice(0, 2).join("/");
  const parentFileOf = (id: string) => (id.startsWith("symbol:") ? id.split(":")[1]! : id);

  it("extracts changed files and their modules", () => {
    const focus = buildChangedPreviewFocus({
      changedFiles: new Map([["src/app.tsx", "modified"]]),
      changedSymbols: new Map(),
      moduleOfId,
      parentFileOf,
    });
    expect(focus?.level).toBe("file");
    expect([...focus!.fileIds]).toEqual(["src/app.tsx"]);
    expect([...focus!.moduleIds]).toEqual(["src/app.tsx"]);
  });

  it("uses exact changed symbols when hunk stats identify them", () => {
    const focus = buildChangedPreviewFocus({
      changedFiles: new Map([["src/app.tsx", "modified"]]),
      changedSymbols: new Map(),
      diffStats: new Map([
        ["src/app.tsx", {}],
        ["symbol:src/app.tsx:function:App:10", {}],
      ]),
      moduleOfId,
      parentFileOf,
      symbolsByFile: new Map([
        [
          "src/app.tsx",
          [
            { id: "symbol:src/app.tsx:function:App:10" },
            { id: "symbol:src/app.tsx:function:Other:30" },
          ],
        ],
      ]),
    });
    expect(focus?.level).toBe("symbol");
    expect([...focus!.symbolIds]).toEqual(["symbol:src/app.tsx:function:App:10"]);
  });

  it("falls back to all symbols in a changed file when symbol precision is unavailable", () => {
    const focus = buildChangedPreviewFocus({
      changedFiles: new Map([["src/app.tsx", "modified"]]),
      changedSymbols: new Map(),
      moduleOfId,
      parentFileOf,
      symbolsByFile: new Map([["src/app.tsx", [{ id: "symbol:src/app.tsx:function:App:10" }]]]),
    });
    expect([...focus!.symbolIds]).toEqual(["symbol:src/app.tsx:function:App:10"]);
  });
});
