import Mathlib.Analysis.Convex.Combination

namespace Sprawlens.TemporalBarycenter

open scoped BigOperators
open Set

universe u v w

variable {R : Type u} {E : Type v} {ι : Type w}
variable [Field R]
variable [AddCommGroup E] [Module R E]

/-- Exact finite weighted center; the index set is unordered by construction. -/
def barycenter (indices : Finset ι) (weight : ι → R) (point : ι → E) : E :=
  indices.centerMass weight point

/-- Relabeling a finite family cannot change its center of mass. -/
theorem barycenter_reindex
    (indices : Finset ι) (weight : ι → R) (point : ι → E)
    {κ : Type*} [DecidableEq κ] (relabel : ι ≃ κ) :
    barycenter (indices.map relabel.toEmbedding)
        (fun k => weight (relabel.symm k))
        (fun k => point (relabel.symm k)) =
      barycenter indices weight point := by
  classical
  simp [barycenter, Finset.centerMass]

/-- A common translation commutes with the normalized weighted center. -/
theorem barycenter_translate
    (indices : Finset ι) (weight : ι → R) (point : ι → E) (offset : E)
    (totalWeight : ∑ i ∈ indices, weight i ≠ 0) :
    barycenter indices weight (fun i => point i + offset) =
      barycenter indices weight point + offset := by
  classical
  simp only [barycenter, Finset.centerMass, smul_add, Finset.sum_add_distrib]
  rw [← Finset.sum_smul]
  rw [← mul_smul, inv_mul_cancel₀ totalWeight, one_smul]

/-- Uniform scaling commutes with the normalized weighted center. -/
theorem barycenter_scale
    (indices : Finset ι) (weight : ι → R) (point : ι → E) (scale : R) :
    barycenter indices weight (fun i => scale • point i) =
      scale • barycenter indices weight point := by
  exact Finset.centerMass_smul (c := scale) (t := indices) (w := weight) (z := point)

/-- Non-negative weights with positive total place the center inside the input convex hull. -/
theorem barycenter_mem_convexHull
    [LinearOrder R] [IsStrictOrderedRing R]
    (indices : Finset ι) (weight : ι → R) (point : ι → E)
    (nonnegative : ∀ i ∈ indices, 0 ≤ weight i)
    (positiveTotal : 0 < ∑ i ∈ indices, weight i) :
    barycenter indices weight point ∈ convexHull R (Set.range point) := by
  exact Finset.centerMass_mem_convexHull indices nonnegative positiveTotal
    (fun i _ => Set.mem_range_self i)

/-- The production history mix: 0=current, 1=previous. -/
def affineBarycenter (current previous : E) (historyMix : R) : E :=
  AffineMap.lineMap current previous historyMix

@[simp] theorem affineBarycenter_zero (current previous : E) :
    affineBarycenter (R := R) current previous 0 = current := by
  simp [affineBarycenter]

@[simp] theorem affineBarycenter_one (current previous : E) :
    affineBarycenter (R := R) current previous 1 = previous := by
  simp [affineBarycenter]

theorem affineBarycenter_formula (current previous : E) (historyMix : R) :
    affineBarycenter (R := R) current previous historyMix =
      (1 - historyMix) • current + historyMix • previous := by
  exact AffineMap.lineMap_apply_module current previous historyMix

theorem affineBarycenter_swap (current previous : E) (historyMix : R) :
    affineBarycenter (R := R) current previous historyMix =
      affineBarycenter (R := R) previous current (1 - historyMix) := by
  simp only [affineBarycenter_formula]
  module

theorem affineBarycenter_translate
    (current previous offset : E) (historyMix : R) :
    affineBarycenter (R := R) (current + offset) (previous + offset) historyMix =
      affineBarycenter (R := R) current previous historyMix + offset := by
  simp only [affineBarycenter_formula, smul_add]
  module

theorem affineBarycenter_scale
    (current previous : E) (historyMix scale : R) :
    affineBarycenter (R := R) (scale • current) (scale • previous) historyMix =
      scale • affineBarycenter (R := R) current previous historyMix := by
  simp only [affineBarycenter_formula]
  module

theorem affineBarycenter_mem_convexHull
    [LinearOrder R] [IsStrictOrderedRing R]
    (current previous : E) (historyMix : R)
    (historyMixInRange : historyMix ∈ Set.Icc (0 : R) 1) :
    affineBarycenter (R := R) current previous historyMix ∈
      convexHull R ({current, previous} : Set E) := by
  exact segment_subset_convexHull (𝕜 := R) (s := ({current, previous} : Set E))
    (by simp) (by simp) (lineMap_mem_segment R current previous historyMixInRange)

end Sprawlens.TemporalBarycenter
