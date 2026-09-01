import Mathlib.Analysis.Convex.Extreme
import Mathlib.Algebra.Order.BigOperators.Ring.Finset
import Sprawlens.PairwiseClipCompleteness
import Sprawlens.RedundantBoundaryNormalizer

/-!
# Irredundant polygon uniqueness

This module separates semantic uniqueness into two obligations:

1. every materialized vertex is an extreme point of its convex hull;
2. two ordered materializations of the same extreme-point set have the same
   cyclic order.

Finite affine exposure recovers the vertex set.  For full-dimensional weakly
ordered normalizer outputs, local irredundancy then recovers strict global
order, closing the order-theoretic polygon obligation as well.
-/

namespace Sprawlens.IrredundantPolygonUniqueness

open Set
open CollinearExtrema
open ConvexClipContract
open CyclicBinaryBlocks
open DegenerateClip
open ExactGeometry
open ExecutableCanonicalizer
open FanBetweenness
open HalfPlaneClipPoints
open HalfPlaneIntersection
open FullDimensionalSupportSemantics
open ListReclipClassification
open OrderedTriples
open PolygonSeamCanonicalizer
open PairwiseClipCompleteness
open RedundantBoundaryNormalizer
open SemanticReclassification
open SegmentContact
open SimpleRing
open StrictConvexContract
open Vec2Linear
open WeakConvexHalfPlaneSigns
open WindingCanonicalizer

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Strict global list order: every increasing-index triple is a strict left
turn. -/
def AllStrictlyOrderedCCW (points : List (Vec2 R)) : Prop :=
  points.Triplewise
    (fun first second third => 0 < orientation first second third)

omit [IsStrictOrderedRing R] in
/-- Strict global order is invariant under cyclic seam rotation. -/
theorem allStrictlyOrderedCCW_rotate
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points)
    (count : Nat) :
    AllStrictlyOrderedCCW (points.rotate count) := by
  by_cases lengthAtLeastThree : 3 ≤ points.length
  · let rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length := by
      simpa using lengthAtLeastThree
    have vertexOrdered : IsStrictlyLinearlyOrderedCCW
        (listVertex points lengthAtLeastThree) := by
      rw [strictlyLinearlyOrdered_iff_indexedVertices_triplewise]
      rw [indexedVertices_listVertex]
      exact ordered
    let start : RingIndex (points.length - 3) :=
      ⟨count % points.length, by
        have positive : 0 < points.length := by omega
        have bound := Nat.mod_lt count positive
        omega⟩
    have rotatedOrdered := vertexOrdered.rotateVertex start
    have reindexedOrdered : IsStrictlyLinearlyOrderedCCW
        (listVertex (points.rotate count) rotatedLengthAtLeastThree) := by
      convert rotatedOrdered using 1
      · simp
      · apply (Fin.heq_fun_iff (by simp)).2
        intro index
        simp [listVertex, StrictConvexContract.rotateVertex, rotateIndex,
          start, Nat.add_comm]
        apply congrArg points.get
        apply Fin.ext
        simp only
        rw [show 3 + (points.length - 3) = points.length by omega]
        rw [Nat.add_comm index.val (count % points.length)]
        rw [Nat.mod_add_mod, Nat.add_comm]
    rw [strictlyLinearlyOrdered_iff_indexedVertices_triplewise] at reindexedOrdered
    rw [indexedVertices_listVertex] at reindexedOrdered
    exact reindexedOrdered
  · unfold AllStrictlyOrderedCCW
    apply allOrderedTriples_of_length_le_two
    simp only [List.length_rotate]
    omega

omit [IsStrictOrderedRing R] in
/-- Open redundant-vertex deletion preserves strict global order whenever the
input already has it. -/
theorem normalizeOpenBoundary_strictlyOrdered
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points) :
    AllStrictlyOrderedCCW (normalizeOpenBoundary points) :=
  allOrderedTriples_sublist (normalizeOpenBoundary_sublist points) ordered

/-- A strictly ordered open chain contains no vertex removable by the
open-segment rule, so normalization is observationally the identity. -/
theorem normalizeOpenBoundary_eq_of_strictlyOrdered :
    ∀ (points : List (Vec2 R)),
      AllStrictlyOrderedCCW points → normalizeOpenBoundary points = points
  | [], _ => by simp [normalizeOpenBoundary]
  | [point], _ => by simp [normalizeOpenBoundary]
  | [first, finish], _ => by simp [normalizeOpenBoundary]
  | first :: middle :: finish :: remaining, ordered => by
      have strictTurn : 0 < orientation first middle finish :=
        relation_of_prefix ordered
      have irredundant :
          pointInOpenSegmentBool first finish middle ≠ true := by
        intro redundant
        have collinear : orientation first finish middle = 0 :=
          ((pointInOpenSegmentBool_eq_true first finish middle).mp redundant).1
        rw [orientation_reverse] at collinear
        linarith
      rw [normalizeOpenBoundary, if_neg irredundant]
      rw [normalizeOpenBoundary_eq_of_strictlyOrdered
        (middle :: finish :: remaining)
        (List.triplewise_cons.mp ordered).2]
termination_by points => points.length

omit [IsStrictOrderedRing R] in
/-- Every fueled cyclic deletion traversal preserves strict global order. -/
theorem normalizeCyclicBoundaryFuel_strictlyOrdered :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      AllStrictlyOrderedCCW points →
        AllStrictlyOrderedCCW (normalizeCyclicBoundaryFuel fuel points)
  | 0, _, ordered => ordered
  | fuel + 1, points, ordered => by
      apply normalizeCyclicBoundaryFuel_strictlyOrdered fuel
      apply normalizeOpenBoundary_strictlyOrdered
      exact allStrictlyOrderedCCW_rotate points ordered 1

/-- Fueled cyclic traversal cannot shorten a strictly ordered polygon. -/
theorem normalizeCyclicBoundaryFuel_length_eq_of_strictlyOrdered :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      AllStrictlyOrderedCCW points →
        (normalizeCyclicBoundaryFuel fuel points).length = points.length
  | 0, _, _ => rfl
  | fuel + 1, points, ordered => by
      rw [normalizeCyclicBoundaryFuel]
      rw [normalizeOpenBoundary_eq_of_strictlyOrdered
        (points.rotate 1) (allStrictlyOrderedCCW_rotate points ordered 1)]
      rw [normalizeCyclicBoundaryFuel_length_eq_of_strictlyOrdered
        fuel (points.rotate 1)
        (allStrictlyOrderedCCW_rotate points ordered 1)]
      exact List.length_rotate points 1

omit [IsStrictOrderedRing R] in
/-- Deterministic seam selection preserves strict global order. -/
theorem canonicalPolygon_strictlyOrdered
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points) :
    AllStrictlyOrderedCCW (canonicalPolygon points) := by
  unfold canonicalPolygon
  split
  · exact ordered
  · exact allStrictlyOrderedCCW_rotate points ordered _

omit [IsStrictOrderedRing R] in
/-- One complete cyclic boundary pass preserves strict global order. -/
theorem normalizeCyclicBoundary_strictlyOrdered
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points) :
    AllStrictlyOrderedCCW (normalizeCyclicBoundary points) := by
  apply canonicalPolygon_strictlyOrdered
  exact normalizeCyclicBoundaryFuel_strictlyOrdered
    points.length points ordered

/-- On a duplicate-free strictly ordered polygon, one full boundary pass
only chooses the deterministic cyclic seam. -/
theorem normalizeCyclicBoundary_eq_canonicalPolygon_of_strictlyOrdered
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllStrictlyOrderedCCW points) :
    normalizeCyclicBoundary points = canonicalPolygon points := by
  apply normalizeCyclicBoundary_eq_canonicalPolygon_of_length_eq points nodup
  rw [normalizeCyclicBoundary, canonicalPolygon_length]
  exact normalizeCyclicBoundaryFuel_length_eq_of_strictlyOrdered
    points.length points ordered

omit [IsStrictOrderedRing R] in
/-- Finite descent preserves strict global order at every recursive step. -/
theorem normalizeCyclicBoundaryFixedFuel_strictlyOrdered :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      AllStrictlyOrderedCCW points →
        AllStrictlyOrderedCCW
          (normalizeCyclicBoundaryFixedFuel fuel points)
  | 0, _, ordered => ordered
  | fuel + 1, points, ordered => by
      simp only [normalizeCyclicBoundaryFixedFuel]
      split
      · exact normalizeCyclicBoundaryFixedFuel_strictlyOrdered fuel _
          (normalizeCyclicBoundary_strictlyOrdered points ordered)
      · exact normalizeCyclicBoundary_strictlyOrdered points ordered

omit [IsStrictOrderedRing R] in
/-- The complete finite-descent normalizer preserves strict global order. -/
theorem normalizeCyclicBoundaryFixed_strictlyOrdered
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points) :
    AllStrictlyOrderedCCW (normalizeCyclicBoundaryFixed points) := by
  apply normalizeCyclicBoundaryFixedFuel_strictlyOrdered
  exact canonicalPolygon_strictlyOrdered points ordered

/-- On a duplicate-free strictly ordered polygon, finite-descent
normalization is exactly deterministic seam selection. -/
theorem normalizeCyclicBoundaryFixed_eq_canonicalPolygon_of_strictlyOrdered
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllStrictlyOrderedCCW points) :
    normalizeCyclicBoundaryFixed points = canonicalPolygon points := by
  unfold normalizeCyclicBoundaryFixed
  cases lengthEq : points.length with
  | zero => simp [normalizeCyclicBoundaryFixedFuel]
  | succ fuel =>
      simp only [normalizeCyclicBoundaryFixedFuel]
      have passEq :
          normalizeCyclicBoundary (canonicalPolygon points) =
            canonicalPolygon points := by
        rw [normalizeCyclicBoundary_eq_canonicalPolygon_of_strictlyOrdered]
        · exact canonicalPolygon_idempotent points
        · exact (canonicalPolygon_nodup_iff points).mpr nodup
        · exact canonicalPolygon_strictlyOrdered points ordered
      rw [passEq]
      simp

/-- A strictly interior affine interpolation of distinct endpoints satisfies
the executable open-segment specification. -/
theorem pointInOpenSegment_of_strict_interpolation
    (start finish : Vec2 R) (distinct : start ≠ finish)
    (parameter : R) (parameterPositive : 0 < parameter)
    (parameterBelowOne : parameter < 1) :
    PointInOpenSegment start finish
      (interpolatePoint start finish parameter) := by
  have strictBetweenInterpolate
      (first second : R) (different : first ≠ second) :
      StrictBetween
        (first + (second - first) * parameter) first second := by
    unfold StrictBetween
    rcases lt_or_gt_of_ne different with forward | backward
    · left
      have deltaPositive : 0 < second - first := sub_pos.mpr forward
      have scaledPositive : 0 < (second - first) * parameter :=
        mul_pos deltaPositive parameterPositive
      have scaledBelowDelta :
          (second - first) * parameter < second - first := by
        nlinarith [mul_lt_mul_of_pos_left parameterBelowOne deltaPositive]
      constructor <;> nlinarith
    · right
      have deltaNegative : second - first < 0 := sub_neg.mpr backward
      have scaledNegative : (second - first) * parameter < 0 :=
        mul_neg_of_neg_of_pos deltaNegative parameterPositive
      have deltaBelowScaled :
          second - first < (second - first) * parameter := by
        nlinarith [mul_lt_mul_of_neg_left parameterBelowOne deltaNegative]
      constructor <;> nlinarith
  have collinear :
      orientation start finish
        (interpolatePoint start finish parameter) = 0 := by
    simp only [orientation, interpolatePoint]
    ring
  constructor
  · exact collinear
  · by_cases xDifferent : start.x ≠ finish.x
    · left
      constructor
      · exact strictBetweenInterpolate start.x finish.x xDifferent
      · by_cases yDifferent : start.y ≠ finish.y
        · exact betweenInclusive_of_strictBetween
            (strictBetweenInterpolate start.y finish.y yDifferent)
        · simp [BetweenInclusive, interpolatePoint, not_ne_iff.mp yDifferent]
    · right
      have yDifferent : start.y ≠ finish.y := by
        intro yEqual
        apply distinct
        cases start
        cases finish
        simp_all
      constructor
      · exact strictBetweenInterpolate start.y finish.y yDifferent
      · simp [BetweenInclusive, interpolatePoint, not_ne_iff.mp xDifferent]

/-- The project interpolation formula agrees with Mathlib's open affine
segment whenever its parameter is strictly between zero and one. -/
theorem interpolatePoint_mem_openSegment
    (start finish : Vec2 R) (parameter : R)
    (parameterPositive : 0 < parameter) (parameterBelowOne : parameter < 1) :
    interpolatePoint start finish parameter ∈ openSegment R start finish := by
  have lineMapEq :
      AffineMap.lineMap start finish parameter =
        interpolatePoint start finish parameter := by
    simp only [AffineMap.lineMap_apply_module]
    exact affineCombination_eq_interpolatePoint
      start finish (1 - parameter) parameter (by ring)
  rw [← lineMapEq]
  exact lineMap_mem_openSegment (𝕜 := R) start finish
    ⟨parameterPositive, parameterBelowOne⟩

/-- Among three pairwise distinct collinear points, exactly one geometric
role is interior: at least one point lies in the open segment of the other
two.  The statement avoids choosing a coordinate axis. -/
theorem one_mem_openSegment_of_collinear
    (first middle last : Vec2 R)
    (firstNeMiddle : first ≠ middle)
    (middleNeLast : middle ≠ last)
    (firstNeLast : first ≠ last)
    (collinear : orientation first last middle = 0) :
    middle ∈ openSegment R first last ∨
      first ∈ openSegment R middle last ∨
      last ∈ openSegment R first middle := by
  let parameter := lineParameter first last middle
  have middleEq :
      middle = interpolatePoint first last parameter :=
    (interpolatePoint_lineParameter first last middle firstNeLast
      collinear).symm
  have parameterNeZero : parameter ≠ 0 := by
    intro parameterZero
    rw [parameterZero, interpolatePoint_zero] at middleEq
    exact firstNeMiddle middleEq.symm
  have parameterNeOne : parameter ≠ 1 := by
    intro parameterOne
    rw [parameterOne, interpolatePoint_one] at middleEq
    exact middleNeLast middleEq
  rcases lt_or_gt_of_ne parameterNeZero with parameterNegative | parameterPositive
  · right
    left
    let localParameter := (-parameter) / (1 - parameter)
    have denominatorPositive : 0 < 1 - parameter := by linarith
    have localPositive : 0 < localParameter :=
      div_pos (neg_pos.mpr parameterNegative) denominatorPositive
    have localBelowOne : localParameter < 1 := by
      exact (div_lt_one denominatorPositive).mpr (by linarith)
    have firstEq :
        first = interpolatePoint middle last localParameter := by
      calc
        first = interpolatePoint first last 0 :=
          (interpolatePoint_zero first last).symm
        _ = interpolatePoint
              (interpolatePoint first last parameter)
              (interpolatePoint first last 1) localParameter := by
            rw [interpolatePoint_between_parameters]
            congr 1
            dsimp [localParameter]
            field_simp [sub_ne_zero.mpr (by linarith : parameter ≠ 1)]
            ring
        _ = interpolatePoint middle last localParameter := by
          rw [← middleEq, interpolatePoint_one]
    rw [firstEq]
    exact interpolatePoint_mem_openSegment middle last localParameter
      localPositive localBelowOne
  · by_cases parameterBelowOne : parameter < 1
    · left
      rw [middleEq]
      exact interpolatePoint_mem_openSegment first last parameter
        parameterPositive parameterBelowOne
    · right
      right
      have parameterAboveOne : 1 < parameter := by
        exact lt_of_le_of_ne (le_of_not_gt parameterBelowOne) parameterNeOne.symm
      let localParameter := 1 / parameter
      have localPositive : 0 < localParameter := div_pos one_pos parameterPositive
      have localBelowOne : localParameter < 1 :=
        (div_lt_one parameterPositive).mpr parameterAboveOne
      have lastEq :
          last = interpolatePoint first middle localParameter := by
        calc
          last = interpolatePoint first last 1 :=
            (interpolatePoint_one first last).symm
          _ = interpolatePoint
                (interpolatePoint first last 0)
                (interpolatePoint first last parameter) localParameter := by
              rw [interpolatePoint_between_parameters]
              congr 1
              dsimp [localParameter]
              field_simp [parameterNeZero]
              ring
          _ = interpolatePoint first middle localParameter := by
            rw [interpolatePoint_zero, ← middleEq]
      rw [lastEq]
      exact interpolatePoint_mem_openSegment first middle localParameter
        localPositive localBelowOne

omit [IsStrictOrderedRing R] in
/-- Every point on a closed segment is collinear with its endpoints. -/
theorem orientation_eq_zero_of_onClosedSegment
    (start finish point : Vec2 R)
    (onSegment : OnClosedSegment start finish point) :
    orientation start finish point = 0 := by
  obtain ⟨parameter, _, rfl⟩ := onSegment
  simp only [orientation, interpolatePoint]
  ring

omit [IsStrictOrderedRing R] in
/-- A finite generator set whose convex region is a nondegenerate segment
cannot contain a positive ordered triple. -/
theorem not_hasPositiveTriple_of_region_eq_segment
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (start finish : Vec2 R) (distinct : start ≠ finish)
    (sameRegion : listConvexRegion points =
      (DegenerateArtifact.segment start finish).region) :
    ¬HasPositiveTriple (listVertex points lengthAtLeastThree) := by
  intro fullDimensional
  obtain ⟨first, middle, last, firstBeforeMiddle, middleBeforeLast,
      positive⟩ := fullDimensional
  let vertex := listVertex points lengthAtLeastThree
  have generatorMember (index : RingIndex (points.length - 3)) :
      vertex index ∈ listConvexRegion points := by
    unfold listConvexRegion
    apply subset_convexHull R
    simp [vertex, listVertex]
  have onSegment (index : RingIndex (points.length - 3)) :
      OnClosedSegment start finish (vertex index) := by
    change vertex index ∈ (DegenerateArtifact.segment start finish).region
    rw [← sameRegion]
    exact generatorMember index
  have firstOnLine := orientation_eq_zero_of_onClosedSegment
    start finish (vertex first) (onSegment first)
  have middleOnLine := orientation_eq_zero_of_onClosedSegment
    start finish (vertex middle) (onSegment middle)
  have lastOnLine := orientation_eq_zero_of_onClosedSegment
    start finish (vertex last) (onSegment last)
  have collinear := common_line_triple_collinear
    start finish (vertex first) (vertex middle) (vertex last)
      distinct firstOnLine middleOnLine lastOnLine
  exact (ne_of_gt positive) collinear

/-- Full affine dimension is determined by the represented convex region on
duplicate-free weakly ordered lists, rather than by their materialization. -/
theorem hasPositiveTriple_iff_of_region_eq
    (first second : List (Vec2 R))
    (firstLength : 3 ≤ first.length) (secondLength : 3 ≤ second.length)
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllOrderedCCW first)
    (secondOrdered : AllOrderedCCW second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    HasPositiveTriple (listVertex first firstLength) ↔
      HasPositiveTriple (listVertex second secondLength) := by
  constructor
  · intro firstFull
    by_contra secondNotFull
    obtain ⟨start, finish, distinct, secondArtifact⟩ :=
      ExecutableCanonicalizer.canonicalizeNormalized_eq_segment_of_not_positive
        second secondNodup secondLength secondNotFull
    have secondSegmentRegion :
        listConvexRegion second =
          (DegenerateArtifact.segment start finish).region := by
      rw [← ExecutableCanonicalizer.canonicalizeNormalized_region
        second secondNodup secondOrdered, secondArtifact,
        ExecutableCanonicalizer.canonicalSegment_region]
    have firstSegmentRegion :
        listConvexRegion first =
          (DegenerateArtifact.segment start finish).region :=
      sameRegion.trans secondSegmentRegion
    exact (not_hasPositiveTriple_of_region_eq_segment
      first firstLength start finish distinct firstSegmentRegion) firstFull
  · intro secondFull
    by_contra firstNotFull
    obtain ⟨start, finish, distinct, firstArtifact⟩ :=
      ExecutableCanonicalizer.canonicalizeNormalized_eq_segment_of_not_positive
        first firstNodup firstLength firstNotFull
    have firstSegmentRegion :
        listConvexRegion first =
          (DegenerateArtifact.segment start finish).region := by
      rw [← ExecutableCanonicalizer.canonicalizeNormalized_region
        first firstNodup firstOrdered, firstArtifact,
        ExecutableCanonicalizer.canonicalSegment_region]
    have secondSegmentRegion :
        listConvexRegion second =
          (DegenerateArtifact.segment start finish).region :=
      sameRegion.symm.trans firstSegmentRegion
    exact (not_hasPositiveTriple_of_region_eq_segment
      second secondLength start finish distinct secondSegmentRegion) secondFull

/-- In a full-dimensional, duplicate-free weakly ordered polygon, a
collinear leading triple makes its middle vertex an open-segment redundancy. -/
theorem pointInOpenSegment_of_prefix_collinear_of_ordered
    (previous target next : Vec2 R) (remaining : List (Vec2 R))
    (ordered : AllOrderedCCW (previous :: target :: next :: remaining))
    (nodup : (previous :: target :: next :: remaining).Nodup)
    (fullDimensional : HasPositiveTriple
      (listVertex (previous :: target :: next :: remaining) (by simp)))
    (collinear : orientation previous target next = 0) :
    PointInOpenSegment previous next target := by
  let points := previous :: target :: next :: remaining
  let lengthAtLeastThree : 3 ≤ points.length := by simp [points]
  let vertex := listVertex points lengthAtLeastThree
  let previousIndex : RingIndex (points.length - 3) := ⟨0, by omega⟩
  let targetIndex : RingIndex (points.length - 3) := ⟨1, by omega⟩
  let nextIndex : RingIndex (points.length - 3) := ⟨2, by omega⟩
  have vertexPrevious : vertex previousIndex = previous := by
    simp [vertex, listVertex, points, previousIndex]
  have vertexTarget : vertex targetIndex = target := by
    simp [vertex, listVertex, points, targetIndex]
  have vertexNext : vertex nextIndex = next := by
    simp [vertex, listVertex, points, nextIndex]
  have vertexOrdered : IsLinearlyOrderedCCW vertex := by
    rw [linearlyOrdered_iff_indexedVertices_triplewise]
    rw [indexedVertices_listVertex]
    exact ordered
  have vertexInjective : Function.Injective vertex :=
    listVertex_injective_of_nodup lengthAtLeastThree (by simpa [points] using nodup)
  have vertexFullDimensional : HasPositiveTriple vertex := by
    simpa [vertex, points, lengthAtLeastThree] using fullDimensional
  have previousNeNext : previousIndex ≠ nextIndex := by
    intro equal
    have valuesEqual := congrArg Fin.val equal
    simp [previousIndex, nextIndex] at valuesEqual
  obtain ⟨witness, witnessOffLine⟩ :=
    exists_off_line_vertex_of_positiveTriple vertex vertexInjective
      vertexFullDimensional nextIndex previousIndex previousNeNext.symm
  have witnessAfterNext : nextIndex.val < witness.val := by
    have witnessNePrevious : witness ≠ previousIndex := by
      intro equal
      subst witness
      simp at witnessOffLine
    have witnessNeTarget : witness ≠ targetIndex := by
      intro equal
      subst witness
      have targetCollinear :
          orientation (vertex nextIndex) (vertex targetIndex)
            (vertex previousIndex) = 0 := by
        rw [vertexNext, vertexTarget, vertexPrevious,
          orientation_reverse, ← orientation_cycle, collinear, neg_zero]
      exact witnessOffLine targetCollinear
    have witnessNeNext : witness ≠ nextIndex := by
      intro equal
      subst witness
      simp at witnessOffLine
    have witnessValNeZero : witness.val ≠ 0 := by
      intro equal
      apply witnessNePrevious
      apply Fin.ext
      simpa [previousIndex] using equal
    have witnessValNeOne : witness.val ≠ 1 := by
      intro equal
      apply witnessNeTarget
      apply Fin.ext
      simpa [targetIndex] using equal
    have witnessValNeTwo : witness.val ≠ 2 := by
      intro equal
      apply witnessNeNext
      apply Fin.ext
      simpa [nextIndex] using equal
    change 2 < witness.val
    omega
  have chordNonnegative :
      0 ≤ orientation (vertex previousIndex) (vertex nextIndex)
        (vertex witness) :=
    vertexOrdered previousIndex nextIndex witness (by simp [previousIndex, nextIndex])
      witnessAfterNext
  have chordNonzero :
      orientation (vertex previousIndex) (vertex nextIndex)
          (vertex witness) ≠ 0 := by
    rw [← orientation_cycle]
    exact witnessOffLine
  have witnessPositive :
      0 < orientation (vertex nextIndex) (vertex witness)
        (vertex previousIndex) := by
    rw [orientation_cycle]
    exact lt_of_le_of_ne chordNonnegative (Ne.symm chordNonzero)
  have leftSupport :
      0 ≤ orientation (vertex nextIndex) (vertex witness)
        (vertex targetIndex) := by
    rw [orientation_cycle]
    exact vertexOrdered targetIndex nextIndex witness
      (by simp [targetIndex, nextIndex]) witnessAfterNext
  have rightSupport :
      0 ≤ orientation (vertex witness) (vertex previousIndex)
        (vertex targetIndex) := by
    calc
      0 ≤ orientation (vertex previousIndex) (vertex targetIndex)
          (vertex witness) :=
        vertexOrdered previousIndex targetIndex witness
          (by simp [previousIndex, targetIndex]) (by
            change 2 < witness.val at witnessAfterNext
            change 1 < witness.val
            omega)
      _ = orientation (vertex witness) (vertex previousIndex)
          (vertex targetIndex) :=
        (orientation_cycle (vertex witness) (vertex previousIndex)
          (vertex targetIndex))
  have rotatedCollinear :
      orientation (vertex nextIndex) (vertex previousIndex)
        (vertex targetIndex) = 0 := by
    rw [vertexNext, vertexPrevious, vertexTarget, ← orientation_cycle]
    exact collinear
  obtain ⟨parameter, parameterNonnegative, parameterAtMostOne,
      targetInterpolation⟩ :=
    collinear_between_of_positive_witness
      (vertex nextIndex) (vertex witness) (vertex previousIndex)
        (vertex targetIndex) witnessPositive rotatedCollinear
          leftSupport rightSupport
  have previousNeTarget : previous ≠ target := by
    intro equal
    apply (List.nodup_cons.mp nodup).1
    simp [equal]
  have targetNeNext : target ≠ next := by
    intro equal
    apply (List.nodup_cons.mp (List.nodup_cons.mp nodup).2).1
    simp [equal]
  have previousNeNextPoint : previous ≠ next := by
    intro equal
    apply (List.nodup_cons.mp nodup).1
    simp [equal]
  have targetInterpolationPoints :
      target = interpolatePoint previous next parameter := by
    rw [vertexTarget, vertexPrevious, vertexNext] at targetInterpolation
    exact targetInterpolation
  have parameterNeZero : parameter ≠ 0 := by
    intro parameterZero
    rw [parameterZero, interpolatePoint_zero] at targetInterpolationPoints
    exact previousNeTarget targetInterpolationPoints.symm
  have parameterNeOne : parameter ≠ 1 := by
    intro parameterOne
    rw [parameterOne, interpolatePoint_one] at targetInterpolationPoints
    exact targetNeNext targetInterpolationPoints
  rw [targetInterpolationPoints]
  exact pointInOpenSegment_of_strict_interpolation previous next
    previousNeNextPoint parameter
      (lt_of_le_of_ne parameterNonnegative (Ne.symm parameterNeZero))
      (lt_of_le_of_ne parameterAtMostOne parameterNeOne)

/-- The leading cyclic turn is strict when a full-dimensional weak polygon
is duplicate-free and the local deletion rule is already fixed. -/
theorem prefix_strict_of_ordered_of_irredundant
    (previous target next : Vec2 R) (remaining : List (Vec2 R))
    (ordered : AllOrderedCCW (previous :: target :: next :: remaining))
    (nodup : (previous :: target :: next :: remaining).Nodup)
    (fullDimensional : HasPositiveTriple
      (listVertex (previous :: target :: next :: remaining) (by simp)))
    (irredundant :
      OpenHeadIrredundant (previous :: target :: next :: remaining)) :
    0 < orientation previous target next := by
  have nonnegative : 0 ≤ orientation previous target next :=
    relation_of_prefix ordered
  rcases lt_or_eq_of_le nonnegative with positive | zero
  · exact positive
  · have interior := pointInOpenSegment_of_prefix_collinear_of_ordered
      previous target next remaining ordered nodup fullDimensional zero.symm
    have redundant :
        pointInOpenSegmentBool previous next target = true :=
      (pointInOpenSegmentBool_eq_true previous next target).mpr interior
    simp [OpenHeadIrredundant, redundant] at irredundant

/-- Strictness of the leading turn, packaged in the same list-shape style as
the executable normalizer's local irredundancy predicate. -/
def OpenHeadStrict (points : List (Vec2 R)) : Prop :=
  match points with
  | previous :: target :: next :: _ =>
      0 < orientation previous target next
  | _ => True

/-- Every seam of a cyclic list begins with a strict turn. -/
def CyclicallyStrict (points : List (Vec2 R)) : Prop :=
  ∀ count, count < points.length → OpenHeadStrict (points.rotate count)

omit [IsStrictOrderedRing R] in
/-- A bounded cyclic strictness certificate applies to an arbitrary rotation
after reducing its seam index modulo the nonempty list length. -/
theorem openHeadStrict_rotate_of_cyclicallyStrict
    (points : List (Vec2 R)) (nonempty : 0 < points.length)
    (strict : CyclicallyStrict points) (count : Nat) :
    OpenHeadStrict (points.rotate count) := by
  have reduced := strict (count % points.length)
    (Nat.mod_lt count nonempty)
  rw [List.rotate_mod] at reduced
  exact reduced

/-- A full-dimensional weak polygon that is duplicate-free and locally
irredundant at every seam has a strict turn at every seam. -/
theorem cyclicallyStrict_of_ordered_of_irredundant
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllOrderedCCW points) (nodup : points.Nodup)
    (fullDimensional : HasPositiveTriple
      (listVertex points lengthAtLeastThree))
    (irredundant : CyclicallyIrredundant points) :
    CyclicallyStrict points := by
  intro count countBound
  let rotated := points.rotate count
  have rotatedLengthAtLeastThree : 3 ≤ rotated.length := by
    simpa [rotated] using lengthAtLeastThree
  have rotatedOrdered : AllOrderedCCW rotated :=
    allOrderedCCW_rotate points ordered count
  have rotatedNodup : rotated.Nodup := List.nodup_rotate.mpr nodup
  have rotatedFullDimensional : HasPositiveTriple
      (listVertex rotated rotatedLengthAtLeastThree) :=
    hasPositiveTriple_listVertex_rotate points lengthAtLeastThree ordered nodup
      fullDimensional count rotatedLengthAtLeastThree
  have rotatedIrredundant : OpenHeadIrredundant rotated :=
    irredundant count countBound
  change OpenHeadStrict rotated
  cases rotatedEq : rotated with
  | nil =>
      rw [rotatedEq] at rotatedLengthAtLeastThree
      simp at rotatedLengthAtLeastThree
  | cons previous tail =>
      cases tailEq : tail with
      | nil =>
          rw [rotatedEq, tailEq] at rotatedLengthAtLeastThree
          simp at rotatedLengthAtLeastThree
      | cons target tail =>
          cases secondTailEq : tail with
          | nil =>
              rw [rotatedEq, tailEq, secondTailEq] at rotatedLengthAtLeastThree
              simp at rotatedLengthAtLeastThree
          | cons next remaining =>
              rw [rotatedEq, tailEq, secondTailEq] at rotatedOrdered
              rw [rotatedEq, tailEq, secondTailEq] at rotatedNodup
              rw [rotatedEq, tailEq, secondTailEq] at rotatedIrredundant
              let PositiveFor : List (Vec2 R) → Prop := fun values =>
                ∀ lengthProof : 3 ≤ values.length,
                  HasPositiveTriple (listVertex values lengthProof)
              have rotatedPositiveFor : PositiveFor rotated := by
                intro lengthProof
                simpa only using rotatedFullDimensional
              have rotatedShape :
                  rotated = previous :: target :: next :: remaining := by
                rw [rotatedEq, tailEq, secondTailEq]
              have shapePositiveFor :
                  PositiveFor (previous :: target :: next :: remaining) := by
                exact (congrArg PositiveFor rotatedShape).mp rotatedPositiveFor
              exact prefix_strict_of_ordered_of_irredundant
                previous target next remaining rotatedOrdered rotatedNodup
                  (shapePositiveFor (by simp))
                  rotatedIrredundant

/-- Two permutations with the same leading vertex and strict global order
have the same tail order. -/
theorem eq_of_perm_of_head_eq_of_strictlyOrdered
    (firstHead : Vec2 R) (firstTail secondTail : List (Vec2 R))
    (permutation : List.Perm (firstHead :: firstTail)
      (firstHead :: secondTail))
    (firstOrdered : AllStrictlyOrderedCCW (firstHead :: firstTail))
    (secondOrdered : AllStrictlyOrderedCCW (firstHead :: secondTail)) :
    firstHead :: firstTail = firstHead :: secondTail := by
  have firstTailOrdered : firstTail.Pairwise
      (fun first second =>
        0 < orientation firstHead first second) :=
    (List.triplewise_cons.mp firstOrdered).1
  have secondTailOrdered : secondTail.Pairwise
      (fun first second =>
        0 < orientation firstHead first second) :=
    (List.triplewise_cons.mp secondOrdered).1
  apply congrArg (List.cons firstHead)
  apply List.Perm.eq_of_pairwise
    (le := fun first second =>
      0 < orientation firstHead first second)
  · intro first second _ _ firstBefore secondBefore
    rw [orientation_reverse] at secondBefore
    exfalso
    linarith
  · exact firstTailOrdered
  · exact secondTailOrdered
  · exact permutation.cons_inv

/-- A strict polygon has a unique canonical list among all permutations that
preserve strict global CCW order. -/
theorem canonicalPolygon_eq_of_perm_of_strictlyOrdered
    (first second : List (Vec2 R))
    (permutation : List.Perm first second)
    (firstOrdered : AllStrictlyOrderedCCW first)
    (secondOrdered : AllStrictlyOrderedCCW second) :
    canonicalPolygon first = canonicalPolygon second := by
  have canonicalPerm :
      List.Perm (canonicalPolygon first) (canonicalPolygon second) :=
    (canonicalPolygon_perm first).trans
      (permutation.trans (canonicalPolygon_perm second).symm)
  have sameArgmin := argmin_pointKey_eq_of_perm permutation
  cases selected : List.argmin pointKey first with
  | none =>
      have firstEmpty := List.argmin_eq_none.mp selected
      subst first
      have secondEmpty := permutation.symm.eq_nil
      subst second
      simp [canonicalPolygon]
  | some minimum =>
      have selectedSecond : List.argmin pointKey second = some minimum := by
        rw [← sameArgmin, selected]
      have firstHead :=
        canonicalPolygon_head?_eq_argmin first minimum selected
      have secondHead :=
        canonicalPolygon_head?_eq_argmin second minimum selectedSecond
      cases firstCanonicalEq : canonicalPolygon first with
      | nil => simp [firstCanonicalEq] at firstHead
      | cons firstValue firstTail =>
          cases secondCanonicalEq : canonicalPolygon second with
          | nil => simp [secondCanonicalEq] at secondHead
          | cons secondValue secondTail =>
              have firstValueEq : firstValue = minimum := by
                simpa [firstCanonicalEq] using firstHead
              have secondValueEq : secondValue = minimum := by
                simpa [secondCanonicalEq] using secondHead
              subst firstValue
              subst secondValue
              rw [firstCanonicalEq, secondCanonicalEq] at canonicalPerm
              apply eq_of_perm_of_head_eq_of_strictlyOrdered
                minimum firstTail secondTail canonicalPerm
              · simpa [firstCanonicalEq] using
                  canonicalPolygon_strictlyOrdered first firstOrdered
              · simpa [secondCanonicalEq] using
                  canonicalPolygon_strictlyOrdered second secondOrdered

/-- An affine signed-distance bound on finite generators extends to their
entire convex hull. -/
theorem signedDistance_le_of_mem_listConvexRegion
    (plane : HalfPlane R) (points : List (Vec2 R)) (bound : R)
    (generatorBound : ∀ point, point ∈ points →
      signedDistance plane point ≤ bound)
    {point : Vec2 R} (pointMember : point ∈ listConvexRegion points) :
    signedDistance plane point ≤ bound := by
  unfold listConvexRegion at pointMember
  obtain ⟨Index, _, weight, generator,
      weightNonnegative, weightSum, generatorMember, pointEq⟩ :=
    mem_convexHull_iff_exists_fintype.mp pointMember
  have weightedBound :
      ∑ index, weight index * signedDistance plane (generator index) ≤
        ∑ index, weight index * bound := by
    apply Finset.sum_le_sum
    intro index _
    exact mul_le_mul_of_nonneg_left
      (generatorBound (generator index) (generatorMember index))
      (weightNonnegative index)
  rw [signedDistance_finite_affineCombination
    plane weight generator point weightSum pointEq] at weightedBound
  simpa [← Finset.sum_mul, weightSum] using weightedBound

/-- If exactly one finite generator maximizes an affine signed distance, it
is also the unique maximizer over the whole convex hull. -/
theorem eq_of_mem_listConvexRegion_of_unique_signedDistance_max
    (plane : HalfPlane R) (points : List (Vec2 R)) (target : Vec2 R)
    (generatorBound : ∀ point, point ∈ points →
      signedDistance plane point ≤ signedDistance plane target)
    (generatorUnique : ∀ point, point ∈ points →
      signedDistance plane point = signedDistance plane target →
        point = target)
    {point : Vec2 R} (pointMember : point ∈ listConvexRegion points)
    (pointMaximal :
      signedDistance plane point = signedDistance plane target) :
    point = target := by
  unfold listConvexRegion at pointMember
  obtain ⟨Index, _, weight, generator,
      weightNonnegative, weightSum, generatorMember, pointEq⟩ :=
    mem_convexHull_iff_exists_fintype.mp pointMember
  have affineDistance :
      ∑ index, weight index * signedDistance plane (generator index) =
        signedDistance plane point :=
    signedDistance_finite_affineCombination
      plane weight generator point weightSum pointEq
  have gapNonnegative : ∀ index, 0 ≤
      weight index *
        (signedDistance plane target -
          signedDistance plane (generator index)) := by
    intro index
    exact mul_nonneg (weightNonnegative index)
      (sub_nonneg.mpr
        (generatorBound (generator index) (generatorMember index)))
  have gapSumZero :
      ∑ index, weight index *
          (signedDistance plane target -
            signedDistance plane (generator index)) = 0 := by
    calc
      ∑ index, weight index *
          (signedDistance plane target -
            signedDistance plane (generator index)) =
          signedDistance plane target * ∑ index, weight index -
            ∑ index,
              weight index * signedDistance plane (generator index) := by
                simp only [mul_sub, Finset.sum_sub_distrib,
                  ← Finset.sum_mul]
                ring
      _ = 0 := by rw [weightSum, affineDistance, pointMaximal]; ring
  have eachGapZero : ∀ index,
      weight index *
          (signedDistance plane target -
            signedDistance plane (generator index)) = 0 := by
    intro index
    exact (Finset.sum_eq_zero_iff_of_nonneg
      (fun candidate _ => gapNonnegative candidate)).mp gapSumZero
        index (Finset.mem_univ index)
  have weightedGeneratorEq : ∀ index,
      weight index • generator index = weight index • target := by
    intro index
    by_cases weightZero : weight index = 0
    · simp [weightZero]
    · have distanceEq :
          signedDistance plane (generator index) =
            signedDistance plane target := by
        have gapZero :
            signedDistance plane target -
                signedDistance plane (generator index) = 0 :=
          (mul_eq_zero.mp (eachGapZero index)).resolve_left weightZero
        linarith
      rw [generatorUnique (generator index)
        (generatorMember index) distanceEq]
  calc
    point = ∑ index, weight index • generator index := pointEq.symm
    _ = ∑ index, weight index • target := by
      apply Finset.sum_congr rfl
      intro index _
      exact weightedGeneratorEq index
    _ = target := by simp [← Finset.sum_smul, weightSum]

/-- A finite generator that uniquely maximizes an affine signed distance is
an extreme point of the generated convex region. -/
theorem mem_extremePoints_of_unique_signedDistance_max
    (plane : HalfPlane R) (points : List (Vec2 R)) (target : Vec2 R)
    (targetMember : target ∈ points)
    (generatorBound : ∀ point, point ∈ points →
      signedDistance plane point ≤ signedDistance plane target)
    (generatorUnique : ∀ point, point ∈ points →
      signedDistance plane point = signedDistance plane target →
        point = target) :
    target ∈ (listConvexRegion points).extremePoints R := by
  rw [mem_extremePoints_iff_left]
  constructor
  · unfold listConvexRegion
    exact subset_convexHull R _ targetMember
  · intro first firstMember second secondMember targetBetween
    obtain ⟨firstWeight, secondWeight, firstWeightPositive,
      secondWeightPositive, weightSum, targetEq⟩ := targetBetween
    have firstBound := signedDistance_le_of_mem_listConvexRegion
      plane points (signedDistance plane target) generatorBound firstMember
    have secondBound := signedDistance_le_of_mem_listConvexRegion
      plane points (signedDistance plane target) generatorBound secondMember
    have distanceEq := congrArg (signedDistance plane) targetEq
    rw [affineCombination_eq_interpolatePoint
      first second firstWeight secondWeight weightSum,
      signedDistance_interpolatePoint] at distanceEq
    have firstMaximal :
        signedDistance plane first = signedDistance plane target := by
      unfold interpolateDistance at distanceEq
      have firstWeightEq : firstWeight = 1 - secondWeight := by linarith
      rw [firstWeightEq] at firstWeightPositive
      nlinarith
    exact eq_of_mem_listConvexRegion_of_unique_signedDistance_max
      plane points target generatorBound generatorUnique
        firstMember firstMaximal

/-- The affine half-plane functional opposite an oriented chord.  Points to
the left of `start → finish` have negative signed distance. -/
def oppositeChordPlane (start finish : Vec2 R) : HalfPlane R :=
  {
    normalX := finish.y - start.y
    normalY := start.x - finish.x
    offset :=
      (finish.y - start.y) * start.x -
        (finish.x - start.x) * start.y
  }

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- The chord functional is exactly negated orientation. -/
theorem signedDistance_oppositeChordPlane
    (start finish point : Vec2 R) :
    signedDistance (oppositeChordPlane start finish) point =
      -orientation start finish point := by
  simp only [signedDistance, oppositeChordPlane, orientation]
  ring

/-- In a strict polygon whose first three vertices are
`previous, target, next`, the target is uniquely exposed by the opposite
functional of the shortcut chord `previous → next`. -/
theorem second_mem_extremePoints_of_strictlyOrdered
    (previous target next : Vec2 R) (remaining : List (Vec2 R))
    (ordered :
      AllStrictlyOrderedCCW (previous :: target :: next :: remaining)) :
    target ∈
      (listConvexRegion
        (previous :: target :: next :: remaining)).extremePoints R := by
  let plane := oppositeChordPlane previous next
  have targetPositive : 0 < signedDistance plane target := by
    rw [show signedDistance plane target =
      -orientation previous next target by
        exact signedDistance_oppositeChordPlane previous next target]
    rw [orientation_reverse]
    simpa using (relation_of_prefix ordered)
  have remainingLeft : ∀ point, point ∈ remaining →
      0 < orientation previous next point := by
    intro point pointMember
    have previousPairs := (List.triplewise_cons.mp ordered).1
    have afterTargetPairs := (List.pairwise_cons.mp previousPairs).2
    exact (List.pairwise_cons.mp afterTargetPairs).1 point pointMember
  apply mem_extremePoints_of_unique_signedDistance_max
    plane (previous :: target :: next :: remaining) target (by simp)
  · intro point pointMember
    simp only [List.mem_cons] at pointMember
    rcases pointMember with rfl | rfl | rfl | pointMember
    · rw [signedDistance_oppositeChordPlane]
      simp [orientation]
      linarith
    · exact le_rfl
    · rw [signedDistance_oppositeChordPlane]
      simp [orientation]
      linarith
    · rw [signedDistance_oppositeChordPlane]
      have pointLeft := remainingLeft point pointMember
      linarith
  · intro point pointMember distanceEq
    simp only [List.mem_cons] at pointMember
    rcases pointMember with rfl | rfl | rfl | pointMember
    · rw [signedDistance_oppositeChordPlane] at distanceEq
      simp [orientation] at distanceEq
      linarith
    · rfl
    · rw [signedDistance_oppositeChordPlane] at distanceEq
      simp [orientation] at distanceEq
      linarith
    · rw [signedDistance_oppositeChordPlane] at distanceEq
      have pointLeft := remainingLeft point pointMember
      linarith

/-- A weakly ordered polygon already exposes its second vertex whenever the
leading turn alone is strict; later vertices need only stay on the weak left
side of the shortcut chord. -/
theorem second_mem_extremePoints_of_ordered_of_prefix_strict
    (previous target next : Vec2 R) (remaining : List (Vec2 R))
    (ordered : AllOrderedCCW (previous :: target :: next :: remaining))
    (prefixStrict : 0 < orientation previous target next) :
    target ∈
      (listConvexRegion
        (previous :: target :: next :: remaining)).extremePoints R := by
  let plane := oppositeChordPlane previous next
  have targetPositive : 0 < signedDistance plane target := by
    rw [show signedDistance plane target =
      -orientation previous next target by
        exact signedDistance_oppositeChordPlane previous next target]
    rw [orientation_reverse]
    simpa using prefixStrict
  have remainingLeft : ∀ point, point ∈ remaining →
      0 ≤ orientation previous next point := by
    intro point pointMember
    have previousPairs := (List.triplewise_cons.mp ordered).1
    have afterTargetPairs := (List.pairwise_cons.mp previousPairs).2
    exact (List.pairwise_cons.mp afterTargetPairs).1 point pointMember
  apply mem_extremePoints_of_unique_signedDistance_max
    plane (previous :: target :: next :: remaining) target (by simp)
  · intro point pointMember
    simp only [List.mem_cons] at pointMember
    rcases pointMember with rfl | rfl | rfl | pointMember
    · rw [signedDistance_oppositeChordPlane]
      simp [orientation]
      linarith
    · exact le_rfl
    · rw [signedDistance_oppositeChordPlane]
      simp [orientation]
      linarith
    · rw [signedDistance_oppositeChordPlane]
      have pointLeft := remainingLeft point pointMember
      linarith
  · intro point pointMember distanceEq
    simp only [List.mem_cons] at pointMember
    rcases pointMember with rfl | rfl | rfl | pointMember
    · rw [signedDistance_oppositeChordPlane] at distanceEq
      simp [orientation] at distanceEq
      linarith
    · rfl
    · rw [signedDistance_oppositeChordPlane] at distanceEq
      simp [orientation] at distanceEq
      linarith
    · rw [signedDistance_oppositeChordPlane] at distanceEq
      have pointLeft := remainingLeft point pointMember
      linarith

/-- Every listed vertex can be exposed as the second element of a cyclic
rotation, together with both cyclic neighbors. -/
def EveryVertexHasCyclicNeighbors (points : List (Vec2 R)) : Prop :=
  ∀ target, target ∈ points →
    ∃ count previous next remaining,
      points.rotate count = previous :: target :: next :: remaining

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
/-- Every list of length at least three has cyclic predecessor/successor
materializations for all of its members. -/
theorem everyVertexHasCyclicNeighbors_of_length_ge_three
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length) :
    EveryVertexHasCyclicNeighbors points := by
  intro target targetMember
  obtain ⟨before, after, pointsEq⟩ := List.append_of_mem targetMember
  subst points
  cases before with
  | nil =>
      cases after with
      | nil => simp at lengthAtLeastThree
      | cons next tail =>
          have tailNonempty : tail ≠ [] := by
            intro tailEmpty
            subst tail
            simp at lengthAtLeastThree
          let previous := tail.getLast tailNonempty
          let remaining := tail.dropLast
          have tailEq : remaining ++ [previous] = tail := by
            exact List.dropLast_append_getLast tailNonempty
          let prefixPoints := target :: next :: remaining
          refine ⟨prefixPoints.length, previous, next, remaining, ?_⟩
          rw [← tailEq]
          change (prefixPoints ++ [previous]).rotate prefixPoints.length = _
          rw [List.rotate_append_length_eq]
          rfl
  | cons first rest =>
      let before := first :: rest
      have beforeNonempty : before ≠ [] := by simp [before]
      let previous := before.getLast beforeNonempty
      let prefixPoints := before.dropLast
      have beforeEq : prefixPoints ++ [previous] = before := by
        exact List.dropLast_append_getLast beforeNonempty
      let cycleTail := after ++ prefixPoints
      have cycleTailNonempty : cycleTail ≠ [] := by
        intro cycleTailEmpty
        have emptyParts : after = [] ∧ prefixPoints = [] := by
          simpa [cycleTail] using cycleTailEmpty
        have afterEmpty : after = [] := emptyParts.1
        have prefixEmpty : prefixPoints = [] := emptyParts.2
        have beforeLength : before.length = 1 := by
          have dropLength : before.dropLast.length = 0 := by
            simp [prefixPoints] at prefixEmpty
            exact congrArg List.length prefixEmpty
          simp only [List.length_dropLast] at dropLength
          have beforePositive : 0 < before.length :=
            List.length_pos_iff.mpr beforeNonempty
          omega
        have restEmpty : rest = [] := by
          simp [before] at beforeLength
          exact beforeLength
        simp [restEmpty, afterEmpty] at lengthAtLeastThree
      cases cycleTailEq : cycleTail with
      | nil => exact False.elim (cycleTailNonempty cycleTailEq)
      | cons next remaining =>
          refine ⟨prefixPoints.length, previous, next, remaining, ?_⟩
          change ((before : List (Vec2 R)) ++ target :: after).rotate
            prefixPoints.length = _
          rw [← beforeEq]
          simp only [List.append_assoc, List.cons_append]
          rw [List.rotate_append_length_eq]
          simpa [cycleTail, List.append_assoc] using cycleTailEq

/-- Strict order plus cyclic neighbor materialization certifies every listed
vertex as an extreme point. -/
theorem allVerticesExtreme_of_strictlyOrdered_of_cyclicNeighbors
    (points : List (Vec2 R))
    (ordered : AllStrictlyOrderedCCW points)
    (neighbors : EveryVertexHasCyclicNeighbors points) :
    ∀ target, target ∈ points →
      target ∈ (listConvexRegion points).extremePoints R := by
  intro target targetMember
  obtain ⟨count, previous, next, remaining, rotatedEq⟩ :=
    neighbors target targetMember
  have rotatedOrdered := allStrictlyOrderedCCW_rotate points ordered count
  rw [rotatedEq] at rotatedOrdered
  have rotatedExtreme := second_mem_extremePoints_of_strictlyOrdered
    previous target next remaining rotatedOrdered
  rw [← PolygonSeamCanonicalizer.listConvexRegion_rotate points count,
    rotatedEq]
  exact rotatedExtreme

/-- Every listed generator is an extreme point of the region generated by
the list. -/
def AllVerticesExtreme (points : List (Vec2 R)) : Prop :=
  ∀ point, point ∈ points →
    point ∈ (listConvexRegion points).extremePoints R

/-- Weak global order plus strict cyclic turns exposes every listed vertex as
an extreme point, without assuming strictness for all nonadjacent triples. -/
theorem allVerticesExtreme_of_ordered_of_cyclicallyStrict
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllOrderedCCW points) (strict : CyclicallyStrict points) :
    AllVerticesExtreme points := by
  intro target targetMember
  obtain ⟨count, previous, next, remaining, rotatedEq⟩ :=
    everyVertexHasCyclicNeighbors_of_length_ge_three
      points lengthAtLeastThree target targetMember
  have rotatedOrdered := allOrderedCCW_rotate points ordered count
  rw [rotatedEq] at rotatedOrdered
  have rotatedStrict := openHeadStrict_rotate_of_cyclicallyStrict
    points (by omega) strict count
  rw [rotatedEq] at rotatedStrict
  have prefixStrict : 0 < orientation previous target next := by
    simpa [OpenHeadStrict] using rotatedStrict
  have rotatedExtreme :=
    second_mem_extremePoints_of_ordered_of_prefix_strict
      previous target next remaining rotatedOrdered prefixStrict
  rw [← PolygonSeamCanonicalizer.listConvexRegion_rotate points count,
    rotatedEq]
  exact rotatedExtreme

/-- Three pairwise distinct generators cannot be collinear when every listed
generator is an extreme point of the generated convex region. -/
theorem orientation_ne_zero_of_allVerticesExtreme
    (points : List (Vec2 R)) (allExtreme : AllVerticesExtreme points)
    (first middle last : Vec2 R)
    (firstMember : first ∈ points) (middleMember : middle ∈ points)
    (lastMember : last ∈ points)
    (firstNeMiddle : first ≠ middle)
    (middleNeLast : middle ≠ last)
    (firstNeLast : first ≠ last) :
    orientation first middle last ≠ 0 := by
  intro collinear
  have reversedCollinear : orientation first last middle = 0 := by
    rw [orientation_reverse, collinear, neg_zero]
  have generatorMember (point : Vec2 R) (member : point ∈ points) :
      point ∈ listConvexRegion points := by
    unfold listConvexRegion
    exact subset_convexHull R _ member
  rcases one_mem_openSegment_of_collinear first middle last
      firstNeMiddle middleNeLast firstNeLast reversedCollinear with
    middleBetween | firstBetween | lastBetween
  · have middleExtreme :=
      (mem_extremePoints_iff_left.mp (allExtreme middle middleMember)).2
    have forced := middleExtreme first (generatorMember first firstMember)
      last (generatorMember last lastMember) middleBetween
    exact firstNeMiddle forced
  · have firstExtreme :=
      (mem_extremePoints_iff_left.mp (allExtreme first firstMember)).2
    have forced := firstExtreme middle (generatorMember middle middleMember)
      last (generatorMember last lastMember) firstBetween
    exact firstNeMiddle forced.symm
  · have lastExtreme :=
      (mem_extremePoints_iff_left.mp (allExtreme last lastMember)).2
    have forced := lastExtreme first (generatorMember first firstMember)
      middle (generatorMember middle middleMember) lastBetween
    exact firstNeLast forced

/-- Weak global order becomes strict global order once duplicate freedom and
extremality exclude the zero-orientation branch for every ordered triple. -/
theorem allStrictlyOrderedCCW_of_ordered_of_allVerticesExtreme
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllOrderedCCW points) (allExtreme : AllVerticesExtreme points) :
    AllStrictlyOrderedCCW points := by
  unfold AllOrderedCCW at ordered
  unfold AllStrictlyOrderedCCW
  change points.Triplewise
    (fun first second last => 0 ≤ orientation first second last) at ordered
  rw [List.triplewise_iff_getElem] at ordered
  rw [List.triplewise_iff_getElem]
  intro firstIndex middleIndex lastIndex firstBeforeMiddle middleBeforeLast
    lastBound
  have firstBound : firstIndex < points.length := by omega
  have middleBound : middleIndex < points.length := by omega
  have firstNeMiddle :
      points[firstIndex] ≠ points[middleIndex] := by
    intro equal
    have indicesEqual := nodup.getElem_inj_iff.mp equal
    omega
  have middleNeLast :
      points[middleIndex] ≠ points[lastIndex] := by
    intro equal
    have indicesEqual := nodup.getElem_inj_iff.mp equal
    omega
  have firstNeLast :
      points[firstIndex] ≠ points[lastIndex] := by
    intro equal
    have indicesEqual := nodup.getElem_inj_iff.mp equal
    omega
  have nonzero := orientation_ne_zero_of_allVerticesExtreme points allExtreme
    points[firstIndex] points[middleIndex] points[lastIndex]
      (by simp) (by simp) (by simp)
      firstNeMiddle middleNeLast firstNeLast
  exact lt_of_le_of_ne
    (ordered firstIndex middleIndex lastIndex firstBeforeMiddle
      middleBeforeLast lastBound)
    (Ne.symm nonzero)

/-- Weak global order with strict cyclic turns is already strict globally. -/
theorem allStrictlyOrderedCCW_of_ordered_of_cyclicallyStrict
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (nodup : points.Nodup) (ordered : AllOrderedCCW points)
    (strict : CyclicallyStrict points) :
    AllStrictlyOrderedCCW points := by
  apply allStrictlyOrderedCCW_of_ordered_of_allVerticesExtreme
    points nodup ordered
  exact allVerticesExtreme_of_ordered_of_cyclicallyStrict
    points lengthAtLeastThree ordered strict

/-- This closes the normalizer-side bridge: full-dimensional weak order,
duplicate freedom, and local irredundancy imply strict global polygon order. -/
theorem allStrictlyOrderedCCW_of_ordered_of_irredundant
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (nodup : points.Nodup) (ordered : AllOrderedCCW points)
    (fullDimensional : HasPositiveTriple
      (listVertex points lengthAtLeastThree))
    (irredundant : CyclicallyIrredundant points) :
    AllStrictlyOrderedCCW points := by
  apply allStrictlyOrderedCCW_of_ordered_of_cyclicallyStrict
    points lengthAtLeastThree nodup ordered
  exact cyclicallyStrict_of_ordered_of_irredundant
    points lengthAtLeastThree ordered nodup fullDimensional irredundant

/-- A full-dimensional polygon branch produced by the public finite-descent
normalizer recovers strict global order from its proved postconditions. -/
theorem normalizeCyclicBoundaryFixed_strictlyOrdered_of_fullDimensional
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points)
    (nodup : points.Nodup)
    (outputLength : 3 ≤ (normalizeCyclicBoundaryFixed points).length)
    (outputFullDimensional : HasPositiveTriple
      (listVertex (normalizeCyclicBoundaryFixed points) outputLength)) :
    AllStrictlyOrderedCCW (normalizeCyclicBoundaryFixed points) := by
  apply allStrictlyOrderedCCW_of_ordered_of_irredundant
    (normalizeCyclicBoundaryFixed points) outputLength
  · exact normalizeCyclicBoundaryFixed_nodup points nodup
  · exact normalizeCyclicBoundaryFixed_ordered points ordered
  · exact outputFullDimensional
  · exact normalizeCyclicBoundaryFixed_irredundant points nodup

omit [IsStrictOrderedRing R] in
/-- The public finite-descent output is already at the deterministic polygon
seam on every duplicate-free input. -/
theorem canonicalPolygon_normalizeCyclicBoundaryFixed
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    canonicalPolygon (normalizeCyclicBoundaryFixed points) =
      normalizeCyclicBoundaryFixed points := by
  have oneStepFixed := normalizeCyclicBoundaryFixed_step_fixed points nodup
  have canonicalStep := canonicalPolygon_normalizeCyclicBoundary
    (normalizeCyclicBoundaryFixed points)
  rw [oneStepFixed] at canonicalStep
  exact canonicalStep

/-- Every strict globally CCW-ordered list of length at least three consists
exactly of extreme generators of its convex hull. -/
theorem allVerticesExtreme_of_strictlyOrdered
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllStrictlyOrderedCCW points) :
    AllVerticesExtreme points :=
  allVerticesExtreme_of_strictlyOrdered_of_cyclicNeighbors points ordered
    (everyVertexHasCyclicNeighbors_of_length_ge_three
      points lengthAtLeastThree)

/-- If every finite generator is extreme, continuous convex-hull semantics
recovers exactly the original generator set. -/
theorem vertexSet_eq_extremePoints_of_allVerticesExtreme
    (points : List (Vec2 R)) (allExtreme : AllVerticesExtreme points) :
    {point : Vec2 R | point ∈ points} =
      (listConvexRegion points).extremePoints R := by
  apply Set.Subset.antisymm
  · intro point pointMember
    exact allExtreme point pointMember
  · unfold listConvexRegion
    exact extremePoints_convexHull_subset

/-- Equal convex regions with all generators extreme have exactly the same
finite vertex set. -/
theorem vertexSet_eq_of_region_eq_of_allVerticesExtreme
    (first second : List (Vec2 R))
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    {point : Vec2 R | point ∈ first} =
      {point : Vec2 R | point ∈ second} := by
  rw [vertexSet_eq_extremePoints_of_allVerticesExtreme first firstExtreme,
    vertexSet_eq_extremePoints_of_allVerticesExtreme second secondExtreme,
    sameRegion]

/-- With duplicate-free materializations, recovered vertex-set equality lifts
to list permutation. -/
theorem perm_of_region_eq_of_allVerticesExtreme
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    List.Perm first second := by
  apply (List.perm_ext_iff_of_nodup firstNodup secondNodup).mpr
  intro point
  have sameVertexSet :=
    vertexSet_eq_of_region_eq_of_allVerticesExtreme
      first second firstExtreme secondExtreme sameRegion
  exact Set.ext_iff.mp sameVertexSet point

/-- Once all listed vertices are extreme and both materializations are
strictly CCW ordered, equal continuous regions produce the same canonical
polygon list. -/
theorem canonicalPolygon_eq_of_region_eq_of_extreme_of_strictlyOrdered
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (firstOrdered : AllStrictlyOrderedCCW first)
    (secondOrdered : AllStrictlyOrderedCCW second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalPolygon first = canonicalPolygon second := by
  apply canonicalPolygon_eq_of_perm_of_strictlyOrdered first second
  · exact perm_of_region_eq_of_allVerticesExtreme
      first second firstNodup secondNodup firstExtreme secondExtreme sameRegion
  · exact firstOrdered
  · exact secondOrdered

/-- Strict duplicate-free polygons of length at least three are semantically
extensional: equal convex regions yield the same deterministic polygon list. -/
theorem canonicalPolygon_eq_of_region_eq_of_strictlyOrdered
    (first second : List (Vec2 R))
    (firstLength : 3 ≤ first.length) (secondLength : 3 ≤ second.length)
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllStrictlyOrderedCCW first)
    (secondOrdered : AllStrictlyOrderedCCW second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalPolygon first = canonicalPolygon second := by
  apply canonicalPolygon_eq_of_region_eq_of_extreme_of_strictlyOrdered
    first second firstNodup secondNodup
  · exact allVerticesExtreme_of_strictlyOrdered
      first firstLength firstOrdered
  · exact allVerticesExtreme_of_strictlyOrdered
      second secondLength secondOrdered
  · exact firstOrdered
  · exact secondOrdered
  · exact sameRegion

/-- Full-dimensional weakly ordered irredundant polygons are semantically
extensional; strict order is derived rather than required from the caller. -/
theorem canonicalPolygon_eq_of_region_eq_of_ordered_of_irredundant
    (first second : List (Vec2 R))
    (firstLength : 3 ≤ first.length) (secondLength : 3 ≤ second.length)
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllOrderedCCW first)
    (secondOrdered : AllOrderedCCW second)
    (firstFullDimensional : HasPositiveTriple
      (listVertex first firstLength))
    (secondFullDimensional : HasPositiveTriple
      (listVertex second secondLength))
    (firstIrredundant : CyclicallyIrredundant first)
    (secondIrredundant : CyclicallyIrredundant second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalPolygon first = canonicalPolygon second := by
  apply canonicalPolygon_eq_of_region_eq_of_strictlyOrdered
    first second firstLength secondLength firstNodup secondNodup
  · exact allStrictlyOrderedCCW_of_ordered_of_irredundant
      first firstLength firstNodup firstOrdered
        firstFullDimensional firstIrredundant
  · exact allStrictlyOrderedCCW_of_ordered_of_irredundant
      second secondLength secondNodup secondOrdered
        secondFullDimensional secondIrredundant
  · exact sameRegion

/-- Public finite-descent normalization is semantically extensional on its
full-dimensional weakly ordered polygon branch. -/
theorem normalizeCyclicBoundaryFixed_eq_of_region_eq_of_fullDimensional
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllOrderedCCW first)
    (secondOrdered : AllOrderedCCW second)
    (firstOutputLength :
      3 ≤ (normalizeCyclicBoundaryFixed first).length)
    (secondOutputLength :
      3 ≤ (normalizeCyclicBoundaryFixed second).length)
    (firstOutputFullDimensional : HasPositiveTriple
      (listVertex (normalizeCyclicBoundaryFixed first) firstOutputLength))
    (secondOutputFullDimensional : HasPositiveTriple
      (listVertex (normalizeCyclicBoundaryFixed second) secondOutputLength))
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    normalizeCyclicBoundaryFixed first =
      normalizeCyclicBoundaryFixed second := by
  have firstOutputStrict :=
    normalizeCyclicBoundaryFixed_strictlyOrdered_of_fullDimensional
      first firstOrdered firstNodup firstOutputLength
        firstOutputFullDimensional
  have secondOutputStrict :=
    normalizeCyclicBoundaryFixed_strictlyOrdered_of_fullDimensional
      second secondOrdered secondNodup secondOutputLength
        secondOutputFullDimensional
  have outputRegionEq :
      listConvexRegion (normalizeCyclicBoundaryFixed first) =
        listConvexRegion (normalizeCyclicBoundaryFixed second) := by
    rw [normalizeCyclicBoundaryFixed_region first,
      normalizeCyclicBoundaryFixed_region second, sameRegion]
  have canonicalEq := canonicalPolygon_eq_of_region_eq_of_strictlyOrdered
    (normalizeCyclicBoundaryFixed first)
    (normalizeCyclicBoundaryFixed second)
    firstOutputLength secondOutputLength
    (normalizeCyclicBoundaryFixed_nodup first firstNodup)
    (normalizeCyclicBoundaryFixed_nodup second secondNodup)
    firstOutputStrict secondOutputStrict outputRegionEq
  calc
    normalizeCyclicBoundaryFixed first =
        canonicalPolygon (normalizeCyclicBoundaryFixed first) :=
      (canonicalPolygon_normalizeCyclicBoundaryFixed first firstNodup).symm
    _ = canonicalPolygon (normalizeCyclicBoundaryFixed second) := canonicalEq
    _ = normalizeCyclicBoundaryFixed second :=
      canonicalPolygon_normalizeCyclicBoundaryFixed second secondNodup

/-- Two non-full-dimensional duplicate-free weakly ordered lists of length at
least three canonicalize to the same segment artifact exactly when their
convex regions agree. -/
theorem canonicalizeSeamed_eq_of_region_eq_of_not_fullDimensional
    (first second : List (Vec2 R))
    (firstLength : 3 ≤ first.length) (secondLength : 3 ≤ second.length)
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllOrderedCCW first)
    (secondOrdered : AllOrderedCCW second)
    (firstNotFull : ¬HasPositiveTriple (listVertex first firstLength))
    (secondNotFull : ¬HasPositiveTriple (listVertex second secondLength))
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalizeSeamed first = canonicalizeSeamed second := by
  obtain ⟨firstStart, firstFinish, firstDistinct, firstArtifact⟩ :=
    ExecutableCanonicalizer.canonicalizeNormalized_eq_segment_of_not_positive
      first firstNodup firstLength firstNotFull
  obtain ⟨secondStart, secondFinish, secondDistinct, secondArtifact⟩ :=
    ExecutableCanonicalizer.canonicalizeNormalized_eq_segment_of_not_positive
      second secondNodup secondLength secondNotFull
  have segmentRegionEq :
      (ExecutableCanonicalizer.canonicalSegment
        firstStart firstFinish).region =
      (ExecutableCanonicalizer.canonicalSegment
        secondStart secondFinish).region := by
    rw [← firstArtifact, ← secondArtifact,
      ExecutableCanonicalizer.canonicalizeNormalized_region
        first firstNodup firstOrdered,
      ExecutableCanonicalizer.canonicalizeNormalized_region
        second secondNodup secondOrdered]
    exact sameRegion
  have segmentEq := ExecutableCanonicalizer.canonicalSegment_eq_of_region_eq
    firstStart firstFinish secondStart secondFinish
      firstDistinct segmentRegionEq
  rw [canonicalizeSeamed, ExecutableCanonicalizer.canonicalize,
    List.dedup_eq_self.mpr firstNodup, firstArtifact,
    normalizePolygonSeam_canonicalSegment,
    canonicalizeSeamed, ExecutableCanonicalizer.canonicalize,
    List.dedup_eq_self.mpr secondNodup, secondArtifact,
    normalizePolygonSeam_canonicalSegment]
  exact segmentEq

/-- On lists of length at least three, semantic equality and local
irredundancy make the complete dimension/seam canonicalizer extensional in
both the polygon and collinear branches. -/
theorem canonicalizeSeamed_eq_of_region_eq_of_irredundant_length_ge_three
    (first second : List (Vec2 R))
    (firstLength : 3 ≤ first.length) (secondLength : 3 ≤ second.length)
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllOrderedCCW first)
    (secondOrdered : AllOrderedCCW second)
    (firstIrredundant : CyclicallyIrredundant first)
    (secondIrredundant : CyclicallyIrredundant second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalizeSeamed first = canonicalizeSeamed second := by
  have dimensionEq := hasPositiveTriple_iff_of_region_eq
    first second firstLength secondLength firstNodup secondNodup
      firstOrdered secondOrdered sameRegion
  by_cases firstFull : HasPositiveTriple (listVertex first firstLength)
  · have secondFull : HasPositiveTriple (listVertex second secondLength) :=
      dimensionEq.mp firstFull
    have canonicalEq :=
      canonicalPolygon_eq_of_region_eq_of_ordered_of_irredundant
        first second firstLength secondLength firstNodup secondNodup
          firstOrdered secondOrdered firstFull secondFull
            firstIrredundant secondIrredundant sameRegion
    rw [canonicalizeSeamed,
      canonicalize_eq_polygon_of_nodup_of_positive
        first firstNodup firstLength firstFull,
      canonicalizeSeamed,
      canonicalize_eq_polygon_of_nodup_of_positive
        second secondNodup secondLength secondFull]
    simp only [normalizePolygonSeam]
    exact congrArg CanonicalArtifact.polygon canonicalEq
  · have secondNotFull :
        ¬HasPositiveTriple (listVertex second secondLength) := by
      exact fun secondFull => firstFull (dimensionEq.mpr secondFull)
    exact canonicalizeSeamed_eq_of_region_eq_of_not_fullDimensional
      first second firstLength secondLength firstNodup secondNodup
        firstOrdered secondOrdered firstFull secondNotFull sameRegion

/-- The public winding/reduction/artifact composition is semantically
extensional whenever both reduced outputs have length at least three.  The
theorem covers both its full-dimensional polygon and collinear segment
dispatches. -/
theorem canonicalizeReducedWindingSeamed_eq_of_region_eq_of_output_length_ge_three
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstBidirectionallyOrdered :
      AllOrderedCCW first ∨ AllOrderedCCW first.reverse)
    (secondBidirectionallyOrdered :
      AllOrderedCCW second ∨ AllOrderedCCW second.reverse)
    (firstOutputLength : 3 ≤
      (normalizeCyclicBoundaryFixed (normalizeWinding first)).length)
    (secondOutputLength : 3 ≤
      (normalizeCyclicBoundaryFixed (normalizeWinding second)).length)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalizeReducedWindingSeamed first =
      canonicalizeReducedWindingSeamed second := by
  let firstWound := normalizeWinding first
  let secondWound := normalizeWinding second
  let firstOutput := normalizeCyclicBoundaryFixed firstWound
  let secondOutput := normalizeCyclicBoundaryFixed secondWound
  have firstWoundOrdered : AllOrderedCCW firstWound :=
    normalizeWinding_ordered first firstBidirectionallyOrdered
  have secondWoundOrdered : AllOrderedCCW secondWound :=
    normalizeWinding_ordered second secondBidirectionallyOrdered
  have firstWoundNodup : firstWound.Nodup :=
    (normalizeWinding_nodup_iff first).mpr firstNodup
  have secondWoundNodup : secondWound.Nodup :=
    (normalizeWinding_nodup_iff second).mpr secondNodup
  have firstOutputRegion : listConvexRegion firstOutput =
      listConvexRegion first := by
    calc
      listConvexRegion firstOutput = listConvexRegion firstWound :=
        normalizeCyclicBoundaryFixed_region firstWound
      _ = listConvexRegion first := normalizeWinding_region first
  have secondOutputRegion : listConvexRegion secondOutput =
      listConvexRegion second := by
    calc
      listConvexRegion secondOutput = listConvexRegion secondWound :=
        normalizeCyclicBoundaryFixed_region secondWound
      _ = listConvexRegion second := normalizeWinding_region second
  have outputRegionEq :
      listConvexRegion firstOutput = listConvexRegion secondOutput :=
    firstOutputRegion.trans (sameRegion.trans secondOutputRegion.symm)
  change canonicalizeSeamed firstOutput = canonicalizeSeamed secondOutput
  apply canonicalizeSeamed_eq_of_region_eq_of_irredundant_length_ge_three
    firstOutput secondOutput
      (by simpa [firstOutput, firstWound] using firstOutputLength)
      (by simpa [secondOutput, secondWound] using secondOutputLength)
  · exact normalizeCyclicBoundaryFixed_nodup firstWound firstWoundNodup
  · exact normalizeCyclicBoundaryFixed_nodup secondWound secondWoundNodup
  · exact normalizeCyclicBoundaryFixed_ordered firstWound firstWoundOrdered
  · exact normalizeCyclicBoundaryFixed_ordered secondWound secondWoundOrdered
  · exact normalizeCyclicBoundaryFixed_irredundant firstWound firstWoundNodup
  · exact normalizeCyclicBoundaryFixed_irredundant secondWound secondWoundNodup
  · exact outputRegionEq

/-- The complete boundary normalizer is semantically extensional on the
strict duplicate-free polygon domain. -/
theorem normalizeCyclicBoundaryFixed_eq_of_region_eq_of_strictlyOrdered
    (first second : List (Vec2 R))
    (firstLength : 3 ≤ first.length) (secondLength : 3 ≤ second.length)
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstOrdered : AllStrictlyOrderedCCW first)
    (secondOrdered : AllStrictlyOrderedCCW second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    normalizeCyclicBoundaryFixed first =
      normalizeCyclicBoundaryFixed second := by
  rw [normalizeCyclicBoundaryFixed_eq_canonicalPolygon_of_strictlyOrdered
      first firstNodup firstOrdered,
    normalizeCyclicBoundaryFixed_eq_canonicalPolygon_of_strictlyOrdered
      second secondNodup secondOrdered]
  exact canonicalPolygon_eq_of_region_eq_of_strictlyOrdered
    first second firstLength secondLength firstNodup secondNodup
      firstOrdered secondOrdered sameRegion

/-- Exact polygon-list uniqueness follows once same-set ordered polygons are
known to have the same cyclic order.  The recovered permutation is passed to
that remaining order-rigidity obligation explicitly. -/
theorem canonicalPolygon_eq_of_region_eq_of_extreme_and_order_rigidity
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (sameRegion : listConvexRegion first = listConvexRegion second)
    (orderRigid : List.Perm first second → first ~r second) :
    canonicalPolygon first = canonicalPolygon second := by
  have sameVertices := perm_of_region_eq_of_allVerticesExtreme
    first second firstNodup secondNodup firstExtreme secondExtreme sameRegion
  have sameCyclicOrder := orderRigid sameVertices
  obtain ⟨count, rotatedEq⟩ := sameCyclicOrder
  rw [← rotatedEq]
  exact (canonicalPolygon_rotate first firstNodup count).symm

end Sprawlens.IrredundantPolygonUniqueness
