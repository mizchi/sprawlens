import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { extractCodeSymbolsFromSource } from "../packages/analyzer-ts/src/snapshot.ts";
import { parseChangedAfterLines } from "../packages/viz/src/astDiffRepresentation.ts";
import {
  evaluateAstDiffGoldSet,
  materializeAstDiffGoldSet,
  parseAstDiffAnnotationManifest,
  type AstDiffEvaluationReport,
  type AstDiffMetrics,
} from "../packages/viz/src/astSymbolDiffEvaluation.ts";

const execFileAsync = promisify(execFile);

type Options = {
  manifest: string;
  gold: string;
  output: string;
  markdown: string;
};

function parseArgs(args: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`expected --name value arguments, received: ${args.join(" ")}`);
    }
    values.set(key.slice(2), value);
  }
  return {
    manifest: resolve(values.get("manifest") ?? "research/ast-diff-annotation-manifest.json"),
    gold: resolve(values.get("gold") ?? "research/datasets/ast-diff-gold-v1.json"),
    output: resolve(values.get("output") ?? "research/results/ast-diff-gold-v1-report.json"),
    markdown: resolve(values.get("markdown") ?? "research/results/ast-diff-gold-v1-report.md"),
  };
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

async function writeTextAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

async function sourceAtRevision(repo: string, revision: string, file: string): Promise<string> {
  try {
    await git(repo, ["cat-file", "-e", `${revision}:${file}`]);
  } catch {
    return "";
  }
  return git(repo, ["show", `${revision}:${file}`]);
}

function metricRow(label: string, metrics: AstDiffMetrics): string {
  const percent = (value: number) => (value * 100).toFixed(1);
  return `| ${label} | ${metrics.cases} | ${metrics.expected} | ${metrics.predicted} | ${metrics.truePositive} | ${metrics.falsePositive} | ${metrics.falseNegative} | ${percent(metrics.precision)}% | ${percent(metrics.recall)}% | ${percent(metrics.f1)}% | ${percent(metrics.statusAccuracy)}% |`;
}

function markdownReport(report: AstDiffEvaluationReport): string {
  const header = [
    "| Group | Cases | Gold | Predicted | TP | FP | FN | Precision | Recall | F1 | Status accuracy |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const failures = report.cases.filter(
    (item) => item.falsePositive > 0 || item.falseNegative > 0 || item.statusMismatchIds.length > 0,
  );
  return [
    `# AST diff gold-set report: ${report.datasetId}`,
    "",
    "Detection is scored on the visible after-revision symbol set. Status accuracy distinguishes `added` from `modified` among matched symbols.",
    "",
    "## Micro average",
    "",
    ...header,
    metricRow("all", report.micro),
    "",
    "## By change kind",
    "",
    "Cases may appear in multiple change-kind slices; these rows are not additive.",
    "",
    ...header,
    ...Object.entries(report.byChangeKind).map(([key, value]) => metricRow(key, value)),
    "",
    "## By language",
    "",
    ...header,
    ...Object.entries(report.byLanguage).map(([key, value]) => metricRow(key, value)),
    "",
    "## By repository",
    "",
    ...header,
    ...Object.entries(report.byRepository).map(([key, value]) => metricRow(key, value)),
    "",
    ...(report.representation
      ? [
          "## AST representation coverage",
          "",
          "This is an upper-bound coverage measure: the fraction of changed after-revision lines enclosed by at least one extracted AST symbol range. It is separate from precision/recall over representable symbols.",
          "",
          "| Group | Cases | Changed after-lines | Covered after-lines | Coverage |",
          "| --- | ---: | ---: | ---: | ---: |",
          `| all | ${report.representation.micro.cases} | ${report.representation.micro.changedAfterLines} | ${report.representation.micro.coveredAfterLines} | ${(report.representation.micro.coverage * 100).toFixed(1)}% |`,
          ...Object.entries(report.representation.byRepository).map(
            ([key, value]) =>
              `| ${key} | ${value.cases} | ${value.changedAfterLines} | ${value.coveredAfterLines} | ${(value.coverage * 100).toFixed(1)}% |`,
          ),
          "",
          "### Uncovered changed after-lines",
          "",
          ...report.representation.cases.flatMap((item) =>
            item.uncoveredAfterLines.length > 0
              ? [`- ${item.id}: ${item.uncoveredAfterLines.join(", ")}`]
              : [],
          ),
          ...(report.representation.cases.every((item) => item.uncoveredAfterLines.length === 0)
            ? ["No uncovered after-lines."]
            : []),
          "",
        ]
      : []),
    "## Error cases",
    "",
    ...(failures.length === 0
      ? ["No false positives, false negatives, or status mismatches."]
      : failures.flatMap((item) => [
          `### ${item.id}`,
          "",
          `- False positives: ${item.falsePositiveIds.join(", ") || "none"}`,
          `- False negatives: ${item.falseNegativeIds.join(", ") || "none"}`,
          `- Status mismatches: ${item.statusMismatchIds.join(", ") || "none"}`,
          "",
        ])),
    "",
  ].join("\n");
}

const options = parseArgs(process.argv.slice(2));
const manifest = parseAstDiffAnnotationManifest(
  JSON.parse(await readFile(options.manifest, "utf8")),
);
const manifestDirectory = dirname(options.manifest);
const verifiedRevisions = new Set<string>();
const sourceCache = new Map<string, Promise<string>>();

const goldSet = await materializeAstDiffGoldSet(manifest, async (request) => {
  const repo = resolve(manifestDirectory, request.repositoryPath);
  const revisionKey = `${repo}\0${request.revision}`;
  if (!verifiedRevisions.has(revisionKey)) {
    await git(repo, ["rev-parse", "--verify", `${request.revision}^{commit}`]);
    verifiedRevisions.add(revisionKey);
  }
  const sourceKey = `${revisionKey}\0${request.file}`;
  let source = sourceCache.get(sourceKey);
  if (!source) {
    source = sourceAtRevision(repo, request.revision, request.file);
    sourceCache.set(sourceKey, source);
  }
  const content = await source;
  return content === "" ? [] : extractCodeSymbolsFromSource(request.file, content);
});
const changedAfterLinesByCase = new Map<string, number[]>();
await Promise.all(
  manifest.cases.map(async (testCase) => {
    const repo = resolve(manifestDirectory, testCase.repositoryPath);
    const patch = await git(repo, [
      "diff",
      "--no-ext-diff",
      "--unified=0",
      testCase.beforeRevision,
      testCase.afterRevision,
      "--",
      testCase.file,
    ]);
    changedAfterLinesByCase.set(testCase.id, parseChangedAfterLines(patch));
  }),
);
const report = evaluateAstDiffGoldSet(goldSet, changedAfterLinesByCase);

await Promise.all([
  writeJsonAtomic(options.gold, goldSet),
  writeJsonAtomic(options.output, report),
  writeTextAtomic(options.markdown, markdownReport(report)),
]);

process.stdout.write(
  `${report.datasetId}: n=${report.micro.cases}, precision=${report.micro.precision.toFixed(3)}, recall=${report.micro.recall.toFixed(3)}, F1=${report.micro.f1.toFixed(3)}\n`,
);
