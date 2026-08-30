import Mathlib.Data.List.FinRange
import Mathlib.Data.List.Basic
import Sprawlens.ConvexHalfPlaneSigns
import Sprawlens.PolygonAreaRewrite
import Sprawlens.StrictConvexContract

namespace Sprawlens.ConvexClipArea

open ConvexClipContract
open ConvexHalfPlaneSigns
open CyclicBinaryBlocks
open CyclicClosure
open ExactGeometry
open HalfPlaneClipFold
open HalfPlaneIntersection
open HalfPlaneClipPoints
open HalfPlaneClipRing
open PolygonAreaRewrite
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

def indexedSignedTwiceArea {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : R :=
  closedEdgeCrossSum (indexedVertices vertex)

def clippedSignedTwiceArea {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) : R :=
  closedEdgeCrossSum (clipIndexedRing plane vertex)

omit [IsStrictOrderedRing R] in
/-- Output normalization removes only zero-length edges and an explicit closing duplicate. -/
theorem clippedSignedTwiceArea_eq_outputPointFlatten {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    clippedSignedTwiceArea plane vertex =
      closedEdgeCrossSum
        (((indexedEdges vertex).map fun edge =>
          outputPoints plane edge.1 edge.2).flatten) := by
  rw [clippedSignedTwiceArea, clipIndexedRing, closedClipOutputPoints,
    clipOutputPoints, joinDistinct]
  rw [closedEdgeCrossSum_normalizeClosure]
  exact closedEdgeCrossSum_destutter_ne _

/-- Area semantics can use the branch-free ideal emitter, including boundary vertices. -/
theorem clippedSignedTwiceArea_eq_idealOutputPointFlatten {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    clippedSignedTwiceArea plane vertex =
      closedEdgeCrossSum
        (((indexedEdges vertex).map fun edge =>
          idealOutputPoints plane edge.1 edge.2).flatten) := by
  rw [clippedSignedTwiceArea_eq_outputPointFlatten]
  simp_rw [outputPoints_eq_destutter_ideal]
  have preserved := closedEdgeCrossSum_flatten_map_destutter_ne
    ((indexedEdges vertex).map fun edge =>
      idealOutputPoints plane edge.1 edge.2)
  rw [List.map_map] at preserved
  simp only [Function.comp_def] at preserved
  exact preserved

omit [IsStrictOrderedRing R] in
theorem closedEdgeCrossSum_idealOutputPointFlatten_rotate
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) (amount : Nat) :
    closedEdgeCrossSum
        (((edges.rotate amount).map fun edge =>
          idealOutputPoints plane edge.1 edge.2).flatten) =
      closedEdgeCrossSum
        ((edges.map fun edge => idealOutputPoints plane edge.1 edge.2).flatten) := by
  rw [List.map_rotate]
  exact closedEdgeCrossSum_flatten_rotate _ amount

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem indexedSignedTwiceArea_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    indexedSignedTwiceArea (rotateVertex start vertex) =
      indexedSignedTwiceArea vertex := by
  rw [indexedSignedTwiceArea, indexedSignedTwiceArea,
    indexedVertices_rotateVertex]
  exact closedEdgeCrossSum_rotate _ start.val

theorem clippedSignedTwiceArea_rotateVertex {extraVertices : Nat}
    (plane : HalfPlane R) (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    clippedSignedTwiceArea plane (rotateVertex start vertex) =
      clippedSignedTwiceArea plane vertex := by
  rw [clippedSignedTwiceArea_eq_idealOutputPointFlatten,
    clippedSignedTwiceArea_eq_idealOutputPointFlatten,
    indexedEdges_rotateVertex]
  exact closedEdgeCrossSum_idealOutputPointFlatten_rotate
    plane (indexedEdges vertex) start.val

def idealIndexedChunks {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    List (List (Vec2 R)) :=
  (indexedEdges vertex).map fun edge =>
    idealOutputPoints plane edge.1 edge.2

def canonicalChunkBlock {A : Type u}
    (leaving entering : List A) (outsideCount : Nat)
    (retained : List (List A)) : List (List A) :=
  leaving :: (List.replicate (outsideCount - 1) [] ++ entering :: retained)

omit [IsStrictOrderedRing R] in
theorem idealIndexedChunks_eq_of_rotatedBlock {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    idealIndexedChunks plane vertex =
      canonicalChunkBlock
        [vertex ⟨0, by omega⟩,
          boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)]
        [boundaryPoint plane (vertex ⟨count, by omega⟩)
          (vertex ⟨count + 1, by omega⟩)] count
        (List.ofFn (fun index : Fin (extraVertices + 3 - count - 1) =>
          [vertex ⟨count + 1 + index.val, by omega⟩])) := by
  apply List.ext_getElem?
  intro index
  by_cases indexBound : index < extraVertices + 3
  · have insideOfNotBlock : ∀ pointIndex : RingIndex extraVertices,
        ¬(0 < pointIndex.val ∧ pointIndex.val ≤ count) →
          signedDistance plane (vertex pointIndex) ≤ 0 := by
      intro pointIndex notInBlock
      exact le_of_not_gt fun outside =>
        notInBlock ((outsideIff pointIndex).mp outside)
    have leftAtIndex :
        (idealIndexedChunks plane vertex)[index]? = some
          (idealOutputPoints plane (vertex ⟨index, indexBound⟩)
            (vertex (nextIndex ⟨index, indexBound⟩))) := by
      rw [idealIndexedChunks, indexedEdges, List.map_ofFn]
      change (List.ofFn (fun pointIndex => idealOutputPoints plane
        (vertex pointIndex) (vertex (nextIndex pointIndex))))[index]? = _
      rw [List.getElem?_ofFn, dif_pos indexBound]
    rw [leftAtIndex]
    by_cases indexZero : index = 0
    · subst index
      have currentInside :
          signedDistance plane (vertex ⟨0, by omega⟩) ≤ 0 :=
        insideOfNotBlock ⟨0, by omega⟩ (by simp)
      have nextOutside :
          0 < signedDistance plane (vertex ⟨1, by omega⟩) := by
        apply (outsideIff ⟨1, by omega⟩).mpr
        exact ⟨by norm_num, countPositive⟩
      rw [show nextIndex (⟨0, by omega⟩ : RingIndex extraVertices) =
          ⟨1, by omega⟩ by
        apply Fin.ext
        simp [nextIndex]]
      rw [idealOutputPoints_of_inside_outside
        plane _ _ currentInside nextOutside]
      simp [canonicalChunkBlock]
    · by_cases beforeCount : index < count
      · have currentOutside :
            0 < signedDistance plane (vertex ⟨index, indexBound⟩) := by
          apply (outsideIff ⟨index, indexBound⟩).mpr
          change 0 < index ∧ index ≤ count
          exact ⟨by omega, by omega⟩
        have nextBound : index + 1 < extraVertices + 3 := by omega
        have nextOutside :
            0 < signedDistance plane (vertex ⟨index + 1, nextBound⟩) := by
          apply (outsideIff ⟨index + 1, nextBound⟩).mpr
          change 0 < index + 1 ∧ index + 1 ≤ count
          exact ⟨by omega, by omega⟩
        rw [show nextIndex (⟨index, indexBound⟩ : RingIndex extraVertices) =
            ⟨index + 1, nextBound⟩ by
          apply Fin.ext
          simp [nextIndex, Nat.mod_eq_of_lt nextBound]]
        rw [idealOutputPoints_of_outside_outside
          plane _ _ currentOutside nextOutside]
        have indexForm : ∃ offset, index = offset + 1 :=
          ⟨index - 1, by omega⟩
        rcases indexForm with ⟨offset, rfl⟩
        have offsetBound : offset < count - 1 := by omega
        simp [canonicalChunkBlock]
        rw [List.getElem?_append_left (by simpa using offsetBound)]
        rw [List.getElem?_replicate, if_pos offsetBound]
      · by_cases atCount : index = count
        · subst index
          have currentOutside :
              0 < signedDistance plane (vertex ⟨count, countBound⟩) := by
            apply (outsideIff ⟨count, countBound⟩).mpr
            exact ⟨countPositive, le_rfl⟩
          have nextInside :
              signedDistance plane (vertex ⟨count + 1, countNextBound⟩) ≤ 0 :=
            insideOfNotBlock ⟨count + 1, countNextBound⟩ (by
              change ¬(0 < count + 1 ∧ count + 1 ≤ count)
              omega)
          rw [show nextIndex (⟨count, countBound⟩ : RingIndex extraVertices) =
              ⟨count + 1, countNextBound⟩ by
            apply Fin.ext
            simp [nextIndex, Nat.mod_eq_of_lt countNextBound]]
          rw [idealOutputPoints_of_outside_inside
            plane _ _ currentOutside nextInside]
          cases count with
          | zero => omega
          | succ countTail => simp [canonicalChunkBlock]
        · have currentInside :
              signedDistance plane (vertex ⟨index, indexBound⟩) ≤ 0 :=
            insideOfNotBlock ⟨index, indexBound⟩ (by
              change ¬(0 < index ∧ index ≤ count)
              omega)
          have indexForm : ∃ offset, index = count + 1 + offset :=
            ⟨index - count - 1, by omega⟩
          rcases indexForm with ⟨offset, rfl⟩
          have offsetBound :
              offset < extraVertices + 3 - count - 1 := by omega
          have retainedChunkAt :
              (canonicalChunkBlock
                [vertex ⟨0, by omega⟩,
                  boundaryPoint plane (vertex ⟨0, by omega⟩)
                    (vertex ⟨1, by omega⟩)]
                [boundaryPoint plane (vertex ⟨count, countBound⟩)
                  (vertex ⟨count + 1, countNextBound⟩)] count
                (List.ofFn (fun retainedIndex :
                    Fin (extraVertices + 3 - count - 1) =>
                  [vertex ⟨count + 1 + retainedIndex.val, by omega⟩])))[count + 1 + offset]? =
                some [vertex ⟨count + 1 + offset, indexBound⟩] := by
            rw [canonicalChunkBlock]
            have firstForm : count + 1 + offset = count + offset + 1 := by omega
            have shifted := congrArg (fun listIndex =>
              ([vertex ⟨0, by omega⟩,
                  boundaryPoint plane (vertex ⟨0, by omega⟩)
                    (vertex ⟨1, by omega⟩)] ::
                (List.replicate (count - 1) [] ++
                  [boundaryPoint plane (vertex ⟨count, countBound⟩)
                    (vertex ⟨count + 1, countNextBound⟩)] ::
                  List.ofFn (fun retainedIndex :
                      Fin (extraVertices + 3 - count - 1) =>
                    [vertex ⟨count + 1 + retainedIndex.val, by omega⟩])))[listIndex]?)
              firstForm
            rw [shifted, List.getElem?_cons_succ, List.getElem?_append]
            rw [if_neg (by simp; omega)]
            simp only [List.length_replicate]
            have secondForm : count + offset - (count - 1) = offset + 1 := by omega
            rw [secondForm, List.getElem?_cons_succ, List.getElem?_ofFn,
              dif_pos offsetBound]
          by_cases indexLast : count + 1 + offset + 1 = extraVertices + 3
          · have zeroInside :
                signedDistance plane (vertex ⟨0, by omega⟩) ≤ 0 :=
              insideOfNotBlock ⟨0, by omega⟩ (by simp)
            rw [show nextIndex
                (⟨count + 1 + offset, indexBound⟩ : RingIndex extraVertices) =
                ⟨0, by omega⟩ by
              apply Fin.ext
              simp [nextIndex, indexLast]]
            rw [idealOutputPoints_of_inside_inside
              plane _ _ currentInside zeroInside]
            exact retainedChunkAt.symm
          · have nextBound :
                count + 1 + offset + 1 < extraVertices + 3 := by omega
            have nextInside : signedDistance plane
                (vertex ⟨count + 1 + offset + 1, nextBound⟩) ≤ 0 :=
              insideOfNotBlock ⟨count + 1 + offset + 1, nextBound⟩ (by
                change ¬(0 < count + 1 + offset + 1 ∧
                  count + 1 + offset + 1 ≤ count)
                omega)
            rw [show nextIndex
                (⟨count + 1 + offset, indexBound⟩ : RingIndex extraVertices) =
                ⟨count + 1 + offset + 1, nextBound⟩ by
              apply Fin.ext
              simp [nextIndex, Nat.mod_eq_of_lt nextBound]]
            rw [idealOutputPoints_of_inside_inside
              plane _ _ currentInside nextInside]
            exact retainedChunkAt.symm
  · have partition :
        1 + (count - 1) + 1 + (extraVertices + 3 - count - 1) =
          extraVertices + 3 := by omega
    have partitionPrime :
        count - 1 + (extraVertices + 3 - count - 1 + 1) + 1 =
          extraVertices + 3 := by omega
    simp [idealIndexedChunks, indexedEdges, canonicalChunkBlock, indexBound]
    omega

theorem flatten_ofFn_singleton {A : Type u} {n : Nat} (value : Fin n → A) :
    (List.ofFn fun index => [value index]).flatten = List.ofFn value := by
  induction n with
  | zero => simp
  | succ n inductionHypothesis =>
      rw [List.ofFn_succ, List.ofFn_succ]
      simp only [List.flatten_cons, List.singleton_append]
      rw [inductionHypothesis]

def outsideBlockVertices {extraVertices count : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (countBound : count < extraVertices + 3) : List (Vec2 R) :=
  List.ofFn fun index : Fin count =>
    vertex ⟨index.val + 1, by omega⟩

def retainedBlockVertices {extraVertices count : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : List (Vec2 R) :=
  List.ofFn fun index : Fin (extraVertices + 3 - count - 1) =>
    vertex ⟨count + 1 + index.val, by omega⟩

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem indexedVertices_eq_block {extraVertices count : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3) :
    indexedVertices vertex =
      vertex ⟨0, by omega⟩ ::
        (outsideBlockVertices vertex countBound ++
          retainedBlockVertices (count := count) vertex) := by
  apply List.ext_getElem?
  intro index
  by_cases indexBound : index < extraVertices + 3
  · by_cases indexZero : index = 0
    · subst index
      simp [indexedVertices]
    · by_cases inOutside : index ≤ count
      · have offsetBound : index - 1 < count := by omega
        have indexForm : index = (index - 1) + 1 := by omega
        rw [indexedVertices]
        rw [List.getElem?_ofFn, dif_pos indexBound]
        have shifted := congrArg (fun listIndex =>
          (vertex ⟨0, by omega⟩ ::
            (outsideBlockVertices vertex countBound ++
              retainedBlockVertices (count := count) vertex))[listIndex]?)
          indexForm
        rw [shifted, List.getElem?_cons_succ, List.getElem?_append]
        simp [outsideBlockVertices, offsetBound]
        apply congrArg vertex
        apply Fin.ext
        change index = index - 1 + 1
        omega
      · have offsetBound :
            index - count - 1 < extraVertices + 3 - count - 1 := by omega
        have indexForm : index = count + (index - count - 1) + 1 := by omega
        rw [indexedVertices, List.getElem?_ofFn, dif_pos indexBound]
        have shifted := congrArg (fun listIndex =>
          (vertex ⟨0, by omega⟩ ::
            (outsideBlockVertices vertex countBound ++
              retainedBlockVertices (count := count) vertex))[listIndex]?)
          indexForm
        rw [shifted, List.getElem?_cons_succ, List.getElem?_append]
        have afterOutside :
            ¬count + (index - count - 1) <
              (outsideBlockVertices vertex countBound).length := by
          simp [outsideBlockVertices]
        rw [if_neg afterOutside]
        simp [outsideBlockVertices, retainedBlockVertices, offsetBound]
        apply congrArg vertex
        apply Fin.ext
        change index = count + 1 + (index - count - 1)
        omega
  · have partition :
        1 + count + (extraVertices + 3 - count - 1) =
          extraVertices + 3 := by omega
    simp [indexedVertices, outsideBlockVertices, retainedBlockVertices, indexBound]
    omega

omit [IsStrictOrderedRing R] in
theorem idealIndexedChunkFlatten_eq_block {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    (idealIndexedChunks plane vertex).flatten =
      vertex ⟨0, by omega⟩ ::
        boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩) ::
        boundaryPoint plane (vertex ⟨count, by omega⟩)
          (vertex ⟨count + 1, by omega⟩) ::
        retainedBlockVertices (count := count) vertex := by
  rw [idealIndexedChunks_eq_of_rotatedBlock plane vertex countPositive
    countBound countNextBound outsideIff]
  simp [canonicalChunkBlock, retainedBlockVertices, flatten_ofFn_singleton]

omit [IsStrictOrderedRing R] in
theorem outsideBlockVertices_triplewise {extraVertices count : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countBound : count < extraVertices + 3) :
    (outsideBlockVertices vertex countBound).Triplewise
      (fun first second third => 0 ≤ orientation first second third) := by
  rw [List.triplewise_iff_getElem]
  intro first second third firstBefore secondBefore thirdBound
  simp only [outsideBlockVertices, List.length_ofFn] at thirdBound
  simp only [outsideBlockVertices, List.getElem_ofFn]
  apply le_of_lt
  apply ordered
  · change first + 1 < second + 1
    omega
  · change second + 1 < third + 1
    omega

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem retainedBlockVertices_eq_cons {extraVertices count : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (countNextBound : count + 1 < extraVertices + 3) :
    retainedBlockVertices (count := count) vertex =
      vertex ⟨count + 1, countNextBound⟩ ::
        (retainedBlockVertices (count := count) vertex).tail := by
  let retained := retainedBlockVertices (count := count) vertex
  have retainedNonempty : retained ≠ [] := by
    simp [retained, retainedBlockVertices]
    omega
  have headEq : retained.head retainedNonempty =
      vertex ⟨count + 1, countNextBound⟩ := by
    simp [retained, retainedBlockVertices, List.head_ofFn]
  calc
    retainedBlockVertices (count := count) vertex = retained := rfl
    _ = retained.head retainedNonempty :: retained.tail :=
      (List.cons_head_tail retainedNonempty).symm
    _ = vertex ⟨count + 1, countNextBound⟩ :: retained.tail := by rw [headEq]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem outsideBlockVertices_eq_singleton {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (countBound : 1 < extraVertices + 3) :
    outsideBlockVertices (count := 1) vertex countBound =
      [vertex ⟨1, countBound⟩] := by
  simp [outsideBlockVertices]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem outsideBlockVertices_eq_first_middle_last {extraVertices count : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (countAtLeastTwo : 2 ≤ count) (countBound : count < extraVertices + 3) :
    outsideBlockVertices vertex countBound =
      vertex ⟨1, by omega⟩ ::
        ((outsideBlockVertices vertex countBound).tail.dropLast ++
          [vertex ⟨count, countBound⟩]) := by
  let outside := outsideBlockVertices vertex countBound
  have outsideNonempty : outside ≠ [] := by
    simp [outside, outsideBlockVertices]
    omega
  have outsideTailNonempty : outside.tail ≠ [] := by
    intro tailEmpty
    have tailLength : outside.tail.length = count - 1 := by
      simp [outside, outsideBlockVertices]
    rw [tailEmpty] at tailLength
    simp at tailLength
    omega
  have headEq : outside.head outsideNonempty = vertex ⟨1, by omega⟩ := by
    simp [outside, outsideBlockVertices, List.head_ofFn]
  have lastEq : outside.getLast outsideNonempty =
      vertex ⟨count, countBound⟩ := by
    simp only [outside, outsideBlockVertices, List.getLast_ofFn]
    apply congrArg vertex
    apply Fin.ext
    change count - 1 + 1 = count
    omega
  have tailLastEq : outside.tail.getLast outsideTailNonempty =
      outside.getLast outsideNonempty := by
    have consEq : outside.head outsideNonempty :: outside.tail = outside :=
      List.cons_head_tail outsideNonempty
    calc
      outside.tail.getLast outsideTailNonempty =
          (outside.head outsideNonempty :: outside.tail).getLast
            (List.cons_ne_nil _ _) :=
        (List.getLast_cons outsideTailNonempty).symm
      _ = outside.getLast outsideNonempty :=
        List.getLast_congr (List.cons_ne_nil _ _) outsideNonempty consEq
  calc
    outsideBlockVertices vertex countBound = outside := rfl
    _ = outside.head outsideNonempty :: outside.tail :=
      (List.cons_head_tail outsideNonempty).symm
    _ = vertex ⟨1, by omega⟩ :: outside.tail := by rw [headEq]
    _ = vertex ⟨1, by omega⟩ ::
        (outside.tail.dropLast ++ [outside.tail.getLast outsideTailNonempty]) := by
      rw [List.dropLast_append_getLast outsideTailNonempty]
    _ = vertex ⟨1, by omega⟩ ::
        (outside.tail.dropLast ++ [vertex ⟨count, countBound⟩]) := by
      congr 3
      rw [tailLastEq, lastEq]

theorem clippedSignedTwiceArea_le_of_rotatedBlock {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    clippedSignedTwiceArea plane vertex ≤ indexedSignedTwiceArea vertex := by
  have insideOfNotBlock : ∀ pointIndex : RingIndex extraVertices,
      ¬(0 < pointIndex.val ∧ pointIndex.val ≤ count) →
        signedDistance plane (vertex pointIndex) ≤ 0 := by
    intro pointIndex notInBlock
    exact le_of_not_gt fun outside =>
      notInBlock ((outsideIff pointIndex).mp outside)
  have zeroInside : signedDistance plane (vertex ⟨0, by omega⟩) ≤ 0 :=
    insideOfNotBlock ⟨0, by omega⟩ (by simp)
  have firstOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩) := by
    apply (outsideIff ⟨1, by omega⟩).mpr
    exact ⟨by norm_num, countPositive⟩
  have lastOutside :
      0 < signedDistance plane (vertex ⟨count, countBound⟩) := by
    apply (outsideIff ⟨count, countBound⟩).mpr
    exact ⟨countPositive, le_rfl⟩
  have nextInside :
      signedDistance plane (vertex ⟨count + 1, countNextBound⟩) ≤ 0 :=
    insideOfNotBlock ⟨count + 1, countNextBound⟩ (by
      change ¬(0 < count + 1 ∧ count + 1 ≤ count)
      omega)
  have exitParameterBounds := boundaryParameter_mem_Icc_of_inside_outside
    zeroInside firstOutside
  have entryParameterBounds := boundaryParameter_mem_Icc_of_outside_inside
    lastOutside nextInside
  rw [clippedSignedTwiceArea_eq_idealOutputPointFlatten]
  change closedEdgeCrossSum (idealIndexedChunks plane vertex).flatten ≤
    closedEdgeCrossSum (indexedVertices vertex)
  rw [idealIndexedChunkFlatten_eq_block plane vertex countPositive countBound
    countNextBound outsideIff]
  rw [indexedVertices_eq_block vertex countPositive countBound]
  have retainedEq := retainedBlockVertices_eq_cons
    (count := count) vertex countNextBound
  rw [retainedEq]
  by_cases singletonOutside : count = 1
  · subst count
    rw [outsideBlockVertices_eq_singleton vertex countBound]
    have turn : 0 ≤ orientation
        (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
        (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
        (vertex (⟨2, by omega⟩ : RingIndex extraVertices)) := by
      exact le_of_lt (ordered _ _ _ (by norm_num) (by norm_num))
    simpa [boundaryPoint] using
      (closedEdgeCrossSum_interpolate_corner_le_of_mem_Icc
        (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
        (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
        (vertex (⟨2, by omega⟩ : RingIndex extraVertices))
        exitParameterBounds entryParameterBounds turn
        (retainedBlockVertices (count := 1) vertex).tail)
  · have countAtLeastTwo : 2 ≤ count := by omega
    have outsideEq := outsideBlockVertices_eq_first_middle_last
      vertex countAtLeastTwo countBound
    rw [outsideEq]
    have outsideOrdered := outsideBlockVertices_triplewise ordered countBound
    rw [outsideEq] at outsideOrdered
    have firstTurn : 0 ≤ orientation
        (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
        (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
        (vertex ⟨count, countBound⟩) := by
      apply le_of_lt
      apply ordered
      · change 0 < 1
        omega
      · change 1 < count
        omega
    have middleTurn : 0 ≤ orientation
        (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
        (vertex ⟨count, countBound⟩)
        (vertex ⟨count + 1, countNextBound⟩) := by
      apply le_of_lt
      apply ordered
      · change 0 < count
        omega
      · change count < count + 1
        omega
    have lastTurn : 0 ≤ orientation
        (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
        (vertex ⟨count, countBound⟩)
        (vertex ⟨count + 1, countNextBound⟩) := by
      apply le_of_lt
      apply ordered
      · change 1 < count
        omega
      · change count < count + 1
        omega
    simpa [boundaryPoint] using
      (closedEdgeCrossSum_canonical_clip_le
        (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
        (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
        (vertex ⟨count, countBound⟩)
        (vertex ⟨count + 1, countNextBound⟩)
        (outsideBlockVertices vertex countBound).tail.dropLast
        (retainedBlockVertices (count := count) vertex).tail
        outsideOrdered exitParameterBounds entryParameterBounds
        firstTurn middleTurn lastTurn)

omit [IsStrictOrderedRing R] in
theorem idealIndexedChunks_eq_of_singleton_inside_block
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (countPositive : 0 < count)
    (countLast : count + 1 = extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    idealIndexedChunks plane vertex =
      canonicalChunkBlock
        [vertex ⟨0, by omega⟩,
          boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)]
        [boundaryPoint plane (vertex ⟨count, by omega⟩)
          (vertex ⟨0, by omega⟩)] count [] := by
  apply List.ext_getElem?
  intro index
  by_cases indexBound : index < extraVertices + 3
  · have insideOfNotBlock : ∀ pointIndex : RingIndex extraVertices,
        ¬(0 < pointIndex.val ∧ pointIndex.val ≤ count) →
          signedDistance plane (vertex pointIndex) ≤ 0 := by
      intro pointIndex notInBlock
      exact le_of_not_gt fun outside =>
        notInBlock ((outsideIff pointIndex).mp outside)
    have leftAtIndex :
        (idealIndexedChunks plane vertex)[index]? = some
          (idealOutputPoints plane (vertex ⟨index, indexBound⟩)
            (vertex (nextIndex ⟨index, indexBound⟩))) := by
      rw [idealIndexedChunks, indexedEdges, List.map_ofFn]
      change (List.ofFn (fun pointIndex => idealOutputPoints plane
        (vertex pointIndex) (vertex (nextIndex pointIndex))))[index]? = _
      rw [List.getElem?_ofFn, dif_pos indexBound]
    rw [leftAtIndex]
    by_cases indexZero : index = 0
    · subst index
      have zeroInside : signedDistance plane (vertex ⟨0, by omega⟩) ≤ 0 :=
        insideOfNotBlock ⟨0, by omega⟩ (by simp)
      have firstOutside :
          0 < signedDistance plane (vertex ⟨1, by omega⟩) := by
        apply (outsideIff ⟨1, by omega⟩).mpr
        exact ⟨by norm_num, countPositive⟩
      rw [show nextIndex (⟨0, by omega⟩ : RingIndex extraVertices) =
          ⟨1, by omega⟩ by
        apply Fin.ext
        simp [nextIndex]]
      rw [idealOutputPoints_of_inside_outside
        plane _ _ zeroInside firstOutside]
      simp [canonicalChunkBlock]
    · by_cases beforeLast : index < count
      · have currentOutside :
            0 < signedDistance plane (vertex ⟨index, indexBound⟩) := by
          apply (outsideIff ⟨index, indexBound⟩).mpr
          change 0 < index ∧ index ≤ count
          omega
        have nextBound : index + 1 < extraVertices + 3 := by omega
        have nextOutside :
            0 < signedDistance plane (vertex ⟨index + 1, nextBound⟩) := by
          apply (outsideIff ⟨index + 1, nextBound⟩).mpr
          change 0 < index + 1 ∧ index + 1 ≤ count
          omega
        rw [show nextIndex (⟨index, indexBound⟩ : RingIndex extraVertices) =
            ⟨index + 1, nextBound⟩ by
          apply Fin.ext
          simp [nextIndex, Nat.mod_eq_of_lt nextBound]]
        rw [idealOutputPoints_of_outside_outside
          plane _ _ currentOutside nextOutside]
        have indexForm : ∃ offset, index = offset + 1 :=
          ⟨index - 1, by omega⟩
        rcases indexForm with ⟨offset, rfl⟩
        have offsetBound : offset < count - 1 := by omega
        simp [canonicalChunkBlock]
        rw [List.getElem?_append_left (by simpa using offsetBound)]
        rw [List.getElem?_replicate, if_pos offsetBound]
      · have atLast : index = count := by omega
        subst index
        have lastOutside :
            0 < signedDistance plane (vertex ⟨count, by omega⟩) := by
          apply (outsideIff ⟨count, by omega⟩).mpr
          exact ⟨countPositive, le_rfl⟩
        have zeroInside : signedDistance plane (vertex ⟨0, by omega⟩) ≤ 0 :=
          insideOfNotBlock ⟨0, by omega⟩ (by simp)
        rw [show nextIndex (⟨count, by omega⟩ : RingIndex extraVertices) =
            ⟨0, by omega⟩ by
          apply Fin.ext
          simp [nextIndex, countLast]]
        rw [idealOutputPoints_of_outside_inside
          plane _ _ lastOutside zeroInside]
        cases count with
        | zero => omega
        | succ countTail => simp [canonicalChunkBlock]
  · have totalLength : 1 + (count - 1) + 1 = extraVertices + 3 := by omega
    simp [idealIndexedChunks, indexedEdges, canonicalChunkBlock, indexBound]
    omega

theorem clippedSignedTwiceArea_le_of_singleton_inside_block
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countLast : count + 1 = extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    clippedSignedTwiceArea plane vertex ≤ indexedSignedTwiceArea vertex := by
  have countBound : count < extraVertices + 3 := by omega
  have countAtLeastTwo : 2 ≤ count := by omega
  have zeroInside : signedDistance plane (vertex ⟨0, by omega⟩) ≤ 0 := by
    apply le_of_not_gt
    intro outside
    have bounds := (outsideIff ⟨0, by omega⟩).mp outside
    change 0 < 0 ∧ 0 ≤ count at bounds
    omega
  have firstOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩) := by
    apply (outsideIff ⟨1, by omega⟩).mpr
    exact ⟨by norm_num, by omega⟩
  have lastOutside :
      0 < signedDistance plane (vertex ⟨count, countBound⟩) := by
    apply (outsideIff ⟨count, countBound⟩).mpr
    exact ⟨countPositive, le_rfl⟩
  have exitParameterBounds := boundaryParameter_mem_Icc_of_inside_outside
    zeroInside firstOutside
  have entryParameterBounds := boundaryParameter_mem_Icc_of_outside_inside
    lastOutside zeroInside
  have outsideEq := outsideBlockVertices_eq_first_middle_last
    vertex countAtLeastTwo countBound
  have outsideOrdered := outsideBlockVertices_triplewise ordered countBound
  rw [outsideEq] at outsideOrdered
  have firstTurn : 0 ≤ orientation
      (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
      (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
      (vertex ⟨count, countBound⟩) := by
    apply le_of_lt
    apply ordered
    · change 0 < 1
      omega
    · change 1 < count
      omega
  have lastTurn : 0 ≤ orientation
      (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
      (vertex ⟨count, countBound⟩)
      (vertex (⟨0, by omega⟩ : RingIndex extraVertices)) := by
    rw [orientation_cycle]
    exact firstTurn
  rw [clippedSignedTwiceArea_eq_idealOutputPointFlatten]
  change closedEdgeCrossSum (idealIndexedChunks plane vertex).flatten ≤
    closedEdgeCrossSum (indexedVertices vertex)
  rw [idealIndexedChunks_eq_of_singleton_inside_block
    plane vertex countPositive countLast outsideIff]
  rw [indexedVertices_eq_block vertex countPositive countBound]
  rw [outsideEq]
  have retainedEmpty :
      retainedBlockVertices (count := count) vertex = [] := by
    simp [retainedBlockVertices]
    omega
  rw [retainedEmpty]
  simp [canonicalChunkBlock]
  simpa [boundaryPoint] using
    (closedEdgeCrossSum_singleton_inside_clip_le
      (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
      (vertex (⟨1, by omega⟩ : RingIndex extraVertices))
      (vertex ⟨count, countBound⟩)
      (outsideBlockVertices vertex countBound).tail.dropLast
      outsideOrdered exitParameterBounds entryParameterBounds
      firstTurn (by simp) lastTurn)

theorem indexedVertices_nodup_of_strict {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    (indexedVertices vertex).Nodup := by
  exact List.nodup_ofFn_ofInjective ordered.injective

theorem indexedSignedTwiceArea_nonnegative {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    0 ≤ indexedSignedTwiceArea vertex := by
  apply closedEdgeCrossSum_nonnegative_of_triplewise
  exact (linearlyOrdered_iff_indexedVertices_triplewise vertex).mp
    ordered.vertexOrdered.linear

theorem clippedSignedTwiceArea_le_of_length_le_two {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (lengthBound : (clipIndexedRing plane vertex).length ≤ 2) :
    clippedSignedTwiceArea plane vertex ≤ indexedSignedTwiceArea vertex := by
  rw [clippedSignedTwiceArea,
    closedEdgeCrossSum_eq_zero_of_length_le_two _ lengthBound]
  exact indexedSignedTwiceArea_nonnegative ordered

omit [IsStrictOrderedRing R] in
theorem clipIndexedRing_eq_nil_of_all_outside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allOutside : ∀ index, 0 < signedDistance plane (vertex index)) :
    clipIndexedRing plane vertex = [] := by
  have eachEmpty : ∀ edge ∈ indexedEdges vertex,
      outputPoints plane edge.1 edge.2 = [] := by
    intro edge edgeMember
    obtain ⟨index, rfl⟩ := (mem_indexedEdges_iff vertex edge).mp edgeMember
    exact outputPoints_eq_nil_of_outside plane
      (vertex index) (vertex (nextIndex index))
      (allOutside index) (allOutside (nextIndex index))
  have flattenedEmpty := outputPointFlatten_eq_nil_of_each_empty
    plane (indexedEdges vertex) eachEmpty
  rw [clipIndexedRing, closedClipOutputPoints, clipOutputPoints,
    joinDistinct, flattenedEmpty]
  rfl

theorem clippedSignedTwiceArea_le_of_all_outside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (allOutside : ∀ index, 0 < signedDistance plane (vertex index)) :
    clippedSignedTwiceArea plane vertex ≤ indexedSignedTwiceArea vertex := by
  rw [clippedSignedTwiceArea, clipIndexedRing_eq_nil_of_all_outside plane vertex allOutside]
  exact indexedSignedTwiceArea_nonnegative ordered

omit [IsStrictOrderedRing R] in
theorem outputPointFlatten_eq_indexedVertices_of_all_inside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allInside : ∀ index, signedDistance plane (vertex index) ≤ 0) :
    ((indexedEdges vertex).map fun edge =>
      outputPoints plane edge.1 edge.2).flatten = indexedVertices vertex := by
  have outputAt : ∀ index : RingIndex extraVertices,
      outputPoints plane (vertex index) (vertex (nextIndex index)) = [vertex index] := by
    intro index
    exact outputPoints_eq_singleton_of_inside plane
      (vertex index) (vertex (nextIndex index))
      (allInside index) (allInside (nextIndex index))
  rw [indexedEdges, List.map_ofFn]
  change (List.ofFn (fun index : RingIndex extraVertices =>
    outputPoints plane (vertex index) (vertex (nextIndex index)))).flatten =
      indexedVertices vertex
  have outputFunction :
      (fun index : RingIndex extraVertices =>
        outputPoints plane (vertex index) (vertex (nextIndex index))) =
        fun index => [vertex index] := by
    funext index
    exact outputAt index
  rw [outputFunction]
  rw [List.ofFn_comp' vertex (fun point => [point])]
  change ((indexedVertices vertex).map fun point => [point]).flatten =
    indexedVertices vertex
  generalize indexedVertices vertex = points
  induction points with
  | nil => rfl
  | cons point rest inductionHypothesis => simp [inductionHypothesis]

theorem clipIndexedRing_eq_indexedVertices_of_all_inside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (allInside : ∀ index, signedDistance plane (vertex index) ≤ 0) :
    clipIndexedRing plane vertex = indexedVertices vertex := by
  have flattened := outputPointFlatten_eq_indexedVertices_of_all_inside
    plane vertex allInside
  have nodup := indexedVertices_nodup_of_strict ordered
  have chain : (indexedVertices vertex).IsChain (· ≠ ·) :=
    (nodup.pairwise_of_forall_ne fun _ _ _ _ distinct => distinct).isChain
  rw [clipIndexedRing, closedClipOutputPoints, clipOutputPoints, joinDistinct, flattened]
  rw [List.destutter_of_isChain (· ≠ ·) _ chain]
  exact normalizeClosure_eq_self_of_nodup _ nodup

theorem clippedSignedTwiceArea_eq_of_all_inside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (allInside : ∀ index, signedDistance plane (vertex index) ≤ 0) :
    clippedSignedTwiceArea plane vertex = indexedSignedTwiceArea vertex := by
  rw [clippedSignedTwiceArea, indexedSignedTwiceArea,
    clipIndexedRing_eq_indexedVertices_of_all_inside plane vertex ordered allInside]

/-- A checkable structural certificate for the nondegenerate mixed clipping case. -/
structure CanonicalMixedClipDecomposition
    (input output : List (Vec2 R)) where
  insideLast : Vec2 R
  outsideFirst : Vec2 R
  outsideLast : Vec2 R
  insideFirst : Vec2 R
  outsideMiddle : List (Vec2 R)
  insideTail : List (Vec2 R)
  exitParameter : R
  entryParameter : R
  inputRotationAmount : Nat
  outputRotationAmount : Nat
  inputRotation :
    input.rotate inputRotationAmount =
      insideLast :: outsideFirst ::
        (outsideMiddle ++ outsideLast :: insideFirst :: insideTail)
  outputRotation :
    output.rotate outputRotationAmount =
      insideLast ::
        interpolatePoint insideLast outsideFirst exitParameter ::
        interpolatePoint outsideLast insideFirst entryParameter ::
        insideFirst :: insideTail
  outsideOrdered :
    (outsideFirst :: (outsideMiddle ++ [outsideLast])).Triplewise
      (fun first second third => 0 ≤ orientation first second third)
  exitInSegment : exitParameter ∈ Set.Icc (0 : R) 1
  entryInSegment : entryParameter ∈ Set.Icc (0 : R) 1
  firstTurn : 0 ≤ orientation insideLast outsideFirst outsideLast
  middleTurn : 0 ≤ orientation insideLast outsideLast insideFirst
  lastTurn : 0 ≤ orientation outsideFirst outsideLast insideFirst

omit [IsStrictOrderedRing R] in
theorem canonicalMixedClipDecomposition_input_length_at_least_four
    {input output : List (Vec2 R)}
    (decomposition : CanonicalMixedClipDecomposition input output) :
    4 ≤ input.length := by
  rw [← List.length_rotate input decomposition.inputRotationAmount,
    decomposition.inputRotation]
  simp
  omega

/-- Mixed clipping where exactly one input vertex is outside. -/
structure SingletonOutsideClipDecomposition
    (input output : List (Vec2 R)) where
  insideLast : Vec2 R
  outside : Vec2 R
  insideFirst : Vec2 R
  insideTail : List (Vec2 R)
  exitParameter : R
  entryParameter : R
  inputRotationAmount : Nat
  outputRotationAmount : Nat
  inputRotation :
    input.rotate inputRotationAmount =
      insideLast :: outside :: insideFirst :: insideTail
  outputRotation :
    output.rotate outputRotationAmount =
      insideLast ::
        interpolatePoint insideLast outside exitParameter ::
        interpolatePoint outside insideFirst entryParameter ::
        insideFirst :: insideTail
  exitInSegment : exitParameter ∈ Set.Icc (0 : R) 1
  entryInSegment : entryParameter ∈ Set.Icc (0 : R) 1
  turn : 0 ≤ orientation insideLast outside insideFirst

/-- Mixed clipping where exactly one input vertex is retained. -/
structure SingletonInsideClipDecomposition
    (input output : List (Vec2 R)) where
  inside : Vec2 R
  outsideFirst : Vec2 R
  outsideLast : Vec2 R
  outsideMiddle : List (Vec2 R)
  exitParameter : R
  entryParameter : R
  inputRotationAmount : Nat
  outputRotationAmount : Nat
  inputRotation :
    input.rotate inputRotationAmount =
      inside :: outsideFirst :: (outsideMiddle ++ [outsideLast])
  outputRotation :
    output.rotate outputRotationAmount =
      [inside,
        interpolatePoint inside outsideFirst exitParameter,
        interpolatePoint outsideLast inside entryParameter]
  outsideOrdered :
    (outsideFirst :: (outsideMiddle ++ [outsideLast])).Triplewise
      (fun first second third => 0 ≤ orientation first second third)
  exitInSegment : exitParameter ∈ Set.Icc (0 : R) 1
  entryInSegment : entryParameter ∈ Set.Icc (0 : R) 1
  firstTurn : 0 ≤ orientation inside outsideFirst outsideLast
  lastTurn : 0 ≤ orientation outsideFirst outsideLast inside

theorem closedEdgeCrossSum_le_of_mixed_decomposition
    {input output : List (Vec2 R)}
    (decomposition : CanonicalMixedClipDecomposition input output) :
    closedEdgeCrossSum output ≤ closedEdgeCrossSum input := by
  calc
    closedEdgeCrossSum output =
        closedEdgeCrossSum (output.rotate decomposition.outputRotationAmount) :=
      (closedEdgeCrossSum_rotate output decomposition.outputRotationAmount).symm
    _ = closedEdgeCrossSum
        (decomposition.insideLast ::
          interpolatePoint decomposition.insideLast decomposition.outsideFirst
            decomposition.exitParameter ::
          interpolatePoint decomposition.outsideLast decomposition.insideFirst
            decomposition.entryParameter ::
          decomposition.insideFirst :: decomposition.insideTail) := by
      rw [decomposition.outputRotation]
    _ ≤ closedEdgeCrossSum
        (decomposition.insideLast :: decomposition.outsideFirst ::
          (decomposition.outsideMiddle ++
            decomposition.outsideLast :: decomposition.insideFirst ::
              decomposition.insideTail)) := by
      exact closedEdgeCrossSum_canonical_clip_le
        decomposition.insideLast decomposition.outsideFirst
        decomposition.outsideLast decomposition.insideFirst
        decomposition.outsideMiddle decomposition.insideTail
        decomposition.outsideOrdered
        decomposition.exitInSegment decomposition.entryInSegment
        decomposition.firstTurn decomposition.middleTurn decomposition.lastTurn
    _ = closedEdgeCrossSum (input.rotate decomposition.inputRotationAmount) := by
      rw [decomposition.inputRotation]
    _ = closedEdgeCrossSum input :=
      closedEdgeCrossSum_rotate input decomposition.inputRotationAmount

theorem closedEdgeCrossSum_le_of_singleton_outside_decomposition
    {input output : List (Vec2 R)}
    (decomposition : SingletonOutsideClipDecomposition input output) :
    closedEdgeCrossSum output ≤ closedEdgeCrossSum input := by
  calc
    closedEdgeCrossSum output =
        closedEdgeCrossSum (output.rotate decomposition.outputRotationAmount) :=
      (closedEdgeCrossSum_rotate output decomposition.outputRotationAmount).symm
    _ = closedEdgeCrossSum
        (decomposition.insideLast ::
          interpolatePoint decomposition.insideLast decomposition.outside
            decomposition.exitParameter ::
          interpolatePoint decomposition.outside decomposition.insideFirst
            decomposition.entryParameter ::
          decomposition.insideFirst :: decomposition.insideTail) := by
      rw [decomposition.outputRotation]
    _ ≤ closedEdgeCrossSum
        (decomposition.insideLast :: decomposition.outside ::
          decomposition.insideFirst :: decomposition.insideTail) := by
      exact closedEdgeCrossSum_interpolate_corner_le_of_mem_Icc
        decomposition.insideLast decomposition.outside decomposition.insideFirst
        decomposition.exitInSegment decomposition.entryInSegment
        decomposition.turn decomposition.insideTail
    _ = closedEdgeCrossSum
        (input.rotate decomposition.inputRotationAmount) := by
      rw [decomposition.inputRotation]
    _ = closedEdgeCrossSum input :=
      closedEdgeCrossSum_rotate input decomposition.inputRotationAmount

theorem closedEdgeCrossSum_le_of_singleton_inside_decomposition
    {input output : List (Vec2 R)}
    (decomposition : SingletonInsideClipDecomposition input output) :
    closedEdgeCrossSum output ≤ closedEdgeCrossSum input := by
  calc
    closedEdgeCrossSum output =
        closedEdgeCrossSum (output.rotate decomposition.outputRotationAmount) :=
      (closedEdgeCrossSum_rotate output decomposition.outputRotationAmount).symm
    _ = closedEdgeCrossSum
        [decomposition.inside,
          interpolatePoint decomposition.inside decomposition.outsideFirst
            decomposition.exitParameter,
          interpolatePoint decomposition.outsideLast decomposition.inside
            decomposition.entryParameter] := by
      rw [decomposition.outputRotation]
    _ ≤ closedEdgeCrossSum
        (decomposition.inside :: decomposition.outsideFirst ::
          (decomposition.outsideMiddle ++ [decomposition.outsideLast])) := by
      exact closedEdgeCrossSum_singleton_inside_clip_le
        decomposition.inside decomposition.outsideFirst decomposition.outsideLast
        decomposition.outsideMiddle decomposition.outsideOrdered
        decomposition.exitInSegment decomposition.entryInSegment
        decomposition.firstTurn (by simp) decomposition.lastTurn
    _ = closedEdgeCrossSum
        (input.rotate decomposition.inputRotationAmount) := by
      rw [decomposition.inputRotation]
    _ = closedEdgeCrossSum input :=
      closedEdgeCrossSum_rotate input decomposition.inputRotationAmount

/-- Exhaustive certificate shape consumed by the final area theorem.

The mixed constructor deliberately carries a structural decomposition. Proving that the
current emitter always produces such a certificate is a separate implementation-refinement
obligation, rather than an implicit assumption hidden in the area theorem. -/
inductive ClipAreaCertificate {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) : Prop
  | allInside
      (inside : ∀ index, signedDistance plane (vertex index) ≤ 0)
  | allOutside
      (outside : ∀ index, 0 < signedDistance plane (vertex index))
  | degenerate
      (lengthBound : (clipIndexedRing plane vertex).length ≤ 2)
  | singletonOutside
      (decomposition : SingletonOutsideClipDecomposition
        (indexedVertices vertex) (clipIndexedRing plane vertex))
  | singletonInside
      (decomposition : SingletonInsideClipDecomposition
        (indexedVertices vertex) (clipIndexedRing plane vertex))
  | mixed
      (decomposition : CanonicalMixedClipDecomposition
        (indexedVertices vertex) (clipIndexedRing plane vertex))

theorem clippedSignedTwiceArea_le_of_certificate {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (certificate : ClipAreaCertificate plane vertex) :
    clippedSignedTwiceArea plane vertex ≤ indexedSignedTwiceArea vertex := by
  cases certificate with
  | allInside inside =>
      exact (clippedSignedTwiceArea_eq_of_all_inside
        plane vertex ordered inside).le
  | allOutside outside =>
      exact clippedSignedTwiceArea_le_of_all_outside
        plane vertex ordered outside
  | degenerate lengthBound =>
      exact clippedSignedTwiceArea_le_of_length_le_two
        plane vertex ordered lengthBound
  | singletonOutside decomposition =>
      exact closedEdgeCrossSum_le_of_singleton_outside_decomposition decomposition
  | singletonInside decomposition =>
      exact closedEdgeCrossSum_le_of_singleton_inside_decomposition decomposition
  | mixed decomposition =>
      exact closedEdgeCrossSum_le_of_mixed_decomposition decomposition

/-- Unconditional semantic theorem: clipping a strict convex CCW ring by any closed
half-plane cannot increase its signed shoelace area. -/
theorem clippedSignedTwiceArea_le {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    clippedSignedTwiceArea plane vertex ≤ indexedSignedTwiceArea vertex := by
  by_cases hasOutside : ∃ index, 0 < signedDistance plane (vertex index)
  · by_cases hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0
    · rcases outside_rotatedBlock plane vertex ordered hasOutside hasInside with
        ⟨positive, start, count, countPositive, countBound, blockIff⟩
      let rotated := rotateVertex start vertex
      have rotatedOrdered : IsStrictVertexOrderedConvexCCW rotated :=
        ordered.rotateVertex start
      have rotatedBlockIff : ∀ index,
          0 < signedDistance plane (rotated index) ↔
            0 < index.val ∧ index.val ≤ count := by
        intro index
        simpa [rotated, rotateVertex] using blockIff index
      have rotatedAreaNonincrease :
          clippedSignedTwiceArea plane rotated ≤ indexedSignedTwiceArea rotated := by
        by_cases retainedAtLeastTwo : count + 1 < extraVertices + 3
        · exact clippedSignedTwiceArea_le_of_rotatedBlock
            plane rotated rotatedOrdered countPositive countBound
            retainedAtLeastTwo rotatedBlockIff
        · have singletonInside : count + 1 = extraVertices + 3 := by omega
          exact clippedSignedTwiceArea_le_of_singleton_inside_block
            plane rotated rotatedOrdered countPositive singletonInside rotatedBlockIff
      calc
        clippedSignedTwiceArea plane vertex =
            clippedSignedTwiceArea plane rotated :=
          (clippedSignedTwiceArea_rotateVertex plane start vertex).symm
        _ ≤ indexedSignedTwiceArea rotated := rotatedAreaNonincrease
        _ = indexedSignedTwiceArea vertex :=
          indexedSignedTwiceArea_rotateVertex start vertex
    · have allOutside : ∀ index, 0 < signedDistance plane (vertex index) := by
        intro index
        exact lt_of_not_ge fun inside => hasInside ⟨index, inside⟩
      exact clippedSignedTwiceArea_le_of_all_outside
        plane vertex ordered allOutside
  · have allInside : ∀ index, signedDistance plane (vertex index) ≤ 0 := by
      intro index
      exact le_of_not_gt fun outside => hasOutside ⟨index, outside⟩
    exact (clippedSignedTwiceArea_eq_of_all_inside
      plane vertex ordered allInside).le

/-- Regression witness: a strict triangle can have exactly one retained input vertex. -/
def singletonInsideTriangleVertex (index : RingIndex 0) : Vec2 Rat :=
  match index.val with
  | 0 => { x := 0, y := 0 }
  | 1 => { x := 2, y := 0 }
  | _ => { x := 0, y := 2 }

def singletonInsideTrianglePlane : HalfPlane Rat where
  normalX := 1
  normalY := 1
  offset := 1

theorem singletonInsideTriangle_strict :
    IsStrictVertexOrderedConvexCCW singletonInsideTriangleVertex := by
  intro first second third firstBefore secondBefore
  have firstValue : first.val = 0 := by omega
  have secondValue : second.val = 1 := by omega
  have thirdValue : third.val = 2 := by omega
  have firstEq : first = (⟨0, by omega⟩ : RingIndex 0) := Fin.ext firstValue
  have secondEq : second = (⟨1, by omega⟩ : RingIndex 0) := Fin.ext secondValue
  have thirdEq : third = (⟨2, by omega⟩ : RingIndex 0) := Fin.ext thirdValue
  rw [firstEq, secondEq, thirdEq]
  norm_num [singletonInsideTriangleVertex, orientation]

theorem singletonInsideTriangle_clip_output :
    clipIndexedRing singletonInsideTrianglePlane singletonInsideTriangleVertex =
      [{ x := 0, y := 0 }, { x := 1, y := 0 }, { x := 0, y := 1 }] := by
  native_decide

/-- The former general mixed shape cannot represent the three-vertex witness. -/
theorem singletonInsideTriangle_not_general_mixed :
    ¬Nonempty (CanonicalMixedClipDecomposition
      (indexedVertices singletonInsideTriangleVertex)
      (clipIndexedRing singletonInsideTrianglePlane singletonInsideTriangleVertex)) := by
  rintro ⟨decomposition⟩
  have lengthBound :=
    canonicalMixedClipDecomposition_input_length_at_least_four decomposition
  have inputLength :
      (indexedVertices singletonInsideTriangleVertex).length = 3 := by
    simp [indexedVertices]
  omega

/-- The widened singleton-inside constructor accepts the regression witness. -/
def singletonInsideTriangleDecomposition : SingletonInsideClipDecomposition
    (indexedVertices singletonInsideTriangleVertex)
    (clipIndexedRing singletonInsideTrianglePlane singletonInsideTriangleVertex) where
  inside := { x := 0, y := 0 }
  outsideFirst := { x := 2, y := 0 }
  outsideLast := { x := 0, y := 2 }
  outsideMiddle := []
  exitParameter := 1 / 2
  entryParameter := 1 / 2
  inputRotationAmount := 0
  outputRotationAmount := 0
  inputRotation := by native_decide
  outputRotation := by native_decide
  outsideOrdered := by simp
  exitInSegment := by norm_num
  entryInSegment := by norm_num
  firstTurn := by norm_num [orientation]
  lastTurn := by norm_num [orientation]

theorem singletonInsideTriangle_area_nonincrease :
    clippedSignedTwiceArea singletonInsideTrianglePlane singletonInsideTriangleVertex ≤
      indexedSignedTwiceArea singletonInsideTriangleVertex := by
  exact clippedSignedTwiceArea_le_of_certificate
    singletonInsideTrianglePlane singletonInsideTriangleVertex
    singletonInsideTriangle_strict
    (.singletonInside singletonInsideTriangleDecomposition)

def singletonOutsideTrianglePlane : HalfPlane Rat where
  normalX := 1
  normalY := 0
  offset := 1

/-- The symmetric one-outside triangle exercises the other widened constructor. -/
def singletonOutsideTriangleDecomposition : SingletonOutsideClipDecomposition
    (indexedVertices singletonInsideTriangleVertex)
    (clipIndexedRing singletonOutsideTrianglePlane singletonInsideTriangleVertex) where
  insideLast := { x := 0, y := 0 }
  outside := { x := 2, y := 0 }
  insideFirst := { x := 0, y := 2 }
  insideTail := []
  exitParameter := 1 / 2
  entryParameter := 1 / 2
  inputRotationAmount := 0
  outputRotationAmount := 0
  inputRotation := by native_decide
  outputRotation := by native_decide
  exitInSegment := by norm_num
  entryInSegment := by norm_num
  turn := by norm_num [orientation]

theorem singletonOutsideTriangle_area_nonincrease :
    clippedSignedTwiceArea singletonOutsideTrianglePlane singletonInsideTriangleVertex ≤
      indexedSignedTwiceArea singletonInsideTriangleVertex := by
  exact clippedSignedTwiceArea_le_of_certificate
    singletonOutsideTrianglePlane singletonInsideTriangleVertex
    singletonInsideTriangle_strict
    (.singletonOutside singletonOutsideTriangleDecomposition)

end Sprawlens.ConvexClipArea
