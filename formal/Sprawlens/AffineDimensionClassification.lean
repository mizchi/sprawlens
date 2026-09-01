import Sprawlens.SemanticReclassification

namespace Sprawlens.AffineDimensionClassification

open ConvexClipContract
open ExactGeometry
open FullDimensionalSupportSemantics
open HalfPlaneClipPoints
open ListReclipClassification
open ReclipCertificate
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- The one-dimensional branch stated only on increasing index triples.  For
a weakly ordered ring, failure of full-dimensionality forces these
orientations to vanish rather than turn clockwise. -/
def AllOrderedTriplesCollinear {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∀ first second third,
    first.val < second.val → second.val < third.val →
      orientation (vertex first) (vertex second) (vertex third) = 0

omit [IsStrictOrderedRing R] in
/-- Weak global order has an exact affine-dimension fork: either one ordered
triple is positive, or every ordered triple is collinear. -/
theorem linearlyOrdered_dimensionDichotomy
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex) :
    HasPositiveTriple vertex ∨ AllOrderedTriplesCollinear vertex := by
  by_cases fullDimensional : HasPositiveTriple vertex
  · exact Or.inl fullDimensional
  · right
    intro first second third firstBefore secondBefore
    have nonnegative := ordered first second third firstBefore secondBefore
    have nonpositive :
        orientation (vertex first) (vertex second) (vertex third) ≤ 0 := by
      exact le_of_not_gt fun positive ↦ fullDimensional
        ⟨first, second, third, firstBefore, secondBefore, positive⟩
    exact le_antisymm nonpositive nonnegative

/-- Injectivity closes the full-dimensional side immediately with the
existing reusable certificate.  The only remaining classification obligation
is therefore the all-collinear side. -/
theorem reclipCertified_or_allOrderedTriplesCollinear
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex) :
    IsReclipCertified vertex ∨ AllOrderedTriplesCollinear vertex := by
  rcases linearlyOrdered_dimensionDichotomy vertex ordered with
    fullDimensional | collinear
  · exact Or.inl
      (IsLinearlyOrderedCCW.reclipCertified_of_injective_fullDimensional
        ordered injective fullDimensional)
  · exact Or.inr collinear

/-- Applied to an actual emitter output, weak-order preservation plus `Nodup`
reduces total redispatch to the collinear endpoint-normalization branch. -/
theorem clipOutput_reclipCertified_or_allOrderedTriplesCollinear
    {extraVertices : Nat}
    (plane : HalfPlane R) (source : RingIndex extraVertices → Vec2 R)
    (sourceOrdered : IsLinearlyOrderedCCW source)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing plane source).length)
    (outputNodup : (clipIndexedRing plane source).Nodup) :
    IsReclipCertified
        (listVertex (clipIndexedRing plane source) lengthAtLeastThree) ∨
      AllOrderedTriplesCollinear
        (listVertex (clipIndexedRing plane source) lengthAtLeastThree) := by
  apply reclipCertified_or_allOrderedTriplesCollinear
  · exact clipOutput_listVertex_linearlyOrdered
      plane source sourceOrdered lengthAtLeastThree
  · exact listVertex_injective_of_nodup lengthAtLeastThree outputNodup

end Sprawlens.AffineDimensionClassification
