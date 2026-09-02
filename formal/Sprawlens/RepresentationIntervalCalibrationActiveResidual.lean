import Sprawlens.RepresentationIntervalCalibrationEndpointResidual

namespace Sprawlens.RepresentationIntervalCalibrationActiveResidual

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMonotoneCalibration
open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationEndpointResidual

universe u v

/-- A complete, pipeline-indexed execution trace for both endpoints of every
constraint.  No uniform envelope is chosen at this layer. -/
structure StagewiseIntervalTraceFamilyAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) where
  lowerTrace : ∀ constraint, constraint ∈ constraints →
    StagewiseResidualTraceAt artifact pipeline (exactLower artifact constraint)
  lowerOutput : ∀ constraint constraintMem,
    (lowerTrace constraint constraintMem).output =
      observedLower artifact constraint
  upperTrace : ∀ constraint, constraint ∈ constraints →
    StagewiseResidualTraceAt artifact pipeline (exactUpper artifact constraint)
  upperOutput : ∀ constraint constraintMem,
    (upperTrace constraint constraintMem).output =
      observedUpper artifact constraint

/-- A compact certificate containing only the two traces that determine the
observed feasibility gap. -/
structure ActiveEndpointTraceCertificateAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) where
  lowerConstraint : Constraint
  lowerMem : lowerConstraint ∈ constraints
  lowerObservedIsMax :
    observedLower artifact lowerConstraint =
      maxLowerCenter observedLower artifact constraints nonempty
  lowerTrace :
    StagewiseResidualTraceAt artifact pipeline
      (exactLower artifact lowerConstraint)
  lowerOutput : lowerTrace.output = observedLower artifact lowerConstraint
  upperConstraint : Constraint
  upperMem : upperConstraint ∈ constraints
  upperObservedIsMin :
    observedUpper artifact upperConstraint =
      minUpperCenter observedUpper artifact constraints nonempty
  upperTrace :
    StagewiseResidualTraceAt artifact pipeline
      (exactUpper artifact upperConstraint)
  upperOutput : upperTrace.output = observedUpper artifact upperConstraint

namespace ActiveEndpointTraceCertificateAt

def lowerEnvelope
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty) : ℝ :=
  certificate.lowerTrace.residualEnvelope

def upperEnvelope
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty) : ℝ :=
  certificate.upperTrace.residualEnvelope

end ActiveEndpointTraceCertificateAt

theorem activeEndpointTraceCertificate_lowerEnvelope_nonnegative
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty) :
    0 ≤ certificate.lowerEnvelope := by
  exact stagewiseResidualTrace_residualEnvelope_nonnegative
    certificate.lowerTrace

theorem activeEndpointTraceCertificate_upperEnvelope_nonnegative
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty) :
    0 ≤ certificate.upperEnvelope := by
  exact stagewiseResidualTrace_residualEnvelope_nonnegative
    certificate.upperTrace

noncomputable def activeEndpointTraceCertificate
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints) :
    ActiveEndpointTraceCertificateAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty := by
  let lowerWitness :=
    maxLowerCenter_is_attained observedLower artifact constraints nonempty
  let lowerConstraint := Classical.choose lowerWitness
  have lowerSpec := Classical.choose_spec lowerWitness
  let upperWitness :=
    minUpperCenter_is_attained observedUpper artifact constraints nonempty
  let upperConstraint := Classical.choose upperWitness
  have upperSpec := Classical.choose_spec upperWitness
  exact {
    lowerConstraint := lowerConstraint
    lowerMem := lowerSpec.1
    lowerObservedIsMax := lowerSpec.2
    lowerTrace := family.lowerTrace lowerConstraint lowerSpec.1
    lowerOutput := family.lowerOutput lowerConstraint lowerSpec.1
    upperConstraint := upperConstraint
    upperMem := upperSpec.1
    upperObservedIsMin := upperSpec.2
    upperTrace := family.upperTrace upperConstraint upperSpec.1
    upperOutput := family.upperOutput upperConstraint upperSpec.1
  }

theorem stagewiseIntervalTraceFamily_endpointsInSource
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints) :
    IntervalEndpointsInCalibrationDomainAt exactLower exactUpper source artifact
      constraints := by
  intro constraint constraintMem
  exact ⟨stagewiseResidualTrace_input_mem
      (family.lowerTrace constraint constraintMem),
    stagewiseResidualTrace_input_mem
      (family.upperTrace constraint constraintMem)⟩

/-- Only the two traces attaining the observed extrema contribute to this
post-hoc gap certificate. -/
theorem activeEndpointTraceCertificate_gap_bound
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty) :
    intervalFeasibilityGap
          (calibratedEndpoint exactLower pipeline.calibration)
          (calibratedEndpoint exactUpper pipeline.calibration) artifact
            constraints nonempty -
        certificate.lowerEnvelope - certificate.upperEnvelope ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have lowerError :=
    stagewiseResidualTrace_final_error_le_envelope certificate.lowerTrace
  rw [certificate.lowerOutput] at lowerError
  have activeMappedLowerLeMax := lower_le_maxLowerCenter
    (calibratedEndpoint exactLower pipeline.calibration) artifact constraints
      nonempty certificate.lowerConstraint certificate.lowerMem
  simp only [calibratedEndpoint] at activeMappedLowerLeMax
  have observedMaxBound :
      maxLowerCenter observedLower artifact constraints nonempty ≤
        maxLowerCenter (calibratedEndpoint exactLower pipeline.calibration)
          artifact constraints nonempty + certificate.lowerEnvelope := by
    rw [← certificate.lowerObservedIsMax]
    change observedLower artifact certificate.lowerConstraint ≤
      maxLowerCenter (calibratedEndpoint exactLower pipeline.calibration)
        artifact constraints nonempty +
          certificate.lowerTrace.residualEnvelope
    have errorUpper := (abs_le.mp lowerError).2
    linarith
  have upperError :=
    stagewiseResidualTrace_final_error_le_envelope certificate.upperTrace
  rw [certificate.upperOutput] at upperError
  have mappedMinLeActiveUpper := minUpperCenter_le_upper
    (calibratedEndpoint exactUpper pipeline.calibration) artifact constraints
      nonempty certificate.upperConstraint certificate.upperMem
  simp only [calibratedEndpoint] at mappedMinLeActiveUpper
  have observedMinBound :
      minUpperCenter
            (calibratedEndpoint exactUpper pipeline.calibration) artifact
              constraints nonempty - certificate.upperEnvelope ≤
        minUpperCenter observedUpper artifact constraints nonempty := by
    rw [← certificate.upperObservedIsMin]
    change
      minUpperCenter (calibratedEndpoint exactUpper pipeline.calibration)
          artifact constraints nonempty -
          certificate.upperTrace.residualEnvelope ≤
        observedUpper artifact certificate.upperConstraint
    have errorLower := (abs_le.mp upperError).1
    linarith
  unfold intervalFeasibilityGap
  linarith

theorem activeEndpointTraceCertificate_pipelineGap_bound_of_endpointsInSource
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty) :
    pipeline.lowerSlope artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty - certificate.lowerEnvelope - certificate.upperEnvelope ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have mappedLowerBound :=
    (feasibleGap_bounds pipeline exactLower exactUpper artifact constraints
      nonempty endpointsInSource exactFeasible).1
  have activeBound := activeEndpointTraceCertificate_gap_bound pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty certificate
  linarith

theorem activeEndpointTraceCertificate_pipelineGap_bound
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty) :
    pipeline.lowerSlope artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty - certificate.lowerEnvelope - certificate.upperEnvelope ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  apply activeEndpointTraceCertificate_pipelineGap_bound_of_endpointsInSource
    pipeline exactLower exactUpper observedLower observedUpper artifact
      constraints nonempty certificate
  · exact stagewiseIntervalTraceFamily_endpointsInSource pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints family
  · exact exactFeasible

theorem activeEndpointTraceCertificate_commonCenter_preserved_of_endpointsInSource
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (robustGap : certificate.lowerEnvelope + certificate.upperEnvelope ≤
      pipeline.lowerSlope artifact *
        intervalFeasibilityGap exactLower exactUpper artifact constraints
          nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have gapBound :=
    activeEndpointTraceCertificate_pipelineGap_bound_of_endpointsInSource
      pipeline exactLower exactUpper observedLower observedUpper artifact
        constraints nonempty certificate endpointsInSource exactFeasible
  linarith

theorem activeEndpointTraceCertificate_commonCenter_preserved
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (robustGap : certificate.lowerEnvelope + certificate.upperEnvelope ≤
      pipeline.lowerSlope artifact *
        intervalFeasibilityGap exactLower exactUpper artifact constraints
          nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply activeEndpointTraceCertificate_commonCenter_preserved_of_endpointsInSource
    pipeline exactLower exactUpper observedLower observedUpper artifact
      constraints nonempty certificate
  · exact stagewiseIntervalTraceFamily_endpointsInSource pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints family
  · exact exactFeasible
  · exact robustGap

def inactiveLargeExactLower (_artifact : Unit) (_constraint : Bool) : ℝ :=
  0

def inactiveLargeExactUpper (_artifact : Unit) (_constraint : Bool) : ℝ :=
  10

def inactiveLargeObservedLower (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then -100 else 0

def inactiveLargeObservedUpper (_artifact : Unit) (_constraint : Bool) : ℝ :=
  10

noncomputable def inactiveLargeLowerTrace (constraint : Bool) :
    StagewiseResidualTraceAt () oneIdentityPipeline 0 := by
  cases constraint
  · refine .single identityStage 0 0 0
      (by simp [allCalibrationDomain])
      (by simp [allCalibrationDomain]) (by norm_num) ?_
    change |(0 : ℝ) - 0| ≤ 0
    norm_num
  · refine .single identityStage 0 (-100) 100
      (by simp [allCalibrationDomain])
      (by simp [allCalibrationDomain]) (by norm_num) ?_
    change |(-100 : ℝ) - 0| ≤ 100
    norm_num

noncomputable def inactiveLargeUpperTrace :
    StagewiseResidualTraceAt () oneIdentityPipeline 10 := by
  refine .single identityStage 10 10 0
    (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_
  change |(10 : ℝ) - 10| ≤ 0
  norm_num

noncomputable def inactiveLargeTraceFamily :
    StagewiseIntervalTraceFamilyAt oneIdentityPipeline inactiveLargeExactLower
      inactiveLargeExactUpper inactiveLargeObservedLower
        inactiveLargeObservedUpper () Finset.univ where
  lowerTrace := fun constraint _ => inactiveLargeLowerTrace constraint
  lowerOutput := by
    intro constraint _
    cases constraint <;> rfl
  upperTrace := fun _ _ => inactiveLargeUpperTrace
  upperOutput := by
    intro constraint _
    cases constraint <;> rfl

theorem inactiveLargeObserved_maxLower_eq_zero :
    maxLowerCenter inactiveLargeObservedLower () Finset.univ
      Finset.univ_nonempty = 0 := by
  obtain ⟨constraint, _, endpointEq⟩ :=
    maxLowerCenter_is_attained inactiveLargeObservedLower () Finset.univ
      Finset.univ_nonempty
  cases constraint
  · simpa [inactiveLargeObservedLower] using endpointEq.symm
  · have zeroLeMax := lower_le_maxLowerCenter inactiveLargeObservedLower ()
      Finset.univ Finset.univ_nonempty false (by simp)
    rw [← endpointEq] at zeroLeMax
    norm_num [inactiveLargeObservedLower] at zeroLeMax

theorem inactiveLargeObserved_minUpper_eq_ten :
    minUpperCenter inactiveLargeObservedUpper () Finset.univ
      Finset.univ_nonempty = 10 := by
  obtain ⟨constraint, _, endpointEq⟩ :=
    minUpperCenter_is_attained inactiveLargeObservedUpper () Finset.univ
      Finset.univ_nonempty
  cases constraint <;>
    simpa [inactiveLargeObservedUpper] using endpointEq.symm

noncomputable def inactiveLargeActiveCertificate :
    ActiveEndpointTraceCertificateAt oneIdentityPipeline
      inactiveLargeExactLower inactiveLargeExactUpper
      inactiveLargeObservedLower inactiveLargeObservedUpper () Finset.univ
        Finset.univ_nonempty where
  lowerConstraint := false
  lowerMem := by simp
  lowerObservedIsMax := by
    rw [inactiveLargeObserved_maxLower_eq_zero]
    rfl
  lowerTrace := inactiveLargeLowerTrace false
  lowerOutput := rfl
  upperConstraint := false
  upperMem := by simp
  upperObservedIsMin := by
    rw [inactiveLargeObserved_minUpper_eq_ten]
    rfl
  upperTrace := inactiveLargeUpperTrace
  upperOutput := rfl

theorem inactiveLargeActiveCertificate_envelopes_eq_zero :
    inactiveLargeActiveCertificate.lowerEnvelope = 0 ∧
      inactiveLargeActiveCertificate.upperEnvelope = 0 := by
  constructor <;> rfl

theorem inactiveLargeTraceFamily_contains_hundred_residual :
    (inactiveLargeTraceFamily.lowerTrace true (by simp)).residualEnvelope =
      100 := by
  rfl

theorem inactiveLargeExact_gap_eq_ten :
    intervalFeasibilityGap inactiveLargeExactLower inactiveLargeExactUpper ()
      Finset.univ Finset.univ_nonempty = 10 := by
  have maxEq :
      maxLowerCenter inactiveLargeExactLower () Finset.univ
        Finset.univ_nonempty = 0 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      maxLowerCenter_is_attained inactiveLargeExactLower () Finset.univ
        Finset.univ_nonempty
    cases constraint <;>
      simpa [inactiveLargeExactLower] using endpointEq.symm
  have minEq :
      minUpperCenter inactiveLargeExactUpper () Finset.univ
        Finset.univ_nonempty = 10 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      minUpperCenter_is_attained inactiveLargeExactUpper () Finset.univ
        Finset.univ_nonempty
    cases constraint <;>
      simpa [inactiveLargeExactUpper] using endpointEq.symm
  rw [intervalFeasibilityGap, maxEq, minEq]
  norm_num

theorem inactiveLargeObserved_gap_eq_ten :
    intervalFeasibilityGap inactiveLargeObservedLower
      inactiveLargeObservedUpper () Finset.univ Finset.univ_nonempty = 10 := by
  rw [intervalFeasibilityGap, inactiveLargeObserved_maxLower_eq_zero,
    inactiveLargeObserved_minUpper_eq_ten]
  norm_num

/-- A residual of one hundred on a non-active lower endpoint does not consume
any of the certified gap; a uniform worst-case envelope would lose this fact. -/
theorem inactiveLargeResidual_does_not_reduce_active_gap :
    inactiveLargeActiveCertificate.lowerEnvelope +
          inactiveLargeActiveCertificate.upperEnvelope = 0 ∧
      intervalFeasibilityGap inactiveLargeObservedLower
          inactiveLargeObservedUpper () Finset.univ Finset.univ_nonempty =
        intervalFeasibilityGap inactiveLargeExactLower inactiveLargeExactUpper
          () Finset.univ Finset.univ_nonempty := by
  rw [inactiveLargeActiveCertificate_envelopes_eq_zero.1,
    inactiveLargeActiveCertificate_envelopes_eq_zero.2,
    inactiveLargeObserved_gap_eq_ten, inactiveLargeExact_gap_eq_ten]
  norm_num

theorem inactiveLargeResidual_commonCenter_from_active_certificate :
    CommonIntervalCenterAt inactiveLargeObservedLower inactiveLargeObservedUpper
      () Finset.univ := by
  apply activeEndpointTraceCertificate_commonCenter_preserved
    oneIdentityPipeline inactiveLargeExactLower inactiveLargeExactUpper
      inactiveLargeObservedLower inactiveLargeObservedUpper () Finset.univ
        Finset.univ_nonempty inactiveLargeTraceFamily
          inactiveLargeActiveCertificate
  · rw [inactiveLargeExact_gap_eq_ten]
    norm_num
  · rw [inactiveLargeActiveCertificate_envelopes_eq_zero.1,
      inactiveLargeActiveCertificate_envelopes_eq_zero.2,
      inactiveLargeExact_gap_eq_ten]
    norm_num [oneIdentityPipeline, identityStage,
      CalibrationPipeline.lowerSlope, hingeLowerSlope]

end Sprawlens.RepresentationIntervalCalibrationActiveResidual
