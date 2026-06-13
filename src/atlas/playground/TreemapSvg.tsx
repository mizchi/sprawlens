import { useMemo, useRef, useState } from "preact/hooks";
import type { AtlasEdge, SymbolKind } from "../contracts/graph.js";
import { isStaticKind, SymbolTag, symbolGlyphOf } from "./symbolIcons.tsx";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import { CfgLayer, cfgAnchorsOf, type CfgEntry } from "./CfgLayer.tsx";
import {
  ACTIVE_EDGE,
  BUNDLE_STRENGTH,
  districtFill,
  districtLabelFill,
  districtStroke,
  DOWNSTREAM_COLOR,
  ExitPreviewsLayer,
  EXPORTED_LABEL,
  FILE_LABEL_INK,
  INTERNAL_LABEL,
  LEAF_STROKE,
  LEAF_BORDER_MIN_PX,
  makeEdgeBundler,
  SYMBOL_DOMINANT_FRACTION,
  SYMBOL_KIND_COLORS,
  SYMBOL_STROKE,
  SYMBOL_ZOOM,
  selectionDirections,
  focusDimOf,
  InnerLevelsLayer,
  isWatermarkSized,
  leafFillOf,
  makeTopAncestorOf,
  RaisedEdgePath,
  SELECT_STROKE,
  UPSTREAM_COLOR,
  WatermarkLabelsLayer,
} from "./mapShared.tsx";
import { symbolNameOf } from "./cfgClient.ts";
import {
  EDGE_PICK_DOMINANCE,
  EDGE_PICK_NODE_PX,
  EDGE_PICK_PX,
  pickEdgeAtPoint,
  type EdgePickCandidate,
} from "./edgePick.ts";
import { cellInView, segmentInView } from "./viewCulling.ts";
import type { TreemapState } from "./treemapController.js";
import {
  useMapViewport,
  type FocusRequest,
  type FocusView,
} from "./useMapViewport.ts";

type Props = {
  state: TreemapState;
  fileEdges: AtlasEdge[];
  showEdges: boolean;
  /** Hierarchy-path bundling strength: 1 = fully bundled, 0 = straight. */
  bundleStrength?: number;
  labels?: Map<string, string>;
  changedFiles?: Map<string, "added" | "modified">;
  cyclicIds?: Set<string>;
  /** File ids on the test layer; rendered with the shared muted fill. */
  testFileIds?: Set<string>;
  /** Nested symbol layouts inside the file cells (file granularity). */
  innerCells?: CellResult[];
  exportedIds?: Set<string>;
  /** Symbol declaration kind per id, for the zoomed-in classification icons. */
  symbolKindOf?: (id: string) => SymbolKind | undefined;
  /** Symbol id → parent file id, for label gating. */
  parentFileOf?: (id: string) => string;
  /** Dependency-path extraction: members stay lit, everything else dims. */
  focus?: FocusView | null;
  /** Stratum visibility by level kind: the partition still uses hidden
   * levels (placement, confinement), they just don't draw. */
  visibleLevels?: ReadonlySet<string>;
  /** Kind of the leaf cells ("file" or "symbol"). */
  leafKind?: string;
  /** Dynamic CFG diagrams hosted by symbol cells (zoom-gated). */
  cfgEntries?: CfgEntry[];
  width: number;
  height: number;
  selectedId: string | null;
  selectedIds?: Set<string>;
  /** Picked dependency edges (proximity click); raised above the map. */
  selectedEdges?: { source: string; target: string }[];
  onSelect: (id: string | null, additive?: boolean) => void;
  /** Pick the dependency edge nearest a background click; shift adds it to
   * the multi-selection. */
  onSelectEdge?: (source: string, target: string, additive?: boolean) => void;
  /** Fly the camera to an element (off-screen dependency name click). */
  onFocusId?: (id: string) => void;
  focusRequest?: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
};

/** Cells smaller than this on screen are not worth a polygon. */
const MIN_CELL_PX = 2.5;
/** Edges shorter than this on screen are sub-pixel noise. */
const MIN_EDGE_PX = 6;
/** Symbol cells at least this big on screen show their classification tag. */
const SYMBOL_ICON_MIN_PX = 26;
/** Class members stay collapsed until their cell is this big on screen. */
const MEMBER_TAG_MIN_PX = 55;

export function TreemapSvg(props: Props) {
  const { state, width, height, selectedId, onSelect } = props;
  const multiSelected = props.selectedIds ?? new Set<string>();
  const isSelected = (id: string): boolean =>
    id === selectedId || multiSelected.has(id);
  const cyclicIds = props.cyclicIds ?? new Set<string>();
  const focus = props.focus ?? null;
  const bundleStrength = props.bundleStrength ?? BUNDLE_STRENGTH;

  const levelVisible = (kind: string): boolean =>
    props.visibleLevels?.has(kind) ?? true;
  const leafVisible = levelVisible(props.leafKind ?? "file");
  const onSelectEdge = props.onSelectEdge;
  const selectedEdges = props.selectedEdges ?? [];
  const isSelectedEdge = (s: string, t: string) =>
    selectedEdges.some((e) => e.source === s && e.target === t);
  const pickEdgeRef = useRef<(x: number, y: number, shift: boolean) => boolean>(
    () => false,
  );
  const hoverEdgeRef = useRef<(x: number, y: number) => void>(() => {});
  const { svgProps, zoom, committedView, clientToWorld, toViewScale } =
    useMapViewport({
      width,
      height,
      focusRequest: props.focusRequest,
      onViewSettle: props.onViewSettle,
      onPickEdge: (x, y, shift) => pickEdgeRef.current(x, y, shift),
      onHover: (x, y) => hoverEdgeRef.current(x, y),
    });
  const [hoveredEdge, setHoveredEdge] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const hoveredEdgeRef = useRef<{ source: string; target: string } | null>(null);

  const topCells = state.levels[0]!.cells;
  const innerLevels = state.levels.slice(1);
  const fileCells = useMemo(
    () => [...state.leafLayouts.values()].flatMap((l) => l.cells),
    [state],
  );
  const positionOf = useMemo(() => {
    const map = new Map<string, Vec2>();
    // every boundary level contributes bundling control points
    for (const level of state.levels) {
      for (const [id, cell] of level.cells) map.set(id, cell.site);
    }
    for (const cell of fileCells) map.set(cell.id, cell.site);
    return map;
  }, [state, fileCells]);
  const parentModuleOf = (id: string): string | null =>
    state.parentOf.get(id) ?? null;
  const topAncestorOf = makeTopAncestorOf(state.parentOf, (id) =>
    topCells.has(id),
  );

  // displayed CFGs re-anchor reference edges: incoming at the entry
  // terminal, outgoing at the step block that makes the call
  const cfgAnchors = useMemo(
    () => cfgAnchorsOf(props.cfgEntries ?? []),
    [props.cfgEntries],
  );
  const bundleOf = useMemo(
    () =>
      makeEdgeBundler({
        parentOf: state.parentOf,
        positionOf,
        strength: bundleStrength,
        span: Math.hypot(width, height),
        cfgAnchors,
      }),
    [state.parentOf, positionOf, bundleStrength, cfgAnchors, width, height],
  );

  // viewport culling, shared with rings: at monorepo scale most of the
  // cost is cells and edges that sit entirely off-screen. The committed
  // view rect (post zoom/pan) decides visibility; slack keeps partially
  // visible geometry alive so panning never reveals an empty margin.
  const edgeSlack = committedView.w * 0.1;
  const edgeInView = (edge: AtlasEdge): boolean => {
    const a = positionOf.get(edge.source);
    const b = positionOf.get(edge.target);
    return a != null && b != null && segmentInView(a, b, committedView, edgeSlack);
  };

  const bundled = useMemo(() => {
    if (!props.showEdges || focus) return [];
    return props.fileEdges.flatMap((edge) => {
      if (!edgeInView(edge)) return [];
      const b = bundleOf(edge);
      return b ? [b] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fileEdges, props.showEdges, focus, state, positionOf, bundleStrength, cfgAnchors, committedView]);

  // proximity edge picking: a background click selects the nearest visible
  // dependency edge, resolving overlaps by distance, not paint order (shared
  // with the rings layout via edgePick)

  // extraction mode: only the focused paths render, in direction colors
  const focusBundles = useMemo(() => {
    if (!focus) return [];
    return (
      [
        [focus.downstreamEdges, DOWNSTREAM_COLOR],
        [focus.upstreamEdges, UPSTREAM_COLOR],
      ] as const
    ).flatMap(([edges, color]) =>
      edges.flatMap((edge) => {
        const b = bundleOf(edge);
        return b ? [{ ...b, color }] : [];
      }),
    );
  }, [focus, state, positionOf, bundleStrength, cfgAnchors]);

  const dim = focusDimOf(focus);
  const moduleOpacity = dim.module;
  const fileOpacity = dim.leaf;

  // selection split: what the selection depends on vs what depends on it,
  // drawn regardless of the ambient-edges toggle (same as rings)
  const noSelection = selectedId === null && multiSelected.size === 0;
  const directions = useMemo(
    () =>
      selectionDirections({
        edges: noSelection || focus ? [] : props.fileEdges,
        isSelected,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.fileEdges, selectedId, multiSelected, noSelection, focus],
  );

  // grabbable edges are the *prominent* ones — the lit selection/focus
  // dependencies — not the faint ambient mesh, which would steal clicks from
  // the cells beneath it.
  const candidates: EdgePickCandidate[] = useMemo(() => {
    const out: EdgePickCandidate[] = [];
    if (focus) {
      for (const fb of focusBundles) {
        out.push({ source: fb.source, target: fb.target, points: fb.points });
      }
    } else {
      for (const edge of [...directions.outgoing, ...directions.incoming]) {
        const bundle = bundleOf(edge);
        if (bundle) {
          out.push({
            source: edge.source,
            target: edge.target,
            points: bundle.points,
          });
        }
      }
    }
    return out;
  }, [focus, focusBundles, directions, bundleOf]);
  const resolveEdgeAt = (
    clientX: number,
    clientY: number,
  ): { source: string; target: string } | null => {
    // tighter radius when the cursor is over a node shape (districts tile the
    // plane), wider over empty canvas — keeps cells selectable while edges
    // crossing them stay catchable right on the line
    const el = document.elementFromPoint(clientX, clientY);
    const tag = el?.tagName?.toLowerCase();
    const px =
      tag === "circle" || tag === "polygon" ? EDGE_PICK_NODE_PX : EDGE_PICK_PX;
    const hit = pickEdgeAtPoint(
      clientToWorld,
      clientX,
      clientY,
      candidates,
      px * toViewScale(),
      EDGE_PICK_DOMINANCE,
    );
    return hit ? { source: hit.source, target: hit.target } : null;
  };
  pickEdgeRef.current = (clientX, clientY, shift) => {
    if (!onSelectEdge) return false;
    const hit = resolveEdgeAt(clientX, clientY);
    if (!hit) return false;
    onSelectEdge(hit.source, hit.target, shift);
    return true;
  };
  // hover preview: surface the edge a click would pick (and a pointer cursor)
  hoverEdgeRef.current = (clientX, clientY) => {
    const next = onSelectEdge ? resolveEdgeAt(clientX, clientY) : null;
    const cur = hoveredEdgeRef.current;
    if (cur?.source !== next?.source || cur?.target !== next?.target) {
      hoveredEdgeRef.current = next;
      setHoveredEdge(next);
    }
  };

  const edgeEndpoints = (edge: AtlasEdge): [Vec2, Vec2] | null => {
    let a = positionOf.get(edge.source);
    let b = positionOf.get(edge.target);
    if (!a || !b) return null;
    const sourceCfg = cfgAnchors.get(edge.source);
    if (sourceCfg) {
      const name = symbolNameOf(edge.target);
      a = (name ? sourceCfg.calls.get(name) : undefined) ?? a;
    }
    const targetCfg = cfgAnchors.get(edge.target);
    if (targetCfg) b = targetCfg.entry;
    return [a, b];
  };

  const innerCells = props.innerCells ?? [];
  const parentFileOf = props.parentFileOf ?? ((id: string) => id);
  const showInner = zoom > 0.8 && innerCells.length > 0;
  const visibleInnerCells = showInner
    ? innerCells.filter(
        (c) =>
          c.polygon.length >= 3 &&
          (isSelected(c.id) ||
            (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX &&
              cellInView(c.site, Math.sqrt(c.actualArea), committedView))),
      )
    : [];

  const fillOf = (cell: CellResult): string =>
    leafFillOf(cell.id, {
      changedFiles: props.changedFiles,
      cyclicIds,
      testFileIds: props.testFileIds,
      dependencyIds: directions.dependencyIds,
      dependentIds: directions.dependentIds,
      topAncestorOf,
    });

  const visibleFileCells = fileCells.filter(
    (c) =>
      c.polygon.length >= 3 &&
      (isSelected(c.id) ||
        props.changedFiles?.has(c.id) ||
        (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX &&
          cellInView(c.site, Math.sqrt(c.actualArea), committedView))),
  );
  const labelOf = (id: string): string =>
    props.labels?.get(id) ?? symbolNameOf(id) ?? id.split("/").pop() ?? id;

  return (
    <svg
      {...svgProps}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        cursor: hoveredEdge ? "pointer" : "grab",
      }}
      onClick={() => onSelect(null)}
    >
      <style>{"polygon, path { vector-effect: non-scaling-stroke; }"}</style>
      {/* top-level districts */}
      <g style={{ display: levelVisible(state.levels[0]!.kind) ? "" : "none" }}>
        {[...topCells.values()].map((cell) =>
          cell.polygon.length >= 3 ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={districtFill(cell.id)}
              fill-opacity={moduleOpacity(cell.id)}
              stroke={
                isSelected(cell.id)
                  ? SELECT_STROKE
                  : districtStroke(cell.id)
              }
              stroke-opacity={moduleOpacity(cell.id)}
              stroke-width={isSelected(cell.id) ? 3 : 1.6}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id, event.shiftKey);
              }}
            />
          ) : null,
        )}
      </g>
      {/* intermediate boundary districts (shared with rings) */}
      <InnerLevelsLayer
        levels={innerLevels}
        topAncestorOf={topAncestorOf}
        isSelected={isSelected}
        onSelect={onSelect}
        dim={dim}
        zoom={zoom}
        labels={props.labels}
        visibleLevels={props.visibleLevels}
      />
      {/* file cells */}
      <g style={{ display: leafVisible ? "" : "none" }}>
        {visibleFileCells.map((cell) => {
          // outline zoom-gated like rings: macro views read as filled
          // regions, borders fade in as cells grow on screen
          const border =
            isSelected(cell.id) ||
            Math.sqrt(cell.actualArea) * zoom >= LEAF_BORDER_MIN_PX;
          return (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={fillOf(cell)}
              fill-opacity={fileOpacity(cell.id)}
              stroke={
                isSelected(cell.id)
                  ? SELECT_STROKE
                  : border
                    ? LEAF_STROKE
                    : "none"
              }
              stroke-opacity={fileOpacity(cell.id)}
              stroke-width={isSelected(cell.id) ? 2.5 : 0.6}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id, event.shiftKey);
              }}
            />
          );
        })}
      </g>
      {leafVisible ? (
        <WatermarkLabelsLayer
          cells={visibleFileCells}
          zoom={zoom}
          labelOf={labelOf}
          dim={dim}
          view={committedView}
        />
      ) : null}
      {/* nested symbols inside file cells (same rules as rings) */}
      {showInner ? (
        <g stroke={SYMBOL_STROKE} stroke-width={0.4} stroke-opacity={0.8}>
          {visibleInnerCells.map((cell) =>
            cell.id.endsWith("#rest") ? null : (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="transparent"
                stroke={isSelected(cell.id) ? SELECT_STROKE : undefined}
                stroke-width={isSelected(cell.id) ? 1.6 : undefined}
                opacity={dim.symbol(cell.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(cell.id, event.shiftKey);
                }}
              />
            ),
          )}
        </g>
      ) : null}
      {showInner ? (
        <g
          text-anchor="middle"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {visibleInnerCells.map((cell) => {
            if (cell.id.endsWith("#rest")) return null;
            const fileSelected = isSelected(parentFileOf(cell.id));
            const dominant =
              Math.sqrt(cell.actualArea) * zoom >=
              Math.min(width, height) * SYMBOL_DOMINANT_FRACTION;
            const name = labelOf(cell.id);
            const kind = props.symbolKindOf?.(cell.id);
            const glyph = symbolGlyphOf(kind, name);
            // members stay collapsed until a deep zoom enlarges their cell
            const isMember = glyph === "method" || glyph === "property";
            const onScreen = Math.sqrt(cell.actualArea) * zoom;
            const roomy =
              zoom >= SYMBOL_ZOOM &&
              onScreen >= (isMember ? MEMBER_TAG_MIN_PX : SYMBOL_ICON_MIN_PX);
            const passes = isMember
              ? roomy || isSelected(cell.id)
              : fileSelected || dominant || roomy || isSelected(cell.id);
            if (!passes) return null;
            const fontSize = Math.min(
              Math.max(Math.sqrt(cell.actualArea) * 0.3, 9 / zoom),
              13 / zoom,
            );
            return (
              <SymbolTag
                key={cell.id}
                cx={cell.site.x}
                cy={cell.site.y - 4 / zoom}
                name={name}
                glyph={glyph}
                static={isStaticKind(kind)}
                fontSize={fontSize}
                color={
                  glyph
                    ? SYMBOL_KIND_COLORS[glyph]!
                    : props.exportedIds?.has(cell.id)
                      ? EXPORTED_LABEL
                      : INTERNAL_LABEL
                }
                opacity={dim.symbol(cell.id)}
              />
            );
          })}
        </g>
      ) : null}
      <CfgLayer
        entries={props.cfgEntries ?? []}
        zoom={zoom}
        view={committedView}
      />
      {/* bundled dependency edges */}
      {props.showEdges && !focus ? (
        <g fill="none">
          {bundled.map((edge) => {
            const active =
              isSelected(edge.source) ||
              isSelected(edge.target) ||
              isSelected(parentModuleOf(edge.source) ?? "") ||
              isSelected(parentModuleOf(edge.target) ?? "");
            // sub-pixel intra-module edges are pure overdraw at overview
            if (!active && edge.chord * zoom < MIN_EDGE_PX) return null;
            return (
              <path
                key={`${edge.source} ${edge.target}`}
                d={edge.d}
                stroke={active ? ACTIVE_EDGE : UPSTREAM_COLOR}
                stroke-opacity={active ? 0.9 : selectedId ? 0.08 : 0.22}
                stroke-width={active ? 1.8 : 1}
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </g>
      ) : null}
      {/* selection references, colored by direction; independent of the
          ambient-edge toggle */}
      {!focus ? (
        <g fill="none">
          {(
            [
              [directions.outgoing, DOWNSTREAM_COLOR],
              [directions.incoming, UPSTREAM_COLOR],
            ] as const
          ).flatMap(([edges, color]) =>
            edges.map((edge) => {
              const bundle = bundleOf(edge);
              if (!bundle) return null;
              return (
                <path
                  key={`sel-${edge.source}-${edge.target}`}
                  d={bundle.d}
                  stroke={color}
                  stroke-opacity={0.9}
                  stroke-width={1.6}
                  stroke-dasharray={`${5 / zoom} ${4 / zoom}`}
                  style={{ pointerEvents: "none" }}
                />
              );
            }),
          )}
        </g>
      ) : null}
      {/* extracted dependency paths, colored by direction */}
      {focus ? (
        <g fill="none">
          {focusBundles.map((edge) => (
            <path
              key={`focus-${edge.source} ${edge.target}`}
              d={edge.d}
              stroke={edge.color}
              stroke-opacity={0.85}
              stroke-width={1.8}
              style={{ pointerEvents: "none" }}
            />
          ))}
        </g>
      ) : null}
      {/* hover preview: a faint accent over the edge a click would pick */}
      {hoveredEdge && !isSelectedEdge(hoveredEdge.source, hoveredEdge.target)
        ? (() => {
            const bundle = bundleOf({
              source: hoveredEdge.source,
              target: hoveredEdge.target,
            });
            return bundle ? (
              <g style={{ pointerEvents: "none" }}>
                <RaisedEdgePath d={bundle.d} width={8} opacity={0.2} />
                <RaisedEdgePath d={bundle.d} width={2} opacity={0.85} />
              </g>
            ) : null;
          })()
        : null}
      {/* picked edge, raised above the districts: bold accented stroke with
          its endpoint districts outlined (pointer-through so cells stay
          clickable) */}
      {selectedEdges.map((selectedEdge) => {
        const key = `${selectedEdge.source}->${selectedEdge.target}`;
        const bundle = bundleOf({
          source: selectedEdge.source,
          target: selectedEdge.target,
        });
        if (!bundle) return null;
        return (
          <g key={key} style={{ pointerEvents: "none" }}>
            <RaisedEdgePath d={bundle.d} />
            {[selectedEdge.source, selectedEdge.target].map((id) => {
              const top = topAncestorOf(id);
              const cell = top ? topCells.get(top) : null;
              if (!cell || cell.polygon.length < 3) return null;
              return (
                <polygon
                  key={id}
                  points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={SELECT_STROKE}
                  stroke-width={3}
                />
              );
            })}
          </g>
        );
      })}
      {/* top-level labels */}
      <g
        text-anchor="middle"
        style={{
          pointerEvents: "none",
          userSelect: "none",
          display: levelVisible(state.levels[0]!.kind) ? "" : "none",
        }}
      >
        {[...topCells.values()].map((cell) => {
          if (cell.polygon.length < 3) return null;
          // screen-px cap: district names stay readable, never dominant
          const fontSize = Math.min(
            Math.sqrt(cell.actualArea) * 0.18,
            28 / zoom,
          );
          return (
            <text
              key={cell.id}
              x={cell.site.x}
              y={cell.site.y}
              font-size={fontSize}
              font-weight="700"
              fill={districtLabelFill(cell.id)}
              fill-opacity={0.85 * moduleOpacity(cell.id)}
            >
              {labelOf(cell.id)}
            </text>
          );
        })}
      </g>
      {/* file labels appear once their cell is readable, and hand off to
          the background watermark past the shared threshold */}
      <g
        fill={FILE_LABEL_INK}
        text-anchor="middle"
        style={{
          pointerEvents: "none",
          userSelect: "none",
          display: leafVisible ? "" : "none",
        }}
      >
        {visibleFileCells.map((cell) => {
          if (isWatermarkSized(cell, zoom)) return null;
          const px = Math.sqrt(cell.actualArea) * zoom;
          const name = labelOf(cell.id);
          // symbol leaves get their kind icon + matching ink; files stay plain
          const kind =
            props.leafKind === "symbol" ? props.symbolKindOf?.(cell.id) : undefined;
          // members stay collapsed until their cell is large on screen
          const isMember = kind === "method" || kind === "property" ||
            kind === "static-method" || kind === "static-property";
          if (px < (isMember ? MEMBER_TAG_MIN_PX : 28) && !isSelected(cell.id)) {
            return null;
          }
          // screen-px cap (like rings): the name stays modest while
          // zooming until the watermark copy takes over
          const fontSize = Math.min(
            Math.max(Math.sqrt(cell.actualArea) * 0.14, 9 / zoom),
            18 / zoom,
          );
          const glyph = symbolGlyphOf(kind, name);
          return (
            <SymbolTag
              key={cell.id}
              cx={cell.site.x}
              cy={cell.site.y}
              name={name}
              glyph={glyph}
              static={isStaticKind(kind)}
              fontSize={fontSize}
              color={glyph ? SYMBOL_KIND_COLORS[glyph]! : FILE_LABEL_INK}
              opacity={fileOpacity(cell.id)}
            />
          );
        })}
      </g>
      {(focus
        ? ([
            [focus.downstreamEdges, DOWNSTREAM_COLOR, "exit-focus-down"],
            [focus.upstreamEdges, UPSTREAM_COLOR, "exit-focus-up"],
          ] as const)
        : ([
            [directions.outgoing, DOWNSTREAM_COLOR, "exit-sel-down"],
            [directions.incoming, UPSTREAM_COLOR, "exit-sel-up"],
          ] as const)
      ).map(([edges, color, key]) => (
        <ExitPreviewsLayer
          key={key}
          edges={edges}
          color={color}
          view={committedView}
          endpointsOf={edgeEndpoints}
          labelOf={labelOf}
          onSelect={onSelect}
          onFocus={props.onFocusId}
          zoom={zoom}
        />
      ))}
    </svg>
  );
}
