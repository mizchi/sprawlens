import Mathlib.Algebra.Order.Floor.Ring
import Sprawlens.FixedPointEncodedCost
import Sprawlens.PathwiseReliabilityVerdict

namespace Sprawlens.FixedPointQuantization

open ApproximateWeightedNormalization
open FixedPointEncodedCost
open PathwiseReliabilityVerdict
open PositiveCostAttainment

universe u

noncomputable def quantum (scale : PositiveScale) : ℝ :=
  1 / (scale.denominator : ℝ)

noncomputable def quantizeUp (scale : PositiveScale) (value : ℝ) :
    ScaledIntCost scale :=
  ⟨Int.ofNat ⌈value * (scale.denominator : ℝ)⌉₊⟩

theorem denominator_real_pos (scale : PositiveScale) :
    0 < (scale.denominator : ℝ) := by
  exact_mod_cast scale.positive

theorem quantum_pos (scale : PositiveScale) : 0 < quantum scale := by
  exact one_div_pos.mpr (denominator_real_pos scale)

theorem decode_quantizeUp (scale : PositiveScale) (value : ℝ) :
    decode (quantizeUp scale value) =
      (⌈value * (scale.denominator : ℝ)⌉₊ : ℝ) /
        (scale.denominator : ℝ) := by
  simp [decode, quantizeUp]

/-- Upward quantization never understates a real value. -/
theorem value_le_decode_quantizeUp (scale : PositiveScale) (value : ℝ) :
    value ≤ decode (quantizeUp scale value) := by
  rw [decode_quantizeUp]
  apply (le_div_iff₀ (denominator_real_pos scale)).2
  exact Nat.le_ceil _

/-- For nonnegative inputs, upward quantization adds strictly less than one
fixed-point unit. -/
theorem decode_quantizeUp_lt_add_quantum
    (scale : PositiveScale) {value : ℝ} (nonnegative : 0 ≤ value) :
    decode (quantizeUp scale value) < value + quantum scale := by
  rw [decode_quantizeUp, div_lt_iff₀ (denominator_real_pos scale)]
  have ceilLt :
      (⌈value * (scale.denominator : ℝ)⌉₊ : ℝ) <
        value * (scale.denominator : ℝ) + 1 :=
    Nat.ceil_lt_add_one
      (mul_nonneg nonnegative (denominator_real_pos scale).le)
  calc
    (⌈value * (scale.denominator : ℝ)⌉₊ : ℝ) <
        value * (scale.denominator : ℝ) + 1 := ceilLt
    _ = (value + quantum scale) * (scale.denominator : ℝ) := by
      rw [add_mul]
      have quantumMul :
          quantum scale * (scale.denominator : ℝ) = 1 := by
        simp [quantum, denominator_real_ne_zero scale]
      rw [quantumMul]

theorem quantizationError_nonnegative (scale : PositiveScale) (value : ℝ) :
    0 ≤ decode (quantizeUp scale value) - value := by
  linarith [value_le_decode_quantizeUp scale value]

theorem quantizationError_lt_quantum
    (scale : PositiveScale) {value : ℝ} (nonnegative : 0 ≤ value) :
    decode (quantizeUp scale value) - value < quantum scale := by
  linarith [decode_quantizeUp_lt_add_quantum scale nonnegative]

noncomputable def quantizedUpCost
    {Edit : Type u} (scale : PositiveScale)
    (cost : List Edit → List Edit → Edit → Edit → ℝ) :
    List Edit → List Edit → Edit → Edit → ℝ :=
  fun before after first second =>
    decode (quantizeUp scale (cost before after first second))

theorem primitiveCost_le_quantizedUpCost
    {Edit : Type u} (scale : PositiveScale)
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ) :
    PrimitiveSwapCostLe Independent cost (quantizedUpCost scale cost) := by
  intro before after first second independent
  exact value_le_decode_quantizeUp scale
    (cost before after first second)

theorem primitiveCost_quantizedUpCost_within
    {Edit : Type u} (scale : PositiveScale)
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0) :
    PrimitiveSwapCostWithin Independent cost (quantizedUpCost scale cost)
      (quantum scale) := by
  intro before after first second independent
  have lower := value_le_decode_quantizeUp scale
    (cost before after first second)
  have upper := decode_quantizeUp_lt_add_quantum scale
    (nonnegative before after first second independent)
  unfold quantizedUpCost
  rw [abs_of_nonpos (sub_nonpos.mpr lower)]
  linarith

theorem WeightedSwapStep.exists_quantizedUp
    {Edit : Type u} (scale : PositiveScale)
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {edgeCost : ℝ} {source target : List Edit}
    (edge : WeightedSwapStep Independent cost edgeCost source target) :
    ∃ quantizedEdgeCost,
      WeightedSwapStep Independent (quantizedUpCost scale cost)
        quantizedEdgeCost source target ∧
      edgeCost ≤ quantizedEdgeCost ∧
      quantizedEdgeCost ≤ edgeCost + quantum scale := by
  cases edge with
  | forward before after first second independent =>
      refine ⟨decode (quantizeUp scale (cost before after first second)),
        .forward before after first second independent, ?_, ?_⟩
      · exact value_le_decode_quantizeUp scale _
      · exact (decode_quantizeUp_lt_add_quantum scale
          (nonnegative before after first second independent)).le
  | backward before after first second independent =>
      refine ⟨decode (quantizeUp scale (cost before after first second)),
        .backward before after first second independent, ?_, ?_⟩
      · exact value_le_decode_quantizeUp scale _
      · exact (decode_quantizeUp_lt_add_quantum scale
          (nonnegative before after first second independent)).le

/-- A whole path can be re-costed with upward fixed-point quantization. The
quantized total is conservative and adds at most one quantum per edge. -/
theorem WeightedTracePath.exists_quantizedUp
    {Edit : Type u} (scale : PositiveScale)
    (Independent : Edit → Edit → Prop)
    (cost : List Edit → List Edit → Edit → Edit → ℝ)
    (nonnegative : PrimitiveSwapCostLowerBound Independent cost 0)
    {count : Nat} {pathCost : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent cost
      count pathCost source target) :
    ∃ quantizedPathCost,
      WeightedTracePath Independent (quantizedUpCost scale cost)
        count quantizedPathCost source target ∧
      pathCost ≤ quantizedPathCost ∧
      quantizedPathCost ≤ pathCost + (count : ℝ) * quantum scale := by
  induction path with
  | refl edits => exact ⟨0, .refl edits, le_rfl, by simp⟩
  | @step count edgeCost tailCost source next target edge rest
      inductionHypothesis =>
      obtain ⟨quantizedEdgeCost, quantizedEdge, edgeLower, edgeUpper⟩ :=
        WeightedSwapStep.exists_quantizedUp scale Independent cost
          nonnegative edge
      obtain ⟨quantizedTailCost, quantizedRest, tailLower, tailUpper⟩ :=
        inductionHypothesis
      refine ⟨quantizedEdgeCost + quantizedTailCost,
        .step quantizedEdge quantizedRest,
        add_le_add edgeLower tailLower, ?_⟩
      calc
        quantizedEdgeCost + quantizedTailCost ≤
            (edgeCost + quantum scale) +
              (tailCost + (count : ℝ) * quantum scale) :=
          add_le_add edgeUpper tailUpper
        _ = edgeCost + tailCost +
            ((count + 1 : Nat) : ℝ) * quantum scale := by
          push_cast
          ring

/-- If a conservative quantized two-sided report certifies, then the original
unquantized errors also satisfy the stability premise. -/
theorem twoSidedReport_target_eq_of_quantized_certified
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError
      quantizedSelectedError quantizedComparisonError : ℝ)
    (selectedLe : selectedError ≤ quantizedSelectedError)
    (comparisonLe : comparisonError ≤ quantizedComparisonError)
    (stable : selectedError + comparisonError < margin →
      selectedTarget = bestTarget)
    (certified : (twoSidedReport selectedTarget bestTarget margin
      quantizedSelectedError quantizedComparisonError).verdict =
        .certifiedStable) :
    selectedTarget = bestTarget := by
  apply stable
  have quantizedBelow := (twoSidedReport_certified_iff selectedTarget
    bestTarget margin quantizedSelectedError quantizedComparisonError).mp
    certified
  exact lt_of_le_of_lt (add_le_add selectedLe comparisonLe) quantizedBelow

theorem overestimateReport_target_eq_of_quantized_certified
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin comparisonError quantizedComparisonError : ℝ)
    (comparisonLe : comparisonError ≤ quantizedComparisonError)
    (stable : comparisonError < margin → selectedTarget = bestTarget)
    (certified : (overestimateReport selectedTarget bestTarget margin
      quantizedComparisonError).verdict = .certifiedStable) :
    selectedTarget = bestTarget := by
  apply stable
  exact lt_of_le_of_lt comparisonLe
    ((overestimateReport_certified_iff selectedTarget bestTarget margin
      quantizedComparisonError).mp certified)

theorem underestimateReport_target_eq_of_quantized_certified
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError quantizedSelectedError : ℝ)
    (selectedLe : selectedError ≤ quantizedSelectedError)
    (stable : selectedError < margin → selectedTarget = bestTarget)
    (certified : (underestimateReport selectedTarget bestTarget margin
      quantizedSelectedError).verdict = .certifiedStable) :
    selectedTarget = bestTarget := by
  apply stable
  exact lt_of_le_of_lt selectedLe
    ((underestimateReport_certified_iff selectedTarget bestTarget margin
      quantizedSelectedError).mp certified)

theorem twoSidedReport_actual_certified_of_quantized
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError comparisonError
      quantizedSelectedError quantizedComparisonError : ℝ)
    (selectedLe : selectedError ≤ quantizedSelectedError)
    (comparisonLe : comparisonError ≤ quantizedComparisonError)
    (certified : (twoSidedReport selectedTarget bestTarget margin
      quantizedSelectedError quantizedComparisonError).verdict =
        .certifiedStable) :
    (twoSidedReport selectedTarget bestTarget margin
      selectedError comparisonError).verdict = .certifiedStable := by
  rw [twoSidedReport_certified_iff]
  exact lt_of_le_of_lt (add_le_add selectedLe comparisonLe)
    ((twoSidedReport_certified_iff selectedTarget bestTarget margin
      quantizedSelectedError quantizedComparisonError).mp certified)

theorem overestimateReport_actual_certified_of_quantized
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin comparisonError quantizedComparisonError : ℝ)
    (comparisonLe : comparisonError ≤ quantizedComparisonError)
    (certified : (overestimateReport selectedTarget bestTarget margin
      quantizedComparisonError).verdict = .certifiedStable) :
    (overestimateReport selectedTarget bestTarget margin
      comparisonError).verdict = .certifiedStable := by
  rw [overestimateReport_certified_iff]
  exact lt_of_le_of_lt comparisonLe
    ((overestimateReport_certified_iff selectedTarget bestTarget margin
      quantizedComparisonError).mp certified)

theorem underestimateReport_actual_certified_of_quantized
    {Edit : Type u} (selectedTarget bestTarget : List Edit)
    (margin selectedError quantizedSelectedError : ℝ)
    (selectedLe : selectedError ≤ quantizedSelectedError)
    (certified : (underestimateReport selectedTarget bestTarget margin
      quantizedSelectedError).verdict = .certifiedStable) :
    (underestimateReport selectedTarget bestTarget margin
      selectedError).verdict = .certifiedStable := by
  rw [underestimateReport_certified_iff]
  exact lt_of_le_of_lt selectedLe
    ((underestimateReport_certified_iff selectedTarget bestTarget margin
      quantizedSelectedError).mp certified)

end Sprawlens.FixedPointQuantization
