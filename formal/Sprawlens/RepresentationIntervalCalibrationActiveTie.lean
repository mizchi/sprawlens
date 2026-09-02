import Sprawlens.RepresentationIntervalCalibrationActiveResidual

namespace Sprawlens.RepresentationIntervalCalibrationActiveTie

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationEndpointResidual
open RepresentationIntervalCalibrationActiveResidual

def tiedExactLower (_artifact : Unit) (constraint : Bool) : ℝ :=
  if constraint then -100 else 0

def tiedExactUpper (_artifact : Unit) (_constraint : Bool) : ℝ :=
  10

def tiedObservedLower (_artifact : Unit) (_constraint : Bool) : ℝ :=
  0

def tiedObservedUpper (_artifact : Unit) (_constraint : Bool) : ℝ :=
  10

noncomputable def tiedLowerTrace (constraint : Bool) :
    StagewiseResidualTraceAt () oneIdentityPipeline
      (tiedExactLower () constraint) := by
  cases constraint
  · refine .single identityStage 0 0 0
      (by simp [allCalibrationDomain])
      (by simp [allCalibrationDomain]) (by norm_num) ?_
    change |(0 : ℝ) - 0| ≤ 0
    norm_num
  · refine .single identityStage (-100) 0 100
      (by simp [allCalibrationDomain])
      (by simp [allCalibrationDomain]) (by norm_num) ?_
    change |(0 : ℝ) - (-100)| ≤ 100
    norm_num

noncomputable def tiedUpperTrace :
    StagewiseResidualTraceAt () oneIdentityPipeline 10 := by
  refine .single identityStage 10 10 0
    (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_
  change |(10 : ℝ) - 10| ≤ 0
  norm_num

theorem tiedObserved_maxLower_eq_zero :
    maxLowerCenter tiedObservedLower () Finset.univ Finset.univ_nonempty =
      0 := by
  obtain ⟨constraint, _, endpointEq⟩ :=
    maxLowerCenter_is_attained tiedObservedLower () Finset.univ
      Finset.univ_nonempty
  cases constraint <;>
    simpa [tiedObservedLower] using endpointEq.symm

theorem tiedObserved_minUpper_eq_ten :
    minUpperCenter tiedObservedUpper () Finset.univ Finset.univ_nonempty =
      10 := by
  obtain ⟨constraint, _, endpointEq⟩ :=
    minUpperCenter_is_attained tiedObservedUpper () Finset.univ
      Finset.univ_nonempty
  cases constraint <;>
    simpa [tiedObservedUpper] using endpointEq.symm

noncomputable def tiedLowResidualCertificate :
    ActiveEndpointTraceCertificateAt oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty where
  lowerConstraint := false
  lowerMem := by simp
  lowerObservedIsMax := by
    rw [tiedObserved_maxLower_eq_zero]
    rfl
  lowerTrace := tiedLowerTrace false
  lowerOutput := rfl
  upperConstraint := false
  upperMem := by simp
  upperObservedIsMin := by
    rw [tiedObserved_minUpper_eq_ten]
    rfl
  upperTrace := tiedUpperTrace
  upperOutput := rfl

noncomputable def tiedHighResidualCertificate :
    ActiveEndpointTraceCertificateAt oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty where
  lowerConstraint := true
  lowerMem := by simp
  lowerObservedIsMax := by
    rw [tiedObserved_maxLower_eq_zero]
    rfl
  lowerTrace := tiedLowerTrace true
  lowerOutput := rfl
  upperConstraint := false
  upperMem := by simp
  upperObservedIsMin := by
    rw [tiedObserved_minUpper_eq_ten]
    rfl
  upperTrace := tiedUpperTrace
  upperOutput := rfl

theorem tiedCertificates_choose_distinct_lower_constraints :
    tiedLowResidualCertificate.lowerConstraint = false ∧
      tiedHighResidualCertificate.lowerConstraint = true := by
  constructor <;> rfl

theorem tiedCertificates_have_different_envelopes :
    tiedLowResidualCertificate.lowerEnvelope = 0 ∧
      tiedHighResidualCertificate.lowerEnvelope = 100 ∧
      tiedLowResidualCertificate.upperEnvelope = 0 ∧
      tiedHighResidualCertificate.upperEnvelope = 0 := by
  constructor
  · rfl
  · constructor
    · rfl
    · constructor <;> rfl

theorem tiedExact_maxLower_eq_zero :
    maxLowerCenter tiedExactLower () Finset.univ Finset.univ_nonempty = 0 := by
  obtain ⟨constraint, _, endpointEq⟩ :=
    maxLowerCenter_is_attained tiedExactLower () Finset.univ
      Finset.univ_nonempty
  cases constraint
  · simpa [tiedExactLower] using endpointEq.symm
  · have zeroLeMax := lower_le_maxLowerCenter tiedExactLower () Finset.univ
      Finset.univ_nonempty false (by simp)
    rw [← endpointEq] at zeroLeMax
    norm_num [tiedExactLower] at zeroLeMax

theorem tiedExact_minUpper_eq_ten :
    minUpperCenter tiedExactUpper () Finset.univ Finset.univ_nonempty = 10 := by
  obtain ⟨constraint, _, endpointEq⟩ :=
    minUpperCenter_is_attained tiedExactUpper () Finset.univ
      Finset.univ_nonempty
  cases constraint <;>
    simpa [tiedExactUpper] using endpointEq.symm

theorem tiedExact_gap_eq_ten :
    intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
      Finset.univ_nonempty = 10 := by
  rw [intervalFeasibilityGap, tiedExact_maxLower_eq_zero,
    tiedExact_minUpper_eq_ten]
  norm_num

theorem tiedObserved_gap_eq_ten :
    intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
      Finset.univ_nonempty = 10 := by
  rw [intervalFeasibilityGap, tiedObserved_maxLower_eq_zero,
    tiedObserved_minUpper_eq_ten]
  norm_num

theorem tiedExact_endpointsInSource :
    IntervalEndpointsInCalibrationDomainAt tiedExactLower tiedExactUpper
      allCalibrationDomain () Finset.univ := by
  intro constraint _
  constructor <;> simp [allCalibrationDomain]

theorem tiedLowResidualCertificate_bound_is_exact :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedLowResidualCertificate.lowerEnvelope -
        tiedLowResidualCertificate.upperEnvelope =
      intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty := by
  rw [tiedExact_gap_eq_ten, tiedObserved_gap_eq_ten,
    tiedCertificates_have_different_envelopes.1,
    tiedCertificates_have_different_envelopes.2.2.1]
  norm_num [oneIdentityPipeline, identityStage,
    CalibrationPipeline.lowerSlope, hingeLowerSlope]

theorem tiedHighResidualCertificate_bound_is_strictly_weaker :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedHighResidualCertificate.lowerEnvelope -
        tiedHighResidualCertificate.upperEnvelope <
      oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedLowResidualCertificate.lowerEnvelope -
        tiedLowResidualCertificate.upperEnvelope := by
  rw [tiedExact_gap_eq_ten,
    tiedCertificates_have_different_envelopes.1,
    tiedCertificates_have_different_envelopes.2.1,
    tiedCertificates_have_different_envelopes.2.2.1,
    tiedCertificates_have_different_envelopes.2.2.2]
  norm_num

theorem tiedLowResidualCertificate_pipeline_bound :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedLowResidualCertificate.lowerEnvelope -
        tiedLowResidualCertificate.upperEnvelope ≤
      intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty := by
  apply activeEndpointTraceCertificate_pipelineGap_bound_of_endpointsInSource
    oneIdentityPipeline tiedExactLower tiedExactUpper tiedObservedLower
      tiedObservedUpper () Finset.univ Finset.univ_nonempty
        tiedLowResidualCertificate tiedExact_endpointsInSource
  rw [tiedExact_gap_eq_ten]
  norm_num

theorem tiedHighResidualCertificate_pipeline_bound :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedHighResidualCertificate.lowerEnvelope -
        tiedHighResidualCertificate.upperEnvelope ≤
      intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty := by
  apply activeEndpointTraceCertificate_pipelineGap_bound_of_endpointsInSource
    oneIdentityPipeline tiedExactLower tiedExactUpper tiedObservedLower
      tiedObservedUpper () Finset.univ Finset.univ_nonempty
        tiedHighResidualCertificate tiedExact_endpointsInSource
  rw [tiedExact_gap_eq_ten]
  norm_num

/-- Extrema attainment alone does not make a post-hoc certificate canonical:
two valid choices for the same tied geometry can report different bounds. -/
theorem tiedActiveSelection_changes_bound_without_changing_geometry :
    intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
          Finset.univ_nonempty = 10 ∧
      tiedLowResidualCertificate.lowerEnvelope +
          tiedLowResidualCertificate.upperEnvelope = 0 ∧
      tiedHighResidualCertificate.lowerEnvelope +
          tiedHighResidualCertificate.upperEnvelope = 100 := by
  rw [tiedObserved_gap_eq_ten,
    tiedCertificates_have_different_envelopes.1,
    tiedCertificates_have_different_envelopes.2.1,
    tiedCertificates_have_different_envelopes.2.2.1,
    tiedCertificates_have_different_envelopes.2.2.2]
  norm_num

end Sprawlens.RepresentationIntervalCalibrationActiveTie
