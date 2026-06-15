import { describe, expect, it } from "vitest";
import { extractMoonbitSymbols } from "./astExtract.js";

// integration test: loads the vendored MoonBit parser bundle and checks the
// AST → symbol mapping. Skips gracefully if the parser cannot be loaded.
describe("extractMoonbitSymbols (real parser)", () => {
  const source = [
    "pub fn add(a : Int, b : Int) -> Int {",
    "  a + b",
    "}",
    "",
    "fn helper() -> Unit {",
    "  ()",
    "}",
    "",
    "pub struct Point {",
    "  x : Int",
    "}",
    "",
    "pub enum Color {",
    "  Red",
    "  Green",
    "}",
    "",
    "pub trait Hello {",
    "  hi(Self) -> String",
    "}",
    "",
    "pub let answer : Int = 42",
    "",
    "pub fn Point::mag(self : Point) -> Int {",
    "  self.x",
    "}",
  ].join("\n");

  it("extracts kinds, visibility, methods, and line ranges", async () => {
    const syms = await extractMoonbitSymbols(source, "demo.mbt");
    if (syms === null) {
      // parser bundle missing in this environment — nothing to assert
      return;
    }
    const by = (n: string) => syms.find((s) => s.name === n);
    expect(by("add")?.kind).toBe("function");
    expect(by("add")?.exported).toBe(true);
    expect(by("helper")?.exported).toBe(false);
    expect(by("Point")?.kind).toBe("class");
    expect(by("Color")?.kind).toBe("enum");
    expect(by("Hello")?.kind).toBe("interface");
    expect(by("answer")?.kind).toBe("variable");
    // a `T::m` method carries its receiver type as parentClass
    const mag = by("mag");
    expect(mag?.kind).toBe("method");
    expect(mag?.parentClass).toBe("Point");
    // real source locations (add spans its multi-line body)
    expect(by("add")?.startLine).toBe(1);
    expect(by("add")?.endLine).toBe(3);
  });
});
