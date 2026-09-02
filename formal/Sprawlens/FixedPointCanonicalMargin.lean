import Sprawlens.FixedPointCanonicalProvenance
import Sprawlens.FixedPointMarginProvenance

namespace Sprawlens.FixedPointCanonicalMargin

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalArtifact
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointGapEncoding
open FixedPointIntegerReport
open FixedPointMarginProvenance
open FixedPointPathDataWitness
open FixedPointSerializableIntegerReport
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u

/-- Final gate: path provenance is checked first, then the serialized margin
must equal the conservative encoding recomputed from trusted classifier data. -/
noncomputable def verifyCanonicalReliabilityArtifactWithMargin
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit) :
    Option (IntegerReliabilityReport Edit scale) :=
  match verifyCanonicalReliabilityArtifact scale maxSteps maxBytes Independent
      encodedCost source rawReport paths with
  | none => none
  | some report =>
      if report.margin = encodeMarginDown scale actualMargin
      then some report
      else none

theorem verifyCanonicalReliabilityArtifactWithMargin_eq_some_iff
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale) :
    verifyCanonicalReliabilityArtifactWithMargin scale maxSteps maxBytes
        Independent encodedCost source actualMargin rawReport paths =
        some report ↔
      verifyCanonicalReliabilityArtifact scale maxSteps maxBytes Independent
          encodedCost source rawReport paths = some report ∧
      report.margin = encodeMarginDown scale actualMargin := by
  cases baseEq : verifyCanonicalReliabilityArtifact scale maxSteps maxBytes
      Independent encodedCost source rawReport paths with
  | none => simp [verifyCanonicalReliabilityArtifactWithMargin, baseEq]
  | some parsed =>
      by_cases marginEq : parsed.margin = encodeMarginDown scale actualMargin
      · simp only [verifyCanonicalReliabilityArtifactWithMargin, baseEq,
          marginEq, ↓reduceIte, Option.some.injEq]
        constructor
        · intro outputEq
          subst report
          exact ⟨rfl, marginEq⟩
        · exact fun info => info.1
      · simp only [verifyCanonicalReliabilityArtifactWithMargin, baseEq,
          marginEq, ↓reduceIte, reduceCtorEq, false_iff,
          Option.some.injEq]
        rintro ⟨outputEq, reportMarginEq⟩
        subst report
        exact marginEq reportMarginEq

/-- Successful final validation constructs the existing margin-encoded
serializable report, not a parallel weaker notion. -/
theorem exists_marginEncodedSerializableReport_of_canonicalArtifact
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (accepted : verifyCanonicalReliabilityArtifactWithMargin scale maxSteps
      maxBytes Independent encodedCost source actualMargin rawReport paths =
        some report) :
    ∃ bounded : MarginEncodedSerializableReport Edit scale Independent
        exactCost approximateCost encodedCost source actualMargin,
      bounded.serializable.report = report := by
  have acceptedInfo :=
    (verifyCanonicalReliabilityArtifactWithMargin_eq_some_iff scale maxSteps
      maxBytes Independent encodedCost source actualMargin rawReport paths
      report).mp accepted
  obtain ⟨serializable, reportEq⟩ :=
    exists_serializableIntegerReport_of_canonicalArtifact scale maxSteps
      maxBytes Independent exactCost approximateCost encodedCost source
      rawReport paths report within acceptedInfo.1
  refine ⟨{
    serializable := serializable
    margin_eq := ?_
  }, reportEq⟩
  rw [reportEq]
  exact acceptedInfo.2

theorem canonicalArtifact_requiredError_lt_actualMargin
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (accepted : verifyCanonicalReliabilityArtifactWithMargin scale maxSteps
      maxBytes Independent encodedCost source actualMargin rawReport paths =
        some report)
    (certified : report.verdict = .certifiedStable) :
    report.decode.requiredError < actualMargin := by
  obtain ⟨bounded, reportEq⟩ :=
    exists_marginEncodedSerializableReport_of_canonicalArtifact scale maxSteps
      maxBytes Independent exactCost approximateCost encodedCost source
      actualMargin rawReport paths report within accepted
  rw [← reportEq] at certified ⊢
  exact bounded.requiredError_lt_actualMargin marginNonnegative certified

theorem canonicalArtifact_target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : report.decode.requiredError < actualMargin →
      report.selectedTarget = report.bestTarget)
    (accepted : verifyCanonicalReliabilityArtifactWithMargin scale maxSteps
      maxBytes Independent encodedCost source actualMargin rawReport paths =
        some report)
    (certified : report.verdict = .certifiedStable) :
    report.selectedTarget = report.bestTarget :=
  stable (canonicalArtifact_requiredError_lt_actualMargin scale maxSteps
    maxBytes Independent exactCost approximateCost encodedCost source
    actualMargin rawReport paths report within marginNonnegative accepted
    certified)

theorem componentCanonicalArtifact_withMargin_accepted :
    verifyCanonicalReliabilityArtifactWithMargin milliScale 1 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentCanonicalRawReport componentCanonicalPaths =
        some componentCanonicalIntegerReport := by
  apply (verifyCanonicalReliabilityArtifactWithMargin_eq_some_iff milliScale
    1 4 NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentCanonicalRawReport componentCanonicalPaths
    componentCanonicalIntegerReport).mpr
  exact ⟨componentCanonicalArtifact_accepted, by
    norm_num [componentCanonicalIntegerReport, overestimateIntegerReport,
      encodeMarginDown, gapUnitsDown, wholeMilli, ofInt, milliScale]⟩

/-- Same accepted boundary path as before, but with the serialized margin
inflated by one unit. Path provenance alone accepts it and yields a false
certification at the exact boundary. -/
def inflatedCanonicalIntegerReport :
    IntegerReliabilityReport NontrivialEdit milliScale :=
  overestimateIntegerReport nontrivialBest nontrivialBest ⟨1001⟩
    (wholeMilli 1)

def inflatedCanonicalRawReport :
    SerializedTaggedIntegerReport NontrivialEdit :=
  serializeIntegerReport inflatedCanonicalIntegerReport

def inflatedCanonicalRawPath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, "1000"⟩, nontrivialBest⟩]

def inflatedCanonicalPaths : SerializedModePaths NontrivialEdit :=
  .overestimate inflatedCanonicalRawPath

theorem inflatedCanonicalArtifact_base_accepted :
    verifyCanonicalReliabilityArtifact milliScale 1 4
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      inflatedCanonicalRawReport inflatedCanonicalPaths =
        some inflatedCanonicalIntegerReport := by
  have reportParsed :
      parseSerializedReportAtScale milliScale 4 inflatedCanonicalRawReport =
        some inflatedCanonicalIntegerReport := by
    apply parseSerializedReportAtScale_serialize
    norm_num [IntegerReportReprsWithin, inflatedCanonicalIntegerReport,
      overestimateIntegerReport, wholeMilli, ofInt, zero, milliScale]
    native_decide
  have pathAccepted :
      verifySerializedPathField milliScale 1 4 NontrivialIndependent
        boundaryMilliErrorCost nontrivialSource nontrivialBest (wholeMilli 1)
        inflatedCanonicalRawPath = some 1 := by
    native_decide
  simp [verifyCanonicalReliabilityArtifact, reportParsed,
    inflatedCanonicalIntegerReport, inflatedCanonicalPaths,
    overestimateIntegerReport, pathAccepted]

theorem inflatedCanonicalArtifact_base_certifies :
    inflatedCanonicalIntegerReport.verdict = .certifiedStable := by
  native_decide

theorem inflatedCanonicalArtifact_actual_strict_margin_fails :
    ¬inflatedCanonicalIntegerReport.decode.requiredError < 1 := by
  norm_num [inflatedCanonicalIntegerReport,
    IntegerReliabilityReport.decode, overestimateIntegerReport,
    PathwiseReliabilityReport.requiredError, wholeMilli, ofInt,
    FixedPointEncodedCost.decode, milliScale]

theorem inflatedCanonicalArtifact_withMargin_rejected :
    verifyCanonicalReliabilityArtifactWithMargin milliScale 1 4
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource 1
      inflatedCanonicalRawReport inflatedCanonicalPaths = none := by
  unfold verifyCanonicalReliabilityArtifactWithMargin
  rw [inflatedCanonicalArtifact_base_accepted]
  norm_num [inflatedCanonicalIntegerReport, overestimateIntegerReport,
    encodeMarginDown, gapUnitsDown, milliScale]

end Sprawlens.FixedPointCanonicalMargin
