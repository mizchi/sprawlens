import Sprawlens.CyclicDestutter
import Sprawlens.StrictConvexContract

namespace Sprawlens.ClipRotationEquivariance

open ConvexClipContract
open CyclicDestutter
open ExactGeometry
open HalfPlaneClipFold
open HalfPlaneClipPoints
open HalfPlaneClipRing
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [IsStrictOrderedRing R] in
/-- The executable closed-ring emitter is cyclic destuttering of its raw
per-edge output chunks. -/
theorem closedClipOutputPoints_eq_cyclicDestutter
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) :
    closedClipOutputPoints plane edges =
      cyclicDestutter
        (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten :=
  rfl

omit [IsStrictOrderedRing R] in
/-- Changing only the seam between a cyclically equivalent edge list changes
the normalized executable output by at most a list rotation. -/
theorem closedClipOutputPoints_isRotated_of_isRotated
    (plane : HalfPlane R) {first second : List (Vec2 R × Vec2 R)}
    (rotated : first ~r second) :
    closedClipOutputPoints plane first ~r
      closedClipOutputPoints plane second := by
  rw [closedClipOutputPoints_eq_cyclicDestutter,
    closedClipOutputPoints_eq_cyclicDestutter]
  exact IsRotated.cyclicDestutter_flatten
    (List.IsRotated.map rotated fun edge => outputPoints plane edge.1 edge.2)

omit [IsStrictOrderedRing R] in
/-- The concrete indexed clip implementation is equivariant under every
choice of input materialization seam.  No convexity premise is needed. -/
theorem clipIndexedRing_rotateVertex_isRotated
    {extraVertices : Nat}
    (plane : HalfPlane R) (start : RingIndex extraVertices)
    (vertex : RingIndex extraVertices → Vec2 R) :
    clipIndexedRing plane (rotateVertex start vertex) ~r
      clipIndexedRing plane vertex := by
  rw [clipIndexedRing, indexedEdges_rotateVertex]
  exact closedClipOutputPoints_isRotated_of_isRotated plane
    (List.IsRotated.forall (indexedEdges vertex) start.val)

end Sprawlens.ClipRotationEquivariance
