import Sprawlens.ExactGeometry

namespace Sprawlens.SegmentIntersection

open ExactGeometry

universe u

variable {R : Type u} [Field R] [LinearOrder R]

/-- `c` and `d` lie strictly on opposite sides of the oriented line `a → b`. -/
def StrictOppositeSides (a b c d : Vec2 R) : Prop :=
  (0 < orientation a b c ∧ orientation a b d < 0) ∨
    (orientation a b c < 0 ∧ 0 < orientation a b d)

/-- Both open segment interiors cross; endpoint contact and collinear overlap are excluded. -/
def ProperlyIntersect (a b c d : Vec2 R) : Prop :=
  StrictOppositeSides a b c d ∧ StrictOppositeSides c d a b

def strictOppositeSidesBool [DecidableLT R] (a b c d : Vec2 R) : Bool :=
  (decide (0 < orientation a b c) && decide (orientation a b d < 0)) ||
    (decide (orientation a b c < 0) && decide (0 < orientation a b d))

def properlyIntersectBool [DecidableLT R] (a b c d : Vec2 R) : Bool :=
  strictOppositeSidesBool a b c d && strictOppositeSidesBool c d a b

theorem strictOppositeSidesBool_eq_true [DecidableLT R] (a b c d : Vec2 R) :
    strictOppositeSidesBool a b c d = true ↔ StrictOppositeSides a b c d := by
  simp [strictOppositeSidesBool, StrictOppositeSides]

theorem properlyIntersectBool_eq_true [DecidableLT R] (a b c d : Vec2 R) :
    properlyIntersectBool a b c d = true ↔ ProperlyIntersect a b c d := by
  simp [properlyIntersectBool, ProperlyIntersect, strictOppositeSidesBool_eq_true]

theorem strictOppositeSides_swap_points (a b c d : Vec2 R) :
    StrictOppositeSides a b d c ↔ StrictOppositeSides a b c d := by
  simp only [StrictOppositeSides]
  aesop

theorem strictOppositeSides_reverse_line [IsStrictOrderedRing R] (a b c d : Vec2 R) :
    StrictOppositeSides b a c d ↔ StrictOppositeSides a b c d := by
  unfold StrictOppositeSides
  rw [orientation_swap_start_middle a b c, orientation_swap_start_middle a b d]
  simp only [neg_pos, neg_lt_zero]
  aesop

theorem strictOppositeSides_translate (a b c d offset : Vec2 R) :
    StrictOppositeSides
        (translate a offset) (translate b offset) (translate c offset) (translate d offset) ↔
      StrictOppositeSides a b c d := by
  simp only [StrictOppositeSides, orientation_translate]

theorem strictOppositeSides_scale
    [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (a b c d : Vec2 R) :
    StrictOppositeSides
        (scale factor a) (scale factor b) (scale factor c) (scale factor d) ↔
      StrictOppositeSides a b c d := by
  simp only [StrictOppositeSides,
    orientation_scale_pos_iff factor factorNonzero,
    orientation_scale_neg_iff factor factorNonzero]

theorem properlyIntersect_swap_segments (a b c d : Vec2 R) :
    ProperlyIntersect c d a b ↔ ProperlyIntersect a b c d := by
  simp only [ProperlyIntersect, and_comm]

theorem properlyIntersect_reverse_first [IsStrictOrderedRing R] (a b c d : Vec2 R) :
    ProperlyIntersect b a c d ↔ ProperlyIntersect a b c d := by
  simp only [ProperlyIntersect, strictOppositeSides_reverse_line,
    strictOppositeSides_swap_points]

theorem properlyIntersect_reverse_second [IsStrictOrderedRing R] (a b c d : Vec2 R) :
    ProperlyIntersect a b d c ↔ ProperlyIntersect a b c d := by
  simp only [ProperlyIntersect, strictOppositeSides_swap_points,
    strictOppositeSides_reverse_line]

theorem properlyIntersect_translate (a b c d offset : Vec2 R) :
    ProperlyIntersect
        (translate a offset) (translate b offset) (translate c offset) (translate d offset) ↔
      ProperlyIntersect a b c d := by
  simp only [ProperlyIntersect, strictOppositeSides_translate]

theorem properlyIntersect_scale
    [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (a b c d : Vec2 R) :
    ProperlyIntersect
        (scale factor a) (scale factor b) (scale factor c) (scale factor d) ↔
      ProperlyIntersect a b c d := by
  simp only [ProperlyIntersect, strictOppositeSides_scale factor factorNonzero]

theorem properlyIntersect_first_segment_nondegenerate (a b c d : Vec2 R)
    (intersection : ProperlyIntersect a b c d) : a ≠ b := by
  intro equal
  subst b
  simp [ProperlyIntersect, StrictOppositeSides, orientation] at intersection

theorem properlyIntersect_second_segment_nondegenerate (a b c d : Vec2 R)
    (intersection : ProperlyIntersect a b c d) : c ≠ d := by
  intro equal
  subst d
  simp [ProperlyIntersect, StrictOppositeSides] at intersection

theorem properlyIntersect_no_shared_start (a b c d : Vec2 R)
    (intersection : ProperlyIntersect a b c d) : a ≠ c := by
  intro equal
  subst c
  simp [ProperlyIntersect, StrictOppositeSides, orientation] at intersection

theorem properlyIntersect_no_first_end_second_start (a b c d : Vec2 R)
    (intersection : ProperlyIntersect a b c d) : b ≠ c := by
  intro equal
  subst c
  simp [ProperlyIntersect, StrictOppositeSides, orientation] at intersection

theorem properlyIntersect_no_first_start_second_end (a b c d : Vec2 R)
    (intersection : ProperlyIntersect a b c d) : a ≠ d := by
  intro equal
  subst d
  simp [ProperlyIntersect, StrictOppositeSides, orientation] at intersection

theorem properlyIntersect_no_shared_end (a b c d : Vec2 R)
    (intersection : ProperlyIntersect a b c d) : b ≠ d := by
  intro equal
  subst d
  have opposite := intersection.2
  unfold StrictOppositeSides at opposite
  rw [orientation_duplicate_middle_end] at opposite
  simp at opposite

end Sprawlens.SegmentIntersection
