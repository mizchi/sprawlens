import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  compareSoloAstDiffAnnotationPasses,
  type SoloAstDiffAgreementReport,
  type SoloAstDiffAnnotationKey,
  type SoloAstDiffAnnotationSheet,
} from "../packages/viz/src/astDiffSoloAnnotation.ts";

const passAPath = resolve(option("--pass-a", "research/ast-diff-confirmatory-v2-solo-pass-a.json"));
const keyAPath = resolve(
  option("--key-a", "research/ast-diff-confirmatory-v2-solo-pass-a-key.json"),
);
const passBPath = resolve(option("--pass-b", "research/ast-diff-confirmatory-v2-solo-pass-b.json"));
const keyBPath = resolve(
  option("--key-b", "research/ast-diff-confirmatory-v2-solo-pass-b-key.json"),
);
const outputPath = resolve(
  option("--output", "research/results/ast-diff-confirmatory-v2-solo-agreement.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-confirmatory-v2-solo-agreement.md"),
);

const [passA, keyA, passB, keyB] = await Promise.all([
  readJson<SoloAstDiffAnnotationSheet>(passAPath),
  readJson<SoloAstDiffAnnotationKey>(keyAPath),
  readJson<SoloAstDiffAnnotationSheet>(passBPath),
  readJson<SoloAstDiffAnnotationKey>(keyBPath),
]);
const report = compareSoloAstDiffAnnotationPasses(passA, keyA, passB, keyB);
await Promise.all([
  writeAtomic(outputPath, `${JSON.stringify(report, null, 2)}\n`),
  writeAtomic(markdownPath, renderMarkdown(report)),
]);
process.stdout.write(
  `${report.datasetId}: binary agreement ${(report.binary.agreement * 100).toFixed(1)}%, status agreement ${(report.status.agreement * 100).toFixed(1)}%, ${report.disagreements.length} disagreements\n`,
);

function renderMarkdown(report: SoloAstDiffAgreementReport): string {
  const rows = report.disagreements.map(
    (item) =>
      `| ${escapeCell(item.caseId)} | ${item.kind} | \`${escapeCell(JSON.stringify(item.symbol))}\` | ${item.passA} | ${item.passB} |`,
  );
  return [
    `# Solo AST diff annotation test–retest agreement`,
    "",
    `- Dataset: \`${report.datasetId}\``,
    `- Design: \`${report.design}\``,
    `- Washout: ${report.washoutDays} days (minimum ${report.minimumWashoutDays})`,
    `- Cases: ${report.cases}`,
    `- Symbols: ${report.symbols}`,
    `- Binary agreement: ${(report.binary.agreement * 100).toFixed(1)}% (κ=${report.binary.kappa.toFixed(3)})`,
    `- Status agreement among symbols highlighted in both passes: ${(report.status.agreement * 100).toFixed(1)}% (κ=${report.status.kappa.toFixed(3)}, n=${report.status.compared})`,
    "",
    "## Disagreements",
    "",
    "| Case | Kind | Symbol | Pass A | Pass B |",
    "| --- | --- | --- | --- | --- |",
    ...(rows.length > 0 ? rows : ["| — | — | — | — | — |"]),
    "",
  ].join("\n");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
