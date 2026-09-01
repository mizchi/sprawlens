import Sprawlens.HausdorffApproximation

namespace Sprawlens.FiniteHausdorffMaximum

open HausdorffApproximation
open Set

universe u

noncomputable section

variable {Point : Type u} [MetricSpace Point]

/-- Finite sample carrier with the nonemptiness needed by `Finset.max'`. -/
structure FiniteSamples (Point : Type u) where
  points : Finset Point
  nonempty : points.Nonempty

namespace FiniteSamples

def directedDistances
    (samples : FiniteSamples Point) (target : Set Point) : Finset ℝ :=
  samples.points.image (fun point => Metric.infDist point target)

theorem directedDistances_nonempty
    (samples : FiniteSamples Point) (target : Set Point) :
    (samples.directedDistances target).Nonempty := by
  exact samples.nonempty.image _

/-- Maximum nearest-target distance attained by a finite nonempty sample set. -/
def directedMaximum
    (samples : FiniteSamples Point) (target : Set Point) : ℝ :=
  (samples.directedDistances target).max'
    (samples.directedDistances_nonempty target)

theorem infDist_le_directedMaximum_of_mem
    (samples : FiniteSamples Point) (target : Set Point)
    {point : Point} (pointInSamples : point ∈ samples.points) :
    Metric.infDist point target ≤ samples.directedMaximum target := by
  apply Finset.le_max'
  exact Finset.mem_image.mpr ⟨point, pointInSamples, rfl⟩

theorem exists_infDist_eq_directedMaximum
    (samples : FiniteSamples Point) (target : Set Point) :
    ∃ point ∈ samples.points,
      samples.directedMaximum target = Metric.infDist point target := by
  have maximumInDistances := Finset.max'_mem
    (samples.directedDistances target)
    (samples.directedDistances_nonempty target)
  rcases Finset.mem_image.mp maximumInDistances with
    ⟨point, pointInSamples, pointAtMaximum⟩
  exact ⟨point, pointInSamples, pointAtMaximum.symm⟩

theorem directedMaximum_nonnegative
    (samples : FiniteSamples Point) (target : Set Point) :
    0 ≤ samples.directedMaximum target := by
  rcases samples.exists_infDist_eq_directedMaximum target with
    ⟨point, _, maximumAtPoint⟩
  rw [maximumAtPoint]
  exact Metric.infDist_nonneg

end FiniteSamples

theorem finiteSamples_directedDistances_nonempty
    (samples : FiniteSamples Point) (target : Set Point) :
    (samples.directedDistances target).Nonempty :=
  samples.directedDistances_nonempty target

theorem finiteSamples_infDist_le_directedMaximum_of_mem
    (samples : FiniteSamples Point) (target : Set Point)
    {point : Point} (pointInSamples : point ∈ samples.points) :
    Metric.infDist point target ≤ samples.directedMaximum target :=
  samples.infDist_le_directedMaximum_of_mem target pointInSamples

theorem finiteSamples_exists_infDist_eq_directedMaximum
    (samples : FiniteSamples Point) (target : Set Point) :
    ∃ point ∈ samples.points,
      samples.directedMaximum target = Metric.infDist point target :=
  samples.exists_infDist_eq_directedMaximum target

theorem finiteSamples_directedMaximum_nonnegative
    (samples : FiniteSamples Point) (target : Set Point) :
    0 ≤ samples.directedMaximum target :=
  samples.directedMaximum_nonnegative target

/-- Symmetric sampled Hausdorff estimate used by the executable algorithm. -/
def sampledHausdorffEstimate
    (sourceSamples targetSamples : FiniteSamples Point)
    (source target : Set Point) : ℝ :=
  max (sourceSamples.directedMaximum target)
    (targetSamples.directedMaximum source)

theorem source_infDist_le_sampledHausdorffEstimate
    (sourceSamples targetSamples : FiniteSamples Point)
    (source target : Set Point) {point : Point}
    (pointInSamples : point ∈ sourceSamples.points) :
    Metric.infDist point target ≤
      sampledHausdorffEstimate sourceSamples targetSamples source target := by
  exact (sourceSamples.infDist_le_directedMaximum_of_mem
    target pointInSamples).trans (le_max_left _ _)

theorem target_infDist_le_sampledHausdorffEstimate
    (sourceSamples targetSamples : FiniteSamples Point)
    (source target : Set Point) {point : Point}
    (pointInSamples : point ∈ targetSamples.points) :
    Metric.infDist point source ≤
      sampledHausdorffEstimate sourceSamples targetSamples source target := by
  exact (targetSamples.infDist_le_directedMaximum_of_mem
    source pointInSamples).trans (le_max_right _ _)

theorem sampledHausdorffEstimate_witness
    (sourceSamples targetSamples : FiniteSamples Point)
    (source target : Set Point) :
    (∃ point ∈ sourceSamples.points,
      sampledHausdorffEstimate sourceSamples targetSamples source target =
        Metric.infDist point target) ∨
    (∃ point ∈ targetSamples.points,
      sampledHausdorffEstimate sourceSamples targetSamples source target =
        Metric.infDist point source) := by
  rcases le_total
      (sourceSamples.directedMaximum target)
      (targetSamples.directedMaximum source) with
    sourceLeTarget | targetLeSource
  · right
    rcases targetSamples.exists_infDist_eq_directedMaximum source with
      ⟨point, pointInSamples, maximumAtPoint⟩
    exact ⟨point, pointInSamples, by
      rw [sampledHausdorffEstimate, max_eq_right sourceLeTarget,
        maximumAtPoint]⟩
  · left
    rcases sourceSamples.exists_infDist_eq_directedMaximum target with
      ⟨point, pointInSamples, maximumAtPoint⟩
    exact ⟨point, pointInSamples, by
      rw [sampledHausdorffEstimate, max_eq_left targetLeSource,
        maximumAtPoint]⟩

theorem sampledHausdorffEstimate_nonnegative
    (sourceSamples targetSamples : FiniteSamples Point)
    (source target : Set Point) :
    0 ≤ sampledHausdorffEstimate sourceSamples targetSamples source target :=
  (sourceSamples.directedMaximum_nonnegative target).trans
    (le_max_left _ _)

/-- Finite nonempty sample sets automatically discharge all maximum-related
fields of the Hausdorff certificate. Only epsilon-net proofs remain. -/
theorem finiteSamplesCertificate
    (source target : BoundaryDiscrepancy.CompactBoundary Point)
    (sourceSamples targetSamples : FiniteSamples Point)
    (sourceEpsilon targetEpsilon : ℝ)
    (sourceNet : IsEpsilonNet (sourceSamples.points : Set Point)
      (source : Set Point) sourceEpsilon)
    (targetNet : IsEpsilonNet (targetSamples.points : Set Point)
      (target : Set Point) targetEpsilon)
    (sourceEpsilonNonnegative : 0 ≤ sourceEpsilon)
    (targetEpsilonNonnegative : 0 ≤ targetEpsilon) :
    Certificate source target sourceSamples.points targetSamples.points
      (sampledHausdorffEstimate sourceSamples targetSamples source target)
      sourceEpsilon targetEpsilon where
  sourceNet := sourceNet
  targetNet := targetNet
  sourceSampleUpper := by
    intro point pointInSamples
    exact source_infDist_le_sampledHausdorffEstimate
      sourceSamples targetSamples source target pointInSamples
  targetSampleUpper := by
    intro point pointInSamples
    exact target_infDist_le_sampledHausdorffEstimate
      sourceSamples targetSamples source target pointInSamples
  estimateWitness := sampledHausdorffEstimate_witness
    sourceSamples targetSamples source target
  estimate_nonnegative := sampledHausdorffEstimate_nonnegative
    sourceSamples targetSamples source target
  sourceEpsilon_nonnegative := sourceEpsilonNonnegative
  targetEpsilon_nonnegative := targetEpsilonNonnegative

theorem finiteSamplesHausdorffInterval
    (source target : BoundaryDiscrepancy.CompactBoundary Point)
    (sourceSamples targetSamples : FiniteSamples Point)
    (sourceEpsilon targetEpsilon : ℝ)
    (sourceNet : IsEpsilonNet (sourceSamples.points : Set Point)
      (source : Set Point) sourceEpsilon)
    (targetNet : IsEpsilonNet (targetSamples.points : Set Point)
      (target : Set Point) targetEpsilon)
    (sourceEpsilonNonnegative : 0 ≤ sourceEpsilon)
    (targetEpsilonNonnegative : 0 ≤ targetEpsilon) :
    sampledHausdorffEstimate sourceSamples targetSamples source target ≤
        dist source target ∧
      dist source target ≤
        sampledHausdorffEstimate sourceSamples targetSamples source target +
          max sourceEpsilon targetEpsilon := by
  exact certifiedHausdorff_interval
    (finiteSamplesCertificate source target sourceSamples targetSamples
      sourceEpsilon targetEpsilon sourceNet targetNet
      sourceEpsilonNonnegative targetEpsilonNonnegative)

end

end Sprawlens.FiniteHausdorffMaximum
