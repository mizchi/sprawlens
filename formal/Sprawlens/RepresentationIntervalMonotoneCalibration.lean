import Sprawlens.RepresentationIntervalAffineCalibration

namespace Sprawlens.RepresentationIntervalMonotoneCalibration

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalAffineCalibration

universe u v

def calibratedEndpoint
    {Artifact : Type u} {Constraint : Type v}
    (endpoint : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraint : Constraint) : ℝ :=
  calibration artifact (endpoint artifact constraint)

theorem intervalAccepted_orderEmbedding_iff
    {Artifact : Type u} {Constraint : Type v}
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraint : Constraint)
    (center : ℝ) :
    IntervalAcceptedAt (calibratedEndpoint lower calibration)
        (calibratedEndpoint upper calibration) artifact constraint
        (calibration artifact center) ↔
      IntervalAcceptedAt lower upper artifact constraint center := by
  simp only [IntervalAcceptedAt, calibratedEndpoint,
    (calibration artifact).le_iff_le]

/-- Pairwise interval feasibility is invariant under an artifact-wide order
embedding.  Surjectivity is unnecessary: a transformed witness between two
mapped intervals reflects the four endpoint inequalities needed to construct
an exact-domain witness. -/
theorem pairwiseFeasibility_orderEmbedding_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    PairwiseIntervalFeasibleAt lower upper artifact constraints ↔
      PairwiseIntervalFeasibleAt (calibratedEndpoint lower calibration)
        (calibratedEndpoint upper calibration) artifact constraints := by
  constructor
  · intro pairwise first firstMem second secondMem
    obtain ⟨center, firstAccepted, secondAccepted⟩ :=
      pairwise first firstMem second secondMem
    exact ⟨calibration artifact center,
      (intervalAccepted_orderEmbedding_iff lower upper calibration artifact
        first center).mpr firstAccepted,
      (intervalAccepted_orderEmbedding_iff lower upper calibration artifact
        second center).mpr secondAccepted⟩
  · intro transformed first firstMem second secondMem
    obtain ⟨transformedCenter, firstAccepted, secondAccepted⟩ :=
      transformed first firstMem second secondMem
    change
      calibration artifact (lower artifact first) ≤ transformedCenter ∧
          transformedCenter ≤ calibration artifact (upper artifact first)
        at firstAccepted
    change
      calibration artifact (lower artifact second) ≤ transformedCenter ∧
          transformedCenter ≤ calibration artifact (upper artifact second)
        at secondAccepted
    have firstLowerLeFirstUpper :
        lower artifact first ≤ upper artifact first :=
      (calibration artifact).le_iff_le.mp
        (firstAccepted.1.trans firstAccepted.2)
    have secondLowerLeFirstUpper :
        lower artifact second ≤ upper artifact first :=
      (calibration artifact).le_iff_le.mp
        (secondAccepted.1.trans firstAccepted.2)
    have firstLowerLeSecondUpper :
        lower artifact first ≤ upper artifact second :=
      (calibration artifact).le_iff_le.mp
        (firstAccepted.1.trans secondAccepted.2)
    have secondLowerLeSecondUpper :
        lower artifact second ≤ upper artifact second :=
      (calibration artifact).le_iff_le.mp
        (secondAccepted.1.trans secondAccepted.2)
    refine ⟨max (lower artifact first) (lower artifact second), ?_, ?_⟩
    · exact ⟨le_max_left _ _,
        max_le firstLowerLeFirstUpper secondLowerLeFirstUpper⟩
    · exact ⟨le_max_right _ _,
        max_le firstLowerLeSecondUpper secondLowerLeSecondUpper⟩

/-- Finite common-center feasibility is an ordinal property.  A strictly
increasing calibration need not be onto: finite Helly reconstruction fills
any gaps in its range when reflecting a transformed common center. -/
theorem commonCenter_orderEmbedding_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    CommonIntervalCenterAt lower upper artifact constraints ↔
      CommonIntervalCenterAt (calibratedEndpoint lower calibration)
        (calibratedEndpoint upper calibration) artifact constraints := by
  rw [← pairwiseIntervalFeasible_iff_commonCenter lower upper artifact
      constraints,
    ← pairwiseIntervalFeasible_iff_commonCenter
      (calibratedEndpoint lower calibration)
      (calibratedEndpoint upper calibration) artifact constraints]
  exact pairwiseFeasibility_orderEmbedding_iff lower upper calibration artifact
    constraints

theorem maxLowerCenter_orderEmbedding
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    maxLowerCenter (calibratedEndpoint lower calibration) artifact constraints
        nonempty =
      calibration artifact
        (maxLowerCenter lower artifact constraints nonempty) := by
  apply le_antisymm
  · obtain ⟨constraint, constraintMem, transformedEq⟩ :=
      maxLowerCenter_is_attained (calibratedEndpoint lower calibration)
        artifact constraints nonempty
    have exactLe := lower_le_maxLowerCenter lower artifact constraints nonempty
      constraint constraintMem
    rw [← transformedEq]
    exact (calibration artifact).monotone exactLe
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      maxLowerCenter_is_attained lower artifact constraints nonempty
    have transformedLe := lower_le_maxLowerCenter
      (calibratedEndpoint lower calibration) artifact constraints nonempty
        constraint constraintMem
    rw [← exactEq]
    exact transformedLe

theorem minUpperCenter_orderEmbedding
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    minUpperCenter (calibratedEndpoint upper calibration) artifact constraints
        nonempty =
      calibration artifact
        (minUpperCenter upper artifact constraints nonempty) := by
  apply le_antisymm
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      minUpperCenter_is_attained upper artifact constraints nonempty
    have transformedLe := minUpperCenter_le_upper
      (calibratedEndpoint upper calibration) artifact constraints nonempty
        constraint constraintMem
    rw [← exactEq]
    exact transformedLe
  · obtain ⟨constraint, constraintMem, transformedEq⟩ :=
      minUpperCenter_is_attained (calibratedEndpoint upper calibration)
        artifact constraints nonempty
    have exactLe := minUpperCenter_le_upper upper artifact constraints nonempty
      constraint constraintMem
    rw [← transformedEq]
    exact (calibration artifact).monotone exactLe

/-- Under a nonlinear calibration the numerical gap is the difference of the
mapped extrema, not generally a constant multiple of the original gap. -/
theorem intervalFeasibilityGap_orderEmbedding
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    intervalFeasibilityGap (calibratedEndpoint lower calibration)
        (calibratedEndpoint upper calibration) artifact constraints nonempty =
      calibration artifact
          (minUpperCenter upper artifact constraints nonempty) -
        calibration artifact
          (maxLowerCenter lower artifact constraints nonempty) := by
  unfold intervalFeasibilityGap
  rw [maxLowerCenter_orderEmbedding lower calibration artifact constraints
      nonempty,
    minUpperCenter_orderEmbedding upper calibration artifact constraints
      nonempty]

/-- Although the magnitude is coordinate-dependent, the feasibility verdict
given by the sign of the gap is invariant under every order embedding. -/
theorem intervalFeasibilityGap_nonnegative_orderEmbedding_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    0 ≤ intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints
          nonempty ↔
      0 ≤ intervalFeasibilityGap lower upper artifact constraints
        nonempty := by
  rw [intervalFeasibilityGap_orderEmbedding lower upper calibration artifact
      constraints nonempty]
  unfold intervalFeasibilityGap
  simp only [sub_nonneg, (calibration artifact).le_iff_le]

noncomputable def cubeCalibration : ℝ ↪o ℝ :=
  OrderEmbedding.ofStrictMono (fun value : ℝ ↦ value ^ 3)
    (by
      exact (show Odd 3 by decide).strictMono_pow)

theorem cubeCalibration_two_equal_exact_gaps_have_unequal_mapped_gaps :
    (1 : ℝ) - 0 = 2 - 1 ∧
      cubeCalibration 1 - cubeCalibration 0 ≠
        cubeCalibration 2 - cubeCalibration 1 := by
  norm_num [cubeCalibration, OrderEmbedding.ofStrictMono]

/-- No artifact-independent multiplicative scale can describe the numerical
gap of the cubic calibration even for two equal unit gaps. -/
theorem cubeCalibration_has_no_constant_gap_scale :
    ¬∃ scale : ℝ,
      cubeCalibration 1 - cubeCalibration 0 = scale * (1 - 0) ∧
        cubeCalibration 2 - cubeCalibration 1 = scale * (2 - 1) := by
  rintro ⟨scale, firstGap, secondGap⟩
  norm_num [cubeCalibration, OrderEmbedding.ofStrictMono] at firstGap secondGap
  linarith

/-- Weak monotonicity alone is insufficient: the constant zero calibration is
monotone but collapses two separated singleton intervals to the same point. -/
theorem monotoneCalibration_can_hide_infeasibility :
    Monotone (affineValue zeroScale zeroShift ()) ∧
      ¬CommonIntervalCenterAt separatedLower separatedUpper () Finset.univ ∧
      CommonIntervalCenterAt
        (affineEndpoint separatedLower zeroScale zeroShift)
        (affineEndpoint separatedUpper zeroScale zeroShift) () Finset.univ := by
  constructor
  · intro first second _
    simp [affineValue, zeroScale, zeroShift]
  · exact zeroScale_can_hide_infeasible_intervals

end Sprawlens.RepresentationIntervalMonotoneCalibration
