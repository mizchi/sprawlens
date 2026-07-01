/**
 * The single executor every front-end funnels through. Pure: given the graph
 * index, the current view, and an intent, it returns the next view and a
 * result. Navigation intents return a new `view` and a `navigated` summary;
 * query intents return the view unchanged and the structured answer.
 */
import type { GraphIndex } from "./graphQuery.ts";
import {
  cycles,
  dependencies,
  dependents,
  describe,
  find,
  impact,
  lens,
  path,
  resolve,
  structure,
} from "./graphQuery.ts";
import type { Intent, IntentResult } from "./intent.ts";
import type { ViewState } from "./viewState.ts";

export type ApplyResult = { view: ViewState; result: IntentResult };

const data = (view: ViewState, payload: unknown, summary: string): ApplyResult => ({
  view,
  result: { kind: "data", data: payload, summary },
});
const err = (view: ViewState, message: string): ApplyResult => ({
  view,
  result: { kind: "error", message },
});
const nav = (view: ViewState, summary: string): ApplyResult => ({
  view,
  result: { kind: "navigated", summary },
});

/** A short, agent-readable description of a node/module for focus summaries. */
function describeBrief(idx: GraphIndex, id: string): string {
  const d = describe(idx, id);
  if (!d) return id;
  const where = d.file && d.kind !== "module" ? ` in ${d.module}` : "";
  return `${d.id} (${d.kind}${where}) — depends on ${d.dependsOn}, depended on by ${d.dependedOnBy}`;
}

export function applyIntent(idx: GraphIndex, view: ViewState, intent: Intent): ApplyResult {
  switch (intent.type) {
    // ---- navigation ----
    case "focus": {
      if (!resolve(idx, intent.target)) return err(view, `unknown target: ${intent.target}`);
      const next = { ...view, selection: [intent.target], camera: { target: intent.target } };
      return nav(next, `Focused ${describeBrief(idx, intent.target)}`);
    }
    case "select": {
      const ids = intent.additive ? [...new Set([...view.selection, ...intent.ids])] : intent.ids;
      return nav({ ...view, selection: ids }, `Selected ${ids.length} node(s)`);
    }
    case "clearSelection":
      return nav({ ...view, selection: [] }, "Cleared selection");
    case "setGranularity":
      return nav(
        { ...view, granularity: intent.granularity },
        `Granularity → ${intent.granularity}`,
      );
    case "setLayout":
      return nav({ ...view, layout: intent.layout }, `Layout → ${intent.layout}`);
    case "setLayers":
      return nav(
        { ...view, hiddenLayers: intent.hidden },
        intent.hidden.length ? `Hiding layers: ${intent.hidden.join(", ")}` : "All layers shown",
      );
    case "setTilt": {
      const tilt = { ...view.tilt, ...intent.tilt };
      return nav(
        { ...view, tilt },
        `Tilt ${tilt.enabled ? "on" : "off"} (pitch ${tilt.pitch.toFixed(2)}, theta ${tilt.theta.toFixed(2)})`,
      );
    }
    case "setDiff":
      return nav({ ...view, showDiff: intent.show }, `Diff overlay ${intent.show ? "on" : "off"}`);
    case "home":
      return nav({ ...view, selection: [], camera: { target: null } }, "Framed the whole map");

    // ---- queries ----
    case "structure": {
      const s = structure(idx, intent.target);
      return data(
        view,
        s,
        `${s.scope}: ${s.entries.length} ${s.level === "root" ? "modules" : "children"}`,
      );
    }
    case "dependencies": {
      const r = dependencies(idx, intent.target, intent.depth);
      if (!r) return err(view, `unknown target: ${intent.target}`);
      return data(
        view,
        r,
        `${r.target} depends on ${r.count} ${r.level}(s) within depth ${r.depth}`,
      );
    }
    case "dependents": {
      const r = dependents(idx, intent.target, intent.depth);
      if (!r) return err(view, `unknown target: ${intent.target}`);
      return data(
        view,
        r,
        `${r.count} ${r.level}(s) depend on ${r.target} within depth ${r.depth}`,
      );
    }
    case "impact": {
      const r = impact(idx, intent.target);
      if (!r) return err(view, `unknown target: ${intent.target}`);
      return data(view, r, `Changing ${r.target} affects ${r.count} ${r.level}(s)`);
    }
    case "find": {
      const r = find(idx, intent.query, intent.limit);
      return data(view, r, `${r.length} match(es) for "${intent.query}"`);
    }
    case "cycles": {
      const r = cycles(idx, intent.level);
      return data(view, r, `${r.length} dependency cycle(s) at ${intent.level ?? "module"} level`);
    }
    case "path": {
      const p = path(idx, intent.from, intent.to);
      return data(
        view,
        p,
        p
          ? `Path of ${p.length} hop(s): ${p.join(" → ")}`
          : `No dependency path ${intent.from} → ${intent.to}`,
      );
    }
    case "describe": {
      const d = describe(idx, intent.target);
      if (!d) return err(view, `unknown target: ${intent.target}`);
      return data(view, d, describeBrief(idx, intent.target));
    }
    case "lens": {
      const r = lens(idx, intent.target, {
        direction: intent.direction,
        depth: intent.depth,
        maxNodes: intent.maxNodes,
      });
      if (!r) return err(view, `unknown target: ${intent.target}`);
      return data(
        view,
        r,
        `Lens ${r.target}: ${r.nodes.length} ${r.level}(s), ${r.edges.length} edge(s), ${r.summary.dependents} upstream / ${r.summary.dependencies} downstream`,
      );
    }
  }
}
