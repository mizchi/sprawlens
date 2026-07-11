import type { FocusView } from "./useMapViewport.ts";

type CssLength = number | string;

export type MapFocusSpecInput = {
  manual?: FocusView | null;
  traceExtractEnabled?: boolean;
  traceExtract?: FocusView | null;
  changedPreviewEnabled?: boolean;
  changedPreview?: FocusView | null;
};

/**
 * One map can only be actively extracted at a time. Manual selection wins
 * because it is an explicit navigation action; trace extract is next because it
 * answers "what executed"; changed preview is the broad fallback for "what
 * changed".
 */
export function resolveMapFocusView(input: MapFocusSpecInput): FocusView | null {
  if (input.manual) return input.manual;
  if (input.traceExtractEnabled && input.traceExtract) return input.traceExtract;
  if (input.changedPreviewEnabled && input.changedPreview) return input.changedPreview;
  return null;
}

export type OverlayLayoutSpecInput = {
  mapWidth: number;
  hasChangedPreviewPanel: boolean;
  hasTraceTimelineControl: boolean;
  hasTraceExtractControl: boolean;
};

export type OverlayLayoutSpec = {
  mobileLayout: boolean;
  traceControlBottom: CssLength;
  changedPreviewBottom: CssLength;
  chatBottomOffset: CssLength;
};

const MOBILE_BREAKPOINT = 640;
const MOBILE_SAFE_BOTTOM = "max(8px, env(safe-area-inset-bottom))";

/**
 * Bottom overlays share one lane on phones: trace control at the bottom,
 * changed preview above it, chat above whichever temporal controls exist.
 */
export function overlayLayoutSpec(input: OverlayLayoutSpecInput): OverlayLayoutSpec {
  const mobileLayout = input.mapWidth <= MOBILE_BREAKPOINT;
  const hasBottomTraceControl = input.hasTraceTimelineControl || input.hasTraceExtractControl;
  if (!mobileLayout) {
    return {
      mobileLayout,
      traceControlBottom: 16,
      changedPreviewBottom: "8px",
      chatBottomOffset: 0,
    };
  }

  return {
    mobileLayout,
    traceControlBottom: MOBILE_SAFE_BOTTOM,
    changedPreviewBottom: hasBottomTraceControl
      ? "calc(118px + env(safe-area-inset-bottom))"
      : MOBILE_SAFE_BOTTOM,
    chatBottomOffset: input.hasChangedPreviewPanel
      ? hasBottomTraceControl
        ? "calc(190px + env(safe-area-inset-bottom))"
        : "calc(88px + env(safe-area-inset-bottom))"
      : hasBottomTraceControl
        ? "calc(74px + env(safe-area-inset-bottom))"
        : 0,
  };
}

export type LiveDataUpdateLayoutPlan = "ignore" | "warm-apply" | "cold-rebuild";

export function liveDataUpdateLayoutPlan(input: {
  layoutReady: boolean;
  displayChanged: boolean;
}): LiveDataUpdateLayoutPlan {
  if (!input.displayChanged) return "ignore";
  return input.layoutReady ? "warm-apply" : "cold-rebuild";
}
