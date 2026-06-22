import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type {
  LanguageDetail,
  LayerManifestEntry,
  ServiceGraph,
  TestCaseResult,
  TestRun,
  Trace,
} from "@sprawlens/schema";
import { definitionPreview } from "./definitionPreview.js";
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
  /** The terraform-derived service graph (the upper layer); served at GET
   * /api/services. A producer is re-run per request for live .tf updates. */
  services?: ServiceGraph | (() => ServiceGraph | Promise<ServiceGraph>);
  /** A runtime trace (symbol refs already resolved against the snapshot), served
   * at GET /api/trace for the execution-path overlay. A producer is re-run per
   * request for live re-ingest. */
  trace?: Trace | (() => Trace | Promise<Trace>);
  /** A test run (case ids joined to the tree, `covers` resolved to symbols),
   * served at GET /api/test-run for the reporter overlay. A producer is re-run
   * per request for live re-ingest. */
  testRun?: TestRun | (() => TestRun | Promise<TestRun>);
  /** Click-to-run: run one test case by id and return its fresh result. The CLI
   * injects this (it owns the configured command); omit to disable the
   * POST /api/test-run/case endpoint. The composition root, not the server,
   * decides what command runs — the server never builds it from the request. */
  runTestCase?: (testId: string) => Promise<TestCaseResult | null>;
  /** Enable experimental viz features (trace player, commit-log, test reporter);
   * served at GET /api/config. Set by the CLI `--experimental` flag. */
  experimental?: boolean;
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
  const {
    repos,
    snapshots,
    analyzers,
    vizDist,
    detail,
    layers,
    services,
    trace,
    testRun,
    runTestCase,
    experimental,
  } = opts;

  // the test run shown at GET /api/test-run; materialized from the option on
  // first read, then mutated in place by click-to-run so the overlay reflects
  // a freshly re-run case.
  let testRunState: TestRun | null | undefined;
  const currentTestRun = async (): Promise<TestRun | null> => {
    if (testRunState !== undefined) return testRunState;
    if (!testRun) testRunState = null;
    else if (typeof testRun === "function") testRunState = await testRun();
    else testRunState = testRun;
    return testRunState;
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
        .end(JSON.stringify({ layers: layers ?? [], experimental: experimental ?? false }));
      return;
    }

    // GET /api/services -> the terraform-derived service graph (empty if unset)
    if (req.method === "GET" && url.pathname === "/api/services") {
      const graph: ServiceGraph = services
        ? typeof services === "function"
          ? await services()
          : services
        : { services: [], edges: [] };
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(graph));
      return;
    }

    // GET /api/trace -> the runtime trace overlay (null when none was ingested)
    if (req.method === "GET" && url.pathname === "/api/trace") {
      const value = trace
        ? typeof trace === "function"
          ? await trace()
          : trace
        : null;
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(value));
      return;
    }

    // GET /api/test-run -> the test reporter overlay (null when none was ingested)
    if (req.method === "GET" && url.pathname === "/api/test-run") {
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(await currentTestRun()));
      return;
    }

    // POST /api/test-run/case { testId } -> run just that case and return its
    // fresh result, merged into the served test run. 404 when no runner is
    // configured ([test] command unset). The testId selects the case; the
    // command itself comes from config, never from the request body.
    if (req.method === "POST" && url.pathname === "/api/test-run/case") {
      if (!runTestCase) {
        res.writeHead(404).end(JSON.stringify({ error: "no test runner" }));
        return;
      }
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          testId?: string;
        };
        if (!body.testId || typeof body.testId !== "string") {
          res.writeHead(400).end(JSON.stringify({ error: "missing testId" }));
          return;
        }
        // run BEFORE writing headers so a failure returns a clean 500 instead of
        // crashing the process on a committed response (see the cfg handler)
        const result = await runTestCase(body.testId);
        if (result) {
          const run = (await currentTestRun()) ?? { schemaVersion: 1 as const, results: [] };
          const idx = run.results.findIndex((r) => r.testId === result.testId);
          if (idx >= 0) run.results[idx] = result;
          else run.results.push(result);
          testRunState = run;
        }
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(result));
      } catch (error) {
        console.error(error);
        res.writeHead(500).end(JSON.stringify({ error: "test run failed" }));
      }
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
        // resolve the graph BEFORE writing headers: writing 200 first commits
        // the response, so a rejection here would make the catch's writeHead(500)
        // throw ERR_HTTP_HEADERS_SENT and crash the process (taking the whole
        // server, not just this request, down)
        const graph = await detail.cfg(root, body.file, body.line);
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(graph));
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
        // await before writing headers (see the cfg handler above) so a
        // rejection returns a clean 500 instead of crashing the server
        const result = await detail.callHierarchy(root, body.file, body.symbol);
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

    if (req.method === "POST" && url.pathname === "/api/hover") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          repo: string;
          file: string;
          symbol: string;
          line?: number;
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
        // await before writing headers (see the cfg handler) so a rejection
        // returns a clean 500 instead of crashing the server. Prefer the LSP
        // hover (rich, resolved types); fall back to reading the declaration
        // from source for languages with no LSP detail provider.
        let result = detail?.hover
          ? await detail.hover(root, body.file, body.symbol)
          : null;
        if (!result && body.line) {
          result = await definitionPreview(root, body.file, body.line);
        }
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(result));
      } catch (error) {
        console.error(error);
        res.writeHead(500).end(JSON.stringify({ error: "hover failed" }));
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
