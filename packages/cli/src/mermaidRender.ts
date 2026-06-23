import type { AtlasGraph } from "@sprawlens/schema";
import { deriveModuleIdOf, deriveModules } from "@sprawlens/schema";
import type { DiffSummary } from "./diffRender.js";

export type MermaidDiffOptions = {
  /** Counts shown in the diagram title; omitted when absent. */
  summary?: DiffSummary;
  /** Cap on rendered nodes (changed nodes are kept first). Default 50. */
  maxNodes?: number;
  /** Flowchart direction. Default "LR". */
  direction?: "LR" | "TB";
  /**
   * Node granularity. "file" (default) graphs individual files; "module"
   * aggregates files into their module and graphs cross-module imports — far
   * fewer nodes, the better default for a large-repo PR comment.
   */
  level?: "file" | "module";
};

type Changed = Map<string, "added" | "modified">;

const ADDED_FILL = "#86efac";
const ADDED_STROKE = "#16a34a";
const MODIFIED_FILL = "#fdba74";
const MODIFIED_STROKE = "#ea580c";

/**
 * Render the *changed subgraph* — changed files plus their direct (1-hop)
 * dependency neighbors — as a GitHub-native Mermaid flowchart. The result is a
 * fenced ```mermaid block, so it can be pasted straight into a PR comment with
 * no image upload. Returns "" when nothing changed is present in the graph.
 *
 * Mermaid can only draw node+edge graphs, so this is a dependency view of the
 * blast radius, not the voronoi/treemap macro shape the SVG renderer produces.
 */
export function renderDiffMermaid(
  graph: AtlasGraph,
  changed: Changed,
  options: MermaidDiffOptions = {},
): string {
  const maxNodes = options.maxNodes ?? 50;
  const direction = options.direction ?? "LR";

  // module level collapses the file graph into a cross-module import graph and
  // remaps the per-file change kinds onto modules before the same subgraph
  // focus / capping / coloring runs.
  const view = options.level === "module" ? aggregateToModules(graph, changed) : { graph, changed };
  graph = view.graph;
  changed = view.changed;

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  // changed ids that actually have a node on the map (README.md etc. won't)
  const changedIds = [...changed.keys()].filter((id) => nodeById.has(id)).sort();

  if (changedIds.length === 0) return "";

  const changedSet = new Set(changedIds);
  // 1-hop neighbors: the other endpoint of any edge touching a changed node
  const neighborIds = new Set<string>();
  for (const e of graph.edges) {
    if (changedSet.has(e.source) && nodeById.has(e.target)) neighborIds.add(e.target);
    if (changedSet.has(e.target) && nodeById.has(e.source)) neighborIds.add(e.source);
  }
  for (const id of changedSet) neighborIds.delete(id);

  // changed nodes first (never dropped), then neighbors, up to the cap
  const ordered = [...changedIds, ...[...neighborIds].sort()];
  const kept = ordered.slice(0, maxNodes);
  const keptSet = new Set(kept);
  const dropped = ordered.length - kept.length;

  // stable n0..nN ids; mermaid node ids must be identifier-safe, labels quoted
  const localId = new Map<string, string>();
  kept.forEach((id, i) => localId.set(id, `n${i}`));

  const lines: string[] = [];
  lines.push(`flowchart ${direction}`);
  lines.push(`  classDef added fill:${ADDED_FILL},stroke:${ADDED_STROKE},color:#052e16`);
  lines.push(`  classDef modified fill:${MODIFIED_FILL},stroke:${MODIFIED_STROKE},color:#431407`);

  for (const id of kept) {
    // a flat dep graph has no spatial grouping, so a basename ("index.ts")
    // collides across packages — label with the disambiguating path instead.
    lines.push(`  ${localId.get(id)}["${escapeLabel(shortLabel(id))}"]`);
  }

  // edges where both endpoints survived the cap
  const seenEdge = new Set<string>();
  for (const e of graph.edges) {
    if (!keptSet.has(e.source) || !keptSet.has(e.target)) continue;
    const key = `${e.source} ${e.target}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    lines.push(`  ${localId.get(e.source)} --> ${localId.get(e.target)}`);
  }

  for (const id of changedIds) {
    if (!keptSet.has(id)) continue;
    lines.push(`  class ${localId.get(id)} ${changed.get(id)}`);
  }

  // summary as a plain markdown line ABOVE the fence — renders everywhere,
  // unlike mermaid frontmatter which needs a recent renderer.
  const heading = options.summary
    ? `**diff** \`+${options.summary.added}\` added · \`~${options.summary.modified}\` modified · \`-${options.summary.removed}\` removed\n\n`
    : "";
  const fenced = "```mermaid\n" + lines.join("\n") + "\n```";
  const note =
    dropped > 0 ? `\n\n_+${dropped} more node(s) not shown (node cap ${maxNodes})._` : "";
  return `${heading}${fenced}${note}`;
}

/**
 * Collapse the file graph into a module graph (via the directory-aware module
 * heuristic) and remap per-file change kinds onto modules. A module is "added"
 * only when every one of its files is newly added (a brand-new module);
 * otherwise any change makes it "modified".
 */
function aggregateToModules(
  graph: AtlasGraph,
  changed: Changed,
): { graph: AtlasGraph; changed: Changed } {
  const moduleIdOf = deriveModuleIdOf(graph.nodes.map((n) => n.id));
  const mg = deriveModules(graph, moduleIdOf);

  // which modules contain at least one changed file
  const touched = new Set<string>();
  for (const fileId of changed.keys()) touched.add(moduleIdOf(fileId));

  const moduleChanged: Changed = new Map();
  for (const mid of touched) {
    const files = mg.filesByModule.get(mid);
    if (!files || files.length === 0) continue; // module not on the map
    const allAdded = files.every((f) => changed.get(f.id) === "added");
    moduleChanged.set(mid, allAdded ? "added" : "modified");
  }

  return {
    graph: { nodes: mg.modules, edges: mg.moduleEdges },
    changed: moduleChanged,
  };
}

/**
 * A readable, disambiguating label from a repo-relative path: drop a leading
 * "packages/" and collapse "/src/" so "packages/cli/src/index.ts" reads as
 * "cli/index.ts", while non-monorepo paths pass through largely intact.
 */
function shortLabel(id: string): string {
  return id.replace(/^packages\//, "").replace(/\/src\//, "/");
}

/**
 * Entity-encode the characters that break a mermaid `["..."]` node label.
 * `[`/`]` matter for real route files (`app/[id].tsx`); `<`/`>` because GitHub
 * renders mermaid with htmlLabels. The `&` pass must run first or it would
 * double-encode the entities the later passes emit.
 */
function escapeLabel(label: string): string {
  return label
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;");
}
