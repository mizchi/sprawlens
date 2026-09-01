import Mathlib.Data.List.OfFn
import Sprawlens.ReclipCertificate

namespace Sprawlens.ListReclipClassification

open CanonicalClip
open ConvexClipContract
open CyclicClosure
open CyclicBinaryBlocks
open ExactGeometry
open FullDimensionalSupportSemantics
open HalfPlaneClipPoints
open HalfPlaneClipRing
open ReclipCertificate
open OrderedTriples
open SegmentTripleOrientation
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Reindex a list of at least three points as the ring representation consumed
by the existing executable clipping step. -/
def listVertex (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length) :
    RingIndex (points.length - 3) → Vec2 R :=
  fun index ↦ points.get (Fin.cast (by omega) index)

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
/-- Reindexing and materializing a list is lossless. -/
theorem indexedVertices_listVertex
    (points : List (Vec2 R)) (lengthAtLeastThree : 3 ≤ points.length) :
    indexedVertices (listVertex points lengthAtLeastThree) = points := by
  apply List.ext_getElem
  · simp [indexedVertices]
    omega
  · intro index leftBound rightBound
    simp only [indexedVertices, List.getElem_ofFn]
    simp [listVertex]

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
/-- A duplicate-free materialized list remains injective after conversion to
the fixed-size ring index used by the clipping contract. -/
theorem listVertex_injective_of_nodup
    {points : List (Vec2 R)} (lengthAtLeastThree : 3 ≤ points.length)
    (nodup : points.Nodup) :
    Function.Injective (listVertex points lengthAtLeastThree) := by
  intro first second equalVertices
  have equalCasts := nodup.injective_get equalVertices
  apply Fin.ext
  simpa using congrArg Fin.val equalCasts

omit [IsStrictOrderedRing R] in
/-- A positive prefix triangle is a full-dimensionality witness for the
reindexed list representation. -/
theorem listVertex_hasPositiveTriple_of_prefix
    {points : List (Vec2 R)} (lengthAtLeastThree : 3 ≤ points.length)
    {first second third : Vec2 R} {tail : List (Vec2 R)}
    (pointsEq : points = first :: second :: third :: tail)
    (positive : 0 < orientation first second third) :
    HasPositiveTriple (listVertex points lengthAtLeastThree) := by
  let firstIndex : RingIndex (points.length - 3) := ⟨0, by omega⟩
  let secondIndex : RingIndex (points.length - 3) := ⟨1, by omega⟩
  let thirdIndex : RingIndex (points.length - 3) := ⟨2, by omega⟩
  refine ⟨firstIndex, secondIndex, thirdIndex, ?_, ?_, ?_⟩
  · simp [firstIndex, secondIndex]
  · simp [secondIndex, thirdIndex]
  · simpa [listVertex, firstIndex, secondIndex, thirdIndex, pointsEq] using positive

/-- Global weak vertex order, unlike only adjacent turn nonnegativity, is
preserved by the point emitter and both duplicate-normalization passes. -/
theorem clipIndexedRing_allOrderedCCW_of_linearlyOrdered
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex) :
    AllOrderedCCW (clipIndexedRing plane vertex) := by
  unfold clipIndexedRing closedClipOutputPoints
  apply normalizeClosure_allOrderedCCW
  apply clipOutputPoints_allOrderedCCW
  simpa [List.flatMap] using outputPointFlatMap_allOrderedCCW plane
    (indexedEdges_pairwise_segmentPairCCW vertex ordered.weak)
    (indexedEdges_triplewise_of_linearlyOrdered vertex ordered)

/-- Any nondegenerate reindexing of an emitted list therefore satisfies the
weak global vertex-order component needed by later support certificates. -/
theorem clipOutput_listVertex_linearlyOrdered
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing plane vertex).length) :
    IsLinearlyOrderedCCW
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) := by
  rw [linearlyOrdered_iff_indexedVertices_triplewise]
  rw [indexedVertices_listVertex]
  exact clipIndexedRing_allOrderedCCW_of_linearlyOrdered plane vertex ordered

/-- Only the polygon branch needs a new proof certificate. Empty, point, and
segment outputs are classified directly instead of being padded into a bogus
three-vertex polygon. -/
inductive OutputReclassification : List (Vec2 R) → Prop
  | empty : OutputReclassification []
  | point (value : Vec2 R) : OutputReclassification [value]
  | segment (start finish : Vec2 R) : OutputReclassification [start, finish]
  | polygon (points : List (Vec2 R))
      (lengthAtLeastThree : 3 ≤ points.length)
      (certified : IsReclipCertified
        (listVertex points lengthAtLeastThree)) :
      OutputReclassification points

/-- The exact remaining proof obligation for a variable-length output list:
every materialization with at least three vertices must produce the reusable
polygon certificate. -/
def PolygonReclipObligation (points : List (Vec2 R)) : Prop :=
  ∀ lengthAtLeastThree : 3 ≤ points.length,
    IsReclipCertified (listVertex points lengthAtLeastThree)

/-- Once the polygon-only obligation is supplied, every list is exhaustively
classified without placing false polygon invariants on degenerate outputs. -/
theorem outputReclassification_of_polygonObligation
    (points : List (Vec2 R))
    (polygonReady : PolygonReclipObligation points) :
    OutputReclassification points := by
  cases points with
  | nil => exact .empty
  | cons first rest =>
      cases rest with
      | nil => exact .point first
      | cons second tail =>
          cases tail with
          | nil => exact .segment first second
          | cons third remaining =>
              let lengthAtLeastThree :
                  3 ≤ (first :: second :: third :: remaining).length := by simp
              exact OutputReclassification.polygon _ lengthAtLeastThree
                (polygonReady lengthAtLeastThree)

/-- Conversely, an exhaustive output classification contains exactly the
certificate required in every length-at-least-three branch. -/
theorem polygonObligation_of_outputReclassification
    {points : List (Vec2 R)}
    (classified : OutputReclassification points) :
    PolygonReclipObligation points := by
  intro lengthAtLeastThree
  cases classified with
  | empty => simp at lengthAtLeastThree
  | point value => simp at lengthAtLeastThree
  | segment start finish => simp at lengthAtLeastThree
  | polygon points certifiedLength certified =>
      simpa using certified

/-- Variable-length output classification and the polygon-only certificate
obligation are logically equivalent. -/
theorem outputReclassification_iff_polygonObligation
    (points : List (Vec2 R)) :
    OutputReclassification points ↔ PolygonReclipObligation points := by
  exact ⟨polygonObligation_of_outputReclassification,
    outputReclassification_of_polygonObligation points⟩

/-- For the executable emitter, reclassification reduces exactly to proving
the polygon branch when its normalized output length is at least three. -/
def ClipOutputPolygonReclipObligation
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  PolygonReclipObligation (clipIndexedRing plane vertex)

theorem clipOutputReclassification
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (polygonReady : ClipOutputPolygonReclipObligation plane vertex) :
    OutputReclassification (clipIndexedRing plane vertex) :=
  outputReclassification_of_polygonObligation
    (clipIndexedRing plane vertex) polygonReady

/-- A stronger strict-order proof for every nondegenerate materialization is
sufficient, but no longer required by downstream clipping. -/
theorem polygonReclipObligation_of_strict
    (points : List (Vec2 R))
    (strict : ∀ lengthAtLeastThree : 3 ≤ points.length,
      IsStrictVertexOrderedConvexCCW
        (listVertex points lengthAtLeastThree)) :
    PolygonReclipObligation points := by
  intro lengthAtLeastThree
  exact ReclipCertificate.IsStrictVertexOrderedConvexCCW.reclipCertified
    (strict lengthAtLeastThree)

/-- After global weak order has been obtained automatically from the emitter,
these are the remaining geometric facts sufficient to construct the reusable
certificate for one polygon output materialization. -/
structure PolygonOutputResidualCertificate
    (points : List (Vec2 R))
    (lengthAtLeastThree : 3 ≤ points.length) : Prop where
  injective : Function.Injective (listVertex points lengthAtLeastThree)
  fullDimensional : HasPositiveTriple (listVertex points lengthAtLeastThree)
  outsideRotatedBlock : ∀ (plane : HalfPlane R),
    (∃ index, 0 < signedDistance plane
      (listVertex points lengthAtLeastThree index)) →
    (∃ index, signedDistance plane
      (listVertex points lengthAtLeastThree index) ≤ 0) →
    IsRotatedBlock (fun index ↦ 0 < signedDistance plane
      (listVertex points lengthAtLeastThree index))

/-- The emitter already supplies weak global order. Injectivity,
full-dimensionality, and cyclic sign contiguity therefore close the exact
polygon-output recertification obligation. -/
theorem clipOutput_reclipCertified_of_residual
    {extraVertices : Nat}
    (sourcePlane : HalfPlane R)
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing sourcePlane vertex).length)
    (residual : PolygonOutputResidualCertificate
      (clipIndexedRing sourcePlane vertex) lengthAtLeastThree) :
    IsReclipCertified
      (listVertex (clipIndexedRing sourcePlane vertex) lengthAtLeastThree) := by
  let outputVertex :=
    listVertex (clipIndexedRing sourcePlane vertex) lengthAtLeastThree
  have outputOrdered : IsLinearlyOrderedCCW outputVertex :=
    clipOutput_listVertex_linearlyOrdered sourcePlane vertex ordered
      lengthAtLeastThree
  exact ⟨
    orderedInjectiveFullDimensional_supportSemanticsAdequate
      outputVertex outputOrdered residual.injective residual.fullDimensional,
    residual.outsideRotatedBlock
  ⟩

end Sprawlens.ListReclipClassification
