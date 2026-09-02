import Sprawlens.EncodedWeightedPathDataVerifier
import Sprawlens.PathwiseReportProvenance

namespace Sprawlens.EncodedPathwiseSerializableReport

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open PathwiseErrorValidity
open PathwiseReliabilityVerdict
open PathwiseReportProvenance
open PositiveCostAttainment

universe u v

structure AcceptedEncodedWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (source target : List Edit) (encodedPathCost : EncodedCost) where
  count : Nat
  steps : List (EncodedCost × List Edit)
  accepted : verifyEncodedWeightedPathData zero add Independent encodedCost
    source steps = some (count, encodedPathCost, target)

theorem AcceptedEncodedWeightedPathData.toWeightedTracePath
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    {decode : EncodedCost → ℝ}
    {zero : EncodedCost} {add : EncodedCost → EncodedCost → EncodedCost}
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost}
    {source target : List Edit} {encodedPathCost : EncodedCost}
    (data : AcceptedEncodedWeightedPathData zero add Independent encodedCost
      source target encodedPathCost) :
    WeightedTracePath Independent (decodePrimitiveCost decode encodedCost)
      data.count (decode encodedPathCost) source target :=
  verifyEncodedWeightedPathData_sound decode zero add decode_zero decode_add
    Independent encodedCost source data.steps data.accepted

inductive EncodedSerializablePathwiseErrorEvidence
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (decode : EncodedCost → ℝ)
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedErrorCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (source : List Edit) : PathwiseReliabilityReport Edit → Type (max u v + 1) where
  | twoSided
      {selectedTarget bestTarget : List Edit} {margin : ℝ}
      {selectedEncodedError comparisonEncodedError : EncodedCost}
      (selectedData : AcceptedEncodedWeightedPathData zero add Independent
        encodedErrorCost source selectedTarget selectedEncodedError)
      (comparisonData : AcceptedEncodedWeightedPathData zero add Independent
        encodedErrorCost source bestTarget comparisonEncodedError) :
      EncodedSerializablePathwiseErrorEvidence decode zero add Independent
        encodedErrorCost source
        (twoSidedReport selectedTarget bestTarget margin
          (decode selectedEncodedError) (decode comparisonEncodedError))
  | overestimate
      {selectedTarget bestTarget : List Edit} {margin : ℝ}
      {comparisonEncodedError : EncodedCost}
      (comparisonData : AcceptedEncodedWeightedPathData zero add Independent
        encodedErrorCost source bestTarget comparisonEncodedError) :
      EncodedSerializablePathwiseErrorEvidence decode zero add Independent
        encodedErrorCost source
        (overestimateReport selectedTarget bestTarget margin
          (decode comparisonEncodedError))
  | underestimate
      {selectedTarget bestTarget : List Edit} {margin : ℝ}
      {selectedEncodedError : EncodedCost}
      (selectedData : AcceptedEncodedWeightedPathData zero add Independent
        encodedErrorCost source selectedTarget selectedEncodedError) :
      EncodedSerializablePathwiseErrorEvidence decode zero add Independent
        encodedErrorCost source
        (underestimateReport selectedTarget bestTarget margin
          (decode selectedEncodedError))

def EncodedSerializablePathwiseErrorEvidence.toPathwiseErrorEvidence
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    {decode : EncodedCost → ℝ}
    {zero : EncodedCost} {add : EncodedCost → EncodedCost → EncodedCost}
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → EncodedCost}
    {source : List Edit} {report : PathwiseReliabilityReport Edit}
    (evidence : EncodedSerializablePathwiseErrorEvidence decode zero add
      Independent encodedErrorCost source report) :
    PathwiseErrorEvidence Independent
      (decodePrimitiveCost decode encodedErrorCost) source report :=
  match evidence with
  | .twoSided selectedData comparisonData =>
      .twoSided
        (selectedData.toWeightedTracePath decode_zero decode_add)
        (comparisonData.toWeightedTracePath decode_zero decode_add)
  | .overestimate comparisonData =>
      .overestimate
        (comparisonData.toWeightedTracePath decode_zero decode_add)
  | .underestimate selectedData =>
      .underestimate
        (selectedData.toWeightedTracePath decode_zero decode_add)

structure EncodedSerializablePathwiseReliabilityReport
    (Edit : Type u) [DecidableEq Edit]
    (EncodedCost : Type v) [DecidableEq EncodedCost]
    (decode : EncodedCost → ℝ)
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedErrorCost :
      List Edit → List Edit → Edit → Edit → EncodedCost)
    (source : List Edit) where
  report : PathwiseReliabilityReport Edit
  within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
    (decodePrimitiveCost decode encodedErrorCost)
  evidence : EncodedSerializablePathwiseErrorEvidence decode zero add
    Independent encodedErrorCost source report

def EncodedSerializablePathwiseReliabilityReport.toProvenanced
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    {decode : EncodedCost → ℝ}
    {zero : EncodedCost} {add : EncodedCost → EncodedCost → EncodedCost}
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → EncodedCost}
    {source : List Edit}
    (serializable : EncodedSerializablePathwiseReliabilityReport Edit
      EncodedCost decode zero add Independent exactCost approximateCost
      encodedErrorCost source) :
    ProvenancedPathwiseReliabilityReport Edit Independent exactCost
      approximateCost (decodePrimitiveCost decode encodedErrorCost) source where
  report := serializable.report
  within := serializable.within
  evidence := serializable.evidence.toPathwiseErrorEvidence
    decode_zero decode_add

theorem EncodedSerializablePathwiseReliabilityReport.toProvenanced_report
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    {decode : EncodedCost → ℝ}
    {zero : EncodedCost} {add : EncodedCost → EncodedCost → EncodedCost}
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → EncodedCost}
    {source : List Edit}
    (serializable : EncodedSerializablePathwiseReliabilityReport Edit
      EncodedCost decode zero add Independent exactCost approximateCost
      encodedErrorCost source) :
    (serializable.toProvenanced decode_zero decode_add).report =
      serializable.report := rfl

theorem EncodedSerializablePathwiseReliabilityReport.requiredError_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    {decode : EncodedCost → ℝ}
    {zero : EncodedCost} {add : EncodedCost → EncodedCost → EncodedCost}
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → EncodedCost}
    {source : List Edit}
    (serializable : EncodedSerializablePathwiseReliabilityReport Edit
      EncodedCost decode zero add Independent exactCost approximateCost
      encodedErrorCost source) :
    0 ≤ serializable.report.requiredError :=
  (serializable.toProvenanced decode_zero decode_add).requiredError_nonnegative

theorem rawNegativeErrorReport_has_no_encoded_serializable_evidence
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    {decode : EncodedCost → ℝ}
    {zero : EncodedCost} {add : EncodedCost → EncodedCost → EncodedCost}
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    (Independent : Bool → Bool → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Bool → List Bool → Bool → Bool → ℝ)
    (encodedErrorCost :
      List Bool → List Bool → Bool → Bool → EncodedCost)
    (source : List Bool) :
    ¬∃ serializable : EncodedSerializablePathwiseReliabilityReport Bool
        EncodedCost decode zero add Independent exactCost approximateCost
        encodedErrorCost source,
      serializable.report = rawNegativeErrorReport := by
  rintro ⟨serializable, reportEq⟩
  apply rawNegativeErrorReport_has_no_provenance Independent exactCost
    approximateCost (decodePrimitiveCost decode encodedErrorCost) source
  refine ⟨serializable.toProvenanced decode_zero decode_add, ?_⟩
  exact (serializable.toProvenanced_report decode_zero decode_add).trans
    reportEq

end Sprawlens.EncodedPathwiseSerializableReport
