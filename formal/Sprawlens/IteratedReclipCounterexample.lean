import Sprawlens.ReclipRotation

namespace Sprawlens.IteratedReclipCounterexample

open CanonicalClip
open ConvexClipContract
open ExactGeometry
open FullDimensionalSupportSemantics
open HalfPlaneClipPoints
open ListReclipClassification
open ReclipCertificate
open SimpleRing
open StrictConvexContract
open Vec2Linear

/-- A full-dimensional convex pentagon whose lower edge is represented by
three distinct collinear vertices. -/
def redundantBottomVertex (index : RingIndex 2) : Vec2 Rat :=
  match index.val with
  | 0 => { x := 0, y := 0 }
  | 1 => { x := 1, y := 0 }
  | 2 => { x := 2, y := 0 }
  | 3 => { x := 2, y := 2 }
  | _ => { x := 0, y := 2 }

def bottomSupportingPlane : HalfPlane Rat where
  normalX := 0
  normalY := 1
  offset := 0

theorem redundantBottomVertex_ordered :
    IsLinearlyOrderedCCW redundantBottomVertex := by
  intro first second third firstBefore secondBefore
  fin_cases first <;> fin_cases second <;> fin_cases third
  all_goals simp at firstBefore secondBefore
  all_goals
    norm_num [redundantBottomVertex, orientation]

theorem redundantBottomVertex_injective :
    Function.Injective redundantBottomVertex := by
  intro first second equal
  fin_cases first <;> fin_cases second <;> try rfl
  all_goals
    exfalso
    norm_num [redundantBottomVertex] at equal

theorem redundantBottomVertex_fullDimensional :
    HasPositiveTriple redundantBottomVertex := by
  let first : RingIndex 2 := ⟨0, by omega⟩
  let second : RingIndex 2 := ⟨2, by omega⟩
  let third : RingIndex 2 := ⟨3, by omega⟩
  refine ⟨first, second, third, by simp [first, second],
    by simp [second, third], ?_⟩
  norm_num [first, second, third, redundantBottomVertex, orientation]

/-- The source satisfies the existing reusable one-step certificate despite
containing a redundant collinear boundary vertex. -/
theorem redundantBottomVertex_reclipCertified :
    IsReclipCertified redundantBottomVertex :=
  IsLinearlyOrderedCCW.reclipCertified_of_injective_fullDimensional
    redundantBottomVertex_ordered redundantBottomVertex_injective
      redundantBottomVertex_fullDimensional

/-- Clipping by the supporting line retains the three distinct points on the
subdivided lower edge. -/
theorem redundantBottom_clip_eq_collinearTriple :
    clipIndexedRing bottomSupportingPlane redundantBottomVertex =
      [{ x := 0, y := 0 }, { x := 1, y := 0 }, { x := 2, y := 0 }] := by
  native_decide

def collinearTripleVertex (index : RingIndex 0) : Vec2 Rat :=
  match index.val with
  | 0 => { x := 0, y := 0 }
  | 1 => { x := 1, y := 0 }
  | _ => { x := 2, y := 0 }

/-- Three ordered collinear vertices denote an unbounded support line but a
bounded vertex hull, so they cannot carry the polygon certificate. -/
theorem collinearTriple_not_supportSemanticsAdequate :
    ¬SupportSemanticsAdequate collinearTripleVertex := by
  intro adequate
  let witness : Vec2 Rat := { x := 3, y := 0 }
  have witnessInSupport :
      witness ∈ indexedPolygonRegion collinearTripleVertex := by
    intro edgeIndex
    fin_cases edgeIndex <;>
      norm_num [witness, collinearTripleVertex, nextIndex, orientation]
  have witnessInConvex :
      witness ∈ indexedVertexConvexRegion collinearTripleVertex := by
    rw [← adequate]
    exact witnessInSupport
  have inputHullSubset :
      indexedVertexConvexRegion collinearTripleVertex ⊆
        { point : Vec2 Rat | point.x ≤ 2 } := by
    apply convexHull_min
    · rintro point ⟨index, rfl⟩
      fin_cases index <;> norm_num [collinearTripleVertex]
    · intro start startBound finish finishBound
        startWeight finishWeight startWeightNonnegative
        finishWeightNonnegative weightSum
      change (startWeight • start + finishWeight • finish).x ≤ 2
      simp only [add_x, smul_x]
      calc
        startWeight * start.x + finishWeight * finish.x ≤
            startWeight * 2 + finishWeight * 2 :=
          add_le_add
            (mul_le_mul_of_nonneg_left startBound startWeightNonnegative)
            (mul_le_mul_of_nonneg_left finishBound finishWeightNonnegative)
        _ = 2 := by rw [← add_mul, weightSum, one_mul]
  have witnessBound := inputHullSubset witnessInConvex
  norm_num [witness] at witnessBound

theorem listVertex_collinearTriple :
    listVertex
      ([{ x := 0, y := 0 }, { x := 1, y := 0 }, { x := 2, y := 0 }] :
        List (Vec2 Rat)) (by simp) = collinearTripleVertex := by
  funext index
  fin_cases index <;> rfl

/-- Length alone cannot classify this output: it has three values, but its
continuous region is a segment rather than a polygon. -/
theorem collinearTriple_not_outputReclassification :
    ¬OutputReclassification
      ([{ x := 0, y := 0 }, { x := 1, y := 0 }, { x := 2, y := 0 }] :
        List (Vec2 Rat)) := by
  intro classified
  have certified :=
    (polygonObligation_of_outputReclassification classified) (by simp)
  rw [listVertex_collinearTriple] at certified
  exact collinearTriple_not_supportSemanticsAdequate
    certified.supportAdequate

/-- Therefore `IsReclipCertified` is sufficient for exact one-step geometry
but is not an inductive certificate for the current length-based output
classification. -/
theorem reclipCertified_does_not_imply_outputReclassification :
    IsReclipCertified redundantBottomVertex ∧
      ¬OutputReclassification
        (clipIndexedRing bottomSupportingPlane redundantBottomVertex) := by
  refine ⟨redundantBottomVertex_reclipCertified, ?_⟩
  rw [redundantBottom_clip_eq_collinearTriple]
  exact collinearTriple_not_outputReclassification

end Sprawlens.IteratedReclipCounterexample
