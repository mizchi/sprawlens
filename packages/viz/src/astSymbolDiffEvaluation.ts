import { diffAstSymbols, type AstSymbolLike } from "./astSymbolDiff.ts";

export type AstDiffStatus = "added" | "modified";

export type AstDiffGoldLabel = {
  symbolId: string;
  status: AstDiffStatus;
};

export type AstDiffGoldCase = {
  id: string;
  language: string;
  repository: string;
  beforeRevision: string;
  afterRevision: string;
  file: string;
  changeKinds: string[];
  before: AstSymbolLike[];
  after: AstSymbolLike[];
  expected: AstDiffGoldLabel[];
  notes?: string;
};

export type AstDiffGoldSet = {
  schemaVersion: 1;
  datasetId: string;
  description?: string;
  annotation?: {
    annotators?: string[];
    adjudicator?: string;
    protocol?: string;
  };
  cases: AstDiffGoldCase[];
};

export type AstDiffSymbolSelector = {
  kind: string;
  name: string;
  parent?: { kind?: string; name: string };
  /** Zero-based source-order occurrence, only for intentionally duplicated declarations. */
  occurrence?: number;
};

export type AstDiffAnnotationManifest = {
  schemaVersion: 1;
  datasetId: string;
  description?: string;
  annotation?: AstDiffGoldSet["annotation"];
  cases: Array<{
    id: string;
    language: string;
    repository: string;
    repositoryPath: string;
    beforeRevision: string;
    afterRevision: string;
    file: string;
    changeKinds: string[];
    expected: Array<{ symbol: AstDiffSymbolSelector; status: AstDiffStatus }>;
    notes?: string;
  }>;
};

export type AstDiffAnnotationExtension = {
  schemaVersion: 1;
  datasetId: string;
  baseDatasetId: string;
  description?: string;
  additions: Array<{
    caseId: string;
    expected: Array<{ symbol: AstDiffSymbolSelector; status: AstDiffStatus }>;
  }>;
};

export type AstDiffSymbolLoadRequest = {
  caseId: string;
  repository: string;
  repositoryPath: string;
  revision: string;
  file: string;
};

export type AstDiffMetrics = {
  cases: number;
  expected: number;
  predicted: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
  statusCorrect: number;
  statusAccuracy: number;
};

export type AstDiffCaseReport = AstDiffMetrics & {
  id: string;
  language: string;
  repository: string;
  beforeRevision: string;
  afterRevision: string;
  file: string;
  changeKinds: string[];
  truePositiveIds: string[];
  falsePositiveIds: string[];
  falseNegativeIds: string[];
  statusMismatchIds: string[];
};

export type AstDiffEvaluationReport = {
  schemaVersion: 1;
  datasetId: string;
  micro: AstDiffMetrics;
  byLanguage: Record<string, AstDiffMetrics>;
  byRepository: Record<string, AstDiffMetrics>;
  byChangeKind: Record<string, AstDiffMetrics>;
  cases: AstDiffCaseReport[];
  representation?: AstDiffRepresentationReport;
};

export type AstDiffPredictor = (
  testCase: AstDiffGoldCase,
  changedAfterLines: readonly number[],
) => ReadonlyMap<string, AstDiffStatus>;

export type AstDiffRepresentationMetrics = {
  cases: number;
  changedAfterLines: number;
  coveredAfterLines: number;
  coverage: number;
};

export type AstDiffRepresentationReport = {
  micro: AstDiffRepresentationMetrics;
  byRepository: Record<string, AstDiffRepresentationMetrics>;
  cases: Array<
    AstDiffRepresentationMetrics & {
      id: string;
      repository: string;
      file: string;
      uncoveredAfterLines: number[];
    }
  >;
};

/** Create a new annotation revision while leaving the frozen base untouched. */
export function extendAstDiffAnnotationManifest(
  base: AstDiffAnnotationManifest,
  extension: AstDiffAnnotationExtension,
): AstDiffAnnotationManifest {
  const parsedBase = parseAstDiffAnnotationManifest(base);
  if (extension.schemaVersion !== 1) throw new Error("extension schemaVersion must be 1");
  if (extension.baseDatasetId !== parsedBase.datasetId) {
    throw new Error(
      `extension baseDatasetId ${extension.baseDatasetId} does not match ${parsedBase.datasetId}`,
    );
  }
  if (!extension.datasetId) throw new Error("extension datasetId must be a non-empty string");
  if (!Array.isArray(extension.additions)) throw new Error("extension additions must be an array");
  const cases = parsedBase.cases.map((item) => ({
    ...item,
    changeKinds: [...item.changeKinds],
    expected: item.expected.map((label) => ({
      ...label,
      symbol: cloneSelector(label.symbol),
    })),
  }));
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const extendedCaseIds = new Set<string>();
  for (const addition of extension.additions) {
    const item = casesById.get(addition.caseId);
    if (!item) throw new Error(`extension references missing case: ${addition.caseId}`);
    if (extendedCaseIds.has(addition.caseId)) {
      throw new Error(`duplicate extension case: ${addition.caseId}`);
    }
    extendedCaseIds.add(addition.caseId);
    const selectorKeys = new Set(item.expected.map((label) => selectorKey(label.symbol)));
    for (const label of addition.expected) {
      const key = selectorKey(label.symbol);
      if (selectorKeys.has(key)) {
        throw new Error(`duplicate selector in ${addition.caseId}: ${key}`);
      }
      selectorKeys.add(key);
      item.expected.push({ ...label, symbol: cloneSelector(label.symbol) });
    }
  }
  return parseAstDiffAnnotationManifest({
    ...parsedBase,
    datasetId: extension.datasetId,
    ...(extension.description ? { description: extension.description } : {}),
    cases,
  });
}

export function parseAstDiffAnnotationManifest(value: unknown): AstDiffAnnotationManifest {
  const root = objectAt(value, "annotation manifest");
  if (root.schemaVersion !== 1) throw new Error("annotation schemaVersion must be 1");
  const datasetId = stringAt(root.datasetId, "datasetId");
  if (!Array.isArray(root.cases)) throw new Error("annotation cases must be an array");
  const caseIds = new Set<string>();
  const cases = root.cases.map((rawCase, index) => {
    const item = objectAt(rawCase, `cases[${index}]`);
    const id = stringAt(item.id, `cases[${index}].id`);
    if (caseIds.has(id)) throw new Error(`duplicate case id: ${id}`);
    caseIds.add(id);
    if (!Array.isArray(item.changeKinds) || item.changeKinds.length === 0) {
      throw new Error(`${id}.changeKinds must be a non-empty array`);
    }
    if (!Array.isArray(item.expected)) throw new Error(`${id}.expected must be an array`);
    const expected = item.expected.map((rawLabel, labelIndex) => {
      const path = `${id}.expected[${labelIndex}]`;
      const label = objectAt(rawLabel, path);
      let status: AstDiffStatus;
      if (label.status === "added") status = "added";
      else if (label.status === "modified") status = "modified";
      else {
        throw new Error(`${path} has invalid status`);
      }
      const rawSelector = objectAt(label.symbol, `${path}.symbol`);
      const selector: AstDiffSymbolSelector = {
        kind: stringAt(rawSelector.kind, `${path}.symbol.kind`),
        name: stringAt(rawSelector.name, `${path}.symbol.name`),
      };
      if (rawSelector.parent !== undefined) {
        const parent = objectAt(rawSelector.parent, `${path}.symbol.parent`);
        selector.parent = {
          name: stringAt(parent.name, `${path}.symbol.parent.name`),
          ...(typeof parent.kind === "string" ? { kind: parent.kind } : {}),
        };
      }
      if (rawSelector.occurrence !== undefined) {
        if (
          typeof rawSelector.occurrence !== "number" ||
          !Number.isInteger(rawSelector.occurrence) ||
          rawSelector.occurrence < 0
        ) {
          throw new Error(`${path}.symbol.occurrence must be a non-negative integer`);
        }
        selector.occurrence = rawSelector.occurrence;
      }
      return { symbol: selector, status };
    });
    return {
      id,
      language: stringAt(item.language, `${id}.language`),
      repository: stringAt(item.repository, `${id}.repository`),
      repositoryPath: stringAt(item.repositoryPath, `${id}.repositoryPath`),
      beforeRevision: stringAt(item.beforeRevision, `${id}.beforeRevision`),
      afterRevision: stringAt(item.afterRevision, `${id}.afterRevision`),
      file: stringAt(item.file, `${id}.file`),
      changeKinds: item.changeKinds.map((kind, kindIndex) =>
        stringAt(kind, `${id}.changeKinds[${kindIndex}]`),
      ),
      expected,
      ...(typeof item.notes === "string" ? { notes: item.notes } : {}),
    };
  });
  return {
    schemaVersion: 1,
    datasetId,
    ...(typeof root.description === "string" ? { description: root.description } : {}),
    ...(isObject(root.annotation)
      ? { annotation: root.annotation as AstDiffGoldSet["annotation"] }
      : {}),
    cases,
  };
}

/** Resolve human-readable annotations against symbols extracted at pinned revisions. */
export async function materializeAstDiffGoldSet(
  manifest: AstDiffAnnotationManifest,
  loadSymbols: (request: AstDiffSymbolLoadRequest) => Promise<AstSymbolLike[]>,
): Promise<AstDiffGoldSet> {
  const parsedManifest = parseAstDiffAnnotationManifest(manifest);
  const cases: AstDiffGoldCase[] = [];
  for (const item of parsedManifest.cases) {
    const base = {
      caseId: item.id,
      repository: item.repository,
      repositoryPath: item.repositoryPath,
      file: item.file,
    };
    const [before, after] = await Promise.all([
      loadSymbols({ ...base, revision: item.beforeRevision }),
      loadSymbols({ ...base, revision: item.afterRevision }),
    ]);
    const expected = item.expected.map(({ symbol, status }) => ({
      symbolId: resolveSelector(item.id, after, symbol).id,
      status,
    }));
    cases.push({
      id: item.id,
      language: item.language,
      repository: item.repository,
      beforeRevision: item.beforeRevision,
      afterRevision: item.afterRevision,
      file: item.file,
      changeKinds: [...item.changeKinds],
      before,
      after,
      expected,
      ...(item.notes ? { notes: item.notes } : {}),
    });
  }
  return parseAstDiffGoldSet({
    schemaVersion: 1,
    datasetId: parsedManifest.datasetId,
    ...(parsedManifest.description ? { description: parsedManifest.description } : {}),
    ...(parsedManifest.annotation ? { annotation: parsedManifest.annotation } : {}),
    cases,
  });
}

type Counts = Omit<AstDiffMetrics, "precision" | "recall" | "f1" | "statusAccuracy">;

const emptyCounts = (): Counts => ({
  cases: 0,
  expected: 0,
  predicted: 0,
  truePositive: 0,
  falsePositive: 0,
  falseNegative: 0,
  statusCorrect: 0,
});

/**
 * Evaluate the visible after-revision symbol set produced by diffAstSymbols.
 * Detection metrics compare symbol ids; statusAccuracy separately checks the
 * added/modified label for matched ids.
 */
export function evaluateAstDiffGoldSet(
  goldSet: AstDiffGoldSet,
  changedAfterLinesByCase?: ReadonlyMap<string, readonly number[]>,
  predictor: AstDiffPredictor = (testCase) => diffAstSymbols(testCase.before, testCase.after),
): AstDiffEvaluationReport {
  const parsed = parseAstDiffGoldSet(goldSet);
  const micro = emptyCounts();
  const byLanguage = new Map<string, Counts>();
  const byRepository = new Map<string, Counts>();
  const byChangeKind = new Map<string, Counts>();
  const cases = parsed.cases.map((testCase): AstDiffCaseReport => {
    const predicted = predictor(testCase, changedAfterLinesByCase?.get(testCase.id) ?? []);
    const expected = new Map(testCase.expected.map((label) => [label.symbolId, label.status]));
    const truePositiveIds = [...predicted.keys()].filter((id) => expected.has(id)).sort();
    const falsePositiveIds = [...predicted.keys()].filter((id) => !expected.has(id)).sort();
    const falseNegativeIds = [...expected.keys()].filter((id) => !predicted.has(id)).sort();
    const statusMismatchIds = truePositiveIds
      .filter((id) => predicted.get(id) !== expected.get(id))
      .sort();
    const counts: Counts = {
      cases: 1,
      expected: expected.size,
      predicted: predicted.size,
      truePositive: truePositiveIds.length,
      falsePositive: falsePositiveIds.length,
      falseNegative: falseNegativeIds.length,
      statusCorrect: truePositiveIds.length - statusMismatchIds.length,
    };
    addCounts(micro, counts);
    addToGroup(byLanguage, testCase.language, counts);
    addToGroup(byRepository, testCase.repository, counts);
    for (const changeKind of new Set(testCase.changeKinds)) {
      addToGroup(byChangeKind, changeKind, counts);
    }
    return {
      id: testCase.id,
      language: testCase.language,
      repository: testCase.repository,
      beforeRevision: testCase.beforeRevision,
      afterRevision: testCase.afterRevision,
      file: testCase.file,
      changeKinds: [...testCase.changeKinds],
      ...finalize(counts),
      truePositiveIds,
      falsePositiveIds,
      falseNegativeIds,
      statusMismatchIds,
    };
  });

  return {
    schemaVersion: 1,
    datasetId: parsed.datasetId,
    micro: finalize(micro),
    byLanguage: finalizeGroups(byLanguage),
    byRepository: finalizeGroups(byRepository),
    byChangeKind: finalizeGroups(byChangeKind),
    cases,
    ...(changedAfterLinesByCase
      ? { representation: representationReport(parsed.cases, changedAfterLinesByCase) }
      : {}),
  };
}

export function parseAstDiffGoldSet(value: unknown): AstDiffGoldSet {
  const root = objectAt(value, "gold set");
  if (root.schemaVersion !== 1) throw new Error("gold set schemaVersion must be 1");
  const datasetId = stringAt(root.datasetId, "datasetId");
  if (!Array.isArray(root.cases)) throw new Error("gold set cases must be an array");
  const caseIds = new Set<string>();
  const cases = root.cases.map((rawCase, index): AstDiffGoldCase => {
    const item = objectAt(rawCase, `cases[${index}]`);
    const id = stringAt(item.id, `cases[${index}].id`);
    if (caseIds.has(id)) throw new Error(`duplicate case id: ${id}`);
    caseIds.add(id);
    const before = parseSymbols(item.before, `${id}.before`);
    const after = parseSymbols(item.after, `${id}.after`);
    const afterIds = new Set(after.map((symbol) => symbol.id));
    if (!Array.isArray(item.expected)) throw new Error(`${id}.expected must be an array`);
    const expectedIds = new Set<string>();
    const expected = item.expected.map((rawLabel, labelIndex): AstDiffGoldLabel => {
      const label = objectAt(rawLabel, `${id}.expected[${labelIndex}]`);
      const symbolId = stringAt(label.symbolId, `${id}.expected[${labelIndex}].symbolId`);
      if (!afterIds.has(symbolId)) {
        throw new Error(`${id}: expected symbol ${symbolId} is missing from the after symbol set`);
      }
      if (expectedIds.has(symbolId))
        throw new Error(`${id}: duplicate expected symbol id: ${symbolId}`);
      expectedIds.add(symbolId);
      if (label.status !== "added" && label.status !== "modified") {
        throw new Error(`${id}: invalid expected status for ${symbolId}`);
      }
      return { symbolId, status: label.status };
    });
    if (!Array.isArray(item.changeKinds) || item.changeKinds.length === 0) {
      throw new Error(`${id}.changeKinds must be a non-empty array`);
    }
    return {
      id,
      language: stringAt(item.language, `${id}.language`),
      repository: stringAt(item.repository, `${id}.repository`),
      beforeRevision: stringAt(item.beforeRevision, `${id}.beforeRevision`),
      afterRevision: stringAt(item.afterRevision, `${id}.afterRevision`),
      file: stringAt(item.file, `${id}.file`),
      changeKinds: item.changeKinds.map((kind, kindIndex) =>
        stringAt(kind, `${id}.changeKinds[${kindIndex}]`),
      ),
      before,
      after,
      expected,
      ...(typeof item.notes === "string" ? { notes: item.notes } : {}),
    };
  });
  return {
    schemaVersion: 1,
    datasetId,
    ...(typeof root.description === "string" ? { description: root.description } : {}),
    ...(isObject(root.annotation)
      ? { annotation: root.annotation as AstDiffGoldSet["annotation"] }
      : {}),
    cases,
  };
}

function parseSymbols(value: unknown, path: string): AstSymbolLike[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  const ids = new Set<string>();
  return value.map((rawSymbol, index) => {
    const item = objectAt(rawSymbol, `${path}[${index}]`);
    const id = stringAt(item.id, `${path}[${index}].id`);
    if (ids.has(id)) {
      const side = path.endsWith(".after") ? "after" : "before";
      throw new Error(`duplicate ${side} symbol id: ${id}`);
    }
    ids.add(id);
    const loc = finiteNumberAt(item.loc, `${path}[${index}].loc`);
    if (loc < 1) throw new Error(`${path}[${index}].loc must be at least 1`);
    return {
      id,
      name: stringAt(item.name, `${path}[${index}].name`),
      kind: stringAt(item.kind, `${path}[${index}].kind`),
      loc,
      ...(finiteOptional(item.startLine) ? { startLine: item.startLine } : {}),
      ...(finiteOptional(item.endLine) ? { endLine: item.endLine } : {}),
      ...(finiteOptional(item.complexity) ? { complexity: item.complexity } : {}),
      ...(typeof item.parentClass === "string" ? { parentClass: item.parentClass } : {}),
      ...(typeof item.fingerprint === "string" ? { fingerprint: item.fingerprint } : {}),
    };
  });
}

function resolveSelector(
  caseId: string,
  symbols: readonly AstSymbolLike[],
  selector: AstDiffSymbolSelector,
): AstSymbolLike {
  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const matches = symbols.filter((symbol) => {
    if (symbol.kind !== selector.kind || symbol.name !== selector.name) return false;
    if (!selector.parent) return true;
    const parent = symbol.parentClass ? byId.get(symbol.parentClass) : undefined;
    return (
      parent?.name === selector.parent.name &&
      (selector.parent.kind === undefined || parent.kind === selector.parent.kind)
    );
  });
  matches.sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0) || a.id.localeCompare(b.id));
  if (selector.occurrence !== undefined) {
    const match = matches[selector.occurrence];
    if (match) return match;
    throw new Error(
      `${caseId}: selector ${selector.kind}:${selector.name} occurrence ${selector.occurrence} did not match`,
    );
  }
  if (matches.length === 1) return matches[0]!;
  const reason =
    matches.length === 0 ? "did not match" : `is ambiguous (${matches.length} matches)`;
  throw new Error(`${caseId}: selector ${selector.kind}:${selector.name} ${reason}`);
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
  return [
    selector.kind,
    selector.name,
    selector.parent?.kind ?? "",
    selector.parent?.name ?? "",
    selector.occurrence ?? "",
  ].join("\0");
}

function representationReport(
  cases: readonly AstDiffGoldCase[],
  changedAfterLinesByCase: ReadonlyMap<string, readonly number[]>,
): AstDiffRepresentationReport {
  const totals = { cases: 0, changedAfterLines: 0, coveredAfterLines: 0 };
  const repositoryTotals = new Map<
    string,
    { cases: number; changedAfterLines: number; coveredAfterLines: number }
  >();
  const caseReports = cases.map((testCase) => {
    const changedLines = [...new Set(changedAfterLinesByCase.get(testCase.id) ?? [])].sort(
      (a, b) => a - b,
    );
    const ranges = testCase.after.flatMap((symbol) => {
      const start = symbol.startLine ?? symbolLineFromId(symbol.id);
      if (start === null) return [];
      return [{ start, end: symbol.endLine ?? start + Math.max(1, symbol.loc) - 1 }];
    });
    const uncoveredAfterLines = changedLines.filter(
      (line) => !ranges.some((range) => range.start <= line && line <= range.end),
    );
    const counts = {
      cases: 1,
      changedAfterLines: changedLines.length,
      coveredAfterLines: changedLines.length - uncoveredAfterLines.length,
    };
    addRepresentationCounts(totals, counts);
    const repo = repositoryTotals.get(testCase.repository) ?? {
      cases: 0,
      changedAfterLines: 0,
      coveredAfterLines: 0,
    };
    addRepresentationCounts(repo, counts);
    repositoryTotals.set(testCase.repository, repo);
    return {
      id: testCase.id,
      repository: testCase.repository,
      file: testCase.file,
      ...finalizeRepresentation(counts),
      uncoveredAfterLines,
    };
  });
  return {
    micro: finalizeRepresentation(totals),
    byRepository: Object.fromEntries(
      [...repositoryTotals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([repository, counts]) => [repository, finalizeRepresentation(counts)]),
    ),
    cases: caseReports,
  };
}

function symbolLineFromId(id: string): number | null {
  const value = Number.parseInt(id.slice(id.lastIndexOf(":") + 1), 10);
  return Number.isFinite(value) ? value : null;
}

function addRepresentationCounts(
  target: { cases: number; changedAfterLines: number; coveredAfterLines: number },
  value: { cases: number; changedAfterLines: number; coveredAfterLines: number },
): void {
  target.cases += value.cases;
  target.changedAfterLines += value.changedAfterLines;
  target.coveredAfterLines += value.coveredAfterLines;
}

function finalizeRepresentation(counts: {
  cases: number;
  changedAfterLines: number;
  coveredAfterLines: number;
}): AstDiffRepresentationMetrics {
  return {
    ...counts,
    coverage:
      counts.changedAfterLines > 0 ? counts.coveredAfterLines / counts.changedAfterLines : 1,
  };
}

function addToGroup(groups: Map<string, Counts>, key: string, value: Counts): void {
  const counts = groups.get(key) ?? emptyCounts();
  addCounts(counts, value);
  groups.set(key, counts);
}

function addCounts(target: Counts, value: Counts): void {
  target.cases += value.cases;
  target.expected += value.expected;
  target.predicted += value.predicted;
  target.truePositive += value.truePositive;
  target.falsePositive += value.falsePositive;
  target.falseNegative += value.falseNegative;
  target.statusCorrect += value.statusCorrect;
}

function finalize(counts: Counts): AstDiffMetrics {
  const perfectNegative = counts.expected === 0 && counts.predicted === 0;
  const precision =
    counts.predicted > 0 ? counts.truePositive / counts.predicted : perfectNegative ? 1 : 0;
  const recall = counts.expected > 0 ? counts.truePositive / counts.expected : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    ...counts,
    precision,
    recall,
    f1,
    statusAccuracy:
      counts.truePositive > 0
        ? counts.statusCorrect / counts.truePositive
        : perfectNegative
          ? 1
          : 0,
  };
}

function finalizeGroups(groups: Map<string, Counts>): Record<string, AstDiffMetrics> {
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, finalize(value)]),
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${path} must be an object`);
  return value;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${path} must be a non-empty string`);
  return value;
}

function finiteNumberAt(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${path} must be a finite number`);
  return value;
}

function finiteOptional(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
