import {
  BOUNDARY_LEVELS,
  DISPLAY_LEVELS,
  granularityOf,
  OMIT_SCOPES,
  presetConfig,
  presetOf,
  UNAVAILABLE_LEVELS,
  VIEW_PRESETS,
  type BoundaryLevel,
  type DisplayLevel,
  type OmitScope,
  type ViewConfig,
  type WeightKind,
} from "./viewConfig.ts";

export type DataSource =
  | "synthetic"
  | "sprawlens"
  | "sprawlens-history"
  | "playwright";
export type LayoutKind = "rings" | "treemap";

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
  /** Fly the camera to files as their working-tree changes appear. */
  followChanges: boolean;
  /** Diff comparison base (no UI yet; git tooling will own this). */
  diffBase: string;
  showEdges: boolean;
};

type Props = {
  params: PlaygroundParams;
  /** Top-level scopes present in the loaded graph. */
  availableScopes: string[];
  /** Experiment helpers (graph mutation buttons) show only when set. */
  debug?: boolean;
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

const INCLUDE_LABELS: Record<OmitScope, string> = {
  test: "test",
  local: "local",
};

export function Controls(props: Props) {
  const { params, availableScopes, onChange } = props;
  const set = <K extends keyof PlaygroundParams>(
    key: K,
    value: PlaygroundParams[K],
  ) => onChange({ ...params, [key]: value });
  const granularity = granularityOf(params.displayLevels);
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
          onInput={(e) =>
            set("layout", (e.target as HTMLSelectElement).value as LayoutKind)
          }
        >
          <option value="rings">rings (modules)</option>
          <option value="treemap">treemap (bundled)</option>
        </select>
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>weight</span>
        <select
          value={params.weight}
          onInput={(e) =>
            set("weight", (e.target as HTMLSelectElement).value as WeightKind)
          }
        >
          <option value="loc">LOC</option>
          <option value="complexity">complexity (deps)</option>
        </select>
      </label>
      <div style={row}>
        <span style={{ width: "110px" }}>boundaries</span>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {BOUNDARY_LEVELS.map((level) => {
            // a file boundary around file leaves is the leaf itself
            const disabled = level === "file" && granularity !== "symbol";
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
            // the checked set decides the leaf unit (granularityOf):
            // files nest symbols when both show, symbols alone form the
            // network. CFG needs symbols to exist somewhere.
            const disabled =
              UNAVAILABLE_LEVELS.has(level) ||
              (level === "directory" &&
                !params.boundaries.includes("directory")) ||
              (level === "cfg" && granularity === "module");
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
      {/* checked = shown; the state stays an exclusion set so new
          scopes default to included */}
      <div style={row}>
        <span style={{ width: "110px", alignSelf: "start" }}>include</span>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            maxHeight: "120px",
            overflowY: "auto",
            flex: "1",
          }}
        >
          {OMIT_SCOPES.map((scope) => (
            <label
              key={scope}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <input
                type="checkbox"
                checked={!params.omit.includes(scope)}
                onInput={(e) => {
                  const shown = (e.target as HTMLInputElement).checked;
                  const next = OMIT_SCOPES.filter((s) =>
                    s === scope ? !shown : params.omit.includes(s),
                  );
                  set("omit", next);
                }}
              />
              {INCLUDE_LABELS[scope]}
            </label>
          ))}
          {availableScopes.map((scope) => (
            <label
              key={scope}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <input
                type="checkbox"
                checked={!params.omitModules.includes(scope)}
                onInput={(e) => {
                  const shown = (e.target as HTMLInputElement).checked;
                  set(
                    "omitModules",
                    shown
                      ? params.omitModules.filter((m) => m !== scope)
                      : [...params.omitModules, scope],
                  );
                }}
              />
              {scope}
            </label>
          ))}
        </div>
      </div>
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
        <span style={{ width: "110px" }}>detail edges</span>
        <input
          type="checkbox"
          checked={params.showEdges}
          onInput={(e) =>
            set("showEdges", (e.target as HTMLInputElement).checked)
          }
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