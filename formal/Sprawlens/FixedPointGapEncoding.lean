import Sprawlens.FixedPointScaleAlgorithm

namespace Sprawlens.FixedPointGapEncoding

open FixedPointEncodedCost
open FixedPointQuantization
open FixedPointScaleAlgorithm
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- Conservatively encode a nonnegative real margin gap by rounding down at a
positive integer base scale. -/
noncomputable def gapUnitsDown (baseScale : PositiveScale) (gap : ℝ) : Nat :=
  ⌊gap * (baseScale.denominator : ℝ)⌋₊

/-- Decode the conservative gap units back to the real model. -/
noncomputable def decodedGapDown
    (baseScale : PositiveScale) (gap : ℝ) : ℝ :=
  (gapUnitsDown baseScale gap : ℝ) /
    (baseScale.denominator : ℝ)

/-- Downward gap encoding never claims more margin than the real gap. -/
theorem decodedGapDown_le
    (baseScale : PositiveScale) {gap : ℝ} (gapNonnegative : 0 ≤ gap) :
    decodedGapDown baseScale gap ≤ gap := by
  rw [decodedGapDown]
  apply (div_le_iff₀ (denominator_real_pos baseScale)).2
  exact Nat.floor_le
    (mul_nonneg gapNonnegative (denominator_real_pos baseScale).le)

/-- The conservative encoding loses strictly less than one base-scale unit. -/
theorem gap_lt_decodedGapDown_add_quantum
    (baseScale : PositiveScale) (gap : ℝ) :
    gap < decodedGapDown baseScale gap + quantum baseScale := by
  rw [decodedGapDown, quantum]
  have denominatorPositive := denominator_real_pos baseScale
  rw [← add_div, lt_div_iff₀ denominatorPositive]
  simpa [gapUnitsDown, add_comm] using
    (Nat.lt_floor_add_one
      (gap * (baseScale.denominator : ℝ)))

/-- A positive unit survives downward encoding exactly when the real gap is at
least one quantum of the chosen base scale. -/
theorem gapUnitsDown_pos_iff
    (baseScale : PositiveScale) (gap : ℝ) :
    0 < gapUnitsDown baseScale gap ↔ quantum baseScale ≤ gap := by
  rw [gapUnitsDown, Nat.floor_pos, quantum]
  have denominatorPositive := denominator_real_pos baseScale
  constructor
  · intro oneLe
    exact (div_le_iff₀ denominatorPositive).2 (by simpa using oneLe)
  · intro quantumLe
    exact (div_le_iff₀ denominatorPositive).1 quantumLe

/-- Use conservative gap units as input to the executable denominator
selector. -/
noncomputable def selectedScaleFromGap
    (pathCount : Nat) (baseScale : PositiveScale) (gap : ℝ) :
    PositiveScale :=
  selectedScale pathCount baseScale.denominator
    (gapUnitsDown baseScale gap)

/-- If downward encoding retains at least one unit, the selected scale's
worst-case accumulated quantization slack is strictly below the original real
gap. -/
theorem selectedScaleFromGap_mul_quantum_lt_gap
    (pathCount : Nat) (baseScale : PositiveScale) {gap : ℝ}
    (gapNonnegative : 0 ≤ gap)
    (encodedGapPositive : 0 < gapUnitsDown baseScale gap) :
    (pathCount : ℝ) *
        quantum (selectedScaleFromGap pathCount baseScale gap) < gap := by
  have belowDecoded := selectedScale_mul_quantum_lt_decodedGap
    pathCount baseScale.denominator (gapUnitsDown baseScale gap)
    baseScale.positive encodedGapPositive
  exact belowDecoded.trans_le (decodedGapDown_le baseScale gapNonnegative)

/-- A positive real gap always admits some finite base scale whose downward
encoding retains a positive unit. -/
theorem exists_baseScale_gapUnitsDown_pos
    {gap : ℝ} (gapPositive : 0 < gap) :
    ∃ baseScale : PositiveScale, 0 < gapUnitsDown baseScale gap := by
  obtain ⟨denominator, denominatorLarge⟩ := exists_nat_gt (1 / gap)
  have denominatorPositive : 0 < denominator := by
    have ratioNonnegative : 0 ≤ 1 / gap := by positivity
    exact_mod_cast (ratioNonnegative.trans_lt denominatorLarge)
  let baseScale : PositiveScale := {
    denominator
    positive := denominatorPositive
  }
  refine ⟨baseScale, (gapUnitsDown_pos_iff baseScale gap).2 ?_⟩
  rw [quantum, show baseScale.denominator = denominator from rfl]
  have denominatorRealPositive : 0 < (denominator : ℝ) := by
    exact_mod_cast denominatorPositive
  apply (div_le_iff₀ denominatorRealPositive).2
  have := (div_lt_iff₀ gapPositive).mp denominatorLarge
  linarith

/-- Re-costing a path at the scale selected from a conservatively encoded real
gap remains below its original cost plus that real gap. -/
theorem WeightedTracePath.exists_quantizedUp_at_selectedScaleFromGap
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {pathCost gap : ℝ}
    {source target : List Edit}
    (path : WeightedTracePath Independent cost
      pathCount pathCost source target)
    (baseScale : PositiveScale)
    (gapNonnegative : 0 ≤ gap)
    (encodedGapPositive : 0 < gapUnitsDown baseScale gap) :
    ∃ quantizedPathCost,
      WeightedTracePath Independent
        (quantizedUpCost
          (selectedScaleFromGap pathCount baseScale gap) cost)
        pathCount quantizedPathCost source target ∧
      pathCost ≤ quantizedPathCost ∧
      quantizedPathCost < pathCost + gap := by
  obtain ⟨quantizedPathCost, quantizedPath, lower, upper⟩ :=
    FixedPointQuantization.WeightedTracePath.exists_quantizedUp
      (selectedScaleFromGap pathCount baseScale gap)
      Independent cost nonnegative path
  refine ⟨quantizedPathCost, quantizedPath, lower, ?_⟩
  have slackBelow := selectedScaleFromGap_mul_quantum_lt_gap
    pathCount baseScale gapNonnegative encodedGapPositive
  linarith

/-- Conservative real-gap encoding plus the executable selector certifies an
overestimate report. -/
theorem overestimateReport_certified_at_selectedScaleFromGap
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {comparisonError margin gap : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (comparisonPath : WeightedTracePath Independent cost
      pathCount comparisonError source bestTarget)
    (baseScale : PositiveScale)
    (gapNonnegative : 0 ≤ gap)
    (encodedGapPositive : 0 < gapUnitsDown baseScale gap)
    (marginEq : margin = comparisonError + gap) :
    ∃ quantizedComparisonError,
      WeightedTracePath Independent
        (quantizedUpCost
          (selectedScaleFromGap pathCount baseScale gap) cost)
        pathCount quantizedComparisonError source bestTarget ∧
      (overestimateReport selectedTarget bestTarget margin
        quantizedComparisonError).verdict = .certifiedStable := by
  obtain ⟨quantizedComparisonError, quantizedPath, lower, belowMargin⟩ :=
    WeightedTracePath.exists_quantizedUp_at_selectedScaleFromGap
      Independent cost nonnegative comparisonPath baseScale
      gapNonnegative encodedGapPositive
  refine ⟨quantizedComparisonError, quantizedPath, ?_⟩
  rw [overestimateReport_certified_iff, marginEq]
  exact belowMargin

/-- Conservative real-gap encoding plus the executable selector certifies an
underestimate report. -/
theorem underestimateReport_certified_at_selectedScaleFromGap
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {selectedError margin gap : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent cost
      pathCount selectedError source selectedTarget)
    (baseScale : PositiveScale)
    (gapNonnegative : 0 ≤ gap)
    (encodedGapPositive : 0 < gapUnitsDown baseScale gap)
    (marginEq : margin = selectedError + gap) :
    ∃ quantizedSelectedError,
      WeightedTracePath Independent
        (quantizedUpCost
          (selectedScaleFromGap pathCount baseScale gap) cost)
        pathCount quantizedSelectedError source selectedTarget ∧
      (underestimateReport selectedTarget bestTarget margin
        quantizedSelectedError).verdict = .certifiedStable := by
  obtain ⟨quantizedSelectedError, quantizedPath, lower, belowMargin⟩ :=
    WeightedTracePath.exists_quantizedUp_at_selectedScaleFromGap
      Independent cost nonnegative selectedPath baseScale
      gapNonnegative encodedGapPositive
  refine ⟨quantizedSelectedError, quantizedPath, ?_⟩
  rw [underestimateReport_certified_iff, marginEq]
  exact belowMargin

/-- In the two-sided case, scale selection uses the sum of both path lengths. -/
theorem twoSidedReport_certified_at_selectedScaleFromGap
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {selectedCount comparisonCount : Nat}
    {selectedError comparisonError margin gap : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent cost
      selectedCount selectedError source selectedTarget)
    (comparisonPath : WeightedTracePath Independent cost
      comparisonCount comparisonError source bestTarget)
    (baseScale : PositiveScale)
    (gapNonnegative : 0 ≤ gap)
    (encodedGapPositive : 0 < gapUnitsDown baseScale gap)
    (marginEq : margin = selectedError + comparisonError + gap) :
    let scale := selectedScaleFromGap
      (selectedCount + comparisonCount) baseScale gap
    ∃ quantizedSelectedError quantizedComparisonError,
      WeightedTracePath Independent (quantizedUpCost scale cost)
        selectedCount quantizedSelectedError source selectedTarget ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        comparisonCount quantizedComparisonError source bestTarget ∧
      (twoSidedReport selectedTarget bestTarget margin
        quantizedSelectedError quantizedComparisonError).verdict =
          .certifiedStable := by
  let scale := selectedScaleFromGap
    (selectedCount + comparisonCount) baseScale gap
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
  have slackBelow := selectedScaleFromGap_mul_quantum_lt_gap
    (selectedCount + comparisonCount) baseScale
    gapNonnegative encodedGapPositive
  calc
    quantizedSelectedError + quantizedComparisonError ≤
        (selectedError + (selectedCount : ℝ) * quantum scale) +
          (comparisonError + (comparisonCount : ℝ) * quantum scale) :=
      add_le_add selectedUpper comparisonUpper
    _ = selectedError + comparisonError +
        ((selectedCount + comparisonCount : Nat) : ℝ) * quantum scale := by
      push_cast
      ring
    _ < selectedError + comparisonError + gap := by
      linarith

/-- A positive half-milli gap is erased by a base scale of 1000. This is why
the nonzero encoded-gap check is load-bearing. -/
example : gapUnitsDown ⟨1000, by norm_num⟩ (1 / 2000 : ℝ) = 0 := by
  norm_num [gapUnitsDown]

/-- At base scale 4000, the same half-milli gap retains two units. -/
example : gapUnitsDown ⟨4000, by norm_num⟩ (1 / 2000 : ℝ) = 2 := by
  norm_num [gapUnitsDown]

/-- Those two retained units make 2001 the selected worst-case denominator
for a one-edge path. -/
example :
    (selectedScaleFromGap 1 ⟨4000, by norm_num⟩
      (1 / 2000 : ℝ)).denominator = 2001 := by
  norm_num [selectedScaleFromGap, selectedScale,
    minimalSufficientDenominator, gapUnitsDown]

/-- The selected denominator's one-edge quantum is strictly below the
original half-milli gap. -/
example :
    (1 : ℝ) * quantum
      (selectedScaleFromGap 1 ⟨4000, by norm_num⟩
        (1 / 2000 : ℝ)) < 1 / 2000 := by
  norm_num [selectedScaleFromGap, selectedScale,
    minimalSufficientDenominator, gapUnitsDown, quantum]

end Sprawlens.FixedPointGapEncoding
