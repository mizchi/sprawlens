import { symbolDiffProjectionWorkRatio } from "../packages/viz/src/diffStats.ts";

export type AstDiffAdaptiveCompatibilityInput = {
  threshold: number;
  naturalCases: readonly AstDiffAdaptiveNaturalCase[];
  naturalComparisons: readonly AstDiffAdaptiveNaturalComparison[];
  naturalGroups: readonly AstDiffAdaptiveNaturalGroup[];
  syntheticAssessment: AstDiffAdaptiveSyntheticAssessment;
};

export type AstDiffAdaptiveNaturalCase = {
  id: string;
  repository: string;
  files: ReadonlyArray<{ after: readonly unknown[]; hunks: readonly unknown[] }>;
};

export type AstDiffAdaptiveNaturalComparison = {
  caseId: string;
  repository: string;
  speedup: number;
  adaptiveNaiveFileCount: number;
  adaptiveIndexedFileCount: number;
};

export type AstDiffAdaptiveNaturalGroup = {
  caseId: string;
  repository: string;
  condition: "projection-indexed" | "projection-naive" | "projection-adaptive";
  repetitions: number;
  successfulRepetitions: number;
  failures: number;
  timeouts: number;
  outputDigest: string | null;
  outputItems: number | null;
};

export type AstDiffAdaptiveSyntheticAssessment = {
  policyThreshold: number;
  validationPassed: boolean;
  outputExactScenarios: number;
  scenarios: number;
  naiveScenarios: number;
  indexedScenarios: number;
  fastestChoiceAgreement: number;
  failures: number;
  timeouts: number;
};

export type AstDiffAdaptiveCompatibilityAssessment = {
  threshold: number;
  natural: {
    repositories: number;
    cases: number;
    files: number;
    naiveFiles: number;
    indexedFiles: number;
    allNaiveCases: number;
    v1ChoicePreservedCases: number;
    forcedNaiveFasterCases: number;
    outputExactCases: number;
    workRatio: { min: number; max: number };
    failures: number;
    timeouts: number;
  };
  synthetic: {
    scenarios: number;
    naiveScenarios: number;
    indexedScenarios: number;
    fastestChoiceAgreement: number;
    outputExactScenarios: number;
    validationPassed: boolean;
    failures: number;
    timeouts: number;
  };
  combined: {
    bothStrategiesObservedAcrossSeparateCorpora: boolean;
    corpusLevelChoiceAgreement: boolean;
    validatesSingleAdaptivePolicy: false;
  };
};

export function assessAstDiffAdaptiveCompatibility(
  input: AstDiffAdaptiveCompatibilityInput,
): AstDiffAdaptiveCompatibilityAssessment {
  validateInput(input);
  const comparisonByCase = new Map(
    input.naturalComparisons.map((comparison) => [comparison.caseId, comparison]),
  );
  const groupsByCase = new Map<string, AstDiffAdaptiveNaturalGroup[]>();
  for (const group of input.naturalGroups) {
    const groups = groupsByCase.get(group.caseId) ?? [];
    groups.push(group);
    groupsByCase.set(group.caseId, groups);
  }

  let naiveFiles = 0;
  let indexedFiles = 0;
  let allNaiveCases = 0;
  let v1ChoicePreservedCases = 0;
  let forcedNaiveFasterCases = 0;
  let outputExactCases = 0;
  const workRatios: number[] = [];
  for (const naturalCase of input.naturalCases) {
    let caseNaiveFiles = 0;
    let caseIndexedFiles = 0;
    for (const file of naturalCase.files) {
      const workRatio = symbolDiffProjectionWorkRatio(file.after.length, file.hunks.length);
      workRatios.push(workRatio);
      if (workRatio > input.threshold) {
        caseIndexedFiles += 1;
      } else {
        caseNaiveFiles += 1;
      }
    }
    naiveFiles += caseNaiveFiles;
    indexedFiles += caseIndexedFiles;
    if (caseIndexedFiles === 0) allNaiveCases += 1;
    const comparison = comparisonByCase.get(naturalCase.id)!;
    if (
      caseNaiveFiles === comparison.adaptiveNaiveFileCount &&
      caseIndexedFiles === comparison.adaptiveIndexedFileCount
    ) {
      v1ChoicePreservedCases += 1;
    }
    if (comparison.speedup < 1) forcedNaiveFasterCases += 1;
    if (naturalOutputExact(groupsByCase.get(naturalCase.id) ?? [])) outputExactCases += 1;
  }

  const natural = {
    repositories: new Set(input.naturalCases.map(({ repository }) => repository)).size,
    cases: input.naturalCases.length,
    files: workRatios.length,
    naiveFiles,
    indexedFiles,
    allNaiveCases,
    v1ChoicePreservedCases,
    forcedNaiveFasterCases,
    outputExactCases,
    workRatio: range(workRatios),
    failures: input.naturalGroups.reduce((sum, group) => sum + group.failures, 0),
    timeouts: input.naturalGroups.reduce((sum, group) => sum + group.timeouts, 0),
  };
  const synthetic = {
    scenarios: input.syntheticAssessment.scenarios,
    naiveScenarios: input.syntheticAssessment.naiveScenarios,
    indexedScenarios: input.syntheticAssessment.indexedScenarios,
    fastestChoiceAgreement: input.syntheticAssessment.fastestChoiceAgreement,
    outputExactScenarios: input.syntheticAssessment.outputExactScenarios,
    validationPassed: input.syntheticAssessment.validationPassed,
    failures: input.syntheticAssessment.failures,
    timeouts: input.syntheticAssessment.timeouts,
  };
  return {
    threshold: input.threshold,
    natural,
    synthetic,
    combined: {
      bothStrategiesObservedAcrossSeparateCorpora:
        natural.naiveFiles > 0 && synthetic.indexedScenarios > 0,
      corpusLevelChoiceAgreement:
        natural.allNaiveCases === natural.cases &&
        natural.v1ChoicePreservedCases === natural.cases &&
        natural.forcedNaiveFasterCases === natural.cases &&
        synthetic.indexedScenarios === synthetic.scenarios &&
        synthetic.fastestChoiceAgreement === synthetic.scenarios,
      validatesSingleAdaptivePolicy: false,
    },
  };
}

export function renderAstDiffAdaptiveCompatibilityAssessment(
  assessment: AstDiffAdaptiveCompatibilityAssessment,
): string {
  const { natural, synthetic, combined } = assessment;
  const consistent =
    combined.bothStrategiesObservedAcrossSeparateCorpora &&
    combined.corpusLevelChoiceAgreement &&
    natural.outputExactCases === natural.cases &&
    synthetic.outputExactScenarios === synthetic.scenarios &&
    natural.failures === 0 &&
    natural.timeouts === 0 &&
    synthetic.failures === 0 &&
    synthetic.timeouts === 0;
  return `Post-hoc compatibility: **${consistent ? "CONSISTENT" : "INCONSISTENT"}**

Single-policy validation: **${combined.validatesSingleAdaptivePolicy ? "YES" : "NO"}**

| Corpus | Selected regime | Evidence |
|---|:---:|---|
| Natural frozen holdout | naive | ${natural.naiveFiles} files / ${natural.allNaiveCases} cases; v1 choices preserved ${natural.v1ChoicePreservedCases}/${natural.cases}; forced naive faster ${natural.forcedNaiveFasterCases}/${natural.cases}; recorded v1 exact ${natural.outputExactCases}/${natural.cases} |
| Reserved synthetic validation | indexed | ${synthetic.indexedScenarios}/${synthetic.scenarios} scenarios; fastest-choice agreement ${synthetic.fastestChoiceAgreement}/${synthetic.scenarios}; exact ${synthetic.outputExactScenarios}/${synthetic.scenarios}; fixed validation ${synthetic.validationPassed ? "PASS" : "FAIL"} |

- Candidate threshold: ${assessment.threshold}
- Natural work-ratio range: ${natural.workRatio.min.toFixed(3)}–${natural.workRatio.max.toFixed(3)}
- Both strategies observed only across separate corpora: ${combined.bothStrategiesObservedAcrossSeparateCorpora ? "yes" : "no"}
- Natural failures/timeouts: ${natural.failures}/${natural.timeouts}
- Synthetic failures/timeouts: ${synthetic.failures}/${synthetic.timeouts}
`;
}

function naturalOutputExact(groups: readonly AstDiffAdaptiveNaturalGroup[]): boolean {
  if (groups.length !== 3) return false;
  const conditions = new Set(groups.map(({ condition }) => condition));
  if (
    !["projection-indexed", "projection-naive", "projection-adaptive"].every((condition) =>
      conditions.has(condition),
    )
  ) {
    return false;
  }
  if (
    groups.some(
      (group) =>
        group.successfulRepetitions !== group.repetitions ||
        typeof group.outputDigest !== "string" ||
        group.outputItems === null,
    )
  ) {
    return false;
  }
  return (
    new Set(groups.map(({ outputDigest }) => outputDigest)).size === 1 &&
    new Set(groups.map(({ outputItems }) => outputItems)).size === 1
  );
}

function validateInput(input: AstDiffAdaptiveCompatibilityInput): void {
  if (!Number.isFinite(input.threshold) || input.threshold <= 0) {
    throw new Error("compatibility threshold must be a positive finite number");
  }
  if (input.syntheticAssessment.policyThreshold !== input.threshold) {
    throw new Error("synthetic policy threshold does not match the compatibility threshold");
  }
  if (input.naturalCases.length === 0) throw new Error("natural cases must not be empty");
  const caseIds = uniqueIds(input.naturalCases, "natural case");
  const comparisonIds = uniqueIds(
    input.naturalComparisons.map(({ caseId }) => ({ id: caseId })),
    "natural comparison",
  );
  if (
    caseIds.size !== comparisonIds.size ||
    [...caseIds].some((caseId) => !comparisonIds.has(caseId))
  ) {
    throw new Error("natural cases and comparisons must contain identical case ids");
  }
  for (const naturalCase of input.naturalCases) {
    if (naturalCase.files.length === 0)
      throw new Error(`natural case has no files: ${naturalCase.id}`);
  }
  for (const comparison of input.naturalComparisons) {
    if (!Number.isFinite(comparison.speedup) || comparison.speedup <= 0) {
      throw new Error("natural comparison speedup must be positive");
    }
  }
}

function uniqueIds(values: readonly { id: string }[], label: string): Set<string> {
  const ids = new Set<string>();
  for (const { id } of values) {
    if (!id) throw new Error(`${label} id must not be empty`);
    if (ids.has(id)) throw new Error(`duplicate ${label}: ${id}`);
    ids.add(id);
  }
  return ids;
}

function range(values: readonly number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}
