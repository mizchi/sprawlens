import { describe, expect, it } from "vitest";
import { extractTsTests } from "./testExtract.js";

describe("extractTsTests", () => {
  it("extracts nested describe/it/test with names and nesting", () => {
    const src = `
      import { describe, it, test } from "vitest";
      describe("math", () => {
        it("adds", () => {});
        describe("mul", () => {
          test("by zero", () => {});
        });
      });
      test("top level", () => {});
    `;
    const nodes = extractTsTests("a.test.ts", src);
    expect(nodes.map((n) => n.name)).toEqual(["math", "top level"]);
    const math = nodes[0]!;
    expect(math.kind).toBe("suite");
    expect(math.children.map((c) => `${c.kind}:${c.name}`)).toEqual([
      "case:adds",
      "suite:mul",
    ]);
    expect(math.children[1]!.children.map((c) => c.name)).toEqual(["by zero"]);
    expect(nodes[1]!.kind).toBe("case");
  });

  it("peels describe.each / it.skip and keeps template titles", () => {
    const src = `
      describe.each([1, 2])("case %s", () => {
        it.skip("pending", () => {});
        it(\`templated \${x}\`, () => {});
      });
    `;
    const nodes = extractTsTests("a.test.ts", src);
    expect(nodes[0]!.name).toBe("case %s");
    const kids = nodes[0]!.children;
    expect(kids.map((c) => c.name)).toEqual(["pending", "templated ${…}"]);
  });

  it("ignores non-test calls and untitled calls", () => {
    expect(extractTsTests("a.test.ts", `foo("x", () => {}); bar();`)).toEqual([]);
    expect(extractTsTests("a.test.ts", `it(myName, () => {});`)).toEqual([]);
  });

  it("records the declaration line of each case", () => {
    const src = `describe("s", () => {\n  it("c", () => {});\n});`;
    const nodes = extractTsTests("a.test.ts", src);
    expect(nodes[0]!.startLine).toBe(1);
    expect(nodes[0]!.children[0]!.startLine).toBe(2);
  });
});
