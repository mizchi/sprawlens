import { summarizeSamples } from "@sprawlens/layout";
import { decideRepositoryEvaluationClaim } from "./repositoryEvaluationReport.ts";

export type RepositoryPrimaryEffect = {
  repository: string;
  adjacencyGain: number;
  edgeLengthReduction: number;
  displacementReduction: number;
  objectiveReduction: number;
  stepReduction: number;
};

const METRICS = [
  "adjacencyGain",
  "edgeLengthReduction",
  "displacementReduction",
  "objectiveReduction",
  "stepReduction",
] as const;

/** Recompute the registered estimands after recovering failed repositories, without replacing primary. */
export function summarizeMissingnessSensitivity(
  primary: readonly RepositoryPrimaryEffect[],
  recovered: readonly RepositoryPrimaryEffect[],
) {
  const repositories = [...primary, ...recovered];
  const names = repositories.map(({ repository }) => repository);
  if (new Set(names).size !== names.length) {
    throw new Error("duplicate repository in missingness sensitivity");
  }
  if (primary.length === 0) throw new Error("missingness sensitivity requires primary effects");
  const contrasts = Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      summarizeSamples(repositories.map((effect) => effect[metric])),
    ]),
  ) as Record<(typeof METRICS)[number], ReturnType<typeof summarizeSamples>>;
  return {
    schemaVersion: 1 as const,
    status: "post-hoc missingness sensitivity; primary estimate unchanged" as const,
    primaryRepositories: primary.length,
    recoveredRepositories: recovered.length,
    combinedRepositories: repositories.length,
    repositories,
    contrasts,
    decision: decideRepositoryEvaluationClaim({
      includedRepositories: repositories.length,
      displacementReduction: contrasts.displacementReduction,
      adjacencyGain: contrasts.adjacencyGain,
    }),
  };
}
