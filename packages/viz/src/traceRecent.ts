import type { TraceMeta } from "@sprawlens/schema";

/**
 * Merge a freshly-announced capture into the recent list (newest first),
 * replacing any entry with the same id and capping at `max`. Mirrors the
 * server's ring buffer so the picker and the store stay in agreement.
 */
export function mergeTraceMeta(list: TraceMeta[], incoming: TraceMeta, max = 10): TraceMeta[] {
  const without = list.filter((m) => m.id !== incoming.id);
  return [incoming, ...without].slice(0, max);
}
