import Sprawlens.RepresentationIntervalCalibrationComposition

namespace Sprawlens.RepresentationIntervalCalibrationPipeline

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMonotoneCalibration
open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition

universe u v

/-- One verified calibration stage.  Its source and target domains are type
indices, preventing an adjacent stage from being attached with a mismatched
intermediate domain. -/
structure CalibrationStage
    (Artifact : Type u)
    (source target : Artifact → Set ℝ) where
  calibration : Artifact → ℝ ↪o ℝ
  lowerSlope : Artifact → ℝ
  upperSlope : Artifact → ℝ
  distortion : ∀ artifact,
    SecantDistortionOnAt calibration lowerSlope upperSlope source artifact
  mapsDomain : ∀ artifact,
    MapsCalibrationDomainAt calibration source target artifact

/-- A nonempty finite pipeline.  `cons` can only connect stages whose shared
domain index is definitionally the same. -/
inductive CalibrationPipeline (Artifact : Type u) :
    (Artifact → Set ℝ) → (Artifact → Set ℝ) → Type (u + 1) where
  | single {source target}
      (stage : CalibrationStage Artifact source target) :
      CalibrationPipeline Artifact source target
  | cons {source intermediate target}
      (stage : CalibrationStage Artifact source intermediate)
      (rest : CalibrationPipeline Artifact intermediate target) :
      CalibrationPipeline Artifact source target

namespace CalibrationPipeline

noncomputable def calibration
    {Artifact : Type u} {source target : Artifact → Set ℝ} :
    CalibrationPipeline Artifact source target → Artifact → ℝ ↪o ℝ
  | .single stage => stage.calibration
  | .cons stage rest => composeCalibration stage.calibration rest.calibration

def lowerSlope
    {Artifact : Type u} {source target : Artifact → Set ℝ} :
    CalibrationPipeline Artifact source target → Artifact → ℝ
  | .single stage => stage.lowerSlope
  | .cons stage rest => multiplySlope stage.lowerSlope rest.lowerSlope

def upperSlope
    {Artifact : Type u} {source target : Artifact → Set ℝ} :
    CalibrationPipeline Artifact source target → Artifact → ℝ
  | .single stage => stage.upperSlope
  | .cons stage rest => multiplySlope stage.upperSlope rest.upperSlope

def stageCount
    {Artifact : Type u} {source target : Artifact → Set ℝ} :
    CalibrationPipeline Artifact source target → ℕ
  | .single _ => 1
  | .cons _ rest => rest.stageCount + 1

end CalibrationPipeline

theorem secantDistortion
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact) :
    SecantDistortionOnAt pipeline.calibration pipeline.lowerSlope
      pipeline.upperSlope source artifact := by
  induction pipeline with
  | single stage =>
      exact stage.distortion artifact
  | cons stage rest restInduction =>
      exact localSecantDistortion_compose stage.calibration rest.calibration
        stage.lowerSlope stage.upperSlope rest.lowerSlope rest.upperSlope _ _
          artifact (stage.distortion artifact) restInduction
            (stage.mapsDomain artifact)

theorem mapsDomain
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact) :
    MapsCalibrationDomainAt pipeline.calibration source target artifact := by
  induction pipeline with
  | single stage =>
      exact stage.mapsDomain artifact
  | cons stage rest restInduction =>
      intro value valueMem
      change rest.calibration artifact (stage.calibration artifact value) ∈
        _
      exact restInduction _ (stage.mapsDomain artifact value valueMem)

theorem stageCount_positive
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target) :
    0 < pipeline.stageCount := by
  induction pipeline with
  | single _ => simp [CalibrationPipeline.stageCount]
  | cons _ rest restInduction =>
      simp only [CalibrationPipeline.stageCount]
      omega

theorem cons_calibration_apply
    {Artifact : Type u}
    {source intermediate target : Artifact → Set ℝ}
    (stage : CalibrationStage Artifact source intermediate)
    (rest : CalibrationPipeline Artifact intermediate target)
    (artifact : Artifact)
    (value : ℝ) :
    (CalibrationPipeline.cons stage rest).calibration artifact value =
      rest.calibration artifact (stage.calibration artifact value) := rfl

theorem calibratedEndpoint_cons
    {Artifact : Type u} {Constraint : Type v}
    {source intermediate target : Artifact → Set ℝ}
    (endpoint : Artifact → Constraint → ℝ)
    (stage : CalibrationStage Artifact source intermediate)
    (rest : CalibrationPipeline Artifact intermediate target)
    (artifact : Artifact)
    (constraint : Constraint) :
    calibratedEndpoint endpoint (CalibrationPipeline.cons stage rest).calibration
        artifact constraint =
      calibratedEndpoint (calibratedEndpoint endpoint stage.calibration)
        rest.calibration artifact constraint := rfl

theorem mapsEndpointsToTarget
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt lower upper
      source artifact constraints) :
    IntervalEndpointsInCalibrationDomainAt
      (calibratedEndpoint lower pipeline.calibration)
      (calibratedEndpoint upper pipeline.calibration) target artifact
        constraints := by
  exact mappedEndpointsInIntermediateDomain lower upper pipeline.calibration
    source target artifact constraints endpointsInSource
      (mapsDomain pipeline artifact)

theorem feasibleGap_bounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt lower upper
      source artifact constraints)
    (feasible : 0 ≤
      intervalFeasibilityGap lower upper artifact constraints nonempty) :
    pipeline.lowerSlope artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty ≤
        intervalFeasibilityGap
          (calibratedEndpoint lower pipeline.calibration)
          (calibratedEndpoint upper pipeline.calibration) artifact constraints
            nonempty ∧
      intervalFeasibilityGap
          (calibratedEndpoint lower pipeline.calibration)
          (calibratedEndpoint upper pipeline.calibration) artifact constraints
            nonempty ≤
        pipeline.upperSlope artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty := by
  apply feasibleGap_localMetricDistortionBounds_of_endpoints lower upper
    pipeline.calibration pipeline.lowerSlope pipeline.upperSlope source artifact
      constraints nonempty
  · exact secantDistortion pipeline artifact
  · exact endpointsInSource
  · exact feasible

theorem infeasibleDeficit_bounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (lower upper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt lower upper
      source artifact constraints)
    (infeasible :
      intervalFeasibilityGap lower upper artifact constraints nonempty ≤ 0) :
    pipeline.lowerSlope artifact *
          (-intervalFeasibilityGap lower upper artifact constraints nonempty) ≤
        -intervalFeasibilityGap
          (calibratedEndpoint lower pipeline.calibration)
          (calibratedEndpoint upper pipeline.calibration) artifact constraints
            nonempty ∧
      -intervalFeasibilityGap
          (calibratedEndpoint lower pipeline.calibration)
          (calibratedEndpoint upper pipeline.calibration) artifact constraints
            nonempty ≤
        pipeline.upperSlope artifact *
          (-intervalFeasibilityGap lower upper artifact constraints nonempty) := by
  apply infeasibleGap_localMetricDistortionBounds lower upper
    pipeline.calibration pipeline.lowerSlope pipeline.upperSlope source artifact
      constraints nonempty
  · exact secantDistortion pipeline artifact
  · exact intervalEndpointsInDomain_implies_extremaInDomain lower upper source
      artifact constraints nonempty endpointsInSource
  · exact infeasible

theorem observedGap_ge_lowerSlope_sub_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (residual : MetricCalibrationResidualBoundAt exactLower exactUpper
      observedLower observedUpper pipeline.calibration artifact constraints
        residualError) :
    pipeline.lowerSlope artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty -
        2 * residualError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  apply observedGap_ge_localLowerScaledExactGap_sub_twoResidual exactLower
    exactUpper observedLower observedUpper pipeline.calibration
      pipeline.lowerSlope pipeline.upperSlope source artifact constraints
        nonempty residualError
  · exact secantDistortion pipeline artifact
  · exact endpointsInSource
  · exact exactFeasible
  · exact residual

theorem commonCenter_preserved_of_gap_ge_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (residual : MetricCalibrationResidualBoundAt exactLower exactUpper
      observedLower observedUpper pipeline.calibration artifact constraints
        residualError)
    (robustGap : 2 * residualError ≤ pipeline.lowerSlope artifact *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply commonCenter_preserved_of_localDistortedGap_ge_twoResidual exactLower
    exactUpper observedLower observedUpper pipeline.calibration
      pipeline.lowerSlope pipeline.upperSlope source artifact constraints
        nonempty residualError
  · exact secantDistortion pipeline artifact
  · exact endpointsInSource
  · exact exactFeasible
  · exact residual
  · exact robustGap

noncomputable def identityStage :
    CalibrationStage Unit allCalibrationDomain allCalibrationDomain where
  calibration := artifactWideIdentity
  lowerSlope := hingeLowerSlope
  upperSlope := hingeLowerSlope
  distortion := fun _ => identityCalibration_secantDistortion_one_one_on_all
  mapsDomain := by
    intro _ value _
    simp [allCalibrationDomain]

noncomputable def threeIdentityPipeline :
    CalibrationPipeline Unit allCalibrationDomain allCalibrationDomain :=
  .cons identityStage (.cons identityStage (.single identityStage))

theorem threeIdentityPipeline_stageCount_eq_three :
    threeIdentityPipeline.stageCount = 3 := by
  rfl

theorem threeIdentityPipeline_slopes_eq_one :
    threeIdentityPipeline.lowerSlope () = 1 ∧
      threeIdentityPipeline.upperSlope () = 1 := by
  norm_num [threeIdentityPipeline, identityStage,
    CalibrationPipeline.lowerSlope, CalibrationPipeline.upperSlope,
    multiplySlope, hingeLowerSlope]

theorem threeIdentityPipeline_apply (value : ℝ) :
    threeIdentityPipeline.calibration () value = value := by
  norm_num [threeIdentityPipeline, identityStage,
    CalibrationPipeline.calibration, composeCalibration, artifactWideIdentity,
    identityCalibration, OrderEmbedding.ofStrictMono]

end Sprawlens.RepresentationIntervalCalibrationPipeline
