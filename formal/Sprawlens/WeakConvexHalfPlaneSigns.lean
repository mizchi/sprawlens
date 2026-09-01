import Sprawlens.ConvexHalfPlaneSigns
import Sprawlens.FanBetweenness
import Sprawlens.FullDimensionalSupportSemantics

namespace Sprawlens.WeakConvexHalfPlaneSigns

open ConvexClipContract
open ConvexHalfPlaneSigns
open CyclicBinaryBlocks
open ExactGeometry
open FanBetweenness
open FullDimensionalSupportSemantics
open HalfPlaneClipPoints
open HalfPlaneIntersection
open SimpleRing

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Three points lying on one nondegenerate reference line are collinear with
each other.  This packages the zero-orientation propagation used below. -/
theorem common_line_triple_collinear
    (start finish first second third : Vec2 R)
    (startNeFinish : start ≠ finish)
    (firstOnLine : orientation start finish first = 0)
    (secondOnLine : orientation start finish second = 0)
    (thirdOnLine : orientation start finish third = 0) :
    orientation first second third = 0 := by
  have firstStartFinish : orientation first start finish = 0 := by
    calc
      orientation first start finish = orientation start finish first := by
        exact (orientation_cycle first start finish).symm
      _ = 0 := firstOnLine
  have firstFinishSecond : orientation first finish second = 0 :=
    orientation_eq_zero_of_collinear_chain
      first start finish second firstStartFinish secondOnLine startNeFinish
  have secondStartFinish : orientation second start finish = 0 := by
    calc
      orientation second start finish = orientation start finish second := by
        exact (orientation_cycle second start finish).symm
      _ = 0 := secondOnLine
  have secondFinishThird : orientation second finish third = 0 :=
    orientation_eq_zero_of_collinear_chain
      second start finish third secondStartFinish thirdOnLine startNeFinish
  by_cases finishEqSecond : finish = second
  · subst second
    exact orientation_eq_zero_of_collinear_chain
      first start finish third firstStartFinish thirdOnLine startNeFinish
  · have finishSecondThird : orientation finish second third = 0 := by
      rw [orientation_swap_start_middle, secondFinishThird, neg_zero]
    exact orientation_eq_zero_of_collinear_chain
      first finish second third firstFinishSecond finishSecondThird finishEqSecond

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- If `witness` is off a nondegenerate line, every pair of distinct points
on that line sees a nonzero turn through `witness`. -/
theorem orientation_ne_zero_of_off_line
    (start finish first second witness : Vec2 R)
    (startNeFinish : start ≠ finish)
    (firstNeSecond : first ≠ second)
    (firstOnLine : orientation start finish first = 0)
    (secondOnLine : orientation start finish second = 0)
    (witnessOffLine : orientation start witness finish ≠ 0) :
    orientation first witness second ≠ 0 := by
  intro firstWitnessSecondZero
  have startFirstSecond : orientation start first second = 0 :=
    common_line_triple_collinear start finish start first second
      startNeFinish (by simp) firstOnLine secondOnLine
  have finishFirstSecond : orientation finish first second = 0 :=
    common_line_triple_collinear start finish finish first second
      startNeFinish (by simp) firstOnLine secondOnLine
  have witnessFirstSecond : orientation witness first second = 0 := by
    rw [orientation_swap_start_middle, firstWitnessSecondZero, neg_zero]
  have firstSecondStart : orientation first second start = 0 := by
    calc
      orientation first second start = orientation start first second := by
        rw [orientation_cycle]
      _ = 0 := startFirstSecond
  have witnessFirstStart : orientation witness first start = 0 :=
    orientation_eq_zero_of_collinear_chain_left
      witness first second start witnessFirstSecond firstSecondStart firstNeSecond
  have firstSecondFinish : orientation first second finish = 0 := by
    calc
      orientation first second finish = orientation finish first second := by
        rw [orientation_cycle]
      _ = 0 := finishFirstSecond
  have witnessFirstFinish : orientation witness first finish = 0 :=
    orientation_eq_zero_of_collinear_chain_left
      witness first second finish witnessFirstSecond firstSecondFinish firstNeSecond
  have firstNeWitness : first ≠ witness := by
    intro equalPoints
    subst witness
    have startFirstFinish : orientation start first finish = 0 := by
      rw [orientation_reverse, firstOnLine, neg_zero]
    exact witnessOffLine startFirstFinish
  have startFirstWitness : orientation start first witness = 0 := by
    have startWitnessFirst : orientation start witness first = 0 := by
      calc
        orientation start witness first = orientation witness first start := by
          exact (orientation_cycle start witness first).symm
        _ = 0 := witnessFirstStart
    rw [orientation_reverse, startWitnessFirst, neg_zero]
  have firstWitnessFinish : orientation first witness finish = 0 := by
    rw [orientation_swap_start_middle, witnessFirstFinish, neg_zero]
  exact witnessOffLine
    (orientation_eq_zero_of_collinear_chain
      start first witness finish startFirstWitness firstWitnessFinish
        firstNeWitness)

/-- A point interpolated between two strict outside points remains strictly
outside because signed distance is affine. -/
theorem signedDistance_pos_of_between_pos
    (plane : HalfPlane R) (start finish point : Vec2 R)
    (startPositive : 0 < signedDistance plane start)
    (finishPositive : 0 < signedDistance plane finish)
    (between : ∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        point = interpolatePoint start finish parameter) :
    0 < signedDistance plane point := by
  rcases between with ⟨parameter, parameterNonnegative, parameterAtMostOne,
    pointEq⟩
  rw [pointEq, signedDistance_interpolatePoint, interpolateDistance]
  have affineForm :
      signedDistance plane start +
          (signedDistance plane finish - signedDistance plane start) * parameter =
        (1 - parameter) * signedDistance plane start +
          parameter * signedDistance plane finish := by ring
  rw [affineForm]
  by_cases parameterZero : parameter = 0
  · simp [parameterZero, startPositive]
  · exact add_pos_of_nonneg_of_pos
      (mul_nonneg (sub_nonneg.mpr parameterAtMostOne)
        (le_of_lt startPositive))
      (mul_pos (lt_of_le_of_ne parameterNonnegative (Ne.symm parameterZero))
        finishPositive)

/-- A point interpolated between two inside-or-boundary points remains in the
closed half-plane. -/
theorem signedDistance_nonpos_of_between_nonpos
    (plane : HalfPlane R) (start finish point : Vec2 R)
    (startNonpositive : signedDistance plane start ≤ 0)
    (finishNonpositive : signedDistance plane finish ≤ 0)
    (between : ∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        point = interpolatePoint start finish parameter) :
    signedDistance plane point ≤ 0 := by
  rcases between with ⟨parameter, parameterNonnegative, parameterAtMostOne,
    pointEq⟩
  rw [pointEq, signedDistance_interpolatePoint, interpolateDistance]
  have affineForm :
      signedDistance plane start +
          (signedDistance plane finish - signedDistance plane start) * parameter =
        (1 - parameter) * signedDistance plane start +
          parameter * signedDistance plane finish := by ring
  rw [affineForm]
  exact add_nonpos
    (mul_nonpos_of_nonneg_of_nonpos
      (sub_nonneg.mpr parameterAtMostOne) startNonpositive)
    (mul_nonpos_of_nonneg_of_nonpos parameterNonnegative finishNonpositive)

/-- Full dimensionality supplies a vertex off every line through two
distinct indexed vertices. -/
theorem exists_off_line_vertex_of_positiveTriple
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex)
    (start finish : RingIndex extraVertices)
    (startNeFinish : start ≠ finish) :
    ∃ witness, orientation (vertex start) (vertex witness) (vertex finish) ≠ 0 := by
  rcases fullDimensional with
    ⟨first, second, third, firstBeforeSecond, secondBeforeThird, positive⟩
  by_contra noWitness
  push Not at noWitness
  have startPointNeFinishPoint : vertex start ≠ vertex finish := by
    intro equalPoints
    exact startNeFinish (injective equalPoints)
  have onLine (index : RingIndex extraVertices) :
      orientation (vertex start) (vertex finish) (vertex index) = 0 := by
    rw [orientation_reverse, noWitness index, neg_zero]
  have tripleZero := common_line_triple_collinear
    (vertex start) (vertex finish) (vertex first) (vertex second) (vertex third)
    startPointNeFinishPoint (onLine first) (onLine second) (onLine third)
  linarith

/-- Four increasing collinear vertices in an injective, full-dimensional weak
polygon cannot form an unconstrained run.  An off-line polygon vertex and the
global order force one of three decisive betweenness relations. -/
theorem collinear_quadruple_has_blocking_betweenness
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (abcZero : orientation (vertex a) (vertex b) (vertex c) = 0)
    (abdZero : orientation (vertex a) (vertex b) (vertex d) = 0)
    (acdZero : orientation (vertex a) (vertex c) (vertex d) = 0) :
    (∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        vertex b = interpolatePoint (vertex a) (vertex c) parameter) ∨
    (∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        vertex c = interpolatePoint (vertex b) (vertex d) parameter) ∨
    (∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        vertex d = interpolatePoint (vertex c) (vertex a) parameter) := by
  have aNeD : a ≠ d := by
    intro equalIndices
    have equalValues := congrArg Fin.val equalIndices
    omega
  have aPointNeDPoint : vertex a ≠ vertex d := by
    intro equalPoints
    exact aNeD (injective equalPoints)
  have aPointNeCPoint : vertex a ≠ vertex c := by
    intro equalPoints
    have equalIndices := injective equalPoints
    have equalValues := congrArg Fin.val equalIndices
    omega
  have dPointNeBPoint : vertex d ≠ vertex b := by
    intro equalPoints
    have equalIndices := injective equalPoints
    have equalValues := congrArg Fin.val equalIndices
    omega
  have adBZero : orientation (vertex a) (vertex d) (vertex b) = 0 := by
    rw [orientation_reverse, abdZero, neg_zero]
  have adCZero : orientation (vertex a) (vertex d) (vertex c) = 0 := by
    rw [orientation_reverse, acdZero, neg_zero]
  rcases exists_off_line_vertex_of_positiveTriple
      vertex injective fullDimensional a d aNeD with
    ⟨witness, witnessOffLine⟩
  have witnessValNeA : witness.val ≠ a.val := by
    intro equalValues
    have equalIndices : witness = a := Fin.ext equalValues
    subst witness
    simp at witnessOffLine
  have witnessValNeB : witness.val ≠ b.val := by
    intro equalValues
    have equalIndices : witness = b := Fin.ext equalValues
    subst witness
    exact witnessOffLine abdZero
  have witnessValNeC : witness.val ≠ c.val := by
    intro equalValues
    have equalIndices : witness = c := Fin.ext equalValues
    subst witness
    exact witnessOffLine acdZero
  by_cases witnessBeforeA : witness.val < a.val
  · left
    have turnNonzero : orientation (vertex c) (vertex witness) (vertex a) ≠ 0 :=
      orientation_ne_zero_of_off_line
        (vertex a) (vertex d) (vertex c) (vertex a) (vertex witness)
        aPointNeDPoint aPointNeCPoint.symm adCZero (by simp) witnessOffLine
    have turnNonnegative :
        0 ≤ orientation (vertex c) (vertex witness) (vertex a) := by
      calc
        0 ≤ orientation (vertex witness) (vertex a) (vertex c) :=
          ordered witness a c witnessBeforeA (lt_trans aBeforeB bBeforeC)
        _ = orientation (vertex c) (vertex witness) (vertex a) :=
          orientation_cycle (vertex c) (vertex witness) (vertex a)
    have turnPositive :
        0 < orientation (vertex c) (vertex witness) (vertex a) :=
      lt_of_le_of_ne turnNonnegative (Ne.symm turnNonzero)
    have collinear : orientation (vertex c) (vertex a) (vertex b) = 0 := by
      calc
        orientation (vertex c) (vertex a) (vertex b) =
            orientation (vertex a) (vertex b) (vertex c) :=
          (orientation_cycle (vertex c) (vertex a) (vertex b)).symm
        _ = 0 := abcZero
    have leftSupport :
        0 ≤ orientation (vertex c) (vertex witness) (vertex b) := by
      calc
        0 ≤ orientation (vertex witness) (vertex b) (vertex c) :=
          ordered witness b c (lt_trans witnessBeforeA aBeforeB) bBeforeC
        _ = orientation (vertex c) (vertex witness) (vertex b) :=
          orientation_cycle (vertex c) (vertex witness) (vertex b)
    have rightSupport :
        0 ≤ orientation (vertex witness) (vertex a) (vertex b) :=
      ordered witness a b witnessBeforeA aBeforeB
    exact collinear_between_of_positive_witness
      (vertex c) (vertex witness) (vertex a) (vertex b)
      turnPositive collinear leftSupport rightSupport
  · have aBeforeWitness : a.val < witness.val := by omega
    by_cases witnessBeforeB : witness.val < b.val
    · right
      left
      have turnNonzero :
          orientation (vertex d) (vertex witness) (vertex b) ≠ 0 :=
        orientation_ne_zero_of_off_line
          (vertex a) (vertex d) (vertex d) (vertex b) (vertex witness)
          aPointNeDPoint dPointNeBPoint (by simp) adBZero witnessOffLine
      have turnNonnegative :
          0 ≤ orientation (vertex d) (vertex witness) (vertex b) := by
        calc
          0 ≤ orientation (vertex witness) (vertex b) (vertex d) :=
            ordered witness b d witnessBeforeB (lt_trans bBeforeC cBeforeD)
          _ = orientation (vertex d) (vertex witness) (vertex b) :=
            orientation_cycle (vertex d) (vertex witness) (vertex b)
      have turnPositive :
          0 < orientation (vertex d) (vertex witness) (vertex b) :=
        lt_of_le_of_ne turnNonnegative (Ne.symm turnNonzero)
      have collinear : orientation (vertex d) (vertex b) (vertex c) = 0 := by
        have bcdZero : orientation (vertex b) (vertex c) (vertex d) = 0 :=
          common_line_triple_collinear
            (vertex a) (vertex d) (vertex b) (vertex c) (vertex d)
            aPointNeDPoint adBZero adCZero (by simp)
        calc
          orientation (vertex d) (vertex b) (vertex c) =
              orientation (vertex b) (vertex c) (vertex d) :=
            (orientation_cycle (vertex d) (vertex b) (vertex c)).symm
          _ = 0 := bcdZero
      have leftSupport :
          0 ≤ orientation (vertex d) (vertex witness) (vertex c) := by
        calc
          0 ≤ orientation (vertex witness) (vertex c) (vertex d) :=
            ordered witness c d (lt_trans witnessBeforeB bBeforeC) cBeforeD
          _ = orientation (vertex d) (vertex witness) (vertex c) :=
            orientation_cycle (vertex d) (vertex witness) (vertex c)
      have rightSupport :
          0 ≤ orientation (vertex witness) (vertex b) (vertex c) :=
        ordered witness b c witnessBeforeB bBeforeC
      exact collinear_between_of_positive_witness
        (vertex d) (vertex witness) (vertex b) (vertex c)
        turnPositive collinear leftSupport rightSupport
    · have bBeforeWitness : b.val < witness.val := by omega
      by_cases witnessBeforeC : witness.val < c.val
      · right
        right
        have turnNonzero :
            orientation (vertex a) (vertex witness) (vertex c) ≠ 0 :=
          orientation_ne_zero_of_off_line
            (vertex a) (vertex d) (vertex a) (vertex c) (vertex witness)
            aPointNeDPoint aPointNeCPoint (by simp) adCZero witnessOffLine
        have turnNonnegative :
            0 ≤ orientation (vertex a) (vertex witness) (vertex c) :=
          ordered a witness c aBeforeWitness witnessBeforeC
        have turnPositive :
            0 < orientation (vertex a) (vertex witness) (vertex c) :=
          lt_of_le_of_ne turnNonnegative (Ne.symm turnNonzero)
        have leftSupport :
            0 ≤ orientation (vertex a) (vertex witness) (vertex d) :=
          ordered a witness d aBeforeWitness
            (lt_trans witnessBeforeC cBeforeD)
        have rightSupport :
            0 ≤ orientation (vertex witness) (vertex c) (vertex d) :=
          ordered witness c d witnessBeforeC cBeforeD
        exact collinear_between_of_positive_witness
          (vertex a) (vertex witness) (vertex c) (vertex d)
          turnPositive acdZero leftSupport rightSupport
      · have cBeforeWitness : c.val < witness.val := by omega
        left
        have turnNonzero :
            orientation (vertex c) (vertex witness) (vertex a) ≠ 0 :=
          orientation_ne_zero_of_off_line
            (vertex a) (vertex d) (vertex c) (vertex a) (vertex witness)
            aPointNeDPoint aPointNeCPoint.symm adCZero (by simp) witnessOffLine
        have turnNonnegative :
            0 ≤ orientation (vertex c) (vertex witness) (vertex a) := by
          calc
            0 ≤ orientation (vertex a) (vertex c) (vertex witness) :=
              ordered a c witness (lt_trans aBeforeB bBeforeC) cBeforeWitness
            _ = orientation (vertex c) (vertex witness) (vertex a) :=
              (orientation_cycle (vertex a) (vertex c) (vertex witness)).symm
        have turnPositive :
            0 < orientation (vertex c) (vertex witness) (vertex a) :=
          lt_of_le_of_ne turnNonnegative (Ne.symm turnNonzero)
        have collinear : orientation (vertex c) (vertex a) (vertex b) = 0 := by
          calc
            orientation (vertex c) (vertex a) (vertex b) =
                orientation (vertex a) (vertex b) (vertex c) :=
              (orientation_cycle (vertex c) (vertex a) (vertex b)).symm
            _ = 0 := abcZero
        have leftSupport :
            0 ≤ orientation (vertex c) (vertex witness) (vertex b) := by
          calc
            0 ≤ orientation (vertex b) (vertex c) (vertex witness) :=
              ordered b c witness bBeforeC cBeforeWitness
            _ = orientation (vertex c) (vertex witness) (vertex b) :=
              (orientation_cycle (vertex b) (vertex c) (vertex witness)).symm
        have rightSupport :
            0 ≤ orientation (vertex witness) (vertex a) (vertex b) := by
          calc
            0 ≤ orientation (vertex a) (vertex b) (vertex witness) :=
              ordered a b witness aBeforeB
                (lt_trans bBeforeC cBeforeWitness)
            _ = orientation (vertex witness) (vertex a) (vertex b) :=
              orientation_cycle (vertex witness) (vertex a) (vertex b)
        exact collinear_between_of_positive_witness
          (vertex c) (vertex witness) (vertex a) (vertex b)
          turnPositive collinear leftSupport rightSupport

/-- Under weak global order, an outside/inside/outside/inside alternation can
survive the affine four-point circuit only when all four selected vertices
are collinear.  This isolates the sole case that the former strict proof did
not have to handle. -/
theorem outside_inside_outside_inside_forces_collinear
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (aOutside : 0 < signedDistance plane (vertex a))
    (bInside : signedDistance plane (vertex b) ≤ 0)
    (cOutside : 0 < signedDistance plane (vertex c))
    (dInside : signedDistance plane (vertex d) ≤ 0) :
    orientation (vertex a) (vertex b) (vertex c) = 0 ∧
      orientation (vertex a) (vertex b) (vertex d) = 0 ∧
      orientation (vertex a) (vertex c) (vertex d) = 0 ∧
      orientation (vertex b) (vertex c) (vertex d) = 0 := by
  have bcdNonnegative : 0 ≤ orientation (vertex b) (vertex c) (vertex d) :=
    ordered b c d bBeforeC cBeforeD
  have abdNonnegative : 0 ≤ orientation (vertex a) (vertex b) (vertex d) :=
    ordered a b d aBeforeB (lt_trans bBeforeC cBeforeD)
  have acdNonnegative : 0 ≤ orientation (vertex a) (vertex c) (vertex d) :=
    ordered a c d (lt_trans aBeforeB bBeforeC) cBeforeD
  have abcNonnegative : 0 ≤ orientation (vertex a) (vertex b) (vertex c) :=
    ordered a b c aBeforeB bBeforeC
  have circuit := signedDistance_four_point_circuit
    plane (vertex a) (vertex b) (vertex c) (vertex d)
  have bcdZero : orientation (vertex b) (vertex c) (vertex d) = 0 := by
    apply le_antisymm
    · apply le_of_not_gt
      intro bcdPositive
      have leftFirst : 0 < orientation (vertex b) (vertex c) (vertex d) *
          signedDistance plane (vertex a) := mul_pos bcdPositive aOutside
      have leftSecond : 0 ≤ orientation (vertex a) (vertex b) (vertex d) *
          signedDistance plane (vertex c) :=
        mul_nonneg abdNonnegative (le_of_lt cOutside)
      have rightFirst : orientation (vertex a) (vertex c) (vertex d) *
          signedDistance plane (vertex b) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos acdNonnegative bInside
      have rightSecond : orientation (vertex a) (vertex b) (vertex c) *
          signedDistance plane (vertex d) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos abcNonnegative dInside
      linarith
    · exact bcdNonnegative
  have abdZero : orientation (vertex a) (vertex b) (vertex d) = 0 := by
    apply le_antisymm
    · apply le_of_not_gt
      intro abdPositive
      have leftFirst : 0 ≤ orientation (vertex b) (vertex c) (vertex d) *
          signedDistance plane (vertex a) :=
        mul_nonneg bcdNonnegative (le_of_lt aOutside)
      have leftSecond : 0 < orientation (vertex a) (vertex b) (vertex d) *
          signedDistance plane (vertex c) := mul_pos abdPositive cOutside
      have rightFirst : orientation (vertex a) (vertex c) (vertex d) *
          signedDistance plane (vertex b) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos acdNonnegative bInside
      have rightSecond : orientation (vertex a) (vertex b) (vertex c) *
          signedDistance plane (vertex d) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos abcNonnegative dInside
      linarith
    · exact abdNonnegative
  have bNeD : vertex b ≠ vertex d := by
    intro equalPoints
    have equalIndices := injective equalPoints
    have equalValues := congrArg Fin.val equalIndices
    omega
  have bdcZero : orientation (vertex b) (vertex d) (vertex c) = 0 := by
    rw [orientation_swap_start_middle, orientation_cycle, orientation_cycle,
      bcdZero, neg_zero]
  have abcZero : orientation (vertex a) (vertex b) (vertex c) = 0 :=
    orientation_eq_zero_of_collinear_chain_left
      (vertex a) (vertex b) (vertex d) (vertex c)
      abdZero bdcZero bNeD
  have adcZero : orientation (vertex a) (vertex d) (vertex c) = 0 :=
    orientation_eq_zero_of_collinear_chain
      (vertex a) (vertex b) (vertex d) (vertex c)
      abdZero bdcZero bNeD
  have acdZero : orientation (vertex a) (vertex c) (vertex d) = 0 := by
    rw [orientation_swap_start_middle, orientation_cycle, orientation_cycle,
      adcZero, neg_zero]
  exact ⟨abcZero, abdZero, acdZero, bcdZero⟩

/-- The complementary alternating pattern has the same collinear-only
residual. -/
theorem inside_outside_inside_outside_forces_collinear
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (aInside : signedDistance plane (vertex a) ≤ 0)
    (bOutside : 0 < signedDistance plane (vertex b))
    (cInside : signedDistance plane (vertex c) ≤ 0)
    (dOutside : 0 < signedDistance plane (vertex d)) :
    orientation (vertex a) (vertex b) (vertex c) = 0 ∧
      orientation (vertex a) (vertex b) (vertex d) = 0 ∧
      orientation (vertex a) (vertex c) (vertex d) = 0 ∧
      orientation (vertex b) (vertex c) (vertex d) = 0 := by
  have bcdNonnegative : 0 ≤ orientation (vertex b) (vertex c) (vertex d) :=
    ordered b c d bBeforeC cBeforeD
  have abdNonnegative : 0 ≤ orientation (vertex a) (vertex b) (vertex d) :=
    ordered a b d aBeforeB (lt_trans bBeforeC cBeforeD)
  have acdNonnegative : 0 ≤ orientation (vertex a) (vertex c) (vertex d) :=
    ordered a c d (lt_trans aBeforeB bBeforeC) cBeforeD
  have abcNonnegative : 0 ≤ orientation (vertex a) (vertex b) (vertex c) :=
    ordered a b c aBeforeB bBeforeC
  have circuit := signedDistance_four_point_circuit
    plane (vertex a) (vertex b) (vertex c) (vertex d)
  have acdZero : orientation (vertex a) (vertex c) (vertex d) = 0 := by
    apply le_antisymm
    · apply le_of_not_gt
      intro acdPositive
      have leftFirst : orientation (vertex b) (vertex c) (vertex d) *
          signedDistance plane (vertex a) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos bcdNonnegative aInside
      have leftSecond : orientation (vertex a) (vertex b) (vertex d) *
          signedDistance plane (vertex c) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos abdNonnegative cInside
      have rightFirst : 0 < orientation (vertex a) (vertex c) (vertex d) *
          signedDistance plane (vertex b) := mul_pos acdPositive bOutside
      have rightSecond : 0 ≤ orientation (vertex a) (vertex b) (vertex c) *
          signedDistance plane (vertex d) :=
        mul_nonneg abcNonnegative (le_of_lt dOutside)
      linarith
    · exact acdNonnegative
  have abcZero : orientation (vertex a) (vertex b) (vertex c) = 0 := by
    apply le_antisymm
    · apply le_of_not_gt
      intro abcPositive
      have leftFirst : orientation (vertex b) (vertex c) (vertex d) *
          signedDistance plane (vertex a) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos bcdNonnegative aInside
      have leftSecond : orientation (vertex a) (vertex b) (vertex d) *
          signedDistance plane (vertex c) ≤ 0 :=
        mul_nonpos_of_nonneg_of_nonpos abdNonnegative cInside
      have rightFirst : 0 ≤ orientation (vertex a) (vertex c) (vertex d) *
          signedDistance plane (vertex b) :=
        mul_nonneg acdNonnegative (le_of_lt bOutside)
      have rightSecond : 0 < orientation (vertex a) (vertex b) (vertex c) *
          signedDistance plane (vertex d) := mul_pos abcPositive dOutside
      linarith
    · exact abcNonnegative
  have aNeC : vertex a ≠ vertex c := by
    intro equalPoints
    have equalIndices := injective equalPoints
    have equalValues := congrArg Fin.val equalIndices
    omega
  have bacZero : orientation (vertex b) (vertex a) (vertex c) = 0 := by
    rw [orientation_swap_start_middle, abcZero, neg_zero]
  have bcdZero : orientation (vertex b) (vertex c) (vertex d) = 0 :=
    orientation_eq_zero_of_collinear_chain
      (vertex b) (vertex a) (vertex c) (vertex d)
      bacZero acdZero aNeC
  have badZero : orientation (vertex b) (vertex a) (vertex d) = 0 :=
    orientation_eq_zero_of_collinear_chain_left
      (vertex b) (vertex a) (vertex c) (vertex d)
      bacZero acdZero aNeC
  have abdZero : orientation (vertex a) (vertex b) (vertex d) = 0 := by
    rw [orientation_swap_start_middle, badZero, neg_zero]
  exact ⟨abcZero, abdZero, acdZero, bcdZero⟩

/-- Injectivity and full dimensionality eliminate the collinear residual from
the weak outside/inside/outside/inside circuit proof. -/
theorem not_outside_inside_outside_inside_of_weak_fullDimensional
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (aOutside : 0 < signedDistance plane (vertex a))
    (bInside : signedDistance plane (vertex b) ≤ 0)
    (cOutside : 0 < signedDistance plane (vertex c))
    (dInside : signedDistance plane (vertex d) ≤ 0) : False := by
  rcases outside_inside_outside_inside_forces_collinear
      plane vertex ordered injective a b c d aBeforeB bBeforeC cBeforeD
      aOutside bInside cOutside dInside with
    ⟨abcZero, abdZero, acdZero, _⟩
  rcases collinear_quadruple_has_blocking_betweenness
      vertex ordered injective fullDimensional a b c d
      aBeforeB bBeforeC cBeforeD abcZero abdZero acdZero with
    bBetween | cBetween | dBetween
  · have bOutside := signedDistance_pos_of_between_pos
      plane (vertex a) (vertex c) (vertex b) aOutside cOutside bBetween
    linarith
  · have cInside := signedDistance_nonpos_of_between_nonpos
      plane (vertex b) (vertex d) (vertex c) bInside dInside cBetween
    linarith
  · have dOutside := signedDistance_pos_of_between_pos
      plane (vertex c) (vertex a) (vertex d) cOutside aOutside dBetween
    linarith

/-- The complementary alternating pattern is likewise impossible once the
weak representation is injective and full-dimensional. -/
theorem not_inside_outside_inside_outside_of_weak_fullDimensional
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex)
    (a b c d : RingIndex extraVertices)
    (aBeforeB : a.val < b.val)
    (bBeforeC : b.val < c.val)
    (cBeforeD : c.val < d.val)
    (aInside : signedDistance plane (vertex a) ≤ 0)
    (bOutside : 0 < signedDistance plane (vertex b))
    (cInside : signedDistance plane (vertex c) ≤ 0)
    (dOutside : 0 < signedDistance plane (vertex d)) : False := by
  rcases inside_outside_inside_outside_forces_collinear
      plane vertex ordered injective a b c d aBeforeB bBeforeC cBeforeD
      aInside bOutside cInside dOutside with
    ⟨abcZero, abdZero, acdZero, _⟩
  rcases collinear_quadruple_has_blocking_betweenness
      vertex ordered injective fullDimensional a b c d
      aBeforeB bBeforeC cBeforeD abcZero abdZero acdZero with
    bBetween | cBetween | dBetween
  · have bInside := signedDistance_nonpos_of_between_nonpos
      plane (vertex a) (vertex c) (vertex b) aInside cInside bBetween
    linarith
  · have cOutside := signedDistance_pos_of_between_pos
      plane (vertex b) (vertex d) (vertex c) bOutside dOutside cBetween
    linarith
  · have dInside := signedDistance_nonpos_of_between_nonpos
      plane (vertex c) (vertex a) (vertex d) cInside aInside dBetween
    linarith

/-- For an injective, full-dimensional weakly ordered polygon, either outside
or inside vertices form one interval in the chosen linear materialization. -/
theorem outside_or_inside_linear_interval_of_weak_fullDimensional
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex)
    (hasOutside : ∃ index, 0 < signedDistance plane (vertex index))
    (hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0) :
    IsLinearInterval (fun index => 0 < signedDistance plane (vertex index)) ∨
      IsLinearInterval (fun index => signedDistance plane (vertex index) ≤ 0) := by
  have blocks := linearInterval_or_complement_of_no_alternation
    (fun index => 0 < signedDistance plane (vertex index)) hasOutside
    (by simpa only [not_lt] using hasInside)
    (by
      intro a b c d aBeforeB bBeforeC cBeforeD alternating
      exact not_outside_inside_outside_inside_of_weak_fullDimensional
        plane vertex ordered injective fullDimensional
        a b c d aBeforeB bBeforeC cBeforeD
        alternating.1 (le_of_not_gt alternating.2.1)
        alternating.2.2.1 (le_of_not_gt alternating.2.2.2))
    (by
      intro a b c d aBeforeB bBeforeC cBeforeD alternating
      exact not_inside_outside_inside_outside_of_weak_fullDimensional
        plane vertex ordered injective fullDimensional
        a b c d aBeforeB bBeforeC cBeforeD
        (le_of_not_gt alternating.1) alternating.2.1
        (le_of_not_gt alternating.2.2.1) alternating.2.2.2)
  rcases blocks with outsideInterval | insideInterval
  · exact Or.inl outsideInterval
  · right
    rcases insideInterval with ⟨first, last, interval⟩
    exact ⟨first, last, fun index => by
      simpa only [not_lt] using interval index⟩

/-- The outside vertices of every mixed half-plane form one cyclic block for
an injective, full-dimensional weakly ordered polygon. -/
theorem outside_rotatedBlock_of_weak_fullDimensional
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (fullDimensional : HasPositiveTriple vertex)
    (hasOutside : ∃ index, 0 < signedDistance plane (vertex index))
    (hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0) :
    IsRotatedBlock (fun index => 0 < signedDistance plane (vertex index)) := by
  apply rotatedBlock_of_linearInterval_or_complement
  · exact hasOutside
  · simpa only [not_lt] using hasInside
  · have intervals := outside_or_inside_linear_interval_of_weak_fullDimensional
      plane vertex ordered injective fullDimensional hasOutside hasInside
    rcases intervals with outsideInterval | insideInterval
    · exact Or.inl outsideInterval
    · exact Or.inr ⟨insideInterval.choose, insideInterval.choose_spec.choose,
        fun index => by
          simpa only [not_lt] using
            insideInterval.choose_spec.choose_spec index⟩

end Sprawlens.WeakConvexHalfPlaneSigns
