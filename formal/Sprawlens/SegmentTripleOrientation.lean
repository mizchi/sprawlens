import Sprawlens.HalfPlaneClipPoints

namespace Sprawlens.SegmentTripleOrientation

open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Every choice of one endpoint from each oriented segment forms a weak left turn. -/
def EndpointTriplesCCW
    (aStart aFinish bStart bFinish cStart cFinish : Vec2 R) : Prop :=
  ∀ a ∈ [aStart, aFinish], ∀ b ∈ [bStart, bFinish], ∀ c ∈ [cStart, cFinish],
    0 ≤ orientation a b c

/-- Pairwise edge support needed when two output points come from the same chunk. -/
def SegmentPairCCW
    (first second : Vec2 R × Vec2 R) : Prop :=
  (∀ point ∈ [second.1, second.2],
      0 ≤ orientation first.1 first.2 point) ∧
    ∀ point ∈ [first.1, first.2],
      0 ≤ orientation point second.1 second.2

def SegmentTripleCCW
    (first second third : Vec2 R × Vec2 R) : Prop :=
  EndpointTriplesCCW
    first.1 first.2 second.1 second.2 third.1 third.2

/-- Two points occur in the forward parameter order of one oriented segment. -/
def InSegmentOrder (start finish first second : Vec2 R) : Prop :=
  ∃ firstParameter secondParameter,
    firstParameter ≤ secondParameter ∧
      first = interpolatePoint start finish firstParameter ∧
      second = interpolatePoint start finish secondParameter

theorem outputPoints_pairwise_inSegmentOrder
    (plane : HalfPlane R) (start finish : Vec2 R) :
    (outputPoints plane start finish).Pairwise (InSegmentOrder start finish) := by
  rw [outputPoints_eq_parameter_map, List.pairwise_map]
  exact (outputParameters_pairwise plane start finish).imp fun {firstParameter secondParameter}
      ordered =>
    ⟨firstParameter, secondParameter, ordered, rfl, rfl⟩

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem orientation_two_on_same_segment_first
    (start finish c : Vec2 R) (firstParameter secondParameter : R) :
    orientation
      (interpolatePoint start finish firstParameter)
      (interpolatePoint start finish secondParameter)
      c =
      (secondParameter - firstParameter) * orientation start finish c := by
  simp only [orientation, interpolatePoint]
  ring

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem orientation_two_on_same_segment_last
    (a start finish : Vec2 R) (firstParameter secondParameter : R) :
    orientation a
      (interpolatePoint start finish firstParameter)
      (interpolatePoint start finish secondParameter) =
      (secondParameter - firstParameter) * orientation a start finish := by
  simp only [orientation, interpolatePoint]
  ring

theorem orientation_two_on_same_segment_first_nonneg
    (start finish c first second : Vec2 R)
    (ordered : InSegmentOrder start finish first second)
    (cLeft : 0 ≤ orientation start finish c) :
    0 ≤ orientation first second c := by
  rcases ordered with ⟨firstParameter, secondParameter, parameterOrder, rfl, rfl⟩
  rw [orientation_two_on_same_segment_first]
  exact mul_nonneg (sub_nonneg.mpr parameterOrder) cLeft

theorem orientation_two_on_same_segment_last_nonneg
    (a start finish first second : Vec2 R)
    (ordered : InSegmentOrder start finish first second)
    (aLeft : 0 ≤ orientation a start finish) :
    0 ≤ orientation a first second := by
  rcases ordered with ⟨firstParameter, secondParameter, parameterOrder, rfl, rfl⟩
  rw [orientation_two_on_same_segment_last]
  exact mul_nonneg (sub_nonneg.mpr parameterOrder) aLeft

theorem orientation_nonneg_two_from_first_segment
    (firstStart firstFinish secondStart secondFinish first middle last : Vec2 R)
    (firstMiddleOrder : InSegmentOrder firstStart firstFinish first middle)
    (lastOnSecond : OnClosedSegment secondStart secondFinish last)
    (pair : SegmentPairCCW
      (firstStart, firstFinish) (secondStart, secondFinish)) :
    0 ≤ orientation first middle last := by
  rcases lastOnSecond with ⟨parameter, parameterRange, rfl⟩
  apply orientation_two_on_same_segment_first_nonneg
    firstStart firstFinish _ first middle firstMiddleOrder
  exact orientation_interpolate_third_nonneg
    firstStart firstFinish secondStart secondFinish
    parameterRange.1 parameterRange.2
    (pair.1 secondStart (by simp))
    (pair.1 secondFinish (by simp))

theorem orientation_nonneg_two_from_second_segment
    (firstStart firstFinish secondStart secondFinish first middle last : Vec2 R)
    (firstOnFirst : OnClosedSegment firstStart firstFinish first)
    (middleLastOrder : InSegmentOrder secondStart secondFinish middle last)
    (pair : SegmentPairCCW
      (firstStart, firstFinish) (secondStart, secondFinish)) :
    0 ≤ orientation first middle last := by
  rcases firstOnFirst with ⟨parameter, parameterRange, rfl⟩
  apply orientation_two_on_same_segment_last_nonneg
    _ secondStart secondFinish middle last middleLastOrder
  exact orientation_interpolate_first_nonneg
    firstStart firstFinish secondStart secondFinish
    parameterRange.1 parameterRange.2
    (pair.2 firstStart (by simp))
    (pair.2 firstFinish (by simp))

omit [IsStrictOrderedRing R] in
theorem orientation_three_on_same_segment
    (start finish first second third : Vec2 R)
    (firstOnSegment : OnClosedSegment start finish first)
    (secondOnSegment : OnClosedSegment start finish second)
    (thirdOnSegment : OnClosedSegment start finish third) :
    orientation first second third = 0 := by
  rcases firstOnSegment with ⟨firstParameter, _, rfl⟩
  rcases secondOnSegment with ⟨secondParameter, _, rfl⟩
  rcases thirdOnSegment with ⟨thirdParameter, _, rfl⟩
  simp only [orientation, interpolatePoint]
  ring

/-- Convex combinations on three segments preserve the endpoint triple orientation contract. -/
theorem orientation_interpolate_three_nonneg
    (aStart aFinish bStart bFinish cStart cFinish : Vec2 R)
    {aParameter bParameter cParameter : R}
    (aRange : aParameter ∈ Set.Icc 0 1)
    (bRange : bParameter ∈ Set.Icc 0 1)
    (cRange : cParameter ∈ Set.Icc 0 1)
    (endpoints : EndpointTriplesCCW
      aStart aFinish bStart bFinish cStart cFinish) :
    0 ≤ orientation
      (interpolatePoint aStart aFinish aParameter)
      (interpolatePoint bStart bFinish bParameter)
      (interpolatePoint cStart cFinish cParameter) := by
  apply orientation_interpolate_third_nonneg
    (parameterNonnegative := cRange.1)
    (parameterAtMostOne := cRange.2)
  · apply orientation_interpolate_second_nonneg
      (parameterNonnegative := bRange.1)
      (parameterAtMostOne := bRange.2)
    · apply orientation_interpolate_first_nonneg
        (parameterNonnegative := aRange.1)
        (parameterAtMostOne := aRange.2)
      · exact endpoints aStart (by simp) bStart (by simp) cStart (by simp)
      · exact endpoints aFinish (by simp) bStart (by simp) cStart (by simp)
    · apply orientation_interpolate_first_nonneg
        (parameterNonnegative := aRange.1)
        (parameterAtMostOne := aRange.2)
      · exact endpoints aStart (by simp) bFinish (by simp) cStart (by simp)
      · exact endpoints aFinish (by simp) bFinish (by simp) cStart (by simp)
  · apply orientation_interpolate_second_nonneg
      (parameterNonnegative := bRange.1)
      (parameterAtMostOne := bRange.2)
    · apply orientation_interpolate_first_nonneg
        (parameterNonnegative := aRange.1)
        (parameterAtMostOne := aRange.2)
      · exact endpoints aStart (by simp) bStart (by simp) cFinish (by simp)
      · exact endpoints aFinish (by simp) bStart (by simp) cFinish (by simp)
    · apply orientation_interpolate_first_nonneg
        (parameterNonnegative := aRange.1)
        (parameterAtMostOne := aRange.2)
      · exact endpoints aStart (by simp) bFinish (by simp) cFinish (by simp)
      · exact endpoints aFinish (by simp) bFinish (by simp) cFinish (by simp)

theorem orientation_nonneg_of_onClosedSegments
    (aStart aFinish bStart bFinish cStart cFinish a b c : Vec2 R)
    (aOnSegment : OnClosedSegment aStart aFinish a)
    (bOnSegment : OnClosedSegment bStart bFinish b)
    (cOnSegment : OnClosedSegment cStart cFinish c)
    (endpoints : EndpointTriplesCCW
      aStart aFinish bStart bFinish cStart cFinish) :
    0 ≤ orientation a b c := by
  rcases aOnSegment with ⟨aParameter, aRange, rfl⟩
  rcases bOnSegment with ⟨bParameter, bRange, rfl⟩
  rcases cOnSegment with ⟨cParameter, cRange, rfl⟩
  exact orientation_interpolate_three_nonneg
    aStart aFinish bStart bFinish cStart cFinish
    aRange bRange cRange endpoints

theorem orientation_nonneg_of_emitted_on_ordered_edges
    (plane : HalfPlane R)
    (aStart aFinish bStart bFinish cStart cFinish a b c : Vec2 R)
    (aEmitted : a ∈ outputPoints plane aStart aFinish)
    (bEmitted : b ∈ outputPoints plane bStart bFinish)
    (cEmitted : c ∈ outputPoints plane cStart cFinish)
    (endpoints : EndpointTriplesCCW
      aStart aFinish bStart bFinish cStart cFinish) :
    0 ≤ orientation a b c := by
  exact orientation_nonneg_of_onClosedSegments
    aStart aFinish bStart bFinish cStart cFinish a b c
    (outputPoints_onClosedSegment plane aStart aFinish a aEmitted)
    (outputPoints_onClosedSegment plane bStart bFinish b bEmitted)
    (outputPoints_onClosedSegment plane cStart cFinish c cEmitted)
    endpoints

/-- Pairwise and triplewise input-edge support lifts through the executable point emitter. -/
theorem outputPointFlatMap_allOrderedCCW
    (plane : HalfPlane R) :
    ∀ {edges : List (Vec2 R × Vec2 R)},
      edges.Pairwise SegmentPairCCW →
      edges.Triplewise SegmentTripleCCW →
      OrderedTriples.AllOrderedCCW
        (edges.flatMap fun edge => outputPoints plane edge.1 edge.2)
  | [], _, _ => by simp [OrderedTriples.AllOrderedCCW]
  | edge :: rest, pairwiseEdges, triplewiseEdges => by
      rw [List.flatMap_cons]
      change List.Triplewise (fun a b c => 0 ≤ orientation a b c)
        (outputPoints plane edge.1 edge.2 ++
          rest.flatMap fun later => outputPoints plane later.1 later.2)
      rw [List.triplewise_append]
      have pairHead := (List.pairwise_cons.mp pairwiseEdges).1
      have pairTail := (List.pairwise_cons.mp pairwiseEdges).2
      have tripleHead := (List.triplewise_cons.mp triplewiseEdges).1
      have tripleTail := (List.triplewise_cons.mp triplewiseEdges).2
      refine ⟨outputPoints_allOrderedCCW plane edge.1 edge.2,
        outputPointFlatMap_allOrderedCCW plane pairTail tripleTail, ?_, ?_⟩
      · intro first firstEmitted
        rw [List.pairwise_flatMap]
        constructor
        · intro later laterMember
          exact (outputPoints_pairwise_inSegmentOrder plane later.1 later.2).imp
            fun {middle last} middleLastOrder =>
              orientation_nonneg_two_from_second_segment
                edge.1 edge.2 later.1 later.2 first middle last
                (outputPoints_onClosedSegment plane edge.1 edge.2 first firstEmitted)
                middleLastOrder (pairHead later laterMember)
        · exact tripleHead.imp fun {second third} segmentTriple =>
            by
              intro middle middleEmitted last lastEmitted
              exact orientation_nonneg_of_emitted_on_ordered_edges
                plane edge.1 edge.2 second.1 second.2 third.1 third.2
                first middle last firstEmitted middleEmitted lastEmitted segmentTriple
      · intro last lastMember
        simp only [List.mem_flatMap] at lastMember
        rcases lastMember with ⟨later, laterMember, lastEmitted⟩
        exact (outputPoints_pairwise_inSegmentOrder plane edge.1 edge.2).imp
          fun {first middle} firstMiddleOrder =>
            orientation_nonneg_two_from_first_segment
              edge.1 edge.2 later.1 later.2 first middle last
              firstMiddleOrder
              (outputPoints_onClosedSegment plane later.1 later.2 last lastEmitted)
              (pairHead later laterMember)

def triangleEdgesCCW : List (Vec2 Rat × Vec2 Rat) :=
  [
    ({ x := 0, y := 0 }, { x := 1, y := 0 }),
    ({ x := 1, y := 0 }, { x := 0, y := 1 }),
    ({ x := 0, y := 1 }, { x := 0, y := 0 })
  ]

def triangleEdgesReordered : List (Vec2 Rat × Vec2 Rat) :=
  [
    ({ x := 0, y := 0 }, { x := 1, y := 0 }),
    ({ x := 0, y := 1 }, { x := 0, y := 0 }),
    ({ x := 1, y := 0 }, { x := 0, y := 1 })
  ]

theorem ccw_triangle_has_pair_and_triple_support :
    triangleEdgesCCW.Pairwise SegmentPairCCW ∧
      triangleEdgesCCW.Triplewise SegmentTripleCCW := by
  norm_num [triangleEdgesCCW, SegmentPairCCW, SegmentTripleCCW, EndpointTriplesCCW,
    List.pairwise_cons, List.triplewise_cons, orientation]

/-- Supporting half-planes alone do not encode cyclic traversal order. -/
theorem pair_support_does_not_encode_edge_order :
    triangleEdgesReordered.Pairwise SegmentPairCCW ∧
      ¬triangleEdgesReordered.Triplewise SegmentTripleCCW := by
  norm_num [triangleEdgesReordered, SegmentPairCCW, SegmentTripleCCW, EndpointTriplesCCW,
    List.pairwise_cons, List.triplewise_cons, orientation]

end Sprawlens.SegmentTripleOrientation
