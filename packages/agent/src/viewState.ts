/**
 * The headless view state the agent operates. It mirrors the viz's view params
 * (layout / granularity / selection / camera / layers / tilt) but holds no
 * browser objects, so the MCP front-end can carry one per session and the
 * in-app chat can apply the same intents to the live store. The renderer
 * (a later step) turns a ViewState + graph into an SVG/PNG.
 */
export type Layout = "rings" | "treemap";
export type Granularity = "module" | "file" | "symbol";
export type Tilt = { enabled: boolean; theta: number; pitch: number };

export type ViewState = {
  layout: Layout;
  granularity: Granularity;
  /** Highlighted node ids; the first also anchors the dependency focus. */
  selection: string[];
  /** What the camera frames — a node/module id, or null for "fit the whole map". */
  camera: { target: string | null };
  /** Layer names switched off (e.g. "test", "deps"). */
  hiddenLayers: string[];
  /** Overlay the working-tree diff. */
  showDiff: boolean;
  tilt: Tilt;
};

export const initialView: ViewState = {
  layout: "rings",
  granularity: "file",
  selection: [],
  camera: { target: null },
  hiddenLayers: [],
  showDiff: false,
  tilt: { enabled: false, theta: 0, pitch: 0 },
};
