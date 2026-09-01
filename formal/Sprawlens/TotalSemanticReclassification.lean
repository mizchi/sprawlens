import Sprawlens.CollinearExtrema

namespace Sprawlens.TotalSemanticReclassification

open AffineDimensionClassification
open CollinearExtrema
open ConvexClipContract
open ExactGeometry
open HalfPlaneClipPoints
open ListReclipClassification
open OrderedTriples
open SemanticReclassification
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A duplicate-free weakly ordered list with at least three elements can
always be reclassified semantically: the positive-dimensional fork is a
reclip-certified polygon, and the all-collinear fork is normalized to its two
actual extreme vertices. -/
theorem hasSemanticReclassification_of_linearlyOrdered_of_nodup
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : IsLinearlyOrderedCCW
      (listVertex points lengthAtLeastThree))
    (nodup : points.Nodup) :
    HasSemanticReclassification points := by
  let vertex := listVertex points lengthAtLeastThree
  have injective : Function.Injective vertex :=
    listVertex_injective_of_nodup lengthAtLeastThree nodup
  rcases reclipCertified_or_allOrderedTriplesCollinear
      vertex ordered injective with certified | collinear
  · exact ⟨.polygon points lengthAtLeastThree certified,
      polygon_semanticallyReclassifies points lengthAtLeastThree certified⟩
  · rcases exists_segment_extrema_of_allOrderedTriplesCollinear
        vertex injective collinear with ⟨startIndex, finishIndex, allOn⟩
    let start := vertex startIndex
    let finish := vertex finishIndex
    have startMember : start ∈ points := by
      rw [← indexedVertices_listVertex points lengthAtLeastThree]
      change start ∈ List.ofFn vertex
      exact List.mem_ofFn.mpr ⟨startIndex, rfl⟩
    have finishMember : finish ∈ points := by
      rw [← indexedVertices_listVertex points lengthAtLeastThree]
      change finish ∈ List.ofFn vertex
      exact List.mem_ofFn.mpr ⟨finishIndex, rfl⟩
    refine ⟨.degenerate (.segment start finish),
      list_semanticallyReclassifies_segment points start finish
        startMember finishMember ?_⟩
    intro point member
    have indexedMember : point ∈ indexedVertices vertex := by
      rw [indexedVertices_listVertex]
      exact member
    change point ∈ List.ofFn vertex at indexedMember
    rcases List.mem_ofFn.mp indexedMember with ⟨index, pointEq⟩
    simpa [start, finish, pointEq] using allOn index

/-- Length zero, one, and two are already exact degenerate artifacts.  At
length three or more, weak order and duplicate freedom are sufficient for the
dimension-aware total classification above. -/
theorem hasSemanticReclassification_of_orderedPolygonBranch
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : ∀ lengthAtLeastThree : 3 ≤ points.length,
      IsLinearlyOrderedCCW (listVertex points lengthAtLeastThree)) :
    HasSemanticReclassification points := by
  cases points with
  | nil => exact ⟨.degenerate .empty, empty_semanticallyReclassifies⟩
  | cons first rest =>
      cases rest with
      | nil => exact ⟨.degenerate (.point first),
          point_semanticallyReclassifies first⟩
      | cons second tail =>
          cases tail with
          | nil => exact ⟨.degenerate (.segment first second),
              segment_semanticallyReclassifies first second⟩
          | cons third remaining =>
              let lengthAtLeastThree :
                  3 ≤ (first :: second :: third :: remaining).length := by simp
              exact hasSemanticReclassification_of_linearlyOrdered_of_nodup
                _ lengthAtLeastThree (ordered lengthAtLeastThree) nodup

/-- The executable emitter therefore has a total semantic reclassification
whenever its source has weak global order and its normalized output is
duplicate-free. -/
theorem clipOutput_hasSemanticReclassification
    {extraVertices : Nat}
    (plane : HalfPlane R) (source : RingIndex extraVertices → Vec2 R)
    (sourceOrdered : IsLinearlyOrderedCCW source)
    (outputNodup : (clipIndexedRing plane source).Nodup) :
    HasSemanticReclassification (clipIndexedRing plane source) := by
  apply hasSemanticReclassification_of_orderedPolygonBranch _ outputNodup
  intro lengthAtLeastThree
  exact clipOutput_listVertex_linearlyOrdered
    plane source sourceOrdered lengthAtLeastThree

omit [IsStrictOrderedRing R] in
/-- Removing repeated values anywhere in a list preserves its convex point-set
semantics, not merely its traversal shape. -/
theorem listConvexRegion_dedup (points : List (Vec2 R)) :
    listConvexRegion points.dedup = listConvexRegion points := by
  unfold listConvexRegion
  congr 1
  ext point
  simp

/-- Global deduplication removes the injectivity side condition without
changing semantics.  Since it is a sublist, weak global order is preserved;
the deduplicated list can therefore be classified by affine dimension. -/
theorem hasSemanticReclassification_of_allOrderedCCW
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    HasSemanticReclassification points := by
  let normalized := points.dedup
  have normalizedNodup : normalized.Nodup := List.nodup_dedup points
  have normalizedOrdered : AllOrderedCCW normalized :=
    AllOrderedCCW.sublist (List.dedup_sublist points) ordered
  have normalizedClassified : HasSemanticReclassification normalized := by
    apply hasSemanticReclassification_of_orderedPolygonBranch
      normalized normalizedNodup
    intro lengthAtLeastThree
    rw [linearlyOrdered_iff_indexedVertices_triplewise]
    rw [indexedVertices_listVertex]
    exact normalizedOrdered
  rcases normalizedClassified with ⟨artifact, classified⟩
  refine ⟨artifact, ?_⟩
  change listConvexRegion points = artifact.region
  change listConvexRegion normalized = artifact.region at classified
  rw [← classified]
  exact (listConvexRegion_dedup points).symm

/-- Consequently the executable output of every weakly globally ordered
source has a total dimension-aware semantic reclassification.  No separate
output-length or duplicate-freedom premise remains. -/
theorem clipOutput_hasSemanticReclassification_of_linearlyOrdered
    {extraVertices : Nat}
    (plane : HalfPlane R) (source : RingIndex extraVertices → Vec2 R)
    (sourceOrdered : IsLinearlyOrderedCCW source) :
    HasSemanticReclassification (clipIndexedRing plane source) := by
  apply hasSemanticReclassification_of_allOrderedCCW
  exact clipIndexedRing_allOrderedCCW_of_linearlyOrdered
    plane source sourceOrdered

end Sprawlens.TotalSemanticReclassification
