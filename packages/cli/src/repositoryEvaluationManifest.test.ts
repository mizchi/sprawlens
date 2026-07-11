import { describe, expect, it } from "vitest";
import { parseRepositoryEvaluationManifest } from "./repositoryEvaluationManifest.ts";

const languages = ["TypeScript", "Go", "Rust", "MoonBit"] as const;
const bands = ["small", "medium", "large"] as const;
const ranges = {
  small: { minKb: 1, maxKb: 9_999 },
  medium: { minKb: 10_000, maxKb: 49_999 },
  large: { minKb: 50_000, maxKb: 100_000 },
};

const fixture = () => ({
  schemaVersion: 1,
  frozenAt: "2026-07-11T14:55:35Z",
  selectionProtocol: {
    languages,
    sizeBands: ranges,
    repositoriesPerLanguageSizeBand: 2,
    activeSince: "2025-01-01T00:00:00Z",
    createdBefore: {
      TypeScript: "2025-01-01T00:00:00Z",
      Go: "2025-01-01T00:00:00Z",
      Rust: "2025-01-01T00:00:00Z",
      MoonBit: "2026-01-01T00:00:00Z",
    },
    minimumStars: { TypeScript: 1_000, Go: 1_000, Rust: 1_000, MoonBit: 5 },
    excludedOwners: ["mizchi"],
    excludedRepositories: ["example/development-set"],
    excludedContentKinds: ["curated-list", "documentation-only"],
    metadataSource: "github-graphql",
    sort: "stars-desc",
    benchmark: {
      snapshotCommits: 15,
      seeds: [3, 7, 11],
      grouping: "module",
      minNodes: 3,
      maxNodes: 80,
    },
  },
  repositories: languages.flatMap((language, languageIndex) =>
    bands.flatMap((sizeBand) =>
      Array.from({ length: 2 }, (_, index) => ({
        fullName: `owner/${language.toLowerCase()}-${sizeBand}-${index}`,
        language,
        sizeBand,
        sizeKb: ranges[sizeBand].minKb + index,
        stars: 100 - languageIndex * 10 - index,
        defaultBranch: "main",
        head: String(languageIndex * 6 + bands.indexOf(sizeBand) * 2 + index + 1).padStart(40, "0"),
        committedAt: "2026-07-10T00:00:00Z",
        license: "MIT",
      })),
    ),
  ),
});

describe("repository evaluation preregistration manifest", () => {
  it("accepts a balanced 24-repository manifest", () => {
    const parsed = parseRepositoryEvaluationManifest(fixture());

    expect(parsed.repositories).toHaveLength(24);
    expect(parsed.selectionProtocol.benchmark.seeds).toEqual([3, 7, 11]);
  });

  it("rejects duplicate repositories and commits", () => {
    const duplicateRepository = fixture();
    duplicateRepository.repositories[1]!.fullName = duplicateRepository.repositories[0]!.fullName;
    expect(() => parseRepositoryEvaluationManifest(duplicateRepository)).toThrow(
      /duplicate repository/,
    );

    const duplicateCommit = fixture();
    duplicateCommit.repositories[1]!.head = duplicateCommit.repositories[0]!.head;
    expect(() => parseRepositoryEvaluationManifest(duplicateCommit)).toThrow(/duplicate commit/);
  });

  it("rejects imbalance, invalid SHA, and size-band drift", () => {
    const imbalanced = fixture();
    imbalanced.repositories.pop();
    expect(() => parseRepositoryEvaluationManifest(imbalanced)).toThrow(/expected 2 repositories/);

    const invalidSha = fixture();
    invalidSha.repositories[0]!.head = "main";
    expect(() => parseRepositoryEvaluationManifest(invalidSha)).toThrow(/40-character commit SHA/);

    const wrongBand = fixture();
    wrongBand.repositories[0]!.sizeKb = 10_000;
    expect(() => parseRepositoryEvaluationManifest(wrongBand)).toThrow(/outside small size band/);
  });
});
