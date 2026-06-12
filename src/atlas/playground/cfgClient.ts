import type { DetailGraph } from "../contracts/detail.js";

/**
 * Client for the dynamic CFG detail level: fetched per symbol when the
 * camera zooms deep enough, never part of the static snapshot. Any
 * failure (server absent, fixture-only session) resolves to null and the
 * cell simply stays plain.
 */

/** Fetch params from a snapshot symbol id; null for synthesized symbols. */
export function cfgRequestOf(
  symbolId: string,
): { file: string; line: number } | null {
  if (!symbolId.startsWith("symbol:")) return null;
  const parts = symbolId.split(":"); // symbol:<path>:<kind>:<name>:<line>
  const line = Number(parts[parts.length - 1]);
  if (!parts[1] || !Number.isFinite(line)) return null;
  return { file: parts[1], line };
}

/** Display name embedded in a snapshot symbol id; null otherwise. */
export function symbolNameOf(id: string): string | null {
  if (!id.startsWith("symbol:")) return null;
  const parts = id.split(":");
  return parts.length >= 5 ? (parts[parts.length - 2] ?? null) : null;
}

export async function fetchCfg(
  repo: string,
  file: string,
  line: number,
): Promise<DetailGraph | null> {
  try {
    const response = await fetch("/api/cfg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, file, line }),
    });
    if (!response.ok) return null;
    return (await response.json()) as DetailGraph | null;
  } catch {
    return null;
  }
}
