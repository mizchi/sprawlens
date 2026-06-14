import type {
  AtlasEdge,
  AtlasGraph,
  AtlasNode,
  AtlasNodeKind,
} from "./graph.js";
import { defaultModuleIdOf, type ModuleIdOf } from "./modules.js";

/**
 * Multi-level hierarchy contract. The analysis hierarchy (service → module
 * → directory → file → class → symbol → block) and the display hierarchy
 * are separate concerns: a view picks a leaf granularity (what the producer
 * expands to) and an ordered list of boundary groupings (which levels are
 * rendered as nested regions). Skipping a level — e.g. module → symbol with
 * no file boundary — is just omitting its grouping.
 */

/** One boundary level: maps a leaf id to its group id at this level. */
export type Grouping = {
  kind: AtlasNodeKind;
  groupOf: (leafId: string) => string;
  /** Display label for a group; defaults to the group id. */
  labelOf?: (groupId: string) => string;
};

export type HierarchyLevel = {
  kind: AtlasNodeKind;
  /** Group nodes; loc = sum of member leaf loc. */
  nodes: AtlasNode[];
  /**
   * The level's full network: cross-group edges lifted from the leaves
   * (weight-aggregated) plus native edges observed at this level (service
   * communication etc.). This is what a top-level rings/treemap layout of
   * this level consumes.
   */
  edges: AtlasEdge[];
};

export type LevelTree = {
  /** Boundary levels, outer → inner. Leaves are not a level; they live in
   * childrenOf of the innermost groups. */
  levels: HierarchyLevel[];
  /** Any node id (groups and leaves) → parent group id; top groups → null. */
  parentOf: Map<string, string | null>;
  /** Group id → child nodes (next-level groups, or leaves for innermost). */
  childrenOf: Map<string, AtlasNode[]>;
  /**
   * Group id → edges among its children: aggregated child-group edges for
   * intermediate groups, raw leaf edges for innermost groups. This is what
   * the nested subdivision layout of that group consumes.
   */
  innerEdgesOf: Map<string, AtlasEdge[]>;
  /** Group id → its level kind (leaves are not included). */
  kindOf: Map<string, AtlasNodeKind>;
};

export type DeriveLevelsOptions = {
  /**
   * Edges native to a boundary level, keyed by level kind — e.g. service
   * communication links that static imports cannot see. Endpoints must be
   * group ids of that level; edges naming unknown groups are dropped.
   */
  nativeEdges?: ReadonlyMap<string, readonly AtlasEdge[]>;
};

/**
 * Derives the level tree for a leaf graph and a boundary chain. Group ids
 * must nest strictly (one parent per group); when a leaf's group id at some
 * level equals its parent group id (a file sitting at the module root), a
 * synthetic `<id>/(root)` group keeps the levels uniform.
 */
export function deriveLevels(
  graph: AtlasGraph,
  boundaries: readonly Grouping[],
  options: DeriveLevelsOptions = {},
): LevelTree {
  const depth = boundaries.length;
  const parentOf = new Map<string, string | null>();
  const childrenOf = new Map<string, AtlasNode[]>();
  const innerEdgesOf = new Map<string, AtlasEdge[]>();
  const kindOf = new Map<string, AtlasNodeKind>();

  // Group chain per leaf, with the (root) synthesis for parent==child ids.
  const chains = new Map<string, string[]>();
  for (const leaf of graph.nodes) {
    const chain: string[] = [];
    for (let k = 0; k < depth; k++) {
      let id = boundaries[k]!.groupOf(leaf.id);
      // a group must never share its id with the leaf (file boundary over
      // file leaves) or its parent (file at the module root): both would
      // self-link the parent chain — wrap in a synthetic group instead
      if (id === leaf.id) id = `${id}/(root)`;
      if (k > 0 && id === chain[k - 1]) id = `${id}/(root)`;
      chain.push(id);
    }
    chains.set(leaf.id, chain);
  }

  // Group nodes per level: loc sums and parent/child links.
  const nodesByLevel: Map<string, AtlasNode>[] = Array.from(
    { length: depth },
    () => new Map(),
  );
  for (const leaf of graph.nodes) {
    const chain = chains.get(leaf.id)!;
    for (let k = 0; k < depth; k++) {
      const grouping = boundaries[k]!;
      const id = chain[k]!;
      let group = nodesByLevel[k]!.get(id);
      if (!group) {
        group = {
          id,
          kind: grouping.kind,
          label: grouping.labelOf?.(id) ?? id,
          metrics: { loc: 0 },
        };
        nodesByLevel[k]!.set(id, group);
        kindOf.set(id, grouping.kind);
        const parent = k > 0 ? chain[k - 1]! : null;
        parentOf.set(id, parent);
        if (parent !== null) {
          const siblings = childrenOf.get(parent);
          if (siblings) siblings.push(group);
          else childrenOf.set(parent, [group]);
        }
      }
      group.metrics.loc += leaf.metrics.loc;
    }
    const innermost = depth > 0 ? chain[depth - 1]! : null;
    parentOf.set(leaf.id, innermost);
    if (innermost !== null) {
      const siblings = childrenOf.get(innermost);
      if (siblings) siblings.push(leaf);
      else childrenOf.set(innermost, [leaf]);
    }
  }

  // Edge lifting: at each level, leaf edges between distinct groups
  // aggregate by (source, target); intra-group leaf edges at the innermost
  // level stay raw. An aggregated level-k edge whose endpoints share a
  // level-(k-1) parent is that parent's inner edge.
  type Aggregate = {
    source: string;
    target: string;
    weight: number;
    kind: AtlasEdge["kind"];
    uniform: boolean;
    parent: string | null;
    /** Union of contributing edges' refs (imported symbol names). */
    refs: Set<string> | null;
  };
  const aggregatesByLevel: Map<string, Aggregate>[] = Array.from(
    { length: depth },
    () => new Map(),
  );
  for (const edge of graph.edges) {
    const sChain = chains.get(edge.source);
    const tChain = chains.get(edge.target);
    if (!sChain || !tChain) continue;
    for (let k = 0; k < depth; k++) {
      const sg = sChain[k]!;
      const tg = tChain[k]!;
      if (sg === tg) {
        if (k === depth - 1) {
          const inner = innerEdgesOf.get(sg);
          if (inner) inner.push(edge);
          else innerEdgesOf.set(sg, [edge]);
        }
        continue;
      }
      const key = `${sg}\u0000${tg}`;
      const existing = aggregatesByLevel[k]!.get(key);
      if (existing) {
        existing.weight += edge.weight ?? 1;
        if (existing.uniform && existing.kind !== edge.kind) {
          existing.kind = undefined;
          existing.uniform = false;
        }
        if (edge.refs && edge.refs.length > 0) {
          existing.refs ??= new Set();
          for (const ref of edge.refs) existing.refs.add(ref);
        }
      } else {
        aggregatesByLevel[k]!.set(key, {
          source: sg,
          target: tg,
          weight: edge.weight ?? 1,
          kind: edge.kind,
          uniform: true,
          parent: k > 0 && sChain[k - 1] === tChain[k - 1] ? sChain[k - 1]! : null,
          refs: edge.refs && edge.refs.length > 0 ? new Set(edge.refs) : null,
        });
      }
    }
  }

  const levels: HierarchyLevel[] = boundaries.map((grouping, k) => {
    const edges: AtlasEdge[] = [];
    for (const agg of aggregatesByLevel[k]!.values()) {
      const lifted: AtlasEdge = {
        source: agg.source,
        target: agg.target,
        weight: agg.weight,
        kind: agg.kind,
        ...(agg.refs ? { refs: [...agg.refs] } : {}),
      };
      edges.push(lifted);
      if (agg.parent !== null) {
        const inner = innerEdgesOf.get(agg.parent);
        if (inner) inner.push(lifted);
        else innerEdgesOf.set(agg.parent, [lifted]);
      }
    }
    for (const edge of options.nativeEdges?.get(grouping.kind) ?? []) {
      const source = nodesByLevel[k]!.get(edge.source);
      const target = nodesByLevel[k]!.get(edge.target);
      if (!source || !target || edge.source === edge.target) continue;
      edges.push(edge);
      const parent = parentOf.get(edge.source) ?? null;
      if (parent !== null && parent === parentOf.get(edge.target)) {
        const inner = innerEdgesOf.get(parent);
        if (inner) inner.push(edge);
        else innerEdgesOf.set(parent, [edge]);
      }
    }
    return {
      kind: grouping.kind,
      nodes: [...nodesByLevel[k]!.values()],
      edges,
    };
  });

  return { levels, parentOf, childrenOf, innerEdgesOf, kindOf };
}

/**
 * Nearest ancestor (or the node itself) at the requested level kind; null
 * when the id is unknown or the chain has no such level. Composes with
 * liftOverlay: `liftOverlay(o, (id) => ancestorAt(tree, id, "module"))`.
 */
export function ancestorAt(
  tree: LevelTree,
  id: string,
  kind: AtlasNodeKind,
): string | null {
  if (tree.kindOf.get(id) === kind) return id;
  let current = tree.parentOf.get(id);
  while (current != null) {
    if (tree.kindOf.get(current) === kind) return current;
    current = tree.parentOf.get(current);
  }
  return null;
}

/** Parent file of a leaf id (`symbol:<path>:...`, `<path>#sN`, or a path). */
export function parentFileOf(id: string): string {
  if (id.startsWith("symbol:")) return id.split(":")[1] ?? id;
  const hash = id.indexOf("#");
  return hash >= 0 ? id.slice(0, hash) : id;
}

/** Module boundary via the path heuristic (or a workspace-aware mapper). */
export function moduleGrouping(
  moduleIdOf: ModuleIdOf = defaultModuleIdOf,
): Grouping {
  return { kind: "module", groupOf: (id) => moduleIdOf(parentFileOf(id)) };
}

/** Directory boundary: dirname truncated to at most maxDepth segments. */
export function directoryGrouping(maxDepth: number): Grouping {
  return {
    kind: "directory",
    groupOf: (id) => {
      const segments = parentFileOf(id).split("/");
      segments.pop();
      if (segments.length === 0) return "(root)";
      return segments.slice(0, maxDepth).join("/");
    },
  };
}

/** File boundary for symbol/block leaves. */
export function fileGrouping(): Grouping {
  return { kind: "file", groupOf: parentFileOf };
}

const MEMBER_KINDS: ReadonlySet<string> = new Set([
  "method",
  "property",
  "static-method",
  "static-property",
]);

/**
 * The owning class' group id for a member or class-declaration symbol, else
 * null. Members are encoded as `symbol:path:<kind>:Class.member:line` and the
 * declaration as `symbol:path:class:Class:line`; both map to
 * `class:<path>:<ClassName>`. Loose (non-class) symbols return null.
 */
export function classIdOf(id: string): string | null {
  if (!id.startsWith("symbol:")) return null;
  const parts = id.split(":");
  if (parts.length < 5) return null;
  const kind = parts[parts.length - 3]!;
  const name = parts[parts.length - 2]!;
  const path = parts.slice(1, parts.length - 3).join(":");
  if (kind === "class") return `class:${path}:${name}`;
  if (MEMBER_KINDS.has(kind)) return `class:${path}:${name.split(".")[0]}`;
  return null;
}

/** Short class name from a `class:<path>:<ClassName>` group id. */
export function classNameOf(classId: string): string {
  return classId.slice(classId.lastIndexOf(":") + 1);
}

/** Per-module bucket id holding every non-class symbol of a module. */
export function restBucketId(moduleId: string): string {
  return `(rest):${moduleId}`;
}

/**
 * Class boundary: members (method/property, static or not) group under their
 * owning class, and the class declaration symbol joins the same group; the
 * group id is `class:<path>:<ClassName>`.
 *
 * Every non-class symbol of a module shares ONE "(rest):<module>" bucket — not
 * a per-symbol singleton (which froze each loose symbol into the solved-once
 * intermediate partition, pinning it off-center) and not a per-file bucket
 * (which fragmented the module into many small frozen districts). The single
 * rest bucket carries most of the module's loc, so it keeps the centre of the
 * circle and its loose symbols spread there via the continuous leaf melt,
 * while the class districts stay as small contiguous regions around it.
 */
export function classGrouping(
  moduleIdOf: ModuleIdOf = defaultModuleIdOf,
  /** Bucket key for non-class symbols. Must match this class level's PARENT
   * boundary, so the single rest bucket nests under exactly one parent. With a
   * directory boundary above, key it by directory — a module-keyed bucket is
   * shared across the module's directories and, since a group has one parent,
   * collapses into one directory and empties the others. */
  restKeyOf: (id: string) => string = (id) => moduleIdOf(parentFileOf(id)),
): Grouping {
  return {
    kind: "class",
    groupOf: (id) => classIdOf(id) ?? restBucketId(restKeyOf(id)),
    labelOf: (gid) =>
      gid.startsWith("class:") ? classNameOf(gid) : gid,
  };
}

/**
 * Service boundary: the mapping comes from deployment config or tracing,
 * not from code structure. Service-to-service communication edges enter
 * through DeriveLevelsOptions.nativeEdges["service"].
 */
export function serviceGrouping(
  serviceOf: (fileId: string) => string,
): Grouping {
  return { kind: "service", groupOf: (id) => serviceOf(parentFileOf(id)) };
}
