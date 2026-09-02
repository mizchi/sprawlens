import Sprawlens.FixedPointGapEncoding

namespace Sprawlens.FixedPointCheckedScale

open FixedPointEncodedCost
open FixedPointGapEncoding
open FixedPointQuantization
open FixedPointScaleAlgorithm
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

/-- Executable fail-closed wrapper around the raw quotient-plus-one formula.
Both the base scale and encoded gap must be positive before a scale is
returned. -/
def checkedScale
    (pathCount baseScale gapUnits : Nat) : Option PositiveScale :=
  if _baseScalePositive : 0 < baseScale then
    if _gapPositive : 0 < gapUnits then
      some (selectedScale pathCount baseScale gapUnits)
    else
      none
  else
    none

/-- Exact success characterization for a particular returned scale. -/
theorem checkedScale_eq_some_iff
    (pathCount baseScale gapUnits : Nat) (scale : PositiveScale) :
    checkedScale pathCount baseScale gapUnits = some scale ↔
      0 < baseScale ∧ 0 < gapUnits ∧
        selectedScale pathCount baseScale gapUnits = scale := by
  by_cases baseScalePositive : 0 < baseScale
  · by_cases gapPositive : 0 < gapUnits
    · simp [checkedScale, baseScalePositive, gapPositive]
    · simp [checkedScale, baseScalePositive, gapPositive]
  · simp [checkedScale, baseScalePositive]

/-- The checked API succeeds exactly on positive base-scale and gap inputs. -/
theorem exists_checkedScale_iff
    (pathCount baseScale gapUnits : Nat) :
    (∃ scale, checkedScale pathCount baseScale gapUnits = some scale) ↔
      0 < baseScale ∧ 0 < gapUnits := by
  constructor
  · rintro ⟨scale, accepted⟩
    have info := (checkedScale_eq_some_iff
      pathCount baseScale gapUnits scale).mp accepted
    exact ⟨info.1, info.2.1⟩
  · rintro ⟨baseScalePositive, gapPositive⟩
    exact ⟨selectedScale pathCount baseScale gapUnits, by
      simp [checkedScale, baseScalePositive, gapPositive]⟩

/-- Failure means that at least one load-bearing positive-input check failed. -/
theorem checkedScale_eq_none_iff
    (pathCount baseScale gapUnits : Nat) :
    checkedScale pathCount baseScale gapUnits = none ↔
      baseScale = 0 ∨ gapUnits = 0 := by
  by_cases baseScalePositive : 0 < baseScale
  · by_cases gapPositive : 0 < gapUnits
    · simp [checkedScale, baseScalePositive, gapPositive,
        Nat.ne_of_gt baseScalePositive, Nat.ne_of_gt gapPositive]
    · have gapZero : gapUnits = 0 := Nat.eq_zero_of_not_pos gapPositive
      simp [checkedScale, baseScalePositive, gapZero]
  · have baseScaleZero : baseScale = 0 :=
      Nat.eq_zero_of_not_pos baseScalePositive
    simp [checkedScale, baseScaleZero]

/-- Every returned scale satisfies the strict integer slack condition. -/
theorem checkedScale_sufficient
    {pathCount baseScale gapUnits : Nat} {scale : PositiveScale}
    (accepted : checkedScale pathCount baseScale gapUnits = some scale) :
    SufficientDenominator pathCount baseScale gapUnits scale.denominator := by
  obtain ⟨baseScalePositive, gapPositive, selectedEq⟩ :=
    (checkedScale_eq_some_iff
      pathCount baseScale gapUnits scale).mp accepted
  rw [← selectedEq]
  exact selectedScale_sufficient
    pathCount baseScale gapUnits gapPositive

/-- Every returned scale is exactly the least sufficient denominator. -/
theorem checkedScale_denominator_eq_minimal
    {pathCount baseScale gapUnits : Nat} {scale : PositiveScale}
    (accepted : checkedScale pathCount baseScale gapUnits = some scale) :
    scale.denominator =
      minimalSufficientDenominator pathCount baseScale gapUnits := by
  obtain ⟨baseScalePositive, gapPositive, selectedEq⟩ :=
    (checkedScale_eq_some_iff
      pathCount baseScale gapUnits scale).mp accepted
  rw [← selectedEq]
  rfl

/-- The checked result inherits the raw selector's resource upper bound. -/
theorem checkedScale_denominator_le_product_add_one
    {pathCount baseScale gapUnits : Nat} {scale : PositiveScale}
    (accepted : checkedScale pathCount baseScale gapUnits = some scale) :
    scale.denominator ≤ pathCount * baseScale + 1 := by
  rw [checkedScale_denominator_eq_minimal accepted]
  exact minimalSufficientDenominator_le_product_add_one
    pathCount baseScale gapUnits

/-- Checked variant for a real margin gap. The gap is first conservatively
rounded down at the supplied positive base scale. -/
noncomputable def checkedScaleFromGap
    (pathCount : Nat) (baseScale : PositiveScale) (gap : ℝ) :
    Option PositiveScale :=
  checkedScale pathCount baseScale.denominator
    (gapUnitsDown baseScale gap)

/-- The real-gap wrapper returns a particular scale exactly when one base
quantum fits inside the gap and that scale is the verified selector output. -/
theorem checkedScaleFromGap_eq_some_iff
    (pathCount : Nat) (baseScale : PositiveScale) (gap : ℝ)
    (scale : PositiveScale) :
    checkedScaleFromGap pathCount baseScale gap = some scale ↔
      quantum baseScale ≤ gap ∧
        selectedScaleFromGap pathCount baseScale gap = scale := by
  rw [checkedScaleFromGap, checkedScale_eq_some_iff]
  simp only [baseScale.positive, true_and]
  rw [gapUnitsDown_pos_iff]
  rfl

/-- The real-gap checked selector succeeds exactly when the base quantum fits
inside the gap. -/
theorem exists_checkedScaleFromGap_iff
    (pathCount : Nat) (baseScale : PositiveScale) (gap : ℝ) :
    (∃ scale,
      checkedScaleFromGap pathCount baseScale gap = some scale) ↔
      quantum baseScale ≤ gap := by
  constructor
  · rintro ⟨scale, accepted⟩
    exact ((checkedScaleFromGap_eq_some_iff
      pathCount baseScale gap scale).mp accepted).1
  · intro quantumLe
    refine ⟨selectedScaleFromGap pathCount baseScale gap, ?_⟩
    exact (checkedScaleFromGap_eq_some_iff
      pathCount baseScale gap _).mpr ⟨quantumLe, rfl⟩

/-- Failure of the real-gap wrapper has the precise domain meaning that the
gap is smaller than one base quantum. -/
theorem checkedScaleFromGap_eq_none_iff
    (pathCount : Nat) (baseScale : PositiveScale) (gap : ℝ) :
    checkedScaleFromGap pathCount baseScale gap = none ↔
      gap < quantum baseScale := by
  rw [checkedScaleFromGap, checkedScale_eq_none_iff]
  simp only [Nat.ne_of_gt baseScale.positive, false_or]
  constructor
  · intro unitsZero
    have notPositive : ¬0 < gapUnitsDown baseScale gap := by
      simp [unitsZero]
    exact lt_of_not_ge fun quantumLe =>
      notPositive ((gapUnitsDown_pos_iff baseScale gap).2 quantumLe)
  · intro gapLt
    apply Nat.eq_zero_of_not_pos
    intro unitsPositive
    exact (not_le_of_gt gapLt)
      ((gapUnitsDown_pos_iff baseScale gap).1 unitsPositive)

/-- A successful checked real-gap selection is sound for the original real
gap, not merely for the rounded-down surrogate. -/
theorem checkedScaleFromGap_mul_quantum_lt_gap
    {pathCount : Nat} {baseScale : PositiveScale} {gap : ℝ}
    {scale : PositiveScale}
    (accepted :
      checkedScaleFromGap pathCount baseScale gap = some scale) :
    (pathCount : ℝ) * quantum scale < gap := by
  obtain ⟨quantumLe, selectedEq⟩ :=
    (checkedScaleFromGap_eq_some_iff
      pathCount baseScale gap scale).mp accepted
  rw [← selectedEq]
  apply selectedScaleFromGap_mul_quantum_lt_gap
  · exact (quantum_pos baseScale).le.trans quantumLe
  · exact (gapUnitsDown_pos_iff baseScale gap).2 quantumLe

/-- The checked real-gap API can directly produce a quantized path whose
cost remains within the original real margin gap. -/
theorem WeightedTracePath.exists_checkedScale_quantizedUp_below_gap
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {pathCost gap : ℝ}
    {source target : List Edit}
    (path : WeightedTracePath Independent cost
      pathCount pathCost source target)
    (baseScale : PositiveScale)
    (quantumLeGap : quantum baseScale ≤ gap) :
    ∃ scale quantizedPathCost,
      checkedScaleFromGap pathCount baseScale gap = some scale ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        pathCount quantizedPathCost source target ∧
      pathCost ≤ quantizedPathCost ∧
      quantizedPathCost < pathCost + gap := by
  let scale := selectedScaleFromGap pathCount baseScale gap
  have accepted :
      checkedScaleFromGap pathCount baseScale gap = some scale :=
    (checkedScaleFromGap_eq_some_iff
      pathCount baseScale gap scale).mpr ⟨quantumLeGap, rfl⟩
  obtain ⟨quantizedPathCost, quantizedPath, lower, belowGap⟩ :=
    WeightedTracePath.exists_quantizedUp_at_selectedScaleFromGap
      Independent cost nonnegative path baseScale
      ((quantum_pos baseScale).le.trans quantumLeGap)
      ((gapUnitsDown_pos_iff baseScale gap).2 quantumLeGap)
  exact ⟨scale, quantizedPathCost, accepted,
    quantizedPath, lower, belowGap⟩

/-- Checked scale selection and an overestimate report are returned together,
so certification cannot be detached from the successful input checks. -/
theorem exists_checkedScale_overestimateReport_certified
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {comparisonError margin gap : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (comparisonPath : WeightedTracePath Independent cost
      pathCount comparisonError source bestTarget)
    (baseScale : PositiveScale)
    (quantumLeGap : quantum baseScale ≤ gap)
    (marginEq : margin = comparisonError + gap) :
    ∃ scale quantizedComparisonError,
      checkedScaleFromGap pathCount baseScale gap = some scale ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        pathCount quantizedComparisonError source bestTarget ∧
      (overestimateReport selectedTarget bestTarget margin
        quantizedComparisonError).verdict = .certifiedStable := by
  let scale := selectedScaleFromGap pathCount baseScale gap
  have accepted :
      checkedScaleFromGap pathCount baseScale gap = some scale :=
    (checkedScaleFromGap_eq_some_iff
      pathCount baseScale gap scale).mpr ⟨quantumLeGap, rfl⟩
  obtain ⟨quantizedComparisonError, quantizedPath, certified⟩ :=
    overestimateReport_certified_at_selectedScaleFromGap
      Independent cost nonnegative comparisonPath baseScale
      ((quantum_pos baseScale).le.trans quantumLeGap)
      ((gapUnitsDown_pos_iff baseScale gap).2 quantumLeGap) marginEq
  exact ⟨scale, quantizedComparisonError, accepted,
    quantizedPath, certified⟩

/-- Checked scale selection and an underestimate report are returned
together. -/
theorem exists_checkedScale_underestimateReport_certified
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {pathCount : Nat} {selectedError margin gap : ℝ}
    {source selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent cost
      pathCount selectedError source selectedTarget)
    (baseScale : PositiveScale)
    (quantumLeGap : quantum baseScale ≤ gap)
    (marginEq : margin = selectedError + gap) :
    ∃ scale quantizedSelectedError,
      checkedScaleFromGap pathCount baseScale gap = some scale ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        pathCount quantizedSelectedError source selectedTarget ∧
      (underestimateReport selectedTarget bestTarget margin
        quantizedSelectedError).verdict = .certifiedStable := by
  let scale := selectedScaleFromGap pathCount baseScale gap
  have accepted :
      checkedScaleFromGap pathCount baseScale gap = some scale :=
    (checkedScaleFromGap_eq_some_iff
      pathCount baseScale gap scale).mpr ⟨quantumLeGap, rfl⟩
  obtain ⟨quantizedSelectedError, quantizedPath, certified⟩ :=
    underestimateReport_certified_at_selectedScaleFromGap
      Independent cost nonnegative selectedPath baseScale
      ((quantum_pos baseScale).le.trans quantumLeGap)
      ((gapUnitsDown_pos_iff baseScale gap).2 quantumLeGap) marginEq
  exact ⟨scale, quantizedSelectedError, accepted,
    quantizedPath, certified⟩

/-- The two-sided checked API selects from the sum of both path lengths and
returns the successful check beside both path certificates. -/
theorem exists_checkedScale_twoSidedReport_certified
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
    (quantumLeGap : quantum baseScale ≤ gap)
    (marginEq : margin = selectedError + comparisonError + gap) :
    ∃ scale quantizedSelectedError quantizedComparisonError,
      checkedScaleFromGap (selectedCount + comparisonCount)
        baseScale gap = some scale ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        selectedCount quantizedSelectedError source selectedTarget ∧
      WeightedTracePath Independent (quantizedUpCost scale cost)
        comparisonCount quantizedComparisonError source bestTarget ∧
      (twoSidedReport selectedTarget bestTarget margin
        quantizedSelectedError quantizedComparisonError).verdict =
          .certifiedStable := by
  let scale := selectedScaleFromGap
    (selectedCount + comparisonCount) baseScale gap
  have accepted :
      checkedScaleFromGap (selectedCount + comparisonCount)
        baseScale gap = some scale :=
    (checkedScaleFromGap_eq_some_iff
      (selectedCount + comparisonCount) baseScale gap scale).mpr
        ⟨quantumLeGap, rfl⟩
  obtain ⟨quantizedSelectedError, quantizedComparisonError,
      quantizedSelectedPath, quantizedComparisonPath, certified⟩ :=
    twoSidedReport_certified_at_selectedScaleFromGap
      Independent cost nonnegative selectedPath comparisonPath baseScale
      ((quantum_pos baseScale).le.trans quantumLeGap)
      ((gapUnitsDown_pos_iff baseScale gap).2 quantumLeGap) marginEq
  exact ⟨scale, quantizedSelectedError, quantizedComparisonError,
    accepted, quantizedSelectedPath, quantizedComparisonPath, certified⟩

example : checkedScale 1 4000 0 = none := by
  norm_num [checkedScale]

example :
    (checkedScale 1 4000 1).map PositiveScale.denominator = some 4001 := by
  norm_num [checkedScale, selectedScale, minimalSufficientDenominator]

example :
    checkedScaleFromGap 1 ⟨1000, by norm_num⟩ (1 / 2000 : ℝ) = none := by
  norm_num [checkedScaleFromGap, checkedScale, gapUnitsDown]

example :
    (checkedScaleFromGap 1 ⟨4000, by norm_num⟩
      (1 / 2000 : ℝ)).map PositiveScale.denominator = some 2001 := by
  norm_num [checkedScaleFromGap, checkedScale, gapUnitsDown,
    selectedScale, selectedScaleFromGap, minimalSufficientDenominator]

end Sprawlens.FixedPointCheckedScale
