import Mathlib.Data.List.Sort
import Mathlib.Data.List.TakeWhile
import Sprawlens.NatInversionTrace

namespace Sprawlens.NaturalRankStableTrace

open NatInversionTrace
open QuantitativeConfluence
open TraceDerivationGenerator

universe u

def CrossRankIndependent {Edit : Type u}
    (rank : Edit → Nat) (first second : Edit) : Prop :=
  rank first ≠ rank second

/-- Stable canonical form for an arbitrary finite trace whose edit classes
carry natural-number ranks. Equal-rank payload order is retained by insertion
sort. -/
def rankCanonical {Edit : Type u}
    (rank : Edit → Nat) (edits : List Edit) : List Edit :=
  edits.insertionSort fun first second => rank first ≤ rank second

def lowerRankPredicate {Edit : Type u}
    (rank : Edit → Nat) (pivot : Nat) (edit : Edit) : Bool :=
  decide (rank edit < pivot)

theorem lowerCount_map_rank
    {Edit : Type u} (rank : Edit → Nat)
    (pivot : Nat) (edits : List Edit) :
    lowerCount pivot (edits.map rank) =
      (edits.filter (lowerRankPredicate rank pivot)).length := by
  induction edits with
  | nil => simp
  | cons edit rest inductionHypothesis =>
      rw [List.map_cons, lowerCount_cons, inductionHypothesis]
      unfold lowerRankPredicate
      by_cases editLower : rank edit < pivot <;>
        simp [editLower, Nat.add_comm]

/-- In a nondecreasing list, filtering elements below a pivot is exactly the
initial `takeWhile` prefix. -/
theorem filter_lower_eq_takeWhile_of_pairwise
    {Edit : Type u} (rank : Edit → Nat) (pivot : Nat)
    (edits : List Edit)
    (sorted : edits.Pairwise fun first second => rank first ≤ rank second) :
    edits.filter (lowerRankPredicate rank pivot) =
      edits.takeWhile (lowerRankPredicate rank pivot) := by
  induction edits with
  | nil => simp
  | cons edit rest inductionHypothesis =>
      have sortedParts := List.pairwise_cons.mp sorted
      by_cases editLower : rank edit < pivot
      · have tailEquality := inductionHypothesis sortedParts.2
        simp [lowerRankPredicate, editLower, tailEquality]
      · have pivotLeEdit : pivot ≤ rank edit := Nat.le_of_not_gt editLower
        have noTailLower :
            ∀ other, other ∈ rest → ¬rank other < pivot := by
          intro other otherMem otherLower
          have editLeOther := sortedParts.1 other otherMem
          omega
        have filteredTailEmpty :
            rest.filter (lowerRankPredicate rank pivot) = [] := by
          apply List.filter_eq_nil_iff.mpr
          intro other otherMem
          simpa [lowerRankPredicate] using noTailLower other otherMem
        simp [lowerRankPredicate, editLower, filteredTailEmpty]

theorem rankCanonical_pairwise
    {Edit : Type u} (rank : Edit → Nat) (edits : List Edit) :
    (rankCanonical rank edits).Pairwise
      fun first second => rank first ≤ rank second := by
  let relation : Edit → Edit → Prop :=
    fun first second => rank first ≤ rank second
  let _ : Std.Total relation :=
    ⟨fun first second => Nat.le_total (rank first) (rank second)⟩
  let _ : IsTrans Edit relation :=
    ⟨fun _ _ _ firstSecond secondThird =>
      Nat.le_trans firstSecond secondThird⟩
  exact List.pairwise_insertionSort relation edits

theorem rankCanonical_perm
    {Edit : Type u} (rank : Edit → Nat) (edits : List Edit) :
    (rankCanonical rank edits).Perm edits := by
  exact List.perm_insertionSort
    (fun first second => rank first ≤ rank second) edits

theorem lowerPrefix_rankCanonical_length
    {Edit : Type u} (rank : Edit → Nat)
    (pivot : Nat) (edits : List Edit) :
    ((rankCanonical rank edits).takeWhile
        (lowerRankPredicate rank pivot)).length =
      lowerCount pivot (edits.map rank) := by
  let canonical := rankCanonical rank edits
  let predicate := lowerRankPredicate rank pivot
  have filterTake : canonical.filter predicate =
      canonical.takeWhile predicate :=
    filter_lower_eq_takeWhile_of_pairwise rank pivot canonical
      (rankCanonical_pairwise rank edits)
  have filteredPerm :
      (canonical.filter predicate).Perm (edits.filter predicate) :=
    (rankCanonical_perm rank edits).filter predicate
  calc
    (canonical.takeWhile predicate).length =
        (canonical.filter predicate).length := by rw [filterTake]
    _ = (edits.filter predicate).length := filteredPerm.length_eq
    _ = lowerCount pivot (edits.map rank) :=
      (lowerCount_map_rank rank pivot edits).symm

theorem rankCanonical_idempotent
    {Edit : Type u} (rank : Edit → Nat) (edits : List Edit) :
    rankCanonical rank (rankCanonical rank edits) =
      rankCanonical rank edits := by
  unfold rankCanonical
  exact (rankCanonical_pairwise rank edits).insertionSort_eq

@[simp] theorem rankInversionCount_rankCanonical
    {Edit : Type u} (rank : Edit → Nat) (edits : List Edit) :
    rankInversionCount rank (rankCanonical rank edits) = 0 := by
  unfold rankInversionCount
  apply natInversionCount_eq_zero_of_pairwise_le
  exact List.pairwise_map.mpr (rankCanonical_pairwise rank edits)

def InversionsIndependent {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (edits : List Edit) : Prop :=
  ∀ first, first ∈ edits → ∀ second, second ∈ edits →
    rank second < rank first → Independent first second

/-- Stable insertion-sort canonicalization only needs independence for the
inverted edit pairs actually present in the input trace. Non-inverted and
equal-rank dependent pairs are never swapped. -/
theorem naturalRankStableTrace_of_inversionsIndependent
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) (edits : List Edit)
    (inversionsIndependent : InversionsIndependent rank Independent edits) :
    TraceEquivalentIn Independent
      (rankInversionCount rank edits)
      edits (rankCanonical rank edits) := by
  induction edits with
  | nil =>
      simpa [rankCanonical, rankInversionCount, natInversionCount] using
        (TraceEquivalentIn.refl
          (Independent := Independent) [])
  | cons edit rest inductionHypothesis =>
      let canonical := rankCanonical rank rest
      let predicate := lowerRankPredicate rank (rank edit)
      let lowerPrefix := canonical.takeWhile predicate
      let upperSuffix := canonical.dropWhile predicate
      have restInversionsIndependent :
          InversionsIndependent rank Independent rest := by
        intro first firstMem second secondMem inversion
        exact inversionsIndependent first (by simp [firstMem])
          second (by simp [secondMem]) inversion
      have normalizeTail :
          TraceEquivalentIn Independent
            (rankInversionCount rank rest)
            (edit :: rest) (edit :: canonical) :=
        Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
          Independent [edit]
          (inductionHypothesis restInversionsIndependent)
      have editIndependentLower :
          ∀ other, other ∈ lowerPrefix →
            Independent edit other := by
        intro other otherMem
        have predicateTrue : predicate other :=
          List.mem_takeWhile_imp otherMem
        have otherLower : rank other < rank edit := by
          simpa [predicate, lowerRankPredicate] using predicateTrue
        have otherCanonicalMem : other ∈ canonical := by
          rw [← List.takeWhile_append_dropWhile
            (p := predicate) (l := canonical)]
          exact List.mem_append_left _ otherMem
        have otherRestMem : other ∈ rest :=
          (rankCanonical_perm rank rest).mem_iff.mp otherCanonicalMem
        exact inversionsIndependent edit (by simp)
          other (by simp [otherRestMem]) otherLower
      have insertHead :
          TraceEquivalentIn Independent lowerPrefix.length
            (edit :: canonical)
            (rankCanonical rank (edit :: rest)) := by
        have move :=
          Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.append
            Independent upperSuffix
            (moveRight Independent
              edit lowerPrefix editIndependentLower)
        have splitCanonical : lowerPrefix ++ upperSuffix = canonical := by
          exact List.takeWhile_append_dropWhile
        have predicateEq :
            (fun other => decide ¬rank edit ≤ rank other) = predicate := by
          funext other
          simp [predicate, lowerRankPredicate]
        rw [rankCanonical, List.insertionSort_cons_eq_take_drop]
        rw [predicateEq]
        simpa [canonical, rankCanonical, predicate, lowerPrefix, upperSuffix,
          splitCanonical, List.append_assoc] using move
      have prefixLength :
          lowerPrefix.length =
            lowerCount (rank edit) (rest.map rank) := by
        exact lowerPrefix_rankCanonical_length rank (rank edit) rest
      simpa [rankInversionCount, natInversionCount,
        prefixLength, Nat.add_comm] using
        normalizeTail.trans insertHead

/-- Under the common cross-rank independence policy, every inversion is
independent, so the local premise above is discharged automatically. -/
theorem naturalRankStableTrace
    {Edit : Type u} (rank : Edit → Nat) (edits : List Edit) :
    TraceEquivalentIn (CrossRankIndependent rank)
      (rankInversionCount rank edits)
      edits (rankCanonical rank edits) := by
  apply naturalRankStableTrace_of_inversionsIndependent
  intro first firstMem second secondMem inversion
  exact Nat.ne_of_gt inversion

/-- The same exact shortest result holds for an arbitrary dependence graph
whenever every inverted pair in this concrete input trace is independent. -/
theorem naturalRankStableTrace_cost_exact_of_inversionsIndependent
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) (edits : List Edit)
    (inversionsIndependent : InversionsIndependent rank Independent edits) :
    TraceEquivalentIn Independent
        (rankInversionCount rank edits)
        edits (rankCanonical rank edits) ∧
      ∀ {cost}, TraceEquivalentIn Independent
          cost edits (rankCanonical rank edits) →
        rankInversionCount rank edits ≤ cost := by
  refine ⟨naturalRankStableTrace_of_inversionsIndependent
    rank Independent edits inversionsIndependent, ?_⟩
  intro cost equivalent
  have potentialBound :=
    (rankInversionCount_bounds_of_traceEquivalentIn
      rank Independent equivalent).1
  simpa using potentialBound

/-- Natural-rank stable canonicalization is globally shortest among every
derivation allowed to swap only different-rank edits. -/
theorem naturalRankStableTrace_cost_exact
    {Edit : Type u} (rank : Edit → Nat) (edits : List Edit) :
    TraceEquivalentIn (CrossRankIndependent rank)
        (rankInversionCount rank edits)
        edits (rankCanonical rank edits) ∧
      ∀ {cost}, TraceEquivalentIn (CrossRankIndependent rank)
          cost edits (rankCanonical rank edits) →
        rankInversionCount rank edits ≤ cost := by
  apply naturalRankStableTrace_cost_exact_of_inversionsIndependent
  intro first firstMem second secondMem inversion
  exact Nat.ne_of_gt inversion

def NoRankIndependent (_ _ : Nat) : Prop :=
  False

/-- Load-bearing counterexample: a reversed two-rank trace cannot reach its
sorted form when its only inversion is dependent. -/
theorem blockedRankInversion_no_derivation (cost : Nat) :
    ¬TraceEquivalentIn NoRankIndependent cost [1, 0] [0, 1] := by
  intro equivalent
  have listsEqual :=
    Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.eq_of_no_independent
      NoRankIndependent (by simp [NoRankIndependent]) equivalent
  have listsDiffer : [1, 0] ≠ [0, 1] := by decide
  exact listsDiffer listsEqual

theorem blockedRankInversion_not_inversionsIndependent :
    ¬InversionsIndependent id NoRankIndependent [1, 0] := by
  intro independent
  exact independent 1 (by simp) 0 (by simp) (by norm_num [id])

theorem reverseFourRanks_cost_exact :
    TraceEquivalentIn (CrossRankIndependent id) 6
        [3, 2, 1, 0] [0, 1, 2, 3] ∧
      ∀ {cost}, TraceEquivalentIn (CrossRankIndependent id) cost
          [3, 2, 1, 0] [0, 1, 2, 3] →
        6 ≤ cost := by
  simpa [rankInversionCount, natInversionCount, lowerCount,
    rankCanonical] using
    (naturalRankStableTrace_cost_exact id [3, 2, 1, 0])

end Sprawlens.NaturalRankStableTrace
