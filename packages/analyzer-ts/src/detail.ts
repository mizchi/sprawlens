import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageDetail } from "@sprawlens/schema";
import { callHierarchy } from "./callHierarchyProvider.js";
import { extractCfg } from "./cfgProvider.js";
import { hover } from "./hoverProvider.js";
import { LspClient } from "./lspClient.js";

/** One language server per repo root, started lazily. */
const clients = new Map<string, Promise<LspClient>>();
function clientFor(repoRoot: string): Promise<LspClient> {
  let client = clients.get(repoRoot);
  if (!client) {
    client = LspClient.start(repoRoot);
    clients.set(repoRoot, client);
  }
  return client;
}

/** TS/JS deep detail: CFG from the compiler, call hierarchy from the LSP. */
export const tsDetail: LanguageDetail = {
  async cfg(repoRoot, file, line) {
    const source = await readFile(join(repoRoot, file), "utf8");
    return extractCfg(source, line);
  },
  async callHierarchy(repoRoot, file, symbol) {
    return callHierarchy(await clientFor(repoRoot), repoRoot, file, symbol);
  },
  async hover(repoRoot, file, symbol) {
    return hover(await clientFor(repoRoot), repoRoot, file, symbol);
  },
};
