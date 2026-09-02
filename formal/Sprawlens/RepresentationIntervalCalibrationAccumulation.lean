import Sprawlens.RepresentationIntervalCalibrationPipeline

namespace Sprawlens.RepresentationIntervalCalibrationAccumulation

open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalAffineCalibration

universe u

/-- Every stage's reported slope interval lies inside the same relative-error
envelope `[1 - epsilon, 1 + epsilon]` at the selected artifact. -/
def UniformRelativeSlopeBoundAt
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact)
    (epsilon : ℝ) : Prop :=
  match pipeline with
  | .single stage =>
      1 - epsilon ≤ stage.lowerSlope artifact ∧
        stage.upperSlope artifact ≤ 1 + epsilon
  | .cons stage rest =>
      (1 - epsilon ≤ stage.lowerSlope artifact ∧
        stage.upperSlope artifact ≤ 1 + epsilon) ∧
      UniformRelativeSlopeBoundAt rest artifact epsilon

theorem uniformRelativeSlope_accumulates_multiplicatively
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact)
    (epsilon : ℝ)
    (epsilonNonnegative : 0 ≤ epsilon)
    (epsilonAtMostOne : epsilon ≤ 1)
    (uniform : UniformRelativeSlopeBoundAt pipeline artifact epsilon) :
    (1 - epsilon) ^ pipeline.stageCount ≤ pipeline.lowerSlope artifact ∧
      pipeline.upperSlope artifact ≤
        (1 + epsilon) ^ pipeline.stageCount := by
  induction pipeline with
  | single stage =>
      simpa only [UniformRelativeSlopeBoundAt,
        CalibrationPipeline.stageCount, CalibrationPipeline.lowerSlope,
        CalibrationPipeline.upperSlope, pow_one] using uniform
  | cons stage rest restInduction =>
      simp only [UniformRelativeSlopeBoundAt] at uniform
      have restBounds := restInduction uniform.2
      have lowerBaseNonnegative : 0 ≤ 1 - epsilon :=
        sub_nonneg.mpr epsilonAtMostOne
      have upperBaseNonnegative : 0 ≤ 1 + epsilon := by
        linarith
      have stageLowerNonnegative : 0 ≤ stage.lowerSlope artifact :=
        (stage.distortion artifact).1
      have restUpperNonnegative : 0 ≤ rest.upperSlope artifact :=
        (secantDistortion rest artifact).1.trans
          (secantDistortion rest artifact).2.1
      change
        (1 - epsilon) ^ (rest.stageCount + 1) ≤
            stage.lowerSlope artifact * rest.lowerSlope artifact ∧
          stage.upperSlope artifact * rest.upperSlope artifact ≤
            (1 + epsilon) ^ (rest.stageCount + 1)
      constructor
      · calc
          (1 - epsilon) ^ (rest.stageCount + 1) =
              (1 - epsilon) * (1 - epsilon) ^ rest.stageCount := by
            rw [pow_succ]
            ring
          _ ≤ stage.lowerSlope artifact * rest.lowerSlope artifact :=
            mul_le_mul uniform.1.1 restBounds.1
              (pow_nonneg lowerBaseNonnegative _) stageLowerNonnegative
      · calc
          stage.upperSlope artifact * rest.upperSlope artifact ≤
              (1 + epsilon) * (1 + epsilon) ^ rest.stageCount :=
            mul_le_mul uniform.1.2 restBounds.2 restUpperNonnegative
              upperBaseNonnegative
          _ = (1 + epsilon) ^ (rest.stageCount + 1) := by
            rw [pow_succ]
            ring

theorem uniformRelativeSlope_lower_positive
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact)
    (epsilon : ℝ)
    (epsilonNonnegative : 0 ≤ epsilon)
    (epsilonLessThanOne : epsilon < 1)
    (uniform : UniformRelativeSlopeBoundAt pipeline artifact epsilon) :
    0 < pipeline.lowerSlope artifact := by
  have accumulated := uniformRelativeSlope_accumulates_multiplicatively
    pipeline artifact epsilon epsilonNonnegative (le_of_lt epsilonLessThanOne)
      uniform
  exact (pow_pos (sub_pos.mpr epsilonLessThanOne) _).trans_le accumulated.1

theorem epsilon_one_accumulated_lower_envelope_is_zero
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target) :
    (1 - (1 : ℝ)) ^ pipeline.stageCount = 0 := by
  have countNe : pipeline.stageCount ≠ 0 :=
    Nat.ne_of_gt (stageCount_positive pipeline)
  simp [countNe]

/-- Bernoulli's inequality gives a conservative additive lower approximation.
It does not replace the multiplicative upper envelope below. -/
theorem uniformRelativeSlope_linear_lower_bound
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact)
    (epsilon : ℝ)
    (epsilonNonnegative : 0 ≤ epsilon)
    (epsilonAtMostOne : epsilon ≤ 1)
    (uniform : UniformRelativeSlopeBoundAt pipeline artifact epsilon) :
    1 - (pipeline.stageCount : ℝ) * epsilon ≤
      pipeline.lowerSlope artifact := by
  have accumulated := uniformRelativeSlope_accumulates_multiplicatively
    pipeline artifact epsilon epsilonNonnegative epsilonAtMostOne uniform
  calc
    1 - (pipeline.stageCount : ℝ) * epsilon =
        1 + (pipeline.stageCount : ℝ) * (-epsilon) := by ring
    _ ≤ (1 + (-epsilon)) ^ pipeline.stageCount :=
      one_add_mul_le_pow (by linarith) pipeline.stageCount
    _ = (1 - epsilon) ^ pipeline.stageCount := by ring
    _ ≤ pipeline.lowerSlope artifact := accumulated.1

theorem threeStage_tenPercent_relative_envelope
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact)
    (threeStages : pipeline.stageCount = 3)
    (uniform : UniformRelativeSlopeBoundAt pipeline artifact ((1 : ℝ) / 10)) :
    (729 : ℝ) / 1000 ≤ pipeline.lowerSlope artifact ∧
      pipeline.upperSlope artifact ≤ (1331 : ℝ) / 1000 := by
  have accumulated := uniformRelativeSlope_accumulates_multiplicatively
    pipeline artifact ((1 : ℝ) / 10) (by norm_num) (by norm_num) uniform
  rw [threeStages] at accumulated
  norm_num at accumulated ⊢
  exact accumulated

/-- For two positive-error stages, the multiplicative upper envelope is
strictly larger than the naive additive estimate. -/
theorem twoStage_positive_relative_upper_exceeds_additive
    (epsilon : ℝ)
    (epsilonPositive : 0 < epsilon) :
    1 + 2 * epsilon < (1 + epsilon) ^ 2 := by
  have squarePositive : 0 < epsilon ^ 2 := sq_pos_of_pos epsilonPositive
  nlinarith

def scaleTwo (_artifact : Unit) : ℝ := 2

def shiftZero (_artifact : Unit) : ℝ := 0

theorem scaleTwo_positive : ∀ artifact, 0 < scaleTwo artifact := by
  intro artifact
  cases artifact
  norm_num [scaleTwo]

noncomputable def scaleTwoStage :
    CalibrationStage Unit allCalibrationDomain allCalibrationDomain where
  calibration := positiveAffineCalibration scaleTwo shiftZero scaleTwo_positive
  lowerSlope := scaleTwo
  upperSlope := scaleTwo
  distortion := fun artifact =>
    globalSecantDistortion_implies_local
      (positiveAffineCalibration scaleTwo shiftZero scaleTwo_positive)
      scaleTwo scaleTwo allCalibrationDomain artifact
        (positiveAffineCalibration_secantDistortion scaleTwo shiftZero
          scaleTwo_positive artifact)
  mapsDomain := by
    intro artifact value _
    simp [allCalibrationDomain]

theorem scaleTwoStage_apply (value : ℝ) :
    scaleTwoStage.calibration () value = 2 * value := by
  norm_num [scaleTwoStage, positiveAffineCalibration, affineValue, scaleTwo,
    shiftZero, OrderEmbedding.ofStrictMono]

/-- `extra = 0` is one stage; every successor prepends another verified
scale-two stage. -/
noncomputable def repeatScaleTwoPipeline :
    (extra : ℕ) → CalibrationPipeline Unit allCalibrationDomain
      allCalibrationDomain
  | 0 => .single scaleTwoStage
  | extra + 1 => .cons scaleTwoStage (repeatScaleTwoPipeline extra)

theorem repeatScaleTwoPipeline_stageCount (extra : ℕ) :
    (repeatScaleTwoPipeline extra).stageCount = extra + 1 := by
  induction extra with
  | zero => rfl
  | succ extra induction =>
      simp only [repeatScaleTwoPipeline, CalibrationPipeline.stageCount,
        induction]

theorem repeatScaleTwoPipeline_slopes_are_powers (extra : ℕ) :
    (repeatScaleTwoPipeline extra).lowerSlope () = 2 ^ (extra + 1) ∧
      (repeatScaleTwoPipeline extra).upperSlope () = 2 ^ (extra + 1) := by
  induction extra with
  | zero =>
      norm_num [repeatScaleTwoPipeline, scaleTwoStage,
        CalibrationPipeline.lowerSlope, CalibrationPipeline.upperSlope,
        scaleTwo]
  | succ extra induction =>
      rcases induction with ⟨lowerInduction, upperInduction⟩
      constructor
      · simp only [repeatScaleTwoPipeline, CalibrationPipeline.lowerSlope,
          multiplySlope, scaleTwoStage, scaleTwo, lowerInduction]
        rw [pow_succ]
        ring
      · simp only [repeatScaleTwoPipeline, CalibrationPipeline.upperSlope,
          multiplySlope, scaleTwoStage, scaleTwo, upperInduction]
        rw [pow_succ]
        ring

theorem repeatScaleTwoPipeline_apply (extra : ℕ) (value : ℝ) :
    (repeatScaleTwoPipeline extra).calibration () value =
      2 ^ (extra + 1) * value := by
  induction extra generalizing value with
  | zero =>
      norm_num [repeatScaleTwoPipeline, scaleTwoStage,
        CalibrationPipeline.calibration, positiveAffineCalibration,
        affineValue, scaleTwo, shiftZero, OrderEmbedding.ofStrictMono]
  | succ extra induction =>
      rw [repeatScaleTwoPipeline, cons_calibration_apply, induction]
      rw [scaleTwoStage_apply]
      rw [pow_succ]
      ring

end Sprawlens.RepresentationIntervalCalibrationAccumulation
