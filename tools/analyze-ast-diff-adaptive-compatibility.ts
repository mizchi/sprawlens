import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD } from "../packages/viz/src/diffStats.ts";
import {
  assessAstDiffAdaptiveCompatibility,
  renderAstDiffAdaptiveCompatibilityAssessment,
  type AstDiffAdaptiveCompatibilityInput,
} from "./ast-diff-adaptive-compatibility.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const fixturePath = resolve(
  option("--fixture", "research/datasets/ast-diff-adaptive-performance-holdout-v1.json"),
);
const naturalResultPath = resolve(
  option("--natural", "research/results/ast-diff-adaptive-performance-holdout-v1.json"),
);
const syntheticAssessmentPath = resolve(
  option("--synthetic", "research/results/ast-diff-adaptive-v2b-validation-assessment.json"),
);
const outputPath = resolve(
  option("--output", "research/results/ast-diff-adaptive-v2b-compatibility.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-adaptive-v2b-compatibility.md"),
);
const [fixtureText, naturalResultText, syntheticAssessmentText] = await Promise.all([
  readFile(fixturePath, "utf8"),
  readFile(naturalResultPath, "utf8"),
  readFile(syntheticAssessmentPath, "utf8"),
]);
const fixture = parseFixture(JSON.parse(fixtureText));
const naturalResult = parseNaturalResult(JSON.parse(naturalResultText));
const syntheticAssessment = parseSyntheticAssessment(JSON.parse(syntheticAssessmentText));
const fixtureSha256 = sha256(fixtureText);
if (naturalResult.fixture.sha256 !== fixtureSha256) {
  throw new Error("natural benchmark fixture SHA-256 does not match the frozen fixture");
}
if (syntheticAssessment.policy.threshold !== SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD) {
  throw new Error("synthetic assessment threshold does not match the production candidate");
}
const input: AstDiffAdaptiveCompatibilityInput = {
  threshold: SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD,
  naturalCases: fixture.cases,
  naturalComparisons: naturalResult.summary.projectionComparisons,
  naturalGroups: naturalResult.summary.groups.filter(isProjectionGroup),
  syntheticAssessment: {
    policyThreshold: syntheticAssessment.policy.threshold,
    validationPassed: syntheticAssessment.assessment.passed,
    outputExactScenarios: syntheticAssessment.assessment.gates.outputExactness.matchingScenarios,
    scenarios: syntheticAssessment.assessment.gates.outputExactness.requiredScenarios,
    naiveScenarios: syntheticAssessment.assessment.gates.branchCoverage.naiveScenarios,
    indexedScenarios: syntheticAssessment.assessment.gates.branchCoverage.indexedScenarios,
    fastestChoiceAgreement: syntheticAssessment.assessment.diagnostics.choiceAgreement,
    failures: syntheticAssessment.assessment.diagnostics.failures,
    timeouts: syntheticAssessment.assessment.diagnostics.timeouts,
  },
};
const assessment = assessAstDiffAdaptiveCompatibility(input);
const result = {
  schemaVersion: 1 as const,
  status:
    "post-hoc compatibility analysis from frozen results; no new timing and not a validation" as const,
  sources: {
    naturalFixture: source(fixturePath, fixtureText),
    naturalBenchmark: {
      ...source(naturalResultPath, naturalResultText),
      implementation: naturalResult.implementation,
      originalPolicy: naturalResult.protocol.adaptivePolicy,
    },
    syntheticValidationAssessment: {
      ...source(syntheticAssessmentPath, syntheticAssessmentText),
      implementation: syntheticAssessment.source.implementation,
    },
  },
  policy: {
    workRatio: "S*H / ((S+H)*log2(H+1))" as const,
    threshold: SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD,
    indexedWhen: "work ratio > threshold" as const,
  },
  assessment,
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
      sourceSha256: Object.fromEntries(
        Object.entries(result.sources).map(([name, value]) => [name, value.sha256]),
      ),
      assessment,
    },
    null,
    2,
  )}\n`,
);

type NaturalFixture = {
  schemaVersion: 1;
  sourceDatasetId: "ast-diff-adaptive-performance-holdout-v1";
  cases: Array<{
    id: string;
    repository: string;
    files: Array<{ after: unknown[]; hunks: unknown[] }>;
  }>;
};

type NaturalResult = {
  schemaVersion: 1;
  fixture: { sha256: string };
  implementation: { revision: string; dirtyAtRun: boolean };
  protocol: {
    adaptivePolicy: { workRatio: string; threshold: number; indexedWhen: string };
  };
  summary: {
    projectionComparisons: AstDiffAdaptiveCompatibilityInput["naturalComparisons"];
    groups: Array<
      AstDiffAdaptiveCompatibilityInput["naturalGroups"][number] | { condition: "parent-aware" }
    >;
  };
};

type SyntheticAssessment = {
  schemaVersion: 1;
  source: { implementation: { revision: string; dirtyAtRun: boolean } };
  policy: { threshold: number };
  assessment: {
    passed: boolean;
    gates: {
      outputExactness: { matchingScenarios: number; requiredScenarios: number };
      branchCoverage: { naiveScenarios: number; indexedScenarios: number };
    };
    diagnostics: { choiceAgreement: number; failures: number; timeouts: number };
  };
};

function parseFixture(value: unknown): NaturalFixture {
  const fixture = requiredObject(value, "natural fixture") as Partial<NaturalFixture>;
  if (fixture.schemaVersion !== 1) throw new Error("natural fixture schemaVersion must be 1");
  if (fixture.sourceDatasetId !== "ast-diff-adaptive-performance-holdout-v1") {
    throw new Error("natural fixture must be the frozen performance holdout v1");
  }
  if (!Array.isArray(fixture.cases) || fixture.cases.length !== 30) {
    throw new Error("natural fixture must contain exactly 30 cases");
  }
  if (fixture.cases.some((item) => !Array.isArray(item.files))) {
    throw new Error("natural fixture case files are missing");
  }
  const fileCount = fixture.cases.reduce((sum, item) => sum + item.files.length, 0);
  if (fileCount !== 106) throw new Error("natural fixture must contain exactly 106 files");
  return fixture as NaturalFixture;
}

function parseNaturalResult(value: unknown): NaturalResult {
  const result = requiredObject(value, "natural benchmark") as Partial<NaturalResult>;
  if (result.schemaVersion !== 1) throw new Error("natural benchmark schemaVersion must be 1");
  if (!result.fixture || !/^[0-9a-f]{64}$/.test(result.fixture.sha256)) {
    throw new Error("natural benchmark fixture SHA-256 is missing");
  }
  if (
    !result.summary ||
    !Array.isArray(result.summary.projectionComparisons) ||
    result.summary.projectionComparisons.length !== 30 ||
    !Array.isArray(result.summary.groups)
  ) {
    throw new Error("natural benchmark summary is incomplete");
  }
  if (!result.implementation || !result.protocol?.adaptivePolicy) {
    throw new Error("natural benchmark provenance is incomplete");
  }
  return result as NaturalResult;
}

function parseSyntheticAssessment(value: unknown): SyntheticAssessment {
  const result = requiredObject(value, "synthetic assessment") as Partial<SyntheticAssessment>;
  if (result.schemaVersion !== 1) throw new Error("synthetic assessment schemaVersion must be 1");
  if (!result.policy || !result.source?.implementation || !result.assessment) {
    throw new Error("synthetic assessment provenance is incomplete");
  }
  return result as SyntheticAssessment;
}

function isProjectionGroup(
  group: NaturalResult["summary"]["groups"][number],
): group is AstDiffAdaptiveCompatibilityInput["naturalGroups"][number] {
  return group.condition !== "parent-aware";
}

type CompatibilityResult = typeof result;

function renderMarkdown(value: CompatibilityResult): string {
  return `# Adaptive AST diff v2b cross-corpus compatibility

Status: ${value.status}.

- Natural fixture: \`${value.sources.naturalFixture.path}\` (SHA-256 \`${value.sources.naturalFixture.sha256}\`)
- Natural benchmark: \`${value.sources.naturalBenchmark.path}\` (SHA-256 \`${value.sources.naturalBenchmark.sha256}\`)
- Synthetic validation assessment: \`${value.sources.syntheticValidationAssessment.path}\` (SHA-256 \`${value.sources.syntheticValidationAssessment.sha256}\`)
- Candidate policy: \`${value.policy.workRatio}\`; indexed when ratio > \`${value.policy.threshold}\`

${renderAstDiffAdaptiveCompatibilityAssessment(value.assessment)}
This deterministic replay introduces no new timing. The v2b threshold was developed after the natural v1 holdout had been observed, and the two corpora do not form one held-out two-branch validation. The result may document engineering consistency across separate regimes, but it must not be reported as recovery from the failed v2b validation gate.
`;
}

function source(path: string, text: string): { path: string; sha256: string } {
  return { path: relative(projectRoot, path), sha256: sha256(text) };
}

function requiredObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
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
