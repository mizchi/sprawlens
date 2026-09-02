import Sprawlens.RepresentationIntervalRobustness

namespace Sprawlens.RepresentationIntervalCorrelatedError

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness

universe u v

def translateEndpoint
    {Artifact : Type u} {Constraint : Type v}
    (endpoint : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraint : Constraint) : ℝ :=
  endpoint artifact constraint + shift artifact

theorem intervalAccepted_translation_iff
    {Artifact : Type u} {Constraint : Type v}
    (lower upper : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraint : Constraint)
    (center : ℝ) :
    IntervalAcceptedAt (translateEndpoint lower shift)
        (translateEndpoint upper shift) artifact constraint
        (center + shift artifact) ↔
      IntervalAcceptedAt lower upper artifact constraint center := by
  unfold IntervalAcceptedAt translateEndpoint
  constructor <;> rintro ⟨lowerLe, upperLe⟩ <;>
    constructor <;> linarith

theorem commonCenter_translation_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    CommonIntervalCenterAt lower upper artifact constraints ↔
      CommonIntervalCenterAt (translateEndpoint lower shift)
        (translateEndpoint upper shift) artifact constraints := by
  constructor
  · rintro ⟨center, centerAccepted⟩
    refine ⟨center + shift artifact, ?_⟩
    intro constraint constraintMem
    exact (intervalAccepted_translation_iff lower upper shift artifact
      constraint center).mpr (centerAccepted constraint constraintMem)
  · rintro ⟨shiftedCenter, centerAccepted⟩
    refine ⟨shiftedCenter - shift artifact, ?_⟩
    intro constraint constraintMem
    have shiftedAccepted := centerAccepted constraint constraintMem
    have translated :=
      (intervalAccepted_translation_iff lower upper shift artifact constraint
        (shiftedCenter - shift artifact)).mp (by
          simpa only [sub_add_cancel] using shiftedAccepted)
    exact translated

theorem pairwiseFeasibility_translation_iff
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    PairwiseIntervalFeasibleAt lower upper artifact constraints ↔
      PairwiseIntervalFeasibleAt (translateEndpoint lower shift)
        (translateEndpoint upper shift) artifact constraints := by
  rw [pairwiseIntervalFeasible_iff_commonCenter,
    pairwiseIntervalFeasible_iff_commonCenter]
  exact commonCenter_translation_iff lower upper shift artifact constraints

theorem maxLowerCenter_translation
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    maxLowerCenter (translateEndpoint lower shift) artifact constraints
        nonempty =
      maxLowerCenter lower artifact constraints nonempty + shift artifact := by
  apply le_antisymm
  · obtain ⟨constraint, constraintMem, translatedEq⟩ :=
      maxLowerCenter_is_attained (translateEndpoint lower shift) artifact
        constraints nonempty
    have exactLe := lower_le_maxLowerCenter lower artifact constraints nonempty
      constraint constraintMem
    rw [← translatedEq]
    unfold translateEndpoint
    linarith
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      maxLowerCenter_is_attained lower artifact constraints nonempty
    have translatedLe := lower_le_maxLowerCenter (translateEndpoint lower shift)
      artifact constraints nonempty constraint constraintMem
    rw [← exactEq]
    exact translatedLe

theorem minUpperCenter_translation
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (upper : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    minUpperCenter (translateEndpoint upper shift) artifact constraints
        nonempty =
      minUpperCenter upper artifact constraints nonempty + shift artifact := by
  apply le_antisymm
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      minUpperCenter_is_attained upper artifact constraints nonempty
    have translatedLe := minUpperCenter_le_upper
      (translateEndpoint upper shift) artifact constraints nonempty constraint
      constraintMem
    rw [← exactEq]
    exact translatedLe
  · obtain ⟨constraint, constraintMem, translatedEq⟩ :=
      minUpperCenter_is_attained (translateEndpoint upper shift) artifact
        constraints nonempty
    have exactLe := minUpperCenter_le_upper upper artifact constraints nonempty
      constraint constraintMem
    rw [← translatedEq]
    unfold translateEndpoint
    linarith

/-- An artifact-wide common-mode translation cancels from the feasibility gap,
regardless of its magnitude. -/
theorem intervalFeasibilityGap_translation_invariant
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    intervalFeasibilityGap (translateEndpoint lower shift)
        (translateEndpoint upper shift) artifact constraints nonempty =
      intervalFeasibilityGap lower upper artifact constraints nonempty := by
  unfold intervalFeasibilityGap
  rw [maxLowerCenter_translation lower shift artifact constraints nonempty,
    minUpperCenter_translation upper shift artifact constraints nonempty]
  ring

def CommonModeResidualBoundAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (residualError : ℝ) : Prop :=
  EndpointPerturbationBoundAt (translateEndpoint exactLower shift)
    (translateEndpoint exactUpper shift) observedLower observedUpper artifact
      constraints residualError

theorem exactCommonMode_has_zeroResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper : Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    CommonModeResidualBoundAt exactLower exactUpper
      (translateEndpoint exactLower shift) (translateEndpoint exactUpper shift)
      shift artifact constraints 0 := by
  constructor
  · norm_num
  · intro constraint _
    constructor <;> simp

theorem observedGap_ge_exactGap_sub_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (residual : CommonModeResidualBoundAt exactLower exactUpper observedLower
      observedUpper shift artifact constraints residualError) :
    intervalFeasibilityGap exactLower exactUpper artifact constraints nonempty -
        2 * residualError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have bound := observedGap_ge_exactGap_sub_twoError
    (translateEndpoint exactLower shift) (translateEndpoint exactUpper shift)
    observedLower observedUpper artifact constraints nonempty residualError
      residual
  rw [intervalFeasibilityGap_translation_invariant exactLower exactUpper shift
    artifact constraints nonempty] at bound
  exact bound

theorem commonCenter_preserved_of_gap_ge_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (shift : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (residual : CommonModeResidualBoundAt exactLower exactUpper observedLower
      observedUpper shift artifact constraints residualError)
    (robustGap : 2 * residualError ≤
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have gapBound := observedGap_ge_exactGap_sub_twoResidual exactLower exactUpper
    observedLower observedUpper shift artifact constraints nonempty residualError
      residual
  linarith

def hundredShift (_artifact : Unit) : ℝ := 100

theorem meetingIntervals_largeCommonShift_center_hundred :
    ∀ constraint ∈ (Finset.univ : Finset Bool),
      IntervalAcceptedAt (translateEndpoint meetingLower hundredShift)
        (translateEndpoint meetingUpper hundredShift) () constraint 100 := by
  intro constraint _
  cases constraint <;>
    norm_num [IntervalAcceptedAt, translateEndpoint, meetingLower, meetingUpper,
      hundredShift]

theorem meetingIntervals_largeCommonShift_preserves_gap :
    intervalFeasibilityGap (translateEndpoint meetingLower hundredShift)
        (translateEndpoint meetingUpper hundredShift) () Finset.univ
          Finset.univ_nonempty =
      intervalFeasibilityGap meetingLower meetingUpper () Finset.univ
        Finset.univ_nonempty := by
  exact intervalFeasibilityGap_translation_invariant meetingLower meetingUpper
    hundredShift () Finset.univ Finset.univ_nonempty

def constraintSpecificShift (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then 1 else -1

def translateEndpointByConstraint
    (endpoint : Unit → Bool → ℝ)
    (artifact : Unit)
    (constraint : Bool) : ℝ :=
  endpoint artifact constraint + constraintSpecificShift artifact constraint

theorem constraintSpecificShift_preserves_each_width
    (constraint : Bool) :
    translateEndpointByConstraint meetingUpper () constraint -
        translateEndpointByConstraint meetingLower () constraint =
      meetingUpper () constraint - meetingLower () constraint := by
  unfold translateEndpointByConstraint
  ring

/-- Equal lower/upper translation inside each interval preserves every width,
but different translations across constraints can destroy their intersection. -/
theorem constraintSpecificShift_destroys_commonCenter :
    ¬CommonIntervalCenterAt (translateEndpointByConstraint meetingLower)
      (translateEndpointByConstraint meetingUpper) () Finset.univ := by
  rintro ⟨center, centerAccepted⟩
  have left := centerAccepted false (by simp)
  have right := centerAccepted true (by simp)
  norm_num [IntervalAcceptedAt, translateEndpointByConstraint,
    constraintSpecificShift, meetingLower, meetingUpper] at left right
  linarith

end Sprawlens.RepresentationIntervalCorrelatedError
