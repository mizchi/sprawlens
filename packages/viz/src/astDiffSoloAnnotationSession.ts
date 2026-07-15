import type { SoloAstDiffAnnotationSheet, SoloAstDiffDecision } from "./astDiffSoloAnnotation.ts";

export type SoloAstDiffAnnotationProgress = {
  cases: number;
  reviewedCases: number;
  symbols: number;
  classifiedSymbols: number;
  complete: boolean;
  nextAlias: string | null;
};

export type StartSoloAstDiffAnnotationSessionInput = {
  annotatorId: string;
  startedOn: string;
  predictionsNotInspected: boolean;
  otherPassNotInspected: boolean;
};

export type UpdateSoloAstDiffAnnotationCaseInput = {
  alias: string;
  decisions: SoloAstDiffDecision[];
  notes: string;
  reviewed: boolean;
};

/** Start one blinded pass while recording the annotator's explicit declarations. */
export function startSoloAstDiffAnnotationSession(
  sheet: SoloAstDiffAnnotationSheet,
  input: StartSoloAstDiffAnnotationSessionInput,
): SoloAstDiffAnnotationSheet {
  validateSheetShape(sheet);
  if (sheet.annotation.completedOn !== null) throw new Error("annotation pass is completed");
  if (!input.predictionsNotInspected) {
    throw new Error("annotator must confirm predictions were not inspected");
  }
  if (!input.otherPassNotInspected) {
    throw new Error("annotator must confirm the other pass was not inspected");
  }
  const annotatorId = input.annotatorId.trim();
  if (!annotatorId) throw new Error("annotatorId must be a non-empty string");
  if (annotatorId.length > 120) throw new Error("annotatorId must be at most 120 characters");
  validateDate(input.startedOn, "startedOn");

  if (sheet.annotation.startedOn !== null) {
    if (
      sheet.annotation.annotatorId !== annotatorId ||
      sheet.annotation.predictionsInspected !== false ||
      sheet.annotation.otherPassInspectedDuringAnnotation !== false
    ) {
      throw new Error("annotation pass was already started with different metadata");
    }
    return structuredClone(sheet);
  }

  const output = structuredClone(sheet);
  output.annotation = {
    annotatorId,
    startedOn: input.startedOn,
    completedOn: null,
    predictionsInspected: false,
    otherPassInspectedDuringAnnotation: false,
  };
  return output;
}

/** Replace only the decisions and notes for one opaque case alias. */
export function updateSoloAstDiffAnnotationCase(
  sheet: SoloAstDiffAnnotationSheet,
  input: UpdateSoloAstDiffAnnotationCaseInput,
): SoloAstDiffAnnotationSheet {
  validateEditableSheet(sheet);
  if (typeof input.notes !== "string") throw new Error("notes must be a string");
  if (input.notes.length > 10_000) throw new Error("notes must be at most 10000 characters");
  if (typeof input.reviewed !== "boolean") throw new Error("reviewed must be a boolean");
  if (!Array.isArray(input.decisions)) throw new Error("decisions must be an array");

  const caseIndex = sheet.cases.findIndex((item) => item.alias === input.alias);
  if (caseIndex === -1) throw new Error(`unknown case alias: ${input.alias}`);
  const current = sheet.cases[caseIndex]!;
  if (input.decisions.length !== current.decisions.length) {
    throw new Error(
      `${input.alias}: decision count mismatch; expected ${current.decisions.length}, received ${input.decisions.length}`,
    );
  }
  for (const [index, decision] of input.decisions.entries()) {
    if (!isDecision(decision)) {
      throw new Error(`${input.alias}: invalid decision at index ${index}`);
    }
  }

  const output = structuredClone(sheet);
  output.cases[caseIndex] = {
    alias: current.alias,
    reviewed: input.reviewed,
    decisions: current.decisions.map((entry, index) => ({
      symbol: structuredClone(entry.symbol),
      decision: input.decisions[index]!,
    })),
    notes: input.notes,
  };
  return output;
}

/** Seal the working sheet only after every case received an explicit review. */
export function completeSoloAstDiffAnnotationSession(
  sheet: SoloAstDiffAnnotationSheet,
  completedOn: string,
): SoloAstDiffAnnotationSheet {
  validateEditableSheet(sheet);
  validateDate(completedOn, "completedOn");
  if (sheet.cases.some((item) => !item.reviewed)) {
    throw new Error("annotation pass still contains unreviewed cases");
  }
  const startedOn = sheet.annotation.startedOn!;
  if (completedOn < startedOn) throw new Error("completedOn precedes startedOn");
  const output = structuredClone(sheet);
  output.annotation.completedOn = completedOn;
  return output;
}

export function getSoloAstDiffAnnotationProgress(
  sheet: SoloAstDiffAnnotationSheet,
): SoloAstDiffAnnotationProgress {
  validateSheetShape(sheet);
  let reviewedCases = 0;
  let symbols = 0;
  let classifiedSymbols = 0;
  let nextAlias: string | null = null;
  for (const item of sheet.cases) {
    if (item.reviewed) reviewedCases += 1;
    else nextAlias ??= item.alias;
    symbols += item.decisions.length;
    classifiedSymbols += item.decisions.filter(({ decision }) => decision !== "none").length;
  }
  return {
    cases: sheet.cases.length,
    reviewedCases,
    symbols,
    classifiedSymbols,
    complete: sheet.annotation.completedOn !== null,
    nextAlias,
  };
}

function validateEditableSheet(sheet: SoloAstDiffAnnotationSheet): void {
  validateSheetShape(sheet);
  if (sheet.annotation.completedOn !== null) throw new Error("annotation pass is completed");
  if (!sheet.annotation.annotatorId || !sheet.annotation.startedOn) {
    throw new Error("annotation pass has not started");
  }
  if (sheet.annotation.predictionsInspected !== false) {
    throw new Error("annotation pass is not prediction-blind");
  }
  if (sheet.annotation.otherPassInspectedDuringAnnotation !== false) {
    throw new Error("annotation pass inspected the other pass");
  }
  validateDate(sheet.annotation.startedOn, "startedOn");
}

function validateSheetShape(sheet: SoloAstDiffAnnotationSheet): void {
  if (!sheet || typeof sheet !== "object") throw new Error("annotation sheet must be an object");
  if (sheet.schemaVersion !== 1) throw new Error("annotation schemaVersion must be 1");
  if (sheet.passId !== "A" && sheet.passId !== "B") throw new Error("invalid annotation passId");
  if (sheet.predictionBlind !== true) throw new Error("annotation sheet must be prediction-blind");
  if (!Array.isArray(sheet.cases)) throw new Error("annotation cases must be an array");
  const aliases = new Set<string>();
  for (const item of sheet.cases) {
    if (!item.alias || aliases.has(item.alias)) throw new Error("case aliases must be unique");
    aliases.add(item.alias);
    if (!Array.isArray(item.decisions))
      throw new Error(`${item.alias}: decisions must be an array`);
    for (const entry of item.decisions) {
      if (!isDecision(entry.decision)) throw new Error(`${item.alias}: invalid stored decision`);
      if (!entry.symbol?.kind || !entry.symbol.name) {
        throw new Error(`${item.alias}: invalid symbol selector`);
      }
    }
    if (typeof item.reviewed !== "boolean") throw new Error(`${item.alias}: invalid reviewed flag`);
    if (typeof item.notes !== "string") throw new Error(`${item.alias}: invalid notes`);
  }
}

function isDecision(value: unknown): value is SoloAstDiffDecision {
  return value === "none" || value === "added" || value === "modified";
}

function validateDate(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} is not a valid date`);
  }
}
