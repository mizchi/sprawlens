import Sprawlens.PathwiseReportProvenance
import Sprawlens.WeightedPathDataVerifier

namespace Sprawlens.PathwiseSerializableReport

open ApproximateWeightedNormalization
open PathwiseCertificateIncompleteness
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PathwiseReportProvenance
open PositiveCostAttainment
open ReachablePathwiseStrictWitness
open WeightedPathDataVerifier

universe u

/-- Untrusted step data together with the exact aggregate result produced by
the verifier. The count, total cost, and target are outputs, not independent
claims accepted from the payload. -/
structure AcceptedWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source target : List Edit) (pathCost : ℝ) where
  count : Nat
  steps : List (ℝ × List Edit)
  accepted : verifyWeightedPathData costEq Independent swapCost source steps =
    some (count, pathCost, target)

theorem AcceptedWeightedPathData.toWeightedTracePath
    {Edit : Type u} [DecidableEq Edit]
    {costEq : ℝ → ℝ → Bool}
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {source target : List Edit} {pathCost : ℝ}
    (data : AcceptedWeightedPathData costEq Independent swapCost
      source target pathCost) :
    WeightedTracePath Independent swapCost data.count pathCost
      source target :=
  verifyWeightedPathData_sound costEq costEq_sound Independent swapCost
    source data.steps data.accepted

/-- Serializable counterpart of `PathwiseErrorEvidence`. Each mode carries
only the verified path payloads that contribute to its required error. -/
inductive SerializablePathwiseErrorEvidence
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) : PathwiseReliabilityReport Edit → Type (u + 1) where
  | twoSided
      {selectedTarget bestTarget : List Edit}
      {margin selectedError comparisonError : ℝ}
      (selectedData : AcceptedWeightedPathData costEq Independent errorCost
        source selectedTarget selectedError)
      (comparisonData : AcceptedWeightedPathData costEq Independent errorCost
        source bestTarget comparisonError) :
      SerializablePathwiseErrorEvidence costEq Independent errorCost source
        (twoSidedReport selectedTarget bestTarget margin
          selectedError comparisonError)
  | overestimate
      {selectedTarget bestTarget : List Edit}
      {margin comparisonError : ℝ}
      (comparisonData : AcceptedWeightedPathData costEq Independent errorCost
        source bestTarget comparisonError) :
      SerializablePathwiseErrorEvidence costEq Independent errorCost source
        (overestimateReport selectedTarget bestTarget margin comparisonError)
  | underestimate
      {selectedTarget bestTarget : List Edit}
      {margin selectedError : ℝ}
      (selectedData : AcceptedWeightedPathData costEq Independent errorCost
        source selectedTarget selectedError) :
      SerializablePathwiseErrorEvidence costEq Independent errorCost source
        (underestimateReport selectedTarget bestTarget margin selectedError)

def SerializablePathwiseErrorEvidence.toPathwiseErrorEvidence
    {Edit : Type u} [DecidableEq Edit]
    {costEq : ℝ → ℝ → Bool}
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {errorCost : List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit} {report : PathwiseReliabilityReport Edit}
    (evidence : SerializablePathwiseErrorEvidence costEq Independent
      errorCost source report) :
    PathwiseErrorEvidence Independent errorCost source report :=
  match evidence with
  | .twoSided selectedData comparisonData =>
      .twoSided
        (selectedData.toWeightedTracePath costEq_sound)
        (comparisonData.toWeightedTracePath costEq_sound)
  | .overestimate comparisonData =>
      .overestimate (comparisonData.toWeightedTracePath costEq_sound)
  | .underestimate selectedData =>
      .underestimate (selectedData.toWeightedTracePath costEq_sound)

/-- Report boundary suitable for a decoder/checker: the payload supplies only
step data, while the verifier fixes its count, total error, and endpoint. -/
structure SerializablePathwiseReliabilityReport
    (Edit : Type u) [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) where
  report : PathwiseReliabilityReport Edit
  within : PrimitiveSwapCostWithinBy
    Independent exactCost approximateCost errorCost
  evidence : SerializablePathwiseErrorEvidence costEq Independent
    errorCost source report

def SerializablePathwiseReliabilityReport.toProvenanced
    {Edit : Type u} [DecidableEq Edit]
    {costEq : ℝ → ℝ → Bool}
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (serializable : SerializablePathwiseReliabilityReport Edit costEq
      Independent exactCost approximateCost errorCost source) :
    ProvenancedPathwiseReliabilityReport Edit Independent exactCost
      approximateCost errorCost source where
  report := serializable.report
  within := serializable.within
  evidence := serializable.evidence.toPathwiseErrorEvidence costEq_sound

theorem SerializablePathwiseReliabilityReport.toProvenanced_report
    {Edit : Type u} [DecidableEq Edit]
    {costEq : ℝ → ℝ → Bool}
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (serializable : SerializablePathwiseReliabilityReport Edit costEq
      Independent exactCost approximateCost errorCost source) :
    (serializable.toProvenanced costEq_sound).report =
      serializable.report := rfl

theorem SerializablePathwiseReliabilityReport.requiredError_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    {costEq : ℝ → ℝ → Bool}
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {source : List Edit}
    (serializable : SerializablePathwiseReliabilityReport Edit costEq
      Independent exactCost approximateCost errorCost source) :
    0 ≤ serializable.report.requiredError :=
  (serializable.toProvenanced costEq_sound).requiredError_nonnegative

/-- Even if a decoder accepts arbitrary target lists and scalar fields, the
negative-error raw forgery cannot pass a sound step-data verifier. -/
theorem rawNegativeErrorReport_has_no_serializable_evidence
    {costEq : ℝ → ℝ → Bool}
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    (Independent : Bool → Bool → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Bool → List Bool → Bool → Bool → ℝ)
    (source : List Bool) :
    ¬∃ serializable : SerializablePathwiseReliabilityReport Bool costEq
        Independent exactCost approximateCost errorCost source,
      serializable.report = rawNegativeErrorReport := by
  rintro ⟨serializable, reportEq⟩
  apply rawNegativeErrorReport_has_no_provenance Independent exactCost
    approximateCost errorCost source
  refine ⟨serializable.toProvenanced costEq_sound, ?_⟩
  exact (serializable.toProvenanced_report costEq_sound).trans reportEq

def componentBestErrorSteps : List (ℝ × List NontrivialEdit) :=
  [(0, nontrivialBest)]

theorem componentBestErrorSteps_accepted :
    verifyWeightedPathData exactRealEq NontrivialIndependent
      componentErrorCost nontrivialSource componentBestErrorSteps =
        some (1, 0, nontrivialBest) := by
  norm_num [componentBestErrorSteps, verifyWeightedPathData,
    edgeDataAccepted, exactRealEq, weightedSwapStepChoicesList,
    weightedSwapStepChoicesListAux, NontrivialIndependent,
    componentErrorCost, nontrivialSource, nontrivialBest]

def componentBestAcceptedData : AcceptedWeightedPathData exactRealEq
    NontrivialIndependent componentErrorCost nontrivialSource
    nontrivialBest 0 where
  count := 1
  steps := componentBestErrorSteps
  accepted := componentBestErrorSteps_accepted

def componentSerializableReport : SerializablePathwiseReliabilityReport
    NontrivialEdit exactRealEq NontrivialIndependent nontrivialExactCost
    componentApproximateCost componentErrorCost nontrivialSource where
  report := componentCertifiedReport
  within := component_costs_withinBy
  evidence := SerializablePathwiseErrorEvidence.overestimate
    componentBestAcceptedData

theorem componentSerializableReport_verdict :
    componentSerializableReport.report.verdict = .certifiedStable :=
  componentCertifiedReport_verdict

theorem componentSerializableReport_toProvenanced_verdict :
    (componentSerializableReport.toProvenanced exactRealEq_sound).report.verdict =
      .certifiedStable := by
  rw [componentSerializableReport.toProvenanced_report exactRealEq_sound]
  exact componentSerializableReport_verdict

def boundaryBestErrorSteps : List (ℝ × List NontrivialEdit) :=
  [(1, nontrivialBest)]

theorem boundaryBestErrorSteps_accepted :
    verifyWeightedPathData exactRealEq NontrivialIndependent
      boundaryErrorCost nontrivialSource boundaryBestErrorSteps =
        some (1, 1, nontrivialBest) := by
  norm_num [boundaryBestErrorSteps, verifyWeightedPathData,
    edgeDataAccepted, exactRealEq, weightedSwapStepChoicesList,
    weightedSwapStepChoicesListAux, NontrivialIndependent,
    boundaryErrorCost, nontrivialSource, nontrivialBest]

def boundaryBestAcceptedData : AcceptedWeightedPathData exactRealEq
    NontrivialIndependent boundaryErrorCost nontrivialSource
    nontrivialBest 1 where
  count := 1
  steps := boundaryBestErrorSteps
  accepted := boundaryBestErrorSteps_accepted

def boundarySerializableReport : SerializablePathwiseReliabilityReport
    NontrivialEdit exactRealEq NontrivialIndependent nontrivialExactCost
    boundaryApproximateCost boundaryErrorCost nontrivialSource where
  report := boundaryInconclusiveReport
  within := boundary_costs_withinBy
  evidence := SerializablePathwiseErrorEvidence.overestimate
    boundaryBestAcceptedData

theorem boundarySerializableReport_verdict :
    boundarySerializableReport.report.verdict = .inconclusive :=
  boundaryInconclusiveReport_verdict

theorem boundarySerializableReport_toProvenanced_verdict :
    (boundarySerializableReport.toProvenanced exactRealEq_sound).report.verdict =
      .inconclusive := by
  rw [boundarySerializableReport.toProvenanced_report exactRealEq_sound]
  exact boundarySerializableReport_verdict

end Sprawlens.PathwiseSerializableReport
