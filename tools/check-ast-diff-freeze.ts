import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const freezePath = resolve(process.argv[2] ?? "research/ast-diff-confirmatory-freeze.json");
const freeze = JSON.parse(await readFile(freezePath, "utf8")) as {
  datasetId?: string;
  files?: Array<{ path?: string; sha256?: string }>;
};
if (!freeze.datasetId || !Array.isArray(freeze.files) || freeze.files.length === 0) {
  throw new Error("invalid AST diff freeze record");
}

const failures: string[] = [];
for (const item of freeze.files) {
  if (!item.path || !item.sha256) throw new Error("invalid file entry in AST diff freeze record");
  const path = resolve(dirname(freezePath), item.path);
  const actual = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  if (actual !== item.sha256) failures.push(`${item.path}: expected ${item.sha256}, got ${actual}`);
}
if (failures.length > 0) {
  throw new Error(`AST diff freeze verification failed:\n${failures.join("\n")}`);
}
process.stdout.write(`${freeze.datasetId}: ${freeze.files.length} frozen inputs verified\n`);
