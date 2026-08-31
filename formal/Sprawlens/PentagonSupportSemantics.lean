import Sprawlens.QuadrilateralSupportSemantics

namespace Sprawlens.PentagonSupportSemantics

open Set
open CanonicalClip
open ConvexClipContract
open ExactGeometry
open SimpleRing
open StrictConvexContract
open TriangleSupportSemantics

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A strict ordered pentagon has adequate support-half-plane semantics.
The proof selects one of the three triangles in the fan rooted at vertex zero
using the two internal diagonals `0 → 2` and `0 → 3`. -/
theorem strictPentagon_supportSemanticsAdequate
    (vertex : RingIndex 2 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    SupportSemanticsAdequate vertex := by
  let first : RingIndex 2 := ⟨0, by omega⟩
  let second : RingIndex 2 := ⟨1, by omega⟩
  let third : RingIndex 2 := ⟨2, by omega⟩
  let fourth : RingIndex 2 := ⟨3, by omega⟩
  let fifth : RingIndex 2 := ⟨4, by omega⟩
  let firstTriangle := orderedTripleVertex vertex first second third
  let middleTriangle := orderedTripleVertex vertex first third fourth
  let lastTriangle := orderedTripleVertex vertex first fourth fifth
  have firstAdequate : SupportSemanticsAdequate firstTriangle := by
    exact orderedTriple_supportSemanticsAdequate vertex ordered
      first second third (by simp [first, second]) (by simp [second, third])
  have middleAdequate : SupportSemanticsAdequate middleTriangle := by
    exact orderedTriple_supportSemanticsAdequate vertex ordered
      first third fourth (by simp [first, third]) (by simp [third, fourth])
  have lastAdequate : SupportSemanticsAdequate lastTriangle := by
    exact orderedTriple_supportSemanticsAdequate vertex ordered
      first fourth fifth (by simp [first, fourth]) (by simp [fourth, fifth])
  apply Set.Subset.antisymm
  · intro point supportMember
    by_cases firstDiagonalSide :
        0 ≤ orientation (vertex first) (vertex third) point
    · by_cases secondDiagonalSide :
          0 ≤ orientation (vertex first) (vertex fourth) point
      · have pointInTriangleSupport :
            point ∈ indexedPolygonRegion lastTriangle := by
          intro edgeIndex
          fin_cases edgeIndex
          · simpa [lastTriangle, orderedTripleVertex, nextIndex] using
              secondDiagonalSide
          · simpa [lastTriangle, orderedTripleVertex, fourth, fifth, nextIndex] using
              supportMember fourth
          · simpa [lastTriangle, orderedTripleVertex, first, fifth, nextIndex] using
              supportMember fifth
        have pointInTriangleHull :
            point ∈ indexedVertexConvexRegion lastTriangle := by
          rw [← lastAdequate]
          exact pointInTriangleSupport
        exact orderedTriple_convexRegion_subset
          vertex first fourth fifth pointInTriangleHull
      · have secondDiagonalNegative :
            orientation (vertex first) (vertex fourth) point < 0 :=
          lt_of_not_ge secondDiagonalSide
        have reverseSecondDiagonal :
            0 ≤ orientation (vertex fourth) (vertex first) point := by
          rw [orientation_swap_start_middle]
          exact neg_nonneg.mpr (le_of_lt secondDiagonalNegative)
        have pointInTriangleSupport :
            point ∈ indexedPolygonRegion middleTriangle := by
          intro edgeIndex
          fin_cases edgeIndex
          · simpa [middleTriangle, orderedTripleVertex, nextIndex] using
              firstDiagonalSide
          · simpa [middleTriangle, orderedTripleVertex, third, fourth, nextIndex] using
              supportMember third
          · simpa [middleTriangle, orderedTripleVertex, nextIndex] using
              reverseSecondDiagonal
        have pointInTriangleHull :
            point ∈ indexedVertexConvexRegion middleTriangle := by
          rw [← middleAdequate]
          exact pointInTriangleSupport
        exact orderedTriple_convexRegion_subset
          vertex first third fourth pointInTriangleHull
    · have firstDiagonalNegative :
          orientation (vertex first) (vertex third) point < 0 :=
        lt_of_not_ge firstDiagonalSide
      have reverseFirstDiagonal :
          0 ≤ orientation (vertex third) (vertex first) point := by
        rw [orientation_swap_start_middle]
        exact neg_nonneg.mpr (le_of_lt firstDiagonalNegative)
      have pointInTriangleSupport :
          point ∈ indexedPolygonRegion firstTriangle := by
        intro edgeIndex
        fin_cases edgeIndex
        · simpa [firstTriangle, orderedTripleVertex, first, second, nextIndex] using
            supportMember first
        · simpa [firstTriangle, orderedTripleVertex, second, third, nextIndex] using
            supportMember second
        · simpa [firstTriangle, orderedTripleVertex, nextIndex] using
            reverseFirstDiagonal
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

end Sprawlens.PentagonSupportSemantics
