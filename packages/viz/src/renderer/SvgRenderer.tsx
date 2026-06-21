import { RingsMapSvg } from "../RingsMapSvg.tsx";
import { TreemapSvg } from "../TreemapSvg.tsx";
import type { MapHandlers, MapScene } from "./contract.ts";

/**
 * The SVG implementation of the renderer boundary. Unpacks a {@link MapScene}
 * into the rings / treemap SVG components (the only DOM-coupled drawers); a
 * TUI or three.js renderer would take the same `{ scene, ...handlers }` and
 * draw it some other way.
 */
export function SvgRenderer({
  scene,
  ...handlers
}: { scene: MapScene } & MapHandlers) {
  if (scene.kind === "rings") {
    return (
      <RingsMapSvg
        rings={scene.rings}
        innerCells={scene.innerCells}
        fileEdges={scene.edges.file}
        symbolEdges={scene.edges.symbol}
        detailEdges={scene.edges.detail}
        traceEdges={scene.edges.trace}
        traceHeat={scene.edges.traceHeat}
        testStatus={scene.testStatus}
        testDuration={scene.testDuration}
        showEdges={scene.showEdges}
        showFiles={scene.showFiles}
        visibleLevels={scene.visibleLevels}
        cfgEntries={scene.cfgEntries}
        compactModuleLabels={scene.compactModuleLabels}
        cyclicIds={scene.cyclicIds}
        cyclicModuleIds={scene.cyclicModuleIds}
        labels={scene.labels}
        exportedIds={scene.exportedIds}
        symbolKindOf={scene.symbolKindOf}
        focus={scene.focus}
        testFileIds={scene.testFileIds}
        layers={scene.layers}
        altEdges={scene.altEdges}
        hiddenLayers={scene.hiddenLayers}
        parentFileOf={scene.parentFileOf}
        changedOf={scene.changedOf}
        portNodes={scene.portNodes}
        width={scene.width}
        height={scene.height}
        labelMinPx={scene.labelMinPx}
        labelScale={scene.labelScale}
        tilt={scene.tilt}
        onTiltDrag={handlers.onTiltDrag}
        selectedId={handlers.selectedId}
        selectedIds={handlers.selectedIds}
        selectedEdges={handlers.selectedEdges}
        onSelect={handlers.onSelect}
        onSelectEdge={handlers.onSelectEdge}
        onFocusId={handlers.onFocusId}
        focusRequest={handlers.focusRequest}
        onViewSettle={handlers.onViewSettle}
        onSymbolHover={handlers.onSymbolHover}
        onRunTest={handlers.onRunTest}
      />
    );
  }
  return (
    <TreemapSvg
      state={scene.state}
      innerCells={scene.innerCells}
      exportedIds={scene.exportedIds}
      symbolKindOf={scene.symbolKindOf}
      parentFileOf={scene.parentFileOf}
      fileEdges={scene.edges.file}
      traceEdges={scene.edges.trace}
      traceHeat={scene.edges.traceHeat}
      showEdges={scene.showEdges}
      visibleLevels={scene.visibleLevels}
      cfgEntries={scene.cfgEntries}
      leafKind={scene.leafKind}
      labels={scene.labels}
      changedOf={scene.changedOf}
      cyclicIds={scene.cyclicIds}
      testFileIds={scene.testFileIds}
      layers={scene.layers}
      altEdges={scene.altEdges}
      focus={scene.focus}
      width={scene.width}
      height={scene.height}
      labelMinPx={scene.labelMinPx}
      labelScale={scene.labelScale}
      tilt={scene.tilt}
      onTiltDrag={handlers.onTiltDrag}
      selectedId={handlers.selectedId}
      selectedIds={handlers.selectedIds}
      selectedEdges={handlers.selectedEdges}
      onSelect={handlers.onSelect}
      onSelectEdge={handlers.onSelectEdge}
      onFocusId={handlers.onFocusId}
      focusRequest={handlers.focusRequest}
      onViewSettle={handlers.onViewSettle}
      onSymbolHover={handlers.onSymbolHover}
      onRunTest={handlers.onRunTest}
    />
  );
}
