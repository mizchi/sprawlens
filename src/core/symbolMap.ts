import { hierarchy, pack } from "d3-hierarchy";
import type { HierarchyCircularNode } from "d3-hierarchy";
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

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1060;
const MODULE_PADDING = 30;
const FILE_PADDING = 5;
const SYMBOL_PADDING = 2.5;

type ModulePackDatum = {
  type: "root" | "module";
  module?: ModuleParcel;
  value: number;
  children?: ModulePackDatum[];
};

type FilePackDatum = {
  type: "root" | "file";
  file?: ModuleFile;
  value: number;
  children?: FilePackDatum[];
};

type SymbolPackDatum = {
  type: "root" | "symbol";
  symbol?: ModuleSymbol;
  value: number;
  children?: SymbolPackDatum[];
};

type SymbolStats = {
  fanIn: number;
  fanOut: number;
  crossModuleFanIn: number;
  crossModuleFanOut: number;
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
  const moduleLeafById = layoutModules(moduleFrame.modules);
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
      const file = fileLeaf.data.file;
      if (!file) {
        continue;
      }
      const fileNode = fileBoxNode(file, module.id, fileLeaf);
      nodes.push(fileNode);

      const symbols = selectedSymbols.get(file.id) ?? [];
      const symbolLeaves = layoutSymbols(fileNode, symbols, symbolStats);
      for (const symbolLeaf of symbolLeaves) {
        const symbol = symbolLeaf.data.symbol;
        if (!symbol) {
          continue;
        }
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

function layoutModules(modules: ModuleParcel[]): Map<string, HierarchyCircularNode<ModulePackDatum>> {
  const root = hierarchy<ModulePackDatum>({
    type: "root",
    value: 0,
    children: modules.map((module) => ({ type: "module", module, value: Math.max(1, module.loc) })),
  }).sum((node) => node.value);
  const layout = pack<ModulePackDatum>().size([MAP_WIDTH, MAP_HEIGHT]).padding(MODULE_PADDING);
  const packed = layout(root);
  return new Map(packed.leaves().flatMap((leaf) => (leaf.data.module ? [[leaf.data.module.id, leaf] as const] : [])));
}

function layoutFiles(moduleLeaf: HierarchyCircularNode<ModulePackDatum>, files: ModuleFile[]): Array<HierarchyCircularNode<FilePackDatum>> {
  const diameter = Math.max(1, moduleLeaf.r * 1.74);
  const root = hierarchy<FilePackDatum>({
    type: "root",
    value: 0,
    children: files.map((file) => ({ type: "file", file, value: Math.max(1, file.loc) })),
  }).sum((node) => node.value);
  const packed = pack<FilePackDatum>().size([diameter, diameter]).padding(FILE_PADDING)(root);
  return packed.leaves().map((leaf) => {
    leaf.x = moduleLeaf.x - diameter / 2 + leaf.x;
    leaf.y = moduleLeaf.y - diameter / 2 + leaf.y;
    return leaf;
  });
}

function layoutSymbols(fileNode: SymbolMapNode, symbols: ModuleSymbol[], stats: Map<string, SymbolStats>): Array<HierarchyCircularNode<SymbolPackDatum>> {
  if (!fileNode.w || !fileNode.h || symbols.length === 0) {
    return [];
  }
  const root = hierarchy<SymbolPackDatum>({
    type: "root",
    value: 0,
    children: symbols.map((symbol) => {
      const stat = stats.get(symbol.id);
      return {
        type: "symbol",
        symbol,
        value: Math.max(1, symbol.loc + (stat?.fanIn ?? 0) * 3 + (stat?.fanOut ?? 0) * 2 + (symbol.exported ? 8 : 0)),
      };
    }),
  }).sum((node) => node.value);
  const packed = pack<SymbolPackDatum>().size([fileNode.w * 0.86, fileNode.h * 0.86]).padding(SYMBOL_PADDING)(root);
  return packed.leaves().map((leaf) => {
    leaf.x = fileNode.x - (fileNode.w ?? 0) * 0.43 + leaf.x;
    leaf.y = fileNode.y - (fileNode.h ?? 0) * 0.43 + leaf.y;
    return leaf;
  });
}

function moduleNode(module: ModuleParcel, leaf: HierarchyCircularNode<ModulePackDatum>): SymbolMapNode {
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
    visibleAtZoom: 0,
  };
}

function fileBoxNode(file: ModuleFile, moduleId: string, leaf: HierarchyCircularNode<FilePackDatum>): SymbolMapNode {
  const side = Math.max(10, leaf.r * 1.34);
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
    r: Math.SQRT1_2 * side,
    w: side,
    h: side,
    visibleAtZoom: 1.05,
  };
}

function symbolNode(
  symbol: ModuleSymbol,
  file: ModuleFile,
  moduleId: string,
  fileNode: SymbolMapNode,
  leaf: HierarchyCircularNode<SymbolPackDatum>,
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
