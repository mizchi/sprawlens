import type { VizCommand } from "./vizCommands.ts";

/**
 * Keybinding cheat-sheet, derived from the command registry so it never drifts
 * from the actual bindings. Opened with `?`, closed with `?`/Escape or a click
 * outside.
 */
export function HelpModal({
  commands,
  open,
  onClose,
}: {
  commands: readonly VizCommand[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const bound = commands.filter((c) => c.keys && c.keys.length > 0);
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "rgba(2, 6, 23, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "rgba(15, 23, 42, 0.97)",
          color: "#e2e8f0",
          borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          font: "12px/1.5 ui-monospace, monospace",
          padding: "16px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ fontSize: 13 }}>Keyboard shortcuts</strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {bound.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: "3px 8px 3px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  {c.keys!.map((k) => (
                    <kbd
                      key={k}
                      style={{
                        display: "inline-block",
                        minWidth: 16,
                        textAlign: "center",
                        padding: "1px 6px",
                        marginRight: 4,
                        borderRadius: 5,
                        background: "#334155",
                        border: "1px solid #475569",
                      }}
                    >
                      {k === " " ? "space" : k}
                    </kbd>
                  ))}
                </td>
                <td style={{ padding: "3px 0", color: "#cbd5e1" }}>{c.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, color: "#64748b" }}>
          The same operations are exposed to in-page LLM agents as WebMCP tools.
        </div>
      </div>
    </div>
  );
}
