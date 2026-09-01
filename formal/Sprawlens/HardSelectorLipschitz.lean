import Mathlib.Topology.MetricSpace.Lipschitz
import Sprawlens.FeasibleEnvelopeSelector
import Sprawlens.QuantitativeConfluence

namespace Sprawlens.HardSelectorLipschitz

open FeasibleEnvelopeSelector
open QuantitativeConfluence
open Set

noncomputable section

/-- Nearest selection between candidates `-1` and `1`, with the left
candidate winning the midpoint tie. -/
def hardNearest (previous : ℝ) : ℝ :=
  if previous ≤ 0 then -1 else 1

/-- The same policy expressed through the finite feasible-envelope minimum. -/
def selectNearestCandidate (previous : ℝ) : ℝ :=
  (minimum?
    (fun candidate : ℝ => dist previous candidate)
    (fun candidate => candidate)
    [-1, 1]).getD (-1)

/-- No finite global Lipschitz constant exists across the hard switching
boundary. -/
theorem hardNearest_not_lipschitz (constant : NNReal) :
    ¬ LipschitzWith constant hardNearest := by
  intro lipschitz
  let coefficient : ℝ := constant
  let epsilon : ℝ := 1 / (coefficient + 1)
  have coefficientNonneg : 0 ≤ coefficient := NNReal.coe_nonneg constant
  have denominatorPositive : 0 < coefficient + 1 := by linarith
  have epsilonPositive : 0 < epsilon := one_div_pos.mpr denominatorPositive
  have bound := lipschitz.dist_le_mul (0 : ℝ) epsilon
  have outputDistance : dist (hardNearest 0) (hardNearest epsilon) = 2 := by
    norm_num [hardNearest, not_le.mpr epsilonPositive, Real.dist_eq]
  have inputDistance : dist (0 : ℝ) epsilon = epsilon := by
    rw [Real.dist_eq]
    simp [abs_of_pos epsilonPositive]
  rw [outputDistance, inputDistance] at bound
  change 2 ≤ coefficient * epsilon at bound
  have productEq : coefficient * epsilon = coefficient / (coefficient + 1) := by
    simp only [epsilon]
    ring
  rw [productEq] at bound
  have fractionLessThanOne : coefficient / (coefficient + 1) < 1 :=
    (div_lt_one denominatorPositive).2 (by linarith)
  linarith

theorem dist_left_le_right_of_nonpos (previous : ℝ)
    (nonpositive : previous ≤ 0) :
    dist previous (-1) ≤ dist previous 1 := by
  simp only [Real.dist_eq, sub_neg_eq_add]
  by_cases left : previous < -1
  · rw [abs_of_neg (by linarith), abs_of_neg (by linarith)]
    linarith
  · rw [abs_of_nonneg (by linarith), abs_of_nonpos (by linarith)]
    linarith

theorem dist_right_lt_left_of_pos (previous : ℝ)
    (positive : 0 < previous) :
    dist previous 1 < dist previous (-1) := by
  simp only [Real.dist_eq, sub_neg_eq_add]
  by_cases right : previous ≤ 1
  · rw [abs_of_nonpos (by linarith), abs_of_pos (by linarith)]
    linarith
  · rw [abs_of_pos (by linarith), abs_of_pos (by linarith)]
    linarith

/-- The step function is exactly the two-candidate finite argmin policy, not an
unrelated discontinuous function. -/
theorem selectNearestCandidate_eq_hardNearest (previous : ℝ) :
    selectNearestCandidate previous = hardNearest previous := by
  by_cases nonpositive : previous ≤ 0
  · have rightNotBetter :
        ¬ dist previous 1 < dist previous (-1) :=
      not_lt_of_ge (dist_left_le_right_of_nonpos previous nonpositive)
    simp [selectNearestCandidate, minimum?, prefer, hardNearest,
      nonpositive, rightNotBetter]
  · have positive : 0 < previous := lt_of_not_ge nonpositive
    have rightBetter := dist_right_lt_left_of_pos previous positive
    simp [selectNearestCandidate, minimum?, prefer, hardNearest,
      nonpositive, rightBetter]

theorem selectNearestCandidate_not_lipschitz (constant : NNReal) :
    ¬ LipschitzWith constant selectNearestCandidate := by
  intro lipschitz
  apply hardNearest_not_lipschitz constant
  have functionEq : selectNearestCandidate = hardNearest :=
    funext selectNearestCandidate_eq_hardNearest
  simpa only [functionEq] using lipschitz

/-- Consequently the global observable-transition premise used by the
quantitative confluence theorem cannot be assumed for this hard selector, even
when hidden state and observation are both the real predecessor coordinate. -/
theorem hardNearest_not_observableLipschitz (constant : NNReal) :
    ¬ ObservableLipschitzWith constant id hardNearest := by
  intro observableLipschitz
  apply hardNearest_not_lipschitz constant
  exact LipschitzWith.of_dist_le_mul observableLipschitz

theorem hardNearest_eq_left_of_nonpos {previous : ℝ}
    (nonpositive : previous ≤ 0) :
    hardNearest previous = -1 := by
  simp [hardNearest, nonpositive]

theorem hardNearest_eq_right_of_pos {previous : ℝ}
    (positive : 0 < previous) :
    hardNearest previous = 1 := by
  simp [hardNearest, not_le.mpr positive]

/-- Pairwise condition saying that no selector switch occurs between two
predecessor states. -/
def SameSelectionRegime (first second : ℝ) : Prop :=
  (first ≤ 0 ∧ second ≤ 0) ∨ (0 < first ∧ 0 < second)

theorem hardNearest_eq_of_sameSelectionRegime {first second : ℝ}
    (sameRegime : SameSelectionRegime first second) :
    hardNearest first = hardNearest second := by
  rcases sameRegime with left | right
  · rw [hardNearest_eq_left_of_nonpos left.1,
      hardNearest_eq_left_of_nonpos left.2]
  · rw [hardNearest_eq_right_of_pos right.1,
      hardNearest_eq_right_of_pos right.2]

theorem hardNearest_dist_zero_of_sameSelectionRegime {first second : ℝ}
    (sameRegime : SameSelectionRegime first second) :
    dist (hardNearest first) (hardNearest second) = 0 := by
  rw [hardNearest_eq_of_sameSelectionRegime sameRegime]
  exact dist_self _

/-- Predecessor states whose distance from the switching boundary is at least
`margin`. -/
abbrev AwayFromSwitch (margin : ℝ) :=
  { previous : ℝ // previous ≤ -margin ∨ margin ≤ previous }

def inverseMargin (margin : ℝ) (positive : 0 < margin) : NNReal :=
  ⟨1 / margin, (one_div_pos.mpr positive).le⟩

def hardNearestAway (margin : ℝ) (previous : AwayFromSwitch margin) : ℝ :=
  hardNearest previous.1

def selectNearestCandidateAway
    (margin : ℝ) (previous : AwayFromSwitch margin) : ℝ :=
  selectNearestCandidate previous.1

/-- Excluding a positive margin around the switch restores a finite global
bound on the remaining disconnected domain. -/
theorem hardNearestAway_lipschitz (margin : ℝ) (marginPositive : 0 < margin) :
    LipschitzWith (inverseMargin margin marginPositive)
      (hardNearestAway margin) := by
  apply LipschitzWith.of_dist_le_mul
  intro first second
  rcases first.property with firstLeft | firstRight <;>
    rcases second.property with secondLeft | secondRight
  · have firstNonpositive : first.1 ≤ 0 := by linarith
    have secondNonpositive : second.1 ≤ 0 := by linarith
    change dist (hardNearest first.1) (hardNearest second.1) ≤
      (1 / margin) * dist first.1 second.1
    rw [hardNearest_eq_left_of_nonpos firstNonpositive,
      hardNearest_eq_left_of_nonpos secondNonpositive, dist_self]
    exact mul_nonneg (one_div_pos.mpr marginPositive).le dist_nonneg

  · have firstNonpositive : first.1 ≤ 0 := by linarith
    have secondPositive : 0 < second.1 := by linarith
    have distanceLower : 2 * margin ≤ dist first.1 second.1 := by
      rw [Real.dist_eq, abs_of_nonpos (by linarith)]
      linarith
    have ratioBound : 2 ≤ dist first.1 second.1 / margin :=
      (le_div_iff₀ marginPositive).2 distanceLower
    change dist (hardNearest first.1) (hardNearest second.1) ≤
      (1 / margin) * dist first.1 second.1
    rw [hardNearest_eq_left_of_nonpos firstNonpositive,
      hardNearest_eq_right_of_pos secondPositive]
    have outputDistance : dist (-1 : ℝ) 1 = 2 := by
      norm_num [Real.dist_eq]
    rw [outputDistance]
    simpa [div_eq_mul_inv, mul_comm] using ratioBound
  · have firstPositive : 0 < first.1 := by linarith
    have secondNonpositive : second.1 ≤ 0 := by linarith
    have distanceLower : 2 * margin ≤ dist first.1 second.1 := by
      rw [Real.dist_eq, abs_of_nonneg (by linarith)]
      linarith
    have ratioBound : 2 ≤ dist first.1 second.1 / margin :=
      (le_div_iff₀ marginPositive).2 distanceLower
    change dist (hardNearest first.1) (hardNearest second.1) ≤
      (1 / margin) * dist first.1 second.1
    rw [hardNearest_eq_right_of_pos firstPositive,
      hardNearest_eq_left_of_nonpos secondNonpositive]
    have outputDistance : dist (1 : ℝ) (-1) = 2 := by
      norm_num [Real.dist_eq]
    rw [outputDistance]
    simpa [div_eq_mul_inv, mul_comm] using ratioBound
  · have firstPositive : 0 < first.1 := by linarith
    have secondPositive : 0 < second.1 := by linarith
    change dist (hardNearest first.1) (hardNearest second.1) ≤
      (1 / margin) * dist first.1 second.1
    rw [hardNearest_eq_right_of_pos firstPositive,
      hardNearest_eq_right_of_pos secondPositive, dist_self]
    exact mul_nonneg (one_div_pos.mpr marginPositive).le dist_nonneg

/-- The finite argmin presentation inherits the same recovered bound. -/
theorem selectNearestCandidateAway_lipschitz
    (margin : ℝ) (marginPositive : 0 < margin) :
    LipschitzWith (inverseMargin margin marginPositive)
      (selectNearestCandidateAway margin) := by
  apply LipschitzWith.of_dist_le_mul
  intro first second
  rw [selectNearestCandidateAway, selectNearestCandidateAway,
    selectNearestCandidate_eq_hardNearest,
    selectNearestCandidate_eq_hardNearest]
  exact (hardNearestAway_lipschitz margin marginPositive).dist_le_mul
    first second

/-- The recovered `1 / margin` coefficient is attained by the two boundary
points, so it cannot be reduced for this restricted domain. -/
theorem hardNearestAway_margin_bound_tight
    (margin : ℝ) (marginPositive : 0 < margin) :
    dist (hardNearest (-margin)) (hardNearest margin) =
      (inverseMargin margin marginPositive : ℝ) *
        dist (-margin) margin := by
  rw [show hardNearest (-margin) = -1 by
      exact hardNearest_eq_left_of_nonpos (by linarith),
    show hardNearest margin = 1 by
      exact hardNearest_eq_right_of_pos marginPositive]
  change |(-1 : ℝ) - 1| = (1 / margin) * |-margin - margin|
  rw [abs_of_neg (by norm_num : (-1 : ℝ) - 1 < 0),
    abs_of_neg (by linarith : -margin - margin < 0)]
  field_simp

end

end Sprawlens.HardSelectorLipschitz
