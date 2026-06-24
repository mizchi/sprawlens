import { watch } from "node:fs";
import { basename } from "node:path";
import type { TraceMeta, TraceTimeline } from "@sprawlens/schema";

export type { TraceMeta };

/**
 * In-memory ring buffer of the most recent captured timelines. The server keeps
 * one of these and exposes it at /api/traces (list), /api/traces/:id (one full
 * timeline), and /api/traces/stream (SSE ping on each new capture). Oldest
 * entries fall off once `max` is exceeded.
 */
export interface TraceStore {
  push(label: string, timeline: TraceTimeline): TraceMeta;
  /** metadata, newest first */
  list(): TraceMeta[];
  /** the full timeline for an id, or null if unknown / evicted */
  get(id: string): TraceTimeline | null;
}

export function createTraceStore(max = 10): TraceStore {
  // newest is pushed to the end; capacity holds at most `max` entries.
  const entries: { meta: TraceMeta; timeline: TraceTimeline }[] = [];
  let seq = 0;

  return {
    push(label, timeline) {
      const meta: TraceMeta = {
        id: `t${++seq}`,
        label,
        capturedAt: Date.now(),
        stepCount: timeline.steps.length,
        planes: timeline.planes,
      };
      entries.push({ meta, timeline });
      while (entries.length > max) entries.shift();
      return meta;
    },
    list() {
      return entries.map((e) => e.meta).reverse();
    },
    get(id) {
      return entries.find((e) => e.meta.id === id)?.timeline ?? null;
    },
  };
}

/** A `.cpuprofile` is the only artifact the watcher ingests; other dropped files
 * (logs, partial `.tmp` writes) are ignored. */
export function isProfileFile(name: string): boolean {
  return name.endsWith(".cpuprofile");
}

/** Build one profile path into a timeline and push it to the store, announcing
 * the new metadata. A null ingest (unreadable / unresolvable profile) is a
 * no-op: nothing is stored and no announcement fires. Pulled out of the fs
 * watcher so the push/announce pipeline is testable without touching disk. */
export async function ingestProfileInto(
  store: TraceStore,
  ingest: (profilePath: string) => Promise<TraceTimeline | null>,
  profilePath: string,
  onMeta: (meta: TraceMeta) => void,
): Promise<TraceMeta | null> {
  const timeline = await ingest(profilePath);
  if (!timeline || timeline.steps.length === 0) return null;
  const meta = store.push(basename(profilePath), timeline);
  onMeta(meta);
  return meta;
}

/**
 * Watch a drop directory for `.cpuprofile` files and invoke `onProfile` with the
 * full path once each file's write burst settles (debounced per filename, so a
 * profile streamed in chunks ingests once). Returns a stop function. The dir is
 * expected to exist; a watch error (missing dir) is swallowed so an unconfigured
 * drop dir never crashes the server.
 */
export function watchProfiles(
  dir: string,
  onProfile: (profilePath: string) => void,
  debounceMs = 200,
): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let watcher: ReturnType<typeof watch> | null = null;
  try {
    watcher = watch(dir, (_event, filename) => {
      if (!filename || !isProfileFile(filename)) return;
      const existing = timers.get(filename);
      if (existing) clearTimeout(existing);
      timers.set(
        filename,
        setTimeout(() => {
          timers.delete(filename);
          onProfile(`${dir.endsWith("/") ? dir : `${dir}/`}${filename}`);
        }, debounceMs),
      );
    });
  } catch {
    // missing / unreadable drop dir: nothing to watch
  }
  return () => {
    watcher?.close();
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  };
}
