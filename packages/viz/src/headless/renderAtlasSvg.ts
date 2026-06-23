import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { AtlasGraph, SymbolKind } from "@sprawlens/schema";
import { fileGrouping, moduleGrouping } from "@sprawlens/schema";
import { cyclicComponents } from "@sprawlens/layout";
import { buildScene } from "../engine/buildScene.ts";
import { SvgRenderer } from "../renderer/SvgRenderer.tsx";
import {
  createRingsState,
  stepRingsState,
  type RingsState,
} from "../ringsController.ts";
import {
  createTreemapState,
  stepTreemapState,
  type TreemapState,
} from "../treemapController.ts";
import {
  ADDED_FILL,
  INK,
  MAP_BG,
  MODIFIED_FILL,
  PANEL_BG,
  PANEL_BORDER,
  setMapTheme,
} from "../mapShared.tsx";
import type { TiltParams } from "../Controls.tsx";
import type { Granularity } from "../viewConfig.ts";

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
  level?: "module" | "file";
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
  /** Map of node id → change kind; tints added/modified leaf cells. */
  changed?: Map<string, "added" | "modified">;
  /** Counts for the diff legend; when present and non-zero, a legend is drawn. */
  diffSummary?: { added: number; modified: number; removed: number };
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

export function renderAtlasSvg(
  graph: AtlasGraph,
  options: AtlasSvgOptions = {},
): string {
  const layout = options.layout ?? "treemap";
  const level: Granularity = options.level ?? "file";
  const seed = options.seed ?? 1;
  const dark = options.dark ?? false;
  const width = options.width ?? (layout === "rings" ? RINGS_W : TREE_W);
  const height = options.height ?? (layout === "rings" ? RINGS_H : TREE_H);
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  // a file boundary makes files the leaf cells; otherwise modules are the leaves
  const boundaries =
    level === "file" ? [moduleGrouping(), fileGrouping()] : [moduleGrouping()];
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

  const rings =
    layout === "rings" ? solveRings(graph, { solver, maxSteps }) : null;
  const treemap =
    layout === "treemap" ? solveTreemap(graph, { solver, maxSteps }) : null;

  const labels = new Map(graph.nodes.map((n) => [n.id, n.label]));
  const exportedIds = new Set(
    graph.nodes.filter((n) => n.exported).map((n) => n.id),
  );
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
    displayEdges: graph.edges,
    graphEdges: graph.edges,
    symbolEdges: [],
    detailEdges: [],
    traceEdges: [],
    traceHeat: new Map(),
    testStatus: new Map(),
    testDuration: new Map(),
    visibleLevels: new Set<string>([level, "module"]),
    cfgEntries: [],
    cyclicIds,
    cyclicModuleIds,
    labels,
    exportedIds,
    symbolKindOf,
    focus: null,
    testFileIds: new Set(),
    layers: [],
    altEdges: false,
    parentFileOf,
    changedOf: (id) => options.changed?.get(id),
    portNodes: [],
    hiddenLayers: new Set(),
    showEdges: options.showEdges ?? false,
    tilt: NO_TILT,
    labelMinPx: 9,
    labelScale: 1,
    ringsExtent: { width, height },
    treemapExtent: { width, height },
  });
  if (!scene) return emptySvg(width, height);

  const body = renderToString(
    h(SvgRenderer, {
      scene,
      selectedId: null,
      selectedIds: new Set<string>(),
      selectedEdges: [],
      focusRequest: null,
      onSelect: NOOP,
      onSelectEdge: NOOP,
      onFocusId: NOOP,
      onTiltDrag: NOOP,
      onViewSettle: NOOP,
    }),
  );
  const legend = options.diffSummary
    ? buildDiffLegend(options.diffSummary, height)
    : "";
  return finalize(body, width, height, legend);
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
): string {
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

function emptySvg(width: number, height: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${MAP_BG}"/></svg>`
  );
}
