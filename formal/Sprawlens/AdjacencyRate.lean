import Mathlib.Data.Rat.Defs
import Mathlib.Tactic

namespace Sprawlens.AdjacencyRate

/-- Exact score observed by `realizedEdgeRate`: empty constraints are vacuously satisfied. -/
def rate (realized eligible : Nat) : Rat :=
  if eligible = 0 then 1 else (realized : Rat) / (eligible : Rat)

@[simp] theorem rate_zero (realized : Nat) : rate realized 0 = 1 := by
  simp [rate]

theorem rate_of_pos (realized : Nat) {eligible : Nat} (eligiblePos : 0 < eligible) :
    rate realized eligible = (realized : Rat) / (eligible : Rat) := by
  simp [rate, Nat.ne_of_gt eligiblePos]

theorem rate_nonneg (realized eligible : Nat) : 0 ≤ rate realized eligible := by
  by_cases eligibleZero : eligible = 0
  · subst eligible
    simp
  · rw [rate, if_neg eligibleZero]
    positivity

theorem rate_le_one {realized eligible : Nat} (realizedLe : realized ≤ eligible) :
    rate realized eligible ≤ 1 := by
  by_cases eligibleZero : eligible = 0
  · subst eligible
    simp
  · rw [rate, if_neg eligibleZero]
    apply (div_le_one (by positivity : (0 : Rat) < eligible)).mpr
    exact_mod_cast realizedLe

theorem rate_mem_unit_interval {realized eligible : Nat} (realizedLe : realized ≤ eligible) :
    rate realized eligible ∈ Set.Icc (0 : Rat) 1 :=
  ⟨rate_nonneg realized eligible, rate_le_one realizedLe⟩

/-- If the slack is smaller than one score quantum, acceptance cannot hide one lost edge. -/
theorem realized_ge_of_rate_add_slack_ge
    {selectedRealized baselineRealized eligible : Nat} {slack : Rat}
    (eligiblePos : 0 < eligible)
    (slackBelowQuantum : slack * (eligible : Rat) < 1)
    (accepted : rate selectedRealized eligible + slack ≥ rate baselineRealized eligible) :
    baselineRealized ≤ selectedRealized := by
  rw [rate_of_pos selectedRealized eligiblePos, rate_of_pos baselineRealized eligiblePos] at accepted
  by_contra lostEdge
  have countGap : selectedRealized + 1 ≤ baselineRealized :=
    Nat.add_one_le_iff.mpr (Nat.lt_of_not_ge lostEdge)
  have countGapRat : (selectedRealized : Rat) + 1 ≤ (baselineRealized : Rat) := by
    exact_mod_cast countGap
  have eligibleRatPos : (0 : Rat) < (eligible : Rat) := by
    exact_mod_cast eligiblePos
  have acceptedScaled := mul_le_mul_of_nonneg_right accepted eligibleRatPos.le
  have upperBound :
      (baselineRealized : Rat) ≤ (selectedRealized : Rat) + slack * (eligible : Rat) := by
    calc
      (baselineRealized : Rat) =
          ((baselineRealized : Rat) / (eligible : Rat)) * (eligible : Rat) := by
            field_simp
      _ ≤ (((selectedRealized : Rat) / (eligible : Rat)) + slack) *
          (eligible : Rat) := acceptedScaled
      _ = (selectedRealized : Rat) + slack * (eligible : Rat) := by
            field_simp
  linarith

/-- Numerical comparison slack used by the TypeScript feasible-envelope selector. -/
def javascriptSlack : Rat := 1 / 1000000000000

theorem javascriptSlack_below_quantum {eligible : Nat}
    (eligibleBound : eligible < 1000000000000) :
    javascriptSlack * (eligible : Rat) < 1 := by
  have eligibleBoundRat : (eligible : Rat) < 1000000000000 := by
    exact_mod_cast eligibleBound
  calc
    javascriptSlack * (eligible : Rat) = (eligible : Rat) / 1000000000000 := by
      norm_num [javascriptSlack]
      ring
    _ < 1 := (div_lt_one (by norm_num : (0 : Rat) < 1000000000000)).mpr eligibleBoundRat

theorem javascript_acceptance_preserves_realized_count
    {selectedRealized baselineRealized eligible : Nat}
    (eligiblePos : 0 < eligible)
    (eligibleBound : eligible < 1000000000000)
    (accepted :
      rate selectedRealized eligible + javascriptSlack ≥ rate baselineRealized eligible) :
    baselineRealized ≤ selectedRealized := by
  exact realized_ge_of_rate_add_slack_ge eligiblePos
    (javascriptSlack_below_quantum eligibleBound) accepted

/-- The strict denominator bound is load-bearing: at exactly `10^12`, one lost edge can tie. -/
example : rate 0 1000000000000 + javascriptSlack ≥ rate 1 1000000000000 := by
  norm_num [rate, javascriptSlack]

example : ¬(1 : Nat) ≤ 0 := by omega

end Sprawlens.AdjacencyRate
