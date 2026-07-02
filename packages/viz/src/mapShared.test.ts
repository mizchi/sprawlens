import { describe, expect, it } from "vitest";
import { focusNodeOutlineVisual, intermediateBoundaryVisual } from "./mapShared.tsx";

describe("intermediateBoundaryVisual", () => {
  it("subdues non-selected structural boundaries during focus previews", () => {
    expect(
      intermediateBoundaryVisual({
        selected: false,
        classBoundary: false,
        dim: 1,
        subdued: true,
      }),
    ).toEqual({ strokeOpacity: 0.4, strokeWidth: 0.65, dasharray: "5 3", neutral: true });
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
});

describe("focusNodeOutlineVisual", () => {
  it("keeps a screen-space halo around the focused node", () => {
    expect(focusNodeOutlineVisual(2)).toEqual({
      haloWidth: 3,
      coreWidth: 1.1,
    });
  });

  it("can dash command-palette previews", () => {
    expect(focusNodeOutlineVisual(2, true)).toEqual({
      haloWidth: 3,
      coreWidth: 1.1,
      dasharray: "3 2",
    });
  });
});
