import Sprawlens.RepresentationProtectedCenter
import Mathlib.Data.Finset.Max

namespace Sprawlens.RepresentationIntervalHellyCenter

open RepresentationApproximateFactorization
open RepresentationProtectedCenter
open RepresentationValidApproximateFactorization

universe u v w

def IntervalAcceptedAt
    {Artifact : Type u} {Constraint : Type v}
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraint : Constraint)
    (center : ℝ) : Prop :=
  lower artifact constraint ≤ center ∧ center ≤ upper artifact constraint

def PairwiseIntervalFeasibleAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) : Prop :=
  ∀ first ∈ constraints, ∀ second ∈ constraints,
    ∃ center,
      IntervalAcceptedAt lower upper artifact first center ∧
        IntervalAcceptedAt lower upper artifact second center

def CommonIntervalCenterAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) : Prop :=
  ∃ center, ∀ constraint ∈ constraints,
    IntervalAcceptedAt lower upper artifact constraint center

noncomputable def maxLowerCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : ℝ :=
  let lowerValues := constraints.image (lower artifact)
  lowerValues.max' (nonempty.image (lower artifact))

theorem maxLowerCenter_is_attained
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    ∃ constraint ∈ constraints,
      lower artifact constraint =
        maxLowerCenter lower artifact constraints nonempty := by
  have centerMem :
      maxLowerCenter lower artifact constraints nonempty ∈
        constraints.image (lower artifact) := by
    simpa [maxLowerCenter] using
      (Finset.max'_mem (constraints.image (lower artifact))
        (nonempty.image (lower artifact)))
  obtain ⟨constraint, constraintMem, lowerEq⟩ :=
    Finset.mem_image.mp centerMem
  exact ⟨constraint, constraintMem, lowerEq⟩

theorem lower_le_maxLowerCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (constraint : Constraint)
    (constraintMem : constraint ∈ constraints) :
    lower artifact constraint ≤
      maxLowerCenter lower artifact constraints nonempty := by
  apply Finset.le_max'
  exact Finset.mem_image.mpr ⟨constraint, constraintMem, rfl⟩

/-- One-dimensional finite Helly witness: the maximum lower endpoint satisfies
every interval when every pair intersects. -/
theorem maxLowerCenter_satisfies_all_of_pairwise
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (pairwise : PairwiseIntervalFeasibleAt lower upper artifact constraints) :
    ∀ constraint ∈ constraints,
      IntervalAcceptedAt lower upper artifact constraint
        (maxLowerCenter lower artifact constraints nonempty) := by
  obtain ⟨maxConstraint, maxConstraintMem, maxLowerEq⟩ :=
    maxLowerCenter_is_attained lower artifact constraints nonempty
  intro constraint constraintMem
  constructor
  · exact lower_le_maxLowerCenter lower artifact constraints nonempty
      constraint constraintMem
  · obtain ⟨pairCenter, maxAccepted, constraintAccepted⟩ :=
      pairwise maxConstraint maxConstraintMem constraint constraintMem
    rw [← maxLowerEq]
    exact maxAccepted.1.trans constraintAccepted.2

theorem pairwiseIntervalFeasible_implies_commonCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (pairwise : PairwiseIntervalFeasibleAt lower upper artifact constraints) :
    CommonIntervalCenterAt lower upper artifact constraints := by
  by_cases empty : constraints = ∅
  · exact ⟨0, by simp [empty]⟩
  · have nonempty := Finset.nonempty_iff_ne_empty.mpr empty
    exact ⟨maxLowerCenter lower artifact constraints nonempty,
      maxLowerCenter_satisfies_all_of_pairwise lower upper artifact constraints
        nonempty pairwise⟩

theorem commonCenter_implies_pairwiseIntervalFeasible
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (common : CommonIntervalCenterAt lower upper artifact constraints) :
    PairwiseIntervalFeasibleAt lower upper artifact constraints := by
  obtain ⟨center, centerAccepted⟩ := common
  intro first firstMem second secondMem
  exact ⟨center, centerAccepted first firstMem,
    centerAccepted second secondMem⟩

theorem pairwiseIntervalFeasible_iff_commonCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    PairwiseIntervalFeasibleAt lower upper artifact constraints ↔
      CommonIntervalCenterAt lower upper artifact constraints := by
  constructor
  · exact pairwiseIntervalFeasible_implies_commonCenter lower upper artifact
      constraints
  · exact commonCenter_implies_pairwiseIntervalFeasible lower upper artifact
      constraints

theorem emptyIntervalFamily_has_commonCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact) :
    CommonIntervalCenterAt lower upper artifact ∅ := by
  exact ⟨0, by simp⟩

noncomputable def allIntervalCenter
    {Artifact : Type u} {Constraint : Type v}
    [Fintype Constraint] [DecidableEq Constraint] [Nonempty Constraint]
    (lower : Artifact → Constraint → ℝ)
    (artifact : Artifact) : ℝ :=
  maxLowerCenter lower artifact Finset.univ Finset.univ_nonempty

theorem allIntervalCenter_satisfies_of_pairwise
    {Artifact : Type u} {Constraint : Type v}
    [Fintype Constraint] [DecidableEq Constraint] [Nonempty Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (pairwise : PairwiseIntervalFeasibleAt lower upper artifact Finset.univ) :
    ∀ constraint,
      IntervalAcceptedAt lower upper artifact constraint
        (allIntervalCenter lower artifact) := by
  intro constraint
  exact maxLowerCenter_satisfies_all_of_pairwise lower upper artifact
    Finset.univ Finset.univ_nonempty pairwise constraint (Finset.mem_univ _)

theorem pairwiseIntervals_yield_protectedApproximate
    {Artifact : Type u} {Constraint : Type v} {Hidden : Type w}
    [Fintype Constraint] [DecidableEq Constraint] [Nonempty Constraint]
    (render : Artifact → Hidden → ℝ)
    (valid : Artifact → ℝ → Prop)
    (lower upper : Artifact → Constraint → ℝ)
    (radius : NNReal)
    (pairwise : ∀ artifact,
      PairwiseIntervalFeasibleAt lower upper artifact Finset.univ)
    (centerValid : ∀ artifact,
      valid artifact (allIntervalCenter lower artifact))
    (centerError : ∀ artifact hidden,
      nndist (render artifact hidden) (allIntervalCenter lower artifact) ≤
        radius) :
    ProtectedApproximatelyFactorsThroughArtifact render valid
      (IntervalAcceptedAt lower upper) radius := by
  refine ⟨allIntervalCenter lower, ?_, centerError⟩
  intro artifact
  exact ⟨centerValid artifact, fun constraint =>
    allIntervalCenter_satisfies_of_pairwise lower upper artifact
      (pairwise artifact) constraint⟩

def meetingLower (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then 0 else -1

def meetingUpper (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then 1 else 0

theorem meetingIntervals_pairwise :
    PairwiseIntervalFeasibleAt meetingLower meetingUpper () Finset.univ := by
  intro first _ second _
  cases first <;> cases second
  · exact ⟨-1, by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper],
      by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper]⟩
  · exact ⟨0, by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper],
      by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper]⟩
  · exact ⟨0, by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper],
      by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper]⟩
  · exact ⟨0, by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper],
      by norm_num [IntervalAcceptedAt, meetingLower, meetingUpper]⟩

theorem meetingIntervals_commonCenter :
    CommonIntervalCenterAt meetingLower meetingUpper () Finset.univ := by
  exact pairwiseIntervalFeasible_implies_commonCenter meetingLower meetingUpper
    () Finset.univ meetingIntervals_pairwise

theorem meeting_allIntervalCenter_eq_zero :
    allIntervalCenter meetingLower () = 0 := by
  norm_num [allIntervalCenter, maxLowerCenter, meetingLower,
    Finset.max', Finset.sup']

theorem meetingIntervals_yield_protected_radius_one :
    ProtectedApproximatelyFactorsThroughArtifact sharpApproxRender
      intervalValid (IntervalAcceptedAt meetingLower meetingUpper) 1 := by
  apply pairwiseIntervals_yield_protectedApproximate sharpApproxRender
    intervalValid meetingLower meetingUpper 1
  · intro artifact
    cases artifact
    exact meetingIntervals_pairwise
  · intro artifact
    cases artifact
    rw [meeting_allIntervalCenter_eq_zero]
    norm_num [intervalValid]
  · intro artifact hidden
    cases artifact
    rw [meeting_allIntervalCenter_eq_zero]
    cases hidden <;>
      apply NNReal.coe_le_coe.mp <;>
      norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

def separatedLower (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then 1 else -1

def separatedUpper (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then 1 else -1

theorem separatedIntervals_individually_feasible :
    ∀ constraint, ∃ center,
      IntervalAcceptedAt separatedLower separatedUpper () constraint center := by
  intro constraint
  cases constraint
  · exact ⟨-1, by norm_num [IntervalAcceptedAt, separatedLower,
      separatedUpper]⟩
  · exact ⟨1, by norm_num [IntervalAcceptedAt, separatedLower,
      separatedUpper]⟩

theorem separatedIntervals_not_pairwise :
    ¬PairwiseIntervalFeasibleAt separatedLower separatedUpper ()
      Finset.univ := by
  intro pairwise
  obtain ⟨center, leftAccepted, rightAccepted⟩ :=
    pairwise false (by simp) true (by simp)
  norm_num [IntervalAcceptedAt, separatedLower, separatedUpper] at leftAccepted rightAccepted
  linarith

end Sprawlens.RepresentationIntervalHellyCenter
