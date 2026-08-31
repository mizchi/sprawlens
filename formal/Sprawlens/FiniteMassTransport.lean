import Mathlib.Algebra.BigOperators.Field
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring

namespace Sprawlens.FiniteMassTransport

open scoped BigOperators

universe u v w

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
variable {Inside : Type v} {Outside : Type w}
variable [Fintype Inside] [Fintype Outside]

/-- Product-form transport from nonnegative inside capacity to outside demand.
The construction is used only when total capacity is positive. -/
def proportionalFlow
    (capacity : Inside → R) (demand : Outside → R)
    (inside : Inside) (outside : Outside) : R :=
  capacity inside * demand outside / ∑ index, capacity index

omit [Fintype Outside] in
theorem proportionalFlow_nonnegative
    (capacity : Inside → R) (demand : Outside → R)
    (capacityNonnegative : ∀ inside, 0 ≤ capacity inside)
    (demandNonnegative : ∀ outside, 0 ≤ demand outside)
    (totalCapacityPositive : 0 < ∑ inside, capacity inside)
    (inside : Inside) (outside : Outside) :
    0 ≤ proportionalFlow capacity demand inside outside := by
  exact div_nonneg
    (mul_nonneg (capacityNonnegative inside) (demandNonnegative outside))
    (le_of_lt totalCapacityPositive)

omit [IsStrictOrderedRing R] [Fintype Outside] in
/-- Every demand column is met exactly. -/
theorem sum_proportionalFlow_over_inside
    (capacity : Inside → R) (demand : Outside → R)
    (totalCapacityPositive : 0 < ∑ inside, capacity inside)
    (outside : Outside) :
    ∑ inside, proportionalFlow capacity demand inside outside = demand outside := by
  simp_rw [proportionalFlow, div_eq_mul_inv]
  rw [← Finset.sum_mul]
  field_simp [ne_of_gt totalCapacityPositive]
  rw [← Finset.sum_mul]
  ring

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- A row consumes its proportional share of total demand. -/
theorem sum_proportionalFlow_over_outside
    (capacity : Inside → R) (demand : Outside → R)
    (inside : Inside) :
    ∑ outside, proportionalFlow capacity demand inside outside =
      capacity inside * (∑ outside, demand outside) /
        (∑ index, capacity index) := by
  simp_rw [proportionalFlow, div_eq_mul_inv]
  rw [← Finset.sum_mul]
  rw [← Finset.mul_sum]

/-- If total demand does not exceed total capacity, no capacity row is
overdrawn. -/
theorem sum_proportionalFlow_over_outside_le_capacity
    (capacity : Inside → R) (demand : Outside → R)
    (capacityNonnegative : ∀ inside, 0 ≤ capacity inside)
    (totalCapacityPositive : 0 < ∑ inside, capacity inside)
    (demandAtMostCapacity :
      (∑ outside, demand outside) ≤ ∑ inside, capacity inside)
    (inside : Inside) :
    ∑ outside, proportionalFlow capacity demand inside outside ≤
      capacity inside := by
  rw [sum_proportionalFlow_over_outside]
  rw [div_le_iff₀ totalCapacityPositive]
  exact mul_le_mul_of_nonneg_left demandAtMostCapacity
    (capacityNonnegative inside)

omit [IsStrictOrderedRing R] in
/-- Total transported mass is exactly total demand. -/
theorem sum_proportionalFlow
    (capacity : Inside → R) (demand : Outside → R)
    (totalCapacityPositive : 0 < ∑ inside, capacity inside) :
    ∑ inside, ∑ outside, proportionalFlow capacity demand inside outside =
      ∑ outside, demand outside := by
  simp_rw [sum_proportionalFlow_over_outside capacity demand]
  simp_rw [div_eq_mul_inv]
  rw [← Finset.sum_mul]
  rw [← Finset.sum_mul]
  field_simp [ne_of_gt totalCapacityPositive]

end Sprawlens.FiniteMassTransport
