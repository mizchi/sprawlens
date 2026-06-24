import type { TraceMeta } from "@sprawlens/schema";

type Props = {
  traces: TraceMeta[];
  activeId: string | null;
  /** true while the newest capture is auto-followed; false once the user pins one */
  following: boolean;
  onSelect: (id: string) => void;
};

/**
 * Recent-traces picker for the trace player: a compact dropdown of the last N
 * captures (newest first), wired to the player's timeline. Sits just above the
 * player bar. A "live" dot shows when the newest capture is auto-followed; the
 * dot goes quiet once the user pins an older entry. Hidden when no capture has
 * arrived (the baked self-timeline still drives the player in that case).
 */
export function TraceRecentPicker({ traces, activeId, following, onSelect }: Props) {
  if (traces.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 60,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 8,
        background: "rgba(15, 23, 42, 0.86)",
        color: "#e2e8f0",
        font: "11px/1.2 ui-monospace, monospace",
        boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
        zIndex: 30,
      }}
    >
      <span style={{ color: "#94a3b8" }}>recent</span>
      <select
        data-testid="trace-recent-picker"
        value={activeId ?? ""}
        onChange={(e) => onSelect((e.target as HTMLSelectElement).value)}
        style={{
          background: "#1e293b",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 6,
          padding: "3px 6px",
          font: "inherit",
          maxWidth: 320,
        }}
      >
        {traces.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} · {t.stepCount} steps
          </option>
        ))}
      </select>
      <span
        title={following ? "following the newest capture" : "pinned"}
        style={{ color: following ? "#22c55e" : "#64748b", flex: "none" }}
      >
        {following ? "● live" : "○ pinned"}
      </span>
    </div>
  );
}
