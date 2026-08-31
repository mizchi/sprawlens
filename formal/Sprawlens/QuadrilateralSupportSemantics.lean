import Sprawlens.TriangleSupportSemantics

namespace Sprawlens.QuadrilateralSupportSemantics

open Set
open CanonicalClip
open ConvexClipContract
open ExactGeometry
open SimpleRing
open StrictConvexContract
open TriangleSupportSemantics

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A strict ordered quadrilateral has adequate support-half-plane semantics.
The proof splits it along diagonal `0 → 2` and chooses one of two already
verified strict triangles according to the query point's side of the diagonal. -/
theorem strictQuadrilateral_supportSemanticsAdequate
    (vertex : RingIndex 1 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    SupportSemanticsAdequate vertex := by
  let first : RingIndex 1 := ⟨0, by omega⟩
  let second : RingIndex 1 := ⟨1, by omega⟩
  let third : RingIndex 1 := ⟨2, by omega⟩
  let fourth : RingIndex 1 := ⟨3, by omega⟩
  let firstTriangle := orderedTripleVertex vertex first second third
  let secondTriangle := orderedTripleVertex vertex first third fourth
  have firstAdequate : SupportSemanticsAdequate firstTriangle := by
    exact orderedTriple_supportSemanticsAdequate vertex ordered
      first second third (by simp [first, second]) (by simp [second, third])
  have secondAdequate : SupportSemanticsAdequate secondTriangle := by
    exact orderedTriple_supportSemanticsAdequate vertex ordered
      first third fourth (by simp [first, third]) (by simp [third, fourth])
  apply Set.Subset.antisymm
  · intro point supportMember
    by_cases diagonalSide :
        0 ≤ orientation (vertex first) (vertex third) point
    · have pointInTriangleSupport :
          point ∈ indexedPolygonRegion secondTriangle := by
        intro edgeIndex
        fin_cases edgeIndex
        · simpa [secondTriangle, orderedTripleVertex, nextIndex] using diagonalSide
        · simpa [secondTriangle, orderedTripleVertex, third, fourth, nextIndex] using
            supportMember third
        · simpa [secondTriangle, orderedTripleVertex, first, fourth, nextIndex] using
            supportMember fourth
      have pointInTriangleHull :
          point ∈ indexedVertexConvexRegion secondTriangle := by
        rw [← secondAdequate]
        exact pointInTriangleSupport
      exact orderedTriple_convexRegion_subset
        vertex first third fourth pointInTriangleHull
    · have diagonalNegative :
          orientation (vertex first) (vertex third) point < 0 :=
        lt_of_not_ge diagonalSide
      have reverseDiagonal :
          0 ≤ orientation (vertex third) (vertex first) point := by
        rw [orientation_swap_start_middle]
        exact neg_nonneg.mpr (le_of_lt diagonalNegative)
      have pointInTriangleSupport :
          point ∈ indexedPolygonRegion firstTriangle := by
        intro edgeIndex
        fin_cases edgeIndex
        · simpa [firstTriangle, orderedTripleVertex, first, second, nextIndex] using
            supportMember first
        · simpa [firstTriangle, orderedTripleVertex, second, third, nextIndex] using
            supportMember second
        · simpa [firstTriangle, orderedTripleVertex, nextIndex] using reverseDiagonal
      have pointInTriangleHull :
          point ∈ indexedVertexConvexRegion firstTriangle := by
        rw [← firstAdequate]
        exact pointInTriangleSupport
      exact orderedTriple_convexRegion_subset
        vertex first second third pointInTriangleHull
  · apply convexHull_min
    · rintro point ⟨index, rfl⟩
      intro edgeIndex
      exact ordered.weak edgeIndex index
    · exact indexedPolygonRegion_convex vertex

end Sprawlens.QuadrilateralSupportSemantics
