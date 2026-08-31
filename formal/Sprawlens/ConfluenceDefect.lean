import Mathlib.Topology.MetricSpace.Lipschitz
import Sprawlens.LayoutConfluence

namespace Sprawlens.ConfluenceDefect

open LayoutConfluence

universe u v

/-- Metric residual of one edit square. Zero means that this state cannot
distinguish the two edit orders. -/
def squareDefect {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (first second : Edit) (state : State) : ℝ :=
  dist (apply second (apply first state))
    (apply first (apply second state))

theorem squareDefect_nonnegative
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (first second : Edit) (state : State) :
    0 ≤ squareDefect apply first second state := by
  exact dist_nonneg

/-- In a genuine metric space, zero defect is exactly local commutation at the
observed state. -/
theorem squareDefect_eq_zero_iff
    {Edit : Type u} {State : Type v} [MetricSpace State]
    (apply : Edit → State → State) (first second : Edit) (state : State) :
    squareDefect apply first second state = 0 ↔
      apply second (apply first state) = apply first (apply second state) := by
  exact dist_eq_zero

theorem squareDefect_eq_zero_of_commute
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (first second : Edit)
    (commute : Commute apply first second) (state : State) :
    squareDefect apply first second state = 0 := by
  simp [squareDefect, commute state]

/-- A Lipschitz bound separates the square defect into propagation of the first
edit through the second transition and the remaining first-edit displacement
at the second endpoint. -/
theorem squareDefect_le_of_second_lipschitz
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (first second : Edit) (state : State)
    (constant : NNReal) (secondLipschitz : LipschitzWith constant (apply second)) :
    squareDefect apply first second state ≤
      constant * dist (apply first state) state +
        dist (apply second state) (apply first (apply second state)) := by
  unfold squareDefect
  calc
    dist (apply second (apply first state)) (apply first (apply second state)) ≤
        dist (apply second (apply first state)) (apply second state) +
          dist (apply second state) (apply first (apply second state)) :=
      dist_triangle _ _ _
    _ ≤ constant * dist (apply first state) state +
          dist (apply second state) (apply first (apply second state)) := by
      exact add_le_add
        (secondLipschitz.dist_le_mul (apply first state) state) le_rfl

/-- If both terms in the preceding decomposition have explicit budgets, their
weighted sum bounds the observed path dependence. -/
theorem squareDefect_le_of_step_budgets
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (first second : Edit) (state : State)
    (constant : NNReal) (firstBudget residualBudget : ℝ)
    (secondLipschitz : LipschitzWith constant (apply second))
    (firstMove : dist (apply first state) state ≤ firstBudget)
    (residualMove :
      dist (apply second state) (apply first (apply second state)) ≤ residualBudget) :
    squareDefect apply first second state ≤
      constant * firstBudget + residualBudget := by
  calc
    squareDefect apply first second state ≤
        constant * dist (apply first state) state +
          dist (apply second state) (apply first (apply second state)) :=
      squareDefect_le_of_second_lipschitz
        apply first second state constant secondLipschitz
    _ ≤ constant * firstBudget + residualBudget := by
      exact add_le_add (mul_le_mul_of_nonneg_left firstMove constant.coe_nonneg)
        residualMove

end Sprawlens.ConfluenceDefect
