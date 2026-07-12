import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compareAstDiffVariants,
  type AstDiffVariantInput,
} from "../packages/viz/src/astDiffVariantComparison.ts";
import type { AstDiffEvaluationReport } from "../packages/viz/src/astSymbolDiffEvaluation.ts";

const root = resolve("research");
const specs = [
  {
    label: "v1 declarations",
    report: "results/ast-diff-confirmatory-v1-phase1-report.json",
    packets: "annotation-packets/ast-diff-confirmatory-v1/packet-manifest.json",
  },
  {
    label: "v2 + non-export variables",
    report: "results/ast-diff-extraction-v2-posthoc-report.json",
    packets: "annotation-packets/ast-diff-extraction-v2/packet-manifest.json",
  },
  {
    label: "v3 + registration regions",
    report: "results/ast-diff-registration-v3-posthoc-report.json",
    packets: "annotation-packets/ast-diff-registration-v3/packet-manifest.json",
  },
] as const;

const variants: AstDiffVariantInput[] = [];
for (const spec of specs) {
  const report = JSON.parse(
    await readFile(resolve(root, spec.report), "utf8"),
  ) as AstDiffEvaluationReport;
  const packetManifest = JSON.parse(await readFile(resolve(root, spec.packets), "utf8")) as {
    cases: Array<{ afterSymbolCount: number }>;
  };
  variants.push({
    label: spec.label,
    report,
    afterSymbols: packetManifest.cases.reduce((sum, item) => sum + item.afterSymbolCount, 0),
  });
}

const comparison = compareAstDiffVariants(variants);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const points = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pp`;
const integerDelta = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const markdown = [
  "# AST diff extraction variant comparison",
  "",
  "v1 is the prediction-blind single-annotator phase. v2 and v3 are post-hoc extraction extensions and must not be interpreted as confirmatory improvements.",
  "",
  "| Variant | Gold | TP | FP | FN | F1 | Line coverage | vs v1 | After symbols | vs v1 |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...comparison.variants.map(
    (item) =>
      `| ${item.label} | ${item.expected} | ${item.truePositive} | ${item.falsePositive} | ${item.falseNegative} | ${percent(item.f1)} | ${percent(item.coverage)} | ${points(item.coverageDelta)} | ${item.afterSymbols} | ${integerDelta(item.afterSymbolsDelta)} (${percent(item.afterSymbolsDeltaRatio)}) |`,
  ),
  "",
  "Line coverage is the fraction of changed after-revision lines enclosed by at least one extracted region. After-symbol count is summed over the same 12 after-revision files and is a density proxy, not a rendering-time measurement.",
  "",
].join("\n");

await Promise.all([
  writeAtomic(
    resolve(root, "results/ast-diff-variant-comparison.json"),
    `${JSON.stringify(comparison, null, 2)}\n`,
  ),
  writeAtomic(resolve(root, "results/ast-diff-variant-comparison.md"), markdown),
]);
process.stdout.write(
  `${comparison.variants.length} AST diff variants compared against ${comparison.baseline}\n`,
);

async function writeAtomic(path: string, value: string): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}
