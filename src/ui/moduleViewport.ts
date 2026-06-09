export type MapViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type MapSize = {
  width: number;
  height: number;
};

export type MapRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export const MIN_MODULE_MAP_ZOOM = 1;
export const MAX_MODULE_MAP_ZOOM = 4.5;

export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_MODULE_MAP_ZOOM, MAX_MODULE_MAP_ZOOM);
}

export function clampViewport(viewport: MapViewport, size: MapSize): MapViewport {
  const zoom = clampZoom(viewport.zoom);
  const viewWidth = size.width / zoom;
  const viewHeight = size.height / zoom;
  return {
    x: clamp(viewport.x, 0, Math.max(0, size.width - viewWidth)),
    y: clamp(viewport.y, 0, Math.max(0, size.height - viewHeight)),
    zoom,
  };
}

export function viewportToViewBox(viewport: MapViewport, size: MapSize): string {
  const next = clampViewport(viewport, size);
  return `${next.x} ${next.y} ${size.width / next.zoom} ${size.height / next.zoom}`;
}

export function viewportRect(viewport: MapViewport, size: MapSize): MapRect {
  const next = clampViewport(viewport, size);
  return {
    x0: next.x,
    y0: next.y,
    x1: next.x + size.width / next.zoom,
    y1: next.y + size.height / next.zoom,
  };
}

export function rectIntersectsViewport(rect: MapRect, viewport: MapViewport, size: MapSize): boolean {
  const visible = viewportRect(viewport, size);
  return rect.x1 > visible.x0 && rect.x0 < visible.x1 && rect.y1 > visible.y0 && rect.y0 < visible.y1;
}

export function focusViewport(size: MapSize, zoom: number, rect: MapRect): MapViewport {
  const nextZoom = clampZoom(zoom);
  const viewWidth = size.width / nextZoom;
  const viewHeight = size.height / nextZoom;
  const centerX = (rect.x0 + rect.x1) / 2;
  const centerY = (rect.y0 + rect.y1) / 2;
  return clampViewport(
    {
      x: centerX - viewWidth / 2,
      y: centerY - viewHeight / 2,
      zoom: nextZoom,
    },
    size,
  );
}

export function zoomViewportAt(viewport: MapViewport, size: MapSize, point: ScreenPoint, nextZoom: number): MapViewport {
  const current = clampViewport(viewport, size);
  const zoom = clampZoom(nextZoom);
  const worldX = current.x + point.x / current.zoom;
  const worldY = current.y + point.y / current.zoom;
  return clampViewport(
    {
      x: worldX - point.x / zoom,
      y: worldY - point.y / zoom,
      zoom,
    },
    size,
  );
}

export function panViewport(viewport: MapViewport, size: MapSize, delta: ScreenPoint): MapViewport {
  const current = clampViewport(viewport, size);
  return clampViewport(
    {
      x: current.x - delta.x / current.zoom,
      y: current.y - delta.y / current.zoom,
      zoom: current.zoom,
    },
    size,
  );
}

export function wheelZoomFactor(deltaY: number): number {
  return clamp(Math.exp(-deltaY * 0.00028), 0.97, 1.03);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
