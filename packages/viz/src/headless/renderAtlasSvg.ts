import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { AtlasEvidence, AtlasGraph, SymbolKind } from "@sprawlens/schema";
import {
  deriveModuleIdOf,
  classGrouping,
  directoryGrouping,
  fileGrouping,
  moduleGrouping,
  parentFileOf as contractParentFileOf,
  projectAtlasEvidence,
} from "@sprawlens/schema";
import { cyclicComponents } from "@sprawlens/layout";
import { normalizeViewState, serializeViewState, type ViewState } from "@sprawlens/agent";
import "./preactClassicJsxRuntime.ts";
import { buildScene } from "../engine/buildScene.ts";
import { fallbackChangedDiffStat } from "../diffStats.ts";
import { SvgRenderer } from "../renderer/SvgRenderer.tsx";
import type { MapScene } from "../renderer/contract.ts";
import { sceneGeometryFingerprint } from "../renderer/sceneGeometry.ts";
import { createRingsState, stepRingsState, type RingsState } from "../ringsController.ts";
import { createTreemapState, stepTreemapState, type TreemapState } from "../treemapController.ts";
import {
  ADDED_FILL,
  DOWNSTREAM_FILL,
  INK,
  MAP_BG,
  MODIFIED_FILL,
  PANEL_BG,
  PANEL_BORDER,
  setMapTheme,
  UPSTREAM_FILL,
} from "../mapShared.tsx";
import type { TiltParams } from "../Controls.tsx";
import type { Granularity } from "../viewConfig.ts";
import { reweightByTransitiveComplexity } from "../viewConfig.ts";

/**
 * Render a repository's structure map to a standalone SVG string in Node —
 * no browser, no DOM. The whole drawing path (solver → {@link buildScene} →
 * {@link SvgRenderer}) is the same one the interactive app uses; here it runs
 * to convergence in a plain loop and serializes with preact-render-to-string.
 *
 * Scope: module / file granularity (the macro shape). Symbol granularity needs
 * the app's LOD budgeting and per-frame inner layouts, so it stays browser-only.
 */
export type AtlasSvgOptions = {
  /** Concentric rings or bundled treemap. Defaults to treemap (the app default). */
  layout?: "rings" | "treemap";
  /** Leaf unit: bare modules, or modules subdivided into file cells. */
  level?: Granularity;
  /** Layout seed; the same seed yields the same map. Defaults to 1. */
  seed?: number;
  /** Draw the dependency mesh. Defaults to false. */
  showEdges?: boolean;
  /** Dark palette. Defaults to false (light). */
  dark?: boolean;
  /** World canvas size; defaults to the app's per-layout extent. */
  width?: number;
  height?: number;
  /** Solver iteration cap (safety bound around the convergence loop). */
  maxSteps?: number;
  /** Map of node id → change kind; overlays changed leaf cells with change heat. */
  changed?: Map<string, "added" | "modified">;
  /** Counts for the diff legend; when present and non-zero, a legend is drawn. */
  diffSummary?: { added: number; modified: number; removed: number };
  /** Semantic change overlay: touched files plus dependency blast radius. */
  changeSpectrum?: ChangeSpectrum;
  /** Canonical human/agent view contract; its fields override legacy scalars. */
  view?: ViewState;
  /** Serializable diff/runtime/test evidence shared with browser and MCP clients. */
  evidence?: AtlasEvidence;
};

export type AtlasViewSvgOptions = Omit<AtlasSvgOptions, "view" | "layout" | "level" | "seed">;

export type ChangeSpectrum = {
  added: number;
  modified: number;
  removed: number;
  touched: number;
  upstream: number;
  downstream: number;
};

// the app's fixed rings canvas and its default treemap extent
const RINGS_W = 960;
const RINGS_H = 640;
const TREE_W = 1280;
const TREE_H = 720;
// solver tuning, mirrored from App.tsx so the headless map matches the app
const ADAPTATION_RATE = 0.8;
const LLOYD_RATE = 0.7;
const STEPS_PER_ITER = 8;
const DEFAULT_MAX_STEPS = 4000;

const NOOP = () => {};
const NO_TILT: TiltParams = {
  enabled: false,
  theta: 0,
  pitch: 0,
  layers: {},
  gap: 0,
};
// symbol ids encode their declaration kind (symbol:<path>:<kind>:<name>:<line>);
// the same set App.tsx guards symbolKindOf with.
const SYMBOL_KIND_SET: ReadonlySet<string> = new Set([
  "function",
  "class",
  "variable",
  "registration",
  "type",
  "interface",
  "enum",
  "method",
  "property",
  "static-method",
  "static-property",
]);

function symbolKindOf(id: string): SymbolKind | undefined {
  if (!id.startsWith("symbol:")) return undefined;
  const parts = id.split(":");
  if (parts.length < 5) return undefined;
  const k = parts[parts.length - 3]!;
  return SYMBOL_KIND_SET.has(k) ? (k as SymbolKind) : undefined;
}

/** Run a converging layout loop to a steady state (or the step cap). */
function solveRings(graph: AtlasGraph, options: RingsSolveOpts): RingsState {
  let state = createRingsState(graph, options.solver);
  for (let i = 0; i < options.maxSteps; i++) {
    const next = stepRingsState(state, STEPS_PER_ITER);
    state = next.state;
    if (!next.active) break;
  }
  return state;
}
function solveTreemap(graph: AtlasGraph, options: TreemapSolveOpts): TreemapState {
  let state = createTreemapState(graph, options.solver);
  for (let i = 0; i < options.maxSteps; i++) {
    const next = stepTreemapState(state, STEPS_PER_ITER);
    state = next.state;
    if (!next.active) break;
  }
  return state;
}
type RingsSolveOpts = {
  solver: Parameters<typeof createRingsState>[1];
  maxSteps: number;
};
type TreemapSolveOpts = {
  solver: Parameters<typeof createTreemapState>[1];
  maxSteps: number;
};

export function renderAtlasSvg(graph: AtlasGraph, options: AtlasSvgOptions = {}): string {
  const view = options.view ? normalizeViewState(options.view) : null;
  const layout = view?.layout ?? options.layout ?? "treemap";
  const level: Granularity = view?.granularity ?? options.level ?? "file";
  const seed = view?.seed ?? options.seed ?? 1;
  const dark = options.dark ?? view?.theme === "dark";
  const width = options.width ?? view?.viewport.width ?? (layout === "rings" ? RINGS_W : TREE_W);
  const height = options.height ?? view?.viewport.height ?? (layout === "rings" ? RINGS_H : TREE_H);
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const evidence = projectAtlasEvidence(options.evidence);
  const showEvidenceDiff = view?.showDiff ?? true;
  const fileIds = graph.nodes.filter((node) => node.kind === "file").map((node) => node.id);
  const moduleIdOf = deriveModuleIdOf(fileIds);
  const moduleOf = (id: string) => moduleIdOf(contractParentFileOf(id));
  const weightedGraph =
    view?.weight === "complexity" ? reweightByTransitiveComplexity(graph) : graph;
  const displayGraph =
    level === "symbol" && weightedGraph.nodes.some((node) => node.kind === "symbol")
      ? (() => {
          const nodes = weightedGraph.nodes.filter((node) => node.kind === "symbol");
          const ids = new Set(nodes.map((node) => node.id));
          return {
            nodes,
            edges: weightedGraph.edges.filter(
              (edge) => ids.has(edge.source) && ids.has(edge.target),
            ),
          };
        })()
      : (() => {
          const nodes = weightedGraph.nodes.filter((node) => node.kind !== "symbol");
          const ids = new Set(nodes.map((node) => node.id));
          return {
            nodes,
            edges: weightedGraph.edges.filter(
              (edge) => ids.has(edge.source) && ids.has(edge.target),
            ),
          };
        })();
  // A file boundary makes files the leaf cells; symbol mode skips that boundary
  // and lays the symbol graph directly inside the same derived modules as the app.
  const directory = directoryGrouping(3);
  const hierarchyBoundaries = view?.hierarchy.boundaries;
  const hasDirectory = hierarchyBoundaries?.includes("directory") ?? false;
  const boundaries = hierarchyBoundaries
    ? hierarchyBoundaries.flatMap((boundary) => {
        if (boundary === "module") return [moduleGrouping(moduleOf)];
        if (boundary === "directory") return [directory];
        if (boundary === "file" && level === "file") return [fileGrouping()];
        if (boundary === "class" && level === "symbol") {
          return [
            classGrouping(moduleOf, hasDirectory ? (id) => directory.groupOf(id) : undefined),
          ];
        }
        return [];
      })
    : level === "file"
      ? [moduleGrouping(moduleOf), fileGrouping()]
      : [moduleGrouping(moduleOf)];
  if (boundaries.length === 0) boundaries.push(moduleGrouping(moduleOf));
  const solver = {
    width,
    height,
    seed,
    adaptationRate: ADAPTATION_RATE,
    lloydRate: LLOYD_RATE,
    boundaries,
  };

  // the theme tokens are ESM live bindings the components read at render time
  setMapTheme(dark);

  const rings = layout === "rings" ? solveRings(displayGraph, { solver, maxSteps }) : null;
  const treemap = layout === "treemap" ? solveTreemap(displayGraph, { solver, maxSteps }) : null;

  const labels = new Map(graph.nodes.map((n) => [n.id, n.label]));
  const locOf = new Map(graph.nodes.map((n) => [n.id, n.metrics.loc]));
  const exportedIds = new Set(graph.nodes.filter((n) => n.exported).map((n) => n.id));
  const cyclicIds = new Set(
    cyclicComponents(
      graph.nodes.map((n) => n.id),
      graph.edges,
    ).flat(),
  );
  const cyclicModuleIds = rings
    ? new Set(
        cyclicComponents(
          [...new Set(rings.topEdges.flatMap((e) => [e.source, e.target]))],
          rings.topEdges,
        ).flat(),
      )
    : new Set<string>();
  const parentFileOf = (id: string) =>
    id.startsWith("symbol:") ? (id.split(":")[1] ?? id) : id.split("#")[0]!;

  const scene = buildScene({
    rings,
    treemap,
    granularity: level,
    innerCells: [],
    displayEdges: displayGraph.edges,
    symbolEdges: [],
    detailEdges: [],
    traceEdges: evidence.traceEdges,
    traceHeat: evidence.traceHeat,
    testStatus: evidence.testStatus,
    testDuration: evidence.testDuration,
    visibleLevels: new Set<string>([
      ...(view?.hierarchy.displayLevels ?? [level, "module"]),
      level,
    ]),
    cfgEntries: [],
    cyclicIds,
    cyclicModuleIds,
    labels,
    exportedIds,
    symbolKindOf,
    focus: null,
    changedPreviewActive: false,
    testFileIds: new Set(),
    layers: [],
    altEdges: false,
    parentFileOf,
    changedOf: (id) =>
      options.changed?.get(id) ?? (showEvidenceDiff ? evidence.changed.get(id) : undefined),
    diffStatOf: (id) => {
      const exact = showEvidenceDiff ? evidence.diffStats.get(id) : undefined;
      if (exact) return exact;
      const kind =
        options.changed?.get(id) ?? (showEvidenceDiff ? evidence.changed.get(id) : undefined);
      return kind ? fallbackChangedDiffStat(kind, locOf.get(id)) : undefined;
    },
    portNodes: [],
    hiddenLayers: new Set(view?.hiddenLayers ?? []),
    showEdges: view?.showEdges ?? options.showEdges ?? false,
    tilt: view
      ? {
          ...NO_TILT,
          enabled: view.tilt.enabled,
          theta: view.tilt.theta,
          pitch: view.tilt.pitch,
        }
      : NO_TILT,
    labelMinPx: 9,
    labelScale: 1,
    ringsExtent: { width, height },
    treemapExtent: { width, height },
  });
  if (!scene) return emptySvg(width, height);

  const body = renderToString(
    h(SvgRenderer, {
      scene,
      // Persisted/headless artifacts need a content-derived golden key. The
      // interactive renderer deliberately uses its cheap marker instead: a
      // full canonical JSON + BigInt hash on every animation frame is pure
      // verification overhead there.
      geometryFingerprint: sceneGeometryFingerprint(scene),
      selectedId: view?.selection[0] ?? null,
      selectedIds: new Set(view?.selection ?? []),
      selectedEdges: [],
      focusRequest: null,
      onSelect: NOOP,
      onSelectEdge: NOOP,
      onFocusId: NOOP,
      onTiltDrag: NOOP,
      onViewSettle: NOOP,
    }),
  );
  const legend = options.changeSpectrum
    ? buildChangeSpectrumOverlay(options.changeSpectrum, height)
    : options.diffSummary
      ? buildDiffLegend(options.diffSummary, height)
      : "";
  return finalize(body, width, height, legend, {
    layout,
    selectedId: view?.selection[0] ?? null,
    view,
    viewBox: view ? viewBoxFor(scene, view) : null,
    evidence: evidence.summary,
  });
}

/** Render the versioned ViewState through the exact solver/scene/SVG path used by the app. */
export function renderAtlasViewSvg(
  graph: AtlasGraph,
  view: ViewState,
  options: AtlasViewSvgOptions = {},
): string {
  return renderAtlasSvg(graph, { ...options, view: normalizeViewState(view) });
}

function polygonBounds(points: readonly { x: number; y: number }[]) {
  if (points.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function targetBounds(scene: MapScene, id: string) {
  if (scene.kind === "rings") {
    const circle = scene.rings.circles.get(id);
    if (circle) {
      return {
        x: circle.cx - circle.r,
        y: circle.cy - circle.r,
        width: circle.r * 2,
        height: circle.r * 2,
      };
    }
    for (const layout of scene.rings.leafLayouts.values()) {
      const cell = layout.cells.find((candidate) => candidate.id === id);
      if (cell) return polygonBounds(cell.polygon);
    }
  } else {
    for (const level of scene.state.levels) {
      const cell = level.cells.get(id);
      if (cell) return polygonBounds(cell.polygon);
    }
    for (const layout of scene.state.leafLayouts.values()) {
      const cell = layout.cells.find((candidate) => candidate.id === id);
      if (cell) return polygonBounds(cell.polygon);
    }
  }
  return null;
}

function viewBoxFor(scene: MapScene, view: ViewState): string | null {
  if (view.camera.center && view.camera.zoom) {
    const width = scene.width / view.camera.zoom;
    const height = scene.height / view.camera.zoom;
    return `${view.camera.center.x - width / 2} ${view.camera.center.y - height / 2} ${width} ${height}`;
  }
  const bounds = view.camera.target ? targetBounds(scene, view.camera.target) : null;
  if (!bounds) return null;
  const padding = Math.max(bounds.width, bounds.height) * 0.08 + 4;
  return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
}

function buildChangeSpectrumOverlay(summary: ChangeSpectrum, height: number): string {
  const rows: Array<{ label: string; count: number; fill: string; open?: boolean }> = [];
  if (summary.added > 0) rows.push({ label: "added", count: summary.added, fill: ADDED_FILL });
  if (summary.modified > 0)
    rows.push({ label: "modified", count: summary.modified, fill: MODIFIED_FILL });
  if (summary.removed > 0)
    rows.push({ label: "removed", count: summary.removed, fill: "none", open: true });
  if (summary.upstream > 0)
    rows.push({ label: "impact", count: summary.upstream, fill: UPSTREAM_FILL });
  if (summary.downstream > 0)
    rows.push({ label: "deps", count: summary.downstream, fill: DOWNSTREAM_FILL });
  if (rows.length === 0) return "";

  const rowH = 20;
  const padX = 10;
  const padY = 8;
  const titleH = 20;
  const boxW = 172;
  const boxH = padY * 2 + titleH + rows.length * rowH;
  const x = 16;
  const y = height - boxH - 16;

  const items = rows
    .map((r, i) => {
      const top = padY + titleH + i * rowH;
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
    `<text x="${padX}" y="${padY + 12}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="700" fill="${INK}">Change Spectrum</text>` +
    `<text x="${boxW - padX}" y="${padY + 12}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${INK}">touched ${summary.touched}</text>` +
    items +
    `</g>`
  );
}

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

/**
 * Make the rendered fragment a valid standalone document: add the SVG
 * namespace (preact omits it), pin explicit pixel dimensions for rasterizers,
 * and paint the map background the app draws behind the <svg>.
 */
function finalize(
  body: string,
  width: number,
  height: number,
  legend = "",
  metadata?: {
    layout: "rings" | "treemap";
    selectedId: string | null;
    view: ViewState | null;
    viewBox: string | null;
    evidence: ReturnType<typeof projectAtlasEvidence>["summary"];
  },
): string {
  const open = body.indexOf(">");
  if (!body.startsWith("<svg") || open === -1) return body;
  let head = body.slice(0, open);
  const rest = body.slice(open + 1);
  if (metadata?.viewBox) {
    head = /viewBox="[^"]*"/.test(head)
      ? head.replace(/viewBox="[^"]*"/, `viewBox="${metadata.viewBox}"`)
      : `${head} viewBox="${metadata.viewBox}"`;
  }
  if (metadata) {
    head += ` data-atlas-layout="${metadata.layout}"`;
    if (metadata.selectedId) {
      head += ` data-selected-id="${escapeAttribute(metadata.selectedId)}"`;
    }
    if (metadata.view) {
      head += ` data-view-state="${encodeURIComponent(serializeViewState(metadata.view))}"`;
    }
    const evidenceTests = Object.values(metadata.evidence.tests).reduce(
      (sum, count) => sum + count,
      0,
    );
    head += ` data-evidence-changes="${metadata.evidence.changes.added + metadata.evidence.changes.modified + metadata.evidence.changes.removed}"`;
    head += ` data-evidence-trace-edges="${metadata.evidence.traceEdges}"`;
    head += ` data-evidence-tests="${evidenceTests}"`;
  }
  const ns = head.includes("xmlns=")
    ? head
    : `${head} xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`;
  const bg = `<rect x="0" y="0" width="${width}" height="${height}" fill="${MAP_BG}"/>`;
  const withLegend = legend ? rest.replace(/<\/svg>\s*$/, `${legend}</svg>`) : rest;
  return `${ns}>${bg}${withLegend}`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function emptySvg(width: number, height: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${MAP_BG}"/></svg>`
  );
}
