import type { TestNode, TestTree } from "@sprawlens/contracts";

/**
 * One test file's extracted suite/case forest. A language analyzer produces
 * these (its `TestAdapter`); `buildTestTree` assembles them under directory and
 * file nodes. `nodes` are the top-level suites/cases of the file, already nested.
 */
export type TestFileExtraction = { file: string; nodes: TestNode[] };

/**
 * Per-language test extractor. Each analyzer implements this for its framework
 * (vitest/node:test `describe`/`it`, Rust test `mod`, Go `TestXxx`, MoonBit
 * `test`): given a file's source, return its suite/case forest, or null when
 * the file holds no recognizable tests. The neutral `buildTestTree` adds the
 * directory/file scaffolding common to every language.
 */
export interface TestAdapter {
  extractFile(file: string, source: string): TestNode[] | null;
}

/** Directory segments shared by every file's parent path (the common prefix). */
function commonDirPrefix(files: readonly string[]): string {
  if (files.length === 0) return "";
  const dirsOf = (f: string): string[] => f.split("/").slice(0, -1);
  let common = dirsOf(files[0]!);
  for (let k = 1; k < files.length; k++) {
    const segs = dirsOf(files[k]!);
    let i = 0;
    while (i < common.length && i < segs.length && common[i] === segs[i]) i++;
    common = common.slice(0, i);
  }
  return common.join("/");
}

type DirEntry = {
  dirs: Map<string, DirEntry>;
  files: { name: string; node: TestNode }[];
};

/** Convert a mutable dir entry into a TestNode, collapsing single-child chains
 * (a dir holding exactly one sub-dir and no files) so the tree stays shallow. */
function toDirNode(entry: DirEntry, relPath: string, label: string): TestNode {
  let displayName = label;
  let rel = relPath;
  let cur = entry;
  while (cur.files.length === 0 && cur.dirs.size === 1) {
    const [seg, only] = [...cur.dirs.entries()][0]!;
    displayName = displayName ? `${displayName}/${seg}` : seg;
    rel = rel ? `${rel}/${seg}` : seg;
    cur = only;
  }
  const children: TestNode[] = [];
  for (const [seg, sub] of cur.dirs)
    children.push(toDirNode(sub, rel ? `${rel}/${seg}` : seg, seg));
  for (const { node } of cur.files) children.push(node);
  return {
    id: relPath === "" ? "testroot" : `testdir:${rel}`,
    kind: "dir",
    name: displayName,
    children,
  };
}

/**
 * Assemble per-file test extractions into a `dir → file → suite → case` tree.
 * The directory prefix shared by every test file is stripped (so the tree
 * starts where paths diverge), and single-child directory chains collapse into
 * one node. Returns null when no file carries any test.
 */
export function buildTestTree(
  files: readonly TestFileExtraction[],
): TestTree | null {
  const withTests = files.filter((f) => f.nodes.length > 0);
  if (withTests.length === 0) return null;

  const prefix = commonDirPrefix(withTests.map((f) => f.file));
  const root: DirEntry = { dirs: new Map(), files: [] };
  for (const { file, nodes } of withTests) {
    const rel = file.slice(prefix.length).replace(/^\/+/, "");
    const segs = rel.split("/");
    const fileName = segs.pop()!;
    let cur = root;
    for (const seg of segs) {
      let next = cur.dirs.get(seg);
      if (!next) cur.dirs.set(seg, (next = { dirs: new Map(), files: [] }));
      cur = next;
    }
    cur.files.push({
      name: fileName,
      node: {
        id: `testfile:${file}`,
        kind: "file",
        name: fileName,
        file,
        children: nodes,
      },
    });
  }
  return { root: toDirNode(root, "", "") };
}
