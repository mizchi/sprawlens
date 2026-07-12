import { describe, expect, it } from "vitest";
import { symbolGlyphOf } from "./symbolIcons.tsx";

describe("symbolGlyphOf", () => {
  it("renders registration regions with the function glyph", () => {
    expect(symbolGlyphOf("registration", "registerTool.create_entities")).toBe("function");
  });
});
