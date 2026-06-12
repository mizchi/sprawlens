import {
  BOUNDARY_LEVELS,
  DISPLAY_LEVELS,
  OMIT_SCOPES,
  presetConfig,
  presetOf,
  UNAVAILABLE_LEVELS,
  VIEW_PRESETS,
  type BoundaryLevel,
  type DisplayLevel,
  type Granularity,
  type OmitScope,
  type SelectMode,
  type ViewConfig,
  type WeightKind,
} from "./viewConfig.ts";

export type ClipKind = "rect" | "circle" | "hexadecagon";
export type DataSource =
  | "synthetic"
  | "sprawlens"
  | "sprawlens-history"
  | "playwright";
export type LayoutKind = "rings" | "treemap" | "flat";

export type PlaygroundParams = {
  source: DataSource;
  layout: LayoutKind;
  /** Orthogonal view axes; presets bundle them (see viewConfig.ts). */
  granularity: Granularity;
  boundaries: BoundaryLevel[];
  displayLevels: DisplayLevel[];
  omit: OmitScope[];
  /** Module ids excluded from the map entirely. */
  omitModules: string[];
  /** Directory boundary: dirname truncated to this many segments. */
  directoryDepth: number;
  weight: WeightKind;
  focusGranularity: Granularity;
  /** What a click resolves to; zoom focus uses focusGranularity instead. */
  selectMode: SelectMode;
  /** Drop an explicit selection once its element scrolls off-screen. */
  deselectOffscreen: boolean;
  /** Fly the camera to files as their working-tree changes appear. */
  followChanges: boolean;
  /** Diff comparison base: "" = uncommitted vs HEAD, else a git ref. */
  diffBase: string;
  invertRings: boolean;
  count: number;
  seed: number;
  clipKind: ClipKind;
  adaptationRate: number;
  lloydRate: number;
  stepsPerFrame: number;
  showEdges: boolean;
};

type Props = {
  params: PlaygroundParams;
  /** Module ids present in the loaded graph, for the omit list. */
  availableModules: string[];
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

const LEVEL_LABELS: Record<DisplayLevel, string> = {
  module: "module",
  directory: "directory",
  file: "file",
  symbol: "symbol",
  ast: "AST",
  cfg: "CFG",
};

const OMIT_LABELS: Record<OmitScope, string> = {
  test: "test",
  "private-symbol": "private symbol",
};

function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onInput: (value: number) => void;
}) {
  return (
    <label style={row}>
      <span style={{ width: "110px" }}>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) =>
          props.onInput(Number((e.target as HTMLInputElement).value))
        }
        style={{ flex: "1" }}
      />
      <span style={{ width: "48px", textAlign: "right" }}>{props.value}</span>
    </label>
  );
}

export function Controls(props: Props) {
  const { params, availableModules, onChange } = props;
  const set = <K extends keyof PlaygroundParams>(
    key: K,
    value: PlaygroundParams[K],
  ) => onChange({ ...params, [key]: value });
  const viewConfig: ViewConfig = {
    granularity: params.granularity,
    boundaries: params.boundaries,
    displayLevels: params.displayLevels,
    omit: params.omit,
    weight: params.weight,
    focusGranularity: params.focusGranularity,
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
        <span style={{ width: "110px" }}>node unit</span>
        <select
          value={params.granularity}
          onInput={(e) =>
            set(
              "granularity",
              (e.target as HTMLSelectElement).value as Granularity,
            )
          }
        >
          <option value="module">module</option>
          <option value="file">file</option>
          <option value="symbol">symbol (network)</option>
        </select>
      </label>
      <div style={row}>
        <span style={{ width: "110px" }}>boundaries</span>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {BOUNDARY_LEVELS.map((level) => {
            // a file boundary around file leaves is the leaf itself
            const disabled =
              level === "file" && params.granularity !== "symbol";
            return (
              <label
                key={level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={params.boundaries.includes(level)}
                  onInput={(e) => {
                    const on = (e.target as HTMLInputElement).checked;
                    // chain order stays canonical regardless of click order
                    const next = BOUNDARY_LEVELS.filter((l) =>
                      l === level ? on : params.boundaries.includes(l),
                    );
                    set("boundaries", next);
                  }}
                />
                {level}
              </label>
            );
          })}
        </div>
      </div>
      <div style={row}>
        <span style={{ width: "110px" }}>levels</span>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {DISPLAY_LEVELS.map((level) => {
            // visibility per stratum: the partition may still USE a level
            // (boundaries) while this hides its rendering. Disabled when
            // the stratum cannot exist in the current configuration.
            const disabled =
              UNAVAILABLE_LEVELS.has(level) ||
              (level === "directory" &&
                !params.boundaries.includes("directory")) ||
              (level === "file" &&
                params.granularity !== "file" &&
                !(
                  params.granularity === "symbol" &&
                  params.boundaries.includes("file")
                )) ||
              ((level === "symbol" || level === "cfg") &&
                params.granularity === "module");
            return (
              <label
                key={level}
                title={
                  UNAVAILABLE_LEVELS.has(level)
                    ? "fetched dynamically at deep zoom — provider pending"
                    : undefined
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={params.displayLevels.includes(level)}
                  onInput={(e) => {
                    const on = (e.target as HTMLInputElement).checked;
                    const next = DISPLAY_LEVELS.filter((l) =>
                      l === level ? on : params.displayLevels.includes(l),
                    );
                    set("displayLevels", next);
                  }}
                />
                {LEVEL_LABELS[level]}
              </label>
            );
          })}
        </div>
      </div>
      <div style={row}>
        <span style={{ width: "110px" }}>omit</span>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {OMIT_SCOPES.map((scope) => (
            <label
              key={scope}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <input
                type="checkbox"
                checked={params.omit.includes(scope)}
                onInput={(e) => {
                  const on = (e.target as HTMLInputElement).checked;
                  const next = OMIT_SCOPES.filter((s) =>
                    s === scope ? on : params.omit.includes(s),
                  );
                  set("omit", next);
                }}
              />
              {OMIT_LABELS[scope]}
            </label>
          ))}
        </div>
      </div>
      <div style={row}>
        <span style={{ width: "110px", alignSelf: "start" }}>omit modules</span>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            maxHeight: "96px",
            overflowY: "auto",
            flex: "1",
          }}
        >
          {availableModules.map((moduleId) => (
            <label
              key={moduleId}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <input
                type="checkbox"
                checked={params.omitModules.includes(moduleId)}
                onInput={(e) => {
                  const on = (e.target as HTMLInputElement).checked;
                  set(
                    "omitModules",
                    on
                      ? [...params.omitModules, moduleId]
                      : params.omitModules.filter((m) => m !== moduleId),
                  );
                }}
              />
              {moduleId}
            </label>
          ))}
        </div>
      </div>
      {params.boundaries.includes("directory") ? (
        <NumberField
          label="directory depth"
          value={params.directoryDepth}
          min={1}
          max={8}
          step={1}
          onInput={(v) => set("directoryDepth", v)}
        />
      ) : null}
      <label style={row}>
        <span style={{ width: "110px" }}>weight</span>
        <select
          value={params.weight}
          onInput={(e) =>
            set("weight", (e.target as HTMLSelectElement).value as WeightKind)
          }
        >
          <option value="loc">LOC</option>
          <option value="pagerank">PageRank</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>select mode</span>
        <select
          value={params.selectMode}
          onInput={(e) =>
            set(
              "selectMode",
              (e.target as HTMLSelectElement).value as SelectMode,
            )
          }
        >
          <option value="auto">auto (LOD)</option>
          <option value="module">module</option>
          <option value="file">file</option>
          <option value="symbol">symbol</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>auto deselect</span>
        <input
          type="checkbox"
          checked={params.deselectOffscreen}
          onInput={(e) =>
            set("deselectOffscreen", (e.target as HTMLInputElement).checked)
          }
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>follow changes</span>
        <input
          type="checkbox"
          checked={params.followChanges}
          onInput={(e) =>
            set("followChanges", (e.target as HTMLInputElement).checked)
          }
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>diff base</span>
        {/* commits on blur/Enter (native change), not per keystroke —
            each value re-subscribes the diff stream */}
        <input
          type="text"
          value={params.diffBase}
          placeholder="HEAD (dirty)"
          onChange={(e) =>
            set("diffBase", (e.target as HTMLInputElement).value.trim())
          }
          style={{ flex: "1", fontSize: "12px" }}
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>zoom focus</span>
        <select
          value={params.focusGranularity}
          onInput={(e) =>
            set(
              "focusGranularity",
              (e.target as HTMLSelectElement).value as Granularity,
            )
          }
        >
          <option value="module">module</option>
          <option value="file">file</option>
          <option value="symbol">symbol</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>layout</span>
        <select
          value={params.layout}
          onInput={(e) =>
            set("layout", (e.target as HTMLSelectElement).value as LayoutKind)
          }
        >
          <option value="rings">rings (modules)</option>
          <option value="treemap">treemap (bundled)</option>
          <option value="flat">flat (files)</option>
        </select>
      </label>
      {params.layout === "rings" ? (
        <label style={row}>
          <span style={{ width: "110px" }}>invert rings</span>
          <input
            type="checkbox"
            checked={params.invertRings}
            onInput={(e) =>
              set("invertRings", (e.target as HTMLInputElement).checked)
            }
          />
        </label>
      ) : null}
      <label style={row}>
        <span style={{ width: "110px" }}>data</span>
        <select
          value={params.source}
          onInput={(e) =>
            set("source", (e.target as HTMLSelectElement).value as DataSource)
          }
        >
          <option value="synthetic">synthetic</option>
          <option value="sprawlens">sprawlens (this repo)</option>
          <option value="sprawlens-history">sprawlens (git log)</option>
          <option value="playwright">playwright (monorepo)</option>
        </select>
      </label>
      <NumberField
        label={`nodes`}
        value={params.count}
        min={5}
        max={400}
        step={5}
        onInput={(v) => set("count", v)}
      />
      <NumberField
        label="seed"
        value={params.seed}
        min={1}
        max={100}
        step={1}
        onInput={(v) => set("seed", v)}
      />
      <NumberField
        label="adaptationRate"
        value={params.adaptationRate}
        min={0.1}
        max={1.5}
        step={0.05}
        onInput={(v) => set("adaptationRate", v)}
      />
      <NumberField
        label="lloydRate"
        value={params.lloydRate}
        min={0}
        max={1}
        step={0.05}
        onInput={(v) => set("lloydRate", v)}
      />
      <NumberField
        label="steps / frame"
        value={params.stepsPerFrame}
        min={1}
        max={10}
        step={1}
        onInput={(v) => set("stepsPerFrame", v)}
      />
      <label style={row}>
        <span style={{ width: "110px" }}>clip</span>
        <select
          value={params.clipKind}
          onInput={(e) =>
            set("clipKind", (e.target as HTMLSelectElement).value as ClipKind)
          }
        >
          <option value="circle">circle</option>
          <option value="hexadecagon">16-gon</option>
          <option value="rect">rect</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>detail edges</span>
        <input
          type="checkbox"
          checked={params.showEdges}
          onInput={(e) =>
            set("showEdges", (e.target as HTMLInputElement).checked)
          }
        />
      </label>
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
    </div>
  );
}
