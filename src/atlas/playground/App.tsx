import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasGraph, AtlasNode } from "../contracts/graph.js";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type ClipRegion,
} from "../kernel/capacityLayout.js";
import { createGraphLayout } from "../kernel/pipeline.js";
import { createRng, type Rng } from "../kernel/rng.js";
import type { Ring } from "../kernel/polygon.js";
import { centroid } from "../kernel/polygon.js";
import { CellMapSvg } from "./CellMapSvg.tsx";
import { Controls, type ClipKind, type PlaygroundParams } from "./Controls.tsx";
import { snapshotSymbols, snapshotToAtlasGraph } from "./fixtureAdapter.ts";
import { sprawlensSnapshot } from "./fixtures/sprawlens.ts";
import { createSyntheticGraph, synthesizeSymbols } from "./synthetic.ts";

const WIDTH = 960;
const HEIGHT = 640;
const CONVERGENCE_TOLERANCE = 0.02;

function clipOf(kind: ClipKind): ClipRegion {
  return kind === "rect"
    ? { kind: "rect", x: 0, y: 0, width: WIDTH, height: HEIGHT }
    : { kind: "circle", cx: WIDTH / 2, cy: HEIGHT / 2, r: HEIGHT / 2 - 10 };
}

/** 16-gon is the circle clip with a coarse polygonization. */
function segmentsOf(kind: ClipKind): number {
  return kind === "hexadecagon" ? 16 : 64;
}

/** Shrink a convex ring toward its centroid so nested cells stay visually inside. */
function insetRing(ring: Ring, factor: number): Ring {
  const c = centroid(ring);
  return ring.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

function Sparkline(props: { values: number[] }) {
  const w = 220;
  const h = 48;
  const points = props.values
    .map((v, i) => {
      // log scale: 100% error at top, 0.1% at bottom
      const y = h - (h * (Math.log10(Math.max(v, 1e-3)) + 3)) / 3;
      const x = (i / Math.max(props.values.length - 1, 1)) * w;
      return `${x},${Math.min(Math.max(y, 0), h)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: `${w}px`, height: `${h}px` }}>
      <rect width={w} height={h} fill="#f1f5f9" />
      {/* 2% tolerance line */}
      <line
        x1={0}
        x2={w}
        y1={h - (h * (Math.log10(0.02) + 3)) / 3}
        y2={h - (h * (Math.log10(0.02) + 3)) / 3}
        stroke="#94a3b8"
        stroke-dasharray="3 3"
      />
      <polyline points={points} fill="none" stroke="#dc2626" stroke-width={1.5} />
    </svg>
  );
}

export function App() {
  const [params, setParams] = useState<PlaygroundParams>({
    source: "synthetic",
    count: 120,
    seed: 1,
    clipKind: "circle",
    adaptationRate: 0.8,
    lloydRate: 0.7,
    stepsPerFrame: 2,
    showEdges: true,
    showNested: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setFrame] = useState(0);

  const graphRef = useRef<AtlasGraph>(null as unknown as AtlasGraph);
  const layoutRef = useRef<CapacityLayoutState>(
    null as unknown as CapacityLayoutState,
  );
  const historyRef = useRef<number[]>([]);
  const fpsRef = useRef({ last: 0, ema: 0 });
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const mutationRng = useRef<Rng>(createRng(0xc0ffee));
  const nextNodeId = useRef(0);
  const innerLayoutsRef = useRef(new Map<string, CapacityLayoutState>());
  /** Real per-file symbols when a fixture is loaded; null = synthesize. */
  const symbolsRef = useRef<Map<string, AtlasNode[]> | null>(null);

  /** Per-frame sync: each file cell hosts a nested symbol layout clipped to it. */
  const syncInnerLayouts = (outer: CapacityLayoutState, outerMoved: boolean) => {
    const inner = innerLayoutsRef.current;
    const alive = new Set<string>();
    for (const cell of outer.cells) {
      if (cell.polygon.length < 3) continue;
      alive.add(cell.id);
      const node = graphRef.current.nodes.find((n) => n.id === cell.id);
      if (!node) continue;
      const clip: ClipRegion = {
        kind: "polygon",
        ring: insetRing(cell.polygon, 0.94),
      };
      let layout = inner.get(cell.id);
      if (!layout) {
        const symbols =
          symbolsRef.current?.get(cell.id) ??
          synthesizeSymbols(cell.id, node.metrics.loc, 1);
        layout = createCapacityLayout(
          symbols.map((s) => ({ id: s.id, weight: s.metrics.loc })),
          clip,
          { seed: 1 },
        );
      } else if (outerMoved) {
        layout = applyGraphChanges(layout, { clip });
      }
      if (!isConverged(layout, CONVERGENCE_TOLERANCE)) {
        layout = capacityStep(layout);
      }
      inner.set(cell.id, layout);
    }
    for (const id of [...inner.keys()]) {
      if (!alive.has(id)) inner.delete(id);
    }
  };

  const rebuild = (p: PlaygroundParams) => {
    let graph: AtlasGraph;
    if (p.source === "sprawlens") {
      graph = snapshotToAtlasGraph(sprawlensSnapshot);
      symbolsRef.current = snapshotSymbols(sprawlensSnapshot);
    } else {
      graph = createSyntheticGraph({ count: p.count, seed: p.seed });
      symbolsRef.current = null;
    }
    graphRef.current = graph;
    nextNodeId.current = p.count;
    layoutRef.current = createGraphLayout(graph, clipOf(p.clipKind), {
      seed: p.seed,
      adaptationRate: p.adaptationRate,
      lloydRate: p.lloydRate,
      circleSegments: segmentsOf(p.clipKind),
    });
    historyRef.current = [];
    innerLayoutsRef.current = new Map();
  };

  if (layoutRef.current === null) rebuild(params);

  // structural params trigger a rebuild; solver params only update options
  const structuralKey = `${params.source}|${params.count}|${params.seed}|${params.clipKind}`;
  const structuralRef = useRef(structuralKey);
  useEffect(() => {
    if (structuralRef.current !== structuralKey) {
      structuralRef.current = structuralKey;
      rebuild(paramsRef.current);
    } else {
      layoutRef.current = {
        ...layoutRef.current,
        options: {
          ...layoutRef.current.options,
          adaptationRate: params.adaptationRate,
          lloydRate: params.lloydRate,
        },
      };
    }
  }, [structuralKey, params.adaptationRate, params.lloydRate]);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const fps = fpsRef.current;
      if (fps.last > 0) {
        const instant = 1000 / (now - fps.last);
        fps.ema = fps.ema === 0 ? instant : fps.ema * 0.9 + instant * 0.1;
      }
      fps.last = now;
      let state = layoutRef.current;
      const outerActive = !isConverged(state, CONVERGENCE_TOLERANCE / 4);
      if (outerActive) {
        for (let i = 0; i < paramsRef.current.stepsPerFrame; i++) {
          state = capacityStep(state);
        }
        layoutRef.current = state;
        historyRef.current = [
          ...historyRef.current.slice(-179),
          state.maxRelativeError,
        ];
      }
      let innerActive = false;
      if (paramsRef.current.showNested) {
        syncInnerLayouts(state, outerActive);
        for (const layout of innerLayoutsRef.current.values()) {
          if (!isConverged(layout, CONVERGENCE_TOLERANCE)) {
            innerActive = true;
            break;
          }
        }
      }
      // re-render only while a solver is actually advancing; a converged
      // layout would otherwise burn CPU at full frame rate
      if (outerActive || innerActive) setFrame((f) => f + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const mutateWeight = () => {
    const graph = graphRef.current;
    if (graph.nodes.length === 0) return;
    const rng = mutationRng.current;
    const node = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
    const factor = rng() < 0.5 ? 0.7 : 1.3;
    const updated: AtlasNode = {
      ...node,
      metrics: { loc: Math.max(1, Math.round(node.metrics.loc * factor)) },
    };
    graphRef.current = {
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === node.id ? updated : n)),
    };
    layoutRef.current = applyGraphChanges(layoutRef.current, {
      upsert: [{ id: updated.id, weight: updated.metrics.loc }],
    });
    // drop the nested layout so symbols regenerate from the new LOC
    innerLayoutsRef.current.delete(updated.id);
  };

  const addNode = () => {
    const rng = mutationRng.current;
    const node: AtlasNode = {
      id: `added-${nextNodeId.current++}`,
      kind: "file",
      label: "added.ts",
      metrics: { loc: Math.round(20 + 980 * rng() ** 3) },
    };
    const graph = graphRef.current;
    const edges = [...graph.edges];
    if (graph.nodes.length > 0) {
      const target = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
      edges.push({ source: node.id, target: target.id });
    }
    graphRef.current = { nodes: [...graph.nodes, node], edges };
    layoutRef.current = applyGraphChanges(layoutRef.current, {
      upsert: [{ id: node.id, weight: node.metrics.loc }],
    });
  };

  const removeNode = () => {
    const graph = graphRef.current;
    if (graph.nodes.length <= 2) return;
    const rng = mutationRng.current;
    const node = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
    graphRef.current = {
      nodes: graph.nodes.filter((n) => n.id !== node.id),
      edges: graph.edges.filter(
        (e) => e.source !== node.id && e.target !== node.id,
      ),
    };
    layoutRef.current = applyGraphChanges(layoutRef.current, {
      remove: [node.id],
    });
    if (selectedId === node.id) setSelectedId(null);
  };

  const state = layoutRef.current;
  const selected = useMemo(
    () => state.cells.find((c) => c.id === selectedId) ?? null,
    [state, selectedId],
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: "12px",
        height: "100vh",
        padding: "12px",
        boxSizing: "border-box",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: "#e2e8f0",
      }}
    >
      <div
        style={{
          background: "#f8fafc",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      >
        <CellMapSvg
          state={state}
          edges={graphRef.current.edges}
          showEdges={params.showEdges}
          labels={
            new Map(graphRef.current.nodes.map((n) => [n.id, n.label]))
          }
          innerCells={
            params.showNested
              ? [...innerLayoutsRef.current.values()].flatMap((l) => l.cells)
              : []
          }
          width={WIDTH}
          height={HEIGHT}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          fontSize: "12px",
          color: "#0f172a",
        }}
      >
        <Controls
          params={params}
          onChange={setParams}
          onRegenerate={() => rebuild(paramsRef.current)}
          onMutateWeight={mutateWeight}
          onAddNode={addNode}
          onRemoveNode={removeNode}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px",
            background: "#f8fafc",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
          }}
        >
          <div>iteration: {state.iteration}</div>
          <div>
            max relative error: {(state.maxRelativeError * 100).toFixed(2)}%
            {isConverged(state, CONVERGENCE_TOLERANCE) ? " (converged)" : ""}
          </div>
          <div>fps: {fpsRef.current.ema.toFixed(0)}</div>
          <div>cells: {state.cells.length}</div>
          <Sparkline values={historyRef.current} />
        </div>
        {selected ? (
          <div
            style={{
              padding: "8px",
              background: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            <div style={{ fontWeight: "600" }}>{selected.id}</div>
            <div>target: {selected.targetArea.toFixed(1)} px²</div>
            <div>actual: {selected.actualArea.toFixed(1)} px²</div>
            <div>
              error:{" "}
              {(
                ((selected.actualArea - selected.targetArea) /
                  selected.targetArea) *
                100
              ).toFixed(2)}
              %
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
