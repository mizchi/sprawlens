import Mathlib.Data.List.Destutter
import Sprawlens.HalfPlaneClipStep

namespace Sprawlens.HalfPlaneClipFold

open HalfPlaneClipStep

universe u

/-- Concatenate step outputs and remove adjacent duplicates. -/
def joinDistinct {α : Type u} [DecidableEq α] (chunks : List (List α)) : List α :=
  chunks.flatten.destutter (· ≠ ·)

theorem joinDistinct_isChain {α : Type u} [DecidableEq α] (chunks : List (List α)) :
    (joinDistinct chunks).IsChain (· ≠ ·) := by
  exact List.isChain_destutter (· ≠ ·) chunks.flatten

theorem joinDistinct_sublist {α : Type u} [DecidableEq α] (chunks : List (List α)) :
    List.Sublist (joinDistinct chunks) chunks.flatten := by
  exact List.destutter_sublist (· ≠ ·) chunks.flatten

theorem mem_flatten_of_mem_joinDistinct {α : Type u} [DecidableEq α]
    {chunks : List (List α)} {value : α} (member : value ∈ joinDistinct chunks) :
    value ∈ chunks.flatten := by
  exact (joinDistinct_sublist chunks).mem member

def clipOutputDistances {R : Type u} [Field R] [LinearOrder R]
    (edges : List (R × R)) : List R :=
  joinDistinct (edges.map fun edge => outputDistances edge.1 edge.2)

theorem clipOutputDistances_isChain {R : Type u} [Field R] [LinearOrder R]
    (edges : List (R × R)) :
    (clipOutputDistances edges).IsChain (· ≠ ·) := by
  exact joinDistinct_isChain _

theorem clipOutputDistances_nonpos {R : Type u} [Field R] [LinearOrder R]
    {edges : List (R × R)} {distance : R}
    (emitted : distance ∈ clipOutputDistances edges) : distance ≤ 0 := by
  have flattened := mem_flatten_of_mem_joinDistinct emitted
  simp only [List.mem_flatten, List.mem_map] at flattened
  obtain ⟨output, ⟨edge, edgeMember, rfl⟩, distanceMember⟩ := flattened
  exact outputDistances_nonpos distanceMember

end Sprawlens.HalfPlaneClipFold
