import Sprawlens.HardSelectorLipschitz
import Sprawlens.SegmentProjection

namespace Sprawlens.SoftSelectorLipschitz

open HardSelectorLipschitz
open QuantitativeConfluence
open SegmentProjection

noncomputable section

/-- Affine coordinate of a predecessor inside a transition band of half-width
`margin`. -/
def transitionParameter (margin previous : ℝ) : ℝ :=
  (previous + margin) / (2 * margin)

/-- Continuous relaxation of the `-1` / `1` hard nearest selector. -/
def softNearest (margin previous : ℝ) : ℝ :=
  -1 + 2 * unitClamp (transitionParameter margin previous)

theorem dist_transitionParameter
    (margin : ℝ) (marginPositive : 0 < margin) (first second : ℝ) :
    dist (transitionParameter margin first)
        (transitionParameter margin second) =
      (1 / (2 * margin)) * dist first second := by
  simp only [transitionParameter, Real.dist_eq]
  have denominatorPositive : 0 < 2 * margin := by positivity
  have differenceEq :
      (first + margin) / (2 * margin) -
          (second + margin) / (2 * margin) =
        (first - second) / (2 * margin) := by
    field_simp
    ring
  rw [differenceEq, abs_div, abs_of_pos denominatorPositive]
  simp only [div_eq_mul_inv]
  ring

theorem dist_softNearest_eq_two_mul_clamp_dist
    (margin first second : ℝ) :
    dist (softNearest margin first) (softNearest margin second) =
      2 * dist
        (unitClamp (transitionParameter margin first))
        (unitClamp (transitionParameter margin second)) := by
  simp only [softNearest, Real.dist_eq]
  rw [show
      (-1 + 2 * unitClamp (transitionParameter margin first)) -
          (-1 + 2 * unitClamp (transitionParameter margin second)) =
        2 *
          (unitClamp (transitionParameter margin first) -
            unitClamp (transitionParameter margin second)) by ring,
    abs_mul]
  norm_num

/-- The soft transition is globally Lipschitz with the same inverse-margin
coefficient that the hard selector only obtains after deleting the band. -/
theorem softNearest_lipschitz (margin : ℝ) (marginPositive : 0 < margin) :
    LipschitzWith (inverseMargin margin marginPositive)
      (softNearest margin) := by
  apply LipschitzWith.of_dist_le_mul
  intro first second
  change dist (softNearest margin first) (softNearest margin second) ≤
    (1 / margin) * dist first second
  rw [dist_softNearest_eq_two_mul_clamp_dist]
  have clampBound := unitClamp_lipschitz.dist_le_mul
    (transitionParameter margin first)
    (transitionParameter margin second)
  simp only [NNReal.coe_one, one_mul] at clampBound
  calc
    2 * dist
        (unitClamp (transitionParameter margin first))
        (unitClamp (transitionParameter margin second)) ≤
      2 * dist
        (transitionParameter margin first)
        (transitionParameter margin second) :=
      mul_le_mul_of_nonneg_left clampBound (by norm_num)
    _ = (1 / margin) * dist first second := by
      rw [dist_transitionParameter margin marginPositive]
      field_simp

theorem softNearest_observableLipschitz
    (margin : ℝ) (marginPositive : 0 < margin) :
    ObservableLipschitzWith (inverseMargin margin marginPositive)
      id (softNearest margin) := by
  intro first second
  exact (softNearest_lipschitz margin marginPositive).dist_le_mul first second

theorem unitClamp_eq_zero_of_nonpos {parameter : ℝ}
    (nonpositive : parameter ≤ 0) :
    unitClamp parameter = 0 := by
  rw [unitClamp, min_eq_right (by linarith), max_eq_left nonpositive]

theorem unitClamp_eq_one_of_one_le {parameter : ℝ}
    (atLeastOne : 1 ≤ parameter) :
    unitClamp parameter = 1 := by
  rw [unitClamp, min_eq_left atLeastOne, max_eq_right (by norm_num)]

theorem softNearest_eq_left_of_le_neg_margin
    (margin : ℝ) (marginPositive : 0 < margin) {previous : ℝ}
    (left : previous ≤ -margin) :
    softNearest margin previous = -1 := by
  have denominatorPositive : 0 < 2 * margin := by positivity
  have parameterNonpositive : transitionParameter margin previous ≤ 0 := by
    apply div_nonpos_of_nonpos_of_nonneg
    · linarith
    · exact denominatorPositive.le
  rw [softNearest, unitClamp_eq_zero_of_nonpos parameterNonpositive]
  ring

theorem softNearest_eq_right_of_margin_le
    (margin : ℝ) (marginPositive : 0 < margin) {previous : ℝ}
    (right : margin ≤ previous) :
    softNearest margin previous = 1 := by
  have denominatorPositive : 0 < 2 * margin := by positivity
  have parameterAtLeastOne : 1 ≤ transitionParameter margin previous := by
    apply (le_div_iff₀ denominatorPositive).2
    linarith
  rw [softNearest, unitClamp_eq_one_of_one_le parameterAtLeastOne]
  ring

/-- The relaxation preserves the original hard candidates outside its
transition band. -/
theorem softNearest_eq_hardNearest_of_away
    (margin : ℝ) (marginPositive : 0 < margin) {previous : ℝ}
    (away : previous ≤ -margin ∨ margin ≤ previous) :
    softNearest margin previous = hardNearest previous := by
  rcases away with left | right
  · rw [softNearest_eq_left_of_le_neg_margin margin marginPositive left,
      hardNearest_eq_left_of_nonpos (by linarith)]
  · rw [softNearest_eq_right_of_margin_le margin marginPositive right,
      hardNearest_eq_right_of_pos (by linarith)]

theorem softNearest_mem_Icc
    (margin previous : ℝ) :
    softNearest margin previous ∈ Set.Icc (-1 : ℝ) 1 := by
  have clamped := unitClamp_mem_Icc (transitionParameter margin previous)
  constructor <;> simp only [softNearest] <;> linarith [clamped.1, clamped.2]

theorem softNearest_zero (margin : ℝ) (marginPositive : 0 < margin) :
    softNearest margin 0 = 0 := by
  have parameterEq : transitionParameter margin 0 = (1 / 2 : ℝ) := by
    simp only [transitionParameter, zero_add]
    field_simp
  rw [softNearest, parameterEq]
  norm_num [unitClamp]

/-- Load-bearing policy trade-off: continuity changes the midpoint result,
where the hard selector takes its deterministic left tie. -/
theorem softNearest_differs_from_hard_at_switch
    (margin : ℝ) (marginPositive : 0 < margin) :
    softNearest margin 0 ≠ hardNearest 0 := by
  rw [softNearest_zero margin marginPositive]
  norm_num [hardNearest]

/-- The global inverse-margin coefficient is sharp for the relaxation too. -/
theorem softNearest_margin_bound_tight
    (margin : ℝ) (marginPositive : 0 < margin) :
    dist (softNearest margin (-margin)) (softNearest margin margin) =
      (inverseMargin margin marginPositive : ℝ) *
        dist (-margin) margin := by
  rw [softNearest_eq_left_of_le_neg_margin margin marginPositive (le_refl _),
    softNearest_eq_right_of_margin_le margin marginPositive (le_refl _)]
  simpa [hardNearest_eq_left_of_nonpos (show -margin ≤ 0 by linarith),
    hardNearest_eq_right_of_pos marginPositive] using
    hardNearestAway_margin_bound_tight margin marginPositive

end

end Sprawlens.SoftSelectorLipschitz
