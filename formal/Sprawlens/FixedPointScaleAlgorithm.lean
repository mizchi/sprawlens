import Sprawlens.FixedPointScaleSelection

namespace Sprawlens.FixedPointScaleAlgorithm

open FixedPointEncodedCost
open FixedPointQuantization
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- Integer-only sufficient condition ensuring that the worst-case accumulated
upward-quantization slack stays strictly below an encoded margin gap. -/
def SufficientDenominator
    (pathCount baseScale gapUnits denominator : Nat) : Prop :=
  pathCount * baseScale < gapUnits * denominator

/-- The least denominator satisfying `SufficientDenominator`, provided the
encoded gap is positive. This is executable `Nat` arithmetic. -/
def minimalSufficientDenominator
    (pathCount baseScale gapUnits : Nat) : Nat :=
  pathCount * baseScale / gapUnits + 1

/-- Package the executable denominator as a positive fixed-point scale. -/
def selectedScale
    (pathCount baseScale gapUnits : Nat) : PositiveScale := {
  denominator := minimalSufficientDenominator pathCount baseScale gapUnits
  positive := by
    simp [minimalSufficientDenominator]
}

/-- The quotient-plus-one formula always meets the strict integer bound when
the encoded margin gap is nonzero. -/
theorem minimalSufficientDenominator_sufficient
    (pathCount baseScale gapUnits : Nat) (gapPositive : 0 < gapUnits) :
    SufficientDenominator pathCount baseScale gapUnits
      (minimalSufficientDenominator pathCount baseScale gapUnits) := by
  unfold SufficientDenominator minimalSufficientDenominator
  have quotientLt :
      pathCount * baseScale / gapUnits <
        pathCount * baseScale / gapUnits + 1 := by
    omega
  have productLt :=
    (Nat.div_lt_iff_lt_mul gapPositive).mp quotientLt
  simpa [mul_comm] using productLt

/-- No smaller denominator can meet the same worst-case integer condition. -/
theorem minimalSufficientDenominator_minimal
    (pathCount baseScale gapUnits denominator : Nat)
    (gapPositive : 0 < gapUnits)
    (sufficient :
      SufficientDenominator pathCount baseScale gapUnits denominator) :
    minimalSufficientDenominator pathCount baseScale gapUnits ≤ denominator := by
  unfold SufficientDenominator at sufficient
  unfold minimalSufficientDenominator
  apply Nat.succ_le_iff.mpr
  apply (Nat.div_lt_iff_lt_mul gapPositive).mpr
  simpa [mul_comm] using sufficient

/-- Once a denominator satisfies the strict bound, every larger denominator
satisfies it as well. -/
theorem SufficientDenominator.mono
    {pathCount baseScale gapUnits smaller larger : Nat}
    (sufficient :
      SufficientDenominator pathCount baseScale gapUnits smaller)
    (denominatorLe : smaller ≤ larger) :
    SufficientDenominator pathCount baseScale gapUnits larger := by
  unfold SufficientDenominator at sufficient ⊢
  exact sufficient.trans_le
    (Nat.mul_le_mul_left gapUnits denominatorLe)

/-- For a positive encoded gap, the selector is the exact acceptance
threshold: a denominator is sufficient exactly when it is at least the
computed minimum. -/
theorem sufficient_iff_minimalSufficientDenominator_le
    (pathCount baseScale gapUnits denominator : Nat)
    (gapPositive : 0 < gapUnits) :
    SufficientDenominator pathCount baseScale gapUnits denominator ↔
      minimalSufficientDenominator pathCount baseScale gapUnits ≤
        denominator := by
  constructor
  · exact minimalSufficientDenominator_minimal
      pathCount baseScale gapUnits denominator gapPositive
  · intro minimumLe
    exact (minimalSufficientDenominator_sufficient
      pathCount baseScale gapUnits gapPositive).mono minimumLe

/-- The computed denominator is the least element of the complete set of
sufficient denominators. -/
theorem minimalSufficientDenominator_isLeast
    (pathCount baseScale gapUnits : Nat) (gapPositive : 0 < gapUnits) :
    IsLeast
      {denominator : Nat |
        SufficientDenominator pathCount baseScale gapUnits denominator}
      (minimalSufficientDenominator pathCount baseScale gapUnits) := by
  refine ⟨minimalSufficientDenominator_sufficient
    pathCount baseScale gapUnits gapPositive, ?_⟩
  intro denominator sufficient
  exact minimalSufficientDenominator_minimal
    pathCount baseScale gapUnits denominator gapPositive sufficient

/-- The selector's denominator is bounded by the unscaled numerator plus one.
This gives a simple resource bound for an unbounded-integer implementation. -/
theorem minimalSufficientDenominator_le_product_add_one
    (pathCount baseScale gapUnits : Nat) :
    minimalSufficientDenominator pathCount baseScale gapUnits ≤
      pathCount * baseScale + 1 := by
  unfold minimalSufficientDenominator
  exact Nat.add_le_add_right
    (Nat.div_le_self (pathCount * baseScale) gapUnits) 1

theorem selectedScale_denominator_le_product_add_one
    (pathCount baseScale gapUnits : Nat) :
    (selectedScale pathCount baseScale gapUnits).denominator ≤
      pathCount * baseScale + 1 := by
  exact minimalSufficientDenominator_le_product_add_one
    pathCount baseScale gapUnits

/-- The resource upper bound is attained when the encoded gap is one unit. -/
theorem minimalSufficientDenominator_one_gap
    (pathCount baseScale : Nat) :
    minimalSufficientDenominator pathCount baseScale 1 =
      pathCount * baseScale + 1 := by
  simp [minimalSufficientDenominator]

/-- A zero-unit gap admits no sufficient denominator. -/
theorem zero_gap_no_denominator_sufficient
    (pathCount baseScale denominator : Nat) :
    ¬SufficientDenominator pathCount baseScale 0 denominator := by
  simp [SufficientDenominator]

/-- Nat division makes the raw formula return one at a zero-unit gap. Callers
must therefore check gap positivity before treating the output as a scale
certificate. -/
theorem minimalSufficientDenominator_zero_gap
    (pathCount baseScale : Nat) :
    minimalSufficientDenominator pathCount baseScale 0 = 1 := by
  simp [minimalSufficientDenominator]

/-- The denominator immediately below the selector is always rejected. This
is the load-bearing strict boundary in quotient form. -/
theorem quotient_not_sufficient
    (pathCount baseScale gapUnits : Nat) (gapPositive : 0 < gapUnits) :
    ¬SufficientDenominator pathCount baseScale gapUnits
      (pathCount * baseScale / gapUnits) := by
  rw [sufficient_iff_minimalSufficientDenominator_le
    pathCount baseScale gapUnits _ gapPositive]
  simp [minimalSufficientDenominator]

/-- A zero-edge path needs only denominator one, regardless of the encoded
base scale and gap representation. -/
theorem minimalSufficientDenominator_zero_path
    (baseScale gapUnits : Nat) :
    minimalSufficientDenominator 0 baseScale gapUnits = 1 := by
  simp [minimalSufficientDenominator]

/-- If the encoded gap already exceeds the whole worst-case numerator, scale
one is sufficient and is selected. -/
theorem minimalSufficientDenominator_eq_one_of_product_lt_gap
    (pathCount baseScale gapUnits : Nat)
    (productLtGap : pathCount * baseScale < gapUnits) :
    minimalSufficientDenominator pathCount baseScale gapUnits = 1 := by
  rw [minimalSufficientDenominator,
    Nat.div_eq_of_lt productLtGap]

theorem selectedScale_sufficient
    (pathCount baseScale gapUnits : Nat) (gapPositive : 0 < gapUnits) :
    SufficientDenominator pathCount baseScale gapUnits
      (selectedScale pathCount baseScale gapUnits).denominator := by
  exact minimalSufficientDenominator_sufficient
    pathCount baseScale gapUnits gapPositive

/-- The integer condition is exactly the real-valued scale-selection premise:
`pathCount` quantization units fit strictly inside the decoded margin gap. -/
theorem mul_quantum_lt_decodedGap
    (pathCount baseScale gapUnits denominator : Nat)
    (baseScalePositive : 0 < baseScale)
    (denominatorPositive : 0 < denominator)
    (sufficient :
      SufficientDenominator pathCount baseScale gapUnits denominator) :
    let scale : PositiveScale := {
      denominator
      positive := denominatorPositive
    }
    (pathCount : ℝ) * quantum scale <
      (gapUnits : ℝ) / (baseScale : ℝ) := by
  let scale : PositiveScale := {
    denominator
    positive := denominatorPositive
  }
  have denominatorRealPositive : 0 < (denominator : ℝ) := by
    exact_mod_cast denominatorPositive
  have baseScaleRealPositive : 0 < (baseScale : ℝ) := by
    exact_mod_cast baseScalePositive
  have integerBound :
      (pathCount * baseScale : ℝ) < gapUnits * denominator := by
    exact_mod_cast sufficient
  change (pathCount : ℝ) * quantum scale <
    (gapUnits : ℝ) / (baseScale : ℝ)
  rw [quantum, show scale.denominator = denominator from rfl, mul_one_div]
  apply (div_lt_div_iff₀ denominatorRealPositive baseScaleRealPositive).2
  simpa only [Nat.cast_mul] using integerBound

/-- The executable selector therefore gives a scale satisfying the real
worst-case slack bound. -/
theorem selectedScale_mul_quantum_lt_decodedGap
    (pathCount baseScale gapUnits : Nat)
    (baseScalePositive : 0 < baseScale)
    (gapPositive : 0 < gapUnits) :
    (pathCount : ℝ) * quantum
        (selectedScale pathCount baseScale gapUnits) <
      (gapUnits : ℝ) / (baseScale : ℝ) := by
  exact mul_quantum_lt_decodedGap
    pathCount baseScale gapUnits
    (selectedScale pathCount baseScale gapUnits).denominator
    baseScalePositive
    (selectedScale pathCount baseScale gapUnits).positive
    (selectedScale_sufficient pathCount baseScale gapUnits gapPositive)

/-- Re-costing at the selected scale stays below the original path cost plus
the encoded gap. This turns the integer selector into a constructive path
certificate rather than only an arithmetic existence result. -/
theorem WeightedTracePath.exists_quantizedUp_at_selectedScale
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {pathCost : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent cost
      pathCount pathCost source target)
    (baseScale gapUnits : Nat)
    (baseScalePositive : 0 < baseScale)
    (gapPositive : 0 < gapUnits) :
    ∃ quantizedPathCost,
      WeightedTracePath Independent
        (quantizedUpCost
          (selectedScale pathCount baseScale gapUnits) cost)
        pathCount quantizedPathCost source target ∧
      pathCost ≤ quantizedPathCost ∧
      quantizedPathCost <
        pathCost + (gapUnits : ℝ) / (baseScale : ℝ) := by
  obtain ⟨quantizedPathCost, quantizedPath, lower, upper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      (selectedScale pathCount baseScale gapUnits)
      Independent cost nonnegative path
  refine ⟨quantizedPathCost, quantizedPath, lower, ?_⟩
  have slackBelow := selectedScale_mul_quantum_lt_decodedGap
    pathCount baseScale gapUnits baseScalePositive gapPositive
  linarith

/-- For overestimate reports, the executable scale recovers certification
whenever the margin is the actual comparison error plus a positive encoded
gap. -/
theorem overestimateReport_certified_at_selectedScale
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {comparisonError margin : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (comparisonPath : WeightedTracePath Independent cost
      pathCount comparisonError source bestTarget)
    (baseScale gapUnits : Nat)
    (baseScalePositive : 0 < baseScale)
    (gapPositive : 0 < gapUnits)
    (marginEq :
      margin = comparisonError +
        (gapUnits : ℝ) / (baseScale : ℝ)) :
    ∃ quantizedComparisonError,
      WeightedTracePath Independent
        (quantizedUpCost
          (selectedScale pathCount baseScale gapUnits) cost)
        pathCount quantizedComparisonError source bestTarget ∧
      (overestimateReport selectedTarget bestTarget margin
        quantizedComparisonError).verdict = .certifiedStable := by
  obtain ⟨quantizedComparisonError, quantizedPath, lower, belowGap⟩ :=
    WeightedTracePath.exists_quantizedUp_at_selectedScale
      Independent cost nonnegative comparisonPath
      baseScale gapUnits baseScalePositive gapPositive
  refine ⟨quantizedComparisonError, quantizedPath, ?_⟩
  rw [overestimateReport_certified_iff, marginEq]
  exact belowGap

/-- The same executable scale construction applies to underestimate reports. -/
theorem underestimateReport_certified_at_selectedScale
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {selectedError margin : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent cost
      pathCount selectedError source selectedTarget)
    (baseScale gapUnits : Nat)
    (baseScalePositive : 0 < baseScale)
    (gapPositive : 0 < gapUnits)
    (marginEq :
      margin = selectedError +
        (gapUnits : ℝ) / (baseScale : ℝ)) :
    ∃ quantizedSelectedError,
      WeightedTracePath Independent
        (quantizedUpCost
          (selectedScale pathCount baseScale gapUnits) cost)
        pathCount quantizedSelectedError source selectedTarget ∧
      (underestimateReport selectedTarget bestTarget margin
        quantizedSelectedError).verdict = .certifiedStable := by
  obtain ⟨quantizedSelectedError, quantizedPath, lower, belowGap⟩ :=
    WeightedTracePath.exists_quantizedUp_at_selectedScale
      Independent cost nonnegative selectedPath
      baseScale gapUnits baseScalePositive gapPositive
  refine ⟨quantizedSelectedError, quantizedPath, ?_⟩
  rw [underestimateReport_certified_iff, marginEq]
  exact belowGap

/-- For a two-sided report, use the total number of edges. Its selected scale
keeps the sum of both quantized path errors below the encoded margin gap. -/
theorem twoSidedReport_certified_at_selectedScale
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
    (baseScale gapUnits : Nat)
    (baseScalePositive : 0 < baseScale)
    (gapPositive : 0 < gapUnits)
    (marginEq :
      margin = selectedError + comparisonError +
        (gapUnits : ℝ) / (baseScale : ℝ)) :
    let scale := selectedScale
      (selectedCount + comparisonCount) baseScale gapUnits
    ∃ quantizedSelectedError quantizedComparisonError,
      WeightedTracePath Independent (quantizedUpCost scale cost)
        selectedCount quantizedSelectedError source selectedTarget ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        comparisonCount quantizedComparisonError source bestTarget ∧
      (twoSidedReport selectedTarget bestTarget margin
        quantizedSelectedError quantizedComparisonError).verdict =
          .certifiedStable := by
  let scale := selectedScale
    (selectedCount + comparisonCount) baseScale gapUnits
  obtain ⟨quantizedSelectedError, quantizedSelectedPath,
      selectedLower, selectedUpper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      scale Independent cost nonnegative selectedPath
  obtain ⟨quantizedComparisonError, quantizedComparisonPath,
      comparisonLower, comparisonUpper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      scale Independent cost nonnegative comparisonPath
  refine ⟨quantizedSelectedError, quantizedComparisonError,
    quantizedSelectedPath, quantizedComparisonPath, ?_⟩
  rw [twoSidedReport_certified_iff, marginEq]
  have slackBelow := selectedScale_mul_quantum_lt_decodedGap
    (selectedCount + comparisonCount) baseScale gapUnits
    baseScalePositive gapPositive
  calc
    quantizedSelectedError + quantizedComparisonError ≤
        (selectedError + (selectedCount : ℝ) * quantum scale) +
          (comparisonError + (comparisonCount : ℝ) * quantum scale) :=
      add_le_add selectedUpper comparisonUpper
    _ = selectedError + comparisonError +
        ((selectedCount + comparisonCount : Nat) : ℝ) * quantum scale := by
      push_cast
      ring
    _ < selectedError + comparisonError +
        (gapUnits : ℝ) / (baseScale : ℝ) := by
      linarith

/-- At one edge, a base scale of 4000 and a one-unit gap require denominator
4001 for the strict worst-case bound. -/
example : minimalSufficientDenominator 1 4000 1 = 4001 := by
  norm_num [minimalSufficientDenominator]

example : ¬SufficientDenominator 1 4000 1 4000 := by
  norm_num [SufficientDenominator]

example : SufficientDenominator 1 4000 1 4001 := by
  norm_num [SufficientDenominator]

end Sprawlens.FixedPointScaleAlgorithm
