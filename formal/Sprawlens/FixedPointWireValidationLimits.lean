import Sprawlens.FixedPointWirePayloadBudget

namespace Sprawlens.FixedPointWireValidationLimits

open FixedPointCanonicalArtifact
open FixedPointCanonicalMargin
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointWireArtifact

universe u

/-- Raw numeric resource bounds only. Canonical syntax and the expected scale
value are deliberately not part of this predicate. -/
def WireNumericFieldWithinValidationLimits
    (maxScaleBytes maxUnitBytes : Nat) (raw : WireTaggedIntCost) : Prop :=
  raw.scaleDecimal.utf8ByteSize ≤ maxScaleBytes ∧
  raw.unitsDecimal.utf8ByteSize ≤ maxUnitBytes

instance wireNumericFieldWithinValidationLimitsDecidable
    (maxScaleBytes maxUnitBytes : Nat) (raw : WireTaggedIntCost) :
    Decidable (WireNumericFieldWithinValidationLimits maxScaleBytes
      maxUnitBytes raw) := by
  unfold WireNumericFieldWithinValidationLimits
  infer_instance

def AllWireStepNumericFieldsWithinValidationLimits
    {Edit : Type u} (maxScaleBytes maxUnitBytes : Nat) :
    List (WireTaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      WireNumericFieldWithinValidationLimits maxScaleBytes maxUnitBytes
          step.cost ∧
        AllWireStepNumericFieldsWithinValidationLimits maxScaleBytes
          maxUnitBytes remaining

instance allWireStepNumericFieldsWithinValidationLimitsDecidable
    {Edit : Type u} (maxScaleBytes maxUnitBytes : Nat)
    (steps : List (WireTaggedPathStep Edit)) :
    Decidable (AllWireStepNumericFieldsWithinValidationLimits maxScaleBytes
      maxUnitBytes steps) := by
  induction steps with
  | nil => exact isTrue trivial
  | cons step remaining inductionHypothesis =>
      simp [AllWireStepNumericFieldsWithinValidationLimits]
      infer_instance

def WireStepsWithinValidationLimits
    {Edit : Type u} (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (steps : List (WireTaggedPathStep Edit)) : Prop :=
  steps.length ≤ maxSteps ∧
  AllWireStepNumericFieldsWithinValidationLimits maxScaleBytes maxUnitBytes
    steps

instance wireStepsWithinValidationLimitsDecidable
    {Edit : Type u} (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (steps : List (WireTaggedPathStep Edit)) :
    Decidable (WireStepsWithinValidationLimits maxSteps maxScaleBytes
      maxUnitBytes steps) := by
  unfold WireStepsWithinValidationLimits
  infer_instance

def WireModePathsWithinValidationLimits
    {Edit : Type u} (maxSteps maxScaleBytes maxUnitBytes : Nat) :
    WireModePaths Edit → Prop
  | .twoSided selected comparison =>
      WireStepsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
          selected ∧
        WireStepsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
          comparison
  | .overestimate comparison =>
      WireStepsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
        comparison
  | .underestimate selected =>
      WireStepsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
        selected

instance wireModePathsWithinValidationLimitsDecidable
    {Edit : Type u} (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (paths : WireModePaths Edit) :
    Decidable (WireModePathsWithinValidationLimits maxSteps maxScaleBytes
      maxUnitBytes paths) := by
  cases paths <;> simp [WireModePathsWithinValidationLimits] <;>
    infer_instance

def WireReportWithinValidationLimits
    {Edit : Type u} (maxScaleBytes maxUnitBytes : Nat)
    (report : WireTaggedIntegerReport Edit) : Prop :=
  WireNumericFieldWithinValidationLimits maxScaleBytes maxUnitBytes
      report.margin ∧
    WireNumericFieldWithinValidationLimits maxScaleBytes maxUnitBytes
      report.selectedError ∧
    WireNumericFieldWithinValidationLimits maxScaleBytes maxUnitBytes
      report.comparisonError

instance wireReportWithinValidationLimitsDecidable
    {Edit : Type u} (maxScaleBytes maxUnitBytes : Nat)
    (report : WireTaggedIntegerReport Edit) :
    Decidable (WireReportWithinValidationLimits maxScaleBytes maxUnitBytes
      report) := by
  unfold WireReportWithinValidationLimits
  infer_instance

def WireArtifactWithinValidationLimits
    {Edit : Type u} (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit) : Prop :=
  WireReportWithinValidationLimits maxScaleBytes maxUnitBytes report ∧
  WireModePathsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
    paths

instance wireArtifactWithinValidationLimitsDecidable
    {Edit : Type u} (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (report : WireTaggedIntegerReport Edit) (paths : WireModePaths Edit) :
    Decidable (WireArtifactWithinValidationLimits maxSteps maxScaleBytes
      maxUnitBytes report paths) := by
  unfold WireArtifactWithinValidationLimits
  infer_instance

theorem wireNumericFieldWithinValidationLimits_mono
    {scaleSmaller scaleLarger unitSmaller unitLarger : Nat}
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (raw : WireTaggedIntCost)
    (within : WireNumericFieldWithinValidationLimits scaleSmaller unitSmaller
      raw) :
    WireNumericFieldWithinValidationLimits scaleLarger unitLarger raw := by
  unfold WireNumericFieldWithinValidationLimits at within ⊢
  exact ⟨within.1.trans scaleLe, within.2.trans unitLe⟩

theorem allWireStepNumericFieldsWithinValidationLimits_mono
    {Edit : Type u}
    {scaleSmaller scaleLarger unitSmaller unitLarger : Nat}
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (steps : List (WireTaggedPathStep Edit))
    (within : AllWireStepNumericFieldsWithinValidationLimits scaleSmaller
      unitSmaller steps) :
    AllWireStepNumericFieldsWithinValidationLimits scaleLarger unitLarger
      steps := by
  induction steps with
  | nil => trivial
  | cons step remaining inductionHypothesis =>
      simp only [AllWireStepNumericFieldsWithinValidationLimits] at within ⊢
      exact ⟨wireNumericFieldWithinValidationLimits_mono scaleLe unitLe
          step.cost within.1,
        inductionHypothesis within.2⟩

theorem wireStepsWithinValidationLimits_mono
    {Edit : Type u}
    {stepsSmaller stepsLarger scaleSmaller scaleLarger unitSmaller
      unitLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (steps : List (WireTaggedPathStep Edit))
    (within : WireStepsWithinValidationLimits stepsSmaller scaleSmaller
      unitSmaller steps) :
    WireStepsWithinValidationLimits stepsLarger scaleLarger unitLarger
      steps := by
  unfold WireStepsWithinValidationLimits at within ⊢
  exact ⟨within.1.trans stepsLe,
    allWireStepNumericFieldsWithinValidationLimits_mono scaleLe unitLe steps
      within.2⟩

theorem wireModePathsWithinValidationLimits_mono
    {Edit : Type u}
    {stepsSmaller stepsLarger scaleSmaller scaleLarger unitSmaller
      unitLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (paths : WireModePaths Edit)
    (within : WireModePathsWithinValidationLimits stepsSmaller scaleSmaller
      unitSmaller paths) :
    WireModePathsWithinValidationLimits stepsLarger scaleLarger unitLarger
      paths := by
  cases paths with
  | twoSided selected comparison =>
      simp only [WireModePathsWithinValidationLimits] at within ⊢
      exact ⟨wireStepsWithinValidationLimits_mono stepsLe scaleLe unitLe
          selected within.1,
        wireStepsWithinValidationLimits_mono stepsLe scaleLe unitLe comparison
          within.2⟩
  | overestimate comparison =>
      exact wireStepsWithinValidationLimits_mono stepsLe scaleLe unitLe
        comparison within
  | underestimate selected =>
      exact wireStepsWithinValidationLimits_mono stepsLe scaleLe unitLe
        selected within

theorem wireReportWithinValidationLimits_mono
    {Edit : Type u}
    {scaleSmaller scaleLarger unitSmaller unitLarger : Nat}
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (report : WireTaggedIntegerReport Edit)
    (within : WireReportWithinValidationLimits scaleSmaller unitSmaller
      report) :
    WireReportWithinValidationLimits scaleLarger unitLarger report := by
  unfold WireReportWithinValidationLimits at within ⊢
  exact ⟨wireNumericFieldWithinValidationLimits_mono scaleLe unitLe
      report.margin within.1,
    wireNumericFieldWithinValidationLimits_mono scaleLe unitLe
      report.selectedError within.2.1,
    wireNumericFieldWithinValidationLimits_mono scaleLe unitLe
      report.comparisonError within.2.2⟩

theorem wireArtifactWithinValidationLimits_mono
    {Edit : Type u}
    {stepsSmaller stepsLarger scaleSmaller scaleLarger unitSmaller
      unitLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (report : WireTaggedIntegerReport Edit)
    (paths : WireModePaths Edit)
    (within : WireArtifactWithinValidationLimits stepsSmaller scaleSmaller
      unitSmaller report paths) :
    WireArtifactWithinValidationLimits stepsLarger scaleLarger unitLarger
      report paths := by
  exact ⟨wireReportWithinValidationLimits_mono scaleLe unitLe report
      within.1,
    wireModePathsWithinValidationLimits_mono stepsLe scaleLe unitLe paths
      within.2⟩

/-! ## Limit recovery from successful parser layers -/

theorem wireReportWithinValidationLimits_of_parse_of_wellFormed
    {Edit : Type u} (expected : PositiveScale)
    (maxScaleBytes maxUnitBytes : Nat)
    (raw : WireTaggedIntegerReport Edit)
    (parsed : SerializedTaggedIntegerReport Edit)
    (wireAccepted : parseWireReport expected maxScaleBytes raw = some parsed)
    (wellFormed : SerializedReportWellFormed expected maxUnitBytes parsed) :
    WireReportWithinValidationLimits maxScaleBytes maxUnitBytes raw := by
  have scaleValid :=
    (exists_parseWireReport_iff expected maxScaleBytes raw).mp
      ⟨parsed, wireAccepted⟩
  unfold parseWireReport at wireAccepted
  cases marginEq : parseWireCostTag expected maxScaleBytes raw.margin with
  | none => simp [marginEq] at wireAccepted
  | some margin =>
      cases selectedEq : parseWireCostTag expected maxScaleBytes
          raw.selectedError with
      | none => simp [marginEq, selectedEq] at wireAccepted
      | some selectedError =>
          cases comparisonEq : parseWireCostTag expected maxScaleBytes
              raw.comparisonError with
          | none => simp [marginEq, selectedEq, comparisonEq] at wireAccepted
          | some comparisonError =>
              have marginValue :=
                (parseWireCostTag_eq_some_iff expected maxScaleBytes
                  raw.margin margin).mp marginEq |>.2
              have selectedValue :=
                (parseWireCostTag_eq_some_iff expected maxScaleBytes
                  raw.selectedError selectedError).mp selectedEq |>.2
              have comparisonValue :=
                (parseWireCostTag_eq_some_iff expected maxScaleBytes
                  raw.comparisonError comparisonError).mp comparisonEq |>.2
              subst margin
              subst selectedError
              subst comparisonError
              simp [marginEq, selectedEq, comparisonEq] at wireAccepted
              subst parsed
              unfold SerializedReportWellFormed SerializedCostWellFormed at wellFormed
              unfold WireReportWithinValidationLimits
                WireNumericFieldWithinValidationLimits
              exact ⟨⟨scaleValid.1.1, wellFormed.1.2.1⟩,
                ⟨scaleValid.2.1.1, wellFormed.2.1.2.1⟩,
                ⟨scaleValid.2.2.1, wellFormed.2.2.2.1⟩⟩

theorem allWireStepNumericFieldsWithinValidationLimits_of_parseAux
    {Edit : Type u} (expected : PositiveScale)
    (maxScaleBytes maxUnitBytes : Nat)
    (raw : List (WireTaggedPathStep Edit))
    (parsed : List (SerializedTaggedPathStep Edit))
    (wireAccepted : parseWireStepsAux expected maxScaleBytes raw = some parsed)
    (scaleValid : AllWireStepScaleTagsValid expected maxScaleBytes raw)
    (wellFormed : AllSerializedStepsWellFormed expected maxUnitBytes parsed) :
    AllWireStepNumericFieldsWithinValidationLimits maxScaleBytes maxUnitBytes
      raw := by
  induction raw generalizing parsed with
  | nil => trivial
  | cons step remaining inductionHypothesis =>
      simp only [parseWireStepsAux] at wireAccepted
      cases costEq : parseWireCostTag expected maxScaleBytes step.cost with
      | none => simp [costEq] at wireAccepted
      | some cost =>
          cases remainingEq : parseWireStepsAux expected maxScaleBytes
              remaining with
          | none => simp [costEq, remainingEq] at wireAccepted
          | some parsedRemaining =>
              simp [costEq, remainingEq] at wireAccepted
              subst parsed
              simp only [AllWireStepScaleTagsValid] at scaleValid
              simp only [AllSerializedStepsWellFormed] at wellFormed
              have costValue :=
                (parseWireCostTag_eq_some_iff expected maxScaleBytes
                  step.cost cost).mp costEq |>.2
              subst cost
              have unitFits :
                  step.cost.unitsDecimal.utf8ByteSize ≤ maxUnitBytes := by
                exact wellFormed.1.2.1
              simp only [AllWireStepNumericFieldsWithinValidationLimits]
              exact ⟨⟨scaleValid.1.1, unitFits⟩,
                inductionHypothesis parsedRemaining remainingEq scaleValid.2
                  wellFormed.2⟩

theorem wireStepsWithinValidationLimits_of_parse_of_wellFormed
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (raw : List (WireTaggedPathStep Edit))
    (parsed : List (SerializedTaggedPathStep Edit))
    (wireAccepted : parseWireSteps expected maxSteps maxScaleBytes raw =
      some parsed)
    (wellFormed : AllSerializedStepsWellFormed expected maxUnitBytes parsed) :
    WireStepsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes raw := by
  have scaleInfo := (exists_parseWireSteps_iff expected maxSteps maxScaleBytes
    raw).mp ⟨parsed, wireAccepted⟩
  have auxAccepted := wireAccepted
  simp [parseWireSteps, scaleInfo.1] at auxAccepted
  exact ⟨scaleInfo.1,
    allWireStepNumericFieldsWithinValidationLimits_of_parseAux expected
      maxScaleBytes maxUnitBytes raw parsed auxAccepted scaleInfo.2
      wellFormed⟩

def SerializedStepsWithinValidationLimits
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxUnitBytes : Nat)
    (steps : List (SerializedTaggedPathStep Edit)) : Prop :=
  steps.length ≤ maxSteps ∧
  AllSerializedStepsWellFormed expected maxUnitBytes steps

def SerializedModePathsWithinValidationLimits
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxUnitBytes : Nat) : SerializedModePaths Edit → Prop
  | .twoSided selected comparison =>
      SerializedStepsWithinValidationLimits expected maxSteps maxUnitBytes
          selected ∧
        SerializedStepsWithinValidationLimits expected maxSteps maxUnitBytes
          comparison
  | .overestimate comparison =>
      SerializedStepsWithinValidationLimits expected maxSteps maxUnitBytes
        comparison
  | .underestimate selected =>
      SerializedStepsWithinValidationLimits expected maxSteps maxUnitBytes
        selected

theorem serializedStepsWithinValidationLimits_of_verifiedField
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale) (maxSteps maxUnitBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source target : List Edit) (cost : ScaledIntCost expected)
    (steps : List (SerializedTaggedPathStep Edit)) (count : Nat)
    (accepted : verifySerializedPathField expected maxSteps maxUnitBytes
      Independent encodedCost source target cost steps = some count) :
    SerializedStepsWithinValidationLimits expected maxSteps maxUnitBytes
      steps := by
  have weighted := (verifySerializedPathField_eq_some_iff expected maxSteps
    maxUnitBytes Independent encodedCost source target cost steps count).mp
      accepted
  unfold verifySerializedWeightedPathData at weighted
  cases parsedEq : parseSerializedStepsAtScale expected maxSteps maxUnitBytes
      steps with
  | none => simp [parsedEq] at weighted
  | some parsed =>
      exact parseSerializedStepsAtScale_limits expected maxSteps maxUnitBytes
        steps parsed parsedEq

theorem verifyCanonicalReliabilityArtifact_limits_of_some
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale) (maxSteps maxUnitBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (result : IntegerReliabilityReport Edit expected)
    (accepted : verifyCanonicalReliabilityArtifact expected maxSteps
      maxUnitBytes Independent encodedCost source rawReport paths =
        some result) :
    SerializedReportWellFormed expected maxUnitBytes rawReport ∧
      SerializedModePathsWithinValidationLimits expected maxSteps maxUnitBytes
        paths := by
  unfold verifyCanonicalReliabilityArtifact at accepted
  cases reportEq : parseSerializedReportAtScale expected maxUnitBytes
      rawReport with
  | none => simp [reportEq] at accepted
  | some report =>
      have reportWellFormed := parseSerializedReportAtScale_wellFormed expected
        maxUnitBytes rawReport report reportEq
      simp only [reportEq] at accepted
      cases modeEq : report.mode with
      | twoSided =>
          cases paths with
          | twoSided selected comparison =>
              simp only [modeEq] at accepted
              cases selectedEq : verifySerializedPathField expected maxSteps
                  maxUnitBytes Independent encodedCost source
                  report.selectedTarget report.selectedError selected with
              | none => simp [selectedEq] at accepted
              | some selectedCount =>
                  cases comparisonEq : verifySerializedPathField expected
                      maxSteps maxUnitBytes Independent encodedCost source
                      report.bestTarget report.comparisonError comparison with
                  | none => simp [selectedEq, comparisonEq] at accepted
                  | some comparisonCount =>
                      exact ⟨reportWellFormed,
                        ⟨serializedStepsWithinValidationLimits_of_verifiedField
                            expected maxSteps maxUnitBytes Independent encodedCost
                            source report.selectedTarget report.selectedError
                            selected selectedCount selectedEq,
                          serializedStepsWithinValidationLimits_of_verifiedField
                            expected maxSteps maxUnitBytes Independent encodedCost
                            source report.bestTarget report.comparisonError
                            comparison comparisonCount comparisonEq⟩⟩
          | overestimate comparison => simp [modeEq] at accepted
          | underestimate selected => simp [modeEq] at accepted
      | overestimate =>
          cases paths with
          | twoSided selected comparison => simp [modeEq] at accepted
          | overestimate comparison =>
              simp only [modeEq] at accepted
              by_cases unusedZero : report.selectedError = zero expected
              · simp only [unusedZero, ↓reduceIte] at accepted
                cases comparisonEq : verifySerializedPathField expected
                    maxSteps maxUnitBytes Independent encodedCost source
                    report.bestTarget report.comparisonError comparison with
                | none => simp [comparisonEq] at accepted
                | some comparisonCount =>
                    exact ⟨reportWellFormed,
                      serializedStepsWithinValidationLimits_of_verifiedField
                        expected maxSteps maxUnitBytes Independent encodedCost
                        source report.bestTarget report.comparisonError
                        comparison comparisonCount comparisonEq⟩
              · simp [unusedZero] at accepted
          | underestimate selected => simp [modeEq] at accepted
      | underestimate =>
          cases paths with
          | twoSided selected comparison => simp [modeEq] at accepted
          | overestimate comparison => simp [modeEq] at accepted
          | underestimate selected =>
              simp only [modeEq] at accepted
              by_cases unusedZero : report.comparisonError = zero expected
              · simp only [unusedZero, ↓reduceIte] at accepted
                cases selectedEq : verifySerializedPathField expected maxSteps
                    maxUnitBytes Independent encodedCost source
                    report.selectedTarget report.selectedError selected with
                | none => simp [selectedEq] at accepted
                | some selectedCount =>
                    exact ⟨reportWellFormed,
                      serializedStepsWithinValidationLimits_of_verifiedField
                        expected maxSteps maxUnitBytes Independent encodedCost
                        source report.selectedTarget report.selectedError
                        selected selectedCount selectedEq⟩
              · simp [unusedZero] at accepted

theorem wireModePathsWithinValidationLimits_of_parse_of_serializedLimits
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (raw : WireModePaths Edit) (parsed : SerializedModePaths Edit)
    (wireAccepted : parseWireModePaths expected maxSteps maxScaleBytes raw =
      some parsed)
    (serializedLimits : SerializedModePathsWithinValidationLimits expected
      maxSteps maxUnitBytes parsed) :
    WireModePathsWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
      raw := by
  cases raw with
  | twoSided selected comparison =>
      unfold parseWireModePaths at wireAccepted
      cases selectedEq : parseWireSteps expected maxSteps maxScaleBytes
          selected with
      | none => simp [selectedEq] at wireAccepted
      | some parsedSelected =>
          cases comparisonEq : parseWireSteps expected maxSteps maxScaleBytes
              comparison with
          | none => simp [selectedEq, comparisonEq] at wireAccepted
          | some parsedComparison =>
              simp [selectedEq, comparisonEq] at wireAccepted
              subst parsed
              simp only [SerializedModePathsWithinValidationLimits] at serializedLimits
              exact ⟨wireStepsWithinValidationLimits_of_parse_of_wellFormed
                  expected maxSteps maxScaleBytes maxUnitBytes selected
                  parsedSelected selectedEq serializedLimits.1.2,
                wireStepsWithinValidationLimits_of_parse_of_wellFormed
                  expected maxSteps maxScaleBytes maxUnitBytes comparison
                  parsedComparison comparisonEq serializedLimits.2.2⟩
  | overestimate comparison =>
      unfold parseWireModePaths at wireAccepted
      cases comparisonEq : parseWireSteps expected maxSteps maxScaleBytes
          comparison with
      | none => simp [comparisonEq] at wireAccepted
      | some parsedComparison =>
          simp [comparisonEq] at wireAccepted
          subst parsed
          exact wireStepsWithinValidationLimits_of_parse_of_wellFormed
            expected maxSteps maxScaleBytes maxUnitBytes comparison
            parsedComparison comparisonEq serializedLimits.2
  | underestimate selected =>
      unfold parseWireModePaths at wireAccepted
      cases selectedEq : parseWireSteps expected maxSteps maxScaleBytes
          selected with
      | none => simp [selectedEq] at wireAccepted
      | some parsedSelected =>
          simp [selectedEq] at wireAccepted
          subst parsed
          exact wireStepsWithinValidationLimits_of_parse_of_wellFormed
            expected maxSteps maxScaleBytes maxUnitBytes selected
            parsedSelected selectedEq serializedLimits.2

/-- Every report returned by the existing wire verifier satisfies all raw
step-count and numeric UTF-8 resource limits. This is the bridge needed to
classify resource refusal before artifact invalidity. -/
theorem verifyWireReliabilityArtifact_validationLimits_of_some
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit expected)
    (accepted : verifyWireReliabilityArtifactWithMargin expected maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths = some result) :
    WireArtifactWithinValidationLimits maxSteps maxScaleBytes maxUnitBytes
      rawReport rawPaths := by
  obtain ⟨serializedReport, serializedPaths, reportEq, pathsEq,
      canonicalAccepted⟩ :=
    (verifyWireReliabilityArtifactWithMargin_eq_some_iff expected maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths result).mp accepted
  have baseAccepted :=
    (verifyCanonicalReliabilityArtifactWithMargin_eq_some_iff expected
      maxSteps maxUnitBytes Independent encodedCost source actualMargin
      serializedReport serializedPaths result).mp canonicalAccepted |>.1
  have serializedLimits :=
    verifyCanonicalReliabilityArtifact_limits_of_some expected maxSteps
      maxUnitBytes Independent encodedCost source serializedReport
      serializedPaths result baseAccepted
  exact ⟨
    wireReportWithinValidationLimits_of_parse_of_wellFormed expected
      maxScaleBytes maxUnitBytes rawReport serializedReport reportEq
      serializedLimits.1,
    wireModePathsWithinValidationLimits_of_parse_of_serializedLimits expected
      maxSteps maxScaleBytes maxUnitBytes rawPaths serializedPaths pathsEq
      serializedLimits.2⟩

theorem verifyWireReliabilityArtifact_none_of_validationLimits_failure
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (outside : ¬WireArtifactWithinValidationLimits maxSteps maxScaleBytes
      maxUnitBytes rawReport rawPaths) :
    verifyWireReliabilityArtifactWithMargin expected maxSteps maxScaleBytes
      maxUnitBytes Independent encodedCost source actualMargin rawReport
      rawPaths = none := by
  cases verifiedEq : verifyWireReliabilityArtifactWithMargin expected maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths with
  | none => rfl
  | some result =>
      exact False.elim (outside
        (verifyWireReliabilityArtifact_validationLimits_of_some expected
          maxSteps maxScaleBytes maxUnitBytes Independent encodedCost source
          actualMargin rawReport rawPaths result verifiedEq))

end Sprawlens.FixedPointWireValidationLimits
