export type FileLayerMode = "preview" | "detail";

export const FILE_DETAIL_ZOOM = 1.35;
export const FILE_LABEL_ZOOM = 2.2;
export const SYMBOL_DETAIL_ZOOM = 2.8;
export const SYMBOL_LABEL_ZOOM = 3.2;

export function fileLayerMode(zoom: number): FileLayerMode {
  return zoom >= FILE_DETAIL_ZOOM ? "detail" : "preview";
}

export function filePreviewLimit(zoom: number): number {
  if (zoom < 1.2) {
    return 8;
  }
  if (zoom < 1.8) {
    return 14;
  }
  return 24;
}

export function shouldShowFileLabels(zoom: number): boolean {
  return zoom >= FILE_LABEL_ZOOM;
}

export function scaledSvgFontSize(screenPx: number, zoom: number): number {
  return screenPx / Math.max(1, zoom);
}

export function shouldShowSymbols(zoom: number): boolean {
  return zoom >= SYMBOL_DETAIL_ZOOM;
}

export function shouldShowSymbolLabels(zoom: number): boolean {
  return zoom >= SYMBOL_LABEL_ZOOM;
}

export function zoomPercentLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export type LayerRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type ScreenSizeThreshold = {
  width: number;
  height: number;
};

export function rectScreenSize(rect: LayerRect, zoom: number): ScreenSizeThreshold {
  return {
    width: Math.max(0, rect.x1 - rect.x0) * zoom,
    height: Math.max(0, rect.y1 - rect.y0) * zoom,
  };
}

export function shouldShowNestedBlocks(rect: LayerRect, zoom: number, threshold: ScreenSizeThreshold): boolean {
  const size = rectScreenSize(rect, zoom);
  return size.width >= threshold.width && size.height >= threshold.height;
}
