import Sprawlens.FixedPointCanonicalDecimal

namespace Sprawlens.FixedPointCanonicalArtifact

open EncodedWeightedPathDataVerifier
open FixedPointCanonicalDecimal
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- A path step exactly as it can appear in JSON: the scale tag is untrusted
data and the integer units have not yet been parsed. -/
structure SerializedTaggedPathStep (Edit : Type u) where
  cost : SerializedTaggedIntCost
  next : List Edit
deriving DecidableEq, Repr

/-- Parse every decimal cost before constructing the homogeneous typed step
list. Each scalar parser checks its UTF-8 byte bound before integer parsing. -/
def parseSerializedStepsAtScaleAux
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat) :
    List (SerializedTaggedPathStep Edit) →
      Option (List (ScaledIntCost expected × List Edit))
  | [] => some []
  | step :: remaining =>
      match parseSerializedCostAtScaleWithinBytes expected maxBytes step.cost with
      | none => none
      | some cost =>
          match parseSerializedStepsAtScaleAux expected maxBytes remaining with
          | none => none
          | some parsed => some ((cost, step.next) :: parsed)

/-- The raw step-count guard is outside the recursive decimal parser, so an
oversized artifact is refused before any cost is parsed. -/
def parseSerializedStepsAtScale
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit)) :
    Option (List (ScaledIntCost expected × List Edit)) :=
  if _stepCountOk : raw.length ≤ maxSteps then
    parseSerializedStepsAtScaleAux expected maxBytes raw
  else
    none

theorem parseSerializedStepsAtScale_eq_some_iff
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit)) :
    parseSerializedStepsAtScale expected maxSteps maxBytes raw =
        some parsed ↔
      raw.length ≤ maxSteps ∧
      parseSerializedStepsAtScaleAux expected maxBytes raw = some parsed := by
  by_cases stepCountOk : raw.length ≤ maxSteps <;>
    simp [parseSerializedStepsAtScale, stepCountOk]

theorem parseSerializedStepsAtScaleAux_length
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit))
    (accepted : parseSerializedStepsAtScaleAux expected maxBytes raw =
      some parsed) :
    parsed.length = raw.length := by
  induction raw generalizing parsed with
  | nil =>
      simp [parseSerializedStepsAtScaleAux] at accepted
      subst parsed
      rfl
  | cons step remaining inductionHypothesis =>
      simp only [parseSerializedStepsAtScaleAux] at accepted
      cases costEq :
          parseSerializedCostAtScaleWithinBytes expected maxBytes step.cost with
      | none => simp [costEq] at accepted
      | some cost =>
          cases remainingEq :
              parseSerializedStepsAtScaleAux expected maxBytes remaining with
          | none => simp [costEq, remainingEq] at accepted
          | some parsedRemaining =>
              simp [costEq, remainingEq] at accepted
              subst parsed
              simp [inductionHypothesis parsedRemaining remainingEq]

theorem parseSerializedStepsAtScale_length
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit))
    (accepted : parseSerializedStepsAtScale expected maxSteps maxBytes raw =
      some parsed) :
    parsed.length = raw.length := by
  have underlying := (parseSerializedStepsAtScale_eq_some_iff expected
    maxSteps maxBytes raw parsed).mp accepted |>.2
  exact parseSerializedStepsAtScaleAux_length expected maxBytes raw parsed
    underlying

def SerializedStepWellFormed
    (expected : PositiveScale) (maxBytes : Nat)
    {Edit : Type u} (step : SerializedTaggedPathStep Edit) : Prop :=
  step.cost.denominator = expected.denominator ∧
  step.cost.unitsDecimal.utf8ByteSize ≤ maxBytes ∧
  CanonicalDecimal step.cost.unitsDecimal

def AllSerializedStepsWellFormed
    (expected : PositiveScale) (maxBytes : Nat)
    {Edit : Type u} : List (SerializedTaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      SerializedStepWellFormed expected maxBytes step ∧
      AllSerializedStepsWellFormed expected maxBytes remaining

theorem parseSerializedStepsAtScaleAux_wellFormed
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit))
    (accepted : parseSerializedStepsAtScaleAux expected maxBytes raw =
      some parsed) :
    AllSerializedStepsWellFormed expected maxBytes raw := by
  induction raw generalizing parsed with
  | nil => trivial
  | cons step remaining inductionHypothesis =>
      simp only [parseSerializedStepsAtScaleAux] at accepted
      cases costEq :
          parseSerializedCostAtScaleWithinBytes expected maxBytes step.cost with
      | none => simp [costEq] at accepted
      | some cost =>
          cases remainingEq :
              parseSerializedStepsAtScaleAux expected maxBytes remaining with
          | none => simp [costEq, remainingEq] at accepted
          | some parsedRemaining =>
              have costInfo := (parseSerializedCostAtScaleWithinBytes_eq_some_iff
                expected maxBytes step.cost cost).mp costEq
              exact ⟨
                ⟨costInfo.1, costInfo.2.1,
                  ⟨cost.units, costInfo.2.2⟩⟩,
                inductionHypothesis parsedRemaining remainingEq⟩

theorem exists_parseSerializedStepsAtScaleAux_iff
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit)) :
    (∃ parsed, parseSerializedStepsAtScaleAux expected maxBytes raw =
      some parsed) ↔
    AllSerializedStepsWellFormed expected maxBytes raw := by
  induction raw with
  | nil => simp [parseSerializedStepsAtScaleAux,
      AllSerializedStepsWellFormed]
  | cons step remaining inductionHypothesis =>
      constructor
      · rintro ⟨parsed, accepted⟩
        exact parseSerializedStepsAtScaleAux_wellFormed expected maxBytes
          (step :: remaining) parsed accepted
      · intro wellFormed
        simp only [AllSerializedStepsWellFormed,
          SerializedStepWellFormed] at wellFormed
        obtain ⟨tagOk, bytesOk, ⟨units, canonical⟩⟩ := wellFormed.1
        obtain ⟨parsedRemaining, remainingAccepted⟩ :=
          inductionHypothesis.mpr wellFormed.2
        let cost : ScaledIntCost expected := ⟨units⟩
        have costAccepted :
            parseSerializedCostAtScaleWithinBytes expected maxBytes step.cost =
              some cost :=
          (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected maxBytes
            step.cost cost).mpr ⟨tagOk, bytesOk, canonical⟩
        exact ⟨(cost, step.next) :: parsedRemaining, by
          simp [parseSerializedStepsAtScaleAux, costAccepted,
            remainingAccepted]⟩

theorem parseSerializedStepsAtScale_limits
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit))
    (accepted : parseSerializedStepsAtScale expected maxSteps maxBytes raw =
      some parsed) :
    raw.length ≤ maxSteps ∧
    AllSerializedStepsWellFormed expected maxBytes raw := by
  have info := (parseSerializedStepsAtScale_eq_some_iff expected
    maxSteps maxBytes raw parsed).mp accepted
  exact ⟨info.1, parseSerializedStepsAtScaleAux_wellFormed expected
    maxBytes raw parsed info.2⟩

theorem exists_parseSerializedStepsAtScale_iff
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxBytes : Nat)
    (raw : List (SerializedTaggedPathStep Edit)) :
    (∃ parsed, parseSerializedStepsAtScale expected maxSteps maxBytes raw =
      some parsed) ↔
    raw.length ≤ maxSteps ∧
      AllSerializedStepsWellFormed expected maxBytes raw := by
  constructor
  · rintro ⟨parsed, accepted⟩
    exact parseSerializedStepsAtScale_limits expected maxSteps maxBytes
      raw parsed accepted
  · rintro ⟨stepCountOk, wellFormed⟩
    obtain ⟨parsed, parsedEq⟩ :=
      (exists_parseSerializedStepsAtScaleAux_iff expected maxBytes raw).mpr
        wellFormed
    exact ⟨parsed, (parseSerializedStepsAtScale_eq_some_iff expected
      maxSteps maxBytes raw parsed).mpr ⟨stepCountOk, parsedEq⟩⟩

def serializeScaledCost
    (expected : PositiveScale) (cost : ScaledIntCost expected) :
    SerializedTaggedIntCost :=
  ⟨expected.denominator, cost.units.repr⟩

theorem parseSerializedCostAtScaleWithinBytes_serializeScaledCost
    (expected : PositiveScale) (maxBytes : Nat)
    (cost : ScaledIntCost expected)
    (fits : cost.units.repr.utf8ByteSize ≤ maxBytes) :
    parseSerializedCostAtScaleWithinBytes expected maxBytes
      (serializeScaledCost expected cost) = some cost := by
  exact (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected maxBytes
    (serializeScaledCost expected cost) cost).mpr ⟨rfl, fits, rfl⟩

def serializeScaledSteps
    {Edit : Type u} (expected : PositiveScale) :
    List (ScaledIntCost expected × List Edit) →
      List (SerializedTaggedPathStep Edit)
  | [] => []
  | (cost, target) :: remaining =>
      ⟨serializeScaledCost expected cost, target⟩ ::
        serializeScaledSteps expected remaining

def AllScaledStepReprsWithin
    {Edit : Type u} {expected : PositiveScale} (maxBytes : Nat) :
    List (ScaledIntCost expected × List Edit) → Prop
  | [] => True
  | (cost, _) :: remaining =>
      cost.units.repr.utf8ByteSize ≤ maxBytes ∧
        AllScaledStepReprsWithin maxBytes remaining

@[simp] theorem serializeScaledSteps_length
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (ScaledIntCost expected × List Edit)) :
    (serializeScaledSteps expected steps).length = steps.length := by
  induction steps with
  | nil => rfl
  | cons step remaining inductionHypothesis =>
      rcases step with ⟨cost, target⟩
      simp [serializeScaledSteps, inductionHypothesis]

theorem parseSerializedStepsAtScaleAux_serialize
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (steps : List (ScaledIntCost expected × List Edit))
    (fits : AllScaledStepReprsWithin maxBytes steps) :
    parseSerializedStepsAtScaleAux expected maxBytes
      (serializeScaledSteps expected steps) = some steps := by
  induction steps with
  | nil => rfl
  | cons step remaining inductionHypothesis =>
      rcases step with ⟨cost, target⟩
      exact (by
        simp only [AllScaledStepReprsWithin] at fits
        rw [serializeScaledSteps, parseSerializedStepsAtScaleAux,
          parseSerializedCostAtScaleWithinBytes_serializeScaledCost expected
            maxBytes cost fits.1,
          inductionHypothesis fits.2])

theorem parseSerializedStepsAtScale_serialize
    {Edit : Type u} (expected : PositiveScale)
    (maxSteps maxBytes : Nat)
    (steps : List (ScaledIntCost expected × List Edit))
    (stepCountFits : steps.length ≤ maxSteps)
    (reprsFit : AllScaledStepReprsWithin maxBytes steps) :
    parseSerializedStepsAtScale expected maxSteps maxBytes
      (serializeScaledSteps expected steps) = some steps := by
  apply (parseSerializedStepsAtScale_eq_some_iff expected maxSteps maxBytes
    (serializeScaledSteps expected steps) steps).mpr
  exact ⟨by simpa using stepCountFits,
    parseSerializedStepsAtScaleAux_serialize expected maxBytes steps reprsFit⟩

/-- End-to-end decoder/checker: resource and syntax validation precede graph
verification, and only homogeneous typed costs enter arithmetic. -/
def verifySerializedWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (raw : List (SerializedTaggedPathStep Edit)) :
    Option (Nat × ScaledIntCost expected × List Edit) :=
  match parseSerializedStepsAtScale expected maxSteps maxBytes raw with
  | none => none
  | some steps =>
      verifyEncodedWeightedPathData (zero expected) FixedPointEncodedCost.add
        Independent encodedCost source steps

theorem verifySerializedWeightedPathData_sound
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (raw : List (SerializedTaggedPathStep Edit))
    {count : Nat} {encodedPathCost : ScaledIntCost expected}
    {target : List Edit}
    (accepted : verifySerializedWeightedPathData expected maxSteps maxBytes
      Independent encodedCost source raw =
        some (count, encodedPathCost, target)) :
    WeightedTracePath Independent
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost)
      count (FixedPointEncodedCost.decode encodedPathCost) source target := by
  unfold verifySerializedWeightedPathData at accepted
  cases parsedEq :
      parseSerializedStepsAtScale expected maxSteps maxBytes raw with
  | none => simp [parsedEq] at accepted
  | some steps =>
      simp only [parsedEq] at accepted
      exact verifyEncodedWeightedPathData_sound
        FixedPointEncodedCost.decode (zero expected)
        FixedPointEncodedCost.add (decode_zero expected)
        FixedPointEncodedCost.decode_add Independent encodedCost
        source steps accepted

theorem verifySerializedWeightedPathData_count_eq_length
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale) (maxSteps maxBytes : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (raw : List (SerializedTaggedPathStep Edit))
    {count : Nat} {encodedPathCost : ScaledIntCost expected}
    {target : List Edit}
    (accepted : verifySerializedWeightedPathData expected maxSteps maxBytes
      Independent encodedCost source raw =
        some (count, encodedPathCost, target)) :
    count = raw.length := by
  unfold verifySerializedWeightedPathData at accepted
  cases parsedEq :
      parseSerializedStepsAtScale expected maxSteps maxBytes raw with
  | none => simp [parsedEq] at accepted
  | some steps =>
      simp only [parsedEq] at accepted
      calc
        count = steps.length :=
          verifyEncodedWeightedPathData_count_eq_length
            (zero expected) FixedPointEncodedCost.add Independent encodedCost
            source steps accepted
        _ = raw.length := parseSerializedStepsAtScale_length expected
          maxSteps maxBytes raw steps parsedEq

def serializedBoundaryPath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, "1000"⟩, nontrivialBest⟩]

def serializedLeadingZeroPath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, "01000"⟩, nontrivialBest⟩]

def serializedWrongScalePath :
    List (SerializedTaggedPathStep NontrivialEdit) :=
  [⟨⟨500, "1000"⟩, nontrivialBest⟩]

theorem serializedBoundaryPath_accepted :
    verifySerializedWeightedPathData milliScale 1 4
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      serializedBoundaryPath = some (1, wholeMilli 1, nontrivialBest) := by
  native_decide

theorem serializedLeadingZeroPath_rejected :
    verifySerializedWeightedPathData milliScale 1 5
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      serializedLeadingZeroPath = none := by
  native_decide

theorem serializedBoundaryPath_too_long_rejected :
    verifySerializedWeightedPathData milliScale 1 3
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      serializedBoundaryPath = none := by
  native_decide

theorem serializedWrongScalePath_rejected :
    verifySerializedWeightedPathData milliScale 1 4
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      serializedWrongScalePath = none := by
  native_decide

theorem serializedBoundaryPath_step_limit_rejected :
    verifySerializedWeightedPathData milliScale 0 4
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
      serializedBoundaryPath = none := by
  native_decide

/-- A complete report at the JSON-compatible boundary. Every numeric field is
still an untrusted tagged decimal string. -/
structure SerializedTaggedIntegerReport (Edit : Type u) where
  mode : PathwiseApproximationMode
  selectedTarget : List Edit
  bestTarget : List Edit
  margin : SerializedTaggedIntCost
  selectedError : SerializedTaggedIntCost
  comparisonError : SerializedTaggedIntCost
deriving DecidableEq

def parsedSerializedReportValue
    {Edit : Type u} (expected : PositiveScale)
    (raw : SerializedTaggedIntegerReport Edit)
    (margin selectedError comparisonError : ScaledIntCost expected) :
    IntegerReliabilityReport Edit expected where
  mode := raw.mode
  selectedTarget := raw.selectedTarget
  bestTarget := raw.bestTarget
  margin := margin
  selectedError := selectedError
  comparisonError := comparisonError

/-- Parse all three fields independently. No report comparison can run until
every field has passed the same canonical grammar, UTF-8 byte bound, and trusted
scale check. -/
def parseSerializedReportAtScale
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntegerReport Edit) :
    Option (IntegerReliabilityReport Edit expected) :=
  match parseSerializedCostAtScaleWithinBytes expected maxBytes raw.margin with
  | none => none
  | some margin =>
      match parseSerializedCostAtScaleWithinBytes expected maxBytes raw.selectedError with
      | none => none
      | some selectedError =>
          match parseSerializedCostAtScaleWithinBytes expected maxBytes
              raw.comparisonError with
          | none => none
          | some comparisonError =>
              some (parsedSerializedReportValue expected raw margin
                selectedError comparisonError)

theorem parseSerializedReportAtScale_components
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseSerializedReportAtScale expected maxBytes raw =
      some parsed) :
    ∃ margin selectedError comparisonError,
      parseSerializedCostAtScaleWithinBytes expected maxBytes raw.margin = some margin ∧
      parseSerializedCostAtScaleWithinBytes expected maxBytes raw.selectedError =
        some selectedError ∧
      parseSerializedCostAtScaleWithinBytes expected maxBytes raw.comparisonError =
        some comparisonError ∧
      parsedSerializedReportValue expected raw margin selectedError
        comparisonError = parsed := by
  unfold parseSerializedReportAtScale at accepted
  cases marginEq :
      parseSerializedCostAtScaleWithinBytes expected maxBytes raw.margin with
  | none => simp [marginEq] at accepted
  | some margin =>
      cases selectedEq :
          parseSerializedCostAtScaleWithinBytes expected maxBytes raw.selectedError with
      | none => simp [marginEq, selectedEq] at accepted
      | some selectedError =>
          cases comparisonEq :
              parseSerializedCostAtScaleWithinBytes expected maxBytes
                raw.comparisonError with
          | none => simp [marginEq, selectedEq, comparisonEq] at accepted
          | some comparisonError =>
              simp [marginEq, selectedEq, comparisonEq] at accepted
              exact ⟨margin, selectedError, comparisonError, rfl,
                rfl, rfl, accepted⟩

def SerializedCostWellFormed
    (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntCost) : Prop :=
  raw.denominator = expected.denominator ∧
  raw.unitsDecimal.utf8ByteSize ≤ maxBytes ∧
  CanonicalDecimal raw.unitsDecimal

def SerializedReportWellFormed
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntegerReport Edit) : Prop :=
  SerializedCostWellFormed expected maxBytes raw.margin ∧
  SerializedCostWellFormed expected maxBytes raw.selectedError ∧
  SerializedCostWellFormed expected maxBytes raw.comparisonError

theorem serializedCostWellFormed_iff_exists_parse
    (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntCost) :
    SerializedCostWellFormed expected maxBytes raw ↔
      ∃ parsed, parseSerializedCostAtScaleWithinBytes expected maxBytes raw =
        some parsed := by
  constructor
  · rintro ⟨tagOk, bytesOk, ⟨units, canonical⟩⟩
    let parsed : ScaledIntCost expected := ⟨units⟩
    exact ⟨parsed, (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected
      maxBytes raw parsed).mpr ⟨tagOk, bytesOk, canonical⟩⟩
  · rintro ⟨parsed, accepted⟩
    have info := (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected maxBytes
      raw parsed).mp accepted
    exact ⟨info.1, info.2.1, ⟨parsed.units, info.2.2⟩⟩

theorem parseSerializedReportAtScale_wellFormed
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseSerializedReportAtScale expected maxBytes raw =
      some parsed) :
    SerializedReportWellFormed expected maxBytes raw := by
  obtain ⟨margin, selectedError, comparisonError, marginEq, selectedEq,
    comparisonEq, _⟩ := parseSerializedReportAtScale_components expected
      maxBytes raw parsed accepted
  have marginInfo := (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected
    maxBytes raw.margin margin).mp marginEq
  have selectedInfo := (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected
    maxBytes raw.selectedError selectedError).mp selectedEq
  have comparisonInfo := (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected
    maxBytes raw.comparisonError comparisonError).mp comparisonEq
  exact ⟨
    ⟨marginInfo.1, marginInfo.2.1,
      ⟨margin.units, marginInfo.2.2⟩⟩,
    ⟨selectedInfo.1, selectedInfo.2.1,
      ⟨selectedError.units, selectedInfo.2.2⟩⟩,
    ⟨comparisonInfo.1, comparisonInfo.2.1,
      ⟨comparisonError.units, comparisonInfo.2.2⟩⟩⟩

theorem exists_parseSerializedReportAtScale_iff
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntegerReport Edit) :
    (∃ parsed, parseSerializedReportAtScale expected maxBytes raw =
      some parsed) ↔
    SerializedReportWellFormed expected maxBytes raw := by
  constructor
  · rintro ⟨parsed, accepted⟩
    exact parseSerializedReportAtScale_wellFormed expected maxBytes raw
      parsed accepted
  · rintro ⟨marginWellFormed, selectedWellFormed,
      comparisonWellFormed⟩
    obtain ⟨margin, marginEq⟩ :=
      (serializedCostWellFormed_iff_exists_parse expected maxBytes
        raw.margin).mp marginWellFormed
    obtain ⟨selectedError, selectedEq⟩ :=
      (serializedCostWellFormed_iff_exists_parse expected maxBytes
        raw.selectedError).mp selectedWellFormed
    obtain ⟨comparisonError, comparisonEq⟩ :=
      (serializedCostWellFormed_iff_exists_parse expected maxBytes
        raw.comparisonError).mp comparisonWellFormed
    exact ⟨parsedSerializedReportValue expected raw margin selectedError
      comparisonError, by
        simp [parseSerializedReportAtScale, marginEq, selectedEq,
          comparisonEq]⟩

theorem parseSerializedReportAtScale_preserves_metadata
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (raw : SerializedTaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseSerializedReportAtScale expected maxBytes raw =
      some parsed) :
    parsed.mode = raw.mode ∧
    parsed.selectedTarget = raw.selectedTarget ∧
    parsed.bestTarget = raw.bestTarget := by
  obtain ⟨margin, selectedError, comparisonError, _, _, _, parsedEq⟩ :=
    parseSerializedReportAtScale_components expected maxBytes raw parsed
      accepted
  rw [← parsedEq]
  exact ⟨rfl, rfl, rfl⟩

def serializeIntegerReport
    {Edit : Type u} {expected : PositiveScale}
    (report : IntegerReliabilityReport Edit expected) :
    SerializedTaggedIntegerReport Edit where
  mode := report.mode
  selectedTarget := report.selectedTarget
  bestTarget := report.bestTarget
  margin := serializeScaledCost expected report.margin
  selectedError := serializeScaledCost expected report.selectedError
  comparisonError := serializeScaledCost expected report.comparisonError

def IntegerReportReprsWithin
    {Edit : Type u} {expected : PositiveScale} (maxBytes : Nat)
    (report : IntegerReliabilityReport Edit expected) : Prop :=
  report.margin.units.repr.utf8ByteSize ≤ maxBytes ∧
  report.selectedError.units.repr.utf8ByteSize ≤ maxBytes ∧
  report.comparisonError.units.repr.utf8ByteSize ≤ maxBytes

theorem parseSerializedReportAtScale_serialize
    {Edit : Type u} (expected : PositiveScale) (maxBytes : Nat)
    (report : IntegerReliabilityReport Edit expected)
    (fits : IntegerReportReprsWithin maxBytes report) :
    parseSerializedReportAtScale expected maxBytes
      (serializeIntegerReport report) = some report := by
  unfold parseSerializedReportAtScale serializeIntegerReport
  rw [parseSerializedCostAtScaleWithinBytes_serializeScaledCost expected
      maxBytes report.margin fits.1,
    parseSerializedCostAtScaleWithinBytes_serializeScaledCost expected maxBytes
      report.selectedError fits.2.1,
    parseSerializedCostAtScaleWithinBytes_serializeScaledCost expected maxBytes
      report.comparisonError fits.2.2]
  rfl

def serializedLeadingZeroReport : SerializedTaggedIntegerReport Unit where
  mode := .overestimate
  selectedTarget := []
  bestTarget := []
  margin := ⟨1000, "1000"⟩
  selectedError := ⟨1000, "0"⟩
  comparisonError := ⟨1000, "0999"⟩

def serializedNegativeZeroReport : SerializedTaggedIntegerReport Unit where
  mode := .overestimate
  selectedTarget := []
  bestTarget := []
  margin := ⟨1000, "1000"⟩
  selectedError := ⟨1000, "-0"⟩
  comparisonError := ⟨1000, "999"⟩

def serializedMixedScaleReport : SerializedTaggedIntegerReport Unit where
  mode := .overestimate
  selectedTarget := []
  bestTarget := []
  margin := ⟨1000, "1000"⟩
  selectedError := ⟨1000, "0"⟩
  comparisonError := ⟨500, "999"⟩

theorem serializedCertifiedReport_roundtrip :
    parseSerializedReportAtScale witnessScale 4
      (serializeIntegerReport certifiedIntegerWitness) =
        some certifiedIntegerWitness := by
  apply parseSerializedReportAtScale_serialize
  norm_num [IntegerReportReprsWithin, certifiedIntegerWitness,
    overestimateIntegerReport, witnessScale]
  native_decide

theorem serializedLeadingZeroReport_rejected :
    parseSerializedReportAtScale witnessScale 4
      serializedLeadingZeroReport = none := by
  native_decide

theorem serializedNegativeZeroReport_rejected :
    parseSerializedReportAtScale witnessScale 4
      serializedNegativeZeroReport = none := by
  native_decide

theorem serializedMixedScaleReport_rejected :
    parseSerializedReportAtScale witnessScale 4
      serializedMixedScaleReport = none := by
  native_decide

theorem serializedCertifiedReport_too_long_rejected :
    parseSerializedReportAtScale witnessScale 3
      (serializeIntegerReport certifiedIntegerWitness) = none := by
  native_decide

/-- Canonical syntax is intentionally not semantic validity. `-1` has a
unique canonical representation, so the representation layer accepts it;
the existing nonnegative path-provenance layer remains load-bearing. -/
theorem serializedNegativeForgery_roundtrip :
    parseSerializedReportAtScale witnessScale 2
      (serializeIntegerReport negativeIntegerForgery) =
        some negativeIntegerForgery := by
  apply parseSerializedReportAtScale_serialize
  norm_num [IntegerReportReprsWithin, negativeIntegerForgery,
    overestimateIntegerReport, witnessScale]
  native_decide

theorem serializedNegativeForgery_still_certifies :
    negativeIntegerForgery.verdict = .certifiedStable :=
  negativeIntegerForgery_verdict

theorem serializedNegativeForgery_still_invalid :
    ¬negativeIntegerForgery.ErrorsNonnegative :=
  negativeIntegerForgery_invalid

end Sprawlens.FixedPointCanonicalArtifact
