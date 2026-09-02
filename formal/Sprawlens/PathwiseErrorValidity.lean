import Sprawlens.PathwiseReliabilityVerdict

namespace Sprawlens.PathwiseErrorValidity

open ApproximateWeightedNormalization
open PathwiseCertificateIncompleteness
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- Any admissible error budget in a `WithinBy` contract is automatically
nonnegative because it bounds an absolute value. -/
theorem PrimitiveSwapCostWithinBy.errorCost_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost) :
    PrimitiveSwapCostLowerBound Independent errorCost 0 := by
  intro before after first second independent
  exact le_trans (abs_nonneg _) (within before after first second independent)

theorem WeightedSwapStep.errorCost_nonnegative_of_withinBy
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    {edgeError : ℝ} {source target : List Edit}
    (edge : WeightedSwapStep Independent errorCost
      edgeError source target) :
    0 ≤ edgeError :=
  edge.cost_lower_bound Independent errorCost 0
    (PrimitiveSwapCostWithinBy.errorCost_nonnegative
      Independent exactCost approximateCost errorCost within)

/-- Consequently every concrete accumulated error path is nonnegative. -/
theorem WeightedTracePath.errorCost_nonnegative_of_withinBy
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    {count : Nat} {pathError : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent errorCost
      count pathError source target) :
    0 ≤ pathError := by
  have lower := path.count_mul_le_cost Independent errorCost 0
    (PrimitiveSwapCostWithinBy.errorCost_nonnegative
      Independent exactCost approximateCost errorCost within)
  simpa using lower

/-- Proof-carrying wrapper used at the API boundary. Raw report data remains
serializable, while validity cannot be forged without proving both stored
error totals nonnegative. -/
structure ValidatedPathwiseReliabilityReport (Edit : Type u) where
  report : PathwiseReliabilityReport Edit
  selectedErrorNonnegative : 0 ≤ report.selectedError
  comparisonErrorNonnegative : 0 ≤ report.comparisonError

def ValidatedPathwiseReliabilityReport.requiredError
    {Edit : Type u} (validated : ValidatedPathwiseReliabilityReport Edit) : ℝ :=
  validated.report.requiredError

noncomputable def ValidatedPathwiseReliabilityReport.verdict
    {Edit : Type u} (validated : ValidatedPathwiseReliabilityReport Edit) :
    ReliabilityVerdict :=
  validated.report.verdict

theorem ValidatedPathwiseReliabilityReport.requiredError_nonnegative
    {Edit : Type u} (validated : ValidatedPathwiseReliabilityReport Edit) :
    0 ≤ validated.requiredError := by
  cases modeEq : validated.report.mode with
  | twoSided =>
      simp [ValidatedPathwiseReliabilityReport.requiredError,
        PathwiseReliabilityReport.requiredError, modeEq,
        add_nonneg validated.selectedErrorNonnegative
          validated.comparisonErrorNonnegative]
  | overestimate =>
      simpa [ValidatedPathwiseReliabilityReport.requiredError,
        PathwiseReliabilityReport.requiredError, modeEq] using
        validated.comparisonErrorNonnegative
  | underestimate =>
      simpa [ValidatedPathwiseReliabilityReport.requiredError,
        PathwiseReliabilityReport.requiredError, modeEq] using
        validated.selectedErrorNonnegative

theorem ValidatedPathwiseReliabilityReport.verdict_eq_certifiedStable_iff
    {Edit : Type u} (validated : ValidatedPathwiseReliabilityReport Edit) :
    validated.verdict = .certifiedStable ↔
      validated.requiredError < validated.report.margin :=
  validated.report.verdict_eq_certifiedStable_iff

/-- A validated certification is impossible at zero or negative margin. -/
theorem ValidatedPathwiseReliabilityReport.margin_pos_of_certified
    {Edit : Type u} (validated : ValidatedPathwiseReliabilityReport Edit)
    (certified : validated.verdict = .certifiedStable) :
    0 < validated.report.margin := by
  have requiredBelow :=
    validated.verdict_eq_certifiedStable_iff.mp certified
  exact lt_of_le_of_lt validated.requiredError_nonnegative requiredBelow

theorem ValidatedPathwiseReliabilityReport.inconclusive_of_margin_nonpositive
    {Edit : Type u} (validated : ValidatedPathwiseReliabilityReport Edit)
    (marginNonpositive : validated.report.margin ≤ 0) :
    validated.verdict = .inconclusive := by
  rw [ValidatedPathwiseReliabilityReport.verdict,
    PathwiseReliabilityReport.verdict_eq_inconclusive_iff]
  exact not_lt_of_ge
    (le_trans marginNonpositive validated.requiredError_nonnegative)

def validatedTwoSidedReportOfPaths
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    {selectedCount comparisonCount : Nat}
    {selectedError comparisonError : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent errorCost
      selectedCount selectedError source selectedTarget)
    (comparisonPath : WeightedTracePath Independent errorCost
      comparisonCount comparisonError source bestTarget)
    (margin : ℝ) : ValidatedPathwiseReliabilityReport Edit where
  report := twoSidedReport selectedTarget bestTarget margin
    selectedError comparisonError
  selectedErrorNonnegative :=
    WeightedTracePath.errorCost_nonnegative_of_withinBy
      Independent exactCost approximateCost errorCost within selectedPath
  comparisonErrorNonnegative :=
    WeightedTracePath.errorCost_nonnegative_of_withinBy
      Independent exactCost approximateCost errorCost within comparisonPath

def validatedOverestimateReportOfPath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (selectedTarget : List Edit)
    {comparisonCount : Nat} {comparisonError : ℝ}
    {source bestTarget : List Edit}
    (comparisonPath : WeightedTracePath Independent errorCost
      comparisonCount comparisonError source bestTarget)
    (margin : ℝ) : ValidatedPathwiseReliabilityReport Edit where
  report := overestimateReport selectedTarget bestTarget margin comparisonError
  selectedErrorNonnegative := le_refl 0
  comparisonErrorNonnegative :=
    WeightedTracePath.errorCost_nonnegative_of_withinBy
      Independent exactCost approximateCost errorCost within comparisonPath

def validatedUnderestimateReportOfPath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    {selectedCount : Nat} {selectedError : ℝ}
    {source selectedTarget : List Edit}
    (selectedPath : WeightedTracePath Independent errorCost
      selectedCount selectedError source selectedTarget)
    (bestTarget : List Edit) (margin : ℝ) :
    ValidatedPathwiseReliabilityReport Edit where
  report := underestimateReport selectedTarget bestTarget margin selectedError
  selectedErrorNonnegative :=
    WeightedTracePath.errorCost_nonnegative_of_withinBy
      Independent exactCost approximateCost errorCost within selectedPath
  comparisonErrorNonnegative := le_refl 0

/-- The positive-margin witness remains certified after crossing the
proof-carrying validation boundary. -/
def componentValidatedReport :
    ValidatedPathwiseReliabilityReport NontrivialEdit :=
  validatedOverestimateReportOfPath NontrivialIndependent
    nontrivialExactCost nontrivialApproximateCost nontrivialErrorCost
    nontrivial_costs_withinBy nontrivialBest nontrivial_bestErrorPath
    nontrivialMarginResult.margin

theorem componentValidatedReport_report_eq :
    componentValidatedReport.report = componentCertifiedReport := by
  rfl

theorem componentValidatedReport_verdict :
    componentValidatedReport.verdict = .certifiedStable := by
  rw [ValidatedPathwiseReliabilityReport.verdict,
    componentValidatedReport_report_eq]
  exact componentCertifiedReport_verdict

/-- The exact-margin boundary remains inconclusive after validation; error
validity does not turn a sufficient certificate into a complete one. -/
def boundaryValidatedReport :
    ValidatedPathwiseReliabilityReport NontrivialEdit :=
  validatedOverestimateReportOfPath NontrivialIndependent
    nontrivialExactCost boundaryApproximateCost boundaryErrorCost
    boundary_costs_withinBy nontrivialBest boundary_bestErrorPath
    nontrivialMarginResult.margin

theorem boundaryValidatedReport_report_eq :
    boundaryValidatedReport.report = boundaryInconclusiveReport := by
  rfl

theorem boundaryValidatedReport_verdict :
    boundaryValidatedReport.verdict = .inconclusive := by
  rw [ValidatedPathwiseReliabilityReport.verdict,
    boundaryValidatedReport_report_eq]
  exact boundaryInconclusiveReport_verdict

/-- Raw data alone can falsely certify a nonpositive margin by supplying a
negative error. This is the load-bearing counterexample for validation. -/
def rawNegativeErrorReport : PathwiseReliabilityReport Bool :=
  overestimateReport [] [] 0 (-1)

theorem rawNegativeErrorReport_falsely_certifies :
    rawNegativeErrorReport.verdict = .certifiedStable := by
  unfold rawNegativeErrorReport
  rw [overestimateReport_certified_iff]
  norm_num

theorem rawNegativeErrorReport_cannot_be_validated :
    ¬(0 ≤ rawNegativeErrorReport.selectedError ∧
      0 ≤ rawNegativeErrorReport.comparisonError) := by
  simp [rawNegativeErrorReport, overestimateReport]

end Sprawlens.PathwiseErrorValidity
