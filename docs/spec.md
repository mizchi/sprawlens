# sprawlens specification

This is the current product and interaction spec. Historical design notes in
`docs/design/` explain why features were introduced; this file states the
behavior the app should preserve now.

## Product model

sprawlens turns a repository snapshot into a zoomable code map.

- A `Snapshot` is the analyzer output: files, symbols, imports, tests, services,
  optional details, and optional traces.
- `@sprawlens/schema` converts a `Snapshot` into the neutral `AtlasGraph`.
- `@sprawlens/layout` places that graph as either dependency rings or a treemap.
- `@sprawlens/viz` renders the atlas and owns only view state and interaction.

The map hierarchy is:

```text
module -> directory -> file -> class -> symbol -> detail graph
```

Area represents the selected weight (`loc` or `complexity`). Position should
make dependency neighborhoods readable; it is not a file-tree diagram.

## Sources

The UI accepts these sources:

- `synthetic`: deterministic generated graph for stress and render tests.
- `sprawlens`: bundled fixture for zero-setup demos.
- `sprawlens-history`: bundled commit history fixture.
- `playwright`: render fixture for browser tests.
- `served`: CLI/server/Worker supplied snapshot.

The CLI served source can expose hover, CFG, call hierarchy, working-tree diff,
trace, and test endpoints. The Worker served source exposes public GitHub
snapshot generation and static assets only.

## Render Modes

The primary layout modes are:

- `rings`: concentric dependency rings by module.
- `treemap`: rectangular bundled map with the same hierarchy and overlays.

The same semantic overlays must work in both layouts:

- internal dependency edges,
- cross-plane edges for tests/deps/docs,
- runtime trace heat and path edges,
- file/symbol diff outlines,
- selected or extracted focus.

## Focus and Extraction

Only one extraction view controls the active map framing at a time. Priority is:

1. Manual focus or selection.
2. Trace Extract.
3. Changed Preview.

Manual focus wins because it is an explicit navigation action. Trace Extract
wins over Changed Preview because it answers the narrower question "what ran?".
Changed Preview is the broad fallback for "what changed?".

Changed Preview extracts the nodes touched by the active diff:

- Prefer precise changed symbols when symbol diff or hunk stats identify them.
- Otherwise include all symbols in a changed file so the change remains visible
  at symbol granularity.
- Use outlines and foreground diff marks, not large changed-background fills.

Trace Extract extracts every resolved symbol in the active trace or timeline,
not only the current playback cursor. Timeline stack edges and adjacent step
transitions become call edges in the extracted focus.

Implementation anchor: `packages/viz/src/mapDisplaySpec.ts`,
`packages/viz/src/changedPreview.ts`, and `packages/viz/src/traceExtract.ts`.

## Change Visualization

Working-tree, history, and render diff all share the same semantics:

- added and modified nodes are highlighted at file or symbol level;
- removed files are counted but cannot be drawn on a map built from the new
  working tree;
- node-level diff density is shown through outline/foreground emphasis, so the
  macro map stays readable;
- directory/module boundaries are context, not the primary diff signal.

The lower-left Changed Preview panel owns the diff workflow: toggle extraction,
show the changed count, and list recent working-tree changes.

When Changed Preview is active, the extraction and the emphasis channel are
separate. Extract may include surrounding files/symbols as context, but strong
orange outlines, diff percentages, and changed-label weight apply only to nodes
with direct diff evidence. Intermediate boundaries remain context only:
unchanged boundaries fade to a neutral hairline, while boundaries that contain a
directly changed leaf remain readable as the changed ancestry.

## Runtime Trace

sprawlens supports two trace views:

- Aggregate trace overlay: heat and path edges from a resolved `Trace`.
- Timeline player: ordered `TraceTimeline` playback with a cursor and optional
  Trace Extract.

Timeline playback is ephemeral UI state. It is not URL-synced. Trace Extract is
URL-synced because it changes the reproducible render state.

## Agent and Query Lens

Agent Lens is a deterministic, depth-bounded subgraph around a selected target.
It is a read model for agents and users before an LLM summary is requested.

The panel is docked in the lower-right lane so the top-right lane remains
available for LSP hover information. It should grow to content within a capped
height, not reserve a fixed full-height sidebar.

## Interaction

The map supports:

- wheel zoom anchored at the cursor,
- drag pan,
- Alt-drag tilt,
- two-finger pinch zoom in/out,
- one-finger touch pan,
- camera flights to focus targets.

Zoom and pan update the SVG viewBox immediately. Expensive level-of-detail
state commits after the gesture settles.

Code-data updates from the live server are incremental. A changed snapshot
recomputes the displayed graph projection, diffs it against the current display,
and warm-applies only that delta to the existing layout. Cold rebuilds are
reserved for structural view changes such as layout mode, boundary chain,
viewport size, or first load.

New nodes inserted into an existing layout should start near their dependency
neighbors' previous sites. This keeps additions local and legible instead of
appearing as a seed-driven reshuffle.

URL-synced settings are render-affecting and reproducible: source, layout,
boundaries, display levels, weight, Changed Preview, Trace Extract, edges,
service grouping, color scheme, tilt, seed, and experimental mode. Camera,
hover, selection, timeline cursor, and playback are ephemeral.

## Overlay Layout

Overlay lanes are intentional:

- Top-left: layers and structural controls.
- Top-right: camera/theme/source controls and LSP hover popup.
- Lower-left: Changed Preview and change history.
- Lower-middle: Trace player or Trace Extract toggle.
- Lower-right: Agent Lens and chat.

On mobile widths, bottom controls stack to avoid overlap:

1. Trace control at the safe bottom inset.
2. Changed Preview above trace when both exist.
3. Chat above whichever temporal controls are visible.

Implementation anchor: `overlayLayoutSpec()` in
`packages/viz/src/mapDisplaySpec.ts`.

## Package Boundaries

The workspace is layered:

- L0 contracts: language-neutral data shapes only.
- L1 domain: schema transformations and layout algorithms.
- L2 capabilities: language analyzers and providers.
- L3 applications: server and viz.
- L4 composition: CLI and Worker.

`pnpm lint:layers` enforces package dependencies across these layers.

## Deployment

GitHub Pages and Cloudflare Workers serve the same `@sprawlens/viz` build.

- Pages is static hosted output from `packages/viz/dist`.
- Workers serves the same assets and can generate public GitHub snapshots via
  `/api/snapshot?repo=owner/repo`.

Both deployments are updated from GitHub Actions on `main`.
