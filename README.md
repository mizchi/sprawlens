# sprawlens

Visualize the structure of a code repository as a stacked, zoomable map —
modules as concentric dependency rings (or a bundled treemap), subdivided down
to files and symbols with capacity-constrained power diagrams, and linked by
their real import / call graph. Point it at any repo and read how the code is
laid out and how it depends on itself.

Supports **TypeScript / JavaScript, Go, Rust, and MoonBit**, auto-detected.

## Run it on any repo

```bash
# from a checkout of this repo (built bin):
pnpm install && pnpm build
node packages/cli/dist/index.js <path-to-repo>     # analyze + open the browser

# or during development, without building:
pnpm cli serve <path-to-repo>
```

`sprawlens [repo]` (default `.`) snapshots the working tree, starts a local
server that serves the map + the snapshot + the detail endpoints, and opens the
browser. `--port <n>`, `--no-open`.

Language detection: `go.mod` → Go, `Cargo.toml` → Rust, `moon.mod.json` →
MoonBit, otherwise the TypeScript provider (any `package.json` / `tsconfig.json`
/ `*.ts`).

### What the map shows

- **Modules → directories → files → classes → symbols**, area ∝ code size,
  position from graph proximity. Toggle boundary levels in the left drawer.
- **Internal dependency edges** (resolved file→file / symbol→symbol) and
  **external packages** on the deps plane.
- **Stacked planes**: source, tests, and external deps, linked by the edges
  that cross between them — hover a node to light its rope, hold alt for all.
- **Live working-tree diff** (added / modified files, highlighted) and, for
  TypeScript, **per-symbol CFG and call hierarchy** on demand.

## Git-history commands (TypeScript)

```bash
pnpm cli collect <repo> --commits 50   # snapshot N commits into .codesprawl/
pnpm cli analyze <repo>                # diff consecutive snapshots
```

## Architecture

A pnpm workspace split by responsibility. The neutral `Snapshot` is the
contract between language analysis and the view.

| package | responsibility |
|---|---|
| `@sprawlens/schema` | language-neutral contracts (`Snapshot`, `AtlasGraph`, hierarchy, `LanguageProvider`) + neutral computation + the snapshot→graph adapter |
| `@sprawlens/layout` | geometry + graph layout kernel (rings, treemap, power diagram, force, ...) |
| `@sprawlens/analyzer-ts` | TypeScript/JS provider — TS compiler for structure, LSP for CFG / call hierarchy |
| `@sprawlens/analyzer-go` | Go provider — tree-sitter |
| `@sprawlens/analyzer-rust` | Rust provider — tree-sitter |
| `@sprawlens/analyzer-moonbit` | MoonBit provider — heuristic (until a tree-sitter grammar ships) |
| `@sprawlens/server` | neutral HTTP shell: static viz, snapshot, working-tree diff (SSE), injected detail |
| `@sprawlens/viz` | the Preact + SVG map |
| `@sprawlens/cli` | language detection → analyze → serve → open |

A language provider implements `match` + `analyze(repo) → Snapshot` and an
optional `detail` (CFG, call hierarchy). Adding a language is one package.

## Develop

```bash
pnpm install
pnpm test                 # vitest across all packages
pnpm -r exec tsc --noEmit -p tsconfig.json   # typecheck (per package)
pnpm --filter @sprawlens/viz dev             # the map dev server
pnpm dev:server                              # detail/diff server for the viz dev
pnpm build                                   # build viz + bundle the CLI bin
```
