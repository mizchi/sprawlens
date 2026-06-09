import { hierarchy, treemap } from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import {
  buildModuleMapFrame,
  moduleIdForFilePath,
  type CodeLayer,
  type ModuleDependency,
  type ModuleFile,
  type ModuleMapFrame,
  type ModuleParcel,
  type ModuleSymbol,
} from "../core/moduleMap.js";
import type { GraphDiff, Snapshot } from "../core/types.js";
import { layoutDependencyMap } from "./moduleGraphLayout.js";
import {
  filePreviewLimit,
  scaledSvgFontSize,
  shouldShowNestedBlocks,
  zoomPercentLabel,
  type FileLayerMode,
} from "./moduleLayer.js";
import {
  focusViewport,
  panViewport,
  rectIntersectsViewport,
  viewportRect,
  viewportToViewBox,
  wheelZoomFactor,
  zoomViewportAt,
  type MapSize,
  type MapViewport,
  type ScreenPoint,
} from "./moduleViewport.js";

type ModuleCityMapProps = {
  snapshot: Snapshot | null;
  diff: GraphDiff | null;
  selectedFile: string;
  selectedModuleId: string;
  onSelectFile: (path: string) => void;
  onSelectModule: (moduleId: string) => void;
};

type LayoutNode = {
  module: ModuleParcel;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type FileLayoutNode = {
  file: ModuleFile;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  mode: FileLayerMode;
};

type SymbolLayoutNode = {
  symbol: ModuleSymbol;
  file: ModuleFile;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  viewport: MapViewport;
  moved: boolean;
};

type ModuleLayoutMode = "dependency" | "area";

const LAYERS: Array<{ key: CodeLayer; label: string; color: string }> = [
  { key: "runtime", label: "Runtime", color: "#9fb1c4" },
  { key: "test", label: "Test", color: "#6aa9a6" },
  { key: "tooling", label: "Tooling", color: "#c48a4a" },
  { key: "asset", label: "Asset", color: "#b98ad9" },
];

const FILE_PREVIEW_THRESHOLD = { width: 72, height: 48 };
const FILE_DETAIL_THRESHOLD = { width: 160, height: 112 };
const SYMBOL_DETAIL_THRESHOLD = { width: 112, height: 72 };
const FILE_LABEL_THRESHOLD = { width: 64, height: 22 };
const SYMBOL_LABEL_THRESHOLD = { width: 76, height: 22 };
const CLICK_DELAY_MS = 180;

export function ModuleCityMap(props: ModuleCityMapProps) {
  const [gridRef, gridSize] = useElementSize<HTMLDivElement>();
  const [wrapRef, , wrapElement] = useElementSize<HTMLDivElement>();
  const [viewport, setViewport] = useState<MapViewport>({ x: 0, y: 0, zoom: 1 });
  const [layoutMode, setLayoutMode] = useState<ModuleLayoutMode>("dependency");
  const [dragging, setDragging] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const clickTimerRef = useRef<number | null>(null);
  const width = Math.max(1, Math.round(gridSize.width));
  const measuredHeight = Math.round(gridSize.height);
  const height = Math.max(360, measuredHeight > 120 ? measuredHeight : Math.min(760, Math.round(width * 0.62)));
  const mapSize = useMemo(() => ({ width, height }), [height, width]);
  const frame = useMemo(
    () => (props.snapshot ? buildModuleMapFrame(props.snapshot, { diff: props.diff }) : null),
    [props.diff, props.snapshot],
  );
  const layouts = useMemo(() => (frame ? layoutModules(frame, width, height, layoutMode) : []), [frame, height, layoutMode, width]);
  const selectedModuleId = props.selectedModuleId || (props.selectedFile ? moduleIdForFilePath(props.selectedFile) : layouts[0]?.module.id ?? "");
  const selectedLayout = layouts.find((layout) => layout.module.id === selectedModuleId) ?? layouts[0];
  const dependencySet = useMemo(() => selectedDependencies(frame, selectedLayout?.module.id), [frame, selectedLayout?.module.id]);
  const zoom = viewport.zoom;
  const detailedModuleIds = useMemo(() => {
    return new Set(
      layouts
        .filter((layout) => rectIntersectsViewport(layout, viewport, mapSize))
        .filter((layout) => shouldShowNestedBlocks(layout, zoom, FILE_DETAIL_THRESHOLD))
        .map((layout) => layout.module.id),
    );
  }, [layouts, mapSize, viewport, zoom]);
  const previewModuleIds = useMemo(() => {
    return new Set(
      layouts
        .filter((layout) => !detailedModuleIds.has(layout.module.id))
        .filter((layout) => rectIntersectsViewport(layout, viewport, mapSize))
        .filter((layout) => shouldShowNestedBlocks(layout, zoom, FILE_PREVIEW_THRESHOLD))
        .map((layout) => layout.module.id),
    );
  }, [detailedModuleIds, layouts, mapSize, viewport, zoom]);
  const previewFileLayouts = useMemo(
    () => layoutPreviewFiles(layouts, zoom, previewModuleIds),
    [layouts, previewModuleIds, zoom],
  );
  const fileLayouts = useMemo(
    () => layouts.flatMap((layout) => (detailedModuleIds.has(layout.module.id) ? layoutFiles(layout, zoom, "detail") : [])),
    [detailedModuleIds, layouts, zoom],
  );
  const symbolLayouts = useMemo(
    () => fileLayouts.filter((layout) => shouldShowNestedBlocks(layout, zoom, SYMBOL_DETAIL_THRESHOLD)).flatMap((layout) => layoutSymbols(layout, zoom)),
    [fileLayouts, zoom],
  );
  const viewBox = viewportToViewBox(viewport, mapSize);

  useEffect(() => {
    if (!props.selectedModuleId && selectedLayout) {
      props.onSelectModule(selectedLayout.module.id);
    }
  }, [props.onSelectModule, props.selectedModuleId, selectedLayout]);

  useEffect(() => {
    if (!selectedLayout) {
      return;
    }
    setViewport((current) => focusViewport(mapSize, current.zoom, selectedLayout));
  }, [mapSize, selectedLayout?.module.id]);

  useEffect(() => {
    if (!wrapElement) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = pointInElement(event, wrapElement, mapSize);
      setViewport((current) => zoomViewportAt(current, mapSize, point, current.zoom * wheelZoomFactor(event.deltaY)));
    };
    wrapElement.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      wrapElement.removeEventListener("wheel", onWheel);
    };
  }, [mapSize, wrapElement]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  if (!frame) {
    return <div className="empty-state">No module map</div>;
  }

  const clearPendingClick = () => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  const scheduleClick = (action: () => void) => {
    clearPendingClick();
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      action();
    }, CLICK_DELAY_MS);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isToolbarTarget(event.target)) {
      return;
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer events used by tests may not have an active pointer.
      }
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      viewport,
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const delta = {
      x: event.clientX - drag.startClientX,
      y: event.clientY - drag.startClientY,
    };
    if (Math.hypot(delta.x, delta.y) > 3) {
      drag.moved = true;
    }
    setViewport(panViewport(drag.viewport, mapSize, delta));
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore release failures for synthetic pointer events.
    }
    dragRef.current = null;
    setDragging(false);
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const selectModule = (event: MouseEvent<SVGGElement>, moduleId: string) => {
    if (suppressClickRef.current) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    scheduleClick(() => {
      setInspectorOpen(true);
      props.onSelectModule(moduleId);
    });
  };

  const selectFile = (event: MouseEvent<SVGGElement>, path: string) => {
    event.stopPropagation();
    if (suppressClickRef.current) {
      return;
    }
    scheduleClick(() => {
      setInspectorOpen(true);
      props.onSelectFile(path);
    });
  };

  const zoomToRect = (event: MouseEvent<SVGGElement>, rect: { x0: number; y0: number; x1: number; y1: number }, minZoom: number) => {
    event.stopPropagation();
    event.preventDefault();
    clearPendingClick();
    setViewport((current) => focusViewport(mapSize, Math.max(current.zoom * 1.65, minZoom), rect));
  };

  return (
    <div ref={gridRef} className="module-map-grid">
      <div
        ref={wrapRef}
        className={dragging ? "module-map-wrap dragging" : "module-map-wrap"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <svg className="module-map" viewBox={viewBox} style={{ height }} role="img" aria-label="Module city map" data-file-layer={fileLayouts.length > 0 ? "detail" : "preview"}>
          <defs>
            <marker id="module-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L7,3 z" />
            </marker>
          </defs>
          <ModuleDependencyLines dependencies={dependencySet.visible} layouts={layouts} selectedModuleId={selectedLayout?.module.id ?? ""} />
          {layouts.map((layout) => {
            const selected = layout.module.id === selectedLayout?.module.id;
            const related = dependencySet.relatedModuleIds.has(layout.module.id);
            return (
              <g
                key={layout.module.id}
                className="module-parcel"
                onClick={(event) => selectModule(event, layout.module.id)}
                onDoubleClick={(event) => zoomToRect(event, layout, 2)}
              >
                <rect
                  x={layout.x0}
                  y={layout.y0}
                  width={layout.x1 - layout.x0}
                  height={layout.y1 - layout.y0}
                  className={moduleClass(layout.module, selected, related)}
                />
                <LayerBars module={layout.module} x={layout.x0 + 8 / zoom} y={layout.y1 - 12 / zoom} width={layout.x1 - layout.x0 - 16 / zoom} zoom={zoom} />
                {(layout.x1 - layout.x0 > 86 / zoom && layout.y1 - layout.y0 > 54 / zoom) || selected ? (
                  <>
                    <text x={layout.x0 + 9 / zoom} y={layout.y0 + 18 / zoom} className="module-label" fontSize={scaledSvgFontSize(13, zoom)}>
                      {layout.module.label}
                    </text>
                    <text x={layout.x0 + 9 / zoom} y={layout.y0 + 33 / zoom} className="module-sub" fontSize={scaledSvgFontSize(10, zoom)}>
                      {layout.module.fileCount} files / {formatNumber(layout.module.loc)} LOC
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
          <g className="file-preview-layer">
            {previewFileLayouts.map((layout) => (
              <rect
                key={`${layout.file.path}:preview`}
                x={layout.x0}
                y={layout.y0}
                width={layout.x1 - layout.x0}
                height={layout.y1 - layout.y0}
                className={fileClass(layout.file, false, "preview")}
              />
            ))}
          </g>
          {selectedLayout
            ? fileLayouts.map((layout) => (
                <g
                  key={layout.file.path}
                  className="file-tile"
                  onClick={(event) => selectFile(event, layout.file.path)}
                  onDoubleClick={(event) => zoomToRect(event, layout, 3.2)}
                >
                  <rect
                    x={layout.x0}
                    y={layout.y0}
                    width={layout.x1 - layout.x0}
                    height={layout.y1 - layout.y0}
                    className={fileClass(layout.file, props.selectedFile === layout.file.path)}
                  />
                  {shouldShowNestedBlocks(layout, zoom, FILE_LABEL_THRESHOLD) ? (
                    <text x={layout.x0 + 3 / zoom} y={layout.y0 + 10 / zoom} fontSize={scaledSvgFontSize(9, zoom)} className="file-label">
                      {layout.file.label}
                    </text>
                  ) : null}
                </g>
              ))
            : null}
          <g className="symbol-layer">
            {symbolLayouts.map((layout) => (
              <g
                key={layout.symbol.id}
                className="symbol-tile"
                onClick={(event) => selectFile(event, layout.file.path)}
                onDoubleClick={(event) => zoomToRect(event, layout, 4.2)}
              >
                <rect
                  x={layout.x0}
                  y={layout.y0}
                  width={layout.x1 - layout.x0}
                  height={layout.y1 - layout.y0}
                  className={symbolClass(layout.symbol)}
                />
                {shouldShowNestedBlocks(layout, zoom, SYMBOL_LABEL_THRESHOLD) ? (
                  <text x={layout.x0 + 3 / zoom} y={layout.y0 + 10 / zoom} fontSize={scaledSvgFontSize(9, zoom)} className="symbol-label">
                    {layout.symbol.label}
                  </text>
                ) : null}
              </g>
            ))}
          </g>
        </svg>
        <ModuleMiniMap layouts={layouts} mapSize={mapSize} viewport={viewport} selectedModuleId={selectedLayout?.module.id ?? ""} />
        <div className="module-map-toolbar">
          <label>
            Layout
            <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as ModuleLayoutMode)}>
              <option value="dependency">Dependency</option>
              <option value="area">Area</option>
            </select>
          </label>
          <label>
            Zoom
            <input
              type="range"
              min={1}
              max={4.5}
              step={0.1}
              value={zoom}
              onChange={(event) => setViewport((current) => zoomViewportAt(current, mapSize, { x: width / 2, y: height / 2 }, Number(event.target.value)))}
            />
          </label>
          <button type="button" onClick={() => setInspectorOpen((open) => !open)}>
            Details
          </button>
        </div>
      </div>
      {inspectorOpen ? (
        <ModuleInspector
          frame={frame}
          module={selectedLayout?.module}
          dependencies={dependencySet}
          onSelectModule={(moduleId) => {
            setInspectorOpen(true);
            props.onSelectModule(moduleId);
          }}
          onSelectFile={(path) => {
            setInspectorOpen(true);
            props.onSelectFile(path);
          }}
          onClose={() => setInspectorOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ModuleMiniMap(props: { layouts: LayoutNode[]; mapSize: MapSize; viewport: MapViewport; selectedModuleId: string }) {
  const visible = viewportRect(props.viewport, props.mapSize);
  return (
    <aside className="module-minimap" aria-label="Map overview">
      <svg className="module-minimap-svg" viewBox={`0 0 ${props.mapSize.width} ${props.mapSize.height}`} preserveAspectRatio="none" role="img" aria-label="Minimap">
        {props.layouts.map((layout) => (
          <rect
            key={layout.module.id}
            x={layout.x0}
            y={layout.y0}
            width={layout.x1 - layout.x0}
            height={layout.y1 - layout.y0}
            className={layout.module.id === props.selectedModuleId ? "minimap-module selected" : `minimap-module ${layout.module.status}`}
          />
        ))}
        <rect
          x={visible.x0}
          y={visible.y0}
          width={visible.x1 - visible.x0}
          height={visible.y1 - visible.y0}
          className="minimap-viewport"
        />
      </svg>
      <div className="module-minimap-zoom">{zoomPercentLabel(props.viewport.zoom)}</div>
    </aside>
  );
}

function ModuleDependencyLines(props: { dependencies: ModuleDependency[]; layouts: LayoutNode[]; selectedModuleId: string }) {
  const layoutById = new Map(props.layouts.map((layout) => [layout.module.id, layout]));
  return (
    <g className="module-dependencies">
      {props.dependencies.map((dependency) => {
        const from = layoutById.get(dependency.from);
        const to = layoutById.get(dependency.to);
        if (!from || !to) {
          return null;
        }
        const a = rectCenter(from);
        const b = rectCenter(to);
        const selectedOutgoing = dependency.from === props.selectedModuleId;
        return (
          <line
            key={dependency.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            markerEnd="url(#module-arrow)"
            className={dependency.changed ? "module-dep changed" : selectedOutgoing ? "module-dep outgoing" : "module-dep incoming"}
            strokeWidth={Math.min(8, 1.5 + Math.sqrt(dependency.importCount))}
          />
        );
      })}
    </g>
  );
}

function LayerBars(props: { module: ModuleParcel; x: number; y: number; width: number; zoom: number }) {
  if (props.width <= 1) {
    return null;
  }
  const total = Math.max(1, props.module.fileCount);
  let x = props.x;
  return (
    <g className="layer-bars">
      {LAYERS.map((layer) => {
        const width = props.width * (props.module.layerCounts[layer.key] / total);
        const rect = <rect key={layer.key} x={x} y={props.y} width={width} height={4 / props.zoom} fill={layer.color} />;
        x += width;
        return rect;
      })}
    </g>
  );
}

function ModuleInspector(props: {
  frame: ModuleMapFrame;
  module?: ModuleParcel;
  dependencies: ReturnType<typeof selectedDependencies>;
  onSelectModule: (moduleId: string) => void;
  onSelectFile: (path: string) => void;
  onClose: () => void;
}) {
  if (!props.module) {
    return (
      <aside className="module-inspector empty-state">
        <button className="panel-close" type="button" onClick={props.onClose} aria-label="Close details">
          Close
        </button>
        <span>No module selected</span>
      </aside>
    );
  }
  const incoming = props.dependencies.incoming.slice(0, 10);
  const outgoing = props.dependencies.outgoing.slice(0, 10);

  return (
    <aside className="module-inspector">
      <div className="section-head compact">
        <h2>{props.module.label}</h2>
        <button className="panel-close" type="button" onClick={props.onClose} aria-label="Close details">
          Close
        </button>
      </div>
      <span className="meta-label">{props.module.path}</span>
      <dl className="module-stats">
        <div>
          <dt>LOC</dt>
          <dd>{formatNumber(props.module.loc)}</dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>{props.module.fileCount}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{props.module.layerCounts.runtime}</dd>
        </div>
        <div>
          <dt>Tests</dt>
          <dd>{props.module.layerCounts.test}</dd>
        </div>
      </dl>
      <DependencyList title="Depends On" dependencies={outgoing} frame={props.frame} side="to" onSelectModule={props.onSelectModule} />
      <DependencyList title="Used By" dependencies={incoming} frame={props.frame} side="from" onSelectModule={props.onSelectModule} />
      <section className="module-files">
        <h3>Largest Files</h3>
        <ul>
          {props.module.files.slice(0, 12).map((file) => (
            <li key={file.path} onClick={() => props.onSelectFile(file.path)}>
              <span className={`layer-dot ${file.layer}`} />
              <span>{file.path}</span>
              <strong>{formatNumber(file.loc)}</strong>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function DependencyList(props: {
  title: string;
  dependencies: ModuleDependency[];
  frame: ModuleMapFrame;
  side: "from" | "to";
  onSelectModule: (moduleId: string) => void;
}) {
  const moduleById = new Map(props.frame.modules.map((module) => [module.id, module]));
  return (
    <section className="module-dep-list">
      <h3>{props.title}</h3>
      <ul>
        {props.dependencies.map((dependency) => {
          const moduleId = dependency[props.side];
          const module = moduleById.get(moduleId);
          return (
            <li key={dependency.id} onClick={() => props.onSelectModule(moduleId)}>
              <span>{module?.path ?? moduleId}</span>
              <strong>{dependency.importCount}</strong>
            </li>
          );
        })}
        {props.dependencies.length === 0 ? <li className="empty-neighbor">None</li> : null}
      </ul>
    </section>
  );
}

function layoutModules(frame: ModuleMapFrame, width: number, height: number, mode: ModuleLayoutMode): LayoutNode[] {
  if (mode === "dependency") {
    const moduleById = new Map(frame.modules.map((module) => [module.id, module]));
    return layoutDependencyMap(frame.modules, frame.dependencies, { width, height }).flatMap((rect) => {
      const module = moduleById.get(rect.id);
      return module
        ? [
            {
              module,
              x0: rect.x0,
              y0: rect.y0,
              x1: rect.x1,
              y1: rect.y1,
            },
          ]
        : [];
    });
  }

  const root = hierarchy<{ children?: ModuleParcel[]; module?: ModuleParcel }>({ children: frame.modules })
    .sum((node) => node.module?.loc ?? ("loc" in node ? Number(node.loc) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laidOut = treemap<{ children?: ModuleParcel[]; module?: ModuleParcel }>()
    .size([width, height])
    .paddingOuter(2)
    .paddingInner(3)
    .round(true)(root);

  return (laidOut.leaves() as Array<HierarchyRectangularNode<{ children?: ModuleParcel[]; module?: ModuleParcel }>>).map((leaf) => {
    const module = leaf.data as unknown as ModuleParcel;
    return {
      module,
      x0: leaf.x0,
      y0: leaf.y0,
      x1: leaf.x1,
      y1: leaf.y1,
    };
  });
}

function layoutPreviewFiles(layouts: LayoutNode[], zoom: number, previewModuleIds: ReadonlySet<string>): FileLayoutNode[] {
  const limit = filePreviewLimit(zoom);
  return layouts.flatMap((layout) => (previewModuleIds.has(layout.module.id) ? layoutFiles(layout, zoom, "preview", limit) : []));
}

function layoutFiles(layout: LayoutNode | undefined, zoom: number, mode: FileLayerMode, limit?: number): FileLayoutNode[] {
  if (!layout) {
    return [];
  }
  const padding = (mode === "preview" ? 4 : 12) / zoom;
  const width = layout.x1 - layout.x0 - padding * 2;
  const height = layout.y1 - layout.y0 - padding * (mode === "preview" ? 2 : 2);
  const minWidth = (mode === "preview" ? 18 : 80) / zoom;
  const minHeight = (mode === "preview" ? 16 : 60) / zoom;
  if (width < minWidth || height < minHeight) {
    return [];
  }
  const files = typeof limit === "number" ? layout.module.files.slice(0, limit) : layout.module.files;
  const root = hierarchy<{ children?: ModuleFile[]; file?: ModuleFile }>({ children: files })
    .sum((node) => node.file?.loc ?? ("loc" in node ? Number(node.loc) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laidOut = treemap<{ children?: ModuleFile[]; file?: ModuleFile }>()
    .size([width, height])
    .paddingInner(Math.max(0.35, (mode === "preview" ? 1 : 2) / zoom))
    .round(true)(root);
  return (laidOut.leaves() as Array<HierarchyRectangularNode<{ children?: ModuleFile[]; file?: ModuleFile }>>).map((leaf) => {
    const file = leaf.data as unknown as ModuleFile;
    return {
      file,
      x0: layout.x0 + padding + leaf.x0,
      y0: layout.y0 + padding + leaf.y0,
      x1: layout.x0 + padding + leaf.x1,
      y1: layout.y0 + padding + leaf.y1,
      mode,
    };
  });
}

function layoutSymbols(layout: FileLayoutNode, zoom: number): SymbolLayoutNode[] {
  if (layout.file.symbols.length === 0) {
    return [];
  }
  const padding = 4 / zoom;
  const width = layout.x1 - layout.x0 - padding * 2;
  const height = layout.y1 - layout.y0 - padding * 2;
  if (width < 32 / zoom || height < 24 / zoom) {
    return [];
  }
  const root = hierarchy<{ children?: ModuleSymbol[]; symbol?: ModuleSymbol }>({ children: layout.file.symbols })
    .sum((node) => node.symbol?.loc ?? ("loc" in node ? Number(node.loc) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laidOut = treemap<{ children?: ModuleSymbol[]; symbol?: ModuleSymbol }>()
    .size([width, height])
    .paddingInner(Math.max(0.25, 1 / zoom))
    .round(true)(root);
  return (laidOut.leaves() as Array<HierarchyRectangularNode<{ children?: ModuleSymbol[]; symbol?: ModuleSymbol }>>).map((leaf) => {
    const symbol = leaf.data as unknown as ModuleSymbol;
    return {
      symbol,
      file: layout.file,
      x0: layout.x0 + padding + leaf.x0,
      y0: layout.y0 + padding + leaf.y0,
      x1: layout.x0 + padding + leaf.x1,
      y1: layout.y0 + padding + leaf.y1,
    };
  });
}

function selectedDependencies(frame: ModuleMapFrame | null, moduleId?: string) {
  if (!frame || !moduleId) {
    return {
      incoming: [] as ModuleDependency[],
      outgoing: [] as ModuleDependency[],
      visible: [] as ModuleDependency[],
      relatedModuleIds: new Set<string>(),
    };
  }
  const incoming = frame.dependencies.filter((dependency) => dependency.to === moduleId);
  const outgoing = frame.dependencies.filter((dependency) => dependency.from === moduleId);
  const visible = [...incoming, ...outgoing].sort((a, b) => b.importCount - a.importCount).slice(0, 24);
  return {
    incoming,
    outgoing,
    visible,
    relatedModuleIds: new Set(visible.flatMap((dependency) => [dependency.from, dependency.to])),
  };
}

function rectCenter(layout: LayoutNode): { x: number; y: number } {
  return {
    x: (layout.x0 + layout.x1) / 2,
    y: (layout.y0 + layout.y1) / 2,
  };
}

function moduleClass(module: ModuleParcel, selected: boolean, related: boolean): string {
  return ["module-rect", module.status, selected ? "selected" : "", related ? "related" : ""].filter(Boolean).join(" ");
}

function fileClass(file: ModuleFile, selected: boolean, mode: FileLayerMode = "detail"): string {
  return ["file-rect", mode, file.layer, file.status, file.inCycle ? "cycle" : "", selected ? "selected" : ""].filter(Boolean).join(" ");
}

function symbolClass(symbol: ModuleSymbol): string {
  return ["symbol-rect", symbol.kind, symbol.exported ? "exported" : "", symbol.status].filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pointInElement(event: { clientX: number; clientY: number }, element: HTMLElement, size: MapSize): ScreenPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * size.width, 0, size.width),
    y: clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * size.height, 0, size.height),
  };
}

function isToolbarTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest(".module-map-toolbar"));
}

function useElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });
  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    const update = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height || 420)),
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
  }, [element]);

  return [ref, size, element] as const;
}
