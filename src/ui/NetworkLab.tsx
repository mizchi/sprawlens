import { Deck, OrthographicView } from "@deck.gl/core";
import { LineLayer, ScatterplotLayer } from "@deck.gl/layers";
import * as THREE from "three";
import { Graph3d } from "vis-graph3d";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  buildReviewGraphFrame,
  interpolateReviewGraphFrames,
  reviewGraphToGeoJson,
  type ReviewGraphEdge,
  type ReviewGraphFrame,
  type ReviewGraphNode,
  type ReviewGraphStatus,
} from "../core/network.js";
import type { GraphDiff, Snapshot } from "../core/types.js";

type RendererKind = "three" | "deck" | "geojson" | "vis3d";

type NetworkLabProps = {
  snapshot: Snapshot | null;
  beforeSnapshot: Snapshot | null;
  diff: GraphDiff | null;
  selectedFile: string;
  onSelectFile: (path: string) => void;
};

const RENDERERS: Array<{ id: RendererKind; label: string }> = [
  { id: "three", label: "three.js" },
  { id: "deck", label: "deck.gl" },
  { id: "geojson", label: "GeoJSON tiles" },
  { id: "vis3d", label: "vis Graph3d" },
];

export function NetworkLab(props: NetworkLabProps) {
  const [renderer, setRenderer] = useState<RendererKind>("three");
  const [maxNodes, setMaxNodes] = useState(900);
  const [progress, setProgress] = useState(1);

  const toFrame = useMemo(() => {
    if (!props.snapshot) {
      return null;
    }
    return buildReviewGraphFrame(props.snapshot, {
      diff: props.diff,
      maxNodes,
      focusPath: props.selectedFile,
    });
  }, [maxNodes, props.diff, props.selectedFile, props.snapshot]);
  const fromFrame = useMemo(() => {
    if (!props.beforeSnapshot) {
      return null;
    }
    return buildReviewGraphFrame(props.beforeSnapshot, {
      maxNodes,
      focusPath: props.selectedFile,
    });
  }, [maxNodes, props.beforeSnapshot, props.selectedFile]);
  const frame = useMemo(() => {
    if (!toFrame) {
      return null;
    }
    if (!fromFrame || progress >= 1) {
      return toFrame;
    }
    return interpolateReviewGraphFrames(fromFrame, toFrame, progress);
  }, [fromFrame, progress, toFrame]);

  if (!frame) {
    return <div className="empty-state">No graph frame</div>;
  }

  return (
    <section className="network-lab">
      <div className="section-head compact">
        <h2>Network Lab</h2>
        <span className="meta-label">
          {frame.nodes.length} nodes / {frame.edges.length} edges
        </span>
      </div>
      <div className="network-controls" aria-label="Network visualization controls">
        <label>
          Renderer
          <select value={renderer} onChange={(event) => setRenderer(event.target.value as RendererKind)}>
            {RENDERERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Max nodes
          <input
            type="number"
            min={100}
            max={5000}
            step={100}
            value={maxNodes}
            onChange={(event) => setMaxNodes(Number(event.target.value))}
          />
        </label>
        <label>
          Timeline
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
            disabled={!fromFrame}
          />
        </label>
      </div>
      <div className="network-stage">
        {renderer === "three" ? <ThreeNetworkRenderer frame={frame} onSelectPath={props.onSelectFile} /> : null}
        {renderer === "deck" ? <DeckNetworkRenderer frame={frame} onSelectPath={props.onSelectFile} /> : null}
        {renderer === "geojson" ? <GeoJsonTileRenderer frame={frame} onSelectPath={props.onSelectFile} /> : null}
        {renderer === "vis3d" ? <VisGraph3dRenderer frame={frame} /> : null}
      </div>
      <details className="details-panel">
        <summary>Renderer notes</summary>
        <ul>
          <li>three.js: highest freedom, instanced file blocks, custom snapping and timeline animation.</li>
          <li>deck.gl: strong for layered WebGL rendering and picking, weaker for custom 3D structure metaphors.</li>
          <li>GeoJSON tiles: useful for tiled zoom/pan experiments and server-side preprocessing.</li>
          <li>vis Graph3d: useful as a 3D point cloud baseline, not a real network edge renderer.</li>
        </ul>
      </details>
    </section>
  );
}

function ThreeNetworkRenderer(props: { frame: ReviewGraphFrame; onSelectPath: (path: string) => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const [view, setView] = useState(() => initialView(props.frame));
  const dragRef = useRef<{ x: number; y: number; startView: GraphView } | null>(null);

  useEffect(() => {
    setView(initialView(props.frame));
  }, [props.frame.commitHash]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    mount.replaceChildren();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");
    sceneRef.current = scene;
    const camera = new THREE.OrthographicCamera(size.width / -2, size.width / 2, size.height / 2, size.height / -2, 0.1, 5000);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height, false);
    mount.append(renderer.domElement);
    rendererRef.current = renderer;

    const world = new THREE.Group();
    scene.add(world);

    const edgeGroups = edgeLineGroups(props.frame);
    for (const line of edgeGroups) {
      world.add(line);
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true });
    const mesh = new THREE.InstancedMesh(geometry, material, props.frame.nodes.length);
    mesh.userData.nodes = props.frame.nodes;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    props.frame.nodes.forEach((node, index) => {
      const position = threeProjectedPosition(node);
      matrix.compose(
        new THREE.Vector3(position.x, position.y, position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(node.size, node.size, 10 + node.fanOut * 1.8),
      );
      mesh.setMatrixAt(index, matrix);
      color.set(nodeColor(node.status, node.inCycle));
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    world.add(mesh);
    meshRef.current = mesh;

    renderThreeScene(scene, camera, renderer, size, view);

    return () => {
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      mount.replaceChildren();
      rendererRef.current = null;
      sceneRef.current = null;
      meshRef.current = null;
      cameraRef.current = null;
    };
  }, [props.frame, size.height, size.width]);

  useEffect(() => {
    if (sceneRef.current && cameraRef.current && rendererRef.current) {
      renderThreeScene(sceneRef.current, cameraRef.current, rendererRef.current, size, view);
    }
  }, [size, view]);

  const onWheel = (event: ReactPointerWheelEvent) => {
    setView((current) => ({ ...current, zoom: clamp(current.zoom * (event.deltaY < 0 ? 1.12 : 0.88), 0.16, 8) }));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, startView: view };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return;
    }
    const dx = (event.clientX - dragRef.current.x) / view.zoom;
    const dy = (event.clientY - dragRef.current.y) / view.zoom;
    setView({ ...dragRef.current.startView, x: dragRef.current.startView.x - dx, y: dragRef.current.startView.y + dy });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) {
      return;
    }
    const moved = Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y);
    if (moved < 4) {
      const picked = pickThreeNode(event, mountRef.current, cameraRef.current, meshRef.current);
      if (picked) {
        props.onSelectPath(picked.path);
      }
    } else {
      setView((current) => ({ ...current, x: snap(current.x, 24), y: snap(current.y, 24) }));
    }
  };

  return (
    <div
      ref={sizeRef}
      className="network-canvas-wrap"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div ref={mountRef} className="network-canvas" />
      <span className="network-badge">Drag pans, wheel zooms, click selects, pan snaps to grid.</span>
    </div>
  );
}

function DeckNetworkRenderer(props: { frame: ReviewGraphFrame; onSelectPath: (path: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wrapRef, size] = useElementSize<HTMLDivElement>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const nodesById = new Map(props.frame.nodes.map((node) => [node.id, node]));
    const fittedView = initialView(props.frame);
    const deck = new Deck({
      canvas,
      width: size.width,
      height: size.height,
      views: [new OrthographicView({ id: "network" })],
      controller: true,
      initialViewState: {
        network: {
          target: [fittedView.x, fittedView.y, 0],
          zoom: Math.log2(fittedView.zoom) - 0.6,
        },
      },
      layers: [
        new LineLayer<ReviewGraphEdge>({
          id: "edges",
          data: props.frame.edges,
          getSourcePosition: (edge) => {
            const node = nodesById.get(edge.from);
            return [node?.x ?? 0, node?.y ?? 0, node?.z ?? 0];
          },
          getTargetPosition: (edge) => {
            const node = nodesById.get(edge.to);
            return [node?.x ?? 0, node?.y ?? 0, node?.z ?? 0];
          },
          getColor: (edge) => rgbaForStatus(edge.status, 115),
          getWidth: (edge) => (edge.status === "added" || edge.status === "removed" ? 2.2 : 1),
        }),
        new ScatterplotLayer<ReviewGraphNode>({
          id: "nodes",
          data: props.frame.nodes,
          pickable: true,
          radiusUnits: "pixels",
          getPosition: (node) => [node.x, node.y, node.z],
          getRadius: (node) => Math.max(2.5, node.size * 0.22),
          getFillColor: (node) => rgbaForStatus(node.status, Math.round(255 * node.alpha)),
          getLineColor: (node) => (node.inCycle ? [17, 24, 39, 255] : [255, 255, 255, 255]),
          lineWidthMinPixels: 1,
          stroked: true,
          onClick: (info) => {
            const node = info.object;
            if (node) {
              props.onSelectPath(node.path);
            }
          },
        }),
      ],
    });

    return () => deck.finalize();
  }, [props.frame, props.onSelectPath, size.height, size.width]);

  return (
    <div ref={wrapRef} className="network-canvas-wrap">
      <canvas ref={canvasRef} className="network-canvas" />
      <span className="network-badge">deck.gl controller handles pan, zoom, and picking.</span>
    </div>
  );
}

function GeoJsonTileRenderer(props: { frame: ReviewGraphFrame; onSelectPath: (path: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const [view, setView] = useState(() => initialView(props.frame));
  const dragRef = useRef<{ x: number; y: number; startView: GraphView } | null>(null);
  const geojson = useMemo(() => reviewGraphToGeoJson(props.frame), [props.frame]);

  useEffect(() => {
    setView(initialView(props.frame));
  }, [props.frame.commitHash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    canvas.width = Math.max(1, Math.round(size.width * window.devicePixelRatio));
    canvas.height = Math.max(1, Math.round(size.height * window.devicePixelRatio));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    drawGeoJsonTiles(context, size, view, geojson, props.frame);
  }, [geojson, props.frame, size, view]);

  const onWheel = (event: ReactPointerWheelEvent) => {
    setView((current) => ({ ...current, zoom: clamp(current.zoom * (event.deltaY < 0 ? 1.16 : 0.86), 0.12, 10) }));
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, startView: view };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return;
    }
    const dx = (event.clientX - dragRef.current.x) / view.zoom;
    const dy = (event.clientY - dragRef.current.y) / view.zoom;
    setView({ ...dragRef.current.startView, x: dragRef.current.startView.x - dx, y: dragRef.current.startView.y - dy });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) {
      return;
    }
    const moved = Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y);
    if (moved < 4) {
      const rect = event.currentTarget.getBoundingClientRect();
      const picked = pickCanvasNode(props.frame, view, size, event.clientX - rect.left, event.clientY - rect.top);
      if (picked) {
        props.onSelectPath(picked.path);
      }
    } else {
      setView((current) => ({ ...current, x: snap(current.x, 24), y: snap(current.y, 24) }));
    }
  };

  return (
    <div
      ref={wrapRef}
      className="network-canvas-wrap"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas ref={canvasRef} className="network-canvas" />
      <span className="network-badge">GeoJSON FeatureCollection + client tile grid prototype.</span>
    </div>
  );
}

function VisGraph3dRenderer(props: { frame: ReviewGraphFrame }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.replaceChildren();
    const data = props.frame.nodes.map((node, index) => ({
        id: index,
        x: node.x,
        y: node.y,
        z: node.layer === "runtime" ? 0 : node.layer === "test" ? 1 : node.layer === "tooling" ? 2 : 3,
        style: node.size,
        filter: node.group,
        node,
      }));
    const graph = new Graph3d(element, data, {
      width: "100%",
      height: "100%",
      style: "dot-size",
      showPerspective: true,
      showGrid: true,
      keepAspectRatio: true,
      verticalRatio: 0.55,
      xLabel: "directory x",
      yLabel: "directory y",
      zLabel: "code layer",
    });

    return () => {
      graph.destroy?.();
      element.replaceChildren();
    };
  }, [props.frame]);

  return (
    <div className="network-canvas-wrap">
      <div ref={ref} className="network-canvas vis3d-canvas" />
      <span className="network-badge">vis Graph3d is a node cloud baseline; it does not model import edges.</span>
    </div>
  );
}

type ReactPointerWheelEvent = React.WheelEvent<HTMLDivElement>;

type GraphView = {
  x: number;
  y: number;
  zoom: number;
};

function initialView(frame: ReviewGraphFrame): GraphView {
  const center = centerOf(frame);
  const graphWidth = Math.max(1, frame.bounds.maxX - frame.bounds.minX);
  const graphHeight = Math.max(1, frame.bounds.maxY - frame.bounds.minY);
  const zoom = clamp(Math.min(720 / (graphWidth * 1.16), 520 / (graphHeight * 1.16)), 0.08, 0.9);
  return { x: center.x, y: center.y, zoom };
}

function centerOf(frame: ReviewGraphFrame): { x: number; y: number } {
  return {
    x: (frame.bounds.minX + frame.bounds.maxX) / 2,
    y: (frame.bounds.minY + frame.bounds.maxY) / 2,
  };
}

function edgeLineGroups(frame: ReviewGraphFrame): THREE.LineSegments[] {
  const nodesById = new Map(frame.nodes.map((node) => [node.id, node]));
  const statuses: ReviewGraphStatus[] = ["stable", "added", "removed", "changed", "hotspot"];
  return statuses.flatMap((status) => {
    const points: number[] = [];
    for (const edge of frame.edges) {
      if (edge.status !== status) {
        continue;
      }
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      if (!from || !to) {
        continue;
      }
      const fromPosition = threeProjectedPosition(from);
      const toPosition = threeProjectedPosition(to);
      points.push(fromPosition.x, fromPosition.y, fromPosition.z, toPosition.x, toPosition.y, toPosition.z);
    }
    if (points.length === 0) {
      return [];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const material = new THREE.LineBasicMaterial({
      color: nodeColor(status, false),
      transparent: true,
      opacity: status === "stable" ? 0.16 : 0.62,
    });
    return [new THREE.LineSegments(geometry, material)];
  });
}

function renderThreeScene(
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer,
  size: { width: number; height: number },
  view: GraphView,
) {
  camera.left = size.width / -2;
  camera.right = size.width / 2;
  camera.top = size.height / 2;
  camera.bottom = size.height / -2;
  camera.position.set(view.x, view.y, 1600);
  camera.zoom = view.zoom;
  camera.lookAt(view.x, view.y, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height, false);
  renderer.render(scene, camera);
}

function threeProjectedPosition(node: Pick<ReviewGraphNode, "x" | "y" | "z">): { x: number; y: number; z: number } {
  return {
    x: node.x + node.z * 0.34,
    y: node.y - node.z * 0.22,
    z: node.z * 0.08,
  };
}

function drawGeoJsonTiles(
  context: CanvasRenderingContext2D,
  size: { width: number; height: number },
  view: GraphView,
  geojson: ReturnType<typeof reviewGraphToGeoJson>,
  frame: ReviewGraphFrame,
) {
  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, size.width, size.height);
  drawTileGrid(context, size);
  const nodesById = new Map(frame.nodes.map((node) => [node.id, node]));

  context.lineCap = "round";
  for (const feature of geojson.features) {
    if (feature.properties.kind !== "edge") {
      continue;
    }
    const from = nodesById.get(feature.properties.from);
    const to = nodesById.get(feature.properties.to);
    if (!from || !to) {
      continue;
    }
    const a = worldToScreen(from, frame, view, size);
    const b = worldToScreen(to, frame, view, size);
    context.strokeStyle = rgbaCss(feature.properties.status, 0.34);
    context.lineWidth = feature.properties.status === "stable" ? 1 : 2;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }

  for (const node of frame.nodes) {
    const point = worldToScreen(node, frame, view, size);
    context.globalAlpha = node.alpha;
    context.fillStyle = nodeColor(node.status, node.inCycle);
    context.strokeStyle = node.inCycle ? "#111827" : "#ffffff";
    context.lineWidth = node.inCycle ? 2 : 1;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(3, node.size * 0.42 * view.zoom), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawTileGrid(context: CanvasRenderingContext2D, size: { width: number; height: number }) {
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 1;
  for (let x = 0; x <= size.width; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, size.height);
    context.stroke();
  }
  for (let y = 0; y <= size.height; y += 128) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size.width, y);
    context.stroke();
  }
}

function worldToScreen(
  node: Pick<ReviewGraphNode, "x" | "y">,
  frame: ReviewGraphFrame,
  view: GraphView,
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: size.width / 2 + (node.x - view.x) * view.zoom,
    y: size.height / 2 + (node.y - view.y) * view.zoom,
  };
}

function pickCanvasNode(
  frame: ReviewGraphFrame,
  view: GraphView,
  size: { width: number; height: number },
  x: number,
  y: number,
): ReviewGraphNode | undefined {
  let best: { node: ReviewGraphNode; distance: number } | undefined;
  for (const node of frame.nodes) {
    const point = worldToScreen(node, frame, view, size);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= Math.max(8, node.size * 0.5 * view.zoom) && (!best || distance < best.distance)) {
      best = { node, distance };
    }
  }
  return best?.node;
}

function pickThreeNode(
  event: ReactPointerEvent<HTMLDivElement>,
  mount: HTMLDivElement | null,
  camera: THREE.Camera | null,
  mesh: THREE.InstancedMesh | null,
): ReviewGraphNode | undefined {
  if (!mount || !camera || !mesh) {
    return undefined;
  }
  const rect = mount.getBoundingClientRect();
  const mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(mesh)[0];
  const nodes = mesh.userData.nodes as ReviewGraphNode[];
  return hit?.instanceId === undefined ? undefined : nodes[hit.instanceId];
}

function rgbaForStatus(status: ReviewGraphStatus, alpha: number): [number, number, number, number] {
  const [r, g, b] = rgbForStatus(status);
  return [r, g, b, alpha];
}

function rgbaCss(status: ReviewGraphStatus, alpha: number): string {
  const [r, g, b] = rgbForStatus(status);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

function nodeColor(status: ReviewGraphStatus, inCycle: boolean): string {
  if (inCycle) {
    return "#111827";
  }
  const [r, g, b] = rgbForStatus(status);
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbForStatus(status: ReviewGraphStatus): [number, number, number] {
  if (status === "added") {
    return [15, 118, 110];
  }
  if (status === "removed") {
    return [220, 38, 38];
  }
  if (status === "changed") {
    return [37, 99, 235];
  }
  if (status === "hotspot") {
    return [180, 83, 9];
  }
  return [148, 163, 184];
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(260, Math.round(rect.height || 420)),
      };
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    const interval = window.setInterval(update, 240);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.clearInterval(interval);
    };
  }, []);

  return [ref, size] as const;
}
