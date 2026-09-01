import Mathlib.Analysis.Convex.Basic
import Sprawlens.SoftSelectorLipschitz

namespace Sprawlens.SoftSelectorValidity

open Set
open SegmentProjection
open SoftSelectorLipschitz

universe u v

/-- Geometry interpolation driven by a clamped raw parameter. -/
def softGeometry {Geometry : Type u}
    [AddCommGroup Geometry] [Module ℝ Geometry]
    (left right : Geometry) (rawParameter : ℝ) : Geometry :=
  AffineMap.lineMap left right (unitClamp rawParameter)

/-- Convex validity is preserved by every clamped soft interpolation. -/
theorem softGeometry_mem_of_convex
    {Geometry : Type u} [AddCommGroup Geometry] [Module ℝ Geometry]
    (valid : Set Geometry) (validConvex : Convex ℝ valid)
    {left right : Geometry} (leftValid : left ∈ valid)
    (rightValid : right ∈ valid) (rawParameter : ℝ) :
    softGeometry left right rawParameter ∈ valid := by
  exact validConvex.lineMap_mem leftValid rightValid
    (unitClamp_mem_Icc rawParameter)

def SoftInterpolationClosed {Geometry : Type u}
    [AddCommGroup Geometry] [Module ℝ Geometry]
    (valid : Set Geometry) : Prop :=
  ∀ ⦃left right : Geometry⦄, left ∈ valid → right ∈ valid →
    ∀ rawParameter, softGeometry left right rawParameter ∈ valid

theorem unitClamp_eq_self_of_mem_Icc {parameter : ℝ}
    (parameterMem : parameter ∈ Icc (0 : ℝ) 1) :
    unitClamp parameter = parameter := by
  rw [unitClamp, min_eq_right parameterMem.2, max_eq_right parameterMem.1]

/-- Convexity is exactly closure under all clamped two-candidate
interpolations, not merely a convenient sufficient condition. -/
theorem convex_iff_softInterpolationClosed
    {Geometry : Type u} [AddCommGroup Geometry] [Module ℝ Geometry]
    (valid : Set Geometry) :
    Convex ℝ valid ↔ SoftInterpolationClosed valid := by
  constructor
  · intro validConvex left right leftValid rightValid rawParameter
    exact softGeometry_mem_of_convex valid validConvex
      leftValid rightValid rawParameter
  · intro closed
    apply convex_iff_segment_subset.mpr
    intro left leftValid right rightValid point pointMem
    rw [segment_eq_image_lineMap] at pointMem
    rcases pointMem with ⟨parameter, parameterMem, rfl⟩
    have interpolated := closed leftValid rightValid parameter
    simpa [softGeometry,
      unitClamp_eq_self_of_mem_Icc parameterMem] using interpolated

def SatisfiesAll {Geometry : Type u} {Constraint : Type v}
    (accepted : Constraint → Set Geometry) (geometry : Geometry) : Prop :=
  ∀ constraint, geometry ∈ accepted constraint

/-- A vector of protected acceptance sets is preserved when every set is
convex and both endpoint candidates satisfy every constraint. -/
theorem softGeometry_preserves_convex_contract
    {Geometry : Type u} {Constraint : Type v}
    [AddCommGroup Geometry] [Module ℝ Geometry]
    (valid : Set Geometry) (accepted : Constraint → Set Geometry)
    (validConvex : Convex ℝ valid)
    (acceptedConvex : ∀ constraint, Convex ℝ (accepted constraint))
    {left right : Geometry}
    (leftValid : left ∈ valid) (rightValid : right ∈ valid)
    (leftProtected : SatisfiesAll accepted left)
    (rightProtected : SatisfiesAll accepted right)
    (rawParameter : ℝ) :
    softGeometry left right rawParameter ∈ valid ∧
      SatisfiesAll accepted (softGeometry left right rawParameter) := by
  constructor
  · exact softGeometry_mem_of_convex valid validConvex
      leftValid rightValid rawParameter
  · intro constraint
    exact softGeometry_mem_of_convex
      (accepted constraint) (acceptedConvex constraint)
      (leftProtected constraint) (rightProtected constraint) rawParameter

theorem softNearest_eq_softGeometry
    (margin previous : ℝ) :
    softNearest margin previous =
      softGeometry (-1 : ℝ) 1 (transitionParameter margin previous) := by
  simp only [softNearest, softGeometry, AffineMap.lineMap_apply_module]
  ring

/-- The original discrete candidate domain is deliberately non-convex. -/
def discreteCandidates : Set ℝ :=
  {-1, 1}

theorem neg_one_mem_discreteCandidates :
    (-1 : ℝ) ∈ discreteCandidates := by
  simp [discreteCandidates]

theorem one_mem_discreteCandidates :
    (1 : ℝ) ∈ discreteCandidates := by
  simp [discreteCandidates]

theorem zero_not_mem_discreteCandidates :
    (0 : ℝ) ∉ discreteCandidates := by
  norm_num [discreteCandidates]

theorem discreteCandidates_not_convex :
    ¬ Convex ℝ discreteCandidates := by
  intro convex
  have midpoint := convex.lineMap_mem
    neg_one_mem_discreteCandidates one_mem_discreteCandidates
    (show (1 / 2 : ℝ) ∈ Icc 0 1 by norm_num)
  have midpointEq :
      AffineMap.lineMap (-1 : ℝ) 1 (1 / 2 : ℝ) = 0 := by
    simp only [AffineMap.lineMap_apply_module]
    norm_num
  rw [midpointEq] at midpoint
  exact zero_not_mem_discreteCandidates midpoint

/-- Load-bearing failure case: the globally Lipschitz soft selector leaves the
finite candidate set exactly at the hard switch. -/
theorem softNearest_switch_not_mem_discreteCandidates
    (margin : ℝ) (marginPositive : 0 < margin) :
    softNearest margin 0 ∉ discreteCandidates := by
  rw [softNearest_zero margin marginPositive]
  exact zero_not_mem_discreteCandidates

end Sprawlens.SoftSelectorValidity
