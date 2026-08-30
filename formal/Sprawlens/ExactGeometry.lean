import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring

namespace Sprawlens.ExactGeometry

universe u

variable {R : Type u} [Field R]

structure Vec2 (R : Type u) where
  x : R
  y : R
  deriving Repr, DecidableEq

def translate (point offset : Vec2 R) : Vec2 R :=
  { x := point.x + offset.x, y := point.y + offset.y }

def scale (factor : R) (point : Vec2 R) : Vec2 R :=
  { x := factor * point.x, y := factor * point.y }

/-- Signed twice-area determinant; positive means a strict left turn. -/
def orientation (a b c : Vec2 R) : R :=
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

theorem orientation_translate (a b c offset : Vec2 R) :
    orientation (translate a offset) (translate b offset) (translate c offset) =
      orientation a b c := by
  simp only [orientation, translate]
  ring

theorem orientation_scale (factor : R) (a b c : Vec2 R) :
    orientation (scale factor a) (scale factor b) (scale factor c) =
      factor ^ 2 * orientation a b c := by
  simp only [orientation, scale]
  ring

/-- Every non-zero uniform scale preserves strict turn direction. -/
theorem orientation_scale_pos_iff
    [LinearOrder R] [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (a b c : Vec2 R) :
    0 < orientation (scale factor a) (scale factor b) (scale factor c) ↔
      0 < orientation a b c := by
  rw [orientation_scale]
  have squarePositive : 0 < factor ^ 2 := sq_pos_of_ne_zero factorNonzero
  constructor <;> intro turnPositive <;> nlinarith

theorem orientation_scale_neg_iff
    [LinearOrder R] [IsStrictOrderedRing R]
    (factor : R) (factorNonzero : factor ≠ 0) (a b c : Vec2 R) :
    orientation (scale factor a) (scale factor b) (scale factor c) < 0 ↔
      orientation a b c < 0 := by
  rw [orientation_scale]
  have squarePositive : 0 < factor ^ 2 := sq_pos_of_ne_zero factorNonzero
  constructor <;> intro turnNegative <;> nlinarith

theorem orientation_cycle (a b c : Vec2 R) :
    orientation b c a = orientation a b c := by
  simp only [orientation]
  ring

theorem orientation_reverse (a b c : Vec2 R) :
    orientation a c b = -orientation a b c := by
  simp only [orientation]
  ring

theorem orientation_swap_start_middle (a b c : Vec2 R) :
    orientation b a c = -orientation a b c := by
  simp only [orientation]
  ring

/-- Splitting a chord at an ear vertex rewrites its orientation gap as two edge turns. -/
theorem orientation_chord_sub_ear (a b c point : Vec2 R) :
    orientation a c point - orientation a c b =
      orientation a b point + orientation b c point := by
  simp only [orientation]
  ring

theorem orientation_ear_lower_bound
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c point : Vec2 R)
    (leftOfFirst : 0 ≤ orientation a b point)
    (leftOfSecond : 0 ≤ orientation b c point) :
    orientation a c b ≤ orientation a c point := by
  rw [← sub_nonneg]
  rw [orientation_chord_sub_ear]
  positivity

/--
Coordinates relative to the directed chord `a → c` and witness `e`.
The construction uses only determinants, so it needs no division.
-/
def chordFrame (a c e point : Vec2 R) : Vec2 R :=
  { x := -orientation a point e
    y := orientation a c point }

theorem orientation_chordFrame (a c e p q r : Vec2 R) :
    orientation (chordFrame a c e p) (chordFrame a c e q) (chordFrame a c e r) =
      -orientation a c e * orientation p q r := by
  simp only [chordFrame, orientation]
  ring

@[simp] theorem chordFrame_origin (a c e : Vec2 R) :
    chordFrame a c e a = { x := 0, y := 0 } := by
  cases a
  simp [chordFrame, orientation]

theorem chordFrame_chordEnd (a c e : Vec2 R) :
    chordFrame a c e c = { x := -orientation a c e, y := 0 } := by
  cases c
  simp [chordFrame, orientation]
  ring

theorem chordFrame_witness (a c e : Vec2 R) :
    chordFrame a c e e = { x := 0, y := orientation a c e } := by
  cases e
  simp [chordFrame, orientation]
  ring

theorem orientation_chordFrame_nonneg_iff
    [LinearOrder R] [IsStrictOrderedRing R]
    (a c e p q r : Vec2 R) (clockwise : orientation a c e < 0) :
    0 ≤ orientation (chordFrame a c e p) (chordFrame a c e q) (chordFrame a c e r) ↔
      0 ≤ orientation p q r := by
  rw [orientation_chordFrame]
  exact mul_nonneg_iff_of_pos_left (neg_pos.mpr clockwise)

theorem chordFrame_injective (a c e : Vec2 R)
    (nondegenerate : orientation a c e ≠ 0) :
    Function.Injective (chordFrame a c e) := by
  intro p q equalFrames
  have equalX := congrArg Vec2.x equalFrames
  have equalY := congrArg Vec2.y equalFrames
  simp only [chordFrame] at equalX equalY
  have firstDifference : orientation a p e - orientation a q e = 0 := by
    exact sub_eq_zero.mpr (neg_injective equalX)
  have secondDifference : orientation a c p - orientation a c q = 0 := by
    exact sub_eq_zero.mpr equalY
  have xProduct : orientation a c e * (p.x - q.x) = 0 := by
    calc
      orientation a c e * (p.x - q.x) =
          (c.x - a.x) * (orientation a p e - orientation a q e) +
            (e.x - a.x) * (orientation a c p - orientation a c q) := by
              simp only [orientation]
              ring
      _ = 0 := by rw [firstDifference, secondDifference]; ring
  have yProduct : orientation a c e * (p.y - q.y) = 0 := by
    calc
      orientation a c e * (p.y - q.y) =
          (e.y - a.y) * (orientation a c p - orientation a c q) +
            (c.y - a.y) * (orientation a p e - orientation a q e) := by
              simp only [orientation]
              ring
      _ = 0 := by rw [firstDifference, secondDifference]; ring
  have equalPointX : p.x = q.x := by
    rcases mul_eq_zero.mp xProduct with areaZero | differenceZero
    · exact False.elim (nondegenerate areaZero)
    · exact sub_eq_zero.mp differenceZero
  have equalPointY : p.y = q.y := by
    rcases mul_eq_zero.mp yProduct with areaZero | differenceZero
    · exact False.elim (nondegenerate areaZero)
    · exact sub_eq_zero.mp differenceZero
  cases p
  cases q
  simp_all

@[simp] theorem orientation_duplicate_start (a c : Vec2 R) :
    orientation a a c = 0 := by
  simp [orientation]

@[simp] theorem orientation_duplicate_end (a b : Vec2 R) :
    orientation a b a = 0 := by
  simp [orientation]

@[simp] theorem orientation_duplicate_middle_end (a b : Vec2 R) :
    orientation a b b = 0 := by
  simp only [orientation]
  ring

theorem strict_left_turn_start_ne_middle (a b c : Vec2 R)
    [LinearOrder R] [IsStrictOrderedRing R]
    (leftTurn : 0 < orientation a b c) : a ≠ b := by
  intro equal
  subst b
  simp at leftTurn

theorem strict_left_turn_start_ne_end (a b c : Vec2 R)
    [LinearOrder R] [IsStrictOrderedRing R]
    (leftTurn : 0 < orientation a b c) : a ≠ c := by
  intro equal
  subst c
  simp at leftTurn

theorem strict_left_turn_middle_ne_end (a b c : Vec2 R)
    [LinearOrder R] [IsStrictOrderedRing R]
    (leftTurn : 0 < orientation a b c) : b ≠ c := by
  intro equal
  subst c
  rw [orientation_cycle] at leftTurn
  simp at leftTurn

end Sprawlens.ExactGeometry
