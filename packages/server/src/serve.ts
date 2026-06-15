import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type { LanguageDetail, LayerManifestEntry } from "@sprawlens/schema";
import {
  enrichWithLoc,
  isSafeRef,
  watchDir,
  watchWorkingDiff,
  workingDiff,
} from "./workingDiff.js";

/**
 * Atlas server: the language-neutral HTTP shell. Serves the built viz (static),
 * the analyzed snapshot(s), the working-tree diff (poll + SSE), and — when a
 * `detail` provider is injected — the CFG / call-hierarchy endpoints. The CLI
 * runs it for one repo; the dev script runs it for several named repos.
 */
export type AtlasServerOptions = {
  /** name -> absolute repo path (working-tree diff + detail are per repo). */
  repos: Map<string, string>;
  /** name -> snapshot JSON (or a producer); served at GET /api/snapshot. */
  snapshots?: Map<string, unknown | (() => unknown | Promise<unknown>)>;
  /**
   * name -> re-analyze function for live updates. When present, the repo is
   * watched and a fresh snapshot is streamed over /api/snapshot/stream on each
   * change (incremental analyzers re-parse only what changed).
   */
  analyzers?: Map<string, () => unknown | Promise<unknown>>;
  /** Directory of the built viz to serve as static files (SPA fallback). */
  vizDist?: string;
  /** Language-specific CFG / call hierarchy; omit to disable those endpoints. */
  detail?: LanguageDetail;
  /** Layer render manifest (from sprawlens.toml); served at GET /api/config so
   * the viz knows which satellite planes to build and how. */
  layers?: LayerManifestEntry[];
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
  const { repos, snapshots, analyzers, vizDist, detail, layers } = opts;

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

  // Snapshot stream: re-analyze on fs change and push the fresh snapshot (SSE).
  type SnapStream = {
    clients: Set<ServerResponse>;
    last: string | null;
    stop: () => void;
    heartbeat: ReturnType<typeof setInterval>;
  };
  const snapStreams = new Map<string, SnapStream>();
  const subscribeSnapshot = (
    name: string,
    root: string,
    analyze: () => unknown | Promise<unknown>,
    res: ServerResponse,
  ) => {
    let stream = snapStreams.get(name);
    if (!stream) {
      const created: SnapStream = {
        clients: new Set(),
        last: null,
        stop: () => {},
        heartbeat: setInterval(() => {
          for (const client of created.clients) client.write(":hb\n\n");
        }, 25_000),
      };
      let running = false;
      let queued = false;
      const reanalyze = async () => {
        if (running) {
          queued = true;
          return;
        }
        running = true;
        try {
          const json = JSON.stringify(await analyze());
          if (json !== created.last) {
            created.last = json;
            for (const client of created.clients) client.write(`data: ${json}\n\n`);
          }
        } catch (error) {
          console.error(error);
        } finally {
          running = false;
          if (queued) {
            queued = false;
            void reanalyze();
          }
        }
      };
      created.stop = watchDir(root, () => void reanalyze(), 300);
      snapStreams.set(name, created);
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
      const current = snapStreams.get(name);
      if (!current) return;
      current.clients.delete(res);
      if (current.clients.size === 0) {
        current.stop();
        clearInterval(current.heartbeat);
        snapStreams.delete(name);
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

    // GET /api/snapshot/stream?repo=name -> SSE of re-analyzed snapshots on change
    if (req.method === "GET" && url.pathname === "/api/snapshot/stream") {
      const name = repoOf(url.searchParams.get("repo"));
      const root = repos.get(name);
      const analyze = analyzers?.get(name);
      if (!root || !analyze) {
        res.writeHead(404).end(JSON.stringify({ error: "no live analyzer" }));
        return;
      }
      subscribeSnapshot(name, root, analyze, res);
      return;
    }

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

    // GET /api/config -> the layer render manifest (empty array if unset)
    if (req.method === "GET" && url.pathname === "/api/config") {
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ layers: layers ?? [] }));
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
        if (!root || !detail) {
          res.writeHead(root ? 404 : 400).end(
            JSON.stringify({ error: root ? "no detail provider" : "unknown repo" }),
          );
          return;
        }
        if (body.file.includes("..") || body.file.startsWith("/")) {
          res.writeHead(400).end(JSON.stringify({ error: "invalid file" }));
          return;
        }
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(await detail.cfg(root, body.file, body.line)));
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
        const root = repos.get(repoOf(body.repo));
        if (!root || !detail) {
          res.writeHead(root ? 404 : 400).end(
            JSON.stringify({ error: root ? "no detail provider" : "unknown repo" }),
          );
          return;
        }
        if (body.file.includes("..") || body.file.startsWith("/")) {
          res.writeHead(400).end(JSON.stringify({ error: "invalid file" }));
          return;
        }
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(await detail.callHierarchy(root, body.file, body.symbol)));
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
