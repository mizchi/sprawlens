import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import {
  AST_DIFF_BASELINES,
  astDiffBaselinePredictor,
} from "../packages/viz/src/astDiffBaselines.ts";
import { parseChangedAfterLines } from "../packages/viz/src/astDiffRepresentation.ts";
import {
  evaluateAstDiffGoldSet,
  parseAstDiffAnnotationManifest,
  parseAstDiffGoldSet,
} from "../packages/viz/src/astSymbolDiffEvaluation.ts";

const execFileAsync = promisify(execFile);

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const manifestPath = resolve(
  option("--manifest", "research/ast-diff-registration-v3-annotation.json"),
);
const goldPath = resolve(
  option("--gold", "research/datasets/ast-diff-registration-v3-posthoc.json"),
);
const outputPath = resolve(
  option("--output", "research/results/ast-diff-baseline-comparison.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-baseline-comparison.md"),
);
const manifest = parseAstDiffAnnotationManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const goldSet = parseAstDiffGoldSet(JSON.parse(await readFile(goldPath, "utf8")));
if (manifest.datasetId !== goldSet.datasetId) {
  throw new Error(`manifest ${manifest.datasetId} does not match gold set ${goldSet.datasetId}`);
}
if (goldSet.datasetId === "ast-diff-confirmatory-v2-holdout") {
  throw new Error("confirmatory v2 evaluation is blocked until the final annotation freeze exists");
}
const manifestDirectory = dirname(manifestPath);
const changedAfterLinesByCase = new Map<string, number[]>();
for (const testCase of manifest.cases) {
  const repo = resolve(manifestDirectory, testCase.repositoryPath);
  const { stdout } = await execFileAsync(
    "git",
    [
      "-C",
      repo,
      "diff",
      "--no-ext-diff",
      "--unified=0",
      testCase.beforeRevision,
      testCase.afterRevision,
      "--",
      testCase.file,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  changedAfterLinesByCase.set(testCase.id, parseChangedAfterLines(stdout));
}

const reports = Object.fromEntries(
  AST_DIFF_BASELINES.map((baseline) => [
    baseline,
    evaluateAstDiffGoldSet(goldSet, changedAfterLinesByCase, astDiffBaselinePredictor(baseline)),
  ]),
);
const output = {
  schemaVersion: 1,
  datasetId: goldSet.datasetId,
  status: "post-hoc baseline harness development; not confirmatory evidence",
  conditions: AST_DIFF_BASELINES,
  reports,
};
await Promise.all([
  writeAtomic(outputPath, `${JSON.stringify(output, null, 2)}\n`),
  writeAtomic(markdownPath, markdown(output)),
]);
process.stdout.write(
  `${goldSet.datasetId}: compared ${AST_DIFF_BASELINES.length} AST diff conditions\n`,
);

function markdown(value: typeof output): string {
  const pct = (number: number) => `${(number * 100).toFixed(1)}%`;
  return [
    `# AST diff baseline comparison: ${value.datasetId}`,
    "",
    `Status: ${value.status}.`,
    "",
    "All conditions use the same materialized after-symbol universe and scoring path. `file-all-symbols` projects a file-level changed flag onto every visible symbol in that file; it is intentionally coarse. `range-overlap` uses only changed after-lines and symbol ranges. `structural-flat` matches declarations without parent-qualified identity or ancestor propagation. `parent-aware` is the full Sprawlens condition.",
    "",
    "| Condition | Cases | Gold | Predicted | TP | FP | FN | Precision | Recall | F1 | Status accuracy |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...AST_DIFF_BASELINES.map((condition) => {
      const metrics = value.reports[condition].micro;
      return `| ${condition} | ${metrics.cases} | ${metrics.expected} | ${metrics.predicted} | ${metrics.truePositive} | ${metrics.falsePositive} | ${metrics.falseNegative} | ${pct(metrics.precision)} | ${pct(metrics.recall)} | ${pct(metrics.f1)} | ${pct(metrics.statusAccuracy)} |`;
    }),
    "",
    "The input labels are the post-hoc v3 development set. These numbers validate the comparison harness and may motivate preregistered contrasts, but they must not be reported as confirmatory baseline superiority.",
    "",
  ].join("\n");
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}
