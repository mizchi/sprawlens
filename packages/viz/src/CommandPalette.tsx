import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasNodeKind } from "@sprawlens/schema";
import { searchNodesFuzzy, type SearchNode } from "./nodeSearch.ts";

/** Short kind tag shown next to each result. */
const KIND_TAG: Partial<Record<AtlasNodeKind, string>> = {
  service: "svc",
  module: "mod",
  directory: "dir",
  file: "file",
  class: "class",
  symbol: "sym",
  block: "blk",
};

/** Debounce (ms) before a navigated result flies the camera — keeps fast
 * arrowing / typing from spamming flight requests. */
const PREVIEW_DEBOUNCE_MS = 70;

/**
 * Raycast-style command palette: type to fuzzy-filter the node list, arrow /
 * hover to fly the camera to a result (preview, no selection), Enter to commit
 * (select + keep the zoom), Escape to cancel (the host restores the camera).
 * Presentational + local nav state only; search, camera, and selection are
 * injected by the host so this stays renderer-agnostic and testable.
 */
export function CommandPalette(props: {
  open: boolean;
  /** Searchable node universe (stable identity per open, so per-keystroke
   * filtering doesn't churn). */
  nodes: readonly SearchNode[];
  onPreview: (id: string) => void;
  onCommit: (id: string) => void;
  onClose: () => void;
}) {
  const { open, nodes, onPreview, onCommit, onClose } = props;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // refs so the preview effect can stay keyed on the active id alone — the
  // host re-renders constantly (camera settles, frame ticks) and inline
  // callbacks change identity every render
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  const results = useMemo(() => (open ? searchNodesFuzzy(query, nodes) : []), [open, query, nodes]);

  // a fresh open starts blank and focused
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  // keep the active index in range as results shrink
  const activeIndex = results.length === 0 ? -1 : Math.min(active, results.length - 1);
  const activeId = activeIndex < 0 ? undefined : results[activeIndex]?.id;

  // fly the camera to the active result (debounced). Keyed on the id string so
  // the host's frequent re-renders don't perpetually reset the debounce timer.
  useEffect(() => {
    if (!open || activeId === undefined) return;
    const t = setTimeout(() => onPreviewRef.current(activeId), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [open, activeId]);

  // scroll the active row into view as it moves
  useEffect(() => {
    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const commit = (index: number) => {
    const id = results[index]?.id;
    if (id !== undefined) onCommit(id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // swallow every key so map shortcuts don't fire while typing
    e.stopPropagation();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) =>
        results.length === 0 ? 0 : (Math.min(a, results.length - 1) + 1) % results.length,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) =>
        results.length === 0
          ? 0
          : (Math.min(a, results.length - 1) + results.length - 1) % results.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        // barely tint the surround so the map (and the camera preview) stay legible
        background: "rgba(2, 6, 23, 0.1)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: "11vh",
          width: "min(560px, 92vw)",
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          // translucent + frosted: the map reads through so the auto-preview is
          // visible behind the palette, while the blur keeps text legible
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          color: "#e2e8f0",
          borderRadius: 12,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.45)",
          overflow: "hidden",
          font: "13px/1.5 ui-monospace, monospace",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          placeholder="Jump to module / file / symbol…"
          // suppress the browser's autofill / autocomplete dropdown, which
          // otherwise floats a suggestion chip over the result list
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck={false}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          style={{
            border: "none",
            borderBottom: "1px solid #334155",
            background: "transparent",
            color: "#e2e8f0",
            font: "14px/1.6 ui-monospace, monospace",
            padding: "12px 16px",
            outline: "none",
          }}
        />
        <div ref={listRef} style={{ overflowY: "auto" }}>
          {results.length === 0 ? (
            <div style={{ padding: "12px 16px", color: "#64748b" }}>
              {query.trim() ? "No matches" : "Type to search"}
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.id}
                // mousemove (not mouseenter): only a real cursor move grabs a
                // row — otherwise a row rendering under a parked cursor while
                // you type would steal the selection from the top match
                onMouseMove={() => setActive(i)}
                onClick={() => commit(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  cursor: "pointer",
                  background: i === activeIndex ? "#1d4ed8" : "transparent",
                }}
              >
                <span
                  style={{
                    flex: "none",
                    minWidth: 38,
                    textAlign: "center",
                    fontSize: 10,
                    color: i === activeIndex ? "#dbeafe" : "#64748b",
                    border: `1px solid ${i === activeIndex ? "#3b82f6" : "#334155"}`,
                    borderRadius: 5,
                    padding: "1px 4px",
                  }}
                >
                  {KIND_TAG[r.kind] ?? r.kind}
                </span>
                <span style={{ flex: "none", color: "#e2e8f0" }}>{r.label}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    color: i === activeIndex ? "#bfdbfe" : "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    direction: "rtl",
                    maxWidth: "50%",
                  }}
                >
                  {r.id}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
