import Sprawlens.FixedPointQuantization

namespace Sprawlens.FixedPointScaleSelection

open FixedPointEncodedCost
open FixedPointQuantization
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- Any finite nonnegative slack budget can be made smaller than a positive
margin gap by choosing a sufficiently large integer scale. -/
theorem exists_scale_mul_quantum_lt
    {budget gap : ℝ} (budgetNonnegative : 0 ≤ budget)
    (gapPositive : 0 < gap) :
    ∃ scale : PositiveScale, budget * quantum scale < gap := by
  obtain ⟨denominator, denominatorLarge⟩ :=
    exists_nat_gt (budget / gap)
  have ratioNonnegative : 0 ≤ budget / gap :=
    div_nonneg budgetNonnegative gapPositive.le
  have denominatorPositive : 0 < denominator := by
    exact_mod_cast (lt_of_le_of_lt ratioNonnegative denominatorLarge)
  let scale : PositiveScale := {
    denominator
    positive := denominatorPositive
  }
  refine ⟨scale, ?_⟩
  have denominatorRealPositive : 0 < (denominator : ℝ) := by
    exact_mod_cast denominatorPositive
  have budgetLt : budget < gap * (denominator : ℝ) := by
    have := (div_lt_iff₀ gapPositive).mp denominatorLarge
    simpa [mul_comm] using this
  rw [quantum, show scale.denominator = denominator from rfl, mul_one_div]
  exact (div_lt_iff₀ denominatorRealPositive).2 budgetLt

/-- Every strictly-below-margin real path regains certification at some finite
upward-quantization scale. -/
theorem WeightedTracePath.exists_scale_quantizedUp_below_margin
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {count : Nat} {pathCost margin : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent cost
      count pathCost source target)
    (belowMargin : pathCost < margin) :
    ∃ scale : PositiveScale,
      ∃ quantizedPathCost,
        WeightedTracePath Independent (quantizedUpCost scale cost)
          count quantizedPathCost source target ∧
        pathCost ≤ quantizedPathCost ∧
        quantizedPathCost < margin := by
  have gapPositive : 0 < margin - pathCost := sub_pos.mpr belowMargin
  obtain ⟨scale, slackBelow⟩ := exists_scale_mul_quantum_lt
    (show 0 ≤ (count : ℝ) by positivity) gapPositive
  obtain ⟨quantizedPathCost, quantizedPath, lower, upper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      scale Independent cost nonnegative path
  refine ⟨scale, quantizedPathCost, quantizedPath, lower, ?_⟩
  calc
    quantizedPathCost ≤ pathCost + (count : ℝ) * quantum scale := upper
    _ < margin := by linarith

theorem exists_scale_overestimateReport_certified
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {count : Nat} {comparisonError margin : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (comparisonPath : WeightedTracePath Independent cost
      count comparisonError source bestTarget)
    (actualCertified : comparisonError < margin) :
    ∃ scale : PositiveScale,
      ∃ quantizedComparisonError,
        WeightedTracePath Independent (quantizedUpCost scale cost)
          count quantizedComparisonError source bestTarget ∧
        (overestimateReport selectedTarget bestTarget margin
          quantizedComparisonError).verdict = .certifiedStable := by
  obtain ⟨scale, quantizedComparisonError, quantizedPath, lower,
      quantizedBelow⟩ :=
    Sprawlens.FixedPointScaleSelection.WeightedTracePath.exists_scale_quantizedUp_below_margin
      Independent cost nonnegative comparisonPath actualCertified
  exact ⟨scale, quantizedComparisonError, quantizedPath,
    (overestimateReport_certified_iff selectedTarget bestTarget margin
      quantizedComparisonError).mpr quantizedBelow⟩

theorem exists_scale_underestimateReport_certified
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {count : Nat} {selectedError margin : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent cost
      count selectedError source selectedTarget)
    (actualCertified : selectedError < margin) :
    ∃ scale : PositiveScale,
      ∃ quantizedSelectedError,
        WeightedTracePath Independent (quantizedUpCost scale cost)
          count quantizedSelectedError source selectedTarget ∧
        (underestimateReport selectedTarget bestTarget margin
          quantizedSelectedError).verdict = .certifiedStable := by
  obtain ⟨scale, quantizedSelectedError, quantizedPath, lower,
      quantizedBelow⟩ :=
    Sprawlens.FixedPointScaleSelection.WeightedTracePath.exists_scale_quantizedUp_below_margin
      Independent cost nonnegative selectedPath actualCertified
  exact ⟨scale, quantizedSelectedError, quantizedPath,
    (underestimateReport_certified_iff selectedTarget bestTarget margin
      quantizedSelectedError).mpr quantizedBelow⟩

theorem exists_scale_twoSidedReport_certified
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {selectedCount comparisonCount : Nat}
    {selectedError comparisonError margin : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent cost
      selectedCount selectedError source selectedTarget)
    (comparisonPath : WeightedTracePath Independent cost
      comparisonCount comparisonError source bestTarget)
    (actualCertified : selectedError + comparisonError < margin) :
    ∃ scale : PositiveScale,
      ∃ quantizedSelectedError quantizedComparisonError,
        WeightedTracePath Independent (quantizedUpCost scale cost)
          selectedCount quantizedSelectedError source selectedTarget ∧
        WeightedTracePath Independent (quantizedUpCost scale cost)
          comparisonCount quantizedComparisonError source bestTarget ∧
        (twoSidedReport selectedTarget bestTarget margin
          quantizedSelectedError quantizedComparisonError).verdict =
            .certifiedStable := by
  have gapPositive :
      0 < margin - (selectedError + comparisonError) :=
    sub_pos.mpr actualCertified
  obtain ⟨scale, slackBelow⟩ := exists_scale_mul_quantum_lt
    (show 0 ≤ ((selectedCount + comparisonCount : Nat) : ℝ) by positivity)
    gapPositive
  obtain ⟨quantizedSelectedError, quantizedSelectedPath,
      selectedLower, selectedUpper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      scale Independent cost nonnegative selectedPath
  obtain ⟨quantizedComparisonError, quantizedComparisonPath,
      comparisonLower, comparisonUpper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      scale Independent cost nonnegative comparisonPath
  refine ⟨scale, quantizedSelectedError, quantizedComparisonError,
    quantizedSelectedPath, quantizedComparisonPath, ?_⟩
  rw [twoSidedReport_certified_iff]
  calc
    quantizedSelectedError + quantizedComparisonError ≤
        (selectedError + (selectedCount : ℝ) * quantum scale) +
          (comparisonError + (comparisonCount : ℝ) * quantum scale) :=
      add_le_add selectedUpper comparisonUpper
    _ = selectedError + comparisonError +
        ((selectedCount + comparisonCount : Nat) : ℝ) * quantum scale := by
      push_cast
      ring
    _ < margin := by linarith

end Sprawlens.FixedPointScaleSelection
