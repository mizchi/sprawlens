import Sprawlens.PolygonSeamCanonicalizer

namespace Sprawlens.WindingCanonicalizer

open ExactGeometry
open ExecutableCanonicalizer
open OrderedTriples
open PolygonSeamCanonicalizer
open SemanticReclassification

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Executable decision procedure for the finite weak global CCW contract. -/
def decidableAllOrderedCCW :
    (points : List (Vec2 R)) → Decidable (AllOrderedCCW points)
  | [] => isTrue (by simp [AllOrderedCCW, AllOrderedTriples])
  | first :: rest => by
      unfold AllOrderedCCW AllOrderedTriples
      rw [List.triplewise_cons]
      letI : Decidable
          (rest.Pairwise (fun second third =>
            0 ≤ orientation first second third)) := inferInstance
      letI : Decidable
          (rest.Triplewise (fun first second third =>
            0 ≤ orientation first second third)) :=
        decidableAllOrderedCCW rest
      infer_instance

/-- Choose CCW winding when the input itself satisfies the weak global order;
otherwise reverse it.  Correctness is stated on the explicit bidirectional
domain `AllOrderedCCW points ∨ AllOrderedCCW points.reverse`. -/
def normalizeWinding (points : List (Vec2 R)) : List (Vec2 R) :=
  letI := decidableAllOrderedCCW points
  if _ordered : AllOrderedCCW points then points else points.reverse

omit [IsStrictOrderedRing R] in
/-- Already-CCW inputs are fixed points of winding normalization. -/
theorem normalizeWinding_eq_self
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    normalizeWinding points = points := by
  simp [normalizeWinding, ordered]

omit [IsStrictOrderedRing R] in
/-- A non-CCW input is reversed by the executable winding selector. -/
theorem normalizeWinding_eq_reverse
    (points : List (Vec2 R)) (notOrdered : ¬AllOrderedCCW points) :
    normalizeWinding points = points.reverse := by
  simp [normalizeWinding, notOrdered]

omit [IsStrictOrderedRing R] in
/-- Winding normalization only changes traversal direction. -/
theorem normalizeWinding_perm (points : List (Vec2 R)) :
    (normalizeWinding points).Perm points := by
  unfold normalizeWinding
  split
  · exact List.Perm.refl points
  · exact List.reverse_perm points

omit [IsStrictOrderedRing R] in
theorem normalizeWinding_length (points : List (Vec2 R)) :
    (normalizeWinding points).length = points.length :=
  (normalizeWinding_perm points).length_eq

omit [IsStrictOrderedRing R] in
theorem normalizeWinding_nodup_iff (points : List (Vec2 R)) :
    (normalizeWinding points).Nodup ↔ points.Nodup :=
  (normalizeWinding_perm points).nodup_iff

omit [IsStrictOrderedRing R] in
/-- Reversing winding preserves the represented convex-hull region. -/
theorem normalizeWinding_region (points : List (Vec2 R)) :
    listConvexRegion (normalizeWinding points) = listConvexRegion points := by
  unfold listConvexRegion
  congr 1
  ext point
  exact (normalizeWinding_perm points).mem_iff

omit [IsStrictOrderedRing R] in
/-- On the bidirectional winding domain, normalization produces a weakly
ordered CCW list. -/
theorem normalizeWinding_ordered
    (points : List (Vec2 R))
    (bidirectionallyOrdered :
      AllOrderedCCW points ∨ AllOrderedCCW points.reverse) :
    AllOrderedCCW (normalizeWinding points) := by
  by_cases ordered : AllOrderedCCW points
  · rw [normalizeWinding_eq_self points ordered]
    exact ordered
  · rw [normalizeWinding_eq_reverse points ordered]
    exact bidirectionallyOrdered.resolve_left ordered

omit [IsStrictOrderedRing R] in
/-- Winding normalization is idempotent on its stated geometric domain. -/
theorem normalizeWinding_idempotent
    (points : List (Vec2 R))
    (bidirectionallyOrdered :
      AllOrderedCCW points ∨ AllOrderedCCW points.reverse) :
    normalizeWinding (normalizeWinding points) = normalizeWinding points := by
  exact normalizeWinding_eq_self _
    (normalizeWinding_ordered points bidirectionallyOrdered)

/-- Dimension, endpoint, winding, and polygon-seam normalization composed as
one proof-free canonicalization entry point. -/
def canonicalizeWindingSeamed
    (points : List (Vec2 R)) : CanonicalArtifact R :=
  canonicalizeSeamed (normalizeWinding points)

omit [IsStrictOrderedRing R] in
/-- On the existing CCW domain, adding winding normalization is observationally
the identity. -/
theorem canonicalizeWindingSeamed_eq_canonicalizeSeamed
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    canonicalizeWindingSeamed points = canonicalizeSeamed points := by
  rw [canonicalizeWindingSeamed, normalizeWinding_eq_self points ordered]

omit [IsStrictOrderedRing R] in
/-- Clockwise inputs whose reverse satisfies the CCW contract are delegated
exactly to the already-verified CCW canonicalizer. -/
theorem canonicalizeWindingSeamed_eq_reverse
    (points : List (Vec2 R)) (notOrdered : ¬AllOrderedCCW points) :
    canonicalizeWindingSeamed points = canonicalizeSeamed points.reverse := by
  rw [canonicalizeWindingSeamed,
    normalizeWinding_eq_reverse points notOrdered]

/-- The winding-aware composition preserves the input convex region on its
explicit bidirectional winding domain. -/
theorem canonicalizeWindingSeamed_region
    (points : List (Vec2 R))
    (bidirectionallyOrdered :
      AllOrderedCCW points ∨ AllOrderedCCW points.reverse) :
    (canonicalizeWindingSeamed points).region = listConvexRegion points := by
  rw [canonicalizeWindingSeamed,
    canonicalizeSeamed_region _
      (normalizeWinding_ordered points bidirectionallyOrdered),
    normalizeWinding_region]

/-- On duplicate-free CCW inputs, the winding-aware public entry point keeps
the all-branch cyclic-seam invariance of `canonicalizeSeamed`. -/
theorem canonicalizeWindingSeamed_rotate
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllOrderedCCW points) (count : Nat) :
    canonicalizeWindingSeamed (points.rotate count) =
      canonicalizeWindingSeamed points := by
  have rotatedOrdered := allOrderedCCW_rotate points ordered count
  rw [canonicalizeWindingSeamed_eq_canonicalizeSeamed
      (points.rotate count) rotatedOrdered,
    canonicalizeWindingSeamed_eq_canonicalizeSeamed points ordered]
  exact canonicalizeSeamed_rotate points nodup ordered count

end Sprawlens.WindingCanonicalizer
