import Sprawlens.TargetRobustnessReport

namespace Sprawlens.ZeroErrorDijkstraInvariance

open ApproximateWeightedNormalization
open DijkstraInvariant
open PositiveCostAttainment
open SimpleNormalizingSearch
open TargetRobustnessReport

universe u

/-- Cost models agree on every admissible primitive edge. Values outside the
declared independence graph are deliberately irrelevant. -/
def PrimitiveSwapCostEqOnAllowed {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    firstCost before after first second =
      secondCost before after first second

theorem primitiveSwapCostEqOnAllowed_of_within_zero
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost 0) :
    PrimitiveSwapCostEqOnAllowed
      Independent exactCost approximateCost := by
  intro before after first second independent
  have bounded := within before after first second independent
  have absEqZero :
      |exactCost before after first second -
        approximateCost before after first second| = 0 :=
    le_antisymm bounded (abs_nonneg _)
  exact sub_eq_zero.mp (abs_eq_zero.mp absEqZero)

theorem weightedSwapStepChoicesListAux_eq_of_costEqOnAllowed
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (before remaining : List Edit) :
    weightedSwapStepChoicesListAux Independent firstCost before remaining =
      weightedSwapStepChoicesListAux
        Independent secondCost before remaining := by
  induction remaining generalizing before with
  | nil => rfl
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => rfl
      | cons second after =>
          by_cases forward : Independent first second
          · have forwardEq := costEq before after first second forward
            by_cases backward : Independent second first
            · have backwardEq := costEq before after second first backward
              simp [weightedSwapStepChoicesListAux, forward, backward,
                forwardEq, backwardEq,
                inductionHypothesis (before ++ [first])]
            · simp [weightedSwapStepChoicesListAux, forward, backward,
                forwardEq, inductionHypothesis (before ++ [first])]
          · by_cases backward : Independent second first
            · have backwardEq := costEq before after second first backward
              simp [weightedSwapStepChoicesListAux, forward, backward,
                backwardEq, inductionHypothesis (before ++ [first])]
            · simp [weightedSwapStepChoicesListAux, forward, backward,
                inductionHypothesis (before ++ [first])]

theorem weightedSwapStepChoicesList_eq_of_costEqOnAllowed
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (current : List Edit) :
    weightedSwapStepChoicesList Independent firstCost current =
      weightedSwapStepChoicesList Independent secondCost current := by
  exact weightedSwapStepChoicesListAux_eq_of_costEqOnAllowed
    Independent firstCost secondCost costEq [] current

theorem relaxWeightedFrontierEntry_eq_of_costEqOnAllowed
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (entry : ℝ × List Edit) :
    relaxWeightedFrontierEntry Independent firstCost entry =
      relaxWeightedFrontierEntry Independent secondCost entry := by
  unfold relaxWeightedFrontierEntry
  rw [weightedSwapStepChoicesList_eq_of_costEqOnAllowed
    Independent firstCost secondCost costEq]

theorem advanceFrontier_eq_of_costEqOnAllowed
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (selected : ℝ × List Edit) (frontier : List (ℝ × List Edit)) :
    advanceFrontier Independent firstCost selected frontier =
      advanceFrontier Independent secondCost selected frontier := by
  unfold advanceFrontier
  rw [relaxWeightedFrontierEntry_eq_of_costEqOnAllowed
    Independent firstCost secondCost costEq]

theorem dijkstraStep_eq_of_costEqOnAllowed
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (state : SearchState Edit) :
    dijkstraStep Independent firstCost Normal state =
      dijkstraStep Independent secondCost Normal state := by
  unfold dijkstraStep
  cases selectedEq : minimumBy? Prod.fst
      (pruneSettledFrontier state.settled state.frontier) with
  | none => simp [selectedEq]
  | some selected =>
      obtain ⟨selectedCost, selectedTarget⟩ := selected
      by_cases normal : Normal selectedTarget
      · simp [selectedEq, normal]
      · simp [selectedEq, normal,
          advanceFrontier_eq_of_costEqOnAllowed
            Independent firstCost secondCost costEq]

theorem dijkstraSearchFuel_eq_of_costEqOnAllowed
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (fuel : Nat) (state : SearchState Edit) :
    dijkstraSearchFuel Independent firstCost Normal fuel state =
      dijkstraSearchFuel Independent secondCost Normal fuel state := by
  induction fuel generalizing state with
  | zero => rfl
  | succ fuel inductionHypothesis =>
      rw [dijkstraSearchFuel, dijkstraSearchFuel,
        dijkstraStep_eq_of_costEqOnAllowed
          Independent firstCost secondCost Normal costEq state]
      cases dijkstraStep Independent secondCost Normal state with
      | exhausted => rfl
      | found cost target => rfl
      | «continue» next => exact inductionHypothesis next

/-- Public verified Dijkstra is extensional in costs on admissible edges. -/
theorem dijkstraSearch_eq_of_costEqOnAllowed
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (firstCost secondCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (costEq : PrimitiveSwapCostEqOnAllowed
      Independent firstCost secondCost)
    (source : List Edit) :
    dijkstraSearch Independent firstCost Normal source =
      dijkstraSearch Independent secondCost Normal source := by
  unfold dijkstraSearch
  exact dijkstraSearchFuel_eq_of_costEqOnAllowed
    Independent firstCost secondCost Normal costEq
    ((ReachableTraceClass.reachableTraceVerticesList
      Independent source).length + 1)
    (initialSearchState source)

/-- Zero primitive error preserves the entire deterministic search result,
including tie-breaking at margin zero. No positivity of the margin is needed. -/
theorem dijkstraSearch_eq_of_within_zero
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost 0)
    (source : List Edit) :
    dijkstraSearch Independent exactCost Normal source =
      dijkstraSearch Independent approximateCost Normal source := by
  exact dijkstraSearch_eq_of_costEqOnAllowed
    Independent exactCost approximateCost Normal
    (primitiveSwapCostEqOnAllowed_of_within_zero
      Independent exactCost approximateCost within)
    source

/-- A report's selected pair is preserved at exact zero primitive error,
even when a competing result has zero margin and therefore zero open radius. -/
theorem targetRobustnessReport_search_eq_of_within_zero
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost 0) :
    dijkstraSearch Independent approximateCost Normal source =
      some (report.bestCost, report.bestTarget) := by
  have exactSearch := targetRobustnessReport?_some_search_eq
    Independent exactCost Normal source returned
  calc
    dijkstraSearch Independent approximateCost Normal source =
        dijkstraSearch Independent exactCost Normal source :=
      (dijkstraSearch_eq_of_within_zero
        Independent exactCost approximateCost Normal within source).symm
    _ = some (report.bestCost, report.bestTarget) := exactSearch

/-- The report consumer is complete at the isolated exact point and open
inside the positive radius: `Permits` means zero error or strict allowance. -/
theorem targetRobustnessReport_target_stable_of_twoSidedPermission
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
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.twoSidedRadius.Permits epsilon) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  rcases permitted with zeroError | allowed
  · subst epsilon
    have approximateSearch :=
      targetRobustnessReport_search_eq_of_within_zero
        Independent exactCost approximateCost Normal source returned within
    obtain ⟨bestNormal, bestCount, bestPath, bestMinimum⟩ :=
      targetRobustnessReport?_some_best_spec
        Independent exactCost Normal exactNonnegative source returned
    obtain ⟨approximatePathCost, approximatePath, pathError⟩ :=
      weightedTracePath_exists_approximate
        Independent exactCost approximateCost 0 within bestPath
    have pathCostEq : approximatePathCost = report.bestCost := by
      have pathErrorZero :
          |report.bestCost - approximatePathCost| ≤ 0 := by
        simpa using pathError
      have absEqZero :
          |report.bestCost - approximatePathCost| = 0 :=
        le_antisymm pathErrorZero (abs_nonneg _)
      exact (sub_eq_zero.mp (abs_eq_zero.mp absEqZero)).symm
    subst approximatePathCost
    exact ⟨bestCount, report.bestCost, bestCount, report.bestCost,
      approximateSearch, approximatePath, bestPath⟩
  · exact targetRobustnessReport_target_stable_of_twoSidedAllowance
      Independent exactCost approximateCost Normal epsilon
      epsilonNonnegative within exactNonnegative approximateNonnegative
      source returned allowed

/-- One-sided overestimate consumer with the exact zero-error point included. -/
theorem targetRobustnessReport_target_stable_of_overestimatePermission
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
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.oneSidedRadius.Permits epsilon) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  rcases permitted with zeroError | allowed
  · apply targetRobustnessReport_target_stable_of_twoSidedPermission
      Independent exactCost approximateCost Normal epsilon
      epsilonNonnegative within exactNonnegative approximateNonnegative
      source returned
    exact .inl zeroError
  · exact targetRobustnessReport_target_stable_of_overestimateAllowance
      Independent exactCost approximateCost Normal epsilon
      epsilonNonnegative within overestimate exactNonnegative
      approximateNonnegative source returned allowed

/-- One-sided underestimate consumer with the exact zero-error point included. -/
theorem targetRobustnessReport_target_stable_of_underestimatePermission
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
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.oneSidedRadius.Permits epsilon) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  rcases permitted with zeroError | allowed
  · apply targetRobustnessReport_target_stable_of_twoSidedPermission
      Independent exactCost approximateCost Normal epsilon
      epsilonNonnegative within exactNonnegative approximateNonnegative
      source returned
    exact .inl zeroError
  · exact targetRobustnessReport_target_stable_of_underestimateAllowance
      Independent exactCost approximateCost Normal epsilon
      epsilonNonnegative within underestimate exactNonnegative
      approximateNonnegative source returned allowed

end Sprawlens.ZeroErrorDijkstraInvariance
