import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { definitionPreview } from "./definitionPreview.js";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "defprev-"));
  // a Rust file with a doc comment, an attribute, and a fn body
  await writeFile(
    join(dir, "lib.rs"),
    [
      "use std::fmt;",
      "",
      "/// Greets the world.",
      "/// Second doc line.",
      "#[inline]",
      "pub fn greet(name: &str) -> String {",
      '    format!("hi {name}")',
      "}",
      "",
      "pub struct Widget {",
      "    pub id: u32,",
      "}",
      "",
      "pub const MAX: usize = 10;",
    ].join("\n"),
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("definitionPreview", () => {
  it("captures the doc comment, attribute, and signature up to the body", async () => {
    const r = await definitionPreview(dir, "lib.rs", 6); // `pub fn greet`
    expect(r).not.toBeNull();
    const md = r!.markdown;
    expect(md.startsWith("```rust\n")).toBe(true);
    expect(md).toContain("/// Greets the world.");
    expect(md).toContain("/// Second doc line.");
    expect(md).toContain("#[inline]");
    expect(md).toContain("pub fn greet(name: &str) -> String {");
    // the body must NOT leak in
    expect(md).not.toContain("format!");
  });

  it("includes the opening brace line for a struct", async () => {
    const r = await definitionPreview(dir, "lib.rs", 10); // `pub struct Widget`
    expect(r!.markdown).toContain("pub struct Widget {");
    expect(r!.markdown).not.toContain("pub id: u32");
  });

  it("captures a single-line const declaration", async () => {
    const r = await definitionPreview(dir, "lib.rs", 14); // `pub const MAX`
    expect(r!.markdown).toContain("pub const MAX: usize = 10;");
  });

  it("returns null for a missing file or out-of-range line", async () => {
    expect(await definitionPreview(dir, "nope.rs", 1)).toBeNull();
    expect(await definitionPreview(dir, "lib.rs", 9999)).toBeNull();
  });
});
