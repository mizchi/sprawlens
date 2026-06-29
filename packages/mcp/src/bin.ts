#!/usr/bin/env -S npx tsx
/**
 * `sprawlens-mcp [repoPath]` — analyze the repo's current working tree, build
 * the AtlasGraph, and serve the agent tools over stdio (for Claude Code et al.).
 * Defaults to the current directory. Progress goes to stderr so stdout stays a
 * clean MCP transport.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { indexGraph } from "@sprawlens/agent";
import { analyzeRealtimeRepository } from "@sprawlens/analyzer-ts";
import { snapshotToAtlasGraph } from "@sprawlens/schema";
import { createServer } from "./index.ts";

async function main(): Promise<void> {
  const repo = process.argv[2] ?? process.cwd();
  process.stderr.write(`sprawlens-mcp: analyzing ${repo}…\n`);
  const { currentSnapshot } = await analyzeRealtimeRepository(repo);
  const graph = snapshotToAtlasGraph(currentSnapshot as Parameters<typeof snapshotToAtlasGraph>[0]);
  const idx = indexGraph(graph);
  process.stderr.write(
    `sprawlens-mcp: ${idx.moduleIds.size} modules, ${graph.nodes.length} nodes — ready.\n`,
  );
  await createServer(idx).connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`sprawlens-mcp: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
