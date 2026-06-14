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
  /** Edge proximity pick, run in the click capture phase before any node or
   * background handler. Returns true when it consumed the click (an edge was
   * near), so overlapping edges win over the filled shape beneath them. */
  onPickEdge?: (
    clientX: number,
    clientY: number,
    shiftKey: boolean,
  ) => boolean;
  /** Pointer hover (no button), for edge-proximity preview. Not fired while
   * panning. */
  onHover?: (clientX: number, clientY: number) => void;
  /** Alt+drag tilts the plane instead of panning: dx/dy are screen-pixel
   * deltas the caller maps to rotation / pitch radians. */
  onTilt?: (dxPx: number, dyPx: number) => void;
}) {
  const { width, height, focusRequest, onViewSettle } = options;
  const onPickEdgeRef = useRef(options.onPickEdge);
  onPickEdgeRef.current = options.onPickEdge;
  const onHoverRef = useRef(options.onHover);
  onHoverRef.current = options.onHover;
  const onTiltRef = useRef(options.onTilt);
  onTiltRef.current = options.onTilt;
  const viewRef = useRef<ViewBox>({ x: 0, y: 0, w: width, h: height });
  const [committedView, setCommittedView] = useState<ViewBox>(viewRef.current);
  const commitTimer = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    last: Vec2;
    moved: number;
    /** "tilt" = Alt-held drag adjusting the plane orientation, not the view. */
    mode: "pan" | "tilt";
  } | null>(null);
  /** A drag that actually panned must not select on release. */
  const suppressClickRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  /** The tilted content group; its CTM folds in the affine so client→world
   * picking inverts viewBox and tilt in one shot. Falls back to the svg. */
  const contentRef = useRef<SVGGElement>(null);

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

  /** World units per screen pixel. The CTM accounts for the viewBox and
   * preserveAspectRatio letterboxing; the rect ratio is a fallback. */
  const toViewScale = () => {
    const ctm = svgRef.current?.getScreenCTM();
    if (ctm && ctm.a !== 0) return 1 / ctm.a;
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? viewRef.current.w / rect.width : 1;
  };

  /** Screen (client) coordinates → world coordinates under the live view.
   * Uses the SVG CTM so letterboxing (xMidYMid meet) doesn't skew the
   * mapping — essential for proximity hit-testing against edge geometry. */
  const clientToWorld = (clientX: number, clientY: number): Vec2 | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    // pick against the tilted group's CTM when present so edge geometry
    // (stored in pre-tilt world coords) lines up under the affine
    const ctm = contentRef.current?.getScreenCTM() ?? svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
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
        return;
      }
      // edge picking runs first: a click within range of an edge selects it
      // and stops here, so it beats the filled district/circle underneath
      if (onPickEdgeRef.current?.(e.clientX, e.clientY, e.shiftKey)) {
        e.stopPropagation();
      }
    },
    onWheel,
    onPointerDown: (e: PointerEvent) => {
      cancelFlight();
      // Alt+drag rotates/pitches the plane; only when a tilt sink is wired
      const tilt = e.altKey && !!onTiltRef.current;
      dragRef.current = {
        pointerId: e.pointerId,
        last: { x: e.clientX, y: e.clientY },
        moved: 0,
        mode: tilt ? "tilt" : "pan",
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) {
        // hovering (no active pan): surface what an edge click would pick
        onHoverRef.current?.(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - drag.last.x;
      const dy = e.clientY - drag.last.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.last = { x: e.clientX, y: e.clientY };
      if (drag.mode === "tilt") {
        onTiltRef.current?.(dx, dy);
        return;
      }
      const scale = toViewScale();
      const v = viewRef.current;
      viewRef.current = {
        ...v,
        x: v.x - dx * scale,
        y: v.y - dy * scale,
      };
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
    contentRef,
    cancelFlight,
    clientToWorld,
    toViewScale,
  };
}
