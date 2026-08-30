import Sprawlens.FeasibleEnvelope

namespace Sprawlens.Paper1Contract

/-- Exact, implementation-independent observations used by the primary paper contract. -/
structure Candidate where
  converged : Bool
  adjacency : Rat
  displacement : Rat
deriving DecidableEq, Repr

def adjacencyConstraint (baseline : Candidate) :
    FeasibleEnvelope.Constraint Candidate Rat where
  score := Candidate.adjacency
  floor := baseline.adjacency

/-- The paper's primary envelope: zero adjacency tolerance and displacement cost. -/
def policy (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) :
    FeasibleEnvelope.Policy Candidate Rat Rat where
  baseline := baseline
  candidates := candidates
  baseline_mem := baselineMem
  valid := fun candidate => candidate.converged = true
  constraints := [adjacencyConstraint baseline]
  cost := Candidate.displacement

theorem baseline_eligible
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true) :
    FeasibleEnvelope.Eligible (policy baseline candidates baselineMem) baseline := by
  simp [FeasibleEnvelope.Eligible, policy, adjacencyConstraint, baselineMem, baselineConverged]

/-- Under the paper's stated premise, the selected layout converges. -/
theorem selected_converged
    (baseline selected : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (result : FeasibleEnvelope.IsResult (policy baseline candidates baselineMem) selected) :
    selected.converged = true := by
  exact FeasibleEnvelope.selected_valid_of_baseline_eligible
    (policy baseline candidates baselineMem) selected
    (baseline_eligible baseline candidates baselineMem baselineConverged) result

/-- Under zero tolerance, selection preserves the retained baseline's realized adjacency. -/
theorem selected_adjacency_ge_baseline
    (baseline selected : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (result : FeasibleEnvelope.IsResult (policy baseline candidates baselineMem) selected) :
    baseline.adjacency ≤ selected.adjacency := by
  exact FeasibleEnvelope.selected_preserves_floor
    (policy baseline candidates baselineMem) selected
    (baseline_eligible baseline candidates baselineMem baselineConverged) result
    (adjacencyConstraint baseline) (by simp [policy])

/-- Selection minimizes displacement over the feasible set, which contains the baseline. -/
theorem selected_displacement_le_baseline
    (baseline selected : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (result : FeasibleEnvelope.IsResult (policy baseline candidates baselineMem) selected) :
    selected.displacement ≤ baseline.displacement := by
  exact FeasibleEnvelope.selected_cost_le_baseline
    (policy baseline candidates baselineMem) selected
    (baseline_eligible baseline candidates baselineMem baselineConverged) result

end Sprawlens.Paper1Contract
