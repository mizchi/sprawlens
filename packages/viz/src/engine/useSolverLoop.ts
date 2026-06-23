import { useEffect } from "preact/hooks";
import { type CapacityLayoutState, type CellResult, isConverged } from "@sprawlens/layout";
import { stepRingsState, type RingsState } from "../ringsController.ts";
import { stepTreemapState, type TreemapState } from "../treemapController.ts";
import { granularityOf, showsSymbolLevels } from "../viewConfig.ts";
import type { PlaygroundParams } from "../Controls.tsx";

type Ref<T> = { current: T };

/** Outer-layout steps per visible frame; hidden tabs get a larger multiple. */
const STEPS_PER_FRAME = 2;

export type SolverLoopContext = {
  ringsRef: Ref<RingsState | null>;
  treemapRef: Ref<TreemapState | null>;
  innerLayoutsRef: Ref<Map<string, CapacityLayoutState>>;
  innerCellsRef: Ref<CellResult[]>;
  innerDirtyRef: Ref<boolean>;
  repaintSkipRef: Ref<number>;
  paramsRef: Ref<PlaygroundParams>;
  /** Step the nested per-file symbol layouts within a time budget. */
  syncInnerLayouts: (outerCells: CellResult[], outerActive: boolean, budgetMs: number) => void;
  convergenceTolerance: number;
  /** Commit a repaint (bump the frame counter). */
  onFrame: () => void;
  /** Fired when the settled state flips — true once a built layout stops
   * advancing (outer + inner), false when it resumes. Drives the test harness's
   * "render is final" signal; no-op in normal use. */
  onSettleChange?: (settled: boolean) => void;
};

/**
 * The solver's animation loop: time-budgeted stepping of the active outer
 * layout (rings or treemap) plus the nested symbol layouts, committing
 * repaints only while something is still converging and at an information-
 * scaled cadence so a dense map doesn't re-render every frame. Renderer-
 * agnostic — it advances the layout state machines; a non-DOM renderer would
 * still drive them this way, only the rAF/visibility scheduling is host glue.
 */
export function useSolverLoop(ctx: SolverLoopContext) {
  const {
    ringsRef,
    treemapRef,
    innerLayoutsRef,
    innerCellsRef,
    innerDirtyRef,
    repaintSkipRef,
    paramsRef,
    syncInnerLayouts,
    convergenceTolerance,
    onFrame,
    onSettleChange,
  } = ctx;
  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let disposed = false;
    let prevSettled: boolean | null = null;
    // rAF stops entirely in hidden tabs; fall back to a timer so layouts keep
    // converging while the user works elsewhere
    const schedule = () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(() => tick(performance.now()), 33);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const tick = (_now: number) => {
      // time-budgeted stepping: fixed step counts block the main thread for
      // seconds on monorepo-scale graphs. Hidden tabs get a bigger budget to
      // compensate for the ~1 tick/s timer throttling.
      const hidden = document.visibilityState === "hidden";
      const solverBudget = hidden ? 150 : 10;
      const innerBudget = hidden ? 60 : 6;
      const maxSteps = STEPS_PER_FRAME * (hidden ? 30 : 1);
      const solverStart = performance.now();
      let outerActive = false;
      const outerCells: CellResult[] = [];
      if (ringsRef.current) {
        let steps = 0;
        let active = true;
        while (active && steps < maxSteps && performance.now() - solverStart < solverBudget) {
          const result = stepRingsState(ringsRef.current, 1);
          ringsRef.current = result.state;
          active = result.active;
          steps++;
        }
        outerActive = active;
        for (const layout of ringsRef.current.leafLayouts.values()) {
          outerCells.push(...layout.cells);
        }
      } else if (treemapRef.current) {
        let steps = 0;
        let active = true;
        while (active && steps < maxSteps && performance.now() - solverStart < solverBudget) {
          const result = stepTreemapState(treemapRef.current, 1);
          treemapRef.current = result.state;
          active = result.active;
          steps++;
        }
        outerActive = active;
        for (const layout of treemapRef.current.leafLayouts.values()) {
          outerCells.push(...layout.cells);
        }
      }

      let innerActive = false;
      if (
        (showsSymbolLevels(paramsRef.current.displayLevels) ||
          paramsRef.current.displayLevels.includes("cfg")) &&
        granularityOf(paramsRef.current.boundaries, paramsRef.current.displayLevels) === "file"
      ) {
        syncInnerLayouts(outerCells, outerActive, innerBudget);
        for (const layout of innerLayoutsRef.current.values()) {
          if (!isConverged(layout, convergenceTolerance)) {
            innerActive = true;
            break;
          }
        }
      }
      if (innerDirtyRef.current) {
        innerDirtyRef.current = false;
        innerCellsRef.current = [...innerLayoutsRef.current.values()].flatMap((l) => l.cells);
      }
      // re-render only while a solver is actually advancing; a converged layout
      // would otherwise burn CPU at full frame rate. On big maps a full SVG
      // re-render costs as much as the solver budget, so while converging the
      // repaint commits at ~20fps — the solver keeps every frame, the melt
      // animation just interpolates visually coarser.
      if (outerActive || innerActive) {
        repaintSkipRef.current++;
        // information-scaled repaint cadence: a full SVG re-render costs in
        // proportion to the live element count, so the denser the map the fewer
        // frames we actually commit while solving.
        const cells = outerCells.length + innerCellsRef.current.length;
        const repaintEvery = cells > 4000 ? 6 : cells > 1500 ? 4 : cells > 600 ? 3 : 1;
        if (repaintSkipRef.current >= repaintEvery || !outerActive) {
          repaintSkipRef.current = 0;
          onFrame();
        }
      } else if (repaintSkipRef.current > 0) {
        // flush the final state once everything settles
        repaintSkipRef.current = 0;
        onFrame();
      }
      // settled = a built layout that has stopped advancing; report on change
      const hasLayout = !!(ringsRef.current || treemapRef.current);
      const settled = hasLayout && !outerActive && !innerActive;
      if (settled !== prevSettled) {
        prevSettled = settled;
        onSettleChange?.(settled);
      }
      schedule();
    };
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
