import type { TraceTimeline } from "@sprawlens/schema";

/** Short label for a symbol id `symbol:<path>:<kind>:<name>:<line>`. */
function labelOf(symbolId: string | null): { name: string; file: string } {
  if (!symbolId) return { name: "(library)", file: "" };
  const parts = symbolId.split(":");
  const name = parts.at(-2) ?? symbolId;
  const path = parts[1] ?? "";
  return { name, file: path.split("/").at(-1) ?? path };
}

type Props = {
  timeline: TraceTimeline;
  cursor: number;
  playing: boolean;
  extractEnabled: boolean;
  extractCount: number;
  mobile?: boolean;
  bottom?: number | string;
  onCursor: (c: number) => void;
  onTogglePlay: () => void;
  onToggleExtract: () => void;
};

/**
 * The trace player: a bottom bar to scrub/play the captured execution timeline.
 * The map's warm-orange overlay is driven by the cursor (see App's
 * projectTimelineCursor), so playing animates the path the program took.
 */
export function TracePlayer({
  timeline,
  cursor,
  playing,
  extractEnabled,
  extractCount,
  mobile = false,
  bottom,
  onCursor,
  onTogglePlay,
  onToggleExtract,
}: Props) {
  const last = timeline.steps.length - 1;
  const step = timeline.steps[Math.min(cursor, last)];
  if (!step) return null;
  const { name, file } = labelOf(step.symbolId);
  const planeColor = step.plane === "server" ? "#0ea5e9" : "#f59e0b";

  return (
    <div
      style={{
        position: "absolute",
        left: mobile ? 8 : "50%",
        right: mobile ? 8 : undefined,
        bottom: bottom ?? (mobile ? "max(8px, env(safe-area-inset-bottom))" : 16),
        transform: mobile ? undefined : "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        flexWrap: mobile ? "wrap" : "nowrap",
        gap: mobile ? 7 : 12,
        padding: mobile ? "7px 8px" : "8px 14px",
        borderRadius: 10,
        background: "rgba(15, 23, 42, 0.86)",
        color: "#e2e8f0",
        font: "12px/1.2 ui-monospace, monospace",
        boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
        zIndex: 30,
        maxWidth: mobile ? undefined : "min(720px, 90vw)",
      }}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        title={playing ? "pause" : "play"}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          background: "#1e293b",
          color: "#e2e8f0",
          fontSize: 13,
        }}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 8,
          background: planeColor,
          flex: "none",
        }}
        title={step.plane}
      />
      <input
        type="range"
        data-testid="trace-scrubber"
        min={0}
        max={last}
        value={Math.min(cursor, last)}
        onInput={(e) => onCursor(Number((e.target as HTMLInputElement).value))}
        style={{
          width: mobile ? undefined : 320,
          flex: mobile ? "1 1 128px" : undefined,
          minWidth: mobile ? 116 : undefined,
          accentColor: "#ff7a1a",
        }}
      />
      <span
        style={{
          minWidth: mobile ? 0 : 220,
          flex: mobile ? "1 1 145px" : undefined,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <strong style={{ color: "#ff9d4d" }}>{name}</strong>
        {file && <span style={{ color: "#94a3b8" }}> · {file}</span>}
      </span>
      <span style={{ color: "#64748b", flex: "none" }}>
        {Math.min(cursor, last) + 1}/{timeline.steps.length}
      </span>
      <button
        type="button"
        onClick={onToggleExtract}
        disabled={extractCount === 0}
        title={extractEnabled ? "show full trace context" : "extract traced symbols"}
        style={{
          padding: "6px 8px",
          borderRadius: 6,
          border: `1px solid ${extractEnabled ? "#ff7a1a" : "#334155"}`,
          cursor: extractCount === 0 ? "default" : "pointer",
          background: extractEnabled ? "rgba(154,52,18,0.88)" : "#1e293b",
          color: extractEnabled ? "#fed7aa" : "#cbd5e1",
          font: mobile ? "10px/1 ui-monospace, monospace" : "11px/1 ui-monospace, monospace",
        }}
      >
        extract {extractEnabled ? "on" : "off"} · {extractCount}
      </button>
    </div>
  );
}
