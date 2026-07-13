import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const researchRoot = resolve(option("--research-root", "research"));
const outputPath = resolve(
  option("--output", "research/ast-diff-confirmatory-v2-solo-preannotation-freeze.json"),
);
if (!process.argv.includes("--replace")) {
  await assertMissing(outputPath, "solo pre-annotation freeze already exists and is immutable");
}
const packetRoot = resolve(
  option("--packets", "research/annotation-packets/ast-diff-confirmatory-v2-solo"),
);
const fixedPaths = [
  "packages/analyzer-ts/src/snapshot.ts",
  "packages/viz/src/astDiffAnnotationPacket.ts",
  "packages/viz/src/astDiffSoloAnnotation.ts",
  "tools/prepare-solo-ast-diff-annotation.ts",
  "tools/lock-solo-ast-diff-annotation-pass.ts",
  "tools/compare-solo-ast-diff-annotations.ts",
  "tools/freeze-solo-ast-diff-preannotation.ts",
  "research/ast-diff-confirmatory-v2-preannotation-freeze.json",
  "research/ast-diff-confirmatory-v2-preregistration.md",
  "research/ast-diff-confirmatory-v2-solo-amendment.md",
  "research/ast-diff-confirmatory-v2-solo-pass-a-key.json",
  "research/ast-diff-confirmatory-v2-solo-pass-a-template.json",
  "research/ast-diff-confirmatory-v2-solo-pass-b-key.json",
  "research/ast-diff-confirmatory-v2-solo-pass-b-template.json",
];
const packetPaths: string[] = [];
for (const passId of ["a", "b"] as const) {
  const passDirectory = resolve(packetRoot, `pass-${passId}`);
  const manifestPath = resolve(passDirectory, "packet-manifest.json");
  const manifest = objectAt(JSON.parse(await readFile(manifestPath, "utf8")), `pass ${passId}`);
  if (manifest.predictionBlind !== true) throw new Error(`pass ${passId} must be prediction-blind`);
  if (!Array.isArray(manifest.cases) || manifest.cases.length !== 30) {
    throw new Error(`pass ${passId} must contain exactly 30 packet cases`);
  }
  packetPaths.push(relative(process.cwd(), manifestPath));
  for (const rawCase of manifest.cases) {
    const item = objectAt(rawCase, `pass ${passId} packet case`);
    const packet = stringAt(item.packet, `pass ${passId} packet path`);
    const expectedHash = stringAt(item.packetSha256, `pass ${passId} packet hash`);
    const packetPath = resolve(passDirectory, packet);
    const packetText = await readFile(packetPath, "utf8");
    if (sha256(packetText) !== expectedHash) throw new Error(`${packetPath}: packet hash mismatch`);
    packetPaths.push(relative(process.cwd(), packetPath));
  }
}

for (const passId of ["a", "b"] as const) {
  const templatePath = resolve(
    researchRoot,
    `ast-diff-confirmatory-v2-solo-pass-${passId}-template.json`,
  );
  const template = objectAt(JSON.parse(await readFile(templatePath, "utf8")), `pass ${passId}`);
  if (!Array.isArray(template.cases) || template.cases.length !== 30) {
    throw new Error(`pass ${passId} template must contain exactly 30 cases`);
  }
  for (const rawCase of template.cases) {
    const item = objectAt(rawCase, `pass ${passId} template case`);
    if (item.reviewed !== false) throw new Error(`pass ${passId} template contains a review`);
    if (!Array.isArray(item.decisions))
      throw new Error(`pass ${passId} decisions must be an array`);
    for (const rawDecision of item.decisions) {
      const decision = objectAt(rawDecision, `pass ${passId} decision`);
      if (decision.decision !== "none") {
        throw new Error(`pass ${passId} template contains a positive label`);
      }
    }
  }
}

const allPaths = [...fixedPaths, ...packetPaths];
const outputDirectory = dirname(outputPath);
const files = await Promise.all(
  allPaths.map(async (path) => {
    const absolutePath = resolve(path);
    const content = await readFile(absolutePath);
    return {
      path: relative(outputDirectory, absolutePath),
      sha256: sha256(content),
    };
  }),
);
const [{ stdout: revision }, { stdout: status }] = await Promise.all([
  execFileAsync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }),
  execFileAsync("git", ["status", "--porcelain"], { encoding: "utf8" }),
]);
const freeze = {
  schemaVersion: 1,
  datasetId: "ast-diff-confirmatory-v2-holdout",
  frozenOn: new Date().toISOString().slice(0, 10),
  status:
    "solo test-retest pre-annotation freeze; pass templates, alias keys, packets, amendment, and implementation fixed before gold labels or evaluated predictions",
  design: "single-annotator-test-retest",
  predictionEvaluatedBeforeFreeze: false,
  goldLabelsPresent: false,
  minimumWashoutDays: 7,
  passASeed: 1729,
  passBSeed: 2027,
  baseImplementationRevision: revision.trim(),
  implementationDirtyAtFreeze: status.trim().length > 0,
  implementationSourceHashesAuthoritative: true,
  files,
};
await writeAtomic(outputPath, `${JSON.stringify(freeze, null, 2)}\n`);
process.stdout.write(
  `${freeze.datasetId}: froze ${files.length} solo pre-annotation inputs (${freeze.implementationDirtyAtFreeze ? "dirty tree; file hashes authoritative" : "clean tree"})\n`,
);

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

async function assertMissing(path: string, message: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
  throw new Error(message);
}
