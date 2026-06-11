import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ServerResponse } from "node:http";
import { callHierarchy } from "./callHierarchyProvider.js";
import { LspClient } from "./lspClient.js";
import { watchWorkingDiff, workingDiff } from "./workingDiff.js";

/**
 * Atlas symbol-dependency server.
 * Usage: tsx src/atlas/server/index.ts [--port 4710] name=path [name=path...]
 * Exposes POST /api/call-hierarchy {repo, file, symbol},
 * GET /api/working-diff?repo=name (uncommitted changes vs HEAD), and
 * GET /api/working-diff/stream?repo=name (SSE: fs-watched diff pushes).
 * One language server per repo, started lazily on first request.
 */

const args = process.argv.slice(2);
let port = 4710;
const repos = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") {
    port = Number(args[++i]);
    continue;
  }
  const eq = args[i]!.indexOf("=");
  if (eq > 0) {
    const name = args[i]!.slice(0, eq);
    const path = resolve(args[i]!.slice(eq + 1));
    if (!existsSync(path)) {
      console.error(`repo path not found: ${name}=${path}`);
      process.exit(1);
    }
    repos.set(name, path);
  }
}
if (repos.size === 0) {
  console.error("usage: atlas-server [--port N] name=path [name=path...]");
  process.exit(1);
}

const clients = new Map<string, Promise<LspClient>>();
function clientFor(repo: string): Promise<LspClient> {
  let client = clients.get(repo);
  if (!client) {
    const root = repos.get(repo)!;
    console.log(`starting language server for ${repo} (${root})`);
    client = LspClient.start(root);
    clients.set(repo, client);
  }
  return client;
}

// one fs watcher per repo, shared by every SSE client and torn down with
// the last one
type DiffStream = {
  clients: Set<ServerResponse>;
  last: string | null;
  stop: () => void;
  heartbeat: ReturnType<typeof setInterval>;
};
const diffStreams = new Map<string, DiffStream>();

function subscribeWorkingDiff(repo: string, root: string, res: ServerResponse) {
  let stream = diffStreams.get(repo);
  if (!stream) {
    const created: DiffStream = {
      clients: new Set(),
      last: null,
      stop: () => {},
      heartbeat: setInterval(() => {
        for (const client of created.clients) client.write(":hb\n\n");
      }, 25_000),
    };
    created.stop = watchWorkingDiff(root, (diff) => {
      created.last = JSON.stringify(diff);
      for (const client of created.clients) {
        client.write(`data: ${created.last}\n\n`);
      }
    });
    diffStreams.set(repo, created);
    stream = created;
  }
  stream.clients.add(res);
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  if (stream.last !== null) res.write(`data: ${stream.last}\n\n`);
  res.on("close", () => {
    const current = diffStreams.get(repo);
    if (!current) return;
    current.clients.delete(res);
    if (current.clients.size === 0) {
      current.stop();
      clearInterval(current.heartbeat);
      diffStreams.delete(repo);
    }
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method === "GET" && req.url?.startsWith("/api/working-diff")) {
    const url = new URL(req.url, "http://localhost");
    const repo = url.searchParams.get("repo") ?? "";
    const root = repos.get(repo);
    if (!root) {
      res.writeHead(400).end(JSON.stringify({ error: "unknown repo" }));
      return;
    }
    if (url.pathname === "/api/working-diff/stream") {
      subscribeWorkingDiff(repo, root, res);
      return;
    }
    try {
      const diff = await workingDiff(root);
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(diff));
    } catch (error) {
      console.error(error);
      res.writeHead(500).end(JSON.stringify({ error: "git status failed" }));
    }
    return;
  }
  if (req.method !== "POST" || req.url !== "/api/call-hierarchy") {
    res.writeHead(404).end();
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      repo: string;
      file: string;
      symbol: string;
    };
    if (!repos.has(body.repo)) {
      res.writeHead(400).end(JSON.stringify({ error: "unknown repo" }));
      return;
    }
    // reject path escapes; file must stay inside the repo
    if (body.file.includes("..") || body.file.startsWith("/")) {
      res.writeHead(400).end(JSON.stringify({ error: "invalid file" }));
      return;
    }
    const client = await clientFor(body.repo);
    const result = await callHierarchy(
      client,
      repos.get(body.repo)!,
      body.file,
      body.symbol,
    );
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    res
      .writeHead(500)
      .end(JSON.stringify({ error: error instanceof Error ? error.message : "error" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `atlas symbol-dependency server: http://127.0.0.1:${port} (${[...repos.keys()].join(", ")})`,
  );
});
