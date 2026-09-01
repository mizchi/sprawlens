import Mathlib.Analysis.Convex.Topology
import Sprawlens.BoundaryDiscrepancy

namespace Sprawlens.PolygonBoundaryMetric

open BoundaryDiscrepancy
open SameEndpointConsistency
open Set

universe u

variable {E : Type u} [MetricSpace E] [AddCommGroup E] [Module ℝ E]
  [IsTopologicalAddGroup E] [ContinuousSMul ℝ E]

/-- Boundary of an open polygon list, accumulated from one edge at a time.
The empty tail contributes the closing segment back to `origin`. -/
def chainBoundary (origin previous : E) : List E → Set E
  | [] => segment ℝ previous origin
  | next :: remaining =>
      segment ℝ previous next ∪ chainBoundary origin next remaining

/-- Geometric boundary represented by an open vertex list. Empty input has no
boundary; every nonempty input includes the closing edge. -/
def polygonBoundarySet : List E → Set E
  | [] => ∅
  | first :: remaining => chainBoundary first first remaining

theorem segment_isCompact (first second : E) :
    IsCompact (segment ℝ first second) := by
  rw [← convexHull_pair]
  exact (Set.toFinite {first, second}).isCompact_convexHull ℝ

theorem chainBoundary_isCompact (origin previous : E) (remaining : List E) :
    IsCompact (chainBoundary origin previous remaining) := by
  induction remaining generalizing previous with
  | nil => exact segment_isCompact previous origin
  | cons next rest inductionHypothesis =>
      exact (segment_isCompact previous next).union
        (inductionHypothesis next)

theorem polygonBoundarySet_isCompact (points : List E) :
    IsCompact (polygonBoundarySet points) := by
  cases points with
  | nil => exact isCompact_empty
  | cons first remaining =>
      exact chainBoundary_isCompact first first remaining

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
theorem chainBoundary_nonempty (origin previous : E) (remaining : List E) :
    (chainBoundary origin previous remaining).Nonempty := by
  cases remaining with
  | nil =>
      exact ⟨previous, left_mem_segment ℝ previous origin⟩
  | cons next rest =>
      exact ⟨previous, Or.inl (left_mem_segment ℝ previous next)⟩

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
theorem polygonBoundarySet_nonempty (first : E) (remaining : List E) :
    (polygonBoundarySet (first :: remaining)).Nonempty := by
  exact chainBoundary_nonempty first first remaining

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- Appending a final vertex moves the closing edge and exposes the same
cyclic chain with a different origin. -/
theorem chainBoundary_append_singleton
    (origin previous closing : E) (remaining : List E) :
    chainBoundary origin previous (remaining ++ [closing]) =
      segment ℝ closing origin ∪ chainBoundary closing previous remaining := by
  induction remaining generalizing previous with
  | nil =>
      simp [chainBoundary, union_comm]
  | cons next rest inductionHypothesis =>
      simp only [List.cons_append, chainBoundary]
      rw [inductionHypothesis]
      ac_rfl

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- Moving the open-list seam by one vertex preserves the union of its closed
edge segments. -/
theorem polygonBoundarySet_rotate_one (points : List E) :
    polygonBoundarySet (points.rotate 1) = polygonBoundarySet points := by
  cases points with
  | nil => simp [polygonBoundarySet]
  | cons first remaining =>
      cases remaining with
      | nil => simp [polygonBoundarySet, chainBoundary]
      | cons second rest =>
          simp only [List.rotate_cons_succ, List.rotate_zero,
            polygonBoundarySet]
          change chainBoundary second second (rest ++ [first]) =
            chainBoundary first first (second :: rest)
          rw [chainBoundary_append_singleton]
          rfl

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- Arbitrary seam rotation preserves the geometric boundary set. -/
theorem polygonBoundarySet_rotate (points : List E) (amount : Nat) :
    polygonBoundarySet (points.rotate amount) = polygonBoundarySet points := by
  induction amount with
  | zero => simp
  | succ amount inductionHypothesis =>
      calc
        polygonBoundarySet (points.rotate (amount + 1)) =
            polygonBoundarySet ((points.rotate amount).rotate 1) := by
          rw [List.rotate_rotate]
        _ = polygonBoundarySet (points.rotate amount) :=
          polygonBoundarySet_rotate_one (points.rotate amount)
        _ = polygonBoundarySet points := inductionHypothesis

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- Reversing a closed chain exchanges every segment's endpoints and therefore
preserves the same undirected boundary. -/
theorem chainBoundary_reverse
    (origin previous : E) (remaining : List E) :
    chainBoundary origin previous remaining =
      chainBoundary previous origin remaining.reverse := by
  induction remaining generalizing origin previous with
  | nil => simp [chainBoundary, segment_symm]
  | cons next rest inductionHypothesis =>
      simp only [List.reverse_cons]
      rw [chainBoundary_append_singleton]
      simp only [chainBoundary]
      rw [segment_symm ℝ previous next, inductionHypothesis]

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- Winding reversal preserves the union of polygon edges. -/
theorem polygonBoundarySet_reverse (points : List E) :
    polygonBoundarySet points.reverse = polygonBoundarySet points := by
  cases points with
  | nil => simp [polygonBoundarySet]
  | cons first remaining =>
      have rotatedReverse :
          ((first :: remaining).reverse).rotate remaining.length =
            first :: remaining.reverse := by
        simpa using
          (List.rotate_append_length_eq remaining.reverse [first])
      calc
        polygonBoundarySet (first :: remaining).reverse =
            polygonBoundarySet
              ((first :: remaining).reverse.rotate remaining.length) :=
          (polygonBoundarySet_rotate
            (first :: remaining).reverse remaining.length).symm
        _ = polygonBoundarySet (first :: remaining.reverse) := by
          rw [rotatedReverse]
        _ = polygonBoundarySet (first :: remaining) := by
          simp only [polygonBoundarySet]
          exact (chainBoundary_reverse first first remaining).symm

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- A point on a closed segment splits it into two closed segments without
changing the represented point set. -/
theorem segment_union_segment_eq_of_mem
    (first middle last : E) (middleOnEdge : middle ∈ segment ℝ first last) :
    segment ℝ first middle ∪ segment ℝ middle last =
      segment ℝ first last := by
  apply Subset.antisymm
  · exact union_subset
      ((convex_segment (𝕜 := ℝ) first last).segment_subset
        (left_mem_segment ℝ first last) middleOnEdge)
      ((convex_segment (𝕜 := ℝ) first last).segment_subset
        middleOnEdge (right_mem_segment ℝ first last))
  · rw [← insert_endpoints_openSegment ℝ first last]
    intro point member
    rcases member with pointAtFirst | pointAtLast | pointInside
    · subst point
      exact Or.inl (left_mem_segment ℝ first middle)
    · subst point
      exact Or.inr (right_mem_segment ℝ middle last)
    · have middleOnLine :
          middle ∈ Set.range (AffineMap.lineMap first last : ℝ → E) := by
        rw [segment_eq_image_lineMap] at middleOnEdge
        rcases middleOnEdge with ⟨parameter, _, equalMiddle⟩
        exact ⟨parameter, equalMiddle⟩
      rcases openSegment_subset_union first last middleOnLine pointInside with
        pointAtMiddle | pointOnSplit
      · subst point
        exact Or.inl (right_mem_segment ℝ first middle)
      · rcases pointOnSplit with pointOnFirst | pointOnLast
        · exact Or.inl
            ((openSegment_subset_segment (𝕜 := ℝ) first middle) pointOnFirst)
        · exact Or.inr
            ((openSegment_subset_segment (𝕜 := ℝ) middle last) pointOnLast)

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
/-- Inserting a redundant point immediately before the next vertex preserves
the cyclic boundary. Seam invariance moves any chosen polygon edge to this
position. -/
theorem chainBoundary_insert_on_next
    (origin previous inserted next : E) (remaining : List E)
    (insertedOnEdge : inserted ∈ segment ℝ previous next) :
    chainBoundary origin previous (inserted :: next :: remaining) =
      chainBoundary origin previous (next :: remaining) := by
  simp only [chainBoundary]
  rw [← union_assoc, segment_union_segment_eq_of_mem
    previous inserted next insertedOnEdge]

omit [MetricSpace E] [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
theorem polygonBoundarySet_insert_after_first
    (first inserted next : E) (remaining : List E)
    (insertedOnEdge : inserted ∈ segment ℝ first next) :
    polygonBoundarySet (first :: inserted :: next :: remaining) =
      polygonBoundarySet (first :: next :: remaining) := by
  simp only [polygonBoundarySet]
  exact chainBoundary_insert_on_next
    first first inserted next remaining insertedOnEdge

/-- Every nonempty polygon list produces a nonempty compact boundary and hence
an admissible carrier for the Hausdorff metric. -/
def polygonCompactBoundary (first : E) (remaining : List E) :
    CompactBoundary E where
  carrier := polygonBoundarySet (first :: remaining)
  isCompact' := polygonBoundarySet_isCompact (first :: remaining)
  nonempty' := polygonBoundarySet_nonempty first remaining

@[simp]
theorem polygonCompactBoundary_coe (first : E) (remaining : List E) :
    (polygonCompactBoundary first remaining : Set E) =
      polygonBoundarySet (first :: remaining) := by
  rfl

theorem polygonBoundaryDifference_eq_hausdorffDist
    (firstA : E) (remainingA : List E)
    (firstB : E) (remainingB : List E) :
    (compactBoundaryDiscrepancy E).difference
        (polygonCompactBoundary firstA remainingA)
        (polygonCompactBoundary firstB remainingB) =
      Metric.hausdorffDist
        (polygonBoundarySet (firstA :: remainingA))
        (polygonBoundarySet (firstB :: remainingB)) := by
  exact compactBoundaryDifference_eq_hausdorffDist _ _

/-- Polygon boundary distance is zero exactly when the two unions of closed
edges are the same set. Vertex count, seam, and subdivision are intentionally
absent from this equality criterion. -/
theorem polygonBoundaryDifference_eq_zero_iff_set_eq
    (firstA : E) (remainingA : List E)
    (firstB : E) (remainingB : List E) :
    (compactBoundaryDiscrepancy E).difference
        (polygonCompactBoundary firstA remainingA)
        (polygonCompactBoundary firstB remainingB) = 0 ↔
      polygonBoundarySet (firstA :: remainingA) =
        polygonBoundarySet (firstB :: remainingB) := by
  exact compactBoundaryDifference_eq_zero_iff_set_eq _ _

theorem polygonBoundaryDifference_triangle
    (firstA : E) (remainingA : List E)
    (firstB : E) (remainingB : List E)
    (firstC : E) (remainingC : List E) :
    (compactBoundaryDiscrepancy E).difference
        (polygonCompactBoundary firstA remainingA)
        (polygonCompactBoundary firstC remainingC) ≤
      (compactBoundaryDiscrepancy E).difference
          (polygonCompactBoundary firstA remainingA)
          (polygonCompactBoundary firstB remainingB) +
        (compactBoundaryDiscrepancy E).difference
          (polygonCompactBoundary firstB remainingB)
          (polygonCompactBoundary firstC remainingC) := by
  exact compactBoundaryDifference_triangle _ _ _

omit [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
theorem hausdorffDist_polygonBoundarySet_rotate_eq_zero
    (points : List E) (amount : Nat) :
    Metric.hausdorffDist
      (polygonBoundarySet (points.rotate amount))
      (polygonBoundarySet points) = 0 := by
  rw [polygonBoundarySet_rotate]
  exact Metric.hausdorffDist_self_zero

omit [IsTopologicalAddGroup E] [ContinuousSMul ℝ E] in
theorem hausdorffDist_polygonBoundarySet_reverse_eq_zero
    (points : List E) :
    Metric.hausdorffDist
      (polygonBoundarySet points.reverse)
      (polygonBoundarySet points) = 0 := by
  rw [polygonBoundarySet_reverse]
  exact Metric.hausdorffDist_self_zero

theorem polygonBoundaryDifference_insert_after_first_eq_zero
    (first inserted next : E) (remaining : List E)
    (insertedOnEdge : inserted ∈ segment ℝ first next) :
    (compactBoundaryDiscrepancy E).difference
        (polygonCompactBoundary first (inserted :: next :: remaining))
        (polygonCompactBoundary first (next :: remaining)) = 0 := by
  apply (polygonBoundaryDifference_eq_zero_iff_set_eq
    first (inserted :: next :: remaining)
    first (next :: remaining)).mpr
  exact polygonBoundarySet_insert_after_first
    first inserted next remaining insertedOnEdge

end Sprawlens.PolygonBoundaryMetric
