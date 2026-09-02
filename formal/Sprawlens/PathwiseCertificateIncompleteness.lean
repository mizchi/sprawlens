import Sprawlens.ReachablePathwiseStrictWitness

namespace Sprawlens.PathwiseCertificateIncompleteness

open ApproximateWeightedNormalization
open DijkstraInvariant
open PathwiseNontrivialImprovementWitness
open PathwiseUniformDominance
open PositiveCostAttainment
open ReachableErrorEnvelope
open ReachableTraceClass
open TargetReliabilityClassification

/-- Increase exactly the first-position swap cost. On the source this raises
the exact-best edge from one to two, tying the exact second-best edge. -/
def boundaryApproximateCost
    (before after : List NontrivialEdit)
    (left right : NontrivialEdit) : ℝ :=
  nontrivialExactCost before after left right +
    if before = [] then 1 else 0

def boundaryErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : ℝ :=
  if before = [] then 1 else 0

/-- The verified queue tie-break keeps the earlier best candidate even
though best and second now both have approximate cost two. -/
theorem boundary_approximate_dijkstraSearch :
    dijkstraSearch NontrivialIndependent boundaryApproximateCost
      NontrivialNormal nontrivialSource =
        some (2, nontrivialBest) := by
  rw [dijkstraSearch, nontrivial_reachableTraceVerticesList_length]
  norm_num [dijkstraSearchFuel, dijkstraStep, initialSearchState,
    pruneSettledFrontier, advanceFrontier, relaxWeightedFrontierEntry,
    weightedSwapStepChoicesList, weightedSwapStepChoicesListAux,
    SimpleNormalizingSearch.minimumBy?, NontrivialNormal,
    NontrivialIndependent, boundaryApproximateCost,
    nontrivialExactCost, nontrivialSource, nontrivialBest,
    nontrivialSecond]

theorem boundary_approximateCost_nonnegative :
    PrimitiveSwapCostLowerBound
      NontrivialIndependent boundaryApproximateCost 0 := by
  intro before after left right independent
  have exactNonnegative :=
    nontrivial_exactCost_nonnegative before after left right independent
  simp only [boundaryApproximateCost]
  split <;> linarith

theorem boundary_costs_withinBy :
    PrimitiveSwapCostWithinBy NontrivialIndependent nontrivialExactCost
      boundaryApproximateCost boundaryErrorCost := by
  intro before after left right independent
  simp only [boundaryApproximateCost, boundaryErrorCost]
  split <;> norm_num

theorem boundary_approximateCost_overestimates :
    PrimitiveSwapCostLe NontrivialIndependent nontrivialExactCost
      boundaryApproximateCost := by
  intro before after left right independent
  simp only [boundaryApproximateCost]
  split <;> norm_num

theorem boundaryErrorCost_reachableBound_one :
    ReachablePrimitiveErrorCostBound NontrivialIndependent
      boundaryErrorCost nontrivialSource 1 := by
  intro before after left right independent reachable
  simp only [boundaryErrorCost]
  split <;> norm_num

theorem boundary_bestApproximatePath :
    WeightedTracePath NontrivialIndependent boundaryApproximateCost
      1 2 nontrivialSource nontrivialBest := by
  convert WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := boundaryApproximateCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := boundaryApproximateCost)
        nontrivialBest) using 1 <;>
    norm_num [boundaryApproximateCost, nontrivialExactCost,
      nontrivialSource, nontrivialBest]

theorem boundary_secondApproximatePath :
    WeightedTracePath NontrivialIndependent boundaryApproximateCost
      1 2 nontrivialSource nontrivialSecond := by
  simpa [boundaryApproximateCost, nontrivialExactCost,
    nontrivialSource, nontrivialSecond] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := boundaryApproximateCost)
        [.first] [] .second .third trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := boundaryApproximateCost)
        nontrivialSecond)

theorem boundary_bestErrorPath :
    WeightedTracePath NontrivialIndependent boundaryErrorCost
      1 1 nontrivialSource nontrivialBest := by
  simpa [boundaryErrorCost, nontrivialSource, nontrivialBest] using
    WeightedTracePath.step
      (WeightedSwapStep.forward
        (Independent := NontrivialIndependent)
        (swapCost := boundaryErrorCost)
        [] [.third] .first .second trivial)
      (WeightedTracePath.refl
        (Independent := NontrivialIndependent)
        (swapCost := boundaryErrorCost)
        nontrivialBest)

theorem boundary_oneSided_pathwiseMargin_fails :
    ¬(1 : ℝ) < nontrivialMarginResult.margin := by
  norm_num [nontrivialMarginResult]

theorem boundary_twoSided_pathwiseMargin_fails :
    ¬(1 : ℝ) + 1 < nontrivialMarginResult.margin := by
  norm_num [nontrivialMarginResult]

/-- A pathwise rejection is not evidence of a changed target. At the strict
margin boundary the sufficient condition fails, but deterministic tie-break
still returns the exact best target. -/
theorem pathwiseMargin_is_sufficient_not_necessary :
    classifyTargetReliability NontrivialIndependent nontrivialExactCost
          NontrivialNormal nontrivialSource =
        .competingNormalTargets nontrivialMarginResult ∧
      dijkstraSearch NontrivialIndependent boundaryApproximateCost
          NontrivialNormal nontrivialSource =
        some (2, nontrivialMarginResult.bestTarget) ∧
      WeightedTracePath NontrivialIndependent boundaryApproximateCost
          1 2 nontrivialSource nontrivialMarginResult.bestTarget ∧
      WeightedTracePath NontrivialIndependent boundaryApproximateCost
          1 2 nontrivialSource nontrivialMarginResult.secondTarget ∧
      WeightedTracePath NontrivialIndependent boundaryErrorCost
          1 1 nontrivialSource nontrivialMarginResult.bestTarget ∧
      ¬(1 : ℝ) < nontrivialMarginResult.margin ∧
      ¬(1 : ℝ) + 1 < nontrivialMarginResult.margin := by
  refine ⟨nontrivial_competingClassification, ?_, ?_, ?_, ?_,
    boundary_oneSided_pathwiseMargin_fails,
    boundary_twoSided_pathwiseMargin_fails⟩
  · simpa [nontrivialMarginResult] using boundary_approximate_dijkstraSearch
  · simpa [nontrivialMarginResult] using boundary_bestApproximatePath
  · simpa [nontrivialMarginResult] using boundary_secondApproximatePath
  · simpa [nontrivialMarginResult] using boundary_bestErrorPath

end Sprawlens.PathwiseCertificateIncompleteness
