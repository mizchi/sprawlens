import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRealtimeRepository, codesprawlDir, diffsDir, readDiffs, readSnapshots, snapshotsDir } from "./collect.js";
import { resolveSymbolDependencies } from "./symbolDependencies.js";

export type ServeOptions = {
  host?: string;
  port?: number;
};

export type RunningServer = {
  server: Server;
  url: string;
};

export async function startServer(repoPath: string, options: ServeOptions = {}): Promise<RunningServer> {
  const repo = path.resolve(repoPath);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4173;
  const staticDir = resolveStaticDir();

  const server = createServer(async (request, response) => {
    try {
      await handleRequest({
        request,
        response,
        repo,
        staticDir,
      });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    server,
    url: `http://${host}:${actualPort}`,
  };
}

async function handleRequest(input: {
  request: IncomingMessage;
  response: ServerResponse;
  repo: string;
  staticDir: string;
}) {
  const { request, response, repo, staticDir } = input;
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    await handleApi(pathname, request, response, repo);
    return;
  }

  await serveStatic(pathname, response, staticDir);
}

async function handleApi(pathname: string, request: IncomingMessage, response: ServerResponse, repo: string) {
  if (pathname === "/api/rpc") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    sendJson(response, 200, await handleRpc(repo, await readRequestJson(request)));
    return;
  }

  if (pathname === "/api/config") {
    sendJson(response, 200, await readJson(path.join(codesprawlDir(repo), "config.json")));
    return;
  }

  if (pathname === "/api/commits") {
    sendJson(response, 200, await readJson(path.join(codesprawlDir(repo), "commits.json")));
    return;
  }

  if (pathname === "/api/snapshots") {
    const snapshots = await readSnapshots(repo);
    sendJson(
      response,
      200,
      snapshots.map((snapshot) => ({
        commit: snapshot.commit,
        metrics: snapshot.metrics,
      })),
    );
    return;
  }

  if (pathname.startsWith("/api/snapshots/")) {
    const hash = pathname.slice("/api/snapshots/".length);
    sendJson(response, 200, await readJson(path.join(snapshotsDir(repo), `${hash}.json`)));
    return;
  }

  if (pathname === "/api/diffs") {
    const diffs = await readDiffs(repo);
    sendJson(
      response,
      200,
      diffs.map((diff) => ({
        fromCommit: diff.fromCommit,
        toCommit: diff.toCommit,
        metricDelta: diff.metricDelta,
        hotspots: diff.hotspots,
      })),
    );
    return;
  }

  if (pathname === "/api/realtime") {
    sendJson(response, 200, await analyzeRealtimeRepository(repo));
    return;
  }

  if (pathname.startsWith("/api/diffs/")) {
    const name = pathname.slice("/api/diffs/".length);
    sendJson(response, 200, await readJson(path.join(diffsDir(repo), name)));
    return;
  }

  sendJson(response, 404, { error: "API route not found" });
}

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

async function handleRpc(repo: string, payload: unknown): Promise<unknown> {
  const request = payload as RpcRequest;
  const id = request?.id ?? null;
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return rpcError(id, -32600, "Invalid Request");
  }
  if (request.method === "symbolDependencies") {
    const params = request.params as { symbolId?: unknown; maxIncoming?: unknown; maxOutgoing?: unknown } | undefined;
    if (!params || typeof params.symbolId !== "string") {
      return rpcError(id, -32602, "symbolDependencies requires params.symbolId");
    }
    return {
      jsonrpc: "2.0",
      id,
      result: await resolveSymbolDependencies(repo, {
        symbolId: params.symbolId,
        maxIncoming: positiveIntegerOrUndefined(params.maxIncoming),
        maxOutgoing: positiveIntegerOrUndefined(params.maxOutgoing),
      }),
    };
  }
  return rpcError(id, -32601, `Method not found: ${request.method}`);
}

function rpcError(id: string | number | null, code: number, message: string): unknown {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function positiveIntegerOrUndefined(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function serveStatic(pathname: string, response: ServerResponse, staticDir: string) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.resolve(staticDir, `.${requestedPath}`);
  const safeStaticDir = path.resolve(staticDir);

  if (!resolvedPath.startsWith(safeStaticDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const filePath = (await fileExists(resolvedPath)) ? resolvedPath : path.join(staticDir, "index.html");
  if (!(await fileExists(filePath))) {
    sendText(response, 503, "UI build not found. Run `pnpm build` before `codesprawl serve`.");
    return;
  }

  response.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": "no-store",
  });
  response.end(await readFile(filePath));
}

function resolveStaticDir(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "../ui");
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) {
      throw new Error("Request body too large");
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? (JSON.parse(raw) as unknown) : null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function sendText(response: ServerResponse, statusCode: number, value: string) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(value);
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath);
  if (ext === ".html") {
    return "text/html; charset=utf-8";
  }
  if (ext === ".js") {
    return "text/javascript; charset=utf-8";
  }
  if (ext === ".css") {
    return "text/css; charset=utf-8";
  }
  if (ext === ".json") {
    return "application/json; charset=utf-8";
  }
  if (ext === ".svg") {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}
