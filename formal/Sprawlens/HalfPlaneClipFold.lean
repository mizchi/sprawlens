import Mathlib.Data.List.Destutter
import Sprawlens.HalfPlaneClipStep
import Sprawlens.OrderedTriples

namespace Sprawlens.HalfPlaneClipFold

open HalfPlaneClipStep
open OrderedTriples

universe u

/-- Concatenate step outputs and remove adjacent duplicates. -/
def joinDistinct {α : Type u} [DecidableEq α] (chunks : List (List α)) : List α :=
  chunks.flatten.destutter (· ≠ ·)

theorem joinDistinct_isChain {α : Type u} [DecidableEq α] (chunks : List (List α)) :
    (joinDistinct chunks).IsChain (· ≠ ·) := by
  exact List.isChain_destutter (· ≠ ·) chunks.flatten

theorem joinDistinct_sublist {α : Type u} [DecidableEq α] (chunks : List (List α)) :
    List.Sublist (joinDistinct chunks) chunks.flatten := by
  exact List.destutter_sublist (· ≠ ·) chunks.flatten

theorem mem_destutter'_ne_iff {α : Type u} [DecidableEq α]
    (value current : α) : ∀ rest : List α,
    value ∈ rest.destutter' (· ≠ ·) current ↔ value = current ∨ value ∈ rest
  | [] => by simp
  | next :: rest => by
      by_cases distinct : current ≠ next
      · simp [distinct, mem_destutter'_ne_iff value next rest]
      · have equal : current = next := not_ne_iff.mp distinct
        subst next
        simp [mem_destutter'_ne_iff value current rest]

/-- Removing adjacent duplicate values preserves list membership in both
directions. -/
theorem mem_destutter_ne_iff {α : Type u} [DecidableEq α]
    (value : α) (values : List α) :
    value ∈ values.destutter (· ≠ ·) ↔ value ∈ values := by
  cases values with
  | nil => simp
  | cons current rest =>
      simpa [List.destutter_cons'] using mem_destutter'_ne_iff value current rest

theorem mem_joinDistinct_iff {α : Type u} [DecidableEq α]
    (value : α) (chunks : List (List α)) :
    value ∈ joinDistinct chunks ↔ value ∈ chunks.flatten := by
  exact mem_destutter_ne_iff value chunks.flatten

theorem destutter'_starts_with
    {α : Type u} (relation : α → α → Prop) [DecidableRel relation] (first : α) :
    ∀ rest : List α, ∃ tail, rest.destutter' relation first = first :: tail
  | [] => ⟨[], rfl⟩
  | next :: rest => by
      rw [List.destutter'_cons]
      by_cases related : relation first next
      · rw [if_pos related]
        exact ⟨rest.destutter' relation next, rfl⟩
      · rw [if_neg related]
        exact destutter'_starts_with relation first rest

theorem destutter_prefix_pair {α : Type u} [DecidableEq α]
    (first second : α) (rest : List α) (distinct : first ≠ second) :
    List.IsPrefix [first, second]
      ((first :: second :: rest).destutter (· ≠ ·)) := by
  rw [List.destutter_cons_cons, if_pos distinct]
  rcases destutter'_starts_with (· ≠ ·) second rest with ⟨tail, startsWith⟩
  rw [startsWith]
  simp

theorem joinDistinct_prefix_pair {α : Type u} [DecidableEq α]
    {chunks : List (List α)} (first second : α) (rest : List α)
    (flattened : chunks.flatten = first :: second :: rest)
    (distinct : first ≠ second) :
    List.IsPrefix [first, second] (joinDistinct chunks) := by
  rw [joinDistinct, flattened]
  exact destutter_prefix_pair first second rest distinct

theorem joinDistinct_prefix_pair_of_prefix {α : Type u} [DecidableEq α]
    {chunks : List (List α)} (first second : α)
    (flattenedPrefix : List.IsPrefix [first, second] chunks.flatten)
    (distinct : first ≠ second) :
    List.IsPrefix [first, second] (joinDistinct chunks) := by
  rw [List.prefix_iff_exists_eq_append] at flattenedPrefix
  rcases flattenedPrefix with ⟨rest, flattened⟩
  exact joinDistinct_prefix_pair first second rest flattened distinct

theorem destutter'_suffix_pair {α : Type u} [DecidableEq α]
    (penultimate last : α) (distinct : penultimate ≠ last) :
    ∀ (initial : List α) (current : α),
      List.IsSuffix [penultimate, last]
        ((initial ++ [penultimate, last]).destutter' (· ≠ ·) current)
  | [], current => by
      simp only [List.nil_append, List.destutter'_cons]
      by_cases related : current ≠ penultimate
      · rw [if_pos related]
        simp [distinct]
      · rw [if_neg related]
        have equal : current = penultimate := not_ne_iff.mp related
        subst current
        simp [distinct]
  | next :: rest, current => by
      simp only [List.cons_append, List.destutter'_cons]
      by_cases related : current ≠ next
      · rw [if_pos related]
        have suffix := destutter'_suffix_pair penultimate last distinct rest next
        rw [List.suffix_iff_exists_eq_append] at suffix ⊢
        rcases suffix with ⟨front, equality⟩
        exact ⟨current :: front, by simp [equality]⟩
      · rw [if_neg related]
        exact destutter'_suffix_pair penultimate last distinct rest current

theorem destutter_suffix_pair {α : Type u} [DecidableEq α]
    (initial : List α) (penultimate last : α) (distinct : penultimate ≠ last) :
    List.IsSuffix [penultimate, last]
      ((initial ++ [penultimate, last]).destutter (· ≠ ·)) := by
  cases initial with
  | nil => simp [distinct]
  | cons first rest =>
      exact destutter'_suffix_pair penultimate last distinct rest first

theorem joinDistinct_suffix_pair {α : Type u} [DecidableEq α]
    {chunks : List (List α)} (initial : List α) (penultimate last : α)
    (flattened : chunks.flatten = initial ++ [penultimate, last])
    (distinct : penultimate ≠ last) :
    List.IsSuffix [penultimate, last] (joinDistinct chunks) := by
  rw [joinDistinct, flattened]
  exact destutter_suffix_pair initial penultimate last distinct

theorem joinDistinct_suffix_pair_of_suffix {α : Type u} [DecidableEq α]
    {chunks : List (List α)} (penultimate last : α)
    (flattenedSuffix : List.IsSuffix [penultimate, last] chunks.flatten)
    (distinct : penultimate ≠ last) :
    List.IsSuffix [penultimate, last] (joinDistinct chunks) := by
  rw [List.suffix_iff_exists_eq_append] at flattenedSuffix
  rcases flattenedSuffix with ⟨initial, flattened⟩
  exact joinDistinct_suffix_pair initial penultimate last flattened distinct

theorem joinDistinct_allOrderedTriples {α : Type u} [DecidableEq α]
    {relation : α → α → α → Prop} {chunks : List (List α)}
    (ordered : AllOrderedTriples relation chunks.flatten) :
    AllOrderedTriples relation (joinDistinct chunks) := by
  exact allOrderedTriples_sublist (joinDistinct_sublist chunks) ordered

theorem joinDistinct_allOrderedCCW {R : Type u} [Field R] [LinearOrder R] [DecidableEq R]
    {chunks : List (List (ExactGeometry.Vec2 R))}
    (ordered : AllOrderedCCW chunks.flatten) :
    AllOrderedCCW (joinDistinct chunks) := by
  exact AllOrderedCCW.sublist (joinDistinct_sublist chunks) ordered

theorem mem_flatten_of_mem_joinDistinct {α : Type u} [DecidableEq α]
    {chunks : List (List α)} {value : α} (member : value ∈ joinDistinct chunks) :
    value ∈ chunks.flatten := by
  exact (joinDistinct_sublist chunks).mem member

def clipOutputDistances {R : Type u} [Field R] [LinearOrder R]
    (edges : List (R × R)) : List R :=
  joinDistinct (edges.map fun edge => outputDistances edge.1 edge.2)

theorem clipOutputDistances_isChain {R : Type u} [Field R] [LinearOrder R]
    (edges : List (R × R)) :
    (clipOutputDistances edges).IsChain (· ≠ ·) := by
  exact joinDistinct_isChain _

theorem clipOutputDistances_nonpos {R : Type u} [Field R] [LinearOrder R]
    {edges : List (R × R)} {distance : R}
    (emitted : distance ∈ clipOutputDistances edges) : distance ≤ 0 := by
  have flattened := mem_flatten_of_mem_joinDistinct emitted
  simp only [List.mem_flatten, List.mem_map] at flattened
  obtain ⟨output, ⟨edge, edgeMember, rfl⟩, distanceMember⟩ := flattened
  exact outputDistances_nonpos distanceMember

end Sprawlens.HalfPlaneClipFold
