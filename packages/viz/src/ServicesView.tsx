import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ServiceEdge, ServiceGraph, ServiceNode } from "@sprawlens/schema";
import {
  createForceLayout,
  forceStep,
  type ClipRegion,
  type Vec2,
} from "@sprawlens/layout";

/**
 * The upper "service" layer: the terraform-derived service graph rendered as a
 * standalone force-directed plane (nodes = services sized by their resource
 * count, edges styled by communication kind). Self-contained — it fetches
 * /api/services, runs the force layout to convergence, and owns its own
 * pan/zoom. Phase B will fold this into the hierarchy as the top boundary.
 */

const EDGE_COLOR: Record<ServiceEdge["kind"], string> = {
  depends: "#64748b",
  invoke: "#ea580c",
  queue: "#0891b2",
  event: "#7c3aed",
  http: "#16a34a",
};

const EDGE_LABEL: Record<ServiceEdge["kind"], string> = {
  depends: "depends on",
  invoke: "invokes",
  queue: "queue →",
  event: "event →",
  http: "http →",
};

const CLIP: ClipRegion = { kind: "circle", cx: 0, cy: 0, r: 320 };
const ITERATIONS = 600;

/** Display radius for a service node. Independent of the force layout's
 * area-filling radii (which balloon for a sparse graph and overlap); we just
 * use the solved positions and draw compact, well-separated circles. */
function displayRadius(resources: number): number {
  return 16 + 11 * Math.sqrt(Math.max(resources, 1));
}

type Placed = { node: ServiceNode; pos: Vec2; r: number };
type Layout = {
  placed: Placed[];
  posOf: Map<string, Vec2>;
  edges: ServiceEdge[];
  view: ViewBox;
};
type ViewBox = { x: number; y: number; w: number; h: number };

/** Run the force layout to convergence and frame it. */
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
  const placed: Placed[] = [];
  for (const [id, pos] of state.positions) {
    const node = byId.get(id);
    if (node) placed.push({ node, pos, r: displayRadius(node.metrics.resources) });
  }
  // frame the bbox with padding so labels are not clipped
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.pos.x - p.r);
    minY = Math.min(minY, p.pos.y - p.r);
    maxX = Math.max(maxX, p.pos.x + p.r);
    maxY = Math.max(maxY, p.pos.y + p.r);
  }
  if (!Number.isFinite(minX)) {
    minX = -10;
    minY = -10;
    maxX = 10;
    maxY = 10;
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.15 + 40;
  const view: ViewBox = {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
  return { placed, posOf: state.positions, edges: graph.edges, view };
}

export function ServicesView(props: {
  dark: boolean;
  ink: string;
}): preact.JSX.Element {
  const { ink } = props;
  const [graph, setGraph] = useState<ServiceGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((json: ServiceGraph) => live && setGraph(json))
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, []);

  const layout = useMemo(() => (graph ? layoutServices(graph) : null), [graph]);

  // pan/zoom over the fitted viewBox
  const [view, setView] = useState<ViewBox | null>(null);
  useEffect(() => {
    if (layout) setView(layout.view);
  }, [layout]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (error) {
    return <Centered ink={ink}>service graph unavailable ({error})</Centered>;
  }
  if (!graph || !layout || !view) {
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

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const k = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    const w = view.w * k;
    const h = view.h * k;
    setView({
      x: view.x + (view.w - w) * fx,
      y: view.y + (view.h - h) * fy,
      w,
      h,
    });
  };
  const onPointerDown = (e: PointerEvent): void => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / rect.width) * view.w;
    const dy = ((e.clientY - drag.current.y) / rect.height) * view.h;
    drag.current = { x: e.clientX, y: e.clientY };
    setView({ ...view, x: view.x - dx, y: view.y - dy });
  };
  const onPointerUp = (): void => {
    drag.current = null;
  };

  const fontFor = (r: number): number =>
    Math.max(view.w / 56, Math.min(r * 0.7, view.w / 22));

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={{ cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <defs>
        {Object.entries(EDGE_COLOR).map(([kind, color]) => (
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
            <path d="M0 0 L10 5 L0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
      {/* edges */}
      {layout.edges.map((e, i) => {
        const a = layout.posOf.get(e.source);
        const b = layout.posOf.get(e.target);
        if (!a || !b) return null;
        const color = EDGE_COLOR[e.kind];
        const dim = hover !== null && hover !== e.source && hover !== e.target;
        return (
          <line
            key={`e${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
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
      {/* legend */}
      <g transform={`translate(${view.x + view.w * 0.02} ${view.y + view.h * 0.04})`}>
        {Object.entries(EDGE_LABEL).map(([kind, label], i) => (
          <g key={kind} transform={`translate(0 ${i * (view.h / 26)})`}>
            <line
              x1={0}
              y1={0}
              x2={view.w / 28}
              y2={0}
              stroke={EDGE_COLOR[kind as ServiceEdge["kind"]]}
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
      {/* count badge */}
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
