import Sprawlens.ConvexClipContract
import Sprawlens.CyclicBinaryBlocks
import Mathlib.Data.List.Rotate

namespace Sprawlens.StrictConvexContract

open ConvexClipContract
open CyclicBinaryBlocks
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneClipRing
open OrderedTriples
open SimpleRing

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Re-index a cyclic vertex function from a chosen materialization seam. -/
def rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    RingIndex extraVertices → Vec2 R :=
  fun index => vertex (rotateIndex (by omega) start index)

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem indexedVertices_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    indexedVertices (rotateVertex start vertex) =
      (indexedVertices vertex).rotate start.val := by
  apply List.ext_getElem
  · rw [List.length_rotate]
    simp [indexedVertices]
  · intro index leftBound rightBound
    simp only [indexedVertices, List.length_ofFn] at leftBound rightBound
    simp only [indexedVertices, List.getElem_ofFn, List.getElem_rotate,
      rotateVertex, rotateIndex]
    apply congrArg vertex
    apply Fin.ext
    simp only [List.length_ofFn]
    rw [Nat.add_comm]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem rotateIndex_nextIndex {extraVertices : Nat}
    (start index : RingIndex extraVertices) :
    rotateIndex (by omega) start (nextIndex index) =
      nextIndex (rotateIndex (by omega) start index) := by
  apply Fin.ext
  simp only [rotateIndex, nextIndex]
  rw [Nat.add_mod_mod, Nat.mod_add_mod]
  congr 1

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem indexedEdges_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    indexedEdges (rotateVertex start vertex) =
      (indexedEdges vertex).rotate start.val := by
  apply List.ext_getElem
  · rw [List.length_rotate]
    simp [indexedEdges]
  · intro index leftBound rightBound
    simp only [indexedEdges, List.length_ofFn] at leftBound rightBound
    simp only [indexedEdges, List.getElem_ofFn, List.getElem_rotate,
      rotateVertex]
    congr 1
    · apply congrArg vertex
      apply Fin.ext
      simp only [rotateIndex, List.length_ofFn]
      rw [Nat.add_comm]
    · rw [rotateIndex_nextIndex]
      apply congrArg (fun shifted => vertex (nextIndex shifted))
      apply Fin.ext
      simp only [rotateIndex, List.length_ofFn]
      rw [Nat.add_comm]

/-- Every three vertices in increasing index order form a strict left turn. -/
def IsStrictlyLinearlyOrderedCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∀ first second third,
    first.val < second.val → second.val < third.val →
      0 < orientation (vertex first) (vertex second) (vertex third)

omit [IsStrictOrderedRing R] in
theorem IsStrictlyLinearlyOrderedCCW.rotateVertex {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictlyLinearlyOrderedCCW vertex)
    (start : RingIndex extraVertices) :
    IsStrictlyLinearlyOrderedCCW (rotateVertex start vertex) := by
  intro first second third firstBefore secondBefore
  let positive : 0 < extraVertices + 3 := by omega
  let firstRotated := rotateIndex positive start first
  let secondRotated := rotateIndex positive start second
  let thirdRotated := rotateIndex positive start third
  have firstValue : firstRotated.val =
      if start.val + first.val < extraVertices + 3 then
        start.val + first.val else start.val + first.val - (extraVertices + 3) := by
    exact add_mod_eq_self_or_sub start.isLt first.isLt
  have secondValue : secondRotated.val =
      if start.val + second.val < extraVertices + 3 then
        start.val + second.val else start.val + second.val - (extraVertices + 3) := by
    exact add_mod_eq_self_or_sub start.isLt second.isLt
  have thirdValue : thirdRotated.val =
      if start.val + third.val < extraVertices + 3 then
        start.val + third.val else start.val + third.val - (extraVertices + 3) := by
    exact add_mod_eq_self_or_sub start.isLt third.isLt
  change 0 < orientation
    (vertex firstRotated) (vertex secondRotated) (vertex thirdRotated)
  by_cases thirdInRange : start.val + third.val < extraVertices + 3
  · have firstInRange : start.val + first.val < extraVertices + 3 := by omega
    have secondInRange : start.val + second.val < extraVertices + 3 := by omega
    apply ordered firstRotated secondRotated thirdRotated
    · simp [firstValue, secondValue, firstInRange, secondInRange]
      omega
    · simp [secondValue, thirdValue, secondInRange, thirdInRange]
      omega
  · by_cases firstInRange : start.val + first.val < extraVertices + 3
    · by_cases secondInRange : start.val + second.val < extraVertices + 3
      · rw [orientation_cycle
          (vertex thirdRotated) (vertex firstRotated) (vertex secondRotated)]
        apply ordered thirdRotated firstRotated secondRotated
        · simp [thirdValue, firstValue, thirdInRange, firstInRange]
          omega
        · simp [firstValue, secondValue, firstInRange, secondInRange]
          omega
      · rw [← orientation_cycle
          (vertex firstRotated) (vertex secondRotated) (vertex thirdRotated)]
        apply ordered secondRotated thirdRotated firstRotated
        · simp [secondValue, thirdValue, secondInRange, thirdInRange]
          omega
        · simp [thirdValue, firstValue, thirdInRange, firstInRange]
          omega
    · have secondNotInRange :
          ¬start.val + second.val < extraVertices + 3 := by omega
      apply ordered firstRotated secondRotated thirdRotated
      · simp [firstValue, secondValue, firstInRange, secondNotInRange]
        omega
      · simp [secondValue, thirdValue, secondNotInRange, thirdInRange]
        omega

omit [IsStrictOrderedRing R] in
/-- Weak global vertex order is invariant under changing the cyclic
materialization seam. -/
theorem linearlyOrdered_rotateVertex {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsLinearlyOrderedCCW vertex)
    (start : RingIndex extraVertices) :
    IsLinearlyOrderedCCW (rotateVertex start vertex) := by
  intro first second third firstBefore secondBefore
  let positive : 0 < extraVertices + 3 := by omega
  let firstRotated := rotateIndex positive start first
  let secondRotated := rotateIndex positive start second
  let thirdRotated := rotateIndex positive start third
  have firstValue : firstRotated.val =
      if start.val + first.val < extraVertices + 3 then
        start.val + first.val else start.val + first.val - (extraVertices + 3) := by
    exact add_mod_eq_self_or_sub start.isLt first.isLt
  have secondValue : secondRotated.val =
      if start.val + second.val < extraVertices + 3 then
        start.val + second.val else start.val + second.val - (extraVertices + 3) := by
    exact add_mod_eq_self_or_sub start.isLt second.isLt
  have thirdValue : thirdRotated.val =
      if start.val + third.val < extraVertices + 3 then
        start.val + third.val else start.val + third.val - (extraVertices + 3) := by
    exact add_mod_eq_self_or_sub start.isLt third.isLt
  change 0 ≤ orientation
    (vertex firstRotated) (vertex secondRotated) (vertex thirdRotated)
  by_cases thirdInRange : start.val + third.val < extraVertices + 3
  · have firstInRange : start.val + first.val < extraVertices + 3 := by omega
    have secondInRange : start.val + second.val < extraVertices + 3 := by omega
    apply ordered firstRotated secondRotated thirdRotated
    · simp [firstValue, secondValue, firstInRange, secondInRange]
      omega
    · simp [secondValue, thirdValue, secondInRange, thirdInRange]
      omega
  · by_cases firstInRange : start.val + first.val < extraVertices + 3
    · by_cases secondInRange : start.val + second.val < extraVertices + 3
      · rw [orientation_cycle
          (vertex thirdRotated) (vertex firstRotated) (vertex secondRotated)]
        apply ordered thirdRotated firstRotated secondRotated
        · simp [thirdValue, firstValue, thirdInRange, firstInRange]
          omega
        · simp [firstValue, secondValue, firstInRange, secondInRange]
          omega
      · rw [← orientation_cycle
          (vertex firstRotated) (vertex secondRotated) (vertex thirdRotated)]
        apply ordered secondRotated thirdRotated firstRotated
        · simp [secondValue, thirdValue, secondInRange, thirdInRange]
          omega
        · simp [thirdValue, firstValue, thirdInRange, firstInRange]
          omega
    · have secondNotInRange :
          ¬start.val + second.val < extraVertices + 3 := by omega
      apply ordered firstRotated secondRotated thirdRotated
      · simp [firstValue, secondValue, firstInRange, secondNotInRange]
        omega
      · simp [secondValue, thirdValue, secondNotInRange, thirdInRange]
        omega

omit [IsStrictOrderedRing R] in
theorem strictlyLinearlyOrdered_iff_indexedVertices_triplewise
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) :
    IsStrictlyLinearlyOrderedCCW vertex ↔
      (indexedVertices vertex).Triplewise
        (fun first second third => 0 < orientation first second third) := by
  rw [List.triplewise_iff_getElem]
  constructor
  · intro ordered first second third firstBefore secondBefore thirdInRange
    simpa only [indexedVertices, List.getElem_ofFn] using ordered
      (⟨first, by
        simpa only [indexedVertices, List.length_ofFn] using
          (lt_trans firstBefore (lt_trans secondBefore thirdInRange))⟩)
      (⟨second, by
        simpa only [indexedVertices, List.length_ofFn] using
          (lt_trans secondBefore thirdInRange)⟩)
      (⟨third, by simpa only [indexedVertices, List.length_ofFn] using thirdInRange⟩)
      firstBefore secondBefore
  · intro ordered first second third firstBefore secondBefore
    simpa only [indexedVertices, List.getElem_ofFn] using ordered
      first.val second.val third.val firstBefore secondBefore
      (by simpa only [indexedVertices, List.length_ofFn] using third.isLt)

omit [IsStrictOrderedRing R] in
theorem IsStrictlyLinearlyOrderedCCW.weak {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictlyLinearlyOrderedCCW vertex) :
    IsLinearlyOrderedCCW vertex := by
  intro first second third firstBefore secondBefore
  exact le_of_lt (ordered first second third firstBefore secondBefore)

theorem IsStrictlyLinearlyOrderedCCW.vertex_ne_of_lt {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictlyLinearlyOrderedCCW vertex)
    (first second : RingIndex extraVertices)
    (firstBefore : first.val < second.val) :
    vertex first ≠ vertex second := by
  by_cases afterSecondInRange : second.val + 1 < extraVertices + 3
  · let afterSecond : RingIndex extraVertices :=
      ⟨second.val + 1, afterSecondInRange⟩
    exact strict_left_turn_start_ne_middle
      (vertex first) (vertex second) (vertex afterSecond)
      (ordered first second afterSecond firstBefore (by simp [afterSecond]))
  · have secondIsLast : second.val + 1 = extraVertices + 3 := by omega
    by_cases firstIsZero : first.val = 0
    · let middle : RingIndex extraVertices := ⟨1, by omega⟩
      exact strict_left_turn_start_ne_end
        (vertex first) (vertex middle) (vertex second)
        (ordered first middle second
          (by simp [middle, firstIsZero])
          (by simp [middle]; omega))
    · let beforeFirst : RingIndex extraVertices :=
        ⟨first.val - 1, by omega⟩
      exact strict_left_turn_middle_ne_end
        (vertex beforeFirst) (vertex first) (vertex second)
        (ordered beforeFirst first second
          (by
            show first.val - 1 < first.val
            exact Nat.sub_lt (Nat.zero_lt_of_ne_zero firstIsZero) (by omega))
          firstBefore)

theorem IsStrictlyLinearlyOrderedCCW.injective {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictlyLinearlyOrderedCCW vertex) :
    Function.Injective vertex := by
  intro first second pointsEqual
  by_contra indicesDiffer
  have valuesDiffer : first.val ≠ second.val := by
    intro valuesEqual
    exact indicesDiffer (Fin.ext valuesEqual)
  rcases lt_or_gt_of_ne valuesDiffer with firstBefore | secondBefore
  · exact (ordered.vertex_ne_of_lt first second firstBefore) pointsEqual
  · exact (ordered.vertex_ne_of_lt second first secondBefore) pointsEqual.symm

/-- Strict global vertex order; supporting half-planes follow from it. -/
def IsStrictVertexOrderedConvexCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  IsStrictlyLinearlyOrderedCCW vertex

omit [IsStrictOrderedRing R] in
theorem IsStrictVertexOrderedConvexCCW.weak {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    IsWeaklyConvexCCW vertex :=
  ConvexClipContract.IsLinearlyOrderedCCW.weak
    (IsStrictlyLinearlyOrderedCCW.weak ordered)

omit [IsStrictOrderedRing R] in
theorem IsStrictVertexOrderedConvexCCW.strict {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    IsStrictlyLinearlyOrderedCCW vertex :=
  ordered

theorem IsStrictVertexOrderedConvexCCW.injective {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    Function.Injective vertex :=
  ordered.strict.injective

omit [IsStrictOrderedRing R] in
theorem IsStrictVertexOrderedConvexCCW.vertexOrdered {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    IsVertexOrderedConvexCCW vertex :=
  IsStrictlyLinearlyOrderedCCW.weak ordered.strict

theorem clipIndexedRing_cyclicTurnsNonnegative_of_strict_vertex_ordered
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  exact clipIndexedRing_cyclicTurnsNonnegative_of_vertex_ordered
    plane vertex ordered.vertexOrdered

end Sprawlens.StrictConvexContract
