import Sprawlens.ClipOutputRecertification
import Sprawlens.ClipRotationEquivariance

namespace Sprawlens.ReclipRotation

open ClipOutputRecertification
open ClipRotationEquivariance
open ConvexClipArea
open ConvexClipContract
open CyclicBinaryBlocks
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open ListReclipClassification
open ReclipCertificate
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A certified materialized polygon remains certified when its point list is
rotated before reindexing. -/
theorem reclipCertified_listVertex_rotate
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (certified : IsReclipCertified
      (listVertex points lengthAtLeastThree))
    (count : Nat)
    (rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length) :
    IsReclipCertified
      (listVertex (points.rotate count) rotatedLengthAtLeastThree) := by
  let start : RingIndex (points.length - 3) :=
    ⟨count % points.length, by
      have positive : 0 < points.length := by omega
      have bound := Nat.mod_lt count positive
      omega⟩
  have rotatedCertified := certified.rotateVertex start
  convert rotatedCertified using 1
  · simp
  · apply (Fin.heq_fun_iff (by simp)).2
    intro index
    simp [listVertex, StrictConvexContract.rotateVertex, rotateIndex, start,
      Nat.add_comm]
    apply congrArg points.get
    apply Fin.ext
    simp only
    rw [show 3 + (points.length - 3) = points.length by omega]
    rw [Nat.add_comm index.val (count % points.length)]
    rw [Nat.mod_add_mod, Nat.add_comm]

/-- Exhaustive output reclassification is invariant under cyclic list
rotation. -/
theorem OutputReclassification.rotate
    {points : List (Vec2 R)}
    (classified : OutputReclassification points) (count : Nat) :
    OutputReclassification (points.rotate count) := by
  apply outputReclassification_of_polygonObligation
  intro rotatedLengthAtLeastThree
  have lengthAtLeastThree : 3 ≤ points.length := by
    simpa using rotatedLengthAtLeastThree
  have certified :=
    (polygonObligation_of_outputReclassification classified)
      lengthAtLeastThree
  exact reclipCertified_listVertex_rotate points lengthAtLeastThree certified
    count rotatedLengthAtLeastThree

/-- Reclassification depends only on the cyclic output, not its seam. -/
theorem OutputReclassification.isRotated
    {first second : List (Vec2 R)}
    (classified : OutputReclassification first)
    (rotated : first ~r second) : OutputReclassification second := by
  rcases rotated with ⟨count, rfl⟩
  exact OutputReclassification.rotate classified count

/-- The canonical-seam mixed proof transfers back to the executable output
at the caller's original seam. -/
theorem clipOutputReclassification_of_mixed
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (hasOutside : ∃ index, 0 < signedDistance plane (vertex index))
    (hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0) :
    OutputReclassification (clipIndexedRing plane vertex) := by
  rcases exists_rotation_clipOutputReclassification_of_mixed
      plane vertex ordered hasOutside hasInside with ⟨start, classified⟩
  exact ReclipRotation.OutputReclassification.isRotated classified
    (clipIndexedRing_rotateVertex_isRotated plane start vertex)

/-- Every strict input receives an exhaustive classification at its original
materialization seam, including no-cut and empty-cut cases. -/
theorem clipOutputReclassification_of_strict
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    OutputReclassification (clipIndexedRing plane vertex) := by
  by_cases hasOutside : ∃ index, 0 < signedDistance plane (vertex index)
  · by_cases hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0
    · exact clipOutputReclassification_of_mixed
        plane vertex ordered hasOutside hasInside
    · have allOutside : ∀ index,
          0 < signedDistance plane (vertex index) := by
        intro index
        exact lt_of_not_ge fun inside => hasInside ⟨index, inside⟩
      rw [clipIndexedRing_eq_nil_of_all_outside plane vertex allOutside]
      exact .empty
  · have allInside : ∀ index,
        signedDistance plane (vertex index) ≤ 0 := by
      intro index
      exact le_of_not_gt fun outside => hasOutside ⟨index, outside⟩
    rw [clipIndexedRing_eq_indexedVertices_of_all_inside
      plane vertex ordered allInside]
    let lengthAtLeastThree : 3 ≤ (indexedVertices vertex).length := by
      simp [indexedVertices]
    refine OutputReclassification.polygon
      (indexedVertices vertex) lengthAtLeastThree ?_
    have certified :=
      ReclipCertificate.IsStrictVertexOrderedConvexCCW.reclipCertified ordered
    convert certified using 1
    · simp [indexedVertices]
    · apply (Fin.heq_fun_iff (by simp [indexedVertices])).2
      intro index
      change (indexedVertices vertex).get _ = vertex _
      simp only [indexedVertices, List.get_ofFn]
      apply congrArg vertex
      apply Fin.ext
      rfl

end Sprawlens.ReclipRotation
