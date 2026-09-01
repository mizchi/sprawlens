import Sprawlens.PairwiseAdjacentCoverage
import Sprawlens.WeakConvexHalfPlaneSigns

namespace Sprawlens.ReclipCertificate

open CanonicalClip
open ClipCompleteness
open ConvexClipContract
open ConvexHalfPlaneSigns
open ConvexClipConsequences
open CyclicBinaryBlocks
open ExactGeometry
open FullDimensionalSupportSemantics
open HalfPlaneClipPoints
open PairwiseAdjacentCoverage
open PolygonSupportSemantics
open SeamSupportSemantics
open SimpleRing
open StrictConvexContract
open WeakConvexHalfPlaneSigns

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Minimal representation-level certificate needed to apply another exact
half-plane clipping step. It is weaker than strict global vertex order:
support semantics must be adequate, and every mixed half-plane sign pattern
must consist of one cyclic outside block. -/
structure IsReclipCertified {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop where
  supportAdequate : SupportSemanticsAdequate vertex
  outsideRotatedBlock : ∀ (plane : HalfPlane R),
    (∃ index, 0 < signedDistance plane (vertex index)) →
    (∃ index, signedDistance plane (vertex index) ≤ 0) →
    IsRotatedBlock (fun index ↦ 0 < signedDistance plane (vertex index))

/-- Reclip certification belongs to the cyclic polygon, not to the selected
materialization seam. -/
theorem IsReclipCertified.rotateVertex
    {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (certified : IsReclipCertified vertex)
    (start : RingIndex extraVertices) :
    IsReclipCertified (StrictConvexContract.rotateVertex start vertex) := by
  let positive : 0 < extraVertices + 3 := by omega
  have vertexEq : ∀ index,
      StrictConvexContract.rotateVertex start vertex index =
        vertex (rotateIndex positive start index) := by
    intro index
    apply congrArg vertex
    apply Fin.ext
    rfl
  refine ⟨
    (supportSemanticsAdequate_rotateVertex_iff start vertex).mpr
      certified.supportAdequate,
    ?_
  ⟩
  intro plane hasOutside hasInside
  have originalOutside :
      ∃ index, 0 < signedDistance plane (vertex index) := by
    rcases hasOutside with ⟨index, outside⟩
    exact ⟨rotateIndex positive start index, by
      rw [← vertexEq index]
      exact outside⟩
  have originalInside :
      ∃ index, signedDistance plane (vertex index) ≤ 0 := by
    rcases hasInside with ⟨index, inside⟩
    exact ⟨rotateIndex positive start index, by
      rw [← vertexEq index]
      exact inside⟩
  have originalBlock := certified.outsideRotatedBlock
    plane originalOutside originalInside
  have rotatedBlock := originalBlock.comp_rotateIndex positive start
  change IsRotatedBlock (fun index =>
    0 < signedDistance plane (vertex (rotateIndex positive start index)))
  exact rotatedBlock

/-- Strict global order is one sufficient producer of the weaker reusable
clipping certificate. -/
theorem IsStrictVertexOrderedConvexCCW.reclipCertified
    {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    IsReclipCertified vertex := by
  exact ⟨
    strictPolygon_supportSemanticsAdequate vertex ordered,
    fun plane hasOutside hasInside ↦
      outside_rotatedBlock plane vertex ordered hasOutside hasInside
  ⟩

/-- Weak global order is sufficient for reclipping when injectivity and one
positive ordered triple rule out collapsed one-dimensional representations. -/
theorem IsLinearlyOrderedCCW.reclipCertified_of_injective_fullDimensional
    {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex) :
    IsReclipCertified vertex := by
  exact ⟨
    orderedInjectiveFullDimensional_supportSemanticsAdequate
      vertex ordered injective fullDimensional,
    fun plane hasOutside hasInside ↦
      outside_rotatedBlock_of_weak_fullDimensional
        plane vertex ordered injective fullDimensional hasOutside hasInside
  ⟩

/-- A reclip-certified representation has complete boundary generators for
every next half-plane. -/
theorem boundaryGeneratorHullComplete_of_reclipCertified
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (certified : IsReclipCertified vertex) :
    BoundaryGeneratorHullComplete plane vertex := by
  by_cases hasOutside : ∃ index, 0 < signedDistance plane (vertex index)
  · by_cases hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0
    · rcases certified.outsideRotatedBlock plane hasOutside hasInside with
        ⟨positive, start, count, countPositive, countBound, blockIff⟩
      let rotated := rotateVertex start vertex
      have rotatedAdequate : SupportSemanticsAdequate rotated :=
        (supportSemanticsAdequate_rotateVertex_iff start vertex).mpr
          certified.supportAdequate
      have rotatedBlockIff : ∀ index,
          0 < signedDistance plane (rotated index) ↔
            0 < index.val ∧ index.val ≤ count := by
        intro index
        simpa [rotated, rotateVertex] using blockIff index
      have rotatedComplete : BoundaryGeneratorHullComplete plane rotated :=
        boundaryGeneratorHullComplete_of_outsideBlock plane rotated
          rotatedAdequate countPositive countBound rotatedBlockIff
      exact (boundaryGeneratorHullComplete_rotateVertex_iff
        plane start vertex).mp rotatedComplete
    · have allOutside : ∀ index,
          0 < signedDistance plane (vertex index) := by
        intro index
        exact lt_of_not_ge fun inside ↦ hasInside ⟨index, inside⟩
      exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
        plane vertex).mp (clipRegionComplete_of_all_pos
          plane vertex allOutside)
  · have allInside : ∀ index,
        signedDistance plane (vertex index) ≤ 0 := by
      intro index
      exact le_of_not_gt fun outside ↦ hasOutside ⟨index, outside⟩
    exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
      plane vertex).mp (clipRegionComplete_of_all_nonpos
        plane vertex allInside)

/-- Exact executable one-step semantics under the reusable, weaker-than-strict
input certificate. -/
theorem clipIndexedConvexRegion_eq_of_reclipCertified
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (certified : IsReclipCertified vertex) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane :=
  clipIndexedConvexRegion_eq_of_boundaryGeneratorHullComplete plane vertex
    (boundaryGeneratorHullComplete_of_reclipCertified plane vertex certified)

end Sprawlens.ReclipCertificate
