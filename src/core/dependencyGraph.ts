import {
  buildModuleMapFrame,
  moduleIdForFilePath,
  type CodeLayer,
  type ModuleDependency,
  type ModuleFile,
  type ModuleMapFrame,
  type ModuleParcel,
  type ModuleStatus,
  type ModuleSymbol,
} from "./moduleMap.js";
import type { GraphDiff, ImportsEdge, Snapshot } from "./types.js";

export type DependencyGraphNodeKind = "module" | "port" | "api" | "symbol";
export type DependencyGraphStatus = ModuleStatus | "removed";
export type DependencyGraphEdgeScope = "module" | "detail";
export type DependencyGraphPortDirection = "in" | "out";

export type DependencyGraphPreviewNode = {
  id: string;
  path: string;
  label: string;
  layer: CodeLayer;
  loc: number;
  status: DependencyGraphStatus;
  x: number;
  y: number;
  r: number;
};

export type DependencyGraphNode = {
  id: string;
  kind: DependencyGraphNodeKind;
  parentId?: string;
  expanded: boolean;
  path: string;
  label: string;
  layer?: CodeLayer;
  peerModuleId?: string;
  portDirection?: DependencyGraphPortDirection;
  loc: number;
  fileCount: number;
  symbolCount: number;
  fanIn: number;
  fanOut: number;
  inCycle: boolean;
  exported: boolean;
  status: DependencyGraphStatus;
  hotspotScore: number;
  x: number;
  y: number;
  r: number;
  previewNodes: DependencyGraphPreviewNode[];
};

export type DependencyGraphEdge = {
  id: string;
  scope: DependencyGraphEdgeScope;
  from: string;
  to: string;
  importCount: number;
  status: DependencyGraphStatus;
  fromModuleId?: string;
  toModuleId?: string;
};

export type DependencyGraphImportDetail = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromModuleId: string;
  toModuleId: string;
  fromPath: string;
  toPath: string;
  importCount: number;
  specifiers: string[];
  internal: boolean;
  status: DependencyGraphStatus;
};

export type DependencyGraphBreakdown = {
  nodeId: string;
  incoming: DependencyGraphImportDetail[];
  outgoing: DependencyGraphImportDetail[];
};

export type DependencyGraphFrame = {
  schemaVersion: 1;
  commitHash: string;
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
  breakdowns: Record<string, DependencyGraphBreakdown>;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
};

export type BuildDependencyGraphOptions = {
  diff?: Pick<GraphDiff, "addedEdges" | "addedNodes" | "changedFiles" | "hotspots"> | null;
  focusModuleId?: string;
  focusFilePath?: string;
  maxApiNodes?: number;
};

const GRAPH_WIDTH = 1600;
const GRAPH_HEIGHT = 980;
const MODULE_MIN_R = 34;
const MODULE_MAX_R = 72;
const API_MIN_R = 11;
const API_MAX_R = 28;
const SYMBOL_R = 7;
const MODULE_PREVIEW_MAX = 14;

type PositionedModule = {
  module: ModuleParcel;
  expanded: boolean;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
};

export function buildDependencyGraphFrame(snapshot: Snapshot, options: BuildDependencyGraphOptions = {}): DependencyGraphFrame {
  const moduleFrame = buildModuleMapFrame(snapshot, { diff: options.diff });
  const focusModuleId = options.focusModuleId ?? (options.focusFilePath ? moduleIdForFilePath(options.focusFilePath) : undefined);
  const positionedModules = layoutModules(moduleFrame, focusModuleId);
  const positionedById = new Map(positionedModules.map((node) => [node.module.id, node]));
  const nodes: DependencyGraphNode[] = positionedModules.map((node) => moduleNode(node));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const fileById = new Map(moduleFrame.modules.flatMap((module) => module.files.map((file) => [file.id, file] as const)));
  const moduleByFileId = new Map<string, string>();
  const apiNodeByFileId = new Map<string, string>();

  for (const module of moduleFrame.modules) {
    for (const file of module.files) {
      moduleByFileId.set(file.id, module.id);
    }
  }

  for (const port of layoutPortNodes(moduleFrame.dependencies, positionedById)) {
    nodes.push(port);
    visibleNodeIds.add(port.id);
  }

  if (focusModuleId) {
    const focusModule = moduleFrame.modules.find((module) => module.id === focusModuleId);
    const parent = focusModule ? positionedById.get(focusModule.id) : undefined;
    if (focusModule && parent) {
      const apiFiles = selectApiFiles(focusModule, options.maxApiNodes ?? 20);
      const apiNodes = layoutApiNodes(parent, apiFiles);
      for (const apiNode of apiNodes) {
        nodes.push(apiNode.node);
        visibleNodeIds.add(apiNode.node.id);
        apiNodeByFileId.set(apiNode.file.id, apiNode.node.id);
      }

      const focusFile = options.focusFilePath ? apiFiles.find((file) => file.path === options.focusFilePath) : apiFiles[0];
      const focusApiNode = focusFile ? nodes.find((node) => node.id === apiIdForPath(focusFile.path)) : undefined;
      if (focusFile && focusApiNode) {
        for (const symbolNode of layoutSymbolNodes(focusApiNode, focusFile.symbols.filter((symbol) => symbol.exported))) {
          nodes.push(symbolNode);
          visibleNodeIds.add(symbolNode.id);
        }
      }
    }
  }

  const edges = aggregateVisibleEdges(snapshot, moduleFrame, fileById, moduleByFileId, apiNodeByFileId, visibleNodeIds, options.diff ?? null);
  const breakdowns = buildImportBreakdowns(snapshot, moduleFrame, fileById, moduleByFileId, apiNodeByFileId, options.diff ?? null);
  return {
    schemaVersion: 1,
    commitHash: snapshot.commit.hash,
    nodes,
    edges,
    breakdowns,
    bounds: computeBounds(nodes),
  };
}

function moduleNode(positioned: PositionedModule): DependencyGraphNode {
  const module = positioned.module;
  return {
    id: module.id,
    kind: "module",
    expanded: positioned.expanded,
    path: module.path,
    label: module.label,
    loc: module.loc,
    fileCount: module.fileCount,
    symbolCount: module.files.reduce((sum, file) => sum + file.symbols.filter((symbol) => symbol.exported).length, 0),
    fanIn: 0,
    fanOut: 0,
    inCycle: module.files.some((file) => file.inCycle),
    exported: true,
    status: module.status,
    hotspotScore: module.hotspotScore,
    x: positioned.x,
    y: positioned.y,
    r: positioned.r,
    previewNodes: positioned.expanded ? [] : modulePreviewNodes(module),
  };
}

function portNode(
  owner: PositionedModule,
  peer: PositionedModule,
  dependency: ModuleDependency,
  direction: DependencyGraphPortDirection,
  x: number,
  y: number,
): DependencyGraphNode {
  return {
    id: portIdForDependency(owner.module.id, peer.module.id, direction),
    kind: "port",
    parentId: owner.module.id,
    expanded: false,
    path: owner.module.path,
    label: `${direction === "out" ? "to" : "from"} ${peer.module.label}`,
    peerModuleId: peer.module.id,
    portDirection: direction,
    loc: 0,
    fileCount: 0,
    symbolCount: 0,
    fanIn: direction === "in" ? dependency.importCount : 0,
    fanOut: direction === "out" ? dependency.importCount : 0,
    inCycle: false,
    exported: true,
    status: dependency.addedCount > 0 ? "added" : dependency.changed ? "changed" : "stable",
    hotspotScore: 0,
    x,
    y,
    r: clamp(4.5 + Math.sqrt(dependency.importCount) * 0.6, 6, 13),
    previewNodes: [],
  };
}

function apiNode(file: ModuleFile, parent: PositionedModule, x: number, y: number): DependencyGraphNode {
  return {
    id: apiIdForPath(file.path),
    kind: "api",
    parentId: parent.module.id,
    expanded: false,
    path: file.path,
    label: file.label,
    layer: file.layer,
    loc: file.loc,
    fileCount: 1,
    symbolCount: file.symbols.filter((symbol) => symbol.exported).length,
    fanIn: file.fanIn,
    fanOut: file.fanOut,
    inCycle: file.inCycle,
    exported: file.symbols.some((symbol) => symbol.exported),
    status: file.status,
    hotspotScore: file.hotspotScore,
    x,
    y,
    r: clamp(Math.sqrt(Math.max(file.loc, 1)) * 1.45, API_MIN_R, API_MAX_R),
    previewNodes: [],
  };
}

function layoutPortNodes(dependencies: ModuleDependency[], positionedById: Map<string, PositionedModule>): DependencyGraphNode[] {
  const ports: DependencyGraphNode[] = [];
  const perModuleCounts = new Map<string, number>();
  for (const dependency of dependencies) {
    const from = positionedById.get(dependency.from);
    const to = positionedById.get(dependency.to);
    if (!from || !to) {
      continue;
    }
    const fromPoint = boundaryPoint(from, to, perModuleCounts);
    const toPoint = boundaryPoint(to, from, perModuleCounts);
    ports.push(portNode(from, to, dependency, "out", fromPoint.x, fromPoint.y));
    ports.push(portNode(to, from, dependency, "in", toPoint.x, toPoint.y));
  }
  return ports;
}

function boundaryPoint(owner: PositionedModule, peer: PositionedModule, perModuleCounts: Map<string, number>): { x: number; y: number } {
  const count = perModuleCounts.get(owner.module.id) ?? 0;
  perModuleCounts.set(owner.module.id, count + 1);
  const dx = peer.x - owner.x || 0.01;
  const dy = peer.y - owner.y || 0.01;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const spread = ((count % 5) - 2) * 0.055;
  const angle = Math.atan2(dy / distance, dx / distance) + spread;
  return {
    x: owner.x + Math.cos(angle) * owner.r,
    y: owner.y + Math.sin(angle) * owner.r,
  };
}

function symbolNode(symbol: ModuleSymbol, parent: DependencyGraphNode, x: number, y: number): DependencyGraphNode {
  return {
    id: symbol.id,
    kind: "symbol",
    parentId: parent.id,
    expanded: false,
    path: symbol.filePath,
    label: symbol.label,
    loc: symbol.loc,
    fileCount: 0,
    symbolCount: 1,
    fanIn: 0,
    fanOut: 0,
    inCycle: false,
    exported: symbol.exported,
    status: symbol.status,
    hotspotScore: 0,
    x,
    y,
    r: SYMBOL_R,
    previewNodes: [],
  };
}

function selectApiFiles(module: ModuleParcel, maxApiNodes: number): ModuleFile[] {
  return module.files
    .map((file) => ({
      file,
      score:
        (file.symbols.some((symbol) => symbol.exported) ? 900 : 0) +
        file.fanIn * 24 +
        file.fanOut * 16 +
        file.hotspotScore * 3 +
        Math.sqrt(Math.max(file.loc, 1)),
    }))
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path))
    .slice(0, maxApiNodes)
    .map((entry) => entry.file)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function modulePreviewNodes(module: ModuleParcel): DependencyGraphPreviewNode[] {
  const files = selectPreviewFiles(module);
  const largestLoc = Math.max(1, ...files.map((file) => file.loc));
  const count = Math.max(1, files.length);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const span = 1.12;
  const cell = span / Math.max(columns, rows);

  return files.map((file, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    let x = (column - (columns - 1) / 2) * cell;
    let y = (row - (rows - 1) / 2) * cell;
    const r = clamp(Math.sqrt(file.loc / largestLoc) * 0.12, 0.045, 0.12);
    const distance = Math.hypot(x, y);
    const allowed = 0.76 - r;
    if (distance > allowed) {
      x = (x / distance) * allowed;
      y = (y / distance) * allowed;
    }
    return {
      id: `preview:${file.path}`,
      path: file.path,
      label: file.label,
      layer: file.layer,
      loc: file.loc,
      status: file.status,
      x,
      y,
      r,
    };
  });
}

function selectPreviewFiles(module: ModuleParcel): ModuleFile[] {
  const limit = Math.min(MODULE_PREVIEW_MAX, Math.max(3, Math.ceil(Math.sqrt(module.fileCount) * 2)));
  return module.files
    .map((file) => ({
      file,
      score:
        file.fanIn * 20 +
        file.fanOut * 14 +
        file.hotspotScore * 3 +
        (file.symbols.some((symbol) => symbol.exported) ? 120 : 0) +
        Math.sqrt(Math.max(file.loc, 1)),
    }))
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path))
    .slice(0, limit)
    .map((entry) => entry.file)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function layoutModules(frame: ModuleMapFrame, focusModuleId?: string): PositionedModule[] {
  const totalLoc = Math.max(1, frame.modules.reduce((sum, module) => sum + module.loc, 0));
  const nodes = frame.modules.map((module, index): PositionedModule => {
    const angle = -Math.PI / 2 + (index / Math.max(1, frame.modules.length)) * Math.PI * 2;
    const radiusX = GRAPH_WIDTH * 0.34;
    const radiusY = GRAPH_HEIGHT * 0.3;
    const expanded = module.id === focusModuleId;
    return {
      module,
      expanded,
      x: GRAPH_WIDTH / 2 + Math.cos(angle) * radiusX,
      y: GRAPH_HEIGHT / 2 + Math.sin(angle) * radiusY,
      r: expanded ? expandedModuleRadius(module) : clamp(Math.sqrt(module.loc / totalLoc) * 170, MODULE_MIN_R, MODULE_MAX_R),
      vx: 0,
      vy: 0,
    };
  });
  const byId = new Map(nodes.map((node) => [node.module.id, node]));

  for (let iteration = 0; iteration < 180; iteration += 1) {
    for (const dependency of frame.dependencies) {
      const from = byId.get(dependency.from);
      const to = byId.get(dependency.to);
      if (!from || !to) {
        continue;
      }
      const dx = to.x - from.x || 0.01;
      const dy = to.y - from.y || 0.01;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired = from.r + to.r + 90;
      const force = (distance - desired) * 0.004 * Math.max(1, Math.log2(dependency.importCount + 1));
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      from.vx += fx;
      from.vy += fy;
      to.vx -= fx;
      to.vy -= fy;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!a) continue;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (!b) continue;
        const dx = b.x - a.x || deterministicSign(a.module.id, b.module.id) * 0.01;
        const dy = b.y - a.y || deterministicSign(`${a.module.id}:y`, `${b.module.id}:y`) * 0.01;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const minDistance = a.r + b.r + 34;
        if (distance >= minDistance) {
          continue;
        }
        const push = (minDistance - distance) * 0.08;
        const fx = (dx / distance) * push;
        const fy = (dy / distance) * push;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    for (const node of nodes) {
      node.vx += (GRAPH_WIDTH / 2 - node.x) * 0.0012;
      node.vy += (GRAPH_HEIGHT / 2 - node.y) * 0.0012;
      node.x = clamp(node.x + node.vx, node.r + 18, GRAPH_WIDTH - node.r - 18);
      node.y = clamp(node.y + node.vy, node.r + 18, GRAPH_HEIGHT - node.r - 18);
      node.vx *= 0.72;
      node.vy *= 0.72;
    }
  }

  return nodes;
}

function layoutApiNodes(parent: PositionedModule, files: ModuleFile[]): Array<{ file: ModuleFile; node: DependencyGraphNode }> {
  const count = Math.max(1, files.length);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const span = parent.r * 1.18;
  const cell = span / Math.max(columns, rows);
  const maxDistance = parent.r - API_MAX_R - 18;

  return files.map((file, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    let x = parent.x + (column - (columns - 1) / 2) * cell;
    let y = parent.y + (row - (rows - 1) / 2) * cell;
    const nodeRadius = clamp(Math.sqrt(Math.max(file.loc, 1)) * 1.45, API_MIN_R, API_MAX_R);
    const dx = x - parent.x;
    const dy = y - parent.y;
    const distance = Math.hypot(dx, dy);
    const allowed = Math.max(1, maxDistance - nodeRadius);
    if (distance > allowed) {
      x = parent.x + (dx / distance) * allowed;
      y = parent.y + (dy / distance) * allowed;
    }
    return {
      file,
      node: apiNode(file, parent, x, y),
    };
  });
}

function expandedModuleRadius(module: ModuleParcel): number {
  const apiCapacity = Math.min(20, Math.max(8, module.fileCount));
  return clamp(138 + Math.sqrt(apiCapacity) * 15, 168, 240);
}

function layoutSymbolNodes(parent: DependencyGraphNode, symbols: ModuleSymbol[]): DependencyGraphNode[] {
  const radius = parent.r + 24 + Math.sqrt(symbols.length) * 2;
  return symbols.slice(0, 18).map((symbol, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, symbols.length)) * Math.PI * 2;
    return symbolNode(symbol, parent, parent.x + Math.cos(angle) * radius, parent.y + Math.sin(angle) * radius,);
  });
}

function aggregateVisibleEdges(
  snapshot: Snapshot,
  moduleFrame: ModuleMapFrame,
  fileById: Map<string, ModuleFile>,
  moduleByFileId: Map<string, string>,
  apiNodeByFileId: Map<string, string>,
  visibleNodeIds: Set<string>,
  diff: BuildDependencyGraphOptions["diff"],
): DependencyGraphEdge[] {
  const addedEdges = new Set(diff?.addedEdges ?? []);
  const edgeMap = new Map<string, DependencyGraphEdge>();
  const moduleDependencyByPair = new Map<string, ModuleDependency>();
  for (const dependency of moduleFrame.dependencies) {
    moduleDependencyByPair.set(`${dependency.from}->${dependency.to}`, dependency);
    const fromPortId = portIdForDependency(dependency.from, dependency.to, "out");
    const toPortId = portIdForDependency(dependency.to, dependency.from, "in");
    edgeMap.set(`module-route:${fromPortId}->${toPortId}`, {
      id: `module-route:${fromPortId}->${toPortId}`,
      scope: "module",
      from: fromPortId,
      to: toPortId,
      fromModuleId: dependency.from,
      toModuleId: dependency.to,
      importCount: dependency.importCount,
      status: dependency.addedCount > 0 ? "added" : dependency.changed ? "changed" : "stable",
    });
  }

  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || !edge.resolved) {
      continue;
    }
    const from = visibleEndpoint(edge, fileById, moduleByFileId, apiNodeByFileId, visibleNodeIds, "from");
    const to = visibleEndpoint(edge, fileById, moduleByFileId, apiNodeByFileId, visibleNodeIds, "to");
    if (!from || !to || from === to) {
      continue;
    }
    if (from.startsWith("module:") && to.startsWith("module:")) {
      continue;
    }
    const id = `detail-route:${from}->${to}`;
    const fromModuleId = moduleByFileId.get(edge.from);
    const toModuleId = moduleByFileId.get(edge.to);
    if (!fromModuleId || !toModuleId || fromModuleId !== toModuleId) {
      continue;
    }
    const current = edgeMap.get(id) ?? {
      id,
      scope: "detail" as DependencyGraphEdgeScope,
      from,
      to,
      fromModuleId,
      toModuleId,
      importCount: 0,
      status: "stable" as DependencyGraphStatus,
    };
    current.importCount += 1;
    if (addedEdges.has(edge.id)) {
      current.status = "added";
    }
    const moduleDependency = moduleDependencyByPair.get(`${fromModuleId}->${toModuleId}`);
    if (moduleDependency?.changed && current.status === "stable") {
      current.status = "changed";
    }
    edgeMap.set(id, current);
  }

  return [...edgeMap.values()].sort(
    (a, b) =>
      edgeScopeRank(a.scope) - edgeScopeRank(b.scope) ||
      b.importCount - a.importCount ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to),
  );
}

function edgeScopeRank(scope: DependencyGraphEdgeScope): number {
  return scope === "detail" ? 0 : 1;
}

function buildImportBreakdowns(
  snapshot: Snapshot,
  moduleFrame: ModuleMapFrame,
  fileById: Map<string, ModuleFile>,
  moduleByFileId: Map<string, string>,
  apiNodeByFileId: Map<string, string>,
  diff: BuildDependencyGraphOptions["diff"],
): Record<string, DependencyGraphBreakdown> {
  const addedEdges = new Set(diff?.addedEdges ?? []);
  const breakdowns = new Map<string, { nodeId: string; incoming: Map<string, DependencyGraphImportDetail>; outgoing: Map<string, DependencyGraphImportDetail> }>();

  for (const module of moduleFrame.modules) {
    ensureBreakdown(breakdowns, module.id);
  }
  for (const apiNodeId of apiNodeByFileId.values()) {
    ensureBreakdown(breakdowns, apiNodeId);
  }

  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || !edge.resolved) {
      continue;
    }
    const fromFile = fileById.get(edge.from);
    const toFile = fileById.get(edge.to);
    const fromModuleId = moduleByFileId.get(edge.from);
    const toModuleId = moduleByFileId.get(edge.to);
    if (!fromFile || !toFile || !fromModuleId || !toModuleId) {
      continue;
    }

    const detailBase = {
      fromNodeId: apiNodeByFileId.get(edge.from) ?? fromModuleId,
      toNodeId: apiNodeByFileId.get(edge.to) ?? toModuleId,
      fromModuleId,
      toModuleId,
      fromPath: fromFile.path,
      toPath: toFile.path,
      specifier: edge.specifier,
      internal: fromModuleId === toModuleId,
      status: addedEdges.has(edge.id) ? ("added" as DependencyGraphStatus) : ("stable" as DependencyGraphStatus),
    };

    addBreakdownDetail(breakdowns, fromModuleId, "outgoing", detailBase);
    addBreakdownDetail(breakdowns, toModuleId, "incoming", detailBase);
    const fromApiNodeId = apiNodeByFileId.get(edge.from);
    const toApiNodeId = apiNodeByFileId.get(edge.to);
    if (fromApiNodeId) {
      addBreakdownDetail(breakdowns, fromApiNodeId, "outgoing", detailBase);
    }
    if (toApiNodeId) {
      addBreakdownDetail(breakdowns, toApiNodeId, "incoming", detailBase);
    }
  }

  return Object.fromEntries(
    [...breakdowns.entries()].map(([nodeId, breakdown]) => [
      nodeId,
      {
        nodeId,
        incoming: sortedBreakdownDetails(breakdown.incoming),
        outgoing: sortedBreakdownDetails(breakdown.outgoing),
      },
    ]),
  );
}

function ensureBreakdown(
  breakdowns: Map<string, { nodeId: string; incoming: Map<string, DependencyGraphImportDetail>; outgoing: Map<string, DependencyGraphImportDetail> }>,
  nodeId: string,
) {
  if (!breakdowns.has(nodeId)) {
    breakdowns.set(nodeId, { nodeId, incoming: new Map(), outgoing: new Map() });
  }
}

function addBreakdownDetail(
  breakdowns: Map<string, { nodeId: string; incoming: Map<string, DependencyGraphImportDetail>; outgoing: Map<string, DependencyGraphImportDetail> }>,
  nodeId: string,
  direction: "incoming" | "outgoing",
  detail: Omit<DependencyGraphImportDetail, "id" | "importCount" | "specifiers"> & { specifier: string },
) {
  const breakdown = breakdowns.get(nodeId);
  if (!breakdown) {
    return;
  }
  const id = `import-detail:${detail.fromPath}->${detail.toPath}`;
  const details = breakdown[direction];
  const current = details.get(id) ?? {
    id,
    fromNodeId: detail.fromNodeId,
    toNodeId: detail.toNodeId,
    fromModuleId: detail.fromModuleId,
    toModuleId: detail.toModuleId,
    fromPath: detail.fromPath,
    toPath: detail.toPath,
    importCount: 0,
    specifiers: [],
    internal: detail.internal,
    status: detail.status,
  };
  current.importCount += 1;
  if (!current.specifiers.includes(detail.specifier)) {
    current.specifiers.push(detail.specifier);
  }
  if (detail.status === "added") {
    current.status = "added";
  }
  details.set(id, current);
}

function sortedBreakdownDetails(details: Map<string, DependencyGraphImportDetail>): DependencyGraphImportDetail[] {
  return [...details.values()]
    .map((detail) => ({ ...detail, specifiers: [...detail.specifiers].sort() }))
    .sort(
      (a, b) =>
        Number(a.internal) - Number(b.internal) ||
        b.importCount - a.importCount ||
        a.fromPath.localeCompare(b.fromPath) ||
        a.toPath.localeCompare(b.toPath),
    );
}

function visibleEndpoint(
  edge: ImportsEdge,
  fileById: Map<string, ModuleFile>,
  moduleByFileId: Map<string, string>,
  apiNodeByFileId: Map<string, string>,
  visibleNodeIds: Set<string>,
  side: "from" | "to",
): string | undefined {
  const fileId = edge[side];
  const file = fileById.get(fileId);
  if (!file) {
    return undefined;
  }
  const apiId = apiNodeByFileId.get(fileId);
  if (apiId && visibleNodeIds.has(apiId)) {
    return apiId;
  }
  const moduleId = moduleByFileId.get(fileId);
  return moduleId && visibleNodeIds.has(moduleId) ? moduleId : undefined;
}

function apiIdForPath(filePath: string): string {
  return `api:${filePath}`;
}

function portIdForDependency(moduleId: string, peerModuleId: string, direction: DependencyGraphPortDirection): string {
  return `port:${direction}:${moduleId}->${peerModuleId}`;
}

function computeBounds(nodes: DependencyGraphNode[]): DependencyGraphFrame["bounds"] {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return {
    minX: Math.min(...nodes.map((node) => node.x - node.r)) - 24,
    minY: Math.min(...nodes.map((node) => node.y - node.r)) - 24,
    maxX: Math.max(...nodes.map((node) => node.x + node.r)) + 24,
    maxY: Math.max(...nodes.map((node) => node.y + node.r)) + 24,
  };
}

function deterministicSign(a: string, b: string): -1 | 1 {
  return a.localeCompare(b) <= 0 ? -1 : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
