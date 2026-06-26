# 1. Use tsgo for type-level re-export resolution only; keep parsing in-process

- Status: Accepted
- Date: 2026-06-26
- Deciders: mizchi
- Related PRs: #41 (parse speedups), #43 (tsgo re-export resolution), #44 (resident tsgo)

## Context

`analyzer-ts` turns a TypeScript working tree into the atlas snapshot: per-file
symbols, import edges, and symbol-level import links (`symbolImports`). Two
qualities matter — analysis speed (it runs live, re-analysing on every change
over SSE) and correctness of the import graph.

Two facts pulled in opposite directions:

1. **Symbol extraction is cheap in-process.** After the #41 work (parse each
   file once, `setParentNodes=false`, merged walks) a full cold analysis of
   sprawlens (256 files) is ~113ms, ~95% of which is `ts.createSourceFile`
   parse+extract. It is already fast.

2. **Re-export resolution is wrong without type info.** The syntactic resolver
   follows only one re-export hop and skips `export *`. Barrel files
   (`index.ts` doing `export * from "./x"`) — and the cross-package imports
   routed through them, e.g. `import { CodeNode } from "@sprawlens/schema"` —
   lost their symbol-level links entirely.

The question was whether to adopt an external compiler tool
(`tsgo` = `@typescript/native-preview`, or `corsa-bind`) for TS analysis, as we
did for MoonBit (`moon ide gen-symbols`, which replaced a slow vendored parser).

## Decision

**1. Keep symbol extraction in-process (`ts.createSourceFile`).** Do not route
parsing through tsgo. Measured: tsgo's per-file fetch+decode is roughly equal to
the JS parser warm (Go parser + binary AST transfer), but it adds a 100–230ms
cold spawn and a per-snapshot `getSourceFile` IPC, with no bulk
symbol/`workspace symbol`/`documentSymbol` API to amortise it. For symbol
extraction tsgo is at best a wash and usually slower. This is the **opposite**
of the MoonBit case, where the in-tree parser was slow and a CLI won.

**2. Resolve re-exports with the tsgo type checker, with a syntactic fallback.**
Only the barrel re-export resolution uses tsgo's `Checker`: when the repo builds
into tsconfig projects, each barrel's exports are resolved to their original
declaration (`file:line`), expanding `export *`, chasing transitive chains, and
tracking `as` renames. When the repo isn't built or tsgo can't start, the
analyzer falls back to the syntactic resolver. tsgo has no `getAliasedSymbol`,
so this is a hybrid: `export *` is expanded by walking the AST and recursing,
named re-exports are followed via the `ExportSpecifier`'s module specifier.

**3. Keep tsgo resident per repo.** A `Map<repoRoot, residentApi>` holds one
tsgo process across analyses. The first analysis spawns and `openProject`s each
package tsconfig; warm re-analysis pushes only the changed files via
`updateSnapshot({ fileChanges })` (derived from the `ParseCache` mtime diff) with
no respawn. cold 420ms → warm 21ms (~18×). Idle-closed (5 min) and reaped on
process exit; the child also dies with the parent.

## Alternatives considered

- **`corsa-bind`** (`@corsa-bind/napi`): an FFI binding to the Corsa checker over
  stdio. It exposes type-checking, **not** symbol/workspace-symbol extraction —
  unusable for this. Rejected.
- **Replace all parsing with tsgo**: no bulk symbol API (only per-file
  `getSourceFile` + walk, same shape as in-process), plus the cold spawn.
  Measured slower overall. Rejected.
- **tsgo LSP server** (`tsgo lsp -stdio` + `workspace/symbol`): still no bulk
  resolution, and adds a JSON-RPC client and a second process to manage. The
  unstable `API` instance already covers spawn amortisation, incremental
  `fileChanges`, and an in-memory `fs` overlay. Rejected.
- **Syntactic recursive re-export resolution** (walk every file's exports and
  resolve transitively, no tsgo): handles common barrels and chains with zero
  spawn cost, but misses type-level edge cases (re-exports through conditional
  types, namespace re-exports, etc.). Viable and cheaper; not chosen because the
  decision was to use real type information for correctness.

## Consequences

Positive:

- 36 cross-package imports through a barrel now resolve their `symbolImports` to
  the origin file (e.g. `@sprawlens/schema` `snapshotToAtlasGraph → adapter.ts`),
  where before they were empty.
- The resident process makes the live cost negligible after the first analysis,
  and `fileChanges` keeps incremental updates ~1ms.
- Symbol extraction stays simple and fast; only the (smaller) re-export concern
  takes on the tsgo dependency.

Negative / risks:

- **Unstable API dependency.** `@typescript/native-preview` is 7.0.0-dev; the
  used surface (`updateSnapshot`, `getProjects`, `Checker`, `Symbol`) has no
  stable types and several decode traps (`.modifiers`/`.getStart()` crash; use
  `getExports()`, `node.name.pos`; `/Users`→`/users` lowercasing). Pinned by
  inline shapes and kind/flag constants that may drift across tsgo versions.
- **Build prerequisite.** tsgo resolution needs the IDE build artifacts
  (`_build`/tsconfig projects); unbuilt repos silently take the syntactic
  fallback, so re-export precision is build-dependent.
- **Resident process lifecycle** to manage (idle close, exit reaping). Mitigated
  by `unref`'d timer + the child dying with the parent (no zombies, verified).

The fallback design means a missing/unusable tsgo never breaks analysis — it
just degrades re-export precision to the syntactic level.
