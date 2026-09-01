import Mathlib.Analysis.Normed.Affine.AddTorsor
import Sprawlens.ArcLengthSampling
import Sprawlens.FiniteHausdorffMaximum

namespace Sprawlens.PolygonBoundarySampling

open ArcLengthSampling
open HausdorffApproximation
open PolygonBoundaryMetric
open Set

universe u

noncomputable section

variable {E : Type u} [NormedAddCommGroup E] [NormedSpace ℝ E]

/-- Uniform samples on one closed edge, including both endpoints. -/
def segmentSamples (first second : E) (count : ℕ) : Set E :=
  AffineMap.lineMap first second '' inclusiveUniformParameters 1 count

/-- Uniform affine samples form an epsilon-net of a closed segment. -/
theorem segmentSamples_isEpsilonNet
    (first second : E) (count : ℕ) (countPositive : 0 < count) :
    IsEpsilonNet (segmentSamples first second count)
      (segment ℝ first second) (dist first second / count) := by
  have parameterNet := inclusiveUniformParameters_isEpsilonNet
    1 count (by norm_num) countPositive
  constructor
  · rintro point ⟨parameter, parameterInGrid, rfl⟩
    rw [segment_eq_image_lineMap]
    exact ⟨parameter, parameterNet.1 parameterInGrid, rfl⟩
  · intro point pointInSegment
    rw [segment_eq_image_lineMap] at pointInSegment
    rcases pointInSegment with ⟨parameter, parameterInInterval, rfl⟩
    rcases parameterNet.2 parameter parameterInInterval with
      ⟨sample, sampleInGrid, parameterNearSample⟩
    refine ⟨AffineMap.lineMap first second sample,
      ⟨sample, sampleInGrid, rfl⟩, ?_⟩
    calc
      dist (AffineMap.lineMap first second parameter)
          (AffineMap.lineMap first second sample) =
          dist parameter sample * dist first second :=
        dist_lineMap_lineMap first second parameter sample
      _ ≤ uniformStep 1 count * dist first second :=
        mul_le_mul_of_nonneg_right parameterNearSample dist_nonneg
      _ = dist first second / count := by
        simp [uniformStep, div_eq_mul_inv, mul_comm]

/-- Executable finite parameter grid corresponding to the set-level model. -/
def inclusiveUniformParameterFinset (period : ℝ) (count : ℕ) : Finset ℝ :=
  (Finset.range (count + 1)).image
    (fun index : ℕ => (index : ℝ) * uniformStep period count)

@[simp]
theorem inclusiveUniformParameterFinset_coe
    (period : ℝ) (count : ℕ) :
    (inclusiveUniformParameterFinset period count : Set ℝ) =
      inclusiveUniformParameters period count := by
  ext parameter
  simp [inclusiveUniformParameterFinset, inclusiveUniformParameters, eq_comm]

section FiniteSamples

variable [DecidableEq E]

def segmentSampleFinset (first second : E) (count : ℕ) : Finset E :=
  (inclusiveUniformParameterFinset 1 count).image
    (AffineMap.lineMap first second)

@[simp]
theorem segmentSampleFinset_coe
    (first second : E) (count : ℕ) :
    (segmentSampleFinset first second count : Set E) =
      segmentSamples first second count := by
  ext point
  simp [segmentSampleFinset, segmentSamples]

end FiniteSamples

/-- Edge-local samples mirroring `chainBoundary` exactly. -/
def chainBoundarySamples
    (origin previous : E) (count : ℕ) : List E → Set E
  | [] => segmentSamples previous origin count
  | next :: remaining =>
      segmentSamples previous next count ∪
        chainBoundarySamples origin next count remaining

/-- Longest edge in the closed chain. -/
def chainMaxEdgeLength (origin previous : E) : List E → ℝ
  | [] => dist previous origin
  | next :: remaining =>
      max (dist previous next) (chainMaxEdgeLength origin next remaining)

omit [NormedSpace ℝ E] in
theorem chainMaxEdgeLength_nonnegative
    (origin previous : E) (remaining : List E) :
    0 ≤ chainMaxEdgeLength origin previous remaining := by
  induction remaining generalizing previous with
  | nil => exact dist_nonneg
  | cons next rest inductionHypothesis =>
      exact dist_nonneg.trans (le_max_left _ _)

theorem chainBoundarySamples_isEpsilonNet
    (origin previous : E) (remaining : List E)
    (count : ℕ) (countPositive : 0 < count) :
    IsEpsilonNet (chainBoundarySamples origin previous count remaining)
      (chainBoundary origin previous remaining)
      (chainMaxEdgeLength origin previous remaining / count) := by
  induction remaining generalizing previous with
  | nil =>
      exact segmentSamples_isEpsilonNet previous origin count countPositive
  | cons next rest inductionHypothesis =>
      have firstEdgeNet := segmentSamples_isEpsilonNet
        previous next count countPositive
      have remainingNet := inductionHypothesis next
      have unionNet := HausdorffApproximation.IsEpsilonNet.union
        firstEdgeNet remainingNet
      simpa [chainBoundarySamples, chainBoundary, chainMaxEdgeLength,
        max_div_div_right (Nat.cast_nonneg count)] using unionNet

def polygonBoundarySamples : List E → ℕ → Set E
  | [], _ => ∅
  | first :: remaining, count =>
      chainBoundarySamples first first count remaining

def polygonMaxEdgeLength : List E → ℝ
  | [] => 0
  | first :: remaining => chainMaxEdgeLength first first remaining

theorem polygonBoundarySamples_isEpsilonNet
    (points : List E) (count : ℕ) (countPositive : 0 < count) :
    IsEpsilonNet (polygonBoundarySamples points count)
      (polygonBoundarySet points) (polygonMaxEdgeLength points / count) := by
  cases points with
  | nil =>
      constructor
      · exact Subset.rfl
      · intro point pointInEmpty
        exact pointInEmpty.elim
  | cons first remaining =>
      exact chainBoundarySamples_isEpsilonNet
        first first remaining count countPositive

/-- Smallest positive uniform edge subdivision count selected from an
exact-real maximum edge length and a positive target net radius. -/
def adaptiveSubdivisionCount (maxEdgeLength target : ℝ) : ℕ :=
  max 1 (Nat.ceil (maxEdgeLength / target))

theorem adaptiveSubdivisionCount_positive
    (maxEdgeLength target : ℝ) :
    0 < adaptiveSubdivisionCount maxEdgeLength target := by
  exact Nat.zero_lt_one.trans_le (le_max_left 1 _)

/-- The adaptive subdivision selector meets its requested exact-real radius. -/
theorem adaptiveSubdivisionErrorBound
    (maxEdgeLength target : ℝ) (targetPositive : 0 < target) :
    maxEdgeLength / adaptiveSubdivisionCount maxEdgeLength target ≤ target := by
  have countPositive := adaptiveSubdivisionCount_positive maxEdgeLength target
  rw [div_le_iff₀ (Nat.cast_pos.mpr countPositive)]
  have ratioLeCeil :
      maxEdgeLength / target ≤ (Nat.ceil (maxEdgeLength / target) : ℝ) :=
    Nat.le_ceil _
  have ceilLeCount :
      (Nat.ceil (maxEdgeLength / target) : ℝ) ≤
        adaptiveSubdivisionCount maxEdgeLength target := by
    exact_mod_cast le_max_right 1 (Nat.ceil (maxEdgeLength / target))
  have edgeLeCountTarget :=
    (div_le_iff₀ targetPositive).mp (ratioLeCeil.trans ceilLeCount)
  simpa [mul_comm] using edgeLeCountTarget

/-- No smaller positive uniform edge subdivision count can meet the target. -/
theorem adaptiveSubdivisionCount_minimal
    (maxEdgeLength target : ℝ) (targetPositive : 0 < target)
    (count : ℕ) (countPositive : 0 < count)
    (meetsTarget : maxEdgeLength / count ≤ target) :
    adaptiveSubdivisionCount maxEdgeLength target ≤ count := by
  apply max_le
  · exact countPositive
  · apply Nat.ceil_le.mpr
    apply (div_le_iff₀ targetPositive).mpr
    have edgeLeTargetCount :=
      (div_le_iff₀ (Nat.cast_pos.mpr countPositive)).mp meetsTarget
    simpa [mul_comm] using edgeLeTargetCount

/-- Nonempty polygon specialization used by the Hausdorff certificate. -/
theorem polygonCompactBoundarySamples_isEpsilonNet
    (first : E) (remaining : List E)
    (count : ℕ) (countPositive : 0 < count) :
    IsEpsilonNet (polygonBoundarySamples (first :: remaining) count)
      (polygonCompactBoundary first remaining)
      (polygonMaxEdgeLength (first :: remaining) / count) := by
  exact polygonBoundarySamples_isEpsilonNet
    (first :: remaining) count countPositive

section FinitePolygonSamples

variable [DecidableEq E]

def chainBoundarySampleFinset
    (origin previous : E) (count : ℕ) : List E → Finset E
  | [] => segmentSampleFinset previous origin count
  | next :: remaining =>
      segmentSampleFinset previous next count ∪
        chainBoundarySampleFinset origin next count remaining

@[simp]
theorem chainBoundarySampleFinset_coe
    (origin previous : E) (remaining : List E) (count : ℕ) :
    (chainBoundarySampleFinset origin previous count remaining : Set E) =
      chainBoundarySamples origin previous count remaining := by
  induction remaining generalizing previous with
  | nil => simp [chainBoundarySampleFinset, chainBoundarySamples]
  | cons next rest inductionHypothesis =>
      simp [chainBoundarySampleFinset, chainBoundarySamples,
        inductionHypothesis]

def polygonBoundarySampleFinset : List E → ℕ → Finset E
  | [], _ => ∅
  | first :: remaining, count =>
      chainBoundarySampleFinset first first count remaining

@[simp]
theorem polygonBoundarySampleFinset_coe
    (points : List E) (count : ℕ) :
    (polygonBoundarySampleFinset points count : Set E) =
      polygonBoundarySamples points count := by
  cases points with
  | nil => simp [polygonBoundarySampleFinset, polygonBoundarySamples]
  | cons first remaining =>
      simp [polygonBoundarySampleFinset, polygonBoundarySamples]

theorem segmentSampleFinset_nonempty
    (first second : E) (count : ℕ) :
    (segmentSampleFinset first second count).Nonempty := by
  refine ⟨first, ?_⟩
  apply Finset.mem_image.mpr
  refine ⟨0, ?_, AffineMap.lineMap_apply_zero first second⟩
  apply Finset.mem_image.mpr
  exact ⟨0, Finset.mem_range.mpr (Nat.zero_lt_succ count), by simp⟩

theorem chainBoundarySampleFinset_nonempty
    (origin previous : E) (remaining : List E) (count : ℕ) :
    (chainBoundarySampleFinset origin previous count remaining).Nonempty := by
  cases remaining with
  | nil =>
      exact segmentSampleFinset_nonempty previous origin count
  | cons next rest =>
      exact (segmentSampleFinset_nonempty previous next count).mono
        (Finset.subset_union_left)

theorem polygonBoundarySampleFinset_nonempty
    (first : E) (remaining : List E) (count : ℕ) :
    (polygonBoundarySampleFinset (first :: remaining) count).Nonempty := by
  exact chainBoundarySampleFinset_nonempty first first remaining count

def polygonFiniteSamples
    (first : E) (remaining : List E) (count : ℕ) :
    FiniteHausdorffMaximum.FiniteSamples E where
  points := polygonBoundarySampleFinset (first :: remaining) count
  nonempty := polygonBoundarySampleFinset_nonempty first remaining count

@[simp]
theorem polygonFiniteSamples_coe
    (first : E) (remaining : List E) (count : ℕ) :
    ((polygonFiniteSamples first remaining count).points : Set E) =
      polygonBoundarySamples (first :: remaining) count := by
  exact polygonBoundarySampleFinset_coe (first :: remaining) count

def polygonSampledHausdorffEstimate
    (firstSource : E) (remainingSource : List E)
    (firstTarget : E) (remainingTarget : List E) (count : ℕ) : ℝ :=
  FiniteHausdorffMaximum.sampledHausdorffEstimate
    (polygonFiniteSamples firstSource remainingSource count)
    (polygonFiniteSamples firstTarget remainingTarget count)
    (polygonCompactBoundary firstSource remainingSource)
    (polygonCompactBoundary firstTarget remainingTarget)

/-- Uniform resolution chosen from the longer edge of either polygon. -/
def polygonPairAdaptiveSubdivisionCount
    (firstSource : E) (remainingSource : List E)
    (firstTarget : E) (remainingTarget : List E) (target : ℝ) : ℕ :=
  adaptiveSubdivisionCount
    (max
      (polygonMaxEdgeLength (firstSource :: remainingSource))
      (polygonMaxEdgeLength (firstTarget :: remainingTarget)))
    target

/-- End-to-end exact-real interval for the explicitly constructed finite
polygon sample sets. No maximum upper-bound or witness assumptions remain. -/
theorem polygonFiniteSamplesHausdorffInterval
    (firstSource : E) (remainingSource : List E)
    (firstTarget : E) (remainingTarget : List E)
    (count : ℕ) (countPositive : 0 < count) :
    polygonSampledHausdorffEstimate
        firstSource remainingSource firstTarget remainingTarget count ≤
      dist
        (polygonCompactBoundary firstSource remainingSource)
        (polygonCompactBoundary firstTarget remainingTarget) ∧
    dist
        (polygonCompactBoundary firstSource remainingSource)
        (polygonCompactBoundary firstTarget remainingTarget) ≤
      polygonSampledHausdorffEstimate
          firstSource remainingSource firstTarget remainingTarget count +
        max
          (polygonMaxEdgeLength (firstSource :: remainingSource) / count)
          (polygonMaxEdgeLength (firstTarget :: remainingTarget) / count) := by
  apply FiniteHausdorffMaximum.finiteSamplesHausdorffInterval
  · simpa only [polygonFiniteSamples_coe] using
      (polygonCompactBoundarySamples_isEpsilonNet
        firstSource remainingSource count countPositive)
  · simpa only [polygonFiniteSamples_coe] using
      (polygonCompactBoundarySamples_isEpsilonNet
        firstTarget remainingTarget count countPositive)
  · exact div_nonneg
      (chainMaxEdgeLength_nonnegative firstSource firstSource remainingSource)
      (Nat.cast_nonneg count)
  · exact div_nonneg
      (chainMaxEdgeLength_nonnegative firstTarget firstTarget remainingTarget)
      (Nat.cast_nonneg count)

/-- End-to-end adaptive exact-real interval. The target controls the entire
reported interval width, rather than only an intermediate sampling lemma. -/
theorem polygonFiniteSamplesAdaptiveHausdorffInterval
    (firstSource : E) (remainingSource : List E)
    (firstTarget : E) (remainingTarget : List E)
    (target : ℝ) (targetPositive : 0 < target) :
    let count := polygonPairAdaptiveSubdivisionCount
      firstSource remainingSource firstTarget remainingTarget target
    polygonSampledHausdorffEstimate
        firstSource remainingSource firstTarget remainingTarget count ≤
      dist
        (polygonCompactBoundary firstSource remainingSource)
        (polygonCompactBoundary firstTarget remainingTarget) ∧
    dist
        (polygonCompactBoundary firstSource remainingSource)
        (polygonCompactBoundary firstTarget remainingTarget) ≤
      polygonSampledHausdorffEstimate
          firstSource remainingSource firstTarget remainingTarget count + target := by
  dsimp only
  let maxEdgeLength := max
    (polygonMaxEdgeLength (firstSource :: remainingSource))
    (polygonMaxEdgeLength (firstTarget :: remainingTarget))
  let count := polygonPairAdaptiveSubdivisionCount
    firstSource remainingSource firstTarget remainingTarget target
  have countPositive : 0 < count := by
    simpa [count, polygonPairAdaptiveSubdivisionCount, maxEdgeLength] using
      adaptiveSubdivisionCount_positive maxEdgeLength target
  have interval := polygonFiniteSamplesHausdorffInterval
    firstSource remainingSource firstTarget remainingTarget count countPositive
  refine ⟨interval.1, interval.2.trans ?_⟩
  have adaptiveBound : maxEdgeLength / count ≤ target := by
    simpa [count, polygonPairAdaptiveSubdivisionCount, maxEdgeLength] using
      adaptiveSubdivisionErrorBound maxEdgeLength target targetPositive
  have errorBound :
      max
          (polygonMaxEdgeLength (firstSource :: remainingSource) / count)
          (polygonMaxEdgeLength (firstTarget :: remainingTarget) / count) ≤
        target := by
    apply max_le
    · exact (div_le_div_of_nonneg_right
        (le_max_left
          (polygonMaxEdgeLength (firstSource :: remainingSource))
          (polygonMaxEdgeLength (firstTarget :: remainingTarget)))
        (Nat.cast_nonneg count)).trans adaptiveBound
    · exact (div_le_div_of_nonneg_right
        (le_max_right
          (polygonMaxEdgeLength (firstSource :: remainingSource))
          (polygonMaxEdgeLength (firstTarget :: remainingTarget)))
        (Nat.cast_nonneg count)).trans adaptiveBound
  simpa [count] using add_le_add_left errorBound
    (polygonSampledHausdorffEstimate
      firstSource remainingSource firstTarget remainingTarget count)

end FinitePolygonSamples

/-- Edge-local polygon sampling discharges the geometric obligations of the
Hausdorff certificate. Only the finite maximum calculation remains external. -/
theorem polygonHausdorffCertificate
    (firstSource : E) (remainingSource : List E)
    (firstTarget : E) (remainingTarget : List E)
    (count : ℕ) (countPositive : 0 < count) (estimate : ℝ)
    (sourceSampleUpper :
      ∀ point ∈ polygonBoundarySamples
          (firstSource :: remainingSource) count,
        Metric.infDist point
          (polygonCompactBoundary firstTarget remainingTarget) ≤ estimate)
    (targetSampleUpper :
      ∀ point ∈ polygonBoundarySamples
          (firstTarget :: remainingTarget) count,
        Metric.infDist point
          (polygonCompactBoundary firstSource remainingSource) ≤ estimate)
    (estimateWitness :
      (∃ point ∈ polygonBoundarySamples
          (firstSource :: remainingSource) count,
        estimate = Metric.infDist point
          (polygonCompactBoundary firstTarget remainingTarget)) ∨
      (∃ point ∈ polygonBoundarySamples
          (firstTarget :: remainingTarget) count,
        estimate = Metric.infDist point
          (polygonCompactBoundary firstSource remainingSource)))
    (estimateNonnegative : 0 ≤ estimate) :
    Certificate
      (polygonCompactBoundary firstSource remainingSource)
      (polygonCompactBoundary firstTarget remainingTarget)
      (polygonBoundarySamples (firstSource :: remainingSource) count)
      (polygonBoundarySamples (firstTarget :: remainingTarget) count)
      estimate
      (polygonMaxEdgeLength (firstSource :: remainingSource) / count)
      (polygonMaxEdgeLength (firstTarget :: remainingTarget) / count) where
  sourceNet := polygonCompactBoundarySamples_isEpsilonNet
    firstSource remainingSource count countPositive
  targetNet := polygonCompactBoundarySamples_isEpsilonNet
    firstTarget remainingTarget count countPositive
  sourceSampleUpper := sourceSampleUpper
  targetSampleUpper := targetSampleUpper
  estimateWitness := estimateWitness
  estimate_nonnegative := estimateNonnegative
  sourceEpsilon_nonnegative := div_nonneg
    (chainMaxEdgeLength_nonnegative firstSource firstSource remainingSource)
    (Nat.cast_nonneg count)
  targetEpsilon_nonnegative := div_nonneg
    (chainMaxEdgeLength_nonnegative firstTarget firstTarget remainingTarget)
    (Nat.cast_nonneg count)

theorem polygonHausdorffInterval
    (firstSource : E) (remainingSource : List E)
    (firstTarget : E) (remainingTarget : List E)
    (count : ℕ) (countPositive : 0 < count) (estimate : ℝ)
    (sourceSampleUpper :
      ∀ point ∈ polygonBoundarySamples
          (firstSource :: remainingSource) count,
        Metric.infDist point
          (polygonCompactBoundary firstTarget remainingTarget) ≤ estimate)
    (targetSampleUpper :
      ∀ point ∈ polygonBoundarySamples
          (firstTarget :: remainingTarget) count,
        Metric.infDist point
          (polygonCompactBoundary firstSource remainingSource) ≤ estimate)
    (estimateWitness :
      (∃ point ∈ polygonBoundarySamples
          (firstSource :: remainingSource) count,
        estimate = Metric.infDist point
          (polygonCompactBoundary firstTarget remainingTarget)) ∨
      (∃ point ∈ polygonBoundarySamples
          (firstTarget :: remainingTarget) count,
        estimate = Metric.infDist point
          (polygonCompactBoundary firstSource remainingSource)))
    (estimateNonnegative : 0 ≤ estimate) :
    estimate ≤ dist
        (polygonCompactBoundary firstSource remainingSource)
        (polygonCompactBoundary firstTarget remainingTarget) ∧
      dist
        (polygonCompactBoundary firstSource remainingSource)
        (polygonCompactBoundary firstTarget remainingTarget) ≤
      estimate + max
        (polygonMaxEdgeLength (firstSource :: remainingSource) / count)
        (polygonMaxEdgeLength (firstTarget :: remainingTarget) / count) := by
  exact certifiedHausdorff_interval
    (polygonHausdorffCertificate
      firstSource remainingSource firstTarget remainingTarget
      count countPositive estimate sourceSampleUpper targetSampleUpper
      estimateWitness estimateNonnegative)

end

end Sprawlens.PolygonBoundarySampling
