# Unify the scattered edge-rendering paths

Status: Design (2026-06-21). Refactor — behavior-preserving.

Implements #1. Edge rendering is split across `RingsMapSvg`, `TreemapSvg`, and
`mapShared`, with parallel endpoint-resolution, bundling, picking, and per-kind
`<g><path>` loops in each renderer. The goal: route every edge kind
(file / symbol / detail / trace / selection / focus) through one shared,
testable path, so the two renderers stop drifting.

## Constraint

No rendering tests exist; visual regressions are hard to catch. So the refactor
is **incremental and behavior-preserving**: extract the duplicated *pure* logic
(endpoint resolution, pick-candidate assembly) behind unit tests first, then a
shared rendering component, leaving each renderer's geometry inputs intact. Each
phase keeps all gates green and changes no visible output.

## What's duplicated today

- **Endpoint resolution** — `edgeEndpoints` (rings ~RingsMapSvg:488, treemap
  ~TreemapSvg:510) is copy-pasted: resolve `source`/`target` to a position, then
  re-anchor through CFG call/entry anchors. Same logic, two copies.
- **Bundling** — both call the shared `makeEdgeBundler` (mapShared:1189) but each
  builds its own near-identical `positionOf` map first.
- **Per-kind render loops** — each edge kind is a `<g>`+`path` map, repeated per
  renderer with parallel style gates (color / opacity / width / dash / zoom).
- **Picking** — `pickNearestEdge` / `pickEdgeAtPoint` are shared (edgePick.ts),
  but each renderer assembles its candidate list with parallel code.

## Phasing

- **Phase 1 — shared endpoint resolver.** Extract the CFG-anchor re-anchoring
  into `makeEdgeEndpointResolver({ positionOf, cfgAnchors, symbolNameOf })` in
  mapShared: each renderer supplies its own `positionOf` (rings' multi-map
  `resolveSite`, treemap's `positionOf` map) and gets the identical re-anchor +
  `[a,b]` assembly. Unit-tested. Replaces both `edgeEndpoints` copies. (TDD;
  this PR.)
- **Phase 2 — shared edge-group component. (done)** `<BundledEdges>` renders one
  kind's `<g><path>` list (shared stroke / opacity / dash, per-edge width). It
  replaces the rings focus / selection / lsp / trace loops and the treemap trace
  loop — the byte-identical ones — with one component; same SVG output. The
  treemap selection (`directions`) and per-edge-colored focus loops, and the
  per-edge-styled file/symbol loops, stay until Phase 4 carries kind + style
  uniformly.
- **Phase 3 — shared pick-candidate assembly.** One helper builds the lit /
  module candidate lists both `resolveEdgeAt` implementations feed to
  `pickNearestEdge`.
- **Phase 4 (optional) — edge model on the scene.** Carry edge *kinds* uniformly
  through the scene contract so `buildScene` decides visibility/style once and
  both renderers consume the same list.

## Out of scope

Cross-layer correspondence ropes (`PlaneLayerView`) and exit previews
(`ExitPreviewsLayer`) are already shared in `mapShared`; they stay as-is unless a
phase naturally absorbs them. No visual or interaction changes — purely
structural.
