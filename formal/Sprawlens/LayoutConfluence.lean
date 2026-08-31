namespace Sprawlens.LayoutConfluence

universe u v

/-- Execute edits from left to right. -/
def runEdits {Edit : Type u} {State : Type v}
    (apply : Edit → State → State) : List Edit → State → State
  | [], state => state
  | edit :: rest, state => runEdits apply rest (apply edit state)

/-- Two edit kinds commute when swapping them preserves every layout state. -/
def Commute {Edit : Type u} {State : Type v}
    (apply : Edit → State → State) (first second : Edit) : Prop :=
  ∀ state, apply second (apply first state) = apply first (apply second state)

theorem runEdits_append {Edit : Type u} {State : Type v}
    (apply : Edit → State → State) (first second : List Edit) (state : State) :
    runEdits apply (first ++ second) state =
      runEdits apply second (runEdits apply first state) := by
  induction first generalizing state with
  | nil => rfl
  | cons edit rest inductionHypothesis =>
      simp only [List.cons_append, runEdits]
      exact inductionHypothesis (apply edit state)

/-- One adjacent swap of commuting edits preserves the final layout. -/
theorem runEdits_swap {Edit : Type u} {State : Type v}
    (apply : Edit → State → State) (before after : List Edit)
    (first second : Edit) (state : State)
    (commute : Commute apply first second) :
    runEdits apply (before ++ first :: second :: after) state =
      runEdits apply (before ++ second :: first :: after) state := by
  rw [runEdits_append, runEdits_append]
  simp only [runEdits]
  rw [commute (runEdits apply before state)]

/-- Equivalence generated only by swapping declared-independent adjacent edits. -/
inductive TraceEquivalent {Edit : Type u}
    (Independent : Edit → Edit → Prop) : List Edit → List Edit → Prop
  | refl (edits : List Edit) : TraceEquivalent Independent edits edits
  | swap (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      TraceEquivalent Independent
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | symm {first second : List Edit}
      (equivalent : TraceEquivalent Independent first second) :
      TraceEquivalent Independent second first
  | trans {first second third : List Edit}
      (left : TraceEquivalent Independent first second)
      (right : TraceEquivalent Independent second third) :
      TraceEquivalent Independent first third

/-- Local commutation is sufficient for path independence over all edit sequences
related by adjacent swaps of independent edits. -/
theorem runEdits_eq_of_traceEquivalent
    {Edit : Type u} {State : Type v}
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (localCommute : ∀ first second, Independent first second →
      Commute apply first second)
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) (state : State) :
    runEdits apply first state = runEdits apply second state := by
  induction equivalent with
  | refl => rfl
  | swap before after first second independent =>
      exact runEdits_swap apply before after first second state
        (localCommute first second independent)
  | symm _ inductionHypothesis => exact inductionHypothesis.symm
  | trans _ _ leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- If one independent square fails to commute, path independence already fails
for the corresponding two-edit traces. This is the minimal counterexample shape. -/
theorem not_path_independent_of_noncommuting_square
    {Edit : Type u} {State : Type v}
    (apply : Edit → State → State) (first second : Edit) (state : State)
    (different : apply second (apply first state) ≠
      apply first (apply second state)) :
    runEdits apply [first, second] state ≠
      runEdits apply [second, first] state := by
  simpa [runEdits]

/-- A load-bearing two-state witness: resetting the anchor and flipping the
selected side have the same edit multiset but do not commute. -/
inductive ToyLayoutEdit
  | resetAnchor
  | flipSide

def applyToyLayoutEdit : ToyLayoutEdit → Bool → Bool
  | .resetAnchor, _ => false
  | .flipSide, side => !side

theorem toyLayout_noncommuting_square :
    applyToyLayoutEdit .flipSide (applyToyLayoutEdit .resetAnchor false) ≠
      applyToyLayoutEdit .resetAnchor (applyToyLayoutEdit .flipSide false) := by
  decide

theorem toyLayout_path_dependent :
    runEdits applyToyLayoutEdit [.resetAnchor, .flipSide] false ≠
      runEdits applyToyLayoutEdit [.flipSide, .resetAnchor] false := by
  exact not_path_independent_of_noncommuting_square
    applyToyLayoutEdit .resetAnchor .flipSide false toyLayout_noncommuting_square

end Sprawlens.LayoutConfluence
