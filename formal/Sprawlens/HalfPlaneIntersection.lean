import Mathlib.Algebra.Order.Field.Basic
import Mathlib.Order.Interval.Set.Basic
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring
import Sprawlens.ExactGeometry

namespace Sprawlens.HalfPlaneIntersection

open ExactGeometry

universe u

variable {R : Type u} [Field R]

/-- Parameter of the zero crossing between two affine signed distances. -/
def boundaryParameter (current next : R) : R :=
  current / (current - next)

/-- Affine interpolation of two signed distances. -/
def interpolateDistance (current next parameter : R) : R :=
  current + (next - current) * parameter

/-- Affine interpolation along an oriented segment. -/
def interpolatePoint (start finish : Vec2 R) (parameter : R) : Vec2 R :=
  {
    x := start.x + (finish.x - start.x) * parameter
    y := start.y + (finish.y - start.y) * parameter
  }

@[simp]
theorem interpolatePoint_zero (start finish : Vec2 R) :
    interpolatePoint start finish 0 = start := by
  cases start
  simp [interpolatePoint]

@[simp]
theorem interpolatePoint_one (start finish : Vec2 R) :
    interpolatePoint start finish 1 = finish := by
  cases start
  cases finish
  simp [interpolatePoint]

theorem orientation_interpolate_finish (a b c : Vec2 R) (parameter : R) :
    orientation a b (interpolatePoint b c parameter) =
      parameter * orientation a b c := by
  simp only [orientation, interpolatePoint]
  ring

theorem orientation_interpolate_start (a b c : Vec2 R) (parameter : R) :
    orientation (interpolatePoint a b parameter) b c =
      (1 - parameter) * orientation a b c := by
  simp only [orientation, interpolatePoint]
  ring

theorem orientation_interpolate_middle (a b c : Vec2 R) (parameter : R) :
    orientation a (interpolatePoint b c parameter) c =
      (1 - parameter) * orientation a b c := by
  simp only [orientation, interpolatePoint]
  ring

theorem denominator_ne_zero_of_inside_outside
    [LinearOrder R] [IsStrictOrderedRing R]
    {current next : R} (currentInside : current ≤ 0) (nextOutside : 0 < next) :
    current - next ≠ 0 := by
  linarith

theorem denominator_ne_zero_of_outside_inside
    [LinearOrder R] [IsStrictOrderedRing R]
    {current next : R} (currentOutside : 0 < current) (nextInside : next ≤ 0) :
    current - next ≠ 0 := by
  linarith

theorem boundaryParameter_mem_Icc_of_inside_outside
    [LinearOrder R] [IsStrictOrderedRing R]
    {current next : R} (currentInside : current ≤ 0) (nextOutside : 0 < next) :
    boundaryParameter current next ∈ Set.Icc 0 1 := by
  have denominatorNegative : current - next < 0 := by linarith
  constructor
  · exact div_nonneg_of_nonpos currentInside (le_of_lt denominatorNegative)
  · rw [boundaryParameter, div_le_iff_of_neg denominatorNegative]
    linarith

theorem boundaryParameter_mem_Icc_of_outside_inside
    [LinearOrder R] [IsStrictOrderedRing R]
    {current next : R} (currentOutside : 0 < current) (nextInside : next ≤ 0) :
    boundaryParameter current next ∈ Set.Icc 0 1 := by
  have denominatorPositive : 0 < current - next := by linarith
  constructor
  · exact div_nonneg (le_of_lt currentOutside) (le_of_lt denominatorPositive)
  · rw [boundaryParameter, div_le_iff₀ denominatorPositive]
    linarith

theorem interpolateDistance_boundaryParameter
    {current next : R} (distinct : current ≠ next) :
    interpolateDistance current next (boundaryParameter current next) = 0 := by
  rw [interpolateDistance, boundaryParameter]
  field_simp [sub_ne_zero.mpr distinct]
  ring

theorem orientation_interpolate_finish_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {parameter : R}
    (parameterNonnegative : 0 ≤ parameter) (turnNonnegative : 0 ≤ orientation a b c) :
    0 ≤ orientation a b (interpolatePoint b c parameter) := by
  rw [orientation_interpolate_finish]
  exact mul_nonneg parameterNonnegative turnNonnegative

theorem orientation_interpolate_start_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {parameter : R}
    (parameterAtMostOne : parameter ≤ 1) (turnNonnegative : 0 ≤ orientation a b c) :
    0 ≤ orientation (interpolatePoint a b parameter) b c := by
  rw [orientation_interpolate_start]
  exact mul_nonneg (sub_nonneg.mpr parameterAtMostOne) turnNonnegative

theorem orientation_interpolate_middle_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {parameter : R}
    (parameterAtMostOne : parameter ≤ 1) (turnNonnegative : 0 ≤ orientation a b c) :
    0 ≤ orientation a (interpolatePoint b c parameter) c := by
  rw [orientation_interpolate_middle]
  exact mul_nonneg (sub_nonneg.mpr parameterAtMostOne) turnNonnegative

end Sprawlens.HalfPlaneIntersection
