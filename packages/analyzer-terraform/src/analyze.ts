import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import fg from "fast-glob";
import type { RawResource } from "@sprawlens/contracts";
import { parseTerraform } from "./extract.ts";

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
export async function hasTerraform(root: string, tfRoot?: string): Promise<boolean> {
  return (await terraformFiles(root, tfRoot)).length > 0;
}

/**
 * Parse every `.tf` under the terraform root into raw resources. Grouping into
 * services and edge derivation is `resolveServices`' job (in @sprawlens/schema);
 * this stays a thin parser.
 */
export async function analyzeTerraform(root: string, tfRoot?: string): Promise<RawResource[]> {
  const files = await terraformFiles(root, tfRoot);
  const out: RawResource[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const dir = dirname(file);
    for (const r of await parseTerraform(file, content)) {
      // a resource's source path is relative to its own .tf file; resolve it to
      // repo-root-relative so it matches the snapshot's file paths.
      if (r.source) {
        out.push({ ...r, source: relative(root, resolve(dir, r.source)) });
      } else {
        out.push(r);
      }
    }
  }
  return out;
}
