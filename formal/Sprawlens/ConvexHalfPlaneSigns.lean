import Sprawlens.CyclicBinaryBlocks
import Sprawlens.StrictConvexContract

namespace Sprawlens.ConvexHalfPlaneSigns

open ExactGeometry
open CyclicBinaryBlocks
open HalfPlaneClipPoints
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- The affine dependence of four planar points, observed by a half-plane functional. -/
theorem signedDistance_four_point_circuit
    (plane : HalfPlane R) (a b c d : Vec2 R) :
    orientation b c d * signedDistance plane a +
        orientation a b d * signedDistance plane c =
      orientation a c d * signedDistance plane b +
        orientation a b c * signedDistance plane d := by
  cases plane
  cases a
  cases b
  cases c
  cases d
  simp only [orientation, signedDistance]
  ring

/-- Four increasing convex vertices cannot alternate outside/inside/outside/inside. -/
theorem not_outside_inside_outside_inside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (aOutside : 0 < signedDistance plane (vertex a))
    (bInside : signedDistance plane (vertex b) ≤ 0)
    (cOutside : 0 < signedDistance plane (vertex c))
    (dInside : signedDistance plane (vertex d) ≤ 0) : False := by
  have bcd : 0 < orientation (vertex b) (vertex c) (vertex d) :=
    ordered b c d bBeforeC cBeforeD
  have abd : 0 < orientation (vertex a) (vertex b) (vertex d) :=
    ordered a b d aBeforeB (lt_trans bBeforeC cBeforeD)
  have acd : 0 < orientation (vertex a) (vertex c) (vertex d) :=
    ordered a c d (lt_trans aBeforeB bBeforeC) cBeforeD
  have abc : 0 < orientation (vertex a) (vertex b) (vertex c) :=
    ordered a b c aBeforeB bBeforeC
  have leftFirst :
      0 < orientation (vertex b) (vertex c) (vertex d) *
        signedDistance plane (vertex a) := mul_pos bcd aOutside
  have leftSecond :
      0 < orientation (vertex a) (vertex b) (vertex d) *
        signedDistance plane (vertex c) := mul_pos abd cOutside
  have rightFirst :
      orientation (vertex a) (vertex c) (vertex d) *
        signedDistance plane (vertex b) ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos (le_of_lt acd) bInside
  have rightSecond :
      orientation (vertex a) (vertex b) (vertex c) *
        signedDistance plane (vertex d) ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos (le_of_lt abc) dInside
  have circuit := signedDistance_four_point_circuit
    plane (vertex a) (vertex b) (vertex c) (vertex d)
  linarith

/-- The opposite alternating pattern is impossible for the same affine-circuit reason. -/
theorem not_inside_outside_inside_outside {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (aInside : signedDistance plane (vertex a) ≤ 0)
    (bOutside : 0 < signedDistance plane (vertex b))
    (cInside : signedDistance plane (vertex c) ≤ 0)
    (dOutside : 0 < signedDistance plane (vertex d)) : False := by
  have bcd : 0 < orientation (vertex b) (vertex c) (vertex d) :=
    ordered b c d bBeforeC cBeforeD
  have abd : 0 < orientation (vertex a) (vertex b) (vertex d) :=
    ordered a b d aBeforeB (lt_trans bBeforeC cBeforeD)
  have acd : 0 < orientation (vertex a) (vertex c) (vertex d) :=
    ordered a c d (lt_trans aBeforeB bBeforeC) cBeforeD
  have abc : 0 < orientation (vertex a) (vertex b) (vertex c) :=
    ordered a b c aBeforeB bBeforeC
  have leftFirst :
      orientation (vertex b) (vertex c) (vertex d) *
        signedDistance plane (vertex a) ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos (le_of_lt bcd) aInside
  have leftSecond :
      orientation (vertex a) (vertex b) (vertex d) *
        signedDistance plane (vertex c) ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos (le_of_lt abd) cInside
  have rightFirst :
      0 < orientation (vertex a) (vertex c) (vertex d) *
        signedDistance plane (vertex b) := mul_pos acd bOutside
  have rightSecond :
      0 < orientation (vertex a) (vertex b) (vertex c) *
        signedDistance plane (vertex d) := mul_pos abc dOutside
  have circuit := signedDistance_four_point_circuit
    plane (vertex a) (vertex b) (vertex c) (vertex d)
  linarith

/-- Outside vertices form one cyclic block: either outside or inside is a linear interval. -/
theorem outside_or_inside_linear_interval {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (hasOutside : ∃ index, 0 < signedDistance plane (vertex index))
    (hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0) :
    IsLinearInterval (fun index => 0 < signedDistance plane (vertex index)) ∨
      IsLinearInterval (fun index => signedDistance plane (vertex index) ≤ 0) := by
  have blocks := linearInterval_or_complement_of_no_alternation
    (fun index => 0 < signedDistance plane (vertex index)) hasOutside
    (by simpa only [not_lt] using hasInside)
    (by
      intro a b c d aBeforeB bBeforeC cBeforeD alternating
      exact not_outside_inside_outside_inside
        plane vertex ordered a b c d aBeforeB bBeforeC cBeforeD
        alternating.1 (le_of_not_gt alternating.2.1)
        alternating.2.2.1 (le_of_not_gt alternating.2.2.2))
    (by
      intro a b c d aBeforeB bBeforeC cBeforeD alternating
      exact not_inside_outside_inside_outside
        plane vertex ordered a b c d aBeforeB bBeforeC cBeforeD
        (le_of_not_gt alternating.1) alternating.2.1
        (le_of_not_gt alternating.2.2.1) alternating.2.2.2)
  rcases blocks with outsideInterval | insideInterval
  · exact Or.inl outsideInterval
  · right
    rcases insideInterval with ⟨first, last, interval⟩
    exact ⟨first, last, fun index => by simpa only [not_lt] using interval index⟩

/-- In a mixed strict convex ring, cutting immediately before the outside block
materializes one inside vertex followed by all and only the outside vertices. -/
theorem outside_rotatedBlock {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (hasOutside : ∃ index, 0 < signedDistance plane (vertex index))
    (hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0) :
    IsRotatedBlock (fun index => 0 < signedDistance plane (vertex index)) := by
  apply rotatedBlock_of_linearInterval_or_complement
  · exact hasOutside
  · simpa only [not_lt] using hasInside
  · have intervals := outside_or_inside_linear_interval
      plane vertex ordered hasOutside hasInside
    rcases intervals with outsideInterval | insideInterval
    · exact Or.inl outsideInterval
    · exact Or.inr ⟨insideInterval.choose, insideInterval.choose_spec.choose,
        fun index => by
          simpa only [not_lt] using insideInterval.choose_spec.choose_spec index⟩

end Sprawlens.ConvexHalfPlaneSigns
