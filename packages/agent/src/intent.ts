/**
 * The command vocabulary both front-ends speak. Navigation intents mutate the
 * ViewState (what's shown); query intents read the graph and return data
 * without changing the view. `applyIntent` is the single executor.
 */
import type { Granularity, Layout, Tilt } from "./viewState.ts";
import type { LensDirection, Level } from "./graphQuery.ts";

type NavigationIntent =
  /** Frame `target` and select it. */
  | { type: "focus"; target: string }
  | { type: "select"; ids: string[]; additive?: boolean }
  | { type: "clearSelection" }
  | { type: "setGranularity"; granularity: Granularity }
  | { type: "setLayout"; layout: Layout }
  | { type: "setLayers"; hidden: string[] }
  | { type: "setTilt"; tilt: Partial<Tilt> }
  | { type: "setDiff"; show: boolean }
  /** Fit the whole map and clear the selection. */
  | { type: "home" };

type QueryIntent =
  | { type: "structure"; target?: string }
  | { type: "dependencies"; target: string; depth?: number }
  | { type: "dependents"; target: string; depth?: number }
  | { type: "impact"; target: string }
  | { type: "find"; query: string; limit?: number }
  | { type: "cycles"; level?: Level }
  | { type: "path"; from: string; to: string }
  | { type: "describe"; target: string }
  | {
      type: "lens";
      target: string;
      direction?: LensDirection;
      depth?: number;
      maxNodes?: number;
    };

export type Intent = NavigationIntent | QueryIntent;

export type IntentResult =
  /** A navigation intent ran; `summary` describes the new view for the agent. */
  | { kind: "navigated"; summary: string }
  /** A query ran; `data` is the structured answer, `summary` a one-liner. */
  | { kind: "data"; data: unknown; summary: string }
  /** The intent could not run (e.g. unresolvable target). */
  | { kind: "error"; message: string };
