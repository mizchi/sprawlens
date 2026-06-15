import type { AtlasEdge } from "@sprawlens/contracts";
import { cyclicComponents } from "./scc.js";

/**
 * Transitive closure weights: a node's weight is the sum of a base metric
 * (cyclomatic complexity, LOC, ...) over everything it transitively
 * depends on, itself included — "how much complexity do I pull in".
 * Exact, not a DAG-DP approximation: shared dependencies (diamonds)
 * count once, via SCC condensation plus per-component reachability
 * bitsets. O(components² / 64) memory and time — fine into the thousands
 * of nodes.
 */
export function transitiveWeights(
  ids: readonly string[],
  edges: readonly AtlasEdge[],
  baseOf: (id: string) => number,
): Map<string, number> {
  const idSet = new Set(ids);

  // condense cycles: members of an SCC share one closure
  const componentOf = new Map<string, number>();
  let componentCount = 0;
  for (const group of cyclicComponents(ids, edges)) {
    const component = componentCount++;
    for (const id of group) componentOf.set(id, component);
  }
  for (const id of ids) {
    if (!componentOf.has(id)) componentOf.set(id, componentCount++);
  }

  const baseOfComponent = new Float64Array(componentCount);
  for (const id of ids) {
    baseOfComponent[componentOf.get(id)!]! += baseOf(id);
  }

  // component DAG
  const successors: Set<number>[] = Array.from(
    { length: componentCount },
    () => new Set(),
  );
  const indegree = new Int32Array(componentCount);
  for (const edge of edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) continue;
    const a = componentOf.get(edge.source)!;
    const b = componentOf.get(edge.target)!;
    if (a === b || successors[a]!.has(b)) continue;
    successors[a]!.add(b);
    indegree[b]!++;
  }

  // reachability bitsets in reverse topological order
  const words = Math.ceil(componentCount / 32);
  const reach = Array.from(
    { length: componentCount },
    () => new Uint32Array(words),
  );
  const order: number[] = [];
  const queue: number[] = [];
  for (let c = 0; c < componentCount; c++) {
    if (indegree[c] === 0) queue.push(c);
  }
  while (queue.length > 0) {
    const c = queue.shift()!;
    order.push(c);
    for (const next of successors[c]!) {
      indegree[next]!--;
      if (indegree[next] === 0) queue.push(next);
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const c = order[i]!;
    const bits = reach[c]!;
    bits[c >> 5]! |= 1 << (c & 31);
    for (const next of successors[c]!) {
      const childBits = reach[next]!;
      for (let w = 0; w < words; w++) bits[w]! |= childBits[w]!;
    }
  }

  const weightOfComponent = new Float64Array(componentCount);
  for (let c = 0; c < componentCount; c++) {
    const bits = reach[c]!;
    let sum = 0;
    for (let w = 0; w < words; w++) {
      let word = bits[w]!;
      while (word !== 0) {
        const bit = 31 - Math.clz32(word);
        sum += baseOfComponent[(w << 5) + bit]!;
        word &= ~(1 << bit);
      }
    }
    weightOfComponent[c] = sum;
  }

  const weights = new Map<string, number>();
  for (const id of ids) {
    weights.set(id, weightOfComponent[componentOf.get(id)!]!);
  }
  return weights;
}
