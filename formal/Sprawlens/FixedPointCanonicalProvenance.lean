import Sprawlens.FixedPointCanonicalArtifact
import Sprawlens.FixedPointSerializableIntegerReport

namespace Sprawlens.FixedPointCanonicalProvenance

open ApproximateWeightedNormalization
open EncodedPathwiseSerializableReport
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalArtifact
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointSerializableIntegerReport
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- Raw serialized data plus the exact result recomputed by the complete
canonical decoder and graph verifier. -/
structure AcceptedSerializedWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source target : List Edit) (pathCost : ScaledIntCost scale) where
  count : Nat
  steps : List (SerializedTaggedPathStep Edit)
  accepted : verifySerializedWeightedPathData scale maxSteps maxBytes
    Independent encodedCost source steps = some (count, pathCost, target)

/-- Recover the already-proved encoded checker evidence without trusting a
second copy of the parsed steps. -/
def AcceptedSerializedWeightedPathData.toAcceptedEncoded
    {Edit : Type u} [DecidableEq Edit]
    {scale : PositiveScale}
    {maxSteps maxBytes : Nat}
    {Independent : Edit → Edit → Prop} [DecidableRel Independent]
    {encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale}
    {source target : List Edit} {pathCost : ScaledIntCost scale}
    (data : AcceptedSerializedWeightedPathData scale maxSteps maxBytes
      Independent encodedCost source target pathCost) :
    AcceptedEncodedWeightedPathData (zero scale) FixedPointEncodedCost.add
      Independent encodedCost source target pathCost := by
  have accepted := data.accepted
  unfold verifySerializedWeightedPathData at accepted
  cases parsedEq :
      parseSerializedStepsAtScale scale maxSteps maxBytes data.steps with
  | none => simp [parsedEq] at accepted
  | some parsed =>
      exact {
        count := data.count
        steps := parsed
        accepted := by simpa [parsedEq] using accepted
      }

/-- Verify one mode-relevant path and require its recomputed endpoint and
aggregate error to equal the corresponding report fields. -/
def verifySerializedPathField
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source expectedTarget : List Edit)
    (expectedCost : ScaledIntCost scale)
    (steps : List (SerializedTaggedPathStep Edit)) : Option Nat :=
  match verifySerializedWeightedPathData scale maxSteps maxBytes Independent
      encodedCost source steps with
  | none => none
  | some (count, actualCost, actualTarget) =>
      if actualCost = expectedCost ∧ actualTarget = expectedTarget
      then some count
      else none

theorem verifySerializedPathField_eq_some_iff
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source expectedTarget : List Edit)
    (expectedCost : ScaledIntCost scale)
    (steps : List (SerializedTaggedPathStep Edit)) (count : Nat) :
    verifySerializedPathField scale maxSteps maxBytes Independent encodedCost
      source expectedTarget expectedCost steps = some count ↔
    verifySerializedWeightedPathData scale maxSteps maxBytes Independent
      encodedCost source steps = some (count, expectedCost, expectedTarget) := by
  cases verifiedEq : verifySerializedWeightedPathData scale maxSteps maxBytes
      Independent encodedCost source steps with
  | none => simp [verifySerializedPathField, verifiedEq]
  | some result =>
      rcases result with ⟨actualCount, actualCost, actualTarget⟩
      by_cases fieldsMatch :
          actualCost = expectedCost ∧ actualTarget = expectedTarget
      · rcases fieldsMatch with ⟨rfl, rfl⟩
        simp [verifySerializedPathField, verifiedEq]
      · simp [verifySerializedPathField, verifiedEq, fieldsMatch]

def acceptedSerializedDataOfField
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source expectedTarget : List Edit)
    (expectedCost : ScaledIntCost scale)
    (steps : List (SerializedTaggedPathStep Edit)) (count : Nat)
    (accepted : verifySerializedPathField scale maxSteps maxBytes Independent
      encodedCost source expectedTarget expectedCost steps = some count) :
    AcceptedSerializedWeightedPathData scale maxSteps maxBytes Independent
      encodedCost source expectedTarget expectedCost where
  count := count
  steps := steps
  accepted := (verifySerializedPathField_eq_some_iff scale maxSteps maxBytes
    Independent encodedCost source expectedTarget expectedCost steps count).mp
      accepted

/-- The payload shape is indexed by approximation mode: two-sided carries two
paths, while each one-sided mode carries only the path that contributes to its
error bound. -/
inductive SerializedModePaths (Edit : Type u) where
  | twoSided
      (selected comparison : List (SerializedTaggedPathStep Edit))
  | overestimate
      (comparison : List (SerializedTaggedPathStep Edit))
  | underestimate
      (selected : List (SerializedTaggedPathStep Edit))

/-- Complete artifact gate. It validates report syntax, mode-specific path
payloads, recomputed targets and costs, and the zero value of every unused
one-sided error field. -/
def verifyCanonicalReliabilityArtifact
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit) :
    Option (IntegerReliabilityReport Edit scale) :=
  match parseSerializedReportAtScale scale maxBytes rawReport with
  | none => none
  | some report =>
      match report.mode, paths with
      | .twoSided, .twoSided selected comparison =>
          match verifySerializedPathField scale maxSteps maxBytes Independent
              encodedCost source report.selectedTarget report.selectedError
              selected with
          | none => none
          | some _ =>
              match verifySerializedPathField scale maxSteps maxBytes
                  Independent encodedCost source report.bestTarget
                  report.comparisonError comparison with
              | none => none
              | some _ => some report
      | .overestimate, .overestimate comparison =>
          if report.selectedError = zero scale then
            match verifySerializedPathField scale maxSteps maxBytes Independent
                encodedCost source report.bestTarget report.comparisonError
                comparison with
            | none => none
            | some _ => some report
          else none
      | .underestimate, .underestimate selected =>
          if report.comparisonError = zero scale then
            match verifySerializedPathField scale maxSteps maxBytes Independent
                encodedCost source report.selectedTarget report.selectedError
                selected with
            | none => none
            | some _ => some report
          else none
      | _, _ => none

theorem report_eq_twoSidedIntegerReport_of_mode
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale)
    (modeEq : report.mode = .twoSided) :
    report = twoSidedIntegerReport report.selectedTarget report.bestTarget
      report.margin report.selectedError report.comparisonError := by
  cases report with
  | mk mode selectedTarget bestTarget margin selectedError comparisonError =>
      simp only at modeEq
      subst mode
      rfl

theorem report_eq_overestimateIntegerReport_of_mode_of_unused_zero
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale)
    (modeEq : report.mode = .overestimate)
    (unusedZero : report.selectedError = zero scale) :
    report = overestimateIntegerReport report.selectedTarget report.bestTarget
      report.margin report.comparisonError := by
  cases report with
  | mk mode selectedTarget bestTarget margin selectedError comparisonError =>
      simp only at modeEq unusedZero
      subst mode
      subst selectedError
      rfl

theorem report_eq_underestimateIntegerReport_of_mode_of_unused_zero
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale)
    (modeEq : report.mode = .underestimate)
    (unusedZero : report.comparisonError = zero scale) :
    report = underestimateIntegerReport report.selectedTarget report.bestTarget
      report.margin report.selectedError := by
  cases report with
  | mk mode selectedTarget bestTarget margin selectedError comparisonError =>
      simp only at modeEq unusedZero
      subst mode
      subst comparisonError
      rfl

/-- Every accepted canonical artifact constructs the existing mode-indexed
encoded path evidence. This is the semantic bridge that the syntax-only
decoder intentionally does not provide on its own. -/
theorem verifyCanonicalReliabilityArtifact_sound
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (accepted : verifyCanonicalReliabilityArtifact scale maxSteps maxBytes
      Independent encodedCost source rawReport paths = some report) :
    Nonempty (EncodedSerializablePathwiseErrorEvidence FixedPointEncodedCost.decode
      (zero scale) FixedPointEncodedCost.add Independent encodedCost source
      report.decode) := by
  unfold verifyCanonicalReliabilityArtifact at accepted
  cases parsedEq : parseSerializedReportAtScale scale maxBytes rawReport with
  | none => simp [parsedEq] at accepted
  | some parsed =>
      simp only [parsedEq] at accepted
      cases modeEq : parsed.mode with
      | twoSided =>
          cases paths with
          | twoSided selected comparison =>
              simp only [modeEq] at accepted
              cases selectedEq : verifySerializedPathField scale maxSteps
                  maxBytes Independent encodedCost source
                  parsed.selectedTarget parsed.selectedError selected with
              | none => simp [selectedEq] at accepted
              | some selectedCount =>
                  cases comparisonEq : verifySerializedPathField scale
                      maxSteps maxBytes Independent encodedCost source
                      parsed.bestTarget parsed.comparisonError comparison with
                  | none => simp [selectedEq, comparisonEq] at accepted
                  | some comparisonCount =>
                      simp [selectedEq, comparisonEq] at accepted
                      subst report
                      have canonical :=
                        report_eq_twoSidedIntegerReport_of_mode parsed modeEq
                      rw [canonical, decode_twoSidedIntegerReport]
                      exact ⟨.twoSided
                        ((acceptedSerializedDataOfField scale maxSteps
                          maxBytes Independent encodedCost source
                          parsed.selectedTarget parsed.selectedError selected
                          selectedCount selectedEq).toAcceptedEncoded)
                        ((acceptedSerializedDataOfField scale maxSteps
                          maxBytes Independent encodedCost source
                          parsed.bestTarget parsed.comparisonError comparison
                          comparisonCount comparisonEq).toAcceptedEncoded)⟩
          | overestimate comparison => simp [modeEq] at accepted
          | underestimate selected => simp [modeEq] at accepted
      | overestimate =>
          cases paths with
          | twoSided selected comparison => simp [modeEq] at accepted
          | overestimate comparison =>
              simp only [modeEq] at accepted
              by_cases unusedZero : parsed.selectedError = zero scale
              · simp only [unusedZero, ↓reduceIte] at accepted
                cases comparisonEq : verifySerializedPathField scale
                    maxSteps maxBytes Independent encodedCost source
                    parsed.bestTarget parsed.comparisonError comparison with
                | none => simp [comparisonEq] at accepted
                | some comparisonCount =>
                    simp [comparisonEq] at accepted
                    subst report
                    have canonical :=
                      report_eq_overestimateIntegerReport_of_mode_of_unused_zero
                        parsed modeEq unusedZero
                    rw [canonical, decode_overestimateIntegerReport]
                    exact ⟨.overestimate
                      ((acceptedSerializedDataOfField scale maxSteps maxBytes
                        Independent encodedCost source parsed.bestTarget
                        parsed.comparisonError comparison comparisonCount
                        comparisonEq).toAcceptedEncoded)⟩
              · simp [unusedZero] at accepted
          | underestimate selected => simp [modeEq] at accepted
      | underestimate =>
          cases paths with
          | twoSided selected comparison => simp [modeEq] at accepted
          | overestimate comparison => simp [modeEq] at accepted
          | underestimate selected =>
              simp only [modeEq] at accepted
              by_cases unusedZero : parsed.comparisonError = zero scale
              · simp only [unusedZero, ↓reduceIte] at accepted
                cases selectedEq : verifySerializedPathField scale maxSteps
                    maxBytes Independent encodedCost source
                    parsed.selectedTarget parsed.selectedError selected with
                | none => simp [selectedEq] at accepted
                | some selectedCount =>
                    simp [selectedEq] at accepted
                    subst report
                    have canonical :=
                      report_eq_underestimateIntegerReport_of_mode_of_unused_zero
                        parsed modeEq unusedZero
                    rw [canonical, decode_underestimateIntegerReport]
                    exact ⟨.underestimate
                      ((acceptedSerializedDataOfField scale maxSteps maxBytes
                        Independent encodedCost source parsed.selectedTarget
                        parsed.selectedError selected selectedCount
                        selectedEq).toAcceptedEncoded)⟩
              · simp [unusedZero] at accepted

theorem exists_serializableIntegerReport_of_canonicalArtifact
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (accepted : verifyCanonicalReliabilityArtifact scale maxSteps maxBytes
      Independent encodedCost source rawReport paths = some report) :
    ∃ serializable : SerializableIntegerReliabilityReport Edit scale
        Independent exactCost approximateCost encodedCost source,
      serializable.report = report := by
  obtain ⟨evidence⟩ := verifyCanonicalReliabilityArtifact_sound scale maxSteps
    maxBytes Independent encodedCost source rawReport paths report accepted
  exact ⟨{
    report := report
    within := within
    evidence := evidence
  }, rfl⟩

theorem canonicalArtifact_errorsNonnegative
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (accepted : verifyCanonicalReliabilityArtifact scale maxSteps maxBytes
      Independent encodedCost source rawReport paths = some report) :
    report.ErrorsNonnegative := by
  obtain ⟨serializable, reportEq⟩ :=
    exists_serializableIntegerReport_of_canonicalArtifact scale maxSteps
      maxBytes Independent exactCost approximateCost encodedCost source
      rawReport paths report within accepted
  rw [← reportEq]
  exact serializable.errorsNonnegative

theorem canonicalArtifact_requiredUnits_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (accepted : verifyCanonicalReliabilityArtifact scale maxSteps maxBytes
      Independent encodedCost source rawReport paths = some report) :
    0 ≤ report.requiredCost.units := by
  obtain ⟨serializable, reportEq⟩ :=
    exists_serializableIntegerReport_of_canonicalArtifact scale maxSteps
      maxBytes Independent exactCost approximateCost encodedCost source
      rawReport paths report within accepted
  rw [← reportEq]
  exact serializable.requiredUnits_nonnegative

theorem canonicalArtifact_marginUnits_pos_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (report : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (accepted : verifyCanonicalReliabilityArtifact scale maxSteps maxBytes
      Independent encodedCost source rawReport paths = some report)
    (certified : report.verdict = .certifiedStable) :
    0 < report.margin.units := by
  obtain ⟨serializable, reportEq⟩ :=
    exists_serializableIntegerReport_of_canonicalArtifact scale maxSteps
      maxBytes Independent exactCost approximateCost encodedCost source
      rawReport paths report within accepted
  rw [← reportEq] at certified ⊢
  exact serializable.marginUnits_pos_of_certified certified

def componentCanonicalIntegerReport :
    IntegerReliabilityReport NontrivialEdit milliScale :=
  overestimateIntegerReport nontrivialBest nontrivialBest
    (wholeMilli 1) milliZero

def componentCanonicalRawReport :
    SerializedTaggedIntegerReport NontrivialEdit :=
  serializeIntegerReport componentCanonicalIntegerReport

def componentCanonicalRawPath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, "0"⟩, nontrivialBest⟩]

def componentCanonicalPaths : SerializedModePaths NontrivialEdit :=
  .overestimate componentCanonicalRawPath

theorem componentCanonicalArtifact_accepted :
    verifyCanonicalReliabilityArtifact milliScale 1 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource
      componentCanonicalRawReport componentCanonicalPaths =
        some componentCanonicalIntegerReport := by
  have reportParsed :
      parseSerializedReportAtScale milliScale 4 componentCanonicalRawReport =
        some componentCanonicalIntegerReport := by
    apply parseSerializedReportAtScale_serialize
    norm_num [IntegerReportReprsWithin, componentCanonicalIntegerReport,
      overestimateIntegerReport, wholeMilli, ofInt, milliZero, zero,
      milliScale]
    native_decide
  have pathAccepted :
      verifySerializedPathField milliScale 1 4 NontrivialIndependent
        componentMilliErrorCost nontrivialSource nontrivialBest milliZero
        componentCanonicalRawPath = some 1 := by
    native_decide
  simp [verifyCanonicalReliabilityArtifact, reportParsed,
    componentCanonicalIntegerReport, componentCanonicalPaths,
    overestimateIntegerReport, pathAccepted]

theorem componentCanonicalArtifact_has_serializable_provenance :
    ∃ serializable : SerializableIntegerReliabilityReport NontrivialEdit
        milliScale NontrivialIndependent nontrivialExactCost
        ReachablePathwiseStrictWitness.componentApproximateCost
        componentMilliErrorCost nontrivialSource,
      serializable.report = componentCanonicalIntegerReport := by
  apply exists_serializableIntegerReport_of_canonicalArtifact milliScale 1 4
    NontrivialIndependent nontrivialExactCost
    ReachablePathwiseStrictWitness.componentApproximateCost
    componentMilliErrorCost nontrivialSource componentCanonicalRawReport
    componentCanonicalPaths componentCanonicalIntegerReport
  · change PrimitiveSwapCostWithinBy NontrivialIndependent
      nontrivialExactCost
      ReachablePathwiseStrictWitness.componentApproximateCost
      (decodePrimitiveCost milliDecode componentMilliErrorCost)
    exact componentMilliSerializableReport.within
  · exact componentCanonicalArtifact_accepted

theorem componentCanonicalIntegerReport_verdict :
    componentCanonicalIntegerReport.verdict = .certifiedStable := by
  native_decide

/-- `-1` is canonical syntax, but the graph recomputes error 0 for this edge;
the full artifact gate therefore rejects the forged aggregate. -/
def canonicalNegativeIntegerReport :
    IntegerReliabilityReport NontrivialEdit milliScale :=
  overestimateIntegerReport nontrivialBest nontrivialBest milliZero ⟨-1⟩

def canonicalNegativeRawReport :
    SerializedTaggedIntegerReport NontrivialEdit :=
  serializeIntegerReport canonicalNegativeIntegerReport

def canonicalNegativeRawPath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, "-1"⟩, nontrivialBest⟩]

def canonicalNegativePaths : SerializedModePaths NontrivialEdit :=
  .overestimate canonicalNegativeRawPath

theorem canonicalNegativeRawReport_syntax_accepted :
    parseSerializedReportAtScale milliScale 4 canonicalNegativeRawReport =
      some canonicalNegativeIntegerReport := by
  apply parseSerializedReportAtScale_serialize
  norm_num [IntegerReportReprsWithin, canonicalNegativeIntegerReport,
    overestimateIntegerReport, milliZero, zero, milliScale]
  native_decide

theorem canonicalNegativeArtifact_rejected :
    verifyCanonicalReliabilityArtifact milliScale 1 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource
      canonicalNegativeRawReport canonicalNegativePaths = none := by
  native_decide

theorem canonicalNegativeIntegerReport_has_no_serializable_provenance :
    ¬∃ serializable : SerializableIntegerReliabilityReport NontrivialEdit
        milliScale NontrivialIndependent nontrivialExactCost
        ReachablePathwiseStrictWitness.componentApproximateCost
        componentMilliErrorCost nontrivialSource,
      serializable.report = canonicalNegativeIntegerReport := by
  rintro ⟨serializable, reportEq⟩
  have valid := serializable.errorsNonnegative
  rw [reportEq] at valid
  norm_num [canonicalNegativeIntegerReport, overestimateIntegerReport,
    IntegerReliabilityReport.ErrorsNonnegative, milliZero, zero] at valid

/-- An unused one-sided field is not ignored. Without this check, a report
could carry contradictory data that disappears when evidence is constructed. -/
def nonzeroUnusedOverestimateReport :
    IntegerReliabilityReport NontrivialEdit milliScale where
  mode := .overestimate
  selectedTarget := nontrivialBest
  bestTarget := nontrivialBest
  margin := wholeMilli 1
  selectedError := ⟨1⟩
  comparisonError := milliZero

def nonzeroUnusedRawReport :
    SerializedTaggedIntegerReport NontrivialEdit :=
  serializeIntegerReport nonzeroUnusedOverestimateReport

theorem nonzeroUnusedRawReport_syntax_accepted :
    parseSerializedReportAtScale milliScale 4 nonzeroUnusedRawReport =
      some nonzeroUnusedOverestimateReport := by
  apply parseSerializedReportAtScale_serialize
  norm_num [IntegerReportReprsWithin, nonzeroUnusedOverestimateReport,
    wholeMilli, ofInt, milliZero, zero, milliScale]
  native_decide

theorem nonzeroUnusedOverestimateArtifact_rejected :
    verifyCanonicalReliabilityArtifact milliScale 1 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource
      nonzeroUnusedRawReport componentCanonicalPaths = none := by
  native_decide

theorem mode_path_shape_mismatch_rejected :
    verifyCanonicalReliabilityArtifact milliScale 1 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource
      componentCanonicalRawReport
      (.underestimate componentCanonicalRawPath) = none := by
  native_decide

end Sprawlens.FixedPointCanonicalProvenance
