import Sprawlens.HalfPlaneIntersection

namespace Sprawlens.HalfPlaneClipStep

open HalfPlaneIntersection

universe u

variable {R : Type u} [Field R] [LinearOrder R]

inductive EdgeClass where
  | inside
  | leaving
  | entering
  | outside
  deriving Repr, DecidableEq

/-- Classify an oriented edge against the closed half-plane distance `≤ 0`. -/
def classify (current next : R) : EdgeClass :=
  if current ≤ 0 then
    if next ≤ 0 then .inside else .leaving
  else if next ≤ 0 then .entering else .outside

theorem classify_inside_iff {current next : R} :
    classify current next = .inside ↔ current ≤ 0 ∧ next ≤ 0 := by
  simp only [classify]
  split <;> split <;> simp_all

theorem classify_leaving_iff {current next : R} :
    classify current next = .leaving ↔ current ≤ 0 ∧ 0 < next := by
  simp only [classify]
  split <;> split <;> simp_all

theorem classify_entering_iff {current next : R} :
    classify current next = .entering ↔ 0 < current ∧ next ≤ 0 := by
  simp only [classify]
  split <;> split <;> simp_all

theorem classify_outside_iff {current next : R} :
    classify current next = .outside ↔ 0 < current ∧ 0 < next := by
  simp only [classify]
  split <;> split <;> simp_all

theorem leaving_parameter_mem_Icc [IsStrictOrderedRing R] {current next : R}
    (classified : classify current next = .leaving) :
    boundaryParameter current next ∈ Set.Icc 0 1 := by
  exact boundaryParameter_mem_Icc_of_inside_outside
    (classify_leaving_iff.mp classified).1
    (classify_leaving_iff.mp classified).2

theorem entering_parameter_mem_Icc [IsStrictOrderedRing R] {current next : R}
    (classified : classify current next = .entering) :
    boundaryParameter current next ∈ Set.Icc 0 1 := by
  exact boundaryParameter_mem_Icc_of_outside_inside
    (classify_entering_iff.mp classified).1
    (classify_entering_iff.mp classified).2

/-- Observable signed distances emitted by one normalized clipping step. -/
def outputDistances (current next : R) : List R :=
  match classify current next with
  | .inside => [current]
  | .leaving => if current = 0 then [current] else [current, 0]
  | .entering => [0]
  | .outside => []

theorem outputDistances_length_le_two (current next : R) :
    (outputDistances current next).length ≤ 2 := by
  cases classified : classify current next with
  | inside => simp [outputDistances, classified]
  | leaving =>
      rw [outputDistances, classified]
      by_cases currentBoundary : current = 0
      · simp [currentBoundary]
      · simp [currentBoundary]
  | entering => simp [outputDistances, classified]
  | outside => simp [outputDistances, classified]

theorem outputDistances_nodup (current next : R) :
    (outputDistances current next).Nodup := by
  cases classified : classify current next with
  | inside => simp [outputDistances, classified]
  | leaving =>
      rw [outputDistances, classified]
      by_cases currentBoundary : current = 0
      · simp [currentBoundary]
      · simp [currentBoundary]
  | entering => simp [outputDistances, classified]
  | outside => simp [outputDistances, classified]

theorem outputDistances_nonpos {current next distance : R}
    (emitted : distance ∈ outputDistances current next) : distance ≤ 0 := by
  cases classified : classify current next with
  | inside =>
      have emittedCurrent : distance = current := by
        simpa [outputDistances, classified] using emitted
      rw [emittedCurrent]
      exact (classify_inside_iff.mp classified).1
  | leaving =>
      have currentInside := (classify_leaving_iff.mp classified).1
      rw [outputDistances, classified] at emitted
      by_cases currentBoundary : current = 0
      · have emittedCurrent : distance = current := by
          simpa [currentBoundary] using emitted
        rw [emittedCurrent]
        exact currentInside
      · simp [currentBoundary] at emitted
        rcases emitted with emittedCurrent | emittedBoundary
        · rw [emittedCurrent]
          exact currentInside
        · rw [emittedBoundary]
  | entering =>
      have emittedBoundary : distance = 0 := by
        simpa [outputDistances, classified] using emitted
      rw [emittedBoundary]
  | outside =>
      simp [outputDistances, classified] at emitted

end Sprawlens.HalfPlaneClipStep
