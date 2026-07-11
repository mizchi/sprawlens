import { join } from "node:path";
import type { CodesprawlConfig, CommitRecord } from "@sprawlens/schema";
import type {
  RepositoryEvaluationManifest,
  RepositoryLanguage,
} from "./repositoryEvaluationManifest.ts";

const PROVIDER_BY_LANGUAGE: Record<RepositoryLanguage, string> = {
  TypeScript: "typescript",
  Go: "go",
  Rust: "rust",
  MoonBit: "moonbit",
};

export type RepositoryCollectionPlan = {
  repository: RepositoryEvaluationManifest["repositories"][number];
  repoPath: string;
  outputPath: string;
  providerId: string;
};

/** Resolve the frozen manifest without consulting benchmark outcomes or the network. */
export function planRepositoryCollection(
  manifest: RepositoryEvaluationManifest,
  ghqRoot: string,
  outputRoot: string,
  only: readonly string[] = [],
): RepositoryCollectionPlan[] {
  const selected = new Set(only);
  const names = new Set(manifest.repositories.map(({ fullName }) => fullName));
  for (const fullName of selected) {
    if (!names.has(fullName)) {
      throw new Error(`${fullName} is not present in the frozen manifest`);
    }
  }
  return manifest.repositories
    .filter(({ fullName }) => selected.size === 0 || selected.has(fullName))
    .map((repository) => ({
      repository,
      repoPath: join(ghqRoot, "github.com", repository.fullName),
      outputPath: join(outputRoot, ...repository.fullName.split("/")),
      providerId: PROVIDER_BY_LANGUAGE[repository.language],
    }));
}

/** Resume only when collection provenance and the terminal commit are exact. */
export function collectionArtifactReusable(
  config: CodesprawlConfig,
  commits: readonly CommitRecord[],
  repository: RepositoryEvaluationManifest["repositories"][number],
  expectedCommits = 15,
): boolean {
  return (
    config.schemaVersion === 1 &&
    config.options.commits === expectedCommits &&
    config.options.revision === repository.head &&
    config.options.firstParent === true &&
    commits.length === expectedCommits &&
    commits.at(-1)?.hash === repository.head
  );
}

/** Replace one repository status without discarding results from prior partial runs. */
export function upsertCollectionStatusEntry<T extends { fullName: string }>(
  entries: readonly T[],
  entry: T,
): T[] {
  const index = entries.findIndex(({ fullName }) => fullName === entry.fullName);
  if (index === -1) return [...entries, entry];
  return entries.map((existing, current) => (current === index ? entry : existing));
}
