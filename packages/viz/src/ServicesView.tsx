import { useMemo, useState } from "preact/hooks";
import type {
  ServiceEdge,
  ServiceGraph,
  ServiceNode,
  ServiceResource,
  ServiceStore,
  ServiceStoreEdge,
} from "@sprawlens/schema";
import {
  createForceLayout,
  forceStep,
  type ClipRegion,
  type Vec2,
} from "@sprawlens/layout";
import { useMapViewport } from "./useMapViewport.ts";
import { SERVICE_EDGE_COLORS, SERVICE_STORE_COLOR } from "./mapShared.tsx";

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

/** Detail thresholds on a service's on-screen size (world radius / view width):
 * resources fade in from R1, the code cells from R2. Zooming in shrinks the view
 * width, so the ratio grows and detail appears — semantic zoom, no clicks. */
const RES_FADE: [number, number] = [0.05, 0.09];
const CODE_FADE: [number, number] = [0.11, 0.16];

/** Clamp a value's position within [lo, hi] to a 0..1 ramp. */
function ramp(x: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
}

/** Place the i-th of `count` children on a ring; a single child sits centered. */
function ringPlace(i: number, count: number, ringR: number): Vec2 {
  if (count <= 1) return { x: 0, y: 0 };
  const a = (i / count) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * ringR, y: Math.sin(a) * ringR };
}

/** Place the i-th of `count` cells in a centered square grid of side `span`. */
function gridCell(
  i: number,
  count: number,
  span: number,
): { x: number; y: number; size: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const cell = span / Math.max(cols, rows);
  return {
    x: ((i % cols) - (cols - 1) / 2) * cell,
    y: (Math.floor(i / cols) - (rows - 1) / 2) * cell,
    size: cell * 0.66,
  };
}

const baseName = (p: string): string => p.split("/").pop() ?? p;
const shortAddress = (a: string): string => a.split(".").slice(-1)[0] ?? a;

type Placed = { node: ServiceNode; pos: Vec2; r: number };
type PlacedStore = { store: ServiceStore; pos: Vec2; r: number };
type Layout = {
  placed: Placed[];
  stores: PlacedStore[];
  posOf: Map<string, Vec2>;
  edges: ServiceEdge[];
  storeEdges: ServiceStoreEdge[];
};

/** Fixed display radius for an external store node (secondary to services). */
const STORE_R = 22;

/**
 * Run the force layout to convergence, then fit it (aspect-preserving) into the
 * fixed CANVAS_W×CANVAS_H so the shared viewport's initial viewBox frames it.
 * Services and external stores are laid out together (store references pull a
 * store toward the services that use it).
 */
function layoutServices(graph: ServiceGraph): Layout {
  const storeList = graph.stores ?? [];
  const storeEdges = graph.storeEdges ?? [];
  const nodes = [
    ...graph.services.map((s) => ({
      id: s.id,
      weight: Math.max(s.metrics.resources, 1),
    })),
    ...storeList.map((s) => ({ id: s.id, weight: 1 })),
  ];
  const edges = [
    ...graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight ?? 1,
    })),
    ...storeEdges.map((e) => ({
      source: e.service,
      target: e.store,
      weight: e.weight ?? 1,
    })),
  ];
  let state = createForceLayout(nodes, edges, CLIP, {
    seed: 7,
    gravity: 0.008,
    repulsionStrength: 0.14,
    springStrength: 0.05,
  });
  for (let i = 0; i < ITERATIONS; i++) state = forceStep(state);

  const svcById = new Map(graph.services.map((s) => [s.id, s]));
  const storeById = new Map(storeList.map((s) => [s.id, s]));
  const solved: Placed[] = [];
  const solvedStores: PlacedStore[] = [];
  for (const [id, pos] of state.positions) {
    const svc = svcById.get(id);
    if (svc) {
      solved.push({ node: svc, pos, r: displayRadius(svc.metrics.resources) });
      continue;
    }
    const store = storeById.get(id);
    if (store) solvedStores.push({ store, pos, r: STORE_R });
  }

  // bbox over everything, then a single scale/offset to center it in the canvas
  // content box (CANVAS minus MARGIN), so labels never clip the edges.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of [...solved, ...solvedStores]) {
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
  const stores = solvedStores.map((p) => ({ ...p, pos: fit(p.pos), r: p.r * scale }));
  const posOf = new Map(
    [...placed, ...stores].map((p) => [
      "node" in p ? p.node.id : p.store.id,
      p.pos,
    ]),
  );
  return { placed, stores, posOf, edges: graph.edges, storeEdges };
}

/**
 * One service in the plane. Its terraform resources — and inside each, the code
 * (files) it implements — are laid out within the service's own circle and
 * revealed by zoom: when the circle is small on screen it is just a labeled
 * disc; zoom in and the resources fade in, zoom further and the code cells do.
 * `resOpacity` / `codeOpacity` are the LOD ramps the host computes from zoom.
 */
function ServiceCell(props: {
  service: ServiceNode;
  resources: ServiceResource[];
  pos: Vec2;
  r: number;
  dark: boolean;
  ink: string;
  labelSize: number;
  resLabelSize: number;
  strokeW: number;
  dim: boolean;
  resOpacity: number;
  codeOpacity: number;
  onHover: (id: string | null) => void;
}): preact.JSX.Element {
  const { service, resources, pos, r, dark, ink, labelSize, resLabelSize, strokeW } =
    props;
  const count = resources.length;
  const ringR = count > 1 ? r * 0.5 : 0;
  const resR = count > 1 ? r * 0.3 : r * 0.58;
  return (
    <g
      transform={`translate(${pos.x} ${pos.y})`}
      opacity={props.dim ? 0.35 : 1}
      onPointerEnter={() => props.onHover(service.id)}
      onPointerLeave={() => props.onHover(null)}
      style={{ cursor: "pointer" }}
    >
      <circle
        r={r}
        fill={dark ? "#1e293b" : "#e2e8f0"}
        stroke="#0891b2"
        stroke-width={strokeW}
      />
      <text
        y={r + labelSize + 1}
        text-anchor="middle"
        font-size={labelSize}
        fill={ink}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {service.label}
      </text>
      <title>
        {service.id}
        {service.resourceType ? `\n${service.resourceType}` : ""}
        {`\n${service.metrics.resources} resource(s) — zoom in for code`}
      </title>
      {props.resOpacity > 0 ? (
        <g opacity={props.resOpacity}>
          {resources.map((res, i) => {
            const c = ringPlace(i, count, ringR);
            const files = res.files ?? [];
            return (
              <g key={res.address} transform={`translate(${c.x} ${c.y})`}>
                <circle
                  r={resR}
                  fill={dark ? "#0f172a" : "#f1f5f9"}
                  stroke="#64748b"
                  stroke-width={strokeW * 0.6}
                >
                  <title>
                    {res.address}
                    {res.source ? `\n→ ${res.source}` : "\n(no code source)"}
                    {`\n${files.length} file(s)${res.loc ? `, ${res.loc} loc` : ""}`}
                  </title>
                </circle>
                {/* the resource's code: one cell per source file */}
                {props.codeOpacity > 0 ? (
                  <g opacity={props.codeOpacity}>
                    {files.map((f, j) => {
                      const cell = gridCell(j, files.length, resR * 1.25);
                      return (
                        <rect
                          key={f}
                          x={cell.x - cell.size / 2}
                          y={cell.y - cell.size / 2}
                          width={cell.size}
                          height={cell.size}
                          rx={cell.size * 0.18}
                          fill={dark ? "#475569" : "#94a3b8"}
                        >
                          <title>{baseName(f)}</title>
                        </rect>
                      );
                    })}
                    {files.length === 0 ? (
                      <text
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size={resLabelSize}
                        fill={ink}
                        opacity={0.4}
                        style={{ pointerEvents: "none" }}
                      >
                        infra
                      </text>
                    ) : (
                      <text
                        y={resR + resLabelSize + 1}
                        text-anchor="middle"
                        font-size={resLabelSize}
                        fill={ink}
                        opacity={0.8}
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {shortAddress(res.address)}
                      </text>
                    )}
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}
    </g>
  );
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
  const resourcesByService = useMemo(() => {
    const map = new Map<string, ServiceResource[]>();
    for (const r of graph?.resources ?? []) {
      const bucket = map.get(r.service);
      if (bucket) bucket.push(r);
      else map.set(r.service, [r]);
    }
    return map;
  }, [graph]);

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

  // the service label stays a roughly constant on-screen size at any zoom (world
  // units scale with the view width); internal resource labels are world-fixed
  // so they only become legible once you've zoomed into the service.
  const serviceLabelSize = view.w / 45;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
            stroke-width={Math.max(view.w / 600, (e.weight ?? 1) * (view.w / 900))}
            stroke-opacity={dim ? 0.1 : 0.7}
            marker-end={`url(#svc-arrow-${e.kind})`}
          >
            <title>
              {e.source} {EDGE_LABEL[e.kind]} {e.target}
              {e.via ? ` (via ${e.via})` : ""}
            </title>
          </line>
        );
      })}
      {/* store-reference edges: a service uses an external store (dashed) */}
      {layout.storeEdges.map((e, i) => {
        const a = layout.posOf.get(e.service);
        const b = layout.posOf.get(e.store);
        if (!a || !b) return null;
        const dim = hover !== null && hover !== e.service && hover !== e.store;
        return (
          <line
            key={`s${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={SERVICE_STORE_COLOR}
            stroke-width={Math.max(view.w / 700, (e.weight ?? 1) * (view.w / 1000))}
            stroke-opacity={dim ? 0.08 : 0.5}
            stroke-dasharray={`${view.w / 120} ${view.w / 200}`}
          >
            <title>
              {e.service} uses {e.store}
              {e.via ? ` (via ${e.via})` : ""}
            </title>
          </line>
        );
      })}
      {/* service nodes: their resources + code fade in as you zoom (semantic
          zoom). on-screen size = world radius / view width. */}
      {layout.placed.map((p) => {
        const relSize = p.r / view.w;
        return (
          <ServiceCell
            key={p.node.id}
            service={p.node}
            resources={resourcesByService.get(p.node.id) ?? []}
            pos={p.pos}
            r={p.r}
            dark={props.dark}
            ink={ink}
            labelSize={serviceLabelSize}
            resLabelSize={view.w / 78}
            strokeW={view.w / 700}
            dim={hover !== null && hover !== p.node.id}
            resOpacity={ramp(relSize, RES_FADE[0], RES_FADE[1])}
            codeOpacity={ramp(relSize, CODE_FADE[0], CODE_FADE[1])}
            onHover={setHover}
          />
        );
      })}
      {/* external store nodes (S3, DynamoDB, …): rounded rects, set apart from
          the service circles by shape + color */}
      {layout.stores.map((s) => {
        const dim = hover !== null && hover !== s.store.id;
        const size = s.r * 1.6;
        return (
          <g
            key={s.store.id}
            transform={`translate(${s.pos.x} ${s.pos.y})`}
            opacity={dim ? 0.35 : 1}
            onPointerEnter={() => setHover(s.store.id)}
            onPointerLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              rx={size * 0.16}
              fill={props.dark ? "#3f2d0b" : "#fef3c7"}
              stroke={SERVICE_STORE_COLOR}
              stroke-width={view.w / 700}
            />
            <text
              y={s.r + serviceLabelSize * 0.85 + 1}
              text-anchor="middle"
              font-size={serviceLabelSize * 0.85}
              fill={ink}
              opacity={0.85}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {s.store.label}
            </text>
            <title>
              {s.store.address}
              {`\n${s.store.type}`}
            </title>
          </g>
        );
      })}
      {/* count badge — pinned to the current viewport's top-right corner */}
      <text
        x={view.x + view.w * 0.98}
        y={view.y + view.h * 0.04}
        text-anchor="end"
        font-size={view.w / 64}
        fill={ink}
        opacity={0.6}
      >
        {graph.services.length} services · {graph.edges.length} links
      </text>
    </svg>
      {/* edge-kind legend: screen-fixed at the bottom-left, does not pan/zoom */}
      <div
        style={{
          position: "absolute",
          left: "12px",
          bottom: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          fontSize: "11px",
          color: ink,
          opacity: 0.85,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {Object.entries(EDGE_LABEL).map(([kind, label]) => (
          <div
            key={kind}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span
              style={{
                width: "22px",
                borderTop: `2px solid ${edgeColor(kind as ServiceEdge["kind"])}`,
              }}
            />
            <span>{label}</span>
          </div>
        ))}
        {graph.stores && graph.stores.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "22px",
                borderTop: `2px dashed ${SERVICE_STORE_COLOR}`,
              }}
            />
            <span>uses store (S3, …)</span>
          </div>
        ) : null}
      </div>
    </div>
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
