import { describe, expect, it } from "vitest";
import type { FocusView } from "./useMapViewport.ts";
import {
  liveDataUpdateLayoutPlan,
  overlayLayoutSpec,
  resolveMapFocusView,
} from "./mapDisplaySpec.ts";

const focus = (level: FocusView["level"], id: string): FocusView => ({
  level,
  moduleIds: new Set(level === "module" ? [id] : []),
  fileIds: new Set(level === "file" ? [id] : []),
  symbolIds: new Set(level === "symbol" ? [id] : []),
  downstreamEdges: [],
  upstreamEdges: [],
});

describe("resolveMapFocusView", () => {
  it("keeps manual focus above automatic extract views", () => {
    const manual = focus("module", "pkg/app");
    const traceExtract = focus("symbol", "symbol:app.ts:function:run:1");
    const changedPreview = focus("file", "app.ts");

    expect(
      resolveMapFocusView({
        manual,
        traceExtractEnabled: true,
        traceExtract,
        changedPreviewEnabled: true,
        changedPreview,
      }),
    ).toBe(manual);
  });

  it("uses Trace Extract before Changed Preview when both are enabled", () => {
    const traceExtract = focus("symbol", "symbol:app.ts:function:run:1");
    const changedPreview = focus("file", "app.ts");

    expect(
      resolveMapFocusView({
        traceExtractEnabled: true,
        traceExtract,
        changedPreviewEnabled: true,
        changedPreview,
      }),
    ).toBe(traceExtract);
  });

  it("falls back to Changed Preview only when its toggle is enabled", () => {
    const changedPreview = focus("file", "app.ts");

    expect(
      resolveMapFocusView({
        traceExtractEnabled: false,
        traceExtract: null,
        changedPreviewEnabled: true,
        changedPreview,
      }),
    ).toBe(changedPreview);
    expect(
      resolveMapFocusView({
        changedPreviewEnabled: false,
        changedPreview,
      }),
    ).toBeNull();
  });
});

describe("overlayLayoutSpec", () => {
  it("keeps desktop panels compact and anchored to the bottom edge", () => {
    expect(
      overlayLayoutSpec({
        mapWidth: 960,
        hasChangedPreviewPanel: true,
        hasTraceTimelineControl: true,
        hasTraceExtractControl: false,
      }),
    ).toEqual({
      mobileLayout: false,
      traceControlBottom: 16,
      changedPreviewBottom: "8px",
      chatBottomOffset: 0,
    });
  });

  it("stacks mobile trace, changed preview, and chat controls without overlap", () => {
    expect(
      overlayLayoutSpec({
        mapWidth: 640,
        hasChangedPreviewPanel: true,
        hasTraceTimelineControl: false,
        hasTraceExtractControl: true,
      }),
    ).toEqual({
      mobileLayout: true,
      traceControlBottom: "max(8px, env(safe-area-inset-bottom))",
      changedPreviewBottom: "calc(118px + env(safe-area-inset-bottom))",
      chatBottomOffset: "calc(190px + env(safe-area-inset-bottom))",
    });
  });

  it("raises chat above the only visible mobile bottom control", () => {
    expect(
      overlayLayoutSpec({
        mapWidth: 390,
        hasChangedPreviewPanel: false,
        hasTraceTimelineControl: true,
        hasTraceExtractControl: false,
      }).chatBottomOffset,
    ).toBe("calc(74px + env(safe-area-inset-bottom))");
    expect(
      overlayLayoutSpec({
        mapWidth: 390,
        hasChangedPreviewPanel: true,
        hasTraceTimelineControl: false,
        hasTraceExtractControl: false,
      }).chatBottomOffset,
    ).toBe("calc(88px + env(safe-area-inset-bottom))");
  });
});

describe("liveDataUpdateLayoutPlan", () => {
  it("warm-applies code-data changes once a layout exists", () => {
    expect(liveDataUpdateLayoutPlan({ layoutReady: true, displayChanged: true })).toBe(
      "warm-apply",
    );
  });

  it("does not rebuild for unchanged snapshots", () => {
    expect(liveDataUpdateLayoutPlan({ layoutReady: true, displayChanged: false })).toBe("ignore");
  });

  it("cold-builds only when data arrives before the first layout", () => {
    expect(liveDataUpdateLayoutPlan({ layoutReady: false, displayChanged: true })).toBe(
      "cold-rebuild",
    );
  });
});
