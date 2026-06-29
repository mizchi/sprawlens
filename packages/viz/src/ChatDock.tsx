import { useRef, useState } from "preact/hooks";
import type { ViewState } from "@sprawlens/agent";
import { INK, MUTED_INK, PANEL_BG, PANEL_BORDER, SELECT_STROKE } from "./mapShared.tsx";

/**
 * Bottom chat dock: type a question, the server (/api/chat) drives the agent
 * tools to answer and to steer the map, and we apply the returned ViewState to
 * the live view. Steps (the tool calls it made) are shown under each reply.
 */
type Step = { tool: string; summary: string };
type Msg = { role: "user" | "assistant"; text: string; steps?: Step[] };
type ChatResponse = { reply: string; view: ViewState; steps: Step[] };

export function ChatDock(props: {
  /** Snapshot of the current view, sent as context with each message. */
  view: () => ViewState;
  /** Apply the agent's returned view to the live map. */
  onApplyView: (view: ViewState) => void;
}): preact.JSX.Element {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    scrollDown();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, view: props.view() }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as ChatResponse;
      setMessages((m) => [...m, { role: "assistant", text: data.reply, steps: data.steps }]);
      props.onApplyView(data.view);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `⚠ ${error instanceof Error ? error.message : "chat failed"}` },
      ]);
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        fontFamily: "ui-monospace, monospace",
        fontSize: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "absolute",
          right: "12px",
          bottom: open ? "auto" : "8px",
          top: open ? "-30px" : "auto",
          padding: "4px 10px",
          background: PANEL_BG,
          color: INK,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        {open ? "▾ chat" : "💬 ask"}
      </button>
      {open ? (
        <div
          style={{
            background: PANEL_BG,
            borderTop: `1px solid ${PANEL_BORDER}`,
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "44vh",
          }}
        >
          <div ref={listRef} style={{ overflowY: "auto", padding: "10px 12px", flex: 1 }}>
            {messages.length === 0 ? (
              <div style={{ color: MUTED_INK }}>
                Ask about the codebase — e.g. “what depends on packages/layout?”, “show me the
                cycles”, “focus packages/cli”.
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: "10px" }}>
                <span style={{ color: m.role === "user" ? SELECT_STROKE : MUTED_INK }}>
                  {m.role === "user" ? "you" : "map"}
                </span>
                <div style={{ color: INK, whiteSpace: "pre-wrap" }}>{m.text}</div>
                {m.steps && m.steps.length > 0 ? (
                  <div style={{ color: MUTED_INK, marginTop: "3px" }}>
                    {m.steps.map((s, j) => (
                      <div key={j}>
                        · {s.tool}: {s.summary}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <div style={{ color: MUTED_INK }}>…thinking</div> : null}
          </div>
          <div
            style={{
              display: "flex",
              gap: "6px",
              padding: "8px 12px",
              borderTop: `1px solid ${PANEL_BORDER}`,
            }}
          >
            <input
              value={input}
              disabled={busy}
              autocomplete="off"
              placeholder="Ask the map…"
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              style={{
                flex: 1,
                background: "transparent",
                color: INK,
                border: `1px solid ${PANEL_BORDER}`,
                borderRadius: "6px",
                padding: "6px 8px",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              style={{
                background: SELECT_STROKE,
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                cursor: busy ? "default" : "pointer",
              }}
            >
              send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
