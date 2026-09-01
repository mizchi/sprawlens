import Sprawlens.QuantitativeConfluence

namespace Sprawlens.EditSpecificConfluence

open ConfluenceDefect
open LayoutConfluence
open ReachableConfluence
open QuantitativeConfluence

universe u v

/-- Exact Lipschitz amplification assigned to an edit suffix. -/
def suffixWeight {Edit : Type u}
    (constant : Edit → NNReal) (edits : List Edit) : NNReal :=
  (edits.map constant).prod

/-- A sequence of edit-specific Lipschitz bounds composes by multiplication. -/
theorem runEdits_lipschitzWith_product
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (constant : Edit → NNReal)
    (editLipschitz : ∀ edit, LipschitzWith (constant edit) (apply edit))
    (edits : List Edit) :
    LipschitzWith (suffixWeight constant edits) (runEdits apply edits) := by
  induction edits with
  | nil =>
      apply LipschitzWith.of_dist_le_mul
      intro first second
      simp [suffixWeight, runEdits]
  | cons edit rest inductionHypothesis =>
      apply LipschitzWith.of_dist_le_mul
      intro first second
      calc
        dist (runEdits apply (edit :: rest) first)
            (runEdits apply (edit :: rest) second) =
            dist (runEdits apply rest (apply edit first))
              (runEdits apply rest (apply edit second)) := rfl
        _ ≤ (suffixWeight constant rest : ℝ) *
              dist (apply edit first) (apply edit second) :=
          inductionHypothesis.dist_le_mul _ _
        _ ≤ (suffixWeight constant rest : ℝ) *
              (constant edit * dist first second) := by
          exact mul_le_mul_of_nonneg_left
            ((editLipschitz edit).dist_le_mul first second)
            (NNReal.coe_nonneg _)
        _ = (suffixWeight constant (edit :: rest) : ℝ) *
              dist first second := by
          simp only [suffixWeight, List.map_cons, List.prod_cons, NNReal.coe_mul]
          ring

/-- Trace equivalence whose primitive swap cost is the product of the actual
Lipschitz constants in its common suffix. -/
inductive TraceEquivalentWithEditWeight {Edit : Type u}
    (Independent : Edit → Edit → Prop) (constant : Edit → NNReal) :
    NNReal → List Edit → List Edit → Prop
  | refl (edits : List Edit) :
      TraceEquivalentWithEditWeight Independent constant 0 edits edits
  | swap (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      TraceEquivalentWithEditWeight Independent constant
        (suffixWeight constant after)
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | symm {weight : NNReal} {first second : List Edit}
      (equivalent :
        TraceEquivalentWithEditWeight Independent constant weight first second) :
      TraceEquivalentWithEditWeight Independent constant weight second first
  | trans {leftWeight rightWeight : NNReal} {first second third : List Edit}
      (left : TraceEquivalentWithEditWeight
        Independent constant leftWeight first second)
      (right : TraceEquivalentWithEditWeight
        Independent constant rightWeight second third) :
      TraceEquivalentWithEditWeight Independent constant
        (leftWeight + rightWeight) first third

theorem TraceEquivalentWithEditWeight.toTraceEquivalent
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (constant : Edit → NNReal)
    {weight : NNReal} {first second : List Edit}
    (equivalent :
      TraceEquivalentWithEditWeight Independent constant weight first second) :
    TraceEquivalent Independent first second := by
  induction equivalent with
  | refl edits => exact .refl edits
  | swap before after first second independent =>
      exact .swap before after first second independent
  | symm _ inductionHypothesis => exact inductionHypothesis.symm
  | trans _ _ leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- A common suffix amplifies a local square by at most the product of its
actual edit-specific Lipschitz constants. -/
theorem runEdits_swap_dist_le_suffixProduct_mul_squareDefect
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (constant : Edit → NNReal)
    (editLipschitz : ∀ edit, LipschitzWith (constant edit) (apply edit))
    (before after : List Edit) (first second : Edit) (initial : State) :
    dist
        (runEdits apply (before ++ first :: second :: after) initial)
        (runEdits apply (before ++ second :: first :: after) initial) ≤
      (suffixWeight constant after : ℝ) *
        squareDefect apply first second (runEdits apply before initial) := by
  rw [runEdits_append, runEdits_append]
  simp only [runEdits]
  simpa only [squareDefect] using
    (runEdits_lipschitzWith_product apply constant editLipschitz after).dist_le_mul
      (apply second (apply first (runEdits apply before initial)))
      (apply first (apply second (runEdits apply before initial)))

/-- Edit-specific local-to-global bound. Unlike a uniform `L^m` estimate, each
primitive square is multiplied only by constants of edits that actually follow
it. -/
theorem dist_runEdits_le_editWeight_mul_of_lipschitz
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (initial : State) (constant : Edit → NNReal) (budget : ℝ)
    (editLipschitz : ∀ edit, LipschitzWith (constant edit) (apply edit))
    (localBound : ReachableSquareDefectBound apply Independent initial budget)
    {weight : NNReal} {first second : List Edit}
    (equivalent :
      TraceEquivalentWithEditWeight Independent constant weight first second) :
    dist (runEdits apply first initial) (runEdits apply second initial) ≤
      weight * budget := by
  induction equivalent with
  | refl edits => simp
  | swap before after first second independent =>
      calc
        dist
            (runEdits apply (before ++ first :: second :: after) initial)
            (runEdits apply (before ++ second :: first :: after) initial) ≤
            (suffixWeight constant after : ℝ) *
              squareDefect apply first second (runEdits apply before initial) :=
          runEdits_swap_dist_le_suffixProduct_mul_squareDefect
            apply constant editLipschitz before after first second initial
        _ ≤ (suffixWeight constant after : ℝ) * budget := by
          exact mul_le_mul_of_nonneg_left
            (localBound first second independent
              (runEdits apply before initial) ⟨before, rfl⟩)
            (NNReal.coe_nonneg _)
  | symm equivalent inductionHypothesis =>
      simpa only [dist_comm] using inductionHypothesis
  | @trans leftWeight rightWeight first second third left right
      leftHypothesis rightHypothesis =>
      calc
        dist (runEdits apply first initial) (runEdits apply third initial) ≤
            dist (runEdits apply first initial) (runEdits apply second initial) +
              dist (runEdits apply second initial) (runEdits apply third initial) :=
          dist_triangle _ _ _
        _ ≤ leftWeight * budget + rightWeight * budget :=
          add_le_add leftHypothesis rightHypothesis
        _ = (leftWeight + rightWeight) * budget := by rw [add_mul]

/-- Observation-only composition using edit-specific constants. The hidden
state remains unmetricized. -/
theorem runEdits_observable_lipschitzWith_product
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (constant : Edit → NNReal)
    (editLipschitz :
      ∀ edit, ObservableLipschitzWith (constant edit) observe (apply edit))
    (edits : List Edit) (first second : State) :
    dist (observe (runEdits apply edits first))
        (observe (runEdits apply edits second)) ≤
      (suffixWeight constant edits : ℝ) *
        dist (observe first) (observe second) := by
  induction edits generalizing first second with
  | nil => simp [suffixWeight, runEdits]
  | cons edit rest inductionHypothesis =>
      calc
        dist (observe (runEdits apply (edit :: rest) first))
            (observe (runEdits apply (edit :: rest) second)) =
            dist (observe (runEdits apply rest (apply edit first)))
              (observe (runEdits apply rest (apply edit second))) := rfl
        _ ≤ (suffixWeight constant rest : ℝ) *
              dist (observe (apply edit first)) (observe (apply edit second)) :=
          inductionHypothesis (apply edit first) (apply edit second)
        _ ≤ (suffixWeight constant rest : ℝ) *
              (constant edit * dist (observe first) (observe second)) := by
          exact mul_le_mul_of_nonneg_left
            (editLipschitz edit first second)
            (NNReal.coe_nonneg _)
        _ = (suffixWeight constant (edit :: rest) : ℝ) *
              dist (observe first) (observe second) := by
          simp only [suffixWeight, List.map_cons, List.prod_cons, NNReal.coe_mul]
          ring

theorem runEdits_swap_observable_dist_le_suffixProduct_mul_defect
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (constant : Edit → NNReal)
    (editLipschitz :
      ∀ edit, ObservableLipschitzWith (constant edit) observe (apply edit))
    (before after : List Edit) (first second : Edit) (initial : State) :
    dist
        (observe (runEdits apply (before ++ first :: second :: after) initial))
        (observe (runEdits apply (before ++ second :: first :: after) initial)) ≤
      (suffixWeight constant after : ℝ) *
        observableSquareDefect observe apply first second
          (runEdits apply before initial) := by
  rw [runEdits_append, runEdits_append]
  simp only [runEdits]
  simpa only [observableSquareDefect] using
    runEdits_observable_lipschitzWith_product
      observe apply constant editLipschitz after
      (apply second (apply first (runEdits apply before initial)))
      (apply first (apply second (runEdits apply before initial)))

/-- Observable edit-specific local-to-global theorem for final geometry. -/
theorem observable_dist_runEdits_le_editWeight_mul_of_lipschitz
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (constant : Edit → NNReal) (budget : ℝ)
    (editLipschitz :
      ∀ edit, ObservableLipschitzWith (constant edit) observe (apply edit))
    (localBound : ObservableReachableSquareDefectBound
      observe apply Independent initial budget)
    {weight : NNReal} {first second : List Edit}
    (equivalent :
      TraceEquivalentWithEditWeight Independent constant weight first second) :
    dist (observe (runEdits apply first initial))
        (observe (runEdits apply second initial)) ≤
      weight * budget := by
  induction equivalent with
  | refl edits => simp
  | swap before after first second independent =>
      calc
        dist
            (observe (runEdits apply (before ++ first :: second :: after) initial))
            (observe (runEdits apply (before ++ second :: first :: after) initial)) ≤
            (suffixWeight constant after : ℝ) *
              observableSquareDefect observe apply first second
                (runEdits apply before initial) :=
          runEdits_swap_observable_dist_le_suffixProduct_mul_defect
            observe apply constant editLipschitz
            before after first second initial
        _ ≤ (suffixWeight constant after : ℝ) * budget := by
          exact mul_le_mul_of_nonneg_left
            (localBound first second independent
              (runEdits apply before initial) ⟨before, rfl⟩)
            (NNReal.coe_nonneg _)
  | symm equivalent inductionHypothesis =>
      simpa only [dist_comm] using inductionHypothesis
  | @trans leftWeight rightWeight first second third left right
      leftHypothesis rightHypothesis =>
      calc
        dist (observe (runEdits apply first initial))
            (observe (runEdits apply third initial)) ≤
            dist (observe (runEdits apply first initial))
                (observe (runEdits apply second initial)) +
              dist (observe (runEdits apply second initial))
                (observe (runEdits apply third initial)) :=
          dist_triangle _ _ _
        _ ≤ leftWeight * budget + rightWeight * budget :=
          add_le_add leftHypothesis rightHypothesis
        _ = (leftWeight + rightWeight) * budget := by rw [add_mul]

/-- Tightness witness: reset is 0-Lipschitz, increment is 1-Lipschitz, and
double is 2-Lipschitz. -/
def expandingEditConstant : ExpandingEdit → NNReal
  | .reset => 0
  | .increment => 1
  | .double => 2

theorem applyExpandingEdit_lipschitzSpecific (edit : ExpandingEdit) :
    LipschitzWith (expandingEditConstant edit) (applyExpandingEdit edit) := by
  apply LipschitzWith.of_dist_le_mul
  intro first second
  cases edit with
  | reset => simp [expandingEditConstant, applyExpandingEdit]
  | increment =>
      simp only [expandingEditConstant, applyExpandingEdit, Real.dist_eq]
      rw [show first + 1 - (second + 1) = first - second by ring]
      simp
  | double =>
      simp only [expandingEditConstant, applyExpandingEdit, Real.dist_eq]
      rw [show 2 * first - 2 * second = 2 * (first - second) by ring]
      simp [abs_mul]

theorem expandingEdit_specific_weighted_trace :
    TraceEquivalentWithEditWeight
      ExpandingIndependent expandingEditConstant 2
      [.reset, .increment, .double, .increment]
      [.increment, .reset, .double, .increment] := by
  simpa [suffixWeight, expandingEditConstant] using
    (TraceEquivalentWithEditWeight.swap
      (Independent := ExpandingIndependent)
      (constant := expandingEditConstant)
      [] [.double, .increment] .reset .increment
      ExpandingIndependent.reset_increment)

theorem expandingEdit_specific_weight_lt_uniform_weight :
    suffixWeight expandingEditConstant [.double, .increment] <
      (2 : NNReal) ^ ([.double, .increment] : List ExpandingEdit).length := by
  norm_num [suffixWeight, expandingEditConstant]

theorem expandingEdit_specific_suffix_distance :
    dist
        (runEdits applyExpandingEdit
          [.reset, .increment, .double, .increment] 0)
        (runEdits applyExpandingEdit
          [.increment, .reset, .double, .increment] 0) = 2 := by
  norm_num [runEdits, applyExpandingEdit, Real.dist_eq]

/-- The edit-specific theorem gives the exact bound 2 where the uniform
2-Lipschitz theorem assigns weight 2^2 = 4. -/
theorem expandingEdit_specific_weighted_bound :
    dist
        (runEdits applyExpandingEdit
          [.reset, .increment, .double, .increment] 0)
        (runEdits applyExpandingEdit
          [.increment, .reset, .double, .increment] 0) ≤ 2 := by
  simpa using
    (dist_runEdits_le_editWeight_mul_of_lipschitz
      applyExpandingEdit ExpandingIndependent 0 expandingEditConstant 1
      applyExpandingEdit_lipschitzSpecific
      expandingEdit_reachable_squareDefect_le_one
      expandingEdit_specific_weighted_trace)

end Sprawlens.EditSpecificConfluence
