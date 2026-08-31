import Sprawlens.LayoutConfluence
import Sprawlens.FeasibleEnvelopeSelector
import Mathlib.Data.Nat.Basic

namespace Sprawlens.HistorySelectorConfluence

open LayoutConfluence
open FeasibleEnvelopeSelector

/-- Two endpoint candidates are enough to expose predecessor-dependent
selection. `false` and `true` stand for two feasible layout geometries. -/
structure SelectorState where
  editA : Bool
  editB : Bool
  selected : Bool
  deriving DecidableEq, Repr

inductive InputEdit
  | enableA
  | enableB
  deriving DecidableEq, Repr

/-- At the two intermediate inputs only one candidate is feasible. At the base
and common endpoint both are feasible, so the predecessor is retained as the
zero-displacement candidate. -/
def selectNearestPrevious (editA editB previous : Bool) : Bool :=
  if editA && !editB then true
  else if editB && !editA then false
  else previous

def candidateFeasible (editA editB candidate : Bool) : Bool :=
  if editA && !editB then candidate
  else if editB && !editA then !candidate
  else true

def historyDistance (previous candidate : Bool) : Nat :=
  if candidate = previous then 0 else 1

/-- Executable two-candidate selector: filter by the current input, then use
distance to the predecessor as the primary cost. -/
def selectByHistory (editA editB previous : Bool) : Bool :=
  (minimum?
    (historyDistance previous)
    (fun candidate => if candidate then 1 else 0)
    ([false, true].filter (candidateFeasible editA editB))).getD previous

theorem selectByHistory_eq_nearestPrevious
    (editA editB previous : Bool) :
    selectByHistory editA editB previous =
      selectNearestPrevious editA editB previous := by
  revert editA editB previous
  decide

def applyInputEdit : InputEdit → SelectorState → SelectorState
  | .enableA, state =>
      let nextA := true
      { editA := nextA
        editB := state.editB
        selected := selectByHistory nextA state.editB state.selected }
  | .enableB, state =>
      let nextB := true
      { editA := state.editA
        editB := nextB
        selected := selectByHistory state.editA nextB state.selected }

def inputProjection (state : SelectorState) : Bool × Bool :=
  (state.editA, state.editB)

def base : SelectorState :=
  { editA := false, editB := false, selected := false }

/-- The two edits have the same exact endpoint input in either order. -/
theorem input_endpoint_commutes :
    inputProjection (applyInputEdit .enableB (applyInputEdit .enableA base)) =
      inputProjection (applyInputEdit .enableA (applyInputEdit .enableB base)) := by
  decide

/-- The predecessor-dependent selected geometry differs at that common input. -/
theorem selected_endpoint_differs :
    (applyInputEdit .enableB (applyInputEdit .enableA base)).selected ≠
      (applyInputEdit .enableA (applyInputEdit .enableB base)).selected := by
  decide

theorem finiteSelector_noncommuting_square :
    applyInputEdit .enableB (applyInputEdit .enableA base) ≠
      applyInputEdit .enableA (applyInputEdit .enableB base) := by
  intro equalState
  exact selected_endpoint_differs (congrArg SelectorState.selected equalState)

/-- Thus a two-candidate nearest-predecessor selector already has a controlled
path-dependence witness, despite an identical endpoint input. -/
theorem finiteSelector_path_dependent :
    runEdits applyInputEdit [.enableA, .enableB] base ≠
      runEdits applyInputEdit [.enableB, .enableA] base := by
  exact not_path_independent_of_noncommuting_square
    applyInputEdit .enableA .enableB base finiteSelector_noncommuting_square

end Sprawlens.HistorySelectorConfluence
