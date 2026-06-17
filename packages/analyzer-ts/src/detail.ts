import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { LanguageDetail } from "@sprawlens/schema";
import { callHierarchy } from "./callHierarchyProvider.js";
import { extractCfg } from "./cfgProvider.js";
import { hover } from "./hoverProvider.js";
import { LspClient } from "./lspClient.js";

/** How to spawn a language server, and the LSP languageId for its files. */
export type LspServerSpec = {
  command: string;
  args?: readonly string[];
  /** A constant id, or one derived per file (TS uses typescriptreact for .tsx). */
  languageId: string | ((file: string) => string);
};

/**
 * A `detail` provider backed by a language server: hover and call hierarchy via
 * LSP. No CFG — that's a basic-block graph the LSP doesn't produce. Works with
 * any stdio language server (rust-analyzer, gopls, …); one server process is
 * started per repo root, lazily, and reused.
 */
export function createLspDetail(spec: LspServerSpec): LanguageDetail {
  const clients = new Map<string, Promise<LspClient>>();
  const clientFor = (root: string): Promise<LspClient> => {
    let client = clients.get(root);
    if (!client) {
      client = LspClient.start(root, spec.command, spec.args ?? []);
      clients.set(root, client);
    }
    return client;
  };
  const langOf =
    typeof spec.languageId === "function"
      ? spec.languageId
      : () => spec.languageId as string;
  return {
    backend: "lsp",
    cfg: () => null,
    async callHierarchy(root, file, symbol) {
      return callHierarchy(await clientFor(root), root, file, symbol, langOf(file));
    },
    async hover(root, file, symbol) {
      return hover(await clientFor(root), root, file, symbol, langOf(file));
    },
  };
}

/** Path to the bundled typescript-language-server CLI entry. */
function tsServerCli(): string {
  return createRequire(import.meta.url)
    .resolve("typescript-language-server/package.json")
    .replace(/package\.json$/, "lib/cli.mjs");
}

/**
 * TS/JS deep detail: hover + call hierarchy from the language server, plus CFG
 * from the TS compiler (the LSP doesn't expose a control-flow graph).
 */
const tsLsp = createLspDetail({
  command: process.execPath,
  args: [tsServerCli(), "--stdio"],
  languageId: (file) => (/\.tsx$/.test(file) ? "typescriptreact" : "typescript"),
});
export const tsDetail: LanguageDetail = {
  ...tsLsp,
  async cfg(repoRoot, file, line) {
    const source = await readFile(join(repoRoot, file), "utf8");
    return extractCfg(source, line);
  },
};
