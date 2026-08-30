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

/-- Replacing both outer vertices by points on their incident edges scales the turn. -/
theorem orientation_interpolate_both
    (a b c : Vec2 R) (startParameter finishParameter : R) :
    orientation (interpolatePoint a b startParameter) b
        (interpolatePoint b c finishParameter) =
      (1 - startParameter) * finishParameter * orientation a b c := by
  simp only [orientation, interpolatePoint]
  ring

/-- Orientation is affine when its third point moves along an arbitrary segment. -/
theorem orientation_interpolate_third
    (a b start finish : Vec2 R) (parameter : R) :
    orientation a b (interpolatePoint start finish parameter) =
      (1 - parameter) * orientation a b start +
        parameter * orientation a b finish := by
  simp only [orientation, interpolatePoint]
  ring

/-- Orientation is affine when its first point moves along an arbitrary segment. -/
theorem orientation_interpolate_first
    (start finish b c : Vec2 R) (parameter : R) :
    orientation (interpolatePoint start finish parameter) b c =
      (1 - parameter) * orientation start b c +
        parameter * orientation finish b c := by
  simp only [orientation, interpolatePoint]
  ring

/-- Orientation is affine when its second point moves along an arbitrary segment. -/
theorem orientation_interpolate_second
    (a start finish c : Vec2 R) (parameter : R) :
    orientation a (interpolatePoint start finish parameter) c =
      (1 - parameter) * orientation a start c +
        parameter * orientation a finish c := by
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

theorem orientation_interpolate_both_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {startParameter finishParameter : R}
    (startAtMostOne : startParameter ≤ 1)
    (finishNonnegative : 0 ≤ finishParameter)
    (turnNonnegative : 0 ≤ orientation a b c) :
    0 ≤ orientation (interpolatePoint a b startParameter) b
      (interpolatePoint b c finishParameter) := by
  rw [orientation_interpolate_both]
  exact mul_nonneg
    (mul_nonneg (sub_nonneg.mpr startAtMostOne) finishNonnegative)
    turnNonnegative

theorem orientation_interpolate_both_le_original
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {startParameter finishParameter : R}
    (startNonnegative : 0 ≤ startParameter)
    (startAtMostOne : startParameter ≤ 1)
    (finishNonnegative : 0 ≤ finishParameter)
    (finishAtMostOne : finishParameter ≤ 1)
    (turnNonnegative : 0 ≤ orientation a b c) :
    orientation (interpolatePoint a b startParameter) b
        (interpolatePoint b c finishParameter) ≤ orientation a b c := by
  rw [orientation_interpolate_both]
  have oneMinusStartNonnegative : 0 ≤ 1 - startParameter := sub_nonneg.mpr startAtMostOne
  have oneMinusStartAtMostOne : 1 - startParameter ≤ 1 := by linarith
  have coefficientAtMostFinish :
      (1 - startParameter) * finishParameter ≤ finishParameter := by
    exact mul_le_of_le_one_left finishNonnegative oneMinusStartAtMostOne
  have coefficientAtMostOne : (1 - startParameter) * finishParameter ≤ 1 :=
    coefficientAtMostFinish.trans finishAtMostOne
  exact mul_le_of_le_one_left turnNonnegative coefficientAtMostOne

theorem orientation_interpolate_third_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b start finish : Vec2 R) {parameter : R}
    (parameterNonnegative : 0 ≤ parameter)
    (parameterAtMostOne : parameter ≤ 1)
    (startLeft : 0 ≤ orientation a b start)
    (finishLeft : 0 ≤ orientation a b finish) :
    0 ≤ orientation a b (interpolatePoint start finish parameter) := by
  rw [orientation_interpolate_third]
  exact add_nonneg
    (mul_nonneg (sub_nonneg.mpr parameterAtMostOne) startLeft)
    (mul_nonneg parameterNonnegative finishLeft)

theorem orientation_interpolate_first_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (start finish b c : Vec2 R) {parameter : R}
    (parameterNonnegative : 0 ≤ parameter)
    (parameterAtMostOne : parameter ≤ 1)
    (startLeft : 0 ≤ orientation start b c)
    (finishLeft : 0 ≤ orientation finish b c) :
    0 ≤ orientation (interpolatePoint start finish parameter) b c := by
  rw [orientation_interpolate_first]
  exact add_nonneg
    (mul_nonneg (sub_nonneg.mpr parameterAtMostOne) startLeft)
    (mul_nonneg parameterNonnegative finishLeft)

theorem orientation_interpolate_second_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (a start finish c : Vec2 R) {parameter : R}
    (parameterNonnegative : 0 ≤ parameter)
    (parameterAtMostOne : parameter ≤ 1)
    (startLeft : 0 ≤ orientation a start c)
    (finishLeft : 0 ≤ orientation a finish c) :
    0 ≤ orientation a (interpolatePoint start finish parameter) c := by
  rw [orientation_interpolate_second]
  exact add_nonneg
    (mul_nonneg (sub_nonneg.mpr parameterAtMostOne) startLeft)
    (mul_nonneg parameterNonnegative finishLeft)

end Sprawlens.HalfPlaneIntersection
