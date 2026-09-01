import Mathlib.Algebra.Order.Floor.Semifield
import Mathlib.Topology.MetricSpace.Lipschitz
import Sprawlens.HausdorffApproximation

namespace Sprawlens.ArcLengthSampling

open HausdorffApproximation
open Set

universe u

noncomputable section

/-- Distance between consecutive parameters of a uniform sampler. -/
def uniformStep (period : ℝ) (count : ℕ) : ℝ :=
  period / count

/-- Parameter grid including the right endpoint. The endpoint is useful while
proving interval coverage and is removed after mapping a closed curve. -/
def inclusiveUniformParameters (period : ℝ) (count : ℕ) : Set ℝ :=
  {parameter | ∃ index : ℕ, index ≤ count ∧
    parameter = index * uniformStep period count}

/-- Parameter grid used by the executable sampler: `0 ≤ index < count`. -/
def uniformParameters (period : ℝ) (count : ℕ) : Set ℝ :=
  {parameter | ∃ index : ℕ, index < count ∧
    parameter = index * uniformStep period count}

theorem count_mul_uniformStep
    (period : ℝ) {count : ℕ} (countPositive : 0 < count) :
    (count : ℝ) * uniformStep period count = period := by
  exact mul_div_cancel₀ period (by exact_mod_cast countPositive.ne')

/-- Every point of the parameter interval is at most one grid step from an
inclusive uniform sample. The one-step bound is deliberately conservative. -/
theorem inclusiveUniformParameters_isEpsilonNet
    (period : ℝ) (count : ℕ)
    (periodNonnegative : 0 ≤ period) (countPositive : 0 < count) :
    IsEpsilonNet (inclusiveUniformParameters period count)
      (Icc 0 period) (uniformStep period count) := by
  constructor
  · rintro parameter ⟨index, indexLeCount, rfl⟩
    have stepNonnegative : 0 ≤ uniformStep period count :=
      div_nonneg periodNonnegative (Nat.cast_nonneg count)
    constructor
    · apply mul_nonneg (Nat.cast_nonneg index)
      exact stepNonnegative
    · calc
        (index : ℝ) * uniformStep period count ≤
            (count : ℝ) * uniformStep period count := by
          gcongr
        _ = period := count_mul_uniformStep period countPositive
  · intro parameter parameterInInterval
    rcases periodNonnegative.eq_or_lt with periodZero | periodPositive
    · subst period
      have parameterZero : parameter = 0 := by
        exact le_antisymm parameterInInterval.2 parameterInInterval.1
      subst parameter
      refine ⟨0, ?_, ?_⟩
      · exact ⟨0, Nat.zero_le count, by simp [uniformStep]⟩
      · simp [uniformStep]
    · have stepPositive : 0 < uniformStep period count :=
        div_pos periodPositive (Nat.cast_pos.mpr countPositive)
      let index : ℕ := ⌊parameter / uniformStep period count⌋₊
      have quotientNonnegative :
          0 ≤ parameter / uniformStep period count :=
        div_nonneg parameterInInterval.1 stepPositive.le
      have floorLeQuotient :
          (index : ℝ) ≤ parameter / uniformStep period count := by
        exact Nat.floor_le quotientNonnegative
      have quotientLtFloorSucc :
          parameter / uniformStep period count < (index : ℝ) + 1 := by
        exact Nat.lt_floor_add_one _
      have quotientLeCount :
          parameter / uniformStep period count ≤ count := by
        apply (div_le_iff₀ stepPositive).2
        rw [count_mul_uniformStep period countPositive]
        exact parameterInInterval.2
      have indexLeCount : index ≤ count := by
        exact_mod_cast floorLeQuotient.trans quotientLeCount
      have sampleLeParameter :
          (index : ℝ) * uniformStep period count ≤ parameter :=
        (le_div_iff₀ stepPositive).mp floorLeQuotient
      have parameterLtNextSample :
          parameter < ((index : ℝ) + 1) * uniformStep period count :=
        (div_lt_iff₀ stepPositive).mp quotientLtFloorSucc
      refine ⟨(index : ℝ) * uniformStep period count, ?_, ?_⟩
      · exact ⟨index, indexLeCount, rfl⟩
      · rw [Real.dist_eq, abs_of_nonneg (sub_nonneg.mpr sampleLeParameter)]
        linarith

variable {Point : Type u} [MetricSpace Point]

/-- Image of the closed parameter interval: the abstract boundary traced by a
curve with a declared period. -/
def curveBoundary (curve : ℝ → Point) (period : ℝ) : Set Point :=
  curve '' Icc 0 period

def inclusiveUniformCurveSamples
    (curve : ℝ → Point) (period : ℝ) (count : ℕ) : Set Point :=
  curve '' inclusiveUniformParameters period count

def uniformCurveSamples
    (curve : ℝ → Point) (period : ℝ) (count : ℕ) : Set Point :=
  curve '' uniformParameters period count

/-- A nonempty compact Hausdorff carrier constructed from a nonexpansive
closed-interval parameterization. -/
def curveCompactBoundary
    (curve : ℝ → Point) (period : ℝ) (periodNonnegative : 0 ≤ period)
    (curveDistance : ∀ first ∈ Icc (0 : ℝ) period,
      ∀ second ∈ Icc (0 : ℝ) period,
        dist (curve first) (curve second) ≤ dist first second) :
    BoundaryDiscrepancy.CompactBoundary Point where
  carrier := curveBoundary curve period
  isCompact' := by
    apply isCompact_Icc.image_of_continuousOn
    apply LipschitzOnWith.continuousOn
    apply LipschitzOnWith.of_dist_le_mul (K := 1)
    intro first firstInInterval second secondInInterval
    simpa using curveDistance first firstInInterval second secondInInterval
  nonempty' := by
    exact ⟨curve 0, ⟨0, ⟨le_rfl, periodNonnegative⟩, rfl⟩⟩

@[simp]
theorem curveCompactBoundary_coe
    (curve : ℝ → Point) (period : ℝ) (periodNonnegative : 0 ≤ period)
    (curveDistance : ∀ first ∈ Icc (0 : ℝ) period,
      ∀ second ∈ Icc (0 : ℝ) period,
        dist (curve first) (curve second) ≤ dist first second) :
    (curveCompactBoundary curve period periodNonnegative curveDistance : Set Point) =
      curveBoundary curve period := by
  rfl

/-- A 1-Lipschitz arc-length parameterization transports the uniform parameter
net to a boundary net with the same radius. -/
theorem inclusiveUniformCurveSamples_isEpsilonNet
    (curve : ℝ → Point) (period : ℝ) (count : ℕ)
    (periodNonnegative : 0 ≤ period) (countPositive : 0 < count)
    (curveDistance : ∀ first ∈ Icc (0 : ℝ) period,
      ∀ second ∈ Icc (0 : ℝ) period,
        dist (curve first) (curve second) ≤ dist first second) :
    IsEpsilonNet (inclusiveUniformCurveSamples curve period count)
      (curveBoundary curve period) (uniformStep period count) := by
  have parameterNet := inclusiveUniformParameters_isEpsilonNet
    period count periodNonnegative countPositive
  constructor
  · rintro point ⟨parameter, parameterInSamples, rfl⟩
    exact ⟨parameter, parameterNet.1 parameterInSamples, rfl⟩
  · rintro point ⟨parameter, parameterInInterval, rfl⟩
    rcases parameterNet.2 parameter parameterInInterval with
      ⟨sample, sampleInGrid, parameterNearSample⟩
    refine ⟨curve sample, ⟨sample, sampleInGrid, rfl⟩, ?_⟩
    exact (curveDistance parameter parameterInInterval sample
      (parameterNet.1 sampleInGrid)).trans parameterNearSample

omit [MetricSpace Point] in
/-- On a closed curve, the inclusive endpoint sample is the zero sample.
Therefore the mathematical sample set equals the executable `< count` set. -/
theorem inclusiveUniformCurveSamples_eq_uniformCurveSamples
    (curve : ℝ → Point) (period : ℝ) (count : ℕ)
    (countPositive : 0 < count) (curveClosed : curve period = curve 0) :
    inclusiveUniformCurveSamples curve period count =
      uniformCurveSamples curve period count := by
  apply Subset.antisymm
  · rintro point ⟨parameter, ⟨index, indexLeCount, rfl⟩, rfl⟩
    rcases indexLeCount.eq_or_lt with indexEqualsCount | indexLtCount
    · subst index
      refine ⟨0, ⟨0, countPositive, by simp [uniformStep]⟩, ?_⟩
      rw [count_mul_uniformStep period countPositive]
      exact curveClosed.symm
    · exact ⟨(index : ℝ) * uniformStep period count,
        ⟨index, indexLtCount, rfl⟩, rfl⟩
  · rintro point ⟨parameter, ⟨index, indexLtCount, rfl⟩, rfl⟩
    exact ⟨(index : ℝ) * uniformStep period count,
      ⟨index, indexLtCount.le, rfl⟩, rfl⟩

/-- Exact-real contract corresponding to the TypeScript uniform arc-length
sampler. Polygon-specific construction of `curve` remains a refinement step. -/
theorem uniformCurveSamples_isEpsilonNet
    (curve : ℝ → Point) (period : ℝ) (count : ℕ)
    (periodNonnegative : 0 ≤ period) (countPositive : 0 < count)
    (curveClosed : curve period = curve 0)
    (curveDistance : ∀ first ∈ Icc (0 : ℝ) period,
      ∀ second ∈ Icc (0 : ℝ) period,
        dist (curve first) (curve second) ≤ dist first second) :
    IsEpsilonNet (uniformCurveSamples curve period count)
      (curveBoundary curve period) (uniformStep period count) := by
  rw [← inclusiveUniformCurveSamples_eq_uniformCurveSamples
    curve period count countPositive curveClosed]
  exact inclusiveUniformCurveSamples_isEpsilonNet curve period count
    periodNonnegative countPositive curveDistance

/-- Contract for a closed curve parameterized no faster than unit speed.
Arc-length parameterizations are the equality case; allowing slower traces
also preserves the sampling bound. -/
structure ArcLengthTrace (Point : Type u) [MetricSpace Point] where
  curve : ℝ → Point
  period : ℝ
  period_nonnegative : 0 ≤ period
  curve_closed : curve period = curve 0
  curve_distance : ∀ first ∈ Icc (0 : ℝ) period,
    ∀ second ∈ Icc (0 : ℝ) period,
      dist (curve first) (curve second) ≤ dist first second

namespace ArcLengthTrace

def compactBoundary (trace : ArcLengthTrace Point) :
    BoundaryDiscrepancy.CompactBoundary Point :=
  curveCompactBoundary trace.curve trace.period
    trace.period_nonnegative trace.curve_distance

def samples (trace : ArcLengthTrace Point) (count : ℕ) : Set Point :=
  uniformCurveSamples trace.curve trace.period count

def epsilon (trace : ArcLengthTrace Point) (count : ℕ) : ℝ :=
  uniformStep trace.period count

@[simp]
theorem compactBoundary_coe (trace : ArcLengthTrace Point) :
    (trace.compactBoundary : Set Point) =
      curveBoundary trace.curve trace.period := by
  rfl

theorem samples_isEpsilonNet
    (trace : ArcLengthTrace Point) (count : ℕ)
    (countPositive : 0 < count) :
    IsEpsilonNet (trace.samples count) trace.compactBoundary
      (trace.epsilon count) := by
  exact uniformCurveSamples_isEpsilonNet
    trace.curve trace.period count trace.period_nonnegative countPositive
    trace.curve_closed trace.curve_distance

/-- Constructor discharging all geometric sampling obligations of a
Hausdorff certificate. The remaining hypotheses describe the finite maximum
calculation performed by the executable implementation. -/
theorem hausdorffCertificate
    (source target : ArcLengthTrace Point) (count : ℕ)
    (countPositive : 0 < count) (estimate : ℝ)
    (sourceSampleUpper : ∀ point ∈ source.samples count,
      Metric.infDist point target.compactBoundary ≤ estimate)
    (targetSampleUpper : ∀ point ∈ target.samples count,
      Metric.infDist point source.compactBoundary ≤ estimate)
    (estimateWitness :
      (∃ point ∈ source.samples count,
        estimate = Metric.infDist point target.compactBoundary) ∨
      (∃ point ∈ target.samples count,
        estimate = Metric.infDist point source.compactBoundary))
    (estimateNonnegative : 0 ≤ estimate) :
    Certificate source.compactBoundary target.compactBoundary
      (source.samples count) (target.samples count) estimate
      (source.epsilon count) (target.epsilon count) where
  sourceNet := source.samples_isEpsilonNet count countPositive
  targetNet := target.samples_isEpsilonNet count countPositive
  sourceSampleUpper := sourceSampleUpper
  targetSampleUpper := targetSampleUpper
  estimateWitness := estimateWitness
  estimate_nonnegative := estimateNonnegative
  sourceEpsilon_nonnegative :=
    div_nonneg source.period_nonnegative (Nat.cast_nonneg count)
  targetEpsilon_nonnegative :=
    div_nonneg target.period_nonnegative (Nat.cast_nonneg count)

/-- The sampled maximum for two closed unit-speed-or-slower traces brackets
their exact compact-boundary Hausdorff distance. -/
theorem hausdorffInterval
    (source target : ArcLengthTrace Point) (count : ℕ)
    (countPositive : 0 < count) (estimate : ℝ)
    (sourceSampleUpper : ∀ point ∈ source.samples count,
      Metric.infDist point target.compactBoundary ≤ estimate)
    (targetSampleUpper : ∀ point ∈ target.samples count,
      Metric.infDist point source.compactBoundary ≤ estimate)
    (estimateWitness :
      (∃ point ∈ source.samples count,
        estimate = Metric.infDist point target.compactBoundary) ∨
      (∃ point ∈ target.samples count,
        estimate = Metric.infDist point source.compactBoundary))
    (estimateNonnegative : 0 ≤ estimate) :
    estimate ≤ dist source.compactBoundary target.compactBoundary ∧
      dist source.compactBoundary target.compactBoundary ≤
        estimate + max (source.epsilon count) (target.epsilon count) := by
  exact certifiedHausdorff_interval
    (hausdorffCertificate source target count countPositive estimate
      sourceSampleUpper targetSampleUpper estimateWitness
      estimateNonnegative)

end ArcLengthTrace

/-- Unit-speed traversal of the segment `[0, 1]` and back. -/
def triangleWave (parameter : ℝ) : ℝ :=
  1 - |parameter - 1|

theorem triangleWave_closed : triangleWave 2 = triangleWave 0 := by
  norm_num [triangleWave]

theorem triangleWave_distance_le (first second : ℝ) :
    dist (triangleWave first) (triangleWave second) ≤ dist first second := by
  rw [Real.dist_eq, Real.dist_eq]
  simpa [triangleWave, sub_sub_sub_cancel_right, abs_sub_comm] using
    (abs_abs_sub_abs_le_abs_sub (second - 1) (first - 1))

/-- Concrete positive-period witness that the trace contract is inhabited. -/
def triangleWaveTrace : ArcLengthTrace ℝ where
  curve := triangleWave
  period := 2
  period_nonnegative := by norm_num
  curve_closed := triangleWave_closed
  curve_distance := by
    intro first _ second _
    exact triangleWave_distance_le first second

theorem triangleWaveTrace_samples_isEpsilonNet
    (count : ℕ) (countPositive : 0 < count) :
    IsEpsilonNet (triangleWaveTrace.samples count)
      triangleWaveTrace.compactBoundary (2 / count) := by
  exact triangleWaveTrace.samples_isEpsilonNet count countPositive

end

end Sprawlens.ArcLengthSampling
