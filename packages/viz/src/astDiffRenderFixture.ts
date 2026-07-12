import type { SnapshotLike } from "@sprawlens/schema";
import type { AstSymbolLike } from "./astSymbolDiff.ts";

export type AstDiffRenderGoldSet = {
  cases: Array<{
    id: string;
    repository: string;
    file: string;
    after: AstSymbolLike[];
  }>;
};

/** Build an API-compatible snapshot from a materialized AST diff gold set. */
export function buildAstDiffRenderSnapshot(
  goldSet: AstDiffRenderGoldSet,
  options: { repeat?: number } = {},
): SnapshotLike {
  const repeat = Math.max(1, Math.floor(options.repeat ?? 1));
  const nodes: SnapshotLike["nodes"] = [];
  for (let copy = 0; copy < repeat; copy++) {
    for (const testCase of goldSet.cases) {
      const path = `copy-${copy}/${testCase.repository}/${testCase.file}`;
      const idByOldId = new Map(
        testCase.after.map((symbol) => [
          symbol.id,
          symbolId(path, symbol.kind, symbol.name, symbol.startLine ?? lineFromId(symbol.id)),
        ]),
      );
      const symbols = testCase.after.map((symbol) => ({
        ...symbol,
        id: idByOldId.get(symbol.id)!,
        // Gold sets intentionally omit export metadata. Mark every extracted
        // symbol visible so the rendering experiment measures extraction
        // density instead of the application's default "hide local" filter.
        exported: true,
        ...(symbol.parentClass
          ? { parentClass: idByOldId.get(symbol.parentClass) ?? symbol.parentClass }
          : {}),
      }));
      const maxEnd = symbols.reduce(
        (max, symbol) =>
          Math.max(
            max,
            symbol.endLine ??
              (symbol.startLine ?? lineFromId(symbol.id)) + Math.max(1, symbol.loc) - 1,
          ),
        1,
      );
      const symbolLoc = symbols.reduce((sum, symbol) => sum + Math.max(1, symbol.loc), 0);
      nodes.push({
        id: `file:${path}`,
        type: "file",
        path,
        loc: Math.max(maxEnd, symbolLoc, 1),
        symbols,
      });
    }
  }
  return { nodes, edges: [] };
}

function symbolId(path: string, kind: string, name: string, line: number): string {
  return `symbol:${path}:${kind}:${name}:${line}`;
}

function lineFromId(id: string): number {
  const line = Number.parseInt(id.slice(id.lastIndexOf(":") + 1), 10);
  return Number.isFinite(line) ? line : 1;
}
