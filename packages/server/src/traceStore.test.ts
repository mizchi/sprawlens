import { describe, expect, it, vi } from "vitest";
import type { TraceTimeline } from "@sprawlens/schema";
import { createTraceStore, ingestProfileInto, isProfileFile } from "./traceStore.ts";

/** Minimal timeline with `n` server steps and one plane span. */
function timeline(n: number): TraceTimeline {
  return {
    schemaVersion: 1,
    steps: Array.from({ length: n }, (_, i) => ({
      t: i,
      durUs: 1,
      plane: "server" as const,
      symbolId: `symbol:a.ts:fn:f${i}:1`,
      depth: 0,
      stack: [`symbol:a.ts:fn:f${i}:1`],
    })),
    planes: [{ plane: "server", startUs: 0, durationUs: n }],
  };
}

describe("createTraceStore", () => {
  it("push returns metadata derived from the timeline (no steps in the meta)", () => {
    const store = createTraceStore();
    const meta = store.push("run-a", timeline(3));
    expect(meta.label).toBe("run-a");
    expect(meta.stepCount).toBe(3);
    expect(meta.planes).toEqual([{ plane: "server", startUs: 0, durationUs: 3 }]);
    expect(typeof meta.id).toBe("string");
    expect(typeof meta.capturedAt).toBe("number");
    expect(meta).not.toHaveProperty("timeline");
    expect(meta).not.toHaveProperty("steps");
  });

  it("assigns a unique id per push", () => {
    const store = createTraceStore();
    const a = store.push("a", timeline(1));
    const b = store.push("b", timeline(1));
    expect(a.id).not.toBe(b.id);
  });

  it("list returns metadata newest-first", () => {
    const store = createTraceStore();
    store.push("a", timeline(1));
    store.push("b", timeline(1));
    store.push("c", timeline(1));
    expect(store.list().map((m) => m.label)).toEqual(["c", "b", "a"]);
  });

  it("get returns the full timeline by id, null for unknown", () => {
    const store = createTraceStore();
    const meta = store.push("a", timeline(2));
    expect(store.get(meta.id)?.steps).toHaveLength(2);
    expect(store.get("nope")).toBeNull();
  });

  it("evicts the oldest beyond the capacity (ring buffer)", () => {
    const store = createTraceStore(2);
    const a = store.push("a", timeline(1));
    store.push("b", timeline(1));
    store.push("c", timeline(1));
    expect(store.list().map((m) => m.label)).toEqual(["c", "b"]);
    // the evicted entry's timeline is gone
    expect(store.get(a.id)).toBeNull();
  });
});

describe("isProfileFile", () => {
  it("accepts .cpuprofile, rejects everything else", () => {
    expect(isProfileFile("run.cpuprofile")).toBe(true);
    expect(isProfileFile("run.cpuprofile.tmp")).toBe(false);
    expect(isProfileFile("run.log")).toBe(false);
    expect(isProfileFile("notes.txt")).toBe(false);
  });
});

describe("ingestProfileInto", () => {
  it("pushes the built timeline and announces its metadata (label from basename)", async () => {
    const store = createTraceStore();
    const onMeta = vi.fn();
    const meta = await ingestProfileInto(
      store,
      async () => timeline(2),
      "/tmp/drop/run-7.cpuprofile",
      onMeta,
    );
    expect(meta?.label).toBe("run-7.cpuprofile");
    expect(store.list()).toHaveLength(1);
    expect(onMeta).toHaveBeenCalledWith(meta);
  });

  it("is a no-op when ingest yields null (unreadable / unresolvable)", async () => {
    const store = createTraceStore();
    const onMeta = vi.fn();
    const meta = await ingestProfileInto(store, async () => null, "/tmp/x.cpuprofile", onMeta);
    expect(meta).toBeNull();
    expect(store.list()).toHaveLength(0);
    expect(onMeta).not.toHaveBeenCalled();
  });

  it("is a no-op when the timeline has no steps", async () => {
    const store = createTraceStore();
    const onMeta = vi.fn();
    const meta = await ingestProfileInto(
      store,
      async () => timeline(0),
      "/tmp/x.cpuprofile",
      onMeta,
    );
    expect(meta).toBeNull();
    expect(store.list()).toHaveLength(0);
    expect(onMeta).not.toHaveBeenCalled();
  });
});
