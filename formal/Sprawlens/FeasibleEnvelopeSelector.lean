import Mathlib.Order.Defs.LinearOrder
import Sprawlens.FeasibleEnvelope

namespace Sprawlens.FeasibleEnvelopeSelector

open Sprawlens.FeasibleEnvelope

variable {Candidate Score Cost Tie : Type}

/-- Prefer lower cost, then lower explicit tie-break; exact ties keep the left input. -/
def prefer [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    (left right : Candidate) : Candidate :=
  if cost right < cost left then right
  else if cost left < cost right then left
  else if tieBreak right < tieBreak left then right
  else left

theorem prefer_eq_left_or_right [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    (left right : Candidate) :
    prefer cost tieBreak left right = left ∨ prefer cost tieBreak left right = right := by
  by_cases rightCost : cost right < cost left
  · simp [prefer, rightCost]
  · by_cases leftCost : cost left < cost right
    · simp [prefer, rightCost, leftCost]
    · by_cases rightTie : tieBreak right < tieBreak left
      · simp [prefer, rightCost, leftCost, rightTie]
      · simp [prefer, rightCost, leftCost, rightTie]

theorem cost_prefer_le_left [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    (left right : Candidate) :
    cost (prefer cost tieBreak left right) ≤ cost left := by
  by_cases rightCost : cost right < cost left
  · simp [prefer, rightCost, le_of_lt rightCost]
  · by_cases leftCost : cost left < cost right
    · simp [prefer, rightCost, leftCost]
    · have rightLe : cost right ≤ cost left := le_of_not_gt leftCost
      by_cases rightTie : tieBreak right < tieBreak left
      · simp [prefer, rightCost, leftCost, rightTie, rightLe]
      · simp [prefer, rightCost, leftCost, rightTie]

theorem cost_prefer_le_right [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    (left right : Candidate) :
    cost (prefer cost tieBreak left right) ≤ cost right := by
  by_cases rightCost : cost right < cost left
  · simp [prefer, rightCost]
  · have leftLe : cost left ≤ cost right := le_of_not_gt rightCost
    by_cases leftCost : cost left < cost right
    · simp [prefer, rightCost, leftCost, leftLe]
    · by_cases rightTie : tieBreak right < tieBreak left
      · simp [prefer, rightCost, leftCost, rightTie]
      · simp [prefer, rightCost, leftCost, rightTie, leftLe]

theorem prefer_eq_left_of_equal_key [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    (left right : Candidate)
    (costEq : cost left = cost right) (tieEq : tieBreak left = tieBreak right) :
    prefer cost tieBreak left right = left := by
  simp [prefer, costEq, tieEq, lt_irrefl]

/-- Deterministic minimum that preserves input order after exact key ties. -/
def minimum? [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie) :
    List Candidate → Option Candidate
  | [] => none
  | first :: rest =>
      match minimum? cost tieBreak rest with
      | none => some first
      | some selected => some (prefer cost tieBreak first selected)

@[simp] theorem minimum?_nil [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie) :
    minimum? cost tieBreak [] = none := rfl

@[simp] theorem minimum?_singleton [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie) (candidate : Candidate) :
    minimum? cost tieBreak [candidate] = some candidate := rfl

theorem minimum?_eq_none_iff [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie) (candidates : List Candidate) :
    minimum? cost tieBreak candidates = none ↔ candidates = [] := by
  cases candidates with
  | nil => simp
  | cons first rest =>
      cases h : minimum? cost tieBreak rest <;> simp [minimum?, h]

theorem mem_of_minimum?_eq_some [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    {candidates : List Candidate} {selected : Candidate}
    (selectedEq : minimum? cost tieBreak candidates = some selected) :
    selected ∈ candidates := by
  induction candidates generalizing selected with
  | nil => simp at selectedEq
  | cons first rest ih =>
      cases restEq : minimum? cost tieBreak rest with
      | none =>
          simp [minimum?, restEq] at selectedEq
          subst selected
          simp
      | some restSelected =>
          simp [minimum?, restEq] at selectedEq
          subst selected
          have restMem := ih restEq
          rcases prefer_eq_left_or_right cost tieBreak first restSelected with choice | choice
          · rw [choice]
            simp
          · rw [choice]
            simp [restMem]

theorem minimum?_cost_le_of_mem [LinearOrder Cost] [LinearOrder Tie]
    (cost : Candidate → Cost) (tieBreak : Candidate → Tie)
    {candidates : List Candidate} {selected candidate : Candidate}
    (selectedEq : minimum? cost tieBreak candidates = some selected)
    (candidateMem : candidate ∈ candidates) :
    cost selected ≤ cost candidate := by
  induction candidates generalizing selected candidate with
  | nil => simp at candidateMem
  | cons first rest ih =>
      cases restEq : minimum? cost tieBreak rest with
      | none =>
          have restNil := (minimum?_eq_none_iff cost tieBreak rest).mp restEq
          subst rest
          simp [minimum?] at selectedEq candidateMem
          subst selected
          subst candidate
          exact le_rfl
      | some restSelected =>
          simp [minimum?, restEq] at selectedEq
          subst selected
          simp only [List.mem_cons] at candidateMem
          rcases candidateMem with candidateEq | candidateMem
          · rw [candidateEq]
            exact cost_prefer_le_left cost tieBreak first restSelected
          · exact le_trans
              (cost_prefer_le_right cost tieBreak first restSelected)
              (ih restEq candidateMem)

/-- Executable selection plus the proof that its Boolean eligibility test is the policy relation. -/
structure Input (Candidate Score Cost Tie : Type) [LE Score] where
  policy : Policy Candidate Score Cost
  eligible : Candidate → Bool
  eligible_iff : ∀ candidate, candidate ∈ policy.candidates →
    (eligible candidate = true ↔ Eligible policy candidate)
  tieBreak : Candidate → Tie

def eligibleCandidates [LE Score]
    (input : Input Candidate Score Cost Tie) : List Candidate :=
  input.policy.candidates.filter input.eligible

theorem mem_eligibleCandidates_iff [LE Score]
    (input : Input Candidate Score Cost Tie) (candidate : Candidate) :
    candidate ∈ eligibleCandidates input ↔ Eligible input.policy candidate := by
  simp only [eligibleCandidates, List.mem_filter]
  constructor
  · intro filtered
    exact (input.eligible_iff candidate filtered.1).mp filtered.2
  · intro eligible
    exact ⟨eligible.1, (input.eligible_iff candidate eligible.1).mpr eligible⟩

def select [LE Score] [LinearOrder Cost] [LinearOrder Tie]
    (input : Input Candidate Score Cost Tie) : Candidate :=
  match minimum? input.policy.cost input.tieBreak (eligibleCandidates input) with
  | some selected => selected
  | none => input.policy.baseline

/-- The executable finite selector always constructs a result of the abstract relation. -/
theorem select_is_result [LE Score] [LinearOrder Cost] [LinearOrder Tie]
    (input : Input Candidate Score Cost Tie) :
    IsResult input.policy (select input) := by
  cases selectedEq : minimum? input.policy.cost input.tieBreak (eligibleCandidates input) with
  | none =>
      simp only [select, selectedEq]
      right
      constructor
      · intro existsEligible
        rcases existsEligible with ⟨candidate, eligible⟩
        have candidateMem := (mem_eligibleCandidates_iff input candidate).mpr eligible
        have candidatesNil :=
          (minimum?_eq_none_iff input.policy.cost input.tieBreak
            (eligibleCandidates input)).mp selectedEq
        simp [candidatesNil] at candidateMem
      · rfl
  | some selected =>
      simp only [select, selectedEq]
      left
      constructor
      · exact (mem_eligibleCandidates_iff input selected).mp
          (mem_of_minimum?_eq_some input.policy.cost input.tieBreak selectedEq)
      · intro candidate eligible
        exact minimum?_cost_le_of_mem input.policy.cost input.tieBreak selectedEq
          ((mem_eligibleCandidates_iff input candidate).mpr eligible)

end Sprawlens.FeasibleEnvelopeSelector
