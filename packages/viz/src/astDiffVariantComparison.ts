import type { AstDiffEvaluationReport } from "./astSymbolDiffEvaluation.ts";

export type AstDiffVariantInput = {
  label: string;
  report: AstDiffEvaluationReport;
  afterSymbols: number;
};

export type AstDiffVariantComparison = {
  schemaVersion: 1;
  baseline: string;
  variants: Array<{
    label: string;
    datasetId: string;
    cases: number;
    expected: number;
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    f1: number;
    changedAfterLines: number;
    coveredAfterLines: number;
    coverage: number;
    coverageDelta: number;
    afterSymbols: number;
    afterSymbolsDelta: number;
    afterSymbolsDeltaRatio: number;
  }>;
};

export function compareAstDiffVariants(
  variants: readonly AstDiffVariantInput[],
): AstDiffVariantComparison {
  const baseline = variants[0];
  if (!baseline) throw new Error("at least one AST diff variant is required");
  if (!baseline.report.representation) {
    throw new Error(`AST diff variant ${baseline.label} has no representation metrics`);
  }
  return {
    schemaVersion: 1,
    baseline: baseline.label,
    variants: variants.map((variant) => {
      const representation = variant.report.representation?.micro;
      if (!representation) {
        throw new Error(`AST diff variant ${variant.label} has no representation metrics`);
      }
      return {
        label: variant.label,
        datasetId: variant.report.datasetId,
        cases: variant.report.micro.cases,
        expected: variant.report.micro.expected,
        truePositive: variant.report.micro.truePositive,
        falsePositive: variant.report.micro.falsePositive,
        falseNegative: variant.report.micro.falseNegative,
        f1: variant.report.micro.f1,
        changedAfterLines: representation.changedAfterLines,
        coveredAfterLines: representation.coveredAfterLines,
        coverage: representation.coverage,
        coverageDelta: representation.coverage - baseline.report.representation!.micro.coverage,
        afterSymbols: variant.afterSymbols,
        afterSymbolsDelta: variant.afterSymbols - baseline.afterSymbols,
        afterSymbolsDeltaRatio:
          baseline.afterSymbols > 0
            ? (variant.afterSymbols - baseline.afterSymbols) / baseline.afterSymbols
            : 0,
      };
    }),
  };
}
