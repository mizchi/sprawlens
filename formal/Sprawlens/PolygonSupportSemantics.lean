import Sprawlens.TriangleSupportSemantics

namespace Sprawlens.PolygonSupportSemantics

open Set
open CanonicalClip
open ConvexClipContract
open ExactGeometry
open SimpleRing
open StrictConvexContract
open TriangleSupportSemantics

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Remove the last vertex while preserving the indices of every earlier
vertex. -/
def prefixVertex {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (index : RingIndex extraVertices) : Vec2 R :=
  vertex ⟨index.val, by omega⟩

omit [IsStrictOrderedRing R] in
/-- Strict global order is inherited by the prefix obtained by removing the
last vertex. -/
theorem prefixVertex_strict {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    IsStrictVertexOrderedConvexCCW (prefixVertex vertex) := by
  intro first second third firstBefore secondBefore
  exact ordered.strict
    ⟨first.val, by omega⟩ ⟨second.val, by omega⟩ ⟨third.val, by omega⟩
    firstBefore secondBefore

/-- For every polygon with at least three vertices, strict global CCW vertex
order is sufficient for equality between edge-support and vertex-convex-hull
semantics. The induction peels off the last fan triangle. -/
theorem strictPolygon_supportSemanticsAdequate {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    SupportSemanticsAdequate vertex := by
  induction extraVertices with
  | zero =>
      exact strictTriangle_supportSemanticsAdequate vertex ordered
  | succ remaining inductionHypothesis =>
      let first : RingIndex (remaining + 1) := ⟨0, by omega⟩
      let penultimate : RingIndex (remaining + 1) := ⟨remaining + 2, by omega⟩
      let last : RingIndex (remaining + 1) := ⟨remaining + 3, by omega⟩
      let reducedVertex : RingIndex remaining → Vec2 R := prefixVertex vertex
      let lastTriangle := orderedTripleVertex vertex first penultimate last
      have reducedOrdered :
          IsStrictVertexOrderedConvexCCW reducedVertex := by
        exact prefixVertex_strict vertex ordered
      have reducedAdequate : SupportSemanticsAdequate reducedVertex := by
        exact inductionHypothesis reducedVertex reducedOrdered
      have lastTriangleAdequate : SupportSemanticsAdequate lastTriangle := by
        exact orderedTriple_supportSemanticsAdequate vertex ordered
          first penultimate last
          (by simp [first, penultimate]) (by simp [penultimate, last])
      apply Set.Subset.antisymm
      · intro point supportMember
        by_cases diagonalSide :
            0 ≤ orientation (vertex first) (vertex penultimate) point
        · have pointInTriangleSupport :
              point ∈ indexedPolygonRegion lastTriangle := by
            intro edgeIndex
            fin_cases edgeIndex
            · simpa [lastTriangle, orderedTripleVertex, nextIndex] using
                diagonalSide
            · simpa [lastTriangle, orderedTripleVertex, penultimate, last,
                nextIndex] using supportMember penultimate
            · simpa [lastTriangle, orderedTripleVertex, first, last,
                nextIndex] using supportMember last
          have pointInTriangleHull :
              point ∈ indexedVertexConvexRegion lastTriangle := by
            rw [← lastTriangleAdequate]
            exact pointInTriangleSupport
          exact orderedTriple_convexRegion_subset
            vertex first penultimate last pointInTriangleHull
        · have diagonalNegative :
              orientation (vertex first) (vertex penultimate) point < 0 :=
            lt_of_not_ge diagonalSide
          have reverseDiagonal :
              0 ≤ orientation (vertex penultimate) (vertex first) point := by
            rw [orientation_swap_start_middle]
            exact neg_nonneg.mpr (le_of_lt diagonalNegative)
          have pointInReducedSupport :
              point ∈ indexedPolygonRegion reducedVertex := by
            intro edgeIndex
            by_cases edgeIsLast : edgeIndex.val = remaining + 2
            · have edgeIndexEq :
                  edgeIndex = (⟨remaining + 2, by omega⟩ : RingIndex remaining) :=
                Fin.ext edgeIsLast
              rw [edgeIndexEq]
              simpa [reducedVertex, prefixVertex, first, penultimate,
                nextIndex] using reverseDiagonal
            · have edgeBeforeLast : edgeIndex.val < remaining + 2 := by
                omega
              have reducedNextNoWrap :
                  (edgeIndex.val + 1) % (remaining + 3) =
                    edgeIndex.val + 1 :=
                Nat.mod_eq_of_lt (by omega)
              have sourceNextNoWrap :
                  (edgeIndex.val + 1) % (remaining + 1 + 3) =
                    edgeIndex.val + 1 :=
                Nat.mod_eq_of_lt (by omega)
              simpa [reducedVertex, prefixVertex, nextIndex,
                reducedNextNoWrap, sourceNextNoWrap] using
                supportMember
                  (⟨edgeIndex.val, by omega⟩ : RingIndex (remaining + 1))
          have pointInReducedHull :
              point ∈ indexedVertexConvexRegion reducedVertex := by
            rw [← reducedAdequate]
            exact pointInReducedSupport
          apply convexHull_mono _ pointInReducedHull
          rintro sourcePoint ⟨index, rfl⟩
          exact Set.mem_range_self
            (⟨index.val, by omega⟩ : RingIndex (remaining + 1))
      · apply convexHull_min
        · rintro point ⟨index, rfl⟩
          intro edgeIndex
          exact ordered.weak edgeIndex index
        · exact indexedPolygonRegion_convex vertex

end Sprawlens.PolygonSupportSemantics
