import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasEdge, AtlasNode, DetailGraph } from "@sprawlens/schema";
import type { CellResult } from "@sprawlens/layout";
import { fetchCallHierarchy, refsToEdges } from "../callHierarchyClient.ts";
import { cfgRequestOf, fetchCfg } from "../cfgClient.ts";
import { type CfgEntry } from "../CfgLayer.tsx";
import type { PlaygroundParams } from "../Controls.tsx";
import type { Granularity } from "../viewConfig.ts";

type Ref<T> = { current: T };

/** Per-symbol on-demand detail, fetched from the provider's `detail` endpoints.
 * Provider-agnostic by design: the viz hits the neutral `/api/call-hierarchy`
 * and `/api/cfg` routes and the server delegates to whatever backs them — the
 * TS LSP today, a tree-sitter static analysis or `moon ide` tomorrow. So this
 * is "symbol detail", not "LSP". */

const DETAIL_CACHE_MAX = 8;
const CFG_MIN_PX = 64;

export type SymbolDetailContext = {
  activeId: string | null;
  selectedIds: string[];
  selectedIdsRef: Ref<string[]>;
  granularity: Granularity;
  visibleLevels: ReadonlySet<string>;
  /** Settled zoom — CFGs only draw once a cell fills enough screen. */
  zoom: number;
  allCells: CellResult[];
  allInnerCells: CellResult[];
  paramsRef: Ref<PlaygroundParams>;
  graphRef: Ref<{ nodes: { id: string }[] }>;
  symbolsRef: Ref<Map<string, AtlasNode[]> | null>;
  displayGraphRef: Ref<{ edges: AtlasEdge[] }>;
  symbolEdgesRef: Ref<AtlasEdge[]>;
  /** Reactive copies that drive effect re-runs (deps). */
  source: PlaygroundParams["source"];
  displayLevels: PlaygroundParams["displayLevels"];
};

export function useSymbolDetail(ctx: SymbolDetailContext) {
  const {
    activeId,
    selectedIds,
    selectedIdsRef,
    granularity,
    visibleLevels,
    zoom,
    allCells,
    allInnerCells,
    paramsRef,
    graphRef,
    symbolsRef,
    displayGraphRef,
    symbolEdgesRef,
    source,
    displayLevels,
  } = ctx;

  // call hierarchy: symbol→symbol caller/callee edges per selected root, a
  // display-only dashed overlay over the static structure. Bounded LRU.
  const fetchedRef = useRef(new Set<string>());
  const detailEdgesRef = useRef(new Map<string, AtlasEdge[]>());
  const [hierarchyVersion, setHierarchyVersion] = useState(0);

  // CFG diagrams per symbol, fetched once a cell fills the screen; failures
  // (no detail backend) cache as null so they aren't retried each frame.
  const cfgCacheRef = useRef(new Map<string, DetailGraph | null | "pending">());
  const [cfgVersion, setCfgVersion] = useState(0);

  /** Clear the caches (call on a cold rebuild — the symbol set changed). */
  const resetDetail = () => {
    fetchedRef.current = new Set();
    detailEdgesRef.current = new Map();
  };

  // fetch the active selection's call hierarchy (static symbolImports only know
  // file→symbol; the detail backend upgrades to real symbol→symbol edges)
  useEffect(() => {
    const id = activeId;
    if (!id || !id.startsWith("symbol:")) return;
    const repo = paramsRef.current.source;
    // history snapshots don't match the working tree the backend sees
    if (repo === "synthetic" || repo === "sprawlens-history") return;
    if (fetchedRef.current.has(id)) return;
    fetchedRef.current.add(id);
    const parts = id.split(":"); // symbol:<path>:<kind>:<name>:<line>
    fetchCallHierarchy(repo, parts[1]!, parts[3]!)
      .then((response) => {
        const symbolsByFile = symbolsRef.current ?? new Map();
        const fileIds = new Set(graphRef.current.nodes.map((n) => n.id));
        detailEdgesRef.current.set(id, refsToEdges(id, response, symbolsByFile, fileIds));
        // bounded cache: evict the oldest roots nobody has selected
        const selected = new Set(selectedIdsRef.current);
        for (const key of detailEdgesRef.current.keys()) {
          if (detailEdgesRef.current.size <= DETAIL_CACHE_MAX) break;
          if (selected.has(key) || key === id) continue;
          detailEdgesRef.current.delete(key);
          fetchedRef.current.delete(key);
        }
        setHierarchyVersion((v) => v + 1);
      })
      .catch(() => {
        // backend not running or transient failure: allow a later retry
        fetchedRef.current.delete(id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // the overlay shown now: hierarchy edges of the active selection, minus
  // anything the static projection already draws solid
  const detailOverlayEdges = (() => {
    const roots = selectedIds.length > 0 ? selectedIds : activeId ? [activeId] : [];
    const out: AtlasEdge[] = [];
    const seen = new Set(
      (granularity === "symbol" ? displayGraphRef.current.edges : symbolEdgesRef.current).map(
        (e) => `${e.source}->${e.target}`,
      ),
    );
    for (const root of roots) {
      for (const edge of detailEdgesRef.current.get(root) ?? []) {
        const key = `${edge.source}->${edge.target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(edge);
      }
    }
    return out;
  })();

  // fetch CFGs for the selected symbols only (full-viewport sweeps were heavy)
  useEffect(() => {
    if (!displayLevels.includes("cfg")) return;
    if (source === "synthetic" || source === "sprawlens-history") return;
    const wanted = new Set(selectedIds);
    if (activeId) wanted.add(activeId);
    for (const id of wanted) {
      if (cfgCacheRef.current.has(id)) continue;
      const request = cfgRequestOf(id);
      if (!request) {
        cfgCacheRef.current.set(id, null);
        continue;
      }
      cfgCacheRef.current.set(id, "pending");
      fetchCfg(source, request.file, request.line).then((graph) => {
        cfgCacheRef.current.set(id, graph);
        if (graph) setCfgVersion((v) => v + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, selectedIds, displayLevels, source]);

  const cfgEntries = useMemo(() => {
    if (!visibleLevels.has("cfg")) return [] as CfgEntry[];
    const wanted = new Set(selectedIds);
    if (activeId) wanted.add(activeId);
    const cells = granularity === "symbol" ? allCells : allInnerCells;
    const out: CfgEntry[] = [];
    for (const cell of cells) {
      if (!wanted.has(cell.id)) continue;
      if (cell.polygon.length < 3) continue;
      if (Math.sqrt(cell.actualArea) * zoom < CFG_MIN_PX) continue;
      const graph = cfgCacheRef.current.get(cell.id);
      if (!graph || graph === "pending") continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const p of cell.polygon) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      out.push({ id: cell.id, x0, y0, x1, y1, polygon: cell.polygon, graph });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allCells,
    allInnerCells,
    zoom,
    cfgVersion,
    visibleLevels,
    granularity,
    activeId,
    selectedIds,
  ]);

  /** Cached call-hierarchy edges for one root (for the detail panel). */
  const detailEdgesOf = (id: string): AtlasEdge[] => detailEdgesRef.current.get(id) ?? [];

  return {
    detailOverlayEdges,
    cfgEntries,
    hierarchyVersion,
    resetDetail,
    detailEdgesOf,
  };
}
