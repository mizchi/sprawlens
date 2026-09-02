import Sprawlens.PathwiseTargetReliability

namespace Sprawlens.PathwiseApproximationChain

open ApproximateWeightedNormalization
open ComposedApproximateReliability
open DijkstraInvariant
open DirectedApproximationChain
open NormalTargetMargin
open PathwiseTargetReliability
open PositiveCostAttainment
open ReachableTraceClass
open TargetReliabilityClassification

universe u

/-- The zero local-error function used by the reflexive chain. -/
def zeroPrimitiveErrorCost {Edit : Type u} :
    List Edit → List Edit → Edit → Edit → ℝ :=
  fun _ _ _ _ => 0

theorem addPrimitiveErrorCost_zero_left
    {Edit : Type u}
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ) :
    addPrimitiveErrorCost zeroPrimitiveErrorCost errorCost = errorCost := by
  funext before after first second
  simp [addPrimitiveErrorCost, zeroPrimitiveErrorCost]

theorem addPrimitiveErrorCost_assoc
    {Edit : Type u}
    (firstError secondError thirdError :
      List Edit → List Edit → Edit → Edit → ℝ) :
    addPrimitiveErrorCost
        (addPrimitiveErrorCost firstError secondError) thirdError =
      addPrimitiveErrorCost firstError
        (addPrimitiveErrorCost secondError thirdError) := by
  funext before after first second
  simp [addPrimitiveErrorCost, add_assoc]

/-- A finite approximation pipeline whose index retains the pointwise sum of
all stage-local, non-uniform primitive error functions. -/
inductive PrimitiveSwapCostWithinByChain {Edit : Type u}
    (Independent : Edit → Edit → Prop) :
    (List Edit → List Edit → Edit → Edit → ℝ) →
    (List Edit → List Edit → Edit → Edit → ℝ) →
    (List Edit → List Edit → Edit → Edit → ℝ) → Prop where
  | refl (cost : List Edit → List Edit → Edit → Edit → ℝ) :
      PrimitiveSwapCostWithinByChain Independent cost cost
        zeroPrimitiveErrorCost
  | step
      {firstCost middleCost lastCost
          headError tailError :
        List Edit → List Edit → Edit → Edit → ℝ}
      (headWithin : PrimitiveSwapCostWithinBy
        Independent firstCost middleCost headError)
      (tail : PrimitiveSwapCostWithinByChain
        Independent middleCost lastCost tailError) :
      PrimitiveSwapCostWithinByChain Independent firstCost lastCost
        (addPrimitiveErrorCost headError tailError)

/-- Every finite pipeline flattens to its endpoint pointwise error
contract. -/
theorem PrimitiveSwapCostWithinByChain.toWithinBy
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {firstCost lastCost totalError :
      List Edit → List Edit → Edit → Edit → ℝ}
    (chain : PrimitiveSwapCostWithinByChain
      Independent firstCost lastCost totalError) :
    PrimitiveSwapCostWithinBy Independent firstCost lastCost totalError := by
  induction chain with
  | refl cost =>
      intro before after first second independent
      simp [zeroPrimitiveErrorCost]
  | step headWithin tail inductionHypothesis =>
      exact primitiveSwapCostWithinBy_add
        Independent _ _ _ _ _ headWithin inductionHypothesis

/-- Concatenating two non-uniform pipelines pointwise-adds their accumulated
error functions. -/
theorem PrimitiveSwapCostWithinByChain.trans
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {firstCost middleCost lastCost firstError secondError :
      List Edit → List Edit → Edit → Edit → ℝ}
    (first : PrimitiveSwapCostWithinByChain
      Independent firstCost middleCost firstError)
    (second : PrimitiveSwapCostWithinByChain
      Independent middleCost lastCost secondError) :
    PrimitiveSwapCostWithinByChain Independent firstCost lastCost
      (addPrimitiveErrorCost firstError secondError) := by
  induction first generalizing lastCost secondError with
  | refl cost =>
      rw [addPrimitiveErrorCost_zero_left]
      exact second
  | @step firstCost nextCost middleCost headError tailError
      headWithin tail inductionHypothesis =>
      rw [addPrimitiveErrorCost_assoc]
      exact PrimitiveSwapCostWithinByChain.step headWithin
        (inductionHypothesis second)

/-- An arbitrary finite non-uniform approximation pipeline feeds the same
instance-specific target certificate as a directly verified endpoint pair. -/
theorem competingClassification_twoSidedPathwiseCertificate_of_chain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost totalErrorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (chain : PrimitiveSwapCostWithinByChain Independent
      exactCost approximateCost totalErrorCost)
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
        selectedCount <
          (reachableTraceVerticesList Independent source).length ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source selectedTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source selectedTarget ∧
        WeightedTracePath Independent totalErrorCost
          selectedCount selectedError source selectedTarget ∧
        WeightedTracePath Independent exactCost
          bestComparisonCount bestComparisonExactCost
          source result.bestTarget ∧
        WeightedTracePath Independent approximateCost
          bestComparisonCount bestComparisonApproximateCost
          source result.bestTarget ∧
        WeightedTracePath Independent totalErrorCost
          bestComparisonCount bestError source result.bestTarget ∧
        bestComparisonCount <
          (reachableTraceVerticesList Independent source).length ∧
        bestComparisonExactCost ≤ result.bestCost ∧
        selectedExactCost ≤
          result.bestCost + selectedError + bestError ∧
        (selectedError + bestError < result.margin →
          selectedTarget = result.bestTarget) := by
  exact competingClassification_twoSidedPathwiseCertificate
    Independent exactCost approximateCost totalErrorCost Normal
    (chain.toWithinBy Independent) exactNonnegative approximateNonnegative
    source classified

/-- A non-uniform finite approximation chain whose every stage has the same
pointwise direction. The accumulated error remains an edge-local function. -/
inductive PrimitiveSwapCostDirectedByChain {Edit : Type u}
    (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop) :
    (List Edit → List Edit → Edit → Edit → ℝ) →
    (List Edit → List Edit → Edit → Edit → ℝ) →
    (List Edit → List Edit → Edit → Edit → ℝ) → Prop where
  | refl (cost : List Edit → List Edit → Edit → Edit → ℝ) :
      PrimitiveSwapCostDirectedByChain direction Independent cost cost
        zeroPrimitiveErrorCost
  | step
      {firstCost middleCost lastCost
          headError tailError :
        List Edit → List Edit → Edit → Edit → ℝ}
      (headWithin : PrimitiveSwapCostWithinBy
        Independent firstCost middleCost headError)
      (headDirected : PrimitiveSwapCostDirectedLe
        direction Independent firstCost middleCost)
      (tail : PrimitiveSwapCostDirectedByChain direction
        Independent middleCost lastCost tailError) :
      PrimitiveSwapCostDirectedByChain direction Independent
        firstCost lastCost (addPrimitiveErrorCost headError tailError)

theorem PrimitiveSwapCostDirectedByChain.toWithinByChain
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost totalError :
      List Edit → List Edit → Edit → Edit → ℝ}
    (chain : PrimitiveSwapCostDirectedByChain direction Independent
      firstCost lastCost totalError) :
    PrimitiveSwapCostWithinByChain Independent
      firstCost lastCost totalError := by
  induction chain with
  | refl cost => exact .refl cost
  | step headWithin headDirected tail inductionHypothesis =>
      exact .step headWithin inductionHypothesis

theorem PrimitiveSwapCostDirectedByChain.toWithinBy
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost totalError :
      List Edit → List Edit → Edit → Edit → ℝ}
    (chain : PrimitiveSwapCostDirectedByChain direction Independent
      firstCost lastCost totalError) :
    PrimitiveSwapCostWithinBy Independent
      firstCost lastCost totalError :=
  (chain.toWithinByChain direction Independent).toWithinBy Independent

/-- Stage-local directional orders compose to the endpoint order. -/
theorem PrimitiveSwapCostDirectedByChain.endpointOrder
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost totalError :
      List Edit → List Edit → Edit → Edit → ℝ}
    (chain : PrimitiveSwapCostDirectedByChain direction Independent
      firstCost lastCost totalError) :
    PrimitiveSwapCostDirectedLe direction Independent
      firstCost lastCost := by
  induction chain with
  | refl cost =>
      cases direction <;>
        simp [PrimitiveSwapCostDirectedLe, PrimitiveSwapCostLe]
  | @step firstCost middleCost lastCost headError tailError
      headWithin headDirected tail inductionHypothesis =>
      cases direction with
      | overestimate =>
          exact primitiveSwapCostLe_trans
            Independent firstCost middleCost lastCost
            headDirected inductionHypothesis
      | underestimate =>
          exact primitiveSwapCostLe_trans
            Independent lastCost middleCost firstCost
            inductionHypothesis headDirected

/-- Concatenation retains both the common direction and the pointwise sum of
all stage-local error functions. -/
theorem PrimitiveSwapCostDirectedByChain.trans
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost middleCost lastCost firstError secondError :
      List Edit → List Edit → Edit → Edit → ℝ}
    (first : PrimitiveSwapCostDirectedByChain direction Independent
      firstCost middleCost firstError)
    (second : PrimitiveSwapCostDirectedByChain direction Independent
      middleCost lastCost secondError) :
    PrimitiveSwapCostDirectedByChain direction Independent
      firstCost lastCost
        (addPrimitiveErrorCost firstError secondError) := by
  induction first generalizing lastCost secondError with
  | refl cost =>
      rw [addPrimitiveErrorCost_zero_left]
      exact second
  | @step firstCost nextCost middleCost headError tailError
      headWithin headDirected tail inductionHypothesis =>
      rw [addPrimitiveErrorCost_assoc]
      exact PrimitiveSwapCostDirectedByChain.step
        headWithin headDirected (inductionHypothesis second)

/-- A fully overestimating non-uniform pipeline needs only the accumulated
error on the exact-best comparison path. -/
theorem competingClassification_overestimatePathwiseCertificate_of_chain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost totalErrorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (chain : PrimitiveSwapCostDirectedByChain .overestimate Independent
      exactCost approximateCost totalErrorCost)
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
        selectedCount <
          (reachableTraceVerticesList Independent source).length ∧
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
        WeightedTracePath Independent totalErrorCost
          bestComparisonCount bestError source result.bestTarget ∧
        bestComparisonCount <
          (reachableTraceVerticesList Independent source).length ∧
        bestComparisonExactCost ≤ result.bestCost ∧
        selectedExactCost ≤ result.bestCost + bestError ∧
        (bestError < result.margin →
          selectedTarget = result.bestTarget) := by
  exact competingClassification_overestimatePathwiseCertificate
    Independent exactCost approximateCost totalErrorCost Normal
    (chain.toWithinBy .overestimate Independent)
    (chain.endpointOrder .overestimate Independent)
    exactNonnegative approximateNonnegative source classified

/-- A fully underestimating non-uniform pipeline needs only the accumulated
error on the path selected by the approximate search. -/
theorem competingClassification_underestimatePathwiseCertificate_of_chain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost totalErrorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (chain : PrimitiveSwapCostDirectedByChain .underestimate Independent
      exactCost approximateCost totalErrorCost)
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
        selectedCount <
          (reachableTraceVerticesList Independent source).length ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source selectedTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source selectedTarget ∧
        WeightedTracePath Independent totalErrorCost
          selectedCount selectedError source selectedTarget ∧
        selectedExactCost ≤ result.bestCost + selectedError ∧
        (selectedError < result.margin →
          selectedTarget = result.bestTarget) := by
  exact competingClassification_underestimatePathwiseCertificate
    Independent exactCost approximateCost totalErrorCost Normal
    (chain.toWithinBy .underestimate Independent)
    (chain.endpointOrder .underestimate Independent)
    exactNonnegative approximateNonnegative source classified

end Sprawlens.PathwiseApproximationChain
