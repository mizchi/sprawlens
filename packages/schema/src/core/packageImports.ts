import type { CodeEdge, CodeSymbol, CodeSymbolImport } from "@sprawlens/contracts";
import { mergeSymbolImports, symbolImportOf } from "./symbolRefs.js";

/**
 * Import-edge construction for the "a package is a directory" analyzers (Go,
 * MoonBit). Both resolve an import spec to either the importable files of a
 * local package or a grouped external dependency, then turn the file's
 * qualified usages into symbol references against each target file's exports.
 * Only the spec→resolution mapping differs by language, so that is injected;
 * the edge shaping, dedup, and symbol-ref wiring are shared here.
 */

/** A `@pkg.name` / `pkg.Name` / `pkg.Type::method` usage in a file. */
type QualifiedUse = {
  line: number;
  /** The import alias the usage is qualified by. */
  alias: string;
  /** The referenced symbol name (the method, for a `Type::method` use). */
  name: string;
  /** The qualifying type of an associated-method use, to disambiguate. */
  preferClass?: string;
};

/** One import the file declares: the raw spec and the alias it is used by. */
type FilePackageImport = { spec: string; alias: string };

/** What an import spec resolves to: the importable files of a local package, or
 * a grouped external dependency id (with a stdlib flag). */
type ImportResolution = { local: readonly string[] } | { external: string; stdlib?: boolean };

type ResolvePackageImportsArgs = {
  /** The importing file's node id (`file:<rel>`). */
  fileId: string;
  /** The importing file's repo-relative path. */
  rel: string;
  imports: readonly FilePackageImport[];
  uses: readonly QualifiedUse[];
  /** The importing file's symbols — the source side of references. */
  symbols: readonly CodeSymbol[];
  /** The exported symbols of a target file — the reference target side. */
  exportedSymbolsOf: (rel: string) => readonly CodeSymbol[];
  /** Language-specific: map an import spec to local files or an external id. */
  resolveImport: (spec: string) => ImportResolution;
};

export function resolvePackageImports(args: ResolvePackageImportsArgs): CodeEdge[] {
  const { fileId, rel, imports, uses, symbols, exportedSymbolsOf, resolveImport } = args;
  const edges: CodeEdge[] = [];
  const seenSpec = new Set<string>(); // one import edge per spec
  const seenExternal = new Set<string>(); // sub-packages collapse to one group
  for (const imp of imports) {
    if (seenSpec.has(imp.spec)) continue;
    seenSpec.add(imp.spec);
    const res = resolveImport(imp.spec);
    if ("local" in res) {
      const refs = uses.filter((u) => u.alias === imp.alias);
      // a package is a directory: link the importer to every file in it, each
      // resolving only the references it actually exports
      for (const target of res.local) {
        if (target === rel) continue;
        const targetSymbols = exportedSymbolsOf(target);
        const symbolImports: CodeSymbolImport[] = [];
        for (const ref of refs) {
          const si = symbolImportOf(ref, symbols, targetSymbols);
          if (si) mergeSymbolImports(symbolImports, [si]);
        }
        edges.push({
          id: `imports:${fileId}->file:${target}:${imp.spec}`,
          type: "imports",
          from: fileId,
          to: `file:${target}`,
          specifier: imp.spec,
          resolved: true,
          ...(symbolImports.length > 0 ? { symbolImports } : {}),
        });
      }
    } else {
      if (seenExternal.has(res.external)) continue;
      seenExternal.add(res.external);
      edges.push({
        id: `imports:${fileId}->external:${res.external}:${res.external}`,
        type: "imports",
        from: fileId,
        to: `external:${res.external}`,
        specifier: res.external,
        resolved: false,
        external: true,
        ...(res.stdlib ? { stdlib: true } : {}),
      });
    }
  }
  return edges;
}
