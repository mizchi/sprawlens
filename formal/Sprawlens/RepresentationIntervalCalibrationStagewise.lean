import Sprawlens.RepresentationIntervalCalibrationAccumulation

namespace Sprawlens.RepresentationIntervalCalibrationStagewise

open RepresentationIntervalMetricCalibration
open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline

universe u

/-- A relative-error budget structurally aligned with a concrete calibration
pipeline.  Each constructor carries the epsilon and the two stage-envelope
proofs for exactly the stage at that position. -/
inductive StagewiseRelativeBudgetAt
    {Artifact : Type u}
    (artifact : Artifact) :
    {source target : Artifact → Set ℝ} →
      (pipeline : CalibrationPipeline Artifact source target) → Type (u + 1)
  | single {source target}
      (stage : CalibrationStage Artifact source target)
      (epsilon : ℝ)
      (epsilonNonnegative : 0 ≤ epsilon)
      (epsilonAtMostOne : epsilon ≤ 1)
      (lowerBound : 1 - epsilon ≤ stage.lowerSlope artifact)
      (upperBound : stage.upperSlope artifact ≤ 1 + epsilon) :
      StagewiseRelativeBudgetAt artifact (.single stage)
  | cons {source intermediate target}
      (stage : CalibrationStage Artifact source intermediate)
      (rest : CalibrationPipeline Artifact intermediate target)
      (epsilon : ℝ)
      (epsilonNonnegative : 0 ≤ epsilon)
      (epsilonAtMostOne : epsilon ≤ 1)
      (lowerBound : 1 - epsilon ≤ stage.lowerSlope artifact)
      (upperBound : stage.upperSlope artifact ≤ 1 + epsilon)
      (restBudget : StagewiseRelativeBudgetAt artifact rest) :
      StagewiseRelativeBudgetAt artifact (.cons stage rest)

namespace StagewiseRelativeBudgetAt

def epsilons
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} :
    StagewiseRelativeBudgetAt artifact pipeline → List ℝ
  | .single _ epsilon _ _ _ _ => [epsilon]
  | .cons _ _ epsilon _ _ _ _ restBudget => epsilon :: restBudget.epsilons

def lowerEnvelope
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} :
    StagewiseRelativeBudgetAt artifact pipeline → ℝ
  | .single _ epsilon _ _ _ _ => 1 - epsilon
  | .cons _ _ epsilon _ _ _ _ restBudget =>
      (1 - epsilon) * restBudget.lowerEnvelope

def upperEnvelope
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target} :
    StagewiseRelativeBudgetAt artifact pipeline → ℝ
  | .single _ epsilon _ _ _ _ => 1 + epsilon
  | .cons _ _ epsilon _ _ _ _ restBudget =>
      (1 + epsilon) * restBudget.upperEnvelope

end StagewiseRelativeBudgetAt

theorem stagewiseRelativeBudget_lowerEnvelope_nonnegative
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) :
    0 ≤ budget.lowerEnvelope := by
  induction budget with
  | single _ epsilon _ epsilonAtMostOne _ _ =>
      exact sub_nonneg.mpr epsilonAtMostOne
  | cons _ _ epsilon _ epsilonAtMostOne _ _ _ restInduction =>
      exact mul_nonneg (sub_nonneg.mpr epsilonAtMostOne) restInduction

theorem stagewiseRelativeBudget_upperEnvelope_nonnegative
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) :
    0 ≤ budget.upperEnvelope := by
  induction budget with
  | single _ epsilon epsilonNonnegative _ _ _ =>
      dsimp [StagewiseRelativeBudgetAt.upperEnvelope]
      linarith
  | cons _ _ epsilon epsilonNonnegative _ _ _ _ restInduction =>
      exact mul_nonneg (by linarith) restInduction

theorem stagewiseRelativeBudget_bounds_pipeline
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) :
    budget.lowerEnvelope ≤ pipeline.lowerSlope artifact ∧
      pipeline.upperSlope artifact ≤ budget.upperEnvelope := by
  induction budget with
  | single stage _ _ _ lowerBound upperBound =>
      exact ⟨lowerBound, upperBound⟩
  | cons stage rest epsilon epsilonNonnegative _ lowerBound upperBound
      restBudget restInduction =>
      have stageLowerNonnegative : 0 ≤ stage.lowerSlope artifact :=
        (stage.distortion artifact).1
      have restUpperNonnegative : 0 ≤ rest.upperSlope artifact :=
        (secantDistortion rest artifact).1.trans
          (secantDistortion rest artifact).2.1
      have upperBaseNonnegative : 0 ≤ 1 + epsilon := by
        linarith
      change
        (1 - epsilon) * restBudget.lowerEnvelope ≤
            stage.lowerSlope artifact * rest.lowerSlope artifact ∧
          stage.upperSlope artifact * rest.upperSlope artifact ≤
            (1 + epsilon) * restBudget.upperEnvelope
      exact ⟨
        mul_le_mul lowerBound restInduction.1
          (stagewiseRelativeBudget_lowerEnvelope_nonnegative restBudget)
          stageLowerNonnegative,
        mul_le_mul upperBound restInduction.2 restUpperNonnegative
          upperBaseNonnegative⟩

theorem stagewiseRelativeBudget_epsilons_length_eq_stageCount
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) :
    budget.epsilons.length = pipeline.stageCount := by
  induction budget with
  | single => rfl
  | cons _ _ _ _ _ _ _ _ restInduction =>
      simp only [StagewiseRelativeBudgetAt.epsilons, List.length_cons,
        CalibrationPipeline.stageCount, restInduction]

theorem stagewiseRelativeBudget_lowerEnvelope_eq_product
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) :
    budget.lowerEnvelope =
      (budget.epsilons.map (fun epsilon => 1 - epsilon)).prod := by
  induction budget with
  | single =>
      simp [StagewiseRelativeBudgetAt.lowerEnvelope,
        StagewiseRelativeBudgetAt.epsilons]
  | cons _ _ _ _ _ _ _ _ restInduction =>
      simp only [StagewiseRelativeBudgetAt.lowerEnvelope,
        StagewiseRelativeBudgetAt.epsilons, List.map_cons, List.prod_cons,
        restInduction]

theorem stagewiseRelativeBudget_upperEnvelope_eq_product
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) :
    budget.upperEnvelope =
      (budget.epsilons.map (fun epsilon => 1 + epsilon)).prod := by
  induction budget with
  | single =>
      simp [StagewiseRelativeBudgetAt.upperEnvelope,
        StagewiseRelativeBudgetAt.epsilons]
  | cons _ _ _ _ _ _ _ _ restInduction =>
      simp only [StagewiseRelativeBudgetAt.upperEnvelope,
        StagewiseRelativeBudgetAt.epsilons, List.map_cons, List.prod_cons,
        restInduction]

def StagewiseRelativeBudgetAt.AllStrictlySubunit
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline) : Prop :=
  match budget with
  | .single _ epsilon _ _ _ _ => epsilon < 1
  | .cons _ _ epsilon _ _ _ _ restBudget =>
      epsilon < 1 ∧ restBudget.AllStrictlySubunit

theorem stagewiseRelativeBudget_lowerEnvelope_positive
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline)
    (strict : budget.AllStrictlySubunit) :
    0 < budget.lowerEnvelope := by
  induction budget with
  | single _ epsilon _ _ _ _ =>
      exact sub_pos.mpr strict
  | cons _ _ epsilon _ _ _ _ restBudget restInduction =>
      exact mul_pos (sub_pos.mpr strict.1) (restInduction strict.2)

theorem stagewiseRelativeBudget_pipelineLower_positive
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    (budget : StagewiseRelativeBudgetAt artifact pipeline)
    (strict : budget.AllStrictlySubunit) :
    0 < pipeline.lowerSlope artifact := by
  exact (stagewiseRelativeBudget_lowerEnvelope_positive budget strict).trans_le
    (stagewiseRelativeBudget_bounds_pipeline budget).1

theorem observedGap_ge_stagewiseLowerEnvelope_sub_twoResidual
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {Constraint : Type} [DecidableEq Constraint]
    (budget : StagewiseRelativeBudgetAt artifact pipeline)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
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
    budget.lowerEnvelope *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty -
        2 * residualError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have pipelineBound := observedGap_ge_lowerSlope_sub_twoResidual pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty residualError endpointsInSource exactFeasible residual
  have envelopeScaledLe := mul_le_mul_of_nonneg_right
    (stagewiseRelativeBudget_bounds_pipeline budget).1 exactFeasible
  linarith

theorem commonCenter_preserved_of_stagewiseEnvelope_ge_twoResidual
    {Artifact : Type u} {artifact : Artifact}
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {Constraint : Type} [DecidableEq Constraint]
    (budget : StagewiseRelativeBudgetAt artifact pipeline)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
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
    (robustEnvelope : 2 * residualError ≤ budget.lowerEnvelope *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  have observedBound :=
    observedGap_ge_stagewiseLowerEnvelope_sub_twoResidual budget exactLower
      exactUpper observedLower observedUpper constraints nonempty residualError
        endpointsInSource exactFeasible residual
  linarith

noncomputable def heterogeneousIdentityBudget :
    StagewiseRelativeBudgetAt () threeIdentityPipeline := by
  unfold threeIdentityPipeline
  refine .cons identityStage
    (.cons identityStage (.single identityStage)) ((1 : ℝ) / 10)
      (by norm_num) (by norm_num) ?_ ?_ ?_
  · norm_num [identityStage, hingeLowerSlope]
  · norm_num [identityStage, hingeLowerSlope]
  · refine .cons identityStage (.single identityStage) ((1 : ℝ) / 5)
      (by norm_num) (by norm_num) ?_ ?_ ?_
    · norm_num [identityStage, hingeLowerSlope]
    · norm_num [identityStage, hingeLowerSlope]
    · refine .single identityStage ((1 : ℝ) / 20) (by norm_num)
        (by norm_num) ?_ ?_
      · norm_num [identityStage, hingeLowerSlope]
      · norm_num [identityStage, hingeLowerSlope]

theorem heterogeneousIdentityBudget_epsilons :
    heterogeneousIdentityBudget.epsilons =
      [(1 : ℝ) / 10, (1 : ℝ) / 5, (1 : ℝ) / 20] := by
  rfl

theorem heterogeneousIdentityBudget_envelopes :
    heterogeneousIdentityBudget.lowerEnvelope = (171 : ℝ) / 250 ∧
      heterogeneousIdentityBudget.upperEnvelope = (693 : ℝ) / 500 := by
  constructor
  · rw [stagewiseRelativeBudget_lowerEnvelope_eq_product,
      heterogeneousIdentityBudget_epsilons]
    norm_num
  · rw [stagewiseRelativeBudget_upperEnvelope_eq_product,
      heterogeneousIdentityBudget_epsilons]
    norm_num

theorem heterogeneousIdentityBudget_allStrictlySubunit :
    heterogeneousIdentityBudget.AllStrictlySubunit := by
  change ((1 : ℝ) / 10 < 1) ∧
    (1 : ℝ) / 5 < 1 ∧ (1 : ℝ) / 20 < 1
  norm_num

theorem heterogeneousIdentityBudget_bounds_actual_pipeline :
    (171 : ℝ) / 250 ≤ threeIdentityPipeline.lowerSlope () ∧
      threeIdentityPipeline.upperSlope () ≤ (693 : ℝ) / 500 := by
  have bounds := stagewiseRelativeBudget_bounds_pipeline
    heterogeneousIdentityBudget
  rw [heterogeneousIdentityBudget_envelopes.1,
    heterogeneousIdentityBudget_envelopes.2] at bounds
  exact bounds

/-- Retaining the three heterogeneous budgets is strictly tighter than
replacing all of them by their common worst case `20%`. -/
theorem heterogeneousEnvelope_strictly_tighter_than_uniformTwentyPercent :
    (1 - (1 : ℝ) / 5) ^ 3 < (171 : ℝ) / 250 ∧
      (693 : ℝ) / 500 < (1 + (1 : ℝ) / 5) ^ 3 := by
  norm_num

end Sprawlens.RepresentationIntervalCalibrationStagewise
