import { describe, expect, it } from "vitest";
import type { Snapshot } from "@sprawlens/schema";
import worker, { createWorker, type WorkerEnv } from "./worker.ts";

const env: WorkerEnv = {
  ASSETS: {
    fetch: async (request: Request) =>
      new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { "content-type": "text/plain" },
      }),
  },
};

class MemoryCache {
  entries = new Map<string, Response>();

  async match(request: Request): Promise<Response | undefined> {
    return this.entries.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response.clone());
  }
}

function minimalSnapshot(repoPath: string): Snapshot {
  return {
    schemaVersion: 1,
    repoPath,
    commit: {
      hash: "remote",
      shortHash: "remote",
      timestamp: "2026-07-02T00:00:00.000Z",
      authorName: "remote",
      message: "remote snapshot",
      aiIndicators: [],
    },
    nodes: [{ id: "repo", type: "repo", name: repoPath }],
    edges: [],
    metrics: {
      loc: 0,
      fileCount: 0,
      dirCount: 0,
      importEdgeCount: 0,
      unresolvedImportCount: 0,
      cycleCount: 0,
      largestComponentSize: 0,
      maxFanIn: 0,
      maxFanOut: 0,
    },
  };
}

describe("worker", () => {
  it("serves a repository picker on the top page without repo", async () => {
    const res = await worker.fetch(new Request("https://example.com/"), env);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('name="repo"');
  });

  it("redirects form submissions to the served source", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/?repo=mizchi/sprawlens", { redirect: "manual" }),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "/app?source=served&repo=mizchi%2Fsprawlens&layout=rings&tilt=true",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves app assets under /app", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/app?repo=mizchi/sprawlens"),
      env,
    );
    expect(await res.text()).toBe("asset:/app");
  });

  it("caches repository snapshots for one hour", async () => {
    let loads = 0;
    const cache = new MemoryCache();
    const waitUntil: Promise<unknown>[] = [];
    const cachedWorker = createWorker({
      cache,
      snapshotFromRepo: async (repo) => {
        loads++;
        return minimalSnapshot(repo);
      },
    });

    const request = new Request("https://example.com/api/snapshot?repo=mizchi/sprawlens");
    const first = await cachedWorker.fetch(request, env, {
      waitUntil: (promise) => waitUntil.push(promise),
    });
    expect(first.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
    expect(first.headers.get("x-sprawlens-cache")).toBe("miss");
    await Promise.all(waitUntil);

    const second = await cachedWorker.fetch(request, env, {
      waitUntil: (promise) => waitUntil.push(promise),
    });
    expect(second.headers.get("x-sprawlens-cache")).toBe("hit");
    expect(loads).toBe(1);
  });
});
