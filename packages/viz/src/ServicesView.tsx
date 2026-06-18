import { useMemo, useState } from "preact/hooks";
import type { ServiceEdge, ServiceGraph, ServiceNode } from "@sprawlens/schema";
import {
  createForceLayout,
  forceStep,
  type ClipRegion,
  type Vec2,
} from "@sprawlens/layout";
import { useMapViewport } from "./useMapViewport.ts";
import { SERVICE_EDGE_COLORS } from "./mapShared.tsx";

/**
 * The upper "service" layer: the terraform-derived service graph rendered as a
 * standalone force-directed plane (nodes = services sized by their resource
 * count, edges styled by communication kind). It shares the map's zoom/pan
 * (useMapViewport) and edge palette (mapShared) instead of reimplementing them,
 * and the service graph is fetched once by the host (App) and handed in, so the
 * /api/services endpoint isn't hit twice. Only the force layout itself is local.
 * Phase B folds this into the hierarchy as the top boundary.
 */

const EDGE_LABEL: Record<ServiceEdge["kind"], string> = {
  depends: "depends on",
  invoke: "invokes",
  queue: "queue →",
  event: "event →",
  http: "http →",
};

/** Fixed logical canvas the graph is fit into; useMapViewport frames it as the
 * initial viewBox and letterboxes it to the container (as the rings map does). */
const CANVAS_W = 960;
const CANVAS_H = 640;
const MARGIN = 70;

const CLIP: ClipRegion = { kind: "circle", cx: 0, cy: 0, r: 320 };
const ITERATIONS = 600;

const edgeColor = (kind: ServiceEdge["kind"]): string =>
  SERVICE_EDGE_COLORS[kind] ?? "#64748b";

/** Display radius for a service node, before canvas fitting. Independent of the
 * force layout's area-filling radii (which balloon for a sparse graph and
 * overlap); we use the solved positions and draw compact circles. */
function displayRadius(resources: number): number {
  return 16 + 11 * Math.sqrt(Math.max(resources, 1));
}

type Placed = { node: ServiceNode; pos: Vec2; r: number };
type Layout = { placed: Placed[]; posOf: Map<string, Vec2>; edges: ServiceEdge[] };

/**
 * Run the force layout to convergence, then fit it (aspect-preserving) into the
 * fixed CANVAS_W×CANVAS_H so the shared viewport's initial viewBox frames it.
 */
function layoutServices(graph: ServiceGraph): Layout {
  const nodes = graph.services.map((s) => ({
    id: s.id,
    weight: Math.max(s.metrics.resources, 1),
  }));
  const edges = graph.edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight ?? 1,
  }));
  let state = createForceLayout(nodes, edges, CLIP, {
    seed: 7,
    gravity: 0.008,
    repulsionStrength: 0.14,
    springStrength: 0.05,
  });
  for (let i = 0; i < ITERATIONS; i++) state = forceStep(state);

  const byId = new Map(graph.services.map((s) => [s.id, s]));
  const solved: Placed[] = [];
  for (const [id, pos] of state.positions) {
    const node = byId.get(id);
    if (node) solved.push({ node, pos, r: displayRadius(node.metrics.resources) });
  }

  // bbox of the solved graph, then a single scale/offset to center it in the
  // canvas content box (CANVAS minus MARGIN), so labels never clip the edges.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of solved) {
    minX = Math.min(minX, p.pos.x - p.r);
    minY = Math.min(minY, p.pos.y - p.r);
    maxX = Math.max(maxX, p.pos.x + p.r);
    maxY = Math.max(maxY, p.pos.y + p.r);
  }
  if (!Number.isFinite(minX)) {
    minX = -1;
    minY = -1;
    maxX = 1;
    maxY = 1;
  }
  const boxW = CANVAS_W - MARGIN * 2;
  const boxH = CANVAS_H - MARGIN * 2;
  const scale = Math.min(boxW / (maxX - minX || 1), boxH / (maxY - minY || 1));
  const offX = MARGIN + (boxW - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = MARGIN + (boxH - (maxY - minY) * scale) / 2 - minY * scale;
  const fit = (p: Vec2): Vec2 => ({ x: p.x * scale + offX, y: p.y * scale + offY });

  const placed = solved.map((p) => ({ ...p, pos: fit(p.pos), r: p.r * scale }));
  const posOf = new Map(placed.map((p) => [p.node.id, p.pos]));
  return { placed, posOf, edges: graph.edges };
}

export function ServicesView(props: {
  /** Fetched once by the host; null until it resolves. */
  graph: ServiceGraph | null;
  dark: boolean;
  ink: string;
}): preact.JSX.Element {
  const { graph, ink } = props;
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => (graph ? layoutServices(graph) : null), [graph]);

  // shared map zoom/pan: wheel-to-cursor zoom, drag pan, LOD-committed view.
  const { svgProps, committedView } = useMapViewport({
    width: CANVAS_W,
    height: CANVAS_H,
  });
  const view = committedView;

  if (!graph || !layout) {
    return <Centered ink={ink}>loading services…</Centered>;
  }
  if (graph.services.length === 0) {
    return (
      <Centered ink={ink}>
        no terraform detected — add <code>.tf</code> files or a{" "}
        <code>[terraform]</code> root in sprawlens.toml
      </Centered>
    );
  }

  // zoom-responsive sizing: world units scaled by the committed view width keep
  // strokes / labels roughly constant on screen as you zoom.
  const fontFor = (r: number): number =>
    Math.max(view.w / 56, Math.min(r * 0.7, view.w / 22));

  return (
    <svg
      {...svgProps}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ cursor: "grab", touchAction: "none" }}
    >
      <defs>
        {Object.keys(EDGE_LABEL).map((kind) => (
          <marker
            key={kind}
            id={`svc-arrow-${kind}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={edgeColor(kind as ServiceEdge["kind"])} />
          </marker>
        ))}
      </defs>
      {/* edges */}
      {layout.edges.map((e, i) => {
        const a = layout.posOf.get(e.source);
        const b = layout.posOf.get(e.target);
        if (!a || !b) return null;
        const dim = hover !== null && hover !== e.source && hover !== e.target;
        return (
          <line
            key={`e${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={edgeColor(e.kind)}
            strokeWidth={Math.max(view.w / 600, (e.weight ?? 1) * (view.w / 900))}
            strokeOpacity={dim ? 0.1 : 0.7}
            markerEnd={`url(#svc-arrow-${e.kind})`}
          >
            <title>
              {e.source} {EDGE_LABEL[e.kind]} {e.target}
              {e.via ? ` (via ${e.via})` : ""}
            </title>
          </line>
        );
      })}
      {/* service nodes */}
      {layout.placed.map((p) => {
        const dim = hover !== null && hover !== p.node.id;
        return (
          <g
            key={p.node.id}
            transform={`translate(${p.pos.x} ${p.pos.y})`}
            opacity={dim ? 0.35 : 1}
            onPointerEnter={() => setHover(p.node.id)}
            onPointerLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              r={p.r}
              fill={props.dark ? "#1e293b" : "#e2e8f0"}
              stroke="#0891b2"
              strokeWidth={view.w / 700}
            />
            <text
              y={p.r + fontFor(p.r) + 1}
              textAnchor="middle"
              fontSize={fontFor(p.r)}
              fill={ink}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {p.node.label}
            </text>
            <title>
              {p.node.id}
              {p.node.resourceType ? `\n${p.node.resourceType}` : ""}
              {`\n${p.node.metrics.resources} resource(s)`}
              {p.node.source ? `\n→ ${p.node.source.join(", ")}` : ""}
            </title>
          </g>
        );
      })}
      {/* legend — pinned to the current viewport's top-left corner */}
      <g transform={`translate(${view.x + view.w * 0.02} ${view.y + view.h * 0.04})`}>
        {Object.entries(EDGE_LABEL).map(([kind, label], i) => (
          <g key={kind} transform={`translate(0 ${i * (view.h / 26)})`}>
            <line
              x1={0}
              y1={0}
              x2={view.w / 28}
              y2={0}
              stroke={edgeColor(kind as ServiceEdge["kind"])}
              strokeWidth={view.w / 500}
            />
            <text
              x={view.w / 24}
              y={view.h / 90}
              fontSize={view.w / 64}
              fill={ink}
              opacity={0.7}
            >
              {label}
            </text>
          </g>
        ))}
      </g>
      {/* count badge — pinned to the current viewport's top-right corner */}
      <text
        x={view.x + view.w * 0.98}
        y={view.y + view.h * 0.04}
        textAnchor="end"
        fontSize={view.w / 64}
        fill={ink}
        opacity={0.6}
      >
        {graph.services.length} services · {graph.edges.length} links
      </text>
    </svg>
  );
}

function Centered(props: {
  ink: string;
  children: preact.ComponentChildren;
}): preact.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: props.ink,
        fontSize: "13px",
        opacity: 0.7,
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      <div>{props.children}</div>
    </div>
  );
}
