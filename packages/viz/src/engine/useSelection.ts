import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export type Edge = { source: string; target: string };

const edgeKey = (e: Edge) => `${e.source} ${e.target}`;

/**
 * The selection state machine: a mixed multi-selection of nodes and edges plus
 * the dependency-path focus root. Renderer-agnostic — it owns only state and
 * the pure transitions a renderer's click events drive; camera framing is left
 * to the host (selecting an edge or jumping to a node composes `focusOnIds`
 * around these primitives). Esc clears everything.
 */
export function useSelection() {
  // ordered ids, last is the primary (drives detail panel, breadcrumb, labels)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // edges are selectable alongside nodes; a selection can hold both
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  // dependency-path extraction root; always tracks the selection
  const [focusId, setFocusId] = useState<string | null>(null);

  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  /** Replace the whole selection with a single node (or clear). */
  const setSelectedId = (id: string | null) => {
    setSelectedEdges([]);
    setSelectedIds(id === null ? [] : [id]);
  };

  /** Move an already-selected id to the end (make it the primary). */
  const promoteToPrimary = (id: string) =>
    setSelectedIds((prev) => [...prev.filter((x) => x !== id), id]);

  /** Drop a single id from the selection. */
  const deselect = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

  /** Node click: shift toggles membership, a plain click replaces. */
  const selectNode = (id: string | null, additive = false) => {
    if (id === null) {
      setSelectedIds([]);
      setSelectedEdges([]);
      setFocusId(null);
      return;
    }
    if (additive) {
      setSelectedIds(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      );
      if (focusId !== null) setFocusId(id);
      return;
    }
    setSelectedEdges([]);
    setSelectedIds([id]);
    if (focusId !== null) setFocusId(id);
  };

  /**
   * Edge click state transition. Shift toggles the edge into the mixed
   * selection; a plain click replaces the selection with it. Returns true when
   * the host should frame the edge's endpoints (plain click only).
   */
  const selectEdgeState = (
    source: string,
    target: string,
    additive = false,
  ): boolean => {
    const edge = { source, target };
    if (additive) {
      setSelectedEdges(
        selectedEdges.some((e) => edgeKey(e) === edgeKey(edge))
          ? selectedEdges.filter((e) => edgeKey(e) !== edgeKey(edge))
          : [...selectedEdges, edge],
      );
      return false;
    }
    setSelectedIds([]);
    setFocusId(null);
    setSelectedEdges([edge]);
    return true;
  };

  // Esc drops the explicit selection (zoom focus takes over again)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds([]);
        setSelectedEdges([]);
        setFocusId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    selectedIds,
    selectedEdges,
    focusId,
    selectedId,
    selectedIdSet,
    selectedIdsRef,
    setFocusId,
    setSelectedId,
    promoteToPrimary,
    deselect,
    selectNode,
    selectEdgeState,
  };
}
