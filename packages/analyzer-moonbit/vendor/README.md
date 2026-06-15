# Vendored MoonBit parser (`moonbit-parser.js`)

`moonbit-parser.js` is a minified, self-contained ES module that exports
`extract(source: string): string` — it parses MoonBit source with the real
[`moonbitlang/parser`](https://github.com/moonbitlang/parser) (compiled to JS)
and returns the AST as JSON (with source locations). `astExtract.ts` loads it
to derive precise top-level symbols; the regex extractor in `extract.ts` is the
fallback when the parser is unavailable or throws.

It is committed as a build artifact (like a tree-sitter `.wasm`): rebuilding
needs the MoonBit toolchain and is a manual step, not part of CI.

## Rebuilding

`moonbitlang/parser` is experimental and, as of this writing, does not compile
cleanly on the current `moonc` without a one-line patch.

1. Clone the parser and check it out next to this repo:
   `ghq get moonbitlang/parser` (or `git clone`).
2. Patch `basic/report.mbt`: remove `derive(Show)` from `struct Report` — it
   conflicts with the manual `impl Show for Report` (duplicate impl on newer
   `moonc`).
3. Copy `wrapper/` into the parser repo as a package directory, e.g.
   `cp -r wrapper <parser>/sprawlens_wrap`.
4. Build to JS: `cd <parser> && moon build --target js`.
5. Minify the self-contained output into this directory:
   `npx esbuild <parser>/_build/js/debug/build/sprawlens_wrap/sprawlens_wrap.js \
      --minify --format=esm --outfile=moonbit-parser.js`

The wrapper (`wrapper/top.mbt`) sets `@basic.show_loc` to `Json` so the AST's
locations are serialized (they are `null` by default), then returns
`parse_string(source).0.to_json().stringify()`.
