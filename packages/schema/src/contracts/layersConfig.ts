import picomatch from "picomatch";
import type { CodeNode, Snapshot } from "@sprawlens/contracts";
import { defaultLayerOf } from "./layers.ts";

/**
 * Generalized layer system. `test` and `deps` are no longer hardcoded: they
 * are built-in presets of one rule shape, and `sprawlens.toml` can override
 * them or add arbitrary layers. A layer pulls a subset of files onto its own
 * satellite plane (its nodes + the edges among them, plus cross-plane links
 * to source). Classification is stamped onto the Snapshot (FileNode.layer) so
 * the contract carries it and the viz just reads node.layer.
 */

export type LayerLayout = "rings" | "capacity";

/** One layer rule: which files it claims, how its plane is laid out. */
export type LayerRule = {
  name: string;
  /** Globs (picomatch) against the file path; first matching rule wins. */
  match?: string[];
  /** Satellite-plane layout strategy (default "rings"). */
  layout?: LayerLayout;
  /** Also route external (bare-package) imports onto this plane — deps. */
  includeExternal?: boolean;
};

/** Terraform service settings (the `[terraform]` table). */
export type TerraformConfig = {
  /** Directory under the repo to scan for `.tf` (default: repo root). */
  root?: string;
};

/** Test runner settings (the `[test]` table), for click-to-run. */
export type TestConfig = {
  /** Base run command, e.g. `pnpm vitest run`. A clicked case is appended as
   * `<file> -t <title> --reporter=json`. Unset disables click-to-run. */
  command?: string;
};

/** One `[[service]]` mapping: which terraform resources form a service, and
 * which code dirs it maps to (the latter captured for Phase B nesting). */
export type ServiceMapping = {
  name: string;
  /** Address globs (picomatch) claiming terraform resources for this service. */
  terraform?: string[];
  /** Code-dir globs backing this service (rendered when modules nest). */
  source?: string[];
};

/** The `sprawlens.toml` layer settings, parsed. */
export type LayersConfig = {
  layers?: LayerRule[];
  /** Globs dropped from the snapshot entirely (generated files, fixtures). */
  ignore?: string[];
  /** Force a language provider id (same effect as --lang). */
  lang?: string;
  /** Terraform service-layer settings. */
  terraform?: TerraformConfig;
  /** Explicit terraform-resource → service mappings. */
  services?: ServiceMapping[];
  /** Test runner settings (click-to-run). */
  test?: TestConfig;
};

/** What the viz needs to render each non-source plane. */
export type LayerManifestEntry = {
  name: string;
  layout: LayerLayout;
  includeExternal: boolean;
};

/** Built-in presets, applied unless a same-named rule overrides them. The
 * `test` rule has no `match`, so it falls back to the path-based default
 * regex; `deps` claims external packages (and any local `match` the user
 * adds). */
const BUILTIN_LAYERS: readonly LayerRule[] = [
  { name: "test", layout: "rings" },
  { name: "deps", layout: "rings", includeExternal: true },
];

/** Merge user layers over the built-ins: same name overrides in place, new
 * names append. Order is precedence for first-match classification. */
export function resolveLayers(userLayers: readonly LayerRule[]): LayerRule[] {
  const resolved: LayerRule[] = BUILTIN_LAYERS.map((l) => ({ ...l }));
  for (const layer of userLayers) {
    const at = resolved.findIndex((l) => l.name === layer.name);
    if (at >= 0) resolved[at] = { ...resolved[at], ...layer };
    else resolved.push({ ...layer });
  }
  return resolved;
}

/** A path predicate for a rule: explicit globs, else the built-in `test`
 * default regex, else never (deps-by-external claims no local path). */
function compileMatcher(rule: LayerRule): (path: string) => boolean {
  if (rule.match && rule.match.length > 0) {
    const isMatch = picomatch(rule.match as string[]);
    return (path) => isMatch(path);
  }
  if (rule.name === "test") return (path) => defaultLayerOf(path) === "test";
  return () => false;
}

/**
 * Stamp each file node with the first layer it matches and drop ignored
 * files (and any edges touching them). Source files stay bare (no `layer`).
 */
export function applyLayers(snapshot: Snapshot, config: LayersConfig): Snapshot {
  const layers = resolveLayers(config.layers ?? []);
  const matchers = layers.map((l) => ({ name: l.name, test: compileMatcher(l) }));
  const isIgnored =
    config.ignore && config.ignore.length > 0 ? picomatch(config.ignore) : () => false;

  const dropped = new Set<string>();
  const nodes: CodeNode[] = [];
  for (const node of snapshot.nodes) {
    if (node.type !== "file") {
      nodes.push(node);
      continue;
    }
    if (isIgnored(node.path)) {
      dropped.add(node.id);
      continue;
    }
    const hit = matchers.find((m) => m.test(node.path));
    nodes.push(hit ? { ...node, layer: hit.name } : node);
  }
  const edges =
    dropped.size > 0
      ? snapshot.edges.filter((e) => !dropped.has(e.from) && !dropped.has(e.to))
      : snapshot.edges;
  return { ...snapshot, nodes, edges };
}

/** The render manifest for the viz: one entry per non-source layer. */
export function layerManifest(config: LayersConfig): LayerManifestEntry[] {
  return resolveLayers(config.layers ?? []).map((l) => ({
    name: l.name,
    layout: l.layout ?? "rings",
    includeExternal: l.includeExternal ?? false,
  }));
}
