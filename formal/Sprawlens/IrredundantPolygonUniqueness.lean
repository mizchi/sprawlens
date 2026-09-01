import Mathlib.Analysis.Convex.Extreme
import Sprawlens.RedundantBoundaryNormalizer

/-!
# Irredundant polygon uniqueness

This module separates semantic uniqueness into two obligations:

1. every materialized vertex is an extreme point of its convex hull;
2. two ordered materializations of the same extreme-point set have the same
   cyclic order.

The first obligation already recovers the finite vertex set from continuous
convex-hull semantics.  The second remains an order-theoretic polygon lemma.
-/

namespace Sprawlens.IrredundantPolygonUniqueness

open Set
open ConvexClipContract
open CyclicBinaryBlocks
open ExactGeometry
open ListReclipClassification
open OrderedTriples
open PolygonSeamCanonicalizer
open RedundantBoundaryNormalizer
open SemanticReclassification
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Strict global list order: every increasing-index triple is a strict left
turn. -/
def AllStrictlyOrderedCCW (points : List (Vec2 R)) : Prop :=
  points.Triplewise
    (fun first second third => 0 < orientation first second third)

omit [IsStrictOrderedRing R] in
/-- Strict global order is invariant under cyclic seam rotation. -/
theorem allStrictlyOrderedCCW_rotate
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points)
    (count : Nat) :
    AllStrictlyOrderedCCW (points.rotate count) := by
  by_cases lengthAtLeastThree : 3 ≤ points.length
  · let rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length := by
      simpa using lengthAtLeastThree
    have vertexOrdered : IsStrictlyLinearlyOrderedCCW
        (listVertex points lengthAtLeastThree) := by
      rw [strictlyLinearlyOrdered_iff_indexedVertices_triplewise]
      rw [indexedVertices_listVertex]
      exact ordered
    let start : RingIndex (points.length - 3) :=
      ⟨count % points.length, by
        have positive : 0 < points.length := by omega
        have bound := Nat.mod_lt count positive
        omega⟩
    have rotatedOrdered := vertexOrdered.rotateVertex start
    have reindexedOrdered : IsStrictlyLinearlyOrderedCCW
        (listVertex (points.rotate count) rotatedLengthAtLeastThree) := by
      convert rotatedOrdered using 1
      · simp
      · apply (Fin.heq_fun_iff (by simp)).2
        intro index
        simp [listVertex, StrictConvexContract.rotateVertex, rotateIndex,
          start, Nat.add_comm]
        apply congrArg points.get
        apply Fin.ext
        simp only
        rw [show 3 + (points.length - 3) = points.length by omega]
        rw [Nat.add_comm index.val (count % points.length)]
        rw [Nat.mod_add_mod, Nat.add_comm]
    rw [strictlyLinearlyOrdered_iff_indexedVertices_triplewise] at reindexedOrdered
    rw [indexedVertices_listVertex] at reindexedOrdered
    exact reindexedOrdered
  · unfold AllStrictlyOrderedCCW
    apply allOrderedTriples_of_length_le_two
    simp only [List.length_rotate]
    omega

omit [IsStrictOrderedRing R] in
/-- Deterministic seam selection preserves strict global order. -/
theorem canonicalPolygon_strictlyOrdered
    (points : List (Vec2 R)) (ordered : AllStrictlyOrderedCCW points) :
    AllStrictlyOrderedCCW (canonicalPolygon points) := by
  unfold canonicalPolygon
  split
  · exact ordered
  · exact allStrictlyOrderedCCW_rotate points ordered _

/-- Two permutations with the same leading vertex and strict global order
have the same tail order. -/
theorem eq_of_perm_of_head_eq_of_strictlyOrdered
    (firstHead : Vec2 R) (firstTail secondTail : List (Vec2 R))
    (permutation : List.Perm (firstHead :: firstTail)
      (firstHead :: secondTail))
    (firstOrdered : AllStrictlyOrderedCCW (firstHead :: firstTail))
    (secondOrdered : AllStrictlyOrderedCCW (firstHead :: secondTail)) :
    firstHead :: firstTail = firstHead :: secondTail := by
  have firstTailOrdered : firstTail.Pairwise
      (fun first second =>
        0 < orientation firstHead first second) :=
    (List.triplewise_cons.mp firstOrdered).1
  have secondTailOrdered : secondTail.Pairwise
      (fun first second =>
        0 < orientation firstHead first second) :=
    (List.triplewise_cons.mp secondOrdered).1
  apply congrArg (List.cons firstHead)
  apply List.Perm.eq_of_pairwise
    (le := fun first second =>
      0 < orientation firstHead first second)
  · intro first second _ _ firstBefore secondBefore
    rw [orientation_reverse] at secondBefore
    exfalso
    linarith
  · exact firstTailOrdered
  · exact secondTailOrdered
  · exact permutation.cons_inv

/-- A strict polygon has a unique canonical list among all permutations that
preserve strict global CCW order. -/
theorem canonicalPolygon_eq_of_perm_of_strictlyOrdered
    (first second : List (Vec2 R))
    (permutation : List.Perm first second)
    (firstOrdered : AllStrictlyOrderedCCW first)
    (secondOrdered : AllStrictlyOrderedCCW second) :
    canonicalPolygon first = canonicalPolygon second := by
  have canonicalPerm :
      List.Perm (canonicalPolygon first) (canonicalPolygon second) :=
    (canonicalPolygon_perm first).trans
      (permutation.trans (canonicalPolygon_perm second).symm)
  have sameArgmin := argmin_pointKey_eq_of_perm permutation
  cases selected : List.argmin pointKey first with
  | none =>
      have firstEmpty := List.argmin_eq_none.mp selected
      subst first
      have secondEmpty := permutation.symm.eq_nil
      subst second
      simp [canonicalPolygon]
  | some minimum =>
      have selectedSecond : List.argmin pointKey second = some minimum := by
        rw [← sameArgmin, selected]
      have firstHead :=
        canonicalPolygon_head?_eq_argmin first minimum selected
      have secondHead :=
        canonicalPolygon_head?_eq_argmin second minimum selectedSecond
      cases firstCanonicalEq : canonicalPolygon first with
      | nil => simp [firstCanonicalEq] at firstHead
      | cons firstValue firstTail =>
          cases secondCanonicalEq : canonicalPolygon second with
          | nil => simp [secondCanonicalEq] at secondHead
          | cons secondValue secondTail =>
              have firstValueEq : firstValue = minimum := by
                simpa [firstCanonicalEq] using firstHead
              have secondValueEq : secondValue = minimum := by
                simpa [secondCanonicalEq] using secondHead
              subst firstValue
              subst secondValue
              rw [firstCanonicalEq, secondCanonicalEq] at canonicalPerm
              apply eq_of_perm_of_head_eq_of_strictlyOrdered
                minimum firstTail secondTail canonicalPerm
              · simpa [firstCanonicalEq] using
                  canonicalPolygon_strictlyOrdered first firstOrdered
              · simpa [secondCanonicalEq] using
                  canonicalPolygon_strictlyOrdered second secondOrdered

/-- Every listed generator is an extreme point of the region generated by
the list. -/
def AllVerticesExtreme (points : List (Vec2 R)) : Prop :=
  ∀ point, point ∈ points →
    point ∈ (listConvexRegion points).extremePoints R

/-- If every finite generator is extreme, continuous convex-hull semantics
recovers exactly the original generator set. -/
theorem vertexSet_eq_extremePoints_of_allVerticesExtreme
    (points : List (Vec2 R)) (allExtreme : AllVerticesExtreme points) :
    {point : Vec2 R | point ∈ points} =
      (listConvexRegion points).extremePoints R := by
  apply Set.Subset.antisymm
  · intro point pointMember
    exact allExtreme point pointMember
  · unfold listConvexRegion
    exact extremePoints_convexHull_subset

/-- Equal convex regions with all generators extreme have exactly the same
finite vertex set. -/
theorem vertexSet_eq_of_region_eq_of_allVerticesExtreme
    (first second : List (Vec2 R))
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    {point : Vec2 R | point ∈ first} =
      {point : Vec2 R | point ∈ second} := by
  rw [vertexSet_eq_extremePoints_of_allVerticesExtreme first firstExtreme,
    vertexSet_eq_extremePoints_of_allVerticesExtreme second secondExtreme,
    sameRegion]

/-- With duplicate-free materializations, recovered vertex-set equality lifts
to list permutation. -/
theorem perm_of_region_eq_of_allVerticesExtreme
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    List.Perm first second := by
  apply (List.perm_ext_iff_of_nodup firstNodup secondNodup).mpr
  intro point
  have sameVertexSet :=
    vertexSet_eq_of_region_eq_of_allVerticesExtreme
      first second firstExtreme secondExtreme sameRegion
  exact Set.ext_iff.mp sameVertexSet point

/-- Once all listed vertices are extreme and both materializations are
strictly CCW ordered, equal continuous regions produce the same canonical
polygon list. -/
theorem canonicalPolygon_eq_of_region_eq_of_extreme_of_strictlyOrdered
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (firstOrdered : AllStrictlyOrderedCCW first)
    (secondOrdered : AllStrictlyOrderedCCW second)
    (sameRegion : listConvexRegion first = listConvexRegion second) :
    canonicalPolygon first = canonicalPolygon second := by
  apply canonicalPolygon_eq_of_perm_of_strictlyOrdered first second
  · exact perm_of_region_eq_of_allVerticesExtreme
      first second firstNodup secondNodup firstExtreme secondExtreme sameRegion
  · exact firstOrdered
  · exact secondOrdered

/-- Exact polygon-list uniqueness follows once same-set ordered polygons are
known to have the same cyclic order.  The recovered permutation is passed to
that remaining order-rigidity obligation explicitly. -/
theorem canonicalPolygon_eq_of_region_eq_of_extreme_and_order_rigidity
    (first second : List (Vec2 R))
    (firstNodup : first.Nodup) (secondNodup : second.Nodup)
    (firstExtreme : AllVerticesExtreme first)
    (secondExtreme : AllVerticesExtreme second)
    (sameRegion : listConvexRegion first = listConvexRegion second)
    (orderRigid : List.Perm first second → first ~r second) :
    canonicalPolygon first = canonicalPolygon second := by
  have sameVertices := perm_of_region_eq_of_allVerticesExtreme
    first second firstNodup secondNodup firstExtreme secondExtreme sameRegion
  have sameCyclicOrder := orderRigid sameVertices
  obtain ⟨count, rotatedEq⟩ := sameCyclicOrder
  rw [← rotatedEq]
  exact (canonicalPolygon_rotate first firstNodup count).symm

end Sprawlens.IrredundantPolygonUniqueness
