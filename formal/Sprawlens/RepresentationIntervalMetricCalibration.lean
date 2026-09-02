import Sprawlens.RepresentationIntervalMonotoneCalibration

namespace Sprawlens.RepresentationIntervalMetricCalibration

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMonotoneCalibration
open RepresentationIntervalAffineCalibration

universe u v

/-- A quantitative refinement of an order embedding.  Every ordered secant is
bounded between two artifact-wide slopes. -/
def SecantDistortionAt
    {Artifact : Type u}
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (artifact : Artifact) : Prop :=
  0 ≤ lowerSlope artifact ∧
    lowerSlope artifact ≤ upperSlope artifact ∧
      ∀ first second : ℝ, first ≤ second →
        lowerSlope artifact * (second - first) ≤
            calibration artifact second - calibration artifact first ∧
          calibration artifact second - calibration artifact first ≤
            upperSlope artifact * (second - first)

theorem feasibleGap_metricDistortionBounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (distortion : SecantDistortionAt calibration lowerSlope upperSlope artifact)
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
    (maxLowerCenter lower artifact constraints nonempty)
    (minUpperCenter upper artifact constraints nonempty) extremaOrder
  simpa only [intervalFeasibilityGap] using bounds

/-- On the infeasible side the same certificate bounds the positive deficit.
This keeps the sign and the magnitude statements separate. -/
theorem infeasibleGap_metricDistortionBounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (distortion : SecantDistortionAt calibration lowerSlope upperSlope artifact)
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
    (minUpperCenter upper artifact constraints nonempty)
    (maxLowerCenter lower artifact constraints nonempty) extremaOrder
  simpa only [intervalFeasibilityGap, neg_sub] using bounds

def MetricCalibrationResidualBoundAt
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (residualError : ℝ) : Prop :=
  EndpointPerturbationBoundAt (calibratedEndpoint exactLower calibration)
    (calibratedEndpoint exactUpper calibration) observedLower observedUpper
      artifact constraints residualError

theorem exactMetricCalibration_has_zeroResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper : Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint) :
    MetricCalibrationResidualBoundAt exactLower exactUpper
      (calibratedEndpoint exactLower calibration)
      (calibratedEndpoint exactUpper calibration) calibration artifact
        constraints 0 := by
  constructor
  · norm_num
  · intro constraint _
    constructor <;> simp

/-- A lower secant slope turns an exact feasible gap into a quantitative
observed-gap certificate after subtracting only residual endpoint error. -/
theorem observedGap_ge_lowerScaledExactGap_sub_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (distortion : SecantDistortionAt calibration lowerSlope upperSlope artifact)
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
  have transformedBounds := feasibleGap_metricDistortionBounds exactLower
    exactUpper calibration lowerSlope upperSlope artifact constraints nonempty
      distortion exactFeasible
  have observedBound := observedGap_ge_exactGap_sub_twoError
    (calibratedEndpoint exactLower calibration)
    (calibratedEndpoint exactUpper calibration) observedLower observedUpper
      artifact constraints nonempty residualError residual
  linarith

theorem commonCenter_preserved_of_distortedGap_ge_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (distortion : SecantDistortionAt calibration lowerSlope upperSlope artifact)
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
    observedGap_ge_lowerScaledExactGap_sub_twoResidual exactLower exactUpper
      observedLower observedUpper calibration lowerSlope upperSlope artifact
        constraints nonempty residualError distortion exactFeasible residual
  linarith

noncomputable def positiveAffineCalibration
    {Artifact : Type u}
    (scale shift : Artifact → ℝ)
    (scalePositive : ∀ artifact, 0 < scale artifact)
    (artifact : Artifact) : ℝ ↪o ℝ :=
  OrderEmbedding.ofStrictMono (affineValue scale shift artifact)
    (by
      intro first second firstLtSecond
      unfold affineValue
      nlinarith [scalePositive artifact])

/-- Positive affine calibration is the zero-distortion special case whose
lower and upper secant slopes are both exactly the affine scale. -/
theorem positiveAffineCalibration_secantDistortion
    {Artifact : Type u}
    (scale shift : Artifact → ℝ)
    (scalePositive : ∀ artifact, 0 < scale artifact)
    (artifact : Artifact) :
    SecantDistortionAt (positiveAffineCalibration scale shift scalePositive)
      scale scale artifact := by
  refine ⟨le_of_lt (scalePositive artifact), le_rfl, ?_⟩
  intro first second _
  change
    scale artifact * (second - first) ≤
          affineValue scale shift artifact second -
            affineValue scale shift artifact first ∧
      affineValue scale shift artifact second -
          affineValue scale shift artifact first ≤
        scale artifact * (second - first)
  constructor <;> unfold affineValue <;> ring_nf <;> exact le_rfl

def hingeValue (value : ℝ) : ℝ :=
  value + max 0 value

theorem hingeValue_strictMono : StrictMono hingeValue := by
  intro first second firstLtSecond
  unfold hingeValue
  have maxMono : max 0 first ≤ max 0 second :=
    max_le_max le_rfl (le_of_lt firstLtSecond)
  exact add_lt_add_of_lt_of_le firstLtSecond maxMono

noncomputable def hingeCalibration : ℝ ↪o ℝ :=
  OrderEmbedding.ofStrictMono hingeValue hingeValue_strictMono

noncomputable def artifactWideHinge (_artifact : Unit) : ℝ ↪o ℝ :=
  hingeCalibration

def hingeLowerSlope (_artifact : Unit) : ℝ := 1

def hingeUpperSlope (_artifact : Unit) : ℝ := 2

/-- The nonlinear hinge map `x ↦ x + max 0 x` has a global secant slope in
`[1, 2]`, so it preserves feasibility and admits quantitative gap bounds. -/
theorem hingeCalibration_secantDistortion_one_two :
    SecantDistortionAt artifactWideHinge hingeLowerSlope hingeUpperSlope () := by
  refine ⟨by norm_num [hingeLowerSlope], by norm_num [hingeLowerSlope,
    hingeUpperSlope], ?_⟩
  intro first second firstLeSecond
  have maxMono : max 0 first ≤ max 0 second :=
    max_le_max le_rfl firstLeSecond
  constructor
  · change 1 * (second - first) ≤
      hingeValue second - hingeValue first
    unfold hingeValue
    linarith
  · change hingeValue second - hingeValue first ≤
      2 * (second - first)
    unfold hingeValue
    by_cases firstNonnegative : 0 ≤ first
    · have secondNonnegative : 0 ≤ second :=
        firstNonnegative.trans firstLeSecond
      rw [max_eq_right firstNonnegative, max_eq_right secondNonnegative]
      linarith
    · have firstNonpositive : first ≤ 0 := le_of_not_ge firstNonnegative
      by_cases secondNonnegative : 0 ≤ second
      · rw [max_eq_left firstNonpositive, max_eq_right secondNonnegative]
        linarith
      · have secondNonpositive : second ≤ 0 :=
          le_of_not_ge secondNonnegative
        rw [max_eq_left firstNonpositive, max_eq_left secondNonpositive]
        linarith

theorem hingeCalibration_lowerSlope_is_sharp :
    hingeCalibration 0 - hingeCalibration (-1) =
      1 * ((0 : ℝ) - (-1)) := by
  norm_num [hingeCalibration, hingeValue, OrderEmbedding.ofStrictMono]

theorem hingeCalibration_upperSlope_is_sharp :
    hingeCalibration 1 - hingeCalibration 0 =
      2 * ((1 : ℝ) - 0) := by
  norm_num [hingeCalibration, hingeValue, OrderEmbedding.ofStrictMono]

end Sprawlens.RepresentationIntervalMetricCalibration
