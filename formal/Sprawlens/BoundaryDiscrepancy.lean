import Mathlib.Topology.MetricSpace.Closeds
import Sprawlens.SameEndpointConsistency

namespace Sprawlens.BoundaryDiscrepancy

open SameEndpointConsistency

universe u

/-- Minimal model of the implementation's empty-ring fallback. A point stands
for any nonempty boundary; the important branch is that either empty argument
forces a zero result. -/
inductive ToyBoundary
  | empty
  | point (position : ℝ)

def emptyFallbackDifference : ToyBoundary → ToyBoundary → ℝ
  | .empty, _ => 0
  | _, .empty => 0
  | .point first, .point second => |first - second|

/-- The current fallback cannot separate an empty boundary from a nonempty one. -/
theorem emptyFallback_zero_of_distinct :
    emptyFallbackDifference .empty (.point 0) = 0 ∧
      ToyBoundary.empty ≠ .point 0 := by
  exact ⟨rfl, by intro equal; cases equal⟩

/-- Consequently no separating representation-discrepancy contract can have
exactly the current empty-fallback behavior on its full input domain. -/
theorem emptyFallback_not_representationDiscrepancy :
    ¬∃ discrepancy : RepresentationDiscrepancy ToyBoundary,
      discrepancy.difference = emptyFallbackDifference := by
  rintro ⟨discrepancy, equalDifference⟩
  have zero : discrepancy.difference .empty (.point 0) = 0 := by
    rw [equalDifference]
    rfl
  have equalBoundary :=
    (discrepancy.eq_zero_iff .empty (.point 0)).mp zero
  exact emptyFallback_zero_of_distinct.2 equalBoundary

/-- A nonempty compact point set is a canonical boundary carrier on which
Mathlib supplies the genuine Hausdorff metric. The nonempty restriction is
load-bearing: real-valued Hausdorff distance also assigns zero to an empty set. -/
abbrev CompactBoundary (Point : Type u) [TopologicalSpace Point] :=
  TopologicalSpace.NonemptyCompacts Point

noncomputable def compactBoundaryDiscrepancy
    (Point : Type u) [MetricSpace Point] :
    RepresentationDiscrepancy (CompactBoundary Point) :=
  metricRepresentationDiscrepancy (CompactBoundary Point)

theorem compactBoundaryDifference_eq_hausdorffDist
    {Point : Type u} [MetricSpace Point]
    (first second : CompactBoundary Point) :
    (compactBoundaryDiscrepancy Point).difference first second =
      Metric.hausdorffDist (first : Set Point) second := by
  rfl

theorem compactBoundaryDifference_eq_zero_iff_set_eq
    {Point : Type u} [MetricSpace Point]
    (first second : CompactBoundary Point) :
    (compactBoundaryDiscrepancy Point).difference first second = 0 ↔
      (first : Set Point) = (second : Set Point) := by
  constructor
  · intro zero
    have equalBoundary : first = second :=
      ((compactBoundaryDiscrepancy Point).eq_zero_iff first second).mp zero
    exact congrArg (fun boundary : CompactBoundary Point =>
      (boundary : Set Point)) equalBoundary
  · intro equalSet
    apply ((compactBoundaryDiscrepancy Point).eq_zero_iff first second).mpr
    exact SetLike.ext' equalSet

theorem compactBoundaryDifference_triangle
    {Point : Type u} [MetricSpace Point]
    (first second third : CompactBoundary Point) :
    (compactBoundaryDiscrepancy Point).difference first third ≤
      (compactBoundaryDiscrepancy Point).difference first second +
        (compactBoundaryDiscrepancy Point).difference second third := by
  exact dist_triangle _ _ _

end Sprawlens.BoundaryDiscrepancy
