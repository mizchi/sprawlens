import Sprawlens.PathwiseCertificateIncompleteness

namespace Sprawlens.PathwiseReliabilityVerdict

open DijkstraInvariant
open PathwiseCertificateIncompleteness
open PathwiseNontrivialImprovementWitness
open ReachablePathwiseStrictWitness

universe u

inductive PathwiseApproximationMode where
  | twoSided
  | overestimate
  | underestimate
deriving DecidableEq

/-- Deliberately no `unstable` constructor: failure of a sufficient
certificate is epistemically inconclusive. -/
inductive ReliabilityVerdict where
  | certifiedStable
  | inconclusive
deriving DecidableEq

structure PathwiseReliabilityReport (Edit : Type u) where
  mode : PathwiseApproximationMode
  selectedTarget : List Edit
  bestTarget : List Edit
  margin : ℝ
  selectedError : ℝ
  comparisonError : ℝ

def PathwiseReliabilityReport.requiredError
    {Edit : Type u} (report : PathwiseReliabilityReport Edit) : ℝ :=
  match report.mode with
  | .twoSided => report.selectedError + report.comparisonError
  | .overestimate => report.comparisonError
  | .underestimate => report.selectedError

noncomputable def PathwiseReliabilityReport.verdict
    {Edit : Type u} (report : PathwiseReliabilityReport Edit) :
    ReliabilityVerdict :=
  if report.requiredError < report.margin
  then .certifiedStable
  else .inconclusive

theorem PathwiseReliabilityReport.verdict_eq_certifiedStable_iff
    {Edit : Type u} (report : PathwiseReliabilityReport Edit) :
    report.verdict = .certifiedStable ↔
      report.requiredError < report.margin := by
  by_cases certified : report.requiredError < report.margin <;>
    simp [PathwiseReliabilityReport.verdict, certified]

theorem PathwiseReliabilityReport.verdict_eq_inconclusive_iff
    {Edit : Type u} (report : PathwiseReliabilityReport Edit) :
    report.verdict = .inconclusive ↔
      ¬report.requiredError < report.margin := by
  by_cases certified : report.requiredError < report.margin <;>
    simp [PathwiseReliabilityReport.verdict, certified]

def twoSidedReport {Edit : Type u}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError : ℝ) :
    PathwiseReliabilityReport Edit where
  mode := .twoSided
  selectedTarget
  bestTarget
  margin
  selectedError
  comparisonError

def overestimateReport {Edit : Type u}
    (selectedTarget bestTarget : List Edit)
    (margin comparisonError : ℝ) :
    PathwiseReliabilityReport Edit where
  mode := .overestimate
  selectedTarget
  bestTarget
  margin
  selectedError := 0
  comparisonError

def underestimateReport {Edit : Type u}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError : ℝ) :
    PathwiseReliabilityReport Edit where
  mode := .underestimate
  selectedTarget
  bestTarget
  margin
  selectedError
  comparisonError := 0

theorem twoSidedReport_certified_iff
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError : ℝ) :
    (twoSidedReport selectedTarget bestTarget margin
        selectedError comparisonError).verdict = .certifiedStable ↔
      selectedError + comparisonError < margin := by
  rw [PathwiseReliabilityReport.verdict_eq_certifiedStable_iff]
  rfl

theorem overestimateReport_certified_iff
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin comparisonError : ℝ) :
    (overestimateReport selectedTarget bestTarget margin
        comparisonError).verdict = .certifiedStable ↔
      comparisonError < margin := by
  rw [PathwiseReliabilityReport.verdict_eq_certifiedStable_iff]
  rfl

theorem underestimateReport_certified_iff
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError : ℝ) :
    (underestimateReport selectedTarget bestTarget margin
        selectedError).verdict = .certifiedStable ↔
      selectedError < margin := by
  rw [PathwiseReliabilityReport.verdict_eq_certifiedStable_iff]
  rfl

theorem twoSidedReport_target_eq_of_certified
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError : ℝ)
    (stable : selectedError + comparisonError < margin →
      selectedTarget = bestTarget)
    (certified : (twoSidedReport selectedTarget bestTarget margin
      selectedError comparisonError).verdict = .certifiedStable) :
    selectedTarget = bestTarget :=
  stable ((twoSidedReport_certified_iff selectedTarget bestTarget
    margin selectedError comparisonError).mp certified)

theorem overestimateReport_target_eq_of_certified
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin comparisonError : ℝ)
    (stable : comparisonError < margin → selectedTarget = bestTarget)
    (certified : (overestimateReport selectedTarget bestTarget margin
      comparisonError).verdict = .certifiedStable) :
    selectedTarget = bestTarget :=
  stable ((overestimateReport_certified_iff selectedTarget bestTarget
    margin comparisonError).mp certified)

theorem underestimateReport_target_eq_of_certified
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError : ℝ)
    (stable : selectedError < margin → selectedTarget = bestTarget)
    (certified : (underestimateReport selectedTarget bestTarget margin
      selectedError).verdict = .certifiedStable) :
    selectedTarget = bestTarget :=
  stable ((underestimateReport_certified_iff selectedTarget bestTarget
    margin selectedError).mp certified)

def componentCertifiedReport :
    PathwiseReliabilityReport NontrivialEdit :=
  overestimateReport nontrivialBest nontrivialBest
    nontrivialMarginResult.margin 0

theorem componentCertifiedReport_verdict :
    componentCertifiedReport.verdict = .certifiedStable := by
  unfold componentCertifiedReport
  rw [overestimateReport_certified_iff]
  norm_num [nontrivialMarginResult]

theorem componentCertifiedReport_matches_search :
    dijkstraSearch NontrivialIndependent componentApproximateCost
      NontrivialNormal nontrivialSource =
        some (1, componentCertifiedReport.selectedTarget) := by
  simpa [componentCertifiedReport, overestimateReport] using
    component_approximate_dijkstraSearch

def boundaryInconclusiveReport :
    PathwiseReliabilityReport NontrivialEdit :=
  overestimateReport nontrivialBest nontrivialBest
    nontrivialMarginResult.margin 1

theorem boundaryInconclusiveReport_verdict :
    boundaryInconclusiveReport.verdict = .inconclusive := by
  rw [PathwiseReliabilityReport.verdict_eq_inconclusive_iff]
  norm_num [boundaryInconclusiveReport, overestimateReport,
    PathwiseReliabilityReport.requiredError, nontrivialMarginResult]

theorem boundaryInconclusiveReport_matches_preserved_search :
    dijkstraSearch NontrivialIndependent boundaryApproximateCost
      NontrivialNormal nontrivialSource =
        some (2, boundaryInconclusiveReport.selectedTarget) ∧
      boundaryInconclusiveReport.selectedTarget =
        boundaryInconclusiveReport.bestTarget := by
  constructor
  · simpa [boundaryInconclusiveReport, overestimateReport] using
      boundary_approximate_dijkstraSearch
  · rfl

/-- Concrete counterexample to treating `inconclusive` as `unstable`. -/
theorem inconclusive_does_not_imply_target_changed :
    ∃ report : PathwiseReliabilityReport NontrivialEdit,
      report.verdict = .inconclusive ∧
      report.selectedTarget = report.bestTarget := by
  exact ⟨boundaryInconclusiveReport,
    boundaryInconclusiveReport_verdict, rfl⟩

end Sprawlens.PathwiseReliabilityVerdict
