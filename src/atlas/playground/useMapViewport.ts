import { useEffect, useRef, useState } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import type { Vec2 } from "../kernel/vec.js";

/** Camera-flight target: the view rect that frames the jump target's bbox. */
export type FocusRequest = {
  cx: number;
  cy: number;
  viewW: number;
  token: number;
};

/** Dependency-path extraction state, precomputed by the App per level. */
export type FocusView = {
  level: "module" | "file" | "symbol";
  moduleIds: Set<string>;
  fileIds: Set<string>;
  symbolIds: Set<string>;
  /**
   * Reached intermediate boundary groups (directory etc.) when the focus
   * runs at such a level; absent for module/file/symbol extractions.
   */
  groupIds?: Set<string>;
  /** Paths the focused node depends on. */
  downstreamEdges: AtlasEdge[];
  /** Paths that depend on the focused node. */
  upstreamEdges: AtlasEdge[];
};

export type ViewBox = { x: number; y: number; w: number; h: number };

const COMMIT_MS = 120;
/** Deepest zoom-in: dynamic detail levels (CFG inside a symbol cell)
 * need far more magnification than the cell map itself. */
const MAX_ZOOM = 400;
const FLIGHT_MS = 450;

/**
 * Shared map-viewport behavior for the SVG map components: interactive
 * zoom/pan writes the viewBox straight to the DOM (cheap), while the
 * LOD-affecting re-render (label sizing, culling, mode switches) commits at
 * most every COMMIT_MS after the gesture settles. Re-rendering ~1.4k SVG
 * nodes per wheel event is what froze the tab before this split.
 *
 * Also owns the camera flight: the view eases toward a FocusRequest rect
 * instead of teleporting; any user input cancels the flight.
 */
export function useMapViewport(options: {
  width: number;
  height: number;
  focusRequest?: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
}) {
  const { width, height, focusRequest, onViewSettle } = options;
  const viewRef = useRef<ViewBox>({ x: 0, y: 0, w: width, h: height });
  const [committedView, setCommittedView] = useState<ViewBox>(viewRef.current);
  const commitTimer = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    last: Vec2;
    moved: number;
  } | null>(null);
  /** A drag that actually panned must not select on release. */
  const suppressClickRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const commitView = () => {
    const v = { ...viewRef.current };
    setCommittedView(v);
    onViewSettle?.({ x: v.x + v.w / 2, y: v.y + v.h / 2 }, width / v.w);
  };
  const applyView = () => {
    const v = viewRef.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    // trailing debounce: committing (and thus re-running LOD + inserting
    // hundreds of nodes) mid-gesture made zooming back out janky — the
    // gesture stays on the cheap scaled-raster path until it settles
    clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = 0;
      commitView();
    }, COMMIT_MS);
  };
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  // camera flight: ease the view toward the requested rect instead of
  // teleporting. Zoom interpolates in log space (perceptually linear);
  // any user input cancels the flight.
  const flightRef = useRef(0);
  const cancelFlight = () => {
    cancelAnimationFrame(flightRef.current);
    flightRef.current = 0;
  };
  useEffect(() => {
    if (!focusRequest) return;
    cancelFlight();
    const from = { ...viewRef.current };
    const fromCx = from.x + from.w / 2;
    const fromCy = from.y + from.h / 2;
    const toW = Math.min(Math.max(focusRequest.viewW, width / MAX_ZOOM), width * 3);
    const toH = toW * (height / width);
    // rAF never fires in hidden tabs — land instantly there
    if (document.visibilityState === "hidden") {
      viewRef.current = {
        x: focusRequest.cx - toW / 2,
        y: focusRequest.cy - toH / 2,
        w: toW,
        h: toH,
      };
      const v = viewRef.current;
      svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
      commitView();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / FLIGHT_MS, 1);
      const e = 1 - (1 - t) ** 3; // easeOutCubic
      const w = from.w * (toW / from.w) ** e;
      const h = from.h * (toH / from.h) ** e;
      const cx = fromCx + (focusRequest.cx - fromCx) * e;
      const cy = fromCy + (focusRequest.cy - fromCy) * e;
      viewRef.current = { x: cx - w / 2, y: cy - h / 2, w, h };
      const v = viewRef.current;
      svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
      if (t < 1) {
        flightRef.current = requestAnimationFrame(step);
      } else {
        flightRef.current = 0;
        commitView();
      }
    };
    flightRef.current = requestAnimationFrame(step);
    return cancelFlight;
  }, [focusRequest?.token]);

  const toViewScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? viewRef.current.w / rect.width : 1;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    cancelFlight();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = Math.exp(event.deltaY * 0.0018);
    const v = viewRef.current;
    const newW = Math.min(Math.max(v.w * factor, width / MAX_ZOOM), width * 3);
    const scale = newW / v.w;
    const px = v.x + ((event.clientX - rect.left) / rect.width) * v.w;
    const py = v.y + ((event.clientY - rect.top) / rect.height) * v.h;
    viewRef.current = {
      x: px - (px - v.x) * scale,
      y: py - (py - v.y) * scale,
      w: newW,
      h: v.h * scale,
    };
    applyView();
  };

  /** Spread onto the <svg>; the component adds its own onClick(deselect). */
  const svgProps = {
    ref: svgRef,
    viewBox: `${viewRef.current.x} ${viewRef.current.y} ${viewRef.current.w} ${viewRef.current.h}`,
    onClickCapture: (e: MouseEvent) => {
      // the click fired by releasing a pan must not (de)select anything
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
    onWheel,
    onPointerDown: (e: PointerEvent) => {
      cancelFlight();
      dragRef.current = {
        pointerId: e.pointerId,
        last: { x: e.clientX, y: e.clientY },
        moved: 0,
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.last.x;
      const dy = e.clientY - drag.last.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      const scale = toViewScale();
      const v = viewRef.current;
      viewRef.current = {
        ...v,
        x: v.x - dx * scale,
        y: v.y - dy * scale,
      };
      drag.last = { x: e.clientX, y: e.clientY };
      applyView();
    },
    onPointerUp: (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.pointerId === e.pointerId) {
        // ~5px of accumulated motion = a pan, not a click
        if (drag.moved > 5) suppressClickRef.current = true;
        dragRef.current = null;
      }
    },
  };

  return {
    svgProps,
    committedView,
    zoom: width / committedView.w,
    viewRef,
    cancelFlight,
  };
}
