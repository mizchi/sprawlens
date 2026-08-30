import Mathlib.Data.List.Basic
import Mathlib.Data.List.Infix
import Sprawlens.HalfPlaneClipFold

namespace Sprawlens.CyclicClosure

open HalfPlaneClipFold

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

theorem normalizeClosure_preserves
    {α : Type u} [DecidableEq α] {predicate : α → Prop} {output : List α}
    (holds : ∀ value ∈ output, predicate value) :
    ∀ value ∈ normalizeClosure output, predicate value := by
  intro value member
  exact holds value (mem_original_of_mem_normalizeClosure member)

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
