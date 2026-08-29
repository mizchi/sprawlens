import {
  presetConfig,
  presetOf,
  VIEW_PRESETS,
  type BoundaryLevel,
  type DisplayLevel,
  type OmitScope,
  type ViewConfig,
  type WeightKind,
} from "./viewConfig.ts";
import type {
  LeafUpdateSummary,
  StableNeighborhoodExperimentSummary,
} from "./incrementalLayout.ts";

type DataSource =
  | "synthetic"
  | "sprawlens"
  | "sprawlens-history"
  | "playwright"
  // a snapshot served by the CLI (`sprawlens <repo>`) at GET /api/snapshot
  | "served";
type LayoutKind = "rings" | "treemap";

/** Affine tilt that lays the map flat as a stacked-plane view. `pitch` drives
 * the vertical squash (cos(pitch)); `theta` rotates the plane in-plane. The
 * planes stay axis-aligned rectangles — the user tilts them with the mouse
 * (alt+drag) rather than a baked-in parallelogram lean. Radians. */
export type TiltParams = {
  enabled: boolean;
  theta: number;
  pitch: number;
  /** Per-layer plane visibility (layer name -> shown). Names come from the
   * server's layer manifest; "test" and "deps" are the built-in presets. */
  layers: Record<string, boolean>;
  /** Vertical separation between stacked planes, in world units. */
  gap: number;
};

/** Whether a named satellite plane is toggled on. */
function planeShown(tilt: TiltParams, name: string): boolean {
  return tilt.layers[name] === true;
}

/** Whether any satellite plane is toggled on. */
export function anyPlaneShown(tilt: TiltParams): boolean {
  return Object.values(tilt.layers).some(Boolean);
}

export type PlaygroundParams = {
  source: DataSource;
  layout: LayoutKind;
  /** Orthogonal view axes; presets bundle them (see viewConfig.ts). */
  boundaries: BoundaryLevel[];
  displayLevels: DisplayLevel[];
  omit: OmitScope[];
  /** Top-level scopes excluded from the map ((root), src, e2e, ...). */
  omitModules: string[];
  weight: WeightKind;
  /** Use the sequence-stable feasible envelope for changed hierarchy groups. */
  stableLayout: boolean;
  /** Fly the camera to files as their working-tree changes appear. */
  followChanges: boolean;
  /** Extract-style dimming preview for changed files/symbols. */
  changedPreview: boolean;
  /** Extract-style dimming preview for runtime trace symbols. */
  traceExtract: boolean;
  /** Diff comparison base (no UI yet; git tooling will own this). */
  diffBase: string;
  showEdges: boolean;
  /** Nest the module map inside terraform service nodes (the upper layer). */
  groupByService: boolean;
  /** Dark map + chrome; defaults to the system preference. */
  dark: boolean;
  /** Minimum on-screen px a symbol/directory label needs to be drawn. */
  labelMinPx: number;
  /** Multiplier on label font size. */
  labelScale: number;
  /** Stacked-plane tilt; off keeps the flat top-down view. */
  tilt: TiltParams;
};

type Props = {
  params: PlaygroundParams;
  /** Top-level scopes present in the loaded graph. */
  availableScopes: string[];
  /** Experiment helpers (graph mutation buttons) show only when set. */
  debug?: boolean;
  changedCount?: number;
  layoutUpdateSummary?: LeafUpdateSummary;
  stableExperimentSummary?: StableNeighborhoodExperimentSummary;
  onChange: (params: PlaygroundParams) => void;
  onRegenerate: () => void;
  onMutateWeight: () => void;
  onAddNode: () => void;
  onRemoveNode: () => void;
};

const row: Record<string, string> = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
};

const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;

/** The data-source picker is a dev / demo affordance: shown only on localhost
 * and the GitHub Pages demo, hidden in any embedded / production use. */
const SHOW_DATA_PICKER =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.endsWith("github.io"));

export function Controls(props: Props) {
  const { params, onChange } = props;
  const set = <K extends keyof PlaygroundParams>(key: K, value: PlaygroundParams[K]) =>
    onChange({ ...params, [key]: value });
  const viewConfig: ViewConfig = {
    boundaries: params.boundaries,
    displayLevels: params.displayLevels,
    omit: params.omit,
    weight: params.weight,
  };
  const activePreset = presetOf(viewConfig);
  const applyPreset = (id: string) => {
    const config = presetConfig(id);
    if (config) onChange({ ...params, ...config });
  };
  const button: Record<string, string> = {
    padding: "6px 10px",
    fontSize: "12px",
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {SHOW_DATA_PICKER ? (
        <label style={row}>
          <span style={{ width: "110px" }}>data</span>
          <select
            value={params.source}
            onInput={(e) => set("source", (e.target as HTMLSelectElement).value as DataSource)}
          >
            {params.source === "served" ? <option value="served">served (this repo)</option> : null}
            <option value="synthetic">synthetic</option>
            <option value="sprawlens">sprawlens (this repo)</option>
            <option value="sprawlens-history">sprawlens (git log)</option>
            <option value="playwright">playwright (monorepo)</option>
          </select>
        </label>
      ) : null}
      <label style={row}>
        <span style={{ width: "110px" }}>preset</span>
        <select
          value={activePreset}
          onInput={(e) => applyPreset((e.target as HTMLSelectElement).value)}
        >
          {VIEW_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          {activePreset === "custom" ? (
            <option value="custom" disabled>
              custom
            </option>
          ) : null}
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>layout</span>
        <select
          value={params.layout}
          onInput={(e) => set("layout", (e.target as HTMLSelectElement).value as LayoutKind)}
        >
          <option value="rings">rings (modules)</option>
          <option value="treemap">treemap (bundled)</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>weight</span>
        <select
          value={params.weight}
          onInput={(e) => set("weight", (e.target as HTMLSelectElement).value as WeightKind)}
        >
          <option value="loc">LOC</option>
          <option value="complexity">complexity (deps)</option>
        </select>
      </label>
      <label
        style={row}
        title="run the paper envelope: retain the NPVT baseline and minimize changed-layout displacement"
      >
        <span style={{ width: "110px" }}>stable history</span>
        <input
          type="checkbox"
          checked={params.stableLayout}
          onInput={(e) => set("stableLayout", (e.target as HTMLInputElement).checked)}
        />
        {props.layoutUpdateSummary ? (
          <small style={{ color: "#94a3b8" }}>
            S{props.layoutUpdateSummary.stableNeighborhood} W{props.layoutUpdateSummary.warm} C
            {props.layoutUpdateSummary.cold}
          </small>
        ) : null}
      </label>
      {params.stableLayout ? (
        <div
          data-testid="stable-layout-experiment"
          data-stable-groups={props.stableExperimentSummary?.groups ?? 0}
          data-warm-groups={props.layoutUpdateSummary?.warm ?? 0}
          data-cold-groups={props.layoutUpdateSummary?.cold ?? 0}
          data-baseline-selections={props.stableExperimentSummary?.baselineSelections ?? 0}
          data-contract-violations={props.stableExperimentSummary?.contractViolations ?? 0}
          data-adjacency-gain={props.stableExperimentSummary?.meanAdjacencyGain ?? 0}
          data-displacement-reduction={
            props.stableExperimentSummary?.meanDisplacementReduction ?? 0
          }
          data-eligible-candidates={props.stableExperimentSummary?.meanEligibleCandidates ?? 0}
          data-weighted-solves={props.stableExperimentSummary?.meanWeightedSolves ?? 0}
          data-total-steps={props.stableExperimentSummary?.meanTotalSteps ?? 0}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "4px 10px",
            padding: "8px 10px",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "6px",
            background: "rgba(14, 116, 144, 0.1)",
            fontSize: "11px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <strong style={{ gridColumn: "1 / -1", color: "#38bdf8" }}>paper envelope</strong>
          <small style={{ gridColumn: "1 / -1", color: "#94a3b8" }}>
            2 candidates · NPVT topology floor · ≤48 nodes
          </small>
          {(props.stableExperimentSummary?.groups ?? 0) === 0 ? (
            <small style={{ gridColumn: "1 / -1", color: "#94a3b8" }}>
              Advance history to measure the next hierarchy update.
            </small>
          ) : (
            <>
              <span>stable groups</span>
              <b>{props.stableExperimentSummary!.groups}</b>
              <span>displacement saved</span>
              <b>{formatSigned(props.stableExperimentSummary!.meanDisplacementReduction)}</b>
              <span>adjacency gain</span>
              <b>{formatSigned(props.stableExperimentSummary!.meanAdjacencyGain)}</b>
              <span>baseline selected</span>
              <b>
                {props.stableExperimentSummary!.baselineSelections}/
                {props.stableExperimentSummary!.groups}
              </b>
              <span>eligible / solves</span>
              <b>
                {props.stableExperimentSummary!.meanEligibleCandidates.toFixed(1)} /{" "}
                {props.stableExperimentSummary!.meanWeightedSolves.toFixed(1)}
              </b>
              <span>contract</span>
              <b
                style={{
                  color:
                    props.stableExperimentSummary!.contractViolations === 0 ? "#22c55e" : "#ef4444",
                }}
              >
                {props.stableExperimentSummary!.contractViolations} violations
              </b>
            </>
          )}
        </div>
      ) : null}
      <label style={row}>
        <span style={{ width: "110px" }}>follow changes</span>
        <input
          type="checkbox"
          checked={params.followChanges}
          onInput={(e) => set("followChanges", (e.target as HTMLInputElement).checked)}
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>
          changed preview{props.changedCount ? ` ${props.changedCount}` : ""}
        </span>
        <input
          type="checkbox"
          checked={params.changedPreview}
          disabled={(props.changedCount ?? 0) === 0}
          onInput={(e) => set("changedPreview", (e.target as HTMLInputElement).checked)}
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>detail edges</span>
        <input
          type="checkbox"
          checked={params.showEdges}
          onInput={(e) => set("showEdges", (e.target as HTMLInputElement).checked)}
        />
      </label>
      <label style={row} title="nest the module map inside terraform services">
        <span style={{ width: "110px" }}>group by service</span>
        <input
          type="checkbox"
          checked={params.groupByService}
          onInput={(e) => set("groupByService", (e.target as HTMLInputElement).checked)}
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>label min {params.labelMinPx}px</span>
        <input
          type="range"
          min="3"
          max="40"
          step="1"
          value={params.labelMinPx}
          style={{ flex: 1 }}
          onInput={(e) => set("labelMinPx", Number((e.target as HTMLInputElement).value))}
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>label size {params.labelScale.toFixed(2)}×</span>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.05"
          value={params.labelScale}
          style={{ flex: 1 }}
          onInput={(e) => set("labelScale", Number((e.target as HTMLInputElement).value))}
        />
      </label>
      {props.debug ? (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button style={button} onClick={props.onRegenerate}>
            regenerate
          </button>
          <button style={button} onClick={props.onMutateWeight}>
            mutate weight ±30%
          </button>
          <button style={button} onClick={props.onAddNode}>
            add node
          </button>
          <button style={button} onClick={props.onRemoveNode}>
            remove node
          </button>
        </div>
      ) : null}
    </div>
  );
}
