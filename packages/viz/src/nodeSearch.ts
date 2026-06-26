/**
 * Fuzzy node search for the command palette. Pure and unit-tested: the App
 * assembles the searchable node list (modules / files / symbols) and feeds it
 * here; the palette renders whatever ranked results come back.
 *
 * Ranking, best to worst: exact label, label prefix, contiguous label
 * substring, then gappy subsequence (with a camelCase / word-boundary bonus,
 * so "rms" finds "RingsMapSvg"). A match in the id alone always ranks below any
 * label match. Ties break by shorter label, then by kind (leaves before
 * containers), then by id for stable ordering.
 */
import type { AtlasNodeKind } from "@sprawlens/schema";

export type SearchNode = { id: string; label: string; kind: AtlasNodeKind };
export type SearchResult = SearchNode & { score: number };

const DEFAULT_LIMIT = 12;

/** Leaves you usually jump to (symbol/file) sort before the containers that
 * hold them; lower is earlier. */
const KIND_RANK: Record<AtlasNodeKind, number> = {
  symbol: 0,
  block: 0,
  class: 1,
  file: 1,
  directory: 2,
  module: 3,
  service: 4,
};

/** Greedy subsequence: indices in `tl` (already lowercased) that spell `ql`, or
 * null when `ql` is not a subsequence. */
function subsequenceIndices(ql: string, tl: string): number[] | null {
  const idx: number[] = [];
  let ti = 0;
  for (const ch of ql) {
    let found = -1;
    while (ti < tl.length) {
      if (tl[ti] === ch) {
        found = ti;
        ti += 1;
        break;
      }
      ti += 1;
    }
    if (found < 0) return null;
    idx.push(found);
  }
  return idx;
}

/** A match index sits on a word boundary: string start, after a separator, or a
 * camelCase hump (upper preceded by lower/digit). Uses the original-case
 * `target` so casing is visible. */
function isBoundary(target: string, i: number): boolean {
  if (i === 0) return true;
  const prev = target[i - 1]!;
  if (!/[a-z0-9]/i.test(prev)) return true;
  return /[A-Z]/.test(target[i]!) && /[a-z0-9]/.test(prev);
}

/** Match quality of `query` against one `target`, in [400, 1000], or null. */
function matchScore(query: string, target: string): number | null {
  const ql = query.toLowerCase();
  const tl = target.toLowerCase();
  if (ql === tl) return 1000;
  if (tl.startsWith(ql)) return 800;
  if (tl.includes(ql)) return 600;
  const idx = subsequenceIndices(ql, tl);
  if (!idx) return null;
  let boundaries = 0;
  for (const i of idx) if (isBoundary(target, i)) boundaries += 1;
  return 400 + Math.min(150, boundaries * 40);
}

export function searchNodesFuzzy(
  query: string,
  nodes: readonly SearchNode[],
  limit = DEFAULT_LIMIT,
): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const results: SearchResult[] = [];
  for (const node of nodes) {
    const labelScore = matchScore(q, node.label);
    // an id-only match always ranks below any label match (max 390 < 400)
    const idScore = labelScore === null ? matchScore(q, node.id) : null;
    const score = labelScore ?? (idScore === null ? null : (idScore / 1000) * 390);
    if (score === null) continue;
    results.push({ ...node, score });
  }
  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.label.length - b.label.length ||
      (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return results.slice(0, limit);
}
