import Sprawlens.FixedPointCheckedScale

namespace Sprawlens.FixedPointIntegerReport

open FixedPointEncodedCost
open PathwiseReliabilityVerdict

universe u

/-- A pathwise reliability report whose numeric fields all share one fixed
point scale. Its verdict can be computed entirely with signed-integer
addition and strict comparison. -/
structure IntegerReliabilityReport
    (Edit : Type u) (scale : PositiveScale) where
  mode : PathwiseApproximationMode
  selectedTarget : List Edit
  bestTarget : List Edit
  margin : ScaledIntCost scale
  selectedError : ScaledIntCost scale
  comparisonError : ScaledIntCost scale

def IntegerReliabilityReport.requiredCost
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) : ScaledIntCost scale :=
  match report.mode with
  | .twoSided => add report.selectedError report.comparisonError
  | .overestimate => report.comparisonError
  | .underestimate => report.selectedError

/-- Executable integer-only verdict. As in the real report, failure of the
strict sufficient condition is `inconclusive`, never `unstable`. -/
def IntegerReliabilityReport.verdict
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) : ReliabilityVerdict :=
  if report.requiredCost.units < report.margin.units
  then .certifiedStable
  else .inconclusive

noncomputable def IntegerReliabilityReport.decode
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) :
    PathwiseReliabilityReport Edit where
  mode := report.mode
  selectedTarget := report.selectedTarget
  bestTarget := report.bestTarget
  margin := FixedPointEncodedCost.decode report.margin
  selectedError := FixedPointEncodedCost.decode report.selectedError
  comparisonError := FixedPointEncodedCost.decode report.comparisonError

/-- Positive scale makes strict order on integer units exactly the same as
strict order after real decoding. -/
theorem units_lt_iff_decode_lt
    {scale : PositiveScale} (left right : ScaledIntCost scale) :
    left.units < right.units ↔
      FixedPointEncodedCost.decode left <
        FixedPointEncodedCost.decode right := by
  rw [FixedPointEncodedCost.decode, FixedPointEncodedCost.decode,
    div_lt_div_iff_of_pos_right]
  exact_mod_cast Iff.rfl
  exact_mod_cast scale.positive

theorem units_le_iff_decode_le
    {scale : PositiveScale} (left right : ScaledIntCost scale) :
    left.units ≤ right.units ↔
      FixedPointEncodedCost.decode left ≤
        FixedPointEncodedCost.decode right := by
  rw [FixedPointEncodedCost.decode, FixedPointEncodedCost.decode,
    div_le_div_iff_of_pos_right]
  exact_mod_cast Iff.rfl
  exact_mod_cast scale.positive

theorem units_nonnegative_iff_decode_nonnegative
    {scale : PositiveScale} (cost : ScaledIntCost scale) :
    0 ≤ cost.units ↔ 0 ≤ FixedPointEncodedCost.decode cost := by
  simpa using units_le_iff_decode_le (zero scale) cost

theorem IntegerReliabilityReport.decode_requiredCost
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) :
    FixedPointEncodedCost.decode report.requiredCost =
      report.decode.requiredError := by
  cases modeEq : report.mode <;>
    simp [IntegerReliabilityReport.requiredCost,
      IntegerReliabilityReport.decode,
      PathwiseReliabilityReport.requiredError, modeEq]

/-- The executable integer verdict is extensionally identical to running the
existing real-valued verdict after decoding. -/
theorem IntegerReliabilityReport.verdict_eq_decode_verdict
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) :
    report.verdict = report.decode.verdict := by
  unfold IntegerReliabilityReport.verdict
  unfold PathwiseReliabilityReport.verdict
  rw [← report.decode_requiredCost]
  change (if report.requiredCost.units < report.margin.units
    then ReliabilityVerdict.certifiedStable
    else ReliabilityVerdict.inconclusive) =
      if FixedPointEncodedCost.decode report.requiredCost <
        FixedPointEncodedCost.decode report.margin
      then ReliabilityVerdict.certifiedStable
      else ReliabilityVerdict.inconclusive
  by_cases unitsLt : report.requiredCost.units < report.margin.units
  · have decodedLt :=
      (units_lt_iff_decode_lt report.requiredCost report.margin).mp unitsLt
    simp [unitsLt, decodedLt]
  · have notDecodedLt :
      ¬FixedPointEncodedCost.decode report.requiredCost <
        FixedPointEncodedCost.decode report.margin := fun decodedLt =>
      unitsLt ((units_lt_iff_decode_lt
        report.requiredCost report.margin).mpr decodedLt)
    simp [unitsLt, notDecodedLt]

theorem IntegerReliabilityReport.verdict_eq_certifiedStable_iff
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) :
    report.verdict = .certifiedStable ↔
      report.requiredCost.units < report.margin.units := by
  by_cases certified :
      report.requiredCost.units < report.margin.units <;>
    simp [IntegerReliabilityReport.verdict, certified]

theorem IntegerReliabilityReport.verdict_eq_inconclusive_iff
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) :
    report.verdict = .inconclusive ↔
      ¬report.requiredCost.units < report.margin.units := by
  by_cases certified :
      report.requiredCost.units < report.margin.units <;>
    simp [IntegerReliabilityReport.verdict, certified]

def twoSidedIntegerReport
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError : ScaledIntCost scale) :
    IntegerReliabilityReport Edit scale where
  mode := .twoSided
  selectedTarget
  bestTarget
  margin
  selectedError
  comparisonError

def overestimateIntegerReport
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin comparisonError : ScaledIntCost scale) :
    IntegerReliabilityReport Edit scale where
  mode := .overestimate
  selectedTarget
  bestTarget
  margin
  selectedError := zero scale
  comparisonError

def underestimateIntegerReport
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError : ScaledIntCost scale) :
    IntegerReliabilityReport Edit scale where
  mode := .underestimate
  selectedTarget
  bestTarget
  margin
  selectedError
  comparisonError := zero scale

theorem twoSidedIntegerReport_certified_iff
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError : ScaledIntCost scale) :
    (twoSidedIntegerReport selectedTarget bestTarget margin
      selectedError comparisonError).verdict = .certifiedStable ↔
      selectedError.units + comparisonError.units < margin.units := by
  rw [IntegerReliabilityReport.verdict_eq_certifiedStable_iff]
  rfl

theorem overestimateIntegerReport_certified_iff
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin comparisonError : ScaledIntCost scale) :
    (overestimateIntegerReport selectedTarget bestTarget margin
      comparisonError).verdict = .certifiedStable ↔
      comparisonError.units < margin.units := by
  rw [IntegerReliabilityReport.verdict_eq_certifiedStable_iff]
  rfl

theorem underestimateIntegerReport_certified_iff
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError : ScaledIntCost scale) :
    (underestimateIntegerReport selectedTarget bestTarget margin
      selectedError).verdict = .certifiedStable ↔
      selectedError.units < margin.units := by
  rw [IntegerReliabilityReport.verdict_eq_certifiedStable_iff]
  rfl

theorem decode_twoSidedIntegerReport
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError : ScaledIntCost scale) :
    (twoSidedIntegerReport selectedTarget bestTarget margin
      selectedError comparisonError).decode =
        twoSidedReport selectedTarget bestTarget
          (FixedPointEncodedCost.decode margin)
          (FixedPointEncodedCost.decode selectedError)
          (FixedPointEncodedCost.decode comparisonError) := by
  rfl

theorem decode_overestimateIntegerReport
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin comparisonError : ScaledIntCost scale) :
    (overestimateIntegerReport selectedTarget bestTarget margin
      comparisonError).decode =
        overestimateReport selectedTarget bestTarget
          (FixedPointEncodedCost.decode margin)
          (FixedPointEncodedCost.decode comparisonError) := by
  simp [overestimateIntegerReport, IntegerReliabilityReport.decode,
    overestimateReport]

theorem decode_underestimateIntegerReport
    {Edit : Type u} {scale : PositiveScale}
    (selectedTarget bestTarget : List Edit)
    (margin selectedError : ScaledIntCost scale) :
    (underestimateIntegerReport selectedTarget bestTarget margin
      selectedError).decode =
        underestimateReport selectedTarget bestTarget
          (FixedPointEncodedCost.decode margin)
          (FixedPointEncodedCost.decode selectedError) := by
  simp [underestimateIntegerReport, IntegerReliabilityReport.decode,
    underestimateReport]

/-- Integer comparison does not by itself validate error provenance or
nonnegativity. This predicate remains a separate proof-carrying boundary. -/
def IntegerReliabilityReport.ErrorsNonnegative
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale) : Prop :=
  0 ≤ report.selectedError.units ∧ 0 ≤ report.comparisonError.units

theorem IntegerReliabilityReport.decoded_errors_nonnegative
    {Edit : Type u} {scale : PositiveScale}
    (report : IntegerReliabilityReport Edit scale)
    (valid : report.ErrorsNonnegative) :
    0 ≤ report.decode.selectedError ∧
      0 ≤ report.decode.comparisonError := by
  constructor
  · change 0 ≤ (report.selectedError.units : ℝ) /
      (scale.denominator : ℝ)
    apply div_nonneg
    · exact_mod_cast valid.1
    · exact_mod_cast scale.positive.le
  · change 0 ≤ (report.comparisonError.units : ℝ) /
      (scale.denominator : ℝ)
    apply div_nonneg
    · exact_mod_cast valid.2
    · exact_mod_cast scale.positive.le

def witnessScale : PositiveScale := ⟨1000, by norm_num⟩

def certifiedIntegerWitness : IntegerReliabilityReport Unit witnessScale :=
  overestimateIntegerReport [] [] ⟨1000⟩ ⟨999⟩

theorem certifiedIntegerWitness_verdict :
    certifiedIntegerWitness.verdict = .certifiedStable := by
  norm_num [certifiedIntegerWitness, overestimateIntegerReport,
    IntegerReliabilityReport.verdict,
    IntegerReliabilityReport.requiredCost]

def boundaryIntegerWitness : IntegerReliabilityReport Unit witnessScale :=
  overestimateIntegerReport [] [] ⟨1000⟩ ⟨1000⟩

theorem boundaryIntegerWitness_verdict :
    boundaryIntegerWitness.verdict = .inconclusive := by
  norm_num [boundaryIntegerWitness, overestimateIntegerReport,
    IntegerReliabilityReport.verdict,
    IntegerReliabilityReport.requiredCost]

/-- Signed integer arithmetic alone still admits the same negative-error
forgery as the raw real report. Provenance/nonnegativity checks are therefore
load-bearing. -/
def negativeIntegerForgery : IntegerReliabilityReport Unit witnessScale :=
  overestimateIntegerReport [] [] ⟨0⟩ ⟨-1⟩

theorem negativeIntegerForgery_verdict :
    negativeIntegerForgery.verdict = .certifiedStable := by
  norm_num [negativeIntegerForgery, overestimateIntegerReport,
    IntegerReliabilityReport.verdict,
    IntegerReliabilityReport.requiredCost]

theorem negativeIntegerForgery_invalid :
    ¬negativeIntegerForgery.ErrorsNonnegative := by
  norm_num [negativeIntegerForgery, overestimateIntegerReport,
    IntegerReliabilityReport.ErrorsNonnegative]

end Sprawlens.FixedPointIntegerReport
