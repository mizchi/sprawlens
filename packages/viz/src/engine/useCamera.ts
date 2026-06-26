import { useRef, useState } from "preact/hooks";
import type { Vec2 } from "@sprawlens/layout";
import type { FocusRequest } from "../useMapViewport.ts";

/** A world-space bounding box. */
export type Bounds = { x0: number; x1: number; y0: number; y1: number };

/**
 * Camera state: the pending fly-to request the renderer's viewport consumes,
 * and the settled view (center + zoom) the LOD budget reads. `focusBounds` is
 * the generic "frame this bbox" primitive every focus path funnels through;
 * resolving ids/edges to a bbox stays in the host where the geometry lives.
 * Renderer-agnostic — extent is just the framing aspect ratio.
 */
export function useCamera(extent: { width: number; height: number }) {
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [viewInfo, setViewInfo] = useState({
    x: extent.width / 2,
    y: extent.height / 2,
    zoom: 1,
  });
  const viewInfoRef = useRef(viewInfo);
  viewInfoRef.current = viewInfo;

  /** Fly the camera to a view rect framing a world-space bbox. */
  const focusBounds = (bounds: Bounds, padding = 2.5) => {
    // point geometry (ports) gets a fixed frame; padding then scales it
    const w = bounds.x1 - bounds.x0 || 60;
    const h = bounds.y1 - bounds.y0 || 60;
    // frame the bbox with padding: at the default the target ends up ~40% of
    // the view; larger paddings frame its neighborhood instead
    const viewW = Math.max(w, (h * extent.width) / extent.height) * padding;
    setFocusRequest((prev) => ({
      cx: (bounds.x0 + bounds.x1) / 2,
      cy: (bounds.y0 + bounds.y1) / 2,
      viewW,
      token: (prev?.token ?? 0) + 1,
    }));
  };

  /** Fly to an explicit center + world view width (no bbox). Used to restore a
   * snapshotted view, e.g. when the command palette cancels its zoom preview. */
  const restoreView = (center: Vec2, viewW: number) =>
    setFocusRequest((prev) => ({
      cx: center.x,
      cy: center.y,
      viewW,
      token: (prev?.token ?? 0) + 1,
    }));

  /** Record where a view settled (LOD commit); world center + zoom. */
  const onViewSettle = (center: Vec2, zoom: number) =>
    setViewInfo({ x: center.x, y: center.y, zoom });

  return { focusRequest, viewInfo, viewInfoRef, focusBounds, restoreView, onViewSettle };
}
