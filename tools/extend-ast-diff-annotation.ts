import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  extendAstDiffAnnotationManifest,
  parseAstDiffAnnotationManifest,
  type AstDiffAnnotationExtension,
} from "../packages/viz/src/astSymbolDiffEvaluation.ts";

const basePath = resolve(process.argv[2] ?? "research/ast-diff-confirmatory-annotation.json");
const extensionPath = resolve(process.argv[3] ?? "research/ast-diff-extraction-v2-extension.json");
const outputPath = resolve(process.argv[4] ?? "research/ast-diff-extraction-v2-annotation.json");
const base = parseAstDiffAnnotationManifest(JSON.parse(await readFile(basePath, "utf8")));
const extension = JSON.parse(await readFile(extensionPath, "utf8")) as AstDiffAnnotationExtension;
const output = extendAstDiffAnnotationManifest(base, extension);
const temporary = `${outputPath}.tmp`;
await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporary, outputPath);
process.stdout.write(
  `${output.datasetId}: extended ${base.datasetId} with ${extension.additions.length} case additions\n`,
);
