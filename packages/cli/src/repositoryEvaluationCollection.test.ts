import { describe, expect, it } from "vitest";
import type { CommitRecord, CodesprawlConfig } from "@sprawlens/schema";
import type { RepositoryEvaluationManifest } from "./repositoryEvaluationManifest.ts";
import {
  collectionArtifactReusable,
  planRepositoryCollection,
  upsertCollectionStatusEntry,
} from "./repositoryEvaluationCollection.ts";

const head = "1234567890abcdef1234567890abcdef12345678";
const manifest = {
  repositories: [
    {
      fullName: "owner/repo",
      language: "TypeScript",
      sizeBand: "small",
      sizeKb: 10,
      stars: 1,
      defaultBranch: "main",
      head,
      committedAt: "2026-01-01T00:00:00Z",
      license: "MIT",
    },
  ],
} as RepositoryEvaluationManifest;

describe("repository evaluation collection planning", () => {
  it("maps a manifest entry to ghq, artifact, and provider paths", () => {
    expect(planRepositoryCollection(manifest, "/ghq", "/artifacts")).toEqual([
      {
        repository: manifest.repositories[0],
        repoPath: "/ghq/github.com/owner/repo",
        outputPath: "/artifacts/owner/repo",
        providerId: "typescript",
      },
    ]);
  });

  it("rejects an --only repository that is outside the frozen manifest", () => {
    expect(() => planRepositoryCollection(manifest, "/ghq", "/artifacts", ["other/repo"])).toThrow(
      /not present in the frozen manifest/,
    );
  });

  it("reuses only an exact 15-commit first-parent artifact ending at the fixed HEAD", () => {
    const config: CodesprawlConfig = {
      schemaVersion: 1,
      repoPath: "/ghq/github.com/owner/repo",
      createdAt: "2026-01-01T00:00:00Z",
      options: { commits: 15, revision: head, firstParent: true },
    };
    const commits = Array.from(
      { length: 15 },
      (_, index) =>
        ({
          hash: index === 14 ? head : String(index).padStart(40, "0"),
        }) as CommitRecord,
    );

    expect(collectionArtifactReusable(config, commits, manifest.repositories[0]!)).toBe(true);
    expect(collectionArtifactReusable(config, commits.slice(1), manifest.repositories[0]!)).toBe(
      false,
    );
    expect(
      collectionArtifactReusable(
        { ...config, options: { ...config.options, firstParent: false } },
        commits,
        manifest.repositories[0]!,
      ),
    ).toBe(false);
  });

  it("preserves other repository statuses while replacing a resumed entry", () => {
    expect(
      upsertCollectionStatusEntry(
        [
          { fullName: "owner/a", status: "collected" },
          { fullName: "owner/b", status: "failed" },
        ],
        { fullName: "owner/b", status: "reused" },
      ),
    ).toEqual([
      { fullName: "owner/a", status: "collected" },
      { fullName: "owner/b", status: "reused" },
    ]);
  });
});
