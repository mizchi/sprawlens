import Sprawlens.FixedPointWireArtifact

namespace Sprawlens.FixedPointWireResourceLimits

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalArtifact
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointMarginProvenance
open FixedPointPathDataWitness
open FixedPointWireArtifact
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u

def AllWireStepTargetsWithin
    {Edit : Type u} (maxTargetLength : Nat) :
    List (WireTaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      step.next.length ≤ maxTargetLength ∧
      AllWireStepTargetsWithin maxTargetLength remaining

instance allWireStepTargetsWithinDecidable
    {Edit : Type u} (maxTargetLength : Nat)
    (steps : List (WireTaggedPathStep Edit)) :
    Decidable (AllWireStepTargetsWithin maxTargetLength steps) := by
  induction steps with
  | nil => exact isTrue trivial
  | cons step remaining inductionHypothesis =>
      simp [AllWireStepTargetsWithin]
      infer_instance

def WireModePathTargetsWithin
    {Edit : Type u} (maxTargetLength : Nat) : WireModePaths Edit → Prop
  | .twoSided selected comparison =>
      AllWireStepTargetsWithin maxTargetLength selected ∧
      AllWireStepTargetsWithin maxTargetLength comparison
  | .overestimate comparison =>
      AllWireStepTargetsWithin maxTargetLength comparison
  | .underestimate selected =>
      AllWireStepTargetsWithin maxTargetLength selected

instance wireModePathTargetsWithinDecidable
    {Edit : Type u} (maxTargetLength : Nat) (paths : WireModePaths Edit) :
    Decidable (WireModePathTargetsWithin maxTargetLength paths) := by
  cases paths <;> simp [WireModePathTargetsWithin] <;> infer_instance

def WireReportTargetsWithin
    {Edit : Type u} (maxTargetLength : Nat)
    (report : WireTaggedIntegerReport Edit) : Prop :=
  report.selectedTarget.length ≤ maxTargetLength ∧
  report.bestTarget.length ≤ maxTargetLength

instance wireReportTargetsWithinDecidable
    {Edit : Type u} (maxTargetLength : Nat)
    (report : WireTaggedIntegerReport Edit) :
    Decidable (WireReportTargetsWithin maxTargetLength report) := by
  unfold WireReportTargetsWithin
  infer_instance

def wireStepsTargetEditCount
    {Edit : Type u} : List (WireTaggedPathStep Edit) → Nat
  | [] => 0
  | step :: remaining =>
      step.next.length + wireStepsTargetEditCount remaining

def WireModePaths.targetEditCount
    {Edit : Type u} : WireModePaths Edit → Nat
  | .twoSided selected comparison =>
      wireStepsTargetEditCount selected +
        wireStepsTargetEditCount comparison
  | .overestimate comparison => wireStepsTargetEditCount comparison
  | .underestimate selected => wireStepsTargetEditCount selected

def WireModePaths.stepCount
    {Edit : Type u} : WireModePaths Edit → Nat
  | .twoSided selected comparison => selected.length + comparison.length
  | .overestimate comparison => comparison.length
  | .underestimate selected => selected.length

def wireArtifactTargetEditCount
    {Edit : Type u} (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit) : Nat :=
  report.selectedTarget.length + report.bestTarget.length +
    WireModePaths.targetEditCount paths

/-- Two independent resource controls: no individual target list may be huge,
and the aggregate number of edit occurrences across report and path payloads
must also remain bounded. -/
def WireArtifactWithinStructuralLimits
    {Edit : Type u} (maxTargetLength maxTotalTargetEdits : Nat)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit) : Prop :=
  WireReportTargetsWithin maxTargetLength report ∧
  WireModePathTargetsWithin maxTargetLength paths ∧
  wireArtifactTargetEditCount report paths ≤ maxTotalTargetEdits

instance wireArtifactWithinStructuralLimitsDecidable
    {Edit : Type u} (maxTargetLength maxTotalTargetEdits : Nat)
    (report : WireTaggedIntegerReport Edit) (paths : WireModePaths Edit) :
    Decidable (WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits report paths) := by
  unfold WireArtifactWithinStructuralLimits
  infer_instance

theorem wireStepsTargetEditCount_le
    {Edit : Type u} (maxTargetLength : Nat)
    (steps : List (WireTaggedPathStep Edit))
    (within : AllWireStepTargetsWithin maxTargetLength steps) :
    wireStepsTargetEditCount steps ≤ steps.length * maxTargetLength := by
  induction steps with
  | nil => simp [wireStepsTargetEditCount]
  | cons step remaining inductionHypothesis =>
      simp only [AllWireStepTargetsWithin] at within
      have remainingBound := inductionHypothesis within.2
      simp only [wireStepsTargetEditCount, List.length_cons, Nat.succ_mul]
      omega

theorem wireModeTargetEditCount_le
    {Edit : Type u} (maxTargetLength : Nat)
    (paths : WireModePaths Edit)
    (within : WireModePathTargetsWithin maxTargetLength paths) :
    WireModePaths.targetEditCount paths ≤
      WireModePaths.stepCount paths * maxTargetLength := by
  cases paths with
  | twoSided selected comparison =>
      simp only [WireModePathTargetsWithin] at within
      simp only [WireModePaths.targetEditCount, WireModePaths.stepCount,
        Nat.add_mul]
      exact Nat.add_le_add
        (wireStepsTargetEditCount_le maxTargetLength selected within.1)
        (wireStepsTargetEditCount_le maxTargetLength comparison within.2)
  | overestimate comparison =>
      exact wireStepsTargetEditCount_le maxTargetLength comparison within
  | underestimate selected =>
      exact wireStepsTargetEditCount_le maxTargetLength selected within

/-- Structural validation precedes all scale, unit, path, and margin parsing. -/
noncomputable def verifyWireReliabilityArtifactWithinStructuralLimits
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit) :
    Option (IntegerReliabilityReport Edit scale) :=
  if _within : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths then
    verifyWireReliabilityArtifactWithMargin scale maxSteps maxScaleBytes
      maxUnitBytes Independent encodedCost source actualMargin rawReport
      rawPaths
  else
    none

theorem verifyWireWithinStructuralLimits_eq_some_iff
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit scale) :
    verifyWireReliabilityArtifactWithinStructuralLimits scale maxSteps
        maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
        Independent encodedCost source actualMargin rawReport rawPaths =
        some result ↔
      WireArtifactWithinStructuralLimits maxTargetLength maxTotalTargetEdits
        rawReport rawPaths ∧
      verifyWireReliabilityArtifactWithMargin scale maxSteps maxScaleBytes
        maxUnitBytes Independent encodedCost source actualMargin rawReport
        rawPaths = some result := by
  by_cases within : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths <;>
    simp [verifyWireReliabilityArtifactWithinStructuralLimits, within]

theorem verifyWireWithinStructuralLimits_limits
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    {result : IntegerReliabilityReport Edit scale}
    (accepted : verifyWireReliabilityArtifactWithinStructuralLimits scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      Independent encodedCost source actualMargin rawReport rawPaths =
        some result) :
    WireArtifactWithinStructuralLimits maxTargetLength maxTotalTargetEdits
      rawReport rawPaths :=
  (verifyWireWithinStructuralLimits_eq_some_iff scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits Independent encodedCost
    source actualMargin rawReport rawPaths result).mp accepted |>.1

theorem verifyWireWithinStructuralLimits_complete
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    {result : IntegerReliabilityReport Edit scale}
    (within : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths)
    (accepted : verifyWireReliabilityArtifactWithMargin scale maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths = some result) :
    verifyWireReliabilityArtifactWithinStructuralLimits scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      Independent encodedCost source actualMargin rawReport rawPaths =
        some result :=
  (verifyWireWithinStructuralLimits_eq_some_iff scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits Independent encodedCost
    source actualMargin rawReport rawPaths result).mpr ⟨within, accepted⟩

theorem wireArtifactWithinStructuralLimits_target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (accepted : verifyWireReliabilityArtifactWithinStructuralLimits scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      Independent encodedCost source actualMargin rawReport rawPaths =
        some result)
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  have underlying := (verifyWireWithinStructuralLimits_eq_some_iff scale
    maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
    Independent encodedCost source actualMargin rawReport rawPaths result).mp
      accepted |>.2
  exact wireArtifact_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes Independent exactCost approximateCost encodedCost source
    actualMargin rawReport rawPaths result within marginNonnegative stable
    underlying certified

theorem componentWireArtifact_targetEditCount :
    wireArtifactTargetEditCount componentWireReport componentWirePaths = 9 := by
  native_decide

theorem componentWireArtifact_individualTargetsWithin :
    WireReportTargetsWithin 3 componentWireReport ∧
      WireModePathTargetsWithin 3 componentWirePaths := by
  native_decide

theorem componentWireArtifact_structuralLimits :
    WireArtifactWithinStructuralLimits 3 9 componentWireReport
      componentWirePaths := by
  native_decide

theorem componentWireArtifact_withStructuralLimits_accepted :
    verifyWireReliabilityArtifactWithinStructuralLimits milliScale
      1 4 4 3 9 NontrivialIndependent componentMilliErrorCost
      nontrivialSource 1 componentWireReport componentWirePaths =
        some componentCanonicalIntegerReport := by
  exact (verifyWireWithinStructuralLimits_eq_some_iff milliScale 1 4 4
    3 9 NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentWireReport componentWirePaths
    componentCanonicalIntegerReport).mpr
      ⟨componentWireArtifact_structuralLimits,
        componentWireArtifact_withMargin_accepted⟩

/-- The per-list bound is load-bearing: every report/path artifact is
mathematically valid, but a policy smaller than the three-edit target refuses
it before parsing. -/
theorem componentWireArtifact_targetLength_limit_rejected :
    verifyWireReliabilityArtifactWithinStructuralLimits milliScale
      1 4 4 2 9 NontrivialIndependent componentMilliErrorCost
      nontrivialSource 1 componentWireReport componentWirePaths = none := by
  have outside :
      ¬WireArtifactWithinStructuralLimits 2 9 componentWireReport
        componentWirePaths := by
    native_decide
  simp [verifyWireReliabilityArtifactWithinStructuralLimits, outside]

/-- Aggregate control is independent: all individual lists fit length three,
but their combined nine edit occurrences exceed a total limit of eight. -/
theorem componentWireArtifact_totalTargetEdits_limit_rejected :
    verifyWireReliabilityArtifactWithinStructuralLimits milliScale
      1 4 4 3 8 NontrivialIndependent componentMilliErrorCost
      nontrivialSource 1 componentWireReport componentWirePaths = none := by
  have outside :
      ¬WireArtifactWithinStructuralLimits 3 8 componentWireReport
        componentWirePaths := by
    native_decide
  simp [verifyWireReliabilityArtifactWithinStructuralLimits, outside]

theorem componentWireArtifact_lowStructuralPolicy_still_certified :
    componentCanonicalIntegerReport.verdict = .certifiedStable :=
  componentCanonicalIntegerReport_verdict

theorem componentWireArtifact_resource_refusal_not_instability :
    verifyWireReliabilityArtifactWithinStructuralLimits milliScale
        1 4 4 3 8 NontrivialIndependent componentMilliErrorCost
        nontrivialSource 1 componentWireReport componentWirePaths = none ∧
      componentCanonicalIntegerReport.verdict = .certifiedStable :=
  ⟨componentWireArtifact_totalTargetEdits_limit_rejected,
    componentWireArtifact_lowStructuralPolicy_still_certified⟩

end Sprawlens.FixedPointWireResourceLimits
