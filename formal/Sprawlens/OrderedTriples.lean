import Mathlib.Data.List.Destutter
import Mathlib.Data.List.Infix
import Mathlib.Data.List.Triplewise
import Sprawlens.ExactGeometry

namespace Sprawlens.OrderedTriples

open ExactGeometry

universe u

/-- Every three values that occur in list order satisfy `relation`.

This project-facing name exposes Mathlib's standard `List.Triplewise` contract. -/
abbrev AllOrderedTriples {α : Type u} (relation : α → α → α → Prop) (values : List α) : Prop :=
  values.Triplewise relation

@[simp]
theorem allOrderedTriples_nil {α : Type u} (relation : α → α → α → Prop) :
    AllOrderedTriples relation [] := by
  simp [AllOrderedTriples]

@[simp]
theorem allOrderedTriples_singleton {α : Type u} (relation : α → α → α → Prop)
    (a : α) : AllOrderedTriples relation [a] := by
  simp [AllOrderedTriples]

theorem allOrderedTriples_of_length_le_two {α : Type u}
    (relation : α → α → α → Prop) {values : List α} (lengthBound : values.length ≤ 2) :
    AllOrderedTriples relation values := by
  cases values with
  | nil => simp [AllOrderedTriples]
  | cons first rest =>
      cases rest with
      | nil => simp [AllOrderedTriples]
      | cons second tail =>
          cases tail with
          | nil => simp [AllOrderedTriples]
          | cons third remaining => simp at lengthBound

theorem allOrderedTriples_sublist {α : Type u} {relation : α → α → α → Prop}
    {output input : List α} (sublist : List.Sublist output input)
    (ordered : AllOrderedTriples relation input) :
    AllOrderedTriples relation output := by
  induction sublist with
  | slnil => exact .nil
  | cons _ _ inductionHypothesis =>
      exact inductionHypothesis (List.triplewise_cons.mp ordered).2
  | cons_cons _ tailSublist inductionHypothesis =>
      exact .cons
        ((List.triplewise_cons.mp ordered).1.sublist tailSublist)
        (inductionHypothesis (List.triplewise_cons.mp ordered).2)

theorem allOrderedTriples_destutter {α : Type u} [DecidableEq α]
    {relation : α → α → α → Prop} {input : List α}
    (ordered : AllOrderedTriples relation input) :
    AllOrderedTriples relation (input.destutter (· ≠ ·)) := by
  exact allOrderedTriples_sublist (List.destutter_sublist (· ≠ ·) input) ordered

/-- Cross-boundary obligations needed to append two ordered-triple lists. -/
def AppendCompatible {α : Type u} (relation : α → α → α → Prop)
    (left right : List α) : Prop :=
  (∀ first ∈ left, right.Pairwise (relation first)) ∧
    ∀ third ∈ right, left.Pairwise fun first second => relation first second third

theorem allOrderedTriples_append {α : Type u} {relation : α → α → α → Prop}
    {left right : List α}
    (leftOrdered : AllOrderedTriples relation left)
    (rightOrdered : AllOrderedTriples relation right)
    (compatible : AppendCompatible relation left right) :
    AllOrderedTriples relation (left ++ right) := by
  exact List.triplewise_append.mpr
    ⟨leftOrdered, rightOrdered, compatible.1, compatible.2⟩

/-- Per-chunk and cross-chunk obligations for a flattened output sequence. -/
def AllOrderedChunks {α : Type u} (relation : α → α → α → Prop) :
    List (List α) → Prop
  | [] => True
  | chunk :: rest =>
      AllOrderedTriples relation chunk ∧
        AppendCompatible relation chunk rest.flatten ∧
        AllOrderedChunks relation rest

/-- Only the obligations that cross a chunk boundary. -/
def CrossCompatibleChunks {α : Type u} (relation : α → α → α → Prop) :
    List (List α) → Prop
  | [] => True
  | chunk :: rest =>
      AppendCompatible relation chunk rest.flatten ∧
        CrossCompatibleChunks relation rest

theorem allOrderedChunks_of_each_of_cross {α : Type u}
    {relation : α → α → α → Prop} {chunks : List (List α)}
    (each : ∀ chunk ∈ chunks, AllOrderedTriples relation chunk)
    (cross : CrossCompatibleChunks relation chunks) :
    AllOrderedChunks relation chunks := by
  induction chunks with
  | nil => trivial
  | cons chunk rest inductionHypothesis =>
      exact ⟨each chunk (by simp), cross.1,
        inductionHypothesis (fun tail member => each tail (by simp [member])) cross.2⟩

theorem allOrderedTriples_flatten {α : Type u} {relation : α → α → α → Prop} :
    ∀ {chunks : List (List α)}, AllOrderedChunks relation chunks →
      AllOrderedTriples relation chunks.flatten
  | [], _ => by simp
  | chunk :: rest, ordered => by
      rw [List.flatten_cons]
      exact allOrderedTriples_append ordered.1
        (allOrderedTriples_flatten ordered.2.2) ordered.2.1

theorem relation_of_prefix {α : Type u} {relation : α → α → α → Prop}
    {a b c : α} {rest : List α}
    (ordered : AllOrderedTriples relation (a :: b :: c :: rest)) : relation a b c := by
  simpa using (List.triplewise_cons.mp ordered).1.rel_head_tail (a := c) (by simp)

/-- Every adjacent triple in an open list satisfies `relation`. -/
def AllAdjacentTriples {α : Type u} (relation : α → α → α → Prop) : List α → Prop
  | first :: second :: third :: rest =>
      relation first second third ∧ AllAdjacentTriples relation (second :: third :: rest)
  | _ => True

/-- The two adjacent triples that cross the last-to-first boundary of a list ring. -/
def WrapAdjacentTriples {α : Type u}
    (relation : α → α → α → Prop) (values : List α) : Prop :=
  ∀ first second penultimate last,
    List.IsPrefix [first, second] values →
    List.IsSuffix [penultimate, last] values →
    relation penultimate last first ∧ relation last first second

def CyclicAdjacentTriples {α : Type u}
    (relation : α → α → α → Prop) (values : List α) : Prop :=
  AllAdjacentTriples relation values ∧ WrapAdjacentTriples relation values

theorem wrapAdjacentTriples_of_boundary
    {α : Type u} {relation : α → α → α → Prop} {values : List α}
    {first second penultimate last : α}
    (prefixProof : List.IsPrefix [first, second] values)
    (suffixProof : List.IsSuffix [penultimate, last] values)
    (boundary : relation penultimate last first ∧ relation last first second) :
    WrapAdjacentTriples relation values := by
  intro candidateFirst candidateSecond candidatePenultimate candidateLast
    candidatePrefix candidateSuffix
  have prefixEq : [first, second] = [candidateFirst, candidateSecond] := by
    rw [List.prefix_iff_eq_take] at prefixProof candidatePrefix
    exact prefixProof.trans candidatePrefix.symm
  have suffixReverseEq : [last, penultimate] = [candidateLast, candidatePenultimate] := by
    have knownReverse := suffixProof.reverse
    have candidateReverse := candidateSuffix.reverse
    change List.IsPrefix [last, penultimate] values.reverse at knownReverse
    change List.IsPrefix [candidateLast, candidatePenultimate] values.reverse at candidateReverse
    rw [List.prefix_iff_eq_take] at knownReverse candidateReverse
    exact knownReverse.trans candidateReverse.symm
  simp at prefixEq suffixReverseEq
  rcases prefixEq with ⟨rfl, rfl⟩
  rcases suffixReverseEq with ⟨rfl, rfl⟩
  exact boundary

theorem cyclicAdjacentTriples_of_open_and_boundary
    {α : Type u} {relation : α → α → α → Prop} {values : List α}
    {first second penultimate last : α}
    (openTurns : AllAdjacentTriples relation values)
    (prefixProof : List.IsPrefix [first, second] values)
    (suffixProof : List.IsSuffix [penultimate, last] values)
    (boundary : relation penultimate last first ∧ relation last first second) :
    CyclicAdjacentTriples relation values := by
  exact ⟨openTurns, wrapAdjacentTriples_of_boundary prefixProof suffixProof boundary⟩

theorem AllOrderedTriples.adjacent {α : Type u} {relation : α → α → α → Prop} :
    ∀ {values : List α}, AllOrderedTriples relation values → AllAdjacentTriples relation values
  | [], _ => trivial
  | [_], _ => trivial
  | [_, _], _ => trivial
  | _ :: _ :: _ :: _, ordered =>
      ⟨relation_of_prefix ordered,
        AllOrderedTriples.adjacent (List.triplewise_cons.mp ordered).2⟩

def AllOrderedCCW {R : Type u} [Field R] [LinearOrder R] (points : List (Vec2 R)) : Prop :=
  AllOrderedTriples (fun a b c => 0 ≤ orientation a b c) points

def AdjacentTurnsNonnegative {R : Type u} [Field R] [LinearOrder R]
    (points : List (Vec2 R)) : Prop :=
  AllAdjacentTriples (fun a b c => 0 ≤ orientation a b c) points

def WrapTurnsNonnegative {R : Type u} [Field R] [LinearOrder R]
    (points : List (Vec2 R)) : Prop :=
  WrapAdjacentTriples (fun a b c => 0 ≤ orientation a b c) points

def CyclicTurnsNonnegative {R : Type u} [Field R] [LinearOrder R]
    (points : List (Vec2 R)) : Prop :=
  CyclicAdjacentTriples (fun a b c => 0 ≤ orientation a b c) points

def AllOrderedCCWChunks {R : Type u} [Field R] [LinearOrder R]
    (chunks : List (List (Vec2 R))) : Prop :=
  AllOrderedChunks (fun a b c => 0 ≤ orientation a b c) chunks

def CrossCompatibleCCWChunks {R : Type u} [Field R] [LinearOrder R]
    (chunks : List (List (Vec2 R))) : Prop :=
  CrossCompatibleChunks (fun a b c => 0 ≤ orientation a b c) chunks

theorem AllOrderedCCWChunks.of_each_of_cross
    {R : Type u} [Field R] [LinearOrder R] {chunks : List (List (Vec2 R))}
    (each : ∀ chunk ∈ chunks, AllOrderedCCW chunk)
    (cross : CrossCompatibleCCWChunks chunks) :
    AllOrderedCCWChunks chunks := by
  exact allOrderedChunks_of_each_of_cross each cross

theorem AllOrderedCCWChunks.flatten {R : Type u} [Field R] [LinearOrder R]
    {chunks : List (List (Vec2 R))} (ordered : AllOrderedCCWChunks chunks) :
    AllOrderedCCW chunks.flatten := by
  exact allOrderedTriples_flatten ordered

theorem AllOrderedCCW.adjacent {R : Type u} [Field R] [LinearOrder R]
    {points : List (Vec2 R)} (ordered : AllOrderedCCW points) :
    AdjacentTurnsNonnegative points := by
  exact AllOrderedTriples.adjacent ordered

theorem AllOrderedCCW.cyclic {R : Type u} [Field R] [LinearOrder R]
    {points : List (Vec2 R)} (ordered : AllOrderedCCW points) :
    CyclicTurnsNonnegative points := by
  refine ⟨ordered.adjacent, ?_⟩
  intro first second penultimate last prefixProof suffixProof
  rw [List.prefix_iff_exists_eq_append] at prefixProof
  rcases prefixProof with ⟨tail, rfl⟩
  cases tail using List.reverseRecOn with
  | nil =>
      have suffixReverse := suffixProof.reverse
      change List.IsPrefix [last, penultimate] [second, first] at suffixReverse
      rw [List.prefix_iff_eq_take] at suffixReverse
      simp at suffixReverse
      rcases suffixReverse with ⟨rfl, rfl⟩
      simp
  | append_singleton initial lastActual =>
      cases initial using List.reverseRecOn with
      | nil =>
          have suffixReverse := suffixProof.reverse
          change List.IsPrefix [last, penultimate] [lastActual, second, first] at suffixReverse
          rw [List.prefix_iff_eq_take] at suffixReverse
          have endpointEq : last = lastActual ∧ penultimate = second := by
            simpa using suffixReverse
          have lastEq := endpointEq.1
          have penultimateEq := endpointEq.2
          subst last
          subst penultimate
          have turn : 0 ≤ orientation first second lastActual := by
            simpa [AllOrderedCCW, AllOrderedTriples] using ordered
          constructor
          · change 0 ≤ orientation second lastActual first
            rw [orientation_cycle]
            exact turn
          · change 0 ≤ orientation lastActual first second
            rw [orientation_cycle, orientation_cycle]
            exact turn
      | append_singleton middle penultimateActual =>
          have suffixReverse : List.IsPrefix [last, penultimate]
              (lastActual :: penultimateActual ::
                (middle.reverse ++ [second, first])) := by
            simpa [List.reverse_append, List.append_assoc] using suffixProof.reverse
          rw [List.prefix_iff_eq_take] at suffixReverse
          have endpointEq : last = lastActual ∧ penultimate = penultimateActual := by
            simpa using suffixReverse
          have lastEq := endpointEq.1
          have penultimateEq := endpointEq.2
          subst last
          subst penultimate
          have orderedNormalized : AllOrderedCCW
              ([first, second] ++ middle ++ [penultimateActual, lastActual]) := by
            simpa [List.append_assoc] using ordered
          have firstBoundarySublist :
              List.Sublist [first, penultimateActual, lastActual]
                ([first, second] ++ middle ++ [penultimateActual, lastActual]) := by
            apply List.Sublist.cons_cons first
            exact List.sublist_append_right (second :: middle)
              [penultimateActual, lastActual]
          have secondBoundarySublist :
              List.Sublist [first, second, lastActual]
                ([first, second] ++ middle ++ [penultimateActual, lastActual]) := by
            apply List.Sublist.cons_cons first
            apply List.Sublist.cons_cons second
            exact (by simp : List.Sublist [lastActual]
              (middle ++ [penultimateActual, lastActual]))
          have firstTurn : 0 ≤ orientation first penultimateActual lastActual := by
            exact relation_of_prefix
              (allOrderedTriples_sublist firstBoundarySublist orderedNormalized)
          have secondTurn : 0 ≤ orientation first second lastActual := by
            exact relation_of_prefix
              (allOrderedTriples_sublist secondBoundarySublist orderedNormalized)
          constructor
          · change 0 ≤ orientation penultimateActual lastActual first
            rw [orientation_cycle]
            exact firstTurn
          · change 0 ≤ orientation lastActual first second
            rw [orientation_cycle, orientation_cycle]
            exact secondTurn

theorem AllOrderedCCW.sublist {R : Type u} [Field R] [LinearOrder R]
    {output input : List (Vec2 R)} (sublist : List.Sublist output input)
    (ordered : AllOrderedCCW input) : AllOrderedCCW output := by
  exact allOrderedTriples_sublist sublist ordered

theorem AllOrderedCCW.destutter {R : Type u} [Field R] [LinearOrder R]
    [DecidableEq R] {input : List (Vec2 R)} (ordered : AllOrderedCCW input) :
    AllOrderedCCW (input.destutter (· ≠ ·)) := by
  exact allOrderedTriples_destutter ordered

/-- Adjacent triples alone are not stable under an arbitrary sublist operation. -/
def localTurnCounterexampleSource : List (Vec2 Rat) :=
  [{ x := 0, y := 0 }, { x := 2, y := -1 }, { x := 1, y := 0 }, { x := 1, y := -1 }]

def localTurnCounterexampleOutput : List (Vec2 Rat) :=
  [{ x := 0, y := 0 }, { x := 1, y := 0 }, { x := 1, y := -1 }]

theorem local_turns_do_not_survive_arbitrary_sublist :
    List.Sublist localTurnCounterexampleOutput localTurnCounterexampleSource ∧
      0 ≤ orientation
        ({ x := 0, y := 0 } : Vec2 Rat)
        ({ x := 2, y := -1 } : Vec2 Rat)
        ({ x := 1, y := 0 } : Vec2 Rat) ∧
      0 ≤ orientation
        ({ x := 2, y := -1 } : Vec2 Rat)
        ({ x := 1, y := 0 } : Vec2 Rat)
        ({ x := 1, y := -1 } : Vec2 Rat) ∧
      orientation
        ({ x := 0, y := 0 } : Vec2 Rat)
        ({ x := 1, y := 0 } : Vec2 Rat)
        ({ x := 1, y := -1 } : Vec2 Rat) < 0 := by
  native_decide

end Sprawlens.OrderedTriples
