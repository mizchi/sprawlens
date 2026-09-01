import Sprawlens.TargetReliabilityClassification

namespace Sprawlens.TargetMultiplicityInvariant

open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment
open StructuralTargetUniqueness
open TargetReliabilityClassification

universe u

/-- Two distinct reachable normal representations exist. Their costs and
paths are witnesses, but multiplicity concerns only target identity. -/
def HasMultipleNormalTargets {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit) : Prop :=
  ∃ firstCount firstCost firstTarget
      secondCount secondCost secondTarget,
    Normal firstTarget ∧
    Normal secondTarget ∧
    firstTarget ≠ secondTarget ∧
    WeightedTracePath Independent swapCost
      firstCount firstCost source firstTarget ∧
    WeightedTracePath Independent swapCost
      secondCount secondCost source secondTarget

/-- Target multiplicity is a property of the swap graph and normal predicate,
not of its primitive edge weights. -/
theorem hasMultipleNormalTargets_iff_recost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit) :
    HasMultipleNormalTargets Independent firstCost Normal source ↔
      HasMultipleNormalTargets Independent secondCost Normal source := by
  constructor
  · rintro ⟨firstCount, firstPathCost, firstTarget,
      secondCount, secondPathCost, secondTarget,
      firstNormal, secondNormal, different, firstPath, secondPath⟩
    obtain ⟨recostedFirstCost, recostedFirstPath⟩ :=
      weightedTracePath_recost Independent firstCost secondCost firstPath
    obtain ⟨recostedSecondCost, recostedSecondPath⟩ :=
      weightedTracePath_recost Independent firstCost secondCost secondPath
    exact ⟨firstCount, recostedFirstCost, firstTarget,
      secondCount, recostedSecondCost, secondTarget,
      firstNormal, secondNormal, different,
      recostedFirstPath, recostedSecondPath⟩
  · rintro ⟨firstCount, firstPathCost, firstTarget,
      secondCount, secondPathCost, secondTarget,
      firstNormal, secondNormal, different, firstPath, secondPath⟩
    obtain ⟨recostedFirstCost, recostedFirstPath⟩ :=
      weightedTracePath_recost Independent secondCost firstCost firstPath
    obtain ⟨recostedSecondCost, recostedSecondPath⟩ :=
      weightedTracePath_recost Independent secondCost firstCost secondPath
    exact ⟨firstCount, recostedFirstCost, firstTarget,
      secondCount, recostedSecondCost, secondTarget,
      firstNormal, secondNormal, different,
      recostedFirstPath, recostedSecondPath⟩

/-- The total classifier enters its competing branch exactly when at least
two distinct reachable normal targets exist. -/
theorem exists_competingClassification_iff_hasMultipleNormalTargets
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    (∃ result,
        classifyTargetReliability Independent swapCost Normal source =
          .competingNormalTargets result) ↔
      HasMultipleNormalTargets Independent swapCost Normal source := by
  constructor
  · rintro ⟨result, classified⟩
    obtain ⟨bestNormal, ⟨bestCount, bestPath, _bestMinimum⟩,
        secondNormal, secondDifferent,
        ⟨secondCount, secondPath, _secondMinimum⟩,
        _marginEq, _separated, _marginNonnegative⟩ :=
      classifyTargetReliability_competingNormalTargets_spec
        Independent swapCost Normal primitiveNonnegative source classified
    exact ⟨bestCount, result.bestCost, result.bestTarget,
      secondCount, result.secondCost, result.secondTarget,
      bestNormal, secondNormal, secondDifferent.symm, bestPath, secondPath⟩
  · intro multiple
    obtain ⟨firstCount, firstCost, firstTarget,
        secondCount, secondCost, secondTarget,
        firstNormal, secondNormal, targetsDifferent,
        firstPath, secondPath⟩ := multiple
    cases classifiedEq :
        classifyTargetReliability Independent swapCost Normal source with
    | noNormalTarget =>
        have noPath :=
          (classifyTargetReliability_eq_noNormalTarget_iff_no_normalPath
            Independent swapCost Normal primitiveNonnegative source).mp
            classifiedEq
        exact (noPath ⟨firstCount, firstCost, firstTarget,
          firstNormal, firstPath⟩).elim
    | uniqueNormalTarget bestCost bestTarget =>
        obtain ⟨_bestNormal, _bestSpec, noOther⟩ :=
          classifyTargetReliability_uniqueNormalTarget_spec
            Independent swapCost Normal primitiveNonnegative source
            classifiedEq
        by_cases firstDifferent : firstTarget ≠ bestTarget
        · exact (noOther ⟨firstCount, firstCost, firstTarget,
            firstNormal, firstDifferent, firstPath⟩).elim
        · have firstEq : firstTarget = bestTarget := by
            simpa using firstDifferent
          have secondDifferent : secondTarget ≠ bestTarget := by
            intro secondEq
            exact targetsDifferent (firstEq.trans secondEq.symm)
          exact (noOther ⟨secondCount, secondCost, secondTarget,
            secondNormal, secondDifferent, secondPath⟩).elim
    | competingNormalTargets result =>
        exact ⟨result, rfl⟩

/-- The infeasible classification is invariant under nonnegative recosting. -/
theorem noNormalTargetClassification_iff_recost
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstNonnegative : PrimitiveSwapCostLowerBound
      Independent firstCost 0)
    (secondNonnegative : PrimitiveSwapCostLowerBound
      Independent secondCost 0)
    (source : List Edit) :
    classifyTargetReliability Independent firstCost Normal source =
        .noNormalTarget ↔
      classifyTargetReliability Independent secondCost Normal source =
        .noNormalTarget := by
  rw [classifyTargetReliability_eq_noNormalTarget_iff_search_none,
    classifyTargetReliability_eq_noNormalTarget_iff_search_none]
  exact dijkstraSearch_none_iff_recost
    Independent firstCost secondCost Normal
    firstNonnegative secondNonnegative source

/-- The competing classification category is invariant under nonnegative
recosting, though its best target and numerical margin may change. -/
theorem competingClassification_iff_recost
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstNonnegative : PrimitiveSwapCostLowerBound
      Independent firstCost 0)
    (secondNonnegative : PrimitiveSwapCostLowerBound
      Independent secondCost 0)
    (source : List Edit) :
    (∃ result,
        classifyTargetReliability Independent firstCost Normal source =
          .competingNormalTargets result) ↔
      ∃ result,
        classifyTargetReliability Independent secondCost Normal source =
          .competingNormalTargets result := by
  rw [exists_competingClassification_iff_hasMultipleNormalTargets
      Independent firstCost Normal firstNonnegative source,
    exists_competingClassification_iff_hasMultipleNormalTargets
      Independent secondCost Normal secondNonnegative source]
  exact hasMultipleNormalTargets_iff_recost
    Independent firstCost secondCost Normal source

/-- The structurally unique target itself is invariant under nonnegative
recosting, although its minimum numerical cost may change. -/
theorem uniqueNormalTargetClassification_iff_recost
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstNonnegative : PrimitiveSwapCostLowerBound
      Independent firstCost 0)
    (secondNonnegative : PrimitiveSwapCostLowerBound
      Independent secondCost 0)
    (source target : List Edit) :
    (∃ minimumCost,
        classifyTargetReliability Independent firstCost Normal source =
          .uniqueNormalTarget minimumCost target) ↔
      ∃ minimumCost,
        classifyTargetReliability Independent secondCost Normal source =
          .uniqueNormalTarget minimumCost target := by
  constructor
  · rintro ⟨minimumCost, classified⟩
    obtain ⟨bestSearchEq, secondSearchEq⟩ :=
      (classifyTargetReliability_eq_uniqueNormalTarget_iff
        Independent firstCost Normal source minimumCost target).mp classified
    obtain ⟨selectedCount, selectedCost, selectedSearchEq,
        selectedNormal, selectedPath, selectedMinimum⟩ :=
      dijkstraTarget_stable_of_no_secondTarget
        Independent firstCost secondCost Normal
        firstNonnegative secondNonnegative source
        bestSearchEq secondSearchEq
    have recostedSecondNone :=
      (dijkstraSecondNormalTarget_none_iff_recost
        Independent firstCost secondCost Normal
        firstNonnegative secondNonnegative source target).mp secondSearchEq
    exact ⟨selectedCost,
      (classifyTargetReliability_eq_uniqueNormalTarget_iff
        Independent secondCost Normal source selectedCost target).mpr
        ⟨selectedSearchEq, recostedSecondNone⟩⟩
  · rintro ⟨minimumCost, classified⟩
    obtain ⟨bestSearchEq, secondSearchEq⟩ :=
      (classifyTargetReliability_eq_uniqueNormalTarget_iff
        Independent secondCost Normal source minimumCost target).mp classified
    obtain ⟨selectedCount, selectedCost, selectedSearchEq,
        selectedNormal, selectedPath, selectedMinimum⟩ :=
      dijkstraTarget_stable_of_no_secondTarget
        Independent secondCost firstCost Normal
        secondNonnegative firstNonnegative source
        bestSearchEq secondSearchEq
    have recostedSecondNone :=
      (dijkstraSecondNormalTarget_none_iff_recost
        Independent secondCost firstCost Normal
        secondNonnegative firstNonnegative source target).mp secondSearchEq
    exact ⟨selectedCost,
      (classifyTargetReliability_eq_uniqueNormalTarget_iff
        Independent firstCost Normal source selectedCost target).mpr
        ⟨selectedSearchEq, recostedSecondNone⟩⟩

end Sprawlens.TargetMultiplicityInvariant
