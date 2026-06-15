import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import type { LayerLayout, LayerRule, LayersConfig } from "@sprawlens/schema";

/**
 * Read and normalize `sprawlens.toml` from the repo root. The file customizes
 * the layer system — overriding the built-in test/deps presets, adding
 * arbitrary layers, ignoring globs, or forcing a language. Returns null when
 * no config file is present (zero-config = built-in defaults).
 *
 * Shape:
 *   lang = "typescript"
 *   ignore = ["** /generated/**"]
 *   [[layer]]
 *   name = "deps"
 *   match = ["vendor/**"]
 *   layout = "rings"          # rings | capacity
 *   include_external = true   # camelCase includeExternal also accepted
 */
export async function readSprawlensConfig(
  root: string,
  file = "sprawlens.toml",
): Promise<LayersConfig | null> {
  const path = join(root, file);
  if (!existsSync(path)) return null;
  const raw = parse(await readFile(path, "utf8")) as Record<string, unknown>;
  return normalizeConfig(raw);
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? (value as string[])
    : undefined;
}

function asLayout(value: unknown): LayerLayout | undefined {
  return value === "rings" || value === "capacity" ? value : undefined;
}

function normalizeLayer(entry: unknown): LayerRule | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.name !== "string" || e.name === "") return null;
  const match = asStringArray(e.match);
  const layout = asLayout(e.layout);
  const ext = e.include_external ?? e.includeExternal;
  return {
    name: e.name,
    ...(match ? { match } : {}),
    ...(layout ? { layout } : {}),
    ...(typeof ext === "boolean" ? { includeExternal: ext } : {}),
  };
}

function normalizeConfig(raw: Record<string, unknown>): LayersConfig {
  const layers = (Array.isArray(raw.layer) ? raw.layer : [])
    .map(normalizeLayer)
    .filter((l): l is LayerRule => l !== null);
  const ignore = asStringArray(raw.ignore);
  return {
    ...(layers.length > 0 ? { layers } : {}),
    ...(ignore ? { ignore } : {}),
    ...(typeof raw.lang === "string" ? { lang: raw.lang } : {}),
  };
}
