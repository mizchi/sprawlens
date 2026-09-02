import Sprawlens.PathwiseStrictImprovementWitness

namespace Sprawlens.PathwiseNontrivialImprovementWitness

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PathwiseTargetReliability
open PathwiseUniformDominance
open PositiveCostAttainment
open ReachableTraceClass
open TargetReliabilityClassification

inductive NontrivialEdit where
  | first
  | second
  | third
deriving DecidableEq

@[simp] theorem nontrivial_first_ne_second :
    NontrivialEdit.first ≠ .second := by decide

@[simp] theorem nontrivial_first_ne_third :
    NontrivialEdit.first ≠ .third := by decide

@[simp] theorem nontrivial_second_ne_first :
    NontrivialEdit.second ≠ .first := by decide

@[simp] theorem nontrivial_second_ne_third :
    NontrivialEdit.second ≠ .third := by decide

@[simp] theorem nontrivial_third_ne_first :
    NontrivialEdit.third ≠ .first := by decide

@[simp] theorem nontrivial_third_ne_second :
    NontrivialEdit.third ≠ .second := by decide

def NontrivialIndependent (_ _ : NontrivialEdit) : Prop := True

instance nontrivialIndependentDecidable :
    DecidableRel NontrivialIndependent :=
  fun _ _ => isTrue trivial

def nontrivialSource : List NontrivialEdit :=
  [.first, .second, .third]

def nontrivialBest : List NontrivialEdit :=
  [.second, .first, .third]

def nontrivialSecond : List NontrivialEdit :=
  [.first, .third, .second]

def NontrivialNormal (target : List NontrivialEdit) : Prop :=
  target = nontrivialBest ∨ target = nontrivialSecond

instance nontrivialNormalDecidable : DecidablePred NontrivialNormal := by
  intro target
  unfold NontrivialNormal
  infer_instance

/-- The two direct normalizing edges cost one and two respectively; all
other primitive contexts are deliberately expensive. -/
def nontrivialExactCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : ℝ :=
  if before = [] then 1
  else if before = [.first] then 2
  else 10

/-- A unit approximation error exists only after a three-edit prefix, which
cannot occur in the three-element source's swap component. -/
def nontrivialApproximateCost
    (before after : List NontrivialEdit)
    (left right : NontrivialEdit) : ℝ :=
  nontrivialExactCost before after left right +
    if before = [.first, .second, .third] then 1 else 0

def nontrivialErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : ℝ :=
  if before = [.first, .second, .third] then 1 else 0

theorem nontrivial_reachableTraceVerticesList_length :
    (reachableTraceVerticesList NontrivialIndependent
      nontrivialSource).length = 6 := by
  native_decide

theorem nontrivial_exact_dijkstraSearch :
    dijkstraSearch NontrivialIndependent nontrivialExactCost
      NontrivialNormal nontrivialSource =
        some (1, nontrivialBest) := by
  rw [dijkstraSearch, nontrivial_reachableTraceVerticesList_length]
  norm_num [dijkstraSearchFuel, dijkstraStep, initialSearchState,
    pruneSettledFrontier, advanceFrontier, relaxWeightedFrontierEntry,
    weightedSwapStepChoicesList, weightedSwapStepChoicesListAux,
    SimpleNormalizingSearch.minimumBy?, NontrivialNormal,
    NontrivialIndependent, nontrivialExactCost, nontrivialSource,
    nontrivialBest, nontrivialSecond]

theorem nontrivial_exact_dijkstraSecondNormalTarget :
    dijkstraSecondNormalTarget NontrivialIndependent nontrivialExactCost
      NontrivialNormal nontrivialSource nontrivialBest =
        some (2, nontrivialSecond) := by
  rw [dijkstraSecondNormalTarget, dijkstraSearch,
    nontrivial_reachableTraceVerticesList_length]
  norm_num [dijkstraSearchFuel, dijkstraStep, initialSearchState,
    pruneSettledFrontier, advanceFrontier, relaxWeightedFrontierEntry,
    weightedSwapStepChoicesList, weightedSwapStepChoicesListAux,
    SimpleNormalizingSearch.minimumBy?, OtherNormal, NontrivialNormal,
    NontrivialIndependent, nontrivialExactCost, nontrivialSource,
    nontrivialBest, nontrivialSecond]

theorem nontrivial_approximate_dijkstraSearch :
    dijkstraSearch NontrivialIndependent nontrivialApproximateCost
      NontrivialNormal nontrivialSource =
        some (1, nontrivialBest) := by
  rw [dijkstraSearch, nontrivial_reachableTraceVerticesList_length]
  norm_num [dijkstraSearchFuel, dijkstraStep, initialSearchState,
    pruneSettledFrontier, advanceFrontier, relaxWeightedFrontierEntry,
    weightedSwapStepChoicesList, weightedSwapStepChoicesListAux,
    SimpleNormalizingSearch.minimumBy?, NontrivialNormal,
    NontrivialIndependent, nontrivialApproximateCost,
    nontrivialExactCost, nontrivialSource, nontrivialBest,
    nontrivialSecond]
  simp

def nontrivialMarginResult : TargetMarginResult NontrivialEdit where
  bestCost := 1
  bestTarget := nontrivialBest
  secondCost := 2
  secondTarget := nontrivialSecond
  margin := 1

theorem nontrivial_competingClassification :
    classifyTargetReliability NontrivialIndependent nontrivialExactCost
      NontrivialNormal nontrivialSource =
        .competingNormalTargets nontrivialMarginResult := by
  simp [classifyTargetReliability, nontrivial_exact_dijkstraSearch,
    nontrivial_exact_dijkstraSecondNormalTarget, nontrivialMarginResult]
  norm_num

theorem nontrivial_source_ne_best :
    nontrivialSource ≠ nontrivialBest := by decide

theorem nontrivial_exactCost_nonnegative :
    PrimitiveSwapCostLowerBound
      NontrivialIndependent nontrivialExactCost 0 := by
  intro before after left right independent
  simp only [nontrivialExactCost]
  split
  · norm_num
  · split <;> norm_num

theorem nontrivial_approximateCost_nonnegative :
    PrimitiveSwapCostLowerBound
      NontrivialIndependent nontrivialApproximateCost 0 := by
  intro before after left right independent
  have exactNonnegative :=
    nontrivial_exactCost_nonnegative before after left right independent
  simp only [nontrivialApproximateCost]
  split <;> linarith

theorem nontrivial_costs_withinBy :
    PrimitiveSwapCostWithinBy NontrivialIndependent nontrivialExactCost
      nontrivialApproximateCost nontrivialErrorCost := by
  intro before after left right independent
  simp only [nontrivialApproximateCost, nontrivialErrorCost]
  split <;> norm_num

theorem nontrivial_errorCost_bounded_by_one :
    PrimitiveErrorCostBound
      NontrivialIndependent nontrivialErrorCost 1 := by
  intro before after left right independent
  simp only [nontrivialErrorCost]
  split <;> norm_num

theorem nontrivial_approximateCost_overestimates :
    PrimitiveSwapCostLe NontrivialIndependent nontrivialExactCost
      nontrivialApproximateCost := by
  intro before after left right independent
  simp only [nontrivialApproximateCost]
  split <;> norm_num

theorem nontrivial_uniformError_at_least_one
    {epsilon : ℝ}
    (within : PrimitiveSwapCostWithin NontrivialIndependent
      nontrivialExactCost nontrivialApproximateCost epsilon) :
    1 ≤ epsilon := by
  have realized := within
    [.first, .second, .third] [] .first .second trivial
  norm_num [nontrivialExactCost, nontrivialApproximateCost] at realized
  exact realized

theorem nontrivial_errorEnvelope_at_least_one
    {epsilon : ℝ}
    (bounded : PrimitiveErrorCostBound
      NontrivialIndependent nontrivialErrorCost epsilon) :
    1 ≤ epsilon := by
  simpa [nontrivialErrorCost] using
    bounded [.first, .second, .third] [] .first .second trivial

theorem nontrivial_bestExactPath :
    WeightedTracePath NontrivialIndependent nontrivialExactCost
      1 1 nontrivialSource nontrivialBest := by
  simpa [nontrivialExactCost, nontrivialSource, nontrivialBest] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialExactCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialExactCost)
        nontrivialBest)

theorem nontrivial_bestApproximatePath :
    WeightedTracePath NontrivialIndependent nontrivialApproximateCost
      1 1 nontrivialSource nontrivialBest := by
  simpa [nontrivialApproximateCost, nontrivialExactCost,
    nontrivialSource, nontrivialBest] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialApproximateCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialApproximateCost)
        nontrivialBest)

theorem nontrivial_bestErrorPath :
    WeightedTracePath NontrivialIndependent nontrivialErrorCost
      1 0 nontrivialSource nontrivialBest := by
  simpa [nontrivialErrorCost, nontrivialSource, nontrivialBest] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialErrorCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialErrorCost)
        nontrivialBest)

theorem nontrivial_secondExactPath :
    WeightedTracePath NontrivialIndependent nontrivialExactCost
      1 2 nontrivialSource nontrivialSecond := by
  simpa [nontrivialExactCost, nontrivialSource, nontrivialSecond] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialExactCost)
        [.first] [] .second .third trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := nontrivialExactCost)
        nontrivialSecond)

theorem nontrivial_pathwise_twoSided_margin_holds :
    (0 : ℝ) + 0 < nontrivialMarginResult.margin := by
  norm_num [nontrivialMarginResult]

theorem nontrivial_pathwise_oneSided_margin_holds :
    (0 : ℝ) < nontrivialMarginResult.margin := by
  norm_num [nontrivialMarginResult]

theorem nontrivial_twoSided_uniformMargin_impossible
    {epsilon : ℝ}
    (within : PrimitiveSwapCostWithin NontrivialIndependent
      nontrivialExactCost nontrivialApproximateCost epsilon) :
    ¬2 *
        ((reachableTraceVerticesList
          NontrivialIndependent nontrivialSource).length : ℝ) * epsilon <
      nontrivialMarginResult.margin := by
  have epsilonLower := nontrivial_uniformError_at_least_one within
  rw [nontrivial_reachableTraceVerticesList_length]
  norm_num [nontrivialMarginResult] at epsilonLower ⊢
  linarith

theorem nontrivial_oneSided_uniformMargin_impossible
    {epsilon : ℝ}
    (within : PrimitiveSwapCostWithin NontrivialIndependent
      nontrivialExactCost nontrivialApproximateCost epsilon) :
    ¬((reachableTraceVerticesList
        NontrivialIndependent nontrivialSource).length : ℝ) * epsilon <
      nontrivialMarginResult.margin := by
  have epsilonLower := nontrivial_uniformError_at_least_one within
  rw [nontrivial_reachableTraceVerticesList_length]
  norm_num [nontrivialMarginResult] at epsilonLower ⊢
  linarith

/-- Non-degenerate strict improvement: the source is not normal, both
verified searches traverse a positive-length path, and every valid global
uniform envelope still fails while the concrete pathwise error is zero. -/
theorem nontrivial_pathwise_strictly_improves_uniform :
    nontrivialSource ≠ nontrivialMarginResult.bestTarget ∧
      classifyTargetReliability NontrivialIndependent nontrivialExactCost
          NontrivialNormal nontrivialSource =
        .competingNormalTargets nontrivialMarginResult ∧
      dijkstraSearch NontrivialIndependent nontrivialApproximateCost
          NontrivialNormal nontrivialSource =
        some (1, nontrivialMarginResult.bestTarget) ∧
      WeightedTracePath NontrivialIndependent nontrivialApproximateCost
          1 1 nontrivialSource nontrivialMarginResult.bestTarget ∧
      WeightedTracePath NontrivialIndependent nontrivialErrorCost
          1 0 nontrivialSource nontrivialMarginResult.bestTarget ∧
      (0 : ℝ) + 0 < nontrivialMarginResult.margin ∧
      (∀ epsilon,
        PrimitiveSwapCostWithin NontrivialIndependent nontrivialExactCost
            nontrivialApproximateCost epsilon →
          ¬2 *
              ((reachableTraceVerticesList
                NontrivialIndependent nontrivialSource).length : ℝ) *
                epsilon < nontrivialMarginResult.margin) ∧
      (∀ epsilon,
        PrimitiveSwapCostWithin NontrivialIndependent nontrivialExactCost
            nontrivialApproximateCost epsilon →
          ¬((reachableTraceVerticesList
              NontrivialIndependent nontrivialSource).length : ℝ) *
                epsilon < nontrivialMarginResult.margin) := by
  refine ⟨?_, nontrivial_competingClassification,
    ?_, ?_, ?_, nontrivial_pathwise_twoSided_margin_holds,
    (fun epsilon within =>
      nontrivial_twoSided_uniformMargin_impossible within),
    (fun epsilon within =>
      nontrivial_oneSided_uniformMargin_impossible within)⟩
  · simpa [nontrivialMarginResult] using nontrivial_source_ne_best
  · simpa [nontrivialMarginResult] using
      nontrivial_approximate_dijkstraSearch
  · simpa [nontrivialMarginResult] using nontrivial_bestApproximatePath
  · simpa [nontrivialMarginResult] using nontrivial_bestErrorPath

end Sprawlens.PathwiseNontrivialImprovementWitness
