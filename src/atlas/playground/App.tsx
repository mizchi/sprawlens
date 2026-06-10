import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasGraph, AtlasNode } from "../contracts/graph.js";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
} from "../kernel/capacityLayout.js";
import { createGraphLayout } from "../kernel/pipeline.js";
import { centroid, type Ring } from "../kernel/polygon.js";
import { createRng, type Rng } from "../kernel/rng.js";
import { CellMapSvg } from "./CellMapSvg.tsx";
import { Controls, type ClipKind, type PlaygroundParams } from "./Controls.tsx";
import { snapshotSymbols, snapshotToAtlasGraph } from "./fixtureAdapter.ts";
import { sprawlensSnapshot } from "./fixtures/sprawlens.ts";
import {
  applyRingsChanges,
  createRingsState,
  stepRingsState,
  type RingsState,
} from "./ringsController.ts";
import { RingsMapSvg } from "./RingsMapSvg.tsx";
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
    layout: "rings",
    invertRings: false,
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
  const layoutRef = useRef<CapacityLayoutState | null>(null);
  const ringsRef = useRef<RingsState | null>(null);
  const historyRef = useRef<number[]>([]);
  const fpsRef = useRef({ last: 0, ema: 0 });
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const mutationRng = useRef<Rng>(createRng(0xc0ffee));
  const nextNodeId = useRef(0);
  const innerLayoutsRef = useRef(new Map<string, CapacityLayoutState>());
  /** Real per-file symbols when a fixture is loaded; null = synthesize. */
  const symbolsRef = useRef<Map<string, AtlasNode[]> | null>(null);

  const ringsOptions = (p: PlaygroundParams) => ({
    width: WIDTH,
    height: HEIGHT,
    seed: p.seed,
    invert: p.invertRings,
    adaptationRate: p.adaptationRate,
    lloydRate: p.lloydRate,
  });

  /** Per-frame sync: each file cell hosts a nested symbol layout clipped to it. */
  const syncInnerLayouts = (outerCells: CellResult[], outerMoved: boolean) => {
    const inner = innerLayoutsRef.current;
    const alive = new Set<string>();
    const locOf = new Map(
      graphRef.current.nodes.map((n) => [n.id, n.metrics.loc]),
    );
    for (const cell of outerCells) {
      if (cell.polygon.length < 3) continue;
      const loc = locOf.get(cell.id);
      if (loc === undefined) continue;
      alive.add(cell.id);
      const clip: ClipRegion = {
        kind: "polygon",
        ring: insetRing(cell.polygon, 0.94),
      };
      let layout = inner.get(cell.id);
      if (!layout) {
        const symbols =
          symbolsRef.current?.get(cell.id) ??
          synthesizeSymbols(cell.id, loc, 1);
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
    if (p.layout === "rings") {
      ringsRef.current = createRingsState(graph, ringsOptions(p));
      layoutRef.current = null;
    } else {
      layoutRef.current = createGraphLayout(graph, clipOf(p.clipKind), {
        seed: p.seed,
        adaptationRate: p.adaptationRate,
        lloydRate: p.lloydRate,
        circleSegments: segmentsOf(p.clipKind),
      });
      ringsRef.current = null;
    }
    historyRef.current = [];
    innerLayoutsRef.current = new Map();
  };

  if (layoutRef.current === null && ringsRef.current === null) rebuild(params);

  // structural params trigger a rebuild; invert re-rings warm; solver params
  // only update options on the existing layout
  const structuralKey = `${params.source}|${params.layout}|${params.count}|${params.seed}|${params.clipKind}`;
  const structuralRef = useRef(structuralKey);
  const invertRef = useRef(params.invertRings);
  useEffect(() => {
    if (structuralRef.current !== structuralKey) {
      structuralRef.current = structuralKey;
      invertRef.current = paramsRef.current.invertRings;
      rebuild(paramsRef.current);
      return;
    }
    if (invertRef.current !== params.invertRings) {
      invertRef.current = params.invertRings;
      if (ringsRef.current) {
        ringsRef.current = applyRingsChanges(
          ringsRef.current,
          graphRef.current,
          ringsOptions(paramsRef.current),
        );
      }
    }
    if (layoutRef.current) {
      layoutRef.current = {
        ...layoutRef.current,
        options: {
          ...layoutRef.current.options,
          adaptationRate: params.adaptationRate,
          lloydRate: params.lloydRate,
        },
      };
    }
  }, [
    structuralKey,
    params.invertRings,
    params.adaptationRate,
    params.lloydRate,
  ]);

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let disposed = false;
    // rAF stops entirely in hidden tabs; fall back to a timer so layouts
    // keep converging while the user works elsewhere
    const schedule = () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(() => tick(performance.now()), 33);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const tick = (now: number) => {
      const fps = fpsRef.current;
      if (fps.last > 0) {
        const instant = 1000 / (now - fps.last);
        fps.ema = fps.ema === 0 ? instant : fps.ema * 0.9 + instant * 0.1;
      }
      fps.last = now;

      // hidden tabs throttle the fallback timer to ~1 tick/s; batch more
      // solver steps per tick there so convergence keeps a similar pace
      const stepBatch =
        paramsRef.current.stepsPerFrame *
        (document.visibilityState === "hidden" ? 30 : 1);
      let outerActive = false;
      let outerCells: CellResult[] = [];
      let maxError = 0;
      if (ringsRef.current) {
        const result = stepRingsState(ringsRef.current, stepBatch);
        ringsRef.current = result.state;
        outerActive = result.active;
        for (const layout of result.state.moduleLayouts.values()) {
          outerCells.push(...layout.cells);
          maxError = Math.max(maxError, layout.maxRelativeError);
        }
      } else if (layoutRef.current) {
        let state = layoutRef.current;
        outerActive = !isConverged(state, CONVERGENCE_TOLERANCE / 4);
        if (outerActive) {
          for (let i = 0; i < stepBatch; i++) {
            state = capacityStep(state);
          }
          layoutRef.current = state;
        }
        outerCells = state.cells;
        maxError = state.maxRelativeError;
      }
      if (outerActive) {
        historyRef.current = [...historyRef.current.slice(-179), maxError];
      }

      let innerActive = false;
      if (paramsRef.current.showNested) {
        syncInnerLayouts(outerCells, outerActive);
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
      schedule();
    };
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  const afterGraphMutation = (changedFileId?: string) => {
    if (ringsRef.current) {
      ringsRef.current = applyRingsChanges(
        ringsRef.current,
        graphRef.current,
        ringsOptions(paramsRef.current),
      );
    }
    if (changedFileId) innerLayoutsRef.current.delete(changedFileId);
    setFrame((f) => f + 1);
  };

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
    if (layoutRef.current) {
      layoutRef.current = applyGraphChanges(layoutRef.current, {
        upsert: [{ id: updated.id, weight: updated.metrics.loc }],
      });
    }
    afterGraphMutation(updated.id);
  };

  const addNode = () => {
    const rng = mutationRng.current;
    const moduleIds = [
      ...new Set(
        graphRef.current.nodes.map((n) => n.id.split("/").slice(0, -1).join("/")),
      ),
    ].filter((m) => m.length > 0);
    const moduleId =
      moduleIds.length > 0
        ? moduleIds[Math.floor(rng() * moduleIds.length)]!
        : "added";
    const node: AtlasNode = {
      id: `${moduleId}/added-${nextNodeId.current++}.ts`,
      kind: "file",
      label: `added-${nextNodeId.current}.ts`,
      metrics: { loc: Math.round(20 + 980 * rng() ** 3) },
    };
    const graph = graphRef.current;
    const edges = [...graph.edges];
    if (graph.nodes.length > 0) {
      const target = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
      edges.push({ source: node.id, target: target.id });
    }
    graphRef.current = { nodes: [...graph.nodes, node], edges };
    if (layoutRef.current) {
      layoutRef.current = applyGraphChanges(layoutRef.current, {
        upsert: [{ id: node.id, weight: node.metrics.loc }],
      });
    }
    afterGraphMutation();
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
    if (layoutRef.current) {
      layoutRef.current = applyGraphChanges(layoutRef.current, {
        remove: [node.id],
      });
    }
    afterGraphMutation(node.id);
    if (selectedId === node.id) setSelectedId(null);
  };

  const allCells: CellResult[] = ringsRef.current
    ? [...ringsRef.current.moduleLayouts.values()].flatMap((l) => l.cells)
    : (layoutRef.current?.cells ?? []);
  const selected = useMemo(
    () => allCells.find((c) => c.id === selectedId) ?? null,
    [allCells, selectedId],
  );
  const maxError = ringsRef.current
    ? Math.max(
        0,
        ...[...ringsRef.current.moduleLayouts.values()].map(
          (l) => l.maxRelativeError,
        ),
      )
    : (layoutRef.current?.maxRelativeError ?? 0);
  const labels = new Map(graphRef.current.nodes.map((n) => [n.id, n.label]));
  const innerCells = params.showNested
    ? [...innerLayoutsRef.current.values()].flatMap((l) => l.cells)
    : [];

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
        {ringsRef.current ? (
          <RingsMapSvg
            rings={ringsRef.current}
            innerCells={innerCells}
            fileEdges={graphRef.current.edges}
            showEdges={params.showEdges}
            labels={labels}
            width={WIDTH}
            height={HEIGHT}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : layoutRef.current ? (
          <CellMapSvg
            state={layoutRef.current}
            edges={graphRef.current.edges}
            showEdges={params.showEdges}
            innerCells={innerCells}
            labels={labels}
            width={WIDTH}
            height={HEIGHT}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : null}
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
          <div>
            max relative error: {(maxError * 100).toFixed(2)}%
            {maxError < CONVERGENCE_TOLERANCE ? " (converged)" : ""}
          </div>
          <div>fps: {fpsRef.current.ema.toFixed(0)}</div>
          <div>
            cells: {allCells.length}
            {ringsRef.current
              ? ` / modules: ${ringsRef.current.circles.size}`
              : ""}
          </div>
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
