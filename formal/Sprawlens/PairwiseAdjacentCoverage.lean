import Sprawlens.ConvexHalfPlaneSigns
import Sprawlens.HalfPlaneBoundaryGeometry
import Sprawlens.PairwiseBarycentricFlow
import Sprawlens.PolygonSupportSemantics

namespace Sprawlens.PairwiseAdjacentCoverage

open scoped BigOperators

open CanonicalClip
open ClipCompleteness
open ConvexHalfPlaneSigns
open ConvexClipContract
open ConvexClipConsequences
open CyclicBinaryBlocks
open ExactGeometry
open HalfPlaneBoundaryGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open PairwiseBarycentricFlow
open PairwiseClipCompleteness
open PolygonSupportSemantics
open SimpleRing
open StrictConvexContract
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A boundary point lying after `start` and before `finish` in the oriented
boundary order lies on their closed segment. -/
theorem onClosedSegment_of_orderedBoundary_chain
    (plane : HalfPlane R) {start middle finish : Vec2 R}
    (startToMiddle : OrderedBoundary plane start middle)
    (middleToFinish : OrderedBoundary plane middle finish) :
    OnClosedSegment start finish middle := by
  rcases startToMiddle with ⟨firstAmount, firstNonnegative, middleEq⟩
  rcases middleToFinish with ⟨secondAmount, secondNonnegative, finishEq⟩
  have finishFromStart :
      finish = boundaryAdvance plane start (firstAmount + secondAmount) := by
    rw [finishEq, middleEq]
    cases start
    simp only [boundaryAdvance]
    congr 1 <;> ring
  by_cases totalZero : firstAmount + secondAmount = 0
  · have firstZero : firstAmount = 0 := by linarith
    refine ⟨0, ⟨le_rfl, zero_le_one⟩, ?_⟩
    rw [middleEq, firstZero]
    simp [boundaryAdvance]
  · have totalPositive : 0 < firstAmount + secondAmount :=
      lt_of_le_of_ne (add_nonneg firstNonnegative secondNonnegative)
        (Ne.symm totalZero)
    refine ⟨firstAmount / (firstAmount + secondAmount),
      ⟨div_nonneg firstNonnegative (le_of_lt totalPositive), ?_⟩, ?_⟩
    · exact (div_le_one totalPositive).mpr (by linarith)
    · rw [middleEq, finishFromStart]
      apply vec2EquivProd.injective
      apply Prod.ext
      · change
          start.x - firstAmount * plane.normalY =
            start.x +
              ((start.x - (firstAmount + secondAmount) * plane.normalY) -
                start.x) * (firstAmount / (firstAmount + secondAmount))
        field_simp [ne_of_gt totalPositive]
        ring
      · change
          start.y + firstAmount * plane.normalX =
            start.y +
              ((start.y + (firstAmount + secondAmount) * plane.normalX) -
                start.y) * (firstAmount / (firstAmount + secondAmount))
        field_simp [ne_of_gt totalPositive]
        ring

/-- A boundary point on the left of an outside-to-inside edge occurs no later
than that edge's entering boundary point. -/
theorem orderedBoundary_to_entering_of_left_turn
    (plane : HalfPlane R) (target current next : Vec2 R)
    (targetBoundary : signedDistance plane target = 0)
    (currentOutside : 0 < signedDistance plane current)
    (nextInside : signedDistance plane next ≤ 0)
    (targetLeft : 0 ≤ orientation current next target) :
    OrderedBoundary plane target (boundaryPoint plane current next) := by
  have distanceLt : signedDistance plane next < signedDistance plane current := by
    linarith
  have normalPositive := normalSquared_pos_of_signedDistance_lt plane distanceLt
  have distanceDistinct : signedDistance plane current ≠ signedDistance plane next := by
    linarith
  have entryBoundary :
      signedDistance plane (boundaryPoint plane current next) = 0 :=
    signedDistance_boundaryPoint plane current next distanceDistinct
  let amount := boundaryAmount plane target (boundaryPoint plane current next)
  have entryRepresentation :
      boundaryPoint plane current next =
        boundaryAdvance plane target amount := by
    apply boundaryAdvance_boundaryAmount plane normalPositive
    rw [entryBoundary, targetBoundary]
  have entryCollinear :
      orientation current next (boundaryPoint plane current next) = 0 :=
    orientation_boundaryPoint_zero plane current next
  have turnEq :
      0 = orientation current next target +
        amount * (signedDistance plane next - signedDistance plane current) := by
    rw [← entryCollinear, entryRepresentation,
      orientation_boundaryAdvance]
  have distanceGapNegative :
      signedDistance plane next - signedDistance plane current < 0 := by
    linarith
  have amountNonnegative : 0 ≤ amount := by
    by_contra amountNegative
    have amountStrict : amount < 0 := lt_of_not_ge amountNegative
    have productPositive :
        0 < amount * (signedDistance plane next - signedDistance plane current) :=
      mul_pos_of_neg_of_neg amountStrict distanceGapNegative
    linarith
  exact ⟨amount, amountNonnegative, entryRepresentation⟩

/-- When the strictly outside vertices are exactly the materialized block
`1 .. count`, every all-pairs generator is covered by the retained vertices
and the two adjacent crossing edges. -/
theorem pairwiseGenerator_mem_boundaryHull_of_outsideBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countBound : count < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count)
    {point : Vec2 R}
    (generator : IsPairwiseClipGenerator plane vertex point) :
    point ∈ clipBoundaryGeneratorConvexRegion plane vertex := by
  rcases generator with retained | crossing
  · rcases retained with ⟨index, rfl, inside⟩
    exact subset_convexHull R _ (Or.inl ⟨index, rfl, inside⟩)
  · rcases crossing with ⟨first, second, rfl, crossingSigns⟩
    let zero : RingIndex extraVertices := ⟨0, by omega⟩
    let one : RingIndex extraVertices := ⟨1, by omega⟩
    let lastOutside : RingIndex extraVertices := ⟨count, countBound⟩
    have nextZero : nextIndex zero = one := by
      apply Fin.ext
      simp [zero, one, nextIndex]
    have zeroInside : signedDistance plane (vertex zero) ≤ 0 := by
      apply le_of_not_gt
      intro zeroOutside
      have block := (outsideIff zero).mp zeroOutside
      simp [zero] at block
    have oneOutside : 0 < signedDistance plane (vertex one) := by
      apply (outsideIff one).mpr
      constructor
      · simp [one]
      · change 1 ≤ count
        omega
    have lastOutsidePositive :
        0 < signedDistance plane (vertex lastOutside) := by
      apply (outsideIff lastOutside).mpr
      exact ⟨countPositive, le_rfl⟩
    have afterLastInside :
        signedDistance plane (vertex (nextIndex lastOutside)) ≤ 0 := by
      apply le_of_not_gt
      intro afterOutside
      have block := (outsideIff (nextIndex lastOutside)).mp afterOutside
      by_cases countNextBound : count + 1 < extraVertices + 3
      · have nextEq : nextIndex lastOutside =
            (⟨count + 1, countNextBound⟩ : RingIndex extraVertices) := by
          apply Fin.ext
          simp [lastOutside, nextIndex, Nat.mod_eq_of_lt countNextBound]
        rw [nextEq] at block
        change 0 < count + 1 ∧ count + 1 ≤ count at block
        omega
      · have countLast : count + 1 = extraVertices + 3 := by omega
        have nextEq : nextIndex lastOutside = zero := by
          apply Fin.ext
          simp [lastOutside, zero, nextIndex, countLast]
        rw [nextEq] at block
        simp [zero] at block
    have distanceDistinct :
        signedDistance plane (vertex first) ≠
          signedDistance plane (vertex second) := by
      rcases crossingSigns with insideOutside | outsideInside <;> linarith
    have targetBoundary :
        signedDistance plane (boundaryPoint plane
          (vertex first) (vertex second)) = 0 :=
      signedDistance_boundaryPoint plane (vertex first) (vertex second)
        distanceDistinct
    have pairwiseGenerator : IsPairwiseClipGenerator plane vertex
        (boundaryPoint plane (vertex first) (vertex second)) :=
      Or.inr ⟨first, second, rfl, crossingSigns⟩
    have targetInVertexHull :
        boundaryPoint plane (vertex first) (vertex second) ∈
          indexedVertexConvexRegion vertex :=
      (pairwiseGenerator_mem_inputConvexIntersection plane vertex
        pairwiseGenerator).1
    have targetInSupport :
        boundaryPoint plane (vertex first) (vertex second) ∈
          indexedPolygonRegion vertex := by
      rw [strictPolygon_supportSemanticsAdequate vertex ordered]
      exact targetInVertexHull
    let exit := boundaryPoint plane (vertex zero) (vertex one)
    let entry := boundaryPoint plane (vertex lastOutside)
      (vertex (nextIndex lastOutside))
    have exitToTarget : OrderedBoundary plane exit
        (boundaryPoint plane (vertex first) (vertex second)) := by
      apply orderedBoundary_of_leaving_left_turn plane
        (vertex zero) (vertex one)
        (boundaryPoint plane (vertex first) (vertex second))
        zeroInside oneOutside targetBoundary
      simpa [nextZero] using targetInSupport zero
    have targetToEntry : OrderedBoundary plane
        (boundaryPoint plane (vertex first) (vertex second)) entry := by
      apply orderedBoundary_to_entering_of_left_turn plane
        (boundaryPoint plane (vertex first) (vertex second))
        (vertex lastOutside) (vertex (nextIndex lastOutside))
        targetBoundary lastOutsidePositive afterLastInside
      exact targetInSupport lastOutside
    have targetOnSeam : OnClosedSegment exit entry
        (boundaryPoint plane (vertex first) (vertex second)) :=
      onClosedSegment_of_orderedBoundary_chain plane exitToTarget targetToEntry
    have exitGenerator : IsClipBoundaryGenerator plane vertex exit := by
      exact Or.inr ⟨zero, by simp [exit, nextZero], Or.inl ⟨
        zeroInside, oneOutside⟩⟩
    have entryGenerator : IsClipBoundaryGenerator plane vertex entry := by
      exact Or.inr ⟨lastOutside, rfl, Or.inr ⟨
        lastOutsidePositive, afterLastInside⟩⟩
    rcases targetOnSeam with ⟨parameter, parameterRange, targetEq⟩
    rw [targetEq, ← affineCombination_eq_interpolatePoint
      exit entry (1 - parameter) parameter (by ring)]
    exact (convex_convexHull R
      { candidate | IsClipBoundaryGenerator plane vertex candidate })
      (subset_convexHull R _ exitGenerator)
      (subset_convexHull R _ entryGenerator)
      (sub_nonneg.mpr parameterRange.2) parameterRange.1 (by ring)

/-- In the normalized mixed-sign materialization, the adjacent-edge generator
hull covers the complete all-pairs relaxation. -/
theorem pairwiseCovered_of_outsideBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countBound : count < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    pairwiseClipGeneratorConvexRegion plane vertex ⊆
      clipBoundaryGeneratorConvexRegion plane vertex := by
  unfold pairwiseClipGeneratorConvexRegion
  apply convexHull_min
  · intro point generator
    exact pairwiseGenerator_mem_boundaryHull_of_outsideBlock
      plane vertex ordered countPositive countBound outsideIff generator
  · exact convex_convexHull R _

/-- A normalized strict-convex mixed clipping instance has complete adjacent
boundary generators. -/
theorem boundaryGeneratorHullComplete_of_outsideBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countBound : count < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    BoundaryGeneratorHullComplete plane vertex := by
  apply (boundaryGeneratorHullComplete_iff_pairwiseCovered plane vertex
    (PairwiseBarycentricFlow.pairwiseGeneratorHullComplete
      plane vertex)).mpr
  exact pairwiseCovered_of_outsideBlock plane vertex ordered countPositive
    countBound outsideIff

/-- General single-half-plane completeness for every strict globally ordered
convex polygon, including no-cut, empty-cut, boundary, and singleton-side
cases. -/
theorem strictPolygon_boundaryGeneratorHullComplete
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    BoundaryGeneratorHullComplete plane vertex := by
  by_cases hasOutside : ∃ index, 0 < signedDistance plane (vertex index)
  · by_cases hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0
    · rcases outside_rotatedBlock plane vertex ordered hasOutside hasInside with
        ⟨positive, start, count, countPositive, countBound, blockIff⟩
      let rotated := rotateVertex start vertex
      have rotatedOrdered : IsStrictVertexOrderedConvexCCW rotated :=
        ordered.rotateVertex start
      have rotatedBlockIff : ∀ index,
          0 < signedDistance plane (rotated index) ↔
            0 < index.val ∧ index.val ≤ count := by
        intro index
        simpa [rotated, rotateVertex] using blockIff index
      have rotatedComplete :
          BoundaryGeneratorHullComplete plane rotated :=
        boundaryGeneratorHullComplete_of_outsideBlock plane rotated
          rotatedOrdered countPositive countBound rotatedBlockIff
      exact (boundaryGeneratorHullComplete_rotateVertex_iff
        plane start vertex).mp rotatedComplete
    · have allOutside : ∀ index,
          0 < signedDistance plane (vertex index) := by
        intro index
        exact lt_of_not_ge fun inside ↦ hasInside ⟨index, inside⟩
      exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
        plane vertex).mp (clipRegionComplete_of_all_pos
          plane vertex allOutside)
  · have allInside : ∀ index,
        signedDistance plane (vertex index) ≤ 0 := by
      intro index
      exact le_of_not_gt fun outside ↦ hasOutside ⟨index, outside⟩
    exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
      plane vertex).mp (clipRegionComplete_of_all_nonpos
        plane vertex allInside)

/-- Final executable-region theorem: one exact clipping step denotes exactly
the intersection of the strict input polygon's vertex hull and the closed
half-plane. -/
theorem strictPolygon_clipIndexedConvexRegion_eq
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane :=
  clipIndexedConvexRegion_eq_of_boundaryGeneratorHullComplete plane vertex
    (strictPolygon_boundaryGeneratorHullComplete plane vertex ordered)

end Sprawlens.PairwiseAdjacentCoverage
