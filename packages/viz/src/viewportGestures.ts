import type { Vec2 } from "@sprawlens/layout";

export type ViewBox = { x: number; y: number; w: number; h: number };
export type ClientRectLike = { left: number; top: number; width: number; height: number };

function clampViewWidth(w: number, worldWidth: number, maxZoom: number): number {
  return Math.min(Math.max(w, worldWidth / maxZoom), worldWidth * 3);
}

function clientRatio(rect: ClientRectLike, client: Vec2): Vec2 {
  return {
    x: rect.width === 0 ? 0.5 : (client.x - rect.left) / rect.width,
    y: rect.height === 0 ? 0.5 : (client.y - rect.top) / rect.height,
  };
}

export function pointDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function zoomViewAtClientPoint(args: {
  view: ViewBox;
  rect: ClientRectLike;
  client: Vec2;
  factor: number;
  worldWidth: number;
  maxZoom: number;
}): ViewBox {
  const { view, rect, client, factor, worldWidth, maxZoom } = args;
  const ratio = clientRatio(rect, client);
  const nextW = clampViewWidth(view.w * factor, worldWidth, maxZoom);
  const scale = nextW / view.w;
  const anchor = { x: view.x + ratio.x * view.w, y: view.y + ratio.y * view.h };
  const nextH = view.h * scale;
  return {
    x: anchor.x - ratio.x * nextW,
    y: anchor.y - ratio.y * nextH,
    w: nextW,
    h: nextH,
  };
}

export function panViewByClientDelta(
  view: ViewBox,
  dx: number,
  dy: number,
  scale: number,
): ViewBox {
  return {
    ...view,
    x: view.x - dx * scale,
    y: view.y - dy * scale,
  };
}

export function pinchView(args: {
  startView: ViewBox;
  rect: ClientRectLike;
  startDistance: number;
  startMidpoint: Vec2;
  currentDistance: number;
  currentMidpoint: Vec2;
  worldWidth: number;
  maxZoom: number;
}): ViewBox {
  const {
    startView,
    rect,
    startDistance,
    startMidpoint,
    currentDistance,
    currentMidpoint,
    worldWidth,
    maxZoom,
  } = args;
  if (startDistance <= 0 || currentDistance <= 0) return startView;
  const startRatio = clientRatio(rect, startMidpoint);
  const currentRatio = clientRatio(rect, currentMidpoint);
  const nextW = clampViewWidth(
    startView.w * (startDistance / currentDistance),
    worldWidth,
    maxZoom,
  );
  const scale = nextW / startView.w;
  const anchor = {
    x: startView.x + startRatio.x * startView.w,
    y: startView.y + startRatio.y * startView.h,
  };
  const nextH = startView.h * scale;
  return {
    x: anchor.x - currentRatio.x * nextW,
    y: anchor.y - currentRatio.y * nextH,
    w: nextW,
    h: nextH,
  };
}
