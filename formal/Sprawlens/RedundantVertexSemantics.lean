import Sprawlens.FanSupportSemantics

namespace Sprawlens.RedundantVertexSemantics

open Set
open CanonicalClip
open ConvexClipContract
open ExactGeometry
open HalfPlaneIntersection
open PolygonSupportSemantics
open SimpleRing
open StrictConvexContract
open TriangleSupportSemantics
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Subdividing the closing edge by a last vertex does not change the
support-half-plane region. The parameter endpoints cover duplicate vertices
as well as a proper subdivision. -/
theorem indexedPolygonRegion_eq_prefix_of_last_on_closingSegment
    {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (parameter : R) (parameterNonnegative : 0 ≤ parameter)
    (parameterAtMostOne : parameter ≤ 1)
    (lastOnClosing :
      vertex ⟨extraVertices + 3, by omega⟩ =
        interpolatePoint
          (vertex ⟨extraVertices + 2, by omega⟩)
          (vertex ⟨0, by omega⟩) parameter) :
    indexedPolygonRegion vertex =
      indexedPolygonRegion (prefixVertex vertex) := by
  let first : RingIndex (extraVertices + 1) := ⟨0, by omega⟩
  let penultimate : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 2, by omega⟩
  let last : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 3, by omega⟩
  have nextPenultimate : nextIndex penultimate = last := by
    apply Fin.ext
    change (extraVertices + 2 + 1) % (extraVertices + 1 + 3) =
      extraVertices + 3
    rw [Nat.mod_eq_of_lt (by omega)]
  have nextLast : nextIndex last = first := by
    apply Fin.ext
    simp [nextIndex, last, first]
  apply Set.Subset.antisymm
  · intro point sourceMember edgeIndex
    by_cases edgeIsLast : edgeIndex.val = extraVertices + 2
    · have edgeIndexEq :
          edgeIndex = (⟨extraVertices + 2, by omega⟩ : RingIndex extraVertices) :=
        Fin.ext edgeIsLast
      rw [edgeIndexEq]
      have penultimateSupport :
          0 ≤ orientation (vertex penultimate) (vertex last) point := by
        simpa [nextPenultimate] using sourceMember penultimate
      have lastSupport :
          0 ≤ orientation (vertex last) (vertex first) point := by
        simpa [nextLast] using sourceMember last
      have splitClosing :
          orientation (vertex penultimate) (vertex last) point +
              orientation (vertex last) (vertex first) point =
            orientation (vertex penultimate) (vertex first) point := by
        rw [show vertex last = interpolatePoint
          (vertex penultimate) (vertex first) parameter by
            simpa [first, penultimate, last] using lastOnClosing]
        rw [orientation_interpolate_second, orientation_interpolate_first]
        simp only [orientation]
        ring
      simpa [prefixVertex, first, penultimate, nextIndex] using
        (show 0 ≤ orientation (vertex penultimate) (vertex first) point by
          rw [← splitClosing]
          exact add_nonneg penultimateSupport lastSupport)
    · have edgeBeforeLast : edgeIndex.val < extraVertices + 2 := by omega
      have reducedNextNoWrap :
          (edgeIndex.val + 1) % (extraVertices + 3) = edgeIndex.val + 1 :=
        Nat.mod_eq_of_lt (by omega)
      have sourceNextNoWrap :
          (edgeIndex.val + 1) % (extraVertices + 1 + 3) = edgeIndex.val + 1 :=
        Nat.mod_eq_of_lt (by omega)
      simpa [prefixVertex, nextIndex, reducedNextNoWrap, sourceNextNoWrap] using
        sourceMember
          (⟨edgeIndex.val, by omega⟩ : RingIndex (extraVertices + 1))
  · intro point prefixMember edgeIndex
    by_cases edgeBeforePenultimate : edgeIndex.val < extraVertices + 2
    · let prefixIndex : RingIndex extraVertices := ⟨edgeIndex.val, by omega⟩
      have reducedNextNoWrap :
          (prefixIndex.val + 1) % (extraVertices + 3) = prefixIndex.val + 1 :=
        Nat.mod_eq_of_lt (by simp [prefixIndex]; omega)
      have sourceNextNoWrap :
          (edgeIndex.val + 1) % (extraVertices + 1 + 3) = edgeIndex.val + 1 :=
        Nat.mod_eq_of_lt (by omega)
      simpa [prefixIndex, prefixVertex, nextIndex, reducedNextNoWrap,
        sourceNextNoWrap] using prefixMember prefixIndex
    · have closingSupport :
          0 ≤ orientation (vertex penultimate) (vertex first) point := by
        simpa [prefixVertex, first, penultimate, nextIndex] using
          prefixMember
            (⟨extraVertices + 2, by omega⟩ : RingIndex extraVertices)
      by_cases edgeIsPenultimate : edgeIndex.val = extraVertices + 2
      · have edgeIndexEq : edgeIndex = penultimate := Fin.ext edgeIsPenultimate
        rw [edgeIndexEq]
        rw [nextPenultimate]
        rw [show vertex last = interpolatePoint
          (vertex penultimate) (vertex first) parameter by
            simpa [first, penultimate, last] using lastOnClosing]
        rw [orientation_interpolate_second]
        simpa [orientation] using
          mul_nonneg parameterNonnegative closingSupport
      · have edgeIndexEq : edgeIndex = last := by
          have edgeBound := edgeIndex.isLt
          have edgeValue : edgeIndex.val = extraVertices + 3 := by omega
          apply Fin.ext
          simpa [last] using edgeValue
        rw [edgeIndexEq]
        rw [nextLast]
        rw [show vertex last = interpolatePoint
          (vertex penultimate) (vertex first) parameter by
            simpa [first, penultimate, last] using lastOnClosing]
        rw [orientation_interpolate_start]
        exact mul_nonneg (sub_nonneg.mpr parameterAtMostOne) closingSupport

/-- Subdividing the closing edge by a last vertex does not change the convex
hull of the vertex set. -/
theorem indexedVertexConvexRegion_eq_prefix_of_last_on_closingSegment
    {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (parameter : R) (parameterNonnegative : 0 ≤ parameter)
    (parameterAtMostOne : parameter ≤ 1)
    (lastOnClosing :
      vertex ⟨extraVertices + 3, by omega⟩ =
        interpolatePoint
          (vertex ⟨extraVertices + 2, by omega⟩)
          (vertex ⟨0, by omega⟩) parameter) :
    indexedVertexConvexRegion vertex =
      indexedVertexConvexRegion (prefixVertex vertex) := by
  let first : RingIndex (extraVertices + 1) := ⟨0, by omega⟩
  let penultimate : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 2, by omega⟩
  let last : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 3, by omega⟩
  have lastInPrefix :
      vertex last ∈ indexedVertexConvexRegion (prefixVertex vertex) := by
    rw [show vertex last = interpolatePoint
      (vertex penultimate) (vertex first) parameter by
        simpa [first, penultimate, last] using lastOnClosing]
    rw [← affineCombination_eq_interpolatePoint
      (vertex penultimate) (vertex first) (1 - parameter) parameter (by ring)]
    exact (convex_convexHull R (Set.range (prefixVertex vertex)))
      (subset_convexHull R _
        (Set.mem_range_self
          (⟨extraVertices + 2, by omega⟩ : RingIndex extraVertices)))
      (subset_convexHull R _
        (Set.mem_range_self (⟨0, by omega⟩ : RingIndex extraVertices)))
      (sub_nonneg.mpr parameterAtMostOne) parameterNonnegative (by ring)
  apply Set.Subset.antisymm
  · apply convexHull_min
    · rintro point ⟨index, rfl⟩
      by_cases indexIsLast : index.val = extraVertices + 3
      · have indexEq : index = last := Fin.ext indexIsLast
        rw [indexEq]
        exact lastInPrefix
      · exact subset_convexHull R _
          (Set.mem_range_self
            (⟨index.val, by omega⟩ : RingIndex extraVertices))
    · exact convex_convexHull R _
  · apply convexHull_mono
    rintro point ⟨index, rfl⟩
    exact Set.mem_range_self
      (⟨index.val, by omega⟩ : RingIndex (extraVertices + 1))

/-- A support-semantics certificate survives insertion of a redundant last
vertex on the closing edge. -/
theorem supportSemanticsAdequate_of_prefix_of_last_on_closingSegment
    {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (parameter : R) (parameterNonnegative : 0 ≤ parameter)
    (parameterAtMostOne : parameter ≤ 1)
    (lastOnClosing :
      vertex ⟨extraVertices + 3, by omega⟩ =
        interpolatePoint
          (vertex ⟨extraVertices + 2, by omega⟩)
          (vertex ⟨0, by omega⟩) parameter)
    (prefixAdequate : SupportSemanticsAdequate (prefixVertex vertex)) :
    SupportSemanticsAdequate vertex := by
  unfold SupportSemanticsAdequate at prefixAdequate ⊢
  rw [indexedPolygonRegion_eq_prefix_of_last_on_closingSegment
    vertex parameter parameterNonnegative parameterAtMostOne lastOnClosing]
  rw [indexedVertexConvexRegion_eq_prefix_of_last_on_closingSegment
    vertex parameter parameterNonnegative parameterAtMostOne lastOnClosing]
  exact prefixAdequate

/-- A recursive fan certificate may add either a positive-area fan triangle or
a redundant point on the closing edge. This permits positive and zero-area
steps to coexist without weakening the semantic conclusion. -/
def HasReducibleFan : {extraVertices : Nat} →
    (RingIndex extraVertices → Vec2 R) → Prop
  | 0, vertex =>
      0 < orientation (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
        (vertex ⟨2, by omega⟩)
  | extraVertices + 1, vertex =>
      HasReducibleFan (prefixVertex vertex) ∧
        (0 < orientation (vertex ⟨0, by omega⟩)
            (vertex ⟨extraVertices + 2, by omega⟩)
            (vertex ⟨extraVertices + 3, by omega⟩) ∨
          ∃ parameter : R,
            0 ≤ parameter ∧ parameter ≤ 1 ∧
              vertex ⟨extraVertices + 3, by omega⟩ =
                interpolatePoint
                  (vertex ⟨extraVertices + 2, by omega⟩)
                  (vertex ⟨0, by omega⟩) parameter)

/-- Weak global order plus a reducible-fan certificate is sufficient for exact
support semantics, including mixtures of positive fan cells and redundant
closing-edge subdivisions. -/
theorem reducibleFan_supportSemanticsAdequate {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (fan : HasReducibleFan vertex) :
    SupportSemanticsAdequate vertex := by
  induction extraVertices with
  | zero =>
      have strict : IsStrictVertexOrderedConvexCCW vertex := by
        intro first second third firstBefore secondBefore
        fin_cases first <;> fin_cases second <;> fin_cases third
        all_goals simp at firstBefore secondBefore
        simpa [HasReducibleFan] using fan
      exact strictTriangle_supportSemanticsAdequate vertex strict
  | succ remaining inductionHypothesis =>
      have prefixOrdered :
          IsLinearlyOrderedCCW (prefixVertex vertex) :=
        prefixVertex_ordered vertex ordered
      have prefixAdequate :
          SupportSemanticsAdequate (prefixVertex vertex) :=
        inductionHypothesis (prefixVertex vertex) prefixOrdered fan.1
      rcases fan.2 with positive | redundant
      · exact supportSemanticsAdequate_snoc_of_positiveFanTriangle
          vertex ordered prefixAdequate positive
      · rcases redundant with
          ⟨parameter, parameterNonnegative, parameterAtMostOne, lastOnClosing⟩
        exact supportSemanticsAdequate_of_prefix_of_last_on_closingSegment
          vertex parameter parameterNonnegative parameterAtMostOne
          lastOnClosing prefixAdequate

end Sprawlens.RedundantVertexSemantics
