import Sprawlens.StructuralTargetUniqueness

namespace Sprawlens.TargetReliabilityClassification

open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment
open StructuralTargetUniqueness

universe u

/-- Total diagnostic result for representation reliability. Unlike the
optional margin instrument, absence and structural uniqueness are distinct. -/
inductive TargetReliabilityResult (Edit : Type u) where
  | noNormalTarget
  | uniqueNormalTarget (bestCost : ℝ) (bestTarget : List Edit)
  | competingNormalTargets (marginResult : TargetMarginResult Edit)

/-- Classify all outcomes of the best and best-distinct-target searches. -/
noncomputable def classifyTargetReliability
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) : TargetReliabilityResult Edit :=
  match dijkstraSearch Independent swapCost Normal source with
  | none => .noNormalTarget
  | some (bestCost, bestTarget) =>
      match dijkstraSecondNormalTarget Independent swapCost Normal
          source bestTarget with
      | none => .uniqueNormalTarget bestCost bestTarget
      | some (secondCost, secondTarget) =>
          .competingNormalTargets {
            bestCost
            bestTarget
            secondCost
            secondTarget
            margin := secondCost - bestCost
          }

theorem classifyTargetReliability_eq_noNormalTarget_iff_search_none
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) :
    classifyTargetReliability Independent swapCost Normal source =
        .noNormalTarget ↔
      dijkstraSearch Independent swapCost Normal source = none := by
  cases bestSearchEq : dijkstraSearch Independent swapCost Normal source with
  | none => simp [classifyTargetReliability, bestSearchEq]
  | some best =>
      obtain ⟨foundCost, foundTarget⟩ := best
      cases secondSearchEq : dijkstraSecondNormalTarget
          Independent swapCost Normal source foundTarget <;>
        simp [classifyTargetReliability, bestSearchEq, secondSearchEq]

theorem classifyTargetReliability_eq_uniqueNormalTarget_iff
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) (bestCost : ℝ) (bestTarget : List Edit) :
    classifyTargetReliability Independent swapCost Normal source =
        .uniqueNormalTarget bestCost bestTarget ↔
      dijkstraSearch Independent swapCost Normal source =
          some (bestCost, bestTarget) ∧
        dijkstraSecondNormalTarget Independent swapCost Normal
          source bestTarget = none := by
  cases bestSearchEq : dijkstraSearch Independent swapCost Normal source with
  | none => simp [classifyTargetReliability, bestSearchEq]
  | some best =>
      obtain ⟨foundCost, foundTarget⟩ := best
      cases secondSearchEq : dijkstraSecondNormalTarget
          Independent swapCost Normal source foundTarget with
      | none =>
          constructor
          · intro classified
            have classified' :
                TargetReliabilityResult.uniqueNormalTarget
                    foundCost foundTarget =
                  TargetReliabilityResult.uniqueNormalTarget
                    bestCost bestTarget := by
              simpa [classifyTargetReliability,
                bestSearchEq, secondSearchEq] using classified
            injection classified' with costEq targetEq
            subst bestCost
            subst bestTarget
            exact ⟨rfl, secondSearchEq⟩
          · rintro ⟨searchEq, _secondEq⟩
            have pairEq : (foundCost, foundTarget) =
                (bestCost, bestTarget) :=
              Option.some.inj searchEq
            injection pairEq with costEq targetEq
            subst bestCost
            subst bestTarget
            simp [classifyTargetReliability,
              bestSearchEq, secondSearchEq]
      | some second =>
          obtain ⟨secondCost, secondTarget⟩ := second
          constructor
          · intro classified
            simp [classifyTargetReliability,
              bestSearchEq, secondSearchEq] at classified
          · rintro ⟨searchEq, noneEq⟩
            have pairEq : (foundCost, foundTarget) =
                (bestCost, bestTarget) :=
              Option.some.inj searchEq
            injection pairEq with costEq targetEq
            subst bestCost
            subst bestTarget
            rw [secondSearchEq] at noneEq
            contradiction

theorem classifyTargetReliability_eq_competingNormalTargets_iff_margin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) (result : TargetMarginResult Edit) :
    classifyTargetReliability Independent swapCost Normal source =
        .competingNormalTargets result ↔
      dijkstraTargetMargin? Independent swapCost Normal source =
        some result := by
  cases bestSearchEq : dijkstraSearch Independent swapCost Normal source with
  | none =>
      simp [classifyTargetReliability, dijkstraTargetMargin?, bestSearchEq]
  | some best =>
      obtain ⟨bestCost, bestTarget⟩ := best
      cases secondSearchEq : dijkstraSecondNormalTarget
          Independent swapCost Normal source bestTarget with
      | none =>
          simp [classifyTargetReliability, dijkstraTargetMargin?,
            bestSearchEq, secondSearchEq]
      | some second =>
          obtain ⟨secondCost, secondTarget⟩ := second
          simp [classifyTargetReliability, dijkstraTargetMargin?,
            bestSearchEq, secondSearchEq]

/-- The competing classifier retains the exact first Dijkstra result. -/
theorem classifyTargetReliability_competing_bestSearch_eq
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .competingNormalTargets result) :
    dijkstraSearch Independent swapCost Normal source =
      some (result.bestCost, result.bestTarget) := by
  have marginResult : dijkstraTargetMargin? Independent swapCost Normal
      source = some result :=
    (classifyTargetReliability_eq_competingNormalTargets_iff_margin
      Independent swapCost Normal source result).mp classified
  unfold dijkstraTargetMargin? at marginResult
  cases bestSearchEq : dijkstraSearch Independent swapCost Normal source with
  | none => simp [bestSearchEq] at marginResult
  | some best =>
      obtain ⟨bestCost, bestTarget⟩ := best
      cases secondSearchEq : dijkstraSecondNormalTarget
          Independent swapCost Normal source bestTarget with
      | none => simp [bestSearchEq, secondSearchEq] at marginResult
      | some second =>
          obtain ⟨secondCost, secondTarget⟩ := second
          simp [bestSearchEq, secondSearchEq] at marginResult
          subst result
          rfl

/-- `noNormalTarget` is a complete infeasibility certificate, rather than an
ambiguous optional failure. -/
theorem classifyTargetReliability_eq_noNormalTarget_iff_no_normalPath
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    classifyTargetReliability Independent swapCost Normal source =
        .noNormalTarget ↔
      ¬∃ count cost target,
        Normal target ∧
        WeightedTracePath Independent swapCost
          count cost source target := by
  rw [classifyTargetReliability_eq_noNormalTarget_iff_search_none,
    dijkstraSearch_eq_none_iff_no_normalPath
      Independent swapCost Normal primitiveNonnegative source]

/-- `uniqueNormalTarget` carries both global optimality and the stronger
structural fact that no distinct reachable normal representation exists. -/
theorem classifyTargetReliability_uniqueNormalTarget_spec
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {bestCost : ℝ} {bestTarget : List Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .uniqueNormalTarget bestCost bestTarget) :
    Normal bestTarget ∧
      (∃ bestCount,
        WeightedTracePath Independent swapCost
            bestCount bestCost source bestTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            bestCost ≤ otherCost) ∧
      ¬∃ count cost target,
        Normal target ∧ target ≠ bestTarget ∧
        WeightedTracePath Independent swapCost
          count cost source target := by
  obtain ⟨bestSearchEq, secondSearchEq⟩ :=
    (classifyTargetReliability_eq_uniqueNormalTarget_iff
      Independent swapCost Normal source bestCost bestTarget).mp classified
  obtain ⟨bestNormal, bestCount, bestPath, bestMinimum⟩ :=
    dijkstraSearch_some_globalNormalizingMinimum
      Independent swapCost Normal primitiveNonnegative source bestSearchEq
  have noOther :=
    (dijkstraSecondNormalTarget_eq_none_iff_no_otherNormalPath
      Independent swapCost Normal primitiveNonnegative
      source bestTarget).mp secondSearchEq
  exact ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩, noOther⟩

/-- The competing case reuses the full proof-carrying margin specification. -/
theorem classifyTargetReliability_competingNormalTargets_spec
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .competingNormalTargets result) :
    Normal result.bestTarget ∧
      (∃ bestCount,
        WeightedTracePath Independent swapCost
            bestCount result.bestCost source result.bestTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            result.bestCost ≤ otherCost) ∧
      Normal result.secondTarget ∧
      result.secondTarget ≠ result.bestTarget ∧
      (∃ secondCount,
        WeightedTracePath Independent swapCost
            secondCount result.secondCost source result.secondTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            otherTarget ≠ result.bestTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            result.secondCost ≤ otherCost) ∧
      result.margin = result.secondCost - result.bestCost ∧
      TargetSeparatedBy Independent swapCost Normal source
        result.bestCost result.bestTarget result.margin ∧
      0 ≤ result.margin := by
  apply dijkstraTargetMargin?_some_spec
    Independent swapCost Normal primitiveNonnegative source
  exact (classifyTargetReliability_eq_competingNormalTargets_iff_margin
    Independent swapCost Normal source result).mp classified

/-- A classified unique target is stable under arbitrary nonnegative
recosting, with no numerical approximation or positive-margin premise. -/
theorem classifyTargetReliability_uniqueTarget_stable_under_recost
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (referenceCost otherCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (referenceNonnegative : PrimitiveSwapCostLowerBound
      Independent referenceCost 0)
    (otherNonnegative : PrimitiveSwapCostLowerBound
      Independent otherCost 0)
    (source : List Edit) {bestCost : ℝ} {bestTarget : List Edit}
    (classified : classifyTargetReliability Independent referenceCost Normal
      source = .uniqueNormalTarget bestCost bestTarget) :
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
  obtain ⟨bestSearchEq, secondSearchEq⟩ :=
    (classifyTargetReliability_eq_uniqueNormalTarget_iff
      Independent referenceCost Normal source bestCost bestTarget).mp classified
  exact dijkstraTarget_stable_of_no_secondTarget
    Independent referenceCost otherCost Normal
    referenceNonnegative otherNonnegative source
    bestSearchEq secondSearchEq

end Sprawlens.TargetReliabilityClassification
