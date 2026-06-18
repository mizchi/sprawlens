#!/usr/bin/env node
import { Command } from "commander";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  analyzeRepository,
  collectRepository,
  createLspDetail,
} from "@sprawlens/analyzer-ts";
import type {
  LanguageProvider,
  LayersConfig,
  ServiceGraph,
  Snapshot,
} from "@sprawlens/schema";
import {
  applyLayers,
  computeGraphMetrics,
  layerManifest,
  matchResourceFiles,
  resolveServices,
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
  .action(
    async (
      repo: string,
      options: { port: number; open: boolean; lang?: string },
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
      const server = createAtlasServer({
        repos: new Map([[name, root]]),
        snapshots: new Map([[name, snapshot]]),
        analyzers: analyze ? new Map([[name, analyze]]) : undefined,
        vizDist,
        detail,
        layers: layerManifest(config),
        services,
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
