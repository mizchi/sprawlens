import { execFile } from "node:child_process";
import { isAbsolute, relative } from "node:path";
import { promisify } from "node:util";
import type { CallHierarchyResult, LanguageDetail, SymbolRef } from "@sprawlens/schema";

const exec = promisify(execFile);

/**
 * Optional, compiler-aware detail for MoonBit via the `moon ide` toolchain.
 * Semantic and exact (unlike the syntactic baseline), but needs `moon` on PATH
 * and a checkable module, so every call degrades to empty when that is absent —
 * the structure map still works, this only enriches it where the toolchain is.
 *
 * `find-references` is the only semantic relation `moon ide` exposes without a
 * source position, and only as human text, so this parses its location headers
 * (`path:line:col-line:col:`). There is no CFG or outgoing-call command, so
 * `cfg` is null and `callHierarchy` fills `incoming` only.
 */

/** A `moon ide` reference location header. */
const LOC = /^(.*\.mbt):(\d+):\d+-\d+:\d+:?\s*$/;

/**
 * Parse `moon ide find-references` output into repo-relative refs. The first
 * location is the resolved definition; the rest are the incoming references.
 */
export function parseReferences(stdout: string, repoRoot: string, symbol: string): SymbolRef[] {
  const refs: SymbolRef[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(LOC);
    if (!m) continue;
    const abs = m[1]!;
    const file = isAbsolute(abs) ? relative(repoRoot, abs) : abs;
    refs.push({ file, name: symbol, line: Number(m[2]) });
  }
  // drop the leading definition location; the remainder are usages
  return refs.slice(1);
}

async function findReferences(
  repoRoot: string,
  file: string,
  symbol: string,
): Promise<SymbolRef[]> {
  try {
    const { stdout } = await exec("moon", ["ide", "find-references", symbol, "--loc", file], {
      cwd: repoRoot,
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return parseReferences(stdout, repoRoot, symbol);
  } catch {
    // moon absent, module not checkable, or symbol unresolved — no detail
    return [];
  }
}

export const moonbitDetail: LanguageDetail = {
  // `moon ide` has no control-flow graph command
  cfg() {
    return null;
  },
  async callHierarchy(
    repoRoot: string,
    file: string,
    symbol: string,
  ): Promise<CallHierarchyResult> {
    return { incoming: await findReferences(repoRoot, file, symbol), outgoing: [] };
  },
};
