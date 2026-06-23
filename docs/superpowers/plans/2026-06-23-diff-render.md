# `sprawlens render --diff` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--diff [base]` option to `sprawlens render` that tints PR-changed files (added/modified) on the headless SVG map and embeds a legend with counts.

**Architecture:** Single-pass — analyze the head working tree once, then call the existing `workingDiff(root, base)` (`@sprawlens/server`) to learn which files changed vs a base ref (or vs the working tree when no base is given). The change map flows into `renderAtlasSvg` via a new `changed` option, which populates the already-present `changedOf` scene hook; the existing `leafFillOf` colors added/modified leaf cells for free. A legend `<g>` with counts is injected at SVG finalize time. Removed files are not on the map, so they appear in the legend as a count only.

**Tech Stack:** TypeScript, pnpm workspace, Preact + preact-render-to-string (headless SVG), commander (CLI), vitest, git plumbing via `@sprawlens/server`.

---

## File Structure

- **Modify** `packages/viz/src/mapShared.tsx` — export the `ADDED_FILL` / `MODIFIED_FILL` theme tokens so the legend can reuse them (currently module-private `let`).
- **Modify** `packages/viz/src/headless/renderAtlasSvg.ts` — extend `AtlasSvgOptions` with `changed` + `diffSummary`, wire `changedOf`, build & inject the legend, extend `finalize`.
- **Modify** `packages/viz/src/headless/renderAtlasSvg.test.ts` — add a diff-fill + legend test.
- **Create** `packages/cli/src/diffRender.ts` — `toDiffOverlay(diff: WorkingDiff)` → `{ changed, diffSummary }` (pure, testable wiring helper).
- **Create** `packages/cli/src/diffRender.test.ts` — temp git repo → `workingDiff` → `toDiffOverlay` → `renderAtlasSvg`, assert fills + legend counts.
- **Modify** `packages/cli/src/index.ts` — add `--diff [base]` option to the `render` command and wire it through.
- **Modify** `packages/cli/README.md` — GitHub Actions usage snippet.

---

### Task 1: Export the diff color tokens from `mapShared`

**Files:**

- Modify: `packages/viz/src/mapShared.tsx:33-34`

The legend swatches reuse the same `ADDED_FILL` / `MODIFIED_FILL` tokens the map uses, so dark mode (handled by `setMapTheme`) applies automatically. They are currently private `let` bindings. The reassignments inside `setMapTheme` (lines ~134-135 and ~196-197) keep working unchanged because they assign to the same module binding — only the declaration gains `export`.

- [ ] **Step 1: Add `export` to both tokens**

Change:

```tsx
let MODIFIED_FILL = "hsl(8 85% 78%)";
let ADDED_FILL = "hsl(150 55% 80%)";
```

to:

```tsx
export let MODIFIED_FILL = "hsl(8 85% 78%)";
export let ADDED_FILL = "hsl(150 55% 80%)";
```

- [ ] **Step 2: Verify nothing else breaks**

Run: `pnpm --filter @sprawlens/viz exec tsc --noEmit -p tsconfig.json`
Expected: PASS (no type errors). Exporting a `let` is valid ESM.

- [ ] **Step 3: Commit**

```bash
git add packages/viz/src/mapShared.tsx
git commit -m "feat(viz): export ADDED_FILL/MODIFIED_FILL tokens for the diff legend"
```

---

### Task 2: Extend `renderAtlasSvg` options and wire `changedOf` (TDD)

**Files:**

- Modify: `packages/viz/src/headless/renderAtlasSvg.ts` (type at lines 31-48; `changedOf` at line 196; imports at line 18)
- Test: `packages/viz/src/headless/renderAtlasSvg.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `renderAtlasSvg.test.ts` (inside the existing `describe("renderAtlasSvg", ...)`):

```ts
it("tints added/modified files when a changed map is supplied", () => {
  const changed = new Map<string, "added" | "modified">([
    ["src/a/foo.ts", "modified"],
    ["src/b/qux.ts", "added"],
  ]);
  const svg = renderAtlasSvg(GRAPH, { layout: "treemap", level: "file", seed: 1, changed });
  // ADDED_FILL = hsl(150 55% 80%), MODIFIED_FILL = hsl(8 85% 78%) in the light theme
  expect(svg).toContain("hsl(150 55% 80%)");
  expect(svg).toContain("hsl(8 85% 78%)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sprawlens/viz exec vitest run src/headless/renderAtlasSvg.test.ts -t "tints added/modified"`
Expected: FAIL — `changed` is not an accepted option (type error) or the fills are absent.

- [ ] **Step 3: Extend the options type**

In `renderAtlasSvg.ts`, add these fields to `AtlasSvgOptions` (before the closing `}` at line 48):

```ts
  /** Map of node id → change kind; tints added/modified leaf cells. */
  changed?: Map<string, "added" | "modified">;
  /** Counts for the diff legend; when present and non-zero, a legend is drawn. */
  diffSummary?: { added: number; modified: number; removed: number };
```

- [ ] **Step 4: Wire `changedOf` to the map**

In the `buildScene({ ... })` call, replace:

```ts
    changedOf: () => undefined,
```

with:

```ts
    changedOf: (id) => options.changed?.get(id),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sprawlens/viz exec vitest run src/headless/renderAtlasSvg.test.ts -t "tints added/modified"`
Expected: PASS

- [ ] **Step 6: Run the full viz headless test to check for regressions**

Run: `pnpm --filter @sprawlens/viz exec vitest run src/headless/renderAtlasSvg.test.ts`
Expected: PASS (all cases, including determinism and empty-graph).

- [ ] **Step 7: Commit**

```bash
git add packages/viz/src/headless/renderAtlasSvg.ts packages/viz/src/headless/renderAtlasSvg.test.ts
git commit -m "feat(viz): renderAtlasSvg accepts a changed map and tints diff cells"
```

---

### Task 3: Render the diff legend in `renderAtlasSvg` (TDD)

**Files:**

- Modify: `packages/viz/src/headless/renderAtlasSvg.ts` (import line 18; the `return finalize(...)` at line 222; the `finalize` function at lines 230-240; add a `buildDiffLegend` helper)
- Test: `packages/viz/src/headless/renderAtlasSvg.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `renderAtlasSvg.test.ts`:

```ts
it("embeds a diff legend with per-kind counts", () => {
  const svg = renderAtlasSvg(GRAPH, {
    layout: "treemap",
    seed: 1,
    diffSummary: { added: 2, modified: 7, removed: 3 },
  });
  expect(svg).toContain("added 2");
  expect(svg).toContain("modified 7");
  expect(svg).toContain("removed 3");
});

it("omits zero-count rows from the legend and draws none when all zero", () => {
  const someZero = renderAtlasSvg(GRAPH, {
    layout: "treemap",
    seed: 1,
    diffSummary: { added: 1, modified: 0, removed: 0 },
  });
  expect(someZero).toContain("added 1");
  expect(someZero).not.toContain("modified 0");
  expect(someZero).not.toContain("removed 0");

  const allZero = renderAtlasSvg(GRAPH, {
    layout: "treemap",
    seed: 1,
    diffSummary: { added: 0, modified: 0, removed: 0 },
  });
  expect(allZero).not.toContain("added 0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sprawlens/viz exec vitest run src/headless/renderAtlasSvg.test.ts -t "legend"`
Expected: FAIL — no legend text in the SVG.

- [ ] **Step 3: Import the legend tokens**

In `renderAtlasSvg.ts`, replace the import at line 18:

```ts
import { MAP_BG, setMapTheme } from "../mapShared.tsx";
```

with:

```ts
import {
  ADDED_FILL,
  INK,
  MAP_BG,
  MODIFIED_FILL,
  PANEL_BG,
  PANEL_BORDER,
  setMapTheme,
} from "../mapShared.tsx";
```

- [ ] **Step 4: Add the `buildDiffLegend` helper**

Add this function near `finalize` in `renderAtlasSvg.ts`. It reads the theme tokens at call time (after `setMapTheme` has run), so dark mode is honored via the ESM live bindings:

```ts
function buildDiffLegend(
  summary: { added: number; modified: number; removed: number },
  height: number,
): string {
  const rows: Array<{ label: string; count: number; fill: string; open: boolean }> = [];
  if (summary.added > 0)
    rows.push({ label: "added", count: summary.added, fill: ADDED_FILL, open: false });
  if (summary.modified > 0)
    rows.push({ label: "modified", count: summary.modified, fill: MODIFIED_FILL, open: false });
  if (summary.removed > 0)
    rows.push({ label: "removed", count: summary.removed, fill: "none", open: true });
  if (rows.length === 0) return "";

  const rowH = 20;
  const padX = 10;
  const padY = 8;
  const boxW = 132;
  const boxH = padY * 2 + rows.length * rowH;
  const x = 16;
  const y = height - boxH - 16;

  const items = rows
    .map((r, i) => {
      const top = padY + i * rowH;
      const swatch = r.open
        ? `<rect x="${padX}" y="${top + 2}" width="12" height="12" rx="2" fill="none" stroke="${INK}" stroke-width="1.5"/>`
        : `<rect x="${padX}" y="${top + 2}" width="12" height="12" rx="2" fill="${r.fill}" stroke="${INK}" stroke-opacity="0.25"/>`;
      const text = `<text x="${padX + 18}" y="${top + 12}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${INK}">${r.label} ${r.count}</text>`;
      return swatch + text;
    })
    .join("");

  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect x="0" y="0" width="${boxW}" height="${boxH}" rx="6" fill="${PANEL_BG}" stroke="${PANEL_BORDER}"/>` +
    items +
    `</g>`
  );
}
```

- [ ] **Step 5: Build the legend and pass it to `finalize`**

In `renderAtlasSvg`, replace the final return (line 222):

```ts
return finalize(body, width, height);
```

with:

```ts
const legend = options.diffSummary ? buildDiffLegend(options.diffSummary, height) : "";
return finalize(body, width, height, legend);
```

- [ ] **Step 6: Extend `finalize` to inject the legend before `</svg>`**

Replace the `finalize` function body:

```ts
function finalize(body: string, width: number, height: number): string {
  const open = body.indexOf(">");
  if (!body.startsWith("<svg") || open === -1) return body;
  const head = body.slice(0, open);
  const rest = body.slice(open + 1);
  const ns = head.includes("xmlns=")
    ? head
    : `${head} xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
  const bg = `<rect x="0" y="0" width="${width}" height="${height}" fill="${MAP_BG}"/>`;
  return `${ns}>${bg}${rest}`;
}
```

with:

```ts
function finalize(body: string, width: number, height: number, legend = ""): string {
  const open = body.indexOf(">");
  if (!body.startsWith("<svg") || open === -1) return body;
  const head = body.slice(0, open);
  const rest = body.slice(open + 1);
  const ns = head.includes("xmlns=")
    ? head
    : `${head} xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
  const bg = `<rect x="0" y="0" width="${width}" height="${height}" fill="${MAP_BG}"/>`;
  const withLegend = legend ? rest.replace(/<\/svg>\s*$/, `${legend}</svg>`) : rest;
  return `${ns}>${bg}${withLegend}`;
}
```

- [ ] **Step 7: Run the legend tests**

Run: `pnpm --filter @sprawlens/viz exec vitest run src/headless/renderAtlasSvg.test.ts`
Expected: PASS (all cases).

- [ ] **Step 8: Commit**

```bash
git add packages/viz/src/headless/renderAtlasSvg.ts packages/viz/src/headless/renderAtlasSvg.test.ts
git commit -m "feat(viz): embed a diff legend with per-kind counts in renderAtlasSvg"
```

---

### Task 4: CLI `toDiffOverlay` helper (TDD)

**Files:**

- Create: `packages/cli/src/diffRender.ts`
- Test: `packages/cli/src/diffRender.test.ts`

This is the wiring from a `WorkingDiff` (git plumbing result) to the `renderAtlasSvg` inputs. Keeping it as a pure function makes the CLI action thin and the conversion testable.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/diffRender.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { WorkingDiff } from "@sprawlens/server";
import { toDiffOverlay } from "./diffRender.ts";

describe("toDiffOverlay", () => {
  it("splits changed entries into added/modified and counts removed", () => {
    const diff: WorkingDiff = {
      changed: { "src/a.ts": "modified", "src/b.ts": "added", "src/c.ts": "added" },
      removed: ["src/old.ts", "src/gone.ts"],
    };
    const { changed, diffSummary } = toDiffOverlay(diff);
    expect(changed.get("src/a.ts")).toBe("modified");
    expect(changed.get("src/b.ts")).toBe("added");
    expect(diffSummary).toEqual({ added: 2, modified: 1, removed: 2 });
  });

  it("handles an empty diff", () => {
    const { changed, diffSummary } = toDiffOverlay({ changed: {}, removed: [] });
    expect(changed.size).toBe(0);
    expect(diffSummary).toEqual({ added: 0, modified: 0, removed: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sprawlens/cli exec vitest run src/diffRender.test.ts`
Expected: FAIL — `./diffRender.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/cli/src/diffRender.ts`:

```ts
import type { WorkingDiff } from "@sprawlens/server";

export type DiffOverlay = {
  changed: Map<string, "added" | "modified">;
  diffSummary: { added: number; modified: number; removed: number };
};

/** Convert a git WorkingDiff into the inputs renderAtlasSvg expects. */
export function toDiffOverlay(diff: WorkingDiff): DiffOverlay {
  const changed = new Map<string, "added" | "modified">(Object.entries(diff.changed));
  let added = 0;
  let modified = 0;
  for (const kind of changed.values()) {
    if (kind === "added") added += 1;
    else modified += 1;
  }
  return {
    changed,
    diffSummary: { added, modified, removed: diff.removed.length },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sprawlens/cli exec vitest run src/diffRender.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/diffRender.ts packages/cli/src/diffRender.test.ts
git commit -m "feat(cli): add toDiffOverlay to map a WorkingDiff onto renderAtlasSvg inputs"
```

---

### Task 5: End-to-end diff render against a temp git repo (TDD)

**Files:**

- Test: `packages/cli/src/diffRender.test.ts` (extend)

Proves the real path: `workingDiff` (git) → `toDiffOverlay` → `renderAtlasSvg` produces an SVG whose changed files are tinted and whose legend counts match. Uses the temp-git-repo pattern from `packages/analyzer-ts/src/collect.test.ts`.

- [ ] **Step 1: Write the failing test**

Add to the top of `packages/cli/src/diffRender.test.ts` (imports) and a new `describe`:

```ts
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { workingDiff } from "@sprawlens/server";
import { tsProvider } from "@sprawlens/analyzer-ts";
import { snapshotToAtlasGraph } from "@sprawlens/schema";
import { renderAtlasSvg } from "@sprawlens/viz/headless";

const exec = promisify(execFile);
const git = (cwd: string, args: string[]) => exec("git", args, { cwd });

describe("diff render end-to-end", () => {
  it("tints changed files and reports counts vs a base commit", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sprawlens-diff-"));
    try {
      await git(root, ["init"]);
      await git(root, ["config", "user.email", "test@example.com"]);
      await git(root, ["config", "user.name", "Test User"]);
      await mkdir(path.join(root, "src"), { recursive: true });
      await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n");
      await writeFile(path.join(root, "src", "old.ts"), "export const old = 0;\n");
      await git(root, ["add", "."]);
      await git(root, ["commit", "-m", "base"]);
      const base = (await git(root, ["rev-parse", "HEAD"])).stdout.trim();

      // modify a.ts, add b.ts, remove old.ts
      await writeFile(path.join(root, "src", "a.ts"), "export const a = 2;\n");
      await writeFile(path.join(root, "src", "b.ts"), "export const b = 3;\n");
      await rm(path.join(root, "src", "old.ts"));
      await git(root, ["add", "-A"]);
      await git(root, ["commit", "-m", "change"]);

      const diff = await workingDiff(root, base);
      const { changed, diffSummary } = toDiffOverlay(diff);
      expect(diffSummary).toEqual({ added: 1, modified: 1, removed: 1 });

      const snapshot = await tsProvider.analyze(root);
      const graph = snapshotToAtlasGraph(snapshot as Parameters<typeof snapshotToAtlasGraph>[0]);
      const svg = renderAtlasSvg(graph, { layout: "treemap", seed: 1, changed, diffSummary });

      expect(svg).toContain("hsl(150 55% 80%)"); // ADDED_FILL — b.ts
      expect(svg).toContain("hsl(8 85% 78%)"); // MODIFIED_FILL — a.ts
      expect(svg).toContain("removed 1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

`tsProvider` is the TypeScript `LanguageProvider` exported from `@sprawlens/analyzer-ts` (`provider.ts`); `tsProvider.analyze(root)` returns the same `Snapshot` the `render` command builds via `chooseProvider`. `snapshotToAtlasGraph` is re-exported from `@sprawlens/schema` (`adapter.ts`). `renderAtlasSvg` is the `@sprawlens/viz/headless` entry.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sprawlens/cli exec vitest run src/diffRender.test.ts -t "end-to-end"`
Expected: FAIL — before Tasks 2-4 are merged the SVG would lack the diff fills/legend. (When executed after Tasks 2-4, this should pass directly; this task adds only the test.)

- [ ] **Step 3: Make it pass**

No production code change is expected here — Tasks 2-4 already provide the behavior. Re-run until green.

Run: `pnpm --filter @sprawlens/cli exec vitest run src/diffRender.test.ts`
Expected: PASS (both `toDiffOverlay` unit cases and the end-to-end case).

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/diffRender.test.ts
git commit -m "test(cli): end-to-end diff render against a temp git repo"
```

---

### Task 6: Wire `--diff [base]` into the `render` command

**Files:**

- Modify: `packages/cli/src/index.ts` (the `render` command, lines ~360-440)

- [ ] **Step 1: Add the import**

Ensure `toDiffOverlay` is imported near the other local imports in `index.ts`:

```ts
import { toDiffOverlay } from "./diffRender.ts";
```

`workingDiff` is already imported at line 54 (`import { createAtlasServer, watchDir, workingDiff } from "@sprawlens/server";`).

- [ ] **Step 2: Add the option to the `render` command**

After the `.option("--dark", ...)` line, add:

```ts
  .option(
    "--diff [base]",
    "highlight files changed vs <base> ref, or uncommitted changes if no base",
  )
```

- [ ] **Step 3: Add `diff` to the action's options type**

In the `.action(async (repo, options: { ... })` type literal, add:

```ts
        diff?: string | boolean;
```

- [ ] **Step 4: Compute the diff overlay before calling `renderAtlasSvg`**

Immediately after the `if (graph.nodes.length === 0) { ... }` guard and before `const svg = renderAtlasSvg(...)`, insert:

```ts
let overlay: ReturnType<typeof toDiffOverlay> | undefined;
if (options.diff !== undefined) {
  // commander yields `true` for a bare --diff (no base), a string for --diff <base>
  const base = typeof options.diff === "string" ? options.diff : undefined;
  overlay = toDiffOverlay(await workingDiff(root, base));
}
```

- [ ] **Step 5: Pass the overlay into `renderAtlasSvg`**

Change the `renderAtlasSvg(graph, { ... })` call to spread the overlay:

```ts
const svg = renderAtlasSvg(graph, {
  layout: options.layout,
  level: options.level,
  seed: options.seed,
  showEdges: options.edges ?? false,
  dark: options.dark ?? false,
  ...(options.width ? { width: options.width } : {}),
  ...(options.height ? { height: options.height } : {}),
  ...(overlay ? { changed: overlay.changed, diffSummary: overlay.diffSummary } : {}),
});
```

- [ ] **Step 6: Surface the counts in the success log**

Replace the final `console.log(...)` in the render action with a variant that appends diff counts when present:

```ts
const diffNote = overlay
  ? `, diff +${overlay.diffSummary.added} ~${overlay.diffSummary.modified} -${overlay.diffSummary.removed}`
  : "";
console.log(
  `wrote ${out} (${options.layout}, ${options.level}, ${graph.nodes.length} files, seed ${options.seed}${diffNote})`,
);
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @sprawlens/cli exec tsc --noEmit -p tsconfig.json`
Expected: PASS

- [ ] **Step 8: Smoke test the CLI against this very repo**

Run: `pnpm --filter @sprawlens/cli exec tsx src/index.ts render . --diff -o /tmp/sprawlens-self-diff.svg`
Expected: prints `wrote /tmp/sprawlens-self-diff.svg (treemap, file, N files, seed 1, diff +A ~M -R)`. (With a clean tree all counts may be 0 and no legend is drawn — make a throwaway edit first to see a non-empty legend, then revert it.)

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add render --diff to highlight PR-changed files on the map"
```

---

### Task 7: Document GitHub Actions usage

**Files:**

- Modify: `packages/cli/README.md`

- [ ] **Step 1: Add a "PR diff visualization" section**

Append to `packages/cli/README.md`:

````markdown
## PR diff visualization (GitHub Actions)

`render --diff` tints files changed vs a base ref and embeds a legend, so you can
attach a structure-map of a PR's blast radius as an artifact:

```yaml
- run: git fetch origin ${{ github.base_ref }} --depth=1
- run: npx sprawlens render . --diff origin/${{ github.base_ref }} -o sprawlens-diff.svg
- uses: actions/upload-artifact@v4
  with:
    name: sprawlens-diff
    path: sprawlens-diff.svg
```

- `--diff <base>` colors added files green and modified files orange against the base ref.
- `--diff` with no base highlights uncommitted working-tree changes instead.
- Removed files cannot appear on the map; they are reported as a count in the legend.
````

- [ ] **Step 2: Commit**

```bash
git add packages/cli/README.md
git commit -m "docs(cli): document render --diff for PR diff visualization"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test`
Expected: all tests pass (existing 571 + the new diff cases).

- [ ] **Step 2: Typecheck the workspace**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Lint exports (knip) if it is part of the normal gate**

Run: `pnpm lint:exports`
Expected: no new unused-export errors for `toDiffOverlay` / `DiffOverlay` / the new tokens (they are consumed by the CLI and the legend). If knip flags `DiffOverlay` as unused, either consume it in the CLI action's `overlay` type or drop the standalone type alias.

---

## Notes for the implementer

- **Do not bump versions or publish in this plan.** Release is a separate, explicit step the user drives (npm requires an interactive OTP).
- The diff colors come for free from the existing `leafFillOf` priority chain (`packages/viz/src/mapShared.tsx:350-359`): `added` → `ADDED_FILL`, `modified` → `MODIFIED_FILL`. No renderer cell-styling changes are needed beyond wiring `changedOf`.
- `AtlasNode.id` at file level equals the repo-relative path, which is exactly the key `workingDiff` returns — so the change map keys line up with node ids without translation. If a future provider keys nodes differently, the overlay would silently miss; out of scope here.
- The CLI build is esbuild-bundled (`packages/cli/esbuild.config.mjs` already bundles viz); no esbuild config change is needed because `diffRender.ts` and the extended `renderAtlasSvg` are ordinary TS in already-bundled packages.
