import Sprawlens.RepresentationIntervalCalibrationActiveTie

namespace Sprawlens.RepresentationIntervalCalibrationActiveMinimum

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationEndpointResidual
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveTie

universe u v

noncomputable def observedLowerActiveSet
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (observedLower : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : Finset Constraint := by
  classical
  exact constraints.filter fun constraint =>
    observedLower artifact constraint =
      maxLowerCenter observedLower artifact constraints nonempty

noncomputable def observedUpperActiveSet
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (observedUpper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : Finset Constraint := by
  classical
  exact constraints.filter fun constraint =>
    observedUpper artifact constraint =
      minUpperCenter observedUpper artifact constraints nonempty

theorem observedLowerActiveSet_nonempty
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (observedLower : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    (observedLowerActiveSet observedLower artifact constraints nonempty).Nonempty := by
  classical
  obtain ⟨constraint, constraintMem, endpointEq⟩ :=
    maxLowerCenter_is_attained observedLower artifact constraints nonempty
  exact ⟨constraint, Finset.mem_filter.mpr ⟨constraintMem, endpointEq⟩⟩

theorem observedUpperActiveSet_nonempty
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (observedUpper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    (observedUpperActiveSet observedUpper artifact constraints nonempty).Nonempty := by
  classical
  obtain ⟨constraint, constraintMem, endpointEq⟩ :=
    minUpperCenter_is_attained observedUpper artifact constraints nonempty
  exact ⟨constraint, Finset.mem_filter.mpr ⟨constraintMem, endpointEq⟩⟩

noncomputable def lowerTraceEnvelopeAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (constraint : Constraint) : ℝ :=
  if constraintMem : constraint ∈ constraints then
    (family.lowerTrace constraint constraintMem).residualEnvelope
  else 0

noncomputable def upperTraceEnvelopeAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (constraint : Constraint) : ℝ :=
  if constraintMem : constraint ∈ constraints then
    (family.upperTrace constraint constraintMem).residualEnvelope
  else 0

/-- A minimum-envelope policy exists independently for the lower and upper
observed extrema of every nonempty finite family. -/
theorem exists_minimumActiveEndpointTraceCertificate
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
    ∃ certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
        exactUpper observedLower observedUpper artifact constraints nonempty,
      (∀ constraint ∈
          observedLowerActiveSet observedLower artifact constraints nonempty,
        certificate.lowerEnvelope ≤ lowerTraceEnvelopeAt family constraint) ∧
      (∀ constraint ∈
          observedUpperActiveSet observedUpper artifact constraints nonempty,
        certificate.upperEnvelope ≤ upperTraceEnvelopeAt family constraint) := by
  classical
  obtain ⟨lowerConstraint, lowerActive, lowerMinimal⟩ :=
    Finset.exists_min_image
      (observedLowerActiveSet observedLower artifact constraints nonempty)
      (lowerTraceEnvelopeAt family)
      (observedLowerActiveSet_nonempty observedLower artifact constraints
        nonempty)
  obtain ⟨upperConstraint, upperActive, upperMinimal⟩ :=
    Finset.exists_min_image
      (observedUpperActiveSet observedUpper artifact constraints nonempty)
      (upperTraceEnvelopeAt family)
      (observedUpperActiveSet_nonempty observedUpper artifact constraints
        nonempty)
  have lowerParts := Finset.mem_filter.mp lowerActive
  have upperParts := Finset.mem_filter.mp upperActive
  let certificate : ActiveEndpointTraceCertificateAt pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty := {
    lowerConstraint := lowerConstraint
    lowerMem := lowerParts.1
    lowerObservedIsMax := lowerParts.2
    lowerTrace := family.lowerTrace lowerConstraint lowerParts.1
    lowerOutput := family.lowerOutput lowerConstraint lowerParts.1
    upperConstraint := upperConstraint
    upperMem := upperParts.1
    upperObservedIsMin := upperParts.2
    upperTrace := family.upperTrace upperConstraint upperParts.1
    upperOutput := family.upperOutput upperConstraint upperParts.1
  }
  refine ⟨certificate, ?_, ?_⟩
  · intro constraint constraintActive
    have minimum := lowerMinimal constraint constraintActive
    change
      (family.lowerTrace lowerConstraint lowerParts.1).residualEnvelope ≤
        lowerTraceEnvelopeAt family constraint
    simpa only [lowerTraceEnvelopeAt, dif_pos lowerParts.1] using minimum
  · intro constraint constraintActive
    have minimum := upperMinimal constraint constraintActive
    change
      (family.upperTrace upperConstraint upperParts.1).residualEnvelope ≤
        upperTraceEnvelopeAt family constraint
    simpa only [upperTraceEnvelopeAt, dif_pos upperParts.1] using minimum

noncomputable def minimumActiveEndpointTraceCertificate
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
      observedLower observedUpper artifact constraints nonempty :=
  Classical.choose
    (exists_minimumActiveEndpointTraceCertificate pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)

theorem minimumActiveEndpointTraceCertificate_is_minimal
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
    (∀ constraint ∈
        observedLowerActiveSet observedLower artifact constraints nonempty,
      (minimumActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).lowerEnvelope ≤
        lowerTraceEnvelopeAt family constraint) ∧
    (∀ constraint ∈
        observedUpperActiveSet observedUpper artifact constraints nonempty,
      (minimumActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).upperEnvelope ≤
        upperTraceEnvelopeAt family constraint) :=
  Classical.choose_spec
    (exists_minimumActiveEndpointTraceCertificate pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)

noncomputable def tiedTraceFamily :
    StagewiseIntervalTraceFamilyAt oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ where
  lowerTrace := fun constraint _ => tiedLowerTrace constraint
  lowerOutput := by
    intro constraint _
    cases constraint <;> rfl
  upperTrace := fun _ _ => tiedUpperTrace
  upperOutput := by
    intro constraint _
    cases constraint <;> rfl

noncomputable def tiedMinimumActiveCertificate :
    ActiveEndpointTraceCertificateAt oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty :=
  minimumActiveEndpointTraceCertificate oneIdentityPipeline tiedExactLower
    tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
      Finset.univ_nonempty tiedTraceFamily

theorem tiedFalse_mem_observedLowerActiveSet :
    false ∈ observedLowerActiveSet tiedObservedLower () Finset.univ
      Finset.univ_nonempty := by
  classical
  apply Finset.mem_filter.mpr
  exact ⟨by simp, by
    simpa [tiedObservedLower] using tiedObserved_maxLower_eq_zero.symm⟩

theorem tiedFalse_mem_observedUpperActiveSet :
    false ∈ observedUpperActiveSet tiedObservedUpper () Finset.univ
      Finset.univ_nonempty := by
  classical
  apply Finset.mem_filter.mpr
  exact ⟨by simp, by
    simpa [tiedObservedUpper] using tiedObserved_minUpper_eq_ten.symm⟩

theorem tiedLowerTraceEnvelopeAt_false_eq_zero :
    lowerTraceEnvelopeAt tiedTraceFamily false = 0 := by
  rfl

theorem tiedUpperTraceEnvelopeAt_false_eq_zero :
    upperTraceEnvelopeAt tiedTraceFamily false = 0 := by
  rfl

theorem tiedMinimumActiveCertificate_envelopes_eq_zero :
    tiedMinimumActiveCertificate.lowerEnvelope = 0 ∧
      tiedMinimumActiveCertificate.upperEnvelope = 0 := by
  have minimality := minimumActiveEndpointTraceCertificate_is_minimal
    oneIdentityPipeline tiedExactLower tiedExactUpper tiedObservedLower
      tiedObservedUpper () Finset.univ Finset.univ_nonempty tiedTraceFamily
  constructor
  · have leZero := minimality.1 false tiedFalse_mem_observedLowerActiveSet
    rw [tiedLowerTraceEnvelopeAt_false_eq_zero] at leZero
    exact le_antisymm leZero
      (activeEndpointTraceCertificate_lowerEnvelope_nonnegative
        tiedMinimumActiveCertificate)
  · have leZero := minimality.2 false tiedFalse_mem_observedUpperActiveSet
    rw [tiedUpperTraceEnvelopeAt_false_eq_zero] at leZero
    exact le_antisymm leZero
      (activeEndpointTraceCertificate_upperEnvelope_nonnegative
        tiedMinimumActiveCertificate)

theorem tiedMinimumPolicy_is_strictly_stronger_than_highResidualChoice :
    tiedMinimumActiveCertificate.lowerEnvelope +
          tiedMinimumActiveCertificate.upperEnvelope <
      tiedHighResidualCertificate.lowerEnvelope +
        tiedHighResidualCertificate.upperEnvelope := by
  rw [tiedMinimumActiveCertificate_envelopes_eq_zero.1,
    tiedMinimumActiveCertificate_envelopes_eq_zero.2,
    tiedCertificates_have_different_envelopes.2.1,
    tiedCertificates_have_different_envelopes.2.2.2]
  norm_num

theorem tiedMinimumActiveCertificate_bound_is_exact :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedMinimumActiveCertificate.lowerEnvelope -
        tiedMinimumActiveCertificate.upperEnvelope =
      intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty := by
  rw [tiedExact_gap_eq_ten, tiedObserved_gap_eq_ten,
    tiedMinimumActiveCertificate_envelopes_eq_zero.1,
    tiedMinimumActiveCertificate_envelopes_eq_zero.2]
  norm_num [oneIdentityPipeline, identityStage,
    CalibrationPipeline.lowerSlope,
    RepresentationIntervalMetricCalibration.hingeLowerSlope]

theorem tiedMinimumActiveCertificate_pipeline_bound :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedMinimumActiveCertificate.lowerEnvelope -
        tiedMinimumActiveCertificate.upperEnvelope ≤
      intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty := by
  apply activeEndpointTraceCertificate_pipelineGap_bound_of_endpointsInSource
    oneIdentityPipeline tiedExactLower tiedExactUpper tiedObservedLower
      tiedObservedUpper () Finset.univ Finset.univ_nonempty
        tiedMinimumActiveCertificate tiedExact_endpointsInSource
  rw [tiedExact_gap_eq_ten]
  norm_num

end Sprawlens.RepresentationIntervalCalibrationActiveMinimum
