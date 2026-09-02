import Sprawlens.RepresentationIntervalCalibrationStagewise

namespace Sprawlens.RepresentationIntervalCalibrationResidualPropagation

open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationAccumulation

universe u

/-- The upper secant certificate is an absolute Lipschitz bound on its
certified domain, without requiring the caller to order the two inputs. -/
theorem calibration_abs_sub_le_upperSlope_mul_abs
    {Artifact : Type u}
    (calibration : Artifact → ℝ ↪o ℝ)
    (lowerSlope upperSlope : Artifact → ℝ)
    (domain : Artifact → Set ℝ)
    (artifact : Artifact)
    (distortion : SecantDistortionOnAt calibration lowerSlope upperSlope domain
      artifact)
    (first second : ℝ)
    (firstMem : first ∈ domain artifact)
    (secondMem : second ∈ domain artifact) :
    |calibration artifact second - calibration artifact first| ≤
      upperSlope artifact * |second - first| := by
  rcases le_total first second with firstLeSecond | secondLeFirst
  · have upperBound :=
      (distortion.2.2 first firstMem second secondMem firstLeSecond).2
    rw [abs_of_nonneg
        (sub_nonneg.mpr ((calibration artifact).monotone firstLeSecond)),
      abs_of_nonneg (sub_nonneg.mpr firstLeSecond)]
    exact upperBound
  · have upperBound :=
      (distortion.2.2 second secondMem first firstMem secondLeFirst).2
    rw [abs_of_nonpos
        (sub_nonpos.mpr ((calibration artifact).monotone secondLeFirst)),
      abs_of_nonpos (sub_nonpos.mpr secondLeFirst)]
    simpa only [neg_sub] using upperBound

theorem pipeline_abs_sub_le_upperSlope_mul_abs
    {Artifact : Type u} {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (artifact : Artifact)
    (first second : ℝ)
    (firstMem : first ∈ source artifact)
    (secondMem : second ∈ source artifact) :
    |pipeline.calibration artifact second -
        pipeline.calibration artifact first| ≤
      pipeline.upperSlope artifact * |second - first| := by
  exact calibration_abs_sub_le_upperSlope_mul_abs pipeline.calibration
    pipeline.lowerSlope pipeline.upperSlope source artifact
      (secantDistortion pipeline artifact) first second firstMem secondMem

/-- A proof-carrying approximate execution trace aligned with a concrete
pipeline.  Every observed intermediate value must remain in the next stage's
certified domain. -/
inductive StagewiseResidualTraceAt
    {Artifact : Type u}
    (artifact : Artifact) :
    {source target : Artifact → Set ℝ} →
      (pipeline : CalibrationPipeline Artifact source target) →
      (input : ℝ) → Type (u + 1)
  | single {source target}
      (stage : CalibrationStage Artifact source target)
      (input observed residual : ℝ)
      (inputMem : input ∈ source artifact)
      (observedMem : observed ∈ target artifact)
      (residualNonnegative : 0 ≤ residual)
      (errorBound : |observed - stage.calibration artifact input| ≤ residual) :
      StagewiseResidualTraceAt artifact (.single stage) input
  | cons {source intermediate target}
      (stage : CalibrationStage Artifact source intermediate)
      (rest : CalibrationPipeline Artifact intermediate target)
      (input intermediateObserved residual : ℝ)
      (inputMem : input ∈ source artifact)
      (intermediateObservedMem : intermediateObserved ∈ intermediate artifact)
      (residualNonnegative : 0 ≤ residual)
      (errorBound :
        |intermediateObserved - stage.calibration artifact input| ≤ residual)
      (restTrace : StagewiseResidualTraceAt artifact rest intermediateObserved) :
      StagewiseResidualTraceAt artifact (.cons stage rest) input

namespace StagewiseResidualTraceAt

def output
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ} :
    StagewiseResidualTraceAt artifact pipeline input → ℝ
  | .single _ _ observed _ _ _ _ _ => observed
  | .cons _ _ _ _ _ _ _ _ _ restTrace => restTrace.output

def residuals
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ} :
    StagewiseResidualTraceAt artifact pipeline input → List ℝ
  | .single _ _ _ residual _ _ _ _ => [residual]
  | .cons _ _ _ _ residual _ _ _ _ restTrace =>
      residual :: restTrace.residuals

def residualEnvelope
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ} :
    StagewiseResidualTraceAt artifact pipeline input → ℝ
  | .single _ _ _ residual _ _ _ _ => residual
  | .cons _ rest _ _ residual _ _ _ _ restTrace =>
      restTrace.residualEnvelope + rest.upperSlope artifact * residual

end StagewiseResidualTraceAt

theorem stagewiseResidualTrace_residualEnvelope_nonnegative
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ}
    (trace : StagewiseResidualTraceAt artifact pipeline input) :
    0 ≤ trace.residualEnvelope := by
  induction trace with
  | single _ _ _ residual _ _ residualNonnegative _ =>
      exact residualNonnegative
  | cons _ rest _ _ residual _ _ residualNonnegative _ _ restInduction =>
      have restUpperNonnegative : 0 ≤ rest.upperSlope artifact :=
        (secantDistortion rest artifact).1.trans
          (secantDistortion rest artifact).2.1
      exact add_nonneg restInduction
        (mul_nonneg restUpperNonnegative residualNonnegative)

theorem stagewiseResidualTrace_residuals_length_eq_stageCount
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ}
    (trace : StagewiseResidualTraceAt artifact pipeline input) :
    trace.residuals.length = pipeline.stageCount := by
  induction trace with
  | single => rfl
  | cons _ _ _ _ _ _ _ _ _ _ restInduction =>
      simp only [StagewiseResidualTraceAt.residuals, List.length_cons,
        CalibrationPipeline.stageCount, restInduction]

theorem stagewiseResidualTrace_input_mem
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ}
    (trace : StagewiseResidualTraceAt artifact pipeline input) :
    input ∈ source artifact := by
  cases trace with
  | single _ _ _ _ inputMem => exact inputMem
  | cons _ _ _ _ _ inputMem => exact inputMem

theorem stagewiseResidualTrace_final_error_le_envelope
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} {input : ℝ}
    (trace : StagewiseResidualTraceAt artifact pipeline input) :
    |trace.output - pipeline.calibration artifact input| ≤
      trace.residualEnvelope := by
  induction trace with
  | single _ _ _ _ _ _ _ errorBound =>
      exact errorBound
  | cons stage rest input intermediateObserved residual inputMem
      intermediateObservedMem residualNonnegative errorBound restTrace
      restInduction =>
      have exactIntermediateMem :
          stage.calibration artifact input ∈ _ :=
        stage.mapsDomain artifact input inputMem
      have restMapBound :=
        pipeline_abs_sub_le_upperSlope_mul_abs rest artifact
          (stage.calibration artifact input) intermediateObserved
          exactIntermediateMem intermediateObservedMem
      have restUpperNonnegative : 0 ≤ rest.upperSlope artifact :=
        (secantDistortion rest artifact).1.trans
          (secantDistortion rest artifact).2.1
      have amplified :=
        restMapBound.trans
          (mul_le_mul_of_nonneg_left errorBound restUpperNonnegative)
      change
        |restTrace.output -
            rest.calibration artifact (stage.calibration artifact input)| ≤
          restTrace.residualEnvelope + rest.upperSlope artifact * residual
      calc
        |restTrace.output -
            rest.calibration artifact (stage.calibration artifact input)| ≤
            |restTrace.output -
                rest.calibration artifact intermediateObserved| +
              |rest.calibration artifact intermediateObserved -
                rest.calibration artifact (stage.calibration artifact input)| :=
          abs_sub_le _ _ _
        _ ≤ restTrace.residualEnvelope +
              rest.upperSlope artifact * residual :=
          add_le_add restInduction amplified

/-- In a two-stage scale-by-two pipeline, an error of one after the first
stage is doubled by the second stage even when the second stage itself is
exact. -/
noncomputable def twoScaleResidualTrace :
    StagewiseResidualTraceAt () (repeatScaleTwoPipeline 1) 0 := by
  unfold repeatScaleTwoPipeline
  refine .cons scaleTwoStage (.single scaleTwoStage)
    0 1 1 (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_ ?_
  · rw [scaleTwoStage_apply]
    norm_num
  · refine .single scaleTwoStage 1 2 0
      (by simp [allCalibrationDomain])
      (by simp [allCalibrationDomain]) (by norm_num) ?_
    rw [scaleTwoStage_apply]
    norm_num

theorem twoScaleResidualTrace_output_eq_two :
    twoScaleResidualTrace.output = 2 := by
  rfl

theorem twoScaleResidualTrace_residuals_eq_one_zero :
    twoScaleResidualTrace.residuals = [1, 0] := by
  rfl

theorem twoScaleResidualTrace_envelope_eq_two :
    twoScaleResidualTrace.residualEnvelope = 2 := by
  change 0 + 2 * 1 = 2
  norm_num

theorem twoScaleResidualTrace_final_error_is_sharp :
    |twoScaleResidualTrace.output -
        (repeatScaleTwoPipeline 1).calibration () 0| =
      twoScaleResidualTrace.residualEnvelope := by
  rw [twoScaleResidualTrace_output_eq_two,
    repeatScaleTwoPipeline_apply,
    twoScaleResidualTrace_envelope_eq_two]
  norm_num

/-- The raw sum of local residuals is not a sound final-error bound once a
later stage can expand distances. -/
theorem twoScaleResidualTrace_unweighted_sum_is_unsound :
    twoScaleResidualTrace.residuals.sum = 1 ∧
      ¬ |twoScaleResidualTrace.output -
          (repeatScaleTwoPipeline 1).calibration () 0| ≤
        twoScaleResidualTrace.residuals.sum := by
  constructor
  · rw [twoScaleResidualTrace_residuals_eq_one_zero]
    norm_num
  · rw [twoScaleResidualTrace_output_eq_two,
      repeatScaleTwoPipeline_apply,
      twoScaleResidualTrace_residuals_eq_one_zero]
    norm_num

end Sprawlens.RepresentationIntervalCalibrationResidualPropagation
