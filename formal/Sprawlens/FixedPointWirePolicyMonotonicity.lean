import Sprawlens.FixedPointWireDiagnostic

namespace Sprawlens.FixedPointWirePolicyMonotonicity

open FixedPointWireArtifact
open FixedPointCanonicalProvenance
open FixedPointWireDiagnostic
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointWirePayloadBudget
open FixedPointWireResourceLimits
open PathwiseNontrivialImprovementWitness

universe u

theorem allWireStepTargetsWithin_mono
    {Edit : Type u} {smaller larger : Nat}
    (limitLe : smaller ≤ larger)
    (steps : List (WireTaggedPathStep Edit))
    (within : AllWireStepTargetsWithin smaller steps) :
    AllWireStepTargetsWithin larger steps := by
  induction steps with
  | nil => trivial
  | cons step remaining inductionHypothesis =>
      simp only [AllWireStepTargetsWithin] at within ⊢
      exact ⟨within.1.trans limitLe, inductionHypothesis within.2⟩

theorem wireModePathTargetsWithin_mono
    {Edit : Type u} {smaller larger : Nat}
    (limitLe : smaller ≤ larger)
    (paths : WireModePaths Edit)
    (within : WireModePathTargetsWithin smaller paths) :
    WireModePathTargetsWithin larger paths := by
  cases paths with
  | twoSided selected comparison =>
      simp only [WireModePathTargetsWithin] at within ⊢
      exact ⟨allWireStepTargetsWithin_mono limitLe selected within.1,
        allWireStepTargetsWithin_mono limitLe comparison within.2⟩
  | overestimate comparison =>
      exact allWireStepTargetsWithin_mono limitLe comparison within
  | underestimate selected =>
      exact allWireStepTargetsWithin_mono limitLe selected within

theorem wireReportTargetsWithin_mono
    {Edit : Type u} {smaller larger : Nat}
    (limitLe : smaller ≤ larger)
    (report : WireTaggedIntegerReport Edit)
    (within : WireReportTargetsWithin smaller report) :
    WireReportTargetsWithin larger report := by
  unfold WireReportTargetsWithin at within ⊢
  exact ⟨within.1.trans limitLe, within.2.trans limitLe⟩

theorem wireArtifactWithinStructuralLimits_mono
    {Edit : Type u}
    {targetSmaller targetLarger totalSmaller totalLarger : Nat}
    (targetLe : targetSmaller ≤ targetLarger)
    (totalLe : totalSmaller ≤ totalLarger)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit)
    (within : WireArtifactWithinStructuralLimits targetSmaller totalSmaller
      report paths) :
    WireArtifactWithinStructuralLimits targetLarger totalLarger report
      paths := by
  unfold WireArtifactWithinStructuralLimits at within ⊢
  exact ⟨wireReportTargetsWithin_mono targetLe report within.1,
    wireModePathTargetsWithin_mono targetLe paths within.2.1,
    within.2.2.trans totalLe⟩

theorem wireArtifactWithinSchemaBudget_mono
    {Edit : Type u} (editWeight : Edit → Nat)
    {smaller larger : Nat} (budgetLe : smaller ≤ larger)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit)
    (within : WireArtifactWithinSchemaBudget editWeight smaller report paths) :
    WireArtifactWithinSchemaBudget editWeight larger report paths := by
  unfold WireArtifactWithinSchemaBudget at within ⊢
  exact within.trans budgetLe

/-- Relaxing only the outer structural/schema policy cannot turn an accepted
report into a refusal or a different report. Parsing and numeric limits remain
fixed in this theorem. -/
theorem checkWire_accepted_mono_outerPolicy
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (targetSmaller targetLarger totalSmaller totalLarger : Nat)
    (targetLe : targetSmaller ≤ targetLarger)
    (totalLe : totalSmaller ≤ totalLarger)
    (editWeight : Edit → Nat)
    (schemaSmaller schemaLarger : Nat)
    (schemaLe : schemaSmaller ≤ schemaLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit scale)
    (accepted : checkWireReliabilityArtifact scale maxSteps maxScaleBytes
      maxUnitBytes targetSmaller totalSmaller editWeight schemaSmaller
      Independent encodedCost source actualMargin rawReport rawPaths =
        .accepted result) :
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
      targetLarger totalLarger editWeight schemaLarger Independent encodedCost
      source actualMargin rawReport rawPaths = .accepted result := by
  have info := (checkWire_eq_accepted_iff scale maxSteps maxScaleBytes
    maxUnitBytes targetSmaller totalSmaller editWeight schemaSmaller
    Independent encodedCost source actualMargin rawReport rawPaths result).mp
      accepted
  exact (checkWire_eq_accepted_iff scale maxSteps maxScaleBytes maxUnitBytes
    targetLarger totalLarger editWeight schemaLarger Independent encodedCost
    source actualMargin rawReport rawPaths result).mpr
      ⟨wireArtifactWithinStructuralLimits_mono targetLe totalLe rawReport
          rawPaths info.1,
        wireArtifactWithinSchemaBudget_mono editWeight schemaLe rawReport
          rawPaths info.2.1,
        info.2.2⟩

theorem checkWire_validationLimitExceeded_mono_outerPolicy
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (targetSmaller targetLarger totalSmaller totalLarger : Nat)
    (targetLe : targetSmaller ≤ targetLarger)
    (totalLe : totalSmaller ≤ totalLarger)
    (editWeight : Edit → Nat)
    (schemaSmaller schemaLarger : Nat)
    (schemaLe : schemaSmaller ≤ schemaLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (refused : checkWireReliabilityArtifact scale maxSteps maxScaleBytes
      maxUnitBytes targetSmaller totalSmaller editWeight schemaSmaller
      Independent encodedCost source actualMargin rawReport rawPaths =
        .validationLimitExceeded) :
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
      targetLarger totalLarger editWeight schemaLarger Independent encodedCost
      source actualMargin rawReport rawPaths = .validationLimitExceeded := by
  have info := (checkWire_eq_validationLimitExceeded_iff scale maxSteps
    maxScaleBytes maxUnitBytes targetSmaller totalSmaller editWeight
    schemaSmaller Independent encodedCost source actualMargin rawReport
    rawPaths).mp refused
  exact (checkWire_eq_validationLimitExceeded_iff scale maxSteps
    maxScaleBytes maxUnitBytes targetLarger totalLarger editWeight schemaLarger
    Independent encodedCost source actualMargin rawReport rawPaths).mpr
      ⟨wireArtifactWithinStructuralLimits_mono targetLe totalLe rawReport
          rawPaths info.1,
        wireArtifactWithinSchemaBudget_mono editWeight schemaLe rawReport
          rawPaths info.2.1,
        info.2.2⟩

/-- If validation itself fails after the outer policies pass, relaxing those
policies preserves artifact invalidity rather than relabeling it as accepted. -/
theorem checkWire_invalidArtifact_mono_outerPolicy
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (targetSmaller targetLarger totalSmaller totalLarger : Nat)
    (targetLe : targetSmaller ≤ targetLarger)
    (totalLe : totalSmaller ≤ totalLarger)
    (editWeight : Edit → Nat)
    (schemaSmaller schemaLarger : Nat)
    (schemaLe : schemaSmaller ≤ schemaLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (invalid : checkWireReliabilityArtifact scale maxSteps maxScaleBytes
      maxUnitBytes targetSmaller totalSmaller editWeight schemaSmaller
      Independent encodedCost source actualMargin rawReport rawPaths =
        .invalidArtifact) :
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
      targetLarger totalLarger editWeight schemaLarger Independent encodedCost
      source actualMargin rawReport rawPaths = .invalidArtifact := by
  have info := (checkWire_eq_invalidArtifact_iff scale maxSteps maxScaleBytes
    maxUnitBytes targetSmaller totalSmaller editWeight schemaSmaller
    Independent encodedCost source actualMargin rawReport rawPaths).mp invalid
  exact (checkWire_eq_invalidArtifact_iff scale maxSteps maxScaleBytes
    maxUnitBytes targetLarger totalLarger editWeight schemaLarger Independent
    encodedCost source actualMargin rawReport rawPaths).mpr
      ⟨wireArtifactWithinStructuralLimits_mono targetLe totalLe rawReport
          rawPaths info.1,
        wireArtifactWithinSchemaBudget_mono editWeight schemaLe rawReport
          rawPaths info.2.1,
        info.2.2⟩

/-! ## Exact policy-boundary witnesses -/

theorem componentWireArtifact_structuralPolicy_threshold :
    checkWireReliabilityArtifact milliScale 1 4 4 3 8 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths = .structuralLimitExceeded ∧
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths =
          .accepted componentCanonicalIntegerReport :=
  ⟨componentWireArtifact_diagnostic_structuralLimitExceeded,
    componentWireArtifact_diagnostic_accepted⟩

theorem componentWireArtifact_schemaPolicy_threshold :
    checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 31
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths = .schemaBudgetExceeded ∧
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths =
          .accepted componentCanonicalIntegerReport :=
  ⟨componentWireArtifact_diagnostic_schemaBudgetExceeded,
    componentWireArtifact_diagnostic_accepted⟩

theorem componentWireArtifact_stepPolicy_threshold :
    checkWireReliabilityArtifact milliScale 0 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths = .validationLimitExceeded ∧
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths =
          .accepted componentCanonicalIntegerReport :=
  ⟨componentWireArtifact_diagnostic_stepLimitExceeded,
    componentWireArtifact_diagnostic_accepted⟩

theorem componentWireArtifact_scaleBytePolicy_threshold :
    checkWireReliabilityArtifact milliScale 1 3 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths = .validationLimitExceeded ∧
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths =
          .accepted componentCanonicalIntegerReport :=
  ⟨componentWireArtifact_diagnostic_scaleByteLimitExceeded,
    componentWireArtifact_diagnostic_accepted⟩

theorem componentWireArtifact_unitBytePolicy_threshold :
    checkWireReliabilityArtifact milliScale 1 4 3 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths = .validationLimitExceeded ∧
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentWireReport componentWirePaths =
          .accepted componentCanonicalIntegerReport :=
  ⟨componentWireArtifact_diagnostic_unitByteLimitExceeded,
    componentWireArtifact_diagnostic_accepted⟩

theorem componentWireArtifact_accepted_under_relaxedOuterPolicy :
    checkWireReliabilityArtifact milliScale 1 4 4 4 10 oneBytePerEdit 100
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths =
        .accepted componentCanonicalIntegerReport := by
  exact checkWire_accepted_mono_outerPolicy milliScale 1 4 4 3 4 9 10
    (by omega) (by omega) oneBytePerEdit 32 100 (by omega)
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentWireReport componentWirePaths componentCanonicalIntegerReport
    componentWireArtifact_diagnostic_accepted

theorem leadingZeroScaleWireReport_invalid_under_relaxedOuterPolicy :
    checkWireReliabilityArtifact milliScale 1 5 4 4 10 oneBytePerEdit 200
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      leadingZeroScaleWireReport componentWirePaths = .invalidArtifact := by
  exact checkWire_invalidArtifact_mono_outerPolicy milliScale 1 5 4
    3 4 9 10 (by omega) (by omega) oneBytePerEdit 100 200 (by omega)
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    leadingZeroScaleWireReport componentWirePaths
    leadingZeroScaleWireReport_diagnostic_invalidArtifact

end Sprawlens.FixedPointWirePolicyMonotonicity
