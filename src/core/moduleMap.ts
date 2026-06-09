import { computeGraphMetrics } from "./metrics.js";
import type { CodeSymbolKind, FileNode, GraphDiff, ImportsEdge, Snapshot } from "./types.js";

export type CodeLayer = "runtime" | "test" | "tooling" | "asset";
export type ModuleStatus = "stable" | "added" | "changed" | "hotspot";

export type ModuleFile = {
  id: string;
  path: string;
  label: string;
  loc: number;
  layer: CodeLayer;
  status: ModuleStatus;
  fanIn: number;
  fanOut: number;
  inCycle: boolean;
  hotspotScore: number;
  symbols: ModuleSymbol[];
};

export type ModuleSymbol = {
  id: string;
  filePath: string;
  name: string;
  label: string;
  kind: CodeSymbolKind;
  loc: number;
  exported: boolean;
  status: ModuleStatus;
};

export type ModuleParcel = {
  id: string;
  path: string;
  label: string;
  loc: number;
  fileCount: number;
  status: ModuleStatus;
  hotspotScore: number;
  layerCounts: Record<CodeLayer, number>;
  files: ModuleFile[];
};

export type ModuleDependency = {
  id: string;
  from: string;
  to: string;
  importCount: number;
  addedCount: number;
  changed: boolean;
};

export type ModuleMapFrame = {
  schemaVersion: 1;
  commitHash: string;
  modules: ModuleParcel[];
  dependencies: ModuleDependency[];
};

export type BuildModuleMapOptions = {
  diff?: Pick<GraphDiff, "addedNodes" | "addedEdges" | "changedFiles" | "hotspots"> | null;
};

export function buildModuleMapFrame(snapshot: Snapshot, options: BuildModuleMapOptions = {}): ModuleMapFrame {
  const diff = options.diff ?? null;
  const graphMetrics = computeGraphMetrics(snapshot.nodes, snapshot.edges);
  const addedNodeIds = new Set(diff?.addedNodes ?? []);
  const addedEdgeIds = new Set(diff?.addedEdges ?? []);
  const changedPaths = new Set(diff?.changedFiles.map((file) => file.path) ?? []);
  const hotspotByPath = new Map(diff?.hotspots.map((hotspot) => [hotspot.path, hotspot]) ?? []);
  const files = snapshot.nodes.filter((node): node is FileNode => node.type === "file");
  const moduleFiles = new Map<string, ModuleFile[]>();
  const moduleIdByFileId = new Map<string, string>();

  for (const file of files) {
    const modulePath = modulePathForFile(file.path);
    const moduleId = moduleIdForPath(modulePath);
    const metric = graphMetrics.fileMetrics[file.path] ?? { fanIn: 0, fanOut: 0, inCycle: false };
    const moduleFile: ModuleFile = {
      id: file.id,
      path: file.path,
      label: basename(file.path),
      loc: file.loc,
      layer: classifyCodeLayer(file.path),
      status: fileStatus(file.id, file.path, addedNodeIds, changedPaths, hotspotByPath),
      fanIn: metric.fanIn,
      fanOut: metric.fanOut,
      inCycle: metric.inCycle,
      hotspotScore: hotspotByPath.get(file.path)?.score ?? 0,
      symbols: (file.symbols ?? [])
        .map((symbol): ModuleSymbol => ({
          id: symbol.id,
          filePath: file.path,
          name: symbol.name,
          label: symbol.name,
          kind: symbol.kind,
          loc: symbol.loc,
          exported: symbol.exported,
          status: fileStatus(file.id, file.path, addedNodeIds, changedPaths, hotspotByPath),
        }))
        .sort((a, b) => b.loc - a.loc || a.name.localeCompare(b.name)),
    };
    const current = moduleFiles.get(moduleId) ?? [];
    current.push(moduleFile);
    moduleFiles.set(moduleId, current);
    moduleIdByFileId.set(file.id, moduleId);
  }

  const modules = [...moduleFiles.entries()]
    .map(([id, moduleFileList]): ModuleParcel => {
      const sortedFiles = moduleFileList.sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path));
      const loc = sortedFiles.reduce((sum, file) => sum + file.loc, 0);
      const hotspotScore = sortedFiles.reduce((sum, file) => sum + file.hotspotScore, 0);
      const layerCounts = emptyLayerCounts();
      for (const file of sortedFiles) {
        layerCounts[file.layer] += 1;
      }
      return {
        id,
        path: id.slice("module:".length),
        label: moduleLabel(id.slice("module:".length)),
        loc,
        fileCount: sortedFiles.length,
        status: moduleStatus(sortedFiles, hotspotScore),
        hotspotScore,
        layerCounts,
        files: sortedFiles,
      };
    })
    .sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path));

  const dependencyMap = new Map<string, ModuleDependency>();
  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || !edge.resolved) {
      continue;
    }
    const from = moduleIdByFileId.get(edge.from);
    const to = moduleIdByFileId.get(edge.to);
    if (!from || !to || from === to) {
      continue;
    }
    const id = `module-imports:${from}->${to}`;
    const current = dependencyMap.get(id) ?? {
      id,
      from,
      to,
      importCount: 0,
      addedCount: 0,
      changed: false,
    };
    current.importCount += 1;
    if (addedEdgeIds.has(edge.id)) {
      current.addedCount += 1;
      current.changed = true;
    }
    dependencyMap.set(id, current);
  }

  return {
    schemaVersion: 1,
    commitHash: snapshot.commit.hash,
    modules,
    dependencies: [...dependencyMap.values()].sort(
      (a, b) => b.importCount - a.importCount || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
    ),
  };
}

export function moduleIdForFilePath(filePath: string): string {
  return moduleIdForPath(modulePathForFile(filePath));
}

export function modulePathForFile(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length === 0) {
    return ".";
  }
  if ((parts[0] === "packages" || parts[0] === "apps") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  if ((parts[0] === "tests" || parts[0] === "test") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  if ((parts[0] === "src" || parts[0] === "lib") && parts[1]) {
    return parts[0];
  }
  if ((parts[0] === "utils" || parts[0] === "scripts" || parts[0] === "tools") && parts[1]) {
    return parts[0];
  }
  if (parts.length >= 3) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0] ?? ".";
}

export function classifyCodeLayer(filePath: string): CodeLayer {
  const parts = filePath.toLowerCase().split("/");
  const name = parts.at(-1) ?? filePath.toLowerCase();
  if (parts.some((part) => part === "test" || part === "tests" || part === "__tests__") || /[.-](test|spec)\.[cm]?[jt]sx?$/.test(name)) {
    return "test";
  }
  if (parts.some((part) => part === "scripts" || part === "tools" || part === "bin") || /config\.[cm]?[jt]s$/.test(name)) {
    return "tooling";
  }
  if (parts.some((part) => part === "assets" || part === "fixtures" || part === "public")) {
    return "asset";
  }
  return "runtime";
}

function moduleIdForPath(modulePath: string): string {
  return `module:${modulePath}`;
}

function fileStatus(
  id: string,
  filePath: string,
  addedNodeIds: Set<string>,
  changedPaths: Set<string>,
  hotspotByPath: Map<string, { score: number }>,
): ModuleStatus {
  if (hotspotByPath.has(filePath)) {
    return "hotspot";
  }
  if (addedNodeIds.has(id)) {
    return "added";
  }
  if (changedPaths.has(filePath)) {
    return "changed";
  }
  return "stable";
}

function moduleStatus(files: ModuleFile[], hotspotScore: number): ModuleStatus {
  if (hotspotScore > 0 || files.some((file) => file.status === "hotspot")) {
    return "hotspot";
  }
  if (files.length > 0 && files.every((file) => file.status === "added")) {
    return "added";
  }
  if (files.some((file) => file.status === "added" || file.status === "changed")) {
    return "changed";
  }
  return "stable";
}

function emptyLayerCounts(): Record<CodeLayer, number> {
  return {
    runtime: 0,
    test: 0,
    tooling: 0,
    asset: 0,
  };
}

function moduleLabel(modulePath: string): string {
  return modulePath.split("/").at(-1) ?? modulePath;
}

function basename(filePath: string): string {
  return filePath.split("/").at(-1) ?? filePath;
}
