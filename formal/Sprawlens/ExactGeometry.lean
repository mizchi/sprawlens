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
