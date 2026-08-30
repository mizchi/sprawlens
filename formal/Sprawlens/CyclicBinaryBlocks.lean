import Mathlib.Data.Fin.Basic
import Mathlib.Data.Finset.Max
import Mathlib.Data.Fintype.Basic

namespace Sprawlens.CyclicBinaryBlocks

/-- A predicate occupies one nonempty interval in the materialized linear index order. -/
def IsLinearInterval {n : Nat} (predicate : Fin n → Prop) : Prop :=
  ∃ first last, ∀ index, predicate index ↔ first ≤ index ∧ index ≤ last

/-- Add a cyclic offset to a finite index. -/
def rotateIndex {n : Nat} (positive : 0 < n) (start index : Fin n) : Fin n :=
  ⟨(start.val + index.val) % n, Nat.mod_lt _ positive⟩

/-- A nontrivial cyclic binary block can be cut immediately before the selected block.
In the rotated order, index zero is rejected and precisely indices `1 .. count`
are selected. -/
def IsRotatedBlock {n : Nat} (predicate : Fin n → Prop) : Prop :=
  ∃ (positive : 0 < n) (start : Fin n) (count : Nat),
    0 < count ∧ count < n ∧
      ∀ index, predicate (rotateIndex positive start index) ↔
        0 < index.val ∧ index.val ≤ count

theorem add_mod_eq_self_or_sub {n left right : Nat}
    (leftBound : left < n) (rightBound : right < n) :
    (left + right) % n =
      if left + right < n then left + right else left + right - n := by
  split
  next sumBound => exact Nat.mod_eq_of_lt sumBound
  next sumNotBound =>
    rw [Nat.mod_eq_sub_mod (by omega)]
    exact Nat.mod_eq_of_lt (by omega)

/-- Convert either linear materialization of a single cyclic block into a cut
immediately before the selected block. -/
theorem rotatedBlock_of_linearInterval_or_complement {n : Nat}
    (predicate : Fin n → Prop)
    (hasPredicate : ∃ index, predicate index)
    (hasComplement : ∃ index, ¬predicate index)
    (block : IsLinearInterval predicate ∨
      IsLinearInterval (fun index => ¬predicate index)) :
    IsRotatedBlock predicate := by
  classical
  rcases hasPredicate with ⟨selected, selectedHolds⟩
  rcases hasComplement with ⟨rejected, rejectedFails⟩
  have positive : 0 < n := Nat.zero_lt_of_lt selected.isLt
  rcases block with selectedInterval | rejectedInterval
  · rcases selectedInterval with ⟨first, last, interval⟩
    have firstBeforeLast : first.val ≤ last.val := by
      have selectedBounds := (interval selected).mp selectedHolds
      omega
    have notWhole : first.val ≠ 0 ∨ last.val + 1 ≠ n := by
      by_contra whole
      push Not at whole
      have rejectedBounds : first ≤ rejected ∧ rejected ≤ last := by
        constructor <;> apply Fin.mk_le_mk.mpr <;> omega
      exact rejectedFails ((interval rejected).mpr rejectedBounds)
    by_cases firstZero : first.val = 0
    · have lastBeforeEnd : last.val + 1 < n := by
        rcases notWhole with impossible | lastNotEnd
        · exact False.elim (impossible firstZero)
        · omega
      let start : Fin n := ⟨n - 1, by omega⟩
      refine ⟨positive, start, last.val + 1, by omega, by omega, ?_⟩
      intro index
      have rotatedValue := add_mod_eq_self_or_sub start.isLt index.isLt
      change predicate
          ⟨(start.val + index.val) % n, Nat.mod_lt _ positive⟩ ↔ _
      rw [interval]
      change
        first.val ≤ (start.val + index.val) % n ∧
            (start.val + index.val) % n ≤ last.val ↔ _
      rw [rotatedValue]
      simp only [start]
      split <;> omega
    · let start : Fin n := ⟨first.val - 1, by omega⟩
      let count := last.val - first.val + 1
      have countPositive : 0 < count := by omega
      have countBeforeEnd : count < n := by
        by_contra countNotBound
        have firstAtStart : first.val = 0 := by omega
        exact firstZero firstAtStart
      refine ⟨positive, start, count, countPositive, countBeforeEnd, ?_⟩
      intro index
      have rotatedValue := add_mod_eq_self_or_sub start.isLt index.isLt
      change predicate
          ⟨(start.val + index.val) % n, Nat.mod_lt _ positive⟩ ↔ _
      rw [interval]
      change
        first.val ≤ (start.val + index.val) % n ∧
            (start.val + index.val) % n ≤ last.val ↔ _
      rw [rotatedValue]
      simp only [start, count]
      split <;> omega
  · rcases rejectedInterval with ⟨first, last, interval⟩
    have firstBeforeLast : first.val ≤ last.val := by
      have rejectedBounds := (interval rejected).mp rejectedFails
      omega
    let count := n - last.val - 1 + first.val
    have afterLastPartition : last.val + 1 + (n - last.val - 1) = n := by
      omega
    have countPositive : 0 < count := by
      by_contra countNotPositive
      have everyRejected : ¬predicate selected := by
        apply (interval selected).mpr
        constructor <;> apply Fin.mk_le_mk.mpr <;> omega
      exact everyRejected selectedHolds
    have countBeforeEnd : count < n := by omega
    refine ⟨positive, last, count, countPositive, countBeforeEnd, ?_⟩
    intro index
    have rotatedValue := add_mod_eq_self_or_sub last.isLt index.isLt
    change predicate
        ⟨(last.val + index.val) % n, Nat.mod_lt _ positive⟩ ↔ _
    simp only [count]
    by_cases sumInRange : last.val + index.val < n
    · have valueEq : (last.val + index.val) % n = last.val + index.val := by
        simpa [sumInRange] using rotatedValue
      have indexEq :
          (⟨(last.val + index.val) % n, Nat.mod_lt _ positive⟩ : Fin n) =
            ⟨last.val + index.val, sumInRange⟩ := Fin.ext valueEq
      rw [indexEq]
      constructor
      · intro holds
        have outsideInterval :
            ¬(first ≤ (⟨last.val + index.val, sumInRange⟩ : Fin n) ∧
              (⟨last.val + index.val, sumInRange⟩ : Fin n) ≤ last) := by
          intro bounds
          exact ((interval _).mpr bounds) holds
        change ¬(first.val ≤ last.val + index.val ∧
          last.val + index.val ≤ last.val) at outsideInterval
        omega
      · intro bounds
        by_contra rejectedHere
        have intervalBounds := (interval _).mp rejectedHere
        change first.val ≤ last.val + index.val ∧
          last.val + index.val ≤ last.val at intervalBounds
        omega
    · have valueEq :
          (last.val + index.val) % n = last.val + index.val - n := by
        simpa [sumInRange] using rotatedValue
      have reducedBound : last.val + index.val - n < n := by omega
      have indexEq :
          (⟨(last.val + index.val) % n, Nat.mod_lt _ positive⟩ : Fin n) =
            ⟨last.val + index.val - n, reducedBound⟩ := Fin.ext valueEq
      rw [indexEq]
      constructor
      · intro holds
        have outsideInterval :
            ¬(first ≤ (⟨last.val + index.val - n, reducedBound⟩ : Fin n) ∧
              (⟨last.val + index.val - n, reducedBound⟩ : Fin n) ≤ last) := by
          intro bounds
          exact ((interval _).mpr bounds) holds
        change ¬(first.val ≤ last.val + index.val - n ∧
          last.val + index.val - n ≤ last.val) at outsideInterval
        omega
      · intro bounds
        by_contra rejectedHere
        have intervalBounds := (interval _).mp rejectedHere
        change first.val ≤ last.val + index.val - n ∧
          last.val + index.val - n ≤ last.val at intervalBounds
        omega

/-- A binary cyclic sequence with no alternating four-term subsequence has one color
as a linear interval. The other color may be the interval crossing the materialization seam. -/
theorem linearInterval_or_complement_of_no_alternation {n : Nat}
    (predicate : Fin n → Prop)
    (hasPredicate : ∃ index, predicate index)
    (hasComplement : ∃ index, ¬predicate index)
    (notPredicateComplementPredicateComplement :
      ∀ a b c d,
        a < b → b < c → c < d →
        ¬(predicate a ∧ ¬predicate b ∧ predicate c ∧ ¬predicate d))
    (notComplementPredicateComplementPredicate :
      ∀ a b c d,
        a < b → b < c → c < d →
        ¬(¬predicate a ∧ predicate b ∧ ¬predicate c ∧ predicate d)) :
    IsLinearInterval predicate ∨ IsLinearInterval (fun index => ¬predicate index) := by
  classical
  let selected : Finset (Fin n) := Finset.univ.filter predicate
  let rejected : Finset (Fin n) := Finset.univ.filter fun index => ¬predicate index
  have selectedNonempty : selected.Nonempty := by
    rcases hasPredicate with ⟨index, holds⟩
    exact ⟨index, by simp [selected, holds]⟩
  have rejectedNonempty : rejected.Nonempty := by
    rcases hasComplement with ⟨index, fails⟩
    exact ⟨index, by simp [rejected, fails]⟩
  let firstSelected := selected.min' selectedNonempty
  let lastSelected := selected.max' selectedNonempty
  let firstRejected := rejected.min' rejectedNonempty
  let lastRejected := rejected.max' rejectedNonempty
  have firstSelectedHolds : predicate firstSelected := by
    have member := Finset.min'_mem selected selectedNonempty
    change predicate (selected.min' selectedNonempty)
    exact (Finset.mem_filter.mp member).2
  have lastSelectedHolds : predicate lastSelected := by
    have member := Finset.max'_mem selected selectedNonempty
    change predicate (selected.max' selectedNonempty)
    exact (Finset.mem_filter.mp member).2
  have firstRejectedFails : ¬predicate firstRejected := by
    have member := Finset.min'_mem rejected rejectedNonempty
    change ¬predicate (rejected.min' rejectedNonempty)
    exact (Finset.mem_filter.mp member).2
  have lastRejectedFails : ¬predicate lastRejected := by
    have member := Finset.max'_mem rejected rejectedNonempty
    change ¬predicate (rejected.max' rejectedNonempty)
    exact (Finset.mem_filter.mp member).2
  by_cases selectedFilled :
      ∀ index, firstSelected ≤ index → index ≤ lastSelected → predicate index
  · left
    refine ⟨firstSelected, lastSelected, fun index => ?_⟩
    constructor
    · intro holds
      have member : index ∈ selected := by simp [selected, holds]
      exact ⟨Finset.min'_le selected index member,
        Finset.le_max' selected index member⟩
    · rintro ⟨afterFirst, beforeLast⟩
      exact selectedFilled index afterFirst beforeLast
  · right
    push Not at selectedFilled
    rcases selectedFilled with
      ⟨middleRejected, afterFirstSelected, beforeLastSelected, middleRejectedFails⟩
    have firstSelectedNeMiddle : firstSelected ≠ middleRejected := by
      intro equal
      subst middleRejected
      exact middleRejectedFails firstSelectedHolds
    have middleNeLastSelected : middleRejected ≠ lastSelected := by
      intro equal
      apply middleRejectedFails
      rw [equal]
      exact lastSelectedHolds
    have firstBeforeMiddle : firstSelected < middleRejected :=
      lt_of_le_of_ne afterFirstSelected firstSelectedNeMiddle
    have middleBeforeLast : middleRejected < lastSelected :=
      lt_of_le_of_ne beforeLastSelected middleNeLastSelected
    refine ⟨firstRejected, lastRejected, fun index => ?_⟩
    constructor
    · intro fails
      have member : index ∈ rejected := by simp [rejected, fails]
      exact ⟨Finset.min'_le rejected index member,
        Finset.le_max' rejected index member⟩
    · rintro ⟨afterFirstRejected, beforeLastRejected⟩
      intro holds
      rcases lt_trichotomy index middleRejected with beforeMiddle | equalMiddle | afterMiddle
      · have firstRejectedBefore : firstRejected < index :=
          lt_of_le_of_ne afterFirstRejected (by
            intro equal
            subst index
            exact firstRejectedFails holds)
        exact notComplementPredicateComplementPredicate
          firstRejected index middleRejected lastSelected
          firstRejectedBefore beforeMiddle middleBeforeLast
          ⟨firstRejectedFails, holds, middleRejectedFails, lastSelectedHolds⟩
      · exact middleRejectedFails (equalMiddle ▸ holds)
      · have beforeLastRejectedStrict : index < lastRejected :=
          lt_of_le_of_ne beforeLastRejected (by
            intro equal
            apply lastRejectedFails
            rw [← equal]
            exact holds)
        exact notPredicateComplementPredicateComplement
          firstSelected middleRejected index lastRejected
          firstBeforeMiddle afterMiddle beforeLastRejectedStrict
          ⟨firstSelectedHolds, middleRejectedFails, holds, lastRejectedFails⟩

end Sprawlens.CyclicBinaryBlocks
