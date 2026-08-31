import Sprawlens.ClipCompleteness
import Sprawlens.TriangleSupportSemantics

namespace Sprawlens.TriangleClipCompleteness

open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open CanonicalClip
open ClipCompleteness
open ConvexClipContract
open ConvexClipConsequences
open SimpleRing
open StrictConvexContract
open TriangleSupportSemantics
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Reversing a genuine crossing edge does not change its boundary point. -/
theorem boundaryPoint_swap
    (plane : HalfPlane R) (start finish : Vec2 R)
    (distancesDifferent :
      signedDistance plane start ≠ signedDistance plane finish) :
    boundaryPoint plane start finish = boundaryPoint plane finish start := by
  have parameterSwap :
      boundaryParameter (signedDistance plane finish) (signedDistance plane start) =
        1 - boundaryParameter (signedDistance plane start) (signedDistance plane finish) := by
    unfold boundaryParameter
    field_simp [sub_ne_zero.mpr distancesDifferent,
      sub_ne_zero.mpr distancesDifferent.symm]
    ring
  rw [boundaryPoint, boundaryPoint, parameterSwap]
  apply vec2EquivProd.injective
  apply Prod.ext <;>
    simp only [interpolatePoint, vec2EquivProd, Equiv.coe_fn_mk] <;>
    ring

/-- A nonnegative demand below two nonnegative capacities can be split without
exceeding either capacity. -/
theorem exists_nonnegative_split
    (demand firstCapacity secondCapacity : R)
    (demandNonnegative : 0 ≤ demand)
    (firstCapacityNonnegative : 0 ≤ firstCapacity)
    (secondCapacityNonnegative : 0 ≤ secondCapacity)
    (demandAtMostTotal : demand ≤ firstCapacity + secondCapacity) :
    ∃ firstShare secondShare : R,
      0 ≤ firstShare ∧ 0 ≤ secondShare ∧
        firstShare ≤ firstCapacity ∧ secondShare ≤ secondCapacity ∧
          firstShare + secondShare = demand := by
  by_cases demandFitsFirst : demand ≤ firstCapacity
  · exact ⟨demand, 0, demandNonnegative, le_rfl, demandFitsFirst,
      secondCapacityNonnegative, by ring⟩
  · have firstBelowDemand : firstCapacity ≤ demand :=
      le_of_lt (lt_of_not_ge demandFitsFirst)
    refine ⟨firstCapacity, demand - firstCapacity,
      firstCapacityNonnegative, sub_nonneg.mpr firstBelowDemand, le_rfl, ?_, by ring⟩
    linarith

/-- In the one-strictly-inside/two-outside triangle case, any barycentric
point that remains in the half-plane is a convex combination of the inside
vertex and the two boundary crossings. -/
theorem oneInside_twoOutside_barycentric_mem_generatorHull
    (plane : HalfPlane R) (inside outside₁ outside₂ point : Vec2 R)
    (insideWeight outside₁Weight outside₂Weight : R)
    (outside₁WeightNonnegative : 0 ≤ outside₁Weight)
    (outside₂WeightNonnegative : 0 ≤ outside₂Weight)
    (weightSum : insideWeight + outside₁Weight + outside₂Weight = 1)
    (pointEq :
      insideWeight • inside + outside₁Weight • outside₁ +
        outside₂Weight • outside₂ = point)
    (insideStrict : signedDistance plane inside < 0)
    (outside₁Strict : 0 < signedDistance plane outside₁)
    (outside₂Strict : 0 < signedDistance plane outside₂)
    (weightedDistanceInside :
      insideWeight * signedDistance plane inside +
          outside₁Weight * signedDistance plane outside₁ +
        outside₂Weight * signedDistance plane outside₂ ≤ 0) :
    point ∈ convexHull R
      { generator |
        generator = inside ∨
          generator = boundaryPoint plane inside outside₁ ∨
          generator = boundaryPoint plane inside outside₂ } := by
  let insideDistance := signedDistance plane inside
  let outside₁Distance := signedDistance plane outside₁
  let outside₂Distance := signedDistance plane outside₂
  have insideDistanceNegative : insideDistance < 0 := by
    exact insideStrict
  have outside₁DistancePositive : 0 < outside₁Distance := by
    exact outside₁Strict
  have outside₂DistancePositive : 0 < outside₂Distance := by
    exact outside₂Strict
  have insideDistanceNonzero : insideDistance ≠ 0 := ne_of_lt insideDistanceNegative
  have denominator₁Negative : insideDistance - outside₁Distance < 0 := by
    linarith
  have denominator₂Negative : insideDistance - outside₂Distance < 0 := by
    linarith
  have denominator₁Nonzero : insideDistance - outside₁Distance ≠ 0 :=
    ne_of_lt denominator₁Negative
  have denominator₂Nonzero : insideDistance - outside₂Distance ≠ 0 :=
    ne_of_lt denominator₂Negative
  let parameter₁ := boundaryParameter insideDistance outside₁Distance
  let parameter₂ := boundaryParameter insideDistance outside₂Distance
  have parameter₁Positive : 0 < parameter₁ := by
    dsimp [parameter₁, boundaryParameter]
    exact div_pos_of_neg_of_neg insideDistanceNegative denominator₁Negative
  have parameter₂Positive : 0 < parameter₂ := by
    dsimp [parameter₂, boundaryParameter]
    exact div_pos_of_neg_of_neg insideDistanceNegative denominator₂Negative
  let crossing₁Weight := outside₁Weight / parameter₁
  let crossing₂Weight := outside₂Weight / parameter₂
  let retainedWeight := 1 - crossing₁Weight - crossing₂Weight
  have crossing₁WeightNonnegative : 0 ≤ crossing₁Weight :=
    div_nonneg outside₁WeightNonnegative (le_of_lt parameter₁Positive)
  have crossing₂WeightNonnegative : 0 ≤ crossing₂Weight :=
    div_nonneg outside₂WeightNonnegative (le_of_lt parameter₂Positive)
  have crossing₁WeightFormula :
      crossing₁Weight =
        outside₁Weight * (insideDistance - outside₁Distance) / insideDistance := by
    dsimp [crossing₁Weight, parameter₁, boundaryParameter]
    field_simp [insideDistanceNonzero, denominator₁Nonzero]
  have crossing₂WeightFormula :
      crossing₂Weight =
        outside₂Weight * (insideDistance - outside₂Distance) / insideDistance := by
    dsimp [crossing₂Weight, parameter₂, boundaryParameter]
    field_simp [insideDistanceNonzero, denominator₂Nonzero]
  have retainedWeightFormula :
      retainedWeight =
        (insideWeight * insideDistance +
            outside₁Weight * outside₁Distance +
          outside₂Weight * outside₂Distance) / insideDistance := by
    rw [show retainedWeight = 1 - crossing₁Weight - crossing₂Weight by rfl,
      crossing₁WeightFormula, crossing₂WeightFormula]
    have insideWeightFormula :
        insideWeight = 1 - outside₁Weight - outside₂Weight := by
      linarith
    rw [insideWeightFormula]
    field_simp [insideDistanceNonzero]
    ring
  have retainedWeightNonnegative : 0 ≤ retainedWeight := by
    rw [retainedWeightFormula]
    exact div_nonneg_of_nonpos weightedDistanceInside (le_of_lt insideStrict)
  let generator : Fin 3 → Vec2 R := fun index =>
    match index.val with
    | 0 => inside
    | 1 => boundaryPoint plane inside outside₁
    | _ => boundaryPoint plane inside outside₂
  let weight : Fin 3 → R := fun index =>
    match index.val with
    | 0 => retainedWeight
    | 1 => crossing₁Weight
    | _ => crossing₂Weight
  have weightsNonnegative : ∀ index, 0 ≤ weight index := by
    intro index
    fin_cases index
    · exact retainedWeightNonnegative
    · exact crossing₁WeightNonnegative
    · exact crossing₂WeightNonnegative
  have weightsSum : ∑ index, weight index = 1 := by
    rw [Fin.sum_univ_three]
    simp [weight]
    dsimp [retainedWeight]
    ring
  have crossing₁Parameter : crossing₁Weight * parameter₁ = outside₁Weight := by
    dsimp [crossing₁Weight]
    exact div_mul_cancel₀ _ (ne_of_gt parameter₁Positive)
  have crossing₂Parameter : crossing₂Weight * parameter₂ = outside₂Weight := by
    dsimp [crossing₂Weight]
    exact div_mul_cancel₀ _ (ne_of_gt parameter₂Positive)
  have insideCoefficient :
      retainedWeight + crossing₁Weight * (1 - parameter₁) +
          crossing₂Weight * (1 - parameter₂) = insideWeight := by
    calc
      retainedWeight + crossing₁Weight * (1 - parameter₁) +
          crossing₂Weight * (1 - parameter₂) =
          1 - crossing₁Weight * parameter₁ -
            crossing₂Weight * parameter₂ := by
              dsimp [retainedWeight]
              ring
      _ = 1 - outside₁Weight - outside₂Weight := by
        rw [crossing₁Parameter, crossing₂Parameter]
      _ = insideWeight := by linarith
  have firstBoundaryPoint :
      boundaryPoint plane inside outside₁ =
        interpolatePoint inside outside₁ parameter₁ := by
    rfl
  have secondBoundaryPoint :
      boundaryPoint plane inside outside₂ =
        interpolatePoint inside outside₂ parameter₂ := by
    rfl
  have generatedPointEq :
      retainedWeight • inside +
            crossing₁Weight • boundaryPoint plane inside outside₁ +
          crossing₂Weight • boundaryPoint plane inside outside₂ =
        insideWeight • inside + outside₁Weight • outside₁ +
          outside₂Weight • outside₂ := by
    rw [firstBoundaryPoint, secondBoundaryPoint]
    apply vec2EquivProd.injective
    apply Prod.ext
    · change
        retainedWeight * inside.x +
              crossing₁Weight *
                (inside.x + (outside₁.x - inside.x) * parameter₁) +
            crossing₂Weight *
              (inside.x + (outside₂.x - inside.x) * parameter₂) =
          insideWeight * inside.x + outside₁Weight * outside₁.x +
            outside₂Weight * outside₂.x
      linear_combination
        insideCoefficient * inside.x +
        crossing₁Parameter * outside₁.x +
        crossing₂Parameter * outside₂.x
    · change
        retainedWeight * inside.y +
              crossing₁Weight *
                (inside.y + (outside₁.y - inside.y) * parameter₁) +
            crossing₂Weight *
              (inside.y + (outside₂.y - inside.y) * parameter₂) =
          insideWeight * inside.y + outside₁Weight * outside₁.y +
            outside₂Weight * outside₂.y
      linear_combination
        insideCoefficient * inside.y +
        crossing₁Parameter * outside₁.y +
        crossing₂Parameter * outside₂.y
  apply mem_convexHull_of_exists_fintype weight generator weightsNonnegative
    weightsSum
  · intro index
    fin_cases index
    · exact Or.inl rfl
    · exact Or.inr (Or.inl rfl)
    · exact Or.inr (Or.inr rfl)
  · rw [Fin.sum_univ_three]
    exact generatedPointEq.trans pointEq

/-- In the two-strictly-inside/one-outside triangle case, any retained
barycentric point is a convex combination of the two inside vertices and the
two boundary crossings. -/
theorem twoInside_oneOutside_barycentric_mem_generatorHull
    (plane : HalfPlane R) (inside₁ inside₂ outside point : Vec2 R)
    (inside₁Weight inside₂Weight outsideWeight : R)
    (inside₁WeightNonnegative : 0 ≤ inside₁Weight)
    (inside₂WeightNonnegative : 0 ≤ inside₂Weight)
    (outsideWeightNonnegative : 0 ≤ outsideWeight)
    (weightSum : inside₁Weight + inside₂Weight + outsideWeight = 1)
    (pointEq :
      inside₁Weight • inside₁ + inside₂Weight • inside₂ +
        outsideWeight • outside = point)
    (inside₁Strict : signedDistance plane inside₁ < 0)
    (inside₂Strict : signedDistance plane inside₂ < 0)
    (outsideStrict : 0 < signedDistance plane outside)
    (weightedDistanceInside :
      inside₁Weight * signedDistance plane inside₁ +
          inside₂Weight * signedDistance plane inside₂ +
        outsideWeight * signedDistance plane outside ≤ 0) :
    point ∈ convexHull R
      { generator |
        generator = inside₁ ∨ generator = inside₂ ∨
          generator = boundaryPoint plane inside₁ outside ∨
          generator = boundaryPoint plane inside₂ outside } := by
  let inside₁Distance := signedDistance plane inside₁
  let inside₂Distance := signedDistance plane inside₂
  let outsideDistance := signedDistance plane outside
  have inside₁DistanceNegative : inside₁Distance < 0 := inside₁Strict
  have inside₂DistanceNegative : inside₂Distance < 0 := inside₂Strict
  have outsideDistancePositive : 0 < outsideDistance := outsideStrict
  have inside₁DistanceNonzero : inside₁Distance ≠ 0 :=
    ne_of_lt inside₁DistanceNegative
  have inside₂DistanceNonzero : inside₂Distance ≠ 0 :=
    ne_of_lt inside₂DistanceNegative
  let firstCapacity := -(inside₁Weight * inside₁Distance) / outsideDistance
  let secondCapacity := -(inside₂Weight * inside₂Distance) / outsideDistance
  have firstCapacityNonnegative : 0 ≤ firstCapacity := by
    dsimp [firstCapacity]
    exact div_nonneg (neg_nonneg.mpr
      (mul_nonpos_of_nonneg_of_nonpos inside₁WeightNonnegative
        (le_of_lt inside₁DistanceNegative)))
      (le_of_lt outsideDistancePositive)
  have secondCapacityNonnegative : 0 ≤ secondCapacity := by
    dsimp [secondCapacity]
    exact div_nonneg (neg_nonneg.mpr
      (mul_nonpos_of_nonneg_of_nonpos inside₂WeightNonnegative
        (le_of_lt inside₂DistanceNegative)))
      (le_of_lt outsideDistancePositive)
  have outsideWeightAtMostCapacity :
      outsideWeight ≤ firstCapacity + secondCapacity := by
    rw [show firstCapacity = -(inside₁Weight * inside₁Distance) /
        outsideDistance by rfl,
      show secondCapacity = -(inside₂Weight * inside₂Distance) /
        outsideDistance by rfl,
      ← add_div]
    rw [le_div_iff₀ outsideDistancePositive]
    linarith
  obtain ⟨firstShare, secondShare, firstShareNonnegative,
      secondShareNonnegative, firstShareAtMostCapacity,
      secondShareAtMostCapacity, shareSum⟩ :=
    exists_nonnegative_split outsideWeight firstCapacity secondCapacity
      outsideWeightNonnegative firstCapacityNonnegative
      secondCapacityNonnegative outsideWeightAtMostCapacity
  let parameter₁ := boundaryParameter inside₁Distance outsideDistance
  let parameter₂ := boundaryParameter inside₂Distance outsideDistance
  have denominator₁Negative : inside₁Distance - outsideDistance < 0 := by
    linarith
  have denominator₂Negative : inside₂Distance - outsideDistance < 0 := by
    linarith
  have parameter₁Positive : 0 < parameter₁ := by
    dsimp [parameter₁, boundaryParameter]
    exact div_pos_of_neg_of_neg inside₁DistanceNegative denominator₁Negative
  have parameter₂Positive : 0 < parameter₂ := by
    dsimp [parameter₂, boundaryParameter]
    exact div_pos_of_neg_of_neg inside₂DistanceNegative denominator₂Negative
  let crossing₁Weight := firstShare / parameter₁
  let crossing₂Weight := secondShare / parameter₂
  let retained₁Weight :=
    inside₁Weight - crossing₁Weight * (1 - parameter₁)
  let retained₂Weight :=
    inside₂Weight - crossing₂Weight * (1 - parameter₂)
  have crossing₁WeightNonnegative : 0 ≤ crossing₁Weight :=
    div_nonneg firstShareNonnegative (le_of_lt parameter₁Positive)
  have crossing₂WeightNonnegative : 0 ≤ crossing₂Weight :=
    div_nonneg secondShareNonnegative (le_of_lt parameter₂Positive)
  have firstShareScaled :
      firstShare * outsideDistance ≤ -(inside₁Weight * inside₁Distance) := by
    apply (le_div_iff₀ outsideDistancePositive).mp
    simpa [firstCapacity] using firstShareAtMostCapacity
  have secondShareScaled :
      secondShare * outsideDistance ≤ -(inside₂Weight * inside₂Distance) := by
    apply (le_div_iff₀ outsideDistancePositive).mp
    simpa [secondCapacity] using secondShareAtMostCapacity
  have retained₁WeightFormula :
      retained₁Weight =
        (inside₁Weight * inside₁Distance +
          firstShare * outsideDistance) / inside₁Distance := by
    dsimp [retained₁Weight, crossing₁Weight, parameter₁,
      boundaryParameter]
    field_simp [inside₁DistanceNonzero, ne_of_lt denominator₁Negative]
    ring
  have retained₂WeightFormula :
      retained₂Weight =
        (inside₂Weight * inside₂Distance +
          secondShare * outsideDistance) / inside₂Distance := by
    dsimp [retained₂Weight, crossing₂Weight, parameter₂,
      boundaryParameter]
    field_simp [inside₂DistanceNonzero, ne_of_lt denominator₂Negative]
    ring
  have retained₁WeightNonnegative : 0 ≤ retained₁Weight := by
    rw [retained₁WeightFormula]
    apply div_nonneg_of_nonpos _ (le_of_lt inside₁DistanceNegative)
    linarith
  have retained₂WeightNonnegative : 0 ≤ retained₂Weight := by
    rw [retained₂WeightFormula]
    apply div_nonneg_of_nonpos _ (le_of_lt inside₂DistanceNegative)
    linarith
  have crossing₁Parameter : crossing₁Weight * parameter₁ = firstShare := by
    dsimp [crossing₁Weight]
    exact div_mul_cancel₀ _ (ne_of_gt parameter₁Positive)
  have crossing₂Parameter : crossing₂Weight * parameter₂ = secondShare := by
    dsimp [crossing₂Weight]
    exact div_mul_cancel₀ _ (ne_of_gt parameter₂Positive)
  have firstCoefficient :
      retained₁Weight + crossing₁Weight * (1 - parameter₁) =
        inside₁Weight := by
    dsimp [retained₁Weight]
    ring
  have secondCoefficient :
      retained₂Weight + crossing₂Weight * (1 - parameter₂) =
        inside₂Weight := by
    dsimp [retained₂Weight]
    ring
  have outsideCoefficient :
      crossing₁Weight * parameter₁ + crossing₂Weight * parameter₂ =
        outsideWeight := by
    rw [crossing₁Parameter, crossing₂Parameter, shareSum]
  let generator : Fin 4 → Vec2 R := fun index ↦
    match index.val with
    | 0 => inside₁
    | 1 => inside₂
    | 2 => boundaryPoint plane inside₁ outside
    | _ => boundaryPoint plane inside₂ outside
  let weight : Fin 4 → R := fun index ↦
    match index.val with
    | 0 => retained₁Weight
    | 1 => retained₂Weight
    | 2 => crossing₁Weight
    | _ => crossing₂Weight
  have weightsNonnegative : ∀ index, 0 ≤ weight index := by
    intro index
    fin_cases index
    · exact retained₁WeightNonnegative
    · exact retained₂WeightNonnegative
    · exact crossing₁WeightNonnegative
    · exact crossing₂WeightNonnegative
  have weightsSum : ∑ index, weight index = 1 := by
    rw [Fin.sum_univ_four]
    simp only [weight]
    calc
      retained₁Weight + retained₂Weight + crossing₁Weight + crossing₂Weight =
          (retained₁Weight + crossing₁Weight * (1 - parameter₁)) +
            (retained₂Weight + crossing₂Weight * (1 - parameter₂)) +
            (crossing₁Weight * parameter₁ +
              crossing₂Weight * parameter₂) := by ring
      _ = inside₁Weight + inside₂Weight + outsideWeight := by
        rw [firstCoefficient, secondCoefficient, outsideCoefficient]
      _ = 1 := weightSum
  have firstBoundaryPoint :
      boundaryPoint plane inside₁ outside =
        interpolatePoint inside₁ outside parameter₁ := by rfl
  have secondBoundaryPoint :
      boundaryPoint plane inside₂ outside =
        interpolatePoint inside₂ outside parameter₂ := by rfl
  have generatedPointEq :
      retained₁Weight • inside₁ + retained₂Weight • inside₂ +
            crossing₁Weight • boundaryPoint plane inside₁ outside +
          crossing₂Weight • boundaryPoint plane inside₂ outside = point := by
    rw [firstBoundaryPoint, secondBoundaryPoint, ← pointEq]
    apply vec2EquivProd.injective
    apply Prod.ext
    · change
        retained₁Weight * inside₁.x + retained₂Weight * inside₂.x +
              crossing₁Weight *
                (inside₁.x + (outside.x - inside₁.x) * parameter₁) +
            crossing₂Weight *
              (inside₂.x + (outside.x - inside₂.x) * parameter₂) =
          inside₁Weight * inside₁.x + inside₂Weight * inside₂.x +
            outsideWeight * outside.x
      linear_combination
        firstCoefficient * inside₁.x + secondCoefficient * inside₂.x +
        outsideCoefficient * outside.x
    · change
        retained₁Weight * inside₁.y + retained₂Weight * inside₂.y +
              crossing₁Weight *
                (inside₁.y + (outside.y - inside₁.y) * parameter₁) +
            crossing₂Weight *
              (inside₂.y + (outside.y - inside₂.y) * parameter₂) =
          inside₁Weight * inside₁.y + inside₂Weight * inside₂.y +
            outsideWeight * outside.y
      linear_combination
        firstCoefficient * inside₁.y + secondCoefficient * inside₂.y +
        outsideCoefficient * outside.y
  apply mem_convexHull_of_exists_fintype weight generator weightsNonnegative weightsSum
  · intro index
    fin_cases index
    · exact Or.inl rfl
    · exact Or.inr (Or.inl rfl)
    · exact Or.inr (Or.inr (Or.inl rfl))
    · exact Or.inr (Or.inr (Or.inr rfl))
  · rw [Fin.sum_univ_four]
    exact generatedPointEq

/-- A strict triangle with exactly its first vertex inside and the other two
vertices outside satisfies the pure generator-hull completeness obligation. -/
theorem triangle_boundaryGeneratorHullComplete_of_first_inside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstInside : signedDistance plane (vertex ⟨0, by omega⟩) < 0)
    (secondOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩))
    (thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩)) :
    BoundaryGeneratorHullComplete plane vertex := by
  let first : RingIndex 0 := ⟨0, by omega⟩
  let second : RingIndex 0 := ⟨1, by omega⟩
  let third : RingIndex 0 := ⟨2, by omega⟩
  let area := orientation (vertex first) (vertex second) (vertex third)
  let firstWeight : Vec2 R → R := fun point ↦
    orientation (vertex second) (vertex third) point / area
  let secondWeight : Vec2 R → R := fun point ↦
    orientation (vertex third) (vertex first) point / area
  let thirdWeight : Vec2 R → R := fun point ↦
    orientation (vertex first) (vertex second) point / area
  have areaPositive : 0 < area := by
    exact ordered.strict first second third
      (by simp [first, second]) (by simp [second, third])
  intro point pointMember
  have adequate := strictTriangle_supportSemanticsAdequate vertex ordered
  have supportMember : point ∈ indexedPolygonRegion vertex := by
    rw [adequate]
    exact pointMember.1
  have firstWeightNonnegative : 0 ≤ firstWeight point := by
    apply div_nonneg
    · simpa [firstWeight, second, third, nextIndex] using supportMember second
    · exact le_of_lt areaPositive
  have secondWeightNonnegative : 0 ≤ secondWeight point := by
    apply div_nonneg
    · simpa [secondWeight, first, third, nextIndex] using supportMember third
    · exact le_of_lt areaPositive
  have thirdWeightNonnegative : 0 ≤ thirdWeight point := by
    apply div_nonneg
    · simpa [thirdWeight, first, second, nextIndex] using supportMember first
    · exact le_of_lt areaPositive
  have weightSum :
      firstWeight point + secondWeight point + thirdWeight point = 1 := by
    simp only [firstWeight, secondWeight, thirdWeight]
    rw [← add_div, ← add_div]
    rw [orientation_triangle_decomposition]
    exact div_self (ne_of_gt areaPositive)
  have pointEq :
      firstWeight point • vertex first +
            secondWeight point • vertex second +
          thirdWeight point • vertex third = point := by
    simpa [firstWeight, secondWeight, thirdWeight, area] using
      orientation_barycentric_reconstruct
        (vertex first) (vertex second) (vertex third) point
        (ne_of_gt areaPositive)
  have weightedDistanceEq :
      firstWeight point * signedDistance plane (vertex first) +
            secondWeight point * signedDistance plane (vertex second) +
          thirdWeight point * signedDistance plane (vertex third) =
        signedDistance plane point := by
    have pointEqX := congrArg Vec2.x pointEq
    have pointEqY := congrArg Vec2.y pointEq
    simp only [add_x, add_y, smul_x, smul_y] at pointEqX pointEqY
    simp only [signedDistance]
    linear_combination
      plane.normalX * pointEqX +
      plane.normalY * pointEqY -
      plane.offset * weightSum
  have localHull := oneInside_twoOutside_barycentric_mem_generatorHull
    plane (vertex first) (vertex second) (vertex third) point
    (firstWeight point) (secondWeight point) (thirdWeight point)
    secondWeightNonnegative thirdWeightNonnegative weightSum pointEq
    (by exact firstInside) (by exact secondOutside) (by exact thirdOutside)
    (by rw [weightedDistanceEq]; exact pointMember.2)
  apply convexHull_mono _ localHull
  intro generator generatorMember
  rcases generatorMember with rfl | rfl | rfl
  · exact Or.inl ⟨first, rfl, le_of_lt firstInside⟩
  · refine Or.inr ⟨first, ?_, ?_⟩
    · simp [first, second, nextIndex]
    · exact Or.inl ⟨le_of_lt firstInside, by exact secondOutside⟩
  · refine Or.inr ⟨third, ?_, ?_⟩
    · have swapped := boundaryPoint_swap plane (vertex first) (vertex third) (by
        intro equalDistance
        linarith)
      simpa [first, third, nextIndex] using swapped
    · exact Or.inr ⟨by exact thirdOutside, by
        simpa [first, third, nextIndex] using le_of_lt firstInside⟩

/-- A strict triangle with exactly its first vertex outside satisfies the pure
generator-hull completeness obligation. -/
theorem triangle_boundaryGeneratorHullComplete_of_first_outside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstOutside : 0 < signedDistance plane (vertex ⟨0, by omega⟩))
    (secondInside : signedDistance plane (vertex ⟨1, by omega⟩) < 0)
    (thirdInside : signedDistance plane (vertex ⟨2, by omega⟩) < 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  let first : RingIndex 0 := ⟨0, by omega⟩
  let second : RingIndex 0 := ⟨1, by omega⟩
  let third : RingIndex 0 := ⟨2, by omega⟩
  let area := orientation (vertex first) (vertex second) (vertex third)
  let firstWeight : Vec2 R → R := fun point ↦
    orientation (vertex second) (vertex third) point / area
  let secondWeight : Vec2 R → R := fun point ↦
    orientation (vertex third) (vertex first) point / area
  let thirdWeight : Vec2 R → R := fun point ↦
    orientation (vertex first) (vertex second) point / area
  have areaPositive : 0 < area := by
    exact ordered.strict first second third
      (by simp [first, second]) (by simp [second, third])
  intro point pointMember
  have adequate := strictTriangle_supportSemanticsAdequate vertex ordered
  have supportMember : point ∈ indexedPolygonRegion vertex := by
    rw [adequate]
    exact pointMember.1
  have firstWeightNonnegative : 0 ≤ firstWeight point := by
    apply div_nonneg
    · simpa [firstWeight, second, third, nextIndex] using supportMember second
    · exact le_of_lt areaPositive
  have secondWeightNonnegative : 0 ≤ secondWeight point := by
    apply div_nonneg
    · simpa [secondWeight, first, third, nextIndex] using supportMember third
    · exact le_of_lt areaPositive
  have thirdWeightNonnegative : 0 ≤ thirdWeight point := by
    apply div_nonneg
    · simpa [thirdWeight, first, second, nextIndex] using supportMember first
    · exact le_of_lt areaPositive
  have weightSum :
      firstWeight point + secondWeight point + thirdWeight point = 1 := by
    simp only [firstWeight, secondWeight, thirdWeight]
    rw [← add_div, ← add_div]
    rw [orientation_triangle_decomposition]
    exact div_self (ne_of_gt areaPositive)
  have pointEq :
      firstWeight point • vertex first +
            secondWeight point • vertex second +
          thirdWeight point • vertex third = point := by
    simpa [firstWeight, secondWeight, thirdWeight, area] using
      orientation_barycentric_reconstruct
        (vertex first) (vertex second) (vertex third) point
        (ne_of_gt areaPositive)
  have weightedDistanceEq :
      firstWeight point * signedDistance plane (vertex first) +
            secondWeight point * signedDistance plane (vertex second) +
          thirdWeight point * signedDistance plane (vertex third) =
        signedDistance plane point := by
    have pointEqX := congrArg Vec2.x pointEq
    have pointEqY := congrArg Vec2.y pointEq
    simp only [add_x, add_y, smul_x, smul_y] at pointEqX pointEqY
    simp only [signedDistance]
    linear_combination
      plane.normalX * pointEqX +
      plane.normalY * pointEqY -
      plane.offset * weightSum
  have reorderedWeightSum :
      secondWeight point + thirdWeight point + firstWeight point = 1 := by
    linarith
  have reorderedPointEq :
      secondWeight point • vertex second + thirdWeight point • vertex third +
        firstWeight point • vertex first = point := by
    calc
      secondWeight point • vertex second + thirdWeight point • vertex third +
          firstWeight point • vertex first =
        firstWeight point • vertex first + secondWeight point • vertex second +
          thirdWeight point • vertex third := by abel
      _ = point := pointEq
  have localHull := twoInside_oneOutside_barycentric_mem_generatorHull
    plane (vertex second) (vertex third) (vertex first) point
    (secondWeight point) (thirdWeight point) (firstWeight point)
    secondWeightNonnegative thirdWeightNonnegative firstWeightNonnegative
    reorderedWeightSum reorderedPointEq
    (by exact secondInside) (by exact thirdInside) (by exact firstOutside)
    (by
      rw [show
        secondWeight point * signedDistance plane (vertex second) +
              thirdWeight point * signedDistance plane (vertex third) +
            firstWeight point * signedDistance plane (vertex first) =
          firstWeight point * signedDistance plane (vertex first) +
              secondWeight point * signedDistance plane (vertex second) +
            thirdWeight point * signedDistance plane (vertex third) by ring]
      rw [weightedDistanceEq]
      exact pointMember.2)
  apply convexHull_mono _ localHull
  intro generator generatorMember
  rcases generatorMember with rfl | rfl | rfl | rfl
  · exact Or.inl ⟨second, rfl, le_of_lt secondInside⟩
  · exact Or.inl ⟨third, rfl, le_of_lt thirdInside⟩
  · refine Or.inr ⟨first, ?_, ?_⟩
    · have swapped := boundaryPoint_swap plane (vertex second) (vertex first) (by
        intro equalDistance
        linarith)
      simpa [first, second, nextIndex] using swapped
    · exact Or.inr ⟨by exact firstOutside, by exact le_of_lt secondInside⟩
  · refine Or.inr ⟨third, ?_, ?_⟩
    · simp [first, third, nextIndex]
    · exact Or.inl ⟨le_of_lt thirdInside, by
        simpa [first, third, nextIndex] using firstOutside⟩

/-- The second-only-inside labeling follows by cyclic seam invariance. -/
theorem triangle_boundaryGeneratorHullComplete_of_second_inside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstOutside : 0 < signedDistance plane (vertex ⟨0, by omega⟩))
    (secondInside : signedDistance plane (vertex ⟨1, by omega⟩) < 0)
    (thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩)) :
    BoundaryGeneratorHullComplete plane vertex := by
  let start : RingIndex 0 := ⟨1, by omega⟩
  have rotatedComplete :
      BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
    apply triangle_boundaryGeneratorHullComplete_of_first_inside
    · exact ordered.rotateVertex start
    · change signedDistance plane
          (rotateVertex start vertex ⟨0, by omega⟩) < 0
      rw [SeamSupportSemantics.rotateVertex_zero]
      exact secondInside
    · change 0 < signedDistance plane
          (rotateVertex start vertex ⟨1, by omega⟩)
      rw [SeamSupportSemantics.rotateVertex_one]
      simpa [start, nextIndex] using thirdOutside
    · change 0 < signedDistance plane
          (rotateVertex start vertex ⟨2, by omega⟩)
      rw [SeamSupportSemantics.rotateVertex_two]
      simpa [start, nextIndex] using firstOutside
  exact (boundaryGeneratorHullComplete_rotateVertex_iff plane start vertex).mp
    rotatedComplete

/-- The third-only-inside labeling follows by cyclic seam invariance. -/
theorem triangle_boundaryGeneratorHullComplete_of_third_inside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstOutside : 0 < signedDistance plane (vertex ⟨0, by omega⟩))
    (secondOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩))
    (thirdInside : signedDistance plane (vertex ⟨2, by omega⟩) < 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  let start : RingIndex 0 := ⟨2, by omega⟩
  have rotatedComplete :
      BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
    apply triangle_boundaryGeneratorHullComplete_of_first_inside
    · exact ordered.rotateVertex start
    · change signedDistance plane
          (rotateVertex start vertex ⟨0, by omega⟩) < 0
      rw [SeamSupportSemantics.rotateVertex_zero]
      exact thirdInside
    · change 0 < signedDistance plane
          (rotateVertex start vertex ⟨1, by omega⟩)
      rw [SeamSupportSemantics.rotateVertex_one]
      simpa [start, nextIndex] using firstOutside
    · change 0 < signedDistance plane
          (rotateVertex start vertex ⟨2, by omega⟩)
      rw [SeamSupportSemantics.rotateVertex_two]
      simpa [start, nextIndex] using secondOutside
  exact (boundaryGeneratorHullComplete_rotateVertex_iff plane start vertex).mp
    rotatedComplete

/-- The second-only-outside labeling follows by cyclic seam invariance. -/
theorem triangle_boundaryGeneratorHullComplete_of_second_outside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstInside : signedDistance plane (vertex ⟨0, by omega⟩) < 0)
    (secondOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩))
    (thirdInside : signedDistance plane (vertex ⟨2, by omega⟩) < 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  let start : RingIndex 0 := ⟨1, by omega⟩
  have rotatedComplete :
      BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
    apply triangle_boundaryGeneratorHullComplete_of_first_outside
    · exact ordered.rotateVertex start
    · change 0 < signedDistance plane
          (rotateVertex start vertex ⟨0, by omega⟩)
      rw [SeamSupportSemantics.rotateVertex_zero]
      exact secondOutside
    · change signedDistance plane
          (rotateVertex start vertex ⟨1, by omega⟩) < 0
      rw [SeamSupportSemantics.rotateVertex_one]
      simpa [start, nextIndex] using thirdInside
    · change signedDistance plane
          (rotateVertex start vertex ⟨2, by omega⟩) < 0
      rw [SeamSupportSemantics.rotateVertex_two]
      simpa [start, nextIndex] using firstInside
  exact (boundaryGeneratorHullComplete_rotateVertex_iff plane start vertex).mp
    rotatedComplete

/-- The third-only-outside labeling follows by cyclic seam invariance. -/
theorem triangle_boundaryGeneratorHullComplete_of_third_outside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstInside : signedDistance plane (vertex ⟨0, by omega⟩) < 0)
    (secondInside : signedDistance plane (vertex ⟨1, by omega⟩) < 0)
    (thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩)) :
    BoundaryGeneratorHullComplete plane vertex := by
  let start : RingIndex 0 := ⟨2, by omega⟩
  have rotatedComplete :
      BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
    apply triangle_boundaryGeneratorHullComplete_of_first_outside
    · exact ordered.rotateVertex start
    · change 0 < signedDistance plane
          (rotateVertex start vertex ⟨0, by omega⟩)
      rw [SeamSupportSemantics.rotateVertex_zero]
      exact thirdOutside
    · change signedDistance plane
          (rotateVertex start vertex ⟨1, by omega⟩) < 0
      rw [SeamSupportSemantics.rotateVertex_one]
      simpa [start, nextIndex] using firstInside
    · change signedDistance plane
          (rotateVertex start vertex ⟨2, by omega⟩) < 0
      rw [SeamSupportSemantics.rotateVertex_two]
      simpa [start, nextIndex] using secondInside
  exact (boundaryGeneratorHullComplete_rotateVertex_iff plane start vertex).mp
    rotatedComplete

/-- If a clipping line misses all three vertices, every sign pattern of a
strict ordered triangle satisfies pure generator-hull completeness. -/
theorem strictTriangle_boundaryGeneratorHullComplete_of_no_boundary
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (noBoundary : ∀ index, signedDistance plane (vertex index) ≠ 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  let first : RingIndex 0 := ⟨0, by omega⟩
  let second : RingIndex 0 := ⟨1, by omega⟩
  let third : RingIndex 0 := ⟨2, by omega⟩
  by_cases firstNonpositive : signedDistance plane (vertex first) ≤ 0
  · have firstInside : signedDistance plane (vertex first) < 0 :=
      lt_of_le_of_ne firstNonpositive (noBoundary first)
    by_cases secondNonpositive : signedDistance plane (vertex second) ≤ 0
    · have secondInside : signedDistance plane (vertex second) < 0 :=
        lt_of_le_of_ne secondNonpositive (noBoundary second)
      by_cases thirdNonpositive : signedDistance plane (vertex third) ≤ 0
      · have allInside : ∀ index, signedDistance plane (vertex index) ≤ 0 := by
          intro index
          fin_cases index
          · exact firstNonpositive
          · exact secondNonpositive
          · exact thirdNonpositive
        exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
          plane vertex).mp (clipRegionComplete_of_all_nonpos plane vertex allInside)
      · have thirdOutside : 0 < signedDistance plane (vertex third) :=
          lt_of_not_ge thirdNonpositive
        exact triangle_boundaryGeneratorHullComplete_of_third_outside
          plane vertex ordered (by exact firstInside) (by exact secondInside)
          (by exact thirdOutside)
    · have secondOutside : 0 < signedDistance plane (vertex second) :=
        lt_of_not_ge secondNonpositive
      by_cases thirdNonpositive : signedDistance plane (vertex third) ≤ 0
      · have thirdInside : signedDistance plane (vertex third) < 0 :=
          lt_of_le_of_ne thirdNonpositive (noBoundary third)
        exact triangle_boundaryGeneratorHullComplete_of_second_outside
          plane vertex ordered (by exact firstInside) (by exact secondOutside)
          (by exact thirdInside)
      · have thirdOutside : 0 < signedDistance plane (vertex third) :=
          lt_of_not_ge thirdNonpositive
        exact triangle_boundaryGeneratorHullComplete_of_first_inside
          plane vertex ordered (by exact firstInside) (by exact secondOutside)
          (by exact thirdOutside)
  · have firstOutside : 0 < signedDistance plane (vertex first) :=
      lt_of_not_ge firstNonpositive
    by_cases secondNonpositive : signedDistance plane (vertex second) ≤ 0
    · have secondInside : signedDistance plane (vertex second) < 0 :=
        lt_of_le_of_ne secondNonpositive (noBoundary second)
      by_cases thirdNonpositive : signedDistance plane (vertex third) ≤ 0
      · have thirdInside : signedDistance plane (vertex third) < 0 :=
          lt_of_le_of_ne thirdNonpositive (noBoundary third)
        exact triangle_boundaryGeneratorHullComplete_of_first_outside
          plane vertex ordered (by exact firstOutside) (by exact secondInside)
          (by exact thirdInside)
      · have thirdOutside : 0 < signedDistance plane (vertex third) :=
          lt_of_not_ge thirdNonpositive
        exact triangle_boundaryGeneratorHullComplete_of_second_inside
          plane vertex ordered (by exact firstOutside) (by exact secondInside)
          (by exact thirdOutside)
    · have secondOutside : 0 < signedDistance plane (vertex second) :=
        lt_of_not_ge secondNonpositive
      by_cases thirdNonpositive : signedDistance plane (vertex third) ≤ 0
      · have thirdInside : signedDistance plane (vertex third) < 0 :=
          lt_of_le_of_ne thirdNonpositive (noBoundary third)
        exact triangle_boundaryGeneratorHullComplete_of_third_inside
          plane vertex ordered (by exact firstOutside) (by exact secondOutside)
          (by exact thirdInside)
      · have thirdOutside : 0 < signedDistance plane (vertex third) :=
          lt_of_not_ge thirdNonpositive
        have allOutside : ∀ index, 0 < signedDistance plane (vertex index) := by
          intro index
          fin_cases index
          · exact firstOutside
          · exact secondOutside
          · exact thirdOutside
        exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
          plane vertex).mp (clipRegionComplete_of_all_pos plane vertex allOutside)

/-- Under the same generic-position condition, the executable triangle clip
has exact continuous convex-region semantics. -/
theorem strictTriangle_clipIndexedConvexRegion_eq_of_no_boundary
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (noBoundary : ∀ index, signedDistance plane (vertex index) ≠ 0) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane := by
  exact clipIndexedConvexRegion_eq_of_boundaryGeneratorHullComplete plane vertex
    (strictTriangle_boundaryGeneratorHullComplete_of_no_boundary
      plane vertex ordered noBoundary)

end Sprawlens.TriangleClipCompleteness
