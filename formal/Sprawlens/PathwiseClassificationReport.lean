import Sprawlens.PathwiseReportProvenance
import Sprawlens.PathwiseTargetReliability

namespace Sprawlens.PathwiseClassificationReport

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PathwiseCertificateIncompleteness
open PathwiseNontrivialImprovementWitness
open PathwiseReportProvenance
open PathwiseReliabilityVerdict
open PathwiseTargetReliability
open PositiveCostAttainment
open ReachablePathwiseStrictWitness
open TargetReliabilityClassification

universe u

/-- End-to-end result of turning a competing-target classification into a
pathwise report. The selected target comes from the approximate search, while
the comparison target and margin come from the exact classifier. -/
structure ClassifiedProvenancedPathwiseReport
    (Edit : Type u) [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) (result : TargetMarginResult Edit) where
  certificate : ProvenancedPathwiseReliabilityReport Edit Independent
    exactCost approximateCost errorCost source
  selectedApproximateCost : ℝ
  searchResult : dijkstraSearch Independent approximateCost Normal source =
    some (selectedApproximateCost, certificate.report.selectedTarget)
  selectedNormal : Normal certificate.report.selectedTarget
  bestTarget_eq : certificate.report.bestTarget = result.bestTarget
  margin_eq : certificate.report.margin = result.margin
  certified_target_eq :
    certificate.report.verdict = .certifiedStable →
      certificate.report.selectedTarget = certificate.report.bestTarget

theorem ClassifiedProvenancedPathwiseReport.selectedTarget_eq_bestTarget
    {Edit : Type u} [DecidableEq Edit]
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {Normal : List Edit → Prop} [DecidablePred Normal]
    {source : List Edit} {result : TargetMarginResult Edit}
    (classifiedReport : ClassifiedProvenancedPathwiseReport Edit Independent
      exactCost approximateCost errorCost Normal source result)
    (certified : classifiedReport.certificate.report.verdict =
      .certifiedStable) :
    classifiedReport.certificate.report.selectedTarget =
      result.bestTarget := by
  rw [classifiedReport.certified_target_eq certified,
    classifiedReport.bestTarget_eq]

theorem ClassifiedProvenancedPathwiseReport.search_returns_best_of_certified
    {Edit : Type u} [DecidableEq Edit]
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {Normal : List Edit → Prop} [DecidablePred Normal]
    {source : List Edit} {result : TargetMarginResult Edit}
    (classifiedReport : ClassifiedProvenancedPathwiseReport Edit Independent
      exactCost approximateCost errorCost Normal source result)
    (certified : classifiedReport.certificate.report.verdict =
      .certifiedStable) :
    dijkstraSearch Independent approximateCost Normal source =
      some (classifiedReport.selectedApproximateCost, result.bestTarget) := by
  rw [classifiedReport.searchResult,
    classifiedReport.selectedTarget_eq_bestTarget certified]

/-- The two-sided classifier output is directly compilable to a report whose
two stored errors are backed by the selected and exact-best error paths. -/
theorem competingClassificationTwoSided_hasProvenancedReport
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result) :
    Nonempty (ClassifiedProvenancedPathwiseReport Edit Independent exactCost
      approximateCost errorCost Normal source result) := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedError, selectedTarget, bestComparisonCount,
      bestComparisonExactCost, bestComparisonApproximateCost, bestError,
      selectedSearchEq, selectedNormal, selectedCountLt,
      selectedApproximatePath, selectedExactPath, selectedErrorPath,
      bestComparisonExactPath, bestComparisonApproximatePath,
      bestErrorPath, bestComparisonCountLt, bestComparisonCostLe,
      selectedLe, stable⟩ :=
    competingClassification_twoSidedPathwiseCertificate Independent
      exactCost approximateCost errorCost Normal within exactNonnegative
      approximateNonnegative source classified
  let report := twoSidedReport selectedTarget result.bestTarget result.margin
    selectedError bestError
  let certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source := {
    report
    within
    evidence := PathwiseErrorEvidence.twoSided selectedErrorPath bestErrorPath
  }
  exact ⟨{
      certificate
      selectedApproximateCost
      searchResult := by
        simpa [certificate, report, twoSidedReport] using selectedSearchEq
      selectedNormal := by
        simpa [certificate, report, twoSidedReport] using selectedNormal
      bestTarget_eq := by simp [certificate, report, twoSidedReport]
      margin_eq := by simp [certificate, report, twoSidedReport]
      certified_target_eq := by
        intro certified
        apply stable
        exact (twoSidedReport_certified_iff selectedTarget result.bestTarget
          result.margin selectedError bestError).mp
          (by simpa [certificate, report] using certified)
    }⟩

/-- Under pointwise overestimation, only the exact-best comparison error path
is retained in the generated report. -/
theorem competingClassificationOverestimate_hasProvenancedReport
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result) :
    Nonempty (ClassifiedProvenancedPathwiseReport Edit Independent exactCost
      approximateCost errorCost Normal source result) := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedTarget, bestComparisonCount, bestComparisonExactCost,
      bestComparisonApproximateCost, bestError, selectedSearchEq,
      selectedNormal, selectedCountLt, selectedApproximatePath,
      selectedExactPath, bestComparisonExactPath,
      bestComparisonApproximatePath, bestErrorPath, bestComparisonCountLt,
      bestComparisonCostLe, selectedLe, stable⟩ :=
    competingClassification_overestimatePathwiseCertificate Independent
      exactCost approximateCost errorCost Normal within overestimate
      exactNonnegative approximateNonnegative source classified
  let report := overestimateReport selectedTarget result.bestTarget
    result.margin bestError
  let certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source := {
    report
    within
    evidence := PathwiseErrorEvidence.overestimate bestErrorPath
  }
  exact ⟨{
      certificate
      selectedApproximateCost
      searchResult := by
        simpa [certificate, report, overestimateReport] using selectedSearchEq
      selectedNormal := by
        simpa [certificate, report, overestimateReport] using selectedNormal
      bestTarget_eq := by simp [certificate, report, overestimateReport]
      margin_eq := by simp [certificate, report, overestimateReport]
      certified_target_eq := by
        intro certified
        apply stable
        exact (overestimateReport_certified_iff selectedTarget result.bestTarget
          result.margin bestError).mp
          (by simpa [certificate, report] using certified)
    }⟩

/-- Under pointwise underestimation, only the selected search path's error is
retained in the generated report. -/
theorem competingClassificationUnderestimate_hasProvenancedReport
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result) :
    Nonempty (ClassifiedProvenancedPathwiseReport Edit Independent exactCost
      approximateCost errorCost Normal source result) := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedError, selectedTarget, selectedSearchEq, selectedNormal,
      selectedCountLt, selectedApproximatePath, selectedExactPath,
      selectedErrorPath, selectedLe, stable⟩ :=
    competingClassification_underestimatePathwiseCertificate Independent
      exactCost approximateCost errorCost Normal within underestimate
      exactNonnegative approximateNonnegative source classified
  let report := underestimateReport selectedTarget result.bestTarget
    result.margin selectedError
  let certificate : ProvenancedPathwiseReliabilityReport Edit Independent
      exactCost approximateCost errorCost source := {
    report
    within
    evidence := PathwiseErrorEvidence.underestimate selectedErrorPath
  }
  exact ⟨{
      certificate
      selectedApproximateCost
      searchResult := by
        simpa [certificate, report, underestimateReport] using selectedSearchEq
      selectedNormal := by
        simpa [certificate, report, underestimateReport] using selectedNormal
      bestTarget_eq := by simp [certificate, report, underestimateReport]
      margin_eq := by simp [certificate, report, underestimateReport]
      certified_target_eq := by
        intro certified
        apply stable
        exact (underestimateReport_certified_iff selectedTarget result.bestTarget
          result.margin selectedError).mp
          (by simpa [certificate, report] using certified)
    }⟩

/-- Concrete certified instance of the end-to-end classified report contract
on the reachable-component strictness witness. -/
def componentClassifiedReport : ClassifiedProvenancedPathwiseReport
    NontrivialEdit NontrivialIndependent nontrivialExactCost
    componentApproximateCost componentErrorCost NontrivialNormal
    nontrivialSource nontrivialMarginResult where
  certificate := componentProvenancedReport
  selectedApproximateCost := 1
  searchResult := by
    simpa [componentProvenancedReport, componentCertifiedReport,
      overestimateReport] using component_approximate_dijkstraSearch
  selectedNormal := by
    simp [componentProvenancedReport, componentCertifiedReport,
      overestimateReport, NontrivialNormal]
  bestTarget_eq := by rfl
  margin_eq := by rfl
  certified_target_eq := by intro; rfl

theorem componentClassifiedReport_certified :
    componentClassifiedReport.certificate.report.verdict =
      .certifiedStable :=
  componentProvenancedReport_verdict

theorem componentClassifiedReport_search_returns_best :
    dijkstraSearch NontrivialIndependent componentApproximateCost
      NontrivialNormal nontrivialSource =
        some (componentClassifiedReport.selectedApproximateCost,
          nontrivialMarginResult.bestTarget) :=
  componentClassifiedReport.search_returns_best_of_certified
    componentClassifiedReport_certified

/-- Concrete incompleteness boundary: all provenance and classification
fields are valid, the verdict is inconclusive, yet search still returns the
exact classifier's best target. -/
def boundaryClassifiedReport : ClassifiedProvenancedPathwiseReport
    NontrivialEdit NontrivialIndependent nontrivialExactCost
    boundaryApproximateCost boundaryErrorCost NontrivialNormal
    nontrivialSource nontrivialMarginResult where
  certificate := boundaryProvenancedReport
  selectedApproximateCost := 2
  searchResult := by
    simpa [boundaryProvenancedReport, boundaryInconclusiveReport,
      overestimateReport] using boundary_approximate_dijkstraSearch
  selectedNormal := by
    simp [boundaryProvenancedReport, boundaryInconclusiveReport,
      overestimateReport, NontrivialNormal]
  bestTarget_eq := by rfl
  margin_eq := by rfl
  certified_target_eq := by intro; rfl

theorem boundaryClassifiedReport_inconclusive :
    boundaryClassifiedReport.certificate.report.verdict = .inconclusive :=
  boundaryProvenancedReport_verdict

theorem boundaryClassifiedReport_search_still_returns_best :
    dijkstraSearch NontrivialIndependent boundaryApproximateCost
      NontrivialNormal nontrivialSource =
        some (boundaryClassifiedReport.selectedApproximateCost,
          nontrivialMarginResult.bestTarget) := by
  simpa [boundaryClassifiedReport, nontrivialMarginResult] using
    boundary_approximate_dijkstraSearch

end Sprawlens.PathwiseClassificationReport
