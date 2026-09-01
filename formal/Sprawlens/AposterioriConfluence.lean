import Sprawlens.EditSpecificConfluence

namespace Sprawlens.AposterioriConfluence

open ConfluenceDefect
open LayoutConfluence
open QuantitativeConfluence
open EditSpecificConfluence

universe u v

/-- A trace-equivalence certificate indexed by the sum of its primitive swap
costs. The cost model is explicit, so the relation can certify state or
observation defects without extracting data from a proof in `Prop`. -/
inductive TraceCertificate {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    ℝ → List Edit → List Edit → Prop
  | refl (edits : List Edit) :
      TraceCertificate Independent swapCost 0 edits edits
  | swap (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      TraceCertificate Independent swapCost
        (swapCost before after first second)
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | symm {cost : ℝ} {first second : List Edit}
      (certificate :
        TraceCertificate Independent swapCost cost first second) :
      TraceCertificate Independent swapCost cost second first
  | trans {leftCost rightCost : ℝ} {first second third : List Edit}
      (left : TraceCertificate Independent swapCost leftCost first second)
      (right : TraceCertificate Independent swapCost rightCost second third) :
      TraceCertificate Independent swapCost
        (leftCost + rightCost) first third

theorem TraceCertificate.toTraceEquivalent
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent swapCost cost first second) :
    TraceEquivalent Independent first second := by
  induction certificate with
  | refl edits => exact .refl edits
  | swap before after first second independent =>
      exact .swap before after first second independent
  | symm _ inductionHypothesis => exact inductionHypothesis.symm
  | trans _ _ leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

theorem TraceCertificate.cost_nonneg
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : ∀ before after first second,
      0 ≤ swapCost before after first second)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent swapCost cost first second) :
    0 ≤ cost := by
  induction certificate with
  | refl => exact le_rfl
  | swap before after first second _ =>
      exact primitiveNonneg before after first second
  | symm _ inductionHypothesis => exact inductionHypothesis
  | trans _ _ leftHypothesis rightHypothesis =>
      exact add_nonneg leftHypothesis rightHypothesis

/-- The actual defect contribution of one state-level primitive swap. -/
def stateSwapCost
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (initial : State)
    (constant : Edit → NNReal)
    (before after : List Edit) (first second : Edit) : ℝ :=
  (suffixWeight constant after : ℝ) *
    squareDefect apply first second (runEdits apply before initial)

theorem stateSwapCost_nonneg
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (initial : State)
    (constant : Edit → NNReal)
    (before after : List Edit) (first second : Edit) :
    0 ≤ stateSwapCost apply initial constant before after first second := by
  exact mul_nonneg (NNReal.coe_nonneg _) dist_nonneg

/-- The final endpoint distance is bounded by the certificate's actual local
defect sum; no uniform local budget is required. -/
theorem dist_runEdits_le_stateCertificate
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (initial : State) (constant : Edit → NNReal)
    (editLipschitz : ∀ edit, LipschitzWith (constant edit) (apply edit))
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (stateSwapCost apply initial constant) cost first second) :
    dist (runEdits apply first initial) (runEdits apply second initial) ≤
      cost := by
  induction certificate with
  | refl edits => simp
  | swap before after first second independent =>
      simpa only [stateSwapCost] using
        runEdits_swap_dist_le_suffixProduct_mul_squareDefect
          apply constant editLipschitz before after first second initial
  | symm certificate inductionHypothesis =>
      simpa only [dist_comm] using inductionHypothesis
  | @trans leftCost rightCost first second third left right
      leftHypothesis rightHypothesis =>
      calc
        dist (runEdits apply first initial) (runEdits apply third initial) ≤
            dist (runEdits apply first initial) (runEdits apply second initial) +
              dist (runEdits apply second initial) (runEdits apply third initial) :=
          dist_triangle _ _ _
        _ ≤ leftCost + rightCost := add_le_add leftHypothesis rightHypothesis

/-- Every edit-weight derivation with a uniform reachable square budget has a
more informative a posteriori certificate no larger than the old bound. -/
theorem exists_stateCertificate_le_editWeight_mul_budget
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (initial : State) (constant : Edit → NNReal) (budget : ℝ)
    (localBound : ReachableSquareDefectBound apply Independent initial budget)
    {weight : NNReal} {first second : List Edit}
    (equivalent :
      TraceEquivalentWithEditWeight Independent constant weight first second) :
    ∃ cost,
      TraceCertificate Independent (stateSwapCost apply initial constant)
        cost first second ∧
      cost ≤ weight * budget := by
  induction equivalent with
  | refl edits =>
      exact ⟨0, .refl edits, by simp⟩
  | swap before after first second independent =>
      refine ⟨stateSwapCost apply initial constant before after first second,
        .swap before after first second independent, ?_⟩
      exact mul_le_mul_of_nonneg_left
        (localBound first second independent
          (runEdits apply before initial) ⟨before, rfl⟩)
        (NNReal.coe_nonneg _)
  | symm equivalent inductionHypothesis =>
      obtain ⟨cost, certificate, bound⟩ := inductionHypothesis
      exact ⟨cost, certificate.symm, bound⟩
  | @trans leftWeight rightWeight first second third left right
      leftHypothesis rightHypothesis =>
      obtain ⟨leftCost, leftCertificate, leftBound⟩ := leftHypothesis
      obtain ⟨rightCost, rightCertificate, rightBound⟩ := rightHypothesis
      refine ⟨leftCost + rightCost, leftCertificate.trans rightCertificate, ?_⟩
      calc
        leftCost + rightCost ≤
            leftWeight * budget + rightWeight * budget :=
          add_le_add leftBound rightBound
        _ = (leftWeight + rightWeight) * budget := by rw [add_mul]

/-- The actual observation defect contribution of one primitive swap. -/
def observableSwapCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (constant : Edit → NNReal)
    (before after : List Edit) (first second : Edit) : ℝ :=
  (suffixWeight constant after : ℝ) *
    observableSquareDefect observe apply first second
      (runEdits apply before initial)

theorem observableSwapCost_nonneg
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (constant : Edit → NNReal)
    (before after : List Edit) (first second : Edit) :
    0 ≤ observableSwapCost observe apply initial constant
      before after first second := by
  exact mul_nonneg (NNReal.coe_nonneg _) dist_nonneg

/-- Observation-only a posteriori certificate theorem. This is the form used
to certify final geometry while leaving solver state hidden and unmetricized. -/
theorem observable_dist_runEdits_le_certificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (constant : Edit → NNReal)
    (editLipschitz :
      ∀ edit, ObservableLipschitzWith (constant edit) observe (apply edit))
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (observableSwapCost observe apply initial constant) cost first second) :
    dist (observe (runEdits apply first initial))
        (observe (runEdits apply second initial)) ≤
      cost := by
  induction certificate with
  | refl edits => simp
  | swap before after first second independent =>
      simpa only [observableSwapCost] using
        runEdits_swap_observable_dist_le_suffixProduct_mul_defect
          observe apply constant editLipschitz
          before after first second initial
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

theorem exists_observableCertificate_le_editWeight_mul_budget
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (constant : Edit → NNReal) (budget : ℝ)
    (localBound : ObservableReachableSquareDefectBound
      observe apply Independent initial budget)
    {weight : NNReal} {first second : List Edit}
    (equivalent :
      TraceEquivalentWithEditWeight Independent constant weight first second) :
    ∃ cost,
      TraceCertificate Independent
        (observableSwapCost observe apply initial constant) cost first second ∧
      cost ≤ weight * budget := by
  induction equivalent with
  | refl edits =>
      exact ⟨0, .refl edits, by simp⟩
  | swap before after first second independent =>
      refine ⟨observableSwapCost observe apply initial constant
          before after first second,
        .swap before after first second independent, ?_⟩
      exact mul_le_mul_of_nonneg_left
        (localBound first second independent
          (runEdits apply before initial) ⟨before, rfl⟩)
        (NNReal.coe_nonneg _)
  | symm equivalent inductionHypothesis =>
      obtain ⟨cost, certificate, bound⟩ := inductionHypothesis
      exact ⟨cost, certificate.symm, bound⟩
  | @trans leftWeight rightWeight first second third left right
      leftHypothesis rightHypothesis =>
      obtain ⟨leftCost, leftCertificate, leftBound⟩ := leftHypothesis
      obtain ⟨rightCost, rightCertificate, rightBound⟩ := rightHypothesis
      refine ⟨leftCost + rightCost, leftCertificate.trans rightCertificate, ?_⟩
      calc
        leftCost + rightCost ≤
            leftWeight * budget + rightWeight * budget :=
          add_le_add leftBound rightBound
        _ = (leftWeight + rightWeight) * budget := by rw [add_mul]

theorem expandingEdit_aposteriori_trace :
    TraceCertificate ExpandingIndependent
      (stateSwapCost applyExpandingEdit 0 expandingEditConstant) 2
      [.reset, .increment, .double, .increment]
      [.increment, .reset, .double, .increment] := by
  simpa [stateSwapCost, suffixWeight, expandingEditConstant,
    squareDefect, applyExpandingEdit, runEdits, Real.dist_eq] using
    (TraceCertificate.swap
      (Independent := ExpandingIndependent)
      (swapCost := stateSwapCost applyExpandingEdit 0 expandingEditConstant)
      [] [.double, .increment] .reset .increment
      ExpandingIndependent.reset_increment)

/-- The measured a posteriori certificate is exact on the expanding witness. -/
theorem expandingEdit_aposteriori_certificate_exact :
    dist
        (runEdits applyExpandingEdit
          [.reset, .increment, .double, .increment] 0)
        (runEdits applyExpandingEdit
          [.increment, .reset, .double, .increment] 0) = 2 ∧
      dist
          (runEdits applyExpandingEdit
            [.reset, .increment, .double, .increment] 0)
          (runEdits applyExpandingEdit
            [.increment, .reset, .double, .increment] 0) ≤ 2 := by
  constructor
  · exact expandingEdit_specific_suffix_distance
  · exact dist_runEdits_le_stateCertificate
      applyExpandingEdit ExpandingIndependent 0 expandingEditConstant
      applyExpandingEdit_lipschitzSpecific expandingEdit_aposteriori_trace

end Sprawlens.AposterioriConfluence
