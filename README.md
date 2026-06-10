# CodeSprawl Lens

CodeSprawl Lens collects file-level TypeScript/JavaScript import graph snapshots from Git history, computes structural growth metrics and diffs, and serves a small web UI for timeline, treemap, dependency diff, and hotspot review.

## Commands

```bash
pnpm install
pnpm build

node dist/cli/index.js collect ./some-ts-repo --commits 50
node dist/cli/index.js analyze ./some-ts-repo
node dist/cli/index.js serve ./some-ts-repo
```

During package usage, the binary name is `codesprawl`:

```bash
codesprawl collect ./some-ts-repo --commits 50
codesprawl analyze ./some-ts-repo
codesprawl serve ./some-ts-repo
```

## Output

```txt
.codesprawl/
  config.json
  commits.json
  snapshots/<commit>.json
  diffs/<from>..<to>.json
  metrics.csv
```

## MVP Scope

- TypeScript/JavaScript source files only
- File-level graph only
- Static import/export, dynamic `import()`, and literal `require()` specifier extraction
- Relative import resolution with extension and `index.*` fallbacks
- Git worktree based snapshot collection without checking out the main working tree
- Heuristic AI-assisted commit markers, never definitive classification

## Atlas (experimental)

A separate Preact + SVG view (`src/atlas/`) that lays modules out on
concentric dependency rings and subdivides them with capacity-constrained
power diagrams (module → file → symbol). Independent of the legacy UI.

```bash
pnpm dev:atlas               # playground at /atlas.html
ATLAS_HMR=0 pnpm dev:atlas   # heavy maps (e.g. the playwright fixture):
                             # drops prefresh, whose vnode hooks cause
                             # GC pauses during zoom on 4k+ symbol maps
pnpm dev:atlas-server        # LSP call-hierarchy provider (sprawlens/playwright)
```

Production behaves like the no-HMR dev server:

```bash
pnpm build:atlas && pnpm exec vite preview -c vite.atlas.config.ts --port 5174
```

Per-step zoom/pan resource measurement (lightbringer):

```bash
pnpm exec playwright test -c playwright.atlas.config.ts
ATLAS_BASE_URL=http://127.0.0.1:5174 PERF_TRACE=1 \
  pnpm exec playwright test -c playwright.atlas.config.ts   # prod preview
```
