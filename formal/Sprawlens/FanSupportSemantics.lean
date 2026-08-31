import Sprawlens.PolygonSupportSemantics

namespace Sprawlens.FanSupportSemantics

open Set
open CanonicalClip
open ConvexClipContract
open ExactGeometry
open PolygonSupportSemantics
open SimpleRing
open StrictConvexContract
open TriangleSupportSemantics

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A recursively checkable certificate that every triangle in the fan rooted
at vertex zero has positive orientation. Unlike global strict order, this
allows collinear triples that are not fan cells. -/
def HasPositiveFan : {extraVertices : Nat} →
    (RingIndex extraVertices → Vec2 R) → Prop
  | 0, vertex =>
      0 < orientation (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
        (vertex ⟨2, by omega⟩)
  | remaining + 1, vertex =>
      HasPositiveFan (prefixVertex vertex) ∧
        0 < orientation (vertex ⟨0, by omega⟩)
          (vertex ⟨remaining + 2, by omega⟩)
          (vertex ⟨remaining + 3, by omega⟩)

omit [IsStrictOrderedRing R] in
/-- Global strict vertex order constructs a positive-fan certificate. -/
theorem strictOrdered_hasPositiveFan {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    HasPositiveFan vertex := by
  induction extraVertices with
  | zero =>
      let first : RingIndex 0 := ⟨0, by omega⟩
      let second : RingIndex 0 := ⟨1, by omega⟩
      let third : RingIndex 0 := ⟨2, by omega⟩
      simpa [HasPositiveFan, first, second, third] using ordered.strict
        first second third
        (by simp [first, second]) (by simp [second, third])
  | succ remaining inductionHypothesis =>
      let first : RingIndex (remaining + 1) := ⟨0, by omega⟩
      let penultimate : RingIndex (remaining + 1) := ⟨remaining + 2, by omega⟩
      let last : RingIndex (remaining + 1) := ⟨remaining + 3, by omega⟩
      constructor
      · exact inductionHypothesis (prefixVertex vertex)
          (prefixVertex_strict vertex ordered)
      · exact ordered.strict
          first penultimate last
          (by simp [first, penultimate]) (by simp [penultimate, last])

/-- Global weak vertex order plus a positive fan certificate is sufficient for
support-half-plane and vertex-convex-hull semantics to agree. -/
theorem positiveFan_supportSemanticsAdequate {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (fan : HasPositiveFan vertex) :
    SupportSemanticsAdequate vertex := by
  induction extraVertices with
  | zero =>
      let first : RingIndex 0 := ⟨0, by omega⟩
      let second : RingIndex 0 := ⟨1, by omega⟩
      let third : RingIndex 0 := ⟨2, by omega⟩
      have strict : IsStrictVertexOrderedConvexCCW vertex := by
        intro a b c aBefore bBefore
        fin_cases a <;> fin_cases b <;> fin_cases c
        all_goals simp at aBefore bBefore
        simpa [HasPositiveFan, first, second, third] using fan
      exact strictTriangle_supportSemanticsAdequate vertex strict
  | succ remaining inductionHypothesis =>
      let first : RingIndex (remaining + 1) := ⟨0, by omega⟩
      let penultimate : RingIndex (remaining + 1) := ⟨remaining + 2, by omega⟩
      let last : RingIndex (remaining + 1) := ⟨remaining + 3, by omega⟩
      let reducedVertex : RingIndex remaining → Vec2 R := prefixVertex vertex
      let lastTriangle := orderedTripleVertex vertex first penultimate last
      have reducedOrdered : IsLinearlyOrderedCCW reducedVertex := by
        intro a b c aBefore bBefore
        exact ordered
          ⟨a.val, by omega⟩ ⟨b.val, by omega⟩ ⟨c.val, by omega⟩
          aBefore bBefore
      have reducedAdequate : SupportSemanticsAdequate reducedVertex := by
        exact inductionHypothesis reducedVertex reducedOrdered fan.1
      have lastTriangleStrict :
          IsStrictVertexOrderedConvexCCW lastTriangle := by
        exact orderedTripleVertex_strict_of_positive
          vertex first penultimate last fan.2
      have lastTriangleAdequate : SupportSemanticsAdequate lastTriangle := by
        exact strictTriangle_supportSemanticsAdequate _ lastTriangleStrict
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
            · have edgeBeforeLast : edgeIndex.val < remaining + 2 := by omega
              have reducedNextNoWrap :
                  (edgeIndex.val + 1) % (remaining + 3) =
                    edgeIndex.val + 1 := Nat.mod_eq_of_lt (by omega)
              have sourceNextNoWrap :
                  (edgeIndex.val + 1) % (remaining + 1 + 3) =
                    edgeIndex.val + 1 := Nat.mod_eq_of_lt (by omega)
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

end Sprawlens.FanSupportSemantics
