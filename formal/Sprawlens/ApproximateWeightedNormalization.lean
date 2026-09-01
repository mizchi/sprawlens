import Sprawlens.DijkstraInvariant

namespace Sprawlens.ApproximateWeightedNormalization

open AposterioriConfluence
open DijkstraInvariant
open LayoutConfluence
open NonnegativeCostAttainment
open PositiveCostAttainment
open ReachableTraceClass
open SimpleNormalizingSearch

universe u

/-- Uniform error contract between an exact primitive swap cost and an
approximation. Only admissible independent swaps need satisfy the bound. -/
def PrimitiveSwapCostWithin {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    |exactCost before after first second -
      approximateCost before after first second| ≤ epsilon

/-- Non-uniform version of the approximation contract. `errorCost` assigns
an independently checkable budget to each admissible primitive swap. -/
def PrimitiveSwapCostWithinBy {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    |exactCost before after first second -
      approximateCost before after first second| ≤
        errorCost before after first second

/-- Pointwise order between two primitive cost models on admissible swaps. -/
def PrimitiveSwapCostLe {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (lowerCost upperCost :
      List Edit → List Edit → Edit → Edit → ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    lowerCost before after first second ≤
      upperCost before after first second

theorem PrimitiveSwapCostWithinBy.symm
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost) :
    PrimitiveSwapCostWithinBy
      Independent approximateCost exactCost errorCost := by
  intro before after first second independent
  simpa [abs_sub_comm] using
    within before after first second independent

theorem PrimitiveSwapCostWithin.symm
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon) :
    PrimitiveSwapCostWithin
      Independent approximateCost exactCost epsilon := by
  intro before after first second independent
  simpa [abs_sub_comm] using
    within before after first second independent

/-- The same directed graph edge exists under the approximate cost model,
and its scalar cost changes by at most `epsilon`. -/
theorem weightedSwapStep_exists_approximate
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent exactCost
      edgeCost first target) :
    ∃ approximateEdgeCost,
      WeightedSwapStep Independent approximateCost
        approximateEdgeCost first target ∧
      |edgeCost - approximateEdgeCost| ≤ epsilon := by
  cases edge with
  | forward before after left right independent =>
      exact ⟨approximateCost before after left right,
        .forward before after left right independent,
        within before after left right independent⟩
  | backward before after left right independent =>
      exact ⟨approximateCost before after left right,
        .backward before after left right independent,
        within before after left right independent⟩

/-- One exact edge simultaneously transports to the approximate cost graph
and to a graph whose path cost records its local error budget. -/
theorem weightedSwapStep_exists_approximate_with_error
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent exactCost
      edgeCost first target) :
    ∃ approximateEdgeCost edgeError,
      WeightedSwapStep Independent approximateCost
        approximateEdgeCost first target ∧
      WeightedSwapStep Independent errorCost
        edgeError first target ∧
      |edgeCost - approximateEdgeCost| ≤ edgeError := by
  cases edge with
  | forward before after left right independent =>
      exact ⟨approximateCost before after left right,
        errorCost before after left right,
        .forward before after left right independent,
        .forward before after left right independent,
        within before after left right independent⟩
  | backward before after left right independent =>
      exact ⟨approximateCost before after left right,
        errorCost before after left right,
        .backward before after left right independent,
        .backward before after left right independent,
        within before after left right independent⟩

/-- Re-cost an edge from the lower model to the upper model. -/
theorem weightedSwapStep_exists_upper
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (lowerCost upperCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (ordered : PrimitiveSwapCostLe Independent lowerCost upperCost)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent lowerCost
      edgeCost first target) :
    ∃ upperEdgeCost,
      WeightedSwapStep Independent upperCost
        upperEdgeCost first target ∧
      edgeCost ≤ upperEdgeCost := by
  cases edge with
  | forward before after left right independent =>
      exact ⟨upperCost before after left right,
        .forward before after left right independent,
        ordered before after left right independent⟩
  | backward before after left right independent =>
      exact ⟨upperCost before after left right,
        .backward before after left right independent,
        ordered before after left right independent⟩

/-- Re-cost an edge from the upper model to the lower model while retaining
the same lower-before-upper scalar order. -/
theorem weightedSwapStep_exists_lower
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (lowerCost upperCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (ordered : PrimitiveSwapCostLe Independent lowerCost upperCost)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent upperCost
      edgeCost first target) :
    ∃ lowerEdgeCost,
      WeightedSwapStep Independent lowerCost
        lowerEdgeCost first target ∧
      lowerEdgeCost ≤ edgeCost := by
  cases edge with
  | forward before after left right independent =>
      exact ⟨lowerCost before after left right,
        .forward before after left right independent,
        ordered before after left right independent⟩
  | backward before after left right independent =>
      exact ⟨lowerCost before after left right,
        .backward before after left right independent,
        ordered before after left right independent⟩

/-- A path transfers unchanged to the approximate cost model. Its accumulated
cost error grows at most linearly in the number of primitive swaps. -/
theorem weightedTracePath_exists_approximate
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent exactCost
      count pathCost first target) :
    ∃ approximatePathCost,
      WeightedTracePath Independent approximateCost
        count approximatePathCost first target ∧
      |pathCost - approximatePathCost| ≤ (count : ℝ) * epsilon := by
  induction path with
  | refl edits =>
      exact ⟨0, .refl edits, by simp⟩
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨approximateEdgeCost, approximateEdge, edgeBound⟩ :=
        weightedSwapStep_exists_approximate Independent exactCost
          approximateCost epsilon within edge
      obtain ⟨approximateTailCost, approximateRest, tailBound⟩ :=
        inductionHypothesis
      refine ⟨approximateEdgeCost + approximateTailCost,
        .step approximateEdge approximateRest, ?_⟩
      calc
        |edgeCost + tailCost -
            (approximateEdgeCost + approximateTailCost)| =
            |(edgeCost - approximateEdgeCost) +
              (tailCost - approximateTailCost)| := by ring_nf
        _ ≤ |edgeCost - approximateEdgeCost| +
              |tailCost - approximateTailCost| := abs_add_le _ _
        _ ≤ epsilon + (count : ℝ) * epsilon :=
          add_le_add edgeBound tailBound
        _ = ((count + 1 : Nat) : ℝ) * epsilon := by
          push_cast
          ring

/-- Path-sensitive transport. The third path follows exactly the same trace
vertices and accumulates the local error budgets actually used on that path. -/
theorem weightedTracePath_exists_approximate_with_errorPath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent exactCost
      count pathCost first target) :
    ∃ approximatePathCost pathError,
      WeightedTracePath Independent approximateCost
        count approximatePathCost first target ∧
      WeightedTracePath Independent errorCost
        count pathError first target ∧
      |pathCost - approximatePathCost| ≤ pathError := by
  induction path with
  | refl edits =>
      exact ⟨0, 0, .refl edits, .refl edits, by simp⟩
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨approximateEdgeCost, edgeError, approximateEdge,
          errorEdge, edgeBound⟩ :=
        weightedSwapStep_exists_approximate_with_error Independent exactCost
          approximateCost errorCost within edge
      obtain ⟨approximateTailCost, tailError, approximateRest,
          errorRest, tailBound⟩ := inductionHypothesis
      refine ⟨approximateEdgeCost + approximateTailCost,
        edgeError + tailError, .step approximateEdge approximateRest,
        .step errorEdge errorRest, ?_⟩
      calc
        |edgeCost + tailCost -
            (approximateEdgeCost + approximateTailCost)| =
            |(edgeCost - approximateEdgeCost) +
              (tailCost - approximateTailCost)| := by ring_nf
        _ ≤ |edgeCost - approximateEdgeCost| +
              |tailCost - approximateTailCost| := abs_add_le _ _
        _ ≤ edgeError + tailError := add_le_add edgeBound tailBound

/-- Pointwise primitive order lifts to every path, starting from a path in
the lower-cost model. -/
theorem weightedTracePath_exists_upper
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (lowerCost upperCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (ordered : PrimitiveSwapCostLe Independent lowerCost upperCost)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent lowerCost
      count pathCost first target) :
    ∃ upperPathCost,
      WeightedTracePath Independent upperCost
        count upperPathCost first target ∧
      pathCost ≤ upperPathCost := by
  induction path with
  | refl edits => exact ⟨0, .refl edits, le_rfl⟩
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨upperEdgeCost, upperEdge, edgeLe⟩ :=
        weightedSwapStep_exists_upper Independent lowerCost upperCost
          ordered edge
      obtain ⟨upperTailCost, upperRest, tailLe⟩ := inductionHypothesis
      exact ⟨upperEdgeCost + upperTailCost,
        .step upperEdge upperRest, add_le_add edgeLe tailLe⟩

/-- The same path-order lifting, starting from a path in the upper-cost
model and reconstructing its lower-cost counterpart. -/
theorem weightedTracePath_exists_lower
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (lowerCost upperCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (ordered : PrimitiveSwapCostLe Independent lowerCost upperCost)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent upperCost
      count pathCost first target) :
    ∃ lowerPathCost,
      WeightedTracePath Independent lowerCost
        count lowerPathCost first target ∧
      lowerPathCost ≤ pathCost := by
  induction path with
  | refl edits => exact ⟨0, .refl edits, le_rfl⟩
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨lowerEdgeCost, lowerEdge, edgeLe⟩ :=
        weightedSwapStep_exists_lower Independent lowerCost upperCost
          ordered edge
      obtain ⟨lowerTailCost, lowerRest, tailLe⟩ := inductionHypothesis
      exact ⟨lowerEdgeCost + lowerTailCost,
        .step lowerEdge lowerRest, add_le_add edgeLe tailLe⟩

/-- An absolute error bound gives the one-sided upper estimate used below. -/
theorem left_le_right_add_of_abs_sub_le
    {left right error : ℝ}
    (bound : |left - right| ≤ error) :
    left ≤ right + error := by
  have differenceLe : left - right ≤ error :=
    (le_abs_self (left - right)).trans bound
  linarith

/-- Path-sensitive two-sided perturbation rule. If the approximate objective
orders `selected` before `other`, then the exact degradation is bounded by
the sum of the two paths' certified error budgets. -/
theorem exactCost_le_of_approximateOrder
    {selectedExact selectedApproximate selectedError : ℝ}
    {otherExact otherApproximate otherError : ℝ}
    (selectedBound :
      |selectedExact - selectedApproximate| ≤ selectedError)
    (otherBound : |otherExact - otherApproximate| ≤ otherError)
    (approximateOrder : selectedApproximate ≤ otherApproximate) :
    selectedExact ≤ otherExact + selectedError + otherError := by
  have selectedLe := left_le_right_add_of_abs_sub_le selectedBound
  have otherLe : otherApproximate ≤ otherExact + otherError := by
    apply left_le_right_add_of_abs_sub_le
    simpa [abs_sub_comm] using otherBound
  linarith

/-- One-sided scalar rule for an overestimate: the selected exact cost is
already below its approximation, so only the competitor error remains. -/
theorem exactCost_le_of_approximateOrder_overestimate
    {selectedExact selectedApproximate : ℝ}
    {otherExact otherApproximate otherError : ℝ}
    (selectedLe : selectedExact ≤ selectedApproximate)
    (otherBound : |otherExact - otherApproximate| ≤ otherError)
    (approximateOrder : selectedApproximate ≤ otherApproximate) :
    selectedExact ≤ otherExact + otherError := by
  have otherLe : otherApproximate ≤ otherExact + otherError := by
    apply left_le_right_add_of_abs_sub_le
    simpa [abs_sub_comm] using otherBound
  exact selectedLe.trans (approximateOrder.trans otherLe)

/-- One-sided scalar rule for an underestimate: the competitor approximation
is already below its exact cost, so only the selected error remains. -/
theorem exactCost_le_of_approximateOrder_underestimate
    {selectedExact selectedApproximate selectedError : ℝ}
    {otherExact otherApproximate : ℝ}
    (selectedBound :
      |selectedExact - selectedApproximate| ≤ selectedError)
    (otherLe : otherApproximate ≤ otherExact)
    (approximateOrder : selectedApproximate ≤ otherApproximate) :
    selectedExact ≤ otherExact + selectedError := by
  have selectedLe := left_le_right_add_of_abs_sub_le selectedBound
  linarith

/-- Post-hoc target reliability from concrete path budgets. A different
selected target would have to pay the exact separation margin, while the two
certified path perturbations cannot bridge that margin. -/
theorem target_eq_of_approximateOrder_and_pathwiseMargin
    {Target : Type*} {selectedTarget bestTarget : Target}
    {selectedExact selectedApproximate selectedError : ℝ}
    {bestExact bestApproximate bestError margin : ℝ}
    (selectedBound :
      |selectedExact - selectedApproximate| ≤ selectedError)
    (bestBound : |bestExact - bestApproximate| ≤ bestError)
    (approximateOrder : selectedApproximate ≤ bestApproximate)
    (separated : selectedTarget ≠ bestTarget →
      bestExact + margin ≤ selectedExact)
    (marginDominates : selectedError + bestError < margin) :
    selectedTarget = bestTarget := by
  by_contra different
  have nearBest :
      selectedExact ≤ bestExact + selectedError + bestError :=
    exactCost_le_of_approximateOrder selectedBound bestBound
      approximateOrder
  have lower := separated different
  linarith

/-- Pathwise target identity for an overestimate: only the exact best path's
error budget must fit below the target-separation margin. -/
theorem target_eq_of_approximateOrder_overestimate_and_pathwiseMargin
    {Target : Type*} {selectedTarget bestTarget : Target}
    {selectedExact selectedApproximate : ℝ}
    {bestExact bestApproximate bestError margin : ℝ}
    (selectedLe : selectedExact ≤ selectedApproximate)
    (bestBound : |bestExact - bestApproximate| ≤ bestError)
    (approximateOrder : selectedApproximate ≤ bestApproximate)
    (separated : selectedTarget ≠ bestTarget →
      bestExact + margin ≤ selectedExact)
    (marginDominates : bestError < margin) :
    selectedTarget = bestTarget := by
  by_contra different
  have nearBest : selectedExact ≤ bestExact + bestError :=
    exactCost_le_of_approximateOrder_overestimate selectedLe bestBound
      approximateOrder
  have lower := separated different
  linarith

/-- Pathwise target identity for an underestimate: only the selected path's
error budget must fit below the target-separation margin. -/
theorem target_eq_of_approximateOrder_underestimate_and_pathwiseMargin
    {Target : Type*} {selectedTarget bestTarget : Target}
    {selectedExact selectedApproximate selectedError : ℝ}
    {bestExact bestApproximate margin : ℝ}
    (selectedBound :
      |selectedExact - selectedApproximate| ≤ selectedError)
    (bestLe : bestApproximate ≤ bestExact)
    (approximateOrder : selectedApproximate ≤ bestApproximate)
    (separated : selectedTarget ≠ bestTarget →
      bestExact + margin ≤ selectedExact)
    (marginDominates : selectedError < margin) :
    selectedTarget = bestTarget := by
  by_contra different
  have nearBest : selectedExact ≤ bestExact + selectedError :=
    exactCost_le_of_approximateOrder_underestimate selectedBound bestLe
      approximateOrder
  have lower := separated different
  linarith

/-- Proof-carrying, path-sensitive robustness of approximate Dijkstra. The
selected path carries its own accumulated error path. Every exact competitor
can be loop-erased and carries a second error path, and the exact degradation
is bounded by the sum of those two concrete budgets. -/
theorem approximateDijkstra_exactCost_pathwiseCertified
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseExactCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent exactCost
      baseCount baseExactCost source baseTarget) :
    ∃ selectedCount selectedApproximateCost selectedExactCost
        selectedError selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, selectedTarget) ∧
      Normal selectedTarget ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source selectedTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source selectedTarget ∧
      WeightedTracePath Independent errorCost
        selectedCount selectedError source selectedTarget ∧
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        ∃ simpleOtherCount simpleOtherExactCost
            simpleOtherApproximateCost otherError,
          simpleOtherCount <
            (reachableTraceVerticesList Independent source).length ∧
          WeightedTracePath Independent exactCost
            simpleOtherCount simpleOtherExactCost source otherTarget ∧
          WeightedTracePath Independent approximateCost
            simpleOtherCount simpleOtherApproximateCost source otherTarget ∧
          WeightedTracePath Independent errorCost
            simpleOtherCount otherError source otherTarget ∧
          simpleOtherExactCost ≤ otherExactCost ∧
          selectedExactCost ≤
            otherExactCost + selectedError + otherError := by
  obtain ⟨baseApproximateCost, baseError, baseApproximatePath,
      baseErrorPath, baseBound⟩ :=
    weightedTracePath_exists_approximate_with_errorPath Independent exactCost
      approximateCost errorCost within basePath
  obtain ⟨minimumCount, minimumApproximateCost, minimumTarget,
      searchEq, minimumNormal, minimumPath, minimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent approximateCost Normal
      approximateNonneg source baseNormal baseApproximatePath
  obtain ⟨selectedCount, selectedApproximateCost, selectedCountLt,
      selectedApproximatePath, selectedCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent approximateCost approximateNonneg
      (minimumPath.toTraceCertificate Independent approximateCost)
  have minimumCostLe :
      minimumApproximateCost ≤ selectedApproximateCost :=
    minimum minimumNormal selectedApproximatePath
  have selectedCostEq :
      selectedApproximateCost = minimumApproximateCost :=
    le_antisymm selectedCostLe minimumCostLe
  subst selectedApproximateCost
  obtain ⟨selectedExactCost, selectedError, selectedExactPath,
      selectedErrorPath, selectedBoundReverse⟩ :=
    weightedTracePath_exists_approximate_with_errorPath Independent
      approximateCost exactCost errorCost
      (within.symm Independent exactCost approximateCost errorCost)
      selectedApproximatePath
  have selectedBound :
      |selectedExactCost - minimumApproximateCost| ≤ selectedError := by
    simpa [abs_sub_comm] using selectedBoundReverse
  refine ⟨selectedCount, minimumApproximateCost, selectedExactCost,
    selectedError, minimumTarget, searchEq, minimumNormal, selectedCountLt,
    selectedApproximatePath, selectedExactPath, selectedErrorPath, ?_⟩
  intro otherCount otherExactCost otherTarget otherNormal otherPath
  obtain ⟨simpleOtherCount, simpleOtherExactCost, simpleOtherCountLt,
      simpleOtherExactPath, simpleOtherCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent exactCost exactNonneg
      (otherPath.toTraceCertificate Independent exactCost)
  obtain ⟨simpleOtherApproximateCost, otherError,
      simpleOtherApproximatePath, otherErrorPath, otherBound⟩ :=
    weightedTracePath_exists_approximate_with_errorPath Independent exactCost
      approximateCost errorCost within simpleOtherExactPath
  have approximateMinimum :
      minimumApproximateCost ≤ simpleOtherApproximateCost :=
    minimum otherNormal simpleOtherApproximatePath
  have exactLeSimple :
      selectedExactCost ≤
        simpleOtherExactCost + selectedError + otherError :=
    exactCost_le_of_approximateOrder selectedBound otherBound
      approximateMinimum
  refine ⟨simpleOtherCount, simpleOtherExactCost,
    simpleOtherApproximateCost, otherError, simpleOtherCountLt,
    simpleOtherExactPath, simpleOtherApproximatePath, otherErrorPath,
    simpleOtherCostLe, ?_⟩
  linarith

/-- Path-sensitive one-sided guarantee for a pointwise overestimate. The
selected exact path is no more expensive than its approximation, so each
comparison pays only that competitor's concrete accumulated error path. -/
theorem approximateDijkstra_exactCost_pathwiseCertified_of_overestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseExactCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent exactCost
      baseCount baseExactCost source baseTarget) :
    ∃ selectedCount selectedApproximateCost selectedExactCost selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, selectedTarget) ∧
      Normal selectedTarget ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source selectedTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source selectedTarget ∧
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        ∃ simpleOtherCount simpleOtherExactCost
            simpleOtherApproximateCost otherError,
          simpleOtherCount <
            (reachableTraceVerticesList Independent source).length ∧
          WeightedTracePath Independent exactCost
            simpleOtherCount simpleOtherExactCost source otherTarget ∧
          WeightedTracePath Independent approximateCost
            simpleOtherCount simpleOtherApproximateCost source otherTarget ∧
          WeightedTracePath Independent errorCost
            simpleOtherCount otherError source otherTarget ∧
          simpleOtherExactCost ≤ otherExactCost ∧
          selectedExactCost ≤ otherExactCost + otherError := by
  obtain ⟨baseApproximateCost, baseApproximatePath, baseCostLe⟩ :=
    weightedTracePath_exists_upper Independent exactCost approximateCost
      overestimate basePath
  obtain ⟨minimumCount, minimumApproximateCost, minimumTarget,
      searchEq, minimumNormal, minimumPath, minimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent approximateCost Normal
      approximateNonneg source baseNormal baseApproximatePath
  obtain ⟨selectedCount, selectedApproximateCost, selectedCountLt,
      selectedApproximatePath, selectedCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent approximateCost approximateNonneg
      (minimumPath.toTraceCertificate Independent approximateCost)
  have minimumCostLe :
      minimumApproximateCost ≤ selectedApproximateCost :=
    minimum minimumNormal selectedApproximatePath
  have selectedCostEq :
      selectedApproximateCost = minimumApproximateCost :=
    le_antisymm selectedCostLe minimumCostLe
  subst selectedApproximateCost
  obtain ⟨selectedExactCost, selectedExactPath, selectedExactLe⟩ :=
    weightedTracePath_exists_lower Independent exactCost approximateCost
      overestimate selectedApproximatePath
  refine ⟨selectedCount, minimumApproximateCost, selectedExactCost,
    minimumTarget, searchEq, minimumNormal, selectedCountLt,
    selectedApproximatePath, selectedExactPath, ?_⟩
  intro otherCount otherExactCost otherTarget otherNormal otherPath
  obtain ⟨simpleOtherCount, simpleOtherExactCost, simpleOtherCountLt,
      simpleOtherExactPath, simpleOtherCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent exactCost exactNonneg
      (otherPath.toTraceCertificate Independent exactCost)
  obtain ⟨simpleOtherApproximateCost, otherError,
      simpleOtherApproximatePath, otherErrorPath, otherBound⟩ :=
    weightedTracePath_exists_approximate_with_errorPath Independent exactCost
      approximateCost errorCost within simpleOtherExactPath
  have approximateMinimum :
      minimumApproximateCost ≤ simpleOtherApproximateCost :=
    minimum otherNormal simpleOtherApproximatePath
  have exactLeSimple :
      selectedExactCost ≤ simpleOtherExactCost + otherError :=
    exactCost_le_of_approximateOrder_overestimate selectedExactLe
      otherBound approximateMinimum
  refine ⟨simpleOtherCount, simpleOtherExactCost,
    simpleOtherApproximateCost, otherError, simpleOtherCountLt,
    simpleOtherExactPath, simpleOtherApproximatePath, otherErrorPath,
    simpleOtherCostLe, ?_⟩
  linarith

/-- Path-sensitive one-sided guarantee for a pointwise underestimate. Every
competitor approximation is already no larger than its exact cost, so all
comparisons pay only the selected path's concrete accumulated error. -/
theorem approximateDijkstra_exactCost_pathwiseCertified_of_underestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseExactCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent exactCost
      baseCount baseExactCost source baseTarget) :
    ∃ selectedCount selectedApproximateCost selectedExactCost
        selectedError selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, selectedTarget) ∧
      Normal selectedTarget ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source selectedTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source selectedTarget ∧
      WeightedTracePath Independent errorCost
        selectedCount selectedError source selectedTarget ∧
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        ∃ simpleOtherCount simpleOtherExactCost simpleOtherApproximateCost,
          simpleOtherCount <
            (reachableTraceVerticesList Independent source).length ∧
          WeightedTracePath Independent exactCost
            simpleOtherCount simpleOtherExactCost source otherTarget ∧
          WeightedTracePath Independent approximateCost
            simpleOtherCount simpleOtherApproximateCost source otherTarget ∧
          simpleOtherExactCost ≤ otherExactCost ∧
          selectedExactCost ≤ otherExactCost + selectedError := by
  obtain ⟨baseApproximateCost, baseApproximatePath, baseCostLe⟩ :=
    weightedTracePath_exists_lower Independent approximateCost exactCost
      underestimate basePath
  obtain ⟨minimumCount, minimumApproximateCost, minimumTarget,
      searchEq, minimumNormal, minimumPath, minimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent approximateCost Normal
      approximateNonneg source baseNormal baseApproximatePath
  obtain ⟨selectedCount, selectedApproximateCost, selectedCountLt,
      selectedApproximatePath, selectedCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent approximateCost approximateNonneg
      (minimumPath.toTraceCertificate Independent approximateCost)
  have minimumCostLe :
      minimumApproximateCost ≤ selectedApproximateCost :=
    minimum minimumNormal selectedApproximatePath
  have selectedCostEq :
      selectedApproximateCost = minimumApproximateCost :=
    le_antisymm selectedCostLe minimumCostLe
  subst selectedApproximateCost
  obtain ⟨selectedExactCost, selectedError, selectedExactPath,
      selectedErrorPath, selectedBoundReverse⟩ :=
    weightedTracePath_exists_approximate_with_errorPath Independent
      approximateCost exactCost errorCost
      (within.symm Independent exactCost approximateCost errorCost)
      selectedApproximatePath
  have selectedBound :
      |selectedExactCost - minimumApproximateCost| ≤ selectedError := by
    simpa [abs_sub_comm] using selectedBoundReverse
  refine ⟨selectedCount, minimumApproximateCost, selectedExactCost,
    selectedError, minimumTarget, searchEq, minimumNormal, selectedCountLt,
    selectedApproximatePath, selectedExactPath, selectedErrorPath, ?_⟩
  intro otherCount otherExactCost otherTarget otherNormal otherPath
  obtain ⟨simpleOtherCount, simpleOtherExactCost, simpleOtherCountLt,
      simpleOtherExactPath, simpleOtherCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent exactCost exactNonneg
      (otherPath.toTraceCertificate Independent exactCost)
  obtain ⟨simpleOtherApproximateCost, simpleOtherApproximatePath,
      simpleOtherApproximateLe⟩ :=
    weightedTracePath_exists_lower Independent approximateCost exactCost
      underestimate simpleOtherExactPath
  have approximateMinimum :
      minimumApproximateCost ≤ simpleOtherApproximateCost :=
    minimum otherNormal simpleOtherApproximatePath
  have exactLeSimple :
      selectedExactCost ≤ simpleOtherExactCost + selectedError :=
    exactCost_le_of_approximateOrder_underestimate selectedBound
      simpleOtherApproximateLe approximateMinimum
  refine ⟨simpleOtherCount, simpleOtherExactCost,
    simpleOtherApproximateCost, simpleOtherCountLt, simpleOtherExactPath,
    simpleOtherApproximatePath, simpleOtherCostLe, ?_⟩
  linarith

/-- End-to-end robustness of the verified finite Dijkstra search. If exact
and approximate primitive costs differ by at most `epsilon`, and both models
remain nonnegative, the approximate minimizer has exact cost within
`2 * sizeOfTheTraceEquivalenceClass * epsilon` of every exact competitor.

The factor two accounts for perturbing both the selected path and the exact
competitor. Loop erasure makes the result independent of arbitrary zero-cost
detours: both witnesses use fewer edges than the finite reachable-class
bound. -/
theorem approximateDijkstra_exactCost_nearOptimal
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonneg : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseExactCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent exactCost
      baseCount baseExactCost source baseTarget) :
    ∃ selectedCount selectedApproximateCost selectedExactCost selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, selectedTarget) ∧
      Normal selectedTarget ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source selectedTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source selectedTarget ∧
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        selectedExactCost ≤ otherExactCost +
          2 * ((reachableTraceVerticesList Independent source).length : ℝ) *
            epsilon := by
  obtain ⟨baseApproximateCost, baseApproximatePath, baseError⟩ :=
    weightedTracePath_exists_approximate Independent exactCost
      approximateCost epsilon within basePath
  obtain ⟨minimumCount, minimumApproximateCost, minimumTarget,
      searchEq, minimumNormal, minimumPath, minimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent approximateCost Normal
      approximateNonneg source baseNormal baseApproximatePath
  obtain ⟨selectedCount, selectedApproximateCost, selectedCountLt,
      selectedApproximatePath, selectedCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent approximateCost approximateNonneg
      (minimumPath.toTraceCertificate Independent approximateCost)
  have minimumCostLe :
      minimumApproximateCost ≤ selectedApproximateCost :=
    minimum minimumNormal selectedApproximatePath
  have selectedCostEq :
      selectedApproximateCost = minimumApproximateCost :=
    le_antisymm selectedCostLe minimumCostLe
  subst selectedApproximateCost
  obtain ⟨selectedExactCost, selectedExactPath, selectedError⟩ :=
    weightedTracePath_exists_approximate Independent approximateCost
      exactCost epsilon
      (within.symm Independent exactCost approximateCost epsilon)
      selectedApproximatePath
  refine ⟨selectedCount, minimumApproximateCost, selectedExactCost,
    minimumTarget, searchEq, minimumNormal, selectedCountLt,
    selectedApproximatePath, selectedExactPath, ?_⟩
  intro otherCount otherExactCost otherTarget otherNormal otherPath
  obtain ⟨simpleOtherCount, simpleOtherExactCost, simpleOtherCountLt,
      simpleOtherExactPath, simpleOtherCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent exactCost exactNonneg
      (otherPath.toTraceCertificate Independent exactCost)
  obtain ⟨simpleOtherApproximateCost, simpleOtherApproximatePath,
      simpleOtherError⟩ :=
    weightedTracePath_exists_approximate Independent exactCost
      approximateCost epsilon within simpleOtherExactPath
  have approximateMinimum :
      minimumApproximateCost ≤ simpleOtherApproximateCost :=
    minimum otherNormal simpleOtherApproximatePath
  let reachableClassError :=
    ((reachableTraceVerticesList Independent source).length : ℝ) * epsilon
  have selectedCountLe :
      (selectedCount : ℝ) * epsilon ≤ reachableClassError := by
    apply mul_le_mul_of_nonneg_right _ epsilonNonneg
    exact_mod_cast Nat.le_of_lt selectedCountLt
  have otherCountLe :
      (simpleOtherCount : ℝ) * epsilon ≤ reachableClassError := by
    apply mul_le_mul_of_nonneg_right _ epsilonNonneg
    exact_mod_cast Nat.le_of_lt simpleOtherCountLt
  have selectedExactLe :
      selectedExactCost ≤ minimumApproximateCost + reachableClassError := by
    apply left_le_right_add_of_abs_sub_le
    calc
      |selectedExactCost - minimumApproximateCost| =
          |minimumApproximateCost - selectedExactCost| := abs_sub_comm _ _
      _ ≤ (selectedCount : ℝ) * epsilon := selectedError
      _ ≤ reachableClassError := selectedCountLe
  have otherApproximateLe :
      simpleOtherApproximateCost ≤
        simpleOtherExactCost + reachableClassError := by
    apply left_le_right_add_of_abs_sub_le
    calc
      |simpleOtherApproximateCost - simpleOtherExactCost| =
          |simpleOtherExactCost - simpleOtherApproximateCost| :=
            abs_sub_comm _ _
      _ ≤ (simpleOtherCount : ℝ) * epsilon := simpleOtherError
      _ ≤ reachableClassError := otherCountLe
  dsimp [reachableClassError] at selectedExactLe otherApproximateLe ⊢
  linarith

/-- If the approximate model is a pointwise upper bound on exact primitive
costs, only the competitor path's approximation error is paid. -/
theorem approximateDijkstra_exactCost_nearOptimal_of_overestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonneg : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseExactCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent exactCost
      baseCount baseExactCost source baseTarget) :
    ∃ selectedCount selectedApproximateCost selectedExactCost selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, selectedTarget) ∧
      Normal selectedTarget ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source selectedTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source selectedTarget ∧
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        selectedExactCost ≤ otherExactCost +
          ((reachableTraceVerticesList Independent source).length : ℝ) *
            epsilon := by
  obtain ⟨baseApproximateCost, baseApproximatePath, baseCostLe⟩ :=
    weightedTracePath_exists_upper Independent exactCost approximateCost
      overestimate basePath
  obtain ⟨minimumCount, minimumApproximateCost, minimumTarget,
      searchEq, minimumNormal, minimumPath, minimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent approximateCost Normal
      approximateNonneg source baseNormal baseApproximatePath
  obtain ⟨selectedCount, selectedApproximateCost, selectedCountLt,
      selectedApproximatePath, selectedCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent approximateCost approximateNonneg
      (minimumPath.toTraceCertificate Independent approximateCost)
  have minimumCostLe :
      minimumApproximateCost ≤ selectedApproximateCost :=
    minimum minimumNormal selectedApproximatePath
  have selectedCostEq :
      selectedApproximateCost = minimumApproximateCost :=
    le_antisymm selectedCostLe minimumCostLe
  subst selectedApproximateCost
  obtain ⟨selectedExactCost, selectedExactPath, selectedExactLe⟩ :=
    weightedTracePath_exists_lower Independent exactCost approximateCost
      overestimate selectedApproximatePath
  refine ⟨selectedCount, minimumApproximateCost, selectedExactCost,
    minimumTarget, searchEq, minimumNormal, selectedCountLt,
    selectedApproximatePath, selectedExactPath, ?_⟩
  intro otherCount otherExactCost otherTarget otherNormal otherPath
  obtain ⟨simpleOtherCount, simpleOtherExactCost, simpleOtherCountLt,
      simpleOtherExactPath, simpleOtherCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent exactCost exactNonneg
      (otherPath.toTraceCertificate Independent exactCost)
  obtain ⟨simpleOtherApproximateCost, simpleOtherApproximatePath,
      simpleOtherError⟩ :=
    weightedTracePath_exists_approximate Independent exactCost
      approximateCost epsilon within simpleOtherExactPath
  have approximateMinimum :
      minimumApproximateCost ≤ simpleOtherApproximateCost :=
    minimum otherNormal simpleOtherApproximatePath
  let reachableClassError :=
    ((reachableTraceVerticesList Independent source).length : ℝ) * epsilon
  have otherCountLe :
      (simpleOtherCount : ℝ) * epsilon ≤ reachableClassError := by
    apply mul_le_mul_of_nonneg_right _ epsilonNonneg
    exact_mod_cast Nat.le_of_lt simpleOtherCountLt
  have otherApproximateLe :
      simpleOtherApproximateCost ≤
        simpleOtherExactCost + reachableClassError := by
    apply left_le_right_add_of_abs_sub_le
    calc
      |simpleOtherApproximateCost - simpleOtherExactCost| =
          |simpleOtherExactCost - simpleOtherApproximateCost| :=
            abs_sub_comm _ _
      _ ≤ (simpleOtherCount : ℝ) * epsilon := simpleOtherError
      _ ≤ reachableClassError := otherCountLe
  dsimp [reachableClassError] at otherApproximateLe ⊢
  linarith

/-- If the approximate model is a pointwise lower bound on exact primitive
costs, only the selected path's approximation error is paid. -/
theorem approximateDijkstra_exactCost_nearOptimal_of_underestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonneg : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseExactCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent exactCost
      baseCount baseExactCost source baseTarget) :
    ∃ selectedCount selectedApproximateCost selectedExactCost selectedTarget,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, selectedTarget) ∧
      Normal selectedTarget ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source selectedTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source selectedTarget ∧
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        selectedExactCost ≤ otherExactCost +
          ((reachableTraceVerticesList Independent source).length : ℝ) *
            epsilon := by
  obtain ⟨baseApproximateCost, baseApproximatePath, baseCostLe⟩ :=
    weightedTracePath_exists_lower Independent approximateCost exactCost
      underestimate basePath
  obtain ⟨minimumCount, minimumApproximateCost, minimumTarget,
      searchEq, minimumNormal, minimumPath, minimum⟩ :=
    dijkstraSearch_complete_and_optimal Independent approximateCost Normal
      approximateNonneg source baseNormal baseApproximatePath
  obtain ⟨selectedCount, selectedApproximateCost, selectedCountLt,
      selectedApproximatePath, selectedCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent approximateCost approximateNonneg
      (minimumPath.toTraceCertificate Independent approximateCost)
  have minimumCostLe :
      minimumApproximateCost ≤ selectedApproximateCost :=
    minimum minimumNormal selectedApproximatePath
  have selectedCostEq :
      selectedApproximateCost = minimumApproximateCost :=
    le_antisymm selectedCostLe minimumCostLe
  subst selectedApproximateCost
  obtain ⟨selectedExactCost, selectedExactPath, selectedError⟩ :=
    weightedTracePath_exists_approximate Independent approximateCost
      exactCost epsilon
      (within.symm Independent exactCost approximateCost epsilon)
      selectedApproximatePath
  refine ⟨selectedCount, minimumApproximateCost, selectedExactCost,
    minimumTarget, searchEq, minimumNormal, selectedCountLt,
    selectedApproximatePath, selectedExactPath, ?_⟩
  intro otherCount otherExactCost otherTarget otherNormal otherPath
  obtain ⟨simpleOtherCount, simpleOtherExactCost, simpleOtherCountLt,
      simpleOtherExactPath, simpleOtherCostLe⟩ :=
    Sprawlens.ReachableTraceClass.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
      Independent exactCost exactNonneg
      (otherPath.toTraceCertificate Independent exactCost)
  obtain ⟨simpleOtherApproximateCost, simpleOtherApproximatePath,
      simpleOtherApproximateLe⟩ :=
    weightedTracePath_exists_lower Independent approximateCost exactCost
      underestimate simpleOtherExactPath
  have approximateMinimum :
      minimumApproximateCost ≤ simpleOtherApproximateCost :=
    minimum otherNormal simpleOtherApproximatePath
  let reachableClassError :=
    ((reachableTraceVerticesList Independent source).length : ℝ) * epsilon
  have selectedCountLe :
      (selectedCount : ℝ) * epsilon ≤ reachableClassError := by
    apply mul_le_mul_of_nonneg_right _ epsilonNonneg
    exact_mod_cast Nat.le_of_lt selectedCountLt
  have selectedExactLe :
      selectedExactCost ≤ minimumApproximateCost + reachableClassError := by
    apply left_le_right_add_of_abs_sub_le
    calc
      |selectedExactCost - minimumApproximateCost| =
          |minimumApproximateCost - selectedExactCost| := abs_sub_comm _ _
      _ ≤ (selectedCount : ℝ) * epsilon := selectedError
      _ ≤ reachableClassError := selectedCountLe
  dsimp [reachableClassError] at selectedExactLe ⊢
  linarith

/-- If the exact best target is separated from every different acceptable
target by a margin larger than the two-sided perturbation budget, approximate
Dijkstra preserves the target itself, not only the objective value. -/
theorem approximateDijkstra_target_stable_of_margin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon margin : ℝ) (epsilonNonneg : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {bestCount : Nat} {bestExactCost : ℝ} {bestTarget : List Edit}
    (bestNormal : Normal bestTarget)
    (bestPath : WeightedTracePath Independent exactCost
      bestCount bestExactCost source bestTarget)
    (separated :
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        otherTarget ≠ bestTarget →
        bestExactCost + margin ≤ otherExactCost)
    (marginDominates :
      2 * ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source bestTarget := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedTarget, searchEq, selectedNormal, selectedCountLt,
      selectedApproximatePath, selectedExactPath, nearOptimal⟩ :=
    approximateDijkstra_exactCost_nearOptimal Independent exactCost
      approximateCost Normal epsilon epsilonNonneg within exactNonneg
      approximateNonneg source bestNormal bestPath
  have selectedTargetEq : selectedTarget = bestTarget := by
    by_contra different
    have lower := separated selectedNormal selectedExactPath different
    have upper := nearOptimal bestNormal bestPath
    linarith
  subst selectedTarget
  exact ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    searchEq, selectedCountLt, selectedApproximatePath, selectedExactPath⟩

/-- Target identity stability with the one-budget margin for a certified
pointwise overestimate. -/
theorem approximateDijkstra_target_stable_of_overestimate_margin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon margin : ℝ) (epsilonNonneg : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {bestCount : Nat} {bestExactCost : ℝ} {bestTarget : List Edit}
    (bestNormal : Normal bestTarget)
    (bestPath : WeightedTracePath Independent exactCost
      bestCount bestExactCost source bestTarget)
    (separated :
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        otherTarget ≠ bestTarget →
        bestExactCost + margin ≤ otherExactCost)
    (marginDominates :
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source bestTarget := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedTarget, searchEq, selectedNormal, selectedCountLt,
      selectedApproximatePath, selectedExactPath, nearOptimal⟩ :=
    approximateDijkstra_exactCost_nearOptimal_of_overestimate Independent
      exactCost approximateCost Normal epsilon epsilonNonneg within
      overestimate exactNonneg approximateNonneg source bestNormal bestPath
  have selectedTargetEq : selectedTarget = bestTarget := by
    by_contra different
    have lower := separated selectedNormal selectedExactPath different
    have upper := nearOptimal bestNormal bestPath
    linarith
  subst selectedTarget
  exact ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    searchEq, selectedCountLt, selectedApproximatePath, selectedExactPath⟩

/-- Target identity stability with the one-budget margin for a certified
pointwise underestimate. -/
theorem approximateDijkstra_target_stable_of_underestimate_margin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon margin : ℝ) (epsilonNonneg : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonneg : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonneg : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit)
    {bestCount : Nat} {bestExactCost : ℝ} {bestTarget : List Edit}
    (bestNormal : Normal bestTarget)
    (bestPath : WeightedTracePath Independent exactCost
      bestCount bestExactCost source bestTarget)
    (separated :
      ∀ {otherCount otherExactCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent exactCost
          otherCount otherExactCost source otherTarget →
        otherTarget ≠ bestTarget →
        bestExactCost + margin ≤ otherExactCost)
    (marginDominates :
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source bestTarget := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedTarget, searchEq, selectedNormal, selectedCountLt,
      selectedApproximatePath, selectedExactPath, nearOptimal⟩ :=
    approximateDijkstra_exactCost_nearOptimal_of_underestimate Independent
      exactCost approximateCost Normal epsilon epsilonNonneg within
      underestimate exactNonneg approximateNonneg source bestNormal bestPath
  have selectedTargetEq : selectedTarget = bestTarget := by
    by_contra different
    have lower := separated selectedNormal selectedExactPath different
    have upper := nearOptimal bestNormal bestPath
    linarith
  subst selectedTarget
  exact ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    searchEq, selectedCountLt, selectedApproximatePath, selectedExactPath⟩

/-- Load-bearing scalar witness for the factor two in the unconstrained
two-sided theorem. Both exact costs are nonnegative, both approximations have
error at most one, and the approximate objectives tie; nevertheless the
selected exact cost exceeds the competitor by two, so a one-budget theorem
is false without a directional approximation contract. -/
theorem twoSidedError_does_not_imply_oneBudget :
    ∃ selectedExact selectedApproximate otherExact otherApproximate error : ℝ,
      0 ≤ selectedExact ∧ 0 ≤ selectedApproximate ∧
      0 ≤ otherExact ∧ 0 ≤ otherApproximate ∧ 0 ≤ error ∧
      |selectedExact - selectedApproximate| ≤ error ∧
      |otherExact - otherApproximate| ≤ error ∧
      selectedApproximate ≤ otherApproximate ∧
      ¬selectedExact ≤ otherExact + error ∧
      selectedExact = otherExact + 2 * error := by
  exact ⟨2, 1, 0, 1, 1, by norm_num, by norm_num, by norm_num,
    by norm_num, by norm_num, by norm_num, by norm_num, by norm_num,
    by norm_num, by norm_num⟩

/-- At equality, the one-sided overestimate margin condition cannot preserve
target identity: distinct targets may tie approximately while differing by
exactly the competitor error budget. -/
theorem overestimate_marginEquality_allows_distinctTarget :
    ∃ selectedTarget bestTarget : Bool,
      ∃ selectedExact selectedApproximate bestExact bestApproximate
          bestError margin : ℝ,
        selectedTarget ≠ bestTarget ∧
        0 ≤ selectedExact ∧ 0 ≤ selectedApproximate ∧
        0 ≤ bestExact ∧ 0 ≤ bestApproximate ∧ 0 ≤ bestError ∧
        selectedExact ≤ selectedApproximate ∧
        bestExact ≤ bestApproximate ∧
        |bestExact - bestApproximate| ≤ bestError ∧
        selectedApproximate ≤ bestApproximate ∧
        bestExact + margin ≤ selectedExact ∧
        bestError = margin := by
  exact ⟨false, true, 1, 1, 0, 1, 1, 1, by decide,
    by norm_num, by norm_num, by norm_num, by norm_num, by norm_num,
    by norm_num, by norm_num, by norm_num, by norm_num, by norm_num,
    by norm_num⟩

/-- The corresponding equality witness for a pointwise underestimate: the
selected path alone consumes the entire margin, leaving an approximate tie. -/
theorem underestimate_marginEquality_allows_distinctTarget :
    ∃ selectedTarget bestTarget : Bool,
      ∃ selectedExact selectedApproximate bestExact bestApproximate
          selectedError margin : ℝ,
        selectedTarget ≠ bestTarget ∧
        0 ≤ selectedExact ∧ 0 ≤ selectedApproximate ∧
        0 ≤ bestExact ∧ 0 ≤ bestApproximate ∧ 0 ≤ selectedError ∧
        selectedApproximate ≤ selectedExact ∧
        bestApproximate ≤ bestExact ∧
        |selectedExact - selectedApproximate| ≤ selectedError ∧
        selectedApproximate ≤ bestApproximate ∧
        bestExact + margin ≤ selectedExact ∧
        selectedError = margin := by
  exact ⟨false, true, 1, 0, 0, 0, 1, 1, by decide,
    by norm_num, by norm_num, by norm_num, by norm_num, by norm_num,
    by norm_num, by norm_num, by norm_num, by norm_num, by norm_num,
    by norm_num⟩

end Sprawlens.ApproximateWeightedNormalization
