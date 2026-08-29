import type { FileNode } from "@sprawlens/contracts";

export type FileIdentityEvidence = "fingerprint" | "declaration";

export type FileContinuityMatch = {
  beforePath: string;
  afterPath: string;
  evidence: FileIdentityEvidence;
  signature: string;
  symbolCount: number;
};

export type AmbiguousFileContinuity = {
  evidence: FileIdentityEvidence;
  signature: string;
  beforePaths: string[];
  afterPaths: string[];
};

export type FileContinuityResult = {
  matches: FileContinuityMatch[];
  ambiguous: AmbiguousFileContinuity[];
  unmatchedBeforePaths: string[];
  unmatchedAfterPaths: string[];
};

export type FileContinuityOptions = {
  /** Small signatures collide easily (for example, files containing only `main`). */
  minimumSymbolCount?: number;
};

type Evidence = {
  file: FileNode;
  evidence: FileIdentityEvidence;
  signature: string;
  symbolCount: number;
};

/**
 * Conservatively links removed and added paths that carry the same structural
 * evidence. Exact fingerprint multisets are considered first; unmatched files
 * may then use exact declaration kind/name multisets. A non-unique signature
 * is reported as ambiguous and is never guessed.
 */
export function matchFileContinuity(
  before: readonly FileNode[],
  after: readonly FileNode[],
  options: FileContinuityOptions = {},
): FileContinuityResult {
  const minimumSymbolCount = options.minimumSymbolCount ?? 2;
  if (!Number.isInteger(minimumSymbolCount) || minimumSymbolCount < 1) {
    throw new RangeError("minimumSymbolCount must be a positive integer");
  }
  assertUniquePaths(before, "before");
  assertUniquePaths(after, "after");

  const beforePaths = new Set(before.map((file) => file.path));
  const afterPaths = new Set(after.map((file) => file.path));
  const removed = before.filter((file) => !afterPaths.has(file.path));
  const added = after.filter((file) => !beforePaths.has(file.path));
  const unmatchedBefore = new Set(removed.map((file) => file.path));
  const unmatchedAfter = new Set(added.map((file) => file.path));
  const matches: FileContinuityMatch[] = [];
  const ambiguous: AmbiguousFileContinuity[] = [];

  for (const evidence of ["fingerprint", "declaration"] as const) {
    const beforeGroups = groupEvidence(
      removed.filter((file) => unmatchedBefore.has(file.path)),
      evidence,
      minimumSymbolCount,
    );
    const afterGroups = groupEvidence(
      added.filter((file) => unmatchedAfter.has(file.path)),
      evidence,
      minimumSymbolCount,
    );

    for (const signature of [...beforeGroups.keys()].sort()) {
      const beforeCandidates = beforeGroups.get(signature) ?? [];
      const afterCandidates = afterGroups.get(signature) ?? [];
      if (afterCandidates.length === 0) continue;

      if (beforeCandidates.length !== 1 || afterCandidates.length !== 1) {
        ambiguous.push({
          evidence,
          signature,
          beforePaths: beforeCandidates.map(({ file }) => file.path).sort(),
          afterPaths: afterCandidates.map(({ file }) => file.path).sort(),
        });
        continue;
      }

      const [beforeCandidate] = beforeCandidates;
      const [afterCandidate] = afterCandidates;
      if (!beforeCandidate || !afterCandidate) continue;
      matches.push({
        beforePath: beforeCandidate.file.path,
        afterPath: afterCandidate.file.path,
        evidence,
        signature,
        symbolCount: beforeCandidate.symbolCount,
      });
      unmatchedBefore.delete(beforeCandidate.file.path);
      unmatchedAfter.delete(afterCandidate.file.path);
    }
  }

  return {
    matches: matches.sort((a, b) => a.beforePath.localeCompare(b.beforePath)),
    ambiguous: ambiguous.sort(compareAmbiguity),
    unmatchedBeforePaths: [...unmatchedBefore].sort(),
    unmatchedAfterPaths: [...unmatchedAfter].sort(),
  };
}

function groupEvidence(
  files: readonly FileNode[],
  evidence: FileIdentityEvidence,
  minimumSymbolCount: number,
): Map<string, Evidence[]> {
  const groups = new Map<string, Evidence[]>();
  for (const file of files) {
    const item = evidenceFor(file, evidence, minimumSymbolCount);
    if (!item) continue;
    const group = groups.get(item.signature) ?? [];
    group.push(item);
    groups.set(item.signature, group);
  }
  return groups;
}

function evidenceFor(
  file: FileNode,
  evidence: FileIdentityEvidence,
  minimumSymbolCount: number,
): Evidence | undefined {
  const symbols = file.symbols ?? [];
  if (symbols.length < minimumSymbolCount) return undefined;

  const entries: string[][] = [];
  for (const symbol of symbols) {
    if (evidence === "fingerprint") {
      if (!symbol.fingerprint) return undefined;
      entries.push([symbol.kind, symbol.fingerprint]);
    } else {
      entries.push([symbol.kind, symbol.name]);
    }
  }

  return {
    file,
    evidence,
    signature: JSON.stringify(entries.sort(compareEntry)),
    symbolCount: symbols.length,
  };
}

function compareEntry(a: string[], b: string[]): number {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

function compareAmbiguity(a: AmbiguousFileContinuity, b: AmbiguousFileContinuity): number {
  return a.evidence.localeCompare(b.evidence) || a.signature.localeCompare(b.signature);
}

function assertUniquePaths(files: readonly FileNode[], side: "before" | "after"): void {
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) throw new Error(`duplicate ${side} path: ${file.path}`);
    seen.add(file.path);
  }
}
