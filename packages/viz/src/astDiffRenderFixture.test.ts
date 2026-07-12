import { describe, expect, it } from "vitest";
import { buildAstDiffRenderSnapshot } from "./astDiffRenderFixture.ts";

describe("buildAstDiffRenderSnapshot", () => {
  it("namespaces files and parent ids across repositories and repeats", () => {
    const snapshot = buildAstDiffRenderSnapshot(
      {
        cases: [
          {
            id: "a",
            repository: "org/one",
            file: "src/index.ts",
            after: [
              {
                id: "old-class",
                name: "Service",
                kind: "class",
                startLine: 1,
                endLine: 8,
                loc: 3,
              },
              {
                id: "old-method",
                name: "run",
                kind: "method",
                startLine: 2,
                endLine: 4,
                loc: 3,
                parentClass: "old-class",
              },
            ],
          },
          {
            id: "b",
            repository: "org/two",
            file: "src/index.ts",
            after: [],
          },
        ],
      },
      { repeat: 2 },
    );

    const files = snapshot.nodes.filter((node) => node.type === "file");
    expect(files).toHaveLength(4);
    expect(new Set(files.map((node) => node.path)).size).toBe(4);
    const first = files.find((node) => node.path === "copy-0/org/one/src/index.ts")!;
    expect(first.symbols?.[1]).toMatchObject({
      id: "symbol:copy-0/org/one/src/index.ts:method:run:2",
      parentClass: "symbol:copy-0/org/one/src/index.ts:class:Service:1",
      exported: true,
    });
  });
});
