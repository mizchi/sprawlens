import { describe, expect, it } from "vitest";
import { parseHoverMarkdown, tokenizeCode } from "./highlightCode.js";

/** Compact "kind:text" view of a token stream, for terse assertions. */
function shape(code: string): string[] {
  return tokenizeCode(code).map((t) => `${t.kind}:${t.text}`);
}

describe("tokenizeCode", () => {
  it("classifies keywords, types, identifiers and punctuation", () => {
    const s = shape("pub fn parse(_s: &str) -> Expr");
    expect(s).toContain("keyword:pub");
    expect(s).toContain("keyword:fn");
    expect(s).toContain("plain:parse");
    // PascalCase identifiers read as types
    expect(s).toContain("type:Expr");
    // a lowercase primitive name is still highlighted as a type
    expect(s).toContain("type:str");
  });

  it("highlights strings and numbers", () => {
    const s = shape('let x = "hi" + 42');
    expect(s).toContain("keyword:let");
    expect(s).toContain('string:"hi"');
    expect(s).toContain("number:42");
  });

  it("highlights line and block comments without splitting their text", () => {
    expect(shape("a // tail comment")).toContain("comment:// tail comment");
    expect(shape("/* a b */ x")).toContain("comment:/* a b */");
  });

  it("never drops characters — tokens rejoin to the input", () => {
    const code = "fn f<T: Trait>(x: &T) -> Vec<T> { x }";
    expect(
      tokenizeCode(code)
        .map((t) => t.text)
        .join(""),
    ).toBe(code);
  });

  it("treats an unterminated string as a string to the end of line", () => {
    const s = shape('x = "oops');
    expect(s).toContain('string:"oops');
  });
});

describe("parseHoverMarkdown", () => {
  it("splits fenced code blocks (carrying their lang) from prose", () => {
    const md = "```rust\npub fn parse() -> Expr\n```";
    const blocks = parseHoverMarkdown(md);
    expect(blocks).toEqual([{ type: "code", lang: "rust", text: "pub fn parse() -> Expr" }]);
  });

  it("keeps prose between code blocks as text", () => {
    const md = "```rust\nfn a()\n```\nDoes a thing.\n```rust\nfn b()\n```";
    const blocks = parseHoverMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual(["code", "text", "code"]);
    expect(blocks[1]).toEqual({ type: "text", text: "Does a thing." });
  });

  it("returns a lone prose string as a single text block", () => {
    expect(parseHoverMarkdown("just text")).toEqual([{ type: "text", text: "just text" }]);
  });

  it("dedents a code block so source nesting depth doesn't skew it", () => {
    // a signature pulled from a deeply-nested symbol keeps its source indent;
    // strip the common leading whitespace but keep relative indentation
    const md = "```rust\n    fn foo(\n        x: i32,\n    ) -> i32 {\n```";
    expect(parseHoverMarkdown(md)).toEqual([
      { type: "code", lang: "rust", text: "fn foo(\n    x: i32,\n) -> i32 {" },
    ]);
  });

  it("dedents tab-indented code (gopls) too", () => {
    const md = "```go\n\tfunc f() {\n\t\treturn\n\t}\n```";
    expect(parseHoverMarkdown(md)).toEqual([
      { type: "code", lang: "go", text: "func f() {\n\treturn\n}" },
    ]);
  });
});
