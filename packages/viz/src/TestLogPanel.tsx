import type { TestCaseResult } from "@sprawlens/schema";

const STATUS_COLOR: Record<string, string> = {
  pass: "#16a34a",
  fail: "#dc2626",
  skip: "#94a3b8",
  todo: "#d97706",
};

/**
 * Selection panel for a test case: a status badge + duration, the failure
 * message (assertion diff / stack), and the captured run output (stdout/stderr
 * from click-to-run), each in a terminal-style block. Shown when a test cell is
 * selected and a run result exists for it.
 */
export function TestLogPanel({ result }: { result: TestCaseResult }) {
  const color = STATUS_COLOR[result.status] ?? "#94a3b8";
  return (
    <div style={{ marginTop: "8px", fontSize: "11px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            padding: "1px 7px",
            borderRadius: "999px",
            background: color,
            color: "#fff",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {result.status}
        </span>
        {result.durationMs !== undefined ? (
          <span style={{ color: "#64748b" }}>{result.durationMs.toFixed(0)} ms</span>
        ) : null}
      </div>
      {result.message ? <LogBlock title="failure" body={result.message} tint="#dc2626" /> : null}
      {result.output ? <LogBlock title="output" body={result.output} tint="#475569" /> : null}
      {!result.message && !result.output ? (
        <div style={{ marginTop: "6px", color: "#94a3b8" }}>
          no output captured — double-click the cell to re-run and capture it
        </div>
      ) : null}
    </div>
  );
}

function LogBlock({ title, body, tint }: { title: string; body: string; tint: string }) {
  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ color: tint, fontWeight: 600, marginBottom: "2px" }}>{title}</div>
      <pre
        style={{
          margin: 0,
          maxHeight: "26vh",
          overflow: "auto",
          padding: "6px 8px",
          borderRadius: "6px",
          background: "#0f172a",
          color: "#e2e8f0",
          font: "11px/1.45 ui-monospace, Menlo, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {body}
      </pre>
    </div>
  );
}
