import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { calibrateAstDiffAdaptiveThreshold } from "./ast-diff-adaptive-threshold-calibration.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const inputPath = resolve(
  option("--input", "research/results/ast-diff-adaptive-v2-calibration.json"),
);
const outputPath = resolve(
  option("--output", "research/results/ast-diff-adaptive-v2-threshold-candidate.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-adaptive-v2-threshold-candidate.md"),
);
const inputText = await readFile(inputPath, "utf8");
const input = parseCalibrationResult(JSON.parse(inputText));
const calibration = calibrateAstDiffAdaptiveThreshold(input.summary.projectionComparisons);
const result = {
  schemaVersion: 1 as const,
  status: "development calibration candidate; unused validation not yet inspected" as const,
  source: {
    path: relative(projectRoot, inputPath),
    sha256: sha256(inputText),
    protocolHash: input.protocolHash,
    implementation: input.implementation,
  },
  rule: {
    classification:
      "a kernel is materially faster when the other kernel p50 is at least 1.10 times its p50" as const,
    threshold:
      "midpoint between maximum materially-naive work ratio and minimum materially-indexed work ratio; reject overlap" as const,
  },
  calibration,
};
await Promise.all([
  writeAtomic(outputPath, `${JSON.stringify(result, null, 2)}\n`),
  writeAtomic(markdownPath, renderMarkdown(result)),
]);
process.stdout.write(
  `${JSON.stringify(
    {
      output: relative(projectRoot, outputPath),
      markdown: relative(projectRoot, markdownPath),
      sourceSha256: result.source.sha256,
      ...calibration,
    },
    null,
    2,
  )}\n`,
);

type CalibrationResult = {
  schemaVersion: 2;
  protocolHash: string;
  protocol: { profile: "calibration" };
  implementation: { revision: string; dirtyAtRun: boolean };
  summary: {
    projectionComparisons: Array<{
      symbolCount: number;
      hunkCount: number;
      indexedP50Ms: number;
      naiveP50Ms: number;
    }>;
  };
};

function parseCalibrationResult(value: unknown): CalibrationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("calibration result must be an object");
  }
  const result = value as Partial<CalibrationResult>;
  if (result.schemaVersion !== 2) throw new Error("calibration result schemaVersion must be 2");
  if (result.protocol?.profile !== "calibration") {
    throw new Error("threshold calibration requires the fixed calibration profile");
  }
  if (!result.protocolHash || !/^[0-9a-f]{64}$/.test(result.protocolHash)) {
    throw new Error("calibration result protocolHash must be SHA-256");
  }
  if (!result.implementation || typeof result.implementation.revision !== "string") {
    throw new Error("calibration result implementation metadata is missing");
  }
  if (
    !result.summary ||
    !Array.isArray(result.summary.projectionComparisons) ||
    result.summary.projectionComparisons.length !== 18
  ) {
    throw new Error("calibration result must contain exactly 18 projection comparisons");
  }
  return result as CalibrationResult;
}

function renderMarkdown(result: {
  status: string;
  source: { path: string; sha256: string; protocolHash: string };
  calibration: ReturnType<typeof calibrateAstDiffAdaptiveThreshold>;
}): string {
  return `# Adaptive AST diff v2 threshold candidate

Status: ${result.status}.

- Source: \`${result.source.path}\`
- Source SHA-256: \`${result.source.sha256}\`
- Source protocol SHA-256: \`${result.source.protocolHash}\`
- Material advantage ratio: ${result.calibration.materialAdvantageRatio.toFixed(2)}
- Materially naive-faster scenarios: ${result.calibration.naiveFasterScenarios}
- Materially indexed-faster scenarios: ${result.calibration.indexedFasterScenarios}
- Ambiguous scenarios: ${result.calibration.ambiguousScenarios}
- Maximum naive-faster work ratio: ${result.calibration.maxNaiveWorkRatio.toFixed(6)}
- Minimum indexed-faster work ratio: ${result.calibration.minIndexedWorkRatio.toFixed(6)}
- Candidate threshold: **${result.calibration.threshold.toFixed(6)}**

The candidate is derived only from the fixed calibration profile. It must be committed into the production policy before the unused validation profile is executed or inspected. A validation failure must not retune this candidate in place.
`;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
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
