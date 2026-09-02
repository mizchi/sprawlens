import Sprawlens.ReachableErrorEnvelope

namespace Sprawlens.ReachablePathwiseStrictWitness

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PathwiseNontrivialImprovementWitness
open PathwiseUniformDominance
open PositiveCostAttainment
open ReachableErrorEnvelope
open ReachableTraceClass
open TargetReliabilityClassification

/-- The only approximation error is now on the reachable direct edge from
the source to the exact second-best target. -/
def componentApproximateCost
    (before after : List NontrivialEdit)
    (left right : NontrivialEdit) : ℝ :=
  nontrivialExactCost before after left right +
    if before = [.first] then 1 else 0

def componentErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : ℝ :=
  if before = [.first] then 1 else 0

theorem component_approximate_dijkstraSearch :
    dijkstraSearch NontrivialIndependent componentApproximateCost
      NontrivialNormal nontrivialSource =
        some (1, nontrivialBest) := by
  rw [dijkstraSearch, nontrivial_reachableTraceVerticesList_length]
  norm_num [dijkstraSearchFuel, dijkstraStep, initialSearchState,
    pruneSettledFrontier, advanceFrontier, relaxWeightedFrontierEntry,
    weightedSwapStepChoicesList, weightedSwapStepChoicesListAux,
    SimpleNormalizingSearch.minimumBy?, NontrivialNormal,
    NontrivialIndependent, componentApproximateCost,
    nontrivialExactCost, nontrivialSource, nontrivialBest,
    nontrivialSecond]
theorem component_exactCost_nonnegative :
    PrimitiveSwapCostLowerBound
      NontrivialIndependent nontrivialExactCost 0 :=
  nontrivial_exactCost_nonnegative

theorem component_approximateCost_nonnegative :
    PrimitiveSwapCostLowerBound
      NontrivialIndependent componentApproximateCost 0 := by
  intro before after left right independent
  have exactNonnegative :=
    nontrivial_exactCost_nonnegative before after left right independent
  simp only [componentApproximateCost]
  split <;> linarith

theorem component_costs_withinBy :
    PrimitiveSwapCostWithinBy NontrivialIndependent nontrivialExactCost
      componentApproximateCost componentErrorCost := by
  intro before after left right independent
  simp only [componentApproximateCost, componentErrorCost]
  split <;> norm_num

theorem component_approximateCost_overestimates :
    PrimitiveSwapCostLe NontrivialIndependent nontrivialExactCost
      componentApproximateCost := by
  intro before after left right independent
  simp only [componentApproximateCost]
  split <;> norm_num

theorem componentErrorCost_reachableBound_one :
    ReachablePrimitiveErrorCostBound NontrivialIndependent
      componentErrorCost nontrivialSource 1 := by
  intro before after left right independent reachable
  simp only [componentErrorCost]
  split <;> norm_num

/-- The direct second-target edge is reachable from the source and realizes
error one, so no source-local uniform envelope can be smaller. -/
theorem component_reachableEnvelope_at_least_one
    {epsilon : ℝ}
    (bounded : ReachablePrimitiveErrorCostBound NontrivialIndependent
      componentErrorCost nontrivialSource epsilon) :
    1 ≤ epsilon := by
  have realized := bounded [.first] [] .second .third trivial (by
    simpa [nontrivialSource] using
      (LayoutConfluence.TraceEquivalent.refl nontrivialSource))
  simpa [componentErrorCost] using realized

theorem component_bestApproximatePath :
    WeightedTracePath NontrivialIndependent componentApproximateCost
      1 1 nontrivialSource nontrivialBest := by
  simpa [componentApproximateCost, nontrivialExactCost,
    nontrivialSource, nontrivialBest] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := componentApproximateCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := componentApproximateCost)
        nontrivialBest)

theorem component_bestErrorPath :
    WeightedTracePath NontrivialIndependent componentErrorCost
      1 0 nontrivialSource nontrivialBest := by
  simpa [componentErrorCost, nontrivialSource, nontrivialBest] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := componentErrorCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := componentErrorCost)
        nontrivialBest)

theorem component_secondErrorPath :
    WeightedTracePath NontrivialIndependent componentErrorCost
      1 1 nontrivialSource nontrivialSecond := by
  simpa [componentErrorCost, nontrivialSource, nontrivialSecond] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := componentErrorCost)
        [.first] [] .second .third trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := componentErrorCost)
        nontrivialSecond)

/-- Every valid source-reachable uniform envelope fails the two-sided margin
rule, despite the two actually selected/best error paths both costing zero. -/
theorem component_twoSided_reachableUniformMargin_impossible
    {epsilon : ℝ}
    (bounded : ReachablePrimitiveErrorCostBound NontrivialIndependent
      componentErrorCost nontrivialSource epsilon) :
    ¬2 *
        ((reachableTraceVerticesList
          NontrivialIndependent nontrivialSource).length : ℝ) * epsilon <
      nontrivialMarginResult.margin := by
  have epsilonLower := component_reachableEnvelope_at_least_one bounded
  rw [nontrivial_reachableTraceVerticesList_length]
  norm_num [nontrivialMarginResult] at epsilonLower ⊢
  linarith

theorem component_oneSided_reachableUniformMargin_impossible
    {epsilon : ℝ}
    (bounded : ReachablePrimitiveErrorCostBound NontrivialIndependent
      componentErrorCost nontrivialSource epsilon) :
    ¬((reachableTraceVerticesList
        NontrivialIndependent nontrivialSource).length : ℝ) * epsilon <
      nontrivialMarginResult.margin := by
  have epsilonLower := component_reachableEnvelope_at_least_one bounded
  rw [nontrivial_reachableTraceVerticesList_length]
  norm_num [nontrivialMarginResult] at epsilonLower ⊢
  linarith

/-- Non-degenerate strict improvement over every source-reachable uniform
envelope: an unselected but reachable edge realizes error one, while the
positive-length selected and exact-best paths both accumulate error zero. -/
theorem component_pathwise_strictly_improves_reachableUniform :
    nontrivialSource ≠ nontrivialMarginResult.bestTarget ∧
      classifyTargetReliability NontrivialIndependent nontrivialExactCost
          NontrivialNormal nontrivialSource =
        .competingNormalTargets nontrivialMarginResult ∧
      dijkstraSearch NontrivialIndependent componentApproximateCost
          NontrivialNormal nontrivialSource =
        some (1, nontrivialMarginResult.bestTarget) ∧
      WeightedTracePath NontrivialIndependent componentErrorCost
          1 0 nontrivialSource nontrivialMarginResult.bestTarget ∧
      WeightedTracePath NontrivialIndependent componentErrorCost
          1 1 nontrivialSource nontrivialMarginResult.secondTarget ∧
      (0 : ℝ) + 0 < nontrivialMarginResult.margin ∧
      (∀ epsilon,
        ReachablePrimitiveErrorCostBound NontrivialIndependent
            componentErrorCost nontrivialSource epsilon →
          ¬2 *
              ((reachableTraceVerticesList
                NontrivialIndependent nontrivialSource).length : ℝ) *
                epsilon < nontrivialMarginResult.margin) ∧
      (∀ epsilon,
        ReachablePrimitiveErrorCostBound NontrivialIndependent
            componentErrorCost nontrivialSource epsilon →
          ¬((reachableTraceVerticesList
              NontrivialIndependent nontrivialSource).length : ℝ) *
                epsilon < nontrivialMarginResult.margin) := by
  refine ⟨?_, nontrivial_competingClassification,
    ?_, ?_, ?_, nontrivial_pathwise_twoSided_margin_holds,
    (fun epsilon bounded =>
      component_twoSided_reachableUniformMargin_impossible bounded),
    (fun epsilon bounded =>
      component_oneSided_reachableUniformMargin_impossible bounded)⟩
  · simpa [nontrivialMarginResult] using nontrivial_source_ne_best
  · simpa [nontrivialMarginResult] using component_approximate_dijkstraSearch
  · simpa [nontrivialMarginResult] using component_bestErrorPath
  · simpa [nontrivialMarginResult] using component_secondErrorPath

end Sprawlens.ReachablePathwiseStrictWitness
