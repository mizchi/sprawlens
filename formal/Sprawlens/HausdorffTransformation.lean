import Mathlib.Analysis.Normed.Module.Ball.Pointwise
import Sprawlens.PolygonBoundaryMetric

namespace Sprawlens.HausdorffTransformation

open Set
open scoped Pointwise

universe u v

variable {Point : Type u} {Target : Type v}
variable [PseudoMetricSpace Point] [PseudoMetricSpace Target]

/-- A common rigid transform does not change the exact Hausdorff target.
Rotations, reflections, and translations are instances of a common isometry. -/
theorem hausdorffDist_image_isometry
    (transform : Point → Target) (isometry : Isometry transform)
    (source target : Set Point) :
    Metric.hausdorffDist (transform '' source) (transform '' target) =
      Metric.hausdorffDist source target := by
  exact Metric.hausdorffDist_image isometry

/-- Normalizing by an unchanged positive extent preserves rigid-transform
invariance. -/
theorem normalizedHausdorffDist_image_isometry
    (transform : Point → Target) (isometry : Isometry transform)
    (source target : Set Point) (extent : ℝ) :
    Metric.hausdorffDist (transform '' source) (transform '' target) / extent =
      Metric.hausdorffDist source target / extent := by
  rw [hausdorffDist_image_isometry transform isometry]

section Scale

variable {𝕜 E : Type*}
variable [NormedDivisionRing 𝕜] [SeminormedAddCommGroup E]
variable [Module 𝕜 E] [NormSMulClass 𝕜 E]

/-- A common nonzero scalar multiplication scales Hausdorff edistance by the
scalar norm. The nonzero premise excludes the representation-collapsing map. -/
theorem hausdorffEDist_smul_of_ne_zero
    (scalar : 𝕜) (scalar_ne_zero : scalar ≠ 0) (source target : Set E) :
  Metric.hausdorffEDist (scalar • source) (scalar • target) =
      ‖scalar‖₊ • Metric.hausdorffEDist source target := by
  simp only [Metric.hausdorffEDist_def, ← Set.image_smul, iSup_image]
  simp only [Set.image_smul, _root_.infEDist_smul₀ scalar_ne_zero]
  simp only [iSup_subtype']
  rw [← ENNReal.smul_iSup, ← ENNReal.smul_iSup]
  simp only [ENNReal.smul_def, smul_eq_mul, mul_max]

/-- The real-valued exact Hausdorff target scales by the absolute geometric
factor under a common nonzero uniform scale. -/
theorem hausdorffDist_smul_of_ne_zero
    (scalar : 𝕜) (scalar_ne_zero : scalar ≠ 0) (source target : Set E) :
    Metric.hausdorffDist (scalar • source) (scalar • target) =
      ‖scalar‖ * Metric.hausdorffDist source target := by
  simp only [Metric.hausdorffDist, hausdorffEDist_smul_of_ne_zero scalar scalar_ne_zero,
    ENNReal.toReal_smul, NNReal.smul_def, coe_nnnorm, smul_eq_mul]

/-- If the normalization extent is scaled by the same nonzero factor, the
dimensionless Hausdorff target is invariant. -/
theorem normalizedHausdorffDist_smul_of_ne_zero
    (scalar : 𝕜) (scalar_ne_zero : scalar ≠ 0)
    (source target : Set E) (extent : ℝ) :
    Metric.hausdorffDist (scalar • source) (scalar • target) /
        (‖scalar‖ * extent) =
      Metric.hausdorffDist source target / extent := by
  rw [hausdorffDist_smul_of_ne_zero scalar scalar_ne_zero]
  exact mul_div_mul_left _ _ (norm_ne_zero_iff.mpr scalar_ne_zero)

end Scale

end Sprawlens.HausdorffTransformation
