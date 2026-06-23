/**
 * Language-neutral workspace resolution. A repository can be a workspace of
 * named packages (npm/pnpm packages, Cargo workspace crates, a Go/MoonBit
 * module's sub-packages). Each analyzer detects its workspace and maps a
 * cross-package import specifier to the package that provides it; the file
 * resolution within that package stays language-specific.
 */

export type WorkspacePackage = {
  /** Import name: an npm package name, a crate name, a Go/MoonBit module path. */
  name: string;
  /** Repo-relative directory holding the package's sources. */
  sourceRoot: string;
};

/**
 * Match an import specifier to the workspace package that provides it, by the
 * longest package name that prefixes the specifier (so `a/b/c` prefers package
 * `a/b` over `a`). Returns the package and the remaining subpath ("" when the
 * specifier is the bare package name). `separator` is the path separator of the
 * language's specifiers — "/" for npm/Go/MoonBit, "::" for Rust use paths.
 */
export function matchWorkspacePackage(
  packages: readonly WorkspacePackage[],
  specifier: string,
  separator = "/",
): { pkg: WorkspacePackage; subpath: string } | null {
  let best: WorkspacePackage | null = null;
  for (const pkg of packages) {
    if (specifier === pkg.name || specifier.startsWith(pkg.name + separator)) {
      if (!best || pkg.name.length > best.name.length) best = pkg;
    }
  }
  if (!best) return null;
  const subpath =
    specifier === best.name ? "" : specifier.slice(best.name.length + separator.length);
  return { pkg: best, subpath };
}
