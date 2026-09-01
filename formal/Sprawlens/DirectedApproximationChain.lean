import Sprawlens.FiniteApproximationChain

namespace Sprawlens.DirectedApproximationChain

open ApproximateWeightedNormalization
open ComposedApproximateReliability
open DijkstraInvariant
open FiniteApproximationChain
open PositiveCostAttainment
open TargetRobustnessReport
open ZeroErrorDijkstraInvariance

universe u

inductive ApproximationDirection where
  | overestimate
  | underestimate

/-- Stage order viewed from the exact-to-approximate direction. -/
def PrimitiveSwapCostDirectedLe {Edit : Type u}
    (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ) : Prop :=
  match direction with
  | .overestimate =>
      PrimitiveSwapCostLe Independent exactCost approximateCost
  | .underestimate =>
      PrimitiveSwapCostLe Independent approximateCost exactCost

/-- A finite approximation chain whose every stage has the same pointwise
direction as well as a nonnegative uniform error certificate. -/
inductive PrimitiveSwapCostDirectedChain {Edit : Type u}
    (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop) :
    (List Edit → List Edit → Edit → Edit → ℝ) →
    (List Edit → List Edit → Edit → Edit → ℝ) → ℝ → Prop where
  | refl (cost : List Edit → List Edit → Edit → Edit → ℝ) :
      PrimitiveSwapCostDirectedChain direction Independent cost cost 0
  | step
      {firstCost middleCost lastCost :
        List Edit → List Edit → Edit → Edit → ℝ}
      {headError tailError : ℝ}
      (headErrorNonnegative : 0 ≤ headError)
      (headWithin : PrimitiveSwapCostWithin
        Independent firstCost middleCost headError)
      (headDirected : PrimitiveSwapCostDirectedLe
        direction Independent firstCost middleCost)
      (tail : PrimitiveSwapCostDirectedChain
        direction Independent middleCost lastCost tailError) :
      PrimitiveSwapCostDirectedChain direction Independent
        firstCost lastCost (headError + tailError)

/-- Forget stage directions while retaining the exact accumulated budget. -/
theorem PrimitiveSwapCostDirectedChain.toWithinChain
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {totalError : ℝ}
    (chain : PrimitiveSwapCostDirectedChain
      direction Independent firstCost lastCost totalError) :
    PrimitiveSwapCostWithinChain
      Independent firstCost lastCost totalError := by
  induction chain with
  | refl cost => exact .refl cost
  | step headErrorNonnegative headWithin headDirected tail
      inductionHypothesis =>
      exact .step headErrorNonnegative headWithin inductionHypothesis

theorem PrimitiveSwapCostDirectedChain.total_nonnegative
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {totalError : ℝ}
    (chain : PrimitiveSwapCostDirectedChain
      direction Independent firstCost lastCost totalError) :
    0 ≤ totalError :=
  (chain.toWithinChain direction Independent).total_nonnegative Independent

theorem PrimitiveSwapCostDirectedChain.toWithin
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {totalError : ℝ}
    (chain : PrimitiveSwapCostDirectedChain
      direction Independent firstCost lastCost totalError) :
    PrimitiveSwapCostWithin Independent firstCost lastCost totalError :=
  (chain.toWithinChain direction Independent).toWithin Independent

/-- Stage-local one-sided orders compose to the same endpoint direction. -/
theorem PrimitiveSwapCostDirectedChain.endpointOrder
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {totalError : ℝ}
    (chain : PrimitiveSwapCostDirectedChain
      direction Independent firstCost lastCost totalError) :
    PrimitiveSwapCostDirectedLe
      direction Independent firstCost lastCost := by
  induction chain with
  | refl cost =>
      cases direction <;>
        simp [PrimitiveSwapCostDirectedLe, PrimitiveSwapCostLe]
  | @step firstCost middleCost lastCost headError tailError
      headErrorNonnegative headWithin headDirected tail inductionHypothesis =>
      cases direction with
      | overestimate =>
          exact primitiveSwapCostLe_trans
            Independent firstCost middleCost lastCost
            headDirected inductionHypothesis
      | underestimate =>
          exact primitiveSwapCostLe_trans
            Independent lastCost middleCost firstCost
            inductionHypothesis headDirected

/-- Concatenation preserves the common direction and adds total budgets. -/
theorem PrimitiveSwapCostDirectedChain.trans
    {Edit : Type u} (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop)
    {firstCost middleCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {firstError secondError : ℝ}
    (first : PrimitiveSwapCostDirectedChain
      direction Independent firstCost middleCost firstError)
    (second : PrimitiveSwapCostDirectedChain
      direction Independent middleCost lastCost secondError) :
    PrimitiveSwapCostDirectedChain direction Independent
      firstCost lastCost (firstError + secondError) := by
  induction first generalizing lastCost secondError with
  | refl cost => simpa using second
  | @step firstCost nextCost middleCost headError tailError
      headErrorNonnegative headWithin headDirected tail
      inductionHypothesis =>
      simpa [add_assoc] using
        (PrimitiveSwapCostDirectedChain.step
          headErrorNonnegative headWithin headDirected
          (inductionHypothesis second))

/-- One theorem consumes either a fully overestimating or fully
underestimating finite chain and selects the corresponding one-sided rule. -/
theorem targetRobustnessReport_target_stable_of_directedFiniteChain
    {Edit : Type u} [DecidableEq Edit]
    (direction : ApproximationDirection)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    {totalError : ℝ}
    (chain : PrimitiveSwapCostDirectedChain direction Independent
      exactCost approximateCost totalError)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.oneSidedRadius.Permits totalError) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  cases direction with
  | overestimate =>
      exact targetRobustnessReport_target_stable_of_finiteOverestimateChain
        Independent exactCost approximateCost Normal
        (chain.toWithinChain .overestimate Independent)
        (chain.endpointOrder .overestimate Independent)
        exactNonnegative approximateNonnegative source returned permitted
  | underestimate =>
      exact targetRobustnessReport_target_stable_of_finiteUnderestimateChain
        Independent exactCost approximateCost Normal
        (chain.toWithinChain .underestimate Independent)
        (chain.endpointOrder .underestimate Independent)
        exactNonnegative approximateNonnegative source returned permitted

end Sprawlens.DirectedApproximationChain
