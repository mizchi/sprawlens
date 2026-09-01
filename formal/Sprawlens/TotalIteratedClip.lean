import Sprawlens.TotalSemanticReclassification

namespace Sprawlens.TotalIteratedClip

open AffineDimensionClassification
open CanonicalClip
open CollinearExtrema
open ConvexClipContract
open ConvexClipConsequences
open ExactGeometry
open HalfPlaneClipPoints
open ListReclipClassification
open OrderedTriples
open ReclipCertificate
open SemanticReclassification
open SimpleRing
open StrictConvexContract
open TotalSemanticReclassification

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Representation invariant needed to run another total step.  Degenerate
artifacts already have a total executable step.  Polygon artifacts retain
weak global order and duplicate freedom in addition to the reusable one-step
certificate stored by their constructor. -/
def IterationReady : IteratedArtifact R → Prop
  | .degenerate _ => True
  | .polygon points lengthAtLeastThree _ =>
      points.Nodup ∧
        IsLinearlyOrderedCCW (listVertex points lengthAtLeastThree)

/-- The affine-dimension fork constructs an artifact that is both
semantically exact and ready for another step. -/
theorem exists_ready_semanticReclassification_of_linearlyOrdered_of_nodup
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : IsLinearlyOrderedCCW
      (listVertex points lengthAtLeastThree))
    (nodup : points.Nodup) :
    ∃ artifact : IteratedArtifact R,
      SemanticallyReclassifies points artifact ∧ IterationReady artifact := by
  let vertex := listVertex points lengthAtLeastThree
  have injective : Function.Injective vertex :=
    listVertex_injective_of_nodup lengthAtLeastThree nodup
  rcases reclipCertified_or_allOrderedTriplesCollinear
      vertex ordered injective with certified | collinear
  · refine ⟨.polygon points lengthAtLeastThree certified,
      polygon_semanticallyReclassifies points lengthAtLeastThree certified,
      nodup, ordered⟩
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
        startMember finishMember ?_, trivial⟩
    intro point member
    have indexedMember : point ∈ indexedVertices vertex := by
      rw [indexedVertices_listVertex]
      exact member
    change point ∈ List.ofFn vertex at indexedMember
    rcases List.mem_ofFn.mp indexedMember with ⟨index, pointEq⟩
    simpa [start, finish, pointEq] using allOn index

/-- Every weakly ordered list can first be globally deduplicated and then
classified into an iteration-ready artifact without changing its convex
region. -/
theorem exists_ready_semanticReclassification_of_allOrderedCCW
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    ∃ artifact : IteratedArtifact R,
      SemanticallyReclassifies points artifact ∧ IterationReady artifact := by
  let normalized := points.dedup
  have normalizedNodup : normalized.Nodup := List.nodup_dedup points
  have normalizedOrdered : AllOrderedCCW normalized :=
    AllOrderedCCW.sublist (List.dedup_sublist points) ordered
  have normalizedClassified :
      ∃ artifact : IteratedArtifact R,
        SemanticallyReclassifies normalized artifact ∧
          IterationReady artifact := by
    cases normalizedEq : normalized with
    | nil => exact ⟨.degenerate .empty,
        empty_semanticallyReclassifies, trivial⟩
    | cons first rest =>
        cases rest with
        | nil => exact ⟨.degenerate (.point first),
            point_semanticallyReclassifies first, trivial⟩
        | cons second tail =>
            cases tail with
            | nil => exact ⟨.degenerate (.segment first second),
                segment_semanticallyReclassifies first second, trivial⟩
            | cons third remaining =>
                let lengthAtLeastThree :
                    3 ≤ (first :: second :: third :: remaining).length := by
                  simp
                have ringOrdered : IsLinearlyOrderedCCW
                    (listVertex
                      (first :: second :: third :: remaining)
                      lengthAtLeastThree) := by
                  rw [linearlyOrdered_iff_indexedVertices_triplewise]
                  rw [indexedVertices_listVertex]
                  change AllOrderedCCW
                    (first :: second :: third :: remaining)
                  simpa [normalizedEq] using normalizedOrdered
                have branchNodup :
                    (first :: second :: third :: remaining).Nodup := by
                  simpa [normalizedEq] using normalizedNodup
                exact
                  exists_ready_semanticReclassification_of_linearlyOrdered_of_nodup
                    _ lengthAtLeastThree ringOrdered branchNodup
  rcases normalizedClassified with ⟨artifact, classified, ready⟩
  refine ⟨artifact, ?_, ready⟩
  change listConvexRegion points = artifact.region
  change listConvexRegion normalized = artifact.region at classified
  rw [← classified]
  exact (listConvexRegion_dedup points).symm

/-- Every ready artifact admits a next ready artifact through the concrete
emitter or the executable degenerate step. -/
theorem exists_ready_clipTransition
    (plane : HalfPlane R) (source : IteratedArtifact R)
    (sourceReady : IterationReady source) :
    ∃ output : IteratedArtifact R,
      ClipTransition plane source output ∧ IterationReady output := by
  cases source with
  | degenerate artifact =>
      exact ⟨.degenerate (DegenerateClip.clipDegenerateArtifact plane artifact),
        .degenerate artifact, trivial⟩
  | polygon points lengthAtLeastThree certified =>
      rcases sourceReady with ⟨_, ordered⟩
      have outputOrdered :
          AllOrderedCCW
            (clipIndexedRing plane
              (listVertex points lengthAtLeastThree)) :=
        clipIndexedRing_allOrderedCCW_of_linearlyOrdered plane
          (listVertex points lengthAtLeastThree) ordered
      rcases exists_ready_semanticReclassification_of_allOrderedCCW
          _ outputOrdered with ⟨output, classified, outputReady⟩
      exact ⟨output,
        .polygon points lengthAtLeastThree certified output classified,
        outputReady⟩

/-- A ready initial artifact admits a proof-carrying execution for any finite
constraint list, and its result remains ready. -/
theorem exists_ready_clipTransitions
    (planes : List (HalfPlane R)) (source : IteratedArtifact R)
    (sourceReady : IterationReady source) :
    ∃ output : IteratedArtifact R,
      ClipTransitions planes source output ∧ IterationReady output := by
  induction planes generalizing source with
  | nil => exact ⟨source, .nil source, sourceReady⟩
  | cons plane remaining inductionHypothesis =>
      rcases exists_ready_clipTransition plane source sourceReady with
        ⟨middle, first, middleReady⟩
      rcases inductionHypothesis middle middleReady with
        ⟨output, rest, outputReady⟩
      exact ⟨output,
        .cons plane remaining source middle output first rest,
        outputReady⟩

/-- End-to-end totality and exact declarative semantics for finite clipping
from every iteration-ready artifact. -/
theorem exists_ready_output_region_eq_constrainedRegion
    (planes : List (HalfPlane R)) (source : IteratedArtifact R)
    (sourceReady : IterationReady source) :
    ∃ output : IteratedArtifact R,
      IterationReady output ∧
        output.region = constrainedRegion source.region planes := by
  rcases exists_ready_clipTransitions planes source sourceReady with
    ⟨output, transitions, outputReady⟩
  exact ⟨output, outputReady,
    transitions.region_eq_constrainedRegion⟩

/-- Materializing a fixed-size ring and reindexing it through the variable-list
API preserves its vertex convex region, even though the index types are only
propositionally equal after length arithmetic. -/
theorem indexedVertexConvexRegion_listVertex_indexedVertices
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (lengthAtLeastThree : 3 ≤ (indexedVertices vertex).length) :
    indexedVertexConvexRegion
        (listVertex (indexedVertices vertex) lengthAtLeastThree) =
      indexedVertexConvexRegion vertex := by
  unfold indexedVertexConvexRegion
  congr 1
  ext point
  constructor
  · rintro ⟨index, pointEq⟩
    have member : point ∈ indexedVertices
        (listVertex (indexedVertices vertex) lengthAtLeastThree) := by
      change point ∈ List.ofFn
        (listVertex (indexedVertices vertex) lengthAtLeastThree)
      exact List.mem_ofFn.mpr ⟨index, pointEq⟩
    rw [indexedVertices_listVertex] at member
    change point ∈ List.ofFn vertex at member
    exact List.mem_ofFn.mp member
  · rintro ⟨index, pointEq⟩
    have member : point ∈ indexedVertices vertex := by
      change point ∈ List.ofFn vertex
      exact List.mem_ofFn.mpr ⟨index, pointEq⟩
    rw [← indexedVertices_listVertex
      (indexedVertices vertex) lengthAtLeastThree] at member
    change point ∈ List.ofFn
      (listVertex (indexedVertices vertex) lengthAtLeastThree) at member
    exact List.mem_ofFn.mp member

/-- A strict ordered polygon supplies the iteration-ready initial artifact. -/
theorem strictPolygon_initialArtifact_ready
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (strict : IsStrictVertexOrderedConvexCCW vertex) :
    ∃ lengthAtLeastThree : 3 ≤ (indexedVertices vertex).length,
      ∃ certified : IsReclipCertified
          (listVertex (indexedVertices vertex) lengthAtLeastThree),
        IterationReady
          (.polygon (indexedVertices vertex) lengthAtLeastThree certified) := by
  let lengthAtLeastThree : 3 ≤ (indexedVertices vertex).length := by
    simp [indexedVertices]
  let reindexedVertex :=
    listVertex (indexedVertices vertex) lengthAtLeastThree
  let originalIndex (index :
      RingIndex ((indexedVertices vertex).length - 3)) :
      RingIndex extraVertices :=
    ⟨index.val, by simpa [indexedVertices] using index.isLt⟩
  have reindexedEq (index) :
      reindexedVertex index = vertex (originalIndex index) := by
    simp only [reindexedVertex, listVertex, indexedVertices, List.get_ofFn]
    apply congrArg vertex
    apply Fin.ext
    rfl
  have reindexedStrict : IsStrictVertexOrderedConvexCCW reindexedVertex := by
    intro first second third firstBefore secondBefore
    rw [reindexedEq, reindexedEq, reindexedEq]
    apply strict
    · simpa [originalIndex] using firstBefore
    · simpa [originalIndex] using secondBefore
  have certified : IsReclipCertified
      (listVertex (indexedVertices vertex) lengthAtLeastThree) := by
    exact IsStrictVertexOrderedConvexCCW.reclipCertified reindexedStrict
  refine ⟨lengthAtLeastThree, certified, ?_⟩
  constructor
  · exact List.nodup_ofFn_ofInjective strict.injective
  · exact IsStrictlyLinearlyOrderedCCW.weak reindexedStrict

/-- End-to-end theorem for the paper-facing initial condition: clipping any
strict ordered polygon by any finite list of closed half-planes produces a
ready artifact whose region is exactly the declarative intersection. -/
theorem strictPolygon_exists_ready_output_region_eq_constrainedRegion
    {extraVertices : Nat}
    (planes : List (HalfPlane R))
    (vertex : RingIndex extraVertices → Vec2 R)
    (strict : IsStrictVertexOrderedConvexCCW vertex) :
    ∃ output : IteratedArtifact R,
      IterationReady output ∧
        output.region =
          constrainedRegion (indexedVertexConvexRegion vertex) planes := by
  rcases strictPolygon_initialArtifact_ready vertex strict with
    ⟨lengthAtLeastThree, certified, sourceReady⟩
  let source : IteratedArtifact R :=
    .polygon (indexedVertices vertex) lengthAtLeastThree certified
  rcases exists_ready_output_region_eq_constrainedRegion
      planes source sourceReady with ⟨output, outputReady, regionEq⟩
  refine ⟨output, outputReady, ?_⟩
  rw [regionEq]
  congr 2
  exact indexedVertexConvexRegion_listVertex_indexedVertices
    vertex lengthAtLeastThree

end Sprawlens.TotalIteratedClip
