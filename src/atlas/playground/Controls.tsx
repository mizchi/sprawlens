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

export type DataSource =
  | "synthetic"
  | "sprawlens"
  | "sprawlens-history"
  | "playwright";
export type LayoutKind = "rings" | "treemap";

/** Affine tilt that lays the map flat as a stacked-plane view. `pitch` drives
 * the vertical squash (cos(pitch)); `theta` rotates the plane in-plane. The
 * planes stay axis-aligned rectangles — the user tilts them with the mouse
 * (alt+drag) rather than a baked-in parallelogram lean. Radians. */
export type TiltParams = {
  enabled: boolean;
  theta: number;
  pitch: number;
  /** Show the Tests plane below the source plane (drops tests off source). */
  tests: boolean;
  /** Show the Deps plane: external packages below their importers. */
  deps: boolean;
  /** Vertical separation between stacked planes, in world units. */
  gap: number;
};

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
  /** Dark map + chrome; defaults to the system preference. */
  dark: boolean;
  /** Stacked-plane tilt; off keeps the flat top-down view. */
  tilt: TiltParams;
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

/** The data-source picker is a dev / demo affordance: shown only on localhost
 * and the GitHub Pages demo, hidden in any embedded / production use. */
const SHOW_DATA_PICKER =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.endsWith("github.io"));

export function Controls(props: Props) {
  const { params, onChange } = props;
  const set = <K extends keyof PlaygroundParams>(
    key: K,
    value: PlaygroundParams[K],
  ) => onChange({ ...params, [key]: value });
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