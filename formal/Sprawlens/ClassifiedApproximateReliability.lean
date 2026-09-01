import Sprawlens.TargetMarginSemantics

namespace Sprawlens.ClassifiedApproximateReliability

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment
open ReachableTraceClass
open TargetReliabilityClassification

universe u

/-- Direct classifier API for the general two-sided approximation bound. -/
theorem competingClassification_target_stable_of_twoSidedMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (marginDominates :
      2 * ((reachableTraceVerticesList
        Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  apply approximateDijkstra_target_stable_of_computedMargin
    Independent exactCost approximateCost Normal epsilon
    epsilonNonnegative within exactNonnegative approximateNonnegative
    source
  · exact (classifyTargetReliability_eq_competingNormalTargets_iff_margin
      Independent exactCost Normal source result).mp classified
  · exact marginDominates

/-- Direct classifier API when the approximate primitive cost is an
overestimate of the exact one. -/
theorem competingClassification_target_stable_of_overestimateMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (marginDominates :
      ((reachableTraceVerticesList
        Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  apply approximateDijkstra_target_stable_of_computedMargin_overestimate
    Independent exactCost approximateCost Normal epsilon
    epsilonNonnegative within overestimate exactNonnegative
    approximateNonnegative source
  · exact (classifyTargetReliability_eq_competingNormalTargets_iff_margin
      Independent exactCost Normal source result).mp classified
  · exact marginDominates

/-- Direct classifier API when the approximate primitive cost is an
underestimate of the exact one. -/
theorem competingClassification_target_stable_of_underestimateMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (marginDominates :
      ((reachableTraceVerticesList
        Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  apply approximateDijkstra_target_stable_of_computedMargin_underestimate
    Independent exactCost approximateCost Normal epsilon
    epsilonNonnegative within underestimate exactNonnegative
    approximateNonnegative source
  · exact (classifyTargetReliability_eq_competingNormalTargets_iff_margin
      Independent exactCost Normal source result).mp classified
  · exact marginDominates

/-- Unified two-sided decision rule. A structurally unique target is stable
under every nonnegative recosting. A competing target is stable when its
verified numerical margin dominates the approximation budget. -/
theorem classifiedTarget_stable_of_structural_or_twoSidedMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source bestTarget : List Edit)
    (reliability :
      (∃ bestCost,
        classifyTargetReliability Independent exactCost Normal source =
          .uniqueNormalTarget bestCost bestTarget) ∨
      ∃ result,
        classifyTargetReliability Independent exactCost Normal source =
          .competingNormalTargets result ∧
        result.bestTarget = bestTarget ∧
        2 * ((reachableTraceVerticesList
          Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source bestTarget := by
  rcases reliability with structurallyUnique | marginCertified
  · obtain ⟨bestCost, classified⟩ := structurallyUnique
    obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩, noOther⟩ :=
      classifyTargetReliability_uniqueNormalTarget_spec
        Independent exactCost Normal exactNonnegative source classified
    obtain ⟨selectedCount, selectedCost, selectedSearchEq,
        selectedNormal, selectedPath, selectedMinimum⟩ :=
      classifyTargetReliability_uniqueTarget_stable_under_recost
        Independent exactCost approximateCost Normal
        exactNonnegative approximateNonnegative source classified
    exact ⟨selectedCount, selectedCost, bestCount, bestCost,
      selectedSearchEq, selectedPath, bestPath⟩
  · obtain ⟨result, classified, targetEq, marginDominates⟩ :=
      marginCertified
    subst bestTarget
    obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
        selectedSearchEq, selectedLength, selectedApproximatePath,
        selectedExactPath⟩ :=
      competingClassification_target_stable_of_twoSidedMargin
        Independent exactCost approximateCost Normal epsilon
        epsilonNonnegative within exactNonnegative approximateNonnegative
        source classified marginDominates
    exact ⟨selectedCount, selectedApproximateCost,
      selectedCount, selectedExactCost, selectedSearchEq,
      selectedApproximatePath, selectedExactPath⟩

end Sprawlens.ClassifiedApproximateReliability
