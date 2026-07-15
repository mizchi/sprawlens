import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  assessAstDiffAdaptiveValidation,
  renderAstDiffAdaptiveValidationAssessment,
  type AstDiffAdaptiveValidationInput,
} from "./ast-diff-adaptive-validation.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const inputPath = resolve(
  option("--input", "research/results/ast-diff-adaptive-v2b-validation.json"),
);
const outputPath = resolve(
  option("--output", "research/results/ast-diff-adaptive-v2b-validation-assessment.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-adaptive-v2b-validation-assessment.md"),
);
const inputText = await readFile(inputPath, "utf8");
const input = parseValidationResult(JSON.parse(inputText));
const assessment = assessAstDiffAdaptiveValidation(input.summary);
const result = {
  schemaVersion: 1 as const,
  status: assessment.passed
    ? ("post-hoc synthetic validation passed all fixed gates" as const)
    : ("post-hoc synthetic validation failed at least one fixed gate" as const),
  source: {
    path: relative(projectRoot, inputPath),
    sha256: sha256(inputText),
    protocolHash: input.protocolHash,
    implementation: input.implementation,
    environment: input.environment,
  },
  policy: input.protocol.projection.adaptivePolicy,
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
      sourceSha256: result.source.sha256,
      passed: assessment.passed,
      gates: Object.fromEntries(
        Object.entries(assessment.gates).map(([name, gate]) => [name, gate.passed]),
      ),
      diagnostics: assessment.diagnostics,
    },
    null,
    2,
  )}\n`,
);

type ValidationResult = {
  schemaVersion: 2;
  protocolHash: string;
  protocol: {
    profile: "validation";
    projection: {
      adaptivePolicy: {
        workRatio: string;
        threshold: number;
        indexedWhen: string;
      };
    };
  };
  implementation: { revision: string; dirtyAtRun: boolean };
  environment: { node: string; platform: string; arch: string; cpu: string; logicalCpus: number };
  summary: AstDiffAdaptiveValidationInput;
};

function parseValidationResult(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("validation result must be an object");
  }
  const result = value as Partial<ValidationResult>;
  if (result.schemaVersion !== 2) throw new Error("validation result schemaVersion must be 2");
  if (result.protocol?.profile !== "validation") {
    throw new Error("adaptive validation assessment requires the fixed validation profile");
  }
  if (!result.protocolHash || !/^[0-9a-f]{64}$/.test(result.protocolHash)) {
    throw new Error("validation result protocolHash must be SHA-256");
  }
  if (!result.implementation || typeof result.implementation.revision !== "string") {
    throw new Error("validation result implementation metadata is missing");
  }
  if (!result.environment || !result.protocol.projection?.adaptivePolicy) {
    throw new Error("validation environment or adaptive policy metadata is missing");
  }
  if (
    !result.summary ||
    !Array.isArray(result.summary.groups) ||
    !Array.isArray(result.summary.projectionComparisons)
  ) {
    throw new Error("validation result summary is missing");
  }
  return result as ValidationResult;
}

type ValidationAssessmentReport = {
  status: string;
  source: {
    path: string;
    sha256: string;
    protocolHash: string;
    implementation: ValidationResult["implementation"];
    environment: ValidationResult["environment"];
  };
  policy: ValidationResult["protocol"]["projection"]["adaptivePolicy"];
  assessment: ReturnType<typeof assessAstDiffAdaptiveValidation>;
};

function renderMarkdown(result: ValidationAssessmentReport): string {
  return `# Adaptive AST diff v2b validation assessment

Status: ${result.status}.

- Source: \`${result.source.path}\`
- Source SHA-256: \`${result.source.sha256}\`
- Source protocol SHA-256: \`${result.source.protocolHash}\`
- Implementation: \`${result.source.implementation.revision}\` (dirty at run: \`${result.source.implementation.dirtyAtRun}\`)
- Environment: ${result.source.environment.node}, ${result.source.environment.platform}/${result.source.environment.arch}, ${result.source.environment.cpu}
- Policy: \`${result.policy.workRatio}\`; indexed when ratio > \`${result.policy.threshold}\`

${renderAstDiffAdaptiveValidationAssessment(result.assessment)}
The fixed validation is considered failed if any gate fails. In particular, good timing on a single selected branch does not establish adaptive tracking across both branches and must not trigger in-place threshold retuning.
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
