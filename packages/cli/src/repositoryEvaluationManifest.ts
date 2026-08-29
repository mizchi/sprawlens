export const REPOSITORY_LANGUAGES = ["TypeScript", "Go", "Rust", "MoonBit"] as const;
export const REPOSITORY_SIZE_BANDS = ["small", "medium", "large"] as const;

export type RepositoryLanguage = (typeof REPOSITORY_LANGUAGES)[number];
export type RepositorySizeBand = (typeof REPOSITORY_SIZE_BANDS)[number];
export type RepositoryEvaluationManifest = {
  schemaVersion: 1;
  frozenAt: string;
  selectionProtocol: {
    languages: RepositoryLanguage[];
    sizeBands: Record<RepositorySizeBand, { minKb: number; maxKb: number }>;
    repositoriesPerLanguageSizeBand: number;
    activeSince: string;
    createdBefore: Record<RepositoryLanguage, string>;
    minimumStars: Record<RepositoryLanguage, number>;
    excludedOwners: string[];
    excludedRepositories: string[];
    excludedContentKinds: string[];
    metadataSource: "github-graphql";
    sort: "stars-desc";
    benchmark: {
      snapshotCommits: number;
      seeds: number[];
      grouping: "module" | "directory" | "repository";
      minNodes: number;
      maxNodes: number;
    };
  };
  repositories: Array<{
    fullName: string;
    language: RepositoryLanguage;
    sizeBand: RepositorySizeBand;
    sizeKb: number;
    stars: number;
    defaultBranch: string;
    head: string;
    committedAt: string;
    license: string;
  }>;
};

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};
const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a string`);
  return value;
};
const integer = (value: unknown, label: string, minimum = 0): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return value;
};
const timestamp = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${label} must be an ISO timestamp`);
  return parsed;
};
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
};

/** Validate the frozen, balanced repository-level evaluation contract. */
export function parseRepositoryEvaluationManifest(value: unknown): RepositoryEvaluationManifest {
  const input = record(value, "manifest");
  if (input.schemaVersion !== 1) throw new Error("manifest schemaVersion must be 1");
  const frozenAt = timestamp(input.frozenAt, "manifest.frozenAt");
  const protocol = record(input.selectionProtocol, "manifest.selectionProtocol");
  if (!Array.isArray(protocol.languages))
    throw new Error("selectionProtocol.languages must be an array");
  const languages = protocol.languages.map((entry, index) =>
    oneOf(entry, REPOSITORY_LANGUAGES, `selectionProtocol.languages[${index}]`),
  );
  if (languages.length === 0) {
    throw new Error("selectionProtocol.languages must contain at least one registered language");
  }
  if (new Set(languages).size !== languages.length) {
    throw new Error("selectionProtocol.languages must be unique");
  }
  const rawBands = record(protocol.sizeBands, "selectionProtocol.sizeBands");
  const sizeBands = Object.fromEntries(
    REPOSITORY_SIZE_BANDS.map((band) => {
      const range = record(rawBands[band], `selectionProtocol.sizeBands.${band}`);
      const minKb = integer(range.minKb, `selectionProtocol.sizeBands.${band}.minKb`, 1);
      const maxKb = integer(range.maxKb, `selectionProtocol.sizeBands.${band}.maxKb`, minKb);
      return [band, { minKb, maxKb }];
    }),
  ) as RepositoryEvaluationManifest["selectionProtocol"]["sizeBands"];
  const repositoriesPerLanguageSizeBand = integer(
    protocol.repositoriesPerLanguageSizeBand,
    "selectionProtocol.repositoriesPerLanguageSizeBand",
    1,
  );
  const activeSince = timestamp(protocol.activeSince, "selectionProtocol.activeSince");
  const rawCreatedBefore = record(protocol.createdBefore, "selectionProtocol.createdBefore");
  const createdBefore = Object.fromEntries(
    REPOSITORY_LANGUAGES.map((language) => [
      language,
      timestamp(rawCreatedBefore[language], `selectionProtocol.createdBefore.${language}`),
    ]),
  ) as Record<RepositoryLanguage, string>;
  const rawMinimumStars = record(protocol.minimumStars, "selectionProtocol.minimumStars");
  const minimumStars = Object.fromEntries(
    REPOSITORY_LANGUAGES.map((language) => [
      language,
      integer(rawMinimumStars[language], `selectionProtocol.minimumStars.${language}`),
    ]),
  ) as Record<RepositoryLanguage, number>;
  const stringArray = (entry: unknown, label: string) => {
    if (!Array.isArray(entry)) throw new Error(`${label} must be an array`);
    const values = entry.map((value, index) => string(value, `${label}[${index}]`));
    if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
    return values;
  };
  const excludedOwners = stringArray(protocol.excludedOwners, "selectionProtocol.excludedOwners");
  const excludedRepositories = stringArray(
    protocol.excludedRepositories,
    "selectionProtocol.excludedRepositories",
  );
  const excludedContentKinds = stringArray(
    protocol.excludedContentKinds,
    "selectionProtocol.excludedContentKinds",
  );
  if (protocol.metadataSource !== "github-graphql") {
    throw new Error("selectionProtocol.metadataSource must be github-graphql");
  }
  if (protocol.sort !== "stars-desc") throw new Error("selectionProtocol.sort must be stars-desc");
  const rawBenchmark = record(protocol.benchmark, "selectionProtocol.benchmark");
  if (!Array.isArray(rawBenchmark.seeds)) throw new Error("benchmark.seeds must be an array");
  const seeds = rawBenchmark.seeds.map((seed, index) =>
    integer(seed, `benchmark.seeds[${index}]`, 1),
  );
  if (new Set(seeds).size !== seeds.length) throw new Error("benchmark.seeds must be unique");
  const benchmark = {
    snapshotCommits: integer(rawBenchmark.snapshotCommits, "benchmark.snapshotCommits", 2),
    seeds,
    grouping: oneOf(
      rawBenchmark.grouping,
      ["module", "directory", "repository"] as const,
      "benchmark.grouping",
    ),
    minNodes: integer(rawBenchmark.minNodes, "benchmark.minNodes", 2),
    maxNodes: integer(rawBenchmark.maxNodes, "benchmark.maxNodes", 2),
  };
  if (benchmark.minNodes > benchmark.maxNodes) {
    throw new Error("benchmark.minNodes must not exceed benchmark.maxNodes");
  }
  if (!Array.isArray(input.repositories)) throw new Error("manifest.repositories must be an array");
  const repositories = input.repositories.map((entry, index) => {
    const raw = record(entry, `repositories[${index}]`);
    const fullName = string(raw.fullName, `repositories[${index}].fullName`);
    if (!/^[^/\s]+\/[^/\s]+$/.test(fullName)) {
      throw new Error(`repositories[${index}].fullName must be owner/name`);
    }
    const language = oneOf(raw.language, REPOSITORY_LANGUAGES, `repositories[${index}].language`);
    if (!languages.includes(language)) {
      throw new Error(`repositories[${index}].language is outside the selected languages`);
    }
    const sizeBand = oneOf(raw.sizeBand, REPOSITORY_SIZE_BANDS, `repositories[${index}].sizeBand`);
    const sizeKb = integer(raw.sizeKb, `repositories[${index}].sizeKb`, 1);
    const range = sizeBands[sizeBand];
    if (sizeKb < range.minKb || sizeKb > range.maxKb) {
      throw new Error(`repositories[${index}].sizeKb is outside ${sizeBand} size band`);
    }
    const head = string(raw.head, `repositories[${index}].head`);
    if (!/^[0-9a-f]{40}$/i.test(head)) {
      throw new Error(`repositories[${index}].head must be a 40-character commit SHA`);
    }
    const committedAt = timestamp(raw.committedAt, `repositories[${index}].committedAt`);
    if (Date.parse(committedAt) > Date.parse(frozenAt)) {
      throw new Error(`repositories[${index}].committedAt must not be after frozenAt`);
    }
    return {
      fullName,
      language,
      sizeBand,
      sizeKb,
      stars: integer(raw.stars, `repositories[${index}].stars`),
      defaultBranch: string(raw.defaultBranch, `repositories[${index}].defaultBranch`),
      head,
      committedAt,
      license: string(raw.license, `repositories[${index}].license`),
    };
  });
  const names = repositories.map(({ fullName }) => fullName);
  if (new Set(names).size !== names.length)
    throw new Error("manifest contains duplicate repository");
  const commits = repositories.map(({ head }) => head);
  if (new Set(commits).size !== commits.length)
    throw new Error("manifest contains duplicate commit");
  for (const language of languages) {
    for (const sizeBand of REPOSITORY_SIZE_BANDS) {
      const count = repositories.filter(
        (repository) => repository.language === language && repository.sizeBand === sizeBand,
      ).length;
      if (count !== repositoriesPerLanguageSizeBand) {
        throw new Error(
          `expected ${repositoriesPerLanguageSizeBand} repositories for ${language}/${sizeBand}, got ${count}`,
        );
      }
    }
  }
  return {
    schemaVersion: 1,
    frozenAt,
    selectionProtocol: {
      languages,
      sizeBands,
      repositoriesPerLanguageSizeBand,
      activeSince,
      createdBefore,
      minimumStars,
      excludedOwners,
      excludedRepositories,
      excludedContentKinds,
      metadataSource: "github-graphql",
      sort: "stars-desc",
      benchmark,
    },
    repositories,
  };
}
