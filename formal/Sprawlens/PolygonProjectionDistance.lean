import Sprawlens.PolygonBoundaryMetric
import Sprawlens.SegmentProjection

namespace Sprawlens.PolygonProjectionDistance

open Set
open PolygonBoundaryMetric
open SegmentProjection

universe u

variable {E : Type u} [NormedAddCommGroup E] [InnerProductSpace ℝ E]

omit [InnerProductSpace ℝ E] in
/-- Real-valued distance to a union is the minimum of the two distances when
both sets are nonempty. The hypotheses avoid `infDist`'s zero convention for
the empty set. -/
theorem infDist_union_of_nonempty
    (point : E) {first second : Set E}
    (firstNonempty : first.Nonempty)
    (secondNonempty : second.Nonempty) :
    Metric.infDist point (first ∪ second) =
      min (Metric.infDist point first) (Metric.infDist point second) := by
  simp only [Metric.infDist]
  rw [Metric.infEDist_union,
    ENNReal.toReal_min
      (Metric.infEDist_ne_top firstNonempty)
      (Metric.infEDist_ne_top secondNonempty)]

/-- Minimum of exact point-to-segment projection distances along a chain,
including the final closing edge. -/
noncomputable def chainProjectionDistance
    (point origin previous : E) : List E → ℝ
  | [] => dist point (segmentProjection point previous origin)
  | next :: remaining =>
      min
        (dist point (segmentProjection point previous next))
        (chainProjectionDistance point origin next remaining)

/-- Polygon counterpart of `chainProjectionDistance`. The empty polygon uses
the same zero convention as real-valued `Metric.infDist`. -/
noncomputable def polygonProjectionDistance (point : E) : List E → ℝ
  | [] => 0
  | first :: remaining =>
      chainProjectionDistance point first first remaining

theorem infDist_chainBoundary_eq_chainProjectionDistance
    (point origin previous : E) (remaining : List E) :
    Metric.infDist point (chainBoundary origin previous remaining) =
      chainProjectionDistance point origin previous remaining := by
  induction remaining generalizing previous with
  | nil =>
      simpa [chainBoundary, chainProjectionDistance] using
        infDist_segment_eq_dist_projection point previous origin
  | cons next rest inductionHypothesis =>
      rw [chainBoundary, chainProjectionDistance,
        infDist_union_of_nonempty point
          ⟨previous, left_mem_segment ℝ previous next⟩
          (chainBoundary_nonempty origin next rest),
        infDist_segment_eq_dist_projection,
        inductionHypothesis]

/-- Folding the exact projection distance over every closed polygon edge is
exactly the distance to the polygon's geometric boundary set. -/
theorem infDist_polygonBoundarySet_eq_polygonProjectionDistance
    (point : E) (vertices : List E) :
    Metric.infDist point (polygonBoundarySet vertices) =
      polygonProjectionDistance point vertices := by
  cases vertices with
  | nil => simp [polygonBoundarySet, polygonProjectionDistance]
  | cons first remaining =>
      simpa [polygonBoundarySet, polygonProjectionDistance] using
        infDist_chainBoundary_eq_chainProjectionDistance
          point first first remaining

end Sprawlens.PolygonProjectionDistance
