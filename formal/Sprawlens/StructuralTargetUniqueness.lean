import Sprawlens.NormalTargetMargin

namespace Sprawlens.StructuralTargetUniqueness

open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment

universe u

/-- Changing the primitive cost model preserves every concrete swap edge;
only its real-valued index is recomputed. -/
theorem weightedSwapStep_recost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent firstCost edgeCost first target) :
    ∃ recostedEdgeCost,
      WeightedSwapStep Independent secondCost
        recostedEdgeCost first target := by
  cases edge with
  | forward before after left right independent =>
      exact ⟨secondCost before after left right,
        .forward before after left right independent⟩
  | backward before after left right independent =>
      exact ⟨secondCost before after left right,
        .backward before after left right independent⟩

/-- A weighted path can be transported to any other primitive cost model
without changing its vertices or edge count. -/
theorem weightedTracePath_recost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent firstCost
      count pathCost first target) :
    ∃ recostedPathCost,
      WeightedTracePath Independent secondCost
        count recostedPathCost first target := by
  induction path with
  | refl edits => exact ⟨0, .refl edits⟩
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨recostedEdgeCost, recostedEdge⟩ :=
        weightedSwapStep_recost Independent firstCost secondCost edge
      obtain ⟨recostedTailCost, recostedRest⟩ := inductionHypothesis
      exact ⟨recostedEdgeCost + recostedTailCost,
        .step recostedEdge recostedRest⟩

/-- Reachability of some normal target is independent of primitive costs. -/
theorem normalPath_exists_iff_recost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit) :
    (∃ count cost target,
        Normal target ∧
        WeightedTracePath Independent firstCost
          count cost source target) ↔
      ∃ count cost target,
        Normal target ∧
        WeightedTracePath Independent secondCost
          count cost source target := by
  constructor
  · rintro ⟨count, cost, target, normal, path⟩
    obtain ⟨recostedCost, recostedPath⟩ :=
      weightedTracePath_recost Independent firstCost secondCost path
    exact ⟨count, recostedCost, target, normal, recostedPath⟩
  · rintro ⟨count, cost, target, normal, path⟩
    obtain ⟨recostedCost, recostedPath⟩ :=
      weightedTracePath_recost Independent secondCost firstCost path
    exact ⟨count, recostedCost, target, normal, recostedPath⟩

/-- Existence of a path to a distinct normal target depends only on the
swap graph, not on the primitive cost model. -/
theorem otherNormalPath_exists_iff_recost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source excluded : List Edit) :
    (∃ count cost target,
        Normal target ∧ target ≠ excluded ∧
        WeightedTracePath Independent firstCost
          count cost source target) ↔
      ∃ count cost target,
        Normal target ∧ target ≠ excluded ∧
        WeightedTracePath Independent secondCost
          count cost source target := by
  constructor
  · rintro ⟨count, cost, target, normal, different, path⟩
    obtain ⟨recostedCost, recostedPath⟩ :=
      weightedTracePath_recost Independent firstCost secondCost path
    exact ⟨count, recostedCost, target, normal, different, recostedPath⟩
  · rintro ⟨count, cost, target, normal, different, path⟩
    obtain ⟨recostedCost, recostedPath⟩ :=
      weightedTracePath_recost Independent secondCost firstCost path
    exact ⟨count, recostedCost, target, normal, different, recostedPath⟩

/-- The absence of a distinct normal target is therefore cost-independent. -/
theorem no_otherNormalPath_iff_recost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source excluded : List Edit) :
    (¬∃ count cost target,
        Normal target ∧ target ≠ excluded ∧
        WeightedTracePath Independent firstCost
          count cost source target) ↔
      ¬∃ count cost target,
        Normal target ∧ target ≠ excluded ∧
        WeightedTracePath Independent secondCost
          count cost source target := by
  exact not_congr (otherNormalPath_exists_iff_recost
    Independent firstCost secondCost Normal source excluded)

/-- With nonnegative costs, the verified second-target search reports `none`
for one cost model exactly when it reports `none` for every other one. -/
theorem dijkstraSecondNormalTarget_none_iff_recost
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstNonnegative : PrimitiveSwapCostLowerBound
      Independent firstCost 0)
    (secondNonnegative : PrimitiveSwapCostLowerBound
      Independent secondCost 0)
    (source excluded : List Edit) :
    dijkstraSecondNormalTarget Independent firstCost Normal
        source excluded = none ↔
      dijkstraSecondNormalTarget Independent secondCost Normal
        source excluded = none := by
  rw [dijkstraSecondNormalTarget_eq_none_iff_no_otherNormalPath
      Independent firstCost Normal firstNonnegative source excluded,
    dijkstraSecondNormalTarget_eq_none_iff_no_otherNormalPath
      Independent secondCost Normal secondNonnegative source excluded]
  exact no_otherNormalPath_iff_recost
    Independent firstCost secondCost Normal source excluded

/-- With nonnegative costs, infeasibility reported by verified Dijkstra is
also invariant under arbitrary recosting of the same swap graph. -/
theorem dijkstraSearch_none_iff_recost
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstNonnegative : PrimitiveSwapCostLowerBound
      Independent firstCost 0)
    (secondNonnegative : PrimitiveSwapCostLowerBound
      Independent secondCost 0)
    (source : List Edit) :
    dijkstraSearch Independent firstCost Normal source = none ↔
      dijkstraSearch Independent secondCost Normal source = none := by
  rw [dijkstraSearch_eq_none_iff_no_normalPath
      Independent firstCost Normal firstNonnegative source,
    dijkstraSearch_eq_none_iff_no_normalPath
      Independent secondCost Normal secondNonnegative source]
  exact not_congr (normalPath_exists_iff_recost
    Independent firstCost secondCost Normal source)

/-- If one cost model certifies that no distinct normal target is reachable,
then every normal path under every other cost model has the same target. -/
theorem normalTarget_eq_of_no_otherNormalPath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (referenceCost otherCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source uniqueTarget : List Edit)
    (noOther : ¬∃ count cost target,
      Normal target ∧ target ≠ uniqueTarget ∧
      WeightedTracePath Independent referenceCost
        count cost source target)
    {count : Nat} {cost : ℝ} {target : List Edit}
    (normal : Normal target)
    (path : WeightedTracePath Independent otherCost
      count cost source target) :
    target = uniqueTarget := by
  by_contra different
  obtain ⟨recostedCost, recostedPath⟩ :=
    weightedTracePath_recost Independent otherCost referenceCost path
  exact noOther ⟨count, recostedCost, target,
    normal, different, recostedPath⟩

/-- A best target whose verified second-target search returns `none` remains
the target selected by verified Dijkstra under any other nonnegative cost
model. Path and objective values may change; target identity cannot. -/
theorem dijkstraTarget_stable_of_no_secondTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (referenceCost otherCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (referenceNonnegative : PrimitiveSwapCostLowerBound
      Independent referenceCost 0)
    (otherNonnegative : PrimitiveSwapCostLowerBound
      Independent otherCost 0)
    (source : List Edit)
    {bestCost : ℝ} {bestTarget : List Edit}
    (bestSearchEq : dijkstraSearch Independent referenceCost Normal source =
      some (bestCost, bestTarget))
    (secondSearchEq : dijkstraSecondNormalTarget
      Independent referenceCost Normal source bestTarget = none) :
    ∃ selectedCount selectedCost,
      dijkstraSearch Independent otherCost Normal source =
          some (selectedCost, bestTarget) ∧
        Normal bestTarget ∧
        WeightedTracePath Independent otherCost
          selectedCount selectedCost source bestTarget ∧
        ∀ {otherCount otherPathCost otherTarget},
          Normal otherTarget →
          WeightedTracePath Independent otherCost
            otherCount otherPathCost source otherTarget →
          selectedCost ≤ otherPathCost := by
  obtain ⟨bestNormal, bestCount, bestPath, _bestMinimum⟩ :=
    dijkstraSearch_some_globalNormalizingMinimum
      Independent referenceCost Normal referenceNonnegative
      source bestSearchEq
  have noOther : ¬∃ count cost target,
      Normal target ∧ target ≠ bestTarget ∧
      WeightedTracePath Independent referenceCost
        count cost source target :=
    (dijkstraSecondNormalTarget_eq_none_iff_no_otherNormalPath
      Independent referenceCost Normal referenceNonnegative
      source bestTarget).mp secondSearchEq
  obtain ⟨recostedBestCost, recostedBestPath⟩ :=
    weightedTracePath_recost
      Independent referenceCost otherCost bestPath
  obtain ⟨selectedCount, selectedCost, selectedTarget,
      selectedSearchEq, selectedNormal, selectedPath, selectedMinimum⟩ :=
    dijkstraSearch_complete_and_optimal
      Independent otherCost Normal otherNonnegative source
      bestNormal recostedBestPath
  have selectedTargetEq : selectedTarget = bestTarget :=
    normalTarget_eq_of_no_otherNormalPath
      Independent referenceCost otherCost Normal source bestTarget
      noOther selectedNormal selectedPath
  subst selectedTarget
  exact ⟨selectedCount, selectedCost, selectedSearchEq,
    selectedNormal, selectedPath, selectedMinimum⟩

end Sprawlens.StructuralTargetUniqueness
