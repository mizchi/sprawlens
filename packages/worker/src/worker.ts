import { normalizeGitHubRepo, snapshotFromGitHubRepo } from "./remoteSnapshot.ts";
import type { Snapshot } from "@sprawlens/schema";

type AssetBinding = { fetch(request: Request): Promise<Response> };
type SnapshotLoader = (repo: string, options: { token?: string }) => Promise<Snapshot>;
type SnapshotCache = Pick<Cache, "match" | "put">;
type WorkerContext = { waitUntil(promise: Promise<unknown>): void };

export type WorkerEnv = {
  ASSETS: AssetBinding;
  GITHUB_TOKEN?: string;
};

export type WorkerDeps = {
  snapshotFromRepo?: SnapshotLoader;
  cache?: SnapshotCache | null;
};

const SNAPSHOT_CACHE_SECONDS = 60 * 60;
const SNAPSHOT_CACHE_CONTROL = `public, max-age=${SNAPSHOT_CACHE_SECONDS}, s-maxage=${SNAPSHOT_CACHE_SECONDS}`;
const SNAPSHOT_CACHE_VERSION = "2026-07-02-moonbit-methods";

function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("access-control-allow-origin", "*");
  return new Response(JSON.stringify(value), {
    ...init,
    headers,
  });
}

function landingPage(): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sprawlens</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #101419; color: #f4f7fb; }
    main { width: min(560px, calc(100vw - 32px)); }
    h1 { font-size: 34px; margin: 0 0 10px; letter-spacing: 0; }
    p { color: #aab6c5; margin: 0 0 24px; line-height: 1.6; }
    form { display: flex; gap: 8px; }
    input { flex: 1; min-width: 0; border: 1px solid #3a4655; border-radius: 6px; padding: 12px 14px; font: inherit; background: #161d25; color: inherit; }
    button { border: 0; border-radius: 6px; padding: 0 16px; font: inherit; background: #6ee7b7; color: #092016; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>Sprawlens</h1>
    <p>Enter a public GitHub repository such as <code>mizchi/sprawlens</code>.</p>
    <form method="get" action="/">
      <input name="repo" value="mizchi/sprawlens" autocomplete="off" spellcheck="false">
      <button type="submit">Visualize</button>
    </form>
  </main>
</body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function appLocation(repo: string): string {
  const params = new URLSearchParams({ source: "served", repo, layout: "rings", tilt: "true" });
  return `/app?${params.toString()}`;
}

function snapshotCacheKey(request: Request, repo: string): Request {
  const url = new URL(request.url);
  url.pathname = "/api/snapshot";
  url.search = new URLSearchParams({ repo, v: SNAPSHOT_CACHE_VERSION }).toString();
  return new Request(url.toString(), { method: "GET" });
}

function cacheStatus(response: Response, status: "hit" | "miss"): Response {
  const cached = new Response(response.body, response);
  cached.headers.set("x-sprawlens-cache", status);
  return cached;
}

async function writeCache(
  cache: SnapshotCache,
  key: Request,
  response: Response,
  ctx?: WorkerContext,
): Promise<void> {
  const put = cache.put(key, response.clone()).catch(() => {});
  if (ctx) ctx.waitUntil(put);
  else await put;
}

function defaultCacheOf(deps: WorkerDeps): SnapshotCache | null {
  if ("cache" in deps) return deps.cache ?? null;
  if (typeof caches === "undefined") return null;
  return (caches as unknown as { default?: SnapshotCache }).default ?? null;
}

async function handleApi(
  request: Request,
  url: URL,
  env: WorkerEnv,
  deps: Required<Pick<WorkerDeps, "snapshotFromRepo">> & WorkerDeps,
  ctx?: WorkerContext,
): Promise<Response> {
  if (url.pathname === "/api/snapshot") {
    if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405 });
    const input = url.searchParams.get("repo") ?? "";
    const normalized = normalizeGitHubRepo(input);
    if (!normalized) return json({ error: "invalid repo" }, { status: 400 });
    const repo = `${normalized.owner}/${normalized.repo}`;
    const cache = defaultCacheOf(deps);
    const key = snapshotCacheKey(request, repo);
    const cached = await cache?.match(key);
    if (cached) return cacheStatus(cached, "hit");
    try {
      const snapshot = await deps.snapshotFromRepo(repo, { token: env.GITHUB_TOKEN });
      const response = json(snapshot, {
        headers: {
          "cache-control": SNAPSHOT_CACHE_CONTROL,
        },
      });
      if (cache) await writeCache(cache, key, response, ctx);
      return cacheStatus(response, "miss");
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "snapshot failed" },
        { status: 502 },
      );
    }
  }
  if (url.pathname === "/api/config") return json({ layers: [], experimental: false });
  if (url.pathname === "/api/services") return json({ services: [], edges: [] });
  if (url.pathname === "/api/trace") return json(null);
  if (url.pathname === "/api/test-run") return json(null);
  if (url.pathname === "/api/chat") return json({ available: false });
  return json({ error: "not found" }, { status: 404 });
}

export function createWorker(deps: WorkerDeps = {}) {
  const resolved = {
    ...deps,
    snapshotFromRepo: deps.snapshotFromRepo ?? snapshotFromGitHubRepo,
  };
  return {
    async fetch(request: Request, env: WorkerEnv, ctx?: WorkerContext): Promise<Response> {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "content-type",
          },
        });
      }
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return handleApi(request, url, env, resolved, ctx);

      if (url.pathname === "/" && !url.searchParams.has("repo")) return landingPage();
      if (url.pathname === "/" && url.searchParams.has("repo")) {
        const repo = url.searchParams.get("repo") ?? "";
        if (!normalizeGitHubRepo(repo)) return landingPage();
        return new Response(null, {
          status: 302,
          headers: {
            location: appLocation(repo),
            "cache-control": "no-store",
          },
        });
      }

      return env.ASSETS.fetch(request);
    },
  };
}

export default createWorker();
