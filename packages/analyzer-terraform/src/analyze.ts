import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fg from "fast-glob";
import type { RawResource } from "@sprawlens/contracts";
import { parseTerraform } from "./extract.js";

const IGNORE = ["**/.terraform/**", "**/node_modules/**"];

/** Glob the `.tf` files under the terraform root (default: repo root). */
async function terraformFiles(root: string, tfRoot?: string): Promise<string[]> {
  const cwd = tfRoot ? join(root, tfRoot) : root;
  const files = await fg("**/*.tf", {
    cwd,
    ignore: IGNORE,
    onlyFiles: true,
    suppressErrors: true,
  });
  files.sort();
  return files.map((rel) => join(cwd, rel));
}

/** Whether the repo has any Terraform under the (optional) terraform root. */
export async function hasTerraform(
  root: string,
  tfRoot?: string,
): Promise<boolean> {
  return (await terraformFiles(root, tfRoot)).length > 0;
}

/**
 * Parse every `.tf` under the terraform root into raw resources. Grouping into
 * services and edge derivation is `resolveServices`' job (in @sprawlens/schema);
 * this stays a thin parser.
 */
export async function analyzeTerraform(
  root: string,
  tfRoot?: string,
): Promise<RawResource[]> {
  const files = await terraformFiles(root, tfRoot);
  const out: RawResource[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    out.push(...(await parseTerraform(file, content)));
  }
  return out;
}
