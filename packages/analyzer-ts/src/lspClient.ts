import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { encodeMessage, JsonRpcReader } from "./jsonRpc.js";

/**
 * Minimal LSP client speaking to `typescript-language-server --stdio`.
 * Only what the call-hierarchy provider needs; intentionally not a general
 * LSP implementation. The same interface can front other language servers
 * (MoonBit etc.) later.
 */
export class LspClient {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly openDocuments = new Set<string>();

  private constructor(private readonly child: ChildProcess) {
    const reader = new JsonRpcReader((message) => this.onMessage(message));
    child.stdout!.on("data", (chunk: Buffer) => reader.push(chunk));
    child.on("exit", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("language server exited"));
      }
      this.pending.clear();
    });
  }

  static async start(rootDir: string): Promise<LspClient> {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve(
      "typescript-language-server/package.json",
    );
    const cli = packageJsonPath.replace(/package\.json$/, "lib/cli.mjs");
    const child = spawn(process.execPath, [cli, "--stdio"], {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const client = new LspClient(child);
    await client.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(rootDir).href,
      workspaceFolders: [
        { uri: pathToFileURL(rootDir).href, name: "workspace" },
      ],
      capabilities: {
        textDocument: {
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          callHierarchy: {},
          hover: { contentFormat: ["markdown", "plaintext"] },
        },
      },
    });
    client.notify("initialized", {});
    return client;
  }

  request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
    this.child.stdin!.write(
      encodeMessage({ jsonrpc: "2.0", id, method, params }),
    );
    return promise;
  }

  notify(method: string, params: unknown): void {
    this.child.stdin!.write(encodeMessage({ jsonrpc: "2.0", method, params }));
  }

  /** didOpen the file (once); the server loads its project lazily from it. */
  openDocument(absolutePath: string): void {
    if (this.openDocuments.has(absolutePath)) return;
    this.openDocuments.add(absolutePath);
    this.notify("textDocument/didOpen", {
      textDocument: {
        uri: pathToFileURL(absolutePath).href,
        languageId: /\.tsx$/.test(absolutePath)
          ? "typescriptreact"
          : "typescript",
        version: 1,
        text: readFileSync(absolutePath, "utf8"),
      },
    });
  }

  dispose(): void {
    try {
      this.notify("exit", {});
    } catch {
      // already gone
    }
    this.child.kill();
  }

  private onMessage(message: unknown): void {
    const msg = message as {
      id?: number;
      method?: string;
      result?: unknown;
      error?: { code: number; message: string };
    };
    if (msg.id !== undefined && msg.method === undefined) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(`${msg.method ?? "lsp"}: ${msg.error.message}`));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }
    // server→client requests need a response to keep the session alive
    if (msg.id !== undefined && msg.method !== undefined) {
      this.child.stdin!.write(
        encodeMessage({ jsonrpc: "2.0", id: msg.id, result: null }),
      );
    }
  }
}
