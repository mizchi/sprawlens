import Mathlib.Algebra.Order.Field.Basic
import Mathlib.Order.Interval.Set.Basic
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring

namespace Sprawlens.HalfPlaneIntersection

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Parameter of the zero crossing between two affine signed distances. -/
def boundaryParameter (current next : R) : R :=
  current / (current - next)

/-- Affine interpolation of two signed distances. -/
def interpolateDistance (current next parameter : R) : R :=
  current + (next - current) * parameter

theorem denominator_ne_zero_of_inside_outside
    {current next : R} (currentInside : current ≤ 0) (nextOutside : 0 < next) :
    current - next ≠ 0 := by
  linarith

theorem denominator_ne_zero_of_outside_inside
    {current next : R} (currentOutside : 0 < current) (nextInside : next ≤ 0) :
    current - next ≠ 0 := by
  linarith

theorem boundaryParameter_mem_Icc_of_inside_outside
    {current next : R} (currentInside : current ≤ 0) (nextOutside : 0 < next) :
    boundaryParameter current next ∈ Set.Icc 0 1 := by
  have denominatorNegative : current - next < 0 := by linarith
  constructor
  · exact div_nonneg_of_nonpos currentInside (le_of_lt denominatorNegative)
  · rw [boundaryParameter, div_le_iff_of_neg denominatorNegative]
    linarith

theorem boundaryParameter_mem_Icc_of_outside_inside
    {current next : R} (currentOutside : 0 < current) (nextInside : next ≤ 0) :
    boundaryParameter current next ∈ Set.Icc 0 1 := by
  have denominatorPositive : 0 < current - next := by linarith
  constructor
  · exact div_nonneg (le_of_lt currentOutside) (le_of_lt denominatorPositive)
  · rw [boundaryParameter, div_le_iff₀ denominatorPositive]
    linarith

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem interpolateDistance_boundaryParameter
    {current next : R} (distinct : current ≠ next) :
    interpolateDistance current next (boundaryParameter current next) = 0 := by
  rw [interpolateDistance, boundaryParameter]
  field_simp [sub_ne_zero.mpr distinct]
  ring

end Sprawlens.HalfPlaneIntersection
