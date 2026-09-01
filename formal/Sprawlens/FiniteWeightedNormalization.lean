import Sprawlens.UniformWeightedNormalization

namespace Sprawlens.FiniteWeightedNormalization

open AposterioriConfluence
open LayoutConfluence
open PropagatedConfluence
open QuantitativeConfluence
open ReachableRankNormalization

universe u

/-- One directed normalization step carrying its context-dependent real cost.
The cost equality is part of the witness, so an enumerator cannot substitute a
different edge weight. -/
inductive WeightedRankStep {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    : ℝ → List Edit → List Edit → Prop where
  | mk (before after : List Edit) (first second : Edit)
      (independent : Independent first second)
      (inversion : rank second < rank first) :
      WeightedRankStep rank Independent swapCost
        (swapCost before after first second)
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)

theorem WeightedRankStep.toRankReduction
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {current next : List Edit}
    (step : WeightedRankStep rank Independent swapCost cost current next) :
    RankReduction rank Independent next current := by
  cases step with
  | mk before after first second independent inversion =>
      exact ⟨before, after, first, second, rfl, rfl,
        independent, inversion⟩

theorem WeightedRankStep.toTraceCertificate
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {current next : List Edit}
    (step : WeightedRankStep rank Independent swapCost cost current next) :
    TraceCertificate Independent swapCost cost current next := by
  cases step with
  | mk before after first second independent inversion =>
      exact .swap before after first second independent

/-- A canonical directed path: `done` is available only at an irreducible
trace, while `step` composes one weighted decreasing edge with the remaining
normalization. -/
inductive WeightedNormalizingPath {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    ℝ → List Edit → List Edit → Prop where
  | done (edits : List Edit)
      (normalForm : IsReachableRankNormalForm rank Independent edits) :
      WeightedNormalizingPath rank Independent swapCost 0 edits edits
  | step {stepCost tailCost : ℝ} {current next target : List Edit}
      (first : WeightedRankStep rank Independent swapCost
        stepCost current next)
      (rest : WeightedNormalizingPath rank Independent swapCost
        tailCost next target) :
      WeightedNormalizingPath rank Independent swapCost
        (stepCost + tailCost) current target

theorem WeightedNormalizingPath.target_normalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {current target : List Edit}
    (path : WeightedNormalizingPath rank Independent swapCost
      cost current target) :
    IsReachableRankNormalForm rank Independent target := by
  induction path with
  | done edits normalForm => exact normalForm
  | step first rest inductionHypothesis => exact inductionHypothesis

theorem WeightedNormalizingPath.toTraceCertificate
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {current target : List Edit}
    (path : WeightedNormalizingPath rank Independent swapCost
      cost current target) :
    TraceCertificate Independent swapCost cost current target := by
  induction path with
  | done edits normalForm => exact .refl edits
  | step first rest inductionHypothesis =>
      exact (first.toTraceCertificate rank Independent swapCost).trans
        inductionHypothesis

theorem WeightedNormalizingPath.exists_descendingTrace
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {current target : List Edit}
    (path : WeightedNormalizingPath rank Independent swapCost
      cost current target) :
    ∃ count, DescendingTraceIn rank Independent count current target := by
  induction path with
  | done edits normalForm => exact ⟨0, .refl edits⟩
  | step first rest inductionHypothesis =>
      obtain ⟨count, descending⟩ := inductionHypothesis
      exact ⟨1 + count,
        (first.toRankReduction rank Independent swapCost
          |>.toDescendingTraceIn rank Independent).trans descending⟩

/-- Exact finite-branching contract for an implementation-supplied one-step
enumerator. Soundness and completeness are both required. -/
def EnumeratesWeightedRankSteps {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (choices : List Edit → Finset (ℝ × List Edit)) : Prop :=
  ∀ current cost next,
    (cost, next) ∈ choices current ↔
      WeightedRankStep rank Independent swapCost cost current next

/-- Scan every adjacent position, retaining exactly the independent strict
inversions and their context-sensitive edge costs. -/
def weightedRankStepChoicesListAux {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (before : List Edit) : List Edit → List (ℝ × List Edit)
  | first :: second :: after =>
      let tailChoices := weightedRankStepChoicesListAux
        rank Independent swapCost (before ++ [first]) (second :: after)
      if Independent first second ∧ rank second < rank first then
        (swapCost before after first second,
          before ++ second :: first :: after) :: tailChoices
      else
        tailChoices
  | _ => []

theorem weightedRankStepChoicesListAux_sound
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (before remaining : List Edit) {cost : ℝ} {next : List Edit}
    (member : (cost, next) ∈
      weightedRankStepChoicesListAux
        rank Independent swapCost before remaining) :
    WeightedRankStep rank Independent swapCost cost
      (before ++ remaining) next := by
  induction remaining generalizing before cost next with
  | nil => simp [weightedRankStepChoicesListAux] at member
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => simp [weightedRankStepChoicesListAux] at member
      | cons second after =>
          by_cases direct :
              Independent first second ∧ rank second < rank first
          · rw [weightedRankStepChoicesListAux, if_pos direct] at member
            rcases List.mem_cons.mp member with directMember | tailMember
            · have pairEq :
                  (cost, next) =
                    (swapCost before after first second,
                      before ++ second :: first :: after) :=
                directMember
              cases pairEq
              simpa using
                (WeightedRankStep.mk
                  (rank := rank) (Independent := Independent)
                  (swapCost := swapCost)
                  before after first second direct.1 direct.2)
            · simpa [List.append_assoc] using
                inductionHypothesis (before := before ++ [first]) tailMember
          · rw [weightedRankStepChoicesListAux, if_neg direct] at member
            simpa [List.append_assoc] using
              inductionHypothesis (before := before ++ [first]) member

theorem weightedRankStepChoicesListAux_complete
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (context before after : List Edit) (first second : Edit)
    (independent : Independent first second)
    (inversion : rank second < rank first) :
    (swapCost (context ++ before) after first second,
        (context ++ before) ++ second :: first :: after) ∈
      weightedRankStepChoicesListAux rank Independent swapCost context
        (before ++ first :: second :: after) := by
  induction before generalizing context with
  | nil =>
      simp [weightedRankStepChoicesListAux, independent, inversion]
  | cons head before inductionHypothesis =>
      have tailMember := inductionHypothesis (context := context ++ [head])
      cases before with
      | nil =>
          by_cases direct :
              Independent head first ∧ rank first < rank head
          · rw [List.cons_append, List.nil_append,
              weightedRankStepChoicesListAux, if_pos direct]
            apply List.mem_cons_of_mem
            simpa [List.append_assoc] using tailMember
          · rw [List.cons_append, List.nil_append,
              weightedRankStepChoicesListAux, if_neg direct]
            simpa [List.append_assoc] using tailMember
      | cons nextHead nextBefore =>
          by_cases direct :
              Independent head nextHead ∧ rank nextHead < rank head
          · change _ ∈ weightedRankStepChoicesListAux
              rank Independent swapCost context
                (head :: nextHead ::
                  (nextBefore ++ first :: second :: after))
            rw [weightedRankStepChoicesListAux, if_pos direct]
            apply List.mem_cons_of_mem
            simpa [List.append_assoc] using tailMember
          · change _ ∈ weightedRankStepChoicesListAux
              rank Independent swapCost context
                (head :: nextHead ::
                  (nextBefore ++ first :: second :: after))
            rw [weightedRankStepChoicesListAux, if_neg direct]
            simpa [List.append_assoc] using tailMember

noncomputable def weightedRankStepChoices {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit) : Finset (ℝ × List Edit) := by
  classical
  exact (weightedRankStepChoicesListAux
    rank Independent swapCost [] current).toFinset

theorem weightedRankStepChoices_enumerates
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    EnumeratesWeightedRankSteps rank Independent swapCost
      (weightedRankStepChoices rank Independent swapCost) := by
  classical
  intro current cost next
  constructor
  · intro member
    have listMember : (cost, next) ∈
        weightedRankStepChoicesListAux
          rank Independent swapCost [] current := by
      simpa [weightedRankStepChoices] using member
    simpa using weightedRankStepChoicesListAux_sound
      rank Independent swapCost [] current listMember
  · intro step
    cases step with
    | mk before after first second independent inversion =>
        have listMember := weightedRankStepChoicesListAux_complete
          rank Independent swapCost [] before after first second
          independent inversion
        simpa [weightedRankStepChoices] using listMember

structure MinimumWeightedNormalization {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit) : Type (u + 1) where
  cost : ℝ
  target : List Edit
  path : WeightedNormalizingPath rank Independent swapCost
    cost current target
  minimal : ∀ {otherCost otherTarget},
    WeightedNormalizingPath rank Independent swapCost
      otherCost current otherTarget →
    cost ≤ otherCost

theorem exists_weightedRankStep_of_not_normalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit)
    (notNormal : ¬IsReachableRankNormalForm rank Independent current) :
    ∃ cost next,
      WeightedRankStep rank Independent swapCost cost current next := by
  have reducible : HasReducibleAdjacent rank Independent current :=
    not_not.mp notNormal
  obtain ⟨next, before, after, first, second,
      currentEq, nextEq, independent, inversion⟩ :=
    exists_rankReduction_of_hasReducibleAdjacent
      rank Independent reducible
  subst current
  subst next
  exact ⟨swapCost before after first second,
    before ++ second :: first :: after,
    .mk before after first second independent inversion⟩

/-- Finite exact branching plus strict rank descent makes the dynamic program
attain a minimum real cost. Primitive costs need not be uniform, nonnegative,
or context-free because every directed path is finite. -/
theorem minimumWeightedNormalization_exists
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (choices : List Edit → Finset (ℝ × List Edit))
    (enumerates : EnumeratesWeightedRankSteps
      rank Independent swapCost choices)
    (edits : List Edit) :
    Nonempty (MinimumWeightedNormalization
      rank Independent swapCost edits) := by
  classical
  refine (rankReduction_wellFounded rank Independent).induction
    (C := fun current => Nonempty
      (MinimumWeightedNormalization rank Independent swapCost current))
    edits ?_
  intro current inductionHypothesis
  by_cases normalForm : IsReachableRankNormalForm rank Independent current
  · exact ⟨{
      cost := 0
      target := current
      path := .done current normalForm
      minimal := by
        intro otherCost otherTarget otherPath
        cases otherPath with
        | done edits otherNormal => exact le_rfl
        | @step stepCost tailCost current next target first rest =>
            have reducible :
                HasReducibleAdjacent rank Independent current :=
              (exists_rankReduction_iff_hasReducibleAdjacent
                rank Independent current).mp
                ⟨next, first.toRankReduction rank Independent swapCost⟩
            exact (normalForm reducible).elim
    }⟩
  · let outcomes := choices current
    have outcomesNonempty : outcomes.Nonempty := by
      obtain ⟨cost, next, step⟩ :=
        exists_weightedRankStep_of_not_normalForm
          rank Independent swapCost current normalForm
      exact ⟨(cost, next), (enumerates current cost next).mpr step⟩
    let AttachedOutcome := {outcome // outcome ∈ outcomes}
    let resultFor : (outcome : AttachedOutcome) →
        MinimumWeightedNormalization rank Independent swapCost outcome.1.2 :=
      fun outcome =>
        Classical.choice
          (inductionHypothesis outcome.1.2
            ((enumerates current outcome.1.1 outcome.1.2).mp outcome.2
              |>.toRankReduction rank Independent swapCost))
    let totalCost : AttachedOutcome → ℝ :=
      fun outcome => outcome.1.1 + (resultFor outcome).cost
    have attachedNonempty : outcomes.attach.Nonempty := by
      simpa using outcomesNonempty
    obtain ⟨best, bestMem, bestMinimum⟩ :=
      Finset.exists_min_image outcomes.attach totalCost attachedNonempty
    have bestStep : WeightedRankStep rank Independent swapCost
        best.1.1 current best.1.2 :=
      (enumerates current best.1.1 best.1.2).mp best.2
    exact ⟨{
      cost := totalCost best
      target := (resultFor best).target
      path := .step bestStep (resultFor best).path
      minimal := by
        intro otherCost otherTarget otherPath
        cases otherPath with
        | done edits otherNormal => exact (normalForm otherNormal).elim
        | @step stepCost tailCost current next target first rest =>
            have outcomeMem : (stepCost, next) ∈ outcomes :=
              (enumerates current stepCost next).mpr first
            let other : AttachedOutcome :=
              ⟨(stepCost, next), outcomeMem⟩
            have bestLe : totalCost best ≤ totalCost other :=
              bestMinimum other (by simp [other])
            have tailLe : (resultFor other).cost ≤ tailCost :=
              (resultFor other).minimal rest
            dsimp [totalCost] at bestLe ⊢
            linarith
    }⟩

theorem minimumWeightedNormalization_exists_of_decidable
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (edits : List Edit) :
    Nonempty (MinimumWeightedNormalization
      rank Independent swapCost edits) := by
  exact minimumWeightedNormalization_exists
    rank Independent swapCost
    (weightedRankStepChoices rank Independent swapCost)
    (weightedRankStepChoices_enumerates rank Independent swapCost)
    edits

/-- For actual suffix-replayed observation cost, the minimum among all
directed rank-decreasing normalizations is attained by a concrete certificate
and bounds the selected target's geometry endpoint distance. -/
theorem minimumPropagatedNormalization_exists_of_decidable
    {Edit : Type u} {State : Type*} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (edits : List Edit) :
    ∃ cost target,
      WeightedNormalizingPath rank Independent
          (propagatedObservableSwapCost observe apply initial)
          cost edits target ∧
        IsReachableRankNormalForm rank Independent target ∧
        TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          cost edits target ∧
        dist (observe (runEdits apply edits initial))
            (observe (runEdits apply target initial)) ≤ cost ∧
        ∀ {otherCost otherTarget},
          WeightedNormalizingPath rank Independent
            (propagatedObservableSwapCost observe apply initial)
            otherCost edits otherTarget →
          cost ≤ otherCost := by
  let result := Classical.choice
    (minimumWeightedNormalization_exists_of_decidable
      rank Independent
      (propagatedObservableSwapCost observe apply initial) edits)
  have certificate := result.path.toTraceCertificate
    rank Independent
    (propagatedObservableSwapCost observe apply initial)
  exact ⟨result.cost, result.target, result.path,
    result.path.target_normalForm rank Independent
      (propagatedObservableSwapCost observe apply initial),
    certificate,
    observable_dist_runEdits_le_propagatedCertificate
      observe apply Independent initial certificate,
    fun otherPath => result.minimal otherPath⟩

end Sprawlens.FiniteWeightedNormalization
