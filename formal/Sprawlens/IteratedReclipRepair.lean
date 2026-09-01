import Sprawlens.IteratedReclipCounterexample
import Sprawlens.SemanticReclassification

namespace Sprawlens.IteratedReclipRepair

open ConvexClipContract
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneClipRing
open HalfPlaneIntersection
open IteratedReclipCounterexample
open ListReclipClassification
open SemanticReclassification

def bottomStart : Vec2 Rat := { x := 0, y := 0 }

def bottomMiddle : Vec2 Rat := { x := 1, y := 0 }

def bottomFinish : Vec2 Rat := { x := 2, y := 0 }

theorem bottomMiddle_on_segment :
    OnClosedSegment bottomStart bottomFinish bottomMiddle := by
  refine ⟨(1 / 2 : Rat), by norm_num, ?_⟩
  norm_num [bottomStart, bottomMiddle, bottomFinish, interpolatePoint]

/-- The counterexample rejected by the old length-based contract is accepted
as an exact lower-dimensional state by the semantic contract. -/
theorem redundantBottom_clip_hasSemanticReclassification :
    HasSemanticReclassification
      (clipIndexedRing bottomSupportingPlane redundantBottomVertex) := by
  rw [redundantBottom_clip_eq_collinearTriple]
  refine ⟨.degenerate (.segment bottomStart bottomFinish), ?_⟩
  exact collinearTriple_semanticallyReclassifies_segment
    bottomStart bottomMiddle bottomFinish bottomMiddle_on_segment

/-- The repair is a strict extension: it classifies a semantically valid
segment that the raw-list equality contract necessarily rejects. -/
theorem semantic_contract_strictly_extends_length_contract :
    ¬OutputReclassification
        (clipIndexedRing bottomSupportingPlane redundantBottomVertex) ∧
      HasSemanticReclassification
        (clipIndexedRing bottomSupportingPlane redundantBottomVertex) := by
  exact ⟨reclipCertified_does_not_imply_outputReclassification.2,
    redundantBottom_clip_hasSemanticReclassification⟩

end Sprawlens.IteratedReclipRepair
