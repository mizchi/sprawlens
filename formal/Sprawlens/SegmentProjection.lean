import Mathlib.Analysis.InnerProductSpace.Projection.Minimal
import Mathlib.Analysis.Normed.Affine.AddTorsor
import Mathlib.Topology.MetricSpace.HausdorffDistance
import Mathlib.Topology.MetricSpace.Lipschitz

namespace Sprawlens.SegmentProjection

open Set
local notation "⟪" point ", " direction "⟫_ℝ" =>
  inner ℝ point direction

/-- Clamp a real interpolation parameter to the closed unit interval. This is
the exact-real counterpart of `Math.max(0, Math.min(1, parameter))`. -/
def unitClamp (parameter : ℝ) : ℝ :=
  max 0 (min 1 parameter)

theorem unitClamp_mem_Icc (parameter : ℝ) :
    unitClamp parameter ∈ Icc (0 : ℝ) 1 := by
  constructor
  · exact le_max_left _ _
  · exact max_le (by norm_num) (min_le_left _ _)

/-- Clamping cannot amplify an error in the raw projection parameter. -/
theorem unitClamp_lipschitz : LipschitzWith 1 unitClamp := by
  change LipschitzWith 1 (fun parameter : ℝ => max 0 (min 1 parameter))
  simpa [unitClamp, Function.id_def] using
    ((LipschitzWith.id.const_min (1 : ℝ)).const_max 0)

/-- Absolute error of a quotient in terms of errors in its numerator and
positive denominator. This theorem is arithmetic-model independent; an
IEEE-754 analysis only needs to supply bounds for the two input errors. -/
theorem abs_quotient_sub_quotient_le
    (exactNumerator approximateNumerator : ℝ)
    (exactDenominator approximateDenominator : ℝ)
    (exactDenominatorPositive : 0 < exactDenominator)
    (approximateDenominatorPositive : 0 < approximateDenominator) :
    |approximateNumerator / approximateDenominator -
        exactNumerator / exactDenominator| ≤
      (|approximateNumerator - exactNumerator| * exactDenominator +
          |exactNumerator| *
            |approximateDenominator - exactDenominator|) /
        (approximateDenominator * exactDenominator) := by
  rw [div_sub_div _ _ approximateDenominatorPositive.ne'
    exactDenominatorPositive.ne', abs_div,
    abs_of_pos (mul_pos approximateDenominatorPositive
      exactDenominatorPositive)]
  apply (div_le_div_iff_of_pos_right
    (mul_pos approximateDenominatorPositive
      exactDenominatorPositive)).2
  have numeratorIdentity :
      approximateNumerator * exactDenominator -
          approximateDenominator * exactNumerator =
        (approximateNumerator - exactNumerator) * exactDenominator -
          exactNumerator *
            (approximateDenominator - exactDenominator) := by
    ring
  rw [numeratorIdentity]
  calc
    |(approximateNumerator - exactNumerator) * exactDenominator -
        exactNumerator *
          (approximateDenominator - exactDenominator)| ≤
        |(approximateNumerator - exactNumerator) * exactDenominator| +
          |exactNumerator *
            (approximateDenominator - exactDenominator)| :=
      abs_sub _ _
    _ = |approximateNumerator - exactNumerator| * exactDenominator +
          |exactNumerator| *
            |approximateDenominator - exactDenominator| := by
      rw [abs_mul, abs_mul, abs_of_pos exactDenominatorPositive]

/-- A perturbed denominator stays positive when its absolute error is smaller
than the positive exact denominator. This condition is load-bearing for the
quotient error theorem and exposes why near-zero edges need a separate policy. -/
theorem approximateDenominator_pos_of_abs_sub_lt_exact
    (exactDenominator approximateDenominator : ℝ)
    (denominatorErrorSmall :
      |approximateDenominator - exactDenominator| < exactDenominator) :
    0 < approximateDenominator := by
  have lower := neg_abs_le (approximateDenominator - exactDenominator)
  linarith

/-- Scalar optimality condition behind projection onto a closed segment. -/
theorem unitClamp_optimality
    (numerator denominator parameter : ℝ)
    (denominatorPositive : 0 < denominator)
    (parameterInUnitInterval : parameter ∈ Icc (0 : ℝ) 1) :
    (parameter - unitClamp (numerator / denominator)) *
        (numerator - unitClamp (numerator / denominator) * denominator) ≤ 0 := by
  by_cases below : numerator / denominator ≤ 0
  · have numeratorNonpositive : numerator ≤ 0 := by
      simpa using (div_le_iff₀ denominatorPositive).mp below
    have clamped : unitClamp (numerator / denominator) = 0 := by
      rw [unitClamp, min_eq_right (by linarith), max_eq_left below]
    simpa [clamped] using
      mul_nonpos_of_nonneg_of_nonpos parameterInUnitInterval.1 numeratorNonpositive
  · have ratioPositive : 0 < numerator / denominator := lt_of_not_ge below
    by_cases above : 1 ≤ numerator / denominator
    · have denominatorLeNumerator : denominator ≤ numerator := by
        simpa using (le_div_iff₀ denominatorPositive).mp above
      have clamped : unitClamp (numerator / denominator) = 1 := by
        rw [unitClamp, min_eq_left above]
        norm_num
      simpa [clamped] using
        mul_nonpos_of_nonpos_of_nonneg
          (sub_nonpos.mpr parameterInUnitInterval.2)
          (sub_nonneg.mpr denominatorLeNumerator)
    · have ratioBelowOne : numerator / denominator < 1 := lt_of_not_ge above
      have clamped : unitClamp (numerator / denominator) = numerator / denominator := by
        rw [unitClamp, min_eq_right ratioBelowOne.le,
          max_eq_right ratioPositive.le]
      rw [clamped]
      have residual : numerator - numerator / denominator * denominator = 0 := by
        field_simp
        ring
      rw [residual, mul_zero]

variable {E : Type*} [NormedAddCommGroup E] [InnerProductSpace ℝ E]

/-- The numerator used by the point-to-segment projection formula. -/
def projectionNumerator (point start finish : E) : ℝ :=
  ⟪point - start, finish - start⟫_ℝ

/-- The nonnegative denominator used by the point-to-segment projection
formula. -/
def projectionDenominator (start finish : E) : ℝ :=
  ‖finish - start‖ ^ 2

/-- Parameter selected by the implementation's point-to-segment projection.
The degenerate segment branch selects its unique endpoint. -/
noncomputable def projectionParameter (point start finish : E) : ℝ :=
  by
    classical
    exact if start = finish then 0
      else unitClamp
        (projectionNumerator point start finish /
          projectionDenominator start finish)

/-- Point on the closed segment selected by `projectionParameter`. -/
noncomputable def segmentProjection (point start finish : E) : E :=
  AffineMap.lineMap start finish (projectionParameter point start finish)

theorem inner_lineMap_difference
    (point start finish : E) (selected parameter : ℝ) :
    ⟪point - AffineMap.lineMap start finish selected,
        AffineMap.lineMap start finish parameter -
          AffineMap.lineMap start finish selected⟫_ℝ =
      (parameter - selected) *
        (projectionNumerator point start finish -
          selected * projectionDenominator start finish) := by
  simp only [AffineMap.lineMap_apply_module']
  have pointDifference :
      point - (selected • (finish - start) + start) =
        (point - start) - selected • (finish - start) := by
    abel
  have segmentDifference :
      parameter • (finish - start) + start -
          (selected • (finish - start) + start) =
        (parameter - selected) • (finish - start) := by
    module
  have directionInner :
      ⟪finish, finish - start⟫_ℝ =
        ⟪start, finish - start⟫_ℝ + ‖finish - start‖ ^ 2 := by
    have identity :
        ⟪finish - start, finish - start⟫_ℝ =
          ⟪finish, finish - start⟫_ℝ -
            ⟪start, finish - start⟫_ℝ :=
      inner_sub_left finish start (finish - start)
    rw [real_inner_self_eq_norm_sq] at identity
    linarith
  rw [pointDifference, segmentDifference]
  simp only [projectionNumerator, projectionDenominator, inner_sub_left,
    inner_smul_left, inner_smul_right, starRingEnd_apply, star_trivial]
  rw [directionInner]
  ring

/-- A raw-parameter error moves the clamped point by at most that error times
the edge length. This is the geometric interface for later floating-point
analysis. -/
theorem dist_clamped_lineMap_le_parameter_error
    (start finish : E) (firstParameter secondParameter : ℝ) :
    dist
        (AffineMap.lineMap start finish (unitClamp firstParameter))
        (AffineMap.lineMap start finish (unitClamp secondParameter)) ≤
      |firstParameter - secondParameter| * dist start finish := by
  rw [dist_lineMap_lineMap, Real.dist_eq]
  have clampBound :
      |unitClamp firstParameter - unitClamp secondParameter| ≤
        |firstParameter - secondParameter| := by
    simpa [Real.dist_eq] using
      unitClamp_lipschitz.dist_le_mul firstParameter secondParameter
  exact mul_le_mul_of_nonneg_right
    clampBound dist_nonneg

/-- The reported point distance has the same error bound as the projected
point, by the reverse triangle inequality. -/
theorem abs_dist_clamped_lineMap_sub_le_parameter_error
    (point start finish : E) (firstParameter secondParameter : ℝ) :
    |dist point
          (AffineMap.lineMap start finish (unitClamp firstParameter)) -
        dist point
          (AffineMap.lineMap start finish (unitClamp secondParameter))| ≤
      |firstParameter - secondParameter| * dist start finish := by
  calc
    |dist point
          (AffineMap.lineMap start finish (unitClamp firstParameter)) -
        dist point
          (AffineMap.lineMap start finish (unitClamp secondParameter))| =
        dist
          (dist point
            (AffineMap.lineMap start finish (unitClamp firstParameter)))
          (dist point
            (AffineMap.lineMap start finish (unitClamp secondParameter))) := by
      rw [Real.dist_eq]
    _ ≤ dist
          (AffineMap.lineMap start finish (unitClamp firstParameter))
          (AffineMap.lineMap start finish (unitClamp secondParameter)) :=
      dist_dist_dist_le_right _ _ _
    _ ≤ |firstParameter - secondParameter| * dist start finish :=
      dist_clamped_lineMap_le_parameter_error
        start finish firstParameter secondParameter

/-- End-to-end propagation from approximate quotient inputs to the reported
point-to-segment distance. Coordinate-level floating-point analysis can plug
its numerator and denominator error bounds into this exact-real interface. -/
theorem abs_dist_approximate_quotient_sub_exact_le
    (point start finish : E)
    (exactNumerator approximateNumerator : ℝ)
    (exactDenominator approximateDenominator : ℝ)
    (exactDenominatorPositive : 0 < exactDenominator)
    (approximateDenominatorPositive : 0 < approximateDenominator) :
    |dist point
          (AffineMap.lineMap start finish
            (unitClamp
              (approximateNumerator / approximateDenominator))) -
        dist point
          (AffineMap.lineMap start finish
            (unitClamp (exactNumerator / exactDenominator)))| ≤
      ((|approximateNumerator - exactNumerator| * exactDenominator +
          |exactNumerator| *
            |approximateDenominator - exactDenominator|) /
        (approximateDenominator * exactDenominator)) *
          dist start finish := by
  calc
    |dist point
          (AffineMap.lineMap start finish
            (unitClamp
              (approximateNumerator / approximateDenominator))) -
        dist point
          (AffineMap.lineMap start finish
            (unitClamp (exactNumerator / exactDenominator)))| ≤
        |approximateNumerator / approximateDenominator -
          exactNumerator / exactDenominator| * dist start finish :=
      abs_dist_clamped_lineMap_sub_le_parameter_error
        point start finish
        (approximateNumerator / approximateDenominator)
        (exactNumerator / exactDenominator)
    _ ≤ ((|approximateNumerator - exactNumerator| * exactDenominator +
            |exactNumerator| *
              |approximateDenominator - exactDenominator|) /
          (approximateDenominator * exactDenominator)) *
            dist start finish :=
      mul_le_mul_of_nonneg_right
        (abs_quotient_sub_quotient_le
          exactNumerator approximateNumerator
          exactDenominator approximateDenominator
          exactDenominatorPositive approximateDenominatorPositive)
        dist_nonneg

theorem projectionParameter_mem_Icc (point start finish : E) :
    projectionParameter point start finish ∈ Icc (0 : ℝ) 1 := by
  classical
  by_cases degenerate : start = finish
  · simp [projectionParameter, degenerate]
  · simpa [projectionParameter, degenerate] using
      unitClamp_mem_Icc
        (projectionNumerator point start finish /
          projectionDenominator start finish)

theorem segmentProjection_mem_segment (point start finish : E) :
    segmentProjection point start finish ∈ segment ℝ start finish := by
  exact lineMap_mem_segment ℝ start finish
    (projectionParameter_mem_Icc point start finish)

omit [InnerProductSpace ℝ E] in
theorem projectionDenominator_pos {start finish : E}
    (nondegenerate : start ≠ finish) :
    0 < projectionDenominator start finish := by
  have directionNonzero : finish - start ≠ 0 :=
    sub_ne_zero.mpr nondegenerate.symm
  simp only [projectionDenominator]
  positivity

/-- The clamped projection point attains the minimum distance to the entire
closed segment. This covers both nondegenerate and zero-length segments. -/
theorem segmentProjection_norm_eq_iInf
    (point start finish : E) :
    ‖point - segmentProjection point start finish‖ =
      ⨅ candidate : segment ℝ start finish, ‖point - candidate‖ := by
  apply (norm_eq_iInf_iff_real_inner_le_zero
    (convex_segment (𝕜 := ℝ) start finish)
    (segmentProjection_mem_segment point start finish)).2
  intro candidate candidateOnSegment
  rw [segment_eq_image_lineMap] at candidateOnSegment
  rcases candidateOnSegment with ⟨parameter, parameterInUnitInterval, rfl⟩
  classical
  by_cases degenerate : start = finish
  · subst finish
    simp [segmentProjection, projectionParameter]
  · rw [segmentProjection, inner_lineMap_difference]
    simp only [projectionParameter, if_neg degenerate]
    exact unitClamp_optimality
      (projectionNumerator point start finish)
      (projectionDenominator start finish)
      parameter
      (projectionDenominator_pos degenerate)
      parameterInUnitInterval

/-- Exact-real contract for the implementation's point-to-segment distance:
distance to the clamp-projected point is exactly the metric infimum over the
closed segment. -/
theorem infDist_segment_eq_dist_projection
    (point start finish : E) :
    Metric.infDist point (segment ℝ start finish) =
      dist point (segmentProjection point start finish) := by
  simpa only [Metric.infDist_eq_iInf, dist_eq_norm] using
    (segmentProjection_norm_eq_iInf point start finish).symm

end Sprawlens.SegmentProjection
