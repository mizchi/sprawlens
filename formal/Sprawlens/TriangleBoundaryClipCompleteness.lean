import Sprawlens.TriangleClipCompleteness

namespace Sprawlens.TriangleBoundaryClipCompleteness

open CanonicalClip
open ClipCompleteness
open ConvexClipContract
open ConvexClipConsequences
open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open SimpleRing
open StrictConvexContract
open TriangleClipCompleteness
open TriangleSupportSemantics
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- A point in a strict triangle's vertex convex hull has explicit
nonnegative barycentric weights in materialization order. -/
theorem strictTriangle_exists_barycentric
    (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (point : Vec2 R) (pointMember : point ∈ indexedVertexConvexRegion vertex) :
    ∃ firstWeight secondWeight thirdWeight : R,
      0 ≤ firstWeight ∧ 0 ≤ secondWeight ∧ 0 ≤ thirdWeight ∧
        firstWeight + secondWeight + thirdWeight = 1 ∧
          firstWeight • vertex ⟨0, by omega⟩ +
                secondWeight • vertex ⟨1, by omega⟩ +
              thirdWeight • vertex ⟨2, by omega⟩ = point := by
  let first : RingIndex 0 := ⟨0, by omega⟩
  let second : RingIndex 0 := ⟨1, by omega⟩
  let third : RingIndex 0 := ⟨2, by omega⟩
  let area := orientation (vertex first) (vertex second) (vertex third)
  let firstWeight := orientation (vertex second) (vertex third) point / area
  let secondWeight := orientation (vertex third) (vertex first) point / area
  let thirdWeight := orientation (vertex first) (vertex second) point / area
  have areaPositive : 0 < area := by
    exact ordered.strict first second third
      (by simp [first, second]) (by simp [second, third])
  have supportMember : point ∈ indexedPolygonRegion vertex := by
    rw [strictTriangle_supportSemanticsAdequate vertex ordered]
    exact pointMember
  have firstWeightNonnegative : 0 ≤ firstWeight := by
    apply div_nonneg
    · simpa [firstWeight, second, third, nextIndex] using supportMember second
    · exact le_of_lt areaPositive
  have secondWeightNonnegative : 0 ≤ secondWeight := by
    apply div_nonneg
    · simpa [secondWeight, first, third, nextIndex] using supportMember third
    · exact le_of_lt areaPositive
  have thirdWeightNonnegative : 0 ≤ thirdWeight := by
    apply div_nonneg
    · simpa [thirdWeight, first, second, nextIndex] using supportMember first
    · exact le_of_lt areaPositive
  have weightSum : firstWeight + secondWeight + thirdWeight = 1 := by
    simp only [firstWeight, secondWeight, thirdWeight]
    rw [← add_div, ← add_div]
    rw [orientation_triangle_decomposition]
    exact div_self (ne_of_gt areaPositive)
  have pointEq :
      firstWeight • vertex first + secondWeight • vertex second +
        thirdWeight • vertex third = point := by
    simpa [firstWeight, secondWeight, thirdWeight, area] using
      orientation_barycentric_reconstruct
        (vertex first) (vertex second) (vertex third) point
        (ne_of_gt areaPositive)
  exact ⟨firstWeight, secondWeight, thirdWeight,
    firstWeightNonnegative, secondWeightNonnegative, thirdWeightNonnegative,
    weightSum, by simpa [first, second, third] using pointEq⟩

/-- Signed distance respects a three-point affine combination whose weights
sum to one. -/
theorem signedDistance_barycentric_three
    (plane : HalfPlane R) (first second third point : Vec2 R)
    (firstWeight secondWeight thirdWeight : R)
    (weightSum : firstWeight + secondWeight + thirdWeight = 1)
    (pointEq :
      firstWeight • first + secondWeight • second + thirdWeight • third = point) :
    firstWeight * signedDistance plane first +
          secondWeight * signedDistance plane second +
        thirdWeight * signedDistance plane third = signedDistance plane point := by
  have pointEqX := congrArg Vec2.x pointEq
  have pointEqY := congrArg Vec2.y pointEq
  simp only [add_x, add_y, smul_x, smul_y] at pointEqX pointEqY
  simp only [signedDistance]
  linear_combination
    plane.normalX * pointEqX +
    plane.normalY * pointEqY -
    plane.offset * weightSum

/-- A barycentric transport into any subset of the actual boundary generators
is sufficient for triangle generator-hull completeness. -/
theorem triangle_boundaryGeneratorHullComplete_of_barycentric_transport
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (source : Set (Vec2 R))
    (sourceSubset :
      source ⊆ { point | IsClipBoundaryGenerator plane vertex point })
    (transport :
      ∀ (point : Vec2 R) (firstWeight secondWeight thirdWeight : R),
        0 ≤ firstWeight → 0 ≤ secondWeight → 0 ≤ thirdWeight →
        firstWeight + secondWeight + thirdWeight = 1 →
        firstWeight • vertex ⟨0, by omega⟩ +
              secondWeight • vertex ⟨1, by omega⟩ +
            thirdWeight • vertex ⟨2, by omega⟩ = point →
        firstWeight * signedDistance plane (vertex ⟨0, by omega⟩) +
              secondWeight * signedDistance plane (vertex ⟨1, by omega⟩) +
            thirdWeight * signedDistance plane (vertex ⟨2, by omega⟩) ≤ 0 →
        point ∈ convexHull R source) :
    BoundaryGeneratorHullComplete plane vertex := by
  intro point pointMember
  obtain ⟨firstWeight, secondWeight, thirdWeight,
      firstWeightNonnegative, secondWeightNonnegative, thirdWeightNonnegative,
      weightSum, pointEq⟩ :=
    strictTriangle_exists_barycentric vertex ordered point pointMember.1
  have weightedDistanceEq := signedDistance_barycentric_three
    plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
    (vertex ⟨2, by omega⟩) point firstWeight secondWeight thirdWeight
    weightSum pointEq
  have sourceMember := transport point firstWeight secondWeight thirdWeight
    firstWeightNonnegative secondWeightNonnegative thirdWeightNonnegative
    weightSum pointEq (by rw [weightedDistanceEq]; exact pointMember.2)
  exact convexHull_mono sourceSubset sourceMember

/-- With one strict inside vertex, one boundary vertex, and one strict outside
vertex, every retained barycentric point is generated by the inside vertex,
the boundary vertex, and the genuine crossing. -/
theorem oneInside_oneBoundary_oneOutside_barycentric_mem_generatorHull
    (plane : HalfPlane R) (inside boundary outside point : Vec2 R)
    (insideWeight boundaryWeight outsideWeight : R)
    (boundaryWeightNonnegative : 0 ≤ boundaryWeight)
    (outsideWeightNonnegative : 0 ≤ outsideWeight)
    (weightSum : insideWeight + boundaryWeight + outsideWeight = 1)
    (pointEq :
      insideWeight • inside + boundaryWeight • boundary +
        outsideWeight • outside = point)
    (insideStrict : signedDistance plane inside < 0)
    (boundaryEq : signedDistance plane boundary = 0)
    (outsideStrict : 0 < signedDistance plane outside)
    (weightedDistanceInside :
      insideWeight * signedDistance plane inside +
          boundaryWeight * signedDistance plane boundary +
        outsideWeight * signedDistance plane outside ≤ 0) :
    point ∈ convexHull R
      { generator |
        generator = inside ∨ generator = boundary ∨
          generator = boundaryPoint plane inside outside } := by
  let insideDistance := signedDistance plane inside
  let outsideDistance := signedDistance plane outside
  have insideDistanceNegative : insideDistance < 0 := insideStrict
  have outsideDistancePositive : 0 < outsideDistance := outsideStrict
  have insideDistanceNonzero : insideDistance ≠ 0 :=
    ne_of_lt insideDistanceNegative
  have denominatorNegative : insideDistance - outsideDistance < 0 := by
    linarith
  let parameter := boundaryParameter insideDistance outsideDistance
  have parameterPositive : 0 < parameter := by
    dsimp [parameter, boundaryParameter]
    exact div_pos_of_neg_of_neg insideDistanceNegative denominatorNegative
  let crossingWeight := outsideWeight / parameter
  let retainedWeight := insideWeight - crossingWeight * (1 - parameter)
  have crossingWeightNonnegative : 0 ≤ crossingWeight :=
    div_nonneg outsideWeightNonnegative (le_of_lt parameterPositive)
  have crossingParameter : crossingWeight * parameter = outsideWeight := by
    dsimp [crossingWeight]
    exact div_mul_cancel₀ _ (ne_of_gt parameterPositive)
  have retainedWeightFormula :
      retainedWeight =
        (insideWeight * insideDistance + outsideWeight * outsideDistance) /
          insideDistance := by
    dsimp [retainedWeight, crossingWeight, parameter, boundaryParameter]
    field_simp [insideDistanceNonzero, ne_of_lt denominatorNegative]
    ring
  have retainedWeightNonnegative : 0 ≤ retainedWeight := by
    rw [retainedWeightFormula]
    apply div_nonneg_of_nonpos _ (le_of_lt insideDistanceNegative)
    simpa [boundaryEq] using weightedDistanceInside
  have insideCoefficient :
      retainedWeight + crossingWeight * (1 - parameter) = insideWeight := by
    dsimp [retainedWeight]
    ring
  have outputWeightSum : retainedWeight + boundaryWeight + crossingWeight = 1 := by
    calc
      retainedWeight + boundaryWeight + crossingWeight =
          (retainedWeight + crossingWeight * (1 - parameter)) +
            boundaryWeight + crossingWeight * parameter := by ring
      _ = insideWeight + boundaryWeight + outsideWeight := by
        rw [insideCoefficient, crossingParameter]
      _ = 1 := weightSum
  let generator : Fin 3 → Vec2 R := fun index ↦
    match index.val with
    | 0 => inside
    | 1 => boundary
    | _ => boundaryPoint plane inside outside
  let weight : Fin 3 → R := fun index ↦
    match index.val with
    | 0 => retainedWeight
    | 1 => boundaryWeight
    | _ => crossingWeight
  have weightsNonnegative : ∀ index, 0 ≤ weight index := by
    intro index
    fin_cases index
    · exact retainedWeightNonnegative
    · exact boundaryWeightNonnegative
    · exact crossingWeightNonnegative
  have weightsSum : ∑ index, weight index = 1 := by
    rw [Fin.sum_univ_three]
    simpa [weight] using outputWeightSum
  have boundaryPointEq :
      boundaryPoint plane inside outside =
        interpolatePoint inside outside parameter := by rfl
  have generatedPointEq :
      retainedWeight • inside + boundaryWeight • boundary +
          crossingWeight • boundaryPoint plane inside outside = point := by
    rw [boundaryPointEq, ← pointEq]
    apply vec2EquivProd.injective
    apply Prod.ext
    · change
        retainedWeight * inside.x + boundaryWeight * boundary.x +
              crossingWeight *
                (inside.x + (outside.x - inside.x) * parameter) =
          insideWeight * inside.x + boundaryWeight * boundary.x +
            outsideWeight * outside.x
      linear_combination
        insideCoefficient * inside.x + crossingParameter * outside.x
    · change
        retainedWeight * inside.y + boundaryWeight * boundary.y +
              crossingWeight *
                (inside.y + (outside.y - inside.y) * parameter) =
          insideWeight * inside.y + boundaryWeight * boundary.y +
            outsideWeight * outside.y
      linear_combination
        insideCoefficient * inside.y + crossingParameter * outside.y
  apply mem_convexHull_of_exists_fintype weight generator weightsNonnegative weightsSum
  · intro index
    fin_cases index
    · exact Or.inl rfl
    · exact Or.inr (Or.inl rfl)
    · exact Or.inr (Or.inr rfl)
  · rw [Fin.sum_univ_three]
    exact generatedPointEq

/-- If one vertex is on the boundary and the other two are strictly outside,
the only retained barycentric point is the boundary vertex. -/
theorem oneBoundary_twoOutside_barycentric_mem_generatorHull
    (plane : HalfPlane R) (boundary outside₁ outside₂ point : Vec2 R)
    (boundaryWeight outside₁Weight outside₂Weight : R)
    (outside₁WeightNonnegative : 0 ≤ outside₁Weight)
    (outside₂WeightNonnegative : 0 ≤ outside₂Weight)
    (weightSum : boundaryWeight + outside₁Weight + outside₂Weight = 1)
    (pointEq :
      boundaryWeight • boundary + outside₁Weight • outside₁ +
        outside₂Weight • outside₂ = point)
    (boundaryEq : signedDistance plane boundary = 0)
    (outside₁Strict : 0 < signedDistance plane outside₁)
    (outside₂Strict : 0 < signedDistance plane outside₂)
    (weightedDistanceInside :
      boundaryWeight * signedDistance plane boundary +
          outside₁Weight * signedDistance plane outside₁ +
        outside₂Weight * signedDistance plane outside₂ ≤ 0) :
    point ∈ convexHull R { generator | generator = boundary } := by
  have firstTermNonnegative :
      0 ≤ outside₁Weight * signedDistance plane outside₁ :=
    mul_nonneg outside₁WeightNonnegative (le_of_lt outside₁Strict)
  have secondTermNonnegative :
      0 ≤ outside₂Weight * signedDistance plane outside₂ :=
    mul_nonneg outside₂WeightNonnegative (le_of_lt outside₂Strict)
  have firstTermZero :
      outside₁Weight * signedDistance plane outside₁ = 0 := by
    rw [boundaryEq] at weightedDistanceInside
    linarith
  have secondTermZero :
      outside₂Weight * signedDistance plane outside₂ = 0 := by
    rw [boundaryEq] at weightedDistanceInside
    linarith
  have outside₁WeightZero : outside₁Weight = 0 :=
    (mul_eq_zero.mp firstTermZero).resolve_right (ne_of_gt outside₁Strict)
  have outside₂WeightZero : outside₂Weight = 0 :=
    (mul_eq_zero.mp secondTermZero).resolve_right (ne_of_gt outside₂Strict)
  have boundaryWeightOne : boundaryWeight = 1 := by
    linarith
  have pointIsBoundary : point = boundary := by
    rw [← pointEq, outside₁WeightZero, outside₂WeightZero,
      boundaryWeightOne]
    simp
  rw [pointIsBoundary]
  exact subset_convexHull R _ rfl

/-- If two vertices are on the boundary and the third is strictly outside,
every retained barycentric point lies on the boundary segment. -/
theorem twoBoundary_oneOutside_barycentric_mem_generatorHull
    (plane : HalfPlane R) (boundary₁ boundary₂ outside point : Vec2 R)
    (boundary₁Weight boundary₂Weight outsideWeight : R)
    (boundary₁WeightNonnegative : 0 ≤ boundary₁Weight)
    (boundary₂WeightNonnegative : 0 ≤ boundary₂Weight)
    (outsideWeightNonnegative : 0 ≤ outsideWeight)
    (weightSum : boundary₁Weight + boundary₂Weight + outsideWeight = 1)
    (pointEq :
      boundary₁Weight • boundary₁ + boundary₂Weight • boundary₂ +
        outsideWeight • outside = point)
    (boundary₁Eq : signedDistance plane boundary₁ = 0)
    (boundary₂Eq : signedDistance plane boundary₂ = 0)
    (outsideStrict : 0 < signedDistance plane outside)
    (weightedDistanceInside :
      boundary₁Weight * signedDistance plane boundary₁ +
          boundary₂Weight * signedDistance plane boundary₂ +
        outsideWeight * signedDistance plane outside ≤ 0) :
    point ∈ convexHull R
      { generator | generator = boundary₁ ∨ generator = boundary₂ } := by
  have outsideTermNonnegative :
      0 ≤ outsideWeight * signedDistance plane outside :=
    mul_nonneg outsideWeightNonnegative (le_of_lt outsideStrict)
  have outsideTermZero : outsideWeight * signedDistance plane outside = 0 := by
    rw [boundary₁Eq, boundary₂Eq] at weightedDistanceInside
    linarith
  have outsideWeightZero : outsideWeight = 0 :=
    (mul_eq_zero.mp outsideTermZero).resolve_right (ne_of_gt outsideStrict)
  have boundaryWeightSum : boundary₁Weight + boundary₂Weight = 1 := by
    linarith
  have segmentPointEq :
      boundary₁Weight • boundary₁ + boundary₂Weight • boundary₂ = point := by
    rw [← pointEq, outsideWeightZero]
    simp
  rw [← segmentPointEq]
  exact (convex_convexHull R
    { generator | generator = boundary₁ ∨ generator = boundary₂ })
    (subset_convexHull R _ (Or.inl rfl))
    (subset_convexHull R _ (Or.inr rfl))
    boundary₁WeightNonnegative boundary₂WeightNonnegative boundaryWeightSum

/-- First vertex on the boundary, second strictly inside, third strictly
outside. -/
theorem triangle_boundaryGeneratorHullComplete_of_boundary_inside_outside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstBoundary : signedDistance plane (vertex ⟨0, by omega⟩) = 0)
    (secondInside : signedDistance plane (vertex ⟨1, by omega⟩) < 0)
    (thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩)) :
    BoundaryGeneratorHullComplete plane vertex := by
  apply triangle_boundaryGeneratorHullComplete_of_barycentric_transport
    plane vertex ordered
    { generator |
      generator = vertex ⟨1, by omega⟩ ∨
        generator = vertex ⟨0, by omega⟩ ∨
        generator = boundaryPoint plane (vertex ⟨1, by omega⟩)
          (vertex ⟨2, by omega⟩) }
  · intro generator generatorMember
    rcases generatorMember with rfl | rfl | rfl
    · exact Or.inl ⟨⟨1, by omega⟩, rfl, le_of_lt secondInside⟩
    · exact Or.inl ⟨⟨0, by omega⟩, rfl, le_of_eq firstBoundary⟩
    · refine Or.inr ⟨⟨1, by omega⟩, ?_, ?_⟩
      · simp [nextIndex]
      · exact Or.inl ⟨le_of_lt secondInside, by exact thirdOutside⟩
  · intro point firstWeight secondWeight thirdWeight
      firstWeightNonnegative secondWeightNonnegative thirdWeightNonnegative
      weightSum pointEq weightedDistanceInside
    have reorderedWeightSum :
        secondWeight + firstWeight + thirdWeight = 1 := by linarith
    have reorderedPointEq :
        secondWeight • vertex ⟨1, by omega⟩ +
              firstWeight • vertex ⟨0, by omega⟩ +
            thirdWeight • vertex ⟨2, by omega⟩ = point := by
      calc
        secondWeight • vertex ⟨1, by omega⟩ +
              firstWeight • vertex ⟨0, by omega⟩ +
            thirdWeight • vertex ⟨2, by omega⟩ =
          firstWeight • vertex ⟨0, by omega⟩ +
              secondWeight • vertex ⟨1, by omega⟩ +
            thirdWeight • vertex ⟨2, by omega⟩ := by abel
        _ = point := pointEq
    apply oneInside_oneBoundary_oneOutside_barycentric_mem_generatorHull
      plane (vertex ⟨1, by omega⟩) (vertex ⟨0, by omega⟩)
      (vertex ⟨2, by omega⟩) point secondWeight firstWeight thirdWeight
      firstWeightNonnegative thirdWeightNonnegative reorderedWeightSum
      reorderedPointEq secondInside firstBoundary thirdOutside
    rw [show
      secondWeight * signedDistance plane (vertex ⟨1, by omega⟩) +
            firstWeight * signedDistance plane (vertex ⟨0, by omega⟩) +
          thirdWeight * signedDistance plane (vertex ⟨2, by omega⟩) =
        firstWeight * signedDistance plane (vertex ⟨0, by omega⟩) +
            secondWeight * signedDistance plane (vertex ⟨1, by omega⟩) +
          thirdWeight * signedDistance plane (vertex ⟨2, by omega⟩) by ring]
    exact weightedDistanceInside

/-- First vertex on the boundary, second strictly outside, third strictly
inside. -/
theorem triangle_boundaryGeneratorHullComplete_of_boundary_outside_inside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstBoundary : signedDistance plane (vertex ⟨0, by omega⟩) = 0)
    (secondOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩))
    (thirdInside : signedDistance plane (vertex ⟨2, by omega⟩) < 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  apply triangle_boundaryGeneratorHullComplete_of_barycentric_transport
    plane vertex ordered
    { generator |
      generator = vertex ⟨2, by omega⟩ ∨
        generator = vertex ⟨0, by omega⟩ ∨
        generator = boundaryPoint plane (vertex ⟨2, by omega⟩)
          (vertex ⟨1, by omega⟩) }
  · intro generator generatorMember
    rcases generatorMember with rfl | rfl | rfl
    · exact Or.inl ⟨⟨2, by omega⟩, rfl, le_of_lt thirdInside⟩
    · exact Or.inl ⟨⟨0, by omega⟩, rfl, le_of_eq firstBoundary⟩
    · refine Or.inr ⟨⟨1, by omega⟩, ?_, ?_⟩
      · have swapped := boundaryPoint_swap plane
          (vertex ⟨2, by omega⟩) (vertex ⟨1, by omega⟩) (by
            intro equalDistance
            linarith)
        simpa [nextIndex] using swapped
      · exact Or.inr ⟨by exact secondOutside, by exact le_of_lt thirdInside⟩
  · intro point firstWeight secondWeight thirdWeight
      firstWeightNonnegative secondWeightNonnegative thirdWeightNonnegative
      weightSum pointEq weightedDistanceInside
    have reorderedWeightSum :
        thirdWeight + firstWeight + secondWeight = 1 := by linarith
    have reorderedPointEq :
        thirdWeight • vertex ⟨2, by omega⟩ +
              firstWeight • vertex ⟨0, by omega⟩ +
            secondWeight • vertex ⟨1, by omega⟩ = point := by
      calc
        thirdWeight • vertex ⟨2, by omega⟩ +
              firstWeight • vertex ⟨0, by omega⟩ +
            secondWeight • vertex ⟨1, by omega⟩ =
          firstWeight • vertex ⟨0, by omega⟩ +
              secondWeight • vertex ⟨1, by omega⟩ +
            thirdWeight • vertex ⟨2, by omega⟩ := by abel
        _ = point := pointEq
    apply oneInside_oneBoundary_oneOutside_barycentric_mem_generatorHull
      plane (vertex ⟨2, by omega⟩) (vertex ⟨0, by omega⟩)
      (vertex ⟨1, by omega⟩) point thirdWeight firstWeight secondWeight
      firstWeightNonnegative secondWeightNonnegative reorderedWeightSum
      reorderedPointEq thirdInside firstBoundary secondOutside
    rw [show
      thirdWeight * signedDistance plane (vertex ⟨2, by omega⟩) +
            firstWeight * signedDistance plane (vertex ⟨0, by omega⟩) +
          secondWeight * signedDistance plane (vertex ⟨1, by omega⟩) =
        firstWeight * signedDistance plane (vertex ⟨0, by omega⟩) +
            secondWeight * signedDistance plane (vertex ⟨1, by omega⟩) +
          thirdWeight * signedDistance plane (vertex ⟨2, by omega⟩) by ring]
    exact weightedDistanceInside

/-- First and second vertices on the boundary, third strictly outside. -/
theorem triangle_boundaryGeneratorHullComplete_of_boundary_boundary_outside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstBoundary : signedDistance plane (vertex ⟨0, by omega⟩) = 0)
    (secondBoundary : signedDistance plane (vertex ⟨1, by omega⟩) = 0)
    (thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩)) :
    BoundaryGeneratorHullComplete plane vertex := by
  apply triangle_boundaryGeneratorHullComplete_of_barycentric_transport
    plane vertex ordered
    { generator |
      generator = vertex ⟨0, by omega⟩ ∨
        generator = vertex ⟨1, by omega⟩ }
  · intro generator generatorMember
    rcases generatorMember with rfl | rfl
    · exact Or.inl ⟨⟨0, by omega⟩, rfl, le_of_eq firstBoundary⟩
    · exact Or.inl ⟨⟨1, by omega⟩, rfl, le_of_eq secondBoundary⟩
  · intro point firstWeight secondWeight thirdWeight
      firstWeightNonnegative secondWeightNonnegative thirdWeightNonnegative
      weightSum pointEq weightedDistanceInside
    exact twoBoundary_oneOutside_barycentric_mem_generatorHull
      plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
      (vertex ⟨2, by omega⟩) point firstWeight secondWeight thirdWeight
      firstWeightNonnegative secondWeightNonnegative thirdWeightNonnegative
      weightSum pointEq firstBoundary secondBoundary thirdOutside
      weightedDistanceInside

/-- First vertex on the boundary, the other two strictly outside. -/
theorem triangle_boundaryGeneratorHullComplete_of_boundary_outside_outside
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstBoundary : signedDistance plane (vertex ⟨0, by omega⟩) = 0)
    (secondOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩))
    (thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩)) :
    BoundaryGeneratorHullComplete plane vertex := by
  apply triangle_boundaryGeneratorHullComplete_of_barycentric_transport
    plane vertex ordered { generator | generator = vertex ⟨0, by omega⟩ }
  · intro generator generatorMember
    rw [generatorMember]
    exact Or.inl ⟨⟨0, by omega⟩, rfl, le_of_eq firstBoundary⟩
  · intro point firstWeight secondWeight thirdWeight
      _ secondWeightNonnegative thirdWeightNonnegative
      weightSum pointEq weightedDistanceInside
    exact oneBoundary_twoOutside_barycentric_mem_generatorHull
      plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩)
      (vertex ⟨2, by omega⟩) point firstWeight secondWeight thirdWeight
      secondWeightNonnegative thirdWeightNonnegative weightSum pointEq
      firstBoundary secondOutside thirdOutside weightedDistanceInside

/-- A strict triangle is complete whenever its first vertex lies on the clip
boundary, for every sign pattern of the remaining vertices. -/
theorem triangle_boundaryGeneratorHullComplete_of_first_boundary
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (firstBoundary : signedDistance plane (vertex ⟨0, by omega⟩) = 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  by_cases secondNonpositive :
      signedDistance plane (vertex ⟨1, by omega⟩) ≤ 0
  · by_cases thirdNonpositive :
        signedDistance plane (vertex ⟨2, by omega⟩) ≤ 0
    · have allInside : ∀ index, signedDistance plane (vertex index) ≤ 0 := by
        intro index
        fin_cases index
        · exact le_of_eq firstBoundary
        · exact secondNonpositive
        · exact thirdNonpositive
      exact (clipRegionComplete_iff_boundaryGeneratorHullComplete
        plane vertex).mp (clipRegionComplete_of_all_nonpos plane vertex allInside)
    · have thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩) :=
        lt_of_not_ge thirdNonpositive
      by_cases secondBoundary : signedDistance plane (vertex ⟨1, by omega⟩) = 0
      · exact triangle_boundaryGeneratorHullComplete_of_boundary_boundary_outside
          plane vertex ordered firstBoundary secondBoundary thirdOutside
      · have secondInside : signedDistance plane (vertex ⟨1, by omega⟩) < 0 :=
          lt_of_le_of_ne secondNonpositive secondBoundary
        exact triangle_boundaryGeneratorHullComplete_of_boundary_inside_outside
          plane vertex ordered firstBoundary secondInside thirdOutside
  · have secondOutside : 0 < signedDistance plane (vertex ⟨1, by omega⟩) :=
      lt_of_not_ge secondNonpositive
    by_cases thirdNonpositive :
        signedDistance plane (vertex ⟨2, by omega⟩) ≤ 0
    · by_cases thirdBoundary : signedDistance plane (vertex ⟨2, by omega⟩) = 0
      · let start : RingIndex 0 := ⟨2, by omega⟩
        have rotatedComplete :
            BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
          apply triangle_boundaryGeneratorHullComplete_of_boundary_boundary_outside
          · exact ordered.rotateVertex start
          · change signedDistance plane
                (rotateVertex start vertex ⟨0, by omega⟩) = 0
            rw [SeamSupportSemantics.rotateVertex_zero]
            exact thirdBoundary
          · change signedDistance plane
                (rotateVertex start vertex ⟨1, by omega⟩) = 0
            rw [SeamSupportSemantics.rotateVertex_one]
            simpa [start, nextIndex] using firstBoundary
          · change 0 < signedDistance plane
                (rotateVertex start vertex ⟨2, by omega⟩)
            rw [SeamSupportSemantics.rotateVertex_two]
            simpa [start, nextIndex] using secondOutside
        exact (boundaryGeneratorHullComplete_rotateVertex_iff
          plane start vertex).mp rotatedComplete
      · have thirdInside : signedDistance plane (vertex ⟨2, by omega⟩) < 0 :=
          lt_of_le_of_ne thirdNonpositive thirdBoundary
        exact triangle_boundaryGeneratorHullComplete_of_boundary_outside_inside
          plane vertex ordered firstBoundary secondOutside thirdInside
    · have thirdOutside : 0 < signedDistance plane (vertex ⟨2, by omega⟩) :=
        lt_of_not_ge thirdNonpositive
      exact triangle_boundaryGeneratorHullComplete_of_boundary_outside_outside
        plane vertex ordered firstBoundary secondOutside thirdOutside

/-- The location of a boundary vertex is irrelevant by cyclic reindexing. -/
theorem strictTriangle_boundaryGeneratorHullComplete_of_has_boundary
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (hasBoundary : ∃ index, signedDistance plane (vertex index) = 0) :
    BoundaryGeneratorHullComplete plane vertex := by
  rcases hasBoundary with ⟨index, boundaryEq⟩
  fin_cases index
  · exact triangle_boundaryGeneratorHullComplete_of_first_boundary
      plane vertex ordered boundaryEq
  · let start : RingIndex 0 := ⟨1, by omega⟩
    have rotatedComplete :
        BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
      apply triangle_boundaryGeneratorHullComplete_of_first_boundary
      · exact ordered.rotateVertex start
      · change signedDistance plane
            (rotateVertex start vertex ⟨0, by omega⟩) = 0
        rw [SeamSupportSemantics.rotateVertex_zero]
        exact boundaryEq
    exact (boundaryGeneratorHullComplete_rotateVertex_iff
      plane start vertex).mp rotatedComplete
  · let start : RingIndex 0 := ⟨2, by omega⟩
    have rotatedComplete :
        BoundaryGeneratorHullComplete plane (rotateVertex start vertex) := by
      apply triangle_boundaryGeneratorHullComplete_of_first_boundary
      · exact ordered.rotateVertex start
      · change signedDistance plane
            (rotateVertex start vertex ⟨0, by omega⟩) = 0
        rw [SeamSupportSemantics.rotateVertex_zero]
        exact boundaryEq
    exact (boundaryGeneratorHullComplete_rotateVertex_iff
      plane start vertex).mp rotatedComplete

/-- Every strict ordered triangle satisfies pure boundary-generator
completeness, including clipping lines through one or more input vertices. -/
theorem strictTriangle_boundaryGeneratorHullComplete
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    BoundaryGeneratorHullComplete plane vertex := by
  by_cases hasBoundary : ∃ index, signedDistance plane (vertex index) = 0
  · exact strictTriangle_boundaryGeneratorHullComplete_of_has_boundary
      plane vertex ordered hasBoundary
  · apply strictTriangle_boundaryGeneratorHullComplete_of_no_boundary
      plane vertex ordered
    intro index boundaryEq
    exact hasBoundary ⟨index, boundaryEq⟩

/-- The executable clip of every strict ordered triangle has exact continuous
convex-region semantics, with no generic-position assumption. -/
theorem strictTriangle_clipIndexedConvexRegion_eq
    (plane : HalfPlane R) (vertex : RingIndex 0 → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    clipIndexedConvexRegion plane vertex =
      indexedVertexConvexRegion vertex ∩ halfPlaneRegion plane := by
  exact clipIndexedConvexRegion_eq_of_boundaryGeneratorHullComplete plane vertex
    (strictTriangle_boundaryGeneratorHullComplete plane vertex ordered)

end Sprawlens.TriangleBoundaryClipCompleteness
