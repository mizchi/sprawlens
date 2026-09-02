import Sprawlens.FixedPointSerializableIntegerReport

namespace Sprawlens.FixedPointMarginProvenance

open ApproximateWeightedNormalization
open EncodedPathwiseSerializableReport
open EncodedWeightedPathDataVerifier
open FixedPointEncodedCost
open FixedPointGapEncoding
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointSerializableIntegerReport
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u

/-- Canonical conservative encoding for a real classifier margin. Unlike error
costs, margins are rounded down so integer certification cannot gain power by
serialization. -/
noncomputable def encodeMarginDown
    (scale : PositiveScale) (margin : ℝ) : ScaledIntCost scale :=
  ⟨Int.ofNat (gapUnitsDown scale margin)⟩

theorem decode_encodeMarginDown
    (scale : PositiveScale) (margin : ℝ) :
    FixedPointEncodedCost.decode (encodeMarginDown scale margin) =
      decodedGapDown scale margin := by
  simp [FixedPointEncodedCost.decode, encodeMarginDown, decodedGapDown]

/-- A nonnegative real margin is never enlarged by serialization. -/
theorem decode_encodeMarginDown_le
    (scale : PositiveScale) {margin : ℝ} (marginNonnegative : 0 ≤ margin) :
    FixedPointEncodedCost.decode (encodeMarginDown scale margin) ≤ margin := by
  rw [decode_encodeMarginDown]
  exact decodedGapDown_le scale marginNonnegative

/-- Downward margin serialization loses strictly less than one quantum. -/
theorem margin_lt_decode_encodeMarginDown_add_quantum
    (scale : PositiveScale) (margin : ℝ) :
    margin < FixedPointEncodedCost.decode (encodeMarginDown scale margin) +
      FixedPointQuantization.quantum scale := by
  rw [decode_encodeMarginDown]
  exact gap_lt_decodedGapDown_add_quantum scale margin

theorem encodeMarginDown_units_nonnegative
    (scale : PositiveScale) (margin : ℝ) :
    0 ≤ (encodeMarginDown scale margin).units := by
  simp [encodeMarginDown]

theorem encodeMarginDown_units_pos_iff
    (scale : PositiveScale) (margin : ℝ) :
    0 < (encodeMarginDown scale margin).units ↔
      FixedPointQuantization.quantum scale ≤ margin := by
  simp [encodeMarginDown, gapUnitsDown_pos_iff]

/-- A serializable integer report whose margin field is definitionally tied to
the conservative floor encoding of the supplied real classifier margin. -/
structure MarginEncodedSerializableReport
    (Edit : Type u) [DecidableEq Edit]
    (scale : PositiveScale)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ) where
  serializable : SerializableIntegerReliabilityReport Edit scale Independent
    exactCost approximateCost encodedErrorCost source
  margin_eq : serializable.report.margin =
    encodeMarginDown scale actualMargin

theorem MarginEncodedSerializableReport.margin_decode_le_actual
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit} {actualMargin : ℝ}
    (bounded : MarginEncodedSerializableReport Edit scale Independent
      exactCost approximateCost encodedErrorCost source actualMargin)
    (marginNonnegative : 0 ≤ actualMargin) :
    FixedPointEncodedCost.decode bounded.serializable.report.margin ≤
      actualMargin := by
  rw [bounded.margin_eq]
  exact decode_encodeMarginDown_le scale marginNonnegative

/-- Integer certification with an upward-safe error path and downward-safe
margin implies the original real strict margin premise. -/
theorem MarginEncodedSerializableReport.requiredError_lt_actualMargin
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit} {actualMargin : ℝ}
    (bounded : MarginEncodedSerializableReport Edit scale Independent
      exactCost approximateCost encodedErrorCost source actualMargin)
    (marginNonnegative : 0 ≤ actualMargin)
    (certified : bounded.serializable.report.verdict = .certifiedStable) :
    bounded.serializable.report.decode.requiredError < actualMargin := by
  have decodedCertified :
      bounded.serializable.report.decode.verdict = .certifiedStable := by
    rw [← bounded.serializable.report.verdict_eq_decode_verdict]
    exact certified
  have requiredLtEncoded :=
    bounded.serializable.report.decode.verdict_eq_certifiedStable_iff.mp
      decodedCertified
  exact requiredLtEncoded.trans_le
    (bounded.margin_decode_le_actual marginNonnegative)

/-- Any target-stability theorem stated against the original classifier margin
can consume a certified margin-encoded report directly. -/
theorem MarginEncodedSerializableReport.target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {encodedErrorCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source : List Edit} {actualMargin : ℝ}
    (bounded : MarginEncodedSerializableReport Edit scale Independent
      exactCost approximateCost encodedErrorCost source actualMargin)
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : bounded.serializable.report.decode.requiredError < actualMargin →
      bounded.serializable.report.selectedTarget =
        bounded.serializable.report.bestTarget)
    (certified : bounded.serializable.report.verdict = .certifiedStable) :
    bounded.serializable.report.selectedTarget =
      bounded.serializable.report.bestTarget :=
  stable (bounded.requiredError_lt_actualMargin
    marginNonnegative certified)

/-- Path verification alone does not protect the margin field. Raising the
true one-unit margin to 1001 milli-units turns the genuine boundary path into
a false certification. -/
noncomputable def inflatedBoundarySerializableReport :
    SerializableIntegerReliabilityReport NontrivialEdit milliScale
      NontrivialIndependent nontrivialExactCost
      PathwiseCertificateIncompleteness.boundaryApproximateCost
      boundaryMilliErrorCost nontrivialSource where
  report := overestimateIntegerReport nontrivialBest nontrivialBest
    ⟨1001⟩ (wholeMilli 1)
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
      (margin := FixedPointEncodedCost.decode (⟨1001⟩ : MilliCost))
      boundaryCanonicalAcceptedData

theorem inflatedBoundarySerializableReport_verdict :
    inflatedBoundarySerializableReport.report.verdict = .certifiedStable := by
  norm_num [inflatedBoundarySerializableReport,
    overestimateIntegerReport, IntegerReliabilityReport.verdict,
    IntegerReliabilityReport.requiredCost, wholeMilli, ofInt, milliScale]

theorem inflatedBoundarySerializableReport_errors_nonnegative :
    inflatedBoundarySerializableReport.report.ErrorsNonnegative :=
  inflatedBoundarySerializableReport.errorsNonnegative

theorem inflatedBoundarySerializableReport_provenanced_verdict :
    inflatedBoundarySerializableReport.toProvenanced.report.verdict =
      .certifiedStable := by
  rw [← inflatedBoundarySerializableReport.verdict_eq_provenanced]
  exact inflatedBoundarySerializableReport_verdict

theorem inflatedBoundary_actual_strict_margin_fails :
    ¬inflatedBoundarySerializableReport.report.decode.requiredError < 1 := by
  norm_num [inflatedBoundarySerializableReport,
    IntegerReliabilityReport.decode, overestimateIntegerReport,
    PathwiseReliabilityReport.requiredError, wholeMilli, ofInt,
    FixedPointEncodedCost.decode, milliScale]

/-- The inflated report cannot be equipped with canonical margin provenance
for the actual margin one. -/
theorem inflatedBoundary_has_no_margin_provenance :
    ¬∃ bounded : MarginEncodedSerializableReport NontrivialEdit milliScale
        NontrivialIndependent nontrivialExactCost
        PathwiseCertificateIncompleteness.boundaryApproximateCost
        boundaryMilliErrorCost nontrivialSource 1,
      bounded.serializable = inflatedBoundarySerializableReport := by
  rintro ⟨bounded, serializableEq⟩
  have marginEq := bounded.margin_eq
  rw [serializableEq] at marginEq
  norm_num [inflatedBoundarySerializableReport, encodeMarginDown,
    gapUnitsDown, overestimateIntegerReport, milliScale] at marginEq

noncomputable def componentMarginEncodedReport :
    MarginEncodedSerializableReport NontrivialEdit milliScale
      NontrivialIndependent nontrivialExactCost
      ReachablePathwiseStrictWitness.componentApproximateCost
      componentMilliErrorCost nontrivialSource 1 where
  serializable := componentVerifiedIntegerReport
  margin_eq := by
    norm_num [componentVerifiedIntegerReport, encodeMarginDown,
      gapUnitsDown, overestimateIntegerReport, wholeMilli, ofInt, milliScale]

theorem componentMarginEncodedReport_verdict :
    componentMarginEncodedReport.serializable.report.verdict =
      .certifiedStable := componentVerifiedIntegerReport_verdict

noncomputable def boundaryMarginEncodedReport :
    MarginEncodedSerializableReport NontrivialEdit milliScale
      NontrivialIndependent nontrivialExactCost
      PathwiseCertificateIncompleteness.boundaryApproximateCost
      boundaryMilliErrorCost nontrivialSource 1 where
  serializable := boundaryVerifiedIntegerReport
  margin_eq := by
    norm_num [boundaryVerifiedIntegerReport, encodeMarginDown,
      gapUnitsDown, overestimateIntegerReport, wholeMilli, ofInt, milliScale]

theorem boundaryMarginEncodedReport_verdict :
    boundaryMarginEncodedReport.serializable.report.verdict =
      .inconclusive := boundaryVerifiedIntegerReport_verdict

end Sprawlens.FixedPointMarginProvenance
