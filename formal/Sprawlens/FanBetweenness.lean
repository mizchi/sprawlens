import Sprawlens.RedundantVertexSemantics

namespace Sprawlens.FanBetweenness

open CanonicalClip
open ConvexClipContract
open ExactGeometry
open HalfPlaneIntersection
open PolygonSupportSemantics
open RedundantVertexSemantics
open SimpleRing
open TriangleSupportSemantics
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A collinear point lies between the endpoints when an off-line witness sees
both subtriangles with nonnegative orientation. The interpolation parameter is
the corresponding oriented-area ratio. -/
theorem collinear_between_of_positive_witness
    (start witness finish point : Vec2 R)
    (witnessPositive : 0 < orientation start witness finish)
    (collinear : orientation start finish point = 0)
    (leftSupport : 0 ≤ orientation start witness point)
    (rightSupport : 0 ≤ orientation witness finish point) :
    ∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        point = interpolatePoint finish start parameter := by
  let area := orientation start witness finish
  let parameter := orientation witness finish point / area
  have areaPositive : 0 < area := witnessPositive
  have areaNonzero : area ≠ 0 := ne_of_gt witnessPositive
  have reverseCollinear : orientation finish start point = 0 := by
    rw [orientation_swap_start_middle, collinear, neg_zero]
  have areaSplit :
      orientation witness finish point + orientation start witness point =
        area := by
    have decomposition :=
      orientation_triangle_decomposition start witness finish point
    rw [reverseCollinear, add_zero] at decomposition
    simpa [area, add_comm, add_left_comm, add_assoc] using decomposition
  have parameterNonnegative : 0 ≤ parameter := by
    exact div_nonneg rightSupport (le_of_lt witnessPositive)
  have parameterAtMostOne : parameter ≤ 1 := by
    apply (div_le_one areaPositive).2
    linarith [areaSplit]
  have remainingWeight :
      orientation start witness point / area = 1 - parameter := by
    dsimp [parameter]
    field_simp [areaNonzero]
    linarith [areaSplit]
  have reconstruct := orientation_barycentric_reconstruct
    start witness finish point areaNonzero
  refine ⟨parameter, parameterNonnegative, parameterAtMostOne, ?_⟩
  rw [← affineCombination_eq_interpolatePoint
    finish start (1 - parameter) parameter (by ring)]
  simpa [area, reverseCollinear, remainingWeight, add_comm] using reconstruct.symm

/-- In a weakly ordered polygon, a zero-area last fan cell is a closing-edge
subdivision whenever an earlier vertex provides a positive off-line witness. -/
theorem last_on_closingSegment_of_ordered_of_positive_witness
    {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (witness : RingIndex (extraVertices + 1))
    (witnessAfterFirst : 0 < witness.val)
    (witnessBeforePenultimate : witness.val < extraVertices + 2)
    (witnessPositive :
      0 < orientation (vertex ⟨0, by omega⟩) (vertex witness)
        (vertex ⟨extraVertices + 2, by omega⟩))
    (lastCollinear :
      orientation (vertex ⟨0, by omega⟩)
        (vertex ⟨extraVertices + 2, by omega⟩)
        (vertex ⟨extraVertices + 3, by omega⟩) = 0) :
    ∃ parameter : R,
      0 ≤ parameter ∧ parameter ≤ 1 ∧
        vertex ⟨extraVertices + 3, by omega⟩ =
          interpolatePoint
            (vertex ⟨extraVertices + 2, by omega⟩)
            (vertex ⟨0, by omega⟩) parameter := by
  let first : RingIndex (extraVertices + 1) := ⟨0, by omega⟩
  let penultimate : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 2, by omega⟩
  let last : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 3, by omega⟩
  have firstWitnessLast :
      0 ≤ orientation (vertex first) (vertex witness) (vertex last) := by
    exact ordered first witness last
      (by simpa [first] using witnessAfterFirst)
      (by simp [last]; omega)
  have witnessPenultimateLast :
      0 ≤ orientation (vertex witness) (vertex penultimate) (vertex last) := by
    exact ordered witness penultimate last
      (by simpa [penultimate] using witnessBeforePenultimate)
      (by simp [penultimate, last])
  exact collinear_between_of_positive_witness
    (vertex first) (vertex witness) (vertex penultimate) (vertex last)
    (by simpa [first, penultimate] using witnessPositive)
    (by simpa [first, penultimate, last] using lastCollinear)
    firstWitnessLast witnessPenultimateLast

/-- A positive witness for the penultimate prefix propagates to the last
prefix. If both obvious candidate orientations vanish, betweenness forces the
last vertex to equal vertex zero, which injectivity excludes. -/
theorem positive_witness_propagates_to_last
    {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (witness : RingIndex (extraVertices + 1))
    (witnessAfterFirst : 0 < witness.val)
    (witnessBeforePenultimate : witness.val < extraVertices + 2)
    (witnessPositive :
      0 < orientation (vertex ⟨0, by omega⟩) (vertex witness)
        (vertex ⟨extraVertices + 2, by omega⟩)) :
    ∃ nextWitness : RingIndex (extraVertices + 1),
      0 < nextWitness.val ∧ nextWitness.val < extraVertices + 3 ∧
        0 < orientation (vertex ⟨0, by omega⟩) (vertex nextWitness)
          (vertex ⟨extraVertices + 3, by omega⟩) := by
  let first : RingIndex (extraVertices + 1) := ⟨0, by omega⟩
  let penultimate : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 2, by omega⟩
  let last : RingIndex (extraVertices + 1) :=
    ⟨extraVertices + 3, by omega⟩
  have witnessLastNonnegative :
      0 ≤ orientation (vertex first) (vertex witness) (vertex last) := by
    exact ordered first witness last
      (by simpa [first] using witnessAfterFirst) (by simp [last]; omega)
  rcases lt_or_eq_of_le witnessLastNonnegative with
      witnessLastPositive | witnessLastZero
  · exact ⟨witness, witnessAfterFirst, by omega,
      by simpa [first, last] using witnessLastPositive⟩
  · have fanNonnegative :
        0 ≤ orientation (vertex first) (vertex penultimate) (vertex last) := by
      exact ordered first penultimate last
        (by simp [first, penultimate]) (by simp [penultimate, last])
    rcases lt_or_eq_of_le fanNonnegative with fanPositive | fanZero
    · exact ⟨penultimate, by simp [penultimate], by simp [penultimate],
        by simpa [first, penultimate, last] using fanPositive⟩
    · exfalso
      rcases last_on_closingSegment_of_ordered_of_positive_witness
          vertex ordered witness witnessAfterFirst witnessBeforePenultimate
          witnessPositive
          (by simpa [first, penultimate, last] using fanZero.symm) with
        ⟨parameter, parameterNonnegative, parameterAtMostOne, lastInterpolation⟩
      have witnessLastScale :
          orientation (vertex first) (vertex witness) (vertex last) =
            (1 - parameter) *
              orientation (vertex first) (vertex witness) (vertex penultimate) := by
        rw [show vertex last = interpolatePoint
          (vertex penultimate) (vertex first) parameter by
            simpa [first, penultimate, last] using lastInterpolation]
        rw [orientation_interpolate_third]
        simp [orientation]
      have parameterEqOne : parameter = 1 := by
        have witnessLastEqZero :
            orientation (vertex first) (vertex witness) (vertex last) = 0 :=
          witnessLastZero.symm
        rw [witnessLastScale] at witnessLastEqZero
        have sourcePositive :
            0 < orientation (vertex first) (vertex witness)
              (vertex penultimate) := by
          simpa [first, penultimate] using witnessPositive
        nlinarith
      have verticesEqual : vertex last = vertex first := by
        rw [show vertex last = interpolatePoint
          (vertex penultimate) (vertex first) parameter by
            simpa [first, penultimate, last] using lastInterpolation]
        rw [parameterEqOne]
        simp [interpolatePoint]
      have indicesEqual := injective verticesEqual
      have valuesEqual := congrArg Fin.val indicesEqual
      simp [first, last] at valuesEqual

/-- Recursive fan data in which every zero-area cell carries an earlier
off-line witness. The witness inequalities needed for betweenness are supplied
by global weak order rather than duplicated in the certificate. -/
def HasWitnessedFan : {extraVertices : Nat} →
    (RingIndex extraVertices → Vec2 R) → Prop
  | 0, vertex =>
      0 < orientation (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
        (vertex ⟨2, by omega⟩)
  | extraVertices + 1, vertex =>
      HasWitnessedFan (prefixVertex vertex) ∧
        (0 < orientation (vertex ⟨0, by omega⟩)
            (vertex ⟨extraVertices + 2, by omega⟩)
            (vertex ⟨extraVertices + 3, by omega⟩) ∨
          orientation (vertex ⟨0, by omega⟩)
              (vertex ⟨extraVertices + 2, by omega⟩)
              (vertex ⟨extraVertices + 3, by omega⟩) = 0 ∧
            ∃ witness : RingIndex (extraVertices + 1),
              0 < witness.val ∧ witness.val < extraVertices + 2 ∧
                0 < orientation (vertex ⟨0, by omega⟩) (vertex witness)
                  (vertex ⟨extraVertices + 2, by omega⟩))

/-- Under weak global order, witnessed zero-area cells can be converted to
explicit closing-edge subdivisions. -/
theorem witnessedFan_hasReducibleFan {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (fan : HasWitnessedFan vertex) :
    HasReducibleFan vertex := by
  induction extraVertices with
  | zero =>
      simpa [HasWitnessedFan, HasReducibleFan] using fan
  | succ remaining inductionHypothesis =>
      constructor
      · exact inductionHypothesis (prefixVertex vertex)
          (prefixVertex_ordered vertex ordered) fan.1
      · rcases fan.2 with positive | witnessedZero
        · exact Or.inl positive
        · rcases witnessedZero with
            ⟨lastCollinear, witness, witnessAfterFirst,
              witnessBeforePenultimate, witnessPositive⟩
          exact Or.inr
            (last_on_closingSegment_of_ordered_of_positive_witness
              vertex ordered witness witnessAfterFirst witnessBeforePenultimate
              witnessPositive lastCollinear)

/-- A witnessed fan is therefore sufficient for exact support semantics. -/
theorem witnessedFan_supportSemanticsAdequate {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (fan : HasWitnessedFan vertex) :
    SupportSemanticsAdequate vertex := by
  exact reducibleFan_supportSemanticsAdequate vertex ordered
    (witnessedFan_hasReducibleFan vertex ordered fan)

/-- Every prefix endpoint from index two onward has an earlier off-line
witness relative to vertex zero. This is a seam-sensitive, constructive form
of full-dimensionality suitable for fan induction. -/
def HasPositivePrefixWitness {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) : Prop :=
  ∀ endpoint : RingIndex extraVertices, 2 ≤ endpoint.val →
    ∃ witness : RingIndex extraVertices,
      0 < witness.val ∧ witness.val < endpoint.val ∧
        0 < orientation (vertex ⟨0, by omega⟩) (vertex witness)
          (vertex endpoint)

/-- An injective weakly ordered sequence with a positive initial triangle has
a positive off-line witness for every later prefix endpoint. -/
theorem positivePrefixWitness_of_ordered_of_injective_of_initial
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (initialPositive :
      0 < orientation (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
        (vertex ⟨2, by omega⟩)) :
    HasPositivePrefixWitness vertex := by
  induction extraVertices with
  | zero =>
      intro endpoint endpointAtLeastTwo
      have endpointEq : endpoint = (⟨2, by omega⟩ : RingIndex 0) := by
        apply Fin.ext
        have endpointValue : endpoint.val = 2 := by omega
        simpa using endpointValue
      rw [endpointEq]
      exact ⟨⟨1, by omega⟩, by simp, by simp, initialPositive⟩
  | succ remaining inductionHypothesis =>
      have prefixOrdered : IsLinearlyOrderedCCW (prefixVertex vertex) :=
        prefixVertex_ordered vertex ordered
      have prefixInjective : Function.Injective (prefixVertex vertex) := by
        intro left right pointsEqual
        apply Fin.ext
        have embeddedEqual :
            (⟨left.val, by omega⟩ : RingIndex (remaining + 1)) =
              ⟨right.val, by omega⟩ :=
          injective pointsEqual
        exact congrArg
          (fun index : RingIndex (remaining + 1) => index.val) embeddedEqual
      have prefixInitialPositive :
          0 < orientation
            (prefixVertex vertex ⟨0, by omega⟩)
            (prefixVertex vertex ⟨1, by omega⟩)
            (prefixVertex vertex ⟨2, by omega⟩) := by
        simpa [prefixVertex] using initialPositive
      have prefixWitnessed :
          HasPositivePrefixWitness (prefixVertex vertex) :=
        inductionHypothesis (prefixVertex vertex) prefixOrdered prefixInjective
          prefixInitialPositive
      intro endpoint endpointAtLeastTwo
      by_cases endpointBeforeLast : endpoint.val < remaining + 3
      · let prefixEndpoint : RingIndex remaining :=
          ⟨endpoint.val, endpointBeforeLast⟩
        rcases prefixWitnessed prefixEndpoint endpointAtLeastTwo with
          ⟨prefixWitness, witnessAfterFirst, witnessBeforeEndpoint,
            witnessPositive⟩
        refine ⟨⟨prefixWitness.val, by omega⟩, witnessAfterFirst,
          witnessBeforeEndpoint, ?_⟩
        simpa [prefixEndpoint, prefixVertex] using witnessPositive
      · have endpointEq :
            endpoint =
              (⟨remaining + 3, by omega⟩ : RingIndex (remaining + 1)) := by
          apply Fin.ext
          have endpointBound := endpoint.isLt
          have endpointValue : endpoint.val = remaining + 3 := by omega
          simpa using endpointValue
        let prefixLast : RingIndex remaining := ⟨remaining + 2, by omega⟩
        rcases prefixWitnessed prefixLast (by simp [prefixLast]) with
          ⟨prefixWitness, witnessAfterFirst, witnessBeforePrefixLast,
            witnessPositive⟩
        have propagated := positive_witness_propagates_to_last
          vertex ordered injective
          (⟨prefixWitness.val, by omega⟩ : RingIndex (remaining + 1))
          witnessAfterFirst
          (by simpa [prefixLast] using witnessBeforePrefixLast)
          (by simpa [prefixVertex, prefixLast] using witnessPositive)
        rw [endpointEq]
        exact propagated

omit [IsStrictOrderedRing R] in
/-- Positive-prefix witnesses are inherited when the last vertex is removed. -/
theorem positivePrefixWitness_prefix {extraVertices : Nat}
    (vertex : RingIndex (extraVertices + 1) → Vec2 R)
    (witnessed : HasPositivePrefixWitness vertex) :
    HasPositivePrefixWitness (prefixVertex vertex) := by
  intro endpoint endpointAtLeastTwo
  rcases witnessed
      (⟨endpoint.val, by omega⟩ : RingIndex (extraVertices + 1))
      endpointAtLeastTwo with
    ⟨witness, witnessAfterFirst, witnessBeforeEndpoint, witnessPositive⟩
  refine ⟨⟨witness.val, by omega⟩, witnessAfterFirst,
    witnessBeforeEndpoint, ?_⟩
  simpa [prefixVertex] using witnessPositive

omit [IsStrictOrderedRing R] in
/-- Weak order classifies every fan cell as either positive or a witnessed
zero-area cell when all prefixes carry an off-line witness. -/
theorem positivePrefixWitness_hasWitnessedFan {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (witnessed : HasPositivePrefixWitness vertex) :
    HasWitnessedFan vertex := by
  induction extraVertices with
  | zero =>
      let first : RingIndex 0 := ⟨0, by omega⟩
      let second : RingIndex 0 := ⟨1, by omega⟩
      let third : RingIndex 0 := ⟨2, by omega⟩
      rcases witnessed third (by simp [third]) with
        ⟨witness, witnessAfterFirst, witnessBeforeThird, witnessPositive⟩
      have witnessEq : witness = second := by
        apply Fin.ext
        simp [second]
        omega
      rw [witnessEq] at witnessPositive
      simpa [HasWitnessedFan, first, second, third] using witnessPositive
  | succ remaining inductionHypothesis =>
      let first : RingIndex (remaining + 1) := ⟨0, by omega⟩
      let penultimate : RingIndex (remaining + 1) :=
        ⟨remaining + 2, by omega⟩
      let last : RingIndex (remaining + 1) :=
        ⟨remaining + 3, by omega⟩
      constructor
      · exact inductionHypothesis (prefixVertex vertex)
          (prefixVertex_ordered vertex ordered)
          (positivePrefixWitness_prefix vertex witnessed)
      · have lastNonnegative :
            0 ≤ orientation (vertex first) (vertex penultimate) (vertex last) :=
          ordered first penultimate last
            (by simp [first, penultimate]) (by simp [penultimate, last])
        rcases lt_or_eq_of_le lastNonnegative with lastPositive | lastZero
        · exact Or.inl
            (by simpa [first, penultimate, last] using lastPositive)
        · rcases witnessed penultimate (by simp [penultimate]) with
            ⟨witness, witnessAfterFirst, witnessBeforePenultimate,
              witnessPositive⟩
          exact Or.inr ⟨
            by simpa [first, penultimate, last] using lastZero.symm,
            witness, witnessAfterFirst,
            by simpa [penultimate] using witnessBeforePenultimate,
            by simpa [first, penultimate] using witnessPositive⟩

/-- Weak global order plus constructive full-dimensionality at every prefix is
sufficient for exact support semantics. -/
theorem positivePrefixWitness_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (witnessed : HasPositivePrefixWitness vertex) :
    SupportSemanticsAdequate vertex := by
  exact witnessedFan_supportSemanticsAdequate vertex ordered
    (positivePrefixWitness_hasWitnessedFan vertex ordered witnessed)

/-- A seam whose first triangle is positive is sufficient under weak global
order and vertex injectivity; all later zero-area fan cells are proved
redundant rather than excluded. -/
theorem orderedInjectiveInitial_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (injective : Function.Injective vertex)
    (initialPositive :
      0 < orientation (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
        (vertex ⟨2, by omega⟩)) :
    SupportSemanticsAdequate vertex := by
  exact positivePrefixWitness_supportSemanticsAdequate vertex ordered
    (positivePrefixWitness_of_ordered_of_injective_of_initial
      vertex ordered injective initialPositive)

/-- The same result can use the project's topological simplicity contract,
which supplies vertex injectivity. -/
theorem orderedSimpleInitial_supportSemanticsAdequate
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsLinearlyOrderedCCW vertex)
    (simple : IsSimpleRing vertex)
    (initialPositive :
      0 < orientation (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
        (vertex ⟨2, by omega⟩)) :
    SupportSemanticsAdequate vertex := by
  exact orderedInjectiveInitial_supportSemanticsAdequate vertex ordered
    (simpleRing_vertices_injective simple) initialPositive

end Sprawlens.FanBetweenness
