import Sprawlens.RepresentationIntervalHellyCenter

namespace Sprawlens.RepresentationIntervalRobustness

open RepresentationIntervalHellyCenter
open RepresentationProtectedCenter

universe u v

noncomputable def minUpperCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : ℝ :=
  let upperValues := constraints.image (upper artifact)
  upperValues.min' (nonempty.image (upper artifact))

theorem minUpperCenter_is_attained
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    ∃ constraint ∈ constraints,
      upper artifact constraint =
        minUpperCenter upper artifact constraints nonempty := by
  have centerMem :
      minUpperCenter upper artifact constraints nonempty ∈
        constraints.image (upper artifact) := by
    simpa [minUpperCenter] using
      (Finset.min'_mem (constraints.image (upper artifact))
        (nonempty.image (upper artifact)))
  obtain ⟨constraint, constraintMem, upperEq⟩ :=
    Finset.mem_image.mp centerMem
  exact ⟨constraint, constraintMem, upperEq⟩

theorem minUpperCenter_le_upper
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (constraint : Constraint)
    (constraintMem : constraint ∈ constraints) :
    minUpperCenter upper artifact constraints nonempty ≤
      upper artifact constraint := by
  apply Finset.min'_le
  exact Finset.mem_image.mpr ⟨constraint, constraintMem, rfl⟩

noncomputable def intervalFeasibilityGap
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : ℝ :=
  minUpperCenter upper artifact constraints nonempty -
    maxLowerCenter lower artifact constraints nonempty

theorem commonCenter_iff_maxLower_le_minUpper
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    CommonIntervalCenterAt lower upper artifact constraints ↔
      maxLowerCenter lower artifact constraints nonempty ≤
        minUpperCenter upper artifact constraints nonempty := by
  constructor
  · rintro ⟨center, centerAccepted⟩
    obtain ⟨maxConstraint, maxMem, maxEq⟩ :=
      maxLowerCenter_is_attained lower artifact constraints nonempty
    obtain ⟨minConstraint, minMem, minEq⟩ :=
      minUpperCenter_is_attained upper artifact constraints nonempty
    have maxLeCenter := (centerAccepted maxConstraint maxMem).1
    have centerLeMin := (centerAccepted minConstraint minMem).2
    rw [maxEq] at maxLeCenter
    rw [minEq] at centerLeMin
    exact maxLeCenter.trans centerLeMin
  · intro extremaCompatible
    refine ⟨maxLowerCenter lower artifact constraints nonempty, ?_⟩
    intro constraint constraintMem
    exact ⟨lower_le_maxLowerCenter lower artifact constraints nonempty
        constraint constraintMem,
      extremaCompatible.trans
        (minUpperCenter_le_upper upper artifact constraints nonempty constraint
          constraintMem)⟩

theorem commonCenter_iff_feasibilityGap_nonnegative
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    CommonIntervalCenterAt lower upper artifact constraints ↔
      0 ≤ intervalFeasibilityGap lower upper artifact constraints nonempty := by
  rw [commonCenter_iff_maxLower_le_minUpper lower upper artifact constraints
    nonempty]
  unfold intervalFeasibilityGap
  constructor <;> intro extrema <;> linarith

def EndpointPerturbationBoundAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (error : ℝ) : Prop :=
  0 ≤ error ∧
    ∀ constraint ∈ constraints,
      |observedLower artifact constraint - exactLower artifact constraint| ≤
          error ∧
        |observedUpper artifact constraint - exactUpper artifact constraint| ≤
          error

theorem observedMaxLower_le_exactMaxLower_add_error
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (error : ℝ)
    (perturbation : EndpointPerturbationBoundAt exactLower exactUpper
      observedLower observedUpper artifact constraints error) :
    maxLowerCenter observedLower artifact constraints nonempty ≤
      maxLowerCenter exactLower artifact constraints nonempty + error := by
  obtain ⟨constraint, constraintMem, observedMaxEq⟩ :=
    maxLowerCenter_is_attained observedLower artifact constraints nonempty
  have exactLeMax := lower_le_maxLowerCenter exactLower artifact constraints
    nonempty constraint constraintMem
  have lowerError := (abs_le.mp (perturbation.2 constraint constraintMem).1).2
  rw [← observedMaxEq]
  linarith

theorem exactMinUpper_sub_error_le_observedMinUpper
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (error : ℝ)
    (perturbation : EndpointPerturbationBoundAt exactLower exactUpper
      observedLower observedUpper artifact constraints error) :
    minUpperCenter exactUpper artifact constraints nonempty - error ≤
      minUpperCenter observedUpper artifact constraints nonempty := by
  obtain ⟨constraint, constraintMem, observedMinEq⟩ :=
    minUpperCenter_is_attained observedUpper artifact constraints nonempty
  have exactMinLe := minUpperCenter_le_upper exactUpper artifact constraints
    nonempty constraint constraintMem
  have upperError := (abs_le.mp (perturbation.2 constraint constraintMem).2).1
  rw [← observedMinEq]
  linarith

/-- Independent endpoint errors of size η can reduce the feasible interval
gap by at most 2η. -/
theorem observedGap_ge_exactGap_sub_twoError
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (error : ℝ)
    (perturbation : EndpointPerturbationBoundAt exactLower exactUpper
      observedLower observedUpper artifact constraints error) :
    intervalFeasibilityGap exactLower exactUpper artifact constraints nonempty -
        2 * error ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have maxBound := observedMaxLower_le_exactMaxLower_add_error exactLower
    exactUpper observedLower observedUpper artifact constraints nonempty error
      perturbation
  have minBound := exactMinUpper_sub_error_le_observedMinUpper exactLower
    exactUpper observedLower observedUpper artifact constraints nonempty error
      perturbation
  unfold intervalFeasibilityGap
  linarith

theorem commonCenter_preserved_of_gap_ge_twoError
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (error : ℝ)
    (perturbation : EndpointPerturbationBoundAt exactLower exactUpper
      observedLower observedUpper artifact constraints error)
    (robustGap : 2 * error ≤
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have gapBound := observedGap_ge_exactGap_sub_twoError exactLower exactUpper
    observedLower observedUpper artifact constraints nonempty error perturbation
  linarith

def CenterHasIntervalMarginAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (center margin : ℝ) : Prop :=
  ∀ constraint ∈ constraints,
    lower artifact constraint + margin ≤ center ∧
      center + margin ≤ upper artifact constraint

theorem centerMargin_preserved_under_endpointPerturbation
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (center margin error : ℝ)
    (marginCertificate : CenterHasIntervalMarginAt exactLower exactUpper
      artifact constraints center margin)
    (perturbation : EndpointPerturbationBoundAt exactLower exactUpper
      observedLower observedUpper artifact constraints error)
    (errorLeMargin : error ≤ margin) :
    ∀ constraint ∈ constraints,
      IntervalAcceptedAt observedLower observedUpper artifact constraint
        center := by
  intro constraint constraintMem
  have exactMargin := marginCertificate constraint constraintMem
  have endpointError := perturbation.2 constraint constraintMem
  have lowerError := (abs_le.mp endpointError.1).2
  have upperError := (abs_le.mp endpointError.2).1
  constructor <;> linarith

theorem centerMargin_yields_perturbedCommonCenter
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (center margin error : ℝ)
    (marginCertificate : CenterHasIntervalMarginAt exactLower exactUpper
      artifact constraints center margin)
    (perturbation : EndpointPerturbationBoundAt exactLower exactUpper
      observedLower observedUpper artifact constraints error)
    (errorLeMargin : error ≤ margin) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  exact ⟨center,
    centerMargin_preserved_under_endpointPerturbation exactLower exactUpper
      observedLower observedUpper artifact constraints center margin error
      marginCertificate perturbation errorLeMargin⟩

theorem perturbedIntervals_yield_protectedApproximate
    {Artifact : Type u} {Constraint : Type v} {Hidden : Type*}
    [Fintype Constraint] [DecidableEq Constraint]
    (render : Artifact → Hidden → ℝ)
    (valid : Artifact → ℝ → Prop)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (center : Artifact → ℝ)
    (margin error : ℝ)
    (radius : NNReal)
    (marginCertificate : ∀ artifact,
      CenterHasIntervalMarginAt exactLower exactUpper artifact Finset.univ
        (center artifact) margin)
    (perturbation : ∀ artifact,
      EndpointPerturbationBoundAt exactLower exactUpper observedLower
        observedUpper artifact Finset.univ error)
    (errorLeMargin : error ≤ margin)
    (centerValid : ∀ artifact, valid artifact (center artifact))
    (centerError : ∀ artifact hidden,
      nndist (render artifact hidden) (center artifact) ≤ radius) :
    ProtectedApproximatelyFactorsThroughArtifact render valid
      (IntervalAcceptedAt observedLower observedUpper) radius := by
  refine ⟨center, ?_, centerError⟩
  intro artifact
  exact ⟨centerValid artifact, fun constraint =>
    centerMargin_preserved_under_endpointPerturbation exactLower exactUpper
      observedLower observedUpper artifact Finset.univ (center artifact) margin
      error (marginCertificate artifact) (perturbation artifact) errorLeMargin
      constraint (Finset.mem_univ _)⟩

def symmetricExactLower (margin : ℝ) (_artifact : Unit)
    (_constraint : Unit) : ℝ :=
  -margin

def symmetricExactUpper (margin : ℝ) (_artifact : Unit)
    (_constraint : Unit) : ℝ :=
  margin

def symmetricObservedLower (margin error : ℝ) (_artifact : Unit)
    (_constraint : Unit) : ℝ :=
  -margin + error

def symmetricObservedUpper (margin error : ℝ) (_artifact : Unit)
    (_constraint : Unit) : ℝ :=
  margin - error

theorem symmetricWorstCase_is_endpointPerturbation
    (margin error : ℝ)
    (errorNonnegative : 0 ≤ error) :
    EndpointPerturbationBoundAt (symmetricExactLower margin)
      (symmetricExactUpper margin) (symmetricObservedLower margin error)
      (symmetricObservedUpper margin error) () Finset.univ error := by
  constructor
  · exact errorNonnegative
  · intro constraint _
    cases constraint
    constructor <;>
      simp [symmetricExactLower, symmetricExactUpper, symmetricObservedLower,
        symmetricObservedUpper, abs_of_nonneg errorNonnegative]

theorem symmetricWorstCase_commonCenter_iff_error_le_margin
    (margin error : ℝ) :
    CommonIntervalCenterAt (symmetricObservedLower margin error)
        (symmetricObservedUpper margin error) () Finset.univ ↔
      error ≤ margin := by
  constructor
  · rintro ⟨center, centerAccepted⟩
    have accepted := centerAccepted () (by simp)
    norm_num [IntervalAcceptedAt, symmetricObservedLower,
      symmetricObservedUpper] at accepted
    linarith
  · intro errorLeMargin
    refine ⟨0, ?_⟩
    intro constraint _
    cases constraint
    norm_num [IntervalAcceptedAt, symmetricObservedLower,
      symmetricObservedUpper]
    exact errorLeMargin

theorem symmetricWorstCase_gap_loss_factor_two
    (margin error : ℝ) :
    intervalFeasibilityGap (symmetricExactLower margin)
        (symmetricExactUpper margin) () Finset.univ Finset.univ_nonempty -
      intervalFeasibilityGap (symmetricObservedLower margin error)
        (symmetricObservedUpper margin error) () Finset.univ
          Finset.univ_nonempty =
      2 * error := by
  have exactMax :
      maxLowerCenter (symmetricExactLower margin) () Finset.univ
        Finset.univ_nonempty = -margin := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      maxLowerCenter_is_attained (symmetricExactLower margin) () Finset.univ
        Finset.univ_nonempty
    cases constraint
    simpa [symmetricExactLower] using endpointEq.symm
  have exactMin :
      minUpperCenter (symmetricExactUpper margin) () Finset.univ
        Finset.univ_nonempty = margin := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      minUpperCenter_is_attained (symmetricExactUpper margin) () Finset.univ
        Finset.univ_nonempty
    cases constraint
    simpa [symmetricExactUpper] using endpointEq.symm
  have observedMax :
      maxLowerCenter (symmetricObservedLower margin error) () Finset.univ
        Finset.univ_nonempty = -margin + error := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      maxLowerCenter_is_attained (symmetricObservedLower margin error) ()
        Finset.univ Finset.univ_nonempty
    cases constraint
    simpa [symmetricObservedLower] using endpointEq.symm
  have observedMin :
      minUpperCenter (symmetricObservedUpper margin error) () Finset.univ
        Finset.univ_nonempty = margin - error := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      minUpperCenter_is_attained (symmetricObservedUpper margin error) ()
        Finset.univ Finset.univ_nonempty
    cases constraint
    simpa [symmetricObservedUpper] using endpointEq.symm
  unfold intervalFeasibilityGap
  rw [exactMax, exactMin, observedMax, observedMin]
  ring

end Sprawlens.RepresentationIntervalRobustness
