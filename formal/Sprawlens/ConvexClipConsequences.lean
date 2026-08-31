import Mathlib.Data.Set.Basic
import Sprawlens.ConvexClipArea

namespace Sprawlens.ConvexClipConsequences

open ConvexClipArea
open ConvexClipContract
open ExactGeometry
open HalfPlaneClipPoints
open PolygonAreaRewrite
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A proof-carrying transition between two materialized rings. -/
def ShoelaceNonincreasingStep
    (input output : List (Vec2 R)) : Prop :=
  closedEdgeCrossSum output ≤ closedEdgeCrossSum input

/-- The concrete indexed emitter supplies one certified transition. -/
theorem shoelaceNonincreasingStep_of_indexedClip {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    ShoelaceNonincreasingStep
      (indexedVertices vertex) (clipIndexedRing plane vertex) := by
  exact clippedSignedTwiceArea_le plane vertex ordered

/-- Two concrete emitter stages compose when the first output is reindexed for stage two. -/
theorem twoIndexedClips_area_nonincrease
    {firstExtra secondExtra : Nat}
    (firstPlane secondPlane : HalfPlane R)
    (firstVertex : RingIndex firstExtra → Vec2 R)
    (secondVertex : RingIndex secondExtra → Vec2 R)
    (firstOrdered : IsStrictVertexOrderedConvexCCW firstVertex)
    (secondOrdered : IsStrictVertexOrderedConvexCCW secondVertex)
    (continues : indexedVertices secondVertex =
      clipIndexedRing firstPlane firstVertex) :
    clippedSignedTwiceArea secondPlane secondVertex ≤
      indexedSignedTwiceArea firstVertex := by
  calc
    clippedSignedTwiceArea secondPlane secondVertex ≤
        indexedSignedTwiceArea secondVertex :=
      clippedSignedTwiceArea_le secondPlane secondVertex secondOrdered
    _ = clippedSignedTwiceArea firstPlane firstVertex := by
      rw [indexedSignedTwiceArea, clippedSignedTwiceArea, continues]
    _ ≤ indexedSignedTwiceArea firstVertex :=
      clippedSignedTwiceArea_le firstPlane firstVertex firstOrdered

/-- Reflexive-transitive composition of proof-carrying clipping transitions. -/
inductive CertifiedClipPath : List (Vec2 R) → List (Vec2 R) → Prop
  | refl (ring : List (Vec2 R)) : CertifiedClipPath ring ring
  | step {input middle output : List (Vec2 R)}
      (head : ShoelaceNonincreasingStep input middle)
      (tail : CertifiedClipPath middle output) :
      CertifiedClipPath input output

omit [IsStrictOrderedRing R] in
theorem CertifiedClipPath.area_nonincrease
    {input output : List (Vec2 R)}
    (path : CertifiedClipPath input output) :
    closedEdgeCrossSum output ≤ closedEdgeCrossSum input := by
  induction path with
  | refl => exact le_rfl
  | step head _ tailArea => exact tailArea.trans head

omit [IsStrictOrderedRing R] in
theorem CertifiedClipPath.trans
    {input middle output : List (Vec2 R)}
    (first : CertifiedClipPath input middle)
    (second : CertifiedClipPath middle output) :
    CertifiedClipPath input output := by
  induction first with
  | refl => exact second
  | step head _ inductionHypothesis =>
      exact .step head (inductionHypothesis second)

theorem CertifiedClipPath.then_indexedClip
    {input : List (Vec2 R)} {extraVertices : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (path : CertifiedClipPath input (indexedVertices vertex))
    (plane : HalfPlane R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    CertifiedClipPath input (clipIndexedRing plane vertex) := by
  exact path.trans (.step
    (shoelaceNonincreasingStep_of_indexedClip plane vertex ordered)
    (.refl _))

def pathAreaLoss (input output : List (Vec2 R)) : R :=
  closedEdgeCrossSum input - closedEdgeCrossSum output

theorem CertifiedClipPath.areaLoss_nonnegative
    {input output : List (Vec2 R)}
    (path : CertifiedClipPath input output) :
    0 ≤ pathAreaLoss input output := by
  exact sub_nonneg.mpr path.area_nonincrease

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Per-stage losses telescope to the total loss. -/
theorem pathAreaLoss_telescope
    (input middle output : List (Vec2 R)) :
    pathAreaLoss input middle + pathAreaLoss middle output =
      pathAreaLoss input output := by
  simp only [pathAreaLoss]
  ring

/-- The point-set denoted by one affine closed half-plane. -/
def halfPlaneRegion (plane : HalfPlane R) : Set (Vec2 R) :=
  { point | signedDistance plane point ≤ 0 }

/-- Declarative semantics of applying a finite list of half-plane constraints. -/
def constrainedRegion
    (region : Set (Vec2 R)) (planes : List (HalfPlane R)) : Set (Vec2 R) :=
  { point | point ∈ region ∧ ∀ plane ∈ planes, point ∈ halfPlaneRegion plane }

omit [IsStrictOrderedRing R] in
@[simp]
theorem constrainedRegion_nil (region : Set (Vec2 R)) :
    constrainedRegion region [] = region := by
  ext point
  simp [constrainedRegion]

omit [IsStrictOrderedRing R] in
theorem constrainedRegion_subset
    (region : Set (Vec2 R)) (planes : List (HalfPlane R)) :
    constrainedRegion region planes ⊆ region := by
  intro point member
  exact member.1

omit [IsStrictOrderedRing R] in
/-- Sequential constraint batches are equivalent to concatenating their plane lists. -/
theorem constrainedRegion_append
    (region : Set (Vec2 R)) (first second : List (HalfPlane R)) :
    constrainedRegion region (first ++ second) =
      constrainedRegion (constrainedRegion region first) second := by
  ext point
  simp only [constrainedRegion, Set.mem_ofPred_eq, List.mem_append]
  constructor
  · rintro ⟨inRegion, constrained⟩
    exact ⟨⟨inRegion, fun plane member => constrained plane (Or.inl member)⟩,
      fun plane member => constrained plane (Or.inr member)⟩
  · rintro ⟨⟨inRegion, constrainedFirst⟩, constrainedSecond⟩
    exact ⟨inRegion, fun plane member => member.elim
      (constrainedFirst plane) (constrainedSecond plane)⟩

omit [IsStrictOrderedRing R] in
/-- The declarative intersection is independent of any permutation of constraints. -/
theorem constrainedRegion_perm
    (region : Set (Vec2 R)) {planes reordered : List (HalfPlane R)}
    (permutation : planes.Perm reordered) :
    constrainedRegion region planes = constrainedRegion region reordered := by
  ext point
  simp only [constrainedRegion, Set.mem_ofPred_eq]
  constructor
  · rintro ⟨inRegion, constrained⟩
    refine ⟨inRegion, fun plane member => constrained plane ?_⟩
    exact permutation.mem_iff.mpr member
  · rintro ⟨inRegion, constrained⟩
    refine ⟨inRegion, fun plane member => constrained plane ?_⟩
    exact permutation.mem_iff.mp member

omit [IsStrictOrderedRing R] in
theorem constrainedRegion_swap
    (region : Set (Vec2 R)) (first second : HalfPlane R) :
    constrainedRegion region [first, second] =
      constrainedRegion region [second, first] := by
  apply constrainedRegion_perm
  exact .swap second first []

omit [IsStrictOrderedRing R] in
/-- Applying two single constraints sequentially is order-independent as a point set. -/
theorem sequentialHalfPlaneRegions_commute
    (region : Set (Vec2 R)) (first second : HalfPlane R) :
    constrainedRegion (constrainedRegion region [first]) [second] =
      constrainedRegion (constrainedRegion region [second]) [first] := by
  rw [← constrainedRegion_append, ← constrainedRegion_append]
  exact constrainedRegion_swap region first second

end Sprawlens.ConvexClipConsequences
