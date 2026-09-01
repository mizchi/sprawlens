import Sprawlens.ZeroErrorDijkstraInvariance

namespace Sprawlens.ComposedApproximateReliability

open ApproximateWeightedNormalization
open DijkstraInvariant
open PositiveCostAttainment
open TargetRobustnessReport
open ZeroErrorDijkstraInvariance

universe u

/-- Two uniform primitive-error contracts compose additively. -/
theorem primitiveSwapCostWithin_add
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost middleCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (firstError secondError : ℝ)
    (firstWithin : PrimitiveSwapCostWithin
      Independent firstCost middleCost firstError)
    (secondWithin : PrimitiveSwapCostWithin
      Independent middleCost lastCost secondError) :
    PrimitiveSwapCostWithin Independent firstCost lastCost
      (firstError + secondError) := by
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
    _ ≤ firstError + secondError := add_le_add firstBound secondBound

/-- Pointwise one-sided primitive order is transitive on admissible edges. -/
theorem primitiveSwapCostLe_trans
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstCost middleCost lastCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (firstLe : PrimitiveSwapCostLe
      Independent firstCost middleCost)
    (secondLe : PrimitiveSwapCostLe
      Independent middleCost lastCost) :
    PrimitiveSwapCostLe Independent firstCost lastCost := by
  intro before after first second independent
  exact (firstLe before after first second independent).trans
    (secondLe before after first second independent)

theorem certifiedErrorRadius_allows_of_le
    (radius : CertifiedErrorRadius)
    {smaller larger : ℝ} (smallerLe : smaller ≤ larger)
    (allowsLarger : radius.Allows larger) :
    radius.Allows smaller := by
  cases radius with
  | unbounded => trivial
  | finite threshold =>
      exact smallerLe.trans_lt allowsLarger

/-- For nonnegative error bounds, permission is downward closed. The
isolated zero-error branch is preserved when a larger permitted bound is 0. -/
theorem certifiedErrorRadius_permits_of_nonnegative_of_le
    (radius : CertifiedErrorRadius)
    {smaller larger : ℝ} (smallerNonnegative : 0 ≤ smaller)
    (smallerLe : smaller ≤ larger)
    (permitsLarger : radius.Permits larger) :
    radius.Permits smaller := by
  rcases permitsLarger with largerZero | allowsLarger
  · left
    linarith
  · by_cases smallerZero : smaller = 0
    · exact .inl smallerZero
    · exact .inr
        (certifiedErrorRadius_allows_of_le
          radius smallerLe allowsLarger)

/-- Two-stage two-sided approximation consumes the sum of its independently
verified primitive budgets. -/
theorem targetRobustnessReport_target_stable_of_twoStageTwoSided
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost intermediateCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstError secondError : ℝ)
    (firstErrorNonnegative : 0 ≤ firstError)
    (secondErrorNonnegative : 0 ≤ secondError)
    (firstWithin : PrimitiveSwapCostWithin
      Independent exactCost intermediateCost firstError)
    (secondWithin : PrimitiveSwapCostWithin
      Independent intermediateCost approximateCost secondError)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.twoSidedRadius.Permits
      (firstError + secondError)) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  apply targetRobustnessReport_target_stable_of_twoSidedPermission
    Independent exactCost approximateCost Normal
    (firstError + secondError)
    (add_nonneg firstErrorNonnegative secondErrorNonnegative)
    (primitiveSwapCostWithin_add Independent
      exactCost intermediateCost approximateCost
      firstError secondError firstWithin secondWithin)
    exactNonnegative approximateNonnegative source returned permitted

/-- Two-stage pointwise overestimation preserves the one-sided factor while
adding the two uniform error budgets. -/
theorem targetRobustnessReport_target_stable_of_twoStageOverestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost intermediateCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstError secondError : ℝ)
    (firstErrorNonnegative : 0 ≤ firstError)
    (secondErrorNonnegative : 0 ≤ secondError)
    (firstWithin : PrimitiveSwapCostWithin
      Independent exactCost intermediateCost firstError)
    (secondWithin : PrimitiveSwapCostWithin
      Independent intermediateCost approximateCost secondError)
    (exactLeIntermediate : PrimitiveSwapCostLe
      Independent exactCost intermediateCost)
    (intermediateLeApproximate : PrimitiveSwapCostLe
      Independent intermediateCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.oneSidedRadius.Permits
      (firstError + secondError)) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  apply targetRobustnessReport_target_stable_of_overestimatePermission
    Independent exactCost approximateCost Normal
    (firstError + secondError)
    (add_nonneg firstErrorNonnegative secondErrorNonnegative)
    (primitiveSwapCostWithin_add Independent
      exactCost intermediateCost approximateCost
      firstError secondError firstWithin secondWithin)
    (primitiveSwapCostLe_trans Independent
      exactCost intermediateCost approximateCost
      exactLeIntermediate intermediateLeApproximate)
    exactNonnegative approximateNonnegative source returned permitted

/-- Two-stage pointwise underestimation is the reversed order chain with the
same additive error budget. -/
theorem targetRobustnessReport_target_stable_of_twoStageUnderestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost intermediateCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (firstError secondError : ℝ)
    (firstErrorNonnegative : 0 ≤ firstError)
    (secondErrorNonnegative : 0 ≤ secondError)
    (firstWithin : PrimitiveSwapCostWithin
      Independent exactCost intermediateCost firstError)
    (secondWithin : PrimitiveSwapCostWithin
      Independent intermediateCost approximateCost secondError)
    (intermediateLeExact : PrimitiveSwapCostLe
      Independent intermediateCost exactCost)
    (approximateLeIntermediate : PrimitiveSwapCostLe
      Independent approximateCost intermediateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (permitted : report.oneSidedRadius.Permits
      (firstError + secondError)) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  apply targetRobustnessReport_target_stable_of_underestimatePermission
    Independent exactCost approximateCost Normal
    (firstError + secondError)
    (add_nonneg firstErrorNonnegative secondErrorNonnegative)
    (primitiveSwapCostWithin_add Independent
      exactCost intermediateCost approximateCost
      firstError secondError firstWithin secondWithin)
    (primitiveSwapCostLe_trans Independent
      approximateCost intermediateCost exactCost
      approximateLeIntermediate intermediateLeExact)
    exactNonnegative approximateNonnegative source returned permitted

end Sprawlens.ComposedApproximateReliability
