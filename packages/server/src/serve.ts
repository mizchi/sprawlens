import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { callHierarchy } from "./callHierarchyProvider.js";
import { extractCfg } from "./cfgProvider.js";
import { LspClient } from "./lspClient.js";
import {
  enrichWithLoc,
  isSafeRef,
  watchWorkingDiff,
  workingDiff,
} from "./workingDiff.js";

/**
 * Atlas server: the language-neutral HTTP shell. Serves the built viz (static),
 * the analyzed snapshot(s), the working-tree diff (poll + SSE), and the
 * TS-specific detail endpoints (CFG, call hierarchy). The CLI runs it for one
 * repo; the dev script runs it for several named repos.
 */
export type AtlasServerOptions = {
  /** name -> absolute repo path (working-tree diff + detail are per repo). */
  repos: Map<string, string>;
  /** name -> snapshot JSON (or a producer); served at GET /api/snapshot. */
  snapshots?: Map<string, unknown | (() => unknown | Promise<unknown>)>;
  /** Directory of the built viz to serve as static files (SPA fallback). */
  vizDist?: string;
};

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".woff2": "font/woff2",
};

export function createAtlasServer(opts: AtlasServerOptions): Server {
  const { repos, snapshots, vizDist } = opts;
  const clients = new Map<string, Promise<LspClient>>();
  const clientFor = (repo: string): Promise<LspClient> => {
    let client = clients.get(repo);
    if (!client) {
      const root = repos.get(repo)!;
      console.log(`starting language server for ${repo} (${root})`);
      client = LspClient.start(root);
      clients.set(repo, client);
    }
    return client;
  };

  type DiffStream = {
    clients: Set<ServerResponse>;
    last: string | null;
    stop: () => void;
    heartbeat: ReturnType<typeof setInterval>;
  };
  const diffStreams = new Map<string, DiffStream>();
  const subscribeWorkingDiff = (
    base: string,
    root: string,
    res: ServerResponse,
  ) => {
    const key = `${root} ${base}`;
    let stream = diffStreams.get(key);
    if (!stream) {
      const created: DiffStream = {
        clients: new Set(),
        last: null,
        stop: () => {},
        heartbeat: setInterval(() => {
          for (const client of created.clients) client.write(":hb\n\n");
        }, 25_000),
      };
      created.stop = watchWorkingDiff(
        root,
        (diff) => {
          void enrichWithLoc(root, diff).then((enriched) => {
            created.last = JSON.stringify(enriched);
            for (const client of created.clients)
              client.write(`data: ${created.last}\n\n`);
          });
        },
        300,
        base || undefined,
      );
      diffStreams.set(key, created);
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
      const current = diffStreams.get(key);
      if (!current) return;
      current.clients.delete(res);
      if (current.clients.size === 0) {
        current.stop();
        clearInterval(current.heartbeat);
        diffStreams.delete(key);
      }
    });
  };

  const onlyRepo = repos.size === 1 ? [...repos.keys()][0]! : null;

  const serveStatic = async (urlPath: string, res: ServerResponse) => {
    if (!vizDist) {
      res.writeHead(404).end();
      return;
    }
    // SPA: unknown non-asset paths fall back to index.html
    let rel = decodeURIComponent(urlPath.split("?")[0]!).replace(/^\/+/, "");
    if (rel === "" || !extname(rel)) rel = "index.html";
    const file = normalize(join(vizDist, rel));
    if (!file.startsWith(normalize(vizDist))) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res
        .writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" })
        .end(body);
    } catch {
      if (rel !== "index.html") return serveStatic("/index.html", res);
      res.writeHead(404).end();
    }
  };

  return createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const repoOf = (name: string | null) =>
      name && repos.has(name) ? name : (onlyRepo ?? "");

    // GET /api/snapshot?repo=name -> analyzed snapshot JSON
    if (req.method === "GET" && url.pathname === "/api/snapshot") {
      const name = repoOf(url.searchParams.get("repo"));
      const producer = snapshots?.get(name);
      if (producer === undefined) {
        res.writeHead(404).end(JSON.stringify({ error: "no snapshot" }));
        return;
      }
      const snap = typeof producer === "function" ? await producer() : producer;
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(snap));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/working-diff")) {
      const root = repos.get(repoOf(url.searchParams.get("repo")));
      if (!root) {
        res.writeHead(400).end(JSON.stringify({ error: "unknown repo" }));
        return;
      }
      const base = url.searchParams.get("base") ?? "";
      if (base && !isSafeRef(base)) {
        res.writeHead(400).end(JSON.stringify({ error: "invalid base ref" }));
        return;
      }
      if (url.pathname === "/api/working-diff/stream") {
        subscribeWorkingDiff(base, root, res);
        return;
      }
      try {
        const diff = await workingDiff(root, base || undefined);
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(diff));
      } catch (error) {
        console.error(error);
        res.writeHead(500).end(JSON.stringify({ error: "git status failed" }));
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cfg") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          repo: string;
          file: string;
          line: number;
        };
        const root = repos.get(repoOf(body.repo));
        if (!root) {
          res.writeHead(400).end(JSON.stringify({ error: "unknown repo" }));
          return;
        }
        if (body.file.includes("..") || body.file.startsWith("/")) {
          res.writeHead(400).end(JSON.stringify({ error: "invalid file" }));
          return;
        }
        const source = await readFile(join(root, body.file), "utf8");
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(extractCfg(source, body.line)));
      } catch (error) {
        console.error(error);
        res.writeHead(500).end(JSON.stringify({ error: "cfg failed" }));
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/call-hierarchy") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          repo: string;
          file: string;
          symbol: string;
        };
        const name = repoOf(body.repo);
        if (!repos.has(name)) {
          res.writeHead(400).end(JSON.stringify({ error: "unknown repo" }));
          return;
        }
        if (body.file.includes("..") || body.file.startsWith("/")) {
          res.writeHead(400).end(JSON.stringify({ error: "invalid file" }));
          return;
        }
        const client = await clientFor(name);
        const result = await callHierarchy(
          client,
          repos.get(name)!,
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
          .end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "error",
            }),
          );
      }
      return;
    }

    if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
      await serveStatic(url.pathname, res);
      return;
    }
    res.writeHead(404).end();
  });
}
