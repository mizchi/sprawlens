import { describe, expect, it } from "vitest";
import {
  fileLayerMode,
  filePreviewLimit,
  rectScreenSize,
  scaledSvgFontSize,
  shouldShowFileLabels,
  shouldShowNestedBlocks,
  shouldShowSymbolLabels,
  shouldShowSymbols,
  zoomPercentLabel,
} from "./moduleLayer.js";

describe("module layer policy", () => {
  it("previews file structure before switching into file detail", () => {
    expect(fileLayerMode(1)).toBe("preview");
    expect(fileLayerMode(1.34)).toBe("preview");
    expect(fileLayerMode(1.35)).toBe("detail");
  });

  it("keeps the preview sparse at low zoom and denser near detail zoom", () => {
    expect(filePreviewLimit(1)).toBeLessThan(filePreviewLimit(1.8));
  });

  it("only shows file labels after the geometry has enough room", () => {
    expect(shouldShowFileLabels(2.1)).toBe(false);
    expect(shouldShowFileLabels(2.2)).toBe(true);
  });

  it("keeps text visually stable while the SVG viewBox zooms", () => {
    expect(scaledSvgFontSize(13, 1)).toBeCloseTo(13);
    expect(scaledSvgFontSize(13, 4)).toBeCloseTo(3.25);
  });

  it("shows top-level symbols only at deep file zoom", () => {
    expect(shouldShowSymbols(2.7)).toBe(false);
    expect(shouldShowSymbols(2.8)).toBe(true);
    expect(shouldShowSymbolLabels(3.1)).toBe(false);
    expect(shouldShowSymbolLabels(3.2)).toBe(true);
  });

  it("formats zoom as a compact percentage", () => {
    expect(zoomPercentLabel(1)).toBe("100%");
    expect(zoomPercentLabel(2.34)).toBe("234%");
  });

  it("decides nested block visibility from rendered screen size", () => {
    const rect = { x0: 10, y0: 20, x1: 70, y1: 60 };

    expect(rectScreenSize(rect, 2)).toEqual({ width: 120, height: 80 });
    expect(shouldShowNestedBlocks(rect, 2, { width: 110, height: 70 })).toBe(true);
    expect(shouldShowNestedBlocks(rect, 1, { width: 110, height: 70 })).toBe(false);
  });
});
