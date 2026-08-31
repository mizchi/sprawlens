import Sprawlens.CanonicalClip

namespace Sprawlens.TriangleSupportSemantics

open scoped BigOperators
open Set
open CanonicalClip
open ConvexClipContract
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open SimpleRing
open StrictConvexContract
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- The three oriented subareas around a point sum to the oriented area of the
containing triangle, without any containment assumption. -/
theorem orientation_triangle_decomposition (a b c point : Vec2 R) :
    orientation b c point + orientation c a point + orientation a b point =
      orientation a b c := by
  simp only [orientation]
  ring

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Nondegenerate determinant barycentric coordinates reconstruct the point.
This algebraic identity is the bridge from support inequalities to convex-hull
membership. -/
theorem orientation_barycentric_reconstruct
    (a b c point : Vec2 R) (nondegenerate : orientation a b c ≠ 0) :
    (orientation b c point / orientation a b c) • a +
        (orientation c a point / orientation a b c) • b +
        (orientation a b point / orientation a b c) • c = point := by
  apply vec2EquivProd.injective
  apply Prod.ext
  · change
      orientation b c point / orientation a b c * a.x +
            orientation c a point / orientation a b c * b.x +
          orientation a b point / orientation a b c * c.x = point.x
    field_simp [nondegenerate]
    simp only [orientation]
    ring
  · change
      orientation b c point / orientation a b c * a.y +
            orientation c a point / orientation a b c * b.y +
          orientation a b point / orientation a b c * c.y = point.y
    field_simp [nondegenerate]
    simp only [orientation]
    ring

/-- Strict vertex order is sufficient for support-half-plane and vertex-convex
semantics to coincide for a triangle. -/
theorem strictTriangle_supportSemanticsAdequate
    (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    SupportSemanticsAdequate vertex := by
  let first : RingIndex 0 := ⟨0, by omega⟩
  let second : RingIndex 0 := ⟨1, by omega⟩
  let third : RingIndex 0 := ⟨2, by omega⟩
  let area := orientation (vertex first) (vertex second) (vertex third)
  let weight : Vec2 R → RingIndex 0 → R := fun point index =>
    match index.val with
    | 0 => orientation (vertex second) (vertex third) point / area
    | 1 => orientation (vertex third) (vertex first) point / area
    | _ => orientation (vertex first) (vertex second) point / area
  have areaPositive : 0 < area := by
    exact ordered.strict first second third
      (by simp [first, second]) (by simp [second, third])
  apply Set.Subset.antisymm
  · intro point supportMember
    have weightNonnegative :
        ∀ index ∈ (Finset.univ : Finset (RingIndex 0)),
          0 ≤ weight point index := by
      intro index _
      fin_cases index
      · apply div_nonneg
        · simpa [weight, second, third, nextIndex] using supportMember second
        · exact le_of_lt areaPositive
      · apply div_nonneg
        · simpa [weight, first, third, nextIndex] using supportMember third
        · exact le_of_lt areaPositive
      · apply div_nonneg
        · simpa [weight, first, second, nextIndex] using supportMember first
        · exact le_of_lt areaPositive
    have weightSum :
        ∑ index ∈ (Finset.univ : Finset (RingIndex 0)),
          weight point index = 1 := by
      rw [Fin.sum_univ_three]
      simp [weight, first, second, third]
      rw [← add_div, ← add_div]
      rw [orientation_triangle_decomposition]
      exact div_self (ne_of_gt areaPositive)
    have centerMember :
        (Finset.univ : Finset (RingIndex 0)).centerMass
            (fun index => weight point index) vertex ∈
          convexHull R (Set.range vertex) := by
      exact Finset.centerMass_mem_convexHull Finset.univ
        weightNonnegative (by rw [weightSum]; norm_num)
        (fun index _ => Set.mem_range_self index)
    have centerEq :
        (Finset.univ : Finset (RingIndex 0)).centerMass
            (fun index => weight point index) vertex = point := by
      rw [Finset.centerMass_eq_of_sum_1 _ _ weightSum]
      rw [Fin.sum_univ_three]
      simpa [weight, first, second, third, area] using
        orientation_barycentric_reconstruct
          (vertex first) (vertex second) (vertex third) point
          (ne_of_gt areaPositive)
    rw [centerEq] at centerMember
    exact centerMember
  · apply convexHull_min
    · rintro point ⟨index, rfl⟩
      intro edgeIndex
      exact ordered.weak edgeIndex index
    · exact indexedPolygonRegion_convex vertex

/-- Materialize any three source vertices as a standalone triangle in the
chosen order. -/
def orderedTripleVertex {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (first second third : RingIndex extraVertices)
    (index : RingIndex 0) : Vec2 R :=
  match index.val with
  | 0 => vertex first
  | 1 => vertex second
  | _ => vertex third

omit [IsStrictOrderedRing R] in
/-- Every increasing triple selected from a strict globally ordered polygon is
itself a strict ordered triangle. -/
theorem orderedTripleVertex_strict {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (first second third : RingIndex extraVertices)
    (firstBefore : first.val < second.val)
    (secondBefore : second.val < third.val) :
    IsStrictVertexOrderedConvexCCW
      (orderedTripleVertex vertex first second third) := by
  intro triangleFirst triangleSecond triangleThird
    triangleFirstBefore triangleSecondBefore
  fin_cases triangleFirst <;> fin_cases triangleSecond <;> fin_cases triangleThird
  all_goals simp at triangleFirstBefore triangleSecondBefore
  all_goals simpa [orderedTripleVertex] using
    ordered.strict first second third firstBefore secondBefore

omit [IsStrictOrderedRing R] in
/-- A materialized source triple is strictly ordered as soon as its single
nontrivial orientation is positive; no global strictness assumption on the
source polygon is needed. -/
theorem orderedTripleVertex_strict_of_positive {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (first second third : RingIndex extraVertices)
    (positive : 0 < orientation (vertex first) (vertex second) (vertex third)) :
    IsStrictVertexOrderedConvexCCW
      (orderedTripleVertex vertex first second third) := by
  intro triangleFirst triangleSecond triangleThird
    triangleFirstBefore triangleSecondBefore
  fin_cases triangleFirst <;> fin_cases triangleSecond <;> fin_cases triangleThird
  all_goals simp at triangleFirstBefore triangleSecondBefore
  simpa [orderedTripleVertex] using positive

theorem orderedTriple_supportSemanticsAdequate {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (first second third : RingIndex extraVertices)
    (firstBefore : first.val < second.val)
    (secondBefore : second.val < third.val) :
    SupportSemanticsAdequate
      (orderedTripleVertex vertex first second third) := by
  exact strictTriangle_supportSemanticsAdequate _
    (orderedTripleVertex_strict vertex ordered first second third
      firstBefore secondBefore)

/-- The convex hull of any materialized source triple is contained in the
convex hull of the complete source vertex set. -/
theorem orderedTriple_convexRegion_subset {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (first second third : RingIndex extraVertices) :
    indexedVertexConvexRegion
        (orderedTripleVertex vertex first second third) ⊆
      indexedVertexConvexRegion vertex := by
  apply convexHull_mono
  rintro point ⟨index, rfl⟩
  fin_cases index
  · exact Set.mem_range_self first
  · exact Set.mem_range_self second
  · exact Set.mem_range_self third

end Sprawlens.TriangleSupportSemantics
