#!/usr/bin/env node
import { Command } from "commander";
import { analyzeRepository, collectRepository } from "@sprawlens/analyzer-ts";

const program = new Command();

program.name("codesprawl").description("Observe structural growth in TypeScript/JavaScript repositories").version("0.0.0");

program
  .command("collect")
  .argument("<repo>", "repository path")
  .option("--commits <n>", "number of recent commits to collect", parsePositiveInteger)
  .option("--since <duration>", "git --since duration, for example 6.months or '6 months'")
  .option("--step <step>", "sampling step; only 'weekly' is supported for MVP", parseStep)
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

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function parseStep(value: string): "weekly" {
  if (value !== "weekly") {
    throw new Error("Only --step weekly is supported");
  }
  return value;
}
