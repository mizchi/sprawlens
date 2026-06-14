// Convert a .codesprawl snapshot to the atlas SnapshotLike fixture.
// Usage: node scripts/snapshot-to-fixture.mjs <snapshot.json> <exportName> [json] > out
//   default emits a TS module; pass "json" as the 3rd arg for raw JSON.
import { readFileSync } from "node:fs";

const [snapPath, exportName = "sprawlensSnapshot", format = "ts"] =
  process.argv.slice(2);
const snap = JSON.parse(readFileSync(snapPath, "utf8"));

const MEMBER = /^(static-)?(method|property)$/;

// per-file: name -> top-level exported symbol id (members excluded; imports
// only bind top-level exports)
const exportByFile = new Map();
for (const n of snap.nodes) {
  if (n.type !== "file") continue;
  const m = new Map();
  for (const s of n.symbols ?? []) {
    if (s.exported && !MEMBER.test(s.kind)) m.set(s.name, s.id);
  }
  exportByFile.set(n.id, m);
}

const nodes = snap.nodes.map((n) => {
  if (n.type === "repo") return { id: n.id, type: "repo" };
  if (n.type === "dir") return { id: n.id, type: "dir", path: n.path };
  // file
  const symbols = (n.symbols ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    loc: s.loc,
    ...(s.complexity !== undefined ? { complexity: s.complexity } : {}),
    ...(s.exported ? { exported: true } : {}),
  }));
  return {
    id: n.id,
    type: "file",
    path: n.path,
    loc: n.loc,
    ...(symbols.length ? { symbols } : {}),
  };
});

const edges = [];
for (const e of snap.edges) {
  if (e.type !== "imports") continue;
  const out = { type: "imports", from: e.from, to: e.to, resolved: !!e.resolved };
  if (e.external) {
    out.external = true;
    out.specifier = e.specifier;
    edges.push(out);
    continue;
  }
  if (e.resolved) {
    const exp = exportByFile.get(e.to);
    if (exp) {
      const seen = new Set();
      const symbolImports = [];
      for (const b of e.bindings ?? []) {
        const id = exp.get(b.imported);
        if (id && !seen.has(id)) { seen.add(id); symbolImports.push({ toSymbolId: id }); }
      }
      if (symbolImports.length) out.symbolImports = symbolImports;
    }
  }
  edges.push(out);
}

const fixture = { nodes, edges };
if (format === "json") {
  process.stdout.write(JSON.stringify(fixture));
} else {
  process.stdout.write(
    `// Generated from .codesprawl snapshot (commit ${snap.commit?.shortHash ?? "?"}).
// Regenerate: npx tsx src/cli/index.ts collect . --commits 1, then
//   node scripts/snapshot-to-fixture.mjs <snapshot.json> ${exportName} > <out>
import type { SnapshotLike } from "../fixtureAdapter.js";

export const ${exportName}: SnapshotLike = ${JSON.stringify(fixture, null, 1)};
`,
  );
}
