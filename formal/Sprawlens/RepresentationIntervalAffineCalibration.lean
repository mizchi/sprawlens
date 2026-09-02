import Sprawlens.RepresentationIntervalCorrelatedError

namespace Sprawlens.RepresentationIntervalAffineCalibration

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness

universe u v

def affineValue
    {Artifact : Type u}
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (value : ℝ) : ℝ :=
  scale artifact * value + shift artifact

def affineEndpoint
    {Artifact : Type u} {Constraint : Type v}
    (endpoint : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraint : Constraint) : ℝ :=
  affineValue scale shift artifact (endpoint artifact constraint)

theorem intervalAccepted_positiveAffine_iff
    {Artifact : Type u} {Constraint : Type v}
    (lower upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraint : Constraint)
    (center : ℝ)
    (scalePositive : 0 < scale artifact) :
    IntervalAcceptedAt (affineEndpoint lower scale shift)
        (affineEndpoint upper scale shift) artifact constraint
        (affineValue scale shift artifact center) ↔
      IntervalAcceptedAt lower upper artifact constraint center := by
  unfold IntervalAcceptedAt affineEndpoint affineValue
  constructor <;> rintro ⟨lowerLe, upperLe⟩ <;>
    constructor <;> nlinarith

theorem commonCenter_positiveAffine_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (scalePositive : 0 < scale artifact) :
    CommonIntervalCenterAt lower upper artifact constraints ↔
      CommonIntervalCenterAt (affineEndpoint lower scale shift)
        (affineEndpoint upper scale shift) artifact constraints := by
  constructor
  · rintro ⟨center, centerAccepted⟩
    refine ⟨affineValue scale shift artifact center, ?_⟩
    intro constraint constraintMem
    exact (intervalAccepted_positiveAffine_iff lower upper scale shift artifact
      constraint center scalePositive).mpr
        (centerAccepted constraint constraintMem)
  · rintro ⟨transformedCenter, centerAccepted⟩
    let center := (transformedCenter - shift artifact) / scale artifact
    have scaleNe : scale artifact ≠ 0 := ne_of_gt scalePositive
    have mappedCenter :
        affineValue scale shift artifact center = transformedCenter := by
      dsimp [center, affineValue]
      field_simp [scaleNe]
      ring
    refine ⟨center, ?_⟩
    intro constraint constraintMem
    apply (intervalAccepted_positiveAffine_iff lower upper scale shift artifact
      constraint center scalePositive).mp
    rw [mappedCenter]
    exact centerAccepted constraint constraintMem

theorem pairwiseFeasibility_positiveAffine_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (scalePositive : 0 < scale artifact) :
    PairwiseIntervalFeasibleAt lower upper artifact constraints ↔
      PairwiseIntervalFeasibleAt (affineEndpoint lower scale shift)
        (affineEndpoint upper scale shift) artifact constraints := by
  rw [pairwiseIntervalFeasible_iff_commonCenter,
    pairwiseIntervalFeasible_iff_commonCenter]
  exact commonCenter_positiveAffine_iff lower upper scale shift artifact
    constraints scalePositive

theorem maxLowerCenter_positiveAffine
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (scalePositive : 0 < scale artifact) :
    maxLowerCenter (affineEndpoint lower scale shift) artifact constraints
        nonempty =
      affineValue scale shift artifact
        (maxLowerCenter lower artifact constraints nonempty) := by
  apply le_antisymm
  · obtain ⟨constraint, constraintMem, transformedEq⟩ :=
      maxLowerCenter_is_attained (affineEndpoint lower scale shift) artifact
        constraints nonempty
    have exactLe := lower_le_maxLowerCenter lower artifact constraints nonempty
      constraint constraintMem
    rw [← transformedEq]
    unfold affineEndpoint affineValue
    nlinarith
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      maxLowerCenter_is_attained lower artifact constraints nonempty
    have transformedLe := lower_le_maxLowerCenter
      (affineEndpoint lower scale shift) artifact constraints nonempty constraint
      constraintMem
    rw [← exactEq]
    exact transformedLe

theorem minUpperCenter_positiveAffine
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (scalePositive : 0 < scale artifact) :
    minUpperCenter (affineEndpoint upper scale shift) artifact constraints
        nonempty =
      affineValue scale shift artifact
        (minUpperCenter upper artifact constraints nonempty) := by
  apply le_antisymm
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      minUpperCenter_is_attained upper artifact constraints nonempty
    have transformedLe := minUpperCenter_le_upper
      (affineEndpoint upper scale shift) artifact constraints nonempty constraint
      constraintMem
    rw [← exactEq]
    exact transformedLe
  · obtain ⟨constraint, constraintMem, transformedEq⟩ :=
      minUpperCenter_is_attained (affineEndpoint upper scale shift) artifact
        constraints nonempty
    have exactLe := minUpperCenter_le_upper upper artifact constraints nonempty
      constraint constraintMem
    rw [← transformedEq]
    unfold affineEndpoint affineValue
    nlinarith

theorem intervalFeasibilityGap_positiveAffine
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (scalePositive : 0 < scale artifact) :
    intervalFeasibilityGap (affineEndpoint lower scale shift)
        (affineEndpoint upper scale shift) artifact constraints nonempty =
      scale artifact *
        intervalFeasibilityGap lower upper artifact constraints nonempty := by
  unfold intervalFeasibilityGap
  rw [maxLowerCenter_positiveAffine lower scale shift artifact constraints
      nonempty scalePositive,
    minUpperCenter_positiveAffine upper scale shift artifact constraints
      nonempty scalePositive]
  unfold affineValue
  ring

def PositiveAffineResidualBoundAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (residualError : ℝ) : Prop :=
  EndpointPerturbationBoundAt (affineEndpoint exactLower scale shift)
    (affineEndpoint exactUpper scale shift) observedLower observedUpper artifact
      constraints residualError

theorem exactPositiveAffine_has_zeroResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    PositiveAffineResidualBoundAt exactLower exactUpper
      (affineEndpoint exactLower scale shift)
      (affineEndpoint exactUpper scale shift) scale shift artifact constraints
        0 := by
  constructor
  · norm_num
  · intro constraint _
    constructor <;> simp

theorem observedGap_ge_scaledExactGap_sub_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (scalePositive : 0 < scale artifact)
    (residual : PositiveAffineResidualBoundAt exactLower exactUpper
      observedLower observedUpper scale shift artifact constraints
        residualError) :
    scale artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty -
        2 * residualError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have bound := observedGap_ge_exactGap_sub_twoError
    (affineEndpoint exactLower scale shift)
    (affineEndpoint exactUpper scale shift) observedLower observedUpper artifact
      constraints nonempty residualError residual
  rw [intervalFeasibilityGap_positiveAffine exactLower exactUpper scale shift
    artifact constraints nonempty scalePositive] at bound
  exact bound

theorem commonCenter_preserved_of_scaledGap_ge_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (scalePositive : 0 < scale artifact)
    (residual : PositiveAffineResidualBoundAt exactLower exactUpper
      observedLower observedUpper scale shift artifact constraints residualError)
    (robustGap : 2 * residualError ≤ scale artifact *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have gapBound := observedGap_ge_scaledExactGap_sub_twoResidual exactLower
    exactUpper observedLower observedUpper scale shift artifact constraints
      nonempty residualError scalePositive residual
  linarith

def zeroScale (_artifact : Unit) : ℝ := 0

def zeroShift (_artifact : Unit) : ℝ := 0

theorem zeroScale_can_hide_infeasible_intervals :
    ¬CommonIntervalCenterAt separatedLower separatedUpper () Finset.univ ∧
      CommonIntervalCenterAt (affineEndpoint separatedLower zeroScale zeroShift)
        (affineEndpoint separatedUpper zeroScale zeroShift) () Finset.univ := by
  constructor
  · intro common
    exact separatedIntervals_not_pairwise
      (commonCenter_implies_pairwiseIntervalFeasible separatedLower
        separatedUpper () Finset.univ common)
  · refine ⟨0, ?_⟩
    intro constraint _
    simp [IntervalAcceptedAt, affineEndpoint, affineValue, zeroScale, zeroShift]

def negativeScale (_artifact : Unit) : ℝ := -1

def unitLower (_artifact : Unit) (_constraint : Unit) : ℝ := -1

def unitUpper (_artifact : Unit) (_constraint : Unit) : ℝ := 1

theorem negativeScale_directEndpoints_have_no_center :
    ¬CommonIntervalCenterAt (affineEndpoint unitLower negativeScale zeroShift)
      (affineEndpoint unitUpper negativeScale zeroShift) () Finset.univ := by
  rintro ⟨center, centerAccepted⟩
  have accepted := centerAccepted () (by simp)
  norm_num [IntervalAcceptedAt, affineEndpoint, affineValue, unitLower,
    unitUpper, negativeScale, zeroShift] at accepted
  linarith

def reversedAffineLower
    {Artifact : Type u} {Constraint : Type v}
    (upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ) : Artifact → Constraint → ℝ :=
  affineEndpoint upper scale shift

def reversedAffineUpper
    {Artifact : Type u} {Constraint : Type v}
    (lower : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ) : Artifact → Constraint → ℝ :=
  affineEndpoint lower scale shift

theorem intervalAccepted_negativeAffine_reversed_iff
    {Artifact : Type u} {Constraint : Type v}
    (lower upper : Artifact → Constraint → ℝ)
    (scale shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraint : Constraint)
    (center : ℝ)
    (scaleNegative : scale artifact < 0) :
    IntervalAcceptedAt (reversedAffineLower upper scale shift)
        (reversedAffineUpper lower scale shift) artifact constraint
        (affineValue scale shift artifact center) ↔
      IntervalAcceptedAt lower upper artifact constraint center := by
  unfold IntervalAcceptedAt reversedAffineLower reversedAffineUpper
    affineEndpoint affineValue
  constructor <;> rintro ⟨lowerLe, upperLe⟩ <;>
    constructor <;> nlinarith

theorem negativeScale_reversedEndpoints_restore_center :
    CommonIntervalCenterAt (reversedAffineLower unitUpper negativeScale zeroShift)
      (reversedAffineUpper unitLower negativeScale zeroShift) () Finset.univ := by
  refine ⟨0, ?_⟩
  intro constraint _
  cases constraint
  norm_num [IntervalAcceptedAt, reversedAffineLower, reversedAffineUpper,
    affineEndpoint, affineValue, unitLower, unitUpper, negativeScale, zeroShift]

end Sprawlens.RepresentationIntervalAffineCalibration
