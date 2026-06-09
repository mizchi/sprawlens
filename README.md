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
