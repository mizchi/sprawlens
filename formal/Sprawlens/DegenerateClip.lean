import Sprawlens.ListReclipClassification
import Sprawlens.WeakConvexHalfPlaneSigns

namespace Sprawlens.DegenerateClip

open ConvexClipConsequences
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneClipStep
open HalfPlaneIntersection
open ListReclipClassification
open Vec2Linear
open WeakConvexHalfPlaneSigns

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A clipping artifact below polygon dimension.  These states are not padded
with repeated vertices merely to satisfy a three-vertex ring API. -/
inductive DegenerateArtifact (R : Type u) where
  | empty
  | point (value : Vec2 R)
  | segment (start finish : Vec2 R)

/-- Materialized vertices used by the existing output-classification layer. -/
def DegenerateArtifact.points : DegenerateArtifact R → List (Vec2 R)
  | .empty => []
  | .point value => [value]
  | .segment start finish => [start, finish]

/-- Continuous point-set semantics of each lower-dimensional artifact. -/
def DegenerateArtifact.region : DegenerateArtifact R → Set (Vec2 R)
  | .empty => ∅
  | .point value => {value}
  | .segment start finish => { point | OnClosedSegment start finish point }

/-- Empty and point states have an executable exact half-plane step. -/
def clipPointArtifact
    (plane : HalfPlane R) (point : Vec2 R) : DegenerateArtifact R :=
  if signedDistance plane point ≤ 0 then .point point else .empty

/-- Exact segment clipping without coercing a lower-dimensional result into a
polygon. Boundary endpoint coincidences are normalized to point states. -/
def clipSegmentArtifact
    (plane : HalfPlane R) (start finish : Vec2 R) : DegenerateArtifact R :=
  let startDistance := signedDistance plane start
  let finishDistance := signedDistance plane finish
  match classify startDistance finishDistance with
  | .inside =>
      if start = finish then .point start else .segment start finish
  | .leaving =>
      if startDistance = 0 then .point start
      else .segment start (boundaryPoint plane start finish)
  | .entering =>
      if finishDistance = 0 then .point finish
      else .segment (boundaryPoint plane start finish) finish
  | .outside => .empty

/-- Total step on all lower-dimensional artifact states. -/
def clipDegenerateArtifact
    (plane : HalfPlane R) : DegenerateArtifact R → DegenerateArtifact R
  | .empty => .empty
  | .point value => clipPointArtifact plane value
  | .segment start finish => clipSegmentArtifact plane start finish

/-- Every lower-dimensional artifact maps directly into the existing
empty/point/segment output classification. -/
theorem outputReclassification_points (artifact : DegenerateArtifact R) :
    OutputReclassification artifact.points := by
  cases artifact with
  | empty => exact .empty
  | point value => exact .point value
  | segment start finish => exact .segment start finish

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem interpolatePoint_nested_from_start
    (start finish : Vec2 R) (outer inner : R) :
    interpolatePoint start (interpolatePoint start finish outer) inner =
      interpolatePoint start finish (outer * inner) := by
  apply vec2EquivProd.injective
  apply Prod.ext <;> simp [interpolatePoint] <;> ring_nf

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem interpolatePoint_nested_to_finish
    (start finish : Vec2 R) (outer inner : R) :
    interpolatePoint (interpolatePoint start finish outer) finish inner =
      interpolatePoint start finish (outer + (1 - outer) * inner) := by
  apply vec2EquivProd.injective
  apply Prod.ext <;> simp [interpolatePoint] <;> ring_nf

omit [LinearOrder R] [IsStrictOrderedRing R] in
@[simp] theorem interpolatePoint_self (point : Vec2 R) (parameter : R) :
    interpolatePoint point point parameter = point := by
  apply vec2EquivProd.injective
  apply Prod.ext <;> simp [interpolatePoint]

theorem onClosedSegment_self_iff (endpoint point : Vec2 R) :
    OnClosedSegment endpoint endpoint point ↔ point = endpoint := by
  constructor
  · rintro ⟨parameter, _, rfl⟩
    exact interpolatePoint_self endpoint parameter
  · rintro rfl
    exact ⟨0, by simp, by simp⟩

/-- A segment with two inside endpoints stays in the closed half-plane. -/
theorem segment_region_subset_halfPlane_of_endpoints_nonpos
    (plane : HalfPlane R) (start finish : Vec2 R)
    (startInside : signedDistance plane start ≤ 0)
    (finishInside : signedDistance plane finish ≤ 0) :
    (DegenerateArtifact.segment start finish).region ⊆ halfPlaneRegion plane := by
  intro point pointOnSegment
  change OnClosedSegment start finish point at pointOnSegment
  rcases pointOnSegment with ⟨parameter, parameterBounds, pointEq⟩
  exact signedDistance_nonpos_of_between_nonpos
    plane start finish point startInside finishInside
      ⟨parameter, parameterBounds.1, parameterBounds.2, pointEq⟩

/-- A segment with two strict outside endpoints misses the closed half-plane. -/
theorem segment_region_inter_halfPlane_eq_empty_of_endpoints_pos
    (plane : HalfPlane R) (start finish : Vec2 R)
    (startOutside : 0 < signedDistance plane start)
    (finishOutside : 0 < signedDistance plane finish) :
    (DegenerateArtifact.segment start finish).region ∩ halfPlaneRegion plane = ∅ := by
  apply Set.eq_empty_iff_forall_notMem.mpr
  intro point member
  have pointOnSegment : OnClosedSegment start finish point := member.1
  rcases pointOnSegment with ⟨parameter, parameterBounds, pointEq⟩
  have pointInside : signedDistance plane point ≤ 0 := member.2
  have pointOutside := signedDistance_pos_of_between_pos
    plane start finish point startOutside finishOutside
      ⟨parameter, parameterBounds.1, parameterBounds.2, pointEq⟩
  exact (not_lt_of_ge pointInside) pointOutside

/-- In the inside-to-outside case, the exact intersection is the segment from
the retained endpoint to the affine boundary crossing. -/
theorem segment_region_inter_halfPlane_eq_leaving
    (plane : HalfPlane R) (start finish : Vec2 R)
    (startInside : signedDistance plane start ≤ 0)
    (finishOutside : 0 < signedDistance plane finish) :
    (DegenerateArtifact.segment start finish).region ∩ halfPlaneRegion plane =
      (DegenerateArtifact.segment start
        (boundaryPoint plane start finish)).region := by
  let startDistance := signedDistance plane start
  let finishDistance := signedDistance plane finish
  let crossingParameter := boundaryParameter startDistance finishDistance
  have distanceDistinct : startDistance ≠ finishDistance := by
    dsimp [startDistance, finishDistance]
    linarith
  have crossingDistance :
      signedDistance plane (boundaryPoint plane start finish) = 0 :=
    signedDistance_boundaryPoint plane start finish distanceDistinct
  have crossingBounds : crossingParameter ∈ Set.Icc (0 : R) 1 :=
    boundaryParameter_mem_Icc_of_inside_outside startInside finishOutside
  by_cases startBoundary : startDistance = 0
  · have crossingEqStart : boundaryPoint plane start finish = start :=
      boundaryPoint_eq_current_of_current_boundary
        plane start finish startBoundary
    rw [crossingEqStart]
    ext point
    constructor
    · rintro ⟨⟨parameter, parameterBounds, pointEq⟩, pointInside⟩
      have distanceEq : signedDistance plane point =
          finishDistance * parameter := by
        rw [pointEq, signedDistance_interpolatePoint]
        simp [interpolateDistance, startDistance, finishDistance, startBoundary]
      have parameterZero : parameter = 0 := by
        have finishPositive : 0 < finishDistance := finishOutside
        have productNonpositive : finishDistance * parameter ≤ 0 := by
          change signedDistance plane point ≤ 0 at pointInside
          linarith [pointInside, distanceEq]
        have parameterNonpositive : parameter ≤ 0 :=
          (mul_nonpos_iff_pos_imp_nonpos.mp productNonpositive).1 finishPositive
        exact le_antisymm parameterNonpositive parameterBounds.1
      have pointIsStart : point = start := by
        rw [pointEq, parameterZero]
        simp
      exact (onClosedSegment_self_iff start point).mpr pointIsStart
    · intro pointOnSingleton
      have pointEq := (onClosedSegment_self_iff start point).mp pointOnSingleton
      subst point
      exact ⟨onClosedSegment_start start finish, startInside⟩
  · have startStrictInside : startDistance < 0 := by
      dsimp [startDistance]
      exact lt_of_le_of_ne startInside startBoundary
    have denominatorNegative : startDistance - finishDistance < 0 := by
      dsimp [startDistance, finishDistance]
      linarith
    have crossingPositive : 0 < crossingParameter := by
      dsimp [crossingParameter]
      exact div_pos_of_neg_of_neg startStrictInside denominatorNegative
    ext point
    constructor
    · rintro ⟨⟨parameter, parameterBounds, pointEq⟩, pointInside⟩
      have parameterAtMostCrossing : parameter ≤ crossingParameter := by
        dsimp [crossingParameter]
        rw [boundaryParameter, le_div_iff_of_neg denominatorNegative]
        change signedDistance plane point ≤ 0 at pointInside
        rw [pointEq, signedDistance_interpolatePoint,
          interpolateDistance] at pointInside
        dsimp [startDistance, finishDistance] at denominatorNegative ⊢
        nlinarith
      let localParameter := parameter / crossingParameter
      have localBounds : localParameter ∈ Set.Icc (0 : R) 1 := by
        constructor
        · exact div_nonneg parameterBounds.1 (le_of_lt crossingPositive)
        · exact (div_le_one crossingPositive).mpr parameterAtMostCrossing
      refine ⟨localParameter, localBounds, ?_⟩
      rw [boundaryPoint]
      rw [interpolatePoint_nested_from_start]
      have crossingNonzero : crossingParameter ≠ 0 := ne_of_gt crossingPositive
      have parameterIdentity : crossingParameter * localParameter = parameter := by
        dsimp [localParameter]
        field_simp
      rw [parameterIdentity]
      exact pointEq
    · intro pointOnOutput
      exact ⟨
        (by
          rcases pointOnOutput with ⟨parameter, parameterBounds, pointEq⟩
          refine ⟨crossingParameter * parameter, ?_, ?_⟩
          · exact ⟨mul_nonneg crossingBounds.1 parameterBounds.1,
              mul_le_one₀ crossingBounds.2 parameterBounds.1
                parameterBounds.2⟩
          · rw [boundaryPoint] at pointEq
            rw [interpolatePoint_nested_from_start] at pointEq
            exact pointEq),
        segment_region_subset_halfPlane_of_endpoints_nonpos
          plane start (boundaryPoint plane start finish)
          startInside (le_of_eq crossingDistance) pointOnOutput
      ⟩

/-- In the outside-to-inside case, the exact intersection is the segment from
the affine boundary crossing to the retained endpoint. -/
theorem segment_region_inter_halfPlane_eq_entering
    (plane : HalfPlane R) (start finish : Vec2 R)
    (startOutside : 0 < signedDistance plane start)
    (finishInside : signedDistance plane finish ≤ 0) :
    (DegenerateArtifact.segment start finish).region ∩ halfPlaneRegion plane =
      (DegenerateArtifact.segment
        (boundaryPoint plane start finish) finish).region := by
  let startDistance := signedDistance plane start
  let finishDistance := signedDistance plane finish
  let crossingParameter := boundaryParameter startDistance finishDistance
  have distanceDistinct : startDistance ≠ finishDistance := by
    dsimp [startDistance, finishDistance]
    linarith
  have crossingDistance :
      signedDistance plane (boundaryPoint plane start finish) = 0 :=
    signedDistance_boundaryPoint plane start finish distanceDistinct
  have crossingBounds : crossingParameter ∈ Set.Icc (0 : R) 1 :=
    boundaryParameter_mem_Icc_of_outside_inside startOutside finishInside
  have startNotBoundary : startDistance ≠ 0 := by
    dsimp [startDistance]
    linarith
  by_cases finishBoundary : finishDistance = 0
  · have crossingEqFinish : boundaryPoint plane start finish = finish :=
      boundaryPoint_eq_next_of_next_boundary
        plane start finish startNotBoundary finishBoundary
    rw [crossingEqFinish]
    ext point
    constructor
    · rintro ⟨⟨parameter, parameterBounds, pointEq⟩, pointInside⟩
      have distanceEq : signedDistance plane point =
          startDistance * (1 - parameter) := by
        rw [pointEq, signedDistance_interpolatePoint]
        simp [interpolateDistance, startDistance, finishDistance, finishBoundary]
        ring
      have remainingNonpositive : 1 - parameter ≤ 0 := by
        have productNonpositive : startDistance * (1 - parameter) ≤ 0 := by
          change signedDistance plane point ≤ 0 at pointInside
          linarith [pointInside, distanceEq]
        exact (mul_nonpos_iff_pos_imp_nonpos.mp productNonpositive).1
          (by simpa [startDistance] using startOutside)
      have parameterOne : parameter = 1 := by
        linarith [parameterBounds.2]
      have pointIsFinish : point = finish := by
        rw [pointEq, parameterOne]
        simp
      exact (onClosedSegment_self_iff finish point).mpr pointIsFinish
    · intro pointOnSingleton
      have pointEq := (onClosedSegment_self_iff finish point).mp pointOnSingleton
      subst point
      exact ⟨onClosedSegment_finish start finish, finishInside⟩
  · have finishStrictInside : finishDistance < 0 := by
      dsimp [finishDistance]
      exact lt_of_le_of_ne finishInside finishBoundary
    have denominatorPositive : 0 < startDistance - finishDistance := by
      dsimp [startDistance, finishDistance]
      linarith
    have crossingBelowOne : crossingParameter < 1 := by
      dsimp [crossingParameter]
      rw [boundaryParameter, div_lt_iff₀ denominatorPositive]
      linarith
    have remainingPositive : 0 < 1 - crossingParameter :=
      sub_pos.mpr crossingBelowOne
    ext point
    constructor
    · rintro ⟨⟨parameter, parameterBounds, pointEq⟩, pointInside⟩
      have crossingAtMostParameter : crossingParameter ≤ parameter := by
        dsimp [crossingParameter]
        rw [boundaryParameter, div_le_iff₀ denominatorPositive]
        change signedDistance plane point ≤ 0 at pointInside
        rw [pointEq, signedDistance_interpolatePoint,
          interpolateDistance] at pointInside
        dsimp [startDistance, finishDistance] at denominatorPositive ⊢
        nlinarith
      let localParameter :=
        (parameter - crossingParameter) / (1 - crossingParameter)
      have localBounds : localParameter ∈ Set.Icc (0 : R) 1 := by
        constructor
        · exact div_nonneg (sub_nonneg.mpr crossingAtMostParameter)
            (le_of_lt remainingPositive)
        · rw [div_le_one remainingPositive]
          linarith [parameterBounds.2]
      refine ⟨localParameter, localBounds, ?_⟩
      rw [boundaryPoint]
      rw [interpolatePoint_nested_to_finish]
      have remainingNonzero : 1 - crossingParameter ≠ 0 :=
        ne_of_gt remainingPositive
      have parameterIdentity :
          crossingParameter + (1 - crossingParameter) * localParameter =
            parameter := by
        dsimp [localParameter]
        field_simp
        ring
      rw [parameterIdentity]
      exact pointEq
    · intro pointOnOutput
      exact ⟨
        (by
          rcases pointOnOutput with ⟨parameter, parameterBounds, pointEq⟩
          let sourceParameter :=
            crossingParameter + (1 - crossingParameter) * parameter
          have scaledNonnegative :
              0 ≤ (1 - crossingParameter) * parameter :=
            mul_nonneg (sub_nonneg.mpr crossingBounds.2) parameterBounds.1
          have scaledAtMostRemaining :
              (1 - crossingParameter) * parameter ≤
                1 - crossingParameter := by
            simpa using mul_le_mul_of_nonneg_left parameterBounds.2
              (sub_nonneg.mpr crossingBounds.2)
          have sourceBounds : sourceParameter ∈ Set.Icc (0 : R) 1 := by
            dsimp [sourceParameter]
            constructor <;> linarith [crossingBounds.1]
          refine ⟨sourceParameter, sourceBounds, ?_⟩
          rw [boundaryPoint] at pointEq
          rw [interpolatePoint_nested_to_finish] at pointEq
          exact pointEq),
        segment_region_subset_halfPlane_of_endpoints_nonpos
          plane (boundaryPoint plane start finish) finish
          (le_of_eq crossingDistance) finishInside pointOnOutput
      ⟩

/-- The executable segment-state step denotes exactly the continuous segment
intersection for all endpoint sign and boundary cases. -/
theorem clipSegmentArtifact_region
    (plane : HalfPlane R) (start finish : Vec2 R) :
    (clipSegmentArtifact plane start finish).region =
      (DegenerateArtifact.segment start finish).region ∩
        halfPlaneRegion plane := by
  cases classified : classify (signedDistance plane start)
      (signedDistance plane finish) with
  | inside =>
      have conditions := classify_inside_iff.mp classified
      have segmentInside := segment_region_subset_halfPlane_of_endpoints_nonpos
        plane start finish conditions.1 conditions.2
      rw [Set.inter_eq_left.mpr segmentInside]
      by_cases samePoint : start = finish
      · have sameClass : classify (signedDistance plane start)
            (signedDistance plane start) = .inside :=
          classify_inside_iff.mpr ⟨conditions.1,
            by simpa [samePoint] using conditions.2⟩
        subst finish
        ext point
        simp [clipSegmentArtifact, sameClass, DegenerateArtifact.region,
          onClosedSegment_self_iff]
      · simp [clipSegmentArtifact, classified, samePoint]
  | leaving =>
      have conditions := classify_leaving_iff.mp classified
      have exactIntersection := segment_region_inter_halfPlane_eq_leaving
        plane start finish conditions.1 conditions.2
      by_cases startBoundary : signedDistance plane start = 0
      · have boundaryClass : classify 0 (signedDistance plane finish) = .leaving :=
          classify_leaving_iff.mpr ⟨le_rfl, conditions.2⟩
        have crossingEqStart := boundaryPoint_eq_current_of_current_boundary
          plane start finish startBoundary
        rw [exactIntersection, crossingEqStart]
        ext point
        simp [clipSegmentArtifact, startBoundary, boundaryClass,
          DegenerateArtifact.region, onClosedSegment_self_iff]
      · simp [clipSegmentArtifact, classified, startBoundary]
        exact exactIntersection.symm
  | entering =>
      have conditions := classify_entering_iff.mp classified
      have exactIntersection := segment_region_inter_halfPlane_eq_entering
        plane start finish conditions.1 conditions.2
      have startNotBoundary : signedDistance plane start ≠ 0 := by
        linarith [conditions.1]
      by_cases finishBoundary : signedDistance plane finish = 0
      · have boundaryClass : classify (signedDistance plane start) 0 = .entering :=
          classify_entering_iff.mpr ⟨conditions.1, le_rfl⟩
        have crossingEqFinish := boundaryPoint_eq_next_of_next_boundary
          plane start finish startNotBoundary finishBoundary
        rw [exactIntersection, crossingEqFinish]
        ext point
        simp [clipSegmentArtifact, finishBoundary, boundaryClass,
          DegenerateArtifact.region, onClosedSegment_self_iff]
      · simp [clipSegmentArtifact, classified, finishBoundary]
        exact exactIntersection.symm
  | outside =>
      have conditions := classify_outside_iff.mp classified
      have exactIntersection :=
        segment_region_inter_halfPlane_eq_empty_of_endpoints_pos
          plane start finish conditions.1 conditions.2
      simp [clipSegmentArtifact, classified]
      exact exactIntersection.symm

omit [IsStrictOrderedRing R] in
/-- The point-state step denotes exactly intersection with the next closed
half-plane. -/
theorem clipPointArtifact_region
    (plane : HalfPlane R) (point : Vec2 R) :
    (clipPointArtifact plane point).region =
      (DegenerateArtifact.point point).region ∩ halfPlaneRegion plane := by
  by_cases inside : signedDistance plane point ≤ 0
  · simp [clipPointArtifact, inside, DegenerateArtifact.region,
      halfPlaneRegion]
  · have outside : 0 < signedDistance plane point := lt_of_not_ge inside
    simp [clipPointArtifact, inside, DegenerateArtifact.region,
      halfPlaneRegion]

/-- Every lower-dimensional state has a total exact step. Empty remains
empty, and point or segment states denote their set-theoretic intersection
with the next half-plane. -/
theorem clipDegenerateArtifact_region
    (plane : HalfPlane R) (artifact : DegenerateArtifact R) :
    (clipDegenerateArtifact plane artifact).region =
      artifact.region ∩ halfPlaneRegion plane := by
  cases artifact with
  | empty => simp [clipDegenerateArtifact, DegenerateArtifact.region]
  | point value => exact clipPointArtifact_region plane value
  | segment start finish => exact clipSegmentArtifact_region plane start finish

/-- Canonical lower-dimensional artifacts contain no duplicated segment
endpoints. -/
def DegenerateArtifact.Normalized : DegenerateArtifact R → Prop
  | .empty => True
  | .point _ => True
  | .segment start finish => start ≠ finish

omit [IsStrictOrderedRing R] in
theorem clipPointArtifact_normalized
    (plane : HalfPlane R) (point : Vec2 R) :
    (clipPointArtifact plane point).Normalized := by
  by_cases inside : signedDistance plane point ≤ 0 <;>
    simp [clipPointArtifact, inside, DegenerateArtifact.Normalized]

theorem clipSegmentArtifact_normalized
    (plane : HalfPlane R) (start finish : Vec2 R) :
    (clipSegmentArtifact plane start finish).Normalized := by
  cases classified : classify (signedDistance plane start)
      (signedDistance plane finish) with
  | inside =>
      have conditions := classify_inside_iff.mp classified
      by_cases samePoint : start = finish
      · have sameClass : classify (signedDistance plane start)
            (signedDistance plane start) = .inside :=
          classify_inside_iff.mpr ⟨conditions.1,
            by simpa [samePoint] using conditions.2⟩
        subst finish
        simp [clipSegmentArtifact, sameClass, DegenerateArtifact.Normalized]
      · simp [clipSegmentArtifact, classified, samePoint,
          DegenerateArtifact.Normalized]
  | leaving =>
      have conditions := classify_leaving_iff.mp classified
      by_cases startBoundary : signedDistance plane start = 0
      · have boundaryClass : classify 0 (signedDistance plane finish) = .leaving :=
          classify_leaving_iff.mpr ⟨le_rfl, conditions.2⟩
        simp [clipSegmentArtifact, startBoundary, boundaryClass,
          DegenerateArtifact.Normalized]
      · have distanceDistinct : signedDistance plane start ≠
            signedDistance plane finish := by linarith [conditions.2]
        have crossingDistance : signedDistance plane
            (boundaryPoint plane start finish) = 0 :=
          signedDistance_boundaryPoint plane start finish distanceDistinct
        have pointsDistinct : start ≠ boundaryPoint plane start finish := by
          intro equalPoints
          have startIsBoundary : signedDistance plane start = 0 := by
            rw [equalPoints]
            exact crossingDistance
          exact startBoundary startIsBoundary
        simpa [clipSegmentArtifact, classified, startBoundary,
          DegenerateArtifact.Normalized] using pointsDistinct
  | entering =>
      have conditions := classify_entering_iff.mp classified
      by_cases finishBoundary : signedDistance plane finish = 0
      · have boundaryClass : classify (signedDistance plane start) 0 = .entering :=
          classify_entering_iff.mpr ⟨conditions.1, le_rfl⟩
        simp [clipSegmentArtifact, finishBoundary, boundaryClass,
          DegenerateArtifact.Normalized]
      · have distanceDistinct : signedDistance plane start ≠
            signedDistance plane finish := by linarith [conditions.1]
        have crossingDistance : signedDistance plane
            (boundaryPoint plane start finish) = 0 :=
          signedDistance_boundaryPoint plane start finish distanceDistinct
        have pointsDistinct : boundaryPoint plane start finish ≠ finish := by
          intro equalPoints
          have finishIsBoundary : signedDistance plane finish = 0 := by
            rw [← equalPoints]
            exact crossingDistance
          exact finishBoundary finishIsBoundary
        simpa [clipSegmentArtifact, classified, finishBoundary,
          DegenerateArtifact.Normalized] using pointsDistinct
  | outside =>
      simp [clipSegmentArtifact, classified, DegenerateArtifact.Normalized]

theorem clipDegenerateArtifact_normalized
    (plane : HalfPlane R) (artifact : DegenerateArtifact R) :
    (clipDegenerateArtifact plane artifact).Normalized := by
  cases artifact with
  | empty => simp [clipDegenerateArtifact, DegenerateArtifact.Normalized]
  | point value => exact clipPointArtifact_normalized plane value
  | segment start finish => exact clipSegmentArtifact_normalized plane start finish

/-- Sequentially apply any finite half-plane list to a lower-dimensional
artifact. -/
def clipDegenerateMany
    (planes : List (HalfPlane R)) (artifact : DegenerateArtifact R) :
    DegenerateArtifact R :=
  planes.foldl (fun current plane ↦ clipDegenerateArtifact plane current) artifact

omit [IsStrictOrderedRing R] in
theorem constrainedRegion_singleton
    (region : Set (Vec2 R)) (plane : HalfPlane R) :
    constrainedRegion region [plane] = region ∩ halfPlaneRegion plane := by
  ext point
  simp [constrainedRegion]

/-- Finite lower-dimensional execution is exactly the declarative
intersection with every supplied half-plane. -/
theorem clipDegenerateMany_region
    (planes : List (HalfPlane R)) (artifact : DegenerateArtifact R) :
    (clipDegenerateMany planes artifact).region =
      constrainedRegion artifact.region planes := by
  induction planes generalizing artifact with
  | nil => simp [clipDegenerateMany]
  | cons plane rest inductionHypothesis =>
      rw [clipDegenerateMany, List.foldl_cons]
      change (clipDegenerateMany rest
        (clipDegenerateArtifact plane artifact)).region = _
      rw [inductionHypothesis, clipDegenerateArtifact_region]
      rw [← constrainedRegion_singleton]
      rw [← constrainedRegion_append]
      rfl

theorem clipDegenerateMany_normalized
    (planes : List (HalfPlane R)) (artifact : DegenerateArtifact R)
    (initialNormalized : artifact.Normalized) :
    (clipDegenerateMany planes artifact).Normalized := by
  induction planes generalizing artifact with
  | nil => simpa [clipDegenerateMany] using initialNormalized
  | cons plane rest inductionHypothesis =>
      rw [clipDegenerateMany, List.foldl_cons]
      exact inductionHypothesis _
        (clipDegenerateArtifact_normalized plane artifact)

/-- Every reclassified output is either a concrete lower-dimensional state
that can continue through `clipDegenerateMany`, or a certified polygon. -/
theorem OutputReclassification.degenerate_or_certifiedPolygon
    {points : List (Vec2 R)}
    (classified : OutputReclassification points) :
    (∃ artifact : DegenerateArtifact R, artifact.points = points) ∨
      (∃ lengthAtLeastThree : 3 ≤ points.length,
        ReclipCertificate.IsReclipCertified
          (listVertex points lengthAtLeastThree)) := by
  cases classified with
  | empty => exact Or.inl ⟨.empty, rfl⟩
  | point value => exact Or.inl ⟨.point value, rfl⟩
  | segment start finish => exact Or.inl ⟨.segment start finish, rfl⟩
  | polygon points lengthAtLeastThree certified =>
      exact Or.inr ⟨lengthAtLeastThree, certified⟩

/-- Once dispatch selects a lower-dimensional state, any finite continuation
remains exhaustively classified without constructing a synthetic polygon. -/
theorem clipDegenerateMany_outputReclassification
    (planes : List (HalfPlane R)) (artifact : DegenerateArtifact R) :
    OutputReclassification (clipDegenerateMany planes artifact).points :=
  outputReclassification_points _

end Sprawlens.DegenerateClip
