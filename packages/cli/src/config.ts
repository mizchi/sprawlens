import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import type {
  LayerLayout,
  LayerRule,
  LayersConfig,
  ServiceMapping,
  TerraformConfig,
  TestConfig,
} from "@sprawlens/schema";

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
 *
 *   [terraform]
 *   root = "infra/"           # where to scan for .tf (default: repo root)
 *   [[service]]
 *   name = "orders"
 *   terraform = ["aws_lambda_function.orders*", "module.orders"]
 *   source = ["services/orders/**"]   # code dir, captured for Phase B
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

function normalizeService(entry: unknown): ServiceMapping | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.name !== "string" || e.name === "") return null;
  const terraform = asStringArray(e.terraform);
  const source = asStringArray(e.source);
  return {
    name: e.name,
    ...(terraform ? { terraform } : {}),
    ...(source ? { source } : {}),
  };
}

function normalizeTerraform(raw: unknown): TerraformConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  return typeof e.root === "string" ? { root: e.root } : {};
}

function normalizeTest(raw: unknown): TestConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  return typeof e.command === "string" ? { command: e.command } : undefined;
}

function normalizeConfig(raw: Record<string, unknown>): LayersConfig {
  const layers = (Array.isArray(raw.layer) ? raw.layer : [])
    .map(normalizeLayer)
    .filter((l): l is LayerRule => l !== null);
  const ignore = asStringArray(raw.ignore);
  const services = (Array.isArray(raw.service) ? raw.service : [])
    .map(normalizeService)
    .filter((s): s is ServiceMapping => s !== null);
  const terraform = normalizeTerraform(raw.terraform);
  const test = normalizeTest(raw.test);
  return {
    ...(layers.length > 0 ? { layers } : {}),
    ...(ignore ? { ignore } : {}),
    ...(typeof raw.lang === "string" ? { lang: raw.lang } : {}),
    ...(terraform ? { terraform } : {}),
    ...(services.length > 0 ? { services } : {}),
    ...(test ? { test } : {}),
  };
}
