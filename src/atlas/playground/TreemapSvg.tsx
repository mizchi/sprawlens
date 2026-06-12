import { useMemo } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import { CfgLayer, cfgAnchorsOf, type CfgEntry } from "./CfgLayer.tsx";
import {
  BUNDLE_STRENGTH,
  DOWNSTREAM_COLOR,
  makeEdgeBundler,
  selectionDirections,
  focusDimOf,
  InnerLevelsLayer,
  isWatermarkSized,
  leafFillOf,
  makeTopAncestorOf,
  moduleHue,
  SELECT_STROKE,
  UPSTREAM_COLOR,
  WatermarkLabelsLayer,
} from "./mapShared.tsx";
import { symbolNameOf } from "./cfgClient.ts";
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
  onSelect: (id: string | null, additive?: boolean) => void;
  focusRequest?: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
};

/** Cells smaller than this on screen are not worth a polygon. */
const MIN_CELL_PX = 2.5;
/** Edges shorter than this on screen are sub-pixel noise. */
const MIN_EDGE_PX = 6;

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
  const { svgProps, zoom, committedView } = useMapViewport({
    width,
    height,
    focusRequest: props.focusRequest,
    onViewSettle: props.onViewSettle,
  });

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

  const bundled = useMemo(() => {
    if (!props.showEdges || focus) return [];
    return props.fileEdges.flatMap((edge) => {
      const b = bundleOf(edge);
      return b ? [b] : [];
    });
  }, [props.fileEdges, props.showEdges, focus, state, positionOf, bundleStrength, cfgAnchors]);

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
      (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX ||
        isSelected(c.id) ||
        props.changedFiles?.has(c.id)),
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
        cursor: "grab",
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
              fill={`hsl(${moduleHue(cell.id)} 30% 97%)`}
              fill-opacity={moduleOpacity(cell.id)}
              stroke={
                isSelected(cell.id)
                  ? SELECT_STROKE
                  : `hsl(${moduleHue(cell.id)} 45% 55%)`
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
        {visibleFileCells.map((cell) => (
          <polygon
            key={cell.id}
            points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={fillOf(cell)}
            fill-opacity={fileOpacity(cell.id)}
            stroke={isSelected(cell.id) ? SELECT_STROKE : "#94a3b8"}
            stroke-opacity={fileOpacity(cell.id)}
            stroke-width={isSelected(cell.id) ? 2.5 : 0.6}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(cell.id, event.shiftKey);
            }}
          />
        ))}
      </g>
      {leafVisible ? (
        <WatermarkLabelsLayer
          cells={visibleFileCells}
          zoom={zoom}
          labelOf={labelOf}
          dim={dim}
        />
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
                stroke={active ? "#c2410c" : "#0891b2"}
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
          const fontSize = Math.min(
            Math.sqrt(cell.actualArea) * 0.18,
            22 / zoom + 6,
          );
          return (
            <text
              key={cell.id}
              x={cell.site.x}
              y={cell.site.y}
              font-size={fontSize}
              font-weight="700"
              fill={`hsl(${moduleHue(cell.id)} 50% 32%)`}
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
        fill="#334155"
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
          if (px < 46 && !isSelected(cell.id)) return null;
          const fontSize = Math.max(Math.sqrt(cell.actualArea) * 0.14, 9 / zoom);
          return (
            <text
              key={cell.id}
              x={cell.site.x}
              y={cell.site.y}
              font-size={fontSize}
              font-weight={isSelected(cell.id) ? "700" : "400"}
              fill-opacity={fileOpacity(cell.id)}
            >
              {labelOf(cell.id)}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
