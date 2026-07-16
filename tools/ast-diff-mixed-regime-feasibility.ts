export type AstDiffMixedRegimeFileShape = {
  symbolCount: number;
  hunkCount: number;
  workRatio: number;
  path?: string;
};

export type AstDiffMixedRegimeCandidate = {
  afterRevision: string;
  beforeRevision?: string;
  files: readonly AstDiffMixedRegimeFileShape[];
};

export type AstDiffMixedRegimeRepositoryScan = {
  repository: string;
  owner: string;
  pinnedHead: string;
  candidates: readonly AstDiffMixedRegimeCandidate[];
};

export type AstDiffMixedRegimeFeasibility = {
  feasible: boolean;
  threshold: number;
  fixedGate: {
    minimumCases: 15;
    minimumCasesPerRepository: 3;
    minimumRepositories: 3;
    minimumOwners: 3;
  };
  totals: { candidates: number; pureNaive: number; pureIndexed: number; mixed: number };
  repositories: Array<{
    repository: string;
    owner: string;
    pinnedHead: string;
    candidates: number;
    pureNaive: number;
    pureIndexed: number;
    mixed: number;
    workRatio: { min: number; max: number } | null;
  }>;
  gates: {
    pureNaive: AstDiffMixedRegimeBranchGate;
    pureIndexed: AstDiffMixedRegimeBranchGate;
  };
  reasons: string[];
};

type AstDiffMixedRegimeBranchGate = {
  passed: boolean;
  cases: number;
  eligibleRepositories: number;
  eligibleOwners: number;
};

const MINIMUM_CASES = 15;
const MINIMUM_CASES_PER_REPOSITORY = 3;
const MINIMUM_REPOSITORIES = 3;
const MINIMUM_OWNERS = 3;

export function summarizeAstDiffMixedRegimeFeasibility(
  scans: readonly AstDiffMixedRegimeRepositoryScan[],
  threshold: number,
): AstDiffMixedRegimeFeasibility {
  validateScans(scans, threshold);
  const repositories = scans.map((scan) => {
    let pureNaive = 0;
    let pureIndexed = 0;
    let mixed = 0;
    const workRatios: number[] = [];
    for (const candidate of scan.candidates) {
      const strategies = new Set<"naive" | "indexed">();
      for (const file of candidate.files) {
        workRatios.push(file.workRatio);
        strategies.add(file.workRatio > threshold ? "indexed" : "naive");
      }
      if (strategies.size > 1) mixed += 1;
      else if (strategies.has("indexed")) pureIndexed += 1;
      else pureNaive += 1;
    }
    return {
      repository: scan.repository,
      owner: scan.owner,
      pinnedHead: scan.pinnedHead,
      candidates: scan.candidates.length,
      pureNaive,
      pureIndexed,
      mixed,
      workRatio:
        workRatios.length > 0
          ? { min: Math.min(...workRatios), max: Math.max(...workRatios) }
          : null,
    };
  });
  const totals = {
    candidates: repositories.reduce((sum, repository) => sum + repository.candidates, 0),
    pureNaive: repositories.reduce((sum, repository) => sum + repository.pureNaive, 0),
    pureIndexed: repositories.reduce((sum, repository) => sum + repository.pureIndexed, 0),
    mixed: repositories.reduce((sum, repository) => sum + repository.mixed, 0),
  };
  const gates = {
    pureNaive: branchGate(repositories, "pureNaive", totals.pureNaive),
    pureIndexed: branchGate(repositories, "pureIndexed", totals.pureIndexed),
  };
  const reasons: string[] = [];
  if (!gates.pureNaive.passed) reasons.push(failureReason("pure-naive"));
  if (!gates.pureIndexed.passed) reasons.push(failureReason("pure-indexed"));
  return {
    feasible: gates.pureNaive.passed && gates.pureIndexed.passed,
    threshold,
    fixedGate: {
      minimumCases: MINIMUM_CASES,
      minimumCasesPerRepository: MINIMUM_CASES_PER_REPOSITORY,
      minimumRepositories: MINIMUM_REPOSITORIES,
      minimumOwners: MINIMUM_OWNERS,
    },
    totals,
    repositories,
    gates,
    reasons,
  };
}

export function assertAstDiffMixedRegimeRepositoryPins(
  repositories: readonly { repository: string; pinnedHead: string }[],
): void {
  for (const { repository, pinnedHead } of repositories) {
    if (!/^[0-9a-f]{40}$/.test(pinnedHead)) {
      throw new Error(`pinnedHead must be a full commit SHA: ${repository}`);
    }
  }
}

function branchGate(
  repositories: AstDiffMixedRegimeFeasibility["repositories"],
  branch: "pureNaive" | "pureIndexed",
  cases: number,
): AstDiffMixedRegimeBranchGate {
  const eligible = repositories.filter(
    (repository) => repository[branch] >= MINIMUM_CASES_PER_REPOSITORY,
  );
  const eligibleOwners = new Set(eligible.map(({ owner }) => owner)).size;
  return {
    passed:
      cases >= MINIMUM_CASES &&
      eligible.length >= MINIMUM_REPOSITORIES &&
      eligibleOwners >= MINIMUM_OWNERS,
    cases,
    eligibleRepositories: eligible.length,
    eligibleOwners,
  };
}

function failureReason(branch: "pure-naive" | "pure-indexed"): string {
  return `${branch} requires >=${MINIMUM_CASES} cases and >=${MINIMUM_REPOSITORIES} repositories from >=${MINIMUM_OWNERS} owners with >=${MINIMUM_CASES_PER_REPOSITORY} cases each`;
}

function validateScans(
  scans: readonly AstDiffMixedRegimeRepositoryScan[],
  threshold: number,
): void {
  if (scans.length === 0) throw new Error("mixed-regime scans must not be empty");
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("mixed-regime threshold must be a positive finite number");
  }
  assertAstDiffMixedRegimeRepositoryPins(scans);
  const repositories = new Set<string>();
  for (const scan of scans) {
    if (!scan.repository || !scan.owner) throw new Error("repository and owner must not be empty");
    if (repositories.has(scan.repository))
      throw new Error(`duplicate repository: ${scan.repository}`);
    repositories.add(scan.repository);
    const revisions = new Set<string>();
    for (const candidate of scan.candidates) {
      if (!candidate.afterRevision) throw new Error("candidate afterRevision must not be empty");
      if (revisions.has(candidate.afterRevision)) {
        throw new Error(
          `duplicate candidate revision: ${scan.repository}@${candidate.afterRevision}`,
        );
      }
      revisions.add(candidate.afterRevision);
      if (candidate.files.length === 0) throw new Error("candidate files must not be empty");
      for (const file of candidate.files) {
        if (!Number.isSafeInteger(file.symbolCount) || file.symbolCount < 0) {
          throw new Error("file symbolCount must be a non-negative safe integer");
        }
        if (!Number.isSafeInteger(file.hunkCount) || file.hunkCount < 0) {
          throw new Error("file hunkCount must be a non-negative safe integer");
        }
        if (!Number.isFinite(file.workRatio) || file.workRatio < 0) {
          throw new Error("file workRatio must be a non-negative finite number");
        }
      }
    }
  }
}
