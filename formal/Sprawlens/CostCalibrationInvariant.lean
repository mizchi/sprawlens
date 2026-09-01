import Sprawlens.ApproximateWeightedNormalization

namespace Sprawlens.CostCalibrationInvariant

open AposterioriConfluence
open DijkstraInvariant
open LayoutConfluence
open PositiveCostAttainment

universe u

/-- Uniform change of cost units. -/
def scaleSwapCost {Edit : Type u}
    (factor : ℝ)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    List Edit → List Edit → Edit → Edit → ℝ :=
  fun before after first second =>
    factor * swapCost before after first second

theorem weightedSwapStep_scale
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (factor : ℝ)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent swapCost
      edgeCost first target) :
    WeightedSwapStep Independent (scaleSwapCost factor swapCost)
      (factor * edgeCost) first target := by
  cases edge with
  | forward before after left right independent =>
      exact .forward before after left right independent
  | backward before after left right independent =>
      exact .backward before after left right independent

theorem weightedSwapStep_unscale
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (factor : ℝ)
    {scaledEdgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent (scaleSwapCost factor swapCost)
      scaledEdgeCost first target) :
    ∃ edgeCost,
      scaledEdgeCost = factor * edgeCost ∧
      WeightedSwapStep Independent swapCost edgeCost first target := by
  cases edge with
  | forward before after left right independent =>
      exact ⟨swapCost before after left right, rfl,
        .forward before after left right independent⟩
  | backward before after left right independent =>
      exact ⟨swapCost before after left right, rfl,
        .backward before after left right independent⟩

/-- Scaling primitive costs scales every path cost by the same factor without
changing its trace vertices or edge count. -/
theorem weightedTracePath_scale
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (factor : ℝ)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent swapCost
      count pathCost first target) :
    WeightedTracePath Independent (scaleSwapCost factor swapCost)
      count (factor * pathCost) first target := by
  induction path with
  | refl edits => simpa using
      (WeightedTracePath.refl
        (Independent := Independent)
        (swapCost := scaleSwapCost factor swapCost) edits)
  | step edge rest inductionHypothesis =>
      simpa [mul_add] using WeightedTracePath.step
        (weightedSwapStep_scale Independent swapCost factor edge)
        inductionHypothesis

/-- Conversely, every path in the scaled model is the same concrete path in
the original model, with a cost whose scaling equals the indexed cost. -/
theorem weightedTracePath_unscale
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (factor : ℝ)
    {count : Nat} {scaledPathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent (scaleSwapCost factor swapCost)
      count scaledPathCost first target) :
    ∃ pathCost,
      scaledPathCost = factor * pathCost ∧
      WeightedTracePath Independent swapCost
        count pathCost first target := by
  induction path with
  | refl edits => exact ⟨0, by simp, .refl edits⟩
  | @step count scaledEdgeCost scaledTailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨edgeCost, edgeCostEq, exactEdge⟩ :=
        weightedSwapStep_unscale Independent swapCost factor edge
      obtain ⟨tailCost, tailCostEq, exactRest⟩ := inductionHypothesis
      refine ⟨edgeCost + tailCost, ?_, .step exactEdge exactRest⟩
      rw [edgeCostEq, tailCostEq, mul_add]

theorem scaleSwapCost_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (factor : ℝ) (factorNonnegative : 0 ≤ factor)
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0) :
    PrimitiveSwapCostLowerBound Independent
      (scaleSwapCost factor swapCost) 0 := by
  intro before after first second independent
  exact mul_nonneg factorNonnegative
    (primitiveNonnegative before after first second independent)

/-- Positive unit conversion preserves the exact global normalizing optimum.
The deterministic tie order need not be identical, but every returned target
and path is also globally optimal under the original cost model. -/
theorem scaledDijkstra_preserves_exactGlobalOptimality
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (factor : ℝ) (factorPositive : 0 < factor)
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent swapCost
      baseCount baseCost source baseTarget) :
    ∃ minimumCount scaledMinimumCost minimumCost minimumTarget,
      dijkstraSearch Independent (scaleSwapCost factor swapCost)
          Normal source = some (scaledMinimumCost, minimumTarget) ∧
      Normal minimumTarget ∧
      scaledMinimumCost = factor * minimumCost ∧
      WeightedTracePath Independent (scaleSwapCost factor swapCost)
        minimumCount scaledMinimumCost source minimumTarget ∧
      WeightedTracePath Independent swapCost
        minimumCount minimumCost source minimumTarget ∧
      ∀ {otherCount otherCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent swapCost
          otherCount otherCost source otherTarget →
        minimumCost ≤ otherCost := by
  have scaledNonnegative := scaleSwapCost_nonnegative
    Independent swapCost factor factorPositive.le primitiveNonnegative
  have scaledBasePath :=
    weightedTracePath_scale Independent swapCost factor basePath
  obtain ⟨minimumCount, scaledMinimumCost, minimumTarget,
      searchEq, minimumNormal, scaledMinimumPath, scaledMinimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent
      (scaleSwapCost factor swapCost) Normal scaledNonnegative source
      baseNormal scaledBasePath
  obtain ⟨minimumCost, scaledCostEq, minimumPath⟩ :=
    weightedTracePath_unscale Independent swapCost factor scaledMinimumPath
  refine ⟨minimumCount, scaledMinimumCost, minimumCost, minimumTarget,
    searchEq, minimumNormal, scaledCostEq, scaledMinimumPath,
    minimumPath, ?_⟩
  intro otherCount otherCost otherTarget otherNormal otherPath
  have scaledOtherPath :=
    weightedTracePath_scale Independent swapCost factor otherPath
  have scaledLe := scaledMinimum otherNormal scaledOtherPath
  rw [scaledCostEq] at scaledLe
  nlinarith

/-- If the exact best target is strictly separated from every different
normal target, positive unit conversion preserves that target identity. -/
theorem scaledDijkstra_preserves_strictlySeparatedTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (factor : ℝ) (factorPositive : 0 < factor)
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit)
    {bestCount : Nat} {bestCost : ℝ} {bestTarget : List Edit}
    (bestNormal : Normal bestTarget)
    (bestPath : WeightedTracePath Independent swapCost
      bestCount bestCost source bestTarget)
    (strictlySeparated :
      ∀ {otherCount otherCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent swapCost
          otherCount otherCost source otherTarget →
        otherTarget ≠ bestTarget →
        bestCost < otherCost) :
    ∃ minimumCount scaledMinimumCost minimumCost,
      dijkstraSearch Independent (scaleSwapCost factor swapCost)
          Normal source = some (scaledMinimumCost, bestTarget) ∧
      scaledMinimumCost = factor * minimumCost ∧
      WeightedTracePath Independent (scaleSwapCost factor swapCost)
        minimumCount scaledMinimumCost source bestTarget ∧
      WeightedTracePath Independent swapCost
        minimumCount minimumCost source bestTarget := by
  obtain ⟨minimumCount, scaledMinimumCost, minimumCost, minimumTarget,
      searchEq, minimumNormal, scaledCostEq, scaledMinimumPath,
      minimumPath, minimum⟩ :=
    scaledDijkstra_preserves_exactGlobalOptimality Independent swapCost
      Normal factor factorPositive primitiveNonnegative source
      bestNormal bestPath
  have minimumTargetEq : minimumTarget = bestTarget := by
    by_contra different
    have lower := strictlySeparated minimumNormal minimumPath different
    have upper := minimum bestNormal bestPath
    linarith
  subst minimumTarget
  exact ⟨minimumCount, scaledMinimumCost, minimumCost, searchEq,
    scaledCostEq, scaledMinimumPath, minimumPath⟩

/-- Zero scaling erases a strict cost distinction, so positivity of the unit
conversion factor is load-bearing for optimizer preservation. -/
theorem zeroScaling_erases_strictOrder :
    ∃ lower upper : ℝ,
      0 ≤ lower ∧ lower < upper ∧
      0 * lower = 0 * upper := by
  exact ⟨0, 1, by norm_num, by norm_num, by norm_num⟩

/-- A negative factor reverses rather than preserves a strict cost order. -/
theorem negativeScaling_reverses_strictOrder :
    ∃ lower upper factor : ℝ,
      lower < upper ∧ factor < 0 ∧
      factor * upper < factor * lower := by
  exact ⟨0, 1, -1, by norm_num, by norm_num, by norm_num⟩

end Sprawlens.CostCalibrationInvariant
