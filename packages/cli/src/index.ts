#!/usr/bin/env node
import { Command } from "commander";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRepository, collectRepository, tsProvider } from "@sprawlens/analyzer-ts";
import { goProvider } from "@sprawlens/analyzer-go";
import { selectProvider } from "@sprawlens/schema";
import { createAtlasServer } from "@sprawlens/server";

// match order: language-specific signals (go.mod, ...) before the broad TS
// fallback (which also claims any package.json).
const PROVIDERS = [goProvider, tsProvider];

const program = new Command();

program
  .name("sprawlens")
  .description("Visualize the structure of a code repository")
  .version("0.0.0");

program
  .command("serve", { isDefault: true })
  .description("analyze a repo and open its structure map in the browser")
  .argument("[repo]", "repository path", ".")
  .option("--port <n>", "port", (v) => Number.parseInt(v, 10), 4173)
  .option("--no-open", "do not open the browser")
  .action(
    async (
      repo: string,
      options: { port: number; open: boolean },
    ): Promise<void> => {
      const root = resolve(repo);
      const name = basename(root);
      const provider = await selectProvider(PROVIDERS, root);
      if (!provider) {
        console.error(`no language provider matched ${root}`);
        process.exitCode = 1;
        return;
      }
      console.log(`analyzing ${root} (${provider.id}) …`);
      const snapshot = await provider.analyze(root);
      const fileCount = snapshot.nodes.filter((n) => n.type === "file").length;
      console.log(`  ${fileCount} files, ${snapshot.edges.length} edges`);

      const vizDist = resolveVizDist();
      if (!vizDist) {
        console.error(
          "viz build not found. Run `pnpm --filter @sprawlens/viz build` first.",
        );
        process.exitCode = 1;
        return;
      }
      const server = createAtlasServer({
        repos: new Map([[name, root]]),
        snapshots: new Map([[name, snapshot]]),
        vizDist,
      });
      server.listen(options.port, "127.0.0.1", () => {
        const url = `http://127.0.0.1:${options.port}/`;
        console.log(`sprawlens: ${url}`);
        if (options.open) openBrowser(url);
      });
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

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

/** Locate the built viz bundle (workspace dev path; published path later). */
function resolveVizDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../viz/dist"), // packages/cli/src -> packages/viz/dist
    resolve(here, "../viz/dist"),
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
