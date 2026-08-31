import Sprawlens.PairwiseClipCompleteness

namespace Sprawlens.PairwiseBarycentricFlow

open scoped BigOperators

open FiniteMassTransport
open ExactGeometry
open HalfPlaneClipPoints
open PairwiseClipCompleteness
open SimpleRing

universe u v

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]
variable {Index : Type v} [Fintype Index]

/-- Indices whose signed distance is retained by the closed half-plane. -/
abbrev InsideIndex (distance : Index → R) :=
  { index : Index // distance index ≤ 0 }

/-- Complementary indices with strictly positive signed distance. -/
abbrev OutsideIndex (distance : Index → R) :=
  { index : Index // ¬ distance index ≤ 0 }

/-- Available negative signed-distance mass at an inside index. -/
def distanceCapacity (weight distance : Index → R)
    (inside : InsideIndex distance) : R :=
  -(weight inside * distance inside)

/-- Positive signed-distance mass that must be absorbed for an outside index. -/
def distanceDemand (weight distance : Index → R)
    (outside : OutsideIndex distance) : R :=
  weight outside * distance outside

omit [IsStrictOrderedRing R] [Fintype Index] in
theorem outsideDistancePositive (distance : Index → R)
    (outside : OutsideIndex distance) :
    0 < distance outside :=
  lt_of_not_ge outside.property

omit [Fintype Index] in
theorem distanceCapacity_nonnegative
    (weight distance : Index → R)
    (weightNonnegative : ∀ index, 0 ≤ weight index)
    (inside : InsideIndex distance) :
    0 ≤ distanceCapacity weight distance inside := by
  unfold distanceCapacity
  exact neg_nonneg.mpr
    (mul_nonpos_of_nonneg_of_nonpos (weightNonnegative inside) inside.property)

omit [Fintype Index] in
theorem distanceDemand_nonnegative
    (weight distance : Index → R)
    (weightNonnegative : ∀ index, 0 ≤ weight index)
    (outside : OutsideIndex distance) :
    0 ≤ distanceDemand weight distance outside := by
  unfold distanceDemand
  exact mul_nonneg (weightNonnegative outside)
    (le_of_lt (outsideDistancePositive distance outside))

/-- A retained affine combination has enough total inside distance capacity to
absorb all outside distance demand. -/
theorem totalDistanceDemand_le_totalCapacity
    (weight distance : Index → R)
    (weightedDistanceInside : ∑ index, weight index * distance index ≤ 0) :
    (∑ outside, distanceDemand weight distance outside) ≤
      ∑ inside, distanceCapacity weight distance inside := by
  have partition := Fintype.sum_subtype_add_sum_subtype
    (p := fun index ↦ distance index ≤ 0)
    (fun index ↦ weight index * distance index)
  simp only [distanceDemand, distanceCapacity]
  rw [Finset.sum_neg_distrib]
  rw [← partition] at weightedDistanceInside
  linarith

/-- If total inside capacity vanishes, every outside barycentric weight must
vanish as well. -/
theorem outsideWeight_eq_zero_of_totalCapacity_eq_zero
    (weight distance : Index → R)
    (weightNonnegative : ∀ index, 0 ≤ weight index)
    (weightedDistanceInside : ∑ index, weight index * distance index ≤ 0)
    (totalCapacityZero :
      (∑ inside, distanceCapacity weight distance inside) = 0)
    (outside : OutsideIndex distance) :
    weight outside = 0 := by
  have demandAtMostCapacity := totalDistanceDemand_le_totalCapacity
    weight distance weightedDistanceInside
  have eachDemandNonnegative := distanceDemand_nonnegative
    weight distance weightNonnegative
  have outsideDemandAtMostTotal :
      distanceDemand weight distance outside ≤
        ∑ index, distanceDemand weight distance index := by
    exact Finset.single_le_sum
      (fun index _ ↦ eachDemandNonnegative index) (Finset.mem_univ outside)
  have outsideDemandZero : distanceDemand weight distance outside = 0 := by
    rw [totalCapacityZero] at demandAtMostCapacity
    have outsideDemandNonnegative := eachDemandNonnegative outside
    linarith
  unfold distanceDemand at outsideDemandZero
  exact (mul_eq_zero.mp outsideDemandZero).resolve_right
    (ne_of_gt (outsideDistancePositive distance outside))

/-- In the positive-capacity branch, proportional transport is nonnegative,
meets every outside distance demand, and does not overdraw an inside row. -/
theorem proportionalDistanceFlow_contract
    (weight distance : Index → R)
    (weightNonnegative : ∀ index, 0 ≤ weight index)
    (weightedDistanceInside : ∑ index, weight index * distance index ≤ 0)
    (totalCapacityPositive :
      0 < ∑ inside, distanceCapacity weight distance inside) :
    (∀ inside outside,
      0 ≤ proportionalFlow
        (distanceCapacity weight distance) (distanceDemand weight distance)
        inside outside) ∧
    (∀ outside,
      (∑ inside, proportionalFlow
        (distanceCapacity weight distance) (distanceDemand weight distance)
        inside outside) = distanceDemand weight distance outside) ∧
    (∀ inside,
      (∑ outside, proportionalFlow
        (distanceCapacity weight distance) (distanceDemand weight distance)
        inside outside) ≤ distanceCapacity weight distance inside) := by
  have capacityNonnegative := distanceCapacity_nonnegative
    weight distance weightNonnegative
  have demandNonnegative := distanceDemand_nonnegative
    weight distance weightNonnegative
  have demandAtMostCapacity := totalDistanceDemand_le_totalCapacity
    weight distance weightedDistanceInside
  exact ⟨
    fun inside outside ↦ proportionalFlow_nonnegative
      (distanceCapacity weight distance) (distanceDemand weight distance)
      capacityNonnegative demandNonnegative totalCapacityPositive inside outside,
    fun outside ↦ sum_proportionalFlow_over_inside
      (distanceCapacity weight distance) (distanceDemand weight distance)
      totalCapacityPositive outside,
    fun inside ↦ sum_proportionalFlow_over_outside_le_capacity
      (distanceCapacity weight distance) (distanceDemand weight distance)
      capacityNonnegative totalCapacityPositive demandAtMostCapacity inside
  ⟩

/-- Amount of an inside vertex coefficient consumed by a distance-mass flow.
Boundary vertices consume no coefficient: their distance capacity is zero. -/
def insideCoefficientUse
    (distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (inside : InsideIndex distance) : R :=
  if _signed : distance inside < 0 then
    (∑ outside, flow inside outside) / (-distance inside)
  else 0

/-- Convex weight placed on the boundary crossing for an inside/outside pair. -/
def crossingCoefficient
    (distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (inside : InsideIndex distance) (outside : OutsideIndex distance) : R :=
  if _signed : distance inside < 0 then
    flow inside outside * (distance outside - distance inside) /
      ((-distance inside) * distance outside)
  else 0

theorem insideCoefficientUse_nonnegative
    (distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (inside : InsideIndex distance) :
    0 ≤ insideCoefficientUse distance flow inside := by
  unfold insideCoefficientUse
  split_ifs with signed
  · exact div_nonneg (Finset.sum_nonneg fun outside _ ↦
      flowNonnegative inside outside) (neg_nonneg.mpr (le_of_lt signed))
  · exact le_rfl

omit [Fintype Index] in
theorem crossingCoefficient_nonnegative
    (distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (inside : InsideIndex distance) (outside : OutsideIndex distance) :
    0 ≤ crossingCoefficient distance flow inside outside := by
  unfold crossingCoefficient
  split_ifs with insideNegative
  · have outsidePositive := outsideDistancePositive distance outside
    exact div_nonneg
      (mul_nonneg (flowNonnegative inside outside)
        (sub_nonneg.mpr (le_trans (le_of_lt insideNegative)
          (le_of_lt outsidePositive))))
      (mul_nonneg (neg_nonneg.mpr (le_of_lt insideNegative))
        (le_of_lt outsidePositive))
  · exact le_rfl

omit [Fintype Index] in
/-- One crossing coefficient expands into exactly the inside and outside
coefficient shares encoded by its signed-distance flow. -/
theorem crossingCoefficient_smul_boundaryPoint
    (plane : HalfPlaneClipPoints.HalfPlane R)
    (point : Index → ExactGeometry.Vec2 R)
    (distanceEq : ∀ index, distance index =
      HalfPlaneClipPoints.signedDistance plane (point index))
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (inside : InsideIndex distance) (outside : OutsideIndex distance)
    (insideNegative : distance inside < 0) :
    crossingCoefficient distance flow inside outside •
        HalfPlaneClipPoints.boundaryPoint plane (point inside) (point outside) =
      ((flow inside outside / (-distance inside)) • point inside) +
        ((flow inside outside / distance outside) • point outside) := by
  have outsidePositive := outsideDistancePositive distance outside
  have distanceDistinct : distance inside ≠ distance outside := by linarith
  apply Vec2Linear.vec2EquivProd.injective
  apply Prod.ext
  · change
      crossingCoefficient distance flow inside outside *
          ((point inside).x + ((point outside).x - (point inside).x) *
            HalfPlaneIntersection.boundaryParameter
              (HalfPlaneClipPoints.signedDistance plane (point inside))
              (HalfPlaneClipPoints.signedDistance plane (point outside))) =
        (flow inside outside / (-distance inside)) * (point inside).x +
          (flow inside outside / distance outside) * (point outside).x
    rw [← distanceEq (inside : Index), ← distanceEq (outside : Index)]
    simp only [crossingCoefficient, dif_pos insideNegative,
      HalfPlaneIntersection.boundaryParameter]
    field_simp [ne_of_lt insideNegative, ne_of_gt outsidePositive,
      distanceDistinct]
    ring
  · change
      crossingCoefficient distance flow inside outside *
          ((point inside).y + ((point outside).y - (point inside).y) *
            HalfPlaneIntersection.boundaryParameter
              (HalfPlaneClipPoints.signedDistance plane (point inside))
              (HalfPlaneClipPoints.signedDistance plane (point outside))) =
        (flow inside outside / (-distance inside)) * (point inside).y +
          (flow inside outside / distance outside) * (point outside).y
    rw [← distanceEq (inside : Index), ← distanceEq (outside : Index)]
    simp only [crossingCoefficient, dif_pos insideNegative,
      HalfPlaneIntersection.boundaryParameter]
    field_simp [ne_of_lt insideNegative, ne_of_gt outsidePositive,
      distanceDistinct]
    ring

/-- A zero-distance inside row has zero flow when the row is nonnegative and
bounded by its distance capacity. -/
theorem flow_eq_zero_of_inside_boundary
    (weight distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (rowBound : ∀ inside,
      (∑ outside, flow inside outside) ≤
        distanceCapacity weight distance inside)
    (inside : InsideIndex distance) (outside : OutsideIndex distance)
    (insideNotNegative : ¬ distance inside < 0) :
    flow inside outside = 0 := by
  have insideZero : distance inside = 0 := by
    exact le_antisymm inside.property (le_of_not_gt insideNotNegative)
  have flowAtMostRow : flow inside outside ≤ ∑ other, flow inside other := by
    exact Finset.single_le_sum
      (fun other _ ↦ flowNonnegative inside other) (Finset.mem_univ outside)
  have rowAtMostZero : (∑ other, flow inside other) ≤ 0 := by
    simpa [distanceCapacity, insideZero] using rowBound inside
  exact le_antisymm (le_trans flowAtMostRow rowAtMostZero)
    (flowNonnegative inside outside)

/-- The crossing weight is the sum of the inside and outside coefficient
shares carried by its distance-mass flow. -/
theorem crossingCoefficient_eq_shares
    (weight distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (rowBound : ∀ inside,
      (∑ outside, flow inside outside) ≤
        distanceCapacity weight distance inside)
    (inside : InsideIndex distance) (outside : OutsideIndex distance) :
    crossingCoefficient distance flow inside outside =
      flow inside outside / (-distance inside) +
        flow inside outside / distance outside := by
  unfold crossingCoefficient
  split_ifs with insideNegative
  · have outsidePositive := outsideDistancePositive distance outside
    field_simp [ne_of_lt insideNegative, ne_of_gt outsidePositive]
    ring
  · have flowZero := flow_eq_zero_of_inside_boundary weight distance flow
      flowNonnegative rowBound inside outside insideNegative
    simp [flowZero]

/-- The row-level inside coefficient use is the sum of its pairwise shares. -/
theorem insideCoefficientUse_eq_sum_shares
    (weight distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (rowBound : ∀ inside,
      (∑ outside, flow inside outside) ≤
        distanceCapacity weight distance inside)
    (inside : InsideIndex distance) :
    insideCoefficientUse distance flow inside =
      ∑ outside, flow inside outside / (-distance inside) := by
  unfold insideCoefficientUse
  split_ifs with insideNegative
  · rw [Finset.sum_div]
  · have allZero : ∀ outside, flow inside outside = 0 := fun outside ↦
      flow_eq_zero_of_inside_boundary weight distance flow flowNonnegative
        rowBound inside outside insideNegative
    simp [allZero]

/-- A capacity-bounded row never consumes more than its original inside
vertex coefficient. -/
theorem insideCoefficientUse_le_weight
    (weight distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (weightNonnegative : ∀ index, 0 ≤ weight index)
    (rowBound : ∀ inside,
      (∑ outside, flow inside outside) ≤
        distanceCapacity weight distance inside)
    (inside : InsideIndex distance) :
    insideCoefficientUse distance flow inside ≤ weight inside := by
  unfold insideCoefficientUse
  split_ifs with insideNegative
  · rw [div_le_iff₀ (neg_pos.mpr insideNegative)]
    have bound := rowBound inside
    unfold distanceCapacity at bound
    nlinarith
  · exact weightNonnegative inside

omit [IsStrictOrderedRing R] in
/-- Exact column transport turns outside distance shares back into the
original outside barycentric weight. -/
theorem sum_flow_div_outsideDistance
    (weight distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (columnExact : ∀ outside,
      (∑ inside, flow inside outside) =
        distanceDemand weight distance outside)
    (outside : OutsideIndex distance) :
    (∑ inside, flow inside outside / distance outside) = weight outside := by
  rw [← Finset.sum_div, columnExact outside]
  unfold distanceDemand
  field_simp [ne_of_gt (outsideDistancePositive distance outside)]

/-- The total crossing coefficient is exactly the consumed inside
coefficient plus all outside coefficients. -/
theorem sum_crossingCoefficient
    (weight distance : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (columnExact : ∀ outside,
      (∑ inside, flow inside outside) =
        distanceDemand weight distance outside)
    (rowBound : ∀ inside,
      (∑ outside, flow inside outside) ≤
        distanceCapacity weight distance inside) :
    (∑ inside, ∑ outside,
      crossingCoefficient distance flow inside outside) =
      (∑ inside, insideCoefficientUse distance flow inside) +
        ∑ outside : OutsideIndex distance, weight outside := by
  calc
    (∑ inside, ∑ outside,
        crossingCoefficient distance flow inside outside) =
        ∑ inside, ∑ outside,
          (flow inside outside / (-distance inside) +
            flow inside outside / distance outside) := by
      apply Finset.sum_congr rfl
      intro inside _
      apply Finset.sum_congr rfl
      intro outside _
      exact crossingCoefficient_eq_shares weight distance flow
        flowNonnegative rowBound inside outside
    _ = (∑ inside, ∑ outside,
          flow inside outside / (-distance inside)) +
        ∑ inside, ∑ outside,
          flow inside outside / distance outside := by
      simp_rw [Finset.sum_add_distrib]
    _ = (∑ inside, insideCoefficientUse distance flow inside) +
        ∑ outside, ∑ inside,
          flow inside outside / distance outside := by
      congr 1
      · apply Finset.sum_congr rfl
        intro inside _
        exact (insideCoefficientUse_eq_sum_shares weight distance flow
          flowNonnegative rowBound inside).symm
      · exact Finset.sum_comm
    _ = (∑ inside, insideCoefficientUse distance flow inside) +
        ∑ outside : OutsideIndex distance, weight outside := by
      rw [show (∑ outside, ∑ inside,
          flow inside outside / distance outside) =
          ∑ outside : OutsideIndex distance, weight outside by
        apply Finset.sum_congr rfl
        intro outside _
        exact sum_flow_div_outsideDistance weight distance flow
          columnExact outside]

/-- The crossing point contributions reconstruct the consumed inside point
mass and every outside point mass. -/
theorem sum_crossingCoefficient_smul_boundaryPoint
    (plane : HalfPlaneClipPoints.HalfPlane R)
    (point : Index → ExactGeometry.Vec2 R)
    (distance : Index → R)
    (distanceEq : ∀ index, distance index =
      HalfPlaneClipPoints.signedDistance plane (point index))
    (weight : Index → R)
    (flow : InsideIndex distance → OutsideIndex distance → R)
    (flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside)
    (columnExact : ∀ outside,
      (∑ inside, flow inside outside) =
        distanceDemand weight distance outside)
    (rowBound : ∀ inside,
      (∑ outside, flow inside outside) ≤
        distanceCapacity weight distance inside) :
    (∑ inside, ∑ outside,
      crossingCoefficient distance flow inside outside •
        HalfPlaneClipPoints.boundaryPoint plane
          (point inside) (point outside)) =
      (∑ inside,
        insideCoefficientUse distance flow inside • point inside) +
        ∑ outside : OutsideIndex distance,
          weight outside • point outside := by
  have pairExpansion : ∀ inside outside,
      crossingCoefficient distance flow inside outside •
          HalfPlaneClipPoints.boundaryPoint plane
            (point inside) (point outside) =
        (flow inside outside / (-distance inside)) • point inside +
          (flow inside outside / distance outside) • point outside := by
    intro inside outside
    by_cases insideNegative : distance inside < 0
    · exact crossingCoefficient_smul_boundaryPoint plane point distanceEq flow
        inside outside insideNegative
    · have flowZero := flow_eq_zero_of_inside_boundary weight distance flow
        flowNonnegative rowBound inside outside insideNegative
      simp [crossingCoefficient, insideNegative, flowZero]
  calc
    (∑ inside, ∑ outside,
        crossingCoefficient distance flow inside outside •
          HalfPlaneClipPoints.boundaryPoint plane
            (point inside) (point outside)) =
        ∑ inside, ∑ outside,
          ((flow inside outside / (-distance inside)) • point inside +
            (flow inside outside / distance outside) • point outside) := by
      apply Finset.sum_congr rfl
      intro inside _
      apply Finset.sum_congr rfl
      intro outside _
      exact pairExpansion inside outside
    _ = (∑ inside, ∑ outside,
          (flow inside outside / (-distance inside)) • point inside) +
        ∑ inside, ∑ outside,
          (flow inside outside / distance outside) • point outside := by
      simp_rw [Finset.sum_add_distrib]
    _ = (∑ inside,
          insideCoefficientUse distance flow inside • point inside) +
        ∑ outside, (∑ inside,
          flow inside outside / distance outside) • point outside := by
      congr 1
      · apply Finset.sum_congr rfl
        intro inside _
        rw [← Finset.sum_smul]
        rw [← insideCoefficientUse_eq_sum_shares weight distance flow
          flowNonnegative rowBound inside]
      · rw [Finset.sum_comm]
        apply Finset.sum_congr rfl
        intro outside _
        rw [← Finset.sum_smul]
    _ = (∑ inside,
          insideCoefficientUse distance flow inside • point inside) +
        ∑ outside : OutsideIndex distance,
          weight outside • point outside := by
      rw [show (∑ outside, (∑ inside,
          flow inside outside / distance outside) • point outside) =
          ∑ outside : OutsideIndex distance,
            weight outside • point outside by
        apply Finset.sum_congr rfl
        intro outside _
        rw [sum_flow_div_outsideDistance weight distance flow columnExact outside]]

/-- Proportional signed-distance transport supplies the algebraic completeness
witness for every finite retained barycentric combination. -/
theorem pairwiseBarycentricTransport_of_proportionalDistanceFlow
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    PairwiseBarycentricTransport plane vertex := by
  intro Input _ weight source weightNonnegative weightSum
    weightedDistanceInside
  let distance : Input → R := fun index ↦
    signedDistance plane (vertex (source index))
  have distanceEq : ∀ index, distance index =
      signedDistance plane (vertex (source index)) := fun _ ↦ rfl
  have scalarPartition := Fintype.sum_subtype_add_sum_subtype
    (p := fun index ↦ distance index ≤ 0) weight
  have pointPartition := Fintype.sum_subtype_add_sum_subtype
    (p := fun index ↦ distance index ≤ 0)
    (fun index ↦ weight index • vertex (source index))
  by_cases totalCapacityZero :
      (∑ inside, distanceCapacity weight distance inside) = 0
  · have outsideZero : ∀ outside : OutsideIndex distance,
        weight outside = 0 := fun outside ↦
      outsideWeight_eq_zero_of_totalCapacity_eq_zero weight distance
        weightNonnegative weightedDistanceInside totalCapacityZero outside
    refine ⟨InsideIndex distance, inferInstance,
      (fun inside ↦ weight inside),
      (fun inside ↦ vertex (source inside)), ?_, ?_, ?_, ?_⟩
    · intro inside
      exact weightNonnegative inside
    · calc
        (∑ inside : InsideIndex distance, weight inside) =
            (∑ inside : InsideIndex distance, weight inside) +
              ∑ outside : OutsideIndex distance, weight outside := by
                simp [outsideZero]
        _ = ∑ index, weight index := scalarPartition
        _ = 1 := weightSum
    · intro inside
      exact Or.inl ⟨source inside, rfl, by
        simpa [distance] using inside.property⟩
    · calc
        (∑ inside : InsideIndex distance,
            weight inside • vertex (source inside)) =
            (∑ inside : InsideIndex distance,
              weight inside • vertex (source inside)) +
              ∑ outside : OutsideIndex distance,
                weight outside • vertex (source outside) := by
                  simp [outsideZero]
        _ = ∑ index, weight index • vertex (source index) := pointPartition
  · have totalCapacityNonnegative :
        0 ≤ ∑ inside, distanceCapacity weight distance inside :=
      Finset.sum_nonneg fun inside _ ↦
        distanceCapacity_nonnegative weight distance weightNonnegative inside
    have totalCapacityPositive :
        0 < ∑ inside, distanceCapacity weight distance inside :=
      lt_of_le_of_ne totalCapacityNonnegative (Ne.symm totalCapacityZero)
    let flow : InsideIndex distance → OutsideIndex distance → R :=
      proportionalFlow (distanceCapacity weight distance)
        (distanceDemand weight distance)
    have flowContract := proportionalDistanceFlow_contract weight distance
      weightNonnegative weightedDistanceInside totalCapacityPositive
    have flowNonnegative : ∀ inside outside, 0 ≤ flow inside outside :=
      flowContract.1
    have columnExact : ∀ outside,
        (∑ inside, flow inside outside) =
          distanceDemand weight distance outside := flowContract.2.1
    have rowBound : ∀ inside,
        (∑ outside, flow inside outside) ≤
          distanceCapacity weight distance inside := flowContract.2.2
    let Output := Sum (InsideIndex distance)
      (InsideIndex distance × OutsideIndex distance)
    let outputWeight : Output → R
      | .inl inside => weight inside - insideCoefficientUse distance flow inside
      | .inr pair => crossingCoefficient distance flow pair.1 pair.2
    let outputPoint : Output → Vec2 R
      | .inl inside => vertex (source inside)
      | .inr pair => boundaryPoint plane
          (vertex (source pair.1)) (vertex (source pair.2))
    refine ⟨Output, inferInstance, outputWeight, outputPoint, ?_, ?_, ?_, ?_⟩
    · intro output
      cases output with
      | inl inside =>
          exact sub_nonneg.mpr
            (insideCoefficientUse_le_weight weight distance flow
              weightNonnegative rowBound inside)
      | inr pair =>
          exact crossingCoefficient_nonnegative distance flow
            flowNonnegative pair.1 pair.2
    · simp only [outputWeight, Output, Fintype.sum_sum_type]
      rw [Fintype.sum_prod_type]
      rw [sum_crossingCoefficient weight distance flow flowNonnegative
        columnExact rowBound]
      rw [Finset.sum_sub_distrib]
      calc
        ((∑ inside : InsideIndex distance, weight inside) -
              ∑ inside : InsideIndex distance,
                insideCoefficientUse distance flow inside) +
            ((∑ inside : InsideIndex distance,
                insideCoefficientUse distance flow inside) +
              ∑ outside : OutsideIndex distance, weight outside) =
            (∑ inside : InsideIndex distance, weight inside) +
              ∑ outside : OutsideIndex distance, weight outside := by ring
        _ = ∑ index, weight index := scalarPartition
        _ = 1 := weightSum
    · intro output
      cases output with
      | inl inside =>
          exact Or.inl ⟨source inside, rfl, by
            simpa [distance] using inside.property⟩
      | inr pair =>
          exact Or.inr ⟨source pair.1, source pair.2, rfl, Or.inl ⟨by
            simpa [distance] using pair.1.property,
            by simpa [distance] using
              outsideDistancePositive distance pair.2⟩⟩
    · simp only [outputWeight, outputPoint, Output, Fintype.sum_sum_type]
      rw [Fintype.sum_prod_type]
      rw [sum_crossingCoefficient_smul_boundaryPoint plane
        (fun index ↦ vertex (source index)) distance distanceEq weight flow
        flowNonnegative columnExact rowBound]
      simp_rw [sub_smul]
      rw [Finset.sum_sub_distrib]
      calc
        ((∑ inside : InsideIndex distance,
              weight inside • vertex (source inside)) -
              ∑ inside : InsideIndex distance,
                insideCoefficientUse distance flow inside •
                  vertex (source inside)) +
            ((∑ inside : InsideIndex distance,
                insideCoefficientUse distance flow inside •
                  vertex (source inside)) +
              ∑ outside : OutsideIndex distance,
                weight outside • vertex (source outside)) =
            (∑ inside : InsideIndex distance,
              weight inside • vertex (source inside)) +
              ∑ outside : OutsideIndex distance,
                weight outside • vertex (source outside) := by abel
        _ = ∑ index, weight index • vertex (source index) := pointPartition

/-- The all-pairs clipping generator hull is complete for every finite input
vertex family; polygon ordering is not needed for this algebraic layer. -/
theorem pairwiseGeneratorHullComplete
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R) :
    PairwiseGeneratorHullComplete plane vertex :=
  pairwiseGeneratorHullComplete_of_barycentricTransport plane vertex
    (pairwiseBarycentricTransport_of_proportionalDistanceFlow plane vertex)

end Sprawlens.PairwiseBarycentricFlow
