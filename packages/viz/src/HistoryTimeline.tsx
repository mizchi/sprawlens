import { useState } from "preact/hooks";

type TimelineCommit = { shortHash: string; message: string };

type Props = {
  commits: readonly TimelineCommit[];
  /** Index of the displayed commit (the range end when a range is active). */
  index: number;
  /** Inclusive [a,b] range selection, or null. */
  range: readonly [number, number] | null;
  /** Plain click — show one commit. */
  onSelect: (index: number) => void;
  /** Shift-click — select the range from the current commit to this one. */
  onRangeSelect: (anchor: number, index: number) => void;
};

const AXIS = "#94a3b8";
const CURRENT = "#1d4ed8";
const IN_RANGE = "#ea580c";

/**
 * Commit-history timeline: one evenly-spaced lollipop per commit (so the width
 * is stable regardless of message length). Hover shows the commit message;
 * shift-click selects a range from the current commit, which the map highlights
 * with every node changed across the span.
 */
export function HistoryTimeline({ commits, index, range, onSelect, onRangeSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const n = commits.length;
  if (n === 0) return null;
  const inRange = (i: number) => range !== null && i >= range[0] && i <= range[1];
  const show = hovered ?? index;
  const hc = commits[show];

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 120, height: 48 }}>
      {/* message readout for the hovered (or current) commit */}
      {hc ? (
        <div
          style={{
            position: "absolute",
            left: `${((show + 0.5) / n) * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
            maxWidth: "min(60%, 420px)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            fontSize: 11,
          }}
        >
          <b>{hc.shortHash}</b> {hc.message.split("\n")[0]}
        </div>
      ) : null}
      {/* axis */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 6,
          height: 0,
          borderTop: `1px solid ${AXIS}`,
        }}
      />
      {/* lollipops, one flex cell each → even spacing */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end" }}>
        {commits.map((c, i) => {
          const current = i === index;
          const ranged = inRange(i);
          const stick = current ? CURRENT : ranged ? IN_RANGE : AXIS;
          return (
            <button
              key={`${c.shortHash}-${i}`}
              type="button"
              data-testid="commit-marker"
              title={`${c.shortHash} ${c.message.split("\n")[0]}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              onClick={(e) => (e.shiftKey ? onRangeSelect(index, i) : onSelect(i))}
              style={{
                flex: 1,
                height: "100%",
                position: "relative",
                padding: 0,
                border: "none",
                background: ranged ? "rgba(234,88,12,0.12)" : "transparent",
                cursor: "pointer",
              }}
            >
              {/* stick */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 6,
                  width: current ? 2 : 1,
                  height: 22,
                  background: stick,
                  transform: "translateX(-50%)",
                }}
              />
              {/* head */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 24,
                  width: current ? 11 : 8,
                  height: current ? 11 : 8,
                  borderRadius: "50%",
                  background: current || ranged ? stick : "#f8fafc",
                  border: `1.5px solid ${stick}`,
                  transform: "translateX(-50%)",
                  boxShadow: hovered === i ? `0 0 0 3px ${stick}33` : "none",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
