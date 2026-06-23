import { describe, expect, it } from "vitest";
import type { TestNode } from "@sprawlens/contracts";
import { buildTestTree } from "./testTree.js";

/** Find a node by name in a forest (depth-first), for terse assertions. */
function find(nodes: readonly TestNode[], name: string): TestNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = find(n.children, name);
    if (hit) return hit;
  }
  return undefined;
}

const caseNode = (file: string, name: string, line: number): TestNode => ({
  id: `test:${file}:${line}:${name}`,
  kind: "case",
  name,
  file,
  startLine: line,
  children: [],
});

describe("buildTestTree", () => {
  it("returns null when no file has tests", () => {
    expect(buildTestTree([{ file: "src/a.test.ts", nodes: [] }])).toBeNull();
  });

  it("nests dir → file → suite → case, stripping the shared dir prefix", () => {
    const tree = buildTestTree([
      {
        file: "packages/core/src/a.test.ts",
        nodes: [
          {
            id: "test:a:1:math",
            kind: "suite",
            name: "math",
            file: "packages/core/src/a.test.ts",
            startLine: 1,
            children: [caseNode("packages/core/src/a.test.ts", "adds", 2)],
          },
        ],
      },
      {
        file: "packages/cli/src/b.test.ts",
        nodes: [caseNode("packages/cli/src/b.test.ts", "runs", 5)],
      },
    ]);
    expect(tree).not.toBeNull();
    const roots = tree!.root.children;
    // shared "packages" prefix is dropped; the tree starts where paths diverge,
    // and the single-child "core/src" chain collapses to one dir node
    expect(find(roots, "packages")).toBeUndefined();
    const core = find(roots, "core/src");
    expect(core?.kind).toBe("dir");
    const file = find(roots, "a.test.ts");
    expect(file?.kind).toBe("file");
    const suite = find(roots, "math");
    expect(suite?.kind).toBe("suite");
    const testCase = find(roots, "adds");
    expect(testCase?.kind).toBe("case");
    // the case lives under its suite under its file
    expect(file?.children.some((c) => c.name === "math")).toBe(true);
    expect(suite?.children.some((c) => c.name === "adds")).toBe(true);
  });

  it("collapses single-child directory chains into one node", () => {
    const tree = buildTestTree([
      { file: "a/b/c/x.test.ts", nodes: [caseNode("a/b/c/x.test.ts", "t1", 1)] },
      { file: "a/b/c/y.test.ts", nodes: [caseNode("a/b/c/y.test.ts", "t2", 1)] },
    ])!;
    // common prefix a/b/c is fully stripped, so the two files sit at the root
    expect(tree.root.children.map((c) => c.name).sort()).toEqual(["x.test.ts", "y.test.ts"]);
  });

  it("merges a single-child dir chain when it is not the shared prefix", () => {
    const tree = buildTestTree([
      { file: "root/deep/only/x.test.ts", nodes: [caseNode("root/deep/only/x.test.ts", "t1", 1)] },
      { file: "root/other.test.ts", nodes: [caseNode("root/other.test.ts", "t2", 1)] },
    ])!;
    // "root" is the shared prefix → stripped; "deep/only" collapses to one node
    const collapsed = find(tree.root.children, "deep/only");
    expect(collapsed?.kind).toBe("dir");
    expect(find(collapsed!.children, "x.test.ts")).toBeDefined();
  });
});
