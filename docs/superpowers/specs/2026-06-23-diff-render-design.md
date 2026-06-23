# `sprawlens render --diff` — PR diff visualization

Date: 2026-06-23

## Goal

Extend the existing `sprawlens render` CLI command with a `--diff` option that
highlights the files changed in a pull request directly on the headless SVG
structure map. Intended primary use: a GitHub Actions step that fetches the base
ref, renders an SVG, and attaches it as an artifact / PR comment so reviewers can
see _where_ in the codebase a PR lands.

Added and modified files are tinted on the map; a small legend with counts is
embedded in the SVG. Removed files cannot appear on the map (the map is built
from the current working tree, which no longer contains them), so they are
reported as a count in the legend only.

## Non-goals

- Two-state full analysis (analyzing the base ref separately with
  `diffSnapshots`). Rejected in favor of a single-pass `git diff` because CI only
  needs to `fetch` the base, not check it out, and the single pass is faster. The
  cost is that removed files are not drawn on the map.
- Dimming unchanged files / focus mode. We keep the full-color map and only
  overlay the added/modified tint, so the overall structure stays visible.
- Symbol-level diff. Diff operates at file (and module) granularity, matching the
  headless renderer's existing levels.

## CLI interface

```
sprawlens render [repo] --diff [base] [existing options...]
```

- `--diff` with **no value** → uncommitted working-tree changes
  (`git status --porcelain`, via `workingDiff(root)`).
- `--diff <base>` (e.g. `--diff origin/main`) → diff against a base ref
  (`git diff --name-status <base>`, via `workingDiff(root, base)`).
- Composes with all existing `render` options: `--lang`, `--layout`, `--level`,
  `--seed`, `--edges`, `--dark`, `--width`, `--height`, `-o/--output`.

Commander option: `.option("--diff [base]", "highlight files changed vs <base>, or uncommitted changes if omitted")`.
When the flag is absent, behavior is unchanged. When present with no value,
commander yields `true`; we treat that as "no base" and pass `undefined` to
`workingDiff`.

## Data flow

1. Unchanged: analyze the head working tree once →
   `provider.analyze(root)` → `applyLayers` → `snapshotToAtlasGraph` → `AtlasGraph`.
2. **New**: when `--diff` is set, call `workingDiff(root, base)` from
   `@sprawlens/server` (already a dependency of `@sprawlens/cli`, already imported
   in `index.ts` for the `tui` command). Returns
   `{ changed: Record<path, "added" | "modified">, removed: string[], loc?: ... }`.
3. Build `const changed = new Map(Object.entries(diff.changed))` —
   `Map<string, "added" | "modified">`. Keys are repo-relative paths, which match
   `AtlasNode.id` at file level (both produced from repo-relative paths).
4. Build `const diffSummary = { added, modified, removed }` by counting `changed`
   values and `removed.length`.
5. Pass `changed` and `diffSummary` into `renderAtlasSvg`.

## `renderAtlasSvg` changes (`packages/viz/src/headless/renderAtlasSvg.ts`)

Extend `AtlasSvgOptions`:

```ts
changed?: Map<string, "added" | "modified">;
diffSummary?: { added: number; modified: number; removed: number };
```

- Replace `changedOf: () => undefined` (currently line 196) with
  `changedOf: (id) => options.changed?.get(id)`.
  Because the scene already routes `changedOf` to `leafFillOf`, which prioritizes
  `ADDED_FILL` / `MODIFIED_FILL`, no styling work is needed for the cells — full
  color + diff tint falls out for free.
- Pass `diffSummary` into `finalize` so the legend can be drawn.

### Legend rendering

In `finalize` (currently injects the background rect), when `diffSummary` is
present, append a legend `<g>` just before the closing `</svg>`:

- Position: bottom-left, with a small padded translucent backing rect for
  legibility on both light and dark maps.
- Rows (omit any row whose count is 0; if all three are 0, draw no legend):
  - `● added N` — swatch filled with `ADDED_FILL`
  - `● modified N` — swatch filled with `MODIFIED_FILL`
  - `○ removed N` — open swatch (stroke only), since removed files are not on the
    map
- Colors reuse the `ADDED_FILL` / `MODIFIED_FILL` ESM theme tokens already used by
  the map, so dark mode is handled by the existing `setMapTheme(dark)` call.
- Text color uses the existing map foreground token; reuse whatever token the
  renderer already uses for labels.

The legend is plain SVG string construction (swatch `<rect>`s + `<text>`s),
consistent with how `finalize` already builds the background rect as a string.

## Package dependencies

No new dependencies. `@sprawlens/cli` already declares `@sprawlens/server`
(`workspace:*`) and imports `workingDiff`. `renderAtlasSvg` lives in
`@sprawlens/viz`, already used by the `render` command.

## Testing

Add a test that exercises the full `render --diff` path against a throwaway git
repo (reuse the temp-git-repo pattern from `packages/analyzer-ts/src/collect.test.ts`):

1. Create a temp dir, `git init`, commit an initial TypeScript file set, capture
   the base commit.
2. Modify one file, add a new file, delete one file. Commit (or leave in working
   tree to also cover the no-base path).
3. Run the diff-render path (call the CLI action function or `workingDiff` +
   `renderAtlasSvg` directly) and assert on the returned SVG string:
   - the added file's id is colored with `ADDED_FILL`
   - the modified file's id is colored with `MODIFIED_FILL`
   - the legend contains the correct `added` / `modified` / `removed` counts
4. A unit test on the headless renderer: given a graph and a `changed` map,
   `renderAtlasSvg` emits the diff fills and a legend with the supplied counts.

Prefer asserting on substrings of the SVG (fill color tokens, legend count text)
rather than full snapshot equality, to stay robust against layout jitter.

## GitHub Actions usage (documentation)

Add a short README example under `packages/cli/README.md`:

```yaml
- run: git fetch origin ${{ github.base_ref }} --depth=1
- run: npx sprawlens render --diff origin/${{ github.base_ref }} -o sprawlens-diff.svg
- uses: actions/upload-artifact@v4
  with: { name: sprawlens-diff, path: sprawlens-diff.svg }
```

## Open questions / decisions resolved

- Input model: single-pass + `git diff` (decided).
- Unchanged files: full color + diff tint, no dimming (decided).
- Legend: yes, with added/modified/removed counts (decided).
- Removed files: count-only in legend, not drawn (consequence of single-pass).
