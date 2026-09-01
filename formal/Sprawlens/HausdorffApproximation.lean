import Sprawlens.PolygonBoundaryMetric

namespace Sprawlens.HausdorffApproximation

open BoundaryDiscrepancy
open Set

universe u

variable {Point : Type u} [MetricSpace Point]

/-- `samples` covers `source` within `epsilon`, while remaining a subset of
the source. This is the proof-side contract supplied by a boundary sampler. -/
def IsEpsilonNet
    (samples source : Set Point) (epsilon : ℝ) : Prop :=
  samples ⊆ source ∧
    ∀ point ∈ source, ∃ sample ∈ samples, dist point sample ≤ epsilon

/-- Local nets compose across a union. This supports edge-local polygon
sampling without constructing a global piecewise path. -/
theorem IsEpsilonNet.union
    {firstSamples firstSource secondSamples secondSource : Set Point}
    {firstEpsilon secondEpsilon : ℝ}
    (firstNet : IsEpsilonNet firstSamples firstSource firstEpsilon)
    (secondNet : IsEpsilonNet secondSamples secondSource secondEpsilon) :
    IsEpsilonNet (firstSamples ∪ secondSamples)
      (firstSource ∪ secondSource) (max firstEpsilon secondEpsilon) := by
  constructor
  · exact union_subset_union firstNet.1 secondNet.1
  · intro point pointInUnion
    rcases pointInUnion with pointInFirst | pointInSecond
    · rcases firstNet.2 point pointInFirst with
        ⟨sample, sampleInFirst, pointNearSample⟩
      exact ⟨sample, Or.inl sampleInFirst,
        pointNearSample.trans (le_max_left _ _)⟩
    · rcases secondNet.2 point pointInSecond with
        ⟨sample, sampleInSecond, pointNearSample⟩
      exact ⟨sample, Or.inr sampleInSecond,
        pointNearSample.trans (le_max_right _ _)⟩

/-- Evidence needed to turn a finite sampled maximum into a certified interval
for the exact Hausdorff distance. Finiteness and maximum computation belong to
the executable refinement; the theorem only consumes their observable
consequences. -/
structure Certificate
    (source target : CompactBoundary Point)
    (sourceSamples targetSamples : Set Point)
    (estimate sourceEpsilon targetEpsilon : ℝ) : Prop where
  sourceNet : IsEpsilonNet sourceSamples source sourceEpsilon
  targetNet : IsEpsilonNet targetSamples target targetEpsilon
  sourceSampleUpper :
    ∀ point ∈ sourceSamples, Metric.infDist point target ≤ estimate
  targetSampleUpper :
    ∀ point ∈ targetSamples, Metric.infDist point source ≤ estimate
  estimateWitness :
    (∃ point ∈ sourceSamples, estimate = Metric.infDist point target) ∨
      (∃ point ∈ targetSamples, estimate = Metric.infDist point source)
  estimate_nonnegative : 0 ≤ estimate
  sourceEpsilon_nonnegative : 0 ≤ sourceEpsilon
  targetEpsilon_nonnegative : 0 ≤ targetEpsilon

theorem certifiedHausdorff_upper
    {source target : CompactBoundary Point}
    {sourceSamples targetSamples : Set Point}
    {estimate sourceEpsilon targetEpsilon : ℝ}
    (certificate : Certificate source target sourceSamples targetSamples
      estimate sourceEpsilon targetEpsilon) :
    dist source target ≤ estimate + max sourceEpsilon targetEpsilon := by
  rw [Metric.NonemptyCompacts.dist_eq]
  apply Metric.hausdorffDist_le_of_infDist
    (add_nonneg certificate.estimate_nonnegative
      (certificate.sourceEpsilon_nonnegative.trans (le_max_left _ _)))
  · intro point pointInSource
    rcases certificate.sourceNet.2 point pointInSource with
      ⟨sample, sampleInSource, pointNearSample⟩
    calc
      Metric.infDist point target ≤
          Metric.infDist sample target + dist point sample :=
        Metric.infDist_le_infDist_add_dist
      _ ≤ estimate + sourceEpsilon :=
        add_le_add
          (certificate.sourceSampleUpper sample sampleInSource)
          pointNearSample
      _ ≤ estimate + max sourceEpsilon targetEpsilon :=
        add_le_add (le_refl estimate) (le_max_left _ _)
  · intro point pointInTarget
    rcases certificate.targetNet.2 point pointInTarget with
      ⟨sample, sampleInTarget, pointNearSample⟩
    calc
      Metric.infDist point source ≤
          Metric.infDist sample source + dist point sample :=
        Metric.infDist_le_infDist_add_dist
      _ ≤ estimate + targetEpsilon :=
        add_le_add
          (certificate.targetSampleUpper sample sampleInTarget)
          pointNearSample
      _ ≤ estimate + max sourceEpsilon targetEpsilon :=
        add_le_add (le_refl estimate) (le_max_right _ _)

theorem certifiedHausdorff_lower
    {source target : CompactBoundary Point}
    {sourceSamples targetSamples : Set Point}
    {estimate sourceEpsilon targetEpsilon : ℝ}
    (certificate : Certificate source target sourceSamples targetSamples
      estimate sourceEpsilon targetEpsilon) :
    estimate ≤ dist source target := by
  rw [Metric.NonemptyCompacts.dist_eq]
  have sourceTargetFinite :
      Metric.hausdorffEDist (source : Set Point) target ≠ ⊤ :=
    Metric.hausdorffEDist_ne_top_of_nonempty_of_bounded
      source.nonempty target.nonempty source.isCompact.isBounded
      target.isCompact.isBounded
  have targetSourceFinite :
      Metric.hausdorffEDist (target : Set Point) source ≠ ⊤ := by
    rw [Metric.hausdorffEDist_comm]
    exact sourceTargetFinite
  rcases certificate.estimateWitness with
    ⟨point, pointInSamples, estimateAtPoint⟩ |
      ⟨point, pointInSamples, estimateAtPoint⟩
  · rw [estimateAtPoint]
    exact Metric.infDist_le_hausdorffDist_of_mem
      (certificate.sourceNet.1 pointInSamples) sourceTargetFinite
  · rw [estimateAtPoint, Metric.hausdorffDist_comm]
    exact Metric.infDist_le_hausdorffDist_of_mem
      (certificate.targetNet.1 pointInSamples) targetSourceFinite

theorem certifiedHausdorff_interval
    {source target : CompactBoundary Point}
    {sourceSamples targetSamples : Set Point}
    {estimate sourceEpsilon targetEpsilon : ℝ}
    (certificate : Certificate source target sourceSamples targetSamples
      estimate sourceEpsilon targetEpsilon) :
    estimate ≤ dist source target ∧
      dist source target ≤ estimate + max sourceEpsilon targetEpsilon := by
  exact ⟨certifiedHausdorff_lower certificate,
    certifiedHausdorff_upper certificate⟩

/-- The executable estimate has additive error at most the larger sampling
radius. This is an exact-real theorem; floating-point roundoff is deliberately
outside its contract. -/
theorem certifiedHausdorff_abs_error_le
    {source target : CompactBoundary Point}
    {sourceSamples targetSamples : Set Point}
    {estimate sourceEpsilon targetEpsilon : ℝ}
    (certificate : Certificate source target sourceSamples targetSamples
      estimate sourceEpsilon targetEpsilon) :
    |dist source target - estimate| ≤ max sourceEpsilon targetEpsilon := by
  have lower := certifiedHausdorff_lower certificate
  have upper := certifiedHausdorff_upper certificate
  have epsilonNonnegative : 0 ≤ max sourceEpsilon targetEpsilon :=
    certificate.sourceEpsilon_nonnegative.trans (le_max_left _ _)
  rw [abs_le]
  constructor <;> linarith

end Sprawlens.HausdorffApproximation
