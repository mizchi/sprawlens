import Sprawlens.DegenerateClip

namespace Sprawlens.SemanticReclassification

open CanonicalClip
open ConvexClipContract
open ConvexClipConsequences
open DegenerateClip
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneClipRing
open HalfPlaneIntersection
open ListReclipClassification
open ReclipCertificate
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Convex point-set semantics of an arbitrary emitted vertex list.  Unlike
`OutputReclassification`, this definition is meaningful at every affine
dimension and does not infer dimension from the number of list elements. -/
def listConvexRegion (points : List (Vec2 R)) : Set (Vec2 R) :=
  convexHull R { point | point ∈ points }

/-- A reusable clipping state is either a genuinely lower-dimensional
artifact or a polygon carrying the certificate required by the next step. -/
inductive IteratedArtifact (R : Type u)
    [Field R] [LinearOrder R] [IsStrictOrderedRing R] where
  | degenerate (artifact : DegenerateArtifact R)
  | polygon (points : List (Vec2 R))
      (lengthAtLeastThree : 3 ≤ points.length)
      (certified : IsReclipCertified
        (listVertex points lengthAtLeastThree))

/-- Point-set semantics, deliberately separated from materialized list
shape.  This permits a redundant collinear list to normalize to a segment. -/
def IteratedArtifact.region : IteratedArtifact R → Set (Vec2 R)
  | .degenerate artifact => artifact.region
  | .polygon points lengthAtLeastThree _ =>
      indexedVertexConvexRegion (listVertex points lengthAtLeastThree)

/-- Semantic reclassification preserves the represented convex region; it
does not require the raw list to equal the normalized artifact vertices. -/
def SemanticallyReclassifies
    (points : List (Vec2 R)) (artifact : IteratedArtifact R) : Prop :=
  listConvexRegion points = artifact.region

/-- Existential output contract used by an iterated clipping driver. -/
def HasSemanticReclassification (points : List (Vec2 R)) : Prop :=
  ∃ artifact : IteratedArtifact R,
    SemanticallyReclassifies points artifact

/-- The custom segment semantics agrees with mathlib's affine segment. -/
theorem degenerateSegment_region_eq_segment (start finish : Vec2 R) :
    (DegenerateArtifact.segment start finish).region =
      segment R start finish := by
  ext point
  constructor
  · rintro ⟨parameter, parameterBounds, rfl⟩
    rw [← affineCombination_eq_interpolatePoint start finish
      (1 - parameter) parameter (by ring)]
    simpa only [AffineMap.lineMap_apply_module] using
      lineMap_mem_segment R start finish parameterBounds
  · intro member
    rw [segment_eq_image_lineMap] at member
    rcases member with ⟨parameter, parameterBounds, pointEq⟩
    refine ⟨parameter, parameterBounds, ?_⟩
    rw [← pointEq]
    simp only [AffineMap.lineMap_apply_module]
    exact affineCombination_eq_interpolatePoint start finish
      (1 - parameter) parameter (by ring)

theorem empty_semanticallyReclassifies :
    SemanticallyReclassifies ([] : List (Vec2 R))
      (.degenerate .empty) := by
  simp [SemanticallyReclassifies, listConvexRegion, IteratedArtifact.region,
    DegenerateArtifact.region, convexHull_empty]

theorem point_semanticallyReclassifies (point : Vec2 R) :
    SemanticallyReclassifies [point]
      (.degenerate (.point point)) := by
  simp [SemanticallyReclassifies, listConvexRegion, IteratedArtifact.region,
    DegenerateArtifact.region, convexHull_singleton]

theorem segment_semanticallyReclassifies (start finish : Vec2 R) :
    SemanticallyReclassifies [start, finish]
      (.degenerate (.segment start finish)) := by
  rw [SemanticallyReclassifies, listConvexRegion,
    IteratedArtifact.region, degenerateSegment_region_eq_segment]
  rw [show { point | point ∈ [start, finish] } = {start, finish} by
    ext point
    simp]
  exact convexHull_pair start finish

/-- Reindexing a polygon list changes neither its generator set nor its convex
region. -/
theorem listConvexRegion_eq_indexedVertexConvexRegion
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length) :
    listConvexRegion points =
      indexedVertexConvexRegion (listVertex points lengthAtLeastThree) := by
  unfold listConvexRegion indexedVertexConvexRegion
  congr 1
  ext point
  constructor
  · intro member
    have indexedMember :
        point ∈ indexedVertices (listVertex points lengthAtLeastThree) := by
      rw [indexedVertices_listVertex]
      exact member
    change point ∈ List.ofFn
      (listVertex points lengthAtLeastThree) at indexedMember
    exact List.mem_ofFn.mp indexedMember
  · intro member
    have indexedMember :
        point ∈ indexedVertices (listVertex points lengthAtLeastThree) := by
      change point ∈ List.ofFn (listVertex points lengthAtLeastThree)
      exact List.mem_ofFn.mpr member
    rw [indexedVertices_listVertex] at indexedMember
    exact indexedMember

/-- Every certified polygon list has the identity semantic
reclassification. -/
theorem polygon_semanticallyReclassifies
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (certified : IsReclipCertified
      (listVertex points lengthAtLeastThree)) :
    SemanticallyReclassifies points
      (.polygon points lengthAtLeastThree certified) := by
  exact listConvexRegion_eq_indexedVertexConvexRegion
    points lengthAtLeastThree

/-- The previous shape-exact classification embeds into the semantic one.
The converse is intentionally false: semantic classification also accepts
redundant collinear lists. -/
theorem hasSemanticReclassification_of_outputReclassification
    {points : List (Vec2 R)}
    (classified : OutputReclassification points) :
    HasSemanticReclassification points := by
  cases classified with
  | empty => exact ⟨.degenerate .empty, empty_semanticallyReclassifies⟩
  | point value =>
      exact ⟨.degenerate (.point value), point_semanticallyReclassifies value⟩
  | segment start finish =>
      exact ⟨.degenerate (.segment start finish),
        segment_semanticallyReclassifies start finish⟩
  | polygon points lengthAtLeastThree certified =>
      exact ⟨.polygon points lengthAtLeastThree certified,
        polygon_semanticallyReclassifies points lengthAtLeastThree certified⟩

/-- Any emitted list whose points all lie between two included extrema has
exactly the endpoint segment's convex semantics.  This is the reusable
dimension-aware replacement for branching on list length. -/
theorem list_semanticallyReclassifies_segment
    (points : List (Vec2 R)) (start finish : Vec2 R)
    (startMember : start ∈ points) (finishMember : finish ∈ points)
    (allOnSegment : ∀ point ∈ points,
      OnClosedSegment start finish point) :
    SemanticallyReclassifies points
      (.degenerate (.segment start finish)) := by
  rw [SemanticallyReclassifies, listConvexRegion,
    IteratedArtifact.region, degenerateSegment_region_eq_segment]
  apply Set.Subset.antisymm
  · apply convexHull_min
    · intro point member
      rw [← degenerateSegment_region_eq_segment]
      exact allOnSegment point member
    · exact convex_segment start finish
  · exact segment_subset_convexHull startMember finishMember

/-- A three-element list whose middle point lies on the endpoint segment has
exactly the segment's convex semantics, irrespective of its raw length. -/
theorem collinearTriple_semanticallyReclassifies_segment
    (start middle finish : Vec2 R)
    (middleOnSegment : OnClosedSegment start finish middle) :
    SemanticallyReclassifies [start, middle, finish]
      (.degenerate (.segment start finish)) := by
  apply list_semanticallyReclassifies_segment
  · simp
  · simp
  · intro point member
    simp only [List.mem_cons] at member
    rcases member with pointEq | pointEq | pointEq | member
    · simpa [pointEq] using onClosedSegment_start start finish
    · simpa [pointEq] using middleOnSegment
    · simpa [pointEq] using onClosedSegment_finish start finish
    · simp at member

/-- One step of the iterated driver.  The degenerate branch is executable;
the polygon branch records the semantic reclassification proof produced after
running the existing list emitter. -/
inductive ClipTransition (plane : HalfPlane R) :
    IteratedArtifact R → IteratedArtifact R → Prop
  | degenerate (source : DegenerateArtifact R) :
      ClipTransition plane (.degenerate source)
        (.degenerate (clipDegenerateArtifact plane source))
  | polygon
      (points : List (Vec2 R))
      (lengthAtLeastThree : 3 ≤ points.length)
      (certified : IsReclipCertified
        (listVertex points lengthAtLeastThree))
      (output : IteratedArtifact R)
      (classified : SemanticallyReclassifies
        (clipIndexedRing plane (listVertex points lengthAtLeastThree)) output) :
      ClipTransition plane
        (.polygon points lengthAtLeastThree certified) output

/-- Every accepted transition denotes exactly intersection with the next
closed half-plane, regardless of whether its result remains two-dimensional
or collapses to a segment, point, or empty set. -/
theorem ClipTransition.region_eq_intersection
    (plane : HalfPlane R) (source output : IteratedArtifact R)
    (transition : ClipTransition plane source output) :
    output.region = source.region ∩ halfPlaneRegion plane := by
  cases transition with
  | degenerate source =>
      exact clipDegenerateArtifact_region plane source
  | polygon points lengthAtLeastThree certified output classified =>
      rw [← classified]
      change clipIndexedConvexRegion plane
          (listVertex points lengthAtLeastThree) =
        indexedVertexConvexRegion
            (listVertex points lengthAtLeastThree) ∩
          halfPlaneRegion plane
      exact clipIndexedConvexRegion_eq_of_reclipCertified plane
        (listVertex points lengthAtLeastThree) certified

/-- A proof-carrying finite execution.  Totality is deliberately separated:
each polygon step must provide either a certified polygon or a semantically
equivalent lower-dimensional artifact. -/
inductive ClipTransitions : List (HalfPlane R) →
    IteratedArtifact R → IteratedArtifact R → Prop
  | nil (source : IteratedArtifact R) : ClipTransitions [] source source
  | cons (plane : HalfPlane R) (remaining : List (HalfPlane R))
      (source middle output : IteratedArtifact R)
      (first : ClipTransition plane source middle)
      (rest : ClipTransitions remaining middle output) :
      ClipTransitions (plane :: remaining) source output

/-- Any finite accepted execution is exactly the declarative intersection of
the initial artifact with all supplied half-planes. -/
theorem ClipTransitions.region_eq_constrainedRegion
    (planes : List (HalfPlane R)) (source output : IteratedArtifact R)
    (transitions : ClipTransitions planes source output) :
    output.region = constrainedRegion source.region planes := by
  induction transitions with
  | nil source => exact (constrainedRegion_nil source.region).symm
  | cons plane remaining source middle output first rest
      inductionHypothesis =>
      rw [inductionHypothesis, first.region_eq_intersection]
      rw [← constrainedRegion_singleton]
      rw [← constrainedRegion_append]
      rfl

end Sprawlens.SemanticReclassification
