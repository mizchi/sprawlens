import Mathlib.Algebra.Order.Ring.Unbundled.Rat
import Sprawlens.AdjacencyRate
import Sprawlens.FeasibleEnvelope
import Sprawlens.FeasibleEnvelopeSelector

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

/-- Runtime observation contract, including the selector's explicit numerical slack. -/
def observedAdjacencyConstraint (baseline : Candidate) (slack : Rat) :
    FeasibleEnvelope.Constraint Candidate Rat where
  score := Candidate.adjacency
  floor := baseline.adjacency - slack

def observedPolicy (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (slack : Rat) :
    FeasibleEnvelope.Policy Candidate Rat Rat where
  baseline := baseline
  candidates := candidates
  baseline_mem := baselineMem
  valid := fun candidate => candidate.converged = true
  constraints := [observedAdjacencyConstraint baseline slack]
  cost := Candidate.displacement

def observedSelectorInput (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (slack : Rat) (tieBreak : Candidate → Tie) :
    FeasibleEnvelopeSelector.Input Candidate Rat Rat Tie where
  policy := observedPolicy baseline candidates baselineMem slack
  eligible := fun candidate =>
    candidate.converged && decide (baseline.adjacency ≤ candidate.adjacency + slack)
  eligible_iff := by
    intro candidate candidateMem
    change candidate ∈ candidates at candidateMem
    simp only [Bool.and_eq_true, decide_eq_true_eq]
    constructor
    · intro accepted
      refine ⟨candidateMem, accepted.1, ?_⟩
      intro constraint constraintMem
      simp [observedPolicy] at constraintMem
      subst constraint
      simp [observedAdjacencyConstraint]
      linarith
    · intro eligible
      refine ⟨eligible.2.1, ?_⟩
      have floor := eligible.2.2 (observedAdjacencyConstraint baseline slack) (by
        simp [observedPolicy])
      simp [observedAdjacencyConstraint] at floor
      linarith
  tieBreak := tieBreak

def selectObservedCandidate [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (slack : Rat)
    (tieBreak : Candidate → Tie) : Candidate :=
  FeasibleEnvelopeSelector.select
    (observedSelectorInput baseline candidates baselineMem slack tieBreak)

theorem selectObservedCandidate_is_result [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (slack : Rat)
    (tieBreak : Candidate → Tie) :
    FeasibleEnvelope.IsResult (observedPolicy baseline candidates baselineMem slack)
      (selectObservedCandidate baseline candidates baselineMem slack tieBreak) := by
  exact FeasibleEnvelopeSelector.select_is_result
    (observedSelectorInput baseline candidates baselineMem slack tieBreak)

theorem observed_baseline_eligible
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    {slack : Rat} (slackNonneg : 0 ≤ slack) :
    FeasibleEnvelope.Eligible (observedPolicy baseline candidates baselineMem slack) baseline := by
  refine ⟨baselineMem, baselineConverged, ?_⟩
  intro constraint constraintMem
  simp [observedPolicy] at constraintMem
  subst constraint
  simp [observedAdjacencyConstraint]
  linarith

theorem observed_selected_adjacency_add_slack_ge_baseline [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    {slack : Rat} (slackNonneg : 0 ≤ slack) (tieBreak : Candidate → Tie) :
    baseline.adjacency ≤
      (selectObservedCandidate baseline candidates baselineMem slack tieBreak).adjacency + slack := by
  have floor := FeasibleEnvelope.selected_preserves_floor
    (observedPolicy baseline candidates baselineMem slack)
    (selectObservedCandidate baseline candidates baselineMem slack tieBreak)
    (observed_baseline_eligible baseline candidates baselineMem baselineConverged slackNonneg)
    (selectObservedCandidate_is_result baseline candidates baselineMem slack tieBreak)
    (observedAdjacencyConstraint baseline slack) (by simp [observedPolicy])
  simp [observedAdjacencyConstraint] at floor
  linarith

theorem observed_selected_displacement_le_baseline [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    {slack : Rat} (slackNonneg : 0 ≤ slack) (tieBreak : Candidate → Tie) :
    (selectObservedCandidate baseline candidates baselineMem slack tieBreak).displacement ≤
      baseline.displacement := by
  exact FeasibleEnvelope.selected_cost_le_baseline
    (observedPolicy baseline candidates baselineMem slack)
    (selectObservedCandidate baseline candidates baselineMem slack tieBreak)
    (observed_baseline_eligible baseline candidates baselineMem baselineConverged slackNonneg)
    (selectObservedCandidate_is_result baseline candidates baselineMem slack tieBreak)

theorem javascript_slack_selected_realized_ge_baseline [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (tieBreak : Candidate → Tie)
    {selectedRealized baselineRealized eligible : Nat}
    (eligiblePos : 0 < eligible) (eligibleBound : eligible < 1000000000000)
    (selectedScore :
      (selectObservedCandidate baseline candidates baselineMem
        AdjacencyRate.javascriptSlack tieBreak).adjacency =
        AdjacencyRate.rate selectedRealized eligible)
    (baselineScore : baseline.adjacency = AdjacencyRate.rate baselineRealized eligible) :
    baselineRealized ≤ selectedRealized := by
  apply AdjacencyRate.javascript_acceptance_preserves_realized_count eligiblePos eligibleBound
  rw [← selectedScore, ← baselineScore]
  exact observed_selected_adjacency_add_slack_ge_baseline baseline candidates baselineMem
    baselineConverged (by norm_num [AdjacencyRate.javascriptSlack]) tieBreak

def selectorInput (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (tieBreak : Candidate → Tie) :
    FeasibleEnvelopeSelector.Input Candidate Rat Rat Tie where
  policy := policy baseline candidates baselineMem
  eligible := fun candidate =>
    candidate.converged && decide (baseline.adjacency ≤ candidate.adjacency)
  eligible_iff := by
    intro candidate candidateMem
    change candidate ∈ candidates at candidateMem
    simp [FeasibleEnvelope.Eligible, policy, adjacencyConstraint, candidateMem]
  tieBreak := tieBreak

/-- Executable paper selector; exact key ties preserve candidate input order. -/
def selectCandidate [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (tieBreak : Candidate → Tie) : Candidate :=
  FeasibleEnvelopeSelector.select (selectorInput baseline candidates baselineMem tieBreak)

/-- The executable selector discharges the abstract `IsResult` premise. -/
theorem selectCandidate_is_result [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (tieBreak : Candidate → Tie) :
    FeasibleEnvelope.IsResult (policy baseline candidates baselineMem)
      (selectCandidate baseline candidates baselineMem tieBreak) := by
  exact FeasibleEnvelopeSelector.select_is_result
    (selectorInput baseline candidates baselineMem tieBreak)

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

theorem executable_selected_converged [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (tieBreak : Candidate → Tie) :
    (selectCandidate baseline candidates baselineMem tieBreak).converged = true := by
  exact selected_converged baseline _ candidates baselineMem baselineConverged
    (selectCandidate_is_result baseline candidates baselineMem tieBreak)

theorem executable_selected_adjacency_ge_baseline [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (tieBreak : Candidate → Tie) :
    baseline.adjacency ≤
      (selectCandidate baseline candidates baselineMem tieBreak).adjacency := by
  exact selected_adjacency_ge_baseline baseline _ candidates baselineMem baselineConverged
    (selectCandidate_is_result baseline candidates baselineMem tieBreak)

theorem executable_selected_displacement_le_baseline [LinearOrder Tie]
    (baseline : Candidate) (candidates : List Candidate)
    (baselineMem : baseline ∈ candidates) (baselineConverged : baseline.converged = true)
    (tieBreak : Candidate → Tie) :
    (selectCandidate baseline candidates baselineMem tieBreak).displacement ≤
      baseline.displacement := by
  exact selected_displacement_le_baseline baseline _ candidates baselineMem baselineConverged
    (selectCandidate_is_result baseline candidates baselineMem tieBreak)

end Sprawlens.Paper1Contract
