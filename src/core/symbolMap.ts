import { hierarchy, treemap } from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import {
  buildModuleMapFrame,
  moduleIdForFilePath,
  type CodeLayer,
  type ModuleFile,
  type ModuleMapFrame,
  type ModuleParcel,
  type ModuleStatus,
  type ModuleSymbol,
} from "./moduleMap.js";
import type { GraphDiff, ImportsEdge, Snapshot } from "./types.js";

export type SymbolMapNodeKind = "module" | "file" | "symbol";
export type SymbolMapStatus = ModuleStatus | "removed";
export type SymbolSurface = "public" | "exported" | "internal";

export type SymbolMapNode = {
  id: string;
  kind: SymbolMapNodeKind;
  parentId?: string;
  moduleId?: string;
  fileId?: string;
  path: string;
  label: string;
  layer?: CodeLayer;
  loc: number;
  exported: boolean;
  surface: SymbolSurface;
  fanIn: number;
  fanOut: number;
  crossModuleFanIn: number;
  crossModuleFanOut: number;
  status: SymbolMapStatus;
  x: number;
  y: number;
  r: number;
  w?: number;
  h?: number;
  visibleAtZoom: number;
};

export type SymbolMapEdge = {
  id: string;
  scope: "symbol";
  from: string;
  to: string;
  fromModuleId: string;
  toModuleId: string;
  importCount: number;
  crossModule: boolean;
  status: SymbolMapStatus;
  visibleAtZoom: number;
};

export type SymbolMapFrame = {
  schemaVersion: 1;
  commitHash: string;
  nodes: SymbolMapNode[];
  edges: SymbolMapEdge[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  stats: {
    moduleCount: number;
    fileCount: number;
    symbolCount: number;
    publicSymbolCount: number;
    edgeCount: number;
  };
};

export type BuildSymbolMapOptions = {
  diff?: Pick<GraphDiff, "addedEdges" | "addedNodes" | "changedFiles" | "hotspots"> | null;
  focusModuleId?: string;
  focusFilePath?: string;
  maxFiles?: number;
  maxSymbols?: number;
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 1800;
const MAP_PADDING = 24;
const MODULE_PADDING = 18;
const MODULE_HEADER = 34;
const FILE_PADDING = 5;
const SYMBOL_PADDING = 8;

type ModuleRectDatum = {
  type: "root" | "module";
  module?: ModuleParcel;
  value: number;
  children?: ModuleRectDatum[];
};

type FileRectDatum = {
  type: "root" | "file";
  file?: ModuleFile;
  value: number;
  children?: FileRectDatum[];
};

type SymbolStats = {
  fanIn: number;
  fanOut: number;
  crossModuleFanIn: number;
  crossModuleFanOut: number;
};

type ModuleLayoutNode = {
  module: ModuleParcel;
  degree: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type ModuleAttraction = {
  from: string;
  to: string;
  weight: number;
  desired: number;
};

type RectLayout<T> = {
  item: T;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
};

type SymbolLayout = {
  symbol: ModuleSymbol;
  x: number;
  y: number;
  r: number;
};

export function buildSymbolMapFrame(snapshot: Snapshot, options: BuildSymbolMapOptions = {}): SymbolMapFrame {
  const moduleFrame = buildModuleMapFrame(snapshot, { diff: options.diff });
  const focusModuleId = options.focusModuleId ?? (options.focusFilePath ? moduleIdForFilePath(options.focusFilePath) : undefined);
  const moduleByFileId = mapModuleByFileId(moduleFrame);
  const symbolStats = collectSymbolStats(snapshot, moduleByFileId);
  const selectedFiles = selectFiles(moduleFrame, symbolStats, {
    focusModuleId,
    focusFilePath: options.focusFilePath,
    maxFiles: options.maxFiles ?? 520,
  });
  const selectedSymbols = selectSymbolsByFile(selectedFiles, symbolStats, options.maxSymbols ?? 1600);
  const fileById = new Map(moduleFrame.modules.flatMap((module) => module.files.map((file) => [file.id, file] as const)));
  const symbolById = new Map(moduleFrame.modules.flatMap((module) => module.files.flatMap((file) => file.symbols.map((symbol) => [symbol.id, { symbol, file, module }] as const))));
  const moduleLeafById = layoutModules(moduleFrame.modules, moduleFrame.dependencies);
  const nodes: SymbolMapNode[] = [];
  const symbolNodeIds = new Set<string>();

  for (const module of moduleFrame.modules) {
    const leaf = moduleLeafById.get(module.id);
    if (!leaf) {
      continue;
    }
    nodes.push(moduleNode(module, leaf));
  }

  const selectedFilesByModule = groupBy(selectedFiles, (file) => moduleIdForFilePath(file.path));
  for (const module of moduleFrame.modules) {
    const leaf = moduleLeafById.get(module.id);
    const files = selectedFilesByModule.get(module.id) ?? [];
    if (!leaf || files.length === 0) {
      continue;
    }
    const fileLeaves = layoutFiles(leaf, files);
    for (const fileLeaf of fileLeaves) {
      const file = fileLeaf.item;
      const fileNode = fileBoxNode(file, module.id, fileLeaf);
      nodes.push(fileNode);

      const symbols = selectedSymbols.get(file.id) ?? [];
      const symbolLeaves = layoutSymbols(fileNode, symbols, symbolStats);
      for (const symbolLeaf of symbolLeaves) {
        const symbol = symbolLeaf.symbol;
        nodes.push(symbolNode(symbol, file, module.id, fileNode, symbolLeaf, symbolStats.get(symbol.id)));
        symbolNodeIds.add(symbol.id);
      }
    }
  }

  const edges = buildSymbolEdges(snapshot, moduleByFileId, symbolNodeIds, symbolById, fileById, options.diff ?? null);

  return {
    schemaVersion: 1,
    commitHash: snapshot.commit.hash,
    nodes,
    edges,
    bounds: computeBounds(nodes),
    stats: {
      moduleCount: nodes.filter((node) => node.kind === "module").length,
      fileCount: nodes.filter((node) => node.kind === "file").length,
      symbolCount: nodes.filter((node) => node.kind === "symbol").length,
      publicSymbolCount: nodes.filter((node) => node.kind === "symbol" && node.surface === "public").length,
      edgeCount: edges.length,
    },
  };
}

function mapModuleByFileId(frame: ModuleMapFrame): Map<string, string> {
  const moduleByFileId = new Map<string, string>();
  for (const module of frame.modules) {
    for (const file of module.files) {
      moduleByFileId.set(file.id, module.id);
    }
  }
  return moduleByFileId;
}

function collectSymbolStats(snapshot: Snapshot, moduleByFileId: Map<string, string>): Map<string, SymbolStats> {
  const stats = new Map<string, SymbolStats>();
  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || !edge.resolved) {
      continue;
    }
    const fromModuleId = moduleByFileId.get(edge.from);
    const toModuleId = moduleByFileId.get(edge.to);
    if (!fromModuleId || !toModuleId) {
      continue;
    }
    const crossModule = fromModuleId !== toModuleId;
    for (const symbolImport of edge.symbolImports ?? []) {
      if (symbolImport.fromSymbolId) {
        const current = ensureSymbolStats(stats, symbolImport.fromSymbolId);
        current.fanOut += 1;
        if (crossModule) {
          current.crossModuleFanOut += 1;
        }
      }
      if (symbolImport.toSymbolId) {
        const current = ensureSymbolStats(stats, symbolImport.toSymbolId);
        current.fanIn += 1;
        if (crossModule) {
          current.crossModuleFanIn += 1;
        }
      }
    }
  }
  return stats;
}

function ensureSymbolStats(stats: Map<string, SymbolStats>, symbolId: string): SymbolStats {
  const current = stats.get(symbolId) ?? { fanIn: 0, fanOut: 0, crossModuleFanIn: 0, crossModuleFanOut: 0 };
  stats.set(symbolId, current);
  return current;
}

function selectFiles(
  frame: ModuleMapFrame,
  stats: Map<string, SymbolStats>,
  options: { focusModuleId?: string; focusFilePath?: string; maxFiles: number },
): ModuleFile[] {
  const candidates = frame.modules.flatMap((module) => {
    const localLimit = module.id === options.focusModuleId ? 96 : 12;
    return module.files
      .map((file) => ({
        file,
        score:
          file.loc +
          file.hotspotScore * 8 +
          file.fanIn * 20 +
          file.fanOut * 14 +
          (file.path === options.focusFilePath ? 20_000 : 0) +
          file.symbols.reduce((sum, symbol) => {
            const stat = stats.get(symbol.id);
            return sum + (symbol.exported ? 80 : 0) + (stat ? stat.fanIn * 40 + stat.fanOut * 24 + stat.crossModuleFanIn * 180 : 0);
          }, 0),
      }))
      .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path))
      .slice(0, localLimit);
  });

  const selected = new Map<string, ModuleFile>();
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path)).slice(0, options.maxFiles)) {
    selected.set(candidate.file.id, candidate.file);
  }
  if (options.focusFilePath) {
    const focusFile = frame.modules.flatMap((module) => module.files).find((file) => file.path === options.focusFilePath);
    if (focusFile) {
      selected.set(focusFile.id, focusFile);
    }
  }
  return [...selected.values()].sort((a, b) => moduleIdForFilePath(a.path).localeCompare(moduleIdForFilePath(b.path)) || b.loc - a.loc || a.path.localeCompare(b.path));
}

function selectSymbolsByFile(files: ModuleFile[], stats: Map<string, SymbolStats>, maxSymbols: number): Map<string, ModuleSymbol[]> {
  const candidates = files.flatMap((file) =>
    file.symbols
      .map((symbol) => {
        const stat = stats.get(symbol.id);
        return {
          file,
          symbol,
          score:
            (symbol.exported ? 1000 : 0) +
            (stat ? stat.crossModuleFanIn * 500 + stat.crossModuleFanOut * 260 + stat.fanIn * 70 + stat.fanOut * 52 : 0) +
            symbol.loc,
        };
      }),
  );
  const selected = candidates.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path) || a.symbol.name.localeCompare(b.symbol.name)).slice(0, maxSymbols);
  const byFile = new Map<string, ModuleSymbol[]>();
  for (const item of selected) {
    const current = byFile.get(item.file.id) ?? [];
    current.push(item.symbol);
    byFile.set(item.file.id, current);
  }
  for (const [fileId, symbols] of byFile) {
    byFile.set(fileId, symbols.sort((a, b) => b.loc - a.loc || a.name.localeCompare(b.name)));
  }
  return byFile;
}

function layoutModules(modules: ModuleParcel[], dependencies: ModuleMapFrame["dependencies"]): Map<string, RectLayout<ModuleParcel>> {
  const moduleIds = new Set(modules.map((module) => module.id));
  const degree = moduleDegree(modules, dependencies);
  const totalLoc = Math.max(1, modules.reduce((sum, module) => sum + Math.max(1, module.loc), 0));
  const targetArea = MAP_WIDTH * MAP_HEIGHT * 0.24;
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;
  const sortedModules = [...modules].sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path));
  const nodes = sortedModules.map((module, index): ModuleLayoutNode => {
    const side = clamp(Math.sqrt((Math.max(1, module.loc) / totalLoc) * targetArea), 30, 360);
    const hasDependency = (degree.get(module.id) ?? 0) > 0;
    const angle = index * 2.399963229728653;
    const radius = hasDependency ? 260 + Math.sqrt(index) * 54 : 14 + index * 4;
    return {
      module,
      degree: degree.get(module.id) ?? 0,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      w: side,
      h: side,
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.module.id, node]));
  seedDependencyClusters(nodes, nodeById, dependencies, moduleIds);
  const attractions = moduleAttractions(dependencies, moduleIds, nodeById);

  for (let iteration = 0; iteration < 260; iteration++) {
    const alpha = 1 - iteration / 260;
    applyCenterForces(nodes, centerX, centerY, alpha);
    applyAttractions(nodes, nodeById, attractions, alpha);
    applyCollisions(nodes, alpha);
    keepNodesInBounds(nodes);
  }
  for (let iteration = 0; iteration < 120; iteration++) {
    applyCollisions(nodes, 1);
    keepNodesInBounds(nodes);
  }

  return new Map(
    nodes.map((node) => [
      node.module.id,
      {
        item: node.module,
        x0: node.x - node.w / 2,
        y0: node.y - node.h / 2,
        x1: node.x + node.w / 2,
        y1: node.y + node.h / 2,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        r: Math.hypot(node.w, node.h) / 2,
      },
    ]),
  );
}

function moduleDegree(modules: ModuleParcel[], dependencies: ModuleMapFrame["dependencies"]): Map<string, number> {
  const moduleIds = new Set(modules.map((module) => module.id));
  const degree = new Map(modules.map((module) => [module.id, 0]));
  for (const dependency of dependencies) {
    if (!moduleIds.has(dependency.from) || !moduleIds.has(dependency.to) || dependency.from === dependency.to) {
      continue;
    }
    degree.set(dependency.from, (degree.get(dependency.from) ?? 0) + dependency.importCount);
    degree.set(dependency.to, (degree.get(dependency.to) ?? 0) + dependency.importCount);
  }
  return degree;
}

function seedDependencyClusters(
  nodes: ModuleLayoutNode[],
  nodeById: Map<string, ModuleLayoutNode>,
  dependencies: ModuleMapFrame["dependencies"],
  moduleIds: Set<string>,
): void {
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;
  const bestTargetBySource = new Map<string, { target: string; weight: number }>();
  for (const dependency of dependencies) {
    if (!moduleIds.has(dependency.from) || !moduleIds.has(dependency.to) || dependency.from === dependency.to) {
      continue;
    }
    const current = bestTargetBySource.get(dependency.from);
    if (!current || dependency.importCount > current.weight) {
      bestTargetBySource.set(dependency.from, { target: dependency.to, weight: dependency.importCount });
    }
  }

  const sourcesByTarget = new Map<string, string[]>();
  for (const [source, target] of bestTargetBySource) {
    const current = sourcesByTarget.get(target.target) ?? [];
    current.push(source);
    sourcesByTarget.set(target.target, current);
  }

  const targetIds = [...sourcesByTarget.keys()].sort((a, b) => (nodeById.get(b)?.degree ?? 0) - (nodeById.get(a)?.degree ?? 0) || a.localeCompare(b));
  for (const [index, targetId] of targetIds.entries()) {
    const target = nodeById.get(targetId);
    if (!target) {
      continue;
    }
    const angle = index * 2.399963229728653;
    const radius = 160 + Math.sqrt(index) * 70;
    target.x = centerX + Math.cos(angle) * radius;
    target.y = centerY + Math.sin(angle) * radius;
  }

  for (const [targetId, sourceIds] of sourcesByTarget) {
    const target = nodeById.get(targetId);
    if (!target) {
      continue;
    }
    const sortedSources = sourceIds.sort((a, b) => (nodeById.get(b)?.degree ?? 0) - (nodeById.get(a)?.degree ?? 0) || a.localeCompare(b));
    for (const [index, sourceId] of sortedSources.entries()) {
      const source = nodeById.get(sourceId);
      if (!source) {
        continue;
      }
      const angle = -Math.PI / 2 + (index - (sortedSources.length - 1) / 2) * 0.9;
      const radius = Math.max(target.w, target.h) / 2 + Math.max(source.w, source.h) / 2 + 72;
      source.x = target.x + Math.cos(angle) * radius;
      source.y = target.y + Math.sin(angle) * radius;
    }
  }

  for (const node of nodes) {
    if (node.degree === 0) {
      node.x = centerX;
      node.y = centerY;
    }
  }
  keepNodesInBounds(nodes);
}

function moduleAttractions(dependencies: ModuleMapFrame["dependencies"], moduleIds: Set<string>, nodeById: Map<string, ModuleLayoutNode>): ModuleAttraction[] {
  const attractions: ModuleAttraction[] = [];
  const targetsBySource = new Map<string, Array<{ target: string; weight: number }>>();
  for (const dependency of dependencies) {
    if (!moduleIds.has(dependency.from) || !moduleIds.has(dependency.to) || dependency.from === dependency.to) {
      continue;
    }
    const from = nodeById.get(dependency.from);
    const to = nodeById.get(dependency.to);
    if (!from || !to) {
      continue;
    }
    const weight = Math.max(1, Math.log2(dependency.importCount + 1));
    attractions.push({
      from: dependency.from,
      to: dependency.to,
      weight,
      desired: (Math.max(from.w, from.h) + Math.max(to.w, to.h)) / 2 + 54,
    });
    const current = targetsBySource.get(dependency.to) ?? [];
    current.push({ target: dependency.from, weight });
    targetsBySource.set(dependency.to, current);
  }
  for (const sources of targetsBySource.values()) {
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const a = sources[i];
        const b = sources[j];
        if (!a || !b) {
          continue;
        }
        const from = nodeById.get(a.target);
        const to = nodeById.get(b.target);
        if (!from || !to) {
          continue;
        }
        attractions.push({
          from: a.target,
          to: b.target,
          weight: Math.min(a.weight, b.weight) * 1.2,
          desired: (Math.max(from.w, from.h) + Math.max(to.w, to.h)) / 2 + 42,
        });
      }
    }
  }
  return attractions;
}

function applyCenterForces(nodes: ModuleLayoutNode[], centerX: number, centerY: number, alpha: number): void {
  for (const node of nodes) {
    const strength = node.degree === 0 ? 0.055 : 0.004;
    node.x += (centerX - node.x) * strength * alpha;
    node.y += (centerY - node.y) * strength * alpha;
  }
}

function applyAttractions(nodes: ModuleLayoutNode[], nodeById: Map<string, ModuleLayoutNode>, attractions: ModuleAttraction[], alpha: number): void {
  void nodes;
  for (const attraction of attractions) {
    const from = nodeById.get(attraction.from);
    const to = nodeById.get(attraction.to);
    if (!from || !to) {
      continue;
    }
    const dx = to.x - from.x || 0.01;
    const dy = to.y - from.y || 0.01;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force = (distance - attraction.desired) * 0.014 * attraction.weight * alpha;
    const ux = dx / distance;
    const uy = dy / distance;
    from.x += ux * force;
    from.y += uy * force;
    to.x -= ux * force;
    to.y -= uy * force;
  }
}

function applyCollisions(nodes: ModuleLayoutNode[], alpha: number): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (!a || !b) {
        continue;
      }
      const overlapX = (a.w + b.w) / 2 + 18 - Math.abs(a.x - b.x);
      const overlapY = (a.h + b.h) / 2 + 18 - Math.abs(a.y - b.y);
      if (overlapX <= 0 || overlapY <= 0) {
        continue;
      }
      const pushX = overlapX < overlapY;
      const sign = pushX ? Math.sign(a.x - b.x) || 1 : Math.sign(a.y - b.y) || 1;
      const push = (pushX ? overlapX : overlapY) * 0.54 * alpha;
      if (pushX) {
        a.x += sign * push;
        b.x -= sign * push;
      } else {
        a.y += sign * push;
        b.y -= sign * push;
      }
    }
  }
}

function keepNodesInBounds(nodes: ModuleLayoutNode[]): void {
  for (const node of nodes) {
    node.x = clamp(node.x, MAP_PADDING + node.w / 2, MAP_WIDTH - MAP_PADDING - node.w / 2);
    node.y = clamp(node.y, MAP_PADDING + node.h / 2, MAP_HEIGHT - MAP_PADDING - node.h / 2);
  }
}

function rectLayout<T>(item: T, leaf: { x0: number; y0: number; x1: number; y1: number }, offsetX: number, offsetY: number): RectLayout<T> {
  const x0 = offsetX + leaf.x0;
  const y0 = offsetY + leaf.y0;
  const x1 = offsetX + leaf.x1;
  const y1 = offsetY + leaf.y1;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  return {
    item,
    x0,
    y0,
    x1,
    y1,
    x: x0 + w / 2,
    y: y0 + h / 2,
    w,
    h,
    r: Math.hypot(w, h) / 2,
  };
}

function layoutFiles(moduleLeaf: RectLayout<ModuleParcel>, files: ModuleFile[]): Array<RectLayout<ModuleFile>> {
  const width = Math.max(1, moduleLeaf.w - MODULE_PADDING * 2);
  const height = Math.max(1, moduleLeaf.h - MODULE_PADDING * 2 - MODULE_HEADER);
  const root = hierarchy<FileRectDatum>({
    type: "root",
    value: 0,
    children: files.map((file) => ({ type: "file", file, value: Math.max(1, file.loc) })),
  })
    .sum((node) => node.value)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laidOut = treemap<FileRectDatum>()
    .size([width, height])
    .paddingInner(FILE_PADDING)
    .round(true)(root);
  const offsetX = moduleLeaf.x0 + MODULE_PADDING;
  const offsetY = moduleLeaf.y0 + MODULE_PADDING + MODULE_HEADER;
  return laidOut.leaves().flatMap((leaf) => (leaf.data.file ? [rectLayout(leaf.data.file, leaf, offsetX, offsetY)] : []));
}

function layoutSymbols(fileNode: SymbolMapNode, symbols: ModuleSymbol[], stats: Map<string, SymbolStats>): SymbolLayout[] {
  if (!fileNode.w || !fileNode.h || symbols.length === 0) {
    return [];
  }
  const width = Math.max(1, fileNode.w - SYMBOL_PADDING * 2);
  const height = Math.max(1, fileNode.h - SYMBOL_PADDING * 2);
  const left = fileNode.x - fileNode.w / 2 + SYMBOL_PADDING;
  const top = fileNode.y - fileNode.h / 2 + SYMBOL_PADDING;
  const sorted = [...symbols].sort((a, b) => symbolLayoutScore(b, stats) - symbolLayoutScore(a, stats) || a.name.localeCompare(b.name));
  const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length * (width / Math.max(1, height)))));
  const rows = Math.max(1, Math.ceil(sorted.length / columns));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  return sorted.map((symbol, index) => {
    const stat = stats.get(symbol.id);
    const col = index % columns;
    const row = Math.floor(index / columns);
    const baseRadius = 3.6 + Math.sqrt(symbol.loc + (stat?.fanIn ?? 0) * 3 + (stat?.fanOut ?? 0) * 2 + (symbol.exported ? 10 : 0)) * 0.74;
    return {
      symbol,
      x: left + cellWidth * (col + 0.5),
      y: top + cellHeight * (row + 0.5),
      r: clamp(baseRadius, symbol.exported ? 5 : 3.2, Math.max(3.2, Math.min(cellWidth, cellHeight) * 0.34)),
    };
  });
}

function symbolLayoutScore(symbol: ModuleSymbol, stats: Map<string, SymbolStats>): number {
  const stat = stats.get(symbol.id);
  return (symbol.exported ? 1000 : 0) + (stat?.crossModuleFanIn ?? 0) * 500 + (stat?.fanIn ?? 0) * 80 + (stat?.fanOut ?? 0) * 52 + symbol.loc;
}

function moduleNode(module: ModuleParcel, leaf: RectLayout<ModuleParcel>): SymbolMapNode {
  return {
    id: module.id,
    kind: "module",
    moduleId: module.id,
    path: module.path,
    label: module.label,
    loc: module.loc,
    exported: true,
    surface: "exported",
    fanIn: 0,
    fanOut: 0,
    crossModuleFanIn: 0,
    crossModuleFanOut: 0,
    status: module.status,
    x: leaf.x,
    y: leaf.y,
    r: leaf.r,
    w: leaf.w,
    h: leaf.h,
    visibleAtZoom: 0,
  };
}

function fileBoxNode(file: ModuleFile, moduleId: string, leaf: RectLayout<ModuleFile>): SymbolMapNode {
  return {
    id: file.id,
    kind: "file",
    parentId: moduleId,
    moduleId,
    fileId: file.id,
    path: file.path,
    label: file.label,
    layer: file.layer,
    loc: file.loc,
    exported: file.symbols.some((symbol) => symbol.exported),
    surface: "internal",
    fanIn: file.fanIn,
    fanOut: file.fanOut,
    crossModuleFanIn: 0,
    crossModuleFanOut: 0,
    status: file.status,
    x: leaf.x,
    y: leaf.y,
    r: leaf.r,
    w: leaf.w,
    h: leaf.h,
    visibleAtZoom: 1.05,
  };
}

function symbolNode(
  symbol: ModuleSymbol,
  file: ModuleFile,
  moduleId: string,
  fileNode: SymbolMapNode,
  leaf: SymbolLayout,
  stats: SymbolStats = { fanIn: 0, fanOut: 0, crossModuleFanIn: 0, crossModuleFanOut: 0 },
): SymbolMapNode {
  const surface: SymbolSurface = stats.crossModuleFanIn > 0 ? "public" : symbol.exported ? "exported" : "internal";
  const activity = stats.fanIn + stats.fanOut + stats.crossModuleFanIn * 2 + stats.crossModuleFanOut * 2;
  return {
    id: symbol.id,
    kind: "symbol",
    parentId: fileNode.id,
    moduleId,
    fileId: file.id,
    path: file.path,
    label: symbol.label,
    layer: file.layer,
    loc: symbol.loc,
    exported: symbol.exported,
    surface,
    fanIn: stats.fanIn,
    fanOut: stats.fanOut,
    crossModuleFanIn: stats.crossModuleFanIn,
    crossModuleFanOut: stats.crossModuleFanOut,
    status: symbol.status,
    x: leaf.x,
    y: leaf.y,
    r: clamp(leaf.r, surface === "public" ? 5 : 3.2, surface === "public" ? 18 : 13),
    visibleAtZoom: symbolVisibleAtZoom(surface, activity),
  };
}

function symbolVisibleAtZoom(surface: SymbolSurface, activity: number): number {
  if (surface === "public") {
    return 0.48;
  }
  if (surface === "exported") {
    if (activity >= 6) {
      return 1.25;
    }
    if (activity >= 1) {
      return 1.85;
    }
    return 2.7;
  }
  if (activity >= 3) {
    return 3;
  }
  return 4.2;
}

function buildSymbolEdges(
  snapshot: Snapshot,
  moduleByFileId: Map<string, string>,
  visibleSymbolIds: Set<string>,
  symbolById: Map<string, { symbol: ModuleSymbol; file: ModuleFile; module: ModuleParcel }>,
  fileById: Map<string, ModuleFile>,
  diff: BuildSymbolMapOptions["diff"],
): SymbolMapEdge[] {
  const addedEdges = new Set(diff?.addedEdges ?? []);
  const edgeMap = new Map<string, SymbolMapEdge>();
  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || !edge.resolved) {
      continue;
    }
    const fromModuleId = moduleByFileId.get(edge.from);
    const toModuleId = moduleByFileId.get(edge.to);
    if (!fromModuleId || !toModuleId) {
      continue;
    }
    for (const symbolImport of edge.symbolImports ?? []) {
      if (!symbolImport.fromSymbolId || !symbolImport.toSymbolId || !visibleSymbolIds.has(symbolImport.fromSymbolId) || !visibleSymbolIds.has(symbolImport.toSymbolId)) {
        continue;
      }
      const source = symbolById.get(symbolImport.fromSymbolId);
      const target = symbolById.get(symbolImport.toSymbolId);
      const sourceFile = fileById.get(edge.from);
      const targetFile = fileById.get(edge.to);
      if (!source || !target || !sourceFile || !targetFile) {
        continue;
      }
      const id = `symbol-route:${symbolImport.fromSymbolId}->${symbolImport.toSymbolId}`;
      const crossModule = fromModuleId !== toModuleId;
      const current = edgeMap.get(id) ?? {
        id,
        scope: "symbol" as const,
        from: symbolImport.fromSymbolId,
        to: symbolImport.toSymbolId,
        fromModuleId,
        toModuleId,
        importCount: 0,
        crossModule,
        status: "stable" as SymbolMapStatus,
        visibleAtZoom: crossModule ? 0.55 : 3,
      };
      current.importCount += 1;
      if (!crossModule) {
        current.visibleAtZoom = current.importCount >= 3 ? 2.35 : 3;
      }
      if (addedEdges.has(edge.id)) {
        current.status = "added";
      }
      edgeMap.set(id, current);
    }
  }
  return [...edgeMap.values()].sort(
    (a, b) =>
      Number(b.crossModule) - Number(a.crossModule) ||
      b.importCount - a.importCount ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to),
  );
}

function computeBounds(nodes: SymbolMapNode[]): SymbolMapFrame["bounds"] {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return {
    minX: Math.min(...nodes.map((node) => node.x - Math.max(node.r, (node.w ?? 0) / 2))) - 24,
    minY: Math.min(...nodes.map((node) => node.y - Math.max(node.r, (node.h ?? 0) / 2))) - 24,
    maxX: Math.max(...nodes.map((node) => node.x + Math.max(node.r, (node.w ?? 0) / 2))) + 24,
    maxY: Math.max(...nodes.map((node) => node.y + Math.max(node.r, (node.h ?? 0) / 2))) + 24,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const current = groups.get(groupKey) ?? [];
    current.push(item);
    groups.set(groupKey, current);
  }
  return groups;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
