import Mathlib.Topology.MetricSpace.Lipschitz
import Sprawlens.ConfluenceDefect
import Sprawlens.ReachableConfluence

namespace Sprawlens.QuantitativeConfluence

open ConfluenceDefect
open LayoutConfluence
open ReachableConfluence

universe u v

/-- A trace-equivalence derivation carrying the number of primitive adjacent
swaps. Symmetry preserves the cost and transitivity adds costs. -/
inductive TraceEquivalentIn {Edit : Type u}
    (Independent : Edit → Edit → Prop) : Nat → List Edit → List Edit → Prop
  | refl (edits : List Edit) : TraceEquivalentIn Independent 0 edits edits
  | swap (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      TraceEquivalentIn Independent 1
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | symm {cost : Nat} {first second : List Edit}
      (equivalent : TraceEquivalentIn Independent cost first second) :
      TraceEquivalentIn Independent cost second first
  | trans {leftCost rightCost : Nat} {first second third : List Edit}
      (left : TraceEquivalentIn Independent leftCost first second)
      (right : TraceEquivalentIn Independent rightCost second third) :
      TraceEquivalentIn Independent (leftCost + rightCost) first third

theorem TraceEquivalentIn.toTraceEquivalent
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    TraceEquivalent Independent first second := by
  induction equivalent with
  | refl edits => exact .refl edits
  | swap before after first second independent =>
      exact .swap before after first second independent
  | symm _ inductionHypothesis => exact inductionHypothesis.symm
  | trans _ _ leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- Uniform local defect budget, restricted to the reachable state space. -/
def ReachableSquareDefectBound
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (initial : State) (budget : ℝ) : Prop :=
  ∀ first second, Independent first second →
    ∀ state, Reachable apply initial state →
      squareDefect apply first second state ≤ budget

def IsNonexpansive {State : Type v} [PseudoMetricSpace State]
    (transition : State → State) : Prop :=
  ∀ first second, dist (transition first) (transition second) ≤ dist first second

/-- A sequence of nonexpansive edit transitions remains nonexpansive. -/
theorem runEdits_nonexpansive
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State)
    (editNonexpansive : ∀ edit, IsNonexpansive (apply edit))
    (edits : List Edit) :
    IsNonexpansive (runEdits apply edits) := by
  induction edits with
  | nil =>
      intro first second
      exact le_rfl
  | cons edit rest inductionHypothesis =>
      intro first second
      calc
        dist (runEdits apply (edit :: rest) first)
            (runEdits apply (edit :: rest) second) =
            dist (runEdits apply rest (apply edit first))
              (runEdits apply rest (apply edit second)) := rfl
        _ ≤ dist (apply edit first) (apply edit second) :=
          inductionHypothesis (apply edit first) (apply edit second)
        _ ≤ dist first second := editNonexpansive edit first second

/-- A nonexpansive common suffix cannot amplify the local square defect. -/
theorem runEdits_swap_dist_le_squareDefect
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State)
    (editNonexpansive : ∀ edit, IsNonexpansive (apply edit))
    (before after : List Edit) (first second : Edit) (initial : State) :
    dist
        (runEdits apply (before ++ first :: second :: after) initial)
        (runEdits apply (before ++ second :: first :: after) initial) ≤
      squareDefect apply first second (runEdits apply before initial) := by
  rw [runEdits_append, runEdits_append]
  simp only [runEdits]
  simpa only [squareDefect] using
    (runEdits_nonexpansive apply editNonexpansive after
      (apply second (apply first (runEdits apply before initial)))
      (apply first (apply second (runEdits apply before initial))))

/-- Local-to-global bound: under nonexpansive transitions, a derivation using
`cost` adjacent swaps accumulates at most `cost * budget` endpoint defect. -/
theorem dist_runEdits_le_swapCount_mul_of_nonexpansive
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (initial : State) (budget : ℝ)
    (editNonexpansive : ∀ edit, IsNonexpansive (apply edit))
    (localBound : ReachableSquareDefectBound apply Independent initial budget)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    dist (runEdits apply first initial) (runEdits apply second initial) ≤
      cost * budget := by
  induction equivalent with
  | refl edits => simp
  | swap before after first second independent =>
      calc
        dist
            (runEdits apply (before ++ first :: second :: after) initial)
            (runEdits apply (before ++ second :: first :: after) initial) ≤
            squareDefect apply first second (runEdits apply before initial) :=
          runEdits_swap_dist_le_squareDefect
            apply editNonexpansive before after first second initial
        _ ≤ budget := localBound first second independent
          (runEdits apply before initial) ⟨before, rfl⟩
        _ = (1 : Nat) * budget := by simp
  | symm equivalent inductionHypothesis =>
      simpa only [dist_comm] using inductionHypothesis
  | @trans leftCost rightCost first second third left right
      leftHypothesis rightHypothesis =>
      calc
        dist (runEdits apply first initial) (runEdits apply third initial) ≤
            dist (runEdits apply first initial) (runEdits apply second initial) +
              dist (runEdits apply second initial) (runEdits apply third initial) :=
          dist_triangle _ _ _
        _ ≤ leftCost * budget + rightCost * budget :=
          add_le_add leftHypothesis rightHypothesis
        _ = ((leftCost + rightCost : Nat) : ℝ) * budget := by
          rw [Nat.cast_add, add_mul]

/-- Quantitative trace equivalence carrying the sum of suffix amplification
weights. A primitive swap with `m` remaining edits costs `L^m`. -/
inductive TraceEquivalentWithWeight {Edit : Type u}
    (Independent : Edit → Edit → Prop) (constant : NNReal) :
    NNReal → List Edit → List Edit → Prop
  | refl (edits : List Edit) :
      TraceEquivalentWithWeight Independent constant 0 edits edits
  | swap (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      TraceEquivalentWithWeight Independent constant (constant ^ after.length)
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | symm {weight : NNReal} {first second : List Edit}
      (equivalent : TraceEquivalentWithWeight Independent constant weight first second) :
      TraceEquivalentWithWeight Independent constant weight second first
  | trans {leftWeight rightWeight : NNReal} {first second third : List Edit}
      (left : TraceEquivalentWithWeight Independent constant leftWeight first second)
      (right : TraceEquivalentWithWeight Independent constant rightWeight second third) :
      TraceEquivalentWithWeight Independent constant (leftWeight + rightWeight) first third

theorem TraceEquivalentWithWeight.toTraceEquivalent
    {Edit : Type u} (Independent : Edit → Edit → Prop) (constant : NNReal)
    {weight : NNReal} {first second : List Edit}
    (equivalent : TraceEquivalentWithWeight Independent constant weight first second) :
    TraceEquivalent Independent first second := by
  induction equivalent with
  | refl edits => exact .refl edits
  | swap before after first second independent =>
      exact .swap before after first second independent
  | symm _ inductionHypothesis => exact inductionHypothesis.symm
  | trans _ _ leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- A common `L`-Lipschitz bound composes exponentially with suffix length. -/
theorem runEdits_lipschitzWith
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (constant : NNReal)
    (editLipschitz : ∀ edit, LipschitzWith constant (apply edit))
    (edits : List Edit) :
    LipschitzWith (constant ^ edits.length) (runEdits apply edits) := by
  induction edits with
  | nil =>
      apply LipschitzWith.of_dist_le_mul
      intro first second
      simp [runEdits]
  | cons edit rest inductionHypothesis =>
      apply LipschitzWith.of_dist_le_mul
      intro first second
      calc
        dist (runEdits apply (edit :: rest) first)
            (runEdits apply (edit :: rest) second) =
            dist (runEdits apply rest (apply edit first))
              (runEdits apply rest (apply edit second)) := rfl
        _ ≤ ((constant ^ rest.length : NNReal) : ℝ) *
              dist (apply edit first) (apply edit second) :=
          inductionHypothesis.dist_le_mul _ _
        _ ≤ ((constant ^ rest.length : NNReal) : ℝ) *
              (constant * dist first second) := by
          exact mul_le_mul_of_nonneg_left
            ((editLipschitz edit).dist_le_mul first second)
            (NNReal.coe_nonneg _)
        _ = ((constant ^ (edit :: rest).length : NNReal) : ℝ) *
              dist first second := by
          simp only [List.length_cons, pow_succ, NNReal.coe_mul]
          ring

/-- A common suffix amplifies one local square by at most `L^suffix.length`. -/
theorem runEdits_swap_dist_le_suffixWeight_mul_squareDefect
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (constant : NNReal)
    (editLipschitz : ∀ edit, LipschitzWith constant (apply edit))
    (before after : List Edit) (first second : Edit) (initial : State) :
    dist
        (runEdits apply (before ++ first :: second :: after) initial)
        (runEdits apply (before ++ second :: first :: after) initial) ≤
      ((constant ^ after.length : NNReal) : ℝ) *
        squareDefect apply first second (runEdits apply before initial) := by
  rw [runEdits_append, runEdits_append]
  simp only [runEdits]
  simpa only [squareDefect] using
    (runEdits_lipschitzWith apply constant editLipschitz after).dist_le_mul
      (apply second (apply first (runEdits apply before initial)))
      (apply first (apply second (runEdits apply before initial)))

/-- General local-to-global bound. Each primitive square defect is multiplied
by the Lipschitz amplification of its common suffix, and transitive derivations
add those weighted costs. -/
theorem dist_runEdits_le_weight_mul_of_lipschitz
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (Independent : Edit → Edit → Prop)
    (initial : State) (constant : NNReal) (budget : ℝ)
    (editLipschitz : ∀ edit, LipschitzWith constant (apply edit))
    (localBound : ReachableSquareDefectBound apply Independent initial budget)
    {weight : NNReal} {first second : List Edit}
    (equivalent : TraceEquivalentWithWeight Independent constant weight first second) :
    dist (runEdits apply first initial) (runEdits apply second initial) ≤
      weight * budget := by
  induction equivalent with
  | refl edits => simp
  | swap before after first second independent =>
      calc
        dist
            (runEdits apply (before ++ first :: second :: after) initial)
            (runEdits apply (before ++ second :: first :: after) initial) ≤
            ((constant ^ after.length : NNReal) : ℝ) *
              squareDefect apply first second (runEdits apply before initial) :=
          runEdits_swap_dist_le_suffixWeight_mul_squareDefect
            apply constant editLipschitz before after first second initial
        _ ≤ ((constant ^ after.length : NNReal) : ℝ) * budget := by
          exact mul_le_mul_of_nonneg_left
            (localBound first second independent
              (runEdits apply before initial) ⟨before, rfl⟩)
            (NNReal.coe_nonneg (constant ^ after.length))
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
        _ = (leftWeight + rightWeight) * budget := by
          rw [add_mul]

/-- Observable transition bound. The hidden layout state needs no metric; only
the reported geometry lives in a pseudometric space. -/
def ObservableLipschitzWith
    {State : Type u} {Observation : Type v} [PseudoMetricSpace Observation]
    (constant : NNReal) (observe : State → Observation)
    (transition : State → State) : Prop :=
  ∀ first second,
    dist (observe (transition first)) (observe (transition second)) ≤
      constant * dist (observe first) (observe second)

def observableSquareDefect
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : Edit) (state : State) : ℝ :=
  dist
    (observe (apply second (apply first state)))
    (observe (apply first (apply second state)))

def ObservableReachableSquareDefectBound
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State) (budget : ℝ) : Prop :=
  ∀ first second, Independent first second →
    ∀ state, Reachable apply initial state →
      observableSquareDefect observe apply first second state ≤ budget

/-- Per-edit observable Lipschitz bounds compose through an arbitrary suffix. -/
theorem runEdits_observable_lipschitzWith
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (constant : NNReal)
    (editLipschitz : ∀ edit, ObservableLipschitzWith constant observe (apply edit))
    (edits : List Edit) (first second : State) :
    dist (observe (runEdits apply edits first))
        (observe (runEdits apply edits second)) ≤
      ((constant ^ edits.length : NNReal) : ℝ) *
        dist (observe first) (observe second) := by
  induction edits generalizing first second with
  | nil => simp [runEdits]
  | cons edit rest inductionHypothesis =>
      calc
        dist (observe (runEdits apply (edit :: rest) first))
            (observe (runEdits apply (edit :: rest) second)) =
            dist (observe (runEdits apply rest (apply edit first)))
              (observe (runEdits apply rest (apply edit second))) := rfl
        _ ≤ ((constant ^ rest.length : NNReal) : ℝ) *
              dist (observe (apply edit first)) (observe (apply edit second)) :=
          inductionHypothesis (apply edit first) (apply edit second)
        _ ≤ ((constant ^ rest.length : NNReal) : ℝ) *
              (constant * dist (observe first) (observe second)) := by
          exact mul_le_mul_of_nonneg_left
            (editLipschitz edit first second)
            (NNReal.coe_nonneg _)
        _ = ((constant ^ (edit :: rest).length : NNReal) : ℝ) *
              dist (observe first) (observe second) := by
          simp only [List.length_cons, pow_succ, NNReal.coe_mul]
          ring

theorem runEdits_swap_observable_dist_le_suffixWeight_mul_defect
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (constant : NNReal)
    (editLipschitz : ∀ edit, ObservableLipschitzWith constant observe (apply edit))
    (before after : List Edit) (first second : Edit) (initial : State) :
    dist
        (observe (runEdits apply (before ++ first :: second :: after) initial))
        (observe (runEdits apply (before ++ second :: first :: after) initial)) ≤
      ((constant ^ after.length : NNReal) : ℝ) *
        observableSquareDefect observe apply first second
          (runEdits apply before initial) := by
  rw [runEdits_append, runEdits_append]
  simp only [runEdits]
  simpa only [observableSquareDefect] using
    runEdits_observable_lipschitzWith
      observe apply constant editLipschitz after
      (apply second (apply first (runEdits apply before initial)))
      (apply first (apply second (runEdits apply before initial)))

/-- Observable local-to-global theorem. It bounds final geometry differences
without introducing a metric on hidden solver state. -/
theorem observable_dist_runEdits_le_weight_mul_of_lipschitz
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (constant : NNReal) (budget : ℝ)
    (editLipschitz : ∀ edit, ObservableLipschitzWith constant observe (apply edit))
    (localBound : ObservableReachableSquareDefectBound
      observe apply Independent initial budget)
    {weight : NNReal} {first second : List Edit}
    (equivalent : TraceEquivalentWithWeight Independent constant weight first second) :
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
            ((constant ^ after.length : NNReal) : ℝ) *
              observableSquareDefect observe apply first second
                (runEdits apply before initial) :=
          runEdits_swap_observable_dist_le_suffixWeight_mul_defect
            observe apply constant editLipschitz
            before after first second initial
        _ ≤ ((constant ^ after.length : NNReal) : ℝ) * budget := by
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
        _ = (leftWeight + rightWeight) * budget := by
          rw [add_mul]

/-- Expanding suffix counterexample for the naive unweighted local-to-global
bound. One local square has defect one, then a common doubling edit makes the
final endpoint distance two. -/
inductive ExpandingEdit
  | reset
  | increment
  | double
  deriving DecidableEq, Repr

def applyExpandingEdit : ExpandingEdit → ℝ → ℝ
  | .reset, _ => 0
  | .increment, state => state + 1
  | .double, state => 2 * state

inductive ExpandingIndependent : ExpandingEdit → ExpandingEdit → Prop
  | reset_increment : ExpandingIndependent .reset .increment

theorem applyExpandingEdit_lipschitzTwo (edit : ExpandingEdit) :
    LipschitzWith 2 (applyExpandingEdit edit) := by
  apply LipschitzWith.of_dist_le_mul
  intro first second
  cases edit with
  | reset => simp [applyExpandingEdit]
  | increment =>
      simp only [applyExpandingEdit, Real.dist_eq]
      rw [show first + 1 - (second + 1) = first - second by ring]
      norm_num
      nlinarith [abs_nonneg (first - second)]
  | double =>
      simp only [applyExpandingEdit, Real.dist_eq]
      rw [show 2 * first - 2 * second = 2 * (first - second) by ring]
      simp [abs_mul]

theorem expandingEdit_reachable_squareDefect_le_one :
    ReachableSquareDefectBound
      applyExpandingEdit ExpandingIndependent 0 1 := by
  intro first second independent state _
  cases independent
  norm_num [squareDefect, applyExpandingEdit, Real.dist_eq]

theorem expandingEdit_weighted_trace :
    TraceEquivalentWithWeight ExpandingIndependent 2 2
      [.reset, .increment, .double]
      [.increment, .reset, .double] := by
  simpa using
    (TraceEquivalentWithWeight.swap
      (Independent := ExpandingIndependent) (constant := 2)
      [] [.double] .reset .increment ExpandingIndependent.reset_increment)

theorem expandingEdit_local_squareDefect :
    squareDefect applyExpandingEdit .reset .increment 0 = 1 := by
  norm_num [squareDefect, applyExpandingEdit, Real.dist_eq]

theorem expandingSuffix_amplifies_square :
    dist
        (runEdits applyExpandingEdit [.reset, .increment, .double] 0)
        (runEdits applyExpandingEdit [.increment, .reset, .double] 0) = 2 := by
  norm_num [runEdits, applyExpandingEdit, Real.dist_eq]

/-- The weighted theorem accounts exactly for the doubling suffix. -/
theorem expandingSuffix_weighted_bound :
    dist
        (runEdits applyExpandingEdit [.reset, .increment, .double] 0)
        (runEdits applyExpandingEdit [.increment, .reset, .double] 0) ≤ 2 := by
  simpa using
    (dist_runEdits_le_weight_mul_of_lipschitz
      applyExpandingEdit ExpandingIndependent 0 2 1
      applyExpandingEdit_lipschitzTwo
      expandingEdit_reachable_squareDefect_le_one
      expandingEdit_weighted_trace)

theorem expandingSuffix_breaks_unweighted_local_bound :
    ¬ dist
        (runEdits applyExpandingEdit [.reset, .increment, .double] 0)
        (runEdits applyExpandingEdit [.increment, .reset, .double] 0) ≤
      squareDefect applyExpandingEdit .reset .increment 0 := by
  rw [expandingSuffix_amplifies_square, expandingEdit_local_squareDefect]
  norm_num

end Sprawlens.QuantitativeConfluence
