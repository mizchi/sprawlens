import Sprawlens.NatInversionTrace

namespace Sprawlens.ReachableRankNormalization

open NatInversionTrace
open QuantitativeConfluence

universe u

/-- A directed derivation that may swap only adjacent, independent strict
rank inversions. Unlike `TraceEquivalentIn`, this relation deliberately has
no symmetry constructor: every primitive step moves downhill. -/
inductive DescendingTraceIn {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop) :
    Nat → List Edit → List Edit → Prop where
  | refl (edits : List Edit) :
      DescendingTraceIn rank Independent 0 edits edits
  | swap (before after : List Edit) (first second : Edit)
      (independent : Independent first second)
      (inversion : rank second < rank first) :
      DescendingTraceIn rank Independent 1
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | trans {leftCost rightCost : Nat} {first middle last : List Edit}
      (left : DescendingTraceIn rank Independent leftCost first middle)
      (right : DescendingTraceIn rank Independent rightCost middle last) :
      DescendingTraceIn rank Independent
        (leftCost + rightCost) first last

theorem DescendingTraceIn.toTraceEquivalentIn
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {cost : Nat} {first second : List Edit}
    (descending : DescendingTraceIn rank Independent cost first second) :
    TraceEquivalentIn Independent cost first second := by
  induction descending with
  | refl edits => exact .refl edits
  | swap before after first second independent inversion =>
      exact .swap before after first second independent
  | trans left right leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- Exact potential accounting: a directed derivation consumes exactly one
rank inversion per primitive swap. -/
theorem DescendingTraceIn.rankInversionCount_eq
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {cost : Nat} {first second : List Edit}
    (descending : DescendingTraceIn rank Independent cost first second) :
    rankInversionCount rank first =
      cost + rankInversionCount rank second := by
  induction descending with
  | refl edits => simp
  | swap before after first second independent inversion =>
      simpa [Nat.add_comm] using rankInversionCount_adjacent_inversion_exact
        rank before after first second inversion
  | trans left right leftHypothesis rightHypothesis => omega

theorem DescendingTraceIn.cost_le_initialInversions
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {cost : Nat} {first second : List Edit}
    (descending : DescendingTraceIn rank Independent cost first second) :
    cost ≤ rankInversionCount rank first := by
  have accounting := descending.rankInversionCount_eq rank Independent
  omega

theorem DescendingTraceIn.strictly_decreases_of_positive
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {cost : Nat} {first second : List Edit}
    (descending : DescendingTraceIn rank Independent cost first second)
    (positive : 0 < cost) :
    rankInversionCount rank second < rankInversionCount rank first := by
  have accounting := descending.rankInversionCount_eq rank Independent
  omega

/-- No positive-cost directed normalization cycle exists. -/
theorem DescendingTraceIn.no_positive_cycle
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {cost : Nat} {edits : List Edit}
    (descending : DescendingTraceIn rank Independent cost edits edits) :
    cost = 0 := by
  have accounting := descending.rankInversionCount_eq rank Independent
  omega

/-- One permitted normalization step, oriented from the current trace toward
the trace with one fewer rank inversion. -/
def RankReduction {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (next current : List Edit) : Prop :=
  ∃ before after first second,
    current = before ++ first :: second :: after ∧
    next = before ++ second :: first :: after ∧
    Independent first second ∧ rank second < rank first

theorem RankReduction.toDescendingTraceIn
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {next current : List Edit}
    (reduction : RankReduction rank Independent next current) :
    DescendingTraceIn rank Independent 1 current next := by
  obtain ⟨before, after, first, second,
    currentEq, nextEq, independent, inversion⟩ := reduction
  rw [currentEq, nextEq]
  exact .swap before after first second independent inversion

theorem RankReduction.rankInversionCount_lt
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {next current : List Edit}
    (reduction : RankReduction rank Independent next current) :
    rankInversionCount rank next < rankInversionCount rank current := by
  have accounting :=
    (reduction.toDescendingTraceIn rank Independent).rankInversionCount_eq
      rank Independent
  omega

/-- Directed independent-inversion reduction is well-founded, even when
dependent inversions prevent the globally sorted trace from being reached. -/
theorem rankReduction_wellFounded
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) :
    WellFounded (RankReduction rank Independent) := by
  apply (measure (rankInversionCount rank)).wf.mono
  intro next current reduction
  exact reduction.rankInversionCount_lt rank Independent

/-- Structural recognition of an adjacent independent strict inversion. -/
def HasReducibleAdjacent {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop) :
    List Edit → Prop
  | first :: second :: rest =>
      (Independent first second ∧ rank second < rank first) ∨
        HasReducibleAdjacent rank Independent (second :: rest)
  | _ => False

instance instDecidableHasReducibleAdjacent
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (edits : List Edit) :
    Decidable (HasReducibleAdjacent rank Independent edits) := by
  induction edits with
  | nil => exact isFalse id
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => exact isFalse id
      | cons second tail =>
          simp only [HasReducibleAdjacent]
          infer_instance

theorem HasReducibleAdjacent.prepend
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (head : Edit) {edits : List Edit}
    (reducible : HasReducibleAdjacent rank Independent edits) :
    HasReducibleAdjacent rank Independent (head :: edits) := by
  cases edits with
  | nil => contradiction
  | cons second rest => exact Or.inr reducible

theorem hasReducibleAdjacent_of_context
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (before after : List Edit) (first second : Edit)
    (independent : Independent first second)
    (inversion : rank second < rank first) :
    HasReducibleAdjacent rank Independent
      (before ++ first :: second :: after) := by
  induction before with
  | nil => exact Or.inl ⟨independent, inversion⟩
  | cons head before inductionHypothesis =>
      exact inductionHypothesis.prepend rank Independent head

theorem exists_rankReduction_of_hasReducibleAdjacent
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    {edits : List Edit}
    (reducible : HasReducibleAdjacent rank Independent edits) :
    ∃ next, RankReduction rank Independent next edits := by
  induction edits with
  | nil => simp [HasReducibleAdjacent] at reducible
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => simp [HasReducibleAdjacent] at reducible
      | cons second after =>
          rcases reducible with direct | tail
          · exact ⟨second :: first :: after,
              [], after, first, second, rfl, rfl, direct.1, direct.2⟩
          · obtain ⟨next, before, suffix, left, right,
              currentEq, nextEq, independent, inversion⟩ :=
                inductionHypothesis tail
            refine ⟨first :: next, first :: before, suffix, left, right,
              ?_, ?_, independent, inversion⟩
            · simp [currentEq]
            · simp [nextEq]

theorem exists_rankReduction_iff_hasReducibleAdjacent
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) (edits : List Edit) :
    (∃ next, RankReduction rank Independent next edits) ↔
      HasReducibleAdjacent rank Independent edits := by
  constructor
  · rintro ⟨next, before, after, first, second,
      currentEq, nextEq, independent, inversion⟩
    rw [currentEq]
    exact hasReducibleAdjacent_of_context rank Independent
      before after first second independent inversion
  · exact exists_rankReduction_of_hasReducibleAdjacent rank Independent

def IsReachableRankNormalForm {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (edits : List Edit) : Prop :=
  ¬HasReducibleAdjacent rank Independent edits

instance instDecidableIsReachableRankNormalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (edits : List Edit) :
    Decidable (IsReachableRankNormalForm rank Independent edits) := by
  unfold IsReachableRankNormalForm
  infer_instance

/-- Every finite trace reaches some irreducible representative by repeatedly
swapping independent strict inversions. This is an existence theorem only;
it does not assert that different reduction choices yield the same normal
form. -/
theorem exists_reachableRankNormalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) (edits : List Edit) :
    ∃ cost normal,
      DescendingTraceIn rank Independent cost edits normal ∧
      IsReachableRankNormalForm rank Independent normal := by
  classical
  refine (rankReduction_wellFounded rank Independent).induction
    (C := fun current =>
      ∃ cost normal,
        DescendingTraceIn rank Independent cost current normal ∧
        IsReachableRankNormalForm rank Independent normal)
    edits ?_
  intro current inductionHypothesis
  by_cases normalForm : IsReachableRankNormalForm rank Independent current
  · exact ⟨0, current, .refl current, normalForm⟩
  · have reducible : HasReducibleAdjacent rank Independent current :=
      not_not.mp normalForm
    obtain ⟨next, reduction⟩ :=
      exists_rankReduction_of_hasReducibleAdjacent
        rank Independent reducible
    obtain ⟨cost, normal, path, normalForm⟩ :=
      inductionHypothesis next reduction
    refine ⟨1 + cost, normal, ?_, normalForm⟩
    exact (reduction.toDescendingTraceIn rank Independent).trans path

theorem exists_reachableRankNormalForm_with_cost_bound
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop) (edits : List Edit) :
    ∃ cost normal,
      DescendingTraceIn rank Independent cost edits normal ∧
      IsReachableRankNormalForm rank Independent normal ∧
      cost ≤ rankInversionCount rank edits := by
  obtain ⟨cost, normal, path, normalForm⟩ :=
    exists_reachableRankNormalForm rank Independent edits
  exact ⟨cost, normal, path, normalForm,
    path.cost_le_initialInversions rank Independent⟩

inductive ForkEdit where
  | high
  | middle
  | low
  deriving DecidableEq

def forkRank : ForkEdit → Nat
  | .high => 2
  | .middle => 1
  | .low => 0

/-- A symmetric path-shaped independence graph: high--middle--low, without
an edge between high and low. -/
def ForkIndependent : ForkEdit → ForkEdit → Prop
  | .high, .middle
  | .middle, .high
  | .middle, .low
  | .low, .middle => True
  | _, _ => False

theorem fork_left_reachable :
    DescendingTraceIn forkRank ForkIndependent 1
      [.high, .middle, .low] [.middle, .high, .low] := by
  simpa using DescendingTraceIn.swap
    (rank := forkRank) (Independent := ForkIndependent)
    [] [.low] .high .middle (by simp [ForkIndependent]) (by simp [forkRank])

theorem fork_right_reachable :
    DescendingTraceIn forkRank ForkIndependent 1
      [.high, .middle, .low] [.high, .low, .middle] := by
  simpa using DescendingTraceIn.swap
    (rank := forkRank) (Independent := ForkIndependent)
    [.high] [] .middle .low (by simp [ForkIndependent]) (by simp [forkRank])

theorem fork_left_normalForm :
    IsReachableRankNormalForm forkRank ForkIndependent
      [.middle, .high, .low] := by
  simp [IsReachableRankNormalForm, HasReducibleAdjacent,
    forkRank, ForkIndependent]

theorem fork_right_normalForm :
    IsReachableRankNormalForm forkRank ForkIndependent
      [.high, .low, .middle] := by
  simp [IsReachableRankNormalForm, HasReducibleAdjacent,
    forkRank, ForkIndependent]

/-- Load-bearing non-confluence witness: the same trace has two distinct
reachable irreducible representatives under a symmetric independence graph. -/
theorem reachableRankNormalForm_not_unique :
    [.middle, .high, .low] ≠ ([.high, .low, .middle] : List ForkEdit) ∧
      DescendingTraceIn forkRank ForkIndependent 1
        [.high, .middle, .low] [.middle, .high, .low] ∧
      DescendingTraceIn forkRank ForkIndependent 1
        [.high, .middle, .low] [.high, .low, .middle] ∧
      IsReachableRankNormalForm forkRank ForkIndependent
        [.middle, .high, .low] ∧
      IsReachableRankNormalForm forkRank ForkIndependent
        [.high, .low, .middle] := by
  exact ⟨by decide, fork_left_reachable, fork_right_reachable,
    fork_left_normalForm, fork_right_normalForm⟩

end Sprawlens.ReachableRankNormalization
