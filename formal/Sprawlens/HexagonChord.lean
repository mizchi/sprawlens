import Sprawlens.ConvexClipContract

namespace Sprawlens.HexagonChord

open ConvexClipContract
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneClipRing
open OrderedTriples
open SimpleRing

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

def canonicalOrigin : Vec2 R := { x := 0, y := 0 }

def canonicalChordEnd (scale : R) : Vec2 R := { x := scale, y := 0 }

def canonicalWitness (scale : R) : Vec2 R := { x := 0, y := -scale }

/--
In the chord frame, a clockwise alternating triple forces a weakly supported hexagon
to repeat its three vertices. Only the support inequalities used by the proof are assumed.
-/
theorem canonical_support_forces_three_periodic
    (scale : R) (scalePositive : 0 < scale) (b d f : Vec2 R)
    (edge0Supports4 : 0 ≤ orientation canonicalOrigin b (canonicalWitness scale))
    (edge1Supports4 : 0 ≤ orientation b (canonicalChordEnd scale) (canonicalWitness scale))
    (edge2Supports0 : 0 ≤ orientation (canonicalChordEnd scale) d canonicalOrigin)
    (edge3Supports0 : 0 ≤ orientation d (canonicalWitness scale) canonicalOrigin)
    (edge4Supports2 : 0 ≤ orientation (canonicalWitness scale) f (canonicalChordEnd scale))
    (edge5Supports2 : 0 ≤ orientation f canonicalOrigin (canonicalChordEnd scale))
    (edge2Supports5 : 0 ≤ orientation (canonicalChordEnd scale) d f)
    (edge4Supports1 : 0 ≤ orientation (canonicalWitness scale) f b)
    (edge5Supports3 : 0 ≤ orientation f canonicalOrigin d)
    (edge0Supports3 : 0 ≤ orientation canonicalOrigin b d)
    (edge3Supports1 : 0 ≤ orientation d (canonicalWitness scale) b)
    (edge1Supports5 : 0 ≤ orientation b (canonicalChordEnd scale) f) :
    b = canonicalWitness scale ∧ d = canonicalOrigin ∧ f = canonicalChordEnd scale := by
  simp only [canonicalOrigin, canonicalChordEnd, canonicalWitness, orientation] at edge0Supports4 edge1Supports4 edge2Supports0 edge3Supports0 edge4Supports2 edge5Supports2 edge2Supports5 edge4Supports1 edge5Supports3 edge0Supports3 edge3Supports1 edge1Supports5
  ring_nf at edge0Supports4 edge1Supports4 edge2Supports0 edge3Supports0 edge4Supports2 edge5Supports2 edge2Supports5 edge4Supports1 edge5Supports3 edge0Supports3 edge3Supports1 edge1Supports5
  have bXNonpos : b.x ≤ 0 := by nlinarith
  have bYUpper : b.y + scale ≤ b.x := by nlinarith
  have bYNeg : b.y < 0 := by nlinarith
  have dXNonpos : d.x ≤ 0 := by nlinarith
  have dYNonneg : 0 ≤ d.y := by nlinarith
  have fYNonneg : 0 ≤ f.y := by nlinarith
  have fXLower : f.y + scale ≤ f.x := by nlinarith
  have fXPos : 0 < f.x := by nlinarith
  have firstProductNonpos : (d.x - scale) * f.y ≤ 0 :=
    mul_nonpos_of_nonpos_of_nonneg (by linarith) fYNonneg
  have secondProductNonneg : 0 ≤ d.y * (f.x - scale) :=
    mul_nonneg dYNonneg (by linarith)
  have firstProductZero : (d.x - scale) * f.y = 0 := by nlinarith
  have fYZero : f.y = 0 := by
    rcases mul_eq_zero.mp firstProductZero with differenceZero | result
    · nlinarith
    · exact result
  have bShiftNonpos : b.y + scale ≤ 0 := by linarith
  have fGapNonneg : 0 ≤ f.x - scale := by linarith
  have scaledShiftNonpos : (f.x - scale) * (b.y + scale) ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos fGapNonneg bShiftNonpos
  have scaleGapNonpos : scale * (b.y + scale - b.x) ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos (le_of_lt scalePositive) (by linarith)
  have edge4Decomposition :
      f.x * (b.y + scale) - scale * b.x =
        (f.x - scale) * (b.y + scale) + scale * (b.y + scale - b.x) := by
    ring
  have bOnEarLine : b.y + scale = b.x := by
    rw [fYZero] at edge4Supports1
    have edge4Canonical : 0 ≤ f.x * (b.y + scale) - scale * b.x := by
      nlinarith only [edge4Supports1]
    rw [edge4Decomposition] at edge4Canonical
    have scaleGapZero : scale * (b.y + scale - b.x) = 0 := by
      linarith only [edge4Canonical, scaledShiftNonpos, scaleGapNonpos]
    rcases mul_eq_zero.mp scaleGapZero with scaleZero | gapZero
    · exact False.elim ((ne_of_gt scalePositive) scaleZero)
    · linarith
  have dYZero : d.y = 0 := by
    rw [fYZero] at edge5Supports3
    ring_nf at edge5Supports3
    have productNonneg : 0 ≤ f.x * d.y :=
      mul_nonneg (le_of_lt fXPos) dYNonneg
    have productZero : f.x * d.y = 0 := by
      linarith only [edge5Supports3, productNonneg]
    rcases mul_eq_zero.mp productZero with fXZero | result
    · exact False.elim ((ne_of_gt fXPos) fXZero)
    · exact result
  have dXZero : d.x = 0 := by
    rw [dYZero] at edge0Supports3
    ring_nf at edge0Supports3
    have productNonneg : 0 ≤ b.y * d.x :=
      mul_nonneg_of_nonpos_of_nonpos (le_of_lt bYNeg) dXNonpos
    have productZero : b.y * d.x = 0 := by
      linarith only [edge0Supports3, productNonneg]
    rcases mul_eq_zero.mp productZero with bYZero | result
    · exact False.elim ((ne_of_lt bYNeg) bYZero)
    · exact result
  have bXZero : b.x = 0 := by
    rw [dXZero, dYZero] at edge3Supports1
    ring_nf at edge3Supports1
    have productNonpos : b.x * scale ≤ 0 :=
      mul_nonpos_of_nonpos_of_nonneg bXNonpos (le_of_lt scalePositive)
    have productZero : b.x * scale = 0 := by
      linarith only [edge3Supports1, productNonpos]
    rcases mul_eq_zero.mp productZero with result | scaleZero
    · exact result
    · exact False.elim ((ne_of_gt scalePositive) scaleZero)
  have bYValue : b.y = -scale := by linarith
  have fXValue : f.x = scale := by
    rw [bXZero, bYValue, fYZero] at edge1Supports5
    ring_nf at edge1Supports5
    have productNonpos : scale * (scale - f.x) ≤ 0 :=
      mul_nonpos_of_nonneg_of_nonpos (le_of_lt scalePositive) (by linarith)
    have productZero : scale * (scale - f.x) = 0 := by
      have edge1Canonical : 0 ≤ scale * (scale - f.x) := by
        nlinarith only [edge1Supports5]
      linarith only [edge1Canonical, productNonpos]
    rcases mul_eq_zero.mp productZero with scaleZero | differenceZero
    · exact False.elim ((ne_of_gt scalePositive) scaleZero)
    · linarith
  constructor
  · cases b
    simp only [canonicalWitness] at bXZero bYValue ⊢
    simp [bXZero, bYValue]
  constructor
  · cases d
    simp only [canonicalOrigin] at dXZero dYZero ⊢
    simp [dXZero, dYZero]
  · cases f
    simp only [canonicalChordEnd] at fXValue fYZero ⊢
    simp [fXValue, fYZero]

theorem clockwise_support_forces_three_periodic
    (a b c d e f : Vec2 R) (clockwise : orientation a c e < 0)
    (edge0Supports4 : 0 ≤ orientation a b e)
    (edge1Supports4 : 0 ≤ orientation b c e)
    (edge2Supports0 : 0 ≤ orientation c d a)
    (edge3Supports0 : 0 ≤ orientation d e a)
    (edge4Supports2 : 0 ≤ orientation e f c)
    (edge5Supports2 : 0 ≤ orientation f a c)
    (edge2Supports5 : 0 ≤ orientation c d f)
    (edge4Supports1 : 0 ≤ orientation e f b)
    (edge5Supports3 : 0 ≤ orientation f a d)
    (edge0Supports3 : 0 ≤ orientation a b d)
    (edge3Supports1 : 0 ≤ orientation d e b)
    (edge1Supports5 : 0 ≤ orientation b c f) :
    b = e ∧ d = a ∧ f = c := by
  let frame := chordFrame a c e
  let scale := -orientation a c e
  have scalePositive : 0 < scale := neg_pos.mpr clockwise
  have frameOrigin : frame a = canonicalOrigin := by
    simp [frame, canonicalOrigin]
  have frameChordEnd : frame c = canonicalChordEnd scale := by
    simpa only [frame, scale, canonicalChordEnd] using chordFrame_chordEnd a c e
  have frameWitness : frame e = canonicalWitness scale := by
    simpa only [frame, scale, canonicalWitness, neg_neg] using chordFrame_witness a c e
  have mapSupport (p q r : Vec2 R) (support : 0 ≤ orientation p q r) :
      0 ≤ orientation (frame p) (frame q) (frame r) := by
    exact (orientation_chordFrame_nonneg_iff a c e p q r clockwise).2 support
  have periodic := canonical_support_forces_three_periodic scale scalePositive
    (frame b) (frame d) (frame f)
    (by simpa only [frameOrigin, frameWitness] using mapSupport a b e edge0Supports4)
    (by simpa only [frameChordEnd, frameWitness] using mapSupport b c e edge1Supports4)
    (by simpa only [frameOrigin, frameChordEnd] using mapSupport c d a edge2Supports0)
    (by simpa only [frameOrigin, frameWitness] using mapSupport d e a edge3Supports0)
    (by simpa only [frameChordEnd, frameWitness] using mapSupport e f c edge4Supports2)
    (by simpa only [frameOrigin, frameChordEnd] using mapSupport f a c edge5Supports2)
    (by simpa only [frameChordEnd] using mapSupport c d f edge2Supports5)
    (by simpa only [frameWitness] using mapSupport e f b edge4Supports1)
    (by simpa only [frameOrigin] using mapSupport f a d edge5Supports3)
    (by simpa only [frameOrigin] using mapSupport a b d edge0Supports3)
    (by simpa only [frameWitness] using mapSupport d e b edge3Supports1)
    (by simpa only [frameChordEnd] using mapSupport b c f edge1Supports5)
  rcases periodic with ⟨frameB, frameD, frameF⟩
  have frameInjective := chordFrame_injective a c e (ne_of_lt clockwise)
  exact ⟨
    frameInjective (frameB.trans frameWitness.symm),
    frameInjective (frameD.trans frameOrigin.symm),
    frameInjective (frameF.trans frameChordEnd.symm)⟩

theorem weaklyConvex_injective_hexagon_even_chord_nonneg
    (vertex : RingIndex 3 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (injective : Function.Injective vertex) :
    0 ≤ orientation (vertex ⟨0, by omega⟩) (vertex ⟨2, by omega⟩)
      (vertex ⟨4, by omega⟩) := by
  apply le_of_not_gt
  intro clockwise
  let v0 : RingIndex 3 := ⟨0, by omega⟩
  let v1 : RingIndex 3 := ⟨1, by omega⟩
  let v2 : RingIndex 3 := ⟨2, by omega⟩
  let v3 : RingIndex 3 := ⟨3, by omega⟩
  let v4 : RingIndex 3 := ⟨4, by omega⟩
  let v5 : RingIndex 3 := ⟨5, by omega⟩
  have periodic := clockwise_support_forces_three_periodic
    (vertex v0) (vertex v1) (vertex v2) (vertex v3) (vertex v4) (vertex v5)
    (by simpa only [v0, v2, v4] using clockwise)
    (by simpa [v0, v1, v4, nextIndex] using convex v0 v4)
    (by simpa [v1, v2, v4, nextIndex] using convex v1 v4)
    (by simpa [v0, v2, v3, nextIndex] using convex v2 v0)
    (by simpa [v0, v3, v4, nextIndex] using convex v3 v0)
    (by simpa [v2, v4, v5, nextIndex] using convex v4 v2)
    (by simpa [v0, v2, v5, nextIndex] using convex v5 v2)
    (by simpa [v2, v3, v5, nextIndex] using convex v2 v5)
    (by simpa [v1, v4, v5, nextIndex] using convex v4 v1)
    (by simpa [v0, v3, v5, nextIndex] using convex v5 v3)
    (by simpa [v0, v1, v3, nextIndex] using convex v0 v3)
    (by simpa [v1, v3, v4, nextIndex] using convex v3 v1)
    (by simpa [v1, v2, v5, nextIndex] using convex v1 v5)
  have equalIndices := injective periodic.1
  norm_num [v1, v4] at equalIndices

theorem weaklyConvex_injective_hexagon_odd_chord_nonneg
    (vertex : RingIndex 3 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (injective : Function.Injective vertex) :
    0 ≤ orientation (vertex ⟨1, by omega⟩) (vertex ⟨3, by omega⟩)
      (vertex ⟨5, by omega⟩) := by
  apply le_of_not_gt
  intro clockwise
  let v0 : RingIndex 3 := ⟨0, by omega⟩
  let v1 : RingIndex 3 := ⟨1, by omega⟩
  let v2 : RingIndex 3 := ⟨2, by omega⟩
  let v3 : RingIndex 3 := ⟨3, by omega⟩
  let v4 : RingIndex 3 := ⟨4, by omega⟩
  let v5 : RingIndex 3 := ⟨5, by omega⟩
  have periodic := clockwise_support_forces_three_periodic
    (vertex v1) (vertex v2) (vertex v3) (vertex v4) (vertex v5) (vertex v0)
    (by simpa only [v1, v3, v5] using clockwise)
    (by simpa [v1, v2, v5, nextIndex] using convex v1 v5)
    (by simpa [v2, v3, v5, nextIndex] using convex v2 v5)
    (by simpa [v1, v3, v4, nextIndex] using convex v3 v1)
    (by simpa [v1, v4, v5, nextIndex] using convex v4 v1)
    (by simpa [v0, v3, v5, nextIndex] using convex v5 v3)
    (by simpa [v0, v1, v3, nextIndex] using convex v0 v3)
    (by simpa [v0, v3, v4, nextIndex] using convex v3 v0)
    (by simpa [v0, v2, v5, nextIndex] using convex v5 v2)
    (by simpa [v0, v1, v4, nextIndex] using convex v0 v4)
    (by simpa [v1, v2, v4, nextIndex] using convex v1 v4)
    (by simpa [v2, v4, v5, nextIndex] using convex v4 v2)
    (by simpa [v0, v2, v3, nextIndex] using convex v2 v0)
  have equalIndices := injective periodic.1
  norm_num [v2, v5] at equalIndices

theorem weaklyConvex_injective_hexagon_linearlyOrdered
    (vertex : RingIndex 3 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (injective : Function.Injective vertex) :
    IsLinearlyOrderedCCW vertex := by
  intro first second third firstBefore secondBefore
  by_cases adjacent : nextIndex first = second ∨
      nextIndex second = third ∨ nextIndex third = first
  · exact weaklyConvex_ordered_of_cyclic_adjacent_pair convex first second third adjacent
  have firstNotAdjacent : first.val + 1 ≠ second.val := by
    intro valuesEqual
    apply adjacent
    left
    apply Fin.ext
    simp [nextIndex, valuesEqual]
  have secondNotAdjacent : second.val + 1 ≠ third.val := by
    intro valuesEqual
    apply adjacent
    right
    left
    apply Fin.ext
    simp [nextIndex, valuesEqual]
  have notWrapAdjacent : ¬(third.val = 5 ∧ first.val = 0) := by
    rintro ⟨thirdLast, firstZero⟩
    apply adjacent
    right
    right
    apply Fin.ext
    simp [nextIndex, thirdLast, firstZero]
  have indexCases :
      (first.val = 0 ∧ second.val = 2 ∧ third.val = 4) ∨
      (first.val = 1 ∧ second.val = 3 ∧ third.val = 5) := by
    omega
  rcases indexCases with evenIndices | oddIndices
  · rcases evenIndices with ⟨firstZero, secondTwo, thirdFour⟩
    have firstEq : first = (⟨0, by omega⟩ : RingIndex 3) := by
      apply Fin.ext
      exact firstZero
    have secondEq : second = (⟨2, by omega⟩ : RingIndex 3) := by
      apply Fin.ext
      exact secondTwo
    have thirdEq : third = (⟨4, by omega⟩ : RingIndex 3) := by
      apply Fin.ext
      exact thirdFour
    rw [firstEq, secondEq, thirdEq]
    exact weaklyConvex_injective_hexagon_even_chord_nonneg vertex convex injective
  · rcases oddIndices with ⟨firstOne, secondThree, thirdFive⟩
    have firstEq : first = (⟨1, by omega⟩ : RingIndex 3) := by
      apply Fin.ext
      exact firstOne
    have secondEq : second = (⟨3, by omega⟩ : RingIndex 3) := by
      apply Fin.ext
      exact secondThree
    have thirdEq : third = (⟨5, by omega⟩ : RingIndex 3) := by
      apply Fin.ext
      exact thirdFive
    rw [firstEq, secondEq, thirdEq]
    exact weaklyConvex_injective_hexagon_odd_chord_nonneg vertex convex injective

theorem weaklyConvex_simple_hexagon_linearlyOrdered
    (vertex : RingIndex 3 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (simple : IsSimpleRing vertex) :
    IsLinearlyOrderedCCW vertex :=
  weaklyConvex_injective_hexagon_linearlyOrdered vertex convex simple.1

theorem clipIndexedHexagon_cyclicTurnsNonnegative_of_injective
    (plane : HalfPlane R) (vertex : RingIndex 3 → Vec2 R)
    (convex : IsWeaklyConvexCCW vertex)
    (injective : Function.Injective vertex) :
    CyclicTurnsNonnegative (clipIndexedRing plane vertex) := by
  apply clipIndexedRing_cyclicTurnsNonnegative_of_vertex_ordered
  exact ⟨convex,
    weaklyConvex_injective_hexagon_linearlyOrdered vertex convex injective⟩

end Sprawlens.HexagonChord
