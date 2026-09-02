import Sprawlens.RepresentationIntervalCalibrationResidualPropagation

namespace Sprawlens.RepresentationIntervalCalibrationEndpointResidual

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMonotoneCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation

universe u v

/-- A family of proof-carrying scalar traces for one endpoint field.  The
trace itself binds every local residual to the pipeline order and certifies
all intermediate domain memberships. -/
def StagewiseEndpointTraceBoundAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exact observed : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (envelope : ℝ) : Prop :=
  0 ≤ envelope ∧
    ∀ constraint ∈ constraints,
      ∃ trace : StagewiseResidualTraceAt artifact pipeline
          (exact artifact constraint),
        trace.output = observed artifact constraint ∧
          trace.residualEnvelope ≤ envelope

theorem stagewiseEndpointTraceBound_abs
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exact observed : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (envelope : ℝ)
    (bound : StagewiseEndpointTraceBoundAt pipeline exact observed artifact
      constraints envelope)
    (constraint : Constraint)
    (constraintMem : constraint ∈ constraints) :
    |observed artifact constraint -
        calibratedEndpoint exact pipeline.calibration artifact constraint| ≤
      envelope := by
  obtain ⟨trace, outputEq, envelopeBound⟩ :=
    bound.2 constraint constraintMem
  rw [← outputEq]
  exact (stagewiseResidualTrace_final_error_le_envelope trace).trans
    envelopeBound

theorem stagewiseEndpointTraceBound_input_mem
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exact observed : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (envelope : ℝ)
    (bound : StagewiseEndpointTraceBoundAt pipeline exact observed artifact
      constraints envelope)
    (constraint : Constraint)
    (constraintMem : constraint ∈ constraints) :
    exact artifact constraint ∈ source artifact := by
  obtain ⟨trace, _, _⟩ := bound.2 constraint constraintMem
  exact stagewiseResidualTrace_input_mem trace

theorem observedMaxLower_le_exactMaxLower_add_lowerError
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower observedLower : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (lowerError : ℝ)
    (lowerBound : ∀ constraint ∈ constraints,
      |observedLower artifact constraint - exactLower artifact constraint| ≤
        lowerError) :
    maxLowerCenter observedLower artifact constraints nonempty ≤
      maxLowerCenter exactLower artifact constraints nonempty + lowerError := by
  obtain ⟨constraint, constraintMem, observedMaxEq⟩ :=
    maxLowerCenter_is_attained observedLower artifact constraints nonempty
  have exactLeMax := lower_le_maxLowerCenter exactLower artifact constraints
    nonempty constraint constraintMem
  have errorUpper := (abs_le.mp (lowerBound constraint constraintMem)).2
  rw [← observedMaxEq]
  linarith

theorem exactMinUpper_sub_upperError_le_observedMinUpper
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactUpper observedUpper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (upperError : ℝ)
    (upperBound : ∀ constraint ∈ constraints,
      |observedUpper artifact constraint - exactUpper artifact constraint| ≤
        upperError) :
    minUpperCenter exactUpper artifact constraints nonempty - upperError ≤
      minUpperCenter observedUpper artifact constraints nonempty := by
  obtain ⟨constraint, constraintMem, observedMinEq⟩ :=
    minUpperCenter_is_attained observedUpper artifact constraints nonempty
  have exactMinLe := minUpperCenter_le_upper exactUpper artifact constraints
    nonempty constraint constraintMem
  have errorLower := (abs_le.mp (upperBound constraint constraintMem)).1
  rw [← observedMinEq]
  linarith

/-- Lower and upper endpoint errors need not be collapsed to one worst-case
number: their contributions to feasibility-gap loss add separately. -/
theorem observedGap_ge_exactGap_sub_asymmetricError
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (lowerError upperError : ℝ)
    (lowerBound : ∀ constraint ∈ constraints,
      |observedLower artifact constraint - exactLower artifact constraint| ≤
        lowerError)
    (upperBound : ∀ constraint ∈ constraints,
      |observedUpper artifact constraint - exactUpper artifact constraint| ≤
        upperError) :
    intervalFeasibilityGap exactLower exactUpper artifact constraints nonempty -
        lowerError - upperError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have maxBound := observedMaxLower_le_exactMaxLower_add_lowerError exactLower
    observedLower artifact constraints nonempty lowerError lowerBound
  have minBound := exactMinUpper_sub_upperError_le_observedMinUpper exactUpper
    observedUpper artifact constraints nonempty upperError upperBound
  unfold intervalFeasibilityGap
  linarith

theorem stagewiseTrace_observedGap_ge_lowerSlope_sub_envelopes
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (lowerEnvelope upperEnvelope : ℝ)
    (lowerTrace : StagewiseEndpointTraceBoundAt pipeline exactLower
      observedLower artifact constraints lowerEnvelope)
    (upperTrace : StagewiseEndpointTraceBoundAt pipeline exactUpper
      observedUpper artifact constraints upperEnvelope)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty) :
    pipeline.lowerSlope artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty - lowerEnvelope - upperEnvelope ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints := by
    intro constraint constraintMem
    exact ⟨stagewiseEndpointTraceBound_input_mem pipeline exactLower
        observedLower artifact constraints lowerEnvelope lowerTrace constraint
          constraintMem,
      stagewiseEndpointTraceBound_input_mem pipeline exactUpper observedUpper
        artifact constraints upperEnvelope upperTrace constraint constraintMem⟩
  have mappedLowerBound :=
    (feasibleGap_bounds pipeline exactLower exactUpper artifact constraints
      nonempty endpointsInSource exactFeasible).1
  have observedBound := observedGap_ge_exactGap_sub_asymmetricError
    (calibratedEndpoint exactLower pipeline.calibration)
    (calibratedEndpoint exactUpper pipeline.calibration) observedLower
      observedUpper artifact constraints nonempty lowerEnvelope upperEnvelope
        (stagewiseEndpointTraceBound_abs pipeline exactLower observedLower
          artifact constraints lowerEnvelope lowerTrace)
        (stagewiseEndpointTraceBound_abs pipeline exactUpper observedUpper
          artifact constraints upperEnvelope upperTrace)
  linarith

theorem stagewiseTrace_commonCenter_preserved_of_envelopes
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (lowerEnvelope upperEnvelope : ℝ)
    (lowerTrace : StagewiseEndpointTraceBoundAt pipeline exactLower
      observedLower artifact constraints lowerEnvelope)
    (upperTrace : StagewiseEndpointTraceBoundAt pipeline exactUpper
      observedUpper artifact constraints upperEnvelope)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (robustGap : lowerEnvelope + upperEnvelope ≤
      pipeline.lowerSlope artifact *
        intervalFeasibilityGap exactLower exactUpper artifact constraints
          nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have gapBound := stagewiseTrace_observedGap_ge_lowerSlope_sub_envelopes
    pipeline exactLower exactUpper observedLower observedUpper artifact
      constraints nonempty lowerEnvelope upperEnvelope lowerTrace upperTrace
        exactFeasible
  linarith

theorem asymmetricError_le_two_max
    (lowerError upperError : ℝ) :
    lowerError + upperError ≤ 2 * max lowerError upperError := by
  rcases le_total lowerError upperError with lowerLeUpper | upperLeLower
  · rw [max_eq_right lowerLeUpper]
    linarith
  · rw [max_eq_left upperLeLower]
    linarith

theorem asymmetricError_strictly_tighter_of_lt
    (lowerError upperError : ℝ)
    (lowerLtUpper : lowerError < upperError) :
    lowerError + upperError < 2 * max lowerError upperError := by
  rw [max_eq_right (le_of_lt lowerLtUpper)]
  linarith

noncomputable def oneIdentityPipeline :
    CalibrationPipeline Unit allCalibrationDomain allCalibrationDomain :=
  .single identityStage

noncomputable def asymmetricLowerResidualTrace :
    StagewiseResidualTraceAt () oneIdentityPipeline (-2) := by
  refine .single identityStage (-2) (-1) 1
    (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_
  change |(-1 : ℝ) - (-2)| ≤ 1
  norm_num

noncomputable def asymmetricUpperResidualTrace :
    StagewiseResidualTraceAt () oneIdentityPipeline 2 := by
  refine .single identityStage 2 (-1) 3
    (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_
  change |(-1 : ℝ) - 2| ≤ 3
  norm_num

theorem asymmetricLowerEndpointTraceBound :
    StagewiseEndpointTraceBoundAt oneIdentityPipeline
      (symmetricExactLower 2) (symmetricObservedLower 2 1) () Finset.univ 1 := by
  constructor
  · norm_num
  · intro constraint _
    cases constraint
    refine ⟨asymmetricLowerResidualTrace, ?_, le_rfl⟩
    change (-1 : ℝ) = -2 + 1
    norm_num

theorem asymmetricUpperEndpointTraceBound :
    StagewiseEndpointTraceBoundAt oneIdentityPipeline
      (symmetricExactUpper 2) (symmetricObservedUpper 2 3) () Finset.univ 3 := by
  constructor
  · norm_num
  · intro constraint _
    cases constraint
    refine ⟨asymmetricUpperResidualTrace, ?_, le_rfl⟩
    change (-1 : ℝ) = 2 - 3
    norm_num

/-- The asymmetric coefficient is attained: errors one and three consume an
exact gap of four completely. -/
theorem asymmetricEndpointWitness_gap_loss_eq_envelope_sum :
    intervalFeasibilityGap (symmetricExactLower 2)
        (symmetricExactUpper 2) () Finset.univ Finset.univ_nonempty -
      intervalFeasibilityGap (symmetricObservedLower 2 1)
        (symmetricObservedUpper 2 3) () Finset.univ
          Finset.univ_nonempty =
      1 + 3 := by
  have exactMax :
      maxLowerCenter (symmetricExactLower 2) () Finset.univ
        Finset.univ_nonempty = -2 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      maxLowerCenter_is_attained (symmetricExactLower 2) () Finset.univ
        Finset.univ_nonempty
    cases constraint
    simpa [symmetricExactLower] using endpointEq.symm
  have exactMin :
      minUpperCenter (symmetricExactUpper 2) () Finset.univ
        Finset.univ_nonempty = 2 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      minUpperCenter_is_attained (symmetricExactUpper 2) () Finset.univ
        Finset.univ_nonempty
    cases constraint
    simpa [symmetricExactUpper] using endpointEq.symm
  have observedMax :
      maxLowerCenter (symmetricObservedLower 2 1) () Finset.univ
        Finset.univ_nonempty = -1 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      maxLowerCenter_is_attained (symmetricObservedLower 2 1) () Finset.univ
        Finset.univ_nonempty
    cases constraint
    norm_num [symmetricObservedLower] at endpointEq ⊢
    exact endpointEq.symm
  have observedMin :
      minUpperCenter (symmetricObservedUpper 2 3) () Finset.univ
        Finset.univ_nonempty = -1 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      minUpperCenter_is_attained (symmetricObservedUpper 2 3) () Finset.univ
        Finset.univ_nonempty
    cases constraint
    norm_num [symmetricObservedUpper] at endpointEq ⊢
    exact endpointEq.symm
  rw [intervalFeasibilityGap, intervalFeasibilityGap, exactMax, exactMin,
    observedMax, observedMin]
  norm_num

theorem asymmetricEndpointWitness_commonCenter_at_exact_budget :
    CommonIntervalCenterAt (symmetricObservedLower 2 1)
      (symmetricObservedUpper 2 3) () Finset.univ := by
  refine ⟨-1, ?_⟩
  intro constraint _
  cases constraint
  norm_num [IntervalAcceptedAt, symmetricObservedLower,
    symmetricObservedUpper]

theorem asymmetricEndpointWitness_symmetric_rounding_is_strictly_looser :
    (1 : ℝ) + 3 < 2 * max (1 : ℝ) 3 := by
  exact asymmetricError_strictly_tighter_of_lt 1 3 (by norm_num)

/-- Increasing only the upper-endpoint error beyond the exact gap destroys
the singleton interval, so the sum coefficient cannot be reduced in general. -/
theorem asymmetricEndpointWitness_beyond_budget_has_no_commonCenter :
    ¬ CommonIntervalCenterAt (symmetricObservedLower 2 1)
      (symmetricObservedUpper 2 4) () Finset.univ := by
  rintro ⟨center, accepted⟩
  have unitAccepted := accepted () (by simp)
  norm_num [IntervalAcceptedAt, symmetricObservedLower,
    symmetricObservedUpper] at unitAccepted
  linarith

end Sprawlens.RepresentationIntervalCalibrationEndpointResidual
