import Sprawlens.DirectedApproximationChain

namespace Sprawlens.PathwiseTargetReliability

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment
open TargetReliabilityClassification

universe u

def addPrimitiveErrorCost {Edit : Type u}
    (firstError secondError :
      List Edit → List Edit → Edit → Edit → ℝ) :
    List Edit → List Edit → Edit → Edit → ℝ :=
  fun before after first second =>
    firstError before after first second +
      secondError before after first second

/-- Non-uniform primitive error functions compose pointwise. -/
theorem primitiveSwapCostWithinBy_add
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost middleCost lastCost
        firstError secondError :
      List Edit → List Edit → Edit → Edit → ℝ)
    (firstWithin : PrimitiveSwapCostWithinBy
      Independent firstCost middleCost firstError)
    (secondWithin : PrimitiveSwapCostWithinBy
      Independent middleCost lastCost secondError) :
    PrimitiveSwapCostWithinBy Independent firstCost lastCost
      (addPrimitiveErrorCost firstError secondError) := by
  intro before after first second independent
  have firstBound :=
    firstWithin before after first second independent
  have secondBound :=
    secondWithin before after first second independent
  calc
    |firstCost before after first second -
        lastCost before after first second| =
        |(firstCost before after first second -
            middleCost before after first second) +
          (middleCost before after first second -
            lastCost before after first second)| := by ring_nf
    _ ≤ |firstCost before after first second -
          middleCost before after first second| +
        |middleCost before after first second -
          lastCost before after first second| := abs_add_le _ _
    _ ≤ firstError before after first second +
        secondError before after first second :=
      add_le_add firstBound secondBound

/-- The verified approximate search returns concrete selected- and best-path
error sums. Comparing their sum with the computed margin certifies target
identity without the reachable-class worst-case multiplier. -/
theorem competingClassification_twoSidedPathwiseCertificate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result) :
    ∃ selectedCount selectedApproximateCost selectedExactCost
        selectedError selectedTarget
        bestComparisonCount bestComparisonExactCost
        bestComparisonApproximateCost bestError,
      dijkstraSearch Independent approximateCost Normal source =
          some (selectedApproximateCost, selectedTarget) ∧
        Normal selectedTarget ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source selectedTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source selectedTarget ∧
        WeightedTracePath Independent errorCost
          selectedCount selectedError source selectedTarget ∧
        WeightedTracePath Independent exactCost
          bestComparisonCount bestComparisonExactCost
          source result.bestTarget ∧
        WeightedTracePath Independent approximateCost
          bestComparisonCount bestComparisonApproximateCost
          source result.bestTarget ∧
        WeightedTracePath Independent errorCost
          bestComparisonCount bestError source result.bestTarget ∧
        bestComparisonExactCost ≤ result.bestCost ∧
        selectedExactCost ≤
          result.bestCost + selectedError + bestError ∧
        (selectedError + bestError < result.margin →
          selectedTarget = result.bestTarget) := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent, secondSpec,
      marginEq, separated, marginNonnegative⟩ :=
    classifyTargetReliability_competingNormalTargets_spec
      Independent exactCost Normal exactNonnegative source classified
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedError, selectedTarget, selectedSearchEq, selectedNormal,
      selectedCountLt, selectedApproximatePath, selectedExactPath,
      selectedErrorPath, compare⟩ :=
    approximateDijkstra_exactCost_pathwiseCertified
      Independent exactCost approximateCost errorCost Normal
      within exactNonnegative approximateNonnegative source
      bestNormal bestPath
  obtain ⟨bestComparisonCount, bestComparisonExactCost,
      bestComparisonApproximateCost, bestError,
      bestComparisonCountLt, bestComparisonExactPath,
      bestComparisonApproximatePath, bestErrorPath,
      bestComparisonCostLe, selectedLe⟩ :=
    compare bestNormal bestPath
  refine ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    selectedError, selectedTarget,
    bestComparisonCount, bestComparisonExactCost,
    bestComparisonApproximateCost, bestError,
    selectedSearchEq, selectedNormal, selectedApproximatePath,
    selectedExactPath, selectedErrorPath,
    bestComparisonExactPath, bestComparisonApproximatePath,
    bestErrorPath, bestComparisonCostLe, selectedLe, ?_⟩
  intro errorBelowMargin
  by_contra different
  have lower := separated selectedNormal selectedExactPath different
  linarith

/-- For a pointwise overestimate, only the concrete error accumulated on a
loop-erased exact-best comparison path is needed. -/
theorem competingClassification_overestimatePathwiseCertificate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result) :
    ∃ selectedCount selectedApproximateCost selectedExactCost selectedTarget
        bestComparisonCount bestComparisonExactCost
        bestComparisonApproximateCost bestError,
      dijkstraSearch Independent approximateCost Normal source =
          some (selectedApproximateCost, selectedTarget) ∧
        Normal selectedTarget ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source selectedTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source selectedTarget ∧
        WeightedTracePath Independent exactCost
          bestComparisonCount bestComparisonExactCost
          source result.bestTarget ∧
        WeightedTracePath Independent approximateCost
          bestComparisonCount bestComparisonApproximateCost
          source result.bestTarget ∧
        WeightedTracePath Independent errorCost
          bestComparisonCount bestError source result.bestTarget ∧
        bestComparisonExactCost ≤ result.bestCost ∧
        selectedExactCost ≤ result.bestCost + bestError ∧
        (bestError < result.margin →
          selectedTarget = result.bestTarget) := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent, secondSpec,
      marginEq, separated, marginNonnegative⟩ :=
    classifyTargetReliability_competingNormalTargets_spec
      Independent exactCost Normal exactNonnegative source classified
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedTarget, selectedSearchEq, selectedNormal,
      selectedCountLt, selectedApproximatePath, selectedExactPath,
      compare⟩ :=
    approximateDijkstra_exactCost_pathwiseCertified_of_overestimate
      Independent exactCost approximateCost errorCost Normal
      within overestimate exactNonnegative approximateNonnegative source
      bestNormal bestPath
  obtain ⟨bestComparisonCount, bestComparisonExactCost,
      bestComparisonApproximateCost, bestError,
      bestComparisonCountLt, bestComparisonExactPath,
      bestComparisonApproximatePath, bestErrorPath,
      bestComparisonCostLe, selectedLe⟩ :=
    compare bestNormal bestPath
  refine ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    selectedTarget, bestComparisonCount, bestComparisonExactCost,
    bestComparisonApproximateCost, bestError,
    selectedSearchEq, selectedNormal, selectedApproximatePath,
    selectedExactPath, bestComparisonExactPath,
    bestComparisonApproximatePath, bestErrorPath,
    bestComparisonCostLe, selectedLe, ?_⟩
  intro errorBelowMargin
  by_contra different
  have lower := separated selectedNormal selectedExactPath different
  linarith

/-- For a pointwise underestimate, only the selected path's concrete error
sum is needed; no competitor error path remains in the decision rule. -/
theorem competingClassification_underestimatePathwiseCertificate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result) :
    ∃ selectedCount selectedApproximateCost selectedExactCost
        selectedError selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
          some (selectedApproximateCost, selectedTarget) ∧
        Normal selectedTarget ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source selectedTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source selectedTarget ∧
        WeightedTracePath Independent errorCost
          selectedCount selectedError source selectedTarget ∧
        selectedExactCost ≤ result.bestCost + selectedError ∧
        (selectedError < result.margin →
          selectedTarget = result.bestTarget) := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent, secondSpec,
      marginEq, separated, marginNonnegative⟩ :=
    classifyTargetReliability_competingNormalTargets_spec
      Independent exactCost Normal exactNonnegative source classified
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedError, selectedTarget, selectedSearchEq, selectedNormal,
      selectedCountLt, selectedApproximatePath, selectedExactPath,
      selectedErrorPath, compare⟩ :=
    approximateDijkstra_exactCost_pathwiseCertified_of_underestimate
      Independent exactCost approximateCost errorCost Normal
      within underestimate exactNonnegative approximateNonnegative source
      bestNormal bestPath
  obtain ⟨bestComparisonCount, bestComparisonExactCost,
      bestComparisonApproximateCost, bestComparisonCountLt,
      bestComparisonExactPath, bestComparisonApproximatePath,
      bestComparisonCostLe, selectedLe⟩ :=
    compare bestNormal bestPath
  refine ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    selectedError, selectedTarget, selectedSearchEq, selectedNormal,
    selectedApproximatePath, selectedExactPath, selectedErrorPath,
    selectedLe, ?_⟩
  intro errorBelowMargin
  by_contra different
  have lower := separated selectedNormal selectedExactPath different
  linarith

end Sprawlens.PathwiseTargetReliability
