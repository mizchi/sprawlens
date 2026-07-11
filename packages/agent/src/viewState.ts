/**
 * The headless view state the agent operates. It mirrors the viz's view params
 * (layout / granularity / selection / camera / layers / tilt) but holds no
 * browser objects, so the MCP front-end can carry one per session and the
 * in-app chat can apply the same intents to the live store. The renderer
 * (a later step) turns a ViewState + graph into an SVG/PNG.
 */
export type Layout = "rings" | "treemap";
export type Granularity = "module" | "file" | "symbol";
type BoundaryLevel = "module" | "directory" | "file" | "class";
type DisplayLevel = "module" | "directory" | "class" | "symbol" | "ast" | "cfg";
type WeightKind = "loc" | "complexity";
type Theme = "light" | "dark";
export type Tilt = { enabled: boolean; theta: number; pitch: number };
type CameraState = {
  target: string | null;
  /** Optional exact world-space camera state; target remains the semantic anchor. */
  center: { x: number; y: number } | null;
  zoom: number | null;
};
type TraceCursor = { id: string | null; timeUs: number | null };

export type ViewState = {
  /** Wire-format version. Parsers migrate missing/older fields to this shape. */
  version: 1;
  layout: Layout;
  granularity: Granularity;
  hierarchy: { boundaries: BoundaryLevel[]; displayLevels: DisplayLevel[] };
  weight: WeightKind;
  /** Stable NPVT strategy for bounded graph-delta updates. */
  stableLayout: boolean;
  theme: Theme;
  viewport: { width: number; height: number };
  /** Layout seed shared by browser, headless rendering, and agent sessions. */
  seed: number;
  /** Highlighted node ids; the first also anchors the dependency focus. */
  selection: string[];
  /** What the camera frames — a node/module id, or null for "fit the whole map". */
  camera: CameraState;
  /** Layer names switched off (e.g. "test", "deps"). */
  hiddenLayers: string[];
  /** Dependency mesh visibility. */
  showEdges: boolean;
  /** Overlay the working-tree diff. */
  showDiff: boolean;
  /** Active runtime evidence and its deterministic replay cursor. */
  trace: TraceCursor;
  tilt: Tilt;
};

export const initialView: ViewState = {
  version: 1,
  layout: "rings",
  granularity: "file",
  hierarchy: { boundaries: ["module", "file"], displayLevels: ["module", "symbol"] },
  weight: "loc",
  stableLayout: false,
  theme: "light",
  viewport: { width: 960, height: 640 },
  seed: 1,
  selection: [],
  camera: { target: null, center: null, zoom: null },
  hiddenLayers: [],
  showEdges: false,
  showDiff: false,
  trace: { id: null, timeUs: null },
  tilt: { enabled: false, theta: 0, pitch: 0 },
};

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const stringOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
    : [];
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
const BOUNDARIES: ReadonlySet<string> = new Set(["module", "directory", "file", "class"]);
const DISPLAY_LEVELS: ReadonlySet<string> = new Set([
  "module",
  "directory",
  "class",
  "symbol",
  "ast",
  "cfg",
]);

function axesForGranularity(granularity: Granularity): ViewState["hierarchy"] {
  if (granularity === "module") return { boundaries: ["module"], displayLevels: ["module"] };
  if (granularity === "symbol") {
    return { boundaries: ["module"], displayLevels: ["module", "symbol"] };
  }
  return { boundaries: ["module", "file"], displayLevels: ["module", "symbol"] };
}

/** Normalize untrusted chat/MCP/URL data and migrate the pre-v1 partial shape. */
export function normalizeViewState(value: unknown): ViewState {
  const input = object(value);
  const camera = object(input.camera);
  const center = object(camera.center);
  const centerValue =
    typeof center.x === "number" &&
    Number.isFinite(center.x) &&
    typeof center.y === "number" &&
    Number.isFinite(center.y)
      ? { x: center.x, y: center.y }
      : null;
  const zoom = finite(camera.zoom, -1);
  const tilt = object(input.tilt);
  const trace = object(input.trace);
  const hierarchy = object(input.hierarchy);
  const viewport = object(input.viewport);
  const seed = finite(input.seed, initialView.seed);
  const timeUs = finite(trace.timeUs, -1);
  const requestedGranularity: Granularity =
    input.granularity === "module" || input.granularity === "file" || input.granularity === "symbol"
      ? input.granularity
      : initialView.granularity;
  const fallbackAxes = axesForGranularity(requestedGranularity);
  const boundaries = strings(hierarchy.boundaries).filter((level) => BOUNDARIES.has(level)) as
    | BoundaryLevel[]
    | [];
  const displayLevels = strings(hierarchy.displayLevels).filter((level) =>
    DISPLAY_LEVELS.has(level),
  ) as DisplayLevel[];
  const normalizedBoundaries = boundaries.length > 0 ? boundaries : fallbackAxes.boundaries;
  const normalizedDisplay = displayLevels.length > 0 ? displayLevels : fallbackAxes.displayLevels;
  const granularity: Granularity = normalizedBoundaries.includes("file")
    ? "file"
    : normalizedDisplay.includes("symbol")
      ? "symbol"
      : "module";
  const width = finite(viewport.width, initialView.viewport.width);
  const height = finite(viewport.height, initialView.viewport.height);
  return {
    version: 1,
    layout:
      input.layout === "treemap" || input.layout === "rings" ? input.layout : initialView.layout,
    granularity,
    hierarchy: { boundaries: [...normalizedBoundaries], displayLevels: [...normalizedDisplay] },
    weight: input.weight === "complexity" ? "complexity" : "loc",
    stableLayout:
      typeof input.stableLayout === "boolean" ? input.stableLayout : initialView.stableLayout,
    theme: input.theme === "dark" ? "dark" : "light",
    viewport: {
      width: width > 0 ? width : initialView.viewport.width,
      height: height > 0 ? height : initialView.viewport.height,
    },
    seed: seed >= 0 ? Math.floor(seed) : initialView.seed,
    selection: strings(input.selection),
    camera: {
      target: stringOrNull(camera.target),
      center: centerValue,
      zoom: zoom > 0 ? zoom : null,
    },
    hiddenLayers: strings(input.hiddenLayers),
    showEdges: typeof input.showEdges === "boolean" ? input.showEdges : initialView.showEdges,
    showDiff: typeof input.showDiff === "boolean" ? input.showDiff : initialView.showDiff,
    trace: {
      id: stringOrNull(trace.id),
      timeUs: timeUs >= 0 ? timeUs : null,
    },
    tilt: {
      enabled: typeof tilt.enabled === "boolean" ? tilt.enabled : initialView.tilt.enabled,
      theta: finite(tilt.theta, initialView.tilt.theta),
      pitch: finite(tilt.pitch, initialView.tilt.pitch),
    },
  };
}

/** Stable JSON wire representation for MCP, chat persistence, and URL payloads. */
export function serializeViewState(view: ViewState): string {
  return JSON.stringify(normalizeViewState(view));
}

/** Parse a wire value; malformed input safely resolves to a fresh default. */
export function parseViewState(serialized: string): ViewState {
  try {
    return normalizeViewState(JSON.parse(serialized));
  } catch {
    return normalizeViewState(initialView);
  }
}
