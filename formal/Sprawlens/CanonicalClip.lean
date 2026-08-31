import Sprawlens.ConvexClipConsequences
import Sprawlens.StrictConvexContract
import Sprawlens.Vec2Linear

namespace Sprawlens.CanonicalClip

open Set
open Sprawlens.ConvexClipConsequences
open Sprawlens.ConvexClipContract
open Sprawlens.ExactGeometry
open Sprawlens.HalfPlaneClipPoints
open Sprawlens.HalfPlaneClipRing
open Sprawlens.HalfPlaneIntersection
open Sprawlens.SimpleRing
open Sprawlens.StrictConvexContract
open Sprawlens.Vec2Linear

universe u v w

/-- A representation is semantically sound for clipping when its denoted point
set is exactly the declarative intersection. -/
def EmitterSound
    {Point : Type u} {Plane : Type v} {Representation : Type w}
    (regionOf : Representation → Set Point)
    (constrain : Set Point → List Plane → Set Point)
    (emit : Set Point → List Plane → Representation) : Prop :=
  ∀ initial planes, regionOf (emit initial planes) = constrain initial planes

/-- A canonicalizer is extensional when equal denoted regions have equal
canonical representations. This deliberately includes empty, point, segment,
and area-bearing outputs in one contract. -/
def CanonicalByRegion
    {Point : Type u} {Representation : Type v}
    (regionOf : Representation → Set Point)
    (canon : Representation → Representation) : Prop :=
  ∀ first second, regionOf first = regionOf second → canon first = canon second

def SemanticsPreserving
    {Point : Type u} {Representation : Type v}
    (regionOf : Representation → Set Point)
    (canon : Representation → Representation) : Prop :=
  ∀ representation, regionOf (canon representation) = regionOf representation

/-- Semantic preservation and region-extensionality make canonicalization
idempotent; this is an independently auditable normalization obligation. -/
theorem canonical_idempotent
    {Point : Type u} {Representation : Type v}
    (regionOf : Representation → Set Point)
    (canon : Representation → Representation)
    (preserves : SemanticsPreserving regionOf canon)
    (canonical : CanonicalByRegion regionOf canon)
    (representation : Representation) :
    canon (canon representation) = canon representation := by
  exact canonical (canon representation) representation
    (preserves representation)

/-- Sound emission plus region-extensional canonicalization lifts semantic
permutation invariance to exact equality of canonical output artifacts. -/
theorem canonical_emit_eq_of_semantics_eq
    {Point : Type u} {Plane : Type v} {Representation : Type w}
    (regionOf : Representation → Set Point)
    (constrain : Set Point → List Plane → Set Point)
    (emit : Set Point → List Plane → Representation)
    (canon : Representation → Representation)
    (sound : EmitterSound regionOf constrain emit)
    (canonical : CanonicalByRegion regionOf canon)
    (initial : Set Point) {planes reordered : List Plane}
    (semanticsEqual : constrain initial planes = constrain initial reordered) :
    canon (emit initial planes) = canon (emit initial reordered) := by
  apply canonical
  rw [sound initial planes, sound initial reordered]
  exact semanticsEqual

/-- For Sprawlens half planes, the already-proved set semantics discharges the
permutation premise. The remaining obligations are emitter soundness and a
region-extensional canonicalizer. -/
theorem canonical_halfPlane_emit_perm
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {Representation : Type v}
    (regionOf : Representation → Set (ExactGeometry.Vec2 R))
    (emit : Set (ExactGeometry.Vec2 R) →
      List (HalfPlaneClipPoints.HalfPlane R) → Representation)
    (canon : Representation → Representation)
    (sound : EmitterSound regionOf constrainedRegion emit)
    (canonical : CanonicalByRegion regionOf canon)
    (initial : Set (ExactGeometry.Vec2 R))
    {planes reordered : List (HalfPlaneClipPoints.HalfPlane R)}
    (permutation : planes.Perm reordered) :
    canon (emit initial planes) = canon (emit initial reordered) := by
  exact canonical_emit_eq_of_semantics_eq
    regionOf constrainedRegion emit canon sound canonical initial
    (constrainedRegion_perm initial permutation)

/-- The closed convex polygon region denoted by all directed input-edge support
half-planes. This definition remains meaningful for weak and degenerate rings. -/
def indexedPolygonRegion
    {R : Type u} [Field R] [PartialOrder R]
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Set (Vec2 R) :=
  { point | ∀ edgeIndex,
      0 ≤ orientation
        (vertex edgeIndex) (vertex (nextIndex edgeIndex)) point }

/-- The declarative affine half-plane semantics is convex. -/
theorem halfPlaneRegion_convex
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) : Convex R (halfPlaneRegion plane) := by
  intro start startInside finish finishInside startWeight finishWeight
    startWeightNonnegative finishWeightNonnegative weightSum
  change signedDistance plane
    (startWeight • start + finishWeight • finish) ≤ 0
  rw [affineCombination_eq_interpolatePoint
    start finish startWeight finishWeight weightSum]
  rw [signedDistance_interpolatePoint]
  have finishWeightAtMostOne : finishWeight ≤ 1 := by linarith
  calc
    interpolateDistance (signedDistance plane start)
        (signedDistance plane finish) finishWeight =
        (1 - finishWeight) * signedDistance plane start +
          finishWeight * signedDistance plane finish := by
            simp only [interpolateDistance]
            ring
    _ ≤ 0 := add_nonpos
      (mul_nonpos_of_nonneg_of_nonpos
        (sub_nonneg.mpr finishWeightAtMostOne) startInside)
      (mul_nonpos_of_nonneg_of_nonpos finishWeightNonnegative finishInside)

/-- The strict complement of the closed clipping half-plane is convex. -/
theorem strictOutsideRegion_convex
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    (plane : HalfPlane R) :
    Convex R { point | 0 < signedDistance plane point } := by
  intro start startOutside finish finishOutside startWeight finishWeight
    startWeightNonnegative finishWeightNonnegative weightSum
  rw [affineCombination_eq_interpolatePoint
    start finish startWeight finishWeight weightSum]
  change 0 < signedDistance plane (interpolatePoint start finish finishWeight)
  rw [signedDistance_interpolatePoint]
  have weightedForm :
      interpolateDistance (signedDistance plane start)
          (signedDistance plane finish) finishWeight =
        startWeight * signedDistance plane start +
          finishWeight * signedDistance plane finish := by
    have startWeightEq : startWeight = 1 - finishWeight := by linarith
    rw [startWeightEq]
    simp only [interpolateDistance]
    ring
  rw [weightedForm]
  have oneWeightPositive : 0 < startWeight ∨ 0 < finishWeight := by
    by_cases startWeightZero : startWeight = 0
    · right
      have finishWeightOne : finishWeight = 1 := by linarith
      rw [finishWeightOne]
      norm_num
    · left
      exact lt_of_le_of_ne startWeightNonnegative (Ne.symm startWeightZero)
  rcases oneWeightPositive with startWeightPositive | finishWeightPositive
  · exact add_pos_of_pos_of_nonneg
      (mul_pos startWeightPositive startOutside)
      (mul_nonneg finishWeightNonnegative (le_of_lt finishOutside))
  · exact add_pos_of_nonneg_of_pos
      (mul_nonneg startWeightNonnegative (le_of_lt startOutside))
      (mul_pos finishWeightPositive finishOutside)

/-- The support-half-plane interpretation of an indexed polygon is convex,
independently of whether the supplied vertices themselves satisfy it. -/
theorem indexedPolygonRegion_convex
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) :
    Convex R (indexedPolygonRegion vertex) := by
  intro start startInside finish finishInside startWeight finishWeight
    startWeightNonnegative finishWeightNonnegative weightSum supportEdge
  rw [affineCombination_eq_interpolatePoint
    start finish startWeight finishWeight weightSum]
  have finishWeightAtMostOne : finishWeight ≤ 1 := by linarith
  exact orientation_interpolate_third_nonneg
    (vertex supportEdge) (vertex (nextIndex supportEdge)) start finish
    finishWeightNonnegative finishWeightAtMostOne
    (startInside supportEdge) (finishInside supportEdge)

/-- Degeneracy-safe input semantics: the convex hull of the materialized input
vertices. Unlike the supporting-half-plane interpretation, a collapsed ring
denotes a point rather than the whole plane. -/
def indexedVertexConvexRegion
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Set (Vec2 R) :=
  convexHull R (Set.range vertex)

/-- Every emitted vertex remains in the input convex polygon region. This is
one containment direction of emitter soundness, not equality of whole regions. -/
theorem clipIndexedRing_mem_input_region
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    {point : Vec2 R} (emitted : point ∈ clipIndexedRing plane vertex) :
    point ∈ indexedPolygonRegion vertex := by
  rcases clipIndexedRing_on_input_edge plane vertex emitted with
    ⟨sourceEdge, parameter, parameterRange, pointEq⟩
  rw [pointEq]
  intro supportEdge
  exact orientation_interpolate_third_nonneg
    (vertex supportEdge) (vertex (nextIndex supportEdge))
    (vertex sourceEdge) (vertex (nextIndex sourceEdge))
    parameterRange.1 parameterRange.2
    (convex supportEdge sourceEdge)
    (convex supportEdge (nextIndex sourceEdge))

/-- Every emitted vertex is simultaneously inside the input polygon and the
new clipping half-plane. -/
theorem clipIndexedRing_mem_region_intersection
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    {point : Vec2 R} (emitted : point ∈ clipIndexedRing plane vertex) :
    point ∈ indexedPolygonRegion vertex ∩ halfPlaneRegion plane := by
  exact ⟨clipIndexedRing_mem_input_region plane vertex convex emitted,
    clipIndexedRing_nonpos plane vertex emitted⟩

/-- Every emitted point lies in the convex hull of the input vertices because
it lies on one materialized input edge. This does not require convexity or a
nondegeneracy premise. -/
theorem clipIndexedRing_mem_inputConvexRegion
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    {point : Vec2 R} (emitted : point ∈ clipIndexedRing plane vertex) :
    point ∈ indexedVertexConvexRegion vertex := by
  rcases clipIndexedRing_on_input_edge plane vertex emitted with
    ⟨edgeIndex, parameter, parameterRange, rfl⟩
  rw [← affineCombination_eq_interpolatePoint
    (vertex edgeIndex) (vertex (nextIndex edgeIndex))
    (1 - parameter) parameter (by ring)]
  exact (convex_convexHull R (Set.range vertex))
    (subset_convexHull R _ (Set.mem_range_self edgeIndex))
    (subset_convexHull R _ (Set.mem_range_self (nextIndex edgeIndex)))
    (sub_nonneg.mpr parameterRange.2) parameterRange.1 (by ring)

/-- Set-level restatement of the executable emitter contract: after both
normalization passes, its finite vertex set is exactly the declarative set of
retained input vertices and crossing boundary points. -/
theorem clipIndexedRing_vertexSet_eq_boundaryGenerators
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    { point | point ∈ clipIndexedRing plane vertex } =
      { point | IsClipBoundaryGenerator plane vertex point } := by
  ext point
  exact mem_clipIndexedRing_iff_boundaryGenerator plane vertex point

/-- Every declarative boundary generator is geometrically sound for a weakly
convex input ring. Together with the preceding equality this closes the finite
vertex-set contract, while deliberately making no claim yet about the whole
continuous region enclosed by the output ring. -/
theorem clipBoundaryGenerator_mem_region_intersection
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    {point : Vec2 R} (generator : IsClipBoundaryGenerator plane vertex point) :
    point ∈ indexedPolygonRegion vertex ∩ halfPlaneRegion plane := by
  exact clipIndexedRing_mem_region_intersection plane vertex convex
    ((mem_clipIndexedRing_iff_boundaryGenerator plane vertex point).mpr generator)

/-- A continuous under-approximation of the output semantics: all closed
segments whose endpoints are emitted vertices. It includes every output edge,
and also all diagonals, without committing yet to a winding-based interior
definition for empty, point, segment, and polygon outputs. -/
def clipIndexedChordRegion
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    Set (Vec2 R) :=
  { point | ∃ start ∈ clipIndexedRing plane vertex,
      ∃ finish ∈ clipIndexedRing plane vertex,
        OnClosedSegment start finish point }

/-- Every point on every chord between emitted vertices remains in the input
polygon and clipping half-plane. This upgrades finite vertex soundness to a
continuous set containment; the reverse containment remains a separate proof
obligation. -/
theorem clipIndexedChordRegion_subset_region_intersection
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex) :
    clipIndexedChordRegion plane vertex ⊆
      indexedPolygonRegion vertex ∩ halfPlaneRegion plane := by
  rintro point ⟨start, startEmitted, finish, finishEmitted,
    parameter, parameterRange, rfl⟩
  have startIn := clipIndexedRing_mem_region_intersection
    plane vertex convex startEmitted
  have finishIn := clipIndexedRing_mem_region_intersection
    plane vertex convex finishEmitted
  constructor
  · intro supportEdge
    exact orientation_interpolate_third_nonneg
      (vertex supportEdge) (vertex (nextIndex supportEdge)) start finish
      parameterRange.1 parameterRange.2
      (startIn.1 supportEdge) (finishIn.1 supportEdge)
  · change signedDistance plane (interpolatePoint start finish parameter) ≤ 0
    rw [signedDistance_interpolatePoint]
    calc
      interpolateDistance (signedDistance plane start)
          (signedDistance plane finish) parameter =
          (1 - parameter) * signedDistance plane start +
            parameter * signedDistance plane finish := by
              simp only [interpolateDistance]
              ring
      _ ≤ 0 := add_nonpos
        (mul_nonpos_of_nonneg_of_nonpos
          (sub_nonneg.mpr parameterRange.2) startIn.2)
        (mul_nonpos_of_nonneg_of_nonpos parameterRange.1 finishIn.2)

/-- Convex-hull semantics for the normalized output vertex set. Unlike the
pairwise chord approximation, this includes the full area-bearing interior and
also specializes uniformly to empty, point, and segment outputs. -/
def clipIndexedConvexRegion
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    Set (Vec2 R) :=
  convexHull R { point | point ∈ clipIndexedRing plane vertex }

/-- The pairwise segment semantics embeds into the full convex-hull semantics. -/
theorem clipIndexedChordRegion_subset_convexRegion
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    clipIndexedChordRegion plane vertex ⊆
      clipIndexedConvexRegion plane vertex := by
  rintro point ⟨start, startEmitted, finish, finishEmitted,
    parameter, parameterRange, rfl⟩
  rw [← affineCombination_eq_interpolatePoint
    start finish (1 - parameter) parameter (by ring)]
  exact (convex_convexHull R { point | point ∈ clipIndexedRing plane vertex })
    (subset_convexHull R _ startEmitted)
    (subset_convexHull R _ finishEmitted)
    (sub_nonneg.mpr parameterRange.2) parameterRange.1 (by ring)

/-- Full continuous soundness of one clipping step: the convex hull of every
emitted vertex lies in the declarative input-polygon/half-plane intersection.
Only the converse inclusion is still needed for semantic equality. -/
theorem clipIndexedConvexRegion_subset_region_intersection
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex) :
    clipIndexedConvexRegion plane vertex ⊆
      indexedPolygonRegion vertex ∩ halfPlaneRegion plane := by
  apply convexHull_min
  · intro point emitted
    exact clipIndexedRing_mem_region_intersection plane vertex convex emitted
  · exact (indexedPolygonRegion_convex vertex).inter
      (halfPlaneRegion_convex plane)

/-- Degeneracy-safe continuous soundness. The full output convex hull remains
inside the input vertex convex hull and the clipping half-plane, without any
convexity assumption on the input traversal. -/
theorem clipIndexedConvexRegion_subset_inputConvexIntersection
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    clipIndexedConvexRegion plane vertex ⊆
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane := by
  apply convexHull_min
  · intro point emitted
    exact ⟨clipIndexedRing_mem_inputConvexRegion plane vertex emitted,
      clipIndexedRing_nonpos plane vertex emitted⟩
  · exact (convex_convexHull R (Set.range vertex)).inter
      (halfPlaneRegion_convex plane)

/-- The one remaining direction of executable semantic equality, isolated as
a reusable proof obligation. -/
def ClipRegionComplete
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane ⊆
    clipIndexedConvexRegion plane vertex

/-- Since continuous soundness is unconditional, exact region equality is
equivalent to the isolated reverse-containment obligation. -/
theorem clipIndexedConvexRegion_eq_iff_complete
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    clipIndexedConvexRegion plane vertex =
        indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane ↔
      ClipRegionComplete plane vertex := by
  constructor
  · intro regionEq
    unfold ClipRegionComplete
    rw [regionEq]
  · intro complete
    exact Set.Subset.antisymm
      (clipIndexedConvexRegion_subset_inputConvexIntersection plane vertex)
      complete

/-- If every input vertex is retained, clipping is semantically the identity
on the degeneracy-safe convex-hull region. -/
theorem clipIndexedConvexRegion_eq_inputConvexIntersection_of_all_nonpos
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allInside : ∀ index, signedDistance plane (vertex index) ≤ 0) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane := by
  apply Set.Subset.antisymm
  · exact clipIndexedConvexRegion_subset_inputConvexIntersection plane vertex
  · rintro point ⟨pointInInput, _⟩
    apply (show indexedVertexConvexRegion vertex ⊆
        clipIndexedConvexRegion plane vertex by
      apply convexHull_min
      · rintro inputVertex ⟨index, rfl⟩
        exact subset_convexHull R _
          (input_vertex_mem_clipIndexedRing_of_nonpos
            plane vertex index (allInside index))
      · exact convex_convexHull R _)
    exact pointInInput

theorem clipRegionComplete_of_all_nonpos
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allInside : ∀ index, signedDistance plane (vertex index) ≤ 0) :
    ClipRegionComplete plane vertex := by
  rw [← clipIndexedConvexRegion_eq_iff_complete]
  exact clipIndexedConvexRegion_eq_inputConvexIntersection_of_all_nonpos
    plane vertex allInside

/-- Strictly outside vertices make every edge emitter empty. -/
theorem clipIndexedRing_eq_nil_of_all_pos
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allOutside : ∀ index, 0 < signedDistance plane (vertex index)) :
    clipIndexedRing plane vertex = [] := by
  apply List.eq_nil_iff_forall_not_mem.mpr
  intro point emitted
  rw [clipIndexedRing, mem_closedClipOutputPoints_iff,
    mem_clipOutputPoints_iff] at emitted
  simp only [List.mem_flatten, List.mem_map] at emitted
  rcases emitted with ⟨output, ⟨edge, edgeMember, rfl⟩, pointMember⟩
  rw [mem_indexedEdges_iff] at edgeMember
  rcases edgeMember with ⟨index, rfl⟩
  rw [outputPoints_eq_nil_of_outside plane
    (vertex index) (vertex (nextIndex index))
    (allOutside index) (allOutside (nextIndex index))] at pointMember
  exact List.not_mem_nil pointMember

/-- If every input vertex is strictly outside, both the executable output and
the declarative convex intersection are empty. -/
theorem clipIndexedConvexRegion_eq_inputConvexIntersection_of_all_pos
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allOutside : ∀ index, 0 < signedDistance plane (vertex index)) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane := by
  have inputStrictlyOutside :
      indexedVertexConvexRegion vertex ⊆
        { point | 0 < signedDistance plane point } := by
    apply convexHull_min
    · rintro point ⟨index, rfl⟩
      exact allOutside index
    · exact strictOutsideRegion_convex plane
  have intersectionEmpty :
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane = ∅ := by
    apply Set.eq_empty_iff_forall_notMem.mpr
    intro point member
    have pointOutside := inputStrictlyOutside member.1
    exact (not_lt_of_ge member.2) pointOutside
  rw [clipIndexedConvexRegion,
    clipIndexedRing_eq_nil_of_all_pos plane vertex allOutside,
    intersectionEmpty]
  simp

theorem clipRegionComplete_of_all_pos
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (allOutside : ∀ index, 0 < signedDistance plane (vertex index)) :
    ClipRegionComplete plane vertex := by
  rw [← clipIndexedConvexRegion_eq_iff_complete]
  exact clipIndexedConvexRegion_eq_inputConvexIntersection_of_all_pos
    plane vertex allOutside

/-- The old support-half-plane semantics agrees with the degeneracy-safe
vertex-convex semantics exactly when this explicit adequacy contract holds. -/
def SupportSemanticsAdequate
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  indexedPolygonRegion vertex = indexedVertexConvexRegion vertex

/-- Strict global vertex order rules out the concrete failure mode of the
collapsed witness: at least one support constraint is non-vacuous, so the
support interpretation cannot denote the whole plane. -/
theorem strictVertexOrdered_indexedPolygonRegion_ne_univ
    {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    indexedPolygonRegion vertex ≠ Set.univ := by
  let first : RingIndex extraVertices := ⟨0, by omega⟩
  let second : RingIndex extraVertices := ⟨1, by omega⟩
  let third : RingIndex extraVertices := ⟨2, by omega⟩
  let witness := interpolatePoint (vertex first) (vertex third) (-1)
  have strictTurn :
      0 < orientation (vertex first) (vertex second) (vertex third) :=
    ordered.strict first second third (by simp [first, second])
      (by simp [second, third])
  have witnessRight :
      orientation (vertex first) (vertex second) witness < 0 := by
    rw [show witness = interpolatePoint (vertex first) (vertex third) (-1) by rfl]
    rw [orientation_interpolate_third]
    simp
    exact strictTurn
  intro regionUniv
  have witnessMember : witness ∈ indexedPolygonRegion vertex := by
    rw [regionUniv]
    trivial
  exact (not_lt_of_ge (witnessMember first)) witnessRight

/-- Three distinct collinear vertices form a topologically simple triangle,
but its support-half-plane interpretation is an unbounded line rather than the
finite segment denoted by its vertex convex hull. -/
def collinearSimpleTriangleVertex (index : RingIndex 0) : Vec2 Rat :=
  match index.val with
  | 0 => { x := -1, y := 0 }
  | 1 => { x := 0, y := 0 }
  | _ => { x := 1, y := 0 }

theorem collinearSimpleTriangle_simple :
    IsSimpleRing collinearSimpleTriangleVertex := by
  constructor
  · intro first second equalPoints
    fin_cases first <;> fin_cases second <;> try rfl
    all_goals
      exfalso
      norm_num [collinearSimpleTriangleVertex] at equalPoints
  · constructor
    · intro index
      fin_cases index <;>
        norm_num [collinearSimpleTriangleVertex, nextIndex]
    · intro left right nonadjacent
      exfalso
      apply nonadjacent
      fin_cases left <;> fin_cases right <;>
        simp [EdgesAdjacent, nextIndex]

theorem collinearSimpleTriangle_weaklyConvex :
    IsWeaklyConvexCCW collinearSimpleTriangleVertex := by
  intro edgeIndex pointIndex
  fin_cases edgeIndex <;> fin_cases pointIndex <;>
    norm_num [collinearSimpleTriangleVertex, nextIndex, orientation]

/-- Simplicity plus weak convexity still does not make support semantics
adequate; full-dimensionality or an equivalent semantic premise is necessary. -/
theorem simpleWeakConvex_does_not_imply_supportSemanticsAdequate :
    IsSimpleRing collinearSimpleTriangleVertex ∧
      IsWeaklyConvexCCW collinearSimpleTriangleVertex ∧
      ¬ SupportSemanticsAdequate collinearSimpleTriangleVertex := by
  refine ⟨collinearSimpleTriangle_simple,
    collinearSimpleTriangle_weaklyConvex, ?_⟩
  intro adequate
  let witness : Vec2 Rat := { x := 2, y := 0 }
  have witnessInSupport :
      witness ∈ indexedPolygonRegion collinearSimpleTriangleVertex := by
    intro edgeIndex
    fin_cases edgeIndex <;>
      norm_num [witness, collinearSimpleTriangleVertex, nextIndex, orientation]
  have witnessInConvex :
      witness ∈ indexedVertexConvexRegion collinearSimpleTriangleVertex := by
    rw [← adequate]
    exact witnessInSupport
  have inputHullSubset :
      indexedVertexConvexRegion collinearSimpleTriangleVertex ⊆
        { point : Vec2 Rat | point.x ≤ 1 } := by
    apply convexHull_min
    · rintro point ⟨index, rfl⟩
      fin_cases index <;> norm_num [collinearSimpleTriangleVertex]
    · intro start startBound finish finishBound startWeight finishWeight
        startWeightNonnegative finishWeightNonnegative weightSum
      change (startWeight • start + finishWeight • finish).x ≤ 1
      simp only [add_x, smul_x]
      calc
        startWeight * start.x + finishWeight * finish.x ≤
            startWeight * 1 + finishWeight * 1 :=
          add_le_add
            (mul_le_mul_of_nonneg_left startBound startWeightNonnegative)
            (mul_le_mul_of_nonneg_left finishBound finishWeightNonnegative)
        _ = 1 := by rw [mul_one, mul_one, weightSum]
  have witnessBound := inputHullSubset witnessInConvex
  norm_num [witness] at witnessBound

/-- A fully collapsed triangle exposes a mismatch between support-half-plane
input semantics and convex-hull output semantics. -/
def collapsedTriangleVertex (_ : RingIndex 0) : Vec2 Rat :=
  { x := 0, y := 0 }

def collapsedTriangleWitnessPlane : HalfPlane Rat where
  normalX := 1
  normalY := 0
  offset := 1

theorem collapsedTriangle_weaklyConvex :
    IsWeaklyConvexCCW collapsedTriangleVertex := by
  intro edgeIndex pointIndex
  simp [collapsedTriangleVertex, orientation]

theorem collapsedTriangle_clipIndexedRing :
    clipIndexedRing collapsedTriangleWitnessPlane collapsedTriangleVertex =
      [{ x := 0, y := 0 }] := by
  native_decide

/-- The converse of continuous soundness is false under weak convexity alone:
all supporting edges of a collapsed ring are vacuous, so the declared input
region is the whole plane while the emitted convex region remains one point. -/
theorem weakConvex_reverse_containment_counterexample :
    ¬ (indexedPolygonRegion collapsedTriangleVertex ∩
        halfPlaneRegion collapsedTriangleWitnessPlane ⊆
      clipIndexedConvexRegion collapsedTriangleWitnessPlane
        collapsedTriangleVertex) := by
  intro reverseContainment
  let witness : Vec2 Rat := { x := 1, y := 0 }
  have witnessInIntersection : witness ∈
      indexedPolygonRegion collapsedTriangleVertex ∩
        halfPlaneRegion collapsedTriangleWitnessPlane := by
    constructor
    · intro edgeIndex
      norm_num [witness, collapsedTriangleVertex, orientation]
    · norm_num [witness, collapsedTriangleWitnessPlane,
        halfPlaneRegion, signedDistance]
  have witnessInOutput := reverseContainment witnessInIntersection
  rw [clipIndexedConvexRegion, collapsedTriangle_clipIndexedRing] at witnessInOutput
  have outputVertexSet :
      ({ point : Vec2 Rat | point ∈ [{ x := 0, y := 0 }] }) =
        ({ { x := 0, y := 0 } } : Set (Vec2 Rat)) := by
    ext point
    simp
  rw [outputVertexSet, convexHull_singleton] at witnessInOutput
  norm_num [witness] at witnessInOutput

/-- The vertex-convex input semantics repairs the collapsed case: both sides
denote the same singleton even though the support-half-plane semantics did not. -/
theorem collapsedTriangle_vertexConvex_semantics_exact :
    clipIndexedConvexRegion collapsedTriangleWitnessPlane
        collapsedTriangleVertex =
      indexedVertexConvexRegion collapsedTriangleVertex ∩
        halfPlaneRegion collapsedTriangleWitnessPlane := by
  rw [clipIndexedConvexRegion, collapsedTriangle_clipIndexedRing,
    indexedVertexConvexRegion]
  have outputVertexSet :
      ({ point : Vec2 Rat | point ∈ [{ x := 0, y := 0 }] }) =
        ({ { x := 0, y := 0 } } : Set (Vec2 Rat)) := by
    ext point
    simp
  have inputVertexSet :
      Set.range collapsedTriangleVertex =
        ({ { x := 0, y := 0 } } : Set (Vec2 Rat)) := by
    ext point
    simp [collapsedTriangleVertex, eq_comm]
  rw [outputVertexSet, inputVertexSet]
  ext point
  simp [collapsedTriangleWitnessPlane, halfPlaneRegion, signedDistance]

end Sprawlens.CanonicalClip
