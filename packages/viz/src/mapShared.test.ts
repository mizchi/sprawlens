import { describe, expect, it } from "vitest";
import {
  changedBoundaryAncestors,
  focusNodeOutlineVisual,
  foregroundLast,
  intermediateBoundaryVisual,
  topStructureProminent,
  symbolVisibleAtMacro,
  topStructureVisual,
} from "./mapShared.tsx";

describe("intermediateBoundaryVisual", () => {
  it("subdues non-selected structural boundaries during focus previews", () => {
    expect(
      intermediateBoundaryVisual({
        selected: false,
        classBoundary: false,
        dim: 1,
        subdued: true,
      }),
    ).toEqual({ strokeOpacity: 0.08, strokeWidth: 0.28, dasharray: "5 3", neutral: true });
  });

  it("subdues class boundaries during focus previews without hiding them", () => {
    expect(
      intermediateBoundaryVisual({
        selected: false,
        classBoundary: true,
        dim: 1,
        subdued: true,
      }),
    ).toEqual({ strokeOpacity: 0.12, strokeWidth: 0.6, neutral: true });
  });

  it("keeps selected boundaries prominent", () => {
    expect(
      intermediateBoundaryVisual({
        selected: true,
        classBoundary: false,
        dim: 0.1,
        subdued: true,
      }),
    ).toEqual({ strokeOpacity: 1, strokeWidth: 2.5 });
  });

  it("makes unchanged boundaries extra quiet during changed previews", () => {
    expect(
      intermediateBoundaryVisual({
        selected: false,
        classBoundary: false,
        dim: 1,
        subdued: true,
        changePreview: true,
        changed: false,
      }),
    ).toEqual({ strokeOpacity: 0.025, strokeWidth: 0.18, dasharray: "5 3", neutral: true });
  });

  it("keeps changed ancestor boundaries readable during changed previews", () => {
    expect(
      intermediateBoundaryVisual({
        selected: false,
        classBoundary: false,
        dim: 1,
        subdued: true,
        changePreview: true,
        changed: true,
      }),
    ).toEqual({ strokeOpacity: 0.45, strokeWidth: 1.1 });
  });
});

describe("changedBoundaryAncestors", () => {
  it("returns every boundary ancestor of changed leaves", () => {
    const parentOf = new Map<string, string | null>([
      ["src/app.ts", "src/ui"],
      ["src/ui", "src"],
      ["src", null],
      ["src/db.ts", "src/data"],
      ["src/data", "src"],
    ]);
    expect([
      ...changedBoundaryAncestors(
        ["src/app.ts", "src/db.ts"],
        parentOf,
        (id) => id === "src/app.ts",
      ),
    ]).toEqual(["src/ui", "src"]);
  });
});

describe("focusNodeOutlineVisual", () => {
  it("keeps a screen-space halo around the focused node", () => {
    expect(focusNodeOutlineVisual(2)).toEqual({
      haloWidth: 1.4,
      coreWidth: 0.5,
      haloOpacity: 0.28,
      coreOpacity: 0.78,
    });
  });

  it("can dash command-palette previews", () => {
    expect(focusNodeOutlineVisual(2, true)).toEqual({
      haloWidth: 1.4,
      coreWidth: 0.5,
      haloOpacity: 0.22,
      coreOpacity: 0.68,
      dasharray: "3 2",
    });
  });
});

describe("topStructureVisual", () => {
  it("keeps the top structure quiet during focus previews", () => {
    expect(topStructureVisual(true, false)).toEqual({
      fillOpacity: 0.055,
      strokeOpacity: 0.09,
      labelOpacity: 0.18,
    });
  });

  it("keeps selected top-level structure prominent", () => {
    expect(topStructureVisual(true, true)).toEqual({
      fillOpacity: 1,
      strokeOpacity: 1,
      labelOpacity: 1,
    });
  });

  it("leaves the normal map unchanged", () => {
    expect(topStructureVisual(false, false)).toEqual({
      fillOpacity: 1,
      strokeOpacity: 1,
      labelOpacity: 1,
    });
  });
});

describe("focus foreground ordering", () => {
  it("treats reached top-level regions as prominent, not only explicit selections", () => {
    expect(topStructureProminent(true, false, 1)).toBe(true);
    expect(topStructureProminent(true, false, 0.1)).toBe(false);
    expect(topStructureProminent(true, true, 0.1)).toBe(true);
  });

  it("paints focused items after subdued siblings", () => {
    expect(foregroundLast(["background", "focus", "other"], (id) => id === "focus")).toEqual([
      "background",
      "other",
      "focus",
    ]);
  });
});

describe("symbolVisibleAtMacro", () => {
  it("keeps exact AST diffs visible below the normal size and file budget gates", () => {
    expect(symbolVisibleAtMacro({ selected: false, exactDiff: true, screenPx: 2, minPx: 12 })).toBe(
      true,
    );
    expect(
      symbolVisibleAtMacro({
        selected: false,
        exactDiff: false,
        screenPx: 20,
        minPx: 12,
        allowed: false,
      }),
    ).toBe(false);
  });
});
