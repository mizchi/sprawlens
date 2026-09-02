import Sprawlens.FixedPointCanonicalMargin

namespace Sprawlens.FixedPointWireArtifact

open ApproximateWeightedNormalization
open FixedPointCanonicalArtifact
open FixedPointCanonicalDecimal
open FixedPointCanonicalMargin
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointMarginProvenance
open FixedPointPathDataWitness
open PathwiseErrorValidity
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u

/-- Fully wire-level numeric field. Neither the scale nor units have been
parsed into an unbounded numeric type. -/
structure WireTaggedIntCost where
  scaleDecimal : String
  unitsDecimal : String
deriving DecidableEq, Repr

def wireCostValue
    (expected : PositiveScale) (raw : WireTaggedIntCost) :
    SerializedTaggedIntCost :=
  ⟨expected.denominator, raw.unitsDecimal⟩

/-- Validate the scale by bounded byte-for-byte comparison with the trusted
canonical `Nat.repr`. No attacker-controlled scale integer is parsed. -/
def parseWireCostTag
    (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntCost) : Option SerializedTaggedIntCost :=
  if _bytesOk : raw.scaleDecimal.utf8ByteSize ≤ maxScaleBytes then
    if _canonicalExpected :
        raw.scaleDecimal = expected.denominator.repr then
      some (wireCostValue expected raw)
    else
      none
  else
    none

def WireScaleTagValid
    (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntCost) : Prop :=
  raw.scaleDecimal.utf8ByteSize ≤ maxScaleBytes ∧
  raw.scaleDecimal = expected.denominator.repr

theorem parseWireCostTag_eq_some_iff
    (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntCost) (parsed : SerializedTaggedIntCost) :
    parseWireCostTag expected maxScaleBytes raw = some parsed ↔
      WireScaleTagValid expected maxScaleBytes raw ∧
      wireCostValue expected raw = parsed := by
  by_cases bytesOk : raw.scaleDecimal.utf8ByteSize ≤ maxScaleBytes
  · by_cases canonicalExpected :
        raw.scaleDecimal = expected.denominator.repr
    · simp [parseWireCostTag, WireScaleTagValid,
        canonicalExpected]
    · simp [parseWireCostTag, WireScaleTagValid, bytesOk,
        canonicalExpected]
  · simp [parseWireCostTag, WireScaleTagValid, bytesOk]

theorem exists_parseWireCostTag_iff
    (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntCost) :
    (∃ parsed, parseWireCostTag expected maxScaleBytes raw = some parsed) ↔
      WireScaleTagValid expected maxScaleBytes raw := by
  constructor
  · rintro ⟨parsed, accepted⟩
    exact (parseWireCostTag_eq_some_iff expected maxScaleBytes raw parsed).mp
      accepted |>.1
  · intro valid
    exact ⟨wireCostValue expected raw,
      (parseWireCostTag_eq_some_iff expected maxScaleBytes raw
        (wireCostValue expected raw)).mpr ⟨valid, rfl⟩⟩

def serializeWireCost
    (expected : PositiveScale) (units : String) : WireTaggedIntCost :=
  ⟨expected.denominator.repr, units⟩

theorem parseWireCostTag_serialize
    (expected : PositiveScale) (maxScaleBytes : Nat) (units : String)
    (fits : expected.denominator.repr.utf8ByteSize ≤ maxScaleBytes) :
    parseWireCostTag expected maxScaleBytes
      (serializeWireCost expected units) =
        some ⟨expected.denominator, units⟩ := by
  exact (parseWireCostTag_eq_some_iff expected maxScaleBytes
    (serializeWireCost expected units) ⟨expected.denominator, units⟩).mpr
      ⟨⟨fits, rfl⟩, rfl⟩

structure WireTaggedPathStep (Edit : Type u) where
  cost : WireTaggedIntCost
  next : List Edit
deriving DecidableEq, Repr

def parseWireStepsAux
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat) :
    List (WireTaggedPathStep Edit) →
      Option (List (SerializedTaggedPathStep Edit))
  | [] => some []
  | step :: remaining =>
      match parseWireCostTag expected maxScaleBytes step.cost with
      | none => none
      | some cost =>
          match parseWireStepsAux expected maxScaleBytes remaining with
          | none => none
          | some parsed => some (⟨cost, step.next⟩ :: parsed)

def parseWireSteps
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxScaleBytes : Nat)
    (raw : List (WireTaggedPathStep Edit)) :
    Option (List (SerializedTaggedPathStep Edit)) :=
  if _stepCountOk : raw.length ≤ maxSteps then
    parseWireStepsAux expected maxScaleBytes raw
  else
    none

def AllWireStepScaleTagsValid
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat) :
    List (WireTaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      WireScaleTagValid expected maxScaleBytes step.cost ∧
      AllWireStepScaleTagsValid expected maxScaleBytes remaining

theorem parseWireStepsAux_length
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : List (WireTaggedPathStep Edit))
    (parsed : List (SerializedTaggedPathStep Edit))
    (accepted : parseWireStepsAux expected maxScaleBytes raw = some parsed) :
    parsed.length = raw.length := by
  induction raw generalizing parsed with
  | nil =>
      simp [parseWireStepsAux] at accepted
      subst parsed
      rfl
  | cons step remaining inductionHypothesis =>
      simp only [parseWireStepsAux] at accepted
      cases costEq : parseWireCostTag expected maxScaleBytes step.cost with
      | none => simp [costEq] at accepted
      | some cost =>
          cases remainingEq : parseWireStepsAux expected maxScaleBytes
              remaining with
          | none => simp [costEq, remainingEq] at accepted
          | some parsedRemaining =>
              simp [costEq, remainingEq] at accepted
              subst parsed
              simp [inductionHypothesis parsedRemaining remainingEq]

theorem exists_parseWireStepsAux_iff
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : List (WireTaggedPathStep Edit)) :
    (∃ parsed, parseWireStepsAux expected maxScaleBytes raw = some parsed) ↔
      AllWireStepScaleTagsValid expected maxScaleBytes raw := by
  induction raw with
  | nil => simp [parseWireStepsAux, AllWireStepScaleTagsValid]
  | cons step remaining inductionHypothesis =>
      constructor
      · rintro ⟨parsed, accepted⟩
        simp only [parseWireStepsAux] at accepted
        cases costEq : parseWireCostTag expected maxScaleBytes step.cost with
        | none => simp [costEq] at accepted
        | some cost =>
            cases remainingEq : parseWireStepsAux expected maxScaleBytes
                remaining with
            | none => simp [costEq, remainingEq] at accepted
            | some parsedRemaining =>
                exact ⟨
                  (parseWireCostTag_eq_some_iff expected maxScaleBytes
                    step.cost cost).mp costEq |>.1,
                  inductionHypothesis.mp ⟨parsedRemaining, remainingEq⟩⟩
      · intro valid
        simp only [AllWireStepScaleTagsValid] at valid
        obtain ⟨cost, costEq⟩ :=
          (exists_parseWireCostTag_iff expected maxScaleBytes step.cost).mpr
            valid.1
        obtain ⟨remaining, remainingEq⟩ := inductionHypothesis.mpr valid.2
        exact ⟨⟨cost, step.next⟩ :: remaining, by
          simp [parseWireStepsAux, costEq, remainingEq]⟩

theorem exists_parseWireSteps_iff
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxScaleBytes : Nat)
    (raw : List (WireTaggedPathStep Edit)) :
    (∃ parsed, parseWireSteps expected maxSteps maxScaleBytes raw =
      some parsed) ↔
    raw.length ≤ maxSteps ∧
      AllWireStepScaleTagsValid expected maxScaleBytes raw := by
  by_cases stepCountOk : raw.length ≤ maxSteps
  · simp only [parseWireSteps, stepCountOk, ↓reduceDIte]
    rw [exists_parseWireStepsAux_iff]
    simp
  · simp [parseWireSteps, stepCountOk]

structure WireTaggedIntegerReport (Edit : Type u) where
  mode : PathwiseApproximationMode
  selectedTarget : List Edit
  bestTarget : List Edit
  margin : WireTaggedIntCost
  selectedError : WireTaggedIntCost
  comparisonError : WireTaggedIntCost
deriving DecidableEq

def wireReportValue
    {Edit : Type u} (_expected : PositiveScale)
    (raw : WireTaggedIntegerReport Edit)
    (margin selectedError comparisonError : SerializedTaggedIntCost) :
    SerializedTaggedIntegerReport Edit where
  mode := raw.mode
  selectedTarget := raw.selectedTarget
  bestTarget := raw.bestTarget
  margin := margin
  selectedError := selectedError
  comparisonError := comparisonError

def parseWireReport
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntegerReport Edit) :
    Option (SerializedTaggedIntegerReport Edit) :=
  match parseWireCostTag expected maxScaleBytes raw.margin with
  | none => none
  | some margin =>
      match parseWireCostTag expected maxScaleBytes raw.selectedError with
      | none => none
      | some selectedError =>
          match parseWireCostTag expected maxScaleBytes raw.comparisonError with
          | none => none
          | some comparisonError =>
              some (wireReportValue expected raw margin selectedError
                comparisonError)

def WireReportScaleTagsValid
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntegerReport Edit) : Prop :=
  WireScaleTagValid expected maxScaleBytes raw.margin ∧
  WireScaleTagValid expected maxScaleBytes raw.selectedError ∧
  WireScaleTagValid expected maxScaleBytes raw.comparisonError

theorem exists_parseWireReport_iff
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (raw : WireTaggedIntegerReport Edit) :
    (∃ parsed, parseWireReport expected maxScaleBytes raw = some parsed) ↔
      WireReportScaleTagsValid expected maxScaleBytes raw := by
  constructor
  · rintro ⟨parsed, accepted⟩
    unfold parseWireReport at accepted
    cases marginEq : parseWireCostTag expected maxScaleBytes raw.margin with
    | none => simp [marginEq] at accepted
    | some margin =>
        cases selectedEq : parseWireCostTag expected maxScaleBytes
            raw.selectedError with
        | none => simp [marginEq, selectedEq] at accepted
        | some selectedError =>
            cases comparisonEq : parseWireCostTag expected maxScaleBytes
                raw.comparisonError with
            | none => simp [marginEq, selectedEq, comparisonEq] at accepted
            | some comparisonError =>
                exact ⟨
                  (parseWireCostTag_eq_some_iff expected maxScaleBytes
                    raw.margin margin).mp marginEq |>.1,
                  (parseWireCostTag_eq_some_iff expected maxScaleBytes
                    raw.selectedError selectedError).mp selectedEq |>.1,
                  (parseWireCostTag_eq_some_iff expected maxScaleBytes
                    raw.comparisonError comparisonError).mp comparisonEq |>.1⟩
  · rintro ⟨marginValid, selectedValid, comparisonValid⟩
    obtain ⟨margin, marginEq⟩ :=
      (exists_parseWireCostTag_iff expected maxScaleBytes raw.margin).mpr
        marginValid
    obtain ⟨selectedError, selectedEq⟩ :=
      (exists_parseWireCostTag_iff expected maxScaleBytes
        raw.selectedError).mpr selectedValid
    obtain ⟨comparisonError, comparisonEq⟩ :=
      (exists_parseWireCostTag_iff expected maxScaleBytes
        raw.comparisonError).mpr comparisonValid
    exact ⟨wireReportValue expected raw margin selectedError comparisonError,
      by simp [parseWireReport, marginEq, selectedEq, comparisonEq]⟩

inductive WireModePaths (Edit : Type u) where
  | twoSided
      (selected comparison : List (WireTaggedPathStep Edit))
  | overestimate
      (comparison : List (WireTaggedPathStep Edit))
  | underestimate
      (selected : List (WireTaggedPathStep Edit))

def parseWireModePaths
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxScaleBytes : Nat) :
    WireModePaths Edit → Option (SerializedModePaths Edit)
  | .twoSided selected comparison =>
      match parseWireSteps expected maxSteps maxScaleBytes selected with
      | none => none
      | some selected =>
          match parseWireSteps expected maxSteps maxScaleBytes comparison with
          | none => none
          | some comparison => some (.twoSided selected comparison)
  | .overestimate comparison =>
      match parseWireSteps expected maxSteps maxScaleBytes comparison with
      | none => none
      | some comparison => some (.overestimate comparison)
  | .underestimate selected =>
      match parseWireSteps expected maxSteps maxScaleBytes selected with
      | none => none
      | some selected => some (.underestimate selected)

def serializeWireStep
    {Edit : Type u} (expected : PositiveScale)
    (step : SerializedTaggedPathStep Edit) : WireTaggedPathStep Edit :=
  ⟨serializeWireCost expected step.cost.unitsDecimal, step.next⟩

def retagSerializedStep
    {Edit : Type u} (expected : PositiveScale)
    (step : SerializedTaggedPathStep Edit) : SerializedTaggedPathStep Edit :=
  ⟨⟨expected.denominator, step.cost.unitsDecimal⟩, step.next⟩

def serializeWireSteps
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (SerializedTaggedPathStep Edit)) :
    List (WireTaggedPathStep Edit) :=
  steps.map (serializeWireStep expected)

def retagSerializedSteps
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (SerializedTaggedPathStep Edit)) :
    List (SerializedTaggedPathStep Edit) :=
  steps.map (retagSerializedStep expected)

@[simp] theorem serializeWireSteps_length
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (SerializedTaggedPathStep Edit)) :
    (serializeWireSteps expected steps).length = steps.length := by
  simp [serializeWireSteps]

theorem parseWireStepsAux_serialize
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (steps : List (SerializedTaggedPathStep Edit))
    (scaleFits : expected.denominator.repr.utf8ByteSize ≤ maxScaleBytes) :
    parseWireStepsAux expected maxScaleBytes
      (serializeWireSteps expected steps) =
        some (retagSerializedSteps expected steps) := by
  induction steps with
  | nil => rfl
  | cons step remaining inductionHypothesis =>
      simp only [serializeWireSteps, retagSerializedSteps, List.map_cons,
        serializeWireStep, retagSerializedStep,
        parseWireStepsAux] at inductionHypothesis ⊢
      rw [
        parseWireCostTag_serialize expected maxScaleBytes
          step.cost.unitsDecimal scaleFits,
        inductionHypothesis]

theorem parseWireSteps_serialize
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxScaleBytes : Nat)
    (steps : List (SerializedTaggedPathStep Edit))
    (stepCountFits : steps.length ≤ maxSteps)
    (scaleFits : expected.denominator.repr.utf8ByteSize ≤ maxScaleBytes) :
    parseWireSteps expected maxSteps maxScaleBytes
      (serializeWireSteps expected steps) =
        some (retagSerializedSteps expected steps) := by
  simp [parseWireSteps, stepCountFits,
    parseWireStepsAux_serialize expected maxScaleBytes steps scaleFits]

def serializeWireReport
    {Edit : Type u} (expected : PositiveScale)
    (report : SerializedTaggedIntegerReport Edit) :
    WireTaggedIntegerReport Edit where
  mode := report.mode
  selectedTarget := report.selectedTarget
  bestTarget := report.bestTarget
  margin := serializeWireCost expected report.margin.unitsDecimal
  selectedError := serializeWireCost expected report.selectedError.unitsDecimal
  comparisonError :=
    serializeWireCost expected report.comparisonError.unitsDecimal

def retagSerializedReport
    {Edit : Type u} (expected : PositiveScale)
    (report : SerializedTaggedIntegerReport Edit) :
    SerializedTaggedIntegerReport Edit where
  mode := report.mode
  selectedTarget := report.selectedTarget
  bestTarget := report.bestTarget
  margin := ⟨expected.denominator, report.margin.unitsDecimal⟩
  selectedError := ⟨expected.denominator, report.selectedError.unitsDecimal⟩
  comparisonError :=
    ⟨expected.denominator, report.comparisonError.unitsDecimal⟩

theorem parseWireReport_serialize
    {Edit : Type u} (expected : PositiveScale) (maxScaleBytes : Nat)
    (report : SerializedTaggedIntegerReport Edit)
    (scaleFits : expected.denominator.repr.utf8ByteSize ≤ maxScaleBytes) :
    parseWireReport expected maxScaleBytes
      (serializeWireReport expected report) =
        some (retagSerializedReport expected report) := by
  unfold parseWireReport serializeWireReport
  rw [parseWireCostTag_serialize expected maxScaleBytes
      report.margin.unitsDecimal scaleFits,
    parseWireCostTag_serialize expected maxScaleBytes
      report.selectedError.unitsDecimal scaleFits,
    parseWireCostTag_serialize expected maxScaleBytes
      report.comparisonError.unitsDecimal scaleFits]
  rfl

def serializeWireModePaths
    {Edit : Type u} (expected : PositiveScale) :
    SerializedModePaths Edit → WireModePaths Edit
  | .twoSided selected comparison =>
      .twoSided (serializeWireSteps expected selected)
        (serializeWireSteps expected comparison)
  | .overestimate comparison =>
      .overestimate (serializeWireSteps expected comparison)
  | .underestimate selected =>
      .underestimate (serializeWireSteps expected selected)

/-- Fully wire-level final gate. Scale tags remain strings until bounded exact
comparison succeeds; unit strings then pass the canonical artifact and trusted
margin pipeline proved in the preceding modules. -/
noncomputable def verifyWireReliabilityArtifactWithMargin
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit) :
    Option (IntegerReliabilityReport Edit scale) :=
  match parseWireReport scale maxScaleBytes rawReport with
  | none => none
  | some report =>
      match parseWireModePaths scale maxSteps maxScaleBytes rawPaths with
      | none => none
      | some paths =>
          verifyCanonicalReliabilityArtifactWithMargin scale maxSteps
            maxUnitBytes Independent encodedCost source actualMargin report
            paths

theorem verifyWireReliabilityArtifactWithMargin_eq_some_iff
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit scale) :
    verifyWireReliabilityArtifactWithMargin scale maxSteps maxScaleBytes
        maxUnitBytes Independent encodedCost source actualMargin rawReport
        rawPaths = some result ↔
      ∃ report paths,
        parseWireReport scale maxScaleBytes rawReport = some report ∧
        parseWireModePaths scale maxSteps maxScaleBytes rawPaths = some paths ∧
        verifyCanonicalReliabilityArtifactWithMargin scale maxSteps
          maxUnitBytes Independent encodedCost source actualMargin report
          paths = some result := by
  cases reportEq : parseWireReport scale maxScaleBytes rawReport with
  | none =>
      simp [verifyWireReliabilityArtifactWithMargin, reportEq]
  | some report =>
      cases pathsEq : parseWireModePaths scale maxSteps maxScaleBytes
          rawPaths with
      | none =>
          simp [verifyWireReliabilityArtifactWithMargin, reportEq, pathsEq]
      | some paths =>
          simp [verifyWireReliabilityArtifactWithMargin, reportEq, pathsEq]

theorem exists_marginEncodedSerializableReport_of_wireArtifact
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
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
      (EncodedWeightedPathDataVerifier.decodePrimitiveCost
        FixedPointEncodedCost.decode encodedCost))
    (accepted : verifyWireReliabilityArtifactWithMargin scale maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths = some result) :
    ∃ bounded : MarginEncodedSerializableReport Edit scale Independent
        exactCost approximateCost encodedCost source actualMargin,
      bounded.serializable.report = result := by
  obtain ⟨report, paths, _, _, underlying⟩ :=
    (verifyWireReliabilityArtifactWithMargin_eq_some_iff scale maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths result).mp accepted
  exact exists_marginEncodedSerializableReport_of_canonicalArtifact scale
    maxSteps maxUnitBytes Independent exactCost approximateCost encodedCost
    source actualMargin report paths result within underlying

theorem wireArtifact_target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
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
      (EncodedWeightedPathDataVerifier.decodePrimitiveCost
        FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (accepted : verifyWireReliabilityArtifactWithMargin scale maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths = some result)
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨report, paths, _, _, underlying⟩ :=
    (verifyWireReliabilityArtifactWithMargin_eq_some_iff scale maxSteps
      maxScaleBytes maxUnitBytes Independent encodedCost source actualMargin
      rawReport rawPaths result).mp accepted
  exact canonicalArtifact_target_eq_of_certified scale maxSteps maxUnitBytes
    Independent exactCost approximateCost encodedCost source actualMargin
    report paths result within marginNonnegative stable underlying certified

def componentWireReport : WireTaggedIntegerReport NontrivialEdit :=
  serializeWireReport milliScale componentCanonicalRawReport

def componentWirePaths : WireModePaths NontrivialEdit :=
  serializeWireModePaths milliScale componentCanonicalPaths

theorem componentWireReport_parses :
    parseWireReport milliScale 4 componentWireReport =
      some componentCanonicalRawReport := by
  native_decide

theorem componentWirePaths_parse :
    parseWireModePaths milliScale 1 4 componentWirePaths =
      some componentCanonicalPaths := by
  have scaleFits : milliScale.denominator.repr.utf8ByteSize ≤ 4 := by
    native_decide
  have parsed := parseWireSteps_serialize milliScale 1 4
    componentCanonicalRawPath (by native_decide) scaleFits
  have retagEq :
      retagSerializedSteps milliScale componentCanonicalRawPath =
        componentCanonicalRawPath := by
    native_decide
  simp [componentWirePaths, serializeWireModePaths,
    componentCanonicalPaths, parseWireModePaths, parsed, retagEq]

theorem componentWireArtifact_withMargin_accepted :
    verifyWireReliabilityArtifactWithMargin milliScale 1 4 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths =
        some componentCanonicalIntegerReport := by
  unfold verifyWireReliabilityArtifactWithMargin
  rw [componentWireReport_parses, componentWirePaths_parse]
  simpa using componentCanonicalArtifact_withMargin_accepted

def leadingZeroScaleWireReport : WireTaggedIntegerReport NontrivialEdit :=
  { componentWireReport with
    margin := ⟨"01000", "1000"⟩ }

def mixedScaleWireReport : WireTaggedIntegerReport NontrivialEdit :=
  { componentWireReport with
    comparisonError := ⟨"500", "0"⟩ }

def nonAsciiScaleWireReport : WireTaggedIntegerReport NontrivialEdit :=
  { componentWireReport with
    margin := ⟨"１０００", "1000"⟩ }

theorem leadingZeroScaleWireReport_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 5 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      leadingZeroScaleWireReport componentWirePaths = none := by
  have reportRejected :
      parseWireReport milliScale 5 leadingZeroScaleWireReport = none := by
    native_decide
  simp [verifyWireReliabilityArtifactWithMargin, reportRejected]

theorem mixedScaleWireReport_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 4 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      mixedScaleWireReport componentWirePaths = none := by
  have reportRejected :
      parseWireReport milliScale 4 mixedScaleWireReport = none := by
    native_decide
  simp [verifyWireReliabilityArtifactWithMargin, reportRejected]

theorem nonAsciiScaleWireReport_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 20 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      nonAsciiScaleWireReport componentWirePaths = none := by
  have reportRejected :
      parseWireReport milliScale 20 nonAsciiScaleWireReport = none := by
    native_decide
  simp [verifyWireReliabilityArtifactWithMargin, reportRejected]

theorem componentWireReport_scale_byte_limit_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 3 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths = none := by
  have reportRejected :
      parseWireReport milliScale 3 componentWireReport = none := by
    native_decide
  simp [verifyWireReliabilityArtifactWithMargin, reportRejected]

def leadingZeroScaleWirePath : WireModePaths NontrivialEdit :=
  .overestimate [⟨⟨"01000", "0"⟩, nontrivialBest⟩]

def unitsAliasCanonicalRawPath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, "00"⟩, nontrivialBest⟩]

def unitsAliasWirePath : WireModePaths NontrivialEdit :=
  .overestimate (serializeWireSteps milliScale unitsAliasCanonicalRawPath)

theorem leadingZeroScaleWirePath_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 5 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport leadingZeroScaleWirePath = none := by
  have reportParsed :
      parseWireReport milliScale 5 componentWireReport =
        some componentCanonicalRawReport := by
    native_decide
  have pathsRejected :
      parseWireModePaths milliScale 1 5 leadingZeroScaleWirePath = none := by
    native_decide
  simp [verifyWireReliabilityArtifactWithMargin, reportParsed,
    pathsRejected]

def unitsAliasCanonicalPaths : SerializedModePaths NontrivialEdit :=
  .overestimate unitsAliasCanonicalRawPath

theorem unitsAliasWirePath_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 4 4
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport unitsAliasWirePath = none := by
  have reportParsed := componentWireReport_parses
  have pathsParsed :
      parseWireModePaths milliScale 1 4 unitsAliasWirePath =
        some unitsAliasCanonicalPaths := by
    have parsed := parseWireSteps_serialize milliScale 1 4
      unitsAliasCanonicalRawPath (by native_decide) (by native_decide)
    have retagEq :
        retagSerializedSteps milliScale unitsAliasCanonicalRawPath =
          unitsAliasCanonicalRawPath := by
      native_decide
    simp [unitsAliasWirePath, unitsAliasCanonicalPaths,
      parseWireModePaths, parsed, retagEq]
  have underlyingRejected :
      verifyCanonicalReliabilityArtifactWithMargin milliScale 1 4
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        componentCanonicalRawReport unitsAliasCanonicalPaths = none := by
    unfold verifyCanonicalReliabilityArtifactWithMargin
    have baseRejected :
        verifyCanonicalReliabilityArtifact milliScale 1 4
          NontrivialIndependent componentMilliErrorCost nontrivialSource
          componentCanonicalRawReport unitsAliasCanonicalPaths = none := by
      native_decide
    rw [baseRejected]
  simp [verifyWireReliabilityArtifactWithMargin, reportParsed, pathsParsed,
    underlyingRejected]

def inflatedWireReport : WireTaggedIntegerReport NontrivialEdit :=
  serializeWireReport milliScale inflatedCanonicalRawReport

def inflatedWirePaths : WireModePaths NontrivialEdit :=
  .overestimate (serializeWireSteps milliScale inflatedCanonicalRawPath)

theorem inflatedWireArtifact_withMargin_rejected :
    verifyWireReliabilityArtifactWithMargin milliScale 1 4 4
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource 1
      inflatedWireReport inflatedWirePaths = none := by
  have reportParsed :
      parseWireReport milliScale 4 inflatedWireReport =
        some inflatedCanonicalRawReport := by
    native_decide
  have pathsParsed :
      parseWireModePaths milliScale 1 4 inflatedWirePaths =
        some inflatedCanonicalPaths := by
    have parsed := parseWireSteps_serialize milliScale 1 4
      inflatedCanonicalRawPath (by native_decide) (by native_decide)
    have retagEq :
        retagSerializedSteps milliScale inflatedCanonicalRawPath =
          inflatedCanonicalRawPath := by
      native_decide
    simp [inflatedWirePaths, inflatedCanonicalPaths,
      parseWireModePaths, parsed, retagEq]
  simp [verifyWireReliabilityArtifactWithMargin, reportParsed, pathsParsed,
    inflatedCanonicalArtifact_withMargin_rejected]

end Sprawlens.FixedPointWireArtifact
