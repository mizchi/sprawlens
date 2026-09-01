import Sprawlens.ComposedApproximateReliability

namespace Sprawlens.FiniteApproximationChain

open ApproximateWeightedNormalization
open ComposedApproximateReliability
open DijkstraInvariant
open PositiveCostAttainment
open TargetRobustnessReport
open ZeroErrorDijkstraInvariance

universe u

/-- A finite sequence of independently verified primitive approximations.
The real index is the exact sum of all nonnegative stage budgets. -/
inductive PrimitiveSwapCostWithinChain {Edit : Type u}
    (Independent : Edit → Edit → Prop) :
    (List Edit → List Edit → Edit → Edit → ℝ) →
    (List Edit → List Edit → Edit → Edit → ℝ) → ℝ → Prop where
  | refl (cost : List Edit → List Edit → Edit → Edit → ℝ) :
      PrimitiveSwapCostWithinChain Independent cost cost 0
  | step
      {firstCost middleCost lastCost :
        List Edit → List Edit → Edit → Edit → ℝ}
      {headError tailError : ℝ}
      (headErrorNonnegative : 0 ≤ headError)
      (headWithin : PrimitiveSwapCostWithin
        Independent firstCost middleCost headError)
      (tail : PrimitiveSwapCostWithinChain
        Independent middleCost lastCost tailError) :
      PrimitiveSwapCostWithinChain Independent firstCost lastCost
        (headError + tailError)

theorem PrimitiveSwapCostWithinChain.total_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {firstCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {totalError : ℝ}
    (chain : PrimitiveSwapCostWithinChain
      Independent firstCost lastCost totalError) :
    0 ≤ totalError := by
  induction chain with
  | refl cost => norm_num
  | step headErrorNonnegative headWithin tail inductionHypothesis =>
      exact add_nonneg headErrorNonnegative inductionHypothesis

/-- Flatten any finite chain to one endpoint error contract. -/
theorem PrimitiveSwapCostWithinChain.toWithin
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {firstCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {totalError : ℝ}
    (chain : PrimitiveSwapCostWithinChain
      Independent firstCost lastCost totalError) :
    PrimitiveSwapCostWithin Independent firstCost lastCost totalError := by
  induction chain with
  | refl cost =>
      intro before after first second independent
      simp
  | @step firstCost middleCost lastCost headError tailError
      headErrorNonnegative headWithin tail inductionHypothesis =>
      exact primitiveSwapCostWithin_add
        Independent firstCost middleCost lastCost
        headError tailError headWithin inductionHypothesis

/-- Concatenating two chains adds their accumulated budgets. -/
theorem PrimitiveSwapCostWithinChain.trans
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {firstCost middleCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ}
    {firstError secondError : ℝ}
    (first : PrimitiveSwapCostWithinChain
      Independent firstCost middleCost firstError)
    (second : PrimitiveSwapCostWithinChain
      Independent middleCost lastCost secondError) :
    PrimitiveSwapCostWithinChain Independent firstCost lastCost
      (firstError + secondError) := by
  induction first generalizing lastCost secondError with
  | refl cost => simpa using second
  | @step firstCost nextCost middleCost headError tailError
      headErrorNonnegative headWithin tail inductionHypothesis =>
      simpa [add_assoc] using
        (PrimitiveSwapCostWithinChain.step
          headErrorNonnegative headWithin
          (inductionHypothesis second))

/-- A chain with total budget zero preserves the entire deterministic search
result, even if it contains multiple individually verified stages. -/
theorem dijkstraSearch_eq_of_zeroErrorChain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    {totalError : ℝ}
    (chain : PrimitiveSwapCostWithinChain
      Independent exactCost approximateCost totalError)
    (totalErrorZero : totalError = 0)
    (source : List Edit) :
    dijkstraSearch Independent exactCost Normal source =
      dijkstraSearch Independent approximateCost Normal source := by
  have within := chain.toWithin Independent
  rw [totalErrorZero] at within
  exact dijkstraSearch_eq_of_within_zero
    Independent exactCost approximateCost Normal within source

/-- Arbitrarily many two-sided approximation stages consume only their
verified total chain budget. -/
theorem targetRobustnessReport_target_stable_of_finiteTwoSidedChain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    {totalError : ℝ}
    (chain : PrimitiveSwapCostWithinChain
      Independent exactCost approximateCost totalError)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.twoSidedRadius.Permits totalError) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  exact targetRobustnessReport_target_stable_of_twoSidedPermission
    Independent exactCost approximateCost Normal totalError
    (chain.total_nonnegative Independent) (chain.toWithin Independent)
    exactNonnegative approximateNonnegative source returned permitted

/-- A finite chain whose endpoint order is an overestimate uses the larger
one-sided report radius. Stage-local orders can be composed separately. -/
theorem targetRobustnessReport_target_stable_of_finiteOverestimateChain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    {totalError : ℝ}
    (chain : PrimitiveSwapCostWithinChain
      Independent exactCost approximateCost totalError)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
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
  exact targetRobustnessReport_target_stable_of_overestimatePermission
    Independent exactCost approximateCost Normal totalError
    (chain.total_nonnegative Independent) (chain.toWithin Independent)
    overestimate exactNonnegative approximateNonnegative
    source returned permitted

/-- Endpoint underestimate specialization for an arbitrary finite chain. -/
theorem targetRobustnessReport_target_stable_of_finiteUnderestimateChain
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    {totalError : ℝ}
    (chain : PrimitiveSwapCostWithinChain
      Independent exactCost approximateCost totalError)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
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
  exact targetRobustnessReport_target_stable_of_underestimatePermission
    Independent exactCost approximateCost Normal totalError
    (chain.total_nonnegative Independent) (chain.toWithin Independent)
    underestimate exactNonnegative approximateNonnegative
    source returned permitted

end Sprawlens.FiniteApproximationChain
