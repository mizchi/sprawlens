import Mathlib.Tactic.LinearCombination
import Sprawlens.HalfPlaneClipPoints

namespace Sprawlens.HalfPlaneBoundaryGeometry

open ExactGeometry
open HalfPlaneClipPoints

universe u

variable {R : Type u} [Field R]

/-- Move along the boundary tangent oriented so the `≤ 0` half-plane lies to the left. -/
def boundaryAdvance (plane : HalfPlane R) (point : Vec2 R) (amount : R) : Vec2 R :=
  {
    x := point.x - amount * plane.normalY
    y := point.y + amount * plane.normalX
  }

theorem signedDistance_boundaryAdvance
    (plane : HalfPlane R) (point : Vec2 R) (amount : R) :
    signedDistance plane (boundaryAdvance plane point amount) =
      signedDistance plane point := by
  simp only [signedDistance, boundaryAdvance]
  ring

theorem orientation_to_boundaryAdvance
    (plane : HalfPlane R) (inside boundary : Vec2 R) (amount : R) :
    orientation inside boundary (boundaryAdvance plane boundary amount) =
      amount * (signedDistance plane boundary - signedDistance plane inside) := by
  simp only [orientation, boundaryAdvance, signedDistance]
  ring

theorem orientation_from_boundaryAdvance
    (plane : HalfPlane R) (boundary inside : Vec2 R) (amount : R) :
    orientation boundary (boundaryAdvance plane boundary amount) inside =
      amount * (signedDistance plane boundary - signedDistance plane inside) := by
  simp only [orientation, boundaryAdvance, signedDistance]
  ring

theorem orientation_to_ordered_boundary_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) (inside boundary : Vec2 R) {amount : R}
    (amountNonnegative : 0 ≤ amount)
    (insideHalfPlane : signedDistance plane inside ≤ 0)
    (onBoundary : signedDistance plane boundary = 0) :
    0 ≤ orientation inside boundary (boundaryAdvance plane boundary amount) := by
  rw [orientation_to_boundaryAdvance, onBoundary, zero_sub]
  exact mul_nonneg amountNonnegative (neg_nonneg.mpr insideHalfPlane)

theorem orientation_from_ordered_boundary_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) (boundary inside : Vec2 R) {amount : R}
    (amountNonnegative : 0 ≤ amount)
    (insideHalfPlane : signedDistance plane inside ≤ 0)
    (onBoundary : signedDistance plane boundary = 0) :
    0 ≤ orientation boundary (boundaryAdvance plane boundary amount) inside := by
  rw [orientation_from_boundaryAdvance, onBoundary, zero_sub]
  exact mul_nonneg amountNonnegative (neg_nonneg.mpr insideHalfPlane)

/-- The directed order required of the exit and entry points on a clipping seam. -/
def OrderedBoundary [LE R] (plane : HalfPlane R) (start finish : Vec2 R) : Prop :=
  ∃ amount, 0 ≤ amount ∧ finish = boundaryAdvance plane start amount

/-- Crossing signs alone do not determine which way the cut seam must run. -/
theorem crossings_alone_do_not_order_boundary :
    ¬ OrderedBoundary
      ({ normalX := 1, normalY := 0, offset := 0 } : HalfPlane Rat)
      ({ x := 0, y := 1 } : Vec2 Rat)
      ({ x := 0, y := -1 } : Vec2 Rat) := by
  intro ordered
  rcases ordered with ⟨amount, amountNonnegative, finishEq⟩
  have yEq := congrArg Vec2.y finishEq
  simp [boundaryAdvance] at yEq
  linarith

def normalSquared (plane : HalfPlane R) : R :=
  plane.normalX ^ 2 + plane.normalY ^ 2

def boundaryAmount (plane : HalfPlane R) (start finish : Vec2 R) : R :=
  (-(plane.normalY) * (finish.x - start.x) +
    plane.normalX * (finish.y - start.y)) / normalSquared plane

theorem normalSquared_pos_of_signedDistance_lt
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) {start finish : Vec2 R}
    (distanceLt : signedDistance plane start < signedDistance plane finish) :
    0 < normalSquared plane := by
  have normalNonzero : plane.normalX ≠ 0 ∨ plane.normalY ≠ 0 := by
    by_contra bothZero
    push Not at bothZero
    simp [signedDistance, bothZero.1, bothZero.2] at distanceLt
  rcases normalNonzero with xNonzero | yNonzero
  · have xSquarePositive : 0 < plane.normalX ^ 2 := sq_pos_of_ne_zero xNonzero
    have ySquareNonnegative : 0 ≤ plane.normalY ^ 2 := sq_nonneg plane.normalY
    simp only [normalSquared]
    linarith
  · have xSquareNonnegative : 0 ≤ plane.normalX ^ 2 := sq_nonneg plane.normalX
    have ySquarePositive : 0 < plane.normalY ^ 2 := sq_pos_of_ne_zero yNonzero
    simp only [normalSquared]
    linarith

theorem boundaryAdvance_boundaryAmount
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) {start finish : Vec2 R}
    (normalPositive : 0 < normalSquared plane)
    (sameDistance : signedDistance plane finish = signedDistance plane start) :
    finish = boundaryAdvance plane start (boundaryAmount plane start finish) := by
  have distanceDelta :
      plane.normalX * (finish.x - start.x) +
        plane.normalY * (finish.y - start.y) = 0 := by
    simp only [signedDistance] at sameDistance
    linear_combination sameDistance
  have normalNonzero : normalSquared plane ≠ 0 := ne_of_gt normalPositive
  cases start with
  | mk startX startY =>
    cases finish with
    | mk finishX finishY =>
      simp only at distanceDelta
      simp only [boundaryAdvance, boundaryAmount]
      congr 1
      · field_simp [normalNonzero]
        simp only [normalSquared]
        linear_combination plane.normalX * distanceDelta
      · field_simp [normalNonzero]
        simp only [normalSquared]
        linear_combination plane.normalY * distanceDelta

theorem orientation_boundaryAdvance
    (plane : HalfPlane R) (start finish boundary : Vec2 R) (amount : R) :
    orientation start finish (boundaryAdvance plane boundary amount) =
      orientation start finish boundary +
        amount * (signedDistance plane finish - signedDistance plane start) := by
  simp only [orientation, boundaryAdvance, signedDistance]
  ring

theorem orientation_boundaryPoint_zero
    (plane : HalfPlane R) (current next : Vec2 R) :
    orientation current next (boundaryPoint plane current next) = 0 := by
  simp only [orientation, boundaryPoint, HalfPlaneIntersection.interpolatePoint]
  ring

theorem orderedBoundary_of_leaving_left_turn
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) (current next entry : Vec2 R)
    (currentInside : signedDistance plane current ≤ 0)
    (nextOutside : 0 < signedDistance plane next)
    (entryBoundary : signedDistance plane entry = 0)
    (entryLeftOfLeavingEdge : 0 ≤ orientation current next entry) :
    OrderedBoundary plane (boundaryPoint plane current next) entry := by
  have distanceLt : signedDistance plane current < signedDistance plane next := by linarith
  have normalPositive := normalSquared_pos_of_signedDistance_lt plane distanceLt
  have distanceDistinct : signedDistance plane current ≠ signedDistance plane next :=
    ne_of_lt distanceLt
  have exitBoundary :
      signedDistance plane (boundaryPoint plane current next) = 0 :=
    signedDistance_boundaryPoint plane current next distanceDistinct
  let amount := boundaryAmount plane (boundaryPoint plane current next) entry
  have entryRepresentation :
      entry = boundaryAdvance plane (boundaryPoint plane current next) amount := by
    apply boundaryAdvance_boundaryAmount plane normalPositive
    rw [entryBoundary, exitBoundary]
  have turnEq :
      orientation current next entry =
        amount * (signedDistance plane next - signedDistance plane current) := by
    rw [entryRepresentation, orientation_boundaryAdvance,
      orientation_boundaryPoint_zero]
    ring
  have productNonnegative :
      0 ≤ amount * (signedDistance plane next - signedDistance plane current) := by
    rw [← turnEq]
    exact entryLeftOfLeavingEdge
  have distanceGapPositive :
      0 < signedDistance plane next - signedDistance plane current := by linarith
  have amountNonnegative : 0 ≤ amount :=
    nonneg_of_mul_nonneg_left productNonnegative distanceGapPositive
  exact ⟨amount, amountNonnegative, entryRepresentation⟩

theorem orderedBoundary_of_convex_crossing_edges
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R)
    (leavingCurrent leavingNext enteringCurrent enteringNext : Vec2 R)
    (leavingCurrentInside : signedDistance plane leavingCurrent ≤ 0)
    (leavingNextOutside : 0 < signedDistance plane leavingNext)
    (enteringCurrentOutside : 0 < signedDistance plane enteringCurrent)
    (enteringNextInside : signedDistance plane enteringNext ≤ 0)
    (enteringCurrentLeft : 0 ≤ orientation leavingCurrent leavingNext enteringCurrent)
    (enteringNextLeft : 0 ≤ orientation leavingCurrent leavingNext enteringNext) :
    OrderedBoundary plane
      (boundaryPoint plane leavingCurrent leavingNext)
      (boundaryPoint plane enteringCurrent enteringNext) := by
  have enteringDistinct :
      signedDistance plane enteringCurrent ≠ signedDistance plane enteringNext := by
    linarith
  have entryBoundary :
      signedDistance plane (boundaryPoint plane enteringCurrent enteringNext) = 0 :=
    signedDistance_boundaryPoint plane enteringCurrent enteringNext enteringDistinct
  have parameterBounds := HalfPlaneIntersection.boundaryParameter_mem_Icc_of_outside_inside
    enteringCurrentOutside enteringNextInside
  have entryLeft :
      0 ≤ orientation leavingCurrent leavingNext
        (boundaryPoint plane enteringCurrent enteringNext) := by
    apply HalfPlaneIntersection.orientation_interpolate_third_nonneg
    · exact parameterBounds.1
    · exact parameterBounds.2
    · exact enteringCurrentLeft
    · exact enteringNextLeft
  exact orderedBoundary_of_leaving_left_turn plane leavingCurrent leavingNext
    (boundaryPoint plane enteringCurrent enteringNext)
    leavingCurrentInside leavingNextOutside entryBoundary entryLeft

theorem convex_crossing_seam_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R)
    (leavingCurrent leavingNext enteringCurrent enteringNext : Vec2 R)
    (leavingCurrentInside : signedDistance plane leavingCurrent ≤ 0)
    (leavingNextOutside : 0 < signedDistance plane leavingNext)
    (enteringCurrentOutside : 0 < signedDistance plane enteringCurrent)
    (enteringNextInside : signedDistance plane enteringNext ≤ 0)
    (enteringCurrentLeft : 0 ≤ orientation leavingCurrent leavingNext enteringCurrent)
    (enteringNextLeft : 0 ≤ orientation leavingCurrent leavingNext enteringNext) :
    0 ≤ orientation leavingCurrent
        (boundaryPoint plane leavingCurrent leavingNext)
        (boundaryPoint plane enteringCurrent enteringNext) ∧
      0 ≤ orientation
        (boundaryPoint plane leavingCurrent leavingNext)
        (boundaryPoint plane enteringCurrent enteringNext) enteringNext := by
  have ordered := orderedBoundary_of_convex_crossing_edges plane
    leavingCurrent leavingNext enteringCurrent enteringNext
    leavingCurrentInside leavingNextOutside enteringCurrentOutside enteringNextInside
    enteringCurrentLeft enteringNextLeft
  have leavingDistinct :
      signedDistance plane leavingCurrent ≠ signedDistance plane leavingNext := by
    linarith
  have exitBoundary :
      signedDistance plane (boundaryPoint plane leavingCurrent leavingNext) = 0 :=
    signedDistance_boundaryPoint plane leavingCurrent leavingNext leavingDistinct
  rcases ordered with ⟨amount, amountNonnegative, entryEq⟩
  rw [entryEq]
  exact ⟨
    orientation_to_ordered_boundary_nonneg plane leavingCurrent
      (boundaryPoint plane leavingCurrent leavingNext) amountNonnegative
      leavingCurrentInside exitBoundary,
    orientation_from_ordered_boundary_nonneg plane
      (boundaryPoint plane leavingCurrent leavingNext) enteringNext amountNonnegative
      enteringNextInside exitBoundary
  ⟩

theorem orderedBoundary_preserves_signedDistance
    [LinearOrder R]
    (plane : HalfPlane R) {start finish : Vec2 R}
    (ordered : OrderedBoundary plane start finish) :
    signedDistance plane finish = signedDistance plane start := by
  rcases ordered with ⟨amount, _, rfl⟩
  exact signedDistance_boundaryAdvance plane start amount

theorem orderedBoundary_seam_nonneg
    [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) {beforeExit exit entry afterEntry : Vec2 R}
    (ordered : OrderedBoundary plane exit entry)
    (exitBoundary : signedDistance plane exit = 0)
    (beforeInside : signedDistance plane beforeExit ≤ 0)
    (afterInside : signedDistance plane afterEntry ≤ 0) :
    0 ≤ orientation beforeExit exit entry ∧
      0 ≤ orientation exit entry afterEntry := by
  rcases ordered with ⟨amount, amountNonnegative, rfl⟩
  exact ⟨
    orientation_to_ordered_boundary_nonneg plane beforeExit exit amountNonnegative
      beforeInside exitBoundary,
    orientation_from_ordered_boundary_nonneg plane exit afterEntry amountNonnegative
      afterInside exitBoundary
  ⟩

end Sprawlens.HalfPlaneBoundaryGeometry
