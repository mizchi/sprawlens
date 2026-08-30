namespace Sprawlens.FeasibleEnvelope

universe u v w

/-- A protected metric and the minimum score accepted by the envelope. -/
structure Constraint (Candidate : Type u) (Score : Type v) where
  score : Candidate → Score
  floor : Score

/-- Abstract policy shared by every finite feasible-envelope implementation. -/
structure Policy (Candidate : Type u) (Score : Type v) (Cost : Type w) where
  baseline : Candidate
  candidates : List Candidate
  baseline_mem : baseline ∈ candidates
  valid : Candidate → Prop
  constraints : List (Constraint Candidate Score)
  cost : Candidate → Cost

def Eligible [LE Score] (policy : Policy Candidate Score Cost) (candidate : Candidate) : Prop :=
  candidate ∈ policy.candidates ∧
    policy.valid candidate ∧
    ∀ constraint, constraint ∈ policy.constraints → constraint.floor ≤ constraint.score candidate

def IsOptimal [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate) : Prop :=
  Eligible policy selected ∧
    ∀ candidate, Eligible policy candidate → policy.cost selected ≤ policy.cost candidate

def IsFallback [LE Score]
    (policy : Policy Candidate Score Cost) (selected : Candidate) : Prop :=
  (¬ ∃ candidate, Eligible policy candidate) ∧ selected = policy.baseline

def IsResult [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate) : Prop :=
  IsOptimal policy selected ∨ IsFallback policy selected

/-- Every result belongs to the declared finite candidate set, including fallback. -/
theorem result_mem [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate)
    (result : IsResult policy selected) : selected ∈ policy.candidates := by
  rcases result with optimal | fallback
  · exact optimal.1.1
  · rcases fallback with ⟨_, rfl⟩
    exact policy.baseline_mem

/-- A result is valid, or it is the explicitly declared total fallback. -/
theorem result_valid_or_fallback [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate)
    (result : IsResult policy selected) : policy.valid selected ∨ selected = policy.baseline := by
  rcases result with optimal | fallback
  · exact Or.inl optimal.1.2.1
  · exact Or.inr fallback.2

/-- An eligible baseline makes the fallback branch unreachable. -/
theorem result_optimal_of_baseline_eligible [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate)
    (baselineEligible : Eligible policy policy.baseline)
    (result : IsResult policy selected) : IsOptimal policy selected := by
  rcases result with optimal | fallback
  · exact optimal
  · exact (fallback.1 ⟨policy.baseline, baselineEligible⟩).elim

theorem selected_valid_of_baseline_eligible [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate)
    (baselineEligible : Eligible policy policy.baseline)
    (result : IsResult policy selected) : policy.valid selected := by
  exact (result_optimal_of_baseline_eligible policy selected baselineEligible result).1.2.1

theorem selected_preserves_floor [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate)
    (baselineEligible : Eligible policy policy.baseline)
    (result : IsResult policy selected)
    (constraint : Constraint Candidate Score) (constraintMem : constraint ∈ policy.constraints) :
    constraint.floor ≤ constraint.score selected := by
  exact
    (result_optimal_of_baseline_eligible policy selected baselineEligible result).1.2.2
      constraint constraintMem

theorem selected_cost_le_baseline [LE Score] [LE Cost]
    (policy : Policy Candidate Score Cost) (selected : Candidate)
    (baselineEligible : Eligible policy policy.baseline)
    (result : IsResult policy selected) : policy.cost selected ≤ policy.cost policy.baseline := by
  exact
    (result_optimal_of_baseline_eligible policy selected baselineEligible result).2
      policy.baseline baselineEligible

/-- Counterexample witness for the rejected claim "every result is valid". -/
private def invalidBaselinePolicy : Policy Bool Nat Nat where
  baseline := false
  candidates := [false]
  baseline_mem := by simp
  valid := fun candidate => candidate = true
  constraints := []
  cost := fun _ => 0

example : IsResult invalidBaselinePolicy false := by
  right
  simp [IsFallback, Eligible, invalidBaselinePolicy]

example : ¬ invalidBaselinePolicy.valid false := by
  simp [invalidBaselinePolicy]

end Sprawlens.FeasibleEnvelope
