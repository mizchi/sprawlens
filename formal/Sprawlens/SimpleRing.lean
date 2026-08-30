import Mathlib.Data.Fin.Basic
import Sprawlens.CollinearOverlap
import Sprawlens.SegmentIntersection

namespace Sprawlens.SimpleRing

open CollinearOverlap
open ExactGeometry
open SegmentContact
open SegmentIntersection

universe u

variable {R : Type u} [Field R] [LinearOrder R]

/-- Every ring index type has at least three elements. -/
abbrev RingIndex (extraVertices : Nat) := Fin (extraVertices + 3)

def nextIndex {extraVertices : Nat} (index : RingIndex extraVertices) :
    RingIndex extraVertices :=
  ⟨(index.val + 1) % (extraVertices + 3), Nat.mod_lt _ (by omega)⟩

/-- Equal edges and cyclic predecessor/successor edges are adjacent. -/
def EdgesAdjacent {extraVertices : Nat}
    (left right : RingIndex extraVertices) : Prop :=
  left = right ∨ nextIndex left = right ∨ nextIndex right = left

def SegmentsConflict (a b c d : Vec2 R) : Prop :=
  ProperlyIntersect a b c d ∨
    PointInOpenSegment a b c ∨
    PointInOpenSegment a b d ∨
    PointInOpenSegment c d a ∨
    PointInOpenSegment c d b ∨
    OpenSegmentsOverlap a b c d

def segmentsConflictBool [DecidableEq R] [DecidableLT R] [DecidableLE R]
    (a b c d : Vec2 R) : Bool :=
  properlyIntersectBool a b c d ||
    pointInOpenSegmentBool a b c ||
    pointInOpenSegmentBool a b d ||
    pointInOpenSegmentBool c d a ||
    pointInOpenSegmentBool c d b ||
    openSegmentsOverlapBool a b c d

theorem segmentsConflictBool_eq_true
    [DecidableEq R] [DecidableLT R] [DecidableLE R] (a b c d : Vec2 R) :
    segmentsConflictBool a b c d = true ↔ SegmentsConflict a b c d := by
  simp [segmentsConflictBool, SegmentsConflict, properlyIntersectBool_eq_true,
    pointInOpenSegmentBool_eq_true, openSegmentsOverlapBool_eq_true, or_assoc]

/-- Topological simplicity, independent of winding direction and convexity. -/
def IsSimpleRing {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  Function.Injective vertex ∧
    (∀ index, vertex index ≠ vertex (nextIndex index)) ∧
    ∀ left right, ¬EdgesAdjacent left right →
      ¬SegmentsConflict
        (vertex left) (vertex (nextIndex left))
        (vertex right) (vertex (nextIndex right))

theorem edgesAdjacent_refl {extraVertices : Nat} (index : RingIndex extraVertices) :
    EdgesAdjacent index index :=
  Or.inl rfl

theorem edgesAdjacent_next {extraVertices : Nat} (index : RingIndex extraVertices) :
    EdgesAdjacent index (nextIndex index) :=
  Or.inr <| Or.inl rfl

theorem edgesAdjacent_symm {extraVertices : Nat} (left right : RingIndex extraVertices) :
    EdgesAdjacent left right ↔ EdgesAdjacent right left := by
  unfold EdgesAdjacent
  aesop

theorem nonadjacent_indices_ne {extraVertices : Nat} (left right : RingIndex extraVertices)
    (nonadjacent : ¬EdgesAdjacent left right) : left ≠ right := by
  intro equal
  subst right
  exact nonadjacent (edgesAdjacent_refl left)

theorem simpleRing_vertices_injective {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R} (simple : IsSimpleRing vertex) :
    Function.Injective vertex :=
  simple.1

theorem simpleRing_edge_nondegenerate {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R} (simple : IsSimpleRing vertex)
    (index : RingIndex extraVertices) : vertex index ≠ vertex (nextIndex index) :=
  simple.2.1 index

theorem simpleRing_nonadjacent_no_conflict {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R} (simple : IsSimpleRing vertex)
    (left right : RingIndex extraVertices) (nonadjacent : ¬EdgesAdjacent left right) :
    ¬SegmentsConflict
      (vertex left) (vertex (nextIndex left))
      (vertex right) (vertex (nextIndex right)) :=
  simple.2.2 left right nonadjacent

theorem simpleRing_nonadjacent_no_proper_intersection {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R} (simple : IsSimpleRing vertex)
    (left right : RingIndex extraVertices) (nonadjacent : ¬EdgesAdjacent left right) :
    ¬ProperlyIntersect
      (vertex left) (vertex (nextIndex left))
      (vertex right) (vertex (nextIndex right)) := by
  intro intersection
  exact simpleRing_nonadjacent_no_conflict simple left right nonadjacent (Or.inl intersection)

theorem simpleRing_nonadjacent_no_collinear_overlap {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R} (simple : IsSimpleRing vertex)
    (left right : RingIndex extraVertices) (nonadjacent : ¬EdgesAdjacent left right) :
    ¬OpenSegmentsOverlap
      (vertex left) (vertex (nextIndex left))
      (vertex right) (vertex (nextIndex right)) := by
  intro overlap
  exact simpleRing_nonadjacent_no_conflict simple left right nonadjacent
    (Or.inr <| Or.inr <| Or.inr <| Or.inr <| Or.inr overlap)

end Sprawlens.SimpleRing
