import Sprawlens.IrredundantPolygonUniqueness

namespace Sprawlens.CanonicalIteratedClip

open CanonicalClip
open ConvexClipContract
open ConvexClipConsequences
open DegenerateClip
open ExactGeometry
open ExecutableCanonicalizer
open HalfPlaneClipPoints
open HalfPlaneIntersection
open IrredundantPolygonUniqueness
open ListReclipClassification
open OrderedTriples
open RedundantBoundaryNormalizer
open ReclipCertificate
open SemanticReclassification
open SimpleRing
open StrictConvexContract
open TotalIteratedClip
open TotalSemanticReclassification

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Proof-free vertex materialization shared by degenerate and polygonal
iteration artifacts. -/
def iteratedArtifactPoints : IteratedArtifact R → List (Vec2 R)
  | .degenerate artifact => artifact.points
  | .polygon points _ _ => points

/-- Materializing an iteration artifact preserves its continuous region. -/
theorem listConvexRegion_iteratedArtifactPoints
    (artifact : IteratedArtifact R) :
    listConvexRegion (iteratedArtifactPoints artifact) = artifact.region := by
  cases artifact with
  | degenerate artifact =>
      cases artifact with
      | empty =>
          simpa [iteratedArtifactPoints, DegenerateArtifact.points,
            SemanticallyReclassifies] using
            (empty_semanticallyReclassifies (R := R))
      | point value =>
          simpa [iteratedArtifactPoints, DegenerateArtifact.points,
            SemanticallyReclassifies] using
            (point_semanticallyReclassifies value)
      | segment start finish =>
          simpa [iteratedArtifactPoints, DegenerateArtifact.points,
            SemanticallyReclassifies] using
            (segment_semanticallyReclassifies start finish)
  | polygon points lengthAtLeastThree certified =>
      simpa [iteratedArtifactPoints, SemanticallyReclassifies] using
        (polygon_semanticallyReclassifies
          points lengthAtLeastThree certified)

/-- Deduplication makes every materialization duplicate-free without changing
the region, including a degenerate segment whose endpoints happen to agree. -/
theorem listConvexRegion_dedup_iteratedArtifactPoints
    (artifact : IteratedArtifact R) :
    listConvexRegion (iteratedArtifactPoints artifact).dedup =
      artifact.region := by
  exact (listConvexRegion_dedup (iteratedArtifactPoints artifact)).trans
    (listConvexRegion_iteratedArtifactPoints artifact)

/-- Ready artifacts materialize in weak CCW order.  Degenerate lists have at
most two values; the polygon branch carries the linear-order certificate. -/
theorem iteratedArtifactPoints_allOrderedCCW
    (artifact : IteratedArtifact R) (ready : IterationReady artifact) :
    AllOrderedCCW (iteratedArtifactPoints artifact) := by
  cases artifact with
  | degenerate artifact =>
      cases artifact <;>
        simp [iteratedArtifactPoints, DegenerateArtifact.points,
          AllOrderedCCW, AllOrderedTriples]
  | polygon points lengthAtLeastThree certified =>
      rcases ready with ⟨_, ordered⟩
      rw [linearlyOrdered_iff_indexedVertices_triplewise] at ordered
      rw [indexedVertices_listVertex] at ordered
      exact ordered

/-- Canonicalize the duplicate-free materialization of a ready artifact. -/
def canonicalizeReadyArtifact
    (artifact : IteratedArtifact R) : CanonicalArtifact R :=
  canonicalizeReducedWindingSeamed
    (iteratedArtifactPoints artifact).dedup

/-- The ready-artifact adapter preserves continuous semantics. -/
theorem canonicalizeReadyArtifact_region
    (artifact : IteratedArtifact R) (ready : IterationReady artifact) :
    (canonicalizeReadyArtifact artifact).region = artifact.region := by
  rw [canonicalizeReadyArtifact,
    canonicalizeReducedWindingSeamed_region]
  · exact listConvexRegion_dedup_iteratedArtifactPoints artifact
  · exact Or.inl <| AllOrderedCCW.sublist
      (List.dedup_sublist (iteratedArtifactPoints artifact))
      (iteratedArtifactPoints_allOrderedCCW artifact ready)

/-- Equal ready-artifact regions have exactly equal public canonical forms. -/
theorem canonicalizeReadyArtifact_eq_of_region_eq
    (first second : IteratedArtifact R)
    (firstReady : IterationReady first)
    (secondReady : IterationReady second)
    (sameRegion : first.region = second.region) :
    canonicalizeReadyArtifact first = canonicalizeReadyArtifact second := by
  apply canonicalizeReducedWindingSeamed_eq_of_region_eq
  · exact List.nodup_dedup (iteratedArtifactPoints first)
  · exact List.nodup_dedup (iteratedArtifactPoints second)
  · exact Or.inl <| AllOrderedCCW.sublist
      (List.dedup_sublist (iteratedArtifactPoints first))
      (iteratedArtifactPoints_allOrderedCCW first firstReady)
  · exact Or.inl <| AllOrderedCCW.sublist
      (List.dedup_sublist (iteratedArtifactPoints second))
      (iteratedArtifactPoints_allOrderedCCW second secondReady)
  · rw [listConvexRegion_dedup_iteratedArtifactPoints,
      listConvexRegion_dedup_iteratedArtifactPoints]
    exact sameRegion

/-- Constraint permutations produce identical canonical artifacts for any two
proof-carrying ready executions from the same ready source. -/
theorem canonicalizeReadyArtifact_eq_of_clipTransitions_perm
    (source first second : IteratedArtifact R)
    (firstReady : IterationReady first)
    (secondReady : IterationReady second)
    (planes reordered : List (HalfPlane R))
    (permutation : planes.Perm reordered)
    (firstTransitions : ClipTransitions planes source first)
    (secondTransitions : ClipTransitions reordered source second) :
    canonicalizeReadyArtifact first = canonicalizeReadyArtifact second := by
  apply canonicalizeReadyArtifact_eq_of_region_eq
      first second firstReady secondReady
  rw [firstTransitions.region_eq_constrainedRegion,
    secondTransitions.region_eq_constrainedRegion]
  exact constrainedRegion_perm source.region permutation

/-- Totality supplies canonical-equal ready executions for both sides of every
constraint permutation. -/
theorem exists_ready_clipTransitions_perm_canonical_eq
    (source : IteratedArtifact R) (sourceReady : IterationReady source)
    (planes reordered : List (HalfPlane R))
    (permutation : planes.Perm reordered) :
    ∃ first second : IteratedArtifact R,
      ClipTransitions planes source first ∧
        ClipTransitions reordered source second ∧
        IterationReady first ∧ IterationReady second ∧
        canonicalizeReadyArtifact first =
          canonicalizeReadyArtifact second := by
  rcases exists_ready_clipTransitions planes source sourceReady with
    ⟨first, firstTransitions, firstReady⟩
  rcases exists_ready_clipTransitions reordered source sourceReady with
    ⟨second, secondTransitions, secondReady⟩
  refine ⟨first, second, firstTransitions, secondTransitions,
    firstReady, secondReady, ?_⟩
  exact canonicalizeReadyArtifact_eq_of_clipTransitions_perm
    source first second firstReady secondReady planes reordered
      permutation firstTransitions secondTransitions

/-- Paper-facing end-to-end corollary: a strict ordered polygon clipped by
permuted finite closed-half-plane lists has identical canonical output. -/
theorem strictPolygon_exists_canonical_outputs_eq_of_perm
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (strict : IsStrictVertexOrderedConvexCCW vertex)
    (planes reordered : List (HalfPlane R))
    (permutation : planes.Perm reordered) :
    ∃ lengthAtLeastThree : 3 ≤ (indexedVertices vertex).length,
      ∃ certified : IsReclipCertified
          (listVertex (indexedVertices vertex) lengthAtLeastThree),
        ∃ first second : IteratedArtifact R,
          ClipTransitions planes
              (.polygon (indexedVertices vertex)
                lengthAtLeastThree certified) first ∧
            ClipTransitions reordered
              (.polygon (indexedVertices vertex)
                lengthAtLeastThree certified) second ∧
            IterationReady first ∧ IterationReady second ∧
            canonicalizeReadyArtifact first =
              canonicalizeReadyArtifact second := by
  rcases strictPolygon_initialArtifact_ready vertex strict with
    ⟨lengthAtLeastThree, certified, sourceReady⟩
  let source : IteratedArtifact R :=
    .polygon (indexedVertices vertex) lengthAtLeastThree certified
  rcases exists_ready_clipTransitions_perm_canonical_eq
      source sourceReady planes reordered permutation with
    ⟨first, second, firstTransitions, secondTransitions,
      firstReady, secondReady, canonicalEq⟩
  exact ⟨lengthAtLeastThree, certified, first, second,
    firstTransitions, secondTransitions, firstReady, secondReady,
    canonicalEq⟩

end Sprawlens.CanonicalIteratedClip
