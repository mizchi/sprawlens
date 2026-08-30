import Sprawlens.HalfPlaneClipStep
import Sprawlens.OrderedTriples

namespace Sprawlens.HalfPlaneClipPoints

open ExactGeometry
open HalfPlaneIntersection
open HalfPlaneClipStep
open OrderedTriples

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- An affine closed half-plane `normalX * x + normalY * y - offset ≤ 0`. -/
structure HalfPlane (R : Type u) where
  normalX : R
  normalY : R
  offset : R

def signedDistance (plane : HalfPlane R) (point : Vec2 R) : R :=
  plane.normalX * point.x + plane.normalY * point.y - plane.offset

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem signedDistance_interpolatePoint
    (plane : HalfPlane R) (start finish : Vec2 R) (parameter : R) :
    signedDistance plane (interpolatePoint start finish parameter) =
      interpolateDistance (signedDistance plane start) (signedDistance plane finish) parameter := by
  simp only [signedDistance, interpolatePoint, interpolateDistance]
  ring

def boundaryPoint (plane : HalfPlane R) (current next : Vec2 R) : Vec2 R :=
  interpolatePoint current next
    (boundaryParameter (signedDistance plane current) (signedDistance plane next))

omit [LinearOrder R] [IsStrictOrderedRing R] in
theorem signedDistance_boundaryPoint
    (plane : HalfPlane R) (current next : Vec2 R)
    (distinct : signedDistance plane current ≠ signedDistance plane next) :
    signedDistance plane (boundaryPoint plane current next) = 0 := by
  rw [boundaryPoint, signedDistance_interpolatePoint]
  exact interpolateDistance_boundaryParameter distinct

/-- Exact point-emitting counterpart of the TypeScript clipping step. -/
def outputPoints (plane : HalfPlane R) (current next : Vec2 R) : List (Vec2 R) :=
  let currentDistance := signedDistance plane current
  let nextDistance := signedDistance plane next
  match classify currentDistance nextDistance with
  | .inside => [current]
  | .leaving =>
      if currentDistance = 0 then [current] else [current, boundaryPoint plane current next]
  | .entering =>
      if nextDistance = 0 then [next] else [boundaryPoint plane current next]
  | .outside => []

omit [IsStrictOrderedRing R] in
theorem outputPoints_eq_singleton_of_strict_entering
    (plane : HalfPlane R) (current next : Vec2 R)
    (currentOutside : 0 < signedDistance plane current)
    (nextInside : signedDistance plane next < 0) :
    outputPoints plane current next = [boundaryPoint plane current next] := by
  have classified :
      classify (signedDistance plane current) (signedDistance plane next) = .entering :=
    classify_entering_iff.mpr ⟨currentOutside, le_of_lt nextInside⟩
  have nextNotBoundary : signedDistance plane next ≠ 0 := ne_of_lt nextInside
  simp [outputPoints, classified, nextNotBoundary]

omit [IsStrictOrderedRing R] in
theorem outputPoints_eq_pair_of_strict_leaving
    (plane : HalfPlane R) (current next : Vec2 R)
    (currentInside : signedDistance plane current < 0)
    (nextOutside : 0 < signedDistance plane next) :
    outputPoints plane current next = [current, boundaryPoint plane current next] := by
  have classified :
      classify (signedDistance plane current) (signedDistance plane next) = .leaving :=
    classify_leaving_iff.mpr ⟨le_of_lt currentInside, nextOutside⟩
  have currentNotBoundary : signedDistance plane current ≠ 0 := ne_of_lt currentInside
  simp [outputPoints, classified, currentNotBoundary]

omit [IsStrictOrderedRing R] in
theorem outputPoints_cons_of_current_strictly_inside
    (plane : HalfPlane R) (current next : Vec2 R)
    (currentInside : signedDistance plane current < 0) :
    ∃ tail, outputPoints plane current next = current :: tail := by
  by_cases nextInside : signedDistance plane next ≤ 0
  · have classified :
        classify (signedDistance plane current) (signedDistance plane next) = .inside :=
      classify_inside_iff.mpr ⟨le_of_lt currentInside, nextInside⟩
    exact ⟨[], by simp [outputPoints, classified]⟩
  · have nextOutside : 0 < signedDistance plane next := lt_of_not_ge nextInside
    have outputPair := outputPoints_eq_pair_of_strict_leaving
      plane current next currentInside nextOutside
    exact ⟨[boundaryPoint plane current next], outputPair⟩

omit [IsStrictOrderedRing R] in
theorem outputPoints_eq_nil_of_outside
    (plane : HalfPlane R) (current next : Vec2 R)
    (currentOutside : 0 < signedDistance plane current)
    (nextOutside : 0 < signedDistance plane next) :
    outputPoints plane current next = [] := by
  have classified :
      classify (signedDistance plane current) (signedDistance plane next) = .outside :=
    classify_outside_iff.mpr ⟨currentOutside, nextOutside⟩
  simp [outputPoints, classified]

/-- Parameters on the input edge corresponding one-for-one with `outputPoints`. -/
def outputParameters (plane : HalfPlane R) (current next : Vec2 R) : List R :=
  let currentDistance := signedDistance plane current
  let nextDistance := signedDistance plane next
  match classify currentDistance nextDistance with
  | .inside => [0]
  | .leaving =>
      if currentDistance = 0 then [0]
      else [0, boundaryParameter currentDistance nextDistance]
  | .entering =>
      if nextDistance = 0 then [1]
      else [boundaryParameter currentDistance nextDistance]
  | .outside => []

omit [IsStrictOrderedRing R] in
theorem outputPoints_eq_parameter_map
    (plane : HalfPlane R) (current next : Vec2 R) :
    outputPoints plane current next =
      (outputParameters plane current next).map (interpolatePoint current next) := by
  cases classified : classify (signedDistance plane current) (signedDistance plane next) with
  | inside =>
      rw [outputPoints, outputParameters, classified]
      simp
  | leaving =>
      rw [outputPoints, outputParameters, classified]
      by_cases currentBoundary : signedDistance plane current = 0
      · simp [currentBoundary]
      · simp [currentBoundary, boundaryPoint]
  | entering =>
      rw [outputPoints, outputParameters, classified]
      by_cases nextBoundary : signedDistance plane next = 0
      · simp [nextBoundary]
      · simp [nextBoundary, boundaryPoint]
  | outside =>
      rw [outputPoints, outputParameters, classified]
      rfl

theorem outputParameters_mem_Icc
    (plane : HalfPlane R) (current next : Vec2 R) {parameter : R}
    (emitted : parameter ∈ outputParameters plane current next) :
    parameter ∈ Set.Icc 0 1 := by
  cases classified : classify (signedDistance plane current) (signedDistance plane next) with
  | inside =>
      rw [outputParameters, classified] at emitted
      simp at emitted
      subst parameter
      simp
  | leaving =>
      rw [outputParameters, classified] at emitted
      by_cases currentBoundary : signedDistance plane current = 0
      · simp [currentBoundary] at emitted
        subst parameter
        simp
      · simp [currentBoundary] at emitted
        rcases emitted with rfl | rfl
        · simp
        · exact leaving_parameter_mem_Icc classified
  | entering =>
      rw [outputParameters, classified] at emitted
      by_cases nextBoundary : signedDistance plane next = 0
      · simp [nextBoundary] at emitted
        subst parameter
        simp
      · have parameterEq : parameter =
            boundaryParameter (signedDistance plane current) (signedDistance plane next) := by
          simpa [nextBoundary] using emitted
        rw [parameterEq]
        exact entering_parameter_mem_Icc classified
  | outside =>
      rw [outputParameters, classified] at emitted
      simp at emitted

theorem outputParameters_isChain
    (plane : HalfPlane R) (current next : Vec2 R) :
    (outputParameters plane current next).IsChain (· ≤ ·) := by
  cases classified : classify (signedDistance plane current) (signedDistance plane next) with
  | inside =>
      rw [outputParameters, classified]
      simp
  | leaving =>
      rw [outputParameters, classified]
      by_cases currentBoundary : signedDistance plane current = 0
      · simp [currentBoundary]
      · have parameterRange := leaving_parameter_mem_Icc classified
        simp [currentBoundary, parameterRange.1]
  | entering =>
      rw [outputParameters, classified]
      by_cases nextBoundary : signedDistance plane next = 0
      · simp [nextBoundary]
      · simp [nextBoundary]
  | outside =>
      rw [outputParameters, classified]
      simp

theorem outputParameters_pairwise
    (plane : HalfPlane R) (current next : Vec2 R) :
    (outputParameters plane current next).Pairwise (· ≤ ·) := by
  cases classified : classify (signedDistance plane current) (signedDistance plane next) with
  | inside =>
      rw [outputParameters, classified]
      simp
  | leaving =>
      rw [outputParameters, classified]
      by_cases currentBoundary : signedDistance plane current = 0
      · simp [currentBoundary]
      · have parameterRange := leaving_parameter_mem_Icc classified
        simp [currentBoundary, parameterRange.1]
  | entering =>
      rw [outputParameters, classified]
      by_cases nextBoundary : signedDistance plane next = 0
      · simp [nextBoundary]
      · simp [nextBoundary]
  | outside =>
      rw [outputParameters, classified]
      simp

/-- Mapping emitted points back to distances recovers the earlier abstract step model. -/
theorem outputPoints_distances (plane : HalfPlane R) (current next : Vec2 R) :
    (outputPoints plane current next).map (signedDistance plane) =
      outputDistances (signedDistance plane current) (signedDistance plane next) := by
  cases classified : classify (signedDistance plane current) (signedDistance plane next) with
  | inside =>
      simp [outputPoints, outputDistances, classified]
  | leaving =>
      have conditions := classify_leaving_iff.mp classified
      rw [outputPoints, outputDistances, classified]
      by_cases currentBoundary : signedDistance plane current = 0
      · simp [currentBoundary]
      · have distinct : signedDistance plane current ≠ signedDistance plane next := by
          linarith
        simp [currentBoundary, signedDistance_boundaryPoint plane current next distinct]
  | entering =>
      have conditions := classify_entering_iff.mp classified
      rw [outputPoints, outputDistances, classified]
      by_cases nextBoundary : signedDistance plane next = 0
      · simp [nextBoundary]
      · have distinct : signedDistance plane current ≠ signedDistance plane next := by
          linarith
        simp [nextBoundary, signedDistance_boundaryPoint plane current next distinct]
  | outside =>
      simp [outputPoints, outputDistances, classified]

theorem outputPoints_length_le_two (plane : HalfPlane R) (current next : Vec2 R) :
    (outputPoints plane current next).length ≤ 2 := by
  calc
    (outputPoints plane current next).length =
        ((outputPoints plane current next).map (signedDistance plane)).length := by simp
    _ = (outputDistances (signedDistance plane current) (signedDistance plane next)).length := by
      rw [outputPoints_distances]
    _ ≤ 2 := outputDistances_length_le_two _ _

theorem outputPoints_allOrderedCCW (plane : HalfPlane R) (current next : Vec2 R) :
    AllOrderedCCW (outputPoints plane current next) := by
  exact allOrderedTriples_of_length_le_two _ (outputPoints_length_le_two plane current next)

theorem outputPoints_nonpos
    (plane : HalfPlane R) (current next point : Vec2 R)
    (emitted : point ∈ outputPoints plane current next) : signedDistance plane point ≤ 0 := by
  have mapped : signedDistance plane point ∈
      (outputPoints plane current next).map (signedDistance plane) := by
    exact List.mem_map.mpr ⟨point, emitted, rfl⟩
  rw [outputPoints_distances] at mapped
  exact outputDistances_nonpos mapped

def OnClosedSegment (start finish point : Vec2 R) : Prop :=
  ∃ parameter ∈ Set.Icc (0 : R) 1, point = interpolatePoint start finish parameter

theorem onClosedSegment_start (start finish : Vec2 R) :
    OnClosedSegment start finish start := by
  exact ⟨0, by simp, by simp⟩

theorem onClosedSegment_finish (start finish : Vec2 R) :
    OnClosedSegment start finish finish := by
  exact ⟨1, by simp, by simp⟩

theorem outputPoints_onClosedSegment
    (plane : HalfPlane R) (current next point : Vec2 R)
    (emitted : point ∈ outputPoints plane current next) :
    OnClosedSegment current next point := by
  cases classified : classify (signedDistance plane current) (signedDistance plane next) with
  | inside =>
      have pointEq : point = current := by simpa [outputPoints, classified] using emitted
      rw [pointEq]
      exact onClosedSegment_start current next
  | leaving =>
      rw [outputPoints, classified] at emitted
      by_cases currentBoundary : signedDistance plane current = 0
      · have pointEq : point = current := by simpa [currentBoundary] using emitted
        rw [pointEq]
        exact onClosedSegment_start current next
      · simp [currentBoundary] at emitted
        rcases emitted with pointEq | pointEq
        · rw [pointEq]
          exact onClosedSegment_start current next
        · rw [pointEq]
          exact ⟨boundaryParameter (signedDistance plane current) (signedDistance plane next),
            leaving_parameter_mem_Icc classified, rfl⟩
  | entering =>
      rw [outputPoints, classified] at emitted
      by_cases nextBoundary : signedDistance plane next = 0
      · have pointEq : point = next := by simpa [nextBoundary] using emitted
        rw [pointEq]
        exact onClosedSegment_finish current next
      · have pointEq : point = boundaryPoint plane current next := by
          simpa [nextBoundary] using emitted
        rw [pointEq]
        exact ⟨boundaryParameter (signedDistance plane current) (signedDistance plane next),
          entering_parameter_mem_Icc classified, rfl⟩
  | outside =>
      simp [outputPoints, classified] at emitted

end Sprawlens.HalfPlaneClipPoints
