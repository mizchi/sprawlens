# sprawlens

Visualize the structure of a code repository as a stacked, zoomable map —
modules as concentric dependency rings (or a bundled treemap), subdivided down
to files and symbols with capacity-constrained power diagrams, and linked by
their real import / call graph. Point it at any repo and read how the code is
laid out and how it depends on itself.

Supports **TypeScript / JavaScript, Go, Rust, and MoonBit**, auto-detected.

See [`docs/spec.md`](docs/spec.md) for the current product and interaction
specification.

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
browser. `--port <n>`, `--no-open`, `--lang <id>`.

## Cloudflare Workers preview

The Worker build serves the static map and fetches a public GitHub repository on
demand:

```bash
just worker-dev
# open http://127.0.0.1:8787/?repo=mizchi/sprawlens
# or: just worker-dev 8799
```

The top page has a repository input. Submitting `owner/repo` redirects to the
map with `?source=served&repo=owner/repo`; the Worker answers
`/api/snapshot?repo=owner/repo` by reading GitHub's tree API and downloading
only source/manifest files. Snapshot responses are cached for one hour, then
discarded/re-fetched. Set `GITHUB_TOKEN` for private-rate-limit headroom.

## Hosted deployments

GitHub Pages and Cloudflare Workers both serve the same `@sprawlens/viz` build.
Pushes to `main` update:

- **GitHub Pages** via `.github/workflows/deploy-pages.yml`
- **Cloudflare Workers** via `.github/workflows/deploy-workers.yml`

The Workers workflow requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets. Locally, `just worker-deploy` builds
the latest map and runs the same Worker deploy.

Language detection keys off the root manifest: `go.mod` → Go, `Cargo.toml` →
Rust, `moon.mod.json` → MoonBit, `package.json` / `tsconfig.json` → TypeScript.
A single manifest wins outright (stray source files of another language in a
subdirectory don't override it). When the root genuinely names more than one
language, sprawlens asks which to use (or errors with the choices off a TTY);
`--lang typescript|go|rust|moonbit` forces it.

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
pnpm cli collect /abs/repo --commits 50 --output-dir /tmp/repo-history
pnpm cli analyze <repo>                # diff consecutive snapshots
```

## Architecture

A pnpm workspace split into responsibility layers. Each package only depends
on lower layers; `@sprawlens/contracts` (the `Snapshot` / `AtlasGraph` shapes)
is the spine every other package agrees on, and only the cli — the composition
root — knows the concrete analyzers.

| layer          | package                       | responsibility                                                                                                                                       |
| -------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0 contract    | `@sprawlens/contracts`        | language-neutral data shapes only: `Snapshot`, `AtlasGraph`, versioned `AtlasEvidence`, the detail graph, and provider interfaces. Zero dependencies |
| L1 domain      | `@sprawlens/schema`           | neutral computation over the contracts: metrics, diff, the snapshot→graph adapter, hierarchy / layer / module / overlay / delta derivations          |
| L1 domain      | `@sprawlens/layout`           | geometry + graph layout kernel (rings, treemap, power diagram, force, ...)                                                                           |
| L2 domain      | `@sprawlens/agent`            | deterministic graph queries, intents, and the versioned human/agent `ViewState` wire contract; no renderer                                           |
| L2 capability  | `@sprawlens/analyzer-ts`      | TypeScript/JS provider — TS compiler for structure, LSP for CFG / call hierarchy                                                                     |
| L2 capability  | `@sprawlens/analyzer-go`      | Go provider — tree-sitter                                                                                                                            |
| L2 capability  | `@sprawlens/analyzer-rust`    | Rust provider — tree-sitter                                                                                                                          |
| L2 capability  | `@sprawlens/analyzer-moonbit` | MoonBit provider — heuristic (until a tree-sitter grammar ships)                                                                                     |
| L2 capability  | `@sprawlens/providers`        | the provider registry: the ordered `PROVIDERS` list + `selectProvider`, so the match order lives in one place                                        |
| L3 application | `@sprawlens/server`           | neutral HTTP shell: static viz, snapshot, working-tree diff (SSE), injected detail. Depends on no analyzer                                           |
| L3 application | `@sprawlens/viz`              | the Preact + SVG map                                                                                                                                 |
| L4 composition | `@sprawlens/mcp`              | analyzer + agent tools + canonical `@sprawlens/viz/headless` rendering for MCP clients                                                               |
| L4 composition | `@sprawlens/cli`              | language detection → analyze → serve → open; wires a provider's detail into the neutral server                                                       |
| L4 composition | `@sprawlens/worker`           | Cloudflare Worker entry: static assets + lightweight GitHub snapshot generation for `?repo=owner/repo`                                               |

A language provider implements `match` + `analyze(repo) → Snapshot` and an
optional `detail` (CFG, call hierarchy). Adding a language is one package.

`pnpm lint:layers` enforces this table: each package's `@sprawlens/*`
dependencies must stay within its layer (e.g. the server may not reach a
concrete analyzer). It runs in CI.

## Develop

```bash
pnpm install
pnpm test                 # vitest across all packages
pnpm -r exec tsc --noEmit -p tsconfig.json   # typecheck (per package)
pnpm --filter @sprawlens/viz dev             # the map dev server
pnpm dev:server                              # detail/diff server for the viz dev
pnpm build                                   # build viz + bundle the CLI bin
just benchmark-layout                       # deterministic vanilla-vs-guided layout metrics
just benchmark-layout --format csv          # paired raw trials for R/Python analysis
just benchmark-layout --codesprawl .        # consecutive snapshots in .codesprawl/
```
