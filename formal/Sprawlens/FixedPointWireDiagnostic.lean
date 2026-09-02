import Sprawlens.FixedPointWireValidationLimits

namespace Sprawlens.FixedPointWireDiagnostic

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointWireArtifact
open FixedPointWirePayloadBudget
open FixedPointWireResourceLimits
open FixedPointWireValidationLimits
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u

/-- A transport/policy refusal is kept distinct from artifact invalidity.
None of these constructors claims that the represented geometry is unstable. -/
inductive WireArtifactCheckResult
    (Edit : Type u) (scale : PositiveScale) where
  | structuralLimitExceeded
  | schemaBudgetExceeded
  | validationLimitExceeded
  | invalidArtifact
  | accepted (report : IntegerReliabilityReport Edit scale)

/-- Compatibility projection for callers that have not yet adopted diagnostic
outcomes. It intentionally forgets why validation did not return a report. -/
def WireArtifactCheckResult.toOption
    {Edit : Type u} {scale : PositiveScale} :
    WireArtifactCheckResult Edit scale →
      Option (IntegerReliabilityReport Edit scale)
  | .structuralLimitExceeded => none
  | .schemaBudgetExceeded => none
  | .validationLimitExceeded => none
  | .invalidArtifact => none
  | .accepted report => some report

/-- Run cheap structural and schema guards before parsing and graph checking,
while preserving the reason that no reliability report was returned. -/
noncomputable def checkWireReliabilityArtifact
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
    WireArtifactCheckResult Edit scale :=
  if _structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths then
    if _schema : WireArtifactWithinSchemaBudget editWeight maxSchemaWeight
        rawReport rawPaths then
      if _validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths then
        match verifyWireReliabilityArtifactWithMargin scale maxSteps
            maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths with
        | none => .invalidArtifact
        | some report => .accepted report
      else .validationLimitExceeded
    else .schemaBudgetExceeded
  else .structuralLimitExceeded

theorem checkWire_eq_structuralLimitExceeded_iff
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
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin rawReport rawPaths =
        (.structuralLimitExceeded : WireArtifactCheckResult Edit scale) ↔
      ¬WireArtifactWithinStructuralLimits maxTargetLength
        maxTotalTargetEdits rawReport rawPaths := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths
    · by_cases validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths
      · cases verified : verifyWireReliabilityArtifactWithMargin scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths <;>
          simp [checkWireReliabilityArtifact, structural, schema, validation,
            verified]
      · simp [checkWireReliabilityArtifact, structural, schema, validation]
    · simp [checkWireReliabilityArtifact, structural, schema]
  · simp [checkWireReliabilityArtifact, structural]

theorem checkWire_eq_schemaBudgetExceeded_iff
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
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin rawReport rawPaths =
        (.schemaBudgetExceeded : WireArtifactCheckResult Edit scale) ↔
      WireArtifactWithinStructuralLimits maxTargetLength
          maxTotalTargetEdits rawReport rawPaths ∧
        ¬WireArtifactWithinSchemaBudget editWeight maxSchemaWeight
          rawReport rawPaths := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths
    · by_cases validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths
      · cases verified : verifyWireReliabilityArtifactWithMargin scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths <;>
          simp [checkWireReliabilityArtifact, structural, schema, validation,
            verified]
      · simp [checkWireReliabilityArtifact, structural, schema, validation]
    · simp [checkWireReliabilityArtifact, structural, schema]
  · simp [checkWireReliabilityArtifact, structural]

theorem checkWire_eq_validationLimitExceeded_iff
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
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin rawReport rawPaths =
        (.validationLimitExceeded : WireArtifactCheckResult Edit scale) ↔
      WireArtifactWithinStructuralLimits maxTargetLength
          maxTotalTargetEdits rawReport rawPaths ∧
        WireArtifactWithinSchemaBudget editWeight maxSchemaWeight rawReport
            rawPaths ∧
          ¬WireArtifactWithinValidationLimits maxSteps maxScaleBytes
            maxUnitBytes rawReport rawPaths := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths
    · by_cases validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths
      · cases verified : verifyWireReliabilityArtifactWithMargin scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths <;>
          simp [checkWireReliabilityArtifact, structural, schema, validation,
            verified]
      · simp [checkWireReliabilityArtifact, structural, schema, validation]
    · simp [checkWireReliabilityArtifact, structural, schema]
  · simp [checkWireReliabilityArtifact, structural]

theorem checkWire_eq_invalidArtifact_iff
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
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin rawReport rawPaths =
        (.invalidArtifact : WireArtifactCheckResult Edit scale) ↔
      WireArtifactWithinStructuralLimits maxTargetLength
          maxTotalTargetEdits rawReport rawPaths ∧
        WireArtifactWithinSchemaBudget editWeight maxSchemaWeight rawReport
            rawPaths ∧
          WireArtifactWithinValidationLimits maxSteps maxScaleBytes
              maxUnitBytes rawReport rawPaths ∧
            verifyWireReliabilityArtifactWithMargin scale maxSteps
              maxScaleBytes maxUnitBytes Independent encodedCost source
              actualMargin rawReport rawPaths = none := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths
    · by_cases validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths
      · cases verified : verifyWireReliabilityArtifactWithMargin scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths <;>
          simp [checkWireReliabilityArtifact, structural, schema, validation,
            verified]
      · simp [checkWireReliabilityArtifact, structural, schema, validation]
    · simp [checkWireReliabilityArtifact, structural, schema]
  · simp [checkWireReliabilityArtifact, structural]

theorem checkWire_eq_accepted_iff
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
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin rawReport rawPaths =
        .accepted result ↔
      WireArtifactWithinStructuralLimits maxTargetLength
          maxTotalTargetEdits rawReport rawPaths ∧
        WireArtifactWithinSchemaBudget editWeight maxSchemaWeight rawReport
            rawPaths ∧
          WireArtifactWithinValidationLimits maxSteps maxScaleBytes
              maxUnitBytes rawReport rawPaths ∧
            verifyWireReliabilityArtifactWithMargin scale maxSteps
              maxScaleBytes maxUnitBytes Independent encodedCost source
              actualMargin rawReport rawPaths = some result := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths
    · by_cases validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths
      · cases verified : verifyWireReliabilityArtifactWithMargin scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths <;>
          simp [checkWireReliabilityArtifact, structural, schema, validation,
            verified]
      · simp [checkWireReliabilityArtifact, structural, schema, validation]
    · simp [checkWireReliabilityArtifact, structural, schema]
  · simp [checkWireReliabilityArtifact, structural]

/-- Erasing the diagnostic tag recovers the old combined Option checker
exactly, not merely on the positive fixture. -/
theorem checkWire_toOption_eq_verifyWithinSchemaBudget
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
    (checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin rawReport rawPaths).toOption =
        verifyWireReliabilityArtifactWithinSchemaBudget scale maxSteps
          maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
          editWeight maxSchemaWeight Independent encodedCost source
          actualMargin rawReport rawPaths := by
  by_cases structural : WireArtifactWithinStructuralLimits maxTargetLength
      maxTotalTargetEdits rawReport rawPaths
  · by_cases schema : WireArtifactWithinSchemaBudget editWeight
        maxSchemaWeight rawReport rawPaths
    · by_cases validation : WireArtifactWithinValidationLimits maxSteps
          maxScaleBytes maxUnitBytes rawReport rawPaths
      · cases verified : verifyWireReliabilityArtifactWithMargin scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths <;>
          simp [checkWireReliabilityArtifact,
            verifyWireReliabilityArtifactWithinSchemaBudget,
            WireArtifactCheckResult.toOption, structural, schema, validation,
            verified]
      · have rejected :=
          verifyWireReliabilityArtifact_none_of_validationLimits_failure scale
            maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
            actualMargin rawReport rawPaths validation
        simp [checkWireReliabilityArtifact,
          verifyWireReliabilityArtifactWithinSchemaBudget,
          WireArtifactCheckResult.toOption, structural, schema, validation,
          rejected]
    · simp [checkWireReliabilityArtifact,
        verifyWireReliabilityArtifactWithinSchemaBudget,
        WireArtifactCheckResult.toOption, structural, schema]
  · simp [checkWireReliabilityArtifact,
      verifyWireReliabilityArtifactWithinSchemaBudget,
      WireArtifactCheckResult.toOption, structural]

/-- The diagnostic API refines the old Option API without changing which
validated report is accepted. -/
theorem checkWire_accepted_iff_verifyWithinSchemaBudget_some
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
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin rawReport rawPaths =
        .accepted result ↔
      verifyWireReliabilityArtifactWithinSchemaBudget scale maxSteps
        maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
        editWeight maxSchemaWeight Independent encodedCost source actualMargin
        rawReport rawPaths = some result := by
  constructor
  · intro accepted
    have info := (checkWire_eq_accepted_iff scale maxSteps maxScaleBytes
      maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin rawReport
      rawPaths result).mp accepted
    exact (verifyWireWithinSchemaBudget_eq_some_iff scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin rawReport
      rawPaths result).mpr ⟨info.1, info.2.1, info.2.2.2⟩
  · intro accepted
    have info := (verifyWireWithinSchemaBudget_eq_some_iff scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin rawReport
      rawPaths result).mp accepted
    have validation :=
      verifyWireReliabilityArtifact_validationLimits_of_some scale maxSteps
        maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
        rawReport rawPaths result info.2.2
    exact (checkWire_eq_accepted_iff scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin rawReport rawPaths result).mpr
        ⟨info.1, info.2.1, validation, info.2.2⟩

theorem checkWire_target_eq_of_certified
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
    (accepted : checkWireReliabilityArtifact scale maxSteps maxScaleBytes
      maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin rawReport
      rawPaths = .accepted result)
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  have oldAccepted :=
    (checkWire_accepted_iff_verifyWithinSchemaBudget_some scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      rawReport rawPaths result).mp accepted
  exact wireArtifactWithinSchemaBudget_target_eq_of_certified scale maxSteps
    maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
    maxSchemaWeight Independent exactCost approximateCost encodedCost source
    actualMargin rawReport rawPaths result within marginNonnegative stable
    oldAccepted certified

/-! ## Load-bearing outcome witnesses -/

theorem componentWireArtifact_validationLimits :
    WireArtifactWithinValidationLimits 1 4 4 componentWireReport
      componentWirePaths := by
  native_decide

theorem componentWireArtifact_diagnostic_accepted :
    checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths =
        .accepted componentCanonicalIntegerReport := by
  exact (checkWire_eq_accepted_iff milliScale 1 4 4 3 9 oneBytePerEdit 32
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentWireReport componentWirePaths componentCanonicalIntegerReport).mpr
      ⟨componentWireArtifact_structuralLimits,
        componentWireArtifact_oneByteSchemaBudget,
        componentWireArtifact_validationLimits,
        componentWireArtifact_withMargin_accepted⟩

/-- Structural refusal wins before any schema or artifact validation. -/
theorem componentWireArtifact_diagnostic_structuralLimitExceeded :
    checkWireReliabilityArtifact milliScale 1 4 4 3 8 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths =
        .structuralLimitExceeded := by
  apply (checkWire_eq_structuralLimitExceeded_iff milliScale 1 4 4 3 8
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths).mpr
  native_decide

/-- Once structural limits pass, the exact one-byte schema boundary selects
the schema-specific refusal constructor. -/
theorem componentWireArtifact_diagnostic_schemaBudgetExceeded :
    checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 31
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths = .schemaBudgetExceeded := by
  apply (checkWire_eq_schemaBudgetExceeded_iff milliScale 1 4 4 3 9
    oneBytePerEdit 31 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths).mpr
  exact ⟨componentWireArtifact_structuralLimits, by native_decide⟩

/-- Generous transport budgets do not relabel a noncanonical scale alias as a
resource refusal: it reaches validation and is classified as invalid. -/
theorem leadingZeroScaleWireReport_diagnostic_invalidArtifact :
    checkWireReliabilityArtifact milliScale 1 5 4 3 9 oneBytePerEdit 100
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      leadingZeroScaleWireReport componentWirePaths = .invalidArtifact := by
  apply (checkWire_eq_invalidArtifact_iff milliScale 1 5 4 3 9
    oneBytePerEdit 100 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 leadingZeroScaleWireReport componentWirePaths).mpr
  exact ⟨by native_decide, by native_decide, by native_decide,
    leadingZeroScaleWireReport_rejected⟩

theorem componentWireArtifact_diagnostic_stepLimitExceeded :
    checkWireReliabilityArtifact milliScale 0 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths = .validationLimitExceeded := by
  apply (checkWire_eq_validationLimitExceeded_iff milliScale 0 4 4 3 9
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths).mpr
  exact ⟨componentWireArtifact_structuralLimits,
    componentWireArtifact_oneByteSchemaBudget, by native_decide⟩

theorem componentWireArtifact_diagnostic_scaleByteLimitExceeded :
    checkWireReliabilityArtifact milliScale 1 3 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths = .validationLimitExceeded := by
  apply (checkWire_eq_validationLimitExceeded_iff milliScale 1 3 4 3 9
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths).mpr
  exact ⟨componentWireArtifact_structuralLimits,
    componentWireArtifact_oneByteSchemaBudget, by native_decide⟩

theorem componentWireArtifact_diagnostic_unitByteLimitExceeded :
    checkWireReliabilityArtifact milliScale 1 4 3 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths = .validationLimitExceeded := by
  apply (checkWire_eq_validationLimitExceeded_iff milliScale 1 4 3 3 9
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths).mpr
  exact ⟨componentWireArtifact_structuralLimits,
    componentWireArtifact_oneByteSchemaBudget, by native_decide⟩

theorem componentWireArtifact_structuralRefusal_not_invalid :
    checkWireReliabilityArtifact milliScale 1 4 4 3 8 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths ≠ .invalidArtifact := by
  rw [componentWireArtifact_diagnostic_structuralLimitExceeded]
  simp

theorem componentWireArtifact_schemaRefusal_not_invalid :
    checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 31
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths ≠ .invalidArtifact := by
  rw [componentWireArtifact_diagnostic_schemaBudgetExceeded]
  simp

theorem componentWireArtifact_validationRefusal_not_invalid :
    checkWireReliabilityArtifact milliScale 0 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths ≠ .invalidArtifact := by
  rw [componentWireArtifact_diagnostic_stepLimitExceeded]
  simp

/-- Artifact invalidity also is not a theorem of geometric instability: the
underlying genuine report for this altered transport payload is certified. -/
theorem leadingZeroScaleWireReport_invalid_not_instability :
    checkWireReliabilityArtifact milliScale 1 5 4 3 9 oneBytePerEdit 100
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        leadingZeroScaleWireReport componentWirePaths = .invalidArtifact ∧
      componentCanonicalIntegerReport.verdict = .certifiedStable :=
  ⟨leadingZeroScaleWireReport_diagnostic_invalidArtifact,
    componentCanonicalIntegerReport_verdict⟩

end Sprawlens.FixedPointWireDiagnostic
