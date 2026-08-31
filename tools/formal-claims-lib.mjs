const MODULE_PATTERN = /^Sprawlens(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
const THEOREM_PATTERN = /^[A-Za-z][A-Za-z0-9_?'']*(?:\.[A-Za-z][A-Za-z0-9_?'']*)*$/;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseLeanModules(value) {
  if (typeof value !== "string") throw new Error("leanModule must be a string");
  const modules = value
    .replace(/,?\s+and\s+/g, ",")
    .split(",")
    .map((module) => module.trim())
    .filter(Boolean);
  if (modules.length === 0 || modules.some((module) => !MODULE_PATTERN.test(module))) {
    throw new Error(`invalid Lean module list: ${value}`);
  }
  return modules;
}

export function validateClaimsLedger(ledger) {
  if (ledger?.schemaVersion !== 1) throw new Error("claims schemaVersion must be 1");
  if (!Array.isArray(ledger.claims)) throw new Error("claims must be an array");
  const ids = new Set();
  for (const claim of ledger.claims) {
    if (typeof claim?.id !== "string" || claim.id.length === 0) {
      throw new Error("every claim must have a nonempty id");
    }
    if (ids.has(claim.id)) throw new Error(`duplicate claim id: ${claim.id}`);
    ids.add(claim.id);
    parseLeanModules(claim.leanModule);
    if (!Array.isArray(claim.theorems)) {
      throw new Error(`claim ${claim.id} must have a theorem array`);
    }
    for (const theorem of claim.theorems) {
      if (typeof theorem !== "string" || !THEOREM_PATTERN.test(theorem)) {
        throw new Error(`invalid theorem name in ${claim.id}: ${String(theorem)}`);
      }
    }
  }
  return ledger;
}

const declaresTheorem = (source, theorem) => {
  const escaped = escapeRegExp(theorem);
  const declaration = new RegExp(`\\b(?:theorem|lemma)\\s+${escaped}(?=\\s|\\{|\\[|\\(|$)`);
  return source
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .some((line) => declaration.test(line));
};

export function resolveClaimTheorems(ledger, sourceByModule) {
  const resolved = [];
  for (const claim of ledger.claims) {
    const modules = parseLeanModules(claim.leanModule);
    for (const module of modules) {
      if (!sourceByModule.has(module)) throw new Error(`Lean module source is missing: ${module}`);
    }
    for (const theorem of claim.theorems) {
      const owners = modules.filter((module) =>
        declaresTheorem(sourceByModule.get(module), theorem),
      );
      if (owners.length === 0) {
        throw new Error(`theorem not declared in ledger modules: ${claim.id} / ${theorem}`);
      }
      if (owners.length > 1) {
        throw new Error(`theorem is ambiguous across ledger modules: ${claim.id} / ${theorem}`);
      }
      resolved.push(`${owners[0]}.${theorem}`);
    }
  }
  return resolved;
}

export function buildLeanAuditSource(theorems) {
  return `import Sprawlens\n\n${theorems.map((theorem) => `#check ${theorem}`).join("\n")}\n`;
}

export function findUnsafeProofPlaceholders(sourceByModule) {
  const findings = [];
  for (const [module, source] of sourceByModule) {
    for (const [index, line] of source.split("\n").entries()) {
      const code = line.replace(/--.*$/, "");
      if (/\bsorry\b/.test(code)) findings.push(`${module}:${index + 1}: sorry`);
      if (/\badmit\b/.test(code)) findings.push(`${module}:${index + 1}: admit`);
      if (/^\s*axiom\b/.test(code)) findings.push(`${module}:${index + 1}: axiom`);
    }
  }
  return findings;
}
