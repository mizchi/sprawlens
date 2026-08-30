import Mathlib.Data.List.OfFn
import Mathlib.Data.List.ChainOfFn
import Mathlib.Data.Fintype.Basic
import Mathlib.Tactic.FinCases
import Sprawlens.HalfPlaneBoundaryGeometry
import Sprawlens.HalfPlaneClipRing
import Sprawlens.SegmentTripleOrientation
import Sprawlens.SimpleRing

namespace Sprawlens.ConvexClipContract

open ExactGeometry
open HalfPlaneBoundaryGeometry
open HalfPlaneClipPoints
open HalfPlaneClipRing
open OrderedTriples
open SegmentTripleOrientation
open SimpleRing

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A weakly convex CCW ring: every vertex is left of every directed edge. -/
def IsWeaklyConvexCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∀ edgeIndex pointIndex,
    0 ≤ orientation
      (vertex edgeIndex) (vertex (nextIndex edgeIndex)) (vertex pointIndex)

omit [IsStrictOrderedRing R] in
theorem convex_vertex_left_of_edge {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (convex : IsWeaklyConvexCCW vertex) (edgeIndex pointIndex : RingIndex extraVertices) :
    0 ≤ orientation
      (vertex edgeIndex) (vertex (nextIndex edgeIndex)) (vertex pointIndex) :=
  convex edgeIndex pointIndex

omit [IsStrictOrderedRing R] in
theorem convex_local_turn_nonneg {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (convex : IsWeaklyConvexCCW vertex) (index : RingIndex extraVertices) :
    0 ≤ orientation
      (vertex index) (vertex (nextIndex index)) (vertex (nextIndex (nextIndex index))) :=
  convex index (nextIndex (nextIndex index))

theorem orderedBoundary_of_convex_ring_crossings {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (leavingIndex enteringIndex : RingIndex extraVertices)
    (leavingCurrentInside : signedDistance plane (vertex leavingIndex) ≤ 0)
    (leavingNextOutside : 0 < signedDistance plane (vertex (nextIndex leavingIndex)))
    (enteringCurrentOutside : 0 < signedDistance plane (vertex enteringIndex))
    (enteringNextInside : signedDistance plane (vertex (nextIndex enteringIndex)) ≤ 0) :
    OrderedBoundary plane
      (boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex)))
      (boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex))) := by
  exact orderedBoundary_of_convex_crossing_edges plane
    (vertex leavingIndex) (vertex (nextIndex leavingIndex))
    (vertex enteringIndex) (vertex (nextIndex enteringIndex))
    leavingCurrentInside leavingNextOutside enteringCurrentOutside enteringNextInside
    (convex leavingIndex enteringIndex)
    (convex leavingIndex (nextIndex enteringIndex))

theorem convex_ring_crossing_seam_nonneg {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (leavingIndex enteringIndex : RingIndex extraVertices)
    (leavingCurrentInside : signedDistance plane (vertex leavingIndex) ≤ 0)
    (leavingNextOutside : 0 < signedDistance plane (vertex (nextIndex leavingIndex)))
    (enteringCurrentOutside : 0 < signedDistance plane (vertex enteringIndex))
    (enteringNextInside : signedDistance plane (vertex (nextIndex enteringIndex)) ≤ 0) :
    0 ≤ orientation (vertex leavingIndex)
        (boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex)))
        (boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex))) ∧
      0 ≤ orientation
        (boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex)))
        (boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)))
        (vertex (nextIndex enteringIndex)) := by
  exact convex_crossing_seam_nonneg plane
    (vertex leavingIndex) (vertex (nextIndex leavingIndex))
    (vertex enteringIndex) (vertex (nextIndex enteringIndex))
    leavingCurrentInside leavingNextOutside enteringCurrentOutside enteringNextInside
    (convex leavingIndex enteringIndex)
    (convex leavingIndex (nextIndex enteringIndex))

/-- Materialize every indexed cyclic edge in the same order used by the point fold. -/
def indexedEdges {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : List (Vec2 R × Vec2 R) :=
  List.ofFn fun index => (vertex index, vertex (nextIndex index))

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem indexedEdges_isChain {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) :
    (indexedEdges vertex).IsChain fun first second => first.2 = second.1 := by
  rw [indexedEdges, List.isChain_ofFn]
  intro index nextInRange
  dsimp only
  apply congrArg vertex
  apply Fin.ext
  simp [nextIndex, Nat.mod_eq_of_lt nextInRange]

def indexedOutputChunks {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    List (List (Vec2 R)) :=
  (indexedEdges vertex).map fun edge => outputPoints plane edge.1 edge.2

theorem indexedOutputChunks_each_allOrderedCCW {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    {chunk : List (Vec2 R)} (member : chunk ∈ indexedOutputChunks plane vertex) :
    AllOrderedCCW chunk := by
  simp only [indexedOutputChunks, List.mem_map] at member
  rcases member with ⟨edge, _, rfl⟩
  exact outputPoints_allOrderedCCW plane edge.1 edge.2

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem mem_indexedEdges_iff {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) (edge : Vec2 R × Vec2 R) :
    edge ∈ indexedEdges vertex ↔
      ∃ index, edge = (vertex index, vertex (nextIndex index)) := by
  rw [indexedEdges, List.mem_ofFn']
  change (∃ index, (vertex index, vertex (nextIndex index)) = edge) ↔ _
  constructor
  · rintro ⟨index, edgeEq⟩
    exact ⟨index, edgeEq.symm⟩
  · rintro ⟨index, edgeEq⟩
    exact ⟨index, edgeEq.symm⟩

omit [IsStrictOrderedRing R] in
theorem indexedEdges_segmentPairCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    {first second : Vec2 R × Vec2 R}
    (firstMember : first ∈ indexedEdges vertex)
    (secondMember : second ∈ indexedEdges vertex) :
    SegmentPairCCW first second := by
  rw [mem_indexedEdges_iff] at firstMember secondMember
  rcases firstMember with ⟨firstIndex, rfl⟩
  rcases secondMember with ⟨secondIndex, rfl⟩
  constructor
  · intro point pointMember
    simp at pointMember
    rcases pointMember with rfl | rfl
    · exact convex firstIndex secondIndex
    · exact convex firstIndex (nextIndex secondIndex)
  · intro point pointMember
    simp at pointMember
    rcases pointMember with rfl | rfl
    · rw [← orientation_cycle
        (vertex firstIndex) (vertex secondIndex) (vertex (nextIndex secondIndex))]
      exact convex secondIndex firstIndex
    · rw [← orientation_cycle
        (vertex (nextIndex firstIndex))
        (vertex secondIndex) (vertex (nextIndex secondIndex))]
      exact convex secondIndex (nextIndex firstIndex)

omit [IsStrictOrderedRing R] in
theorem indexedEdges_pairwise_segmentPairCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex) :
    (indexedEdges vertex).Pairwise SegmentPairCCW := by
  rw [List.pairwise_iff_get]
  intro firstIndex secondIndex _
  exact indexedEdges_segmentPairCCW vertex convex
    (List.get_mem _ _) (List.get_mem _ _)

/-- Materialize vertices in their `Fin` index order. -/
def indexedVertices {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : List (Vec2 R) :=
  List.ofFn vertex

/-- Every three vertices in the materialized linear index order form a weak left turn. -/
def IsLinearlyOrderedCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∀ first second third,
    first.val < second.val → second.val < third.val →
      0 ≤ orientation (vertex first) (vertex second) (vertex third)

omit [IsStrictOrderedRing R] in
theorem linearlyOrdered_iff_indexedVertices_triplewise {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) :
    IsLinearlyOrderedCCW vertex ↔
      (indexedVertices vertex).Triplewise
        (fun first second third => 0 ≤ orientation first second third) := by
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
theorem linearlyOrdered_orientation_nonneg_of_le {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsLinearlyOrderedCCW vertex)
    (first second third : RingIndex extraVertices)
    (firstBefore : first.val ≤ second.val)
    (secondBefore : second.val ≤ third.val) :
    0 ≤ orientation (vertex first) (vertex second) (vertex third) := by
  by_cases firstEqual : first = second
  · subst second
    simp
  by_cases secondEqual : second = third
  · subst third
    simp
  have firstValNe : first.val ≠ second.val := by
    intro equal
    exact firstEqual (Fin.ext equal)
  have secondValNe : second.val ≠ third.val := by
    intro equal
    exact secondEqual (Fin.ext equal)
  exact ordered first second third (by omega) (by omega)

omit [IsStrictOrderedRing R] in
theorem IsLinearlyOrderedCCW.weak {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsLinearlyOrderedCCW vertex) : IsWeaklyConvexCCW vertex := by
  intro edgeIndex pointIndex
  by_cases nextInRange : edgeIndex.val + 1 < extraVertices + 3
  · let next : RingIndex extraVertices := ⟨edgeIndex.val + 1, nextInRange⟩
    have nextEq : nextIndex edgeIndex = next := by
      apply Fin.ext
      simp [nextIndex, next, Nat.mod_eq_of_lt nextInRange]
    rw [nextEq]
    by_cases pointBefore : pointIndex.val ≤ edgeIndex.val
    · rw [orientation_cycle]
      exact linearlyOrdered_orientation_nonneg_of_le ordered
        pointIndex edgeIndex next pointBefore (by simp [next])
    · exact linearlyOrdered_orientation_nonneg_of_le ordered
        edgeIndex next pointIndex (by simp [next]) (by simp [next]; omega)
  · have edgeIsLast : edgeIndex.val + 1 = extraVertices + 3 := by omega
    let zero : RingIndex extraVertices := ⟨0, by omega⟩
    have nextEq : nextIndex edgeIndex = zero := by
      apply Fin.ext
      simp [nextIndex, zero, edgeIsLast]
    rw [nextEq, orientation_cycle, orientation_cycle]
    exact linearlyOrdered_orientation_nonneg_of_le ordered
      zero pointIndex edgeIndex (by simp [zero]) (by omega)

omit [IsStrictOrderedRing R] in
theorem weaklyConvex_triangle_linearlyOrdered
    (vertex : RingIndex 0 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex) :
    IsLinearlyOrderedCCW vertex := by
  intro first second third firstBefore secondBefore
  have secondIsNext : nextIndex first = second := by
    apply Fin.ext
    simp [nextIndex]
    omega
  rw [← secondIsNext]
  exact convex first third

omit [IsStrictOrderedRing R] in
theorem weaklyConvex_ordered_of_adjacent_pair {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (convex : IsWeaklyConvexCCW vertex)
    (first second third : RingIndex extraVertices)
    (adjacent : nextIndex first = second ∨ nextIndex second = third) :
    0 ≤ orientation (vertex first) (vertex second) (vertex third) := by
  rcases adjacent with firstAdjacent | secondAdjacent
  · rw [← firstAdjacent]
    exact convex first third
  · have turn := convex second first
    rw [secondAdjacent] at turn
    rw [← orientation_cycle (vertex first) (vertex second) (vertex third)]
    exact turn

omit [IsStrictOrderedRing R] in
theorem weaklyConvex_ordered_of_cyclic_adjacent_pair {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (convex : IsWeaklyConvexCCW vertex)
    (first second third : RingIndex extraVertices)
    (adjacent : nextIndex first = second ∨
      nextIndex second = third ∨ nextIndex third = first) :
    0 ≤ orientation (vertex first) (vertex second) (vertex third) := by
  rcases adjacent with firstAdjacent | secondAdjacent | thirdAdjacent
  · exact weaklyConvex_ordered_of_adjacent_pair convex first second third
      (Or.inl firstAdjacent)
  · exact weaklyConvex_ordered_of_adjacent_pair convex first second third
      (Or.inr secondAdjacent)
  · have turn := convex third second
    rw [thirdAdjacent] at turn
    rw [orientation_cycle (vertex third) (vertex first) (vertex second)]
    exact turn

omit [IsStrictOrderedRing R] in
theorem weaklyConvex_quadrilateral_linearlyOrdered
    (vertex : RingIndex 1 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex) :
    IsLinearlyOrderedCCW vertex := by
  intro first second third firstBefore secondBefore
  apply weaklyConvex_ordered_of_adjacent_pair convex first second third
  by_cases firstAdjacent : first.val + 1 = second.val
  · left
    apply Fin.ext
    simp [nextIndex, firstAdjacent]
  · right
    have secondAdjacent : second.val + 1 = third.val := by omega
    apply Fin.ext
    simp [nextIndex, secondAdjacent]

omit [IsStrictOrderedRing R] in
theorem weaklyConvex_pentagon_linearlyOrdered
    (vertex : RingIndex 2 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex) :
    IsLinearlyOrderedCCW vertex := by
  intro first second third firstBefore secondBefore
  apply weaklyConvex_ordered_of_cyclic_adjacent_pair convex first second third
  by_cases firstAdjacent : first.val + 1 = second.val
  · left
    apply Fin.ext
    simp [nextIndex, firstAdjacent]
  by_cases secondAdjacent : second.val + 1 = third.val
  · right
    left
    apply Fin.ext
    simp [nextIndex, secondAdjacent]
  · right
    right
    have firstIsZero : first.val = 0 := by omega
    have secondIsTwo : second.val = 2 := by omega
    have thirdIsFour : third.val = 4 := by omega
    apply Fin.ext
    simp [nextIndex, firstIsZero, thirdIsFour]

/-- Two supporting edges around an ear do not by themselves support the shortcut chord. -/
theorem adjacent_support_does_not_imply_chord_support :
    ∃ a b c point : Vec2 Rat,
      0 ≤ orientation a b point ∧
      0 ≤ orientation b c point ∧
      orientation a c point < 0 := by
  refine ⟨
    { x := 0, y := 0 },
    { x := 0, y := -1 },
    { x := 1, y := 0 },
    { x := 1 / 2, y := -1 / 2 }, ?_⟩
  norm_num [orientation]

/-- A CCW triangle traversed twice, represented as a six-vertex indexed ring. -/
def repeatedTriangleHexagonVertex (index : RingIndex 3) : Vec2 Rat :=
  match index.val % 3 with
  | 0 => { x := 0, y := 0 }
  | 1 => { x := 0, y := -1 }
  | _ => { x := 1, y := 0 }

theorem repeatedTriangleHexagon_weaklyConvex :
    IsWeaklyConvexCCW repeatedTriangleHexagonVertex := by
  intro edgeIndex pointIndex
  fin_cases edgeIndex <;> fin_cases pointIndex <;>
    norm_num [repeatedTriangleHexagonVertex, nextIndex, orientation]

theorem repeatedTriangleHexagon_not_linearlyOrdered :
    ¬IsLinearlyOrderedCCW repeatedTriangleHexagonVertex := by
  intro ordered
  have badTurn := ordered
    (⟨0, by omega⟩ : RingIndex 3)
    (⟨2, by omega⟩ : RingIndex 3)
    (⟨4, by omega⟩ : RingIndex 3)
    (by norm_num) (by norm_num)
  norm_num [repeatedTriangleHexagonVertex, orientation] at badTurn

theorem repeatedTriangleHexagon_not_injective :
    ¬Function.Injective repeatedTriangleHexagonVertex := by
  intro injective
  have equalIndices := injective (show
    repeatedTriangleHexagonVertex (⟨0, by omega⟩ : RingIndex 3) =
      repeatedTriangleHexagonVertex (⟨3, by omega⟩ : RingIndex 3) by
        norm_num [repeatedTriangleHexagonVertex])
  norm_num at equalIndices

theorem repeatedTriangleHexagon_not_simple :
    ¬IsSimpleRing repeatedTriangleHexagonVertex := by
  intro simple
  exact repeatedTriangleHexagon_not_injective simple.1

theorem weaklyConvex_hexagon_does_not_imply_linearlyOrdered :
    ∃ vertex : RingIndex 3 → Vec2 Rat,
      IsWeaklyConvexCCW vertex ∧ ¬IsLinearlyOrderedCCW vertex :=
  ⟨repeatedTriangleHexagonVertex,
    repeatedTriangleHexagon_weaklyConvex,
    repeatedTriangleHexagon_not_linearlyOrdered⟩

/-- Explicit global vertex order; supporting half-planes follow from it. -/
def IsVertexOrderedConvexCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  IsLinearlyOrderedCCW vertex

omit [IsStrictOrderedRing R] in
theorem IsVertexOrderedConvexCCW.weak {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsVertexOrderedConvexCCW vertex) : IsWeaklyConvexCCW vertex :=
  IsLinearlyOrderedCCW.weak ordered

omit [IsStrictOrderedRing R] in
theorem IsVertexOrderedConvexCCW.linear {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsVertexOrderedConvexCCW vertex) : IsLinearlyOrderedCCW vertex :=
  ordered

/-- Weak supporting half-planes plus the cyclic traversal order needed by the emitter fold. -/
def IsTraversalConvexCCW {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  IsWeaklyConvexCCW vertex ∧
    (indexedEdges vertex).Triplewise SegmentTripleCCW

omit [IsStrictOrderedRing R] in
theorem indexedEdges_triplewise_of_linearlyOrdered {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex) :
    (indexedEdges vertex).Triplewise SegmentTripleCCW := by
  rw [List.triplewise_iff_getElem]
  intro firstIndex secondIndex thirdIndex firstBefore secondBefore thirdInRange
  simp only [indexedEdges, List.getElem_ofFn]
  have thirdBound : thirdIndex < extraVertices + 3 := by
    simpa [indexedEdges] using thirdInRange
  let first : RingIndex extraVertices := ⟨firstIndex, by omega⟩
  let second : RingIndex extraVertices := ⟨secondIndex, by omega⟩
  let third : RingIndex extraVertices := ⟨thirdIndex, thirdBound⟩
  have firstNextBound : firstIndex + 1 < extraVertices + 3 := by omega
  have secondNextBound : secondIndex + 1 < extraVertices + 3 := by omega
  let firstNext : RingIndex extraVertices := ⟨firstIndex + 1, firstNextBound⟩
  let secondNext : RingIndex extraVertices := ⟨secondIndex + 1, secondNextBound⟩
  have firstNextEq : nextIndex first = firstNext := by
    apply Fin.ext
    simp [first, firstNext, nextIndex, Nat.mod_eq_of_lt firstNextBound]
  have secondNextEq : nextIndex second = secondNext := by
    apply Fin.ext
    simp [second, secondNext, nextIndex, Nat.mod_eq_of_lt secondNextBound]
  rw [firstNextEq, secondNextEq]
  by_cases thirdNextInRange : thirdIndex + 1 < extraVertices + 3
  · let thirdNext : RingIndex extraVertices := ⟨thirdIndex + 1, thirdNextInRange⟩
    have thirdNextEq : nextIndex third = thirdNext := by
      apply Fin.ext
      simp [third, thirdNext, nextIndex, Nat.mod_eq_of_lt thirdNextInRange]
    rw [thirdNextEq]
    change EndpointTriplesCCW
      (vertex first) (vertex firstNext)
      (vertex second) (vertex secondNext)
      (vertex third) (vertex thirdNext)
    intro a aMember b bMember c cMember
    simp at aMember bMember cMember
    rcases aMember with (rfl | rfl) <;>
      rcases bMember with (rfl | rfl) <;>
        rcases cMember with (rfl | rfl) <;>
          apply linearlyOrdered_orientation_nonneg_of_le ordered <;>
            simp [first, firstNext, second, secondNext, third, thirdNext] <;> omega
  · have thirdIsLast : thirdIndex + 1 = extraVertices + 3 := by omega
    let zero : RingIndex extraVertices := ⟨0, by omega⟩
    have thirdNextEq : nextIndex third = zero := by
      apply Fin.ext
      simp [third, zero, nextIndex, thirdIsLast]
    rw [thirdNextEq]
    change EndpointTriplesCCW
      (vertex first) (vertex firstNext)
      (vertex second) (vertex secondNext)
      (vertex third) (vertex zero)
    intro a aMember b bMember c cMember
    simp at aMember bMember cMember
    rcases aMember with (rfl | rfl) <;>
      rcases bMember with (rfl | rfl) <;>
        rcases cMember with (rfl | rfl)
    all_goals
      first
      | apply linearlyOrdered_orientation_nonneg_of_le ordered
        all_goals (simp [first, firstNext, second, secondNext, third] ; omega)
      | rw [orientation_cycle]
        apply linearlyOrdered_orientation_nonneg_of_le ordered
        all_goals simp [zero, first, firstNext, second, secondNext]
        all_goals omega

omit [IsStrictOrderedRing R] in
theorem IsVertexOrderedConvexCCW.traversal {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsVertexOrderedConvexCCW vertex) :
    IsTraversalConvexCCW vertex := by
  exact ⟨ordered.weak, indexedEdges_triplewise_of_linearlyOrdered vertex ordered.linear⟩

omit [IsStrictOrderedRing R] in
theorem IsTraversalConvexCCW.weak {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsTraversalConvexCCW vertex) : IsWeaklyConvexCCW vertex :=
  ordered.1

omit [IsStrictOrderedRing R] in
theorem IsTraversalConvexCCW.edgeTriples {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsTraversalConvexCCW vertex) :
    (indexedEdges vertex).Triplewise SegmentTripleCCW :=
  ordered.2

def clipIndexedRing {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) : List (Vec2 R) :=
  closedClipOutputPoints plane (indexedEdges vertex)

omit [IsStrictOrderedRing R] in
theorem clipIndexedRing_closureNormalized {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    CyclicClosure.ClosureNormalized (clipIndexedRing plane vertex) := by
  exact closedClipOutputPoints_closureNormalized plane (indexedEdges vertex)

omit [IsStrictOrderedRing R] in
theorem clipIndexedRing_isChain {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    (clipIndexedRing plane vertex).IsChain (· ≠ ·) := by
  exact closedClipOutputPoints_isChain plane (indexedEdges vertex)

theorem clipIndexedRing_nonpos {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    {point : Vec2 R} (emitted : point ∈ clipIndexedRing plane vertex) :
    signedDistance plane point ≤ 0 := by
  exact closedClipOutputPoints_nonpos plane emitted

theorem clipIndexedRing_on_input_edge {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    {point : Vec2 R} (emitted : point ∈ clipIndexedRing plane vertex) :
    ∃ index, OnClosedSegment (vertex index) (vertex (nextIndex index)) point := by
  rcases closedClipOutputPoints_on_input_edge plane emitted with ⟨edge, edgeMember, onEdge⟩
  rw [mem_indexedEdges_iff] at edgeMember
  rcases edgeMember with ⟨index, rfl⟩
  exact ⟨index, onEdge⟩

theorem clipIndexedRing_adjacentTurnsNonnegative_of_crossCompatible
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (cross : CrossCompatibleCCWChunks (indexedOutputChunks plane vertex)) :
    AdjacentTurnsNonnegative (clipIndexedRing plane vertex) := by
  apply closedClipOutputPoints_adjacentTurnsNonnegative_of_orderedChunks
  exact AllOrderedCCWChunks.of_each_of_cross
    (fun chunk member => indexedOutputChunks_each_allOrderedCCW plane vertex member)
    cross

theorem clipIndexedRing_adjacentTurnsNonnegative_of_edgeTriples
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (edgeTriples : (indexedEdges vertex).Triplewise SegmentTripleCCW) :
    AdjacentTurnsNonnegative (clipIndexedRing plane vertex) := by
  apply closedClipOutputPoints_adjacentTurnsNonnegative
  simpa [List.flatMap] using outputPointFlatMap_allOrderedCCW plane
    (indexedEdges_pairwise_segmentPairCCW vertex convex) edgeTriples

theorem clipIndexedRing_adjacentTurnsNonnegative
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsTraversalConvexCCW vertex) :
    AdjacentTurnsNonnegative (clipIndexedRing plane vertex) := by
  exact clipIndexedRing_adjacentTurnsNonnegative_of_edgeTriples
    plane vertex ordered.weak ordered.edgeTriples

theorem clipIndexedRing_cyclicTurnsNonnegative_of_edgeTriples
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (edgeTriples : (indexedEdges vertex).Triplewise SegmentTripleCCW) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  apply closedClipOutputPoints_cyclicTurnsNonnegative
  simpa [List.flatMap] using outputPointFlatMap_allOrderedCCW plane
    (indexedEdges_pairwise_segmentPairCCW vertex convex) edgeTriples

theorem clipIndexedRing_cyclicTurnsNonnegative
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsTraversalConvexCCW vertex) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  exact clipIndexedRing_cyclicTurnsNonnegative_of_edgeTriples
    plane vertex ordered.weak ordered.edgeTriples

theorem clipIndexedRing_cyclicTurnsNonnegative_of_vertex_ordered
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsVertexOrderedConvexCCW vertex) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  exact clipIndexedRing_cyclicTurnsNonnegative plane vertex ordered.traversal

theorem clipIndexedRing_cyclicTurnsNonnegative_of_crossing_boundary
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsTraversalConvexCCW vertex)
    (leavingIndex enteringIndex : RingIndex extraVertices)
    (leavingCurrentInside : signedDistance plane (vertex leavingIndex) ≤ 0)
    (leavingNextOutside : 0 < signedDistance plane (vertex (nextIndex leavingIndex)))
    (enteringCurrentOutside : 0 < signedDistance plane (vertex enteringIndex))
    (enteringNextInside : signedDistance plane (vertex (nextIndex enteringIndex)) ≤ 0)
    (outputPrefix : List.IsPrefix
      [boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)),
        vertex (nextIndex enteringIndex)]
      (clipIndexedRing plane vertex))
    (outputSuffix : List.IsSuffix
      [vertex leavingIndex,
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))]
      (clipIndexedRing plane vertex)) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  apply cyclicAdjacentTriples_of_open_and_boundary
    (clipIndexedRing_adjacentTurnsNonnegative plane vertex ordered)
    outputPrefix outputSuffix
  exact convex_ring_crossing_seam_nonneg plane vertex ordered.weak
    leavingIndex enteringIndex
    leavingCurrentInside leavingNextOutside enteringCurrentOutside enteringNextInside

theorem clipIndexedRing_cyclicTurnsNonnegative_of_crossing_flatten
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsTraversalConvexCCW vertex)
    (leavingIndex enteringIndex : RingIndex extraVertices)
    (leavingCurrentInside : signedDistance plane (vertex leavingIndex) ≤ 0)
    (leavingNextOutside : 0 < signedDistance plane (vertex (nextIndex leavingIndex)))
    (enteringCurrentOutside : 0 < signedDistance plane (vertex enteringIndex))
    (enteringNextInside : signedDistance plane (vertex (nextIndex enteringIndex)) ≤ 0)
    (afterPrefix beforeSuffix : List (Vec2 R))
    (flattenedPrefix :
      ((indexedEdges vertex).map fun edge =>
        outputPoints plane edge.1 edge.2).flatten =
          boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ::
          vertex (nextIndex enteringIndex) :: afterPrefix)
    (flattenedSuffix :
      ((indexedEdges vertex).map fun edge =>
        outputPoints plane edge.1 edge.2).flatten =
          beforeSuffix ++
            [vertex leavingIndex,
              boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))])
    (entryPairDistinct :
      boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ≠
        vertex (nextIndex enteringIndex))
    (exitPairDistinct :
      vertex leavingIndex ≠
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex)))
    (boundaryEndpointsDistinct :
      boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ≠
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  have boundaryPairs := closedClipOutputPoints_boundary_pairs
    plane (indexedEdges vertex)
    (boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)))
    (vertex (nextIndex enteringIndex))
    (vertex leavingIndex)
    (boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex)))
    afterPrefix beforeSuffix
    flattenedPrefix flattenedSuffix entryPairDistinct exitPairDistinct
    boundaryEndpointsDistinct
  apply clipIndexedRing_cyclicTurnsNonnegative_of_crossing_boundary
    plane vertex ordered leavingIndex enteringIndex
    leavingCurrentInside leavingNextOutside enteringCurrentOutside enteringNextInside
  · simpa [clipIndexedRing] using boundaryPairs.1
  · simpa [clipIndexedRing] using boundaryPairs.2

theorem clipIndexedRing_cyclicTurnsNonnegative_of_strict_crossing_flatten
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsTraversalConvexCCW vertex)
    (leavingIndex enteringIndex : RingIndex extraVertices)
    (leavingCurrentInside : signedDistance plane (vertex leavingIndex) < 0)
    (leavingNextOutside : 0 < signedDistance plane (vertex (nextIndex leavingIndex)))
    (enteringCurrentOutside : 0 < signedDistance plane (vertex enteringIndex))
    (enteringNextInside : signedDistance plane (vertex (nextIndex enteringIndex)) < 0)
    (afterPrefix beforeSuffix : List (Vec2 R))
    (flattenedPrefix :
      ((indexedEdges vertex).map fun edge =>
        outputPoints plane edge.1 edge.2).flatten =
          boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ::
          vertex (nextIndex enteringIndex) :: afterPrefix)
    (flattenedSuffix :
      ((indexedEdges vertex).map fun edge =>
        outputPoints plane edge.1 edge.2).flatten =
          beforeSuffix ++
            [vertex leavingIndex,
              boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))])
    (boundaryEndpointsDistinct :
      boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ≠
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  have leavingDistancesDistinct :
      signedDistance plane (vertex leavingIndex) ≠
        signedDistance plane (vertex (nextIndex leavingIndex)) := by
    linarith
  have enteringDistancesDistinct :
      signedDistance plane (vertex enteringIndex) ≠
        signedDistance plane (vertex (nextIndex enteringIndex)) := by
    linarith
  have entryPairDistinct :
      boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ≠
        vertex (nextIndex enteringIndex) := by
    intro equal
    have nextBoundary :
        signedDistance plane (vertex (nextIndex enteringIndex)) = 0 := by
      rw [← equal]
      exact signedDistance_boundaryPoint plane _ _ enteringDistancesDistinct
    linarith
  have exitPairDistinct :
      vertex leavingIndex ≠
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex)) := by
    intro equal
    have currentBoundary : signedDistance plane (vertex leavingIndex) = 0 := by
      rw [equal]
      exact signedDistance_boundaryPoint plane _ _ leavingDistancesDistinct
    linarith
  exact clipIndexedRing_cyclicTurnsNonnegative_of_crossing_flatten
    plane vertex ordered leavingIndex enteringIndex
    (le_of_lt leavingCurrentInside) leavingNextOutside enteringCurrentOutside
    (le_of_lt enteringNextInside) afterPrefix beforeSuffix
    flattenedPrefix flattenedSuffix entryPairDistinct exitPairDistinct
    boundaryEndpointsDistinct

theorem clipIndexedRing_cyclicTurnsNonnegative_of_strict_crossing_edge_order
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsTraversalConvexCCW vertex)
    (leavingIndex enteringIndex : RingIndex extraVertices)
    (following : Vec2 R)
    (remainingEdges restEdges beforeLeaving trailingEdges : List (Vec2 R × Vec2 R))
    (indexedStarts :
      indexedEdges vertex =
        (vertex enteringIndex, vertex (nextIndex enteringIndex)) :: remainingEdges)
    (remainingStarts :
      remainingEdges =
        (vertex (nextIndex enteringIndex), following) :: restEdges)
    (remainingContainsLeaving :
      remainingEdges = beforeLeaving ++
        ((vertex leavingIndex, vertex (nextIndex leavingIndex)) :: trailingEdges))
    (trailingOutside : ∀ edge ∈ trailingEdges,
      0 < signedDistance plane edge.1 ∧ 0 < signedDistance plane edge.2)
    (leavingCurrentInside : signedDistance plane (vertex leavingIndex) < 0)
    (leavingNextOutside : 0 < signedDistance plane (vertex (nextIndex leavingIndex)))
    (enteringCurrentOutside : 0 < signedDistance plane (vertex enteringIndex))
    (enteringNextInside : signedDistance plane (vertex (nextIndex enteringIndex)) < 0)
    (boundaryEndpointsDistinct :
      boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)) ≠
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  have trailingEmpty : ∀ edge ∈ trailingEdges,
      outputPoints plane edge.1 edge.2 = [] := by
    intro edge member
    exact outputPoints_eq_nil_of_outside plane edge.1 edge.2
      (trailingOutside edge member).1 (trailingOutside edge member).2
  have flattenedPairs := outputPointFlatten_boundary_pairs_of_strict_crossings
    plane
    (vertex enteringIndex) (vertex (nextIndex enteringIndex)) following
    (vertex leavingIndex) (vertex (nextIndex leavingIndex))
    remainingEdges restEdges beforeLeaving trailingEdges
    remainingStarts remainingContainsLeaving trailingEmpty
    enteringCurrentOutside enteringNextInside
    leavingCurrentInside leavingNextOutside
  have flattenedPrefix : List.IsPrefix
      [boundaryPoint plane (vertex enteringIndex) (vertex (nextIndex enteringIndex)),
        vertex (nextIndex enteringIndex)]
      ((indexedEdges vertex).map fun edge =>
        outputPoints plane edge.1 edge.2).flatten := by
    rw [indexedStarts]
    exact flattenedPairs.1
  have flattenedSuffix : List.IsSuffix
      [vertex leavingIndex,
        boundaryPoint plane (vertex leavingIndex) (vertex (nextIndex leavingIndex))]
      ((indexedEdges vertex).map fun edge =>
        outputPoints plane edge.1 edge.2).flatten := by
    rw [indexedStarts]
    exact flattenedPairs.2
  rw [List.prefix_iff_exists_eq_append] at flattenedPrefix
  rcases flattenedPrefix with ⟨afterPrefix, prefixEquality⟩
  rw [List.suffix_iff_exists_eq_append] at flattenedSuffix
  rcases flattenedSuffix with ⟨beforeSuffix, suffixEquality⟩
  exact clipIndexedRing_cyclicTurnsNonnegative_of_strict_crossing_flatten
    plane vertex ordered leavingIndex enteringIndex
    leavingCurrentInside leavingNextOutside enteringCurrentOutside enteringNextInside
    afterPrefix beforeSuffix prefixEquality suffixEquality boundaryEndpointsDistinct

end Sprawlens.ConvexClipContract
