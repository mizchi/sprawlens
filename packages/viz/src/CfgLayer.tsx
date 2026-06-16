import { useMemo, useState } from "preact/hooks";
import type { DetailGraph } from "@sprawlens/schema";
import type { AtlasNode } from "@sprawlens/schema";
import { layoutCfg } from "@sprawlens/layout";
import { FILE_LABEL_INK, MACRO_EDGE, SELECT_STROKE } from "./mapShared.tsx";
import type { Vec2 } from "@sprawlens/layout";

/**
 * Control-flow diagrams drawn inside symbol cells, in flowchart notation:
 * decisions are diamonds, loop heads hexagons, plain blocks process
 * rectangles, terminals dots. The diagram fills the Voronoi cell — the
 * entry sits just below the cell's topmost vertex, the exit just above
 * its bottommost one, and each row spreads into the cell's horizontal
 * slab at that height (convex cells make this exact). Every return is its
 * own terminal; loop back edges arc on the right, recursion arcs around
 * the left back to the entry. All edges carry arrowheads — no dashes.
 * Code shows as a hover tooltip only. This rendering is for function
 * symbols; types and classes will get their own treatment.
 */

export type CfgEntry = {
  id: string;
  /** World-space bbox of the host symbol cell. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Host cell outline; rows fit its horizontal slabs. */
  polygon: readonly Vec2[];
  graph: DetailGraph;
};

const BRANCH_RE = /^(if|switch)\b/;
const LOOP_RE = /^(for|while|do)\b/;
const RETURN_RE = /^(return|throw)\b/;

const PLAIN_RE = /^(if|switch|for|while|do|return|throw)\b/;
const IO_RE = /^(await|fetch)$/;

const BRANCH_FILL = "#d97706";
const LOOP_FILL = "#0e7490";
const RETURN_FILL = "#be123c";
const BLOCK_FILL = "#64748b";
/** Entry follows the selection blue; exit/edges follow the theme ink. */
const entryFill = () => SELECT_STROKE;
const exitFill = () => FILE_LABEL_INK;
const edgeStroke = () => MACRO_EDGE;
/** Effect badges: external mutation vs async/external I/O. */
const MUTATION_BADGE = "#e11d48";
const IO_BADGE = "#7c3aed";

const CFG_ARROW_ID = "cfg-arrow";

function points(pairs: [number, number][]): string {
  return pairs.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Horizontal extent of a convex ring at height y. */
function slabAt(
  ring: readonly Vec2[],
  y: number,
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if ((a.y - y) * (b.y - y) > 0) continue;
    const dy = b.y - a.y;
    const t = Math.abs(dy) < 1e-9 ? 0 : (y - a.y) / dy;
    const x = a.x + (b.x - a.x) * Math.min(1, Math.max(0, t));
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  return min <= max ? [min, max] : null;
}

/** One node in flowchart notation; hovering reveals the source code. */
function CfgShape(props: {
  node: AtlasNode;
  x: number;
  y: number;
  size: number;
  effects: readonly string[];
  onHover: (id: string | null) => void;
}) {
  const { node, x, y, size, effects } = props;
  const stop = (event: MouseEvent) => event.stopPropagation();
  const hoverProps = {
    onClick: stop,
    onMouseEnter: () => props.onHover(node.id),
    onMouseLeave: () => props.onHover(null),
  };
  // effect badges sit at the shape's shoulder: red = writes outside the
  // scope, violet = await / fetch (external I/O)
  const hasMutation = effects.some((e) => !IO_RE.test(e));
  const hasIo = effects.some((e) => IO_RE.test(e));
  const badges = (
    <>
      {hasMutation ? (
        <circle
          cx={x + size * 1.15}
          cy={y - size * 0.85}
          r={size * 0.32}
          fill={MUTATION_BADGE}
          {...hoverProps}
        />
      ) : null}
      {hasIo ? (
        <circle
          cx={x + size * (hasMutation ? 1.95 : 1.15)}
          cy={y - size * 0.85}
          r={size * 0.32}
          fill={IO_BADGE}
          {...hoverProps}
        />
      ) : null}
    </>
  );
  let shape;
  if (node.label === "entry" || node.label === "exit") {
    shape = (
      <circle
        cx={x}
        cy={y}
        r={size * 0.45}
        fill={node.label === "entry" ? entryFill() : exitFill()}
        {...hoverProps}
      />
    );
  } else if (BRANCH_RE.test(node.label)) {
    shape = (
      <polygon
        points={points([
          [x, y - size],
          [x + size, y],
          [x, y + size],
          [x - size, y],
        ])}
        fill={BRANCH_FILL}
        {...hoverProps}
      />
    );
  } else if (LOOP_RE.test(node.label)) {
    const lw = size;
    const lh = size * 0.7;
    shape = (
      <polygon
        points={points([
          [x - lw * 0.5, y - lh],
          [x + lw * 0.5, y - lh],
          [x + lw, y],
          [x + lw * 0.5, y + lh],
          [x - lw * 0.5, y + lh],
          [x - lw, y],
        ])}
        fill={LOOP_FILL}
        {...hoverProps}
      />
    );
  } else if (RETURN_RE.test(node.label)) {
    shape = (
      <circle cx={x} cy={y} r={size * 0.55} fill={RETURN_FILL} {...hoverProps} />
    );
  } else {
    shape = (
      <rect
        x={x - size * 0.9}
        y={y - size * 0.55}
        width={size * 1.8}
        height={size * 1.1}
        rx={size * 0.2}
        fill={BLOCK_FILL}
        {...hoverProps}
      />
    );
  }
  return (
    <g>
      {shape}
      {badges}
    </g>
  );
}

type CfgGeometry = {
  layout: ReturnType<typeof layoutCfg>;
  at: (id: string) => Vec2 | null;
  rowH: number;
  indent: number;
};

/** World-space placement shared by the glyph renderer and the edge
 * anchoring in the host maps. */
function cfgGeometry(entry: CfgEntry): CfgGeometry {
  const layout = layoutCfg(entry.graph.nodes, entry.graph.edges, {
    grid: entry.graph.grid,
  });
  const w = entry.x1 - entry.x0;
  // vertical span: from just below the cell's top vertex to just above
  // its bottom vertex, so the whole region carries the flow
  const topY = entry.y0;
  const span = entry.y1 - entry.y0;
  const off = span * 0.06;
  const rowH = (span - 2 * off) / Math.max(1, layout.rows - 1);
  // code-shaped columns: a modest fixed indent step per nesting level —
  // like source text — instead of spreading columns over the full width.
  // The indented block as a whole sits centered in the cell.
  const indent = (w * 0.84) / Math.max(4, layout.cols);
  const blockW = indent * (layout.cols - 1);
  const leftX = entry.x0 + w / 2 - blockW / 2;
  const at = (id: string): Vec2 | null => {
    const p = layout.positions.get(id);
    if (!p) return null;
    const rowIndex = Math.max(0, Math.round(p.y * layout.rows - 0.5));
    const y =
      layout.rows > 1 ? topY + off + rowIndex * rowH : topY + span / 2;
    const colIndex = Math.max(0, Math.round(p.x * layout.cols - 0.5));
    const uniform = leftX + colIndex * indent;
    // only where the cell pinches does the slab pull a node inward
    const slab = slabAt(entry.polygon, y);
    if (!slab) return { x: uniform, y };
    const inset = Math.min((slab[1] - slab[0]) * 0.18, indent * 0.4);
    const lo = slab[0] + inset;
    const hi = slab[1] - inset;
    const x =
      lo >= hi
        ? (slab[0] + slab[1]) / 2
        : Math.min(hi, Math.max(lo, uniform));
    return { x, y };
  };
  return { layout, at, rowH, indent };
}

export type CfgAnchor = {
  /** Incoming references point here (the entry terminal). */
  entry: Vec2;
  /** Callee name → the step block that makes the call. */
  calls: Map<string, Vec2>;
};

/** Edge-anchor positions for every displayed CFG, keyed by symbol id. */
export function cfgAnchorsOf(
  entries: readonly CfgEntry[],
): Map<string, CfgAnchor> {
  const map = new Map<string, CfgAnchor>();
  for (const entry of entries) {
    const geometry = cfgGeometry(entry);
    const entryPos = geometry.at("b-entry");
    if (!entryPos) continue;
    const calls = new Map<string, Vec2>();
    for (const [blockId, names] of Object.entries(entry.graph.calls ?? {})) {
      const p = geometry.at(blockId);
      if (!p) continue;
      for (const name of names) {
        if (!calls.has(name)) calls.set(name, p);
      }
    }
    map.set(entry.id, { entry: entryPos, calls });
  }
  return map;
}

type ViewRect = { x: number; y: number; w: number; h: number };

function CfgGlyph(props: { entry: CfgEntry; zoom: number; view?: ViewRect }) {
  const { entry, zoom, view } = props;
  const [hovered, setHovered] = useState<string | null>(null);
  const { layout, at, rowH, indent } = useMemo(
    () => cfgGeometry(entry),
    [entry],
  );
  const w = entry.x1 - entry.x0;
  // glyphs scale with the cell (so zooming in grows them), capped by the
  // row/column spacing so deep diagrams never overlap
  const size = Math.min(rowH * 0.36, indent * 0.42);
  const strokeWidth = Math.max(1.2 / zoom, size * 0.1);
  /** Arrowheads sit at the shape border, not its center. */
  const trim = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(size * 1.3, len * 0.4);
    return { x: to.x - (dx / len) * t, y: to.y - (dy / len) * t };
  };

  /** Orthogonal elbow routing keeps the code-shaped columns readable. */
  const edgePath = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    kind: "flow" | "loop" | "recursion",
  ): string => {
    if (kind === "loop") {
      // loop back edge: arc on the right of the indented body
      const cx = Math.max(a.x, b.x) + indent * 0.9;
      const cy = (a.y + b.y) / 2;
      const end = trim({ x: cx, y: cy }, b);
      return `M${a.x},${a.y} Q${cx},${cy} ${end.x},${end.y}`;
    }
    if (kind === "recursion") {
      // self call: round the left side back up to the entry
      const cx = Math.min(a.x, b.x) - indent * 1.2;
      const cy = (a.y + b.y) / 2;
      const end = trim({ x: cx, y: cy }, b);
      return `M${a.x},${a.y} Q${cx},${cy} ${end.x},${end.y}`;
    }
    const sameCol = Math.abs(a.x - b.x) < indent * 0.5;
    if (sameCol) {
      if (b.y - a.y > rowH * 1.6) {
        // skip edge (e.g. if-false past the then column): bypass lane
        const lane = Math.min(a.x, b.x) - indent * 0.55;
        const dipIn = a.y + rowH * 0.4;
        const dipOut = b.y - rowH * 0.4;
        const end = trim({ x: lane, y: dipOut }, b);
        return `M${a.x},${a.y} L${lane},${dipIn} L${lane},${dipOut} L${end.x},${end.y}`;
      }
      const end = trim(a, b);
      return `M${a.x},${a.y} L${end.x},${end.y}`;
    }
    // between columns: drop half a row, run across, drop into the target
    const midY = a.y + rowH * 0.5;
    if (b.y > midY + rowH * 0.2) {
      const end = trim({ x: b.x, y: midY }, b);
      return `M${a.x},${a.y} L${a.x},${midY} L${b.x},${midY} L${end.x},${end.y}`;
    }
    const end = trim(a, b);
    return `M${a.x},${a.y} L${end.x},${end.y}`;
  };

  return (
    <g>
      <g
        fill="none"
        stroke={edgeStroke()}
        stroke-width={strokeWidth}
        style={{ pointerEvents: "none" }}
      >
        {entry.graph.edges.map((edge) => {
          const a = at(edge.source);
          const b = at(edge.target);
          if (!a || !b) return null;
          const key = `${edge.source} ${edge.target}`;
          const kind = !layout.backEdges.has(key)
            ? "flow"
            : edge.target === "b-entry"
              ? "recursion"
              : "loop";
          return (
            <path
              key={key}
              d={edgePath(a, b, kind)}
              stroke-opacity={0.8}
              marker-end={`url(#${CFG_ARROW_ID})`}
              style={{ vectorEffect: "none" }}
            />
          );
        })}
      </g>
      <g fill-opacity={0.92}>
        {entry.graph.nodes.map((node) => {
          const p = at(node.id);
          if (!p) return null;
          return (
            <CfgShape
              key={node.id}
              node={node}
              x={p.x}
              y={p.y}
              size={size}
              effects={entry.graph.effects?.[node.id] ?? []}
              onHover={setHovered}
            />
          );
        })}
      </g>
      {hovered
        ? (() => {
            const node = entry.graph.nodes.find((n) => n.id === hovered);
            const p = at(hovered);
            if (!node || !p) return null;
            const effects = entry.graph.effects?.[hovered] ?? [];
            const effectLines = effects.map((e) => `! ${e}`);
            // plain statement blocks skip the code dump — only their
            // externally visible effects matter at a glance
            const isPlain =
              !PLAIN_RE.test(node.label) &&
              node.label !== "entry" &&
              node.label !== "exit";
            let lines: string[];
            if (isPlain) {
              if (effectLines.length === 0) return null;
              lines = effectLines;
            } else {
              const code = entry.graph.code?.[hovered] ?? node.label;
              lines = [...code.split("\n"), ...effectLines].slice(0, 14);
            }
            const fontSize = Math.max(size * 0.8, 9 / zoom);
            const lineH = fontSize * 1.4;
            const longest = Math.max(...lines.map((l) => l.length), 1);
            const boxW = Math.min(w * 0.9, longest * fontSize * 0.62 + fontSize * 2);
            const boxH = lines.length * lineH + fontSize * 1.4;
            // keep the box inside the visible viewport, not just the cell
            const vx0 = view ? view.x : entry.x0;
            const vx1 = view ? view.x + view.w : entry.x1;
            const vy0 = view ? view.y : entry.y0;
            const vy1 = view ? view.y + view.h : entry.y1;
            let bx = p.x + size * 2.2;
            if (bx + boxW > vx1) bx = p.x - size * 2.2 - boxW;
            bx = Math.max(vx0, Math.min(bx, vx1 - boxW));
            let by = p.y - boxH / 2;
            by = Math.max(vy0, Math.min(by, vy1 - boxH));
            return (
              <foreignObject
                x={bx}
                y={by}
                width={boxW}
                height={boxH}
                style={{ pointerEvents: "none", overflow: "visible" }}
              >
                <div
                  // @ts-expect-error xmlns is required inside SVG
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    background: "rgba(15, 23, 42, 0.92)",
                    color: "#e2e8f0",
                    borderRadius: `${fontSize * 0.5}px`,
                    padding: `${fontSize * 0.6}px ${fontSize * 0.8}px`,
                    fontFamily: "Monaco, ui-monospace, Menlo, monospace",
                    fontSize: `${fontSize}px`,
                    lineHeight: `${lineH}px`,
                    whiteSpace: "pre",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  {lines.join("\n")}
                </div>
              </foreignObject>
            );
          })()
        : null}
    </g>
  );
}

export function CfgLayer(props: {
  entries: CfgEntry[];
  zoom: number;
  /** Committed viewport, for clamping hover boxes on-screen. */
  view?: ViewRect;
}) {
  if (props.entries.length === 0) return null;
  return (
    <g>
      <defs>
        {/* markerUnits=strokeWidth keeps arrowheads zoom-proportional */}
        <marker
          id={CFG_ARROW_ID}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={edgeStroke()} />
        </marker>
      </defs>
      {props.entries.map((entry) => (
        <CfgGlyph
          key={entry.id}
          entry={entry}
          zoom={props.zoom}
          view={props.view}
        />
      ))}
    </g>
  );
}
