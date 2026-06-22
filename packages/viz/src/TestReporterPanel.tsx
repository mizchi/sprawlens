import { useMemo, useState } from "preact/hooks";
import type { TestCaseResult, TestStatus } from "@sprawlens/schema";

const STATUS_COLOR: Record<TestStatus, string> = {
  pass: "#16a34a",
  fail: "#dc2626",
  skip: "#94a3b8",
  todo: "#d97706",
};
const ORDER: Record<TestStatus, number> = { fail: 0, todo: 1, pass: 2, skip: 3 };

type Props = {
  results: TestCaseResult[];
  activeId: string | null;
  onSelect: (testId: string) => void;
};

/**
 * dot-reporter preview: every test case as a status-coloured dot (failures
 * first so they stand out), with a pass/fail/skip summary. Clicking a dot
 * selects that case on the map, which opens its log panel.
 */
export function TestReporterPanel({ results, activeId, onSelect }: Props) {
  const [failedOnly, setFailedOnly] = useState(false);
  const counts = useMemo(() => {
    const c: Record<TestStatus, number> = { pass: 0, fail: 0, skip: 0, todo: 0 };
    for (const r of results) c[r.status]++;
    return c;
  }, [results]);
  const dots = useMemo(() => {
    const list = failedOnly ? results.filter((r) => r.status === "fail") : results;
    return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }, [results, failedOnly]);

  if (results.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 12,
        width: 240,
        maxHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(15, 23, 42, 0.86)",
        color: "#e2e8f0",
        font: "11px/1.3 ui-monospace, monospace",
        boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
        zIndex: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <strong>tests</strong>
        <span style={{ color: STATUS_COLOR.pass }}>{counts.pass}✓</span>
        <span style={{ color: STATUS_COLOR.fail, fontWeight: counts.fail ? 700 : 400 }}>
          {counts.fail}✗
        </span>
        {counts.skip ? <span style={{ color: STATUS_COLOR.skip }}>{counts.skip}∅</span> : null}
        <button
          type="button"
          onClick={() => setFailedOnly((v) => !v)}
          title="show failures only"
          style={{
            marginLeft: "auto",
            border: "none",
            cursor: "pointer",
            borderRadius: 5,
            padding: "1px 6px",
            fontSize: 10,
            background: failedOnly ? STATUS_COLOR.fail : "#1e293b",
            color: "#e2e8f0",
          }}
        >
          fails
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          overflowY: "auto",
          alignContent: "flex-start",
        }}
      >
        {dots.map((r) => (
          <button
            key={r.testId}
            type="button"
            data-testid="test-dot"
            title={`${r.name ?? r.testId}\n${r.status}${r.durationMs !== undefined ? ` · ${r.durationMs.toFixed(0)}ms` : ""}`}
            onClick={() => onSelect(r.testId)}
            style={{
              width: 11,
              height: 11,
              padding: 0,
              borderRadius: 3,
              cursor: "pointer",
              background: STATUS_COLOR[r.status],
              border: r.testId === activeId ? "2px solid #fff" : "1px solid rgba(0,0,0,0.25)",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
    </div>
  );
}
