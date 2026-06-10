import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import {
  buildDependencyGraphFrame,
  type DependencyGraphBreakdown,
  type DependencyGraphEdge,
  type DependencyGraphFrame,
  type DependencyGraphImportDetail,
  type DependencyGraphNode,
} from "../core/dependencyGraph.js";
import { moduleIdForFilePath } from "../core/moduleMap.js";
import type { GraphDiff, Snapshot } from "../core/types.js";
import { wheelZoomFactor } from "./moduleViewport.js";

type DependencyGraphViewProps = {
  snapshot: Snapshot | null;
  diff: GraphDiff | null;
  selectedFile: string;
  selectedModuleId: string;
  onSelectFile: (path: string) => void;
  onSelectModule: (moduleId: string) => void;
};

type GraphView = {
  x: number;
  y: number;
  zoom: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  view: GraphView;
  moved: boolean;
};

export type SelectionEdgeRelation = "depends-on" | "used-by" | "unrelated";
export type SelectionNodeRelation = "selected" | "dependency" | "dependent" | "unrelated";

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 8;

export function DependencyGraphView(props: DependencyGraphViewProps) {
  const [wrapRef, size, wrapElement] = useElementSize<HTMLDivElement>();
  const focusModuleId = props.selectedModuleId || (props.selectedFile ? moduleIdForFilePath(props.selectedFile) : undefined);
  const frame = useMemo(
    () =>
      props.snapshot
        ? buildDependencyGraphFrame(props.snapshot, {
            diff: props.diff,
            focusModuleId,
            focusFilePath: props.selectedFile || undefined,
          })
        : null,
    [focusModuleId, props.diff, props.selectedFile, props.snapshot],
  );
  const [view, setView] = useState<GraphView>(() => ({ x: 0, y: 0, zoom: 1 }));
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const pendingFocusViewRef = useRef<{ nodeId: string; zoom: number } | null>(null);

  useEffect(() => {
    if (!frame) {
      return;
    }
    const pending = pendingFocusViewRef.current;
    const pendingNode = pending ? frame.nodes.find((node) => node.id === pending.nodeId) : undefined;
    if (pending && pendingNode) {
      pendingFocusViewRef.current = null;
      setView({ x: pendingNode.x, y: pendingNode.y, zoom: clamp(pending.zoom, MIN_ZOOM, MAX_ZOOM) });
      setSelectedNodeId(pendingNode.id);
      return;
    }
    setView(fitFrame(frame, size));
    setSelectedNodeId(focusModuleId ?? frame.nodes[0]?.id ?? "");
  }, [focusModuleId, frame?.commitHash, size.height, size.width]);

  useEffect(() => {
    if (!wrapElement) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = wrapElement.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setView((current) => zoomAt(current, size, point, current.zoom * wheelZoomFactor(event.deltaY)));
    };
    wrapElement.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      wrapElement.removeEventListener("wheel", onWheel);
    };
  }, [size, wrapElement]);

  if (!frame) {
    return <div className="empty-state">No dependency graph</div>;
  }

  const selectedNode = frame.nodes.find((node) => node.id === selectedNodeId) ?? frame.nodes.find((node) => node.id === focusModuleId) ?? frame.nodes[0];
  const selectedModuleId = graphModuleId(selectedNode);
  const relatedIds = relatedNodeIds(frame, selectedNode?.id ?? "", selectedModuleId);
  const childIds = new Set(selectedNode?.kind === "module" ? frame.nodes.filter((node) => node.parentId === selectedNode.id).map((node) => node.id) : []);
  const viewBox = viewBoxFor(view, size);

  const selectNodeById = (nodeId: string) => {
    const node = frame.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    setSelectedNodeId(node.id);
    if (node.kind === "module") {
      props.onSelectFile("");
      props.onSelectModule(node.id);
      return;
    }
    if (node.kind === "port") {
      props.onSelectFile("");
      if (node.parentId?.startsWith("module:")) {
        props.onSelectModule(node.parentId);
      }
      return;
    }
    props.onSelectFile(node.path);
    if (node.moduleId?.startsWith("module:")) {
      props.onSelectModule(node.moduleId);
    } else if (node.parentId?.startsWith("module:")) {
      props.onSelectModule(node.parentId);
    }
  };

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
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (Math.hypot(dx, dy) > 3) {
      drag.moved = true;
    }
    setView({
      x: drag.view.x - dx / drag.view.zoom,
      y: drag.view.y - dy / drag.view.zoom,
      zoom: drag.view.zoom,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
      setDragging(false);
    }
  };

  const selectNode = (event: MouseEvent<SVGGElement>, node: DependencyGraphNode) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
    if (node.kind === "module") {
      props.onSelectFile("");
      props.onSelectModule(node.id);
      return;
    }
    if (node.kind === "port") {
      props.onSelectFile("");
      if (node.moduleId?.startsWith("module:")) {
        props.onSelectModule(node.moduleId);
      } else if (node.parentId?.startsWith("module:")) {
        props.onSelectModule(node.parentId);
      }
      return;
    }
    props.onSelectFile(node.path);
    if (node.moduleId?.startsWith("module:")) {
      props.onSelectModule(node.moduleId);
    } else if (node.parentId?.startsWith("module:")) {
      props.onSelectModule(node.parentId);
    }
  };

  const zoomToNode = (event: MouseEvent<SVGGElement>, node: DependencyGraphNode) => {
    event.stopPropagation();
    event.preventDefault();
    const nextZoom = drillZoomForNode(node, view.zoom);
    setView({ x: node.x, y: node.y, zoom: clamp(nextZoom, MIN_ZOOM, MAX_ZOOM) });
    setSelectedNodeId(node.id);
    if (node.kind === "module") {
      pendingFocusViewRef.current = { nodeId: node.id, zoom: nextZoom };
      props.onSelectFile("");
      props.onSelectModule(node.id);
      return;
    }
    if (node.kind === "port") {
      props.onSelectFile("");
      if (node.moduleId?.startsWith("module:")) {
        props.onSelectModule(node.moduleId);
      } else if (node.parentId?.startsWith("module:")) {
        props.onSelectModule(node.parentId);
      }
      return;
    }
    props.onSelectFile(node.path);
    if (node.moduleId?.startsWith("module:")) {
      props.onSelectModule(node.moduleId);
    } else if (node.parentId?.startsWith("module:")) {
      props.onSelectModule(node.parentId);
    }
  };

  return (
    <section className="dependency-graph-screen">
      <div className="dependency-graph-head">
        <div>
          <h2>Dependency Graph</h2>
          <span>
            {frame.nodes.length} nodes / {frame.edges.length} edges
          </span>
        </div>
        <div className="dependency-graph-legend" aria-label="Graph legend">
          <span className="legend-dot module" /> Module
          <span className="legend-dot port" /> Port
          <span className="legend-dot api" /> API/File
          <span className="legend-dot symbol" /> Exported symbol
          <span className="legend-line module-route" /> Module route
          <span className="legend-line detail-route" /> Detail route
        </div>
      </div>
      <div
        ref={wrapRef}
        className={dragging ? "dependency-graph-wrap dragging" : "dependency-graph-wrap"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className="dependency-graph" viewBox={viewBox} role="img" aria-label="Node dependency graph">
          <defs>
            <marker id="dependency-graph-arrow" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,5 L4.5,2.5 z" fill="#64748b" />
            </marker>
          </defs>
          <g className="dependency-graph-edges">
            {frame.edges.map((edge) => (
              <GraphEdge
                key={edge.id}
                edge={edge}
                frame={frame}
                selectedNode={selectedNode}
                selectedNodeId={selectedNode?.id ?? ""}
                relatedIds={relatedIds}
                zoom={view.zoom}
              />
            ))}
          </g>
          <g className="dependency-graph-nodes">
            {frame.nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                zoom={view.zoom}
                selected={node.id === selectedNode?.id}
                relation={nodeRelationToSelection(frame, node.id, selectedNode?.id ?? "", selectedModuleId)}
                related={relatedIds.has(node.id) || childIds.has(node.id)}
                showLabel={shouldShowNodeLabel(
                  node,
                  view.zoom,
                  node.id === selectedNode?.id,
                  relatedIds.has(node.id) || childIds.has(node.id),
                  nodeRelationToSelection(frame, node.id, selectedNode?.id ?? "", selectedModuleId),
                )}
                onClick={selectNode}
                onDoubleClick={zoomToNode}
              />
            ))}
          </g>
        </svg>
        <aside className="dependency-graph-minimap" aria-label="Graph minimap">
          <svg viewBox={`${frame.bounds.minX} ${frame.bounds.minY} ${frame.bounds.maxX - frame.bounds.minX} ${frame.bounds.maxY - frame.bounds.minY}`}>
            {frame.edges.slice(0, 220).map((edge) => {
              const from = frame.nodes.find((node) => node.id === edge.from);
              const to = frame.nodes.find((node) => node.id === edge.to);
              return from && to ? <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
            })}
            {frame.nodes.map((node) => (
              <circle key={node.id} cx={node.x} cy={node.y} r={Math.max(8, node.r)} className={node.id === selectedNode?.id ? "selected" : node.kind} />
            ))}
          </svg>
          <strong>{Math.round(view.zoom * 100)}%</strong>
        </aside>
        <div className="dependency-graph-toolbar">
          <button type="button" onClick={() => setView(fitFrame(frame, size))}>
            Fit
          </button>
          <span>Drag pan / wheel zoom / double click zoom</span>
        </div>
      </div>
        <GraphInspector frame={frame} selectedNode={selectedNode} relatedIds={relatedIds} onSelectNode={selectNodeById} />
    </section>
  );
}

function GraphEdge(props: {
  edge: DependencyGraphEdge;
  frame: DependencyGraphFrame;
  selectedNode?: DependencyGraphNode;
  selectedNodeId: string;
  relatedIds: Set<string>;
  zoom: number;
}) {
  const from = props.frame.nodes.find((node) => node.id === props.edge.from);
  const to = props.frame.nodes.find((node) => node.id === props.edge.to);
  if (!from || !to) {
    return null;
  }
  const relation = edgeRelationToSelection(props.edge, props.selectedNodeId, graphModuleId(props.selectedNode));
  const active = relation !== "unrelated";
  const dimmed = props.selectedNodeId ? !active && (!props.relatedIds.has(props.edge.from) || !props.relatedIds.has(props.edge.to)) : false;
  const line = shortenLine(from, to, props.zoom);
  const showArrow = active || props.edge.status !== "stable";
  const strokeWidth =
    props.edge.scope === "module"
      ? Math.min(4.4, 1.2 + Math.sqrt(props.edge.importCount) * 0.44)
      : Math.min(2.6, 0.6 + Math.sqrt(props.edge.importCount) * 0.3);
  return (
    <line
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
      markerEnd={showArrow ? "url(#dependency-graph-arrow)" : undefined}
      className={`dependency-graph-edge ${props.edge.scope}-route ${props.edge.status} ${relation}${active ? " active" : ""}${dimmed ? " dimmed" : ""}`}
      strokeWidth={strokeWidth}
    />
  );
}

function GraphNode(props: {
  node: DependencyGraphNode;
  zoom: number;
  selected: boolean;
  relation: SelectionNodeRelation;
  related: boolean;
  showLabel: boolean;
  onClick: (event: MouseEvent<SVGGElement>, node: DependencyGraphNode) => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>, node: DependencyGraphNode) => void;
}) {
  const radius = visualRadius(props.node, props.zoom);
  const labelOffset = radius + 6 / props.zoom;
  const labelSize = props.node.kind === "module" ? 13 / props.zoom : props.node.kind === "api" ? 11 / props.zoom : 9 / props.zoom;
  const subSize = 9 / props.zoom;
  const strokeWidth = 4 / props.zoom;
  const centeredLabel = props.node.kind === "api" || props.node.kind === "symbol";
  const labelX = centeredLabel ? props.node.x : props.node.x + labelOffset;
  const labelY = centeredLabel ? props.node.y + radius + 10 / props.zoom : props.node.y - 2 / props.zoom;
  const showSubLabel = props.node.kind === "module" || props.selected || props.relation === "dependency" || props.relation === "dependent";
  return (
    <g
      className={`dependency-graph-node ${props.node.kind} ${props.node.layer ?? ""} ${props.node.status} ${props.relation}${props.node.expanded ? " expanded" : ""}${props.selected ? " selected" : ""}${props.related ? " related" : ""}`}
      onClick={(event) => props.onClick(event, props.node)}
      onDoubleClick={(event) => props.onDoubleClick(event, props.node)}
    >
      {props.node.parentId ? <line x1={props.node.x} y1={props.node.y} x2={props.node.x} y2={props.node.y} className="dependency-parent-anchor" /> : null}
      <circle cx={props.node.x} cy={props.node.y} r={radius} />
      {props.node.previewNodes.map((preview) => (
        <circle
          key={preview.id}
          cx={props.node.x + preview.x * radius}
          cy={props.node.y + preview.y * radius}
          r={Math.max(2.2 / props.zoom, preview.r * radius)}
          className={`dependency-module-preview ${preview.layer} ${preview.status}`}
        >
          <title>{`${preview.path}\n${preview.loc} LOC`}</title>
        </circle>
      ))}
      {props.showLabel ? (
        <>
          <text
            x={labelX}
            y={labelY}
            className="dependency-node-label"
            style={{ fontSize: labelSize, strokeWidth }}
            textAnchor={centeredLabel ? "middle" : undefined}
          >
            {props.node.label}
          </text>
          {props.node.kind !== "symbol" && showSubLabel ? (
            <text
              x={labelX}
              y={centeredLabel ? labelY + 11 / props.zoom : props.node.y + 12 / props.zoom}
              className="dependency-node-sub"
              style={{ fontSize: subSize, strokeWidth }}
              textAnchor={centeredLabel ? "middle" : undefined}
            >
              {props.node.kind === "module"
                ? `${props.node.fileCount} files / ${formatNumber(props.node.loc)} LOC`
                : props.node.kind === "port"
                  ? `${props.node.portDirection ?? "port"} / ${formatNumber(Math.max(props.node.fanIn, props.node.fanOut))} imports`
                  : `${props.node.symbolCount} exports / fan ${props.node.fanIn}:${props.node.fanOut}`}
            </text>
          ) : null}
        </>
      ) : null}
      <title>{`${props.node.path}\n${props.node.kind} / ${props.node.loc} LOC`}</title>
    </g>
  );
}

function GraphInspector(props: {
  frame: DependencyGraphFrame;
  selectedNode?: DependencyGraphNode;
  relatedIds: Set<string>;
  onSelectNode: (nodeId: string) => void;
}) {
  if (!props.selectedNode) {
    return null;
  }
  const selectedModuleId = graphModuleId(props.selectedNode);
  const incoming = props.frame.edges.filter(
    (edge) => edge.to === props.selectedNode?.id || (selectedModuleId && edge.scope === "module" && edge.toModuleId === selectedModuleId),
  );
  const outgoing = props.frame.edges.filter(
    (edge) => edge.from === props.selectedNode?.id || (selectedModuleId && edge.scope === "module" && edge.fromModuleId === selectedModuleId),
  );
  const breakdown = props.frame.breakdowns[props.selectedNode.id] ?? (props.selectedNode.kind === "port" && props.selectedNode.parentId ? props.frame.breakdowns[props.selectedNode.parentId] : undefined);
  const nodeById = new Map(props.frame.nodes.map((node) => [node.id, node]));
  return (
    <aside className="dependency-graph-inspector">
      <div>
        <strong>{props.selectedNode.label}</strong>
        <span>{props.selectedNode.path}</span>
      </div>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{props.selectedNode.kind}</dd>
        </div>
        <div>
          <dt>LOC</dt>
          <dd>{formatNumber(props.selectedNode.loc)}</dd>
        </div>
        <div>
          <dt>Fan</dt>
          <dd>
            {props.selectedNode.fanIn}:{props.selectedNode.fanOut}
          </dd>
        </div>
        <div>
          <dt>Related</dt>
          <dd>{props.relatedIds.size}</dd>
        </div>
      </dl>
      <GraphNeighborList title="Depends On" edges={outgoing} side="to" nodeById={nodeById} onSelectNode={props.onSelectNode} />
      <GraphNeighborList title="Used By" edges={incoming} side="from" nodeById={nodeById} onSelectNode={props.onSelectNode} />
      <ImportBreakdownPanel
        selectedNode={props.selectedNode}
        breakdown={breakdown}
        onSelectPath={(path) => {
          const apiNode = props.frame.nodes.find((node) => node.kind === "api" && node.path === path);
          if (apiNode) {
            props.onSelectNode(apiNode.id);
            return;
          }
          const moduleNode = props.frame.nodes.find((node) => node.kind === "module" && path.startsWith(`${node.path}/`));
          if (moduleNode) {
            props.onSelectNode(moduleNode.id);
          }
        }}
      />
    </aside>
  );
}

function ImportBreakdownPanel(props: {
  selectedNode: DependencyGraphNode;
  breakdown?: DependencyGraphBreakdown;
  onSelectPath: (path: string) => void;
}) {
  const breakdown = props.breakdown;
  if (!breakdown) {
    return (
      <section className="import-breakdown">
        <h3>Import Breakdown</h3>
        <p>No import details</p>
      </section>
    );
  }

  return (
    <section className="import-breakdown">
      <h3>Import Breakdown</h3>
      <div className="import-breakdown-columns">
        <ImportBreakdownList
          title="Imports"
          selectedNode={props.selectedNode}
          direction="outgoing"
          details={breakdown.outgoing}
          onSelectPath={props.onSelectPath}
        />
        <ImportBreakdownList
          title="Imported By"
          selectedNode={props.selectedNode}
          direction="incoming"
          details={breakdown.incoming}
          onSelectPath={props.onSelectPath}
        />
      </div>
    </section>
  );
}

function ImportBreakdownList(props: {
  title: string;
  selectedNode: DependencyGraphNode;
  direction: "incoming" | "outgoing";
  details: DependencyGraphImportDetail[];
  onSelectPath: (path: string) => void;
}) {
  const rows =
    props.selectedNode.kind === "module"
      ? groupedImportRows(props.details, props.direction)
      : directImportRows(props.details, props.direction);

  return (
    <section>
      <h4>
        {props.title} <span>{props.details.length}</span>
      </h4>
      <ul>
        {rows.slice(0, 10).map((row) => (
          <li key={row.id} onClick={() => props.onSelectPath(row.primaryPath)}>
            <span>
              <strong>{compactPath(row.primaryPath)}</strong>
              <small>{row.secondary}</small>
            </span>
            <em>{row.count}</em>
          </li>
        ))}
        {rows.length === 0 ? <li className="empty-neighbor">None</li> : null}
      </ul>
    </section>
  );
}

type ImportBreakdownRow = {
  id: string;
  primaryPath: string;
  secondary: string;
  count: number;
};

function groupedImportRows(details: DependencyGraphImportDetail[], direction: "incoming" | "outgoing"): ImportBreakdownRow[] {
  const groups = new Map<string, { path: string; count: number; peers: Map<string, number>; externalCount: number }>();
  for (const detail of details) {
    const path = direction === "outgoing" ? detail.fromPath : detail.toPath;
    const peer = direction === "outgoing" ? detail.toPath : detail.fromPath;
    const group = groups.get(path) ?? { path, count: 0, peers: new Map(), externalCount: 0 };
    group.count += detail.importCount;
    group.peers.set(peer, (group.peers.get(peer) ?? 0) + detail.importCount);
    if (!detail.internal) {
      group.externalCount += detail.importCount;
    }
    groups.set(path, group);
  }
  return [...groups.values()]
    .map((group) => {
      const peers = [...group.peers.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([path, count]) => `${compactPath(path)} (${count})`);
      return {
        id: group.path,
        primaryPath: group.path,
        secondary: `${group.count - group.externalCount} internal / ${group.externalCount} external / ${peers.join(", ")}`,
        count: group.count,
      };
    })
    .sort((a, b) => b.count - a.count || a.primaryPath.localeCompare(b.primaryPath));
}

function directImportRows(details: DependencyGraphImportDetail[], direction: "incoming" | "outgoing"): ImportBreakdownRow[] {
  return details
    .map((detail) => {
      const primaryPath = direction === "outgoing" ? detail.toPath : detail.fromPath;
      const specifiers = detail.specifiers.slice(0, 3).join(", ");
      return {
        id: detail.id,
        primaryPath,
        secondary: `${detail.internal ? "internal" : "external"}${specifiers ? ` / ${specifiers}` : ""}`,
        count: detail.importCount,
      };
    })
    .sort((a, b) => b.count - a.count || a.primaryPath.localeCompare(b.primaryPath));
}

function GraphNeighborList(props: {
  title: string;
  edges: DependencyGraphEdge[];
  side: "from" | "to";
  nodeById: Map<string, DependencyGraphNode>;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <section>
      <h3>{props.title}</h3>
      <ul>
        {props.edges.slice(0, 12).map((edge) => {
          const nodeId = edge[props.side];
          const node = props.nodeById.get(nodeId);
          return (
            <li key={edge.id} onClick={() => props.onSelectNode(nodeId)}>
              <span>{node ? `${node.label} · ${node.path}` : nodeId}</span>
              <strong>{edge.importCount}</strong>
            </li>
          );
        })}
        {props.edges.length === 0 ? <li className="empty-neighbor">None</li> : null}
      </ul>
    </section>
  );
}

function relatedNodeIds(frame: DependencyGraphFrame, selectedNodeId: string, selectedModuleId?: string): Set<string> {
  const ids = new Set(selectedNodeId ? [selectedNodeId] : []);
  for (const edge of frame.edges) {
    if (edge.from === selectedNodeId) {
      ids.add(edge.to);
    }
    if (edge.to === selectedNodeId) {
      ids.add(edge.from);
    }
    if (edge.scope === "module" && selectedModuleId) {
      if (edge.fromModuleId === selectedModuleId) {
        ids.add(edge.from);
        ids.add(edge.to);
        if (edge.toModuleId) {
          ids.add(edge.toModuleId);
        }
      }
      if (edge.toModuleId === selectedModuleId) {
        ids.add(edge.from);
        ids.add(edge.to);
        if (edge.fromModuleId) {
          ids.add(edge.fromModuleId);
        }
      }
    }
  }
  return ids;
}

function fitFrame(frame: DependencyGraphFrame, size: { width: number; height: number }): GraphView {
  const width = Math.max(1, frame.bounds.maxX - frame.bounds.minX);
  const height = Math.max(1, frame.bounds.maxY - frame.bounds.minY);
  return {
    x: (frame.bounds.minX + frame.bounds.maxX) / 2,
    y: (frame.bounds.minY + frame.bounds.maxY) / 2,
    zoom: clamp(Math.min(size.width / (width * 1.08), size.height / (height * 1.08)), MIN_ZOOM, 0.65),
  };
}

function viewBoxFor(view: GraphView, size: { width: number; height: number }): string {
  const width = size.width / view.zoom;
  const height = size.height / view.zoom;
  return `${view.x - width / 2} ${view.y - height / 2} ${width} ${height}`;
}

function zoomAt(view: GraphView, size: { width: number; height: number }, point: { x: number; y: number }, nextZoom: number): GraphView {
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

export function shouldShowNodeLabel(node: DependencyGraphNode, zoom: number, selected: boolean, related: boolean, relation: SelectionNodeRelation): boolean {
  if (selected) {
    return true;
  }
  if (node.kind === "port") {
    return zoom >= 3.2 && (relation === "dependency" || relation === "dependent");
  }
  if (relation === "dependency" || relation === "dependent") {
    return true;
  }
  if (node.kind === "module") {
    return zoom <= 1.4 || related || node.hotspotScore > 0;
  }
  if (node.kind === "api") {
    if (related && zoom >= 1.65) {
      return true;
    }
    return selected || (zoom >= 2.1 && related && (node.fanIn + node.fanOut >= 18 || node.hotspotScore > 0)) || (zoom >= 2.8 && node.fanIn + node.fanOut >= 10);
  }
  return selected || (zoom >= 3.6 && related);
}

export function drillZoomForNode(node: DependencyGraphNode, currentZoom: number): number {
  if (node.kind === "module") {
    return Math.max(currentZoom * 1.75, 3.2);
  }
  if (node.kind === "api") {
    return Math.max(currentZoom * 1.65, 3);
  }
  return Math.max(currentZoom * 1.4, 4.5);
}

export function edgeRelationToSelection(edge: DependencyGraphEdge, selectedNodeId: string, selectedParentId?: string): SelectionEdgeRelation {
  if (!selectedNodeId) {
    return "unrelated";
  }
  if (edge.from === selectedNodeId) {
    return "depends-on";
  }
  if (edge.to === selectedNodeId) {
    return "used-by";
  }
  if (edge.scope === "module" && selectedParentId) {
    const fromModuleId = edge.fromModuleId ?? moduleIdForEndpoint(edge.from);
    const toModuleId = edge.toModuleId ?? moduleIdForEndpoint(edge.to);
    if (fromModuleId === selectedParentId) {
      return "depends-on";
    }
    if (toModuleId === selectedParentId) {
      return "used-by";
    }
  }
  return "unrelated";
}

export function nodeRelationToSelection(frame: DependencyGraphFrame, nodeId: string, selectedNodeId: string, selectedParentId?: string): SelectionNodeRelation {
  if (!selectedNodeId) {
    return "unrelated";
  }
  if (nodeId === selectedNodeId) {
    return "selected";
  }
  for (const edge of frame.edges) {
    if (edge.from === selectedNodeId && edge.to === nodeId) {
      return "dependency";
    }
    if (edge.to === selectedNodeId && edge.from === nodeId) {
      return "dependent";
    }
    if (edge.scope === "module" && selectedParentId) {
      const fromModuleId = edge.fromModuleId ?? nodeModuleId(frame, edge.from);
      const toModuleId = edge.toModuleId ?? nodeModuleId(frame, edge.to);
      const currentModuleId = nodeModuleId(frame, nodeId);
      if (fromModuleId === selectedParentId && currentModuleId === toModuleId) {
        return "dependency";
      }
      if (toModuleId === selectedParentId && currentModuleId === fromModuleId) {
        return "dependent";
      }
    }
  }
  return "unrelated";
}

function graphModuleId(node?: DependencyGraphNode): string | undefined {
  if (!node) {
    return undefined;
  }
  if (node.kind === "module") {
    return node.id;
  }
  if (node.moduleId?.startsWith("module:")) {
    return node.moduleId;
  }
  return node.parentId?.startsWith("module:") ? node.parentId : undefined;
}

function nodeModuleId(frame: DependencyGraphFrame, nodeId: string): string | undefined {
  const node = frame.nodes.find((item) => item.id === nodeId);
  if (node) {
    return graphModuleId(node) ?? (node.id.startsWith("module:") ? node.id : undefined);
  }
  return moduleIdForEndpoint(nodeId);
}

function moduleIdForEndpoint(endpointId: string): string | undefined {
  if (endpointId.startsWith("module:")) {
    return endpointId;
  }
  if (endpointId.startsWith("port:")) {
    const prefix = /^port:(?:in|out):/.exec(endpointId)?.[0];
    if (!prefix) {
      return undefined;
    }
    const body = endpointId.slice(prefix.length);
    const separator = body.indexOf("->module:");
    return separator >= 0 ? body.slice(0, separator) : undefined;
  }
  return undefined;
}

function visualRadius(node: DependencyGraphNode, zoom: number): number {
  if (node.expanded) {
    return node.r;
  }
  return Math.max(4 / zoom, node.r / zoom);
}

function shortenLine(from: DependencyGraphNode, to: DependencyGraphNode, zoom: number) {
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
    x2: to.x - ux * (toRadius + 4 / zoom),
    y2: to.y - uy * (toRadius + 4 / zoom),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function compactPath(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 3) {
    return path;
  }
  return `${parts.slice(0, 2).join("/")}/.../${parts.at(-1)}`;
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
