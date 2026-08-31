import Mathlib.Data.List.Basic
import Mathlib.Data.List.Infix
import Sprawlens.HalfPlaneClipFold
import Sprawlens.OrderedTriples

namespace Sprawlens.CyclicClosure

open HalfPlaneClipFold
open OrderedTriples

universe u

/-- Remove one explicit closing value from an open cyclic representation. -/
def normalizeClosure {α : Type u} [DecidableEq α] : List α → List α
  | [] => []
  | [first] => [first]
  | first :: second :: rest =>
      let output := first :: second :: rest
      if output.getLast? = some first then output.dropLast else output

def ClosureNormalized {α : Type u} : List α → Prop
  | [] => True
  | [_] => True
  | output@(first :: _ :: _) => output.getLast? ≠ some first

@[simp]
theorem normalizeClosure_nil {α : Type u} [DecidableEq α] :
    normalizeClosure ([] : List α) = [] := rfl

@[simp]
theorem normalizeClosure_singleton {α : Type u} [DecidableEq α] (value : α) :
    normalizeClosure [value] = [value] := rfl

theorem normalizeClosure_eq_dropLast_of_closing
    {α : Type u} [DecidableEq α] (first second : α) (rest : List α)
    (closing : (first :: second :: rest).getLast? = some first) :
    normalizeClosure (first :: second :: rest) = (first :: second :: rest).dropLast := by
  simp [normalizeClosure, closing]

theorem normalizeClosure_eq_self_of_open
    {α : Type u} [DecidableEq α] (first second : α) (rest : List α)
    (openOutput : (first :: second :: rest).getLast? ≠ some first) :
    normalizeClosure (first :: second :: rest) = first :: second :: rest := by
  rw [normalizeClosure]
  split
  · rename_i closingTail
    exact (openOutput (by simpa using closingTail)).elim
  · rfl

theorem normalizeClosure_eq_self_of_nodup
    {α : Type u} [DecidableEq α] (output : List α)
    (nodup : output.Nodup) : normalizeClosure output = output := by
  cases output with
  | nil => rfl
  | cons first rest =>
      cases rest with
      | nil => rfl
      | cons second rest =>
          apply normalizeClosure_eq_self_of_open
          intro closing
          have firstInLast : first ∈ (second :: rest).getLast? := by
            simpa using closing
          obtain ⟨nonempty, firstIsLast⟩ :=
            List.mem_getLast?_eq_getLast firstInLast
          have firstInTail : first ∈ second :: rest := by
            rw [firstIsLast]
            exact List.getLast_mem nonempty
          exact (List.nodup_cons.mp nodup).1 firstInTail

theorem mem_original_of_mem_normalizeClosure
    {α : Type u} [DecidableEq α] {output : List α} {value : α}
    (member : value ∈ normalizeClosure output) : value ∈ output := by
  cases output with
  | nil => simp at member
  | cons first rest =>
      cases rest with
      | nil => simpa using member
      | cons second tail =>
          simp only [normalizeClosure] at member
          split at member
          · exact List.mem_of_mem_dropLast member
          · exact member

/-- Removing an explicit closing duplicate preserves value membership because
the same value remains at the head of the open-ring representation. -/
theorem mem_normalizeClosure_iff
    {α : Type u} [DecidableEq α] (value : α) (output : List α) :
    value ∈ normalizeClosure output ↔ value ∈ output := by
  constructor
  · exact mem_original_of_mem_normalizeClosure
  · intro member
    cases output with
    | nil => simp at member
    | cons first rest =>
        cases rest with
        | nil => simpa using member
        | cons second tail =>
            by_cases closing : (first :: second :: tail).getLast? = some first
            · rw [normalizeClosure_eq_dropLast_of_closing first second tail closing]
              by_cases valueIsFirst : value = first
              · subst value
                cases tail <;> simp
              · apply List.mem_dropLast_of_mem_of_ne_getLast? member
                rw [closing]
                simpa using valueIsFirst
            · rw [normalizeClosure_eq_self_of_open first second tail closing]
              exact member

theorem normalizeClosure_length_le
    {α : Type u} [DecidableEq α] (output : List α) :
    (normalizeClosure output).length ≤ output.length := by
  cases output with
  | nil => simp
  | cons first rest =>
      cases rest with
      | nil => simp
      | cons second tail =>
          simp only [normalizeClosure]
          split
          · simp
          · simp

theorem normalizeClosure_sublist
    {α : Type u} [DecidableEq α] (output : List α) :
    List.Sublist (normalizeClosure output) output := by
  cases output with
  | nil => exact .slnil
  | cons first rest =>
      cases rest with
      | nil => exact .refl _
      | cons second tail =>
          by_cases closing : (first :: second :: tail).getLast? = some first
          · rw [normalizeClosure_eq_dropLast_of_closing first second tail closing]
            exact List.dropLast_sublist _
          · rw [normalizeClosure_eq_self_of_open first second tail closing]

theorem normalizeClosure_prefix_pair
    {α : Type u} [DecidableEq α] {output : List α} {first second : α}
    (prefixProof : List.IsPrefix [first, second] output)
    (distinct : first ≠ second) :
    List.IsPrefix [first, second] (normalizeClosure output) := by
  rw [List.prefix_iff_exists_eq_append] at prefixProof
  rcases prefixProof with ⟨tail, rfl⟩
  simp only [List.cons_append, List.nil_append]
  cases tail with
  | nil =>
      have openOutput : ([first, second] : List α).getLast? ≠ some first := by
        simp
        exact fun equal => distinct equal.symm
      rw [normalizeClosure_eq_self_of_open first second [] openOutput]
  | cons third rest =>
      by_cases closing : (first :: second :: third :: rest).getLast? = some first
      · rw [normalizeClosure_eq_dropLast_of_closing first second (third :: rest) closing]
        rw [List.prefix_iff_eq_take]
        simp
      · rw [normalizeClosure_eq_self_of_open first second (third :: rest) closing]
        simp

theorem normalizeClosure_boundary_pairs
    {α : Type u} [DecidableEq α] {output : List α}
    (first second penultimate last : α)
    (prefixProof : List.IsPrefix [first, second] output)
    (suffixProof : List.IsSuffix [penultimate, last] output)
    (endpointsDistinct : first ≠ last) :
    List.IsPrefix [first, second] (normalizeClosure output) ∧
      List.IsSuffix [penultimate, last] (normalizeClosure output) := by
  rw [List.prefix_iff_exists_eq_append] at prefixProof
  rcases prefixProof with ⟨tail, rfl⟩
  simp only [List.cons_append, List.nil_append] at suffixProof ⊢
  have outputLast : (first :: second :: tail).getLast? = some last := by
    have suffixWitness := suffixProof
    rw [List.suffix_iff_exists_eq_append] at suffixWitness
    rcases suffixWitness with ⟨front, equality⟩
    calc
      (first :: second :: tail).getLast? =
          (front ++ [penultimate, last]).getLast? :=
        congrArg List.getLast? equality
      _ = some last := by simp
  have openOutput : (first :: second :: tail).getLast? ≠ some first := by
    intro closing
    rw [outputLast] at closing
    exact endpointsDistinct (Option.some_injective _ closing).symm
  rw [normalizeClosure_eq_self_of_open first second tail openOutput]
  exact ⟨by simp, suffixProof⟩

theorem normalizeClosure_allOrderedTriples
    {α : Type u} [DecidableEq α] {relation : α → α → α → Prop} {output : List α}
    (ordered : AllOrderedTriples relation output) :
    AllOrderedTriples relation (normalizeClosure output) := by
  exact allOrderedTriples_sublist (normalizeClosure_sublist output) ordered

theorem normalizeClosure_allOrderedCCW
    {R : Type u} [Field R] [LinearOrder R] [DecidableEq R]
    {output : List (ExactGeometry.Vec2 R)} (ordered : AllOrderedCCW output) :
    AllOrderedCCW (normalizeClosure output) := by
  exact AllOrderedCCW.sublist (normalizeClosure_sublist output) ordered

theorem normalizeClosure_preserves
    {α : Type u} [DecidableEq α] {predicate : α → Prop} {output : List α}
    (holds : ∀ value ∈ output, predicate value) :
    ∀ value ∈ normalizeClosure output, predicate value := by
  intro value member
  exact holds value (mem_original_of_mem_normalizeClosure member)

theorem normalizeClosure_isChain
    {α : Type u} [DecidableEq α] {relation : α → α → Prop} {output : List α}
    (chain : output.IsChain relation) : (normalizeClosure output).IsChain relation := by
  cases output with
  | nil => simp
  | cons first rest =>
      cases rest with
      | nil => simp
      | cons second tail =>
          by_cases closing : (first :: second :: tail).getLast? = some first
          · rw [normalizeClosure_eq_dropLast_of_closing first second tail closing]
            exact chain.dropLast
          · rw [normalizeClosure_eq_self_of_open first second tail closing]
            exact chain

theorem normalizeClosure_closureNormalized_of_isChain
    {α : Type u} [DecidableEq α] (output : List α)
    (adjacentDistinct : output.IsChain (· ≠ ·)) :
    ClosureNormalized (normalizeClosure output) := by
  cases output with
  | nil => simp [normalizeClosure, ClosureNormalized]
  | cons first rest =>
      cases rest with
      | nil => simp [normalizeClosure, ClosureNormalized]
      | cons second tail =>
          by_cases closing : (first :: second :: tail).getLast? = some first
          · rw [normalizeClosure_eq_dropLast_of_closing first second tail closing]
            cases tail with
            | nil => simp_all [ClosureNormalized]
            | cons third remaining =>
                have dropNonempty : (first :: second :: third :: remaining).dropLast ≠ [] := by
                  simp
                have adjacentLast := adjacentDistinct.rel_getLast_dropLast dropNonempty
                simp only [ClosureNormalized]
                intro normalizedClosing
                have originalLast :
                    (first :: second :: third :: remaining).getLast
                      (by simp) = first := by
                  have := closing
                  rw [List.getLast?_eq_getLast_of_ne_nil (by simp)] at this
                  exact Option.some_injective _ this
                have normalizedLast :
                    (first :: second :: third :: remaining).dropLast.getLast dropNonempty = first := by
                  have normalizedClosing' :
                      (first :: second :: third :: remaining).dropLast.getLast? = some first := by
                    simpa using normalizedClosing
                  rw [List.getLast?_eq_getLast_of_ne_nil dropNonempty] at normalizedClosing'
                  exact Option.some_injective _ normalizedClosing'
                exact adjacentLast (normalizedLast.trans originalLast.symm)
          · have closingTail : (second :: tail).getLast? ≠ some first := by
              simpa using closing
            simp [normalizeClosure, closingTail, ClosureNormalized]

def closedClipOutputDistances {R : Type u} [Field R] [LinearOrder R]
    (edges : List (R × R)) : List R :=
  normalizeClosure (clipOutputDistances edges)

theorem closedClipOutputDistances_closureNormalized
    {R : Type u} [Field R] [LinearOrder R] (edges : List (R × R)) :
    ClosureNormalized (closedClipOutputDistances edges) := by
  exact normalizeClosure_closureNormalized_of_isChain _
    (clipOutputDistances_isChain edges)

theorem closedClipOutputDistances_nonpos
    {R : Type u} [Field R] [LinearOrder R]
    {edges : List (R × R)} {distance : R}
    (emitted : distance ∈ closedClipOutputDistances edges) : distance ≤ 0 := by
  apply clipOutputDistances_nonpos
  exact mem_original_of_mem_normalizeClosure emitted

end Sprawlens.CyclicClosure
