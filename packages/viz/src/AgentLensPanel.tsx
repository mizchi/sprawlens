import type { LensNode, LensResult } from "@sprawlens/agent";

type Props = {
  result: LensResult;
  onFocus: (id: string) => void;
};

const ROLE_LABEL: Record<LensNode["role"], string> = {
  target: "target",
  dependent: "upstream",
  dependency: "downstream",
  both: "both",
};

const ROLE_COLOR: Record<LensNode["role"], string> = {
  target: "#2563eb",
  dependent: "#0891b2",
  dependency: "#ea580c",
  both: "#7c3aed",
};

const shortId = (id: string): string => {
  if (id.startsWith("symbol:")) {
    const parts = id.split(":");
    return `${parts[1]?.split("/").pop() ?? parts[1]}:${parts.at(-2) ?? parts.at(-1)}`;
  }
  return id.split("/").pop() ?? id;
};

function signalText(node: LensNode): string {
  const parts: string[] = [];
  if (node.changed) parts.push(node.changed);
  if (node.traceHeat !== undefined) parts.push(`hot ${Math.round(node.traceHeat * 100)}%`);
  if (node.tests?.length) {
    const failing = node.tests.filter((t) => t.status === "fail").length;
    parts.push(
      failing > 0 ? `${failing}/${node.tests.length} failing` : `${node.tests.length} tests`,
    );
  }
  return parts.join(" · ");
}

function LensRows(props: { title: string; nodes: LensNode[]; onFocus: (id: string) => void }) {
  if (props.nodes.length === 0) return null;
  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ fontWeight: "600", fontSize: "11px" }}>
        {props.title} ({props.nodes.length})
      </div>
      {props.nodes.slice(0, 8).map((node) => {
        const signal = signalText(node);
        return (
          <button
            key={node.id}
            onClick={() => props.onFocus(node.id)}
            title={node.id}
            style={{
              display: "block",
              width: "100%",
              padding: "2px 4px",
              fontSize: "11px",
              cursor: "pointer",
              background: "none",
              border: "none",
              color: ROLE_COLOR[node.role],
              textAlign: "left",
            }}
          >
            <span>{node.role === "dependency" ? "→" : node.role === "dependent" ? "←" : "•"}</span>{" "}
            <span>{node.label || shortId(node.id)}</span>
            <span style={{ color: "#94a3b8" }}> · d{node.depth}</span>
            {signal ? <span style={{ color: "#64748b" }}> · {signal}</span> : null}
          </button>
        );
      })}
      {props.nodes.length > 8 ? (
        <div style={{ color: "#94a3b8", fontSize: "11px", padding: "0 4px" }}>
          +{props.nodes.length - 8} more
        </div>
      ) : null}
    </div>
  );
}

export function AgentLensPanel({ result, onFocus }: Props) {
  const target = result.nodes.find((node) => node.role === "target");
  const upstream = result.nodes.filter((node) => node.role === "dependent" || node.role === "both");
  const downstream = result.nodes.filter(
    (node) => node.role === "dependency" || node.role === "both",
  );
  const targetSignal = target ? signalText(target) : "";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ fontWeight: "600" }}>Agent Lens</div>
        <div style={{ color: "#94a3b8", fontSize: "11px" }}>
          {result.level} · {result.edges.length} edges
        </div>
      </div>
      {target ? (
        <button
          onClick={() => onFocus(target.id)}
          title={target.id}
          style={{
            display: "block",
            width: "100%",
            padding: "2px 4px",
            fontSize: "11px",
            cursor: "pointer",
            background: "none",
            border: "none",
            color: ROLE_COLOR.target,
            fontWeight: "600",
            textAlign: "left",
          }}
        >
          {ROLE_LABEL[target.role]}: {target.label || shortId(target.id)}
          {targetSignal ? <span style={{ color: "#64748b" }}> · {targetSignal}</span> : null}
        </button>
      ) : null}
      <LensRows title="referenced by" nodes={upstream} onFocus={onFocus} />
      <LensRows title="references" nodes={downstream} onFocus={onFocus} />
      {result.summary.tests.total > 0 || result.summary.traced > 0 ? (
        <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px" }}>
          trace {result.summary.traced} · tests {result.summary.tests.fail} fail /{" "}
          {result.summary.tests.total} total
        </div>
      ) : null}
    </div>
  );
}
