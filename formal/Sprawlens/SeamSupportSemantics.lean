import Sprawlens.FanBetweenness

namespace Sprawlens.SeamSupportSemantics

open CanonicalClip
open ConvexClipContract
open ExactGeometry
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
/-- Changing the cyclic materialization seam preserves the vertex range. -/
theorem range_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    Set.range (rotateVertex start vertex) = Set.range vertex := by
  ext point
  rw [← List.mem_ofFn' (rotateVertex start vertex) point]
  rw [← List.mem_ofFn' vertex point]
  change point ∈ indexedVertices (rotateVertex start vertex) ↔
    point ∈ indexedVertices vertex
  rw [indexedVertices_rotateVertex, List.mem_rotate]

omit [IsStrictOrderedRing R] in
/-- Universal support constraints can be read from the materialized edge list. -/
theorem mem_indexedPolygonRegion_iff_indexedEdges
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) (point : Vec2 R) :
    point ∈ indexedPolygonRegion vertex ↔
      ∀ edge ∈ indexedEdges vertex,
        0 ≤ orientation edge.1 edge.2 point := by
  constructor
  · intro member edge edgeMember
    rw [indexedEdges, List.mem_ofFn'] at edgeMember
    rcases edgeMember with ⟨index, rfl⟩
    exact member index
  · intro edgesMember index
    exact edgesMember _ (by
      rw [indexedEdges, List.mem_ofFn']
      exact Set.mem_range_self index)

omit [IsStrictOrderedRing R] in
/-- Changing the seam preserves the edge-support region exactly. -/
theorem indexedPolygonRegion_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    indexedPolygonRegion (rotateVertex start vertex) =
      indexedPolygonRegion vertex := by
  ext point
  rw [mem_indexedPolygonRegion_iff_indexedEdges]
  rw [mem_indexedPolygonRegion_iff_indexedEdges]
  rw [indexedEdges_rotateVertex]
  simp only [List.mem_rotate]

/-- Changing the seam preserves the vertex-convex region exactly. -/
theorem indexedVertexConvexRegion_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    indexedVertexConvexRegion (rotateVertex start vertex) =
      indexedVertexConvexRegion vertex := by
  unfold indexedVertexConvexRegion
  rw [range_rotateVertex]

/-- Support-semantics adequacy is independent of the chosen seam. -/
theorem supportSemanticsAdequate_rotateVertex_iff {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    SupportSemanticsAdequate (rotateVertex start vertex) ↔
      SupportSemanticsAdequate vertex := by
  unfold SupportSemanticsAdequate
  rw [indexedPolygonRegion_rotateVertex]
  rw [indexedVertexConvexRegion_rotateVertex]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
/-- Vertex injectivity is independent of the chosen seam. -/
theorem injective_rotateVertex {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R)
    (injective : Function.Injective vertex) :
    Function.Injective (rotateVertex start vertex) := by
  rw [← List.nodup_ofFn]
  change (indexedVertices (rotateVertex start vertex)).Nodup
  rw [indexedVertices_rotateVertex, List.nodup_rotate]
  exact List.nodup_ofFn.mpr injective

/-- There is a cyclic seam whose first materialized triangle has positive
orientation. This is the exact seam-selection certificate consumed below. -/
def HasPositiveSeam {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∃ start : RingIndex extraVertices,
    0 < orientation
      (rotateVertex start vertex ⟨0, by omega⟩)
      (rotateVertex start vertex ⟨1, by omega⟩)
      (rotateVertex start vertex ⟨2, by omega⟩)

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem rotateVertex_zero {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    rotateVertex start vertex ⟨0, by omega⟩ = vertex start := by
  apply congrArg vertex
  apply Fin.ext
  simp [CyclicBinaryBlocks.rotateIndex]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem rotateVertex_one {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    rotateVertex start vertex ⟨1, by omega⟩ = vertex (nextIndex start) := by
  apply congrArg vertex
  apply Fin.ext
  simp [CyclicBinaryBlocks.rotateIndex, nextIndex]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem rotateVertex_two {extraVertices : Nat}
    (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    rotateVertex start vertex ⟨2, by omega⟩ =
      vertex (nextIndex (nextIndex start)) := by
  have oneIsNext :
      (⟨1, by omega⟩ : RingIndex extraVertices) =
        nextIndex (⟨0, by omega⟩ : RingIndex extraVertices) := by
    apply Fin.ext
    simp [nextIndex]
  have twoIsNext :
      (⟨2, by omega⟩ : RingIndex extraVertices) =
        nextIndex (⟨1, by omega⟩ : RingIndex extraVertices) := by
    apply Fin.ext
    change 2 = (1 + 1) % (extraVertices + 3)
    rw [Nat.mod_eq_of_lt (by omega)]
  change vertex (CyclicBinaryBlocks.rotateIndex (by omega) start ⟨2, by omega⟩) = _
  rw [twoIsNext, rotateIndex_nextIndex]
  rw [oneIsNext, rotateIndex_nextIndex]
  rw [show CyclicBinaryBlocks.rotateIndex (by omega) start
      (⟨0, by omega⟩ : RingIndex extraVertices) = start by
    apply Fin.ext
    simp [CyclicBinaryBlocks.rotateIndex]]

/-- Seam-independent geometric form: some three cyclically consecutive
vertices make a strict left turn. -/
def HasPositiveCyclicTurn {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∃ start : RingIndex extraVertices,
    0 < orientation (vertex start) (vertex (nextIndex start))
      (vertex (nextIndex (nextIndex start)))

omit [IsStrictOrderedRing R] in
/-- A positive cyclic turn is exactly a positive materialization seam. -/
theorem hasPositiveSeam_iff_hasPositiveCyclicTurn {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) :
    HasPositiveSeam vertex ↔ HasPositiveCyclicTurn vertex := by
  constructor <;> rintro ⟨start, positive⟩ <;> refine ⟨start, ?_⟩
  · rw [rotateVertex_zero, rotateVertex_one, rotateVertex_two] at positive
    exact positive
  · rw [rotateVertex_zero, rotateVertex_one, rotateVertex_two]
    exact positive

/-- Weak global order, injectivity, and a positive cyclic seam imply exact
support semantics without fixing the original materialization seam. -/
theorem orderedInjectivePositiveSeam_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (positiveSeam : HasPositiveSeam vertex) :
    SupportSemanticsAdequate vertex := by
  rcases positiveSeam with ⟨start, initialPositive⟩
  have rotatedAdequate :
      SupportSemanticsAdequate (rotateVertex start vertex) := by
    exact FanBetweenness.orderedInjectiveInitial_supportSemanticsAdequate
      (rotateVertex start vertex)
      (linearlyOrdered_rotateVertex ordered start)
      (injective_rotateVertex start vertex injective)
      initialPositive
  exact (supportSemanticsAdequate_rotateVertex_iff start vertex).mp
    rotatedAdequate

/-- Topological simplicity can again supply the injectivity premise. -/
theorem orderedSimplePositiveSeam_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (simple : IsSimpleRing vertex)
    (positiveSeam : HasPositiveSeam vertex) :
    SupportSemanticsAdequate vertex := by
  exact orderedInjectivePositiveSeam_supportSemanticsAdequate
    vertex ordered (simpleRing_vertices_injective simple) positiveSeam

/-- Operational seam-independent statement using a positive cyclic turn. -/
theorem orderedSimplePositiveTurn_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (simple : IsSimpleRing vertex)
    (positiveTurn : HasPositiveCyclicTurn vertex) :
    SupportSemanticsAdequate vertex := by
  exact orderedSimplePositiveSeam_supportSemanticsAdequate vertex ordered simple
    ((hasPositiveSeam_iff_hasPositiveCyclicTurn vertex).mpr positiveTurn)

end Sprawlens.SeamSupportSemantics
