import Sprawlens.SeamSupportSemantics

namespace Sprawlens.FullDimensionalSupportSemantics

open CanonicalClip
open ConvexClipContract
open ExactGeometry
open SeamSupportSemantics
open SimpleRing

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Two consecutive collinear triples with a nondegenerate shared edge lie on
one line, so the outer triple is collinear as well. -/
theorem orientation_eq_zero_of_collinear_chain
    (a b c d : Vec2 R)
    (firstZero : orientation a b c = 0)
    (secondZero : orientation b c d = 0)
    (sharedEdgeNondegenerate : b ≠ c) :
    orientation a c d = 0 := by
  by_cases xDifferent : b.x ≠ c.x
  · have scaled :
        (c.x - b.x) * orientation a c d = 0 := by
      simp only [orientation] at firstZero secondZero ⊢
      linear_combination
        (d.x - c.x) * firstZero + (c.x - a.x) * secondZero
    exact (mul_eq_zero.mp scaled).resolve_left (sub_ne_zero.mpr xDifferent.symm)
  · have yDifferent : b.y ≠ c.y := by
      intro yEqual
      apply sharedEdgeNondegenerate
      cases a
      cases b
      cases c
      simp_all
    have scaled :
        (c.y - b.y) * orientation a c d = 0 := by
      simp only [orientation] at firstZero secondZero ⊢
      linear_combination
        (d.y - c.y) * firstZero + (c.y - a.y) * secondZero
    exact (mul_eq_zero.mp scaled).resolve_left (sub_ne_zero.mpr yDifferent.symm)

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- The same collinear chain also makes the triple using the first shared
endpoint collinear. -/
theorem orientation_eq_zero_of_collinear_chain_left
    (a b c d : Vec2 R)
    (firstZero : orientation a b c = 0)
    (secondZero : orientation b c d = 0)
    (sharedEdgeNondegenerate : b ≠ c) :
    orientation a b d = 0 := by
  by_cases xDifferent : b.x ≠ c.x
  · have scaled :
        (c.x - b.x) * orientation a b d = 0 := by
      simp only [orientation] at firstZero secondZero ⊢
      linear_combination
        (d.x - b.x) * firstZero + (b.x - a.x) * secondZero
    exact (mul_eq_zero.mp scaled).resolve_left (sub_ne_zero.mpr xDifferent.symm)
  · have yDifferent : b.y ≠ c.y := by
      intro yEqual
      apply sharedEdgeNondegenerate
      cases a
      cases b
      cases c
      simp_all
    have scaled :
        (c.y - b.y) * orientation a b d = 0 := by
      simp only [orientation] at firstZero secondZero ⊢
      linear_combination
        (d.y - b.y) * firstZero + (b.y - a.y) * secondZero
    exact (mul_eq_zero.mp scaled).resolve_left (sub_ne_zero.mpr yDifferent.symm)

/-- Conventional full-dimensionality: at least one increasing vertex triple
has positive orientation. -/
def HasPositiveTriple {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∃ first second third,
    first.val < second.val ∧ second.val < third.val ∧
      0 < orientation (vertex first) (vertex second) (vertex third)

omit [IsStrictOrderedRing R] in
/-- Any positive ordered triple contains a positive cyclic adjacent turn.
The proof minimizes the outer index span and uses collinear-chain propagation
to rule out a zero/zero split. -/
theorem positiveTriple_hasPositiveCyclicTurn
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (first second third : RingIndex extraVertices)
    (firstBeforeSecond : first.val < second.val)
    (secondBeforeThird : second.val < third.val)
    (positive : 0 < orientation (vertex first) (vertex second) (vertex third)) :
    HasPositiveCyclicTurn vertex := by
  generalize spanEquation : third.val - first.val = span
  induction span using Nat.strong_induction_on generalizing
      first second third with
  | h span inductionHypothesis =>
      have firstBound := first.isLt
      have secondBound := second.isLt
      have thirdBound := third.isLt
      by_cases gapBeforeSecond : first.val + 1 < second.val
      · let beforeSecond : RingIndex extraVertices :=
          ⟨second.val - 1, by omega⟩
        have beforeSecondValue : beforeSecond.val = second.val - 1 := rfl
        have firstBeforeBeforeSecond : first.val < beforeSecond.val := by
          rw [beforeSecondValue]
          omega
        have beforeSecondBeforeSecond : beforeSecond.val < second.val := by
          rw [beforeSecondValue]
          omega
        have leftNonnegative :
            0 ≤ orientation (vertex first) (vertex beforeSecond) (vertex second) :=
          ordered first beforeSecond second
            firstBeforeBeforeSecond beforeSecondBeforeSecond
        have rightNonnegative :
            0 ≤ orientation (vertex beforeSecond) (vertex second) (vertex third) :=
          ordered beforeSecond second third
            beforeSecondBeforeSecond secondBeforeThird
        have splitPositive :
            0 < orientation (vertex first) (vertex beforeSecond) (vertex second) ∨
              0 < orientation (vertex beforeSecond) (vertex second) (vertex third) := by
          rcases lt_or_eq_of_le leftNonnegative with leftPositive | leftZero
          · exact Or.inl leftPositive
          · rcases lt_or_eq_of_le rightNonnegative with rightPositive | rightZero
            · exact Or.inr rightPositive
            · have sharedDifferent : vertex beforeSecond ≠ vertex second := by
                intro equalPoints
                have equalIndices := injective equalPoints
                have equalValues := congrArg Fin.val equalIndices
                simp [beforeSecond] at equalValues
                omega
              have outerZero := orientation_eq_zero_of_collinear_chain
                (vertex first) (vertex beforeSecond) (vertex second) (vertex third)
                leftZero.symm rightZero.symm sharedDifferent
              exact False.elim ((ne_of_gt positive) outerZero)
        rcases splitPositive with leftPositive | rightPositive
        · exact inductionHypothesis (second.val - first.val) (by omega)
            first beforeSecond second
            firstBeforeBeforeSecond beforeSecondBeforeSecond
            leftPositive (by rfl)
        · exact inductionHypothesis (third.val - beforeSecond.val) (by
              simp [beforeSecond]
              omega)
            beforeSecond second third
            beforeSecondBeforeSecond secondBeforeThird rightPositive (by rfl)
      · have secondIsNext : second.val = first.val + 1 := by omega
        by_cases gapBeforeThird : second.val + 1 < third.val
        · let beforeThird : RingIndex extraVertices :=
            ⟨third.val - 1, by omega⟩
          have beforeThirdValue : beforeThird.val = third.val - 1 := rfl
          have secondBeforeBeforeThird : second.val < beforeThird.val := by
            rw [beforeThirdValue]
            omega
          have beforeThirdBeforeThird : beforeThird.val < third.val := by
            rw [beforeThirdValue]
            omega
          have leftNonnegative :
              0 ≤ orientation (vertex first) (vertex second) (vertex beforeThird) :=
            ordered first second beforeThird firstBeforeSecond
              secondBeforeBeforeThird
          have rightNonnegative :
              0 ≤ orientation (vertex second) (vertex beforeThird) (vertex third) :=
            ordered second beforeThird third
              secondBeforeBeforeThird beforeThirdBeforeThird
          have splitPositive :
              0 < orientation (vertex first) (vertex second) (vertex beforeThird) ∨
                0 < orientation (vertex second) (vertex beforeThird) (vertex third) := by
            rcases lt_or_eq_of_le leftNonnegative with leftPositive | leftZero
            · exact Or.inl leftPositive
            · rcases lt_or_eq_of_le rightNonnegative with rightPositive | rightZero
              · exact Or.inr rightPositive
              · have sharedDifferent : vertex second ≠ vertex beforeThird := by
                  intro equalPoints
                  have equalIndices := injective equalPoints
                  have equalValues := congrArg Fin.val equalIndices
                  simp [beforeThird] at equalValues
                  omega
                have outerZero := orientation_eq_zero_of_collinear_chain_left
                  (vertex first) (vertex second) (vertex beforeThird) (vertex third)
                  leftZero.symm rightZero.symm sharedDifferent
                exact False.elim ((ne_of_gt positive) outerZero)
          rcases splitPositive with leftPositive | rightPositive
          · exact inductionHypothesis (beforeThird.val - first.val) (by
                simp [beforeThird]
                omega)
              first second beforeThird firstBeforeSecond
              secondBeforeBeforeThird leftPositive (by rfl)
          · exact inductionHypothesis (third.val - second.val) (by omega)
              second beforeThird third
              secondBeforeBeforeThird beforeThirdBeforeThird
              rightPositive (by rfl)
        · have thirdIsNext : third.val = second.val + 1 := by omega
          have nextFirst : nextIndex first = second := by
            apply Fin.ext
            simp only [nextIndex]
            rw [Nat.mod_eq_of_lt (by omega)]
            exact secondIsNext.symm
          have nextSecond : nextIndex second = third := by
            apply Fin.ext
            simp only [nextIndex]
            rw [Nat.mod_eq_of_lt (by omega)]
            exact thirdIsNext.symm
          exact ⟨first, by simpa [nextFirst, nextSecond] using positive⟩

omit [IsStrictOrderedRing R] in
theorem hasPositiveTriple_hasPositiveCyclicTurn
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex) :
    HasPositiveCyclicTurn vertex := by
  rcases fullDimensional with
    ⟨first, second, third, firstBeforeSecond, secondBeforeThird, positive⟩
  exact positiveTriple_hasPositiveCyclicTurn vertex ordered injective
    first second third firstBeforeSecond secondBeforeThird positive

/-- Conventional full-dimensionality, weak global order, and injectivity are
sufficient for exact support semantics, with no materialization-seam premise. -/
theorem orderedInjectiveFullDimensional_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex) :
    SupportSemanticsAdequate vertex := by
  have positiveTurn : HasPositiveCyclicTurn vertex :=
    hasPositiveTriple_hasPositiveCyclicTurn vertex ordered injective
      fullDimensional
  exact orderedInjectivePositiveSeam_supportSemanticsAdequate
    vertex ordered injective
    ((hasPositiveSeam_iff_hasPositiveCyclicTurn vertex).mpr positiveTurn)

/-- Topological simplicity supplies injectivity for the seam-independent
full-dimensional theorem. -/
theorem orderedSimpleFullDimensional_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (simple : IsSimpleRing vertex)
    (fullDimensional : HasPositiveTriple vertex) :
    SupportSemanticsAdequate vertex := by
  exact orderedInjectiveFullDimensional_supportSemanticsAdequate
    vertex ordered (simpleRing_vertices_injective simple) fullDimensional

end Sprawlens.FullDimensionalSupportSemantics
