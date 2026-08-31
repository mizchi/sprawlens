import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  buildLeanAuditSource,
  findUnsafeProofPlaceholders,
  parseLeanModules,
  resolveClaimTheorems,
  validateClaimsLedger,
} from "./formal-claims-lib.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const formalRoot = resolve(projectRoot, "formal");
const ledger = validateClaimsLedger(
  JSON.parse(await readFile(resolve(formalRoot, "claims.json"), "utf8")),
);
const modules = new Set(ledger.claims.flatMap((claim) => parseLeanModules(claim.leanModule)));
const sourceByModule = new Map();
for (const module of modules) {
  const relative = `${module.replaceAll(".", "/")}.lean`;
  sourceByModule.set(module, await readFile(resolve(formalRoot, relative), "utf8"));
}

const unsafe = findUnsafeProofPlaceholders(sourceByModule);
if (unsafe.length > 0) throw new Error(`unsafe proof placeholders:\n${unsafe.join("\n")}`);

const theorems = resolveClaimTheorems(ledger, sourceByModule);
const auditRoot = await mkdtemp(join(tmpdir(), "sprawlens-formal-claims-"));
const auditPath = resolve(auditRoot, "ClaimsAudit.lean");
try {
  await writeFile(auditPath, buildLeanAuditSource(theorems));
  const checked = spawnSync("lake", ["env", "lean", auditPath], {
    cwd: formalRoot,
    encoding: "utf8",
  });
  if (checked.error || checked.status !== 0) {
    throw new Error(
      `Lean claim audit failed: ${checked.error?.message ?? checked.stderr ?? checked.stdout}`,
    );
  }
} finally {
  await rm(auditRoot, { recursive: true, force: true });
}

process.stdout.write(
  `${JSON.stringify({
    ledger: basename(resolve(formalRoot, "claims.json")),
    claims: ledger.claims.length,
    modules: modules.size,
    theorems: theorems.length,
    unsafeProofPlaceholders: unsafe.length,
  })}\n`,
);
