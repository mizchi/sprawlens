import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  validateCompletedSoloAstDiffAnnotationPass,
  type SoloAstDiffAnnotationKey,
  type SoloAstDiffAnnotationSheet,
} from "../packages/viz/src/astDiffSoloAnnotation.ts";

const passId = parsePassId(option("--pass", "A"));
const suffix = passId.toLowerCase();
const sheetPath = resolve(
  option("--sheet", `research/ast-diff-confirmatory-v2-solo-pass-${suffix}.json`),
);
const keyPath = resolve(
  option("--key", `research/ast-diff-confirmatory-v2-solo-pass-${suffix}-key.json`),
);
const outputPath = resolve(
  option("--output", `research/ast-diff-confirmatory-v2-solo-pass-${suffix}-lock.json`),
);
await assertMissing(outputPath, `pass ${passId} lock already exists and is immutable`);
const [sheetText, keyText] = await Promise.all([
  readFile(sheetPath, "utf8"),
  readFile(keyPath, "utf8"),
]);
const summary = validateCompletedSoloAstDiffAnnotationPass(
  JSON.parse(sheetText) as SoloAstDiffAnnotationSheet,
  JSON.parse(keyText) as SoloAstDiffAnnotationKey,
  passId,
);
const outputDirectory = dirname(outputPath);
const lock = {
  schemaVersion: 1,
  datasetId: summary.datasetId,
  passId,
  status: "completed solo annotation pass; immutable before the other pass is opened",
  design: "single-annotator-test-retest",
  ...summary,
  files: [
    { path: relative(outputDirectory, sheetPath), sha256: sha256(sheetText) },
    { path: relative(outputDirectory, keyPath), sha256: sha256(keyText) },
  ],
};
await writeAtomic(outputPath, `${JSON.stringify(lock, null, 2)}\n`);
process.stdout.write(
  `${summary.datasetId}: locked solo pass ${passId}, ${summary.cases} cases, ${summary.symbols} symbols\n`,
);

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function parsePassId(value: string): "A" | "B" {
  const normalized = value.toUpperCase();
  if (normalized !== "A" && normalized !== "B") throw new Error("--pass must be A or B");
  return normalized;
}

async function assertMissing(path: string, message: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
  throw new Error(message);
}
