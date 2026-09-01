import Mathlib.Data.List.MinMax
import Sprawlens.AffineDimensionClassification

namespace Sprawlens.CollinearExtrema

open AffineDimensionClassification
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open SimpleRing
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Affine coordinate of a point on the line through two distinct points.
The x coordinate is preferred unless the line is vertical. -/
def lineParameter (start finish point : Vec2 R) : R :=
  if finish.x = start.x then
    (point.y - start.y) / (finish.y - start.y)
  else
    (point.x - start.x) / (finish.x - start.x)

/-- A zero determinant against two distinct base points reconstructs the
point exactly from its one-dimensional affine coordinate. -/
theorem interpolatePoint_lineParameter
    (start finish point : Vec2 R) (distinct : start ≠ finish)
    (collinear : orientation start finish point = 0) :
    interpolatePoint start finish (lineParameter start finish point) = point := by
  rcases start with ⟨startX, startY⟩
  rcases finish with ⟨finishX, finishY⟩
  rcases point with ⟨pointX, pointY⟩
  simp only [orientation] at collinear
  by_cases vertical : finishX = startX
  · have yDistinct : finishY ≠ startY := by
      intro yEqual
      apply distinct
      simp_all
    have pointXEq : pointX = startX := by
      rw [vertical] at collinear
      simp only [sub_self, zero_mul, zero_sub] at collinear
      have productZero :
          (finishY - startY) * (pointX - startX) = 0 := by
        exact neg_eq_zero.mp collinear
      exact sub_eq_zero.mp
        ((mul_eq_zero.mp productZero).resolve_left
          (sub_ne_zero.mpr yDistinct))
    simp only [lineParameter, vertical, if_pos, interpolatePoint]
    congr
    · rw [pointXEq]
      ring
    ·
      field_simp [sub_ne_zero.mpr yDistinct]
      ring
  · have xDistinct : finishX ≠ startX := vertical
    have pointYEq : pointY = startY +
        (finishY - startY) *
          ((pointX - startX) / (finishX - startX)) := by
      field_simp [sub_ne_zero.mpr xDistinct]
      linarith
    simp only [lineParameter, vertical, if_false, interpolatePoint]
    congr
    ·
      field_simp [sub_ne_zero.mpr xDistinct]
      ring
    · exact pointYEq.symm

omit [IsStrictOrderedRing R] in
theorem lineParameter_start
    (start finish : Vec2 R) (_distinct : start ≠ finish) :
    lineParameter start finish start = 0 := by
  by_cases vertical : finish.x = start.x
  · simp [lineParameter, vertical]
  · simp [lineParameter, vertical]

omit [IsStrictOrderedRing R] in
theorem lineParameter_finish
    (start finish : Vec2 R) (distinct : start ≠ finish) :
    lineParameter start finish finish = 1 := by
  by_cases vertical : finish.x = start.x
  · have yDistinct : finish.y ≠ start.y := by
      intro yEqual
      apply distinct
      cases start
      cases finish
      simp_all
    simp [lineParameter, vertical, sub_ne_zero.mpr yDistinct]
  · simp [lineParameter, vertical, sub_ne_zero.mpr vertical]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Reparameterization between two points already represented on the same
affine line. -/
theorem interpolatePoint_between_parameters
    (start finish : Vec2 R) (lower upper localParameter : R) :
    interpolatePoint
        (interpolatePoint start finish lower)
        (interpolatePoint start finish upper) localParameter =
      interpolatePoint start finish
        (lower + (upper - lower) * localParameter) := by
  apply vec2EquivProd.injective
  apply Prod.ext <;> simp [interpolatePoint] <;> ring_nf

/-- A finite injective indexed collinear family has two actual vertices whose
closed segment contains every vertex. -/
theorem exists_segment_extrema_of_allOrderedTriplesCollinear
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (injective : Function.Injective vertex)
    (collinear : AllOrderedTriplesCollinear vertex) :
    ∃ startIndex finishIndex,
      ∀ index, OnClosedSegment
        (vertex startIndex) (vertex finishIndex) (vertex index) := by
  let baseStart : RingIndex extraVertices := ⟨0, by omega⟩
  let baseFinish : RingIndex extraVertices := ⟨1, by omega⟩
  have baseIndicesDistinct : baseStart ≠ baseFinish := by
    intro equal
    have := congrArg Fin.val equal
    simp [baseStart, baseFinish] at this
  have basePointsDistinct : vertex baseStart ≠ vertex baseFinish := by
    intro equal
    exact baseIndicesDistinct (injective equal)
  let parameter (index : RingIndex extraVertices) : R :=
    lineParameter (vertex baseStart) (vertex baseFinish) (vertex index)
  let parameters : Finset R := Finset.univ.image parameter
  have parametersNonempty : parameters.Nonempty := by
    exact Finset.image_nonempty.mpr Finset.univ_nonempty
  let lower := parameters.min' parametersNonempty
  let upper := parameters.max' parametersNonempty
  have lowerMember : lower ∈ parameters :=
    Finset.min'_mem parameters parametersNonempty
  have upperMember : upper ∈ parameters :=
    Finset.max'_mem parameters parametersNonempty
  rcases Finset.mem_image.mp lowerMember with
    ⟨startIndex, _, startParameter⟩
  rcases Finset.mem_image.mp upperMember with
    ⟨finishIndex, _, finishParameter⟩
  have baseCollinear (index : RingIndex extraVertices) :
      orientation (vertex baseStart) (vertex baseFinish) (vertex index) = 0 := by
    by_cases atStart : index = baseStart
    · subst index
      simp [orientation]
    by_cases atFinish : index = baseFinish
    · subst index
      simp only [orientation]
      ring
    apply collinear baseStart baseFinish index
    · simp [baseStart, baseFinish]
    · have indexNotZero : index.val ≠ 0 := by
        intro equal
        apply atStart
        apply Fin.ext
        simpa [baseStart] using equal
      have indexNotOne : index.val ≠ 1 := by
        intro equal
        apply atFinish
        apply Fin.ext
        simpa [baseFinish] using equal
      change 1 < index.val
      omega
  have reconstruct (index : RingIndex extraVertices) :
      interpolatePoint (vertex baseStart) (vertex baseFinish)
          (parameter index) = vertex index := by
    exact interpolatePoint_lineParameter _ _ _ basePointsDistinct
      (baseCollinear index)
  have baseStartParameter : parameter baseStart = 0 := by
    exact lineParameter_start _ _ basePointsDistinct
  have baseFinishParameter : parameter baseFinish = 1 := by
    exact lineParameter_finish _ _ basePointsDistinct
  have baseStartMember : parameter baseStart ∈ parameters := by
    exact Finset.mem_image.mpr ⟨baseStart, Finset.mem_univ _, rfl⟩
  have baseFinishMember : parameter baseFinish ∈ parameters := by
    exact Finset.mem_image.mpr ⟨baseFinish, Finset.mem_univ _, rfl⟩
  have lowerLeZero : lower ≤ 0 := by
    rw [← baseStartParameter]
    exact Finset.min'_le parameters _ baseStartMember
  have oneLeUpper : 1 ≤ upper := by
    rw [← baseFinishParameter]
    exact Finset.le_max' parameters _ baseFinishMember
  have lowerLtUpper : lower < upper := by linarith
  refine ⟨startIndex, finishIndex, ?_⟩
  intro index
  have parameterMember : parameter index ∈ parameters := by
    exact Finset.mem_image.mpr ⟨index, Finset.mem_univ _, rfl⟩
  have lowerLe : lower ≤ parameter index :=
    Finset.min'_le parameters _ parameterMember
  have leUpper : parameter index ≤ upper :=
    Finset.le_max' parameters _ parameterMember
  let localParameter := (parameter index - lower) / (upper - lower)
  have localBounds : localParameter ∈ Set.Icc (0 : R) 1 := by
    constructor
    · exact div_nonneg (sub_nonneg.mpr lowerLe)
        (sub_nonneg.mpr (le_of_lt lowerLtUpper))
    · rw [div_le_one (sub_pos.mpr lowerLtUpper)]
      linarith
  refine ⟨localParameter, localBounds, ?_⟩
  have startReconstruct := reconstruct startIndex
  have finishReconstruct := reconstruct finishIndex
  rw [startParameter] at startReconstruct
  rw [finishParameter] at finishReconstruct
  rw [← startReconstruct, ← finishReconstruct,
    interpolatePoint_between_parameters]
  have parameterIdentity :
      lower + (upper - lower) * localParameter = parameter index := by
    dsimp [localParameter]
    field_simp [ne_of_gt (sub_pos.mpr lowerLtUpper)]
    ring
  rw [parameterIdentity]
  exact (reconstruct index).symm

/-- The executable `List.argmin` / `List.argmax` choices for line parameter
are actual extreme vertices and their segment contains the whole collinear
list. Ties are resolved by first list occurrence, as specified by Mathlib. -/
theorem argmin_argmax_segment_contains
    (first second : Vec2 R) (remaining : List (Vec2 R))
    (distinct : first ≠ second)
    (allCollinear : ∀ point ∈ first :: second :: remaining,
      orientation first second point = 0) :
    ∃ lower upper,
      List.argmin (lineParameter first second)
          (first :: second :: remaining) = some lower ∧
      List.argmax (lineParameter first second)
          (first :: second :: remaining) = some upper ∧
      ∀ point ∈ first :: second :: remaining,
        OnClosedSegment lower upper point := by
  let points := first :: second :: remaining
  let parameter := lineParameter first second
  cases lowerEq : List.argmin parameter points with
  | none =>
      have empty := List.argmin_eq_none.mp lowerEq
      simp [points] at empty
  | some lower =>
      cases upperEq : List.argmax parameter points with
      | none =>
          have empty := List.argmax_eq_none.mp upperEq
          simp [points] at empty
      | some upper =>
          have lowerOptionMember : lower ∈ List.argmin parameter points := by
            simp [lowerEq]
          have upperOptionMember : upper ∈ List.argmax parameter points := by
            simp [upperEq]
          have lowerMember : lower ∈ points :=
            List.argmin_mem lowerOptionMember
          have upperMember : upper ∈ points :=
            List.argmax_mem upperOptionMember
          have firstMember : first ∈ points := by simp [points]
          have secondMember : second ∈ points := by simp [points]
          have lowerLeZero : parameter lower ≤ 0 := by
            rw [← lineParameter_start first second distinct]
            exact List.le_of_mem_argmin firstMember lowerOptionMember
          have oneLeUpper : 1 ≤ parameter upper := by
            rw [← lineParameter_finish first second distinct]
            exact List.le_of_mem_argmax secondMember upperOptionMember
          have lowerLtUpper : parameter lower < parameter upper := by
            linarith
          have reconstruct (point : Vec2 R) (member : point ∈ points) :
              interpolatePoint first second (parameter point) = point := by
            exact interpolatePoint_lineParameter first second point distinct
              (allCollinear point (by simpa [points] using member))
          refine ⟨lower, upper, rfl, rfl, ?_⟩
          intro point member
          have lowerLe : parameter lower ≤ parameter point :=
            List.le_of_mem_argmin member lowerOptionMember
          have leUpper : parameter point ≤ parameter upper :=
            List.le_of_mem_argmax member upperOptionMember
          let localParameter :=
            (parameter point - parameter lower) /
              (parameter upper - parameter lower)
          have localBounds : localParameter ∈ Set.Icc (0 : R) 1 := by
            constructor
            · exact div_nonneg (sub_nonneg.mpr lowerLe)
                (sub_nonneg.mpr (le_of_lt lowerLtUpper))
            · rw [div_le_one (sub_pos.mpr lowerLtUpper)]
              linarith
          refine ⟨localParameter, localBounds, ?_⟩
          rw [← reconstruct lower lowerMember,
            ← reconstruct upper upperMember,
            interpolatePoint_between_parameters]
          have parameterIdentity :
              parameter lower +
                  (parameter upper - parameter lower) * localParameter =
                parameter point := by
            dsimp [localParameter]
            field_simp [ne_of_gt (sub_pos.mpr lowerLtUpper)]
            ring
          rw [parameterIdentity]
          exact (reconstruct point member).symm

end Sprawlens.CollinearExtrema
