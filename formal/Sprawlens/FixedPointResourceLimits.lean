import Sprawlens.FixedPointTaggedPathVerifier

namespace Sprawlens.FixedPointResourceLimits

open EncodedWeightedPathDataVerifier
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointScaleTag
open FixedPointTaggedPathVerifier
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

def AllStepUnitsWithin
    {Edit : Type u} (maxUnitMagnitude : Nat) :
    List (TaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      step.cost.units.natAbs ≤ maxUnitMagnitude ∧
        AllStepUnitsWithin maxUnitMagnitude remaining

instance allStepUnitsWithinDecidable
    {Edit : Type u} (maxUnitMagnitude : Nat)
    (steps : List (TaggedPathStep Edit)) :
    Decidable (AllStepUnitsWithin maxUnitMagnitude steps) := by
  induction steps with
  | nil => exact isTrue trivial
  | cons step remaining inductionHypothesis =>
      simp [AllStepUnitsWithin]
      infer_instance

/-- Explicit resource policy for a serialized path. `natAbs` bounds signed
BigInt magnitude without choosing a finite-width machine representation. -/
def TaggedPathWithinLimits
    {Edit : Type u} (maxSteps maxUnitMagnitude : Nat)
    (steps : List (TaggedPathStep Edit)) : Prop :=
  steps.length ≤ maxSteps ∧
    AllStepUnitsWithin maxUnitMagnitude steps

instance taggedPathWithinLimitsDecidable
    {Edit : Type u} (maxSteps maxUnitMagnitude : Nat)
    (steps : List (TaggedPathStep Edit)) :
    Decidable (TaggedPathWithinLimits maxSteps maxUnitMagnitude steps) := by
  unfold TaggedPathWithinLimits
  infer_instance

/-- Resource checks precede tag parsing and graph/path verification. -/
def verifyTaggedWeightedPathDataWithinLimits
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxUnitMagnitude : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit)) :
    Option (Nat × ScaledIntCost expected × List Edit) :=
  if _withinLimits :
      TaggedPathWithinLimits maxSteps maxUnitMagnitude rawSteps then
    verifyTaggedWeightedPathData expected Independent encodedCost
      source rawSteps
  else
    none

theorem verifyWithinLimits_eq_some_iff
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxUnitMagnitude : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    (result : Nat × ScaledIntCost expected × List Edit) :
    verifyTaggedWeightedPathDataWithinLimits expected maxSteps
      maxUnitMagnitude Independent encodedCost source rawSteps = some result ↔
      TaggedPathWithinLimits maxSteps maxUnitMagnitude rawSteps ∧
      verifyTaggedWeightedPathData expected Independent encodedCost
        source rawSteps = some result := by
  by_cases withinLimits :
      TaggedPathWithinLimits maxSteps maxUnitMagnitude rawSteps <;>
    simp [verifyTaggedWeightedPathDataWithinLimits, withinLimits]

/-- Adding resource guards preserves the semantic soundness of every accepted
path. -/
theorem verifyTaggedWeightedPathDataWithinLimits_sound
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxUnitMagnitude : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    {count : Nat} {encodedPathCost : ScaledIntCost expected}
    {target : List Edit}
    (accepted : verifyTaggedWeightedPathDataWithinLimits expected maxSteps
      maxUnitMagnitude Independent encodedCost source rawSteps =
        some (count, encodedPathCost, target)) :
    WeightedTracePath Independent
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost)
      count (FixedPointEncodedCost.decode encodedPathCost) source target := by
  have underlying := (verifyWithinLimits_eq_some_iff expected maxSteps
    maxUnitMagnitude Independent encodedCost source rawSteps
    (count, encodedPathCost, target)).mp accepted |>.2
  exact verifyTaggedWeightedPathData_sound expected Independent encodedCost
    source rawSteps underlying

theorem verifyTaggedWeightedPathDataWithinLimits_limits
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxUnitMagnitude : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    {result : Nat × ScaledIntCost expected × List Edit}
    (accepted : verifyTaggedWeightedPathDataWithinLimits expected maxSteps
      maxUnitMagnitude Independent encodedCost source rawSteps = some result) :
    TaggedPathWithinLimits maxSteps maxUnitMagnitude rawSteps :=
  (verifyWithinLimits_eq_some_iff expected maxSteps maxUnitMagnitude
    Independent encodedCost source rawSteps result).mp accepted |>.1

theorem verifyTaggedWeightedPathDataWithinLimits_count_le
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxUnitMagnitude : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    {count : Nat} {encodedPathCost : ScaledIntCost expected}
    {target : List Edit}
    (accepted : verifyTaggedWeightedPathDataWithinLimits expected maxSteps
      maxUnitMagnitude Independent encodedCost source rawSteps =
        some (count, encodedPathCost, target)) :
    count ≤ maxSteps := by
  have limits := verifyTaggedWeightedPathDataWithinLimits_limits
    expected maxSteps maxUnitMagnitude Independent encodedCost source
    rawSteps accepted
  have underlying := (verifyWithinLimits_eq_some_iff expected maxSteps
    maxUnitMagnitude Independent encodedCost source rawSteps
    (count, encodedPathCost, target)).mp accepted |>.2
  rw [verifyTaggedWeightedPathData_count_eq_length expected Independent
    encodedCost source rawSteps underlying]
  exact limits.1

/-- Resource guards are complete relative to the underlying verifier for data
that satisfies the declared policy. -/
theorem verifyTaggedWeightedPathDataWithinLimits_complete
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxUnitMagnitude : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    {result : Nat × ScaledIntCost expected × List Edit}
    (withinLimits :
      TaggedPathWithinLimits maxSteps maxUnitMagnitude rawSteps)
    (accepted : verifyTaggedWeightedPathData expected Independent
      encodedCost source rawSteps = some result) :
    verifyTaggedWeightedPathDataWithinLimits expected maxSteps
      maxUnitMagnitude Independent encodedCost source rawSteps = some result :=
  (verifyWithinLimits_eq_some_iff expected maxSteps maxUnitMagnitude
    Independent encodedCost source rawSteps result).mpr
      ⟨withinLimits, accepted⟩

/-- Resource policy for the three scalar fields of a tagged report. -/
def TaggedReportWithinMagnitude
    {Edit : Type u} (maxUnitMagnitude : Nat)
    (report : TaggedIntegerReport Edit) : Prop :=
  report.margin.units.natAbs ≤ maxUnitMagnitude ∧
  report.selectedError.units.natAbs ≤ maxUnitMagnitude ∧
  report.comparisonError.units.natAbs ≤ maxUnitMagnitude

instance taggedReportWithinMagnitudeDecidable
    {Edit : Type u} (maxUnitMagnitude : Nat)
    (report : TaggedIntegerReport Edit) :
    Decidable (TaggedReportWithinMagnitude maxUnitMagnitude report) := by
  unfold TaggedReportWithinMagnitude
  infer_instance

def parseReportAtScaleWithinMagnitude
    {Edit : Type u} (expected : PositiveScale)
    (maxUnitMagnitude : Nat) (raw : TaggedIntegerReport Edit) :
    Option (IntegerReliabilityReport Edit expected) :=
  if _withinMagnitude : TaggedReportWithinMagnitude maxUnitMagnitude raw then
    parseReportAtScale expected raw
  else
    none

theorem parseReportWithinMagnitude_eq_some_iff
    {Edit : Type u} (expected : PositiveScale)
    (maxUnitMagnitude : Nat) (raw : TaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected) :
    parseReportAtScaleWithinMagnitude expected maxUnitMagnitude raw =
        some parsed ↔
      TaggedReportWithinMagnitude maxUnitMagnitude raw ∧
      parseReportAtScale expected raw = some parsed := by
  by_cases withinMagnitude :
      TaggedReportWithinMagnitude maxUnitMagnitude raw <;>
    simp [parseReportAtScaleWithinMagnitude, withinMagnitude]

def IntegerReportWithinMagnitude
    {Edit : Type u} {scale : PositiveScale}
    (maxUnitMagnitude : Nat)
    (report : IntegerReliabilityReport Edit scale) : Prop :=
  report.margin.units.natAbs ≤ maxUnitMagnitude ∧
  report.selectedError.units.natAbs ≤ maxUnitMagnitude ∧
  report.comparisonError.units.natAbs ≤ maxUnitMagnitude

theorem parseReportWithinMagnitude_parsed_limits
    {Edit : Type u} (expected : PositiveScale)
    (maxUnitMagnitude : Nat) (raw : TaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseReportAtScaleWithinMagnitude expected
      maxUnitMagnitude raw = some parsed) :
    IntegerReportWithinMagnitude maxUnitMagnitude parsed := by
  have acceptedInfo := (parseReportWithinMagnitude_eq_some_iff expected
    maxUnitMagnitude raw parsed).mp accepted
  have parsedEq := (parseReportAtScale_eq_some_iff
    expected raw parsed).mp acceptedInfo.2 |>.2.2.2
  rw [← parsedEq]
  simpa [IntegerReportWithinMagnitude, TaggedReportWithinMagnitude,
    parsedReportValue] using acceptedInfo.1

theorem boundedRawVerdict_eq_parsedDecodeVerdict
    {Edit : Type u} (expected : PositiveScale)
    (maxUnitMagnitude : Nat) (raw : TaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseReportAtScaleWithinMagnitude expected
      maxUnitMagnitude raw = some parsed) :
    raw.unsafeVerdict = parsed.decode.verdict := by
  have underlying := (parseReportWithinMagnitude_eq_some_iff expected
    maxUnitMagnitude raw parsed).mp accepted |>.2
  exact unsafeVerdict_eq_parsed_decode_verdict expected raw parsed underlying

theorem homogeneousBoundary_within_limits_accepted :
    verifyTaggedWeightedPathDataWithinLimits milliScale 1 1000
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      homogeneousBoundaryTaggedSteps =
        some (1, wholeMilli 1, nontrivialBest) := by
  exact verifyTaggedWeightedPathDataWithinLimits_complete
    milliScale 1 1000 NontrivialIndependent boundaryMilliErrorCost
    nontrivialSource homogeneousBoundaryTaggedSteps (by
      norm_num [TaggedPathWithinLimits, AllStepUnitsWithin,
        homogeneousBoundaryTaggedSteps])
    homogeneousBoundaryTaggedSteps_accepted

theorem homogeneousBoundary_step_limit_rejected :
    verifyTaggedWeightedPathDataWithinLimits milliScale 0 1000
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      homogeneousBoundaryTaggedSteps = none := by
  norm_num [verifyTaggedWeightedPathDataWithinLimits,
    TaggedPathWithinLimits, homogeneousBoundaryTaggedSteps]

theorem homogeneousBoundary_magnitude_limit_rejected :
    verifyTaggedWeightedPathDataWithinLimits milliScale 1 999
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      homogeneousBoundaryTaggedSteps = none := by
  norm_num [verifyTaggedWeightedPathDataWithinLimits,
    TaggedPathWithinLimits, AllStepUnitsWithin,
    homogeneousBoundaryTaggedSteps]

theorem homogeneousReport_within_magnitude_parses :
    parseReportAtScaleWithinMagnitude witnessScale 1000
      homogeneousTaggedWitness = some certifiedIntegerWitness := by
  exact (parseReportWithinMagnitude_eq_some_iff witnessScale 1000
    homogeneousTaggedWitness certifiedIntegerWitness).mpr
      ⟨by norm_num [TaggedReportWithinMagnitude, homogeneousTaggedWitness],
        homogeneousTaggedWitness_parses⟩

/-- A valid certified report may be refused by a deliberately smaller
resource policy. Resource refusal is not evidence of instability. -/
theorem homogeneousCertifiedReport_low_magnitude_rejected :
    parseReportAtScaleWithinMagnitude witnessScale 999
      homogeneousTaggedWitness = none := by
  norm_num [parseReportAtScaleWithinMagnitude,
    TaggedReportWithinMagnitude, homogeneousTaggedWitness]

theorem homogeneousCertifiedReport_remains_certified :
    homogeneousTaggedWitness.unsafeVerdict = .certifiedStable :=
  homogeneousTaggedWitness_verdict

end Sprawlens.FixedPointResourceLimits
