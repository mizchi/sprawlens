import type { AtlasEdge, AtlasNode } from "@sprawlens/schema";
import type { Vec2 } from "./vec.js";

/**
 * Top-down layered layout for a small control-flow graph: the entry sits
 * at the top of the unit square, branches fan out downward. Back edges
 * (loops) are classified by a DFS from the entry and excluded from the
 * ranking, so loop bodies hang below their head and the back edge can be
 * drawn as a side curve.
 */

export type CfgLayout = {
  /** Unit-square positions: y grows downward from the entry. */
  positions: Map<string, Vec2>;
  /** `${source} ${target}` keys of loop back edges. */
  backEdges: Set<string>;
  /** Grid extents (rank rows / columns) for spacing-aware rendering. */
  rows: number;
  cols: number;
};

export type CfgLayoutOptions = {
  entryId?: string;
  /**
   * Code-shaped placement from a structured producer (row = execution
   * order, col = nesting indent); used verbatim when present, the
   * generic layered solver otherwise.
   */
  grid?: Record<string, { row: number; col: number }>;
};

export function layoutCfg(
  nodes: readonly AtlasNode[],
  edges: readonly AtlasEdge[],
  options: CfgLayoutOptions = {},
): CfgLayout {
  const entryId = options.entryId ?? "b-entry";
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const out = new Map<string, string[]>();
  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue;
    const list = out.get(edge.source);
    if (list) list.push(edge.target);
    else out.set(edge.source, [edge.target]);
  }

  // DFS edge classification: an edge into a node on the active stack is a
  // loop back edge. Iterative with an explicit stack to survive deep CFGs.
  const backEdges = new Set<string>();
  const onStack = new Set<string>();
  const visited = new Set<string>();
  const dfsOrder: string[] = [];
  const start = idSet.has(entryId) ? entryId : ids[0];
  if (start !== undefined) {
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    visited.add(start);
    onStack.add(start);
    dfsOrder.push(start);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const targets = out.get(frame.id) ?? [];
      if (frame.next >= targets.length) {
        onStack.delete(frame.id);
        stack.pop();
        continue;
      }
      const target = targets[frame.next++]!;
      if (onStack.has(target)) {
        backEdges.add(`${frame.id} ${target}`);
        continue;
      }
      if (visited.has(target)) continue;
      visited.add(target);
      onStack.add(target);
      dfsOrder.push(target);
      stack.push({ id: target, next: 0 });
    }
  }

  // Structured grid from the producer: trust it verbatim.
  if (options.grid) {
    const grid = options.grid;
    let maxRow = 0;
    let maxCol = 0;
    for (const id of ids) {
      const cell = grid[id];
      if (!cell) continue;
      maxRow = Math.max(maxRow, cell.row);
      maxCol = Math.max(maxCol, cell.col);
    }
    const rows = maxRow + 1;
    const cols = maxCol + 1;
    const positions = new Map<string, Vec2>();
    for (const id of ids) {
      const cell = grid[id] ?? { row: maxRow, col: 0 };
      positions.set(id, {
        x: (cell.col + 0.5) / cols,
        y: (cell.row + 0.5) / rows,
      });
    }
    return { positions, backEdges, rows, cols };
  }

  // Longest-path ranks over the forward (acyclic) edges, Kahn order.
  const forwardOut = new Map<string, string[]>();
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const [source, targets] of out) {
    for (const target of targets) {
      if (backEdges.has(`${source} ${target}`)) continue;
      const list = forwardOut.get(source);
      if (list) list.push(target);
      else forwardOut.set(source, [target]);
      indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const target of forwardOut.get(id) ?? []) {
      rank.set(target, Math.max(rank.get(target)!, rank.get(id)! + 1));
      const remaining = indegree.get(target)! - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  // Rows: stable order = DFS discovery (unreached nodes trail in input
  // order), evenly spread; y centers each rank's row in the unit square.
  const orderIndex = new Map(dfsOrder.map((id, i) => [id, i]));
  const rows = new Map<number, string[]>();
  for (const id of ids) {
    const r = rank.get(id)!;
    const row = rows.get(r);
    if (row) row.push(id);
    else rows.set(r, [id]);
  }
  const maxRank = Math.max(0, ...rows.keys());
  let maxWidth = 1;
  const positions = new Map<string, Vec2>();
  for (const [r, row] of rows) {
    row.sort(
      (a, b) =>
        (orderIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    maxWidth = Math.max(maxWidth, row.length);
    const y = (r + 0.5) / (maxRank + 1);
    row.forEach((id, i) => {
      positions.set(id, { x: (i + 0.5) / row.length, y });
    });
  }
  return { positions, backEdges, rows: maxRank + 1, cols: maxWidth };
}
