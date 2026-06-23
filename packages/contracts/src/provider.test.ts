import { describe, expect, it } from "vitest";
import { detectProviders, type LanguageProvider } from "./provider.ts";

function provider(id: string, opts: { manifest?: boolean; files?: boolean }): LanguageProvider {
  return {
    id,
    matchesManifest: () => opts.manifest ?? false,
    match: () => (opts.manifest ?? false) || (opts.files ?? false),
    analyze: () => Promise.reject(new Error("not used")),
  };
}

describe("detectProviders", () => {
  it("treats a root manifest as a strong match and stray files as weak", async () => {
    const providers = [
      provider("go", { files: true }), // stray .go in a subdir
      provider("typescript", { manifest: true }), // package.json at root
      provider("rust", {}), // no match
    ];
    const { matched, strong } = await detectProviders(providers, ".");
    expect(matched.map((p) => p.id).sort()).toEqual(["go", "typescript"]);
    expect(strong.map((p) => p.id)).toEqual(["typescript"]);
  });

  it("reports several strong matches as a tie for the caller to resolve", async () => {
    const providers = [
      provider("go", { manifest: true }),
      provider("typescript", { manifest: true }),
    ];
    const { strong } = await detectProviders(providers, ".");
    expect(strong.map((p) => p.id)).toEqual(["go", "typescript"]);
  });

  it("returns empty sets when nothing matches", async () => {
    const { matched, strong } = await detectProviders(
      [provider("go", {}), provider("rust", {})],
      ".",
    );
    expect(matched).toEqual([]);
    expect(strong).toEqual([]);
  });
});
