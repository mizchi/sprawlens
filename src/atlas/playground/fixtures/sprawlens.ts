// Generated from .codesprawl snapshot (commit 48d490d).
// Regenerate: npx tsx src/cli/index.ts collect . --commits 1, then
//   node scripts/snapshot-to-fixture.mjs <snapshot.json> sprawlensSnapshot > <out>
import type { SnapshotLike } from "../fixtureAdapter.js";

export const sprawlensSnapshot: SnapshotLike = {
 "nodes": [
  {
   "id": "repo",
   "type": "repo"
  },
  {
   "id": "dir:e2e",
   "type": "dir",
   "path": "e2e"
  },
  {
   "id": "dir:src",
   "type": "dir",
   "path": "src"
  },
  {
   "id": "dir:src/atlas",
   "type": "dir",
   "path": "src/atlas"
  },
  {
   "id": "dir:src/atlas/contracts",
   "type": "dir",
   "path": "src/atlas/contracts"
  },
  {
   "id": "dir:src/atlas/kernel",
   "type": "dir",
   "path": "src/atlas/kernel"
  },
  {
   "id": "dir:src/atlas/playground",
   "type": "dir",
   "path": "src/atlas/playground"
  },
  {
   "id": "dir:src/atlas/server",
   "type": "dir",
   "path": "src/atlas/server"
  },
  {
   "id": "dir:src/cli",
   "type": "dir",
   "path": "src/cli"
  },
  {
   "id": "dir:src/core",
   "type": "dir",
   "path": "src/core"
  },
  {
   "id": "file:e2e/atlas-zoom.spec.ts",
   "type": "file",
   "path": "e2e/atlas-zoom.spec.ts",
   "loc": 97,
   "symbols": [
    {
     "id": "symbol:e2e/atlas-zoom.spec.ts:function:zoomGesture:13",
     "name": "zoomGesture",
     "kind": "function",
     "loc": 8,
     "complexity": 2
    },
    {
     "id": "symbol:e2e/atlas-zoom.spec.ts:function:polygonCount:22",
     "name": "polygonCount",
     "kind": "function",
     "loc": 2,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:playwright.atlas.config.ts",
   "type": "file",
   "path": "playwright.atlas.config.ts",
   "loc": 28
  },
  {
   "id": "file:src/atlas/contracts/delta.test.ts",
   "type": "file",
   "path": "src/atlas/contracts/delta.test.ts",
   "loc": 114,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/delta.test.ts:function:file:10",
     "name": "file",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/contracts/delta.test.ts:function:graph:18",
     "name": "graph",
     "kind": "function",
     "loc": 4,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/delta.ts",
   "type": "file",
   "path": "src/atlas/contracts/delta.ts",
   "loc": 124,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/delta.ts:type:GraphDelta:15",
     "name": "GraphDelta",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/delta.ts:function:edgeKey:24",
     "name": "edgeKey",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/contracts/delta.ts:function:nodeChanged:29",
     "name": "nodeChanged",
     "kind": "function",
     "loc": 8,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/contracts/delta.ts:function:diffGraphs:42",
     "name": "diffGraphs",
     "kind": "function",
     "loc": 42,
     "complexity": 11,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/delta.ts:function:isEmptyDelta:85",
     "name": "isEmptyDelta",
     "kind": "function",
     "loc": 9,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/delta.ts:function:affectedGroups:103",
     "name": "affectedGroups",
     "kind": "function",
     "loc": 22,
     "complexity": 7,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/detail.ts",
   "type": "file",
   "path": "src/atlas/contracts/detail.ts",
   "loc": 55,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/detail.ts:type:DetailKind:12",
     "name": "DetailKind",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/detail.ts:type:DetailRequest:14",
     "name": "DetailRequest",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/detail.ts:type:DetailGraph:28",
     "name": "DetailGraph",
     "kind": "type",
     "loc": 23,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/detail.ts:type:DetailProvider:53",
     "name": "DetailProvider",
     "kind": "type",
     "loc": 3,
     "complexity": 1,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/graph.test.ts",
   "type": "file",
   "path": "src/atlas/contracts/graph.test.ts",
   "loc": 17
  },
  {
   "id": "file:src/atlas/contracts/graph.ts",
   "type": "file",
   "path": "src/atlas/contracts/graph.ts",
   "loc": 79,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:AtlasNodeKind:11",
     "name": "AtlasNodeKind",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:AtlasNodeMetrics:20",
     "name": "AtlasNodeMetrics",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:SymbolKind:29",
     "name": "SymbolKind",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37",
     "name": "AtlasNode",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdgeKind:54",
     "name": "AtlasEdgeKind",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56",
     "name": "AtlasEdge",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67",
     "name": "AtlasGraph",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:type:WeightScorer:76",
     "name": "WeightScorer",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/graph.ts:function:locScorer:78",
     "name": "locScorer",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/hierarchy.test.ts",
   "type": "file",
   "path": "src/atlas/contracts/hierarchy.test.ts",
   "loc": 282,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/hierarchy.test.ts:function:fileGraph:13",
     "name": "fileGraph",
     "kind": "function",
     "loc": 23,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/hierarchy.ts",
   "type": "file",
   "path": "src/atlas/contracts/hierarchy.ts",
   "loc": 296,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:type:Grouping:19",
     "name": "Grouping",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:type:HierarchyLevel:26",
     "name": "HierarchyLevel",
     "kind": "type",
     "loc": 12,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:type:LevelTree:39",
     "name": "LevelTree",
     "kind": "type",
     "loc": 17,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:type:DeriveLevelsOptions:57",
     "name": "DeriveLevelsOptions",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:deriveLevels:72",
     "name": "deriveLevels",
     "kind": "function",
     "loc": 163,
     "complexity": 48,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:ancestorAt:241",
     "name": "ancestorAt",
     "kind": "function",
     "loc": 13,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:parentFileOf:256",
     "name": "parentFileOf",
     "kind": "function",
     "loc": 5,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263",
     "name": "moduleGrouping",
     "kind": "function",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:directoryGrouping:270",
     "name": "directoryGrouping",
     "kind": "function",
     "loc": 11,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:fileGrouping:283",
     "name": "fileGrouping",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/hierarchy.ts:function:serviceGrouping:292",
     "name": "serviceGrouping",
     "kind": "function",
     "loc": 5,
     "complexity": 1,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/layers.test.ts",
   "type": "file",
   "path": "src/atlas/contracts/layers.test.ts",
   "loc": 77,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/layers.test.ts:function:fileNode:5",
     "name": "fileNode",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/layers.ts",
   "type": "file",
   "path": "src/atlas/contracts/layers.ts",
   "loc": 85,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/layers.ts:type:LayerOf:7",
     "name": "LayerOf",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/layers.ts:function:defaultLayerOf:11",
     "name": "defaultLayerOf",
     "kind": "function",
     "loc": 2,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/layers.ts:type:LayerSplit:14",
     "name": "LayerSplit",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/layers.ts:function:splitByLayer:21",
     "name": "splitByLayer",
     "kind": "function",
     "loc": 21,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/layers.ts:function:matchTestTargets:48",
     "name": "matchTestTargets",
     "kind": "function",
     "loc": 38,
     "complexity": 13,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/modules.test.ts",
   "type": "file",
   "path": "src/atlas/contracts/modules.test.ts",
   "loc": 82,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/modules.test.ts:function:fileNode:5",
     "name": "fileNode",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/modules.ts",
   "type": "file",
   "path": "src/atlas/contracts/modules.ts",
   "loc": 80,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/modules.ts:type:ModuleIdOf:9",
     "name": "ModuleIdOf",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/modules.ts:function:defaultModuleIdOf:14",
     "name": "defaultModuleIdOf",
     "kind": "function",
     "loc": 8,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/modules.ts:type:ModuleGraph:23",
     "name": "ModuleGraph",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/modules.ts:function:deriveModules:32",
     "name": "deriveModules",
     "kind": "function",
     "loc": 49,
     "complexity": 9,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/overlay.test.ts",
   "type": "file",
   "path": "src/atlas/contracts/overlay.test.ts",
   "loc": 72,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/overlay.test.ts:function:moduleOf:4",
     "name": "moduleOf",
     "kind": "function",
     "loc": 6,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/contracts/overlay.ts",
   "type": "file",
   "path": "src/atlas/contracts/overlay.ts",
   "loc": 60,
   "symbols": [
    {
     "id": "symbol:src/atlas/contracts/overlay.ts:type:FlowStep:9",
     "name": "FlowStep",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/overlay.ts:type:FlowOverlay:15",
     "name": "FlowOverlay",
     "kind": "type",
     "loc": 15,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/contracts/overlay.ts:function:liftOverlay:38",
     "name": "liftOverlay",
     "kind": "function",
     "loc": 23,
     "complexity": 9,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/assignment.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/assignment.test.ts",
   "loc": 66
  },
  {
   "id": "file:src/atlas/kernel/assignment.ts",
   "type": "file",
   "path": "src/atlas/kernel/assignment.ts",
   "loc": 63,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/assignment.ts:function:minCostAssignment:12",
     "name": "minCostAssignment",
     "kind": "function",
     "loc": 52,
     "complexity": 13,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/bundling.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/bundling.test.ts",
   "loc": 87
  },
  {
   "id": "file:src/atlas/kernel/bundling.ts",
   "type": "file",
   "path": "src/atlas/kernel/bundling.ts",
   "loc": 81,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/bundling.ts:function:hierarchyControlPoints:17",
     "name": "hierarchyControlPoints",
     "kind": "function",
     "loc": 44,
     "complexity": 15,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/bundling.ts:function:bundlePath:67",
     "name": "bundlePath",
     "kind": "function",
     "loc": 15,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/capacityLayout.bench.ts",
   "type": "file",
   "path": "src/atlas/kernel/capacityLayout.bench.ts",
   "loc": 59,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.bench.ts:function:nodes:14",
     "name": "nodes",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.bench.ts:function:mesh:42",
     "name": "mesh",
     "kind": "function",
     "loc": 9,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/capacityLayout.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/capacityLayout.test.ts",
   "loc": 261,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.test.ts:function:syntheticNodes:16",
     "name": "syntheticNodes",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.test.ts:function:runUntil:24",
     "name": "runUntil",
     "kind": "function",
     "loc": 24,
     "complexity": 5
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/capacityLayout.ts",
   "type": "file",
   "path": "src/atlas/kernel/capacityLayout.ts",
   "loc": 393,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellInputNode:19",
     "name": "CellInputNode",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityOptions:26",
     "name": "CapacityOptions",
     "kind": "type",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38",
     "name": "CellResult",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:type:SiteState:47",
     "name": "SiteState",
     "kind": "type",
     "loc": 4,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52",
     "name": "CapacityLayoutState",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:mergeOptions:72",
     "name": "mergeOptions",
     "kind": "function",
     "loc": 12,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:separateCoincident:86",
     "name": "separateCoincident",
     "kind": "function",
     "loc": 18,
     "complexity": 5
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:flooredWeights:105",
     "name": "flooredWeights",
     "kind": "function",
     "loc": 5,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:computeCells:111",
     "name": "computeCells",
     "kind": "function",
     "loc": 21,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:buildState:133",
     "name": "buildState",
     "kind": "function",
     "loc": 19,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:assignTargets:153",
     "name": "assignTargets",
     "kind": "function",
     "loc": 10,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164",
     "name": "createCapacityLayout",
     "kind": "function",
     "loc": 31,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:adaptWeights:196",
     "name": "adaptWeights",
     "kind": "function",
     "loc": 66,
     "complexity": 18
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263",
     "name": "capacityStep",
     "kind": "function",
     "loc": 47,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311",
     "name": "isConverged",
     "kind": "function",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:type:GraphChanges:318",
     "name": "GraphChanges",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/capacityLayout.ts:function:applyGraphChanges:329",
     "name": "applyGraphChanges",
     "kind": "function",
     "loc": 65,
     "complexity": 12,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/centrality.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/centrality.test.ts",
   "loc": 101
  },
  {
   "id": "file:src/atlas/kernel/centrality.ts",
   "type": "file",
   "path": "src/atlas/kernel/centrality.ts",
   "loc": 94,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/centrality.ts:function:dependentWeights:13",
     "name": "dependentWeights",
     "kind": "function",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/centrality.ts:function:importanceScore:31",
     "name": "importanceScore",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/centrality.ts:type:CentralityModule:35",
     "name": "CentralityModule",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/centrality.ts:type:CentralityRingsOptions:43",
     "name": "CentralityRingsOptions",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/centrality.ts:function:centralityRings:57",
     "name": "centralityRings",
     "kind": "function",
     "loc": 38,
     "complexity": 10,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/cfgLayout.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/cfgLayout.test.ts",
   "loc": 126,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/cfgLayout.test.ts:function:block:5",
     "name": "block",
     "kind": "function",
     "loc": 6,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/cfgLayout.test.ts:function:flow:11",
     "name": "flow",
     "kind": "function",
     "loc": 5,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/cfgLayout.ts",
   "type": "file",
   "path": "src/atlas/kernel/cfgLayout.ts",
   "loc": 155,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/cfgLayout.ts:type:CfgLayout:12",
     "name": "CfgLayout",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/cfgLayout.ts:type:CfgLayoutOptions:22",
     "name": "CfgLayoutOptions",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/cfgLayout.ts:function:layoutCfg:32",
     "name": "layoutCfg",
     "kind": "function",
     "loc": 124,
     "complexity": 33,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/clip.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/clip.test.ts",
   "loc": 61,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/clip.test.ts:function:insideTriangle:20",
     "name": "insideTriangle",
     "kind": "function",
     "loc": 5,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/clip.ts",
   "type": "file",
   "path": "src/atlas/kernel/clip.ts",
   "loc": 132,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/clip.ts:type:ClipRegion:10",
     "name": "ClipRegion",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/clip.ts:function:clipToRing:16",
     "name": "clipToRing",
     "kind": "function",
     "loc": 12,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/clip.ts:function:insideConvex:29",
     "name": "insideConvex",
     "kind": "function",
     "loc": 9,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/kernel/clip.ts:function:randomPointIn:39",
     "name": "randomPointIn",
     "kind": "function",
     "loc": 43,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/clip.ts:function:clampInto:83",
     "name": "clampInto",
     "kind": "function",
     "loc": 24,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/clip.ts:function:clipScale:108",
     "name": "clipScale",
     "kind": "function",
     "loc": 17,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/clip.ts:function:clipCenter:126",
     "name": "clipCenter",
     "kind": "function",
     "loc": 7,
     "complexity": 3,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/embed.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/embed.test.ts",
   "loc": 207,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/embed.test.ts:function:clique:5",
     "name": "clique",
     "kind": "function",
     "loc": 13,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/kernel/embed.test.ts:function:dist:19",
     "name": "dist",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/embed.test.ts:function:meanPairDist:23",
     "name": "meanPairDist",
     "kind": "function",
     "loc": 12,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/kernel/embed.test.ts:function:twoClusters:37",
     "name": "twoClusters",
     "kind": "function",
     "loc": 10,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/embed.ts",
   "type": "file",
   "path": "src/atlas/kernel/embed.ts",
   "loc": 415,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/embed.ts:type:EmbedEdge:15",
     "name": "EmbedEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:type:EmbedOptions:17",
     "name": "EmbedOptions",
     "kind": "type",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:function:embedGraph:31",
     "name": "embedGraph",
     "kind": "function",
     "loc": 139,
     "complexity": 35,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:function:procrustesAlign:177",
     "name": "procrustesAlign",
     "kind": "function",
     "loc": 63,
     "complexity": 10,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:function:bfsAllPairs:242",
     "name": "bfsAllPairs",
     "kind": "function",
     "loc": 27,
     "complexity": 8
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:function:affinities:271",
     "name": "affinities",
     "kind": "function",
     "loc": 55,
     "complexity": 17
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:function:classicalMds:332",
     "name": "classicalMds",
     "kind": "function",
     "loc": 65,
     "complexity": 16
    },
    {
     "id": "symbol:src/atlas/kernel/embed.ts:function:neighborMean:398",
     "name": "neighborMean",
     "kind": "function",
     "loc": 18,
     "complexity": 4
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/forceLayout.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/forceLayout.test.ts",
   "loc": 180,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/forceLayout.test.ts:function:clusteredGraph:13",
     "name": "clusteredGraph",
     "kind": "function",
     "loc": 23,
     "complexity": 6
    },
    {
     "id": "symbol:src/atlas/kernel/forceLayout.test.ts:function:run:37",
     "name": "run",
     "kind": "function",
     "loc": 5,
     "complexity": 2
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/forceLayout.ts",
   "type": "file",
   "path": "src/atlas/kernel/forceLayout.ts",
   "loc": 195,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/forceLayout.ts:type:ForceInputNode:12",
     "name": "ForceInputNode",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/forceLayout.ts:type:ForceInputEdge:13",
     "name": "ForceInputEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/forceLayout.ts:type:ForceOptions:15",
     "name": "ForceOptions",
     "kind": "type",
     "loc": 17,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/forceLayout.ts:type:ForceLayoutState:33",
     "name": "ForceLayoutState",
     "kind": "type",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/forceLayout.ts:function:createForceLayout:53",
     "name": "createForceLayout",
     "kind": "function",
     "loc": 54,
     "complexity": 13,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/forceLayout.ts:function:forceStep:108",
     "name": "forceStep",
     "kind": "function",
     "loc": 88,
     "complexity": 16,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/geojson.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/geojson.test.ts",
   "loc": 45
  },
  {
   "id": "file:src/atlas/kernel/geojson.ts",
   "type": "file",
   "path": "src/atlas/kernel/geojson.ts",
   "loc": 49,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/geojson.ts:type:CellFeatureProperties:8",
     "name": "CellFeatureProperties",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/geojson.ts:type:CellFeature:17",
     "name": "CellFeature",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/geojson.ts:type:CellFeatureCollection:23",
     "name": "CellFeatureCollection",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/geojson.ts:function:cellsToFeatureCollection:28",
     "name": "cellsToFeatureCollection",
     "kind": "function",
     "loc": 22,
     "complexity": 3,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/louvain.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/louvain.test.ts",
   "loc": 132,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/louvain.test.ts:function:clique:4",
     "name": "clique",
     "kind": "function",
     "loc": 13,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.test.ts:function:communitySets:18",
     "name": "communitySets",
     "kind": "function",
     "loc": 9,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/louvain.ts",
   "type": "file",
   "path": "src/atlas/kernel/louvain.ts",
   "loc": 166,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:type:LouvainEdge:9",
     "name": "LouvainEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:type:LouvainOptions:11",
     "name": "LouvainOptions",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:type:LouvainResult:16",
     "name": "LouvainResult",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:type:WorkGraph:23",
     "name": "WorkGraph",
     "kind": "type",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:function:louvain:31",
     "name": "louvain",
     "kind": "function",
     "loc": 42,
     "complexity": 13,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:function:buildGraph:74",
     "name": "buildGraph",
     "kind": "function",
     "loc": 28,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:function:onePass:104",
     "name": "onePass",
     "kind": "function",
     "loc": 40,
     "complexity": 14
    },
    {
     "id": "symbol:src/atlas/kernel/louvain.ts:function:aggregate:146",
     "name": "aggregate",
     "kind": "function",
     "loc": 21,
     "complexity": 5
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/neighborhood.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/neighborhood.test.ts",
   "loc": 136
  },
  {
   "id": "file:src/atlas/kernel/neighborhood.ts",
   "type": "file",
   "path": "src/atlas/kernel/neighborhood.ts",
   "loc": 113,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/neighborhood.ts:function:cellAdjacency:14",
     "name": "cellAdjacency",
     "kind": "function",
     "loc": 17,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/neighborhood.ts:function:realizedEdgeRate:37",
     "name": "realizedEdgeRate",
     "kind": "function",
     "loc": 15,
     "complexity": 7,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/neighborhood.ts:function:greedySwapAssignment:59",
     "name": "greedySwapAssignment",
     "kind": "function",
     "loc": 55,
     "complexity": 17,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/pipeline.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/pipeline.test.ts",
   "loc": 155,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/pipeline.test.ts:function:sampleGraph:8",
     "name": "sampleGraph",
     "kind": "function",
     "loc": 16,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/pipeline.ts",
   "type": "file",
   "path": "src/atlas/kernel/pipeline.ts",
   "loc": 124,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/pipeline.ts:type:GraphLayoutOptions:12",
     "name": "GraphLayoutOptions",
     "kind": "type",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/pipeline.ts:function:embedIterationsFor:28",
     "name": "embedIterationsFor",
     "kind": "function",
     "loc": 7,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/pipeline.ts:function:forceIterationsFor:41",
     "name": "forceIterationsFor",
     "kind": "function",
     "loc": 7,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/pipeline.ts:function:embedSeedHints:57",
     "name": "embedSeedHints",
     "kind": "function",
     "loc": 13,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/pipeline.ts:function:mapToClip:73",
     "name": "mapToClip",
     "kind": "function",
     "loc": 15,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/kernel/pipeline.ts:function:createGraphLayout:93",
     "name": "createGraphLayout",
     "kind": "function",
     "loc": 32,
     "complexity": 6,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/polygon.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/polygon.test.ts",
   "loc": 155
  },
  {
   "id": "file:src/atlas/kernel/polygon.ts",
   "type": "file",
   "path": "src/atlas/kernel/polygon.ts",
   "loc": 173,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4",
     "name": "Ring",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:type:Circle:6",
     "name": "Circle",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:signedArea:8",
     "name": "signedArea",
     "kind": "function",
     "loc": 10,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19",
     "name": "centroid",
     "kind": "function",
     "loc": 23,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:clipHalfPlane:47",
     "name": "clipHalfPlane",
     "kind": "function",
     "loc": 26,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:containsPoint:75",
     "name": "containsPoint",
     "kind": "function",
     "loc": 11,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:circleToPolygon:87",
     "name": "circleToPolygon",
     "kind": "function",
     "loc": 11,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:nearestPointInRing:104",
     "name": "nearestPointInRing",
     "kind": "function",
     "loc": 34,
     "complexity": 8,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/polygon.ts:function:convexHull:144",
     "name": "convexHull",
     "kind": "function",
     "loc": 30,
     "complexity": 9,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/powerDiagram.bench.ts",
   "type": "file",
   "path": "src/atlas/kernel/powerDiagram.bench.ts",
   "loc": 34,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.bench.ts:function:sites:16",
     "name": "sites",
     "kind": "function",
     "loc": 10,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/powerDiagram.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/powerDiagram.test.ts",
   "loc": 301,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.test.ts:function:powerDistance:14",
     "name": "powerDistance",
     "kind": "function",
     "loc": 5,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.test.ts:function:insideConvex:21",
     "name": "insideConvex",
     "kind": "function",
     "loc": 9,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.test.ts:function:randomSites:31",
     "name": "randomSites",
     "kind": "function",
     "loc": 9,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/powerDiagram.ts",
   "type": "file",
   "path": "src/atlas/kernel/powerDiagram.ts",
   "loc": 263,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:type:PowerSite:5",
     "name": "PowerSite",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:type:CellEdge:13",
     "name": "CellEdge",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:type:PowerCell:20",
     "name": "PowerCell",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:type:LabeledVertex:30",
     "name": "LabeledVertex",
     "kind": "type",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:function:clipLabeled:37",
     "name": "clipLabeled",
     "kind": "function",
     "loc": 37,
     "complexity": 10
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:function:clipAgainst:85",
     "name": "clipAgainst",
     "kind": "function",
     "loc": 39,
     "complexity": 8
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:function:cellOf:125",
     "name": "cellOf",
     "kind": "function",
     "loc": 20,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:function:computePowerDiagram:146",
     "name": "computePowerDiagram",
     "kind": "function",
     "loc": 25,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:function:computePowerDiagramGrid:181",
     "name": "computePowerDiagramGrid",
     "kind": "function",
     "loc": 72,
     "complexity": 27
    },
    {
     "id": "symbol:src/atlas/kernel/powerDiagram.ts:function:maxVertexDistance2:254",
     "name": "maxVertexDistance2",
     "kind": "function",
     "loc": 10,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/reach.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/reach.test.ts",
   "loc": 59
  },
  {
   "id": "file:src/atlas/kernel/reach.ts",
   "type": "file",
   "path": "src/atlas/kernel/reach.ts",
   "loc": 64,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/reach.ts:type:ReachEdge:1",
     "name": "ReachEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/reach.ts:type:ReachResult:3",
     "name": "ReachResult",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/reach.ts:function:reachSubgraph:19",
     "name": "reachSubgraph",
     "kind": "function",
     "loc": 46,
     "complexity": 8,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/ringLayout.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/ringLayout.test.ts",
   "loc": 95,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/ringLayout.test.ts:function:modulesFixture:5",
     "name": "modulesFixture",
     "kind": "function",
     "loc": 9,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/ringLayout.ts",
   "type": "file",
   "path": "src/atlas/kernel/ringLayout.ts",
   "loc": 168,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/ringLayout.ts:type:RingModule:1",
     "name": "RingModule",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/ringLayout.ts:type:RingEdge:9",
     "name": "RingEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/ringLayout.ts:type:RingOptions:11",
     "name": "RingOptions",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/ringLayout.ts:type:PlacedCircle:18",
     "name": "PlacedCircle",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/ringLayout.ts:type:RingLayoutResult:20",
     "name": "RingLayoutResult",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/ringLayout.ts:function:ringLayout:31",
     "name": "ringLayout",
     "kind": "function",
     "loc": 138,
     "complexity": 29,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/ringOrder.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/ringOrder.test.ts",
   "loc": 102,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/ringOrder.test.ts:function:linearCrossings:4",
     "name": "linearCrossings",
     "kind": "function",
     "loc": 11,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/kernel/ringOrder.test.ts:function:crossings:21",
     "name": "crossings",
     "kind": "function",
     "loc": 21,
     "complexity": 7
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/ringOrder.ts",
   "type": "file",
   "path": "src/atlas/kernel/ringOrder.ts",
   "loc": 92,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/ringOrder.ts:type:OrderEdge:1",
     "name": "OrderEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/ringOrder.ts:function:barycentricRingOrder:16",
     "name": "barycentricRingOrder",
     "kind": "function",
     "loc": 77,
     "complexity": 24,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/rng.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/rng.test.ts",
   "loc": 27
  },
  {
   "id": "file:src/atlas/kernel/rng.ts",
   "type": "file",
   "path": "src/atlas/kernel/rng.ts",
   "loc": 13,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/rng.ts:type:Rng:1",
     "name": "Rng",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/rng.ts:function:createRng:4",
     "name": "createRng",
     "kind": "function",
     "loc": 10,
     "complexity": 1,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/scc.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/scc.test.ts",
   "loc": 175
  },
  {
   "id": "file:src/atlas/kernel/scc.ts",
   "type": "file",
   "path": "src/atlas/kernel/scc.ts",
   "loc": 171,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/scc.ts:type:SccEdge:7",
     "name": "SccEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/scc.ts:type:SccResult:9",
     "name": "SccResult",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/scc.ts:function:edgeKey:15",
     "name": "edgeKey",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/scc.ts:function:stronglyConnectedComponents:19",
     "name": "stronglyConnectedComponents",
     "kind": "function",
     "loc": 70,
     "complexity": 13,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/scc.ts:function:cyclicComponents:94",
     "name": "cyclicComponents",
     "kind": "function",
     "loc": 16,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/scc.ts:function:feedbackEdges:117",
     "name": "feedbackEdges",
     "kind": "function",
     "loc": 41,
     "complexity": 8,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/scc.ts:function:buildAdjacency:159",
     "name": "buildAdjacency",
     "kind": "function",
     "loc": 13,
     "complexity": 5
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/topoRank.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/topoRank.test.ts",
   "loc": 73
  },
  {
   "id": "file:src/atlas/kernel/topoRank.ts",
   "type": "file",
   "path": "src/atlas/kernel/topoRank.ts",
   "loc": 47,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/topoRank.ts:type:RankEdge:3",
     "name": "RankEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/topoRank.ts:function:topoRank:11",
     "name": "topoRank",
     "kind": "function",
     "loc": 37,
     "complexity": 9,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/transitiveWeight.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/transitiveWeight.test.ts",
   "loc": 86,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/transitiveWeight.test.ts:function:ids:4",
     "name": "ids",
     "kind": "function",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/kernel/transitiveWeight.test.ts:function:one:5",
     "name": "one",
     "kind": "function",
     "loc": 1,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/transitiveWeight.ts",
   "type": "file",
   "path": "src/atlas/kernel/transitiveWeight.ts",
   "loc": 100,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/transitiveWeight.ts:function:transitiveWeights:13",
     "name": "transitiveWeights",
     "kind": "function",
     "loc": 88,
     "complexity": 23,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/kernel/vec.test.ts",
   "type": "file",
   "path": "src/atlas/kernel/vec.test.ts",
   "loc": 19
  },
  {
   "id": "file:src/atlas/kernel/vec.ts",
   "type": "file",
   "path": "src/atlas/kernel/vec.ts",
   "loc": 25,
   "symbols": [
    {
     "id": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1",
     "name": "Vec2",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/vec.ts:function:add:3",
     "name": "add",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/vec.ts:function:sub:7",
     "name": "sub",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/vec.ts:function:scale:11",
     "name": "scale",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/vec.ts:function:dot:15",
     "name": "dot",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/vec.ts:function:lengthOf:19",
     "name": "lengthOf",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/kernel/vec.ts:function:distance:23",
     "name": "distance",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/App.tsx",
   "type": "file",
   "path": "src/atlas/playground/App.tsx",
   "loc": 2398,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/App.tsx:function:scopeOf:122",
     "name": "scopeOf",
     "kind": "function",
     "loc": 5,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/App.tsx:function:insetRing:134",
     "name": "insetRing",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/App.tsx:function:Section:143",
     "name": "Section",
     "kind": "function",
     "loc": 38,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/App.tsx:type:PanelPosition:182",
     "name": "PanelPosition",
     "kind": "type",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/App.tsx:function:App:184",
     "name": "App",
     "kind": "function",
     "loc": 2215,
     "complexity": 402,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/CfgLayer.tsx",
   "type": "file",
   "path": "src/atlas/playground/CfgLayer.tsx",
   "loc": 485,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgEntry:21",
     "name": "CfgEntry",
     "kind": "type",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:entryFill:45",
     "name": "entryFill",
     "kind": "function",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:exitFill:46",
     "name": "exitFill",
     "kind": "function",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:edgeStroke:47",
     "name": "edgeStroke",
     "kind": "function",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:variable:CFG_ARROW_ID:52",
     "name": "CFG_ARROW_ID",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:points:54",
     "name": "points",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:slabAt:59",
     "name": "slabAt",
     "kind": "function",
     "loc": 18,
     "complexity": 5
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:CfgShape:79",
     "name": "CfgShape",
     "kind": "function",
     "loc": 106,
     "complexity": 10
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgGeometry:186",
     "name": "CfgGeometry",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:cfgGeometry:195",
     "name": "cfgGeometry",
     "kind": "function",
     "loc": 39,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgAnchor:235",
     "name": "CfgAnchor",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:cfgAnchorsOf:243",
     "name": "cfgAnchorsOf",
     "kind": "function",
     "loc": 20,
     "complexity": 8,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:type:ViewRect:264",
     "name": "ViewRect",
     "kind": "type",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:CfgGlyph:266",
     "name": "CfgGlyph",
     "kind": "function",
     "loc": 184,
     "complexity": 27
    },
    {
     "id": "symbol:src/atlas/playground/CfgLayer.tsx:function:CfgLayer:451",
     "name": "CfgLayer",
     "kind": "function",
     "loc": 35,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/Controls.tsx",
   "type": "file",
   "path": "src/atlas/playground/Controls.tsx",
   "loc": 335,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/Controls.tsx:type:DataSource:17",
     "name": "DataSource",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/Controls.tsx:type:LayoutKind:22",
     "name": "LayoutKind",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/Controls.tsx:type:PlaygroundParams:24",
     "name": "PlaygroundParams",
     "kind": "type",
     "loc": 18,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/Controls.tsx:type:Props:43",
     "name": "Props",
     "kind": "type",
     "loc": 12,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/Controls.tsx:function:Controls:76",
     "name": "Controls",
     "kind": "function",
     "loc": 260,
     "complexity": 14,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/RingsMapSvg.tsx",
   "type": "file",
   "path": "src/atlas/playground/RingsMapSvg.tsx",
   "loc": 1300,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/RingsMapSvg.tsx:type:Props:64",
     "name": "Props",
     "kind": "type",
     "loc": 56,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/RingsMapSvg.tsx:function:fallbackLabel:123",
     "name": "fallbackLabel",
     "kind": "function",
     "loc": 7,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/playground/RingsMapSvg.tsx:function:RingsMapSvg:152",
     "name": "RingsMapSvg",
     "kind": "function",
     "loc": 1149,
     "complexity": 222,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/TreemapSvg.tsx",
   "type": "file",
   "path": "src/atlas/playground/TreemapSvg.tsx",
   "loc": 710,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/TreemapSvg.tsx:type:Props:52",
     "name": "Props",
     "kind": "type",
     "loc": 43,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/TreemapSvg.tsx:function:TreemapSvg:103",
     "name": "TreemapSvg",
     "kind": "function",
     "loc": 608,
     "complexity": 115,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/apiView.test.ts",
   "type": "file",
   "path": "src/atlas/playground/apiView.test.ts",
   "loc": 248,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/apiView.test.ts:function:sym:33",
     "name": "sym",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/apiView.ts",
   "type": "file",
   "path": "src/atlas/playground/apiView.ts",
   "loc": 190,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/apiView.ts:function:apiModuleIdOf:16",
     "name": "apiModuleIdOf",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:type:ApiBoundarySplit:20",
     "name": "ApiBoundarySplit",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:function:splitApiBoundary:36",
     "name": "splitApiBoundary",
     "kind": "function",
     "loc": 41,
     "complexity": 10,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:type:ApiGraphOptions:78",
     "name": "ApiGraphOptions",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:function:moduleScopeId:86",
     "name": "moduleScopeId",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:function:buildApiGraph:90",
     "name": "buildApiGraph",
     "kind": "function",
     "loc": 57,
     "complexity": 15,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:type:SymbolBudget:148",
     "name": "SymbolBudget",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/apiView.ts:function:applySymbolBudget:162",
     "name": "applySymbolBudget",
     "kind": "function",
     "loc": 29,
     "complexity": 5,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/build.bench.ts",
   "type": "file",
   "path": "src/atlas/playground/build.bench.ts",
   "loc": 35,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/build.bench.ts:function:playwrightGraph:18",
     "name": "playwrightGraph",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/callHierarchyClient.test.ts",
   "type": "file",
   "path": "src/atlas/playground/callHierarchyClient.test.ts",
   "loc": 75
  },
  {
   "id": "file:src/atlas/playground/callHierarchyClient.ts",
   "type": "file",
   "path": "src/atlas/playground/callHierarchyClient.ts",
   "loc": 72,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/callHierarchyClient.ts:type:SymbolRef:4",
     "name": "SymbolRef",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/callHierarchyClient.ts:type:CallHierarchyResponse:6",
     "name": "CallHierarchyResponse",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/callHierarchyClient.ts:function:startLineOf:12",
     "name": "startLineOf",
     "kind": "function",
     "loc": 4,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/callHierarchyClient.ts:function:resolveRef:21",
     "name": "resolveRef",
     "kind": "function",
     "loc": 19,
     "complexity": 8,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/callHierarchyClient.ts:function:refsToEdges:42",
     "name": "refsToEdges",
     "kind": "function",
     "loc": 17,
     "complexity": 7,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/callHierarchyClient.ts:function:fetchCallHierarchy:60",
     "name": "fetchCallHierarchy",
     "kind": "function",
     "loc": 13,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/cfgClient.ts",
   "type": "file",
   "path": "src/atlas/playground/cfgClient.ts",
   "loc": 44,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/cfgClient.ts:function:cfgRequestOf:11",
     "name": "cfgRequestOf",
     "kind": "function",
     "loc": 9,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/cfgClient.ts:function:symbolNameOf:22",
     "name": "symbolNameOf",
     "kind": "function",
     "loc": 5,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/cfgClient.ts:function:fetchCfg:28",
     "name": "fetchCfg",
     "kind": "function",
     "loc": 17,
     "complexity": 3,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/edgePick.test.ts",
   "type": "file",
   "path": "src/atlas/playground/edgePick.test.ts",
   "loc": 98
  },
  {
   "id": "file:src/atlas/playground/edgePick.ts",
   "type": "file",
   "path": "src/atlas/playground/edgePick.ts",
   "loc": 105,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:function:distance2ToSegment:4",
     "name": "distance2ToSegment",
     "kind": "function",
     "loc": 15,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:function:distanceToPolyline:21",
     "name": "distanceToPolyline",
     "kind": "function",
     "loc": 10,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:type:EdgePickCandidate:32",
     "name": "EdgePickCandidate",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:type:EdgePick:38",
     "name": "EdgePick",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_PX:43",
     "name": "EDGE_PICK_PX",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_NODE_PX:47",
     "name": "EDGE_PICK_NODE_PX",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_DOMINANCE:54",
     "name": "EDGE_PICK_DOMINANCE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:function:pickNearestEdge:64",
     "name": "pickNearestEdge",
     "kind": "function",
     "loc": 24,
     "complexity": 7,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/edgePick.ts:function:pickEdgeAtPoint:95",
     "name": "pickEdgeAtPoint",
     "kind": "function",
     "loc": 11,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/fixtureAdapter.test.ts",
   "type": "file",
   "path": "src/atlas/playground/fixtureAdapter.test.ts",
   "loc": 149
  },
  {
   "id": "file:src/atlas/playground/fixtureAdapter.ts",
   "type": "file",
   "path": "src/atlas/playground/fixtureAdapter.ts",
   "loc": 182,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:function:isSymbolKind:16",
     "name": "isSymbolKind",
     "kind": "function",
     "loc": 3,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotSymbolLike:25",
     "name": "SnapshotSymbolLike",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotNodeLike:34",
     "name": "SnapshotNodeLike",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotEdgeLike:42",
     "name": "SnapshotEdgeLike",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotLike:51",
     "name": "SnapshotLike",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:function:baseName:56",
     "name": "baseName",
     "kind": "function",
     "loc": 4,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotToAtlasGraph:61",
     "name": "snapshotToAtlasGraph",
     "kind": "function",
     "loc": 55,
     "complexity": 21,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotSymbolEdges:122",
     "name": "snapshotSymbolEdges",
     "kind": "function",
     "loc": 20,
     "complexity": 11,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotSymbols:148",
     "name": "snapshotSymbols",
     "kind": "function",
     "loc": 35,
     "complexity": 11,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/history.test.ts",
   "type": "file",
   "path": "src/atlas/playground/history.test.ts",
   "loc": 88,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/history.test.ts:function:graphOf:5",
     "name": "graphOf",
     "kind": "function",
     "loc": 11,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/history.ts",
   "type": "file",
   "path": "src/atlas/playground/history.ts",
   "loc": 86,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/history.ts:type:HistoryEntry:6",
     "name": "HistoryEntry",
     "kind": "type",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/history.ts:type:GraphDiff:14",
     "name": "GraphDiff",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/history.ts:type:NodeChange:20",
     "name": "NodeChange",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/history.ts:type:HistoryIndex:25",
     "name": "HistoryIndex",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/history.ts:function:buildHistoryIndex:33",
     "name": "buildHistoryIndex",
     "kind": "function",
     "loc": 21,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/history.ts:function:snapshotToGraph:56",
     "name": "snapshotToGraph",
     "kind": "function",
     "loc": 13,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/playground/history.ts:function:diffGraphs:76",
     "name": "diffGraphs",
     "kind": "function",
     "loc": 11,
     "complexity": 4,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/labelLayout.bench.ts",
   "type": "file",
   "path": "src/atlas/playground/labelLayout.bench.ts",
   "loc": 96,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/labelLayout.bench.ts:function:cells:17",
     "name": "cells",
     "kind": "function",
     "loc": 20,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/labelLayout.bench.ts:function:screenFont:38",
     "name": "screenFont",
     "kind": "function",
     "loc": 12,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/playground/labelLayout.bench.ts:function:labelFrame:52",
     "name": "labelFrame",
     "kind": "function",
     "loc": 36,
     "complexity": 7
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/main.tsx",
   "type": "file",
   "path": "src/atlas/playground/main.tsx",
   "loc": 7
  },
  {
   "id": "file:src/atlas/playground/mapShared.tsx",
   "type": "file",
   "path": "src/atlas/playground/mapShared.tsx",
   "loc": 765,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:DIM:22",
     "name": "DIM",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:MODIFIED_FILL:24",
     "name": "MODIFIED_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:ADDED_FILL:25",
     "name": "ADDED_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:CYCLE_FILL:27",
     "name": "CYCLE_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:TEST_FILL:29",
     "name": "TEST_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:DOWNSTREAM_COLOR:31",
     "name": "DOWNSTREAM_COLOR",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:UPSTREAM_COLOR:32",
     "name": "UPSTREAM_COLOR",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:DOWNSTREAM_FILL:33",
     "name": "DOWNSTREAM_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:UPSTREAM_FILL:34",
     "name": "UPSTREAM_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:SELECT_STROKE:36",
     "name": "SELECT_STROKE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:LEAF_STROKE:38",
     "name": "LEAF_STROKE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_STROKE:39",
     "name": "SYMBOL_STROKE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_EDGE:40",
     "name": "SYMBOL_EDGE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:MACRO_EDGE:41",
     "name": "MACRO_EDGE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:ACTIVE_EDGE:42",
     "name": "ACTIVE_EDGE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:CIRCLE_FILL:43",
     "name": "CIRCLE_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:CIRCLE_STROKE:44",
     "name": "CIRCLE_STROKE",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:CIRCLE_CYCLE_FILL:45",
     "name": "CIRCLE_CYCLE_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:MODULE_LABEL_INK:46",
     "name": "MODULE_LABEL_INK",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:FILE_LABEL_INK:47",
     "name": "FILE_LABEL_INK",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:TEST_LABEL_INK:48",
     "name": "TEST_LABEL_INK",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:WATERMARK_INK:49",
     "name": "WATERMARK_INK",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:PORT_FILL:50",
     "name": "PORT_FILL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_KIND_COLORS:54",
     "name": "SYMBOL_KIND_COLORS",
     "kind": "variable",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:EXPORTED_DOT:63",
     "name": "EXPORTED_DOT",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:PAGE_BG:65",
     "name": "PAGE_BG",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:MAP_BG:66",
     "name": "MAP_BG",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:PANEL_BG:67",
     "name": "PANEL_BG",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:PANEL_BORDER:68",
     "name": "PANEL_BORDER",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:INK:69",
     "name": "INK",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:MUTED_INK:70",
     "name": "MUTED_INK",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:districtFill:81",
     "name": "districtFill",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:districtStroke:83",
     "name": "districtStroke",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:districtLabelFill:85",
     "name": "districtLabelFill",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:innerDistrictStroke:87",
     "name": "innerDistrictStroke",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:innerDistrictLabelFill:89",
     "name": "innerDistrictLabelFill",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:leafTint:91",
     "name": "leafTint",
     "kind": "function",
     "loc": 2,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:setMapTheme:94",
     "name": "setMapTheme",
     "kind": "function",
     "loc": 101,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:WATERMARK_PX:199",
     "name": "WATERMARK_PX",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:LEAF_BORDER_MIN_PX:205",
     "name": "LEAF_BORDER_MIN_PX",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:DISTRICT_BORDER_MIN_PX:206",
     "name": "DISTRICT_BORDER_MIN_PX",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_ZOOM:209",
     "name": "SYMBOL_ZOOM",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_DOMINANT_FRACTION:212",
     "name": "SYMBOL_DOMINANT_FRACTION",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:EXPORTED_LABEL:214",
     "name": "EXPORTED_LABEL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:INTERNAL_LABEL:215",
     "name": "INTERNAL_LABEL",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:moduleHue:218",
     "name": "moduleHue",
     "kind": "function",
     "loc": 7,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:makeTopAncestorOf:229",
     "name": "makeTopAncestorOf",
     "kind": "function",
     "loc": 12,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:type:FocusDim:244",
     "name": "FocusDim",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:focusDimOf:253",
     "name": "focusDimOf",
     "kind": "function",
     "loc": 13,
     "complexity": 7,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:type:LeafFillContext:269",
     "name": "LeafFillContext",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:leafFillOf:281",
     "name": "leafFillOf",
     "kind": "function",
     "loc": 10,
     "complexity": 8,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:InnerLevelsLayer:294",
     "name": "InnerLevelsLayer",
     "kind": "function",
     "loc": 85,
     "complexity": 16,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:WatermarkLabelsLayer:385",
     "name": "WatermarkLabelsLayer",
     "kind": "function",
     "loc": 63,
     "complexity": 7,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:isWatermarkSized:450",
     "name": "isWatermarkSized",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:type:SelectionDirections:456",
     "name": "SelectionDirections",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:selectionDirections:473",
     "name": "selectionDirections",
     "kind": "function",
     "loc": 30,
     "complexity": 9,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:type:ExitPreview:506",
     "name": "ExitPreview",
     "kind": "type",
     "loc": 6,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:ExitPreviewsLayer:517",
     "name": "ExitPreviewsLayer",
     "kind": "function",
     "loc": 113,
     "complexity": 31,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:smoothPathD:634",
     "name": "smoothPathD",
     "kind": "function",
     "loc": 19,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:RaisedEdgePath:657",
     "name": "RaisedEdgePath",
     "kind": "function",
     "loc": 18,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:variable:BUNDLE_STRENGTH:679",
     "name": "BUNDLE_STRENGTH",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:type:EdgeBundle:686",
     "name": "EdgeBundle",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/mapShared.tsx:function:makeEdgeBundler:704",
     "name": "makeEdgeBundler",
     "kind": "function",
     "loc": 62,
     "complexity": 12,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/ringsController.test.ts",
   "type": "file",
   "path": "src/atlas/playground/ringsController.test.ts",
   "loc": 201
  },
  {
   "id": "file:src/atlas/playground/ringsController.ts",
   "type": "file",
   "path": "src/atlas/playground/ringsController.ts",
   "loc": 313,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:type:RingsOptions:46",
     "name": "RingsOptions",
     "kind": "type",
     "loc": 13,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:type:RingsState:60",
     "name": "RingsState",
     "kind": "type",
     "loc": 15,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:resolvedBoundaries:79",
     "name": "resolvedBoundaries",
     "kind": "function",
     "loc": 5,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:canvasOf:85",
     "name": "canvasOf",
     "kind": "function",
     "loc": 9,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:solverOf:95",
     "name": "solverOf",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:placeCircles:103",
     "name": "placeCircles",
     "kind": "function",
     "loc": 50,
     "complexity": 5
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:circleClips:154",
     "name": "circleClips",
     "kind": "function",
     "loc": 14,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:createRingsState:169",
     "name": "createRingsState",
     "kind": "function",
     "loc": 38,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:stepRingsState:209",
     "name": "stepRingsState",
     "kind": "function",
     "loc": 19,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/ringsController.ts:function:applyRingsChanges:236",
     "name": "applyRingsChanges",
     "kind": "function",
     "loc": 78,
     "complexity": 10,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/subdivision.ts",
   "type": "file",
   "path": "src/atlas/playground/subdivision.ts",
   "loc": 342,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:type:SolverOptions:37",
     "name": "SolverOptions",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:type:SubdivisionLevel:43",
     "name": "SubdivisionLevel",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:type:Subdivision:50",
     "name": "Subdivision",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:variable:NEST_INSET:62",
     "name": "NEST_INSET",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:variable:DECLUMP_ITERATIONS:64",
     "name": "DECLUMP_ITERATIONS",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:insetRing:68",
     "name": "insetRing",
     "kind": "function",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:constrainedForceIterations:88",
     "name": "constrainedForceIterations",
     "kind": "function",
     "loc": 8,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:assignedSlotHints:117",
     "name": "assignedSlotHints",
     "kind": "function",
     "loc": 48,
     "complexity": 7,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:solveLevel:167",
     "name": "solveLevel",
     "kind": "function",
     "loc": 11,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:leavesOfGroups:180",
     "name": "leavesOfGroups",
     "kind": "function",
     "loc": 16,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:subdivideUnder:202",
     "name": "subdivideUnder",
     "kind": "function",
     "loc": 107,
     "complexity": 20,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/subdivision.ts:function:seedLeafLayout:315",
     "name": "seedLeafLayout",
     "kind": "function",
     "loc": 28,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/symbolIcons.tsx",
   "type": "file",
   "path": "src/atlas/playground/symbolIcons.tsx",
   "loc": 136,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/symbolIcons.tsx:type:SymbolGlyph:9",
     "name": "SymbolGlyph",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/symbolIcons.tsx:function:symbolGlyphOf:20",
     "name": "symbolGlyphOf",
     "kind": "function",
     "loc": 9,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/symbolIcons.tsx:function:SymbolTag:61",
     "name": "SymbolTag",
     "kind": "function",
     "loc": 39,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/symbolIcons.tsx:function:SymbolIcon:102",
     "name": "SymbolIcon",
     "kind": "function",
     "loc": 35,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/synthetic.test.ts",
   "type": "file",
   "path": "src/atlas/playground/synthetic.test.ts",
   "loc": 109
  },
  {
   "id": "file:src/atlas/playground/synthetic.ts",
   "type": "file",
   "path": "src/atlas/playground/synthetic.ts",
   "loc": 173,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/synthetic.ts:type:SyntheticOptions:4",
     "name": "SyntheticOptions",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/synthetic.ts:function:hashString:16",
     "name": "hashString",
     "kind": "function",
     "loc": 8,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/playground/synthetic.ts:function:synthesizeSymbols:29",
     "name": "synthesizeSymbols",
     "kind": "function",
     "loc": 27,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/synthetic.ts:function:synthesizeSymbolEdges:62",
     "name": "synthesizeSymbolEdges",
     "kind": "function",
     "loc": 37,
     "complexity": 8,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/synthetic.ts:function:createSyntheticGraph:100",
     "name": "createSyntheticGraph",
     "kind": "function",
     "loc": 74,
     "complexity": 15,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/treemapController.test.ts",
   "type": "file",
   "path": "src/atlas/playground/treemapController.test.ts",
   "loc": 354,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/treemapController.test.ts:function:sampleGraph:13",
     "name": "sampleGraph",
     "kind": "function",
     "loc": 30,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/playground/treemapController.test.ts:function:settled:46",
     "name": "settled",
     "kind": "function",
     "loc": 8,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/treemapController.ts",
   "type": "file",
   "path": "src/atlas/playground/treemapController.ts",
   "loc": 365,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/treemapController.ts:type:TreemapOptions:45",
     "name": "TreemapOptions",
     "kind": "type",
     "loc": 16,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/treemapController.ts:type:TreemapLevelCells:62",
     "name": "TreemapLevelCells",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/treemapController.ts:type:TreemapState:64",
     "name": "TreemapState",
     "kind": "type",
     "loc": 12,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/treemapController.ts:function:createTreemapState:79",
     "name": "createTreemapState",
     "kind": "function",
     "loc": 96,
     "complexity": 13,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/treemapController.ts:function:stepTreemapState:177",
     "name": "stepTreemapState",
     "kind": "function",
     "loc": 19,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/treemapController.ts:function:applyTreemapChanges:207",
     "name": "applyTreemapChanges",
     "kind": "function",
     "loc": 159,
     "complexity": 25,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/useMapViewport.ts",
   "type": "file",
   "path": "src/atlas/playground/useMapViewport.ts",
   "loc": 260,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusRequest:6",
     "name": "FocusRequest",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusView:14",
     "name": "FocusView",
     "kind": "type",
     "loc": 15,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/useMapViewport.ts:type:ViewBox:30",
     "name": "ViewBox",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/useMapViewport.ts:function:useMapViewport:48",
     "name": "useMapViewport",
     "kind": "function",
     "loc": 213,
     "complexity": 16,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/viewConfig.test.ts",
   "type": "file",
   "path": "src/atlas/playground/viewConfig.test.ts",
   "loc": 70
  },
  {
   "id": "file:src/atlas/playground/viewConfig.ts",
   "type": "file",
   "path": "src/atlas/playground/viewConfig.ts",
   "loc": 183,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:Granularity:14",
     "name": "Granularity",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:granularityOf:16",
     "name": "granularityOf",
     "kind": "function",
     "loc": 8,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:BoundaryLevel:31",
     "name": "BoundaryLevel",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:variable:BOUNDARY_LEVELS:32",
     "name": "BOUNDARY_LEVELS",
     "kind": "variable",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:DisplayLevel:46",
     "name": "DisplayLevel",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:variable:DISPLAY_LEVELS:52",
     "name": "DISPLAY_LEVELS",
     "kind": "variable",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:variable:UNAVAILABLE_LEVELS:60",
     "name": "UNAVAILABLE_LEVELS",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:OmitScope:68",
     "name": "OmitScope",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:variable:OMIT_SCOPES:69",
     "name": "OMIT_SCOPES",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:hiddenLayersOf:72",
     "name": "hiddenLayersOf",
     "kind": "function",
     "loc": 3,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:showsSymbolLevels:77",
     "name": "showsSymbolLevels",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:WeightKind:81",
     "name": "WeightKind",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:ViewConfig:83",
     "name": "ViewConfig",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:type:ViewPreset:90",
     "name": "ViewPreset",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:variable:VIEW_PRESETS:96",
     "name": "VIEW_PRESETS",
     "kind": "variable",
     "loc": 32,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:presetOf:129",
     "name": "presetOf",
     "kind": "function",
     "loc": 12,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:presetConfig:142",
     "name": "presetConfig",
     "kind": "function",
     "loc": 11,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:complexityOf:156",
     "name": "complexityOf",
     "kind": "function",
     "loc": 3,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewConfig.ts:function:reweightByTransitiveComplexity:165",
     "name": "reweightByTransitiveComplexity",
     "kind": "function",
     "loc": 18,
     "complexity": 2,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/playground/viewCulling.test.ts",
   "type": "file",
   "path": "src/atlas/playground/viewCulling.test.ts",
   "loc": 71
  },
  {
   "id": "file:src/atlas/playground/viewCulling.ts",
   "type": "file",
   "path": "src/atlas/playground/viewCulling.ts",
   "loc": 53,
   "symbols": [
    {
     "id": "symbol:src/atlas/playground/viewCulling.ts:type:ViewRect:4",
     "name": "ViewRect",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewCulling.ts:function:pointInView:7",
     "name": "pointInView",
     "kind": "function",
     "loc": 8,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewCulling.ts:function:cellInView:22",
     "name": "cellInView",
     "kind": "function",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/playground/viewCulling.ts:function:segmentInView:37",
     "name": "segmentInView",
     "kind": "function",
     "loc": 17,
     "complexity": 4,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/server/callHierarchy.test.ts",
   "type": "file",
   "path": "src/atlas/server/callHierarchy.test.ts",
   "loc": 59
  },
  {
   "id": "file:src/atlas/server/callHierarchyProvider.ts",
   "type": "file",
   "path": "src/atlas/server/callHierarchyProvider.ts",
   "loc": 95,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:type:SymbolRef:6",
     "name": "SymbolRef",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:type:CallHierarchyResult:8",
     "name": "CallHierarchyResult",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:type:LspRange:13",
     "name": "LspRange",
     "kind": "type",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:type:DocumentSymbol:14",
     "name": "DocumentSymbol",
     "kind": "type",
     "loc": 5,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:type:CallHierarchyItem:19",
     "name": "CallHierarchyItem",
     "kind": "type",
     "loc": 5,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:function:findSymbol:25",
     "name": "findSymbol",
     "kind": "function",
     "loc": 11,
     "complexity": 5
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:function:toRef:37",
     "name": "toRef",
     "kind": "function",
     "loc": 8,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/server/callHierarchyProvider.ts:function:callHierarchy:51",
     "name": "callHierarchy",
     "kind": "function",
     "loc": 45,
     "complexity": 8,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/server/cfgProvider.test.ts",
   "type": "file",
   "path": "src/atlas/server/cfgProvider.test.ts",
   "loc": 287,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/cfgProvider.test.ts:function:adjacency:4",
     "name": "adjacency",
     "kind": "function",
     "loc": 9,
     "complexity": 3
    }
   ]
  },
  {
   "id": "file:src/atlas/server/cfgProvider.ts",
   "type": "file",
   "path": "src/atlas/server/cfgProvider.ts",
   "loc": 635,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:function:truncate:19",
     "name": "truncate",
     "kind": "function",
     "loc": 4,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:type:FunctionLike:24",
     "name": "FunctionLike",
     "kind": "type",
     "loc": 8,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:function:isFunctionLike:33",
     "name": "isFunctionLike",
     "kind": "function",
     "loc": 11,
     "complexity": 7
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:function:functionAt:47",
     "name": "functionAt",
     "kind": "function",
     "loc": 24,
     "complexity": 8
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:type:ChainResult:72",
     "name": "ChainResult",
     "kind": "type",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:function:collectBindingNames:75",
     "name": "collectBindingNames",
     "kind": "function",
     "loc": 11,
     "complexity": 4
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:class:CfgBuilder:87",
     "name": "CfgBuilder",
     "kind": "class",
     "loc": 455,
     "complexity": 76
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.nodes:88",
     "name": "nodes",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.edges:89",
     "name": "edges",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.grid:90",
     "name": "grid",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.entryId:91",
     "name": "entryId",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.exitId:92",
     "name": "exitId",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.counter:93",
     "name": "counter",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.breakables:95",
     "name": "breakables",
     "kind": "property",
     "loc": 2,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.recursiveBlocks:98",
     "name": "recursiveBlocks",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.calls:100",
     "name": "calls",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.code:102",
     "name": "code",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.effects:104",
     "name": "effects",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.bodyLocals:106",
     "name": "bodyLocals",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:property:CfgBuilder.locals:108",
     "name": "locals",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.constructor:110",
     "name": "constructor",
     "kind": "method",
     "loc": 4,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.callsSelf:116",
     "name": "callsSelf",
     "kind": "method",
     "loc": 17,
     "complexity": 5
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.rootOf:135",
     "name": "rootOf",
     "kind": "method",
     "loc": 12,
     "complexity": 5
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.addEffects:149",
     "name": "addEffects",
     "kind": "method",
     "loc": 56,
     "complexity": 18
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.addCode:207",
     "name": "addCode",
     "kind": "method",
     "loc": 9,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.collectCalls:218",
     "name": "collectCalls",
     "kind": "method",
     "loc": 22,
     "complexity": 6
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.markRecursion:242",
     "name": "markRecursion",
     "kind": "method",
     "loc": 5,
     "complexity": 3
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.block:248",
     "name": "block",
     "kind": "method",
     "loc": 11,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.link:260",
     "name": "link",
     "kind": "method",
     "loc": 5,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.text:266",
     "name": "text",
     "kind": "method",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.body:270",
     "name": "body",
     "kind": "method",
     "loc": 3,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:method:CfgBuilder.chain:275",
     "name": "chain",
     "kind": "method",
     "loc": 266,
     "complexity": 40
    },
    {
     "id": "symbol:src/atlas/server/cfgProvider.ts:function:extractCfg:543",
     "name": "extractCfg",
     "kind": "function",
     "loc": 93,
     "complexity": 15,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/server/index.ts",
   "type": "file",
   "path": "src/atlas/server/index.ts",
   "loc": 232,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/index.ts:function:clientFor:50",
     "name": "clientFor",
     "kind": "function",
     "loc": 10,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/server/index.ts:type:DiffStream:63",
     "name": "DiffStream",
     "kind": "type",
     "loc": 6,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/index.ts:function:subscribeWorkingDiff:71",
     "name": "subscribeWorkingDiff",
     "kind": "function",
     "loc": 53,
     "complexity": 8
    }
   ]
  },
  {
   "id": "file:src/atlas/server/jsonRpc.test.ts",
   "type": "file",
   "path": "src/atlas/server/jsonRpc.test.ts",
   "loc": 57
  },
  {
   "id": "file:src/atlas/server/jsonRpc.ts",
   "type": "file",
   "path": "src/atlas/server/jsonRpc.ts",
   "loc": 41,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/jsonRpc.ts:function:encodeMessage:6",
     "name": "encodeMessage",
     "kind": "function",
     "loc": 7,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/jsonRpc.ts:class:JsonRpcReader:16",
     "name": "JsonRpcReader",
     "kind": "class",
     "loc": 26,
     "complexity": 5,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/jsonRpc.ts:property:JsonRpcReader.buffer:17",
     "name": "buffer",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/jsonRpc.ts:method:JsonRpcReader.constructor:19",
     "name": "constructor",
     "kind": "method",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/jsonRpc.ts:method:JsonRpcReader.push:21",
     "name": "push",
     "kind": "method",
     "loc": 20,
     "complexity": 5,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/atlas/server/lspClient.ts",
   "type": "file",
   "path": "src/atlas/server/lspClient.ts",
   "loc": 128,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/lspClient.ts:class:LspClient:13",
     "name": "LspClient",
     "kind": "class",
     "loc": 116,
     "complexity": 12,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:property:LspClient.nextId:14",
     "name": "nextId",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:property:LspClient.pending:15",
     "name": "pending",
     "kind": "property",
     "loc": 4,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:property:LspClient.openDocuments:19",
     "name": "openDocuments",
     "kind": "property",
     "loc": 1,
     "complexity": 1
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:method:LspClient.constructor:21",
     "name": "constructor",
     "kind": "method",
     "loc": 10,
     "complexity": 2
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:static-method:LspClient.start:32",
     "name": "start",
     "kind": "static-method",
     "loc": 27,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:method:LspClient.request:60",
     "name": "request",
     "kind": "method",
     "loc": 13,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:method:LspClient.notify:74",
     "name": "notify",
     "kind": "method",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:method:LspClient.openDocument:79",
     "name": "openDocument",
     "kind": "method",
     "loc": 14,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:method:LspClient.dispose:94",
     "name": "dispose",
     "kind": "method",
     "loc": 8,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/lspClient.ts:method:LspClient.onMessage:103",
     "name": "onMessage",
     "kind": "method",
     "loc": 25,
     "complexity": 8
    }
   ]
  },
  {
   "id": "file:src/atlas/server/workingDiff.test.ts",
   "type": "file",
   "path": "src/atlas/server/workingDiff.test.ts",
   "loc": 104
  },
  {
   "id": "file:src/atlas/server/workingDiff.ts",
   "type": "file",
   "path": "src/atlas/server/workingDiff.ts",
   "loc": 185,
   "symbols": [
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:type:WorkingDiff:14",
     "name": "WorkingDiff",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:countLines:21",
     "name": "countLines",
     "kind": "function",
     "loc": 5,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:enrichWithLoc:33",
     "name": "enrichWithLoc",
     "kind": "function",
     "loc": 16,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:parseGitStatus:50",
     "name": "parseGitStatus",
     "kind": "function",
     "loc": 25,
     "complexity": 9,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:parseNameStatus:77",
     "name": "parseNameStatus",
     "kind": "function",
     "loc": 22,
     "complexity": 10,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:isSafeRef:101",
     "name": "isSafeRef",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:workingDiff:113",
     "name": "workingDiff",
     "kind": "function",
     "loc": 22,
     "complexity": 6,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:isIgnoredPath:138",
     "name": "isIgnoredPath",
     "kind": "function",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/atlas/server/workingDiff.ts:function:watchWorkingDiff:151",
     "name": "watchWorkingDiff",
     "kind": "function",
     "loc": 35,
     "complexity": 8,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/cli/index.ts",
   "type": "file",
   "path": "src/cli/index.ts",
   "loc": 47,
   "symbols": [
    {
     "id": "symbol:src/cli/index.ts:function:parsePositiveInteger:34",
     "name": "parsePositiveInteger",
     "kind": "function",
     "loc": 7,
     "complexity": 3
    },
    {
     "id": "symbol:src/cli/index.ts:function:parseStep:42",
     "name": "parseStep",
     "kind": "function",
     "loc": 6,
     "complexity": 2
    }
   ]
  },
  {
   "id": "file:src/core/ai.test.ts",
   "type": "file",
   "path": "src/core/ai.test.ts",
   "loc": 26
  },
  {
   "id": "file:src/core/ai.ts",
   "type": "file",
   "path": "src/core/ai.ts",
   "loc": 35,
   "symbols": [
    {
     "id": "symbol:src/core/ai.ts:function:detectAIIndicators:17",
     "name": "detectAIIndicators",
     "kind": "function",
     "loc": 19,
     "complexity": 4,
     "exported": true
    }
   ]
  },
  {
   "id": "file:src/core/collect.test.ts",
   "type": "file",
   "path": "src/core/collect.test.ts",
   "loc": 74,
   "symbols": [
    {
     "id": "symbol:src/core/collect.test.ts:function:git:11",
     "name": "git",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/collect.test.ts:function:withGitRepo:15",
     "name": "withGitRepo",
     "kind": "function",
     "loc": 18,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/core/collect.ts",
   "type": "file",
   "path": "src/core/collect.ts",
   "loc": 349,
   "symbols": [
    {
     "id": "symbol:src/core/collect.ts:type:CollectOptions:13",
     "name": "CollectOptions",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:type:CollectResult:19",
     "name": "CollectResult",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:type:AnalyzeResult:25",
     "name": "AnalyzeResult",
     "kind": "type",
     "loc": 4,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:type:RealtimeAnalyzeResult:30",
     "name": "RealtimeAnalyzeResult",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:collectRepository:37",
     "name": "collectRepository",
     "kind": "function",
     "loc": 47,
     "complexity": 3,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:analyzeRepository:85",
     "name": "analyzeRepository",
     "kind": "function",
     "loc": 26,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:analyzeRealtimeRepository:112",
     "name": "analyzeRealtimeRepository",
     "kind": "function",
     "loc": 39,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:readSnapshots:152",
     "name": "readSnapshots",
     "kind": "function",
     "loc": 18,
     "complexity": 2,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:readDiffs:171",
     "name": "readDiffs",
     "kind": "function",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:codesprawlDir:183",
     "name": "codesprawlDir",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:snapshotsDir:187",
     "name": "snapshotsDir",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:diffsDir:191",
     "name": "diffsDir",
     "kind": "function",
     "loc": 3,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/collect.ts:function:resetCodesprawlOutput:195",
     "name": "resetCodesprawlOutput",
     "kind": "function",
     "loc": 7,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/collect.ts:function:getGitCommits:203",
     "name": "getGitCommits",
     "kind": "function",
     "loc": 12,
     "complexity": 4
    },
    {
     "id": "symbol:src/core/collect.ts:function:getGitCommit:216",
     "name": "getGitCommit",
     "kind": "function",
     "loc": 8,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/collect.ts:function:getGitStatus:225",
     "name": "getGitStatus",
     "kind": "function",
     "loc": 8,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/collect.ts:function:isCodesprawlStatusLine:234",
     "name": "isCodesprawlStatusLine",
     "kind": "function",
     "loc": 4,
     "complexity": 3
    },
    {
     "id": "symbol:src/core/collect.ts:function:parseGitCommitLog:239",
     "name": "parseGitCommitLog",
     "kind": "function",
     "loc": 28,
     "complexity": 4
    },
    {
     "id": "symbol:src/core/collect.ts:function:normalizeSince:268",
     "name": "normalizeSince",
     "kind": "function",
     "loc": 13,
     "complexity": 5
    },
    {
     "id": "symbol:src/core/collect.ts:function:sampleWeekly:282",
     "name": "sampleWeekly",
     "kind": "function",
     "loc": 7,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/collect.ts:function:weekKey:290",
     "name": "weekKey",
     "kind": "function",
     "loc": 7,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/collect.ts:function:writeMetricsCsv:298",
     "name": "writeMetricsCsv",
     "kind": "function",
     "loc": 31,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/collect.ts:function:csvCell:330",
     "name": "csvCell",
     "kind": "function",
     "loc": 4,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/collect.ts:function:readSnapshot:335",
     "name": "readSnapshot",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/collect.ts:function:writeJson:339",
     "name": "writeJson",
     "kind": "function",
     "loc": 4,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/collect.ts:function:git:344",
     "name": "git",
     "kind": "function",
     "loc": 6,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/core/diff.test.ts",
   "type": "file",
   "path": "src/core/diff.test.ts",
   "loc": 82,
   "symbols": [
    {
     "id": "symbol:src/core/diff.test.ts:function:snapshot:5",
     "name": "snapshot",
     "kind": "function",
     "loc": 44,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/core/diff.ts",
   "type": "file",
   "path": "src/core/diff.ts",
   "loc": 179,
   "symbols": [
    {
     "id": "symbol:src/core/diff.ts:function:diffSnapshots:14",
     "name": "diffSnapshots",
     "kind": "function",
     "loc": 23,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/diff.ts:function:computeChangedFiles:38",
     "name": "computeChangedFiles",
     "kind": "function",
     "loc": 46,
     "complexity": 13
    },
    {
     "id": "symbol:src/core/diff.ts:function:computeHotspots:85",
     "name": "computeHotspots",
     "kind": "function",
     "loc": 58,
     "complexity": 17
    },
    {
     "id": "symbol:src/core/diff.ts:function:addedImportEdges:144",
     "name": "addedImportEdges",
     "kind": "function",
     "loc": 4,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/diff.ts:function:fileMap:149",
     "name": "fileMap",
     "kind": "function",
     "loc": 9,
     "complexity": 3
    },
    {
     "id": "symbol:src/core/diff.ts:function:computeMetricDelta:159",
     "name": "computeMetricDelta",
     "kind": "function",
     "loc": 13,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/diff.ts:function:difference:173",
     "name": "difference",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/diff.ts:function:pathFromFileId:177",
     "name": "pathFromFileId",
     "kind": "function",
     "loc": 3,
     "complexity": 2
    }
   ]
  },
  {
   "id": "file:src/core/metrics.test.ts",
   "type": "file",
   "path": "src/core/metrics.test.ts",
   "loc": 35
  },
  {
   "id": "file:src/core/metrics.ts",
   "type": "file",
   "path": "src/core/metrics.ts",
   "loc": 188,
   "symbols": [
    {
     "id": "symbol:src/core/metrics.ts:function:isFileNode:11",
     "name": "isFileNode",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/metrics.ts:function:isImportEdge:15",
     "name": "isImportEdge",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/metrics.ts:function:computeGraphMetrics:19",
     "name": "computeGraphMetrics",
     "kind": "function",
     "loc": 64,
     "complexity": 12,
     "exported": true
    },
    {
     "id": "symbol:src/core/metrics.ts:function:largestConnectedComponentSize:84",
     "name": "largestConnectedComponentSize",
     "kind": "function",
     "loc": 33,
     "complexity": 8
    },
    {
     "id": "symbol:src/core/metrics.ts:function:findCyclicComponents:118",
     "name": "findCyclicComponents",
     "kind": "function",
     "loc": 71,
     "complexity": 22
    }
   ]
  },
  {
   "id": "file:src/core/snapshot.test.ts",
   "type": "file",
   "path": "src/core/snapshot.test.ts",
   "loc": 265,
   "symbols": [
    {
     "id": "symbol:src/core/snapshot.test.ts:function:withFixture:7",
     "name": "withFixture",
     "kind": "function",
     "loc": 13,
     "complexity": 2
    }
   ]
  },
  {
   "id": "file:src/core/snapshot.ts",
   "type": "file",
   "path": "src/core/snapshot.ts",
   "loc": 636,
   "symbols": [
    {
     "id": "symbol:src/core/snapshot.ts:variable:SOURCE_EXTENSIONS:19",
     "name": "SOURCE_EXTENSIONS",
     "kind": "variable",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/snapshot.ts:type:SnapshotOptions:44",
     "name": "SnapshotOptions",
     "kind": "type",
     "loc": 4,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:createSnapshotFromWorkingTree:49",
     "name": "createSnapshotFromWorkingTree",
     "kind": "function",
     "loc": 56,
     "complexity": 4,
     "exported": true
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:normalizePath:106",
     "name": "normalizePath",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:sourceExtension:110",
     "name": "sourceExtension",
     "kind": "function",
     "loc": 6,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:countLoc:117",
     "name": "countLoc",
     "kind": "function",
     "loc": 11,
     "complexity": 3
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:collectDirectoryPaths:129",
     "name": "collectDirectoryPaths",
     "kind": "function",
     "loc": 17,
     "complexity": 4
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:createContainsEdges:147",
     "name": "createContainsEdges",
     "kind": "function",
     "loc": 29,
     "complexity": 5
    },
    {
     "id": "symbol:src/core/snapshot.ts:type:ExtractedImport:177",
     "name": "ExtractedImport",
     "kind": "type",
     "loc": 4,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:createImportEdges:182",
     "name": "createImportEdges",
     "kind": "function",
     "loc": 34,
     "complexity": 8
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:extractImports:217",
     "name": "extractImports",
     "kind": "function",
     "loc": 32,
     "complexity": 13
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:bindingsFromImportDeclaration:250",
     "name": "bindingsFromImportDeclaration",
     "kind": "function",
     "loc": 25,
     "complexity": 12
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:bindingsFromExportDeclaration:276",
     "name": "bindingsFromExportDeclaration",
     "kind": "function",
     "loc": 15,
     "complexity": 8
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:resolveSymbolImports:292",
     "name": "resolveSymbolImports",
     "kind": "function",
     "loc": 39,
     "complexity": 14
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:collectTopLevelSymbolUsages:332",
     "name": "collectTopLevelSymbolUsages",
     "kind": "function",
     "loc": 32,
     "complexity": 12
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:extractTopLevelSymbols:365",
     "name": "extractTopLevelSymbols",
     "kind": "function",
     "loc": 11,
     "complexity": 3
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:symbolsFromTopLevelStatement:377",
     "name": "symbolsFromTopLevelStatement",
     "kind": "function",
     "loc": 16,
     "complexity": 6
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:hasModifier:394",
     "name": "hasModifier",
     "kind": "function",
     "loc": 3,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:classMemberSymbols:402",
     "name": "classMemberSymbols",
     "kind": "function",
     "loc": 43,
     "complexity": 12
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:memberName:446",
     "name": "memberName",
     "kind": "function",
     "loc": 6,
     "complexity": 6
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:symbolFromStatement:453",
     "name": "symbolFromStatement",
     "kind": "function",
     "loc": 18,
     "complexity": 8
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:symbolFromVariableDeclaration:472",
     "name": "symbolFromVariableDeclaration",
     "kind": "function",
     "loc": 25,
     "complexity": 8
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:createSymbol:498",
     "name": "createSymbol",
     "kind": "function",
     "loc": 21,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:cyclomaticComplexity:523",
     "name": "cyclomaticComplexity",
     "kind": "function",
     "loc": 34,
     "complexity": 14
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:hasExportModifier:558",
     "name": "hasExportModifier",
     "kind": "function",
     "loc": 3,
     "complexity": 2
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:scriptKindFor:562",
     "name": "scriptKindFor",
     "kind": "function",
     "loc": 12,
     "complexity": 6
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:resolveRelativeImport:575",
     "name": "resolveRelativeImport",
     "kind": "function",
     "loc": 15,
     "complexity": 5
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:resolutionCandidates:591",
     "name": "resolutionCandidates",
     "kind": "function",
     "loc": 22,
     "complexity": 6
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:fileId:614",
     "name": "fileId",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:symbolId:618",
     "name": "symbolId",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:dirId:622",
     "name": "dirId",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:containsId:626",
     "name": "containsId",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:importId:630",
     "name": "importId",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    },
    {
     "id": "symbol:src/core/snapshot.ts:function:unresolvedId:634",
     "name": "unresolvedId",
     "kind": "function",
     "loc": 3,
     "complexity": 1
    }
   ]
  },
  {
   "id": "file:src/core/types.ts",
   "type": "file",
   "path": "src/core/types.ts",
   "loc": 209,
   "symbols": [
    {
     "id": "symbol:src/core/types.ts:type:AIIndicator:1",
     "name": "AIIndicator",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CommitAIInfo:10",
     "name": "CommitAIInfo",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CommitMetadataInput:16",
     "name": "CommitMetadataInput",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:SnapshotCommit:25",
     "name": "SnapshotCommit",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:RepoNode:35",
     "name": "RepoNode",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:DirNode:41",
     "name": "DirNode",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:FileNode:47",
     "name": "FileNode",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeNode:57",
     "name": "CodeNode",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeSymbolKind:59",
     "name": "CodeSymbolKind",
     "kind": "type",
     "loc": 12,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeSymbol:72",
     "name": "CodeSymbol",
     "kind": "type",
     "loc": 13,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeImportBindingKind:86",
     "name": "CodeImportBindingKind",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeImportBinding:88",
     "name": "CodeImportBinding",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeSymbolImport:95",
     "name": "CodeSymbolImport",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:ContainsEdge:102",
     "name": "ContainsEdge",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:ImportsEdge:109",
     "name": "ImportsEdge",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodeEdge:120",
     "name": "CodeEdge",
     "kind": "type",
     "loc": 1,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:SnapshotMetrics:122",
     "name": "SnapshotMetrics",
     "kind": "type",
     "loc": 11,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:Snapshot:134",
     "name": "Snapshot",
     "kind": "type",
     "loc": 8,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:FileGraphMetric:143",
     "name": "FileGraphMetric",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:MetricsComputation:149",
     "name": "MetricsComputation",
     "kind": "type",
     "loc": 6,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:ChangedFile:156",
     "name": "ChangedFile",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:HotspotReason:167",
     "name": "HotspotReason",
     "kind": "type",
     "loc": 9,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:Hotspot:177",
     "name": "Hotspot",
     "kind": "type",
     "loc": 5,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:GraphDiff:183",
     "name": "GraphDiff",
     "kind": "type",
     "loc": 12,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CodesprawlConfig:196",
     "name": "CodesprawlConfig",
     "kind": "type",
     "loc": 10,
     "complexity": 1,
     "exported": true
    },
    {
     "id": "symbol:src/core/types.ts:type:CommitRecord:207",
     "name": "CommitRecord",
     "kind": "type",
     "loc": 3,
     "complexity": 1,
     "exported": true
    }
   ]
  },
  {
   "id": "file:vite.atlas.config.ts",
   "type": "file",
   "path": "vite.atlas.config.ts",
   "loc": 30
  },
  {
   "id": "file:vitest.config.ts",
   "type": "file",
   "path": "vitest.config.ts",
   "loc": 11
  }
 ],
 "edges": [
  {
   "type": "imports",
   "from": "file:e2e/atlas-zoom.spec.ts",
   "to": "unresolved:e2e/atlas-zoom.spec.ts:./vendor/lightbringer.mjs",
   "resolved": false
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/delta.test.ts",
   "to": "file:src/atlas/contracts/delta.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:function:affectedGroups:103"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:function:diffGraphs:42"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:function:isEmptyDelta:85"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:type:GraphDelta:15"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/delta.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/delta.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/detail.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/graph.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:function:locScorer:78"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/hierarchy.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/hierarchy.test.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:ancestorAt:241"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:deriveLevels:72"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:directoryGrouping:270"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:fileGrouping:283"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:parentFileOf:256"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:serviceGrouping:292"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/hierarchy.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNodeKind:11"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/hierarchy.ts",
   "to": "file:src/atlas/contracts/modules.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:function:defaultModuleIdOf:14"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:type:ModuleIdOf:9"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/layers.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/layers.test.ts",
   "to": "file:src/atlas/contracts/layers.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/layers.ts:function:defaultLayerOf:11"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/layers.ts:function:matchTestTargets:48"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/layers.ts:function:splitByLayer:21"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/layers.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/modules.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/modules.test.ts",
   "to": "file:src/atlas/contracts/modules.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:function:defaultModuleIdOf:14"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:function:deriveModules:32"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/modules.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/contracts/overlay.test.ts",
   "to": "file:src/atlas/contracts/overlay.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/overlay.ts:function:liftOverlay:38"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/overlay.ts:type:FlowOverlay:15"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/assignment.test.ts",
   "to": "file:src/atlas/kernel/assignment.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/assignment.ts:function:minCostAssignment:12"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/bundling.test.ts",
   "to": "file:src/atlas/kernel/bundling.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/bundling.ts:function:bundlePath:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/bundling.ts:function:hierarchyControlPoints:17"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/bundling.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.bench.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.bench.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellInputNode:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.bench.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.bench.ts",
   "to": "file:src/atlas/kernel/transitiveWeight.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/transitiveWeight.ts:function:transitiveWeights:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.test.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:applyGraphChanges:329"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellInputNode:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.test.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.ts",
   "to": "file:src/atlas/kernel/clip.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:type:ClipRegion:10"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:signedArea:8"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.ts",
   "to": "file:src/atlas/kernel/powerDiagram.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:function:computePowerDiagram:146"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:type:CellEdge:13"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:type:PowerSite:5"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:type:Rng:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/capacityLayout.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/centrality.test.ts",
   "to": "file:src/atlas/kernel/centrality.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/centrality.ts:function:centralityRings:57"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/centrality.ts:function:dependentWeights:13"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/centrality.ts:function:importanceScore:31"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/centrality.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/centrality.ts",
   "to": "file:src/atlas/kernel/transitiveWeight.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/transitiveWeight.ts:function:transitiveWeights:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/cfgLayout.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/cfgLayout.test.ts",
   "to": "file:src/atlas/kernel/cfgLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/cfgLayout.ts:function:layoutCfg:32"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/cfgLayout.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/cfgLayout.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/clip.test.ts",
   "to": "file:src/atlas/kernel/clip.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clampInto:83"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipCenter:126"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipToRing:16"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:randomPointIn:39"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:type:ClipRegion:10"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/clip.test.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/clip.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:circleToPolygon:87"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:nearestPointInRing:104"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/clip.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:type:Rng:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/clip.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/embed.test.ts",
   "to": "file:src/atlas/kernel/embed.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/embed.ts:function:embedGraph:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/embed.ts:function:procrustesAlign:177"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/embed.ts:type:EmbedEdge:15"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/embed.test.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/embed.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.test.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.test.ts",
   "to": "file:src/atlas/kernel/forceLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:function:createForceLayout:53"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:function:forceStep:108"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:type:ForceInputEdge:13"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:type:ForceInputNode:12"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.test.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.ts",
   "to": "file:src/atlas/kernel/clip.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clampInto:83"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipCenter:126"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipScale:108"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:randomPointIn:39"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:type:ClipRegion:10"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:nearestPointInRing:104"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:signedArea:8"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/forceLayout.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/geojson.test.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/geojson.test.ts",
   "to": "file:src/atlas/kernel/geojson.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/geojson.ts:function:cellsToFeatureCollection:28"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/geojson.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/louvain.test.ts",
   "to": "file:src/atlas/kernel/louvain.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/louvain.ts:function:louvain:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/louvain.ts:type:LouvainEdge:9"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/neighborhood.test.ts",
   "to": "file:src/atlas/kernel/neighborhood.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:cellAdjacency:14"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:greedySwapAssignment:59"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:realizedEdgeRate:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/neighborhood.test.ts",
   "to": "file:src/atlas/kernel/powerDiagram.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:function:computePowerDiagram:146"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/neighborhood.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/neighborhood.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.test.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.test.ts",
   "to": "file:src/atlas/kernel/pipeline.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:createGraphLayout:93"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:embedSeedHints:57"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:function:locScorer:78"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:WeightScorer:76"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityOptions:26"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.ts",
   "to": "file:src/atlas/kernel/clip.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clampInto:83"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipCenter:126"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipScale:108"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:type:ClipRegion:10"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.ts",
   "to": "file:src/atlas/kernel/embed.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/embed.ts:function:embedGraph:31"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.ts",
   "to": "file:src/atlas/kernel/forceLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:function:createForceLayout:53"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:function:forceStep:108"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/pipeline.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/polygon.test.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:circleToPolygon:87"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:clipHalfPlane:47"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:convexHull:144"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:nearestPointInRing:104"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:signedArea:8"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/polygon.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.bench.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.bench.ts",
   "to": "file:src/atlas/kernel/powerDiagram.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:function:computePowerDiagram:146"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:type:PowerSite:5"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.bench.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.test.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:circleToPolygon:87"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:signedArea:8"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.test.ts",
   "to": "file:src/atlas/kernel/powerDiagram.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:function:computePowerDiagram:146"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/powerDiagram.ts:type:PowerSite:5"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.test.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.test.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:signedArea:8"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/powerDiagram.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/reach.test.ts",
   "to": "file:src/atlas/kernel/reach.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/reach.ts:function:reachSubgraph:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/ringLayout.test.ts",
   "to": "file:src/atlas/kernel/ringLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringLayout.ts:function:ringLayout:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringLayout.ts:type:RingModule:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/ringLayout.test.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/ringLayout.ts",
   "to": "file:src/atlas/kernel/ringOrder.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringOrder.ts:function:barycentricRingOrder:16"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/ringOrder.test.ts",
   "to": "file:src/atlas/kernel/ringOrder.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringOrder.ts:function:barycentricRingOrder:16"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringOrder.ts:type:OrderEdge:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/rng.test.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/scc.test.ts",
   "to": "file:src/atlas/kernel/scc.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:cyclicComponents:94"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:edgeKey:15"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:feedbackEdges:117"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:stronglyConnectedComponents:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/topoRank.test.ts",
   "to": "file:src/atlas/kernel/topoRank.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/topoRank.ts:function:topoRank:11"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/topoRank.ts",
   "to": "file:src/atlas/kernel/scc.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:stronglyConnectedComponents:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/transitiveWeight.test.ts",
   "to": "file:src/atlas/kernel/transitiveWeight.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/transitiveWeight.ts:function:transitiveWeights:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/transitiveWeight.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/transitiveWeight.ts",
   "to": "file:src/atlas/kernel/scc.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:cyclicComponents:94"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/kernel/vec.test.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:function:add:3"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:function:distance:23"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:function:dot:15"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:function:lengthOf:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:function:scale:11"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:function:sub:7"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.test.ts",
   "to": "file:src/atlas/playground/apiView.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:apiModuleIdOf:16"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:applySymbolBudget:162"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:buildApiGraph:90"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:moduleScopeId:86"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:splitApiBoundary:36"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:parentFileOf:256"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.ts",
   "to": "file:src/atlas/contracts/modules.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:function:defaultModuleIdOf:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.ts",
   "to": "file:src/atlas/kernel/transitiveWeight.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/transitiveWeight.ts:function:transitiveWeights:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/apiView.ts",
   "to": "file:src/atlas/playground/viewConfig.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:complexityOf:156"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/contracts/delta.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:function:diffGraphs:42"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:function:isEmptyDelta:85"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/contracts/detail.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/detail.ts:type:DetailGraph:28"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:directoryGrouping:270"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:parentFileOf:256"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:type:Grouping:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/contracts/layers.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/layers.ts:function:defaultLayerOf:11"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/layers.ts:function:matchTestTargets:48"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/contracts/modules.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:function:defaultModuleIdOf:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:applyGraphChanges:329"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:containsPoint:75"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/kernel/reach.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/reach.ts:function:reachSubgraph:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:type:Rng:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/kernel/scc.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/scc.ts:function:cyclicComponents:94"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/apiView.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:apiModuleIdOf:16"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:applySymbolBudget:162"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:buildApiGraph:90"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/apiView.ts:function:splitApiBoundary:36"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/callHierarchyClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/callHierarchyClient.ts:function:fetchCallHierarchy:60"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/callHierarchyClient.ts:function:refsToEdges:42"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/cfgClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/cfgClient.ts:function:cfgRequestOf:11"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/cfgClient.ts:function:fetchCfg:28"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/CfgLayer.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgEntry:21"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/Controls.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/Controls.tsx:function:Controls:76"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/Controls.tsx:type:PlaygroundParams:24"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/fixtureAdapter.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotSymbolEdges:122"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotSymbols:148"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotToAtlasGraph:61"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotLike:51"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/history.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/history.ts:function:buildHistoryIndex:33"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/history.ts:type:HistoryEntry:6"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/history.ts:type:HistoryIndex:25"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/mapShared.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:INK:69"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:makeTopAncestorOf:229"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:MAP_BG:66"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:MUTED_INK:70"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:PAGE_BG:65"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:PANEL_BG:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:PANEL_BORDER:68"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SELECT_STROKE:36"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:setMapTheme:94"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/ringsController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:applyRingsChanges:236"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:createRingsState:169"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:stepRingsState:209"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:type:RingsState:60"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/RingsMapSvg.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/RingsMapSvg.tsx:function:RingsMapSvg:152"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/synthetic.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:createSyntheticGraph:100"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:synthesizeSymbolEdges:62"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:synthesizeSymbols:29"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/treemapController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:applyTreemapChanges:207"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:createTreemapState:79"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:stepTreemapState:177"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:type:TreemapState:64"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/TreemapSvg.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/TreemapSvg.tsx:function:TreemapSvg:103"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "file:src/atlas/playground/viewConfig.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:granularityOf:16"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:hiddenLayersOf:72"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:reweightByTransitiveComplexity:165"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:showsSymbolLevels:77"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/App.tsx",
   "to": "unresolved:src/atlas/playground/App.tsx:./fixtures/sprawlens.ts",
   "resolved": false
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/build.bench.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/build.bench.ts",
   "to": "file:src/atlas/playground/fixtureAdapter.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotToAtlasGraph:61"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotLike:51"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/build.bench.ts",
   "to": "file:src/atlas/playground/ringsController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:createRingsState:169"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/build.bench.ts",
   "to": "file:src/atlas/playground/treemapController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:createTreemapState:79"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/callHierarchyClient.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/callHierarchyClient.test.ts",
   "to": "file:src/atlas/playground/callHierarchyClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/callHierarchyClient.ts:function:refsToEdges:42"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/callHierarchyClient.ts:function:resolveRef:21"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/callHierarchyClient.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/cfgClient.ts",
   "to": "file:src/atlas/contracts/detail.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/detail.ts:type:DetailGraph:28"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/CfgLayer.tsx",
   "to": "file:src/atlas/contracts/detail.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/detail.ts:type:DetailGraph:28"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/CfgLayer.tsx",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/CfgLayer.tsx",
   "to": "file:src/atlas/kernel/cfgLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/cfgLayout.ts:function:layoutCfg:32"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/CfgLayer.tsx",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/CfgLayer.tsx",
   "to": "file:src/atlas/playground/mapShared.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:FILE_LABEL_INK:47"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:MACRO_EDGE:41"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SELECT_STROKE:36"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/Controls.tsx",
   "to": "file:src/atlas/playground/viewConfig.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:variable:BOUNDARY_LEVELS:32"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:variable:DISPLAY_LEVELS:52"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:granularityOf:16"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:variable:OMIT_SCOPES:69"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:presetConfig:142"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:presetOf:129"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:variable:UNAVAILABLE_LEVELS:60"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:variable:VIEW_PRESETS:96"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:type:BoundaryLevel:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:type:DisplayLevel:46"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:type:OmitScope:68"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:type:ViewConfig:83"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:type:WeightKind:81"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/edgePick.test.ts",
   "to": "file:src/atlas/playground/edgePick.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:function:distanceToPolyline:21"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:function:pickNearestEdge:64"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:type:EdgePickCandidate:32"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/edgePick.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/fixtureAdapter.test.ts",
   "to": "file:src/atlas/playground/fixtureAdapter.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotSymbolEdges:122"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotSymbols:148"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:function:snapshotToAtlasGraph:61"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotLike:51"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/fixtureAdapter.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:SymbolKind:29"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/history.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/history.test.ts",
   "to": "file:src/atlas/playground/history.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/history.ts:function:buildHistoryIndex:33"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/history.ts:function:diffGraphs:76"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/history.ts:type:HistoryEntry:6"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/history.ts",
   "to": "file:src/atlas/contracts/delta.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/delta.ts:function:diffGraphs:42"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/history.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/history.ts",
   "to": "file:src/atlas/playground/fixtureAdapter.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/fixtureAdapter.ts:type:SnapshotLike:51"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/labelLayout.bench.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/labelLayout.bench.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/main.tsx",
   "to": "file:src/atlas/playground/App.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/App.tsx:function:App:184"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/kernel/bundling.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/bundling.ts:function:bundlePath:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/bundling.ts:function:hierarchyControlPoints:17"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/playground/cfgClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/cfgClient.ts:function:symbolNameOf:22"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/playground/CfgLayer.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgAnchor:235"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/playground/subdivision.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:type:SubdivisionLevel:43"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/mapShared.tsx",
   "to": "file:src/atlas/playground/useMapViewport.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusView:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.test.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:directoryGrouping:270"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.test.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:containsPoint:75"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.test.ts",
   "to": "file:src/atlas/playground/ringsController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:applyRingsChanges:236"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:createRingsState:169"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:function:stepRingsState:209"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.test.ts",
   "to": "file:src/atlas/playground/synthetic.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:createSyntheticGraph:100"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNodeKind:11"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:deriveLevels:72"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:type:Grouping:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:type:LevelTree:39"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/contracts/modules.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:type:ModuleIdOf:9"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:applyGraphChanges:329"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/kernel/centrality.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/centrality.ts:function:centralityRings:57"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/centrality.ts:function:dependentWeights:13"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/centrality.ts:function:importanceScore:31"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/kernel/pipeline.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:createGraphLayout:93"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:embedSeedHints:57"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:forceIterationsFor:41"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/kernel/ringLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringLayout.ts:function:ringLayout:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/ringLayout.ts:type:PlacedCircle:18"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/ringsController.ts",
   "to": "file:src/atlas/playground/subdivision.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:variable:DECLUMP_ITERATIONS:64"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:seedLeafLayout:315"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:subdivideUnder:202"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:type:SubdivisionLevel:43"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:SymbolKind:29"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/cfgClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/cfgClient.ts:function:symbolNameOf:22"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/CfgLayer.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:function:CfgLayer:451"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:function:cfgAnchorsOf:243"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgEntry:21"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/edgePick.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_DOMINANCE:54"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_NODE_PX:47"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_PX:43"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:function:pickNearestEdge:64"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:type:EdgePickCandidate:32"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/mapShared.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:ACTIVE_EDGE:42"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:CIRCLE_CYCLE_FILL:45"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:CIRCLE_FILL:43"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:CIRCLE_STROKE:44"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:DIM:22"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:DOWNSTREAM_COLOR:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:DOWNSTREAM_FILL:33"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:ExitPreviewsLayer:517"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:EXPORTED_DOT:63"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:EXPORTED_LABEL:214"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:FILE_LABEL_INK:47"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:focusDimOf:253"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:INTERNAL_LABEL:215"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:LEAF_STROKE:38"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:LEAF_BORDER_MIN_PX:205"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:MACRO_EDGE:41"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:MODULE_LABEL_INK:46"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:PORT_FILL:50"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_DOMINANT_FRACTION:212"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_KIND_COLORS:54"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_EDGE:40"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_STROKE:39"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_ZOOM:209"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:TEST_LABEL_INK:48"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:InnerLevelsLayer:294"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:isWatermarkSized:450"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:leafFillOf:281"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:makeEdgeBundler:704"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:makeTopAncestorOf:229"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:RaisedEdgePath:657"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:selectionDirections:473"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SELECT_STROKE:36"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:UPSTREAM_COLOR:32"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:UPSTREAM_FILL:34"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:WatermarkLabelsLayer:385"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/ringsController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/ringsController.ts:type:RingsState:60"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/symbolIcons.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/symbolIcons.tsx:function:SymbolTag:61"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/symbolIcons.tsx:function:symbolGlyphOf:20"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/useMapViewport.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusRequest:6"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusView:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/RingsMapSvg.tsx",
   "to": "file:src/atlas/playground/viewCulling.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewCulling.ts:function:segmentInView:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNodeKind:11"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:type:LevelTree:39"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/assignment.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/assignment.ts:function:minCostAssignment:12"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/clip.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipCenter:126"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/clip.ts:function:clipToRing:16"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/forceLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:function:createForceLayout:53"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/forceLayout.ts:function:forceStep:108"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/neighborhood.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:cellAdjacency:14"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:greedySwapAssignment:59"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/pipeline.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:embedSeedHints:57"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:centroid:19"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:type:Ring:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/subdivision.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/symbolIcons.tsx",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:SymbolKind:29"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/synthetic.test.ts",
   "to": "file:src/atlas/playground/synthetic.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:createSyntheticGraph:100"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:synthesizeSymbolEdges:62"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/synthetic.ts:function:synthesizeSymbols:29"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/synthetic.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/synthetic.ts",
   "to": "file:src/atlas/kernel/rng.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/rng.ts:function:createRng:4"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.test.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:directoryGrouping:270"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.test.ts",
   "to": "file:src/atlas/kernel/neighborhood.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:cellAdjacency:14"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/neighborhood.ts:function:realizedEdgeRate:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.test.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:containsPoint:75"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.test.ts",
   "to": "file:src/atlas/playground/treemapController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:applyTreemapChanges:207"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:createTreemapState:79"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:function:stepTreemapState:177"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:type:TreemapState:64"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNodeKind:11"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/contracts/hierarchy.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:deriveLevels:72"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:function:moduleGrouping:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/hierarchy.ts:type:Grouping:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/contracts/modules.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/modules.ts:type:ModuleIdOf:9"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:applyGraphChanges:329"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:capacityStep:263"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:createCapacityLayout:164"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:function:isConverged:311"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CapacityLayoutState:52"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/kernel/pipeline.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:createGraphLayout:93"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:embedSeedHints:57"
    },
    {
     "toSymbolId": "symbol:src/atlas/kernel/pipeline.ts:function:forceIterationsFor:41"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/kernel/polygon.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/polygon.ts:function:nearestPointInRing:104"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/treemapController.ts",
   "to": "file:src/atlas/playground/subdivision.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:assignedSlotHints:117"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:variable:DECLUMP_ITERATIONS:64"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:insetRing:68"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:variable:NEST_INSET:62"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:seedLeafLayout:315"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:solveLevel:167"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:function:subdivideUnder:202"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/subdivision.ts:type:SubdivisionLevel:43"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:SymbolKind:29"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/kernel/capacityLayout.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/capacityLayout.ts:type:CellResult:38"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/cfgClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/cfgClient.ts:function:symbolNameOf:22"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/CfgLayer.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:function:CfgLayer:451"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:function:cfgAnchorsOf:243"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/CfgLayer.tsx:type:CfgEntry:21"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/edgePick.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_DOMINANCE:54"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_NODE_PX:47"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:variable:EDGE_PICK_PX:43"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:function:pickEdgeAtPoint:95"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/edgePick.ts:type:EdgePickCandidate:32"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/mapShared.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:ACTIVE_EDGE:42"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:BUNDLE_STRENGTH:679"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:districtFill:81"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:districtLabelFill:85"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:districtStroke:83"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:DOWNSTREAM_COLOR:31"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:ExitPreviewsLayer:517"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:EXPORTED_LABEL:214"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:FILE_LABEL_INK:47"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:INTERNAL_LABEL:215"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:LEAF_STROKE:38"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:LEAF_BORDER_MIN_PX:205"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:makeEdgeBundler:704"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_DOMINANT_FRACTION:212"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_KIND_COLORS:54"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_STROKE:39"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SYMBOL_ZOOM:209"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:selectionDirections:473"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:focusDimOf:253"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:InnerLevelsLayer:294"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:isWatermarkSized:450"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:leafFillOf:281"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:makeTopAncestorOf:229"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:RaisedEdgePath:657"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:SELECT_STROKE:36"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:variable:UPSTREAM_COLOR:32"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/mapShared.tsx:function:WatermarkLabelsLayer:385"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/symbolIcons.tsx",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/symbolIcons.tsx:function:SymbolTag:61"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/symbolIcons.tsx:function:symbolGlyphOf:20"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/treemapController.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/treemapController.ts:type:TreemapState:64"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/useMapViewport.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/useMapViewport.ts:function:useMapViewport:48"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusRequest:6"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/useMapViewport.ts:type:FocusView:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/TreemapSvg.tsx",
   "to": "file:src/atlas/playground/viewCulling.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewCulling.ts:function:cellInView:22"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewCulling.ts:function:segmentInView:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/useMapViewport.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/useMapViewport.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/viewConfig.test.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/viewConfig.test.ts",
   "to": "file:src/atlas/playground/viewConfig.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:presetConfig:142"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:presetOf:129"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:function:reweightByTransitiveComplexity:165"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:variable:VIEW_PRESETS:96"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewConfig.ts:type:ViewConfig:83"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/viewConfig.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasGraph:67"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/viewConfig.ts",
   "to": "file:src/atlas/kernel/transitiveWeight.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/transitiveWeight.ts:function:transitiveWeights:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/viewCulling.test.ts",
   "to": "file:src/atlas/playground/viewCulling.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/playground/viewCulling.ts:function:cellInView:22"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewCulling.ts:function:pointInView:7"
    },
    {
     "toSymbolId": "symbol:src/atlas/playground/viewCulling.ts:function:segmentInView:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/playground/viewCulling.ts",
   "to": "file:src/atlas/kernel/vec.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/kernel/vec.ts:type:Vec2:1"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/callHierarchy.test.ts",
   "to": "file:src/atlas/server/callHierarchyProvider.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/callHierarchyProvider.ts:function:callHierarchy:51"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/callHierarchy.test.ts",
   "to": "file:src/atlas/server/lspClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/lspClient.ts:class:LspClient:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/callHierarchyProvider.ts",
   "to": "file:src/atlas/server/lspClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/lspClient.ts:class:LspClient:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/cfgProvider.test.ts",
   "to": "file:src/atlas/server/cfgProvider.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/cfgProvider.ts:function:extractCfg:543"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/cfgProvider.ts",
   "to": "file:src/atlas/contracts/detail.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/detail.ts:type:DetailGraph:28"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/cfgProvider.ts",
   "to": "file:src/atlas/contracts/graph.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasEdge:56"
    },
    {
     "toSymbolId": "symbol:src/atlas/contracts/graph.ts:type:AtlasNode:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/index.ts",
   "to": "file:src/atlas/server/callHierarchyProvider.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/callHierarchyProvider.ts:function:callHierarchy:51"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/index.ts",
   "to": "file:src/atlas/server/cfgProvider.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/cfgProvider.ts:function:extractCfg:543"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/index.ts",
   "to": "file:src/atlas/server/lspClient.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/lspClient.ts:class:LspClient:13"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/index.ts",
   "to": "file:src/atlas/server/workingDiff.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:enrichWithLoc:33"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:isSafeRef:101"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:watchWorkingDiff:151"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:workingDiff:113"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/jsonRpc.test.ts",
   "to": "file:src/atlas/server/jsonRpc.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/jsonRpc.ts:function:encodeMessage:6"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/jsonRpc.ts:class:JsonRpcReader:16"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/lspClient.ts",
   "to": "file:src/atlas/server/jsonRpc.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/jsonRpc.ts:function:encodeMessage:6"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/jsonRpc.ts:class:JsonRpcReader:16"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/atlas/server/workingDiff.test.ts",
   "to": "file:src/atlas/server/workingDiff.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:countLines:21"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:isIgnoredPath:138"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:isSafeRef:101"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:parseGitStatus:50"
    },
    {
     "toSymbolId": "symbol:src/atlas/server/workingDiff.ts:function:parseNameStatus:77"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/cli/index.ts",
   "to": "file:src/core/collect.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/collect.ts:function:analyzeRepository:85"
    },
    {
     "toSymbolId": "symbol:src/core/collect.ts:function:collectRepository:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/ai.test.ts",
   "to": "file:src/core/ai.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/ai.ts:function:detectAIIndicators:17"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/ai.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:AIIndicator:1"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CommitAIInfo:10"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CommitMetadataInput:16"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/collect.test.ts",
   "to": "file:src/core/collect.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/collect.ts:function:analyzeRealtimeRepository:112"
    },
    {
     "toSymbolId": "symbol:src/core/collect.ts:function:analyzeRepository:85"
    },
    {
     "toSymbolId": "symbol:src/core/collect.ts:function:collectRepository:37"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/collect.ts",
   "to": "file:src/core/ai.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/ai.ts:function:detectAIIndicators:17"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/collect.ts",
   "to": "file:src/core/diff.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/diff.ts:function:diffSnapshots:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/collect.ts",
   "to": "file:src/core/snapshot.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/snapshot.ts:function:createSnapshotFromWorkingTree:49"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/collect.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodesprawlConfig:196"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CommitRecord:207"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:GraphDiff:183"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:Snapshot:134"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:SnapshotCommit:25"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/diff.test.ts",
   "to": "file:src/core/diff.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/diff.ts:function:diffSnapshots:14"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/diff.test.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:Snapshot:134"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/diff.ts",
   "to": "file:src/core/metrics.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/metrics.ts:function:computeGraphMetrics:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/diff.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:ChangedFile:156"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeEdge:120"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:FileNode:47"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:GraphDiff:183"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:Hotspot:177"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:HotspotReason:167"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:ImportsEdge:109"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:Snapshot:134"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:SnapshotMetrics:122"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/metrics.test.ts",
   "to": "file:src/core/metrics.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/metrics.ts:function:computeGraphMetrics:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/metrics.test.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeEdge:120"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeNode:57"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/metrics.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeEdge:120"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeNode:57"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:FileGraphMetric:143"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:FileNode:47"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:ImportsEdge:109"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:MetricsComputation:149"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:SnapshotMetrics:122"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/snapshot.test.ts",
   "to": "file:src/core/snapshot.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/snapshot.ts:function:createSnapshotFromWorkingTree:49"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/snapshot.ts",
   "to": "file:src/core/metrics.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/metrics.ts:function:computeGraphMetrics:19"
    }
   ]
  },
  {
   "type": "imports",
   "from": "file:src/core/snapshot.ts",
   "to": "file:src/core/types.ts",
   "resolved": true,
   "symbolImports": [
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeEdge:120"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeImportBinding:88"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeImportBindingKind:86"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeNode:57"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeSymbol:72"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeSymbolImport:95"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:CodeSymbolKind:59"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:FileNode:47"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:Snapshot:134"
    },
    {
     "toSymbolId": "symbol:src/core/types.ts:type:SnapshotCommit:25"
    }
   ]
  }
 ]
};
