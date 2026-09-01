import Mathlib.Data.Fin.Tuple.Sort
import Lean.Elab.Tactic.Omega

namespace Sprawlens.EmpiricalQuantile

open Finset

/-- Number of observations at or below a threshold. -/
def countLE {n : ℕ} {Value : Type*} [LinearOrder Value]
    (values : Fin n → Value) (threshold : Value) : ℕ :=
  #{index | values index ≤ threshold}

/-- Number of observations strictly below a threshold. -/
def countLT {n : ℕ} {Value : Type*} [LinearOrder Value]
    (values : Fin n → Value) (threshold : Value) : ℕ :=
  #{index | values index < threshold}

/-- One-based nearest-rank characterization. At least `rank` observations are
at or below the result, while fewer than `rank` are strictly below it. -/
def HasNearestRank {n : ℕ} {Value : Type*} [LinearOrder Value]
    (values : Fin n → Value) (rank : ℕ) (result : Value) : Prop :=
  0 < rank ∧ rank ≤ n ∧
    rank ≤ countLE values result ∧ countLT values result < rank

/-- Sorting a finite tuple and selecting a zero-based rank. -/
def empiricalNearestRank {n : ℕ} {Value : Type*} [LinearOrder Value]
    (values : Fin n → Value) (rank : Fin n) : Value :=
  values (Tuple.sort values rank)

private theorem card_filter_comp_perm
    {n : ℕ} {Value : Type*}
    (values : Fin n → Value) (permutation : Equiv.Perm (Fin n))
    (predicate : Value → Prop) [DecidablePred predicate] :
    #{index | predicate (values (permutation index))} =
      #{index | predicate (values index)} := by
  let equivalence :
      {index : Fin n // predicate (values (permutation index))} ≃
        {index : Fin n // predicate (values index)} :=
    {
      toFun := fun index => ⟨permutation index, index.property⟩
      invFun := fun index => ⟨permutation.symm index, by simpa using index.property⟩
      left_inv := fun index => by
        apply Subtype.ext
        simp
      right_inv := fun index => by
        apply Subtype.ext
        simp
    }
  calc
    #{index | predicate (values (permutation index))} =
        Fintype.card
          {index : Fin n // predicate (values (permutation index))} :=
      (Fintype.card_subtype _).symm
    _ = Fintype.card {index : Fin n // predicate (values index)} :=
      Fintype.card_congr equivalence
    _ = #{index | predicate (values index)} :=
      Fintype.card_subtype _

/-- A correct lower nearest-rank value cannot exceed a correct upper
nearest-rank value when every lower sample is at most its upper sample. -/
theorem nearestRank_le_of_pointwise_le
    {n : ℕ} {Value : Type*} [LinearOrder Value]
    {lower upper : Fin n → Value} {rank : ℕ}
    {lowerResult upperResult : Value}
    (pointwise : ∀ index, lower index ≤ upper index)
    (lowerRank : HasNearestRank lower rank lowerResult)
    (upperRank : HasNearestRank upper rank upperResult) :
    lowerResult ≤ upperResult := by
  by_contra notLe
  have upper_lt_lower : upperResult < lowerResult := lt_of_not_ge notLe
  have subset :
      Finset.univ.filter (fun index => upper index ≤ upperResult) ⊆
        Finset.univ.filter (fun index => lower index < lowerResult) := by
    intro index membership
    simp only [mem_filter, mem_univ, true_and] at membership ⊢
    exact lt_of_le_of_lt (le_trans (pointwise index) membership) upper_lt_lower
  have cardLe := card_le_card subset
  unfold HasNearestRank countLE countLT at lowerRank upperRank
  omega

/-- The executable sorted-tuple value satisfies the one-based nearest-rank
characterization used by the empirical protocol. -/
theorem empiricalNearestRank_hasNearestRank
    {n : ℕ} {Value : Type*} [LinearOrder Value]
    (values : Fin n → Value) (rank : Fin n) :
    HasNearestRank values (rank + 1) (empiricalNearestRank values rank) := by
  let sorted := values ∘ Tuple.sort values
  have sortedMonotone : Monotone sorted := Tuple.monotone_sort values
  have atOrBelowSorted :
      rank < #{index | sorted index ≤ empiricalNearestRank values rank} := by
    apply (Tuple.lt_card_le_iff_apply_le_of_monotone sortedMonotone).2
    exact le_rfl
  have belowSortedNotAbove :
      ¬rank < #{index | sorted index < empiricalNearestRank values rank} := by
    rw [Tuple.lt_card_lt_iff_apply_lt_of_monotone sortedMonotone]
    exact lt_irrefl _
  have atOrBelow :
      rank < countLE values (empiricalNearestRank values rank) := by
    rw [countLE]
    rw [← card_filter_comp_perm values (Tuple.sort values)
      (fun value => value ≤ empiricalNearestRank values rank)]
    simpa [sorted, Function.comp_def] using atOrBelowSorted
  have below :
      countLT values (empiricalNearestRank values rank) ≤ rank := by
    have sortedBelow :
        #{index | sorted index < empiricalNearestRank values rank} ≤ rank :=
      Nat.le_of_not_gt belowSortedNotAbove
    rw [countLT]
    rw [← card_filter_comp_perm values (Tuple.sort values)
      (fun value => value < empiricalNearestRank values rank)]
    simpa [sorted, Function.comp_def] using sortedBelow
  unfold HasNearestRank
  omega

/-- Coordinatewise monotonicity of the executable nearest-rank statistic. -/
theorem empiricalNearestRank_mono
    {n : ℕ} {Value : Type*} [LinearOrder Value]
    (lower upper : Fin n → Value) (rank : Fin n)
    (pointwise : ∀ index, lower index ≤ upper index) :
    empiricalNearestRank lower rank ≤ empiricalNearestRank upper rank := by
  exact nearestRank_le_of_pointwise_le pointwise
    (empiricalNearestRank_hasNearestRank lower rank)
    (empiricalNearestRank_hasNearestRank upper rank)

/-- Applying the same nearest rank to interval endpoints encloses the nearest
rank of every pointwise-contained exact sample tuple. -/
theorem empiricalNearestRank_interval
    {n : ℕ} {Value : Type*} [LinearOrder Value]
    (lower exact upper : Fin n → Value) (rank : Fin n)
    (lower_le : ∀ index, lower index ≤ exact index)
    (le_upper : ∀ index, exact index ≤ upper index) :
    empiricalNearestRank lower rank ≤ empiricalNearestRank exact rank ∧
      empiricalNearestRank exact rank ≤ empiricalNearestRank upper rank := by
  exact ⟨empiricalNearestRank_mono lower exact rank lower_le,
    empiricalNearestRank_mono exact upper rank le_upper⟩

end Sprawlens.EmpiricalQuantile
