import type { AstDiffStatus, AstDiffSymbolSelector } from "./astSymbolDiffEvaluation.ts";
import type { AstSymbolLike } from "./astSymbolDiff.ts";

export type SoloAstDiffDecision = AstDiffStatus | "none";

export type SoloAstDiffAnnotationSourceCase = {
  id: string;
  candidates: AstDiffSymbolSelector[];
};

export type SoloAstDiffAnnotationSheet = {
  schemaVersion: 1;
  datasetId: string;
  passId: "A" | "B";
  predictionBlind: true;
  minimumWashoutDays: number;
  annotation: {
    annotatorId: string | null;
    startedOn: string | null;
    completedOn: string | null;
    predictionsInspected: boolean | null;
    otherPassInspectedDuringAnnotation: boolean | null;
  };
  cases: Array<{
    alias: string;
    reviewed: boolean;
    decisions: Array<{
      symbol: AstDiffSymbolSelector;
      decision: SoloAstDiffDecision;
    }>;
    notes: string;
  }>;
};

export type SoloAstDiffAnnotationKey = {
  schemaVersion: 1;
  datasetId: string;
  passId: "A" | "B";
  seed: number;
  minimumWashoutDays: number;
  cases: Array<{ alias: string; caseId: string }>;
};

export type SoloAstDiffAnnotationPasses = {
  passA: { sheet: SoloAstDiffAnnotationSheet; key: SoloAstDiffAnnotationKey };
  passB: { sheet: SoloAstDiffAnnotationSheet; key: SoloAstDiffAnnotationKey };
};

export type SoloAstDiffAgreementReport = {
  schemaVersion: 1;
  datasetId: string;
  design: "single-annotator-test-retest";
  minimumWashoutDays: number;
  washoutDays: number;
  cases: number;
  symbols: number;
  binary: AgreementMetrics;
  status: AgreementMetrics & { compared: number };
  disagreements: Array<{
    caseId: string;
    kind: "binary" | "status";
    symbol: AstDiffSymbolSelector;
    passA: SoloAstDiffDecision;
    passB: SoloAstDiffDecision;
  }>;
};

type AgreementMetrics = {
  agreements: number;
  disagreements: number;
  agreement: number;
  kappa: number;
};

type CreateOptions = {
  datasetId: string;
  passASeed: number;
  passBSeed: number;
  minimumWashoutDays: number;
};

/** Create resolvable semantic selectors, disambiguating duplicate declarations by source order. */
export function createUniqueSoloAstDiffSelectors(
  symbols: readonly AstSymbolLike[],
): AstDiffSymbolSelector[] {
  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const ordered = [...symbols].sort(
    (a, b) =>
      (a.startLine ?? 0) - (b.startLine ?? 0) ||
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  const base = ordered.map((symbol) => {
    const parent = symbol.parentClass ? byId.get(symbol.parentClass) : undefined;
    return {
      kind: symbol.kind,
      name: symbol.name,
      ...(parent ? { parent: { kind: parent.kind, name: parent.name } } : {}),
    } satisfies AstDiffSymbolSelector;
  });
  const totals = new Map<string, number>();
  for (const selector of base) {
    const key = selectorKey(selector);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  return base.map((selector) => {
    const key = selectorKey(selector);
    if ((totals.get(key) ?? 0) === 1) return selector;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { ...selector, occurrence };
  });
}

/** Build two opaque, deterministic annotation passes without exposing source case ids in sheets. */
export function createSoloAstDiffAnnotationPasses(
  sourceCases: readonly SoloAstDiffAnnotationSourceCase[],
  options: CreateOptions,
): SoloAstDiffAnnotationPasses {
  if (!options.datasetId) throw new Error("datasetId must be a non-empty string");
  if (sourceCases.length < 2)
    throw new Error("at least two cases are required for pass derangement");
  for (const [name, seed] of [
    ["passASeed", options.passASeed],
    ["passBSeed", options.passBSeed],
  ] as const) {
    if (!Number.isSafeInteger(seed)) throw new Error(`${name} must be a safe integer`);
  }
  if (!Number.isInteger(options.minimumWashoutDays) || options.minimumWashoutDays < 1) {
    throw new Error("minimumWashoutDays must be a positive integer");
  }

  const byId = new Map<string, SoloAstDiffAnnotationSourceCase>();
  for (const testCase of sourceCases) {
    if (!testCase.id) throw new Error("source case id must be a non-empty string");
    if (byId.has(testCase.id)) throw new Error(`duplicate source case id: ${testCase.id}`);
    const selectorKeys = new Set<string>();
    for (const selector of testCase.candidates) {
      validateSelector(selector, `${testCase.id} candidate`);
      const key = selectorKey(selector);
      if (selectorKeys.has(key)) throw new Error(`duplicate selector in ${testCase.id}: ${key}`);
      selectorKeys.add(key);
    }
    byId.set(testCase.id, testCase);
  }

  const passAOrder = fisherYates(
    sourceCases.map((item) => item.id),
    seededRandom(options.passASeed),
  );
  const passBOrder = sattolo(passAOrder, seededRandom(options.passBSeed));

  return {
    passA: createPass("A", passAOrder, byId, options, options.passASeed),
    passB: createPass("B", passBOrder, byId, options, options.passBSeed),
  };
}

/** Compare completed pass A/B sheets only after verifying blinding and washout gates. */
export function compareSoloAstDiffAnnotationPasses(
  rawPassA: SoloAstDiffAnnotationSheet,
  rawKeyA: SoloAstDiffAnnotationKey,
  rawPassB: SoloAstDiffAnnotationSheet,
  rawKeyB: SoloAstDiffAnnotationKey,
): SoloAstDiffAgreementReport {
  const passA = parseCompletedPass(rawPassA, rawKeyA, "A");
  const passB = parseCompletedPass(rawPassB, rawKeyB, "B");
  if (passA.datasetId !== passB.datasetId) throw new Error("pass datasetId mismatch");
  if (passA.minimumWashoutDays !== passB.minimumWashoutDays) {
    throw new Error("pass minimumWashoutDays mismatch");
  }
  const washoutDays = daysBetween(passA.completedOn, passB.startedOn);
  if (washoutDays < passA.minimumWashoutDays) {
    throw new Error(
      `washout gate failed: observed ${washoutDays} days, required ${passA.minimumWashoutDays}`,
    );
  }

  const caseIds = [...passA.cases.keys()].sort();
  if (!sameStrings(caseIds, [...passB.cases.keys()].sort())) {
    throw new Error("pass case universe mismatch");
  }

  let symbols = 0;
  let binaryAgreements = 0;
  let binaryDisagreements = 0;
  let statusCompared = 0;
  let statusAgreements = 0;
  let statusDisagreements = 0;
  const binaryPairs: Array<[boolean, boolean]> = [];
  const statusPairs: Array<[AstDiffStatus, AstDiffStatus]> = [];
  const disagreements: SoloAstDiffAgreementReport["disagreements"] = [];

  for (const caseId of caseIds) {
    const caseA = passA.cases.get(caseId)!;
    const caseB = passB.cases.get(caseId)!;
    const selectorKeys = [...caseA.keys()].sort();
    if (!sameStrings(selectorKeys, [...caseB.keys()].sort())) {
      throw new Error(`${caseId}: pass symbol universe mismatch`);
    }
    for (const key of selectorKeys) {
      symbols += 1;
      const itemA = caseA.get(key)!;
      const itemB = caseB.get(key)!;
      const highlightedA = itemA.decision !== "none";
      const highlightedB = itemB.decision !== "none";
      binaryPairs.push([highlightedA, highlightedB]);
      if (highlightedA === highlightedB) binaryAgreements += 1;
      else {
        binaryDisagreements += 1;
        disagreements.push({
          caseId,
          kind: "binary",
          symbol: cloneSelector(itemA.symbol),
          passA: itemA.decision,
          passB: itemB.decision,
        });
      }
      if (highlightedA && highlightedB) {
        statusCompared += 1;
        statusPairs.push([itemA.decision as AstDiffStatus, itemB.decision as AstDiffStatus]);
        if (itemA.decision === itemB.decision) statusAgreements += 1;
        else {
          statusDisagreements += 1;
          disagreements.push({
            caseId,
            kind: "status",
            symbol: cloneSelector(itemA.symbol),
            passA: itemA.decision,
            passB: itemB.decision,
          });
        }
      }
    }
  }

  disagreements.sort(
    (a, b) =>
      a.caseId.localeCompare(b.caseId) ||
      selectorKey(a.symbol).localeCompare(selectorKey(b.symbol)) ||
      a.kind.localeCompare(b.kind),
  );
  return {
    schemaVersion: 1,
    datasetId: passA.datasetId,
    design: "single-annotator-test-retest",
    minimumWashoutDays: passA.minimumWashoutDays,
    washoutDays,
    cases: caseIds.length,
    symbols,
    binary: agreementMetrics(binaryAgreements, binaryDisagreements, binaryPairs),
    status: {
      compared: statusCompared,
      ...agreementMetrics(statusAgreements, statusDisagreements, statusPairs),
    },
    disagreements,
  };
}

/** Validate one completed pass before hashing it for the washout boundary. */
export function validateCompletedSoloAstDiffAnnotationPass(
  sheet: SoloAstDiffAnnotationSheet,
  key: SoloAstDiffAnnotationKey,
  passId: "A" | "B",
): {
  datasetId: string;
  passId: "A" | "B";
  cases: number;
  symbols: number;
  startedOn: string;
  completedOn: string;
} {
  const parsed = parseCompletedPass(sheet, key, passId);
  return {
    datasetId: parsed.datasetId,
    passId,
    cases: parsed.cases.size,
    symbols: [...parsed.cases.values()].reduce((sum, decisions) => sum + decisions.size, 0),
    startedOn: parsed.startedOn,
    completedOn: parsed.completedOn,
  };
}

function createPass(
  passId: "A" | "B",
  order: readonly string[],
  byId: ReadonlyMap<string, SoloAstDiffAnnotationSourceCase>,
  options: CreateOptions,
  seed: number,
): { sheet: SoloAstDiffAnnotationSheet; key: SoloAstDiffAnnotationKey } {
  const keyCases = order.map((caseId, index) => ({
    alias: `${passId}-${String(index + 1).padStart(3, "0")}`,
    caseId,
  }));
  return {
    key: {
      schemaVersion: 1,
      datasetId: options.datasetId,
      passId,
      seed,
      minimumWashoutDays: options.minimumWashoutDays,
      cases: keyCases,
    },
    sheet: {
      schemaVersion: 1,
      datasetId: options.datasetId,
      passId,
      predictionBlind: true,
      minimumWashoutDays: options.minimumWashoutDays,
      annotation: {
        annotatorId: null,
        startedOn: null,
        completedOn: null,
        predictionsInspected: null,
        otherPassInspectedDuringAnnotation: null,
      },
      cases: keyCases.map(({ alias, caseId }) => ({
        alias,
        reviewed: false,
        decisions: byId.get(caseId)!.candidates.map((symbol) => ({
          symbol: cloneSelector(symbol),
          decision: "none",
        })),
        notes: "",
      })),
    },
  };
}

function parseCompletedPass(
  sheet: SoloAstDiffAnnotationSheet,
  key: SoloAstDiffAnnotationKey,
  expectedPassId: "A" | "B",
): {
  datasetId: string;
  minimumWashoutDays: number;
  startedOn: string;
  completedOn: string;
  cases: Map<string, Map<string, { symbol: AstDiffSymbolSelector; decision: SoloAstDiffDecision }>>;
} {
  if (sheet.schemaVersion !== 1 || key.schemaVersion !== 1)
    throw new Error("invalid schemaVersion");
  if (sheet.passId !== expectedPassId || key.passId !== expectedPassId) {
    throw new Error(`expected pass ${expectedPassId}`);
  }
  if (sheet.datasetId !== key.datasetId)
    throw new Error(`pass ${expectedPassId} datasetId mismatch`);
  if (!sheet.predictionBlind) throw new Error(`pass ${expectedPassId} is not prediction-blind`);
  if (sheet.minimumWashoutDays !== key.minimumWashoutDays) {
    throw new Error(`pass ${expectedPassId} washout contract mismatch`);
  }
  if (sheet.annotation.predictionsInspected !== false) {
    throw new Error(`pass ${expectedPassId}: predictions must not be inspected`);
  }
  if (sheet.annotation.otherPassInspectedDuringAnnotation !== false) {
    throw new Error(`pass ${expectedPassId}: other pass must not be inspected during annotation`);
  }
  if (!sheet.annotation.annotatorId)
    throw new Error(`pass ${expectedPassId}: annotatorId is required`);
  const startedOn = parseDate(sheet.annotation.startedOn, `pass ${expectedPassId} startedOn`);
  const completedOn = parseDate(sheet.annotation.completedOn, `pass ${expectedPassId} completedOn`);
  if (completedOn.getTime() < startedOn.getTime()) {
    throw new Error(`pass ${expectedPassId}: completedOn precedes startedOn`);
  }

  const keyByAlias = new Map<string, string>();
  const keyedCaseIds = new Set<string>();
  for (const item of key.cases) {
    if (keyByAlias.has(item.alias)) throw new Error(`pass ${expectedPassId}: duplicate key alias`);
    if (keyedCaseIds.has(item.caseId))
      throw new Error(`pass ${expectedPassId}: duplicate key caseId`);
    keyByAlias.set(item.alias, item.caseId);
    keyedCaseIds.add(item.caseId);
  }
  if (sheet.cases.length !== key.cases.length) {
    throw new Error(`pass ${expectedPassId}: sheet/key case count mismatch`);
  }
  const cases = new Map<
    string,
    Map<string, { symbol: AstDiffSymbolSelector; decision: SoloAstDiffDecision }>
  >();
  for (const item of sheet.cases) {
    const caseId = keyByAlias.get(item.alias);
    if (!caseId) throw new Error(`pass ${expectedPassId}: unknown alias ${item.alias}`);
    if (cases.has(caseId))
      throw new Error(`pass ${expectedPassId}: duplicate sheet alias ${item.alias}`);
    if (item.reviewed !== true) {
      throw new Error(`pass ${expectedPassId} incomplete case review in ${item.alias}`);
    }
    const decisions = new Map<
      string,
      { symbol: AstDiffSymbolSelector; decision: SoloAstDiffDecision }
    >();
    for (const entry of item.decisions) {
      validateSelector(entry.symbol, `${item.alias} symbol`);
      if (
        entry.decision !== "added" &&
        entry.decision !== "modified" &&
        entry.decision !== "none"
      ) {
        throw new Error(`pass ${expectedPassId} incomplete decision in ${item.alias}`);
      }
      const selector = selectorKey(entry.symbol);
      if (decisions.has(selector)) throw new Error(`pass ${expectedPassId}: duplicate selector`);
      decisions.set(selector, {
        symbol: cloneSelector(entry.symbol),
        decision: entry.decision,
      });
    }
    cases.set(caseId, decisions);
  }
  return {
    datasetId: sheet.datasetId,
    minimumWashoutDays: sheet.minimumWashoutDays,
    startedOn: formatDate(startedOn),
    completedOn: formatDate(completedOn),
    cases,
  };
}

function agreementMetrics<T extends string | boolean>(
  agreements: number,
  disagreements: number,
  pairs: readonly [T, T][],
): AgreementMetrics {
  const total = agreements + disagreements;
  const agreement = total === 0 ? 1 : agreements / total;
  return { agreements, disagreements, agreement, kappa: cohenKappa(pairs, agreement) };
}

function cohenKappa<T extends string | boolean>(
  pairs: readonly [T, T][],
  observed: number,
): number {
  if (pairs.length === 0) return 1;
  const categories = new Set<T>();
  const first = new Map<T, number>();
  const second = new Map<T, number>();
  for (const [a, b] of pairs) {
    categories.add(a);
    categories.add(b);
    first.set(a, (first.get(a) ?? 0) + 1);
    second.set(b, (second.get(b) ?? 0) + 1);
  }
  let expected = 0;
  for (const category of categories) {
    expected +=
      ((first.get(category) ?? 0) / pairs.length) * ((second.get(category) ?? 0) / pairs.length);
  }
  if (expected === 1) return observed === 1 ? 1 : 0;
  return (observed - expected) / (1 - expected);
}

function fisherYates<T>(values: readonly T[], random: () => number): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [output[index], output[other]] = [output[other]!, output[index]!];
  }
  return output;
}

/** Sattolo's algorithm guarantees that no case remains at its pass-A ordinal. */
function sattolo<T>(values: readonly T[], random: () => number): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * index);
    [output[index], output[other]] = [output[other]!, output[index]!];
  }
  return output;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function validateSelector(selector: AstDiffSymbolSelector, path: string): void {
  if (!selector || typeof selector !== "object") throw new Error(`${path} must be an object`);
  if (!selector.kind || !selector.name) throw new Error(`${path} kind/name must be non-empty`);
  if (selector.parent && !selector.parent.name) throw new Error(`${path} parent name is required`);
  if (
    selector.occurrence !== undefined &&
    (!Number.isInteger(selector.occurrence) || selector.occurrence < 0)
  ) {
    throw new Error(`${path} occurrence must be a non-negative integer`);
  }
}

function cloneSelector(selector: AstDiffSymbolSelector): AstDiffSymbolSelector {
  return {
    kind: selector.kind,
    name: selector.name,
    ...(selector.parent ? { parent: { ...selector.parent } } : {}),
    ...(selector.occurrence === undefined ? {} : { occurrence: selector.occurrence }),
  };
}

function selectorKey(selector: AstDiffSymbolSelector): string {
  return JSON.stringify(cloneSelector(selector));
}

function parseDate(value: string | null, path: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} must use YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || formatDate(date) !== value) {
    throw new Error(`${path} is not a valid date`);
  }
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(before: string, after: string): number {
  return Math.floor(
    (new Date(`${after}T00:00:00.000Z`).getTime() - new Date(`${before}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );
}

function sameStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
