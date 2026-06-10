export type ClipKind = "rect" | "circle" | "hexadecagon";
export type DataSource = "synthetic" | "sprawlens";

export type PlaygroundParams = {
  source: DataSource;
  count: number;
  seed: number;
  clipKind: ClipKind;
  adaptationRate: number;
  lloydRate: number;
  stepsPerFrame: number;
  showEdges: boolean;
  showNested: boolean;
};

type Props = {
  params: PlaygroundParams;
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
  const { params, onChange } = props;
  const set = <K extends keyof PlaygroundParams>(
    key: K,
    value: PlaygroundParams[K],
  ) => onChange({ ...params, [key]: value });
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
        <span style={{ width: "110px" }}>edges</span>
        <input
          type="checkbox"
          checked={params.showEdges}
          onInput={(e) =>
            set("showEdges", (e.target as HTMLInputElement).checked)
          }
        />
      </label>
      <label style={row}>
        <span style={{ width: "110px" }}>nested symbols</span>
        <input
          type="checkbox"
          checked={params.showNested}
          onInput={(e) =>
            set("showNested", (e.target as HTMLInputElement).checked)
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
