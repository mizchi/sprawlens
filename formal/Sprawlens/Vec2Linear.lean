import Mathlib.Algebra.Module.TransferInstance
import Mathlib.Analysis.Convex.Combination
import Sprawlens.ExactGeometry
import Sprawlens.HalfPlaneIntersection

namespace Sprawlens.Vec2Linear

open ExactGeometry
open HalfPlaneIntersection

universe u

/-- Coordinate equivalence used only to transport the standard product vector
space structure onto the geometry-facing `Vec2` representation. -/
def vec2EquivProd {R : Type u} : Vec2 R ≃ R × R where
  toFun point := (point.x, point.y)
  invFun point := { x := point.1, y := point.2 }
  left_inv point := by cases point; rfl
  right_inv point := by cases point; rfl

instance {R : Type u} [AddCommGroup R] : AddCommGroup (Vec2 R) :=
  Equiv.addCommGroup vec2EquivProd

instance {R : Type u} [Ring R] : Module R (Vec2 R) :=
  Equiv.module R vec2EquivProd

@[simp] theorem zero_x {R : Type u} [AddCommGroup R] :
    (0 : Vec2 R).x = 0 := rfl

@[simp] theorem zero_y {R : Type u} [AddCommGroup R] :
    (0 : Vec2 R).y = 0 := rfl

@[simp] theorem add_x {R : Type u} [AddCommGroup R] (first second : Vec2 R) :
    (first + second).x = first.x + second.x := rfl

@[simp] theorem add_y {R : Type u} [AddCommGroup R] (first second : Vec2 R) :
    (first + second).y = first.y + second.y := rfl

@[simp] theorem smul_x {R : Type u} [Ring R] (factor : R) (point : Vec2 R) :
    (factor • point).x = factor * point.x := rfl

@[simp] theorem smul_y {R : Type u} [Ring R] (factor : R) (point : Vec2 R) :
    (factor • point).y = factor * point.y := rfl

/-- Mathlib's affine-combination notation agrees with the executable geometry
interpolation primitive when the coefficients sum to one. -/
theorem affineCombination_eq_interpolatePoint
    {R : Type u} [Field R]
    (start finish : Vec2 R) (startWeight finishWeight : R)
    (weightSum : startWeight + finishWeight = 1) :
    startWeight • start + finishWeight • finish =
      interpolatePoint start finish finishWeight := by
  apply vec2EquivProd.injective
  apply Prod.ext
  · change startWeight * start.x + finishWeight * finish.x =
      start.x + (finish.x - start.x) * finishWeight
    linear_combination weightSum * start.x
  · change startWeight * start.y + finishWeight * finish.y =
      start.y + (finish.y - start.y) * finishWeight
    linear_combination weightSum * start.y

end Sprawlens.Vec2Linear
