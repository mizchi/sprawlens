import Sprawlens.FixedPointMarginProvenance

namespace Sprawlens.FixedPointScaleTag

open FixedPointEncodedCost
open FixedPointIntegerReport
open PathwiseReliabilityVerdict

universe u

/-- Raw serialized fixed-point field. Unlike `ScaledIntCost`, its scale tag is
ordinary untrusted data and may disagree with adjacent fields. -/
structure TaggedIntCost where
  denominator : Nat
  units : Int
deriving DecidableEq, Repr

def parseCostAtScale
    (expected : PositiveScale) (raw : TaggedIntCost) :
    Option (ScaledIntCost expected) :=
  if raw.denominator = expected.denominator
  then some ⟨raw.units⟩
  else none

theorem parseCostAtScale_eq_some_iff
    (expected : PositiveScale) (raw : TaggedIntCost)
    (parsed : ScaledIntCost expected) :
    parseCostAtScale expected raw = some parsed ↔
      raw.denominator = expected.denominator ∧
        parsed.units = raw.units := by
  by_cases tagEq : raw.denominator = expected.denominator
  · simp [parseCostAtScale, tagEq, FixedPointEncodedCost.ext_iff, eq_comm]
  · simp [parseCostAtScale, tagEq]

theorem parseCostAtScale_eq_none_iff
    (expected : PositiveScale) (raw : TaggedIntCost) :
    parseCostAtScale expected raw = none ↔
      raw.denominator ≠ expected.denominator := by
  by_cases tagEq : raw.denominator = expected.denominator <;>
    simp [parseCostAtScale, tagEq]

noncomputable def decodeTaggedCost (raw : TaggedIntCost) : Option ℝ :=
  if _denominatorPositive : 0 < raw.denominator then
    some ((raw.units : ℝ) / (raw.denominator : ℝ))
  else
    none

/-- Raw report before scale-tag validation. -/
structure TaggedIntegerReport (Edit : Type u) where
  mode : PathwiseApproximationMode
  selectedTarget : List Edit
  bestTarget : List Edit
  margin : TaggedIntCost
  selectedError : TaggedIntCost
  comparisonError : TaggedIntCost

def TaggedIntegerReport.requiredUnits
    {Edit : Type u} (report : TaggedIntegerReport Edit) : Int :=
  match report.mode with
  | .twoSided => report.selectedError.units + report.comparisonError.units
  | .overestimate => report.comparisonError.units
  | .underestimate => report.selectedError.units

/-- Deliberately unsafe comparison that ignores the three scale tags. It is
kept only to state the counterexample. -/
def TaggedIntegerReport.unsafeVerdict
    {Edit : Type u} (report : TaggedIntegerReport Edit) :
    ReliabilityVerdict :=
  if report.requiredUnits < report.margin.units
  then .certifiedStable
  else .inconclusive

/-- Trusted-schema parser. All numeric fields must carry the expected scale
before the report enters the homogeneous typed integer API. -/
def parseReportAtScale
    {Edit : Type u} (expected : PositiveScale)
    (raw : TaggedIntegerReport Edit) :
    Option (IntegerReliabilityReport Edit expected) :=
  if _marginTag : raw.margin.denominator = expected.denominator then
    if _selectedTag :
        raw.selectedError.denominator = expected.denominator then
      if _comparisonTag :
          raw.comparisonError.denominator = expected.denominator then
        some {
          mode := raw.mode
          selectedTarget := raw.selectedTarget
          bestTarget := raw.bestTarget
          margin := ⟨raw.margin.units⟩
          selectedError := ⟨raw.selectedError.units⟩
          comparisonError := ⟨raw.comparisonError.units⟩
        }
      else none
    else none
  else none

def parsedReportValue
    {Edit : Type u} (expected : PositiveScale)
    (raw : TaggedIntegerReport Edit) :
    IntegerReliabilityReport Edit expected where
  mode := raw.mode
  selectedTarget := raw.selectedTarget
  bestTarget := raw.bestTarget
  margin := ⟨raw.margin.units⟩
  selectedError := ⟨raw.selectedError.units⟩
  comparisonError := ⟨raw.comparisonError.units⟩

/-- Exact parser success contract: all three tags agree with the trusted
expected scale and the result is the corresponding homogeneous report. -/
theorem parseReportAtScale_eq_some_iff
    {Edit : Type u} (expected : PositiveScale)
    (raw : TaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected) :
    parseReportAtScale expected raw = some parsed ↔
      raw.margin.denominator = expected.denominator ∧
      raw.selectedError.denominator = expected.denominator ∧
      raw.comparisonError.denominator = expected.denominator ∧
      parsedReportValue expected raw = parsed := by
  by_cases marginTag : raw.margin.denominator = expected.denominator
  · by_cases selectedTag :
        raw.selectedError.denominator = expected.denominator
    · by_cases comparisonTag :
          raw.comparisonError.denominator = expected.denominator
      · simp [parseReportAtScale, parsedReportValue,
          marginTag, selectedTag, comparisonTag]
      · simp [parseReportAtScale, marginTag, selectedTag, comparisonTag]
    · simp [parseReportAtScale, marginTag, selectedTag]
  · simp [parseReportAtScale, marginTag]

theorem parseReportAtScale_eq_none_iff
    {Edit : Type u} (expected : PositiveScale)
    (raw : TaggedIntegerReport Edit) :
    parseReportAtScale expected raw = none ↔
      raw.margin.denominator ≠ expected.denominator ∨
      raw.selectedError.denominator ≠ expected.denominator ∨
      raw.comparisonError.denominator ≠ expected.denominator := by
  by_cases marginTag : raw.margin.denominator = expected.denominator
  · by_cases selectedTag :
        raw.selectedError.denominator = expected.denominator
    · by_cases comparisonTag :
          raw.comparisonError.denominator = expected.denominator <;>
        simp [parseReportAtScale, marginTag, selectedTag, comparisonTag]
    · simp [parseReportAtScale, marginTag, selectedTag]
  · simp [parseReportAtScale, marginTag]

/-- Once parsing succeeds, the raw unit comparison and typed verdict agree. -/
theorem unsafeVerdict_eq_parsed_verdict
    {Edit : Type u} (expected : PositiveScale)
    (raw : TaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseReportAtScale expected raw = some parsed) :
    raw.unsafeVerdict = parsed.verdict := by
  have parsedEq := (parseReportAtScale_eq_some_iff
    expected raw parsed).mp accepted |>.2.2.2
  rw [← parsedEq]
  cases modeEq : raw.mode <;>
    simp [TaggedIntegerReport.unsafeVerdict,
      TaggedIntegerReport.requiredUnits,
      IntegerReliabilityReport.verdict,
      IntegerReliabilityReport.requiredCost, parsedReportValue,
      FixedPointEncodedCost.add, modeEq]

/-- Successful scale validation therefore inherits the proved real decode
semantics of the homogeneous integer report. -/
theorem unsafeVerdict_eq_parsed_decode_verdict
    {Edit : Type u} (expected : PositiveScale)
    (raw : TaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseReportAtScale expected raw = some parsed) :
    raw.unsafeVerdict = parsed.decode.verdict := by
  calc
    raw.unsafeVerdict = parsed.verdict :=
      unsafeVerdict_eq_parsed_verdict expected raw parsed accepted
    _ = parsed.decode.verdict := parsed.verdict_eq_decode_verdict

/-- Units look certified (`999 < 1000`), but the error uses scale 500 while
the margin uses scale 1000. Their decoded values are approximately 1.998 and
1, so the real strict premise is false. -/
def mixedScaleForgery : TaggedIntegerReport Unit where
  mode := .overestimate
  selectedTarget := []
  bestTarget := []
  margin := ⟨1000, 1000⟩
  selectedError := ⟨1000, 0⟩
  comparisonError := ⟨500, 999⟩

theorem mixedScaleForgery_unsafe_certifies :
    mixedScaleForgery.unsafeVerdict = .certifiedStable := by
  norm_num [mixedScaleForgery, TaggedIntegerReport.unsafeVerdict,
    TaggedIntegerReport.requiredUnits]

theorem mixedScaleForgery_actual_strict_premise_fails :
    ¬(999 : ℝ) / 500 < (1000 : ℝ) / 1000 := by
  norm_num

/-- No trusted expected scale can accept a report whose margin and comparison
error tags disagree. -/
theorem mixedScaleForgery_rejected_at_every_scale
    (expected : PositiveScale) :
    parseReportAtScale expected mixedScaleForgery = none := by
  by_cases marginTag : 1000 = expected.denominator
  · have comparisonTag : 500 ≠ expected.denominator := by omega
    simp [parseReportAtScale, mixedScaleForgery, marginTag, comparisonTag]
  · simp [parseReportAtScale, mixedScaleForgery, marginTag]

def homogeneousTaggedWitness : TaggedIntegerReport Unit where
  mode := .overestimate
  selectedTarget := []
  bestTarget := []
  margin := ⟨1000, 1000⟩
  selectedError := ⟨1000, 0⟩
  comparisonError := ⟨1000, 999⟩

theorem homogeneousTaggedWitness_parses :
    parseReportAtScale witnessScale homogeneousTaggedWitness =
      some certifiedIntegerWitness := by
  norm_num [parseReportAtScale, homogeneousTaggedWitness,
    certifiedIntegerWitness, overestimateIntegerReport,
    FixedPointEncodedCost.zero, witnessScale]

theorem homogeneousTaggedWitness_verdict :
    homogeneousTaggedWitness.unsafeVerdict = .certifiedStable := by
  exact (unsafeVerdict_eq_parsed_verdict witnessScale
    homogeneousTaggedWitness certifiedIntegerWitness
    homogeneousTaggedWitness_parses).trans
      certifiedIntegerWitness_verdict

end Sprawlens.FixedPointScaleTag
