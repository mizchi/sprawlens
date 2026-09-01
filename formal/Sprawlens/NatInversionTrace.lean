import Sprawlens.TraceDerivationGenerator

namespace Sprawlens.NatInversionTrace

open QuantitativeConfluence
open TraceDerivationGenerator

universe u

def lowerCount (pivot : Nat) (values : List Nat) : Nat :=
  (values.filter fun value => decide (value < pivot)).length

/-- Number of earlier-greater-than-later pairs in a natural-rank trace. -/
def natInversionCount : List Nat → Nat
  | [] => 0
  | head :: rest => lowerCount head rest + natInversionCount rest

@[simp] theorem lowerCount_nil (pivot : Nat) :
    lowerCount pivot [] = 0 := by
  simp [lowerCount]

@[simp] theorem lowerCount_cons (pivot head : Nat) (rest : List Nat) :
    lowerCount pivot (head :: rest) =
      (if head < pivot then 1 else 0) + lowerCount pivot rest := by
  simp [lowerCount]
  split <;> simp_all [Nat.add_comm]

theorem lowerCount_eq_zero_of_forall_ge
    (pivot : Nat) (values : List Nat)
    (lowerBound : ∀ value, value ∈ values → pivot ≤ value) :
    lowerCount pivot values = 0 := by
  induction values with
  | nil => rfl
  | cons head rest inductionHypothesis =>
      have headGe : pivot ≤ head := lowerBound head (by simp)
      have restGe : ∀ value, value ∈ rest → pivot ≤ value := by
        intro value valueMem
        exact lowerBound value (by simp [valueMem])
      simp [lowerCount_cons, not_lt_of_ge headGe,
        inductionHypothesis restGe]

/-- A nondecreasing natural-rank trace has no inversions. -/
theorem natInversionCount_eq_zero_of_pairwise_le
    (values : List Nat) (sorted : values.Pairwise (· ≤ ·)) :
    natInversionCount values = 0 := by
  induction values with
  | nil => simp [natInversionCount]
  | cons head rest inductionHypothesis =>
      rw [natInversionCount]
      have sortedParts := List.pairwise_cons.mp sorted
      have lowerCountZero : lowerCount head rest = 0 :=
        lowerCount_eq_zero_of_forall_ge head rest sortedParts.1
      have tailZero := inductionHypothesis sortedParts.2
      omega

theorem lowerCount_adjacent_swap
    (pivot : Nat) (before after : List Nat) (first second : Nat) :
    lowerCount pivot (before ++ first :: second :: after) =
      lowerCount pivot (before ++ second :: first :: after) := by
  induction before with
  | nil =>
      simp only [List.nil_append, lowerCount_cons]
      split_ifs <;> omega
  | cons head before inductionHypothesis =>
      simp only [List.cons_append, lowerCount_cons]
      rw [inductionHypothesis]

/-- One adjacent swap changes natural-rank inversion potential by at most one
in either direction, in an arbitrary prefix and suffix. -/
theorem natInversionCount_adjacent_swap_bounds
    (before after : List Nat) (first second : Nat) :
    natInversionCount (before ++ first :: second :: after) ≤
        natInversionCount (before ++ second :: first :: after) + 1 ∧
      natInversionCount (before ++ second :: first :: after) ≤
        natInversionCount (before ++ first :: second :: after) + 1 := by
  induction before with
  | nil =>
      simp only [List.nil_append, natInversionCount, lowerCount_cons]
      split_ifs <;> omega
  | cons head before inductionHypothesis =>
      simp only [List.cons_append, natInversionCount]
      have countEq :=
        lowerCount_adjacent_swap head before after first second
      rw [countEq]
      omega

/-- Swapping an adjacent strict inversion into increasing order decreases the
natural-rank inversion potential by exactly one. -/
theorem natInversionCount_adjacent_inversion_exact
    (before after : List Nat) (first second : Nat)
    (inversion : second < first) :
    natInversionCount (before ++ first :: second :: after) =
      natInversionCount (before ++ second :: first :: after) + 1 := by
  induction before with
  | nil =>
      simp only [List.nil_append, natInversionCount, lowerCount_cons]
      split_ifs <;> omega
  | cons head before inductionHypothesis =>
      simp only [List.cons_append, natInversionCount]
      have countEq :=
        lowerCount_adjacent_swap head before after first second
      rw [countEq, inductionHypothesis]
      omega

/-- Rank inversion difference lower-bounds every adjacent-swap derivation,
independently of which swaps the relation permits. -/
theorem natInversionCount_bounds_of_traceEquivalentIn
    (Independent : Nat → Nat → Prop)
    {cost : Nat} {first second : List Nat}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    natInversionCount first ≤ natInversionCount second + cost ∧
      natInversionCount second ≤ natInversionCount first + cost := by
  induction equivalent with
  | refl edits => omega
  | swap before after first second independent =>
      exact natInversionCount_adjacent_swap_bounds
        before after first second
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      omega

def rankInversionCount {Edit : Type u}
    (rank : Edit → Nat) (edits : List Edit) : Nat :=
  natInversionCount (edits.map rank)

theorem rankInversionCount_bounds_of_traceEquivalentIn
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    rankInversionCount rank first ≤ rankInversionCount rank second + cost ∧
      rankInversionCount rank second ≤ rankInversionCount rank first + cost := by
  have mapped :=
    Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.map
      Independent (@AllIndependent Nat) rank
      (by simp [AllIndependent]) equivalent
  exact natInversionCount_bounds_of_traceEquivalentIn
    (@AllIndependent Nat) mapped

theorem rankInversionCount_adjacent_inversion_exact
    {Edit : Type u} (rank : Edit → Nat)
    (before after : List Edit) (first second : Edit)
    (inversion : rank second < rank first) :
    rankInversionCount rank (before ++ first :: second :: after) =
      rankInversionCount rank (before ++ second :: first :: after) + 1 := by
  unfold rankInversionCount
  simpa [List.map_append] using
    natInversionCount_adjacent_inversion_exact
      (before.map rank) (after.map rank)
      (rank first) (rank second) inversion

end Sprawlens.NatInversionTrace
