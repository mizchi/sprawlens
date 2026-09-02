import Sprawlens.FixedPointWireResourceLimits

namespace Sprawlens.FixedPointWirePayloadBudget

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalArtifact
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointMarginProvenance
open FixedPointPathDataWitness
open FixedPointWireArtifact
open FixedPointWireResourceLimits
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u

def editListWeight
    {Edit : Type u} (editWeight : Edit → Nat) : List Edit → Nat
  | [] => 0
  | edit :: remaining => editWeight edit + editListWeight editWeight remaining

def wireCostNumericBytes (cost : WireTaggedIntCost) : Nat :=
  cost.scaleDecimal.utf8ByteSize + cost.unitsDecimal.utf8ByteSize

def wireReportNumericBytes
    {Edit : Type u} (report : WireTaggedIntegerReport Edit) : Nat :=
  wireCostNumericBytes report.margin +
  wireCostNumericBytes report.selectedError +
  wireCostNumericBytes report.comparisonError

def wireReportEditWeight
    {Edit : Type u} (editWeight : Edit → Nat)
    (report : WireTaggedIntegerReport Edit) : Nat :=
  editListWeight editWeight report.selectedTarget +
  editListWeight editWeight report.bestTarget

def wireStepNumericBytes
    {Edit : Type u} (step : WireTaggedPathStep Edit) : Nat :=
  wireCostNumericBytes step.cost

def wireStepEditWeight
    {Edit : Type u} (editWeight : Edit → Nat)
    (step : WireTaggedPathStep Edit) : Nat :=
  editListWeight editWeight step.next

def wireStepsNumericBytes
    {Edit : Type u} : List (WireTaggedPathStep Edit) → Nat
  | [] => 0
  | step :: remaining =>
      wireStepNumericBytes step + wireStepsNumericBytes remaining

def wireStepsEditWeight
    {Edit : Type u} (editWeight : Edit → Nat) :
    List (WireTaggedPathStep Edit) → Nat
  | [] => 0
  | step :: remaining =>
      wireStepEditWeight editWeight step +
        wireStepsEditWeight editWeight remaining

def WireModePaths.numericBytes
    {Edit : Type u} : WireModePaths Edit → Nat
  | .twoSided selected comparison =>
      wireStepsNumericBytes selected + wireStepsNumericBytes comparison
  | .overestimate comparison => wireStepsNumericBytes comparison
  | .underestimate selected => wireStepsNumericBytes selected

def WireModePaths.editWeight
    {Edit : Type u} (editWeight : Edit → Nat) : WireModePaths Edit → Nat
  | .twoSided selected comparison =>
      wireStepsEditWeight editWeight selected +
        wireStepsEditWeight editWeight comparison
  | .overestimate comparison => wireStepsEditWeight editWeight comparison
  | .underestimate selected => wireStepsEditWeight editWeight selected

/-- Bytes of numeric strings plus a caller-supplied weight for every serialized
Edit occurrence. JSON keys, quotes, separators, and escaping overhead are not
silently guessed; production must add or independently bound that envelope. -/
def wireArtifactSchemaWeight
    {Edit : Type u} (editWeight : Edit → Nat)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit) : Nat :=
  wireReportNumericBytes report + WireModePaths.numericBytes paths +
  wireReportEditWeight editWeight report +
    WireModePaths.editWeight editWeight paths

def AllEditWeightsWithin
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat) :
    List Edit → Prop
  | [] => True
  | edit :: remaining =>
      editWeight edit ≤ maxEditWeight ∧
      AllEditWeightsWithin editWeight maxEditWeight remaining

instance allEditWeightsWithinDecidable
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat)
    (edits : List Edit) :
    Decidable (AllEditWeightsWithin editWeight maxEditWeight edits) := by
  induction edits with
  | nil => exact isTrue trivial
  | cons edit remaining inductionHypothesis =>
      simp [AllEditWeightsWithin]
      infer_instance

def AllWireStepEditWeightsWithin
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat) :
    List (WireTaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      AllEditWeightsWithin editWeight maxEditWeight step.next ∧
      AllWireStepEditWeightsWithin editWeight maxEditWeight remaining

def WireModeEditWeightsWithin
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat) :
    WireModePaths Edit → Prop
  | .twoSided selected comparison =>
      AllWireStepEditWeightsWithin editWeight maxEditWeight selected ∧
      AllWireStepEditWeightsWithin editWeight maxEditWeight comparison
  | .overestimate comparison =>
      AllWireStepEditWeightsWithin editWeight maxEditWeight comparison
  | .underestimate selected =>
      AllWireStepEditWeightsWithin editWeight maxEditWeight selected

def WireArtifactEditWeightsWithin
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit) : Prop :=
  AllEditWeightsWithin editWeight maxEditWeight report.selectedTarget ∧
  AllEditWeightsWithin editWeight maxEditWeight report.bestTarget ∧
  WireModeEditWeightsWithin editWeight maxEditWeight paths

theorem editListWeight_le
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat)
    (edits : List Edit)
    (within : AllEditWeightsWithin editWeight maxEditWeight edits) :
    editListWeight editWeight edits ≤ edits.length * maxEditWeight := by
  induction edits with
  | nil => simp [editListWeight]
  | cons edit remaining inductionHypothesis =>
      simp only [AllEditWeightsWithin] at within
      have remainingBound := inductionHypothesis within.2
      simp only [editListWeight, List.length_cons, Nat.succ_mul]
      omega

theorem wireStepsEditWeight_le
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat)
    (steps : List (WireTaggedPathStep Edit))
    (within : AllWireStepEditWeightsWithin editWeight maxEditWeight steps) :
    wireStepsEditWeight editWeight steps ≤
      wireStepsTargetEditCount steps * maxEditWeight := by
  induction steps with
  | nil => simp [wireStepsEditWeight, wireStepsTargetEditCount]
  | cons step remaining inductionHypothesis =>
      simp only [AllWireStepEditWeightsWithin] at within
      simp only [wireStepsEditWeight, wireStepsTargetEditCount,
        Nat.add_mul]
      exact Nat.add_le_add
        (editListWeight_le editWeight maxEditWeight step.next within.1)
        (inductionHypothesis within.2)

theorem wireModeEditWeight_le
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat)
    (paths : WireModePaths Edit)
    (within : WireModeEditWeightsWithin editWeight maxEditWeight paths) :
    WireModePaths.editWeight editWeight paths ≤
      WireModePaths.targetEditCount paths * maxEditWeight := by
  cases paths with
  | twoSided selected comparison =>
      simp only [WireModeEditWeightsWithin] at within
      simp only [WireModePaths.editWeight,
        WireModePaths.targetEditCount, Nat.add_mul]
      exact Nat.add_le_add
        (wireStepsEditWeight_le editWeight maxEditWeight selected within.1)
        (wireStepsEditWeight_le editWeight maxEditWeight comparison within.2)
  | overestimate comparison =>
      exact wireStepsEditWeight_le editWeight maxEditWeight comparison within
  | underestimate selected =>
      exact wireStepsEditWeight_le editWeight maxEditWeight selected within

theorem wireArtifactEditWeight_le
    {Edit : Type u} (editWeight : Edit → Nat) (maxEditWeight : Nat)
    (report : WireTaggedIntegerReport Edit) (paths : WireModePaths Edit)
    (within : WireArtifactEditWeightsWithin editWeight maxEditWeight
      report paths) :
    wireReportEditWeight editWeight report +
        WireModePaths.editWeight editWeight paths ≤
      wireArtifactTargetEditCount report paths * maxEditWeight := by
  have selectedBound := editListWeight_le editWeight maxEditWeight
    report.selectedTarget within.1
  have bestBound := editListWeight_le editWeight maxEditWeight
    report.bestTarget within.2.1
  have pathsBound := wireModeEditWeight_le editWeight maxEditWeight paths
    within.2.2
  unfold wireReportEditWeight wireArtifactTargetEditCount
  rw [Nat.add_mul, Nat.add_mul]
  omega

def WireArtifactWithinSchemaBudget
    {Edit : Type u} (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit) : Prop :=
  wireArtifactSchemaWeight editWeight report paths ≤ maxSchemaWeight

instance wireArtifactWithinSchemaBudgetDecidable
    {Edit : Type u} (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (report : WireTaggedIntegerReport Edit) (paths : WireModePaths Edit) :
    Decidable (WireArtifactWithinSchemaBudget editWeight maxSchemaWeight
      report paths) := by
  unfold WireArtifactWithinSchemaBudget
  infer_instance

/-- Structural guards run first. The schema-weight traversal then runs before
numeric parsing and graph verification. -/
noncomputable def verifyWireReliabilityArtifactWithinSchemaBudget
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit) :
    Option (IntegerReliabilityReport Edit scale) :=
  if _structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths then
    if _schema : WireArtifactWithinSchemaBudget editWeight maxSchemaWeight
        rawReport rawPaths then
      verifyWireReliabilityArtifactWithMargin scale maxSteps maxScaleBytes
        maxUnitBytes Independent encodedCost source actualMargin rawReport
        rawPaths
    else none
  else none

theorem verifyWireWithinSchemaBudget_eq_some_iff
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit scale) :
    verifyWireReliabilityArtifactWithinSchemaBudget scale maxSteps
        maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
        editWeight maxSchemaWeight Independent encodedCost source actualMargin
        rawReport rawPaths = some result ↔
      WireArtifactWithinStructuralLimits maxTargetLength maxTotalTargetEdits
        rawReport rawPaths ∧
      WireArtifactWithinSchemaBudget editWeight maxSchemaWeight rawReport
        rawPaths ∧
      verifyWireReliabilityArtifactWithMargin scale maxSteps maxScaleBytes
        maxUnitBytes Independent encodedCost source actualMargin rawReport
        rawPaths = some result := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths <;>
      simp [verifyWireReliabilityArtifactWithinSchemaBudget, structural,
        schema]
  · simp [verifyWireReliabilityArtifactWithinSchemaBudget, structural]

theorem verifyWireWithinSchemaBudget_limits
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    {result : IntegerReliabilityReport Edit scale}
    (accepted : verifyWireReliabilityArtifactWithinSchemaBudget scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      rawReport rawPaths = some result) :
    WireArtifactWithinStructuralLimits maxTargetLength maxTotalTargetEdits
        rawReport rawPaths ∧
      WireArtifactWithinSchemaBudget editWeight maxSchemaWeight rawReport
        rawPaths := by
  have info := (verifyWireWithinSchemaBudget_eq_some_iff scale maxSteps
    maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
    maxSchemaWeight Independent encodedCost source actualMargin rawReport
    rawPaths result).mp accepted
  exact ⟨info.1, info.2.1⟩

theorem verifyWireWithinSchemaBudget_complete
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    {result : IntegerReliabilityReport Edit scale}
    (structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths)
    (schema : WireArtifactWithinSchemaBudget editWeight maxSchemaWeight
      rawReport rawPaths)
    (accepted : verifyWireReliabilityArtifactWithMargin scale maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths = some result) :
    verifyWireReliabilityArtifactWithinSchemaBudget scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      rawReport rawPaths = some result :=
  (verifyWireWithinSchemaBudget_eq_some_iff scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
    maxSchemaWeight Independent encodedCost source actualMargin rawReport
    rawPaths result).mpr ⟨structural, schema, accepted⟩

theorem wireArtifactWithinSchemaBudget_target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
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
    (accepted : verifyWireReliabilityArtifactWithinSchemaBudget scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      rawReport rawPaths = some result)
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  have underlying := (verifyWireWithinSchemaBudget_eq_some_iff scale
    maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
    editWeight maxSchemaWeight Independent encodedCost source actualMargin
    rawReport rawPaths result).mp accepted |>.2.2
  exact wireArtifact_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes Independent exactCost approximateCost encodedCost source
    actualMargin rawReport rawPaths result within marginNonnegative stable
    underlying certified

def oneBytePerEdit (_ : NontrivialEdit) : Nat := 1

def hundredBytesPerEdit (_ : NontrivialEdit) : Nat := 100

theorem componentWireArtifact_numericBytes :
    wireReportNumericBytes componentWireReport +
      WireModePaths.numericBytes componentWirePaths = 23 := by
  native_decide

theorem componentWireArtifact_oneByteEditWeight :
    wireReportEditWeight oneBytePerEdit componentWireReport +
      WireModePaths.editWeight oneBytePerEdit componentWirePaths = 9 := by
  native_decide

theorem componentWireArtifact_oneByteSchemaWeight :
    wireArtifactSchemaWeight oneBytePerEdit componentWireReport
      componentWirePaths = 32 := by
  native_decide

theorem componentWireArtifact_hundredByteEditWeight :
    wireReportEditWeight hundredBytesPerEdit componentWireReport +
      WireModePaths.editWeight hundredBytesPerEdit componentWirePaths =
        900 := by
  native_decide

theorem componentWireArtifact_hundredByteSchemaWeight :
    wireArtifactSchemaWeight hundredBytesPerEdit componentWireReport
      componentWirePaths = 923 := by
  native_decide

theorem componentWireArtifact_editWeightBound_tight :
    wireReportEditWeight hundredBytesPerEdit componentWireReport +
        WireModePaths.editWeight hundredBytesPerEdit componentWirePaths =
      wireArtifactTargetEditCount componentWireReport componentWirePaths *
        100 := by
  native_decide

theorem componentWireArtifact_oneByteSchemaBudget :
    WireArtifactWithinSchemaBudget oneBytePerEdit 32 componentWireReport
      componentWirePaths := by
  native_decide

theorem componentWireArtifact_withSchemaBudget_accepted :
    verifyWireReliabilityArtifactWithinSchemaBudget milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireReport
      componentWirePaths = some componentCanonicalIntegerReport := by
  exact (verifyWireWithinSchemaBudget_eq_some_iff milliScale 1 4 4 3 9
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths
    componentCanonicalIntegerReport).mpr
      ⟨componentWireArtifact_structuralLimits,
        componentWireArtifact_oneByteSchemaBudget,
        componentWireArtifact_withMargin_accepted⟩

theorem componentWireArtifact_oneByteBudget_rejected :
    verifyWireReliabilityArtifactWithinSchemaBudget milliScale
      1 4 4 3 9 oneBytePerEdit 31 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireReport
      componentWirePaths = none := by
  have outside :
      ¬WireArtifactWithinSchemaBudget oneBytePerEdit 31 componentWireReport
        componentWirePaths := by
    native_decide
  simp [verifyWireReliabilityArtifactWithinSchemaBudget,
    componentWireArtifact_structuralLimits, outside]

theorem componentWireArtifact_hundredByteSchemaBudget :
    WireArtifactWithinSchemaBudget hundredBytesPerEdit 923
      componentWireReport componentWirePaths := by
  native_decide

theorem componentWireArtifact_withHundredByteBudget_accepted :
    verifyWireReliabilityArtifactWithinSchemaBudget milliScale
      1 4 4 3 9 hundredBytesPerEdit 923 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireReport
      componentWirePaths = some componentCanonicalIntegerReport := by
  exact (verifyWireWithinSchemaBudget_eq_some_iff milliScale 1 4 4 3 9
    hundredBytesPerEdit 923 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths
    componentCanonicalIntegerReport).mpr
      ⟨componentWireArtifact_structuralLimits,
        componentWireArtifact_hundredByteSchemaBudget,
        componentWireArtifact_withMargin_accepted⟩

theorem componentWireArtifact_hundredByteBudget_rejected :
    verifyWireReliabilityArtifactWithinSchemaBudget milliScale
      1 4 4 3 9 hundredBytesPerEdit 922 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireReport
      componentWirePaths = none := by
  have outside :
      ¬WireArtifactWithinSchemaBudget hundredBytesPerEdit 922
        componentWireReport componentWirePaths := by
    native_decide
  simp [verifyWireReliabilityArtifactWithinSchemaBudget,
    componentWireArtifact_structuralLimits, outside]

theorem componentWireArtifact_schema_refusal_not_instability :
    verifyWireReliabilityArtifactWithinSchemaBudget milliScale
        1 4 4 3 9 oneBytePerEdit 31 NontrivialIndependent
        componentMilliErrorCost nontrivialSource 1 componentWireReport
        componentWirePaths = none ∧
      componentCanonicalIntegerReport.verdict = .certifiedStable :=
  ⟨componentWireArtifact_oneByteBudget_rejected,
    componentCanonicalIntegerReport_verdict⟩

end Sprawlens.FixedPointWirePayloadBudget
