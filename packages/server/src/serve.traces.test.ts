import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { TraceTimeline } from "@sprawlens/schema";
import { createAtlasServer } from "./serve.ts";

function timeline(label: string): TraceTimeline {
  return {
    schemaVersion: 1,
    steps: [
      {
        t: 0,
        durUs: 1,
        plane: "server",
        symbolId: `symbol:${label}.ts:fn:f:1`,
        depth: 0,
        stack: [],
      },
    ],
    planes: [{ plane: "server", startUs: 0, durationUs: 1 }],
  };
}

const servers: { close: () => void }[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

async function startServer(opts: Parameters<typeof createAtlasServer>[0]) {
  const server = createAtlasServer(opts);
  await new Promise<void>((r) => server.listen(0, r));
  servers.push(server);
  const port = (server.address() as AddressInfo).port;
  return `http://127.0.0.1:${port}`;
}

const poll = async (fn: () => Promise<boolean>, ms = 3000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};

describe("/api/traces", () => {
  it("is empty when no watch is configured", async () => {
    const base = await startServer({ repos: new Map([["r", "/tmp"]]) });
    const list = await fetch(`${base}/api/traces`).then((r) => r.json());
    expect(list).toEqual([]);
  });

  it("ingests a dropped .cpuprofile and serves its metadata + full timeline", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sprawlens-traces-"));
    const base = await startServer({
      repos: new Map([["r", "/tmp"]]),
      traceWatch: { dir, ingest: async () => timeline("dropped") },
    });

    await writeFile(join(dir, "run-1.cpuprofile"), "{}");

    const appeared = await poll(async () => {
      const list = await fetch(`${base}/api/traces`).then((r) => r.json());
      return Array.isArray(list) && list.length === 1;
    });
    expect(appeared).toBe(true);

    const list = await fetch(`${base}/api/traces`).then((r) => r.json());
    expect(list[0].label).toBe("run-1.cpuprofile");
    expect(list[0].stepCount).toBe(1);
    expect(list[0]).not.toHaveProperty("steps");

    const full = await fetch(`${base}/api/traces/${list[0].id}`).then((r) => r.json());
    expect(full.steps).toHaveLength(1);
  });

  it("404s an unknown trace id", async () => {
    const base = await startServer({ repos: new Map([["r", "/tmp"]]) });
    const res = await fetch(`${base}/api/traces/nope`);
    expect(res.status).toBe(404);
  });

  it("announces a new capture over the SSE stream", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sprawlens-traces-"));
    const base = await startServer({
      repos: new Map([["r", "/tmp"]]),
      traceWatch: { dir, ingest: async () => timeline("sse") },
    });

    const res = await fetch(`${base}/api/traces/stream`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    await writeFile(join(dir, "run-sse.cpuprofile"), "{}");

    let buf = "";
    const got = await poll(async () => {
      const { value, done } = await reader.read();
      if (done) return false;
      buf += decoder.decode(value, { stream: true });
      return buf.includes("run-sse.cpuprofile");
    });
    await reader.cancel();
    expect(got).toBe(true);
  });
});
