import Sprawlens.FixedPointIntegerReport
import Sprawlens.FixedPointPathDataWitness

namespace Sprawlens.FixedPointSerializableIntegerReport

open ApproximateWeightedNormalization
open EncodedPathwiseSerializableReport
open EncodedWeightedPathDataVerifier
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PathwiseReportProvenance

universe u

/-- Integer-only report data paired with accepted fixed-point path payloads and
the approximation contract needed to interpret those payloads as genuine
error paths. -/
structure SerializableIntegerReliabilityReport
    (Edit : Type u) [DecidableEq Edit]
    (scale : PositiveScale)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) where
  report : IntegerReliabilityReport Edit scale
  within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
    (decodePrimitiveCost FixedPointEncodedCost.decode encodedErrorCost)
  evidence : EncodedSerializablePathwiseErrorEvidence
    FixedPointEncodedCost.decode (zero scale) FixedPointEncodedCost.add
    Independent encodedErrorCost source report.decode

noncomputable def SerializableIntegerReliabilityReport.toEncodedSerializable
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source) :
    EncodedSerializablePathwiseReliabilityReport Edit (ScaledIntCost scale)
      FixedPointEncodedCost.decode (zero scale) FixedPointEncodedCost.add
      Independent exactCost approximateCost encodedErrorCost source where
  report := serializable.report.decode
  within := serializable.within
  evidence := serializable.evidence

noncomputable def SerializableIntegerReliabilityReport.toProvenanced
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source) :
    ProvenancedPathwiseReliabilityReport Edit Independent exactCost
      approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedErrorCost)
      source :=
  serializable.toEncodedSerializable.toProvenanced
    (decode_zero scale) FixedPointEncodedCost.decode_add

@[simp] theorem SerializableIntegerReliabilityReport.toProvenanced_report
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source) :
    serializable.toProvenanced.report = serializable.report.decode := rfl

/-- Accepted path evidence plus `WithinBy` proves both integer error fields
nonnegative. The unused one-sided field is definitionally zero. -/
theorem SerializableIntegerReliabilityReport.errorsNonnegative
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source) :
    serializable.report.ErrorsNonnegative := by
  let validated := serializable.toProvenanced.toValidated
  have selectedReal : 0 ≤ serializable.report.decode.selectedError := by
    have selected := validated.selectedErrorNonnegative
    rw [serializable.toProvenanced.toValidated_report] at selected
    exact selected
  have comparisonReal :
      0 ≤ serializable.report.decode.comparisonError := by
    have comparison := validated.comparisonErrorNonnegative
    rw [serializable.toProvenanced.toValidated_report] at comparison
    exact comparison
  exact ⟨
    (Sprawlens.FixedPointIntegerReport.units_nonnegative_iff_decode_nonnegative
      serializable.report.selectedError).mpr selectedReal,
    (Sprawlens.FixedPointIntegerReport.units_nonnegative_iff_decode_nonnegative
      serializable.report.comparisonError).mpr comparisonReal⟩

theorem SerializableIntegerReliabilityReport.requiredUnits_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source) :
    0 ≤ serializable.report.requiredCost.units := by
  have valid := serializable.errorsNonnegative
  cases modeEq : serializable.report.mode with
  | twoSided =>
      simpa [IntegerReliabilityReport.requiredCost, modeEq] using
        add_nonneg valid.1 valid.2
  | overestimate =>
      simpa [IntegerReliabilityReport.requiredCost, modeEq] using valid.2
  | underestimate =>
      simpa [IntegerReliabilityReport.requiredCost, modeEq] using valid.1

/-- Integer verdict, decoded report verdict, and provenanced report verdict
are the same observation. -/
theorem SerializableIntegerReliabilityReport.verdict_eq_provenanced
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source) :
    serializable.report.verdict =
      serializable.toProvenanced.report.verdict := by
  exact serializable.report.verdict_eq_decode_verdict

/-- A serializable integer certification necessarily has a positive encoded
margin. -/
theorem SerializableIntegerReliabilityReport.marginUnits_pos_of_certified
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit}
    (serializable : SerializableIntegerReliabilityReport Edit scale
      Independent exactCost approximateCost encodedErrorCost source)
    (certified : serializable.report.verdict = .certifiedStable) :
    0 < serializable.report.margin.units := by
  exact lt_of_le_of_lt serializable.requiredUnits_nonnegative
    (serializable.report.verdict_eq_certifiedStable_iff.mp certified)

/-- The negative-unit forgery cannot cross the accepted-path/provenance
boundary under any valid fixed-point approximation contract. -/
theorem negativeIntegerForgery_has_no_serializable_provenance
    (Independent : Unit → Unit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Unit → List Unit → Unit → Unit → ℝ)
    (encodedErrorCost :
      List Unit → List Unit → Unit → Unit →
        ScaledIntCost witnessScale)
    (source : List Unit) :
    ¬∃ serializable : SerializableIntegerReliabilityReport Unit witnessScale
        Independent exactCost approximateCost encodedErrorCost source,
      serializable.report = negativeIntegerForgery := by
  rintro ⟨serializable, reportEq⟩
  apply negativeIntegerForgery_invalid
  rw [← reportEq]
  exact serializable.errorsNonnegative

def componentCanonicalAcceptedData : AcceptedEncodedWeightedPathData
    (zero milliScale) FixedPointEncodedCost.add NontrivialIndependent
    componentMilliErrorCost nontrivialSource nontrivialBest milliZero where
  count := 1
  steps := componentMilliBestSteps
  accepted := by
    norm_num [componentMilliBestSteps, verifyEncodedWeightedPathData,
      encodedEdgeDataAccepted, encodedSwapStepChoicesList,
      encodedSwapStepChoicesListAux, componentMilliErrorCost,
      FixedPointEncodedCost.add, milliZero, zero, NontrivialIndependent,
      nontrivialSource, nontrivialBest]

noncomputable def componentVerifiedIntegerReport :
    SerializableIntegerReliabilityReport NontrivialEdit milliScale
      NontrivialIndependent nontrivialExactCost
      ReachablePathwiseStrictWitness.componentApproximateCost
      componentMilliErrorCost nontrivialSource where
  report := overestimateIntegerReport nontrivialBest nontrivialBest
    (wholeMilli 1) milliZero
  within := by
    change PrimitiveSwapCostWithinBy NontrivialIndependent
      nontrivialExactCost
      ReachablePathwiseStrictWitness.componentApproximateCost
      (decodePrimitiveCost milliDecode componentMilliErrorCost)
    exact componentMilliSerializableReport.within
  evidence := by
    rw [decode_overestimateIntegerReport]
    exact EncodedSerializablePathwiseErrorEvidence.overestimate
      (decode := FixedPointEncodedCost.decode)
      (selectedTarget := nontrivialBest)
      (margin := FixedPointEncodedCost.decode (wholeMilli 1))
      componentCanonicalAcceptedData

theorem componentVerifiedIntegerReport_verdict :
    componentVerifiedIntegerReport.report.verdict =
      ReliabilityVerdict.certifiedStable := by
  norm_num [componentVerifiedIntegerReport, overestimateIntegerReport,
    IntegerReliabilityReport.verdict,
    IntegerReliabilityReport.requiredCost, wholeMilli, ofInt,
    milliZero, zero, milliScale]

theorem componentVerifiedIntegerReport_provenanced_verdict :
    componentVerifiedIntegerReport.toProvenanced.report.verdict =
      ReliabilityVerdict.certifiedStable := by
  rw [← componentVerifiedIntegerReport.verdict_eq_provenanced]
  exact componentVerifiedIntegerReport_verdict

def boundaryCanonicalAcceptedData : AcceptedEncodedWeightedPathData
    (zero milliScale) FixedPointEncodedCost.add NontrivialIndependent
    boundaryMilliErrorCost nontrivialSource nontrivialBest (wholeMilli 1) where
  count := 1
  steps := boundaryMilliBestSteps
  accepted := by
    norm_num [boundaryMilliBestSteps, verifyEncodedWeightedPathData,
      encodedEdgeDataAccepted, encodedSwapStepChoicesList,
      encodedSwapStepChoicesListAux, boundaryMilliErrorCost,
      FixedPointEncodedCost.add, wholeMilli, ofInt, milliZero, zero,
      NontrivialIndependent, nontrivialSource, nontrivialBest, milliScale]

noncomputable def boundaryVerifiedIntegerReport :
    SerializableIntegerReliabilityReport NontrivialEdit milliScale
      NontrivialIndependent nontrivialExactCost
      PathwiseCertificateIncompleteness.boundaryApproximateCost
      boundaryMilliErrorCost nontrivialSource where
  report := overestimateIntegerReport nontrivialBest nontrivialBest
    (wholeMilli 1) (wholeMilli 1)
  within := by
    change PrimitiveSwapCostWithinBy NontrivialIndependent
      nontrivialExactCost
      PathwiseCertificateIncompleteness.boundaryApproximateCost
      (decodePrimitiveCost milliDecode boundaryMilliErrorCost)
    exact boundaryMilliSerializableReport.within
  evidence := by
    rw [decode_overestimateIntegerReport]
    exact EncodedSerializablePathwiseErrorEvidence.overestimate
      (decode := FixedPointEncodedCost.decode)
      (selectedTarget := nontrivialBest)
      (margin := FixedPointEncodedCost.decode (wholeMilli 1))
      boundaryCanonicalAcceptedData

theorem boundaryVerifiedIntegerReport_verdict :
    boundaryVerifiedIntegerReport.report.verdict =
      ReliabilityVerdict.inconclusive := by
  norm_num [boundaryVerifiedIntegerReport, overestimateIntegerReport,
    IntegerReliabilityReport.verdict,
    IntegerReliabilityReport.requiredCost, wholeMilli, ofInt,
    milliZero, zero, milliScale]

theorem boundaryVerifiedIntegerReport_provenanced_verdict :
    boundaryVerifiedIntegerReport.toProvenanced.report.verdict =
      ReliabilityVerdict.inconclusive := by
  rw [← boundaryVerifiedIntegerReport.verdict_eq_provenanced]
  exact boundaryVerifiedIntegerReport_verdict

end Sprawlens.FixedPointSerializableIntegerReport
