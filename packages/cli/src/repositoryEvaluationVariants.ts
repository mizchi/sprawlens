export type RepositoryEvaluationVariant = {
  name: "primary" | "directory-depth-2" | "repository-grouping" | "bounded-swap";
  evidence: "primary" | "sensitivity";
  grouping: "module" | "directory" | "repository";
  directoryDepth?: number;
  stableSwapPasses: readonly number[];
};

const VARIANTS: Record<RepositoryEvaluationVariant["name"], RepositoryEvaluationVariant> = {
  primary: {
    name: "primary",
    evidence: "primary",
    grouping: "module",
    stableSwapPasses: [8],
  },
  "directory-depth-2": {
    name: "directory-depth-2",
    evidence: "sensitivity",
    grouping: "directory",
    directoryDepth: 2,
    stableSwapPasses: [8],
  },
  "repository-grouping": {
    name: "repository-grouping",
    evidence: "sensitivity",
    grouping: "repository",
    stableSwapPasses: [8],
  },
  "bounded-swap": {
    name: "bounded-swap",
    evidence: "sensitivity",
    grouping: "module",
    stableSwapPasses: [0, 1, 8],
  },
};

/** Resolve only variants fixed in the preregistration; arbitrary post-hoc parameters are rejected. */
export function repositoryEvaluationVariant(name: string): RepositoryEvaluationVariant {
  const variant = VARIANTS[name as RepositoryEvaluationVariant["name"]];
  if (!variant) throw new Error(`repository evaluation variant is not registered: ${name}`);
  return variant;
}
