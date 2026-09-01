import Sprawlens.AposterioriConfluence
import Sprawlens.HardSelectorLipschitz

namespace Sprawlens.PropagatedConfluence

open LayoutConfluence
open AposterioriConfluence
open ConfluenceDefect
open QuantitativeConfluence
open EditSpecificConfluence
open HardSelectorLipschitz

universe u v

noncomputable section

/-- Actual observed distance after executing the common suffix of one
primitive adjacent swap. -/
def propagatedObservableSwapCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State)
    (before after : List Edit) (first second : Edit) : ℝ :=
  dist
    (observe (runEdits apply (before ++ first :: second :: after) initial))
    (observe (runEdits apply (before ++ second :: first :: after) initial))

theorem propagatedObservableSwapCost_nonneg
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State)
    (before after : List Edit) (first second : Edit) :
    0 ≤ propagatedObservableSwapCost observe apply initial
      before after first second :=
  dist_nonneg

/-- A propagated certificate bounds final trace distance without any global or
local Lipschitz premise. -/
theorem observable_dist_runEdits_le_propagatedCertificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (propagatedObservableSwapCost observe apply initial)
      cost first second) :
    dist (observe (runEdits apply first initial))
        (observe (runEdits apply second initial)) ≤ cost := by
  induction certificate with
  | refl edits => simp
  | swap before after first second independent => exact le_rfl
  | symm certificate inductionHypothesis =>
      simpa only [dist_comm] using inductionHypothesis
  | @trans leftCost rightCost first second third left right
      leftHypothesis rightHypothesis =>
      calc
        dist (observe (runEdits apply first initial))
            (observe (runEdits apply third initial)) ≤
            dist (observe (runEdits apply first initial))
                (observe (runEdits apply second initial)) +
              dist (observe (runEdits apply second initial))
                (observe (runEdits apply third initial)) :=
          dist_triangle _ _ _
        _ ≤ leftCost + rightCost := add_le_add leftHypothesis rightHypothesis

/-- Every ordinary trace-equivalence derivation can be replayed into a
propagated certificate. This construction assumes no continuity. -/
theorem exists_propagatedCertificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) :
    ∃ cost, TraceCertificate Independent
      (propagatedObservableSwapCost observe apply initial)
      cost first second := by
  induction equivalent with
  | refl edits => exact ⟨0, .refl edits⟩
  | swap before after first second independent =>
      exact ⟨propagatedObservableSwapCost observe apply initial
        before after first second,
        .swap before after first second independent⟩
  | symm equivalent inductionHypothesis =>
      obtain ⟨cost, certificate⟩ := inductionHypothesis
      exact ⟨cost, certificate.symm⟩
  | trans left right leftHypothesis rightHypothesis =>
      obtain ⟨leftCost, leftCertificate⟩ := leftHypothesis
      obtain ⟨rightCost, rightCertificate⟩ := rightHypothesis
      exact ⟨leftCost + rightCost,
        leftCertificate.trans rightCertificate⟩

theorem exists_propagatedCertificate_with_endpoint_bound
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) :
    ∃ cost,
      TraceCertificate Independent
        (propagatedObservableSwapCost observe apply initial)
        cost first second ∧
      dist (observe (runEdits apply first initial))
          (observe (runEdits apply second initial)) ≤ cost := by
  obtain ⟨cost, certificate⟩ :=
    exists_propagatedCertificate observe apply Independent initial equivalent
  exact ⟨cost, certificate,
    observable_dist_runEdits_le_propagatedCertificate
      observe apply Independent initial certificate⟩

/-- Whenever global edit-specific Lipschitz bounds do exist, propagated cost is
no larger than the corresponding local-defect-times-suffix-product cost. -/
theorem propagatedObservableSwapCost_le_observableSwapCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (constant : Edit → NNReal)
    (editLipschitz :
      ∀ edit, ObservableLipschitzWith (constant edit) observe (apply edit))
    (before after : List Edit) (first second : Edit) :
    propagatedObservableSwapCost observe apply initial
        before after first second ≤
      observableSwapCost observe apply initial constant
        before after first second := by
  simpa only [propagatedObservableSwapCost, observableSwapCost] using
    runEdits_swap_observable_dist_le_suffixProduct_mul_defect
      observe apply constant editLipschitz
      before after first second initial

/-- The propagated certificate refines the previous local Lipschitz
certificate along the same derivation. -/
theorem exists_propagatedCertificate_le_observableCertificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (constant : Edit → NNReal)
    (editLipschitz :
      ∀ edit, ObservableLipschitzWith (constant edit) observe (apply edit))
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (observableSwapCost observe apply initial constant)
      cost first second) :
    ∃ propagatedCost,
      TraceCertificate Independent
        (propagatedObservableSwapCost observe apply initial)
        propagatedCost first second ∧
      propagatedCost ≤ cost := by
  induction certificate with
  | refl edits => exact ⟨0, .refl edits, le_rfl⟩
  | swap before after first second independent =>
      exact ⟨propagatedObservableSwapCost observe apply initial
          before after first second,
        .swap before after first second independent,
        propagatedObservableSwapCost_le_observableSwapCost
          observe apply initial constant editLipschitz
          before after first second⟩
  | symm certificate inductionHypothesis =>
      obtain ⟨propagatedCost, propagatedCertificate, bound⟩ :=
        inductionHypothesis
      exact ⟨propagatedCost, propagatedCertificate.symm, bound⟩
  | trans left right leftHypothesis rightHypothesis =>
      obtain ⟨leftCost, leftCertificate, leftBound⟩ := leftHypothesis
      obtain ⟨rightCost, rightCertificate, rightBound⟩ := rightHypothesis
      exact ⟨leftCost + rightCost,
        leftCertificate.trans rightCertificate,
        add_le_add leftBound rightBound⟩

/-- A hard selector suffix can amplify an arbitrarily small local square to a
fixed endpoint gap. -/
inductive HardSuffixEdit
  | reset
  | increment
  | select
  deriving DecidableEq, Repr

def applyHardSuffixEdit (epsilon : ℝ) : HardSuffixEdit → ℝ → ℝ
  | .reset, _ => 0
  | .increment, state => state + epsilon
  | .select, state => hardNearest state

inductive HardSuffixIndependent : HardSuffixEdit → HardSuffixEdit → Prop
  | reset_increment : HardSuffixIndependent .reset .increment

theorem hardSuffix_local_squareDefect
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon) :
    squareDefect (applyHardSuffixEdit epsilon) .reset .increment 0 = epsilon := by
  simp [squareDefect, applyHardSuffixEdit, Real.dist_eq,
    abs_of_pos epsilonPositive]

theorem hardSuffix_propagatedSwapCost
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon) :
    propagatedObservableSwapCost id (applyHardSuffixEdit epsilon) 0
      [] [.select] .reset .increment = 2 := by
  norm_num [propagatedObservableSwapCost, runEdits, applyHardSuffixEdit,
    hardNearest, not_le.mpr epsilonPositive, Real.dist_eq]

theorem hardSuffix_propagated_traceCertificate
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon) :
    TraceCertificate HardSuffixIndependent
      (propagatedObservableSwapCost id (applyHardSuffixEdit epsilon) 0)
      2
      [.reset, .increment, .select]
      [.increment, .reset, .select] := by
  simpa [hardSuffix_propagatedSwapCost epsilon epsilonPositive] using
    (TraceCertificate.swap
      (Independent := HardSuffixIndependent)
      (swapCost := propagatedObservableSwapCost
        id (applyHardSuffixEdit epsilon) 0)
      [] [.select] .reset .increment
      HardSuffixIndependent.reset_increment)

theorem hardSuffix_endpoint_distance
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon) :
    dist
        (runEdits (applyHardSuffixEdit epsilon)
          [.reset, .increment, .select] 0)
        (runEdits (applyHardSuffixEdit epsilon)
          [.increment, .reset, .select] 0) = 2 := by
  norm_num [runEdits, applyHardSuffixEdit, hardNearest,
    not_le.mpr epsilonPositive, Real.dist_eq]

theorem hardSuffix_propagated_certificate_exact
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon) :
    dist
        (runEdits (applyHardSuffixEdit epsilon)
          [.reset, .increment, .select] 0)
        (runEdits (applyHardSuffixEdit epsilon)
          [.increment, .reset, .select] 0) = 2 ∧
      dist
          (runEdits (applyHardSuffixEdit epsilon)
            [.reset, .increment, .select] 0)
          (runEdits (applyHardSuffixEdit epsilon)
            [.increment, .reset, .select] 0) ≤ 2 := by
  constructor
  · exact hardSuffix_endpoint_distance epsilon epsilonPositive
  · exact observable_dist_runEdits_le_propagatedCertificate
      id (applyHardSuffixEdit epsilon) HardSuffixIndependent 0
      (hardSuffix_propagated_traceCertificate epsilon epsilonPositive)

def adversarialEpsilon (constant : NNReal) : ℝ :=
  1 / ((constant : ℝ) + 1)

theorem adversarialEpsilon_positive (constant : NNReal) :
    0 < adversarialEpsilon constant := by
  apply one_div_pos.mpr
  exact add_pos_of_nonneg_of_pos (NNReal.coe_nonneg constant) zero_lt_one

/-- No fixed local amplification factor can recover the hard suffix bound;
the propagated certificate remains exact. -/
theorem hardSuffix_breaks_fixed_local_amplification (constant : NNReal) :
    ¬ propagatedObservableSwapCost id
          (applyHardSuffixEdit (adversarialEpsilon constant)) 0
          [] [.select] .reset .increment ≤
        (constant : ℝ) *
          squareDefect (applyHardSuffixEdit (adversarialEpsilon constant))
            .reset .increment 0 := by
  rw [hardSuffix_propagatedSwapCost
      (adversarialEpsilon constant) (adversarialEpsilon_positive constant),
    hardSuffix_local_squareDefect
      (adversarialEpsilon constant) (adversarialEpsilon_positive constant)]
  intro bound
  have denominatorPositive : 0 < (constant : ℝ) + 1 := by positivity
  have productEq :
      (constant : ℝ) * adversarialEpsilon constant =
        (constant : ℝ) / ((constant : ℝ) + 1) := by
    simp only [adversarialEpsilon]
    ring
  rw [productEq] at bound
  have fractionLessThanOne :
      (constant : ℝ) / ((constant : ℝ) + 1) < 1 :=
    (div_lt_one denominatorPositive).2 (by linarith)
  linarith

end

end Sprawlens.PropagatedConfluence
