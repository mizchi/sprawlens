import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { encodeMessage, JsonRpcReader } from "./jsonRpc.js";

/**
 * Minimal LSP client over stdio: documentSymbol, call hierarchy and hover —
 * what the detail providers need, not a general LSP implementation. It spawns
 * whatever server command it's given, so it fronts typescript-language-server,
 * rust-analyzer, gopls, etc. alike.
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

  /** Spawn `command args…` as the language server, cwd'd at the repo root. */
  static async start(
    rootDir: string,
    command: string,
    args: readonly string[],
  ): Promise<LspClient> {
    const child = spawn(command, [...args], {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const client = new LspClient(child);
    await client.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(rootDir).href,
      workspaceFolders: [{ uri: pathToFileURL(rootDir).href, name: "workspace" }],
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

  /**
   * Send an LSP request. While a server is still indexing it may answer with
   * `ContentModified` (-32801) — "ask again later", not a real failure — so we
   * retry those a few times before giving up. (typescript-language-server signals
   * the same not-ready state by returning an empty result; rust-analyzer errors.)
   */
  async request<T>(method: string, params: unknown, retries = 8): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.send<T>(method, params);
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code !== -32801 || attempt >= retries) throw error;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  private send<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
    this.child.stdin!.write(encodeMessage({ jsonrpc: "2.0", id, method, params }));
    return promise;
  }

  notify(method: string, params: unknown): void {
    this.child.stdin!.write(encodeMessage({ jsonrpc: "2.0", method, params }));
  }

  /** didOpen the file (once); the server loads its project lazily from it. */
  openDocument(absolutePath: string, languageId: string): void {
    if (this.openDocuments.has(absolutePath)) return;
    this.openDocuments.add(absolutePath);
    this.notify("textDocument/didOpen", {
      textDocument: {
        uri: pathToFileURL(absolutePath).href,
        languageId,
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
        const error = new Error(`${msg.method ?? "lsp"}: ${msg.error.message}`);
        (error as { code?: number }).code = msg.error.code;
        pending.reject(error);
      } else {
        pending.resolve(msg.result);
      }
      return;
    }
    // server→client requests need a response to keep the session alive
    if (msg.id !== undefined && msg.method !== undefined) {
      this.child.stdin!.write(encodeMessage({ jsonrpc: "2.0", id: msg.id, result: null }));
    }
  }
}
