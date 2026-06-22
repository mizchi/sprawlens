import { useState } from "preact/hooks";

type Commit = { shortHash: string; message: string };

type Props = {
  commits: readonly Commit[];
  /** Displayed commit (range end when a range is active). */
  index: number;
  range: readonly [number, number] | null;
  /** Plain click — focus one commit (shows its changes on the map). */
  onSelect: (index: number) => void;
  /** Shift-click — select the range from the current commit to this one. */
  onRangeSelect: (anchor: number, index: number) => void;
};

const LANE = "#64748b";
const CURRENT = "#2563eb";
const IN_RANGE = "#ea580c";

/**
 * Vertical Git commit log (newest first): a graph lane of dots beside the
 * commit messages, like a Git client. Click a row to focus that commit — the
 * map shows its changes; shift-click selects a range and highlights everything
 * changed across the span. The horizontal counterpart is HistoryTimeline; both
 * are switchable so the layout can be compared.
 */
export function CommitLog({ commits, index, range, onSelect, onRangeSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const n = commits.length;
  if (n === 0) return null;
  const inRange = (i: number) => range !== null && i >= range[0] && i <= range[1];
  // newest (highest index) at the top
  const order = Array.from({ length: n }, (_, k) => n - 1 - k);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 320,
        maxHeight: "calc(100vh - 90px)",
        display: "flex",
        flexDirection: "column",
        background: "rgba(15, 23, 42, 0.9)",
        color: "#e2e8f0",
        borderRadius: 8,
        boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
        font: "11px/1.4 ui-monospace, monospace",
        zIndex: 30,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          padding: "6px 10px",
          color: "#94a3b8",
          letterSpacing: "0.05em",
          borderBottom: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        <span style={{ width: 34 }}>GRAPH</span>
        <span>COMMIT MESSAGE</span>
      </div>
      <div style={{ overflowY: "auto" }}>
        {order.map((i) => {
          const c = commits[i]!;
          const current = i === index;
          const ranged = inRange(i);
          const dotColor = current ? CURRENT : ranged ? IN_RANGE : LANE;
          return (
            <button
              key={`${c.shortHash}-${i}`}
              type="button"
              data-testid="commit-row"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              onClick={(e) => (e.shiftKey ? onRangeSelect(index, i) : onSelect(i))}
              style={{
                display: "flex",
                alignItems: "stretch",
                width: "100%",
                padding: 0,
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                background: current
                  ? "rgba(37,99,235,0.22)"
                  : ranged
                    ? "rgba(234,88,12,0.14)"
                    : hovered === i
                      ? "rgba(148,163,184,0.12)"
                      : "transparent",
                color: "inherit",
              }}
            >
              {/* graph lane */}
              <span style={{ position: "relative", width: 34, flex: "none" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 16,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: LANE,
                    opacity: 0.5,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 17,
                    top: "50%",
                    width: current ? 11 : 8,
                    height: current ? 11 : 8,
                    borderRadius: "50%",
                    background: current || ranged ? dotColor : "#0f172a",
                    border: `2px solid ${dotColor}`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </span>
              {/* message */}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "5px 8px 5px 2px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${c.shortHash} ${c.message.split("\n")[0]}`}
              >
                <span style={{ color: "#64748b" }}>{c.shortHash}</span>{" "}
                {c.message.split("\n")[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
