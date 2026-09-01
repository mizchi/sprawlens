import Sprawlens.TargetMultiplicityInvariant

namespace Sprawlens.TargetMarginSemantics

open NormalTargetMargin
open PositiveCostAttainment
open TargetReliabilityClassification

universe u

/-- A different normal representation is reachable at exactly the selected
best objective value. -/
def HasDistinctCooptimalTarget {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit)
    (bestCost : ℝ) (bestTarget : List Edit) : Prop :=
  ∃ count target,
    Normal target ∧
    target ≠ bestTarget ∧
    WeightedTracePath Independent swapCost
      count bestCost source target

/-- Every normal path attaining the selected best cost ends at the selected
target. This is objective-level uniqueness, not structural uniqueness. -/
def HasUniqueOptimalTarget {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit)
    (bestCost : ℝ) (bestTarget : List Edit) : Prop :=
  ∀ {count cost target},
    Normal target →
    WeightedTracePath Independent swapCost count cost source target →
    cost = bestCost →
    target = bestTarget

theorem hasUniqueOptimalTarget_iff_no_distinctCooptimalTarget
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit)
    (bestCost : ℝ) (bestTarget : List Edit) :
    HasUniqueOptimalTarget Independent swapCost Normal source
        bestCost bestTarget ↔
      ¬HasDistinctCooptimalTarget Independent swapCost Normal source
        bestCost bestTarget := by
  constructor
  · intro unique
    rintro ⟨count, target, normal, different, path⟩
    exact different (unique normal path rfl)
  · intro noDistinct count cost target normal path costEq
    by_contra different
    apply noDistinct
    subst cost
    exact ⟨count, target, normal, different, path⟩

/-- In the competing branch, zero best-to-second margin is equivalent to a
distinct target attaining exactly the same global optimum. -/
theorem competingMargin_eq_zero_iff_distinctCooptimalTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .competingNormalTargets result) :
    result.margin = 0 ↔
      HasDistinctCooptimalTarget Independent swapCost Normal source
        result.bestCost result.bestTarget := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent,
      ⟨secondCount, secondPath, secondMinimum⟩,
      marginEq, separated, marginNonnegative⟩ :=
    classifyTargetReliability_competingNormalTargets_spec
      Independent swapCost Normal primitiveNonnegative source classified
  constructor
  · intro marginZero
    have costsEq : result.secondCost = result.bestCost := by
      linarith
    rw [costsEq] at secondPath
    exact ⟨secondCount, result.secondTarget,
      secondNormal, secondDifferent, secondPath⟩
  · rintro ⟨otherCount, otherTarget,
      otherNormal, otherDifferent, otherPath⟩
    have secondLeBest :=
      secondMinimum otherNormal otherDifferent otherPath
    have bestLeSecond := bestMinimum secondNormal secondPath
    linarith

/-- A positive computed margin is exactly uniqueness of the optimal target
among all normal paths. Other higher-cost normal targets may still exist. -/
theorem competingMargin_pos_iff_uniqueOptimalTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .competingNormalTargets result) :
    0 < result.margin ↔
      HasUniqueOptimalTarget Independent swapCost Normal source
        result.bestCost result.bestTarget := by
  have zeroIff := competingMargin_eq_zero_iff_distinctCooptimalTarget
    Independent swapCost Normal primitiveNonnegative source classified
  have uniqueIff := hasUniqueOptimalTarget_iff_no_distinctCooptimalTarget
    Independent swapCost Normal source result.bestCost result.bestTarget
  obtain ⟨bestNormal, bestSpec, secondNormal, secondDifferent,
      secondSpec, marginEq, separated, marginNonnegative⟩ :=
    classifyTargetReliability_competingNormalTargets_spec
      Independent swapCost Normal primitiveNonnegative source classified
  constructor
  · intro marginPositive
    apply uniqueIff.mpr
    intro distinctCooptimal
    have marginZero := zeroIff.mpr distinctCooptimal
    linarith
  · intro unique
    have noDistinct := uniqueIff.mp unique
    rcases lt_or_eq_of_le marginNonnegative with marginPositive | marginZero
    · exact marginPositive
    · exact (noDistinct (zeroIff.mp marginZero.symm)).elim

/-- Structural uniqueness is stronger than objective-level uniqueness for
every best cost: if no distinct normal path exists, no cooptimal one exists. -/
theorem uniqueClassification_hasUniqueOptimalTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {bestCost : ℝ} {bestTarget : List Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .uniqueNormalTarget bestCost bestTarget) :
    HasUniqueOptimalTarget Independent swapCost Normal source
      bestCost bestTarget := by
  obtain ⟨bestNormal, bestSpec, noOther⟩ :=
    classifyTargetReliability_uniqueNormalTarget_spec
      Independent swapCost Normal primitiveNonnegative source classified
  apply (hasUniqueOptimalTarget_iff_no_distinctCooptimalTarget
    Independent swapCost Normal source bestCost bestTarget).mpr
  rintro ⟨count, target, normal, different, path⟩
  exact noOther ⟨count, bestCost, target, normal, different, path⟩

end Sprawlens.TargetMarginSemantics
