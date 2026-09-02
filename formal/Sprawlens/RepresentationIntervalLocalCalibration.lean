import Sprawlens.RepresentationIntervalMetricCalibration

namespace Sprawlens.RepresentationIntervalLocalCalibration

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMonotoneCalibration
open RepresentationIntervalMetricCalibration

universe u v

/-- A secant distortion certificate whose validity is explicitly restricted to
an artifact-specific coordinate domain. -/
def SecantDistortionOnAt
    {Artifact : Type u}
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact) : Prop :=
  0 ≤ lowerSlope artifact ∧
    lowerSlope artifact ≤ upperSlope artifact ∧
      ∀ first ∈ domain artifact, ∀ second ∈ domain artifact,
        first ≤ second →
          lowerSlope artifact * (second - first) ≤
              calibration artifact second - calibration artifact first ∧
            calibration artifact second - calibration artifact first ≤
              upperSlope artifact * (second - first)

def IntervalExtremaInCalibrationDomainAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : Prop :=
  maxLowerCenter lower artifact constraints nonempty ∈ domain artifact ∧
    minUpperCenter upper artifact constraints nonempty ∈ domain artifact

def IntervalEndpointsInCalibrationDomainAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) : Prop :=
  ∀ constraint ∈ constraints,
    lower artifact constraint ∈ domain artifact ∧
      upper artifact constraint ∈ domain artifact

theorem intervalEndpointsInDomain_implies_extremaInDomain
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (endpointsInDomain : IntervalEndpointsInCalibrationDomainAt lower upper
      domain artifact constraints) :
    IntervalExtremaInCalibrationDomainAt lower upper domain artifact constraints
      nonempty := by
  constructor
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      maxLowerCenter_is_attained lower artifact constraints nonempty
    rw [← exactEq]
    exact (endpointsInDomain constraint constraintMem).1
  · obtain ⟨constraint, constraintMem, exactEq⟩ :=
      minUpperCenter_is_attained upper artifact constraints nonempty
    rw [← exactEq]
    exact (endpointsInDomain constraint constraintMem).2

theorem globalSecantDistortion_implies_local
    {Artifact : Type u}
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (global : SecantDistortionAt calibration lowerSlope upperSlope artifact) :
    SecantDistortionOnAt calibration lowerSlope upperSlope domain artifact := by
  refine ⟨global.1, global.2.1, ?_⟩
  intro first _ second _ firstLeSecond
  exact global.2.2 first second firstLeSecond

theorem feasibleGap_localMetricDistortionBounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (distortion : SecantDistortionOnAt calibration lowerSlope upperSlope domain
      artifact)
    (extremaInDomain : IntervalExtremaInCalibrationDomainAt lower upper domain
      artifact constraints nonempty)
    (feasible : 0 ≤
      intervalFeasibilityGap lower upper artifact constraints nonempty) :
    lowerSlope artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty ≤
        intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints nonempty ∧
      intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints nonempty ≤
        upperSlope artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty := by
  rw [intervalFeasibilityGap_orderEmbedding lower upper calibration artifact
    constraints nonempty]
  have extremaOrder :
      maxLowerCenter lower artifact constraints nonempty ≤
        minUpperCenter upper artifact constraints nonempty := by
    unfold intervalFeasibilityGap at feasible
    linarith
  have bounds := distortion.2.2
    (maxLowerCenter lower artifact constraints nonempty) extremaInDomain.1
    (minUpperCenter upper artifact constraints nonempty) extremaInDomain.2
      extremaOrder
  simpa only [intervalFeasibilityGap] using bounds

theorem feasibleGap_localMetricDistortionBounds_of_endpoints
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (distortion : SecantDistortionOnAt calibration lowerSlope upperSlope domain
      artifact)
    (endpointsInDomain : IntervalEndpointsInCalibrationDomainAt lower upper
      domain artifact constraints)
    (feasible : 0 ≤
      intervalFeasibilityGap lower upper artifact constraints nonempty) :
    lowerSlope artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty ≤
        intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints nonempty ∧
      intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints nonempty ≤
        upperSlope artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty := by
  apply feasibleGap_localMetricDistortionBounds lower upper calibration
    lowerSlope upperSlope domain artifact constraints nonempty distortion
  · exact intervalEndpointsInDomain_implies_extremaInDomain lower upper domain
      artifact constraints nonempty endpointsInDomain
  · exact feasible

theorem infeasibleGap_localMetricDistortionBounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (distortion : SecantDistortionOnAt calibration lowerSlope upperSlope domain
      artifact)
    (extremaInDomain : IntervalExtremaInCalibrationDomainAt lower upper domain
      artifact constraints nonempty)
    (infeasible :
      intervalFeasibilityGap lower upper artifact constraints nonempty ≤ 0) :
    lowerSlope artifact *
          (-intervalFeasibilityGap lower upper artifact constraints nonempty) ≤
        -intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints nonempty ∧
      -intervalFeasibilityGap (calibratedEndpoint lower calibration)
          (calibratedEndpoint upper calibration) artifact constraints nonempty ≤
        upperSlope artifact *
          (-intervalFeasibilityGap lower upper artifact constraints nonempty) := by
  rw [intervalFeasibilityGap_orderEmbedding lower upper calibration artifact
    constraints nonempty]
  have extremaOrder :
      minUpperCenter upper artifact constraints nonempty ≤
        maxLowerCenter lower artifact constraints nonempty := by
    unfold intervalFeasibilityGap at infeasible
    linarith
  have bounds := distortion.2.2
    (minUpperCenter upper artifact constraints nonempty) extremaInDomain.2
    (maxLowerCenter lower artifact constraints nonempty) extremaInDomain.1
      extremaOrder
  simpa only [intervalFeasibilityGap, neg_sub] using bounds

theorem observedGap_ge_localLowerScaledExactGap_sub_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (distortion : SecantDistortionOnAt calibration lowerSlope upperSlope domain
      artifact)
    (endpointsInDomain : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper domain artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (residual : MetricCalibrationResidualBoundAt exactLower exactUpper
      observedLower observedUpper calibration artifact constraints
        residualError) :
    lowerSlope artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty -
        2 * residualError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have transformedBounds :=
    feasibleGap_localMetricDistortionBounds_of_endpoints exactLower exactUpper
      calibration lowerSlope upperSlope domain artifact constraints nonempty
        distortion endpointsInDomain exactFeasible
  have observedBound := observedGap_ge_exactGap_sub_twoError
    (calibratedEndpoint exactLower calibration)
    (calibratedEndpoint exactUpper calibration) observedLower observedUpper
      artifact constraints nonempty residualError residual
  linarith

theorem commonCenter_preserved_of_localDistortedGap_ge_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (distortion : SecantDistortionOnAt calibration lowerSlope upperSlope domain
      artifact)
    (endpointsInDomain : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper domain artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (residual : MetricCalibrationResidualBoundAt exactLower exactUpper
      observedLower observedUpper calibration artifact constraints residualError)
    (robustGap : 2 * residualError ≤ lowerSlope artifact *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have observedBound :=
    observedGap_ge_localLowerScaledExactGap_sub_twoResidual exactLower exactUpper
      observedLower observedUpper calibration lowerSlope upperSlope domain
        artifact constraints nonempty residualError distortion endpointsInDomain
          exactFeasible residual
  linarith

def nonpositiveCalibrationDomain (_artifact : Unit) : Set ℝ :=
  Set.Iic 0

/-- On the certified nonpositive domain the hinge is exactly the identity, so
both local secant slopes are one. -/
theorem hingeCalibration_secantDistortion_one_one_on_nonpositive :
    SecantDistortionOnAt artifactWideHinge hingeLowerSlope hingeLowerSlope
      nonpositiveCalibrationDomain () := by
  refine ⟨by norm_num [hingeLowerSlope], le_rfl, ?_⟩
  intro first firstMem second secondMem _
  change first ≤ 0 at firstMem
  change second ≤ 0 at secondMem
  change
    1 * (second - first) ≤
          hingeCalibration second - hingeCalibration first ∧
      hingeCalibration second - hingeCalibration first ≤
        1 * (second - first)
  simp only [hingeCalibration, OrderEmbedding.coe_ofStrictMono, hingeValue,
    max_eq_left firstMem, max_eq_left secondMem]
  constructor <;> ring_nf <;> exact le_rfl

/-- The local `[1,1]` certificate is not a global certificate. -/
theorem hingeCalibration_one_one_not_global :
    ¬SecantDistortionAt artifactWideHinge hingeLowerSlope hingeLowerSlope () := by
  intro global
  have falseUpper := (global.2.2 0 1 (by norm_num)).2
  norm_num [artifactWideHinge, hingeLowerSlope, hingeCalibration, hingeValue,
    OrderEmbedding.ofStrictMono] at falseUpper

/-- Point `1` is outside the certified domain and its unit secant is expanded
by two, directly refuting an unchecked extrapolation of the local scale. -/
theorem hingeCalibration_outside_nonpositive_domain_breaks_local_scale :
    (0 : ℝ) ∈ nonpositiveCalibrationDomain () ∧
      (1 : ℝ) ∉ nonpositiveCalibrationDomain () ∧
        hingeCalibration 1 - hingeCalibration 0 ≠
          hingeLowerSlope () * ((1 : ℝ) - 0) := by
  norm_num [nonpositiveCalibrationDomain, hingeLowerSlope, hingeCalibration,
    hingeValue, OrderEmbedding.ofStrictMono]

end Sprawlens.RepresentationIntervalLocalCalibration
