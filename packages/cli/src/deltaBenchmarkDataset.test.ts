import { mkdtemp, mkdir, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDeltaLayoutBenchmark } from "@sprawlens/layout";
import {
  benchmarkBatchToCsv,
  benchmarkResultToCsv,
  classifyDatasetExclusion,
  loadCodesprawlBenchmarkCases,
  parseBenchmarkArgs,
  runRepositoryBenchmarkBatch,
} from "./deltaBenchmarkDataset.ts";

const snapshot = (hash: string, timestamp: string, loc: number, extra = false) => ({
  schemaVersion: 1,
  repoPath: "/tmp/example",
  commit: {
    hash,
    shortHash: hash,
    timestamp,
    authorName: "test",
    message: hash,
    aiIndicators: [],
  },
  nodes: [
    { id: "file:src/a.ts", type: "file", path: "src/a.ts", ext: ".ts", loc, sizeBytes: 1 },
    { id: "file:src/b.ts", type: "file", path: "src/b.ts", ext: ".ts", loc: 2, sizeBytes: 1 },
    ...(extra
      ? [
          {
            id: "file:src/c.ts",
            type: "file",
            path: "src/c.ts",
            ext: ".ts",
            loc: 3,
            sizeBytes: 1,
          },
        ]
      : []),
  ],
  edges: [
    {
      id: "edge:a-b",
      type: "imports",
      from: "file:src/a.ts",
      to: "file:src/b.ts",
      resolved: true,
    },
  ],
  metrics: {},
});

async function writeCorpus(name: string) {
  const root = await mkdtemp(join(tmpdir(), `${name}-`));
  const dir = join(root, ".codesprawl");
  await mkdir(join(dir, "snapshots"), { recursive: true });
  await writeFile(join(dir, "config.json"), JSON.stringify({ repoPath: `/tmp/${name}` }));
  await writeFile(
    join(dir, "snapshots", "c2.json"),
    JSON.stringify(snapshot("c2", "2026-01-02T00:00:00Z", 5, true)),
  );
  await writeFile(
    join(dir, "snapshots", "c1.json"),
    JSON.stringify(snapshot("c1", "2026-01-01T00:00:00Z", 1)),
  );
  return { root, dir };
}

const groupedSnapshot = (hash: string, timestamp: string, changedLoc: number) => ({
  ...snapshot(hash, timestamp, changedLoc),
  nodes: [
    {
      id: "file:src/area/a.ts",
      type: "file",
      path: "src/area/a.ts",
      ext: ".ts",
      loc: changedLoc,
      sizeBytes: 1,
    },
    {
      id: "file:src/area/b.ts",
      type: "file",
      path: "src/area/b.ts",
      ext: ".ts",
      loc: 2,
      sizeBytes: 1,
    },
    {
      id: "file:src/other/c.ts",
      type: "file",
      path: "src/other/c.ts",
      ext: ".ts",
      loc: 3,
      sizeBytes: 1,
    },
    {
      id: "file:src/other/d.ts",
      type: "file",
      path: "src/other/d.ts",
      ext: ".ts",
      loc: 4,
      sizeBytes: 1,
    },
  ],
  edges: [],
});

async function writeGroupedCorpus(name: string) {
  const root = await mkdtemp(join(tmpdir(), `${name}-`));
  const dir = join(root, ".codesprawl");
  await mkdir(join(dir, "snapshots"), { recursive: true });
  await writeFile(join(dir, "config.json"), JSON.stringify({ repoPath: `/tmp/${name}` }));
  await writeFile(
    join(dir, "snapshots", "c1.json"),
    JSON.stringify(groupedSnapshot("c1", "2026-01-01T00:00:00Z", 1)),
  );
  await writeFile(
    join(dir, "snapshots", "c2.json"),
    JSON.stringify(groupedSnapshot("c2", "2026-01-02T00:00:00Z", 5)),
  );
  return root;
}

describe("delta benchmark dataset", () => {
  it("loads chronological graph pairs from a .codesprawl directory", async () => {
    const { root, dir } = await writeCorpus("example");

    const loaded = await loadCodesprawlBenchmarkCases(root, { minNodes: 2, maxNodes: 10 });

    expect(loaded.repository).toBe("example");
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.snapshotCount).toBe(2);
    expect(loaded.pairCount).toBe(1);
    expect(loaded.grouping).toEqual({ kind: "module" });
    expect(loaded.observed).toEqual({
      snapshotsWithNodes: 2,
      minSnapshotNodes: 2,
      maxSnapshotNodes: 3,
    });
    expect(loaded.cases).toHaveLength(1);
    expect(loaded.sequences).toHaveLength(0);
    expect(loaded.sequenceSelection.minSnapshots).toBe(3);
    expect(loaded.selection).toEqual({
      minNodes: 2,
      maxNodes: 10,
      candidateGroups: 1,
      included: 1,
      excluded: { tooSmall: 0, tooLarge: 0, unchanged: 0 },
    });
    expect(loaded.cases[0]?.name).toContain("c1..c2");

    const external = join(root, "benchmark-data");
    await rename(dir, external);
    const direct = await loadCodesprawlBenchmarkCases(external, { minNodes: 2, maxNodes: 10 });
    expect(direct.cases).toHaveLength(1);
  });

  it("forms cases explicitly by module, directory depth, or repository", async () => {
    const root = await writeGroupedCorpus("grouped");

    const moduleCases = await loadCodesprawlBenchmarkCases(root, {
      grouping: "module",
      minNodes: 2,
      maxNodes: 10,
    });
    const shallowDirectoryCases = await loadCodesprawlBenchmarkCases(root, {
      grouping: "directory",
      directoryDepth: 1,
      minNodes: 2,
      maxNodes: 10,
    });
    const deepDirectoryCases = await loadCodesprawlBenchmarkCases(root, {
      grouping: "directory",
      directoryDepth: 2,
      minNodes: 2,
      maxNodes: 10,
    });
    const repositoryCases = await loadCodesprawlBenchmarkCases(root, {
      grouping: "repository",
      minNodes: 2,
      maxNodes: 10,
    });

    expect(moduleCases.grouping).toEqual({ kind: "module" });
    expect(moduleCases.selection).toMatchObject({ candidateGroups: 2, included: 1 });
    expect(shallowDirectoryCases.grouping).toEqual({ kind: "directory", maxDepth: 1 });
    expect(shallowDirectoryCases.selection).toMatchObject({ candidateGroups: 1, included: 1 });
    expect(deepDirectoryCases.grouping).toEqual({ kind: "directory", maxDepth: 2 });
    expect(deepDirectoryCases.selection).toMatchObject({ candidateGroups: 2, included: 1 });
    expect(repositoryCases.grouping).toEqual({ kind: "repository" });
    expect(repositoryCases.selection).toMatchObject({ candidateGroups: 1, included: 1 });
    await expect(
      loadCodesprawlBenchmarkCases(root, { grouping: "directory", directoryDepth: 0 }),
    ).rejects.toThrow(/directoryDepth/);
  });

  it("classifies zero-case datasets from their observed and selection diagnostics", async () => {
    const { root } = await writeCorpus("classified");
    const dataset = await loadCodesprawlBenchmarkCases(root, { minNodes: 2, maxNodes: 10 });

    expect(
      classifyDatasetExclusion({
        ...dataset,
        pairCount: 0,
        cases: [],
      }),
    ).toEqual({ code: "insufficient-history" });
    expect(
      classifyDatasetExclusion({
        ...dataset,
        cases: [],
        observed: { ...dataset.observed, snapshotsWithNodes: 0 },
      }),
    ).toEqual({ code: "no-analyzable-nodes" });
    expect(
      classifyDatasetExclusion({
        ...dataset,
        cases: [],
        selection: {
          ...dataset.selection,
          included: 0,
          candidateGroups: 4,
          excluded: { tooSmall: 4, tooLarge: 0, unchanged: 0 },
        },
      }),
    ).toEqual({ code: "all-groups-too-small" });
    expect(
      classifyDatasetExclusion({
        ...dataset,
        cases: [],
        selection: {
          ...dataset.selection,
          included: 0,
          candidateGroups: 4,
          excluded: { tooSmall: 2, tooLarge: 0, unchanged: 2 },
        },
      }),
    ).toEqual({ code: "mixed-selection-exclusions" });
    expect(
      classifyDatasetExclusion({
        ...dataset,
        cases: [],
        selection: {
          ...dataset.selection,
          included: 0,
          candidateGroups: 0,
          excluded: { tooSmall: 0, tooLarge: 0, unchanged: 0 },
        },
      }),
    ).toEqual({ code: "no-candidate-groups" });
    expect(
      classifyDatasetExclusion({
        ...dataset,
        cases: [],
        selection: {
          ...dataset.selection,
          included: 0,
          candidateGroups: 1,
          excluded: { tooSmall: 0, tooLarge: 1, unchanged: 0 },
        },
      }),
    ).toEqual({ code: "all-groups-too-large" });
    expect(
      classifyDatasetExclusion({
        ...dataset,
        cases: [],
        selection: {
          ...dataset.selection,
          included: 0,
          candidateGroups: 1,
          excluded: { tooSmall: 0, tooLarge: 0, unchanged: 1 },
        },
      }),
    ).toEqual({ code: "all-groups-unchanged" });
  });

  it("keeps repository results separate and summarizes repository means", async () => {
    const first = await writeCorpus("repo-a");
    const second = await writeCorpus("repo-b");
    const datasets = await Promise.all(
      [first.root, second.root].map((root) =>
        loadCodesprawlBenchmarkCases(root, { minNodes: 2, maxNodes: 10 }),
      ),
    );

    const batch = runRepositoryBenchmarkBatch(datasets, { seeds: [3] });

    expect(batch.schemaVersion).toBe(3);
    expect(batch.repositories.map((entry) => entry.dataset.repository)).toEqual([
      "repo-a",
      "repo-b",
    ]);
    expect(
      batch.repositorySummary.contrasts!.stableNeighborhoodVsNeighborhoodSwap.displacementReduction
        .n,
    ).toBe(2);
    expect(
      batch.repositorySummary.contrasts!.stableNeighborhoodVsNeighborhoodSwap
        .centroidDisplacementReduction.n,
    ).toBe(2);
    expect(
      batch.repositorySummary.contrasts!.stableNeighborhoodVsNeighborhoodSwap
        .polygonIoULossReduction.n,
    ).toBe(2);
    expect(
      batch.repositorySummary.contrasts!.stableNeighborhoodVsNeighborhoodSwap
        .boundaryDisplacementReduction.n,
    ).toBe(2);
    expect(
      batch.repositorySummary.contrasts!.stableNeighborhoodVsNeighborhoodSwap
        .distanceChangeFaithfulnessErrorReduction.n,
    ).toBe(2);
    expect(batch.repositorySummary.unit).toBe("repository mean paired difference");
    expect(batch.repositories[0]!.stableSelection!.trials).toBeGreaterThan(0);
    expect(batch.repositories[0]!.stableSelection!.anchorMixCounts).toEqual(
      expect.objectContaining({ "0": expect.any(Number) }),
    );
    expect(batch.repositories[0]!.stableSelection!.swapPassCounts).toEqual({ "8": 1 });
    expect(batch.repositorySummary.stableSelection!.swapPassCounts).toEqual({ "8": 2 });
    expect(batch.repositorySummary.stableSelection!.fallbackRate.n).toBe(2);
    expect(batch.repositorySummary.stableSelection!.noDisplacementGainRate.n).toBe(2);
    expect(batch.repositorySummary.stableSelection!.meanWeightedSolves.n).toBe(2);
    const csv = benchmarkBatchToCsv(batch);
    expect(csv.split("\n")[0]).toMatch(/^repository,scenario,seed,condition/);
    expect(csv).toContain("repo-a,");
    expect(csv).toContain("repo-b,");
    expect(() => runRepositoryBenchmarkBatch([datasets[0]!, datasets[0]!], { seeds: [3] })).toThrow(
      "duplicate repository",
    );
    const empty = {
      ...datasets[0]!,
      repository: "repo-empty",
      cases: [],
      selection: {
        ...datasets[0]!.selection,
        included: 0,
        candidateGroups: 1,
        excluded: { tooSmall: 1, tooLarge: 0, unchanged: 0 },
      },
    };
    const withExcluded = runRepositoryBenchmarkBatch([datasets[0]!, empty], { seeds: [3] });
    expect(withExcluded.repositories[1]).toMatchObject({
      benchmark: null,
      exclusion: { code: "all-groups-too-small" },
    });
    expect(withExcluded.repositorySummary.includedRepositories).toBe(1);
    expect(withExcluded.repositorySummary.excludedRepositories).toBe(1);
    expect(
      withExcluded.repositorySummary.contrasts!.stableNeighborhoodVsNeighborhoodSwap
        .displacementReduction.n,
    ).toBe(1);
    const allExcluded = runRepositoryBenchmarkBatch([empty], { seeds: [3] });
    expect(allExcluded.repositories[0]).toMatchObject({
      benchmark: null,
      exclusion: { code: "all-groups-too-small" },
    });
    expect(allExcluded.repositorySummary).toMatchObject({
      includedRepositories: 0,
      excludedRepositories: 1,
      contrasts: null,
      stableSelection: null,
    });
  });

  it("reports repository-level progress without changing benchmark results", async () => {
    const first = await writeCorpus("progress-a");
    const second = await writeCorpus("progress-b");
    const datasets = await Promise.all(
      [first.root, second.root].map((root) =>
        loadCodesprawlBenchmarkCases(root, { minNodes: 2, maxNodes: 10 }),
      ),
    );
    const events: Array<Record<string, unknown>> = [];

    const batch = runRepositoryBenchmarkBatch(datasets, {
      seeds: [3],
      onRepository: (event) => events.push(event),
    });

    expect(batch.repositorySummary.includedRepositories).toBe(2);
    expect(events).toEqual([
      { index: 1, total: 2, repository: "progress-a", cases: 1, status: "analyzed" },
      { index: 2, total: 2, repository: "progress-b", cases: 1, status: "analyzed" },
    ]);
  });

  it("emits one CSV row per scenario, seed, and condition", () => {
    const result = runDeltaLayoutBenchmark({ seeds: [3, 7] });
    const csv = benchmarkResultToCsv(result);
    const rows = csv.trim().split("\n");

    expect(rows[0]).toBe(
      "scenario,seed,condition,converged,nodes_before,nodes_after,edges_after,max_area_error,mean_area_error,adjacency,edge_length,displacement,centroid_displacement,boundary_displacement,polygon_iou_loss,relative_direction_change,distance_change_faithfulness_error,distance_change_pair_count,constraint_path_median,constraint_path_max,constraint_disconnected_rate,constraint_edge_count,objective,steps,stable_anchor_mix,stable_swap_passes,stable_candidate_count,stable_eligible_candidates,stable_weighted_solves,compute_matched_variant,compute_matched_candidate_count,compute_matched_eligible_candidates,compute_matched_weighted_solves,compute_matched_requested_weighted_solves,compute_matched_budget_matched",
    );
    expect(rows).toHaveLength(1 + 3 * 2 * 9);
    expect(rows[1]).toContain("weight-shift,3,squarified,true");
    expect(rows[2]).toContain("weight-shift,3,cold,true");
    expect(rows[3]).toContain("weight-shift,3,warm,true");
    expect(rows[4]).toContain("weight-shift,3,neighborhoodSwap,true");
    expect(rows[5]).toContain("weight-shift,3,stableNeighborhood,true");
    expect(rows[6]).toContain("weight-shift,3,computeMatchedNeighborhood,true");
    expect(rows[9]).toContain("weight-shift,3,guided,true");
    expect(rows[6]?.split(",").at(-1)).toBe("true");
  });

  it("parses reproducible CLI options and rejects malformed seeds", () => {
    expect(
      parseBenchmarkArgs([
        "--codesprawl",
        "repo",
        "--seeds",
        "3,7,11",
        "--format",
        "csv",
        "--stable-swap-passes",
        "0,1,8",
        "--grouping",
        "directory",
        "--directory-depth",
        "2",
        "--max-nodes",
        "40",
      ]),
    ).toEqual({
      codesprawl: ["repo"],
      seeds: [3, 7, 11],
      stableSwapPasses: [0, 1, 8],
      grouping: "directory",
      directoryDepth: 2,
      format: "csv",
      minNodes: 3,
      maxNodes: 40,
    });
    expect(
      parseBenchmarkArgs(["--codesprawl", "repo-a", "--codesprawl", "repo-b"]).codesprawl,
    ).toEqual(["repo-a", "repo-b"]);
    expect(() => parseBenchmarkArgs(["--seeds", "3,nope"])).toThrow(/seeds/);
    expect(() => parseBenchmarkArgs(["--stable-swap-passes", "0,1"])).toThrow(/include 8/);
    expect(() => parseBenchmarkArgs(["--grouping", "file"])).toThrow(/grouping/);
    expect(() => parseBenchmarkArgs(["--directory-depth", "0"])).toThrow(/directory-depth/);
    expect(parseBenchmarkArgs([])).toMatchObject({ grouping: "module", directoryDepth: 2 });
  });
});
