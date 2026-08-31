import Sprawlens.FullDimensionalSupportSemantics

namespace Sprawlens.ClipCompleteness

open CanonicalClip
open ConvexClipContract
open ConvexClipConsequences
open ExactGeometry
open HalfPlaneClipPoints
open SeamSupportSemantics
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Convex-hull semantics stated directly over the declarative retained-vertex
and crossing-point generators, with no list-emitter representation. -/
def clipBoundaryGeneratorConvexRegion {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    Set (Vec2 R) :=
  convexHull R { point | IsClipBoundaryGenerator plane vertex point }

omit [IsStrictOrderedRing R] in
/-- Index-free reading of a boundary generator through the materialized vertex
and edge sets. This form makes cyclic seam invariance explicit. -/
theorem boundaryGenerator_iff_range_or_edge {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (point : Vec2 R) :
    IsClipBoundaryGenerator plane vertex point ↔
      (point ∈ Set.range vertex ∧ signedDistance plane point ≤ 0) ∨
      (∃ edge ∈ indexedEdges vertex,
        point = boundaryPoint plane edge.1 edge.2 ∧
          ((signedDistance plane edge.1 ≤ 0 ∧
              0 < signedDistance plane edge.2) ∨
            (0 < signedDistance plane edge.1 ∧
              signedDistance plane edge.2 ≤ 0))) := by
  constructor
  · rintro (⟨index, rfl, inside⟩ | ⟨index, rfl, crossing⟩)
    · exact Or.inl ⟨Set.mem_range_self index, inside⟩
    · exact Or.inr ⟨_, (mem_indexedEdges_iff vertex _).2 ⟨index, rfl⟩,
        rfl, crossing⟩
  · rintro (⟨⟨index, rfl⟩, inside⟩ |
      ⟨edge, edgeMember, rfl, crossing⟩)
    · exact Or.inl ⟨index, rfl, inside⟩
    · rcases (mem_indexedEdges_iff vertex edge).1 edgeMember with ⟨index, rfl⟩
      exact Or.inr ⟨index, rfl, crossing⟩

omit [IsStrictOrderedRing R] in
/-- Declarative clipping generators are unchanged by cyclic reindexing. -/
theorem boundaryGenerator_rotateVertex_iff {extraVertices : Nat}
    (plane : HalfPlane R) (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) (point : Vec2 R) :
    IsClipBoundaryGenerator plane (rotateVertex start vertex) point ↔
      IsClipBoundaryGenerator plane vertex point := by
  rw [boundaryGenerator_iff_range_or_edge,
    boundaryGenerator_iff_range_or_edge]
  rw [range_rotateVertex, indexedEdges_rotateVertex]
  simp only [List.mem_rotate]

omit [IsStrictOrderedRing R] in
/-- The pure output region is independent of the cyclic materialization seam. -/
theorem clipBoundaryGeneratorConvexRegion_rotateVertex {extraVertices : Nat}
    (plane : HalfPlane R) (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    clipBoundaryGeneratorConvexRegion plane (rotateVertex start vertex) =
      clipBoundaryGeneratorConvexRegion plane vertex := by
  unfold clipBoundaryGeneratorConvexRegion
  congr 1
  ext point
  exact boundaryGenerator_rotateVertex_iff plane start vertex point

/-- The executable emitter convex hull and declarative generator convex hull
are exactly equal by the already-proved finite vertex-set contract. -/
theorem clipIndexedConvexRegion_eq_boundaryGeneratorConvexRegion
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    clipIndexedConvexRegion plane vertex =
      clipBoundaryGeneratorConvexRegion plane vertex := by
  unfold clipIndexedConvexRegion clipBoundaryGeneratorConvexRegion
  rw [clipIndexedRing_vertexSet_eq_boundaryGenerators]

/-- Pure convex-geometric completeness of the declarative boundary
generators. This is independent of list order, destuttering, and closure. -/
def BoundaryGeneratorHullComplete {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane ⊆
    clipBoundaryGeneratorConvexRegion plane vertex

/-- Pure generator completeness is invariant under cyclic reindexing. -/
theorem boundaryGeneratorHullComplete_rotateVertex_iff {extraVertices : Nat}
    (plane : HalfPlane R) (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    BoundaryGeneratorHullComplete plane (rotateVertex start vertex) ↔
      BoundaryGeneratorHullComplete plane vertex := by
  unfold BoundaryGeneratorHullComplete
  rw [indexedVertexConvexRegion_rotateVertex,
    clipBoundaryGeneratorConvexRegion_rotateVertex]

/-- Executable region completeness is equivalent to the pure generator-hull
obligation. -/
theorem clipRegionComplete_iff_boundaryGeneratorHullComplete
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    ClipRegionComplete plane vertex ↔
      BoundaryGeneratorHullComplete plane vertex := by
  unfold ClipRegionComplete BoundaryGeneratorHullComplete
  rw [clipIndexedConvexRegion_eq_boundaryGeneratorConvexRegion]

/-- When edge-support and vertex-convex input semantics are adequate, the
remaining generator-hull obligation can be stated entirely with edge support
half-planes. -/
theorem boundaryGeneratorHullComplete_iff_supportIntersection
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (adequate : SupportSemanticsAdequate vertex) :
    BoundaryGeneratorHullComplete plane vertex ↔
      indexedPolygonRegion vertex ∩ halfPlaneRegion plane ⊆
        clipBoundaryGeneratorConvexRegion plane vertex := by
  unfold BoundaryGeneratorHullComplete SupportSemanticsAdequate at *
  rw [adequate]

/-- Once pure generator completeness is proved, exact continuous semantics for
the executable clip follows without additional emitter reasoning. -/
theorem clipIndexedConvexRegion_eq_of_boundaryGeneratorHullComplete
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (complete : BoundaryGeneratorHullComplete plane vertex) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane := by
  rw [clipIndexedConvexRegion_eq_iff_complete]
  exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
    plane vertex).mpr complete

end Sprawlens.ClipCompleteness
