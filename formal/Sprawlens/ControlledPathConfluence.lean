import Sprawlens.ControlledPaths
import Sprawlens.LayoutConfluence

namespace Sprawlens.ControlledPathConfluence

open ControlledPaths
open LayoutConfluence

universe u v

/-- The controlled-sequence graph edits embedded in one common edit language. -/
inductive GraphEdit (NodeId : Type u) (Weight : Type v)
  | changeWeight (target : NodeId) (newWeight : Weight)
  | insertLeaf (inserted : Node NodeId Weight)
  | rewire (source oldTarget newTarget : NodeId)

variable {NodeId : Type u} {Weight : Type v}

def applyGraphEdit [DecidableEq NodeId] :
    GraphEdit NodeId Weight → Graph NodeId Weight → Graph NodeId Weight
  | .changeWeight target newWeight => ControlledPaths.changeWeight target newWeight
  | .insertLeaf inserted => ControlledPaths.insertLeaf inserted
  | .rewire source oldTarget newTarget =>
      ControlledPaths.rewire source oldTarget newTarget

/-- Independence facts currently justified by the controlled graph model. -/
inductive IndependentGraphEdits :
    GraphEdit NodeId Weight → GraphEdit NodeId Weight → Prop
  | changeWeight_insertLeaf
      (target : NodeId) (newWeight : Weight) (inserted : Node NodeId Weight)
      (freshForChange : inserted.id ≠ target) :
      IndependentGraphEdits
        (.changeWeight target newWeight) (.insertLeaf inserted)
  | changeWeight_rewire
      (target : NodeId) (newWeight : Weight)
      (source oldTarget newTarget : NodeId) :
      IndependentGraphEdits
        (.changeWeight target newWeight) (.rewire source oldTarget newTarget)

/-- Every declared-independent graph edit pair commutes on every graph state. -/
theorem independentGraphEdits_commute [DecidableEq NodeId]
    (first second : GraphEdit NodeId Weight)
    (independent : IndependentGraphEdits first second) :
    Commute applyGraphEdit first second := by
  intro graph
  cases independent with
  | changeWeight_insertLeaf target newWeight inserted freshForChange =>
      exact (changeWeight_insertLeaf_commute
        graph target newWeight inserted freshForChange).symm
  | changeWeight_rewire target newWeight source oldTarget newTarget =>
      exact (changeWeight_rewire_commute
        graph target newWeight source oldTarget newTarget).symm

/-- Input-graph confluence now holds for arbitrary controlled edit sequences
related by adjacent swaps of the declared-independent edits. -/
theorem runGraphEdits_eq_of_traceEquivalent [DecidableEq NodeId]
    {first second : List (GraphEdit NodeId Weight)}
    (equivalent : TraceEquivalent IndependentGraphEdits first second)
    (initial : Graph NodeId Weight) :
    runEdits applyGraphEdit first initial =
      runEdits applyGraphEdit second initial := by
  exact runEdits_eq_of_traceEquivalent
    applyGraphEdit IndependentGraphEdits independentGraphEdits_commute
    equivalent initial

end Sprawlens.ControlledPathConfluence
