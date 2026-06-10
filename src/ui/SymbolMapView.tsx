import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { buildSymbolMapFrame, type SymbolMapEdge, type SymbolMapFrame, type SymbolMapNode } from "../core/symbolMap.js";
import { moduleIdForFilePath } from "../core/moduleMap.js";
import type { SymbolDependencyResult } from "../core/symbolDependencies.js";
import type { GraphDiff, Snapshot } from "../core/types.js";
import { wheelZoomFactor } from "./moduleViewport.js";

type SymbolMapViewProps = {
  snapshot: Snapshot | null;
  diff: GraphDiff | null;
  selectedFile: string;
  selectedModuleId: string;
  onSelectFile: (path: string) => void;
  onSelectModule: (moduleId: string) => void;
};

type MapView = {
  x: number;
  y: number;
  zoom: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  view: MapView;
};

type SelectedEdgeDirection = "incoming" | "outgoing" | "neutral";

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 8;

export function SymbolMapView(props: SymbolMapViewProps) {
  const [wrapRef, size, wrapElement] = useElementSize<HTMLDivElement>();
  const focusModuleId = props.selectedModuleId || (props.selectedFile ? moduleIdForFilePath(props.selectedFile) : undefined);
  const frame = useMemo(
    () =>
      props.snapshot
        ? buildSymbolMapFrame(props.snapshot, {
            diff: props.diff,
            focusModuleId,
            focusFilePath: props.selectedFile || undefined,
          })
        : null,
    [focusModuleId, props.diff, props.selectedFile, props.snapshot],
  );
  const [view, setView] = useState<MapView>(() => ({ x: 0, y: 0, zoom: 1 }));
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState("");
  const [symbolDependencies, setSymbolDependencies] = useState<SymbolDependencyResult | null>(null);
  const [symbolDependencyLoading, setSymbolDependencyLoading] = useState(false);
  const [symbolDependencyError, setSymbolDependencyError] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!frame) {
      return;
    }
    setView(fitFrame(frame, size));
    setSelectedNodeId((current) => syncedSelectedNodeId(frame, current, focusModuleId));
  }, [focusModuleId, frame?.commitHash, size.height, size.width]);

  useEffect(() => {
    if (!wrapElement) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = wrapElement.getBoundingClientRect();
      setView((current) =>
        zoomAt(
          current,
          size,
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
          current.zoom * wheelZoomFactor(event.deltaY),
        ),
      );
    };
    wrapElement.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapElement.removeEventListener("wheel", onWheel);
  }, [size, wrapElement]);

  const selectedNodeForDependencies = frame?.nodes.find((node) => node.id === selectedNodeId);
  useEffect(() => {
    if (!selectedNodeForDependencies || selectedNodeForDependencies.kind !== "symbol") {
      setSymbolDependencies(null);
      setSymbolDependencyLoading(false);
      setSymbolDependencyError("");
      return;
    }
    const abort = new AbortController();
    setSymbolDependencyLoading(true);
    setSymbolDependencyError("");
    loadSymbolDependencies(selectedNodeForDependencies.id, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setSymbolDependencies(result);
        }
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          setSymbolDependencies(null);
          setSymbolDependencyError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setSymbolDependencyLoading(false);
        }
      });
    return () => abort.abort();
  }, [selectedNodeForDependencies?.id, selectedNodeForDependencies?.kind]);

  if (!frame) {
    return <div className="empty-state">No symbol map</div>;
  }

  const selectedNode = selectedNodeForDependencies;
  const hoveredNode = frame.nodes.find((node) => node.id === hoveredNodeId);
  const inspectorNode = stableInspectorNode(selectedNode, hoveredNode);
  const importRelatedIds = relatedNodeIds(frame, selectedNodeId);
  const callRelatedIds = symbolDependencyRelatedNodeIds(symbolDependencies, selectedNodeId);
  const relatedIds = new Set([...importRelatedIds, ...callRelatedIds]);
  const visibleNodes = frame.nodes.filter((node) => shouldShowNode(node, view.zoom, node.id === selectedNodeId, relatedIds.has(node.id)));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const focusEdgeIds = selectedDependencyEdgeIds(frame, selectedNodeId);
  const visibleEdges = visibleSymbolEdgesForSelection(frame.edges, visibleNodeIds, focusEdgeIds, view.zoom);
  const visibleFocusEdges = visibleEdges.focus;
  const visibleBackgroundEdges = visibleEdges.background;
  const nodeById = new Map(frame.nodes.map((node) => [node.id, node]));
  const visibleCallEdges = symbolDependencyEdgesForMap(symbolDependencies, nodeById).filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));
  const visibleModuleNodes = visibleNodes.filter((node) => node.kind === "module");
  const visibleFileNodes = visibleNodes.filter((node) => node.kind === "file");
  const visibleSymbolNodes = visibleNodes.filter((node) => node.kind === "symbol");
  const focusedNodeIds = new Set([selectedNodeId, ...relatedIds]);
  const visibleBackgroundSymbols = visibleSymbolNodes.filter((node) => !focusedNodeIds.has(node.id));
  const visibleFocusSymbols = visibleSymbolNodes.filter((node) => focusedNodeIds.has(node.id));
  const isSymbolFocus = selectedNode?.kind === "symbol";

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      view,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setView({
      x: drag.view.x - (event.clientX - drag.startClientX) / drag.view.zoom,
      y: drag.view.y - (event.clientY - drag.startClientY) / drag.view.zoom,
      zoom: drag.view.zoom,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const selectNode = (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
    if (node.kind === "module") {
      props.onSelectModule(node.id);
      props.onSelectFile("");
      return;
    }
    if (node.moduleId) {
      props.onSelectModule(node.moduleId);
    }
    if (node.kind === "file" || node.kind === "symbol") {
      props.onSelectFile(node.path);
    }
  };

  const zoomToNode = (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setView({
      x: node.x,
      y: node.y,
      zoom: clamp(node.kind === "module" ? Math.max(view.zoom * 1.7, 1.15) : node.kind === "file" ? Math.max(view.zoom * 1.75, 2.2) : Math.max(view.zoom * 1.45, 3.2), MIN_ZOOM, MAX_ZOOM),
    });
    if (node.moduleId) {
      props.onSelectModule(node.moduleId);
    }
    if (node.kind !== "module") {
      props.onSelectFile(node.path);
    }
  };

  return (
    <section className="symbol-map-screen">
      <div className="symbol-map-head">
        <div>
          <h2>Symbol Map</h2>
          <span>
            {frame.stats.moduleCount} modules / {frame.stats.fileCount} files / {frame.stats.symbolCount} symbols / {frame.stats.edgeCount} routes
          </span>
        </div>
        <div className="symbol-map-legend" aria-label="Symbol map legend">
          <span className="legend-box file" /> file LOC
          <span className="legend-dot symbol-public" /> public symbol
          <span className="legend-dot symbol-exported" /> exported
          <span className="legend-dot symbol-internal" /> internal
          <span className="legend-line cross-module" /> module route
        </div>
      </div>
      <div
        ref={wrapRef}
        className={dragging ? "symbol-map-wrap dragging" : "symbol-map-wrap"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className={isSymbolFocus ? "symbol-map symbol-focus" : "symbol-map"} viewBox={viewBoxFor(view, size)} role="img" aria-label="Symbol dependency map">
          <defs>
            <marker id="symbol-map-arrow" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L4.5,2.5 z" fill="#64748b" />
            </marker>
            <marker id="symbol-map-arrow-outgoing" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L4.5,2.5 z" fill="#0f766e" />
            </marker>
            <marker id="symbol-map-arrow-incoming" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L4.5,2.5 z" fill="#b45309" />
            </marker>
          </defs>
          <g className="symbol-map-modules">
            {visibleModuleNodes.map((node) => (
              <ModuleNode key={node.id} node={node} zoom={view.zoom} selected={node.id === selectedNodeId} onClick={selectNode} onDoubleClick={zoomToNode} />
            ))}
          </g>
          <g className="symbol-map-files">
            {visibleFileNodes.map((node) => (
              <FileNode key={node.id} node={node} zoom={view.zoom} selected={node.id === selectedNodeId} related={relatedIds.has(node.id)} onClick={selectNode} onDoubleClick={zoomToNode} />
            ))}
          </g>
          <g className="symbol-map-edges">
            {visibleBackgroundEdges.map((edge) => (
              <SymbolEdge key={edge.id} edge={edge} nodeById={nodeById} zoom={view.zoom} active={false} direction="neutral" />
            ))}
          </g>
          <g className="symbol-map-focus-edges">
            {visibleFocusEdges.map((edge) => (
              <SymbolEdge key={edge.id} edge={edge} nodeById={nodeById} zoom={view.zoom} active direction={selectedEdgeDirection(edge, selectedNodeId)} />
            ))}
            {visibleCallEdges.map((edge) => (
              <SymbolEdge key={edge.id} edge={edge} nodeById={nodeById} zoom={view.zoom} active direction={selectedEdgeDirection(edge, selectedNodeId)} />
            ))}
          </g>
          <g className="symbol-map-symbols">
            {visibleBackgroundSymbols.map((node) => (
              <SymbolNode
                key={node.id}
                node={node}
                zoom={view.zoom}
                selected={node.id === selectedNodeId}
                related={relatedIds.has(node.id)}
                onClick={selectNode}
                onDoubleClick={zoomToNode}
                onHover={setHoveredNodeId}
              />
            ))}
          </g>
          <g className="symbol-map-focus-symbols">
            {visibleFocusSymbols.map((node) => (
              <SymbolNode
                key={node.id}
                node={node}
                zoom={view.zoom}
                selected={node.id === selectedNodeId}
                related={relatedIds.has(node.id)}
                onClick={selectNode}
                onDoubleClick={zoomToNode}
                onHover={setHoveredNodeId}
              />
            ))}
          </g>
        </svg>
        <aside className="symbol-map-minimap" aria-label="Symbol map minimap">
          <svg viewBox={`${frame.bounds.minX} ${frame.bounds.minY} ${frame.bounds.maxX - frame.bounds.minX} ${frame.bounds.maxY - frame.bounds.minY}`}>
            {frame.nodes.filter((node) => node.kind === "module").map((node) => (
              <circle key={node.id} cx={node.x} cy={node.y} r={node.r} />
            ))}
            {frame.nodes.filter((node) => node.kind === "symbol" && node.surface === "public").map((node) => (
              <circle key={node.id} className="public" cx={node.x} cy={node.y} r={Math.max(10, node.r * 2)} />
            ))}
          </svg>
          <strong>{Math.round(view.zoom * 100)}%</strong>
        </aside>
        <div className="symbol-map-toolbar">
          <button type="button" onClick={() => setView(fitFrame(frame, size))}>
            Fit
          </button>
          <span>Wheel zoom / drag pan / double click drill</span>
        </div>
        <SymbolHoverCard node={hoveredNode} />
      </div>
      <SymbolInspector
        node={inspectorNode}
        selected={selectedNode}
        edges={frame.edges}
        nodeById={nodeById}
        symbolDependencies={symbolDependencies}
        symbolDependencyLoading={symbolDependencyLoading}
        symbolDependencyError={symbolDependencyError}
      />
    </section>
  );
}

function ModuleNode(props: {
  node: SymbolMapNode;
  zoom: number;
  selected: boolean;
  onClick: (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => void;
}) {
  const showLabel = props.zoom <= 1.3 || props.selected;
  return (
    <g
      className={`symbol-map-node module ${props.node.status}${props.selected ? " selected" : ""}`}
      onClick={(event) => props.onClick(event, props.node)}
      onDoubleClick={(event) => props.onDoubleClick(event, props.node)}
    >
      <circle cx={props.node.x} cy={props.node.y} r={props.node.r} />
      {showLabel ? (
        <text x={props.node.x} y={props.node.y - props.node.r + 18 / props.zoom} className="symbol-map-label module-label" style={{ fontSize: 15 / props.zoom }}>
          {props.node.label}
        </text>
      ) : null}
      <title>{`${props.node.path}\n${formatNumber(props.node.loc)} LOC`}</title>
    </g>
  );
}

function FileNode(props: {
  node: SymbolMapNode;
  zoom: number;
  selected: boolean;
  related: boolean;
  onClick: (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => void;
}) {
  const w = props.node.w ?? 1;
  const h = props.node.h ?? 1;
  const showLabel = props.selected || props.related || (props.zoom >= 1.65 && w * props.zoom >= 92 && h * props.zoom >= 52);
  return (
    <g
      className={`symbol-map-node file ${props.node.layer ?? ""} ${props.node.status}${props.selected ? " selected" : ""}${props.related ? " related" : ""}`}
      onClick={(event) => props.onClick(event, props.node)}
      onDoubleClick={(event) => props.onDoubleClick(event, props.node)}
    >
      <rect x={props.node.x - w / 2} y={props.node.y - h / 2} width={w} height={h} />
      {showLabel ? (
        <text x={props.node.x - w / 2 + 4 / props.zoom} y={props.node.y - h / 2 + 12 / props.zoom} className="symbol-map-label file-label" style={{ fontSize: 10 / props.zoom }}>
          {props.node.label}
        </text>
      ) : null}
      <title>{`${props.node.path}\n${formatNumber(props.node.loc)} LOC`}</title>
    </g>
  );
}

function SymbolNode(props: {
  node: SymbolMapNode;
  zoom: number;
  selected: boolean;
  related: boolean;
  onClick: (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>, node: SymbolMapNode) => void;
  onHover: (nodeId: string) => void;
}) {
  const showLabel = shouldShowSymbolLabel(props.node, props.zoom, props.selected, props.related);
  return (
    <g
      className={`symbol-map-node symbol ${props.node.surface} ${props.node.status}${props.selected ? " selected" : ""}${props.related ? " related" : ""}`}
      onClick={(event) => props.onClick(event, props.node)}
      onDoubleClick={(event) => props.onDoubleClick(event, props.node)}
      onMouseOver={() => props.onHover(props.node.id)}
      onMouseOut={() => props.onHover("")}
    >
      <circle cx={props.node.x} cy={props.node.y} r={visualRadius(props.node, props.zoom)} />
      {showLabel ? (
        <text x={props.node.x + (props.node.r + 4) / props.zoom} y={props.node.y + 3 / props.zoom} className="symbol-map-label symbol-label" style={{ fontSize: 10 / props.zoom }}>
          {props.node.label}
        </text>
      ) : null}
      <title>{`${props.node.label}\n${props.node.path}\n${props.node.surface} / fan ${props.node.fanIn}:${props.node.fanOut}`}</title>
    </g>
  );
}

function SymbolEdge(props: {
  edge: SymbolMapEdge;
  nodeById: Map<string, SymbolMapNode>;
  zoom: number;
  active: boolean;
  direction: SelectedEdgeDirection;
}) {
  const from = props.nodeById.get(props.edge.from);
  const to = props.nodeById.get(props.edge.to);
  if (!from || !to) {
    return null;
  }
  const line = shortenLine(from, to, props.zoom);
  return (
    <line
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
      className={`symbol-map-edge ${props.edge.crossModule ? "cross-module" : "internal"} ${props.edge.status} ${props.direction}${props.active ? " active" : ""}`}
      strokeWidth={Math.min(props.active ? 4.8 : 3.6, 0.8 + Math.sqrt(props.edge.importCount) * (props.active ? 0.62 : 0.35))}
      markerEnd={props.active || props.edge.crossModule ? `url(#${markerIdForEdge(props.direction)})` : undefined}
    />
  );
}

function SymbolInspector(props: {
  node?: SymbolMapNode;
  selected?: SymbolMapNode;
  edges: SymbolMapEdge[];
  nodeById: Map<string, SymbolMapNode>;
  symbolDependencies: SymbolDependencyResult | null;
  symbolDependencyLoading: boolean;
  symbolDependencyError: string;
}) {
  const node = props.node;
  if (!node) {
    return null;
  }
  const incoming = props.edges.filter((edge) => edge.to === node.id);
  const outgoing = props.edges.filter((edge) => edge.from === node.id);
  return (
    <aside className="symbol-map-inspector">
      <div>
        <strong>{node.label}</strong>
        <span>{node.path}</span>
      </div>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{node.kind}</dd>
        </div>
        <div>
          <dt>Surface</dt>
          <dd>{node.surface}</dd>
        </div>
        <div>
          <dt>LOC</dt>
          <dd>{formatNumber(node.loc)}</dd>
        </div>
        <div>
          <dt>Fan</dt>
          <dd>
            {node.fanIn}:{node.fanOut}
          </dd>
        </div>
      </dl>
      <NeighborList title="Depends On" edges={outgoing} side="to" nodeById={props.nodeById} />
      <NeighborList title="Used By" edges={incoming} side="from" nodeById={props.nodeById} />
      {node.kind === "symbol" ? (
        <CallDependencyList
          title="Calls"
          direction="outgoing"
          selectedNodeId={node.id}
          dependencies={props.symbolDependencies}
          loading={props.symbolDependencyLoading}
          error={props.symbolDependencyError}
        />
      ) : null}
      {node.kind === "symbol" ? (
        <CallDependencyList
          title="Called By"
          direction="incoming"
          selectedNodeId={node.id}
          dependencies={props.symbolDependencies}
          loading={props.symbolDependencyLoading}
          error={props.symbolDependencyError}
        />
      ) : null}
    </aside>
  );
}

function SymbolHoverCard(props: { node?: SymbolMapNode }) {
  const node = props.node;
  if (!node) {
    return null;
  }
  return (
    <aside className="symbol-map-hover-card" aria-live="polite">
      <strong>{node.label}</strong>
      <span>{node.path}</span>
      <dl>
        <div>
          <dt>{node.kind}</dt>
          <dd>{node.surface}</dd>
        </div>
        <div>
          <dt>LOC</dt>
          <dd>{formatNumber(node.loc)}</dd>
        </div>
        <div>
          <dt>Fan</dt>
          <dd>
            {node.fanIn}:{node.fanOut}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

export function stableInspectorNode(selectedNode?: SymbolMapNode, _hoveredNode?: SymbolMapNode): SymbolMapNode | undefined {
  return selectedNode;
}

export function syncedSelectedNodeId(frame: SymbolMapFrame, currentSelectedNodeId: string, focusModuleId?: string): string {
  const current = frame.nodes.find((node) => node.id === currentSelectedNodeId);
  if (current && selectionBelongsToFocusModule(current, focusModuleId)) {
    return current.id;
  }
  if (focusModuleId && frame.nodes.some((node) => node.id === focusModuleId)) {
    return focusModuleId;
  }
  return frame.nodes.find((node) => node.kind === "module")?.id ?? currentSelectedNodeId;
}

function selectionBelongsToFocusModule(node: SymbolMapNode, focusModuleId?: string): boolean {
  if (!focusModuleId) {
    return true;
  }
  return node.id === focusModuleId || node.moduleId === focusModuleId;
}

function NeighborList(props: { title: string; edges: SymbolMapEdge[]; side: "from" | "to"; nodeById: Map<string, SymbolMapNode> }) {
  return (
    <section>
      <h3>{props.title}</h3>
      <ul>
        {props.edges.slice(0, 8).map((edge) => {
          const node = props.nodeById.get(edge[props.side]);
          return (
            <li key={edge.id}>
              <span>{node ? `${node.label} · ${compactPath(node.path)}` : edge[props.side]}</span>
              <strong>{edge.importCount}</strong>
            </li>
          );
        })}
        {props.edges.length === 0 ? <li className="empty-neighbor">None</li> : null}
      </ul>
    </section>
  );
}

function CallDependencyList(props: {
  title: string;
  direction: "incoming" | "outgoing";
  selectedNodeId: string;
  dependencies: SymbolDependencyResult | null;
  loading: boolean;
  error: string;
}) {
  const nodes = new Map(props.dependencies?.nodes.map((node) => [node.id, node]) ?? []);
  const edges = props.dependencies?.edges.filter((edge) => edge.direction === props.direction) ?? [];
  return (
    <section>
      <h3>{props.title}</h3>
      <ul>
        {props.loading ? <li className="empty-neighbor">Loading call hierarchy...</li> : null}
        {!props.loading && props.error ? <li className="empty-neighbor">{props.error}</li> : null}
        {!props.loading && !props.error
          ? edges.slice(0, 8).map((edge) => {
              const targetId = props.direction === "outgoing" ? edge.toSymbolId : edge.fromSymbolId;
              const node = nodes.get(targetId);
              return (
                <li key={edge.id}>
                  <span>{node ? `${node.name} · ${compactPath(node.filePath)}` : targetId}</span>
                  <strong>{edge.callCount}</strong>
                </li>
              );
            })
          : null}
        {!props.loading && !props.error && edges.length === 0 ? <li className="empty-neighbor">None</li> : null}
      </ul>
    </section>
  );
}

export function relatedNodeIds(frame: SymbolMapFrame, selectedNodeId: string): Set<string> {
  const ids = new Set(selectedNodeId ? [selectedNodeId] : []);
  const selected = frame.nodes.find((node) => node.id === selectedNodeId);
  if (selected?.kind === "file") {
    for (const node of frame.nodes) {
      if (node.parentId === selected.id) {
        ids.add(node.id);
      }
    }
  }
  for (const edge of frame.edges) {
    if (edge.from === selectedNodeId) {
      ids.add(edge.to);
    }
    if (edge.to === selectedNodeId) {
      ids.add(edge.from);
    }
  }
  return ids;
}

export function selectedDependencyEdgeIds(frame: SymbolMapFrame, selectedNodeId: string): Set<string> {
  const selected = frame.nodes.find((node) => node.id === selectedNodeId);
  if (!selected || selected.kind !== "symbol") {
    return new Set();
  }
  return new Set(frame.edges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId).map((edge) => edge.id));
}

export function visibleSymbolEdgesForSelection(edges: SymbolMapEdge[], visibleNodeIds: Set<string>, focusEdgeIds: Set<string>, zoom: number): { background: SymbolMapEdge[]; focus: SymbolMapEdge[] } {
  const background: SymbolMapEdge[] = [];
  const focus: SymbolMapEdge[] = [];
  for (const edge of edges) {
    if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) {
      continue;
    }
    if (focusEdgeIds.has(edge.id)) {
      focus.push(edge);
      continue;
    }
    if (edge.visibleAtZoom <= zoom) {
      background.push(edge);
    }
  }
  return { background, focus };
}

export function selectedEdgeDirection(edge: SymbolMapEdge, selectedNodeId: string): SelectedEdgeDirection {
  if (edge.from === selectedNodeId) {
    return "outgoing";
  }
  if (edge.to === selectedNodeId) {
    return "incoming";
  }
  return "neutral";
}

export function symbolDependencyRelatedNodeIds(dependencies: SymbolDependencyResult | null | undefined, selectedNodeId: string): Set<string> {
  const ids = new Set<string>();
  if (!dependencies || dependencies.symbolId !== selectedNodeId) {
    return ids;
  }
  for (const edge of dependencies.edges) {
    if (edge.fromSymbolId === selectedNodeId) {
      ids.add(edge.toSymbolId);
    }
    if (edge.toSymbolId === selectedNodeId) {
      ids.add(edge.fromSymbolId);
    }
  }
  return ids;
}

function markerIdForEdge(direction: SelectedEdgeDirection): string {
  if (direction === "outgoing") {
    return "symbol-map-arrow-outgoing";
  }
  if (direction === "incoming") {
    return "symbol-map-arrow-incoming";
  }
  return "symbol-map-arrow";
}

export function symbolDependencyEdgesForMap(dependencies: SymbolDependencyResult | null | undefined, nodeById: Map<string, SymbolMapNode>): SymbolMapEdge[] {
  if (!dependencies) {
    return [];
  }
  return dependencies.edges.flatMap((edge): SymbolMapEdge[] => {
    const from = nodeById.get(edge.fromSymbolId);
    const to = nodeById.get(edge.toSymbolId);
    if (!from || !to) {
      return [];
    }
    return [
      {
        id: `lsp-call:${edge.fromSymbolId}->${edge.toSymbolId}`,
        scope: "symbol",
        from: edge.fromSymbolId,
        to: edge.toSymbolId,
        fromModuleId: from.moduleId ?? "",
        toModuleId: to.moduleId ?? "",
        importCount: edge.callCount,
        crossModule: Boolean(from.moduleId && to.moduleId && from.moduleId !== to.moduleId),
        status: "stable",
        visibleAtZoom: 0,
      },
    ];
  });
}

async function loadSymbolDependencies(symbolId: string, signal: AbortSignal): Promise<SymbolDependencyResult> {
  const response = await fetch("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `symbolDependencies:${symbolId}`,
      method: "symbolDependencies",
      params: {
        symbolId,
        maxIncoming: 24,
        maxOutgoing: 24,
      },
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Call hierarchy request failed: ${response.status}`);
  }
  const payload = (await response.json()) as {
    result?: SymbolDependencyResult;
    error?: { message?: string };
  };
  if (!payload.result) {
    throw new Error(payload.error?.message ?? "Call hierarchy request failed");
  }
  return payload.result;
}

function shouldShowNode(node: SymbolMapNode, zoom: number, selected: boolean, related: boolean): boolean {
  if (selected || related) {
    return true;
  }
  if (node.kind === "module") {
    return true;
  }
  return node.visibleAtZoom <= zoom;
}

export function shouldShowSymbolLabel(node: SymbolMapNode, zoom: number, selected: boolean, related: boolean): boolean {
  if (selected || related) {
    return true;
  }
  const activity = node.fanIn + node.fanOut + node.crossModuleFanIn * 2 + node.crossModuleFanOut * 2;
  if (node.surface === "public") {
    return zoom >= 0.72 || activity >= 4;
  }
  if (node.surface === "exported") {
    return (zoom >= 2.35 && activity >= 3) || zoom >= 3.45;
  }
  return (zoom >= 4.2 && activity >= 3) || zoom >= 5.2;
}

function fitFrame(frame: SymbolMapFrame, size: { width: number; height: number }): MapView {
  const width = Math.max(1, frame.bounds.maxX - frame.bounds.minX);
  const height = Math.max(1, frame.bounds.maxY - frame.bounds.minY);
  return {
    x: (frame.bounds.minX + frame.bounds.maxX) / 2,
    y: (frame.bounds.minY + frame.bounds.maxY) / 2,
    zoom: clamp(Math.min(size.width / (width * 1.05), size.height / (height * 1.05)), MIN_ZOOM, 0.9),
  };
}

function viewBoxFor(view: MapView, size: { width: number; height: number }): string {
  const width = size.width / view.zoom;
  const height = size.height / view.zoom;
  return `${view.x - width / 2} ${view.y - height / 2} ${width} ${height}`;
}

function zoomAt(view: MapView, size: { width: number; height: number }, point: { x: number; y: number }, nextZoom: number): MapView {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const left = view.x - size.width / (2 * view.zoom);
  const top = view.y - size.height / (2 * view.zoom);
  const worldX = left + point.x / view.zoom;
  const worldY = top + point.y / view.zoom;
  return {
    x: worldX - (point.x - size.width / 2) / zoom,
    y: worldY - (point.y - size.height / 2) / zoom,
    zoom,
  };
}

function visualRadius(node: SymbolMapNode, zoom: number): number {
  return Math.max(2.6 / zoom, node.r / Math.max(1, zoom * 0.34));
}

function shortenLine(from: SymbolMapNode, to: SymbolMapNode, zoom: number) {
  const dx = to.x - from.x || 0.01;
  const dy = to.y - from.y || 0.01;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance;
  const uy = dy / distance;
  const fromRadius = visualRadius(from, zoom);
  const toRadius = visualRadius(to, zoom);
  return {
    x1: from.x + ux * fromRadius,
    y1: from.y + uy * fromRadius,
    x2: to.x - ux * (toRadius + 3 / zoom),
    y2: to.y - uy * (toRadius + 3 / zoom),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function compactPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 4 ? `${parts.slice(0, 2).join("/")}/.../${parts.at(-1)}` : path;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 960, height: 620 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(320, Math.round(rect.height || 620)),
      };
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return [ref, size, ref.current] as const;
}
