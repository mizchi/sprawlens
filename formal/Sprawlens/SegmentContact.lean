import Sprawlens.ExactGeometry

namespace Sprawlens.SegmentContact

open ExactGeometry

universe u

variable {R : Type u} [Field R] [LinearOrder R]

def StrictBetween (value first second : R) : Prop :=
  (first < value ∧ value < second) ∨ (second < value ∧ value < first)

def BetweenInclusive (value first second : R) : Prop :=
  (first ≤ value ∧ value ≤ second) ∨ (second ≤ value ∧ value ≤ first)

/-- Exact membership in the open segment `(a, b)`, excluding both endpoints. -/
def PointInOpenSegment (a b point : Vec2 R) : Prop :=
  orientation a b point = 0 ∧
    ((StrictBetween point.x a.x b.x ∧ BetweenInclusive point.y a.y b.y) ∨
      (StrictBetween point.y a.y b.y ∧ BetweenInclusive point.x a.x b.x))

def strictBetweenBool [DecidableLT R] (value first second : R) : Bool :=
  (decide (first < value) && decide (value < second)) ||
    (decide (second < value) && decide (value < first))

def betweenInclusiveBool [DecidableLE R] (value first second : R) : Bool :=
  (decide (first ≤ value) && decide (value ≤ second)) ||
    (decide (second ≤ value) && decide (value ≤ first))

def pointInOpenSegmentBool [DecidableEq R] [DecidableLT R] [DecidableLE R]
    (a b point : Vec2 R) : Bool :=
  decide (orientation a b point = 0) &&
    ((strictBetweenBool point.x a.x b.x && betweenInclusiveBool point.y a.y b.y) ||
      (strictBetweenBool point.y a.y b.y && betweenInclusiveBool point.x a.x b.x))

omit [Field R] in theorem strictBetweenBool_eq_true [DecidableLT R] (value first second : R) :
    strictBetweenBool value first second = true ↔ StrictBetween value first second := by
  simp [strictBetweenBool, StrictBetween]

omit [Field R] in theorem betweenInclusiveBool_eq_true [DecidableLE R] (value first second : R) :
    betweenInclusiveBool value first second = true ↔ BetweenInclusive value first second := by
  simp [betweenInclusiveBool, BetweenInclusive]

theorem pointInOpenSegmentBool_eq_true
    [DecidableEq R] [DecidableLT R] [DecidableLE R] (a b point : Vec2 R) :
    pointInOpenSegmentBool a b point = true ↔ PointInOpenSegment a b point := by
  simp [pointInOpenSegmentBool, PointInOpenSegment,
    strictBetweenBool_eq_true, betweenInclusiveBool_eq_true]

omit [Field R] in theorem strictBetween_swap (value first second : R) :
    StrictBetween value second first ↔ StrictBetween value first second := by
  simp only [StrictBetween]
  aesop

omit [Field R] in theorem betweenInclusive_swap (value first second : R) :
    BetweenInclusive value second first ↔ BetweenInclusive value first second := by
  simp only [BetweenInclusive]
  aesop

theorem pointInOpenSegment_reverse [IsStrictOrderedRing R] (a b point : Vec2 R) :
    PointInOpenSegment b a point ↔ PointInOpenSegment a b point := by
  unfold PointInOpenSegment
  rw [orientation_swap_start_middle a b point]
  simp only [neg_eq_zero]
  constructor <;> rintro ⟨collinear, bounds⟩ <;> refine ⟨collinear, ?_⟩
  · simpa only [strictBetween_swap, betweenInclusive_swap] using bounds
  · simpa only [strictBetween_swap, betweenInclusive_swap] using bounds

theorem pointInOpenSegment_start_ne_point (a b point : Vec2 R)
    (interior : PointInOpenSegment a b point) : a ≠ point := by
  intro equal
  subst point
  simp [PointInOpenSegment, StrictBetween] at interior

theorem pointInOpenSegment_end_ne_point (a b point : Vec2 R)
    (interior : PointInOpenSegment a b point) : b ≠ point := by
  intro equal
  subst point
  simp [PointInOpenSegment, StrictBetween] at interior

theorem pointInOpenSegment_segment_nondegenerate (a b point : Vec2 R)
    (interior : PointInOpenSegment a b point) : a ≠ b := by
  intro equal
  subst b
  rcases interior.2 with horizontal | vertical
  · rcases horizontal.1 with forward | reverse
    · exact lt_asymm forward.1 forward.2
    · exact lt_asymm reverse.1 reverse.2
  · rcases vertical.1 with forward | reverse
    · exact lt_asymm forward.1 forward.2
    · exact lt_asymm reverse.1 reverse.2

theorem strictBetween_add_iff [IsStrictOrderedRing R] (value first second offset : R) :
    StrictBetween (value + offset) (first + offset) (second + offset) ↔
      StrictBetween value first second := by
  simp [StrictBetween]

theorem betweenInclusive_add_iff [IsStrictOrderedRing R] (value first second offset : R) :
    BetweenInclusive (value + offset) (first + offset) (second + offset) ↔
      BetweenInclusive value first second := by
  simp [BetweenInclusive]

theorem pointInOpenSegment_translate [IsStrictOrderedRing R]
    (a b point offset : Vec2 R) :
    PointInOpenSegment (translate a offset) (translate b offset) (translate point offset) ↔
      PointInOpenSegment a b point := by
  unfold PointInOpenSegment
  rw [orientation_translate]
  simp only [translate, strictBetween_add_iff, betweenInclusive_add_iff]

theorem strictBetween_mul_iff [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (value first second : R) :
    StrictBetween (factor * value) (factor * first) (factor * second) ↔
      StrictBetween value first second := by
  rcases lt_or_gt_of_ne factorNonzero with factorNegative | factorPositive
  · simp [StrictBetween, factorNegative, and_comm, or_comm]
  · simp [StrictBetween, factorPositive, and_comm]

theorem betweenInclusive_mul_iff [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (value first second : R) :
    BetweenInclusive (factor * value) (factor * first) (factor * second) ↔
      BetweenInclusive value first second := by
  rcases lt_or_gt_of_ne factorNonzero with factorNegative | factorPositive
  · simp [BetweenInclusive, factorNegative, and_comm, or_comm]
  · simp [BetweenInclusive, factorPositive, and_comm]

theorem pointInOpenSegment_scale [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (a b point : Vec2 R) :
    PointInOpenSegment (scale factor a) (scale factor b) (scale factor point) ↔
      PointInOpenSegment a b point := by
  unfold PointInOpenSegment
  rw [orientation_scale]
  rw [mul_eq_zero]
  have factorSquareNonzero : factor ^ 2 ≠ 0 := pow_ne_zero 2 factorNonzero
  simp only [factorSquareNonzero, false_or]
  simp only [scale, strictBetween_mul_iff factor factorNonzero,
    betweenInclusive_mul_iff factor factorNonzero]

end Sprawlens.SegmentContact
