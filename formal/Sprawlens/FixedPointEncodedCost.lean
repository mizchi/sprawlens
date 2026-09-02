import Mathlib.Data.Int.Cast.Field
import Mathlib.Data.Real.Basic
import Mathlib.Tactic

namespace Sprawlens.FixedPointEncodedCost

/-- A serialization scale with a nonzero denominator. Keeping positivity in
the type prevents a nominal "fixed point" codec that divides by zero. -/
structure PositiveScale where
  denominator : Nat
  positive : 0 < denominator

/-- Canonical fixed-point payload: one unbounded signed integer at a scale
fixed by the surrounding schema. This corresponds naturally to a JS `BigInt`
field rather than an IEEE-754 number. -/
structure ScaledIntCost (scale : PositiveScale) where
  units : Int
deriving DecidableEq, Repr

def zero (scale : PositiveScale) : ScaledIntCost scale :=
  ⟨0⟩

def add {scale : PositiveScale}
    (left right : ScaledIntCost scale) : ScaledIntCost scale :=
  ⟨left.units + right.units⟩

noncomputable def decode {scale : PositiveScale}
    (cost : ScaledIntCost scale) : ℝ :=
  (cost.units : ℝ) / (scale.denominator : ℝ)

def ofInt (scale : PositiveScale) (value : Int) : ScaledIntCost scale :=
  ⟨value * (scale.denominator : Int)⟩

@[simp] theorem units_zero (scale : PositiveScale) :
    (zero scale).units = 0 := rfl

@[simp] theorem units_add {scale : PositiveScale}
    (left right : ScaledIntCost scale) :
    (add left right).units = left.units + right.units := rfl

@[simp] theorem decode_zero (scale : PositiveScale) :
    decode (zero scale) = 0 := by
  simp [decode, zero]

@[simp] theorem decode_add {scale : PositiveScale}
    (left right : ScaledIntCost scale) :
    decode (add left right) = decode left + decode right := by
  simp [decode, add, add_div]

theorem denominator_real_ne_zero (scale : PositiveScale) :
    (scale.denominator : ℝ) ≠ 0 := by
  exact_mod_cast (Nat.ne_of_gt scale.positive)

@[simp] theorem decode_ofInt (scale : PositiveScale) (value : Int) :
    decode (ofInt scale value) = (value : ℝ) := by
  rw [decode, ofInt]
  push_cast
  field_simp [denominator_real_ne_zero scale]

@[simp] theorem add_assoc {scale : PositiveScale}
    (first second third : ScaledIntCost scale) :
    add (add first second) third = add first (add second third) := by
  rcases first with ⟨first⟩
  rcases second with ⟨second⟩
  rcases third with ⟨third⟩
  simp [add, Int.add_assoc]

@[simp] theorem add_comm {scale : PositiveScale}
    (left right : ScaledIntCost scale) :
    add left right = add right left := by
  rcases left with ⟨left⟩
  rcases right with ⟨right⟩
  simp [add, Int.add_comm]

@[simp] theorem zero_add {scale : PositiveScale}
    (cost : ScaledIntCost scale) : add (zero scale) cost = cost := by
  cases cost
  simp [add, zero]

@[simp] theorem add_zero {scale : PositiveScale}
    (cost : ScaledIntCost scale) : add cost (zero scale) = cost := by
  cases cost
  simp [add, zero]

theorem ext_iff {scale : PositiveScale}
    {left right : ScaledIntCost scale} :
    left = right ↔ left.units = right.units := by
  constructor
  · exact congrArg ScaledIntCost.units
  · intro unitsEq
    cases left
    cases right
    simp_all

end Sprawlens.FixedPointEncodedCost
