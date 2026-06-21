#!/usr/bin/env node
import { Command } from "commander";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  analyzeRepository,
  collectRepository,
  createLspDetail,
  tsCpuProfileAdapter,
  tsV8CoverageAdapter,
  vitestReportAdapter,
} from "@sprawlens/analyzer-ts";
import type {
  LanguageProvider,
  LayersConfig,
  ServiceGraph,
  Snapshot,
  TestCaseResult,
  TestRun,
  TestTree,
  Trace,
} from "@sprawlens/schema";
import {
  applyLayers,
  computeGraphMetrics,
  layerManifest,
  matchResourceFiles,
  parseFoldedStacks,
  parseLlvmCoverage,
  parseTestId,
  resolveServices,
  resolveTestRun,
  resolveTraceSymbols,
  serviceFileMap,
} from "@sprawlens/schema";
import { analyzeTerraform, hasTerraform } from "@sprawlens/analyzer-terraform";
import { PROVIDERS, detectProviders } from "@sprawlens/providers";
import { createAtlasServer, watchDir, workingDiff } from "@sprawlens/server";
import { readSprawlensConfig } from "./config.js";
import { renderTui, type ChangeKind } from "./tui.js";
import { runTuiApp } from "./tuiApp.js";

// read our own version so `--version` always matches the published package
// (../package.json relative to both src/index.ts in dev and dist/index.js when built)
const version = ((): string => {
  try {
    const url = new URL("../package.json", import.meta.url);
    return JSON.parse(readFileSync(url, "utf8")).version as string;
  } catch {
    return "0.0.0";
  }
})();

const program = new Command();

program
  .name("sprawlens")
  .description("Visualize the structure of a code repository")
  .version(version);

program
  .command("serve", { isDefault: true })
  .description("analyze a repo and open its structure map in the browser")
  .argument("[repo]", "repository path", ".")
  .option("--port <n>", "port", (v) => Number.parseInt(v, 10), 4173)
  .option("--lang <id>", "force a language provider (typescript|go|rust|moonbit)")
  .option("--no-open", "do not open the browser")
  .option(
    "--trace <path>",
    "overlay a runtime trace (.cpuprofile or folded/collapsed stacks)",
  )
  .option(
    "--test-report <path>",
    "overlay a test run (vitest --reporter=json output)",
  )
  .option(
    "--test-traces <path>",
    "per-test traces ({ testId: artifact }) linking each case to its source",
  )
  .action(
    async (
      repo: string,
      options: {
        port: number;
        open: boolean;
        lang?: string;
        trace?: string;
        testReport?: string;
        testTraces?: string;
      },
    ): Promise<void> => {
      const root = resolve(repo);
      const name = basename(root);
      // sprawlens.toml customizes the layer system and can force a language;
      // an explicit --lang still wins over the config's lang.
      const config = (await readSprawlensConfig(root)) ?? {};
      const provider = await chooseProvider(root, options.lang ?? config.lang);
      const tfRoot = config.terraform?.root;
      const terraformPresent = await hasTerraform(root, tfRoot);
      // an infra-only repo (terraform, no code) still gets the service layer;
      // only bail when neither a language provider nor terraform is present.
      if (!provider && !terraformPresent) {
        process.exitCode = 1;
        return;
      }

      // a live analyzer drives fs-watch updates: incremental (re-parse only
      // changed files) when the provider supports it, else full re-analysis.
      // applyLayers stamps each snapshot (initial + live) from the toml config.
      let analyze: (() => Promise<Snapshot>) | undefined;
      let detail = provider?.detail;
      if (provider) {
        const p = provider;
        console.log(`analyzing ${root} (${p.id}) …`);
        const incremental = p.createIncrementalAnalyzer?.(root);
        const rawAnalyze = incremental
          ? () => incremental.analyze()
          : () => p.analyze(root);
        analyze = async (): Promise<Snapshot> =>
          applyLayers(await rawAnalyze(), config);
        // prefer an LSP for deep detail when one is installed: TS already drives
        // its own (LSP + compiler CFG); the others ship a static tree-sitter
        // detail that we upgrade to an LSP (hover + call hierarchy) here.
        const lsp = LSP_SERVERS[p.id];
        if (lsp && p.id !== "typescript" && lspAvailable(lsp.command)) {
          detail = createLspDetail(lsp);
          console.log(`  detail: ${lsp.command} (LSP: hover · call-hierarchy)`);
        }
      } else {
        console.log(
          `no language provider matched ${root}; serving the terraform service layer only`,
        );
      }
      const snapshot = analyze ? await analyze() : emptySnapshot(root, name);
      const fileCount = snapshot.nodes.filter((n) => n.type === "file").length;
      console.log(
        `  ${fileCount} files, ${snapshot.edges.length} edges` +
          (analyze ? " (live)" : " (terraform-only)"),
      );

      const vizDist = resolveVizDist();
      if (!vizDist) {
        console.error(
          "viz build not found. Run `pnpm --filter @sprawlens/viz build` first.",
        );
        process.exitCode = 1;
        return;
      }
      // the upper "service" layer: parse terraform (independent of the code
      // language) into a service graph, re-derived per request for live .tf
      // edits. Empty graph when the repo has no terraform. `fileServices` maps
      // code files to services (from the [[service]].source globs) so the viz
      // can nest the module map inside each service node (Phase B).
      const fileNodes = snapshot.nodes.filter(
        (n): n is Extract<typeof n, { type: "file" }> => n.type === "file",
      );
      const filePaths = fileNodes.map((n) => n.path);
      const fileLoc = new Map(fileNodes.map((n) => [n.path, n.loc ?? 0]));
      const fileServices = serviceFileMap(filePaths, config.services ?? []);
      // attach the code each terraform resource implements (its source-matched
      // snapshot files + their LOC) so the services view can place code inside
      // the resource when a service is expanded.
      const withResourceCode = (graph: ServiceGraph): ServiceGraph => ({
        ...graph,
        resources: graph.resources?.map((r) => {
          if (!r.source) return r;
          const files = matchResourceFiles(filePaths, r.source);
          const loc = files.reduce((sum, f) => sum + (fileLoc.get(f) ?? 0), 0);
          return { ...r, files, loc };
        }),
      });
      const services = terraformPresent
        ? async () =>
            withResourceCode({
              ...resolveServices(await analyzeTerraform(root, tfRoot), {
                services: config.services,
              }),
              fileServices,
            })
        : undefined;
      if (services) {
        const graph = await services();
        console.log(
          `  terraform: ${graph.services.length} services, ${graph.edges.length} links`,
        );
      }
      // ingest an out-of-band runtime trace and resolve its frames against this
      // snapshot's symbols, so the viz can light up the executed path.
      let trace: Trace | undefined;
      if (options.trace) {
        trace = loadTrace(options.trace, root, snapshot);
        if (trace) {
          const resolved = trace.nodes.filter((n) => n.ref.symbolId).length;
          console.log(
            `  trace: ${trace.source}, ${resolved}/${trace.nodes.length} frames resolved, ${trace.edges.length} edges`,
          );
        }
      }

      // ingest a test run (vitest json report); join case ids to the test tree
      // and resolve each case's covered symbols, so the viz tints the cases.
      let testRun: TestRun | undefined;
      if (options.testReport) {
        testRun = loadTestRun(options.testReport, root, snapshot);
        if (testRun) {
          const c = testRun.results.reduce(
            (acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc),
            {} as Record<string, number>,
          );
          console.log(
            `  test report: ${testRun.results.length} cases (${c.pass ?? 0} pass, ${c.fail ?? 0} fail, ${c.skip ?? 0} skip)`,
          );
        }
      }
      // per-test traces: link each case to the source symbols it exercised
      if (options.testTraces) {
        testRun = applyTestTraces(testRun, options.testTraces, root, snapshot);
        if (testRun) {
          const linked = testRun.results.filter((r) => r.covers?.length).length;
          console.log(`  test traces: ${linked} cases linked to source`);
        }
      }
      // click-to-run: enabled only when [test] command is set in sprawlens.toml
      const runTestCase = config.test?.command
        ? makeTestCaseRunner(root, config.test.command, snapshot)
        : undefined;
      if (runTestCase) console.log(`  test command: ${config.test!.command}`);

      const server = createAtlasServer({
        repos: new Map([[name, root]]),
        snapshots: new Map([[name, snapshot]]),
        analyzers: analyze ? new Map([[name, analyze]]) : undefined,
        vizDist,
        detail,
        layers: layerManifest(config),
        services,
        trace,
        testRun,
        runTestCase,
      });
      server.listen(options.port, "127.0.0.1", () => {
        const url = `http://127.0.0.1:${options.port}/`;
        console.log(`sprawlens: ${url}`);
        if (options.open) openBrowser(url);
      });
    },
  );

program
  .command("tui")
  .description(
    "print the repo's module/file/symbol treemap in the terminal (diff-tinted)",
  )
  .argument("[repo]", "repository path", ".")
  .option("--lang <id>", "force a language provider (typescript|go|rust|moonbit)")
  .option("--cols <n>", "grid width (default: terminal width)", (v) => Number.parseInt(v, 10))
  .option("--rows <n>", "grid height (default: terminal height)", (v) => Number.parseInt(v, 10))
  .option("--watch", "re-render on file changes")
  .option("-i, --interactive", "hover for full names, click/Enter to zoom")
  .option("--no-diff", "do not tint working-tree changes")
  .action(
    async (
      repo: string,
      options: {
        lang?: string;
        cols?: number;
        rows?: number;
        watch?: boolean;
        interactive?: boolean;
        diff: boolean;
      },
    ): Promise<void> => {
      const root = resolve(repo);
      const config = (await readSprawlensConfig(root)) ?? {};
      const provider = await chooseProvider(root, options.lang ?? config.lang);
      if (!provider) {
        process.exitCode = 1;
        return;
      }
      // incremental re-analysis keeps watch cheap when the provider supports it
      const incremental = provider.createIncrementalAnalyzer?.(root);
      const analyze = incremental
        ? () => incremental.analyze()
        : () => provider.analyze(root);

      const diffOf = async (): Promise<Map<string, ChangeKind> | undefined> => {
        if (!options.diff) return undefined;
        try {
          const diff = await workingDiff(root);
          return new Map(Object.entries(diff.changed));
        } catch {
          return undefined; // not a git repo, or git unavailable
        }
      };

      if (options.interactive && process.stdin.isTTY) {
        const snapshot = applyLayers(await analyze(), config);
        await runTuiApp({
          snapshot,
          changed: await diffOf(),
          repoName: basename(root),
          repoRoot: root,
        });
        return;
      }

      const render = async (): Promise<void> => {
        const snapshot = applyLayers(await analyze(), config);
        const changed = await diffOf();
        const cols = options.cols ?? process.stdout.columns ?? 80;
        const rows =
          options.rows ?? (process.stdout.rows ? process.stdout.rows - 1 : 30);
        const out = renderTui(snapshot, { cols, rows, changed });
        if (options.watch) process.stdout.write("\x1b[2J\x1b[H"); // clear + home
        process.stdout.write(`${out}\n`);
      };

      await render();
      if (options.watch) {
        const stop = watchDir(root, () => void render(), 300);
        process.on("SIGINT", () => {
          stop();
          process.exit(0);
        });
        await new Promise(() => {}); // keep the watcher alive until Ctrl-C
      }
    },
  );

program
  .command("collect")
  .argument("<repo>", "repository path")
  .option("--commits <n>", "number of recent commits to collect", parsePositiveInteger)
  .option("--since <duration>", "git --since duration, for example 6.months")
  .option("--step <step>", "sampling step; only 'weekly' is supported", parseStep)
  .action(async (repo: string, options: { commits?: number; since?: string; step?: "weekly" }) => {
    const result = await collectRepository(repo, options);
    console.log(`Collected ${result.snapshots.length} snapshots into ${result.config.repoPath}/.codesprawl`);
  });

program
  .command("analyze")
  .argument("<repo>", "repository path or repository containing .codesprawl")
  .action(async (repo: string) => {
    const result = await analyzeRepository(repo);
    console.log(`Analyzed ${result.snapshots.length} snapshots and wrote ${result.diffs.length} diffs`);
  });

program
  .command("doctor")
  .description("report language detection, LSP availability, and detail features")
  .argument("[repo]", "repository path", ".")
  .action(async (repo: string): Promise<void> => {
    const root = resolve(repo);
    const config = (await readSprawlensConfig(root)) ?? {};
    const { matched, strong } = await detectProviders(PROVIDERS, root);
    console.log(`sprawlens doctor — ${root}\n`);
    await reportTerraform(root, config);
    if (matched.length === 0) {
      console.log("  no language provider matched this repo");
      return;
    }
    for (const p of matched) {
      const bin = LSP_SERVERS[p.id]?.command;
      const found = bin ? lspAvailable(bin) : false;
      const tag = strong.includes(p) ? " (root manifest)" : "";
      // mirror the serve-time upgrade: TypeScript drives its own bundled LSP
      // (plus compiler CFG); every other provider is upgraded to its language
      // server when the binary is installed, otherwise its static detail stands in.
      const detail =
        p.detail?.backend === "lsp"
          ? "LSP ✓  (hover · CFG · call-hierarchy)"
          : bin && found
            ? "LSP ✓ used when serving (hover · call-hierarchy); static detail is the fallback"
            : p.detail
              ? "static detail (call-hierarchy) — source-preview hover"
              : "source-preview hover only";
      console.log(`• ${p.id}${tag}`);
      console.log(
        `    language server : ${
          bin ? `${bin} — ${found ? "found ✓" : "not installed ✗"}` : "—"
        }`,
      );
      console.log(`    deep detail     : ${detail}\n`);
    }
  });

/** A degenerate snapshot for an infra-only repo (terraform, no code): just the
 * repo node, so the viz loads and the service-layer overlay does the talking. */
function emptySnapshot(root: string, name: string): Snapshot {
  const nodes: Snapshot["nodes"] = [{ id: "repo", type: "repo", name }];
  const { metrics } = computeGraphMetrics(nodes, []);
  return {
    schemaVersion: 1,
    repoPath: root,
    commit: {
      hash: "WORKTREE",
      shortHash: "worktree",
      timestamp: new Date().toISOString(),
      authorName: "Working Tree",
      message: "Uncommitted working tree",
      aiIndicators: [],
    },
    nodes,
    edges: [],
    metrics: { ...metrics, loc: 0 },
  };
}

/** doctor: report the terraform service layer (the upper layer). */
async function reportTerraform(
  root: string,
  config: LayersConfig,
): Promise<void> {
  const tfRoot = config.terraform?.root;
  if (!(await hasTerraform(root, tfRoot))) {
    console.log(`• terraform : none detected${tfRoot ? ` under ${tfRoot}` : ""}\n`);
    return;
  }
  const graph = resolveServices(await analyzeTerraform(root, tfRoot), {
    services: config.services,
  });
  const where = tfRoot ? ` (root: ${tfRoot})` : "";
  console.log(`• terraform${where}`);
  console.log(`    service layer   : ${graph.services.length} services, ${graph.edges.length} links`);
  console.log(
    `    mapping         : ${
      config.services?.length
        ? `${config.services.length} [[service]] rules`
        : "auto (service-like resources)"
    }\n`,
  );
}

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

/**
 * The language server each provider can use for deep detail (hover + call
 * hierarchy). TypeScript drives its own (LSP + compiler CFG); for the others
 * the server is spawned at serve time when installed, otherwise the
 * tree-sitter baseline + a source-preview hover stand in.
 */
type LspSpec = { command: string; args: string[]; languageId: string };
const LSP_SERVERS: Record<string, LspSpec> = {
  typescript: {
    command: "typescript-language-server",
    args: ["--stdio"],
    languageId: "typescript",
  },
  rust: { command: "rust-analyzer", args: [], languageId: "rust" },
  go: { command: "gopls", args: [], languageId: "go" },
  moonbit: { command: "moonbit-lsp", args: [], languageId: "moonbit" },
};

/** Whether a language server is reachable: a bundled node dep, or a PATH binary. */
function lspAvailable(bin: string): boolean {
  try {
    createRequire(import.meta.url).resolve(`${bin}/package.json`);
    return true; // shipped as a dependency (typescript-language-server)
  } catch {
    /* not a node module — look on PATH */
  }
  const sep = process.platform === "win32" ? ";" : ":";
  return (process.env.PATH ?? "")
    .split(sep)
    .some(
      (d) =>
        d.length > 0 &&
        (existsSync(join(d, bin)) || existsSync(join(d, `${bin}.exe`))),
    );
}

/**
 * Read a runtime-trace artifact and resolve its frames against the snapshot.
 * A `.cpuprofile` (or JSON with the V8 sampled-tree shape) goes through the TS
 * cpuprofile adapter; anything else is treated as folded/collapsed stacks.
 * Returns undefined when the file can't be read/parsed (a bad --trace shouldn't
 * abort the server).
 */
/**
 * Detect a trace artifact's format and normalize it to a (still unresolved)
 * Trace. `parsed` is the JSON value (undefined when the text isn't JSON, e.g.
 * folded stacks); `text` is the raw file for the folded-stack fallback.
 */
function parseTraceArtifact(
  parsed: unknown,
  text: string,
  realRoot: string,
  label: string,
): Trace {
  const obj =
    parsed !== undefined && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  const firstOf = (key: string): Record<string, unknown> | undefined => {
    const list = obj?.[key];
    return Array.isArray(list) && typeof list[0] === "object"
      ? (list[0] as Record<string, unknown>)
      : undefined;
  };
  const isCpuProfile =
    obj !== undefined && Array.isArray(obj.nodes) && Array.isArray(obj.samples);
  // V8 precise coverage: { result: [{ url, functions }] } (NODE_V8_COVERAGE)
  const isV8Coverage = firstOf("result")?.functions !== undefined;
  // llvm-cov export: { data: [{ functions }] }
  const isLlvmCoverage = firstOf("data")?.functions !== undefined;
  return isCpuProfile
    ? tsCpuProfileAdapter.parse(parsed, realRoot)
    : isV8Coverage
      ? tsV8CoverageAdapter.parse(parsed, realRoot)
      : isLlvmCoverage
        ? parseLlvmCoverage(parsed, realRoot)
        : parseFoldedStacks(text, { label });
}

function loadTrace(
  tracePath: string,
  root: string,
  snapshot: Snapshot,
): Trace | undefined {
  const path = resolve(tracePath);
  if (!existsSync(path)) {
    console.error(`trace file not found: ${path}`);
    return undefined;
  }
  const text = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  // a profiler records realpath'd frame urls; match that so the prefix strips
  // (e.g. macOS /tmp -> /private/tmp) and frames become repo-relative.
  const realRoot = realpathSync(root);
  try {
    return resolveTraceSymbols(
      parseTraceArtifact(parsed, text, realRoot, basename(path)),
      snapshot,
    );
  } catch (error) {
    console.error(`failed to parse trace ${path}:`, error);
    return undefined;
  }
}

/**
 * Read a vitest `--reporter=json` report, normalize it to a TestRun, and join
 * it to this snapshot: case ids resolve to the test tree, `covers` (if any) to
 * snapshot symbols. Returns undefined on a missing or unparsable file.
 */
function loadTestRun(
  reportPath: string,
  root: string,
  snapshot: Snapshot,
): TestRun | undefined {
  const path = resolve(reportPath);
  if (!existsSync(path)) {
    console.error(`test report not found: ${path}`);
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const run = vitestReportAdapter.parse(parsed, realpathSync(root));
    // no extracted tree (analyzer found no test files) → resolve against an
    // empty tree so ids pass through and only `covers` resolves.
    const tree: TestTree = snapshot.tests ?? {
      root: { id: "testroot", kind: "dir", name: "", children: [] },
    };
    return resolveTestRun(run, tree, snapshot);
  } catch (error) {
    console.error(`failed to parse test report ${path}:`, error);
    return undefined;
  }
}

/**
 * Read a per-test traces file — a `{ [testId]: <trace artifact> }` map (each
 * artifact any format `--trace` accepts) — and resolve each artifact's frames
 * to the symbols that test exercised. Merge the result into `run` as each
 * case's `covers` (the source edges); cases with a trace but no report row are
 * appended as `pass` (a trace means the case ran). Returns `run` unchanged when
 * the file is missing/unparsable.
 */
function applyTestTraces(
  run: TestRun | undefined,
  tracesPath: string,
  root: string,
  snapshot: Snapshot,
): TestRun | undefined {
  const path = resolve(tracesPath);
  if (!existsSync(path)) {
    console.error(`test traces not found: ${path}`);
    return run;
  }
  let map: Record<string, unknown>;
  try {
    map = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    console.error(`failed to parse test traces ${path}:`, error);
    return run;
  }
  const realRoot = realpathSync(root);
  // symbol:<path>:<kind>:<name>:<line> → <name>, for the covers ref label
  const nameOf = (id: string): string => id.split(":").slice(-2)[0] ?? id;
  const coversOf = new Map<string, { name: string; symbolId: string }[]>();
  for (const [testId, artifact] of Object.entries(map)) {
    try {
      const trace = resolveTraceSymbols(
        parseTraceArtifact(artifact, "", realRoot, testId),
        snapshot,
      );
      const ids = [
        ...new Set(
          trace.nodes
            .map((n) => n.ref.symbolId)
            .filter((id): id is string => id !== undefined),
        ),
      ];
      if (ids.length > 0)
        coversOf.set(
          testId,
          ids.map((id) => ({ name: nameOf(id), symbolId: id })),
        );
    } catch (error) {
      console.error(`failed to parse trace for ${testId}:`, error);
    }
  }
  if (coversOf.size === 0) return run;
  const base: TestRun = run ?? { schemaVersion: 1, results: [] };
  const byId = new Map(base.results.map((r) => [r.testId, r]));
  for (const [testId, covers] of coversOf) {
    const existing = byId.get(testId);
    if (existing) existing.covers = covers;
    else base.results.push({ testId, status: "pass", covers });
  }
  return base;
}

/**
 * Build the click-to-run handler from the `[test] command` config. Returns a
 * function that runs exactly one case (`<command> <file> -t <title>
 * --reporter=json`) and returns its fresh result, joined to the test tree. The
 * command is fixed by config and spawned without a shell; the only request
 * input is the case id, decomposed into a file (validated repo-relative) and a
 * `-t` title pattern. Returns null when the id is malformed or the run yields
 * no matching case.
 */
function makeTestCaseRunner(
  root: string,
  command: string,
  snapshot: Snapshot,
): (testId: string) => Promise<TestCaseResult | null> {
  const argv = command.trim().split(/\s+/);
  const tree: TestTree = snapshot.tests ?? {
    root: { id: "testroot", kind: "dir", name: "", children: [] },
  };
  return async (testId) => {
    const parsed = parseTestId(testId);
    if (!parsed) return null;
    const { file, title } = parsed;
    if (file.includes("..") || file.startsWith("/")) return null;
    const out = join(tmpdir(), `sprawlens-case-${process.pid}-${argv.length}.json`);
    const args = [
      ...argv.slice(1),
      file,
      "-t",
      title,
      "--reporter=json",
      "--outputFile",
      out,
    ];
    const code = await new Promise<number>((res) => {
      const child = spawn(argv[0]!, args, { cwd: root, stdio: "ignore" });
      child.on("error", () => res(-1));
      child.on("close", (c) => res(c ?? -1));
    });
    // a failing test still writes the report (exit 1); only a spawn error (-1)
    // or a missing file means we got nothing back.
    if (code === -1 || !existsSync(out)) return null;
    try {
      const report = JSON.parse(readFileSync(out, "utf8"));
      const run = resolveTestRun(
        vitestReportAdapter.parse(report, realpathSync(root)),
        tree,
        snapshot,
      );
      return (
        run.results.find((r) => r.testId === testId) ?? run.results[0] ?? null
      );
    } catch (error) {
      console.error(`failed to read test run for ${testId}:`, error);
      return null;
    } finally {
      rmSync(out, { force: true });
    }
  };
}

/**
 * Pick the language provider for a repo. `--lang` forces one; otherwise a
 * single root-manifest match (go.mod / Cargo.toml / package.json / moon.mod.json)
 * wins outright, and only a genuine tie — several manifests, or none plus stray
 * source files of more than one language — falls through to the user: an
 * interactive prompt on a TTY, or an error telling them to pass --lang.
 */
async function chooseProvider(
  root: string,
  lang: string | undefined,
): Promise<LanguageProvider | null> {
  if (lang) {
    const forced = PROVIDERS.find((provider) => provider.id === lang);
    if (!forced) {
      console.error(
        `unknown --lang "${lang}". available: ${PROVIDERS.map((p) => p.id).join(", ")}`,
      );
      return null;
    }
    return forced;
  }
  const { matched, strong } = await detectProviders(PROVIDERS, root);
  if (strong.length === 1) return strong[0]!;
  if (strong.length === 0 && matched.length === 1) return matched[0]!;
  if (matched.length === 0) {
    console.error(`no language provider matched ${root}`);
    return null;
  }
  const candidates = strong.length > 1 ? strong : matched;
  if (process.stdin.isTTY && process.stdout.isTTY) {
    return promptProvider(candidates);
  }
  console.error(
    `multiple languages detected (${candidates.map((p) => p.id).join(", ")}). ` +
      `pass --lang <id> to choose.`,
  );
  return null;
}

/** Ask the user which detected language to use (TTY); default is the first. */
async function promptProvider(
  candidates: LanguageProvider[],
): Promise<LanguageProvider | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log("multiple languages detected:");
    candidates.forEach((provider, i) => console.log(`  ${i + 1}) ${provider.id}`));
    const answer = (
      await rl.question(`choose [1-${candidates.length}] or id (default 1): `)
    ).trim();
    if (answer === "") return candidates[0]!;
    const index = Number.parseInt(answer, 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
      return candidates[index]!;
    }
    return candidates.find((provider) => provider.id === answer) ?? candidates[0]!;
  } finally {
    rl.close();
  }
}

/** Locate the built viz bundle (workspace dev path; published path later). */
function resolveVizDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "viz"), // bundled next to dist/index.js (published)
    resolve(here, "../../viz/dist"), // packages/cli/src -> packages/viz/dist (dev)
  ];
  return candidates.find((p) => existsSync(resolve(p, "index.html"))) ?? null;
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function parseStep(value: string): "weekly" {
  if (value !== "weekly") throw new Error("Only --step weekly is supported");
  return value;
}
