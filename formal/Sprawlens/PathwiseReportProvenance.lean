import Sprawlens.PathwiseErrorValidity

namespace Sprawlens.PathwiseReportProvenance

open ApproximateWeightedNormalization
open PathwiseErrorValidity
open PathwiseCertificateIncompleteness
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment
open ReachablePathwiseStrictWitness

universe u

/-- Mode-indexed evidence that the error fields in a report are the costs of
the paths named by that report. One-sided reports expose only the path whose
error is used by their decision rule; the unused field is definitionally 0. -/
inductive PathwiseErrorEvidence
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) : PathwiseReliabilityReport Edit → Type u where
  | twoSided
      {selectedTarget bestTarget : List Edit}
      {margin selectedError comparisonError : ℝ}
      {selectedCount comparisonCount : Nat}
      (selectedPath : WeightedTracePath Independent errorCost
        selectedCount selectedError source selectedTarget)
      (comparisonPath : WeightedTracePath Independent errorCost
        comparisonCount comparisonError source bestTarget) :
      PathwiseErrorEvidence Independent errorCost source
        (twoSidedReport selectedTarget bestTarget margin
          selectedError comparisonError)
  | overestimate
      {selectedTarget bestTarget : List Edit}
      {margin comparisonError : ℝ} {comparisonCount : Nat}
      (comparisonPath : WeightedTracePath Independent errorCost
        comparisonCount comparisonError source bestTarget) :
      PathwiseErrorEvidence Independent errorCost source
        (overestimateReport selectedTarget bestTarget margin comparisonError)
  | underestimate
      {selectedTarget bestTarget : List Edit}
      {margin selectedError : ℝ} {selectedCount : Nat}
      (selectedPath : WeightedTracePath Independent errorCost
        selectedCount selectedError source selectedTarget) :
      PathwiseErrorEvidence Independent errorCost source
        (underestimateReport selectedTarget bestTarget margin selectedError)

/-- A report with both the approximation contract and mode-appropriate path
provenance. This is the certificate type to expose across a trusted boundary. -/
structure ProvenancedPathwiseReliabilityReport
    (Edit : Type u) (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) where
  report : PathwiseReliabilityReport Edit
  within : PrimitiveSwapCostWithinBy
    Independent exactCost approximateCost errorCost
  evidence : PathwiseErrorEvidence Independent errorCost source report

/-- Path provenance plus `WithinBy` is sufficient to construct the weaker
nonnegativity-validated API object without trusting stored scalar errors. -/
def PathwiseErrorEvidence.toValidated
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit} {report : PathwiseReliabilityReport Edit}
    (evidence : PathwiseErrorEvidence Independent errorCost source report)
    (within : PrimitiveSwapCostWithinBy Independent exactCost
      approximateCost errorCost) : ValidatedPathwiseReliabilityReport Edit :=
  match evidence with
  | .twoSided selectedPath comparisonPath =>
      validatedTwoSidedReportOfPaths Independent exactCost approximateCost
        errorCost within selectedPath comparisonPath report.margin
  | .overestimate comparisonPath =>
      validatedOverestimateReportOfPath Independent exactCost approximateCost
        errorCost within report.selectedTarget comparisonPath report.margin
  | .underestimate selectedPath =>
      validatedUnderestimateReportOfPath Independent exactCost approximateCost
        errorCost within selectedPath report.bestTarget report.margin

def ProvenancedPathwiseReliabilityReport.toValidated
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source) :
    ValidatedPathwiseReliabilityReport Edit :=
  certificate.evidence.toValidated certificate.within

theorem ProvenancedPathwiseReliabilityReport.toValidated_report
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source) :
    certificate.toValidated.report = certificate.report := by
  rcases certificate with ⟨report, within, evidence⟩
  cases evidence <;>
    simp [ProvenancedPathwiseReliabilityReport.toValidated,
      PathwiseErrorEvidence.toValidated,
      validatedTwoSidedReportOfPaths,
      validatedOverestimateReportOfPath,
      validatedUnderestimateReportOfPath,
      twoSidedReport, overestimateReport, underestimateReport]

theorem ProvenancedPathwiseReliabilityReport.toValidated_verdict
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source) :
    certificate.toValidated.verdict = certificate.report.verdict := by
  rw [ValidatedPathwiseReliabilityReport.verdict,
    certificate.toValidated_report]

theorem ProvenancedPathwiseReliabilityReport.requiredError_nonnegative
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source) :
    0 ≤ certificate.report.requiredError := by
  rw [← certificate.toValidated_report]
  exact certificate.toValidated.requiredError_nonnegative

/-- The strict reachable-component witness carries the exact comparison path
whose zero error appears in its certified report. -/
def componentProvenancedReport : ProvenancedPathwiseReliabilityReport
    NontrivialEdit NontrivialIndependent nontrivialExactCost
    componentApproximateCost componentErrorCost nontrivialSource where
  report := componentCertifiedReport
  within := component_costs_withinBy
  evidence := PathwiseErrorEvidence.overestimate component_bestErrorPath

theorem componentProvenancedReport_verdict :
    componentProvenancedReport.report.verdict = .certifiedStable :=
  componentCertifiedReport_verdict

/-- The boundary witness also carries genuine path provenance while remaining
inconclusive, so provenance validation does not overstate certificate power. -/
def boundaryProvenancedReport : ProvenancedPathwiseReliabilityReport
    NontrivialEdit NontrivialIndependent nontrivialExactCost
    boundaryApproximateCost boundaryErrorCost nontrivialSource where
  report := boundaryInconclusiveReport
  within := boundary_costs_withinBy
  evidence := PathwiseErrorEvidence.overestimate boundary_bestErrorPath

theorem boundaryProvenancedReport_verdict :
    boundaryProvenancedReport.report.verdict = .inconclusive :=
  boundaryInconclusiveReport_verdict

/-- The raw negative-error forgery cannot be equipped with path provenance
under any admissible approximation contract. -/
theorem rawNegativeErrorReport_has_no_provenance
    (Independent : Bool → Bool → Prop)
    (exactCost approximateCost errorCost :
      List Bool → List Bool → Bool → Bool → ℝ)
    (source : List Bool) :
    ¬∃ certificate : ProvenancedPathwiseReliabilityReport Bool Independent
        exactCost approximateCost errorCost source,
      certificate.report = rawNegativeErrorReport := by
  rintro ⟨certificate, reportEq⟩
  have selectedNonnegative :
      0 ≤ certificate.toValidated.report.selectedError :=
    certificate.toValidated.selectedErrorNonnegative
  have comparisonNonnegative :
      0 ≤ certificate.toValidated.report.comparisonError :=
    certificate.toValidated.comparisonErrorNonnegative
  apply rawNegativeErrorReport_cannot_be_validated
  rw [certificate.toValidated_report, reportEq] at selectedNonnegative
  rw [certificate.toValidated_report, reportEq] at comparisonNonnegative
  exact ⟨selectedNonnegative, comparisonNonnegative⟩

end Sprawlens.PathwiseReportProvenance
