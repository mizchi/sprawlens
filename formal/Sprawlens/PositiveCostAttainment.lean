import Sprawlens.GlobalWeightedNormalization

namespace Sprawlens.PositiveCostAttainment

open AposterioriConfluence
open LayoutConfluence
open OptimalPropagatedConfluence
open PropagatedConfluence
open QuantitativeConfluence
open TraceDerivationGenerator

universe u

/-- One edge of the symmetric certificate graph. `backward` retains the cost
of the primitive proof it reverses, exactly matching `TraceCertificate.symm`. -/
inductive WeightedSwapStep {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    ℝ → List Edit → List Edit → Prop where
  | forward (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      WeightedSwapStep Independent swapCost
        (swapCost before after first second)
        (before ++ first :: second :: after)
        (before ++ second :: first :: after)
  | backward (before after : List Edit) (first second : Edit)
      (independent : Independent first second) :
      WeightedSwapStep Independent swapCost
        (swapCost before after first second)
        (before ++ second :: first :: after)
        (before ++ first :: second :: after)

theorem WeightedSwapStep.symm
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {first second : List Edit}
    (step : WeightedSwapStep Independent swapCost cost first second) :
    WeightedSwapStep Independent swapCost cost second first := by
  cases step with
  | forward before after first second independent =>
      exact .backward before after first second independent
  | backward before after first second independent =>
      exact .forward before after first second independent

theorem WeightedSwapStep.toTraceCertificate
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {first second : List Edit}
    (step : WeightedSwapStep Independent swapCost cost first second) :
    TraceCertificate Independent swapCost cost first second := by
  cases step with
  | forward before after first second independent =>
      exact .swap before after first second independent
  | backward before after first second independent =>
      exact (TraceCertificate.swap
        (Independent := Independent) (swapCost := swapCost)
        before after first second independent).symm

/-- Sequential normal form for arbitrary certificates, indexed by both edge
count and accumulated real cost. -/
inductive WeightedTracePath {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    Nat → ℝ → List Edit → List Edit → Prop where
  | refl (edits : List Edit) :
      WeightedTracePath Independent swapCost 0 0 edits edits
  | step {count : Nat} {stepCost tailCost : ℝ}
      {first second target : List Edit}
      (edge : WeightedSwapStep Independent swapCost
        stepCost first second)
      (rest : WeightedTracePath Independent swapCost
        count tailCost second target) :
      WeightedTracePath Independent swapCost
        (count + 1) (stepCost + tailCost) first target

theorem WeightedTracePath.append
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {leftCount rightCount : Nat} {leftCost rightCost : ℝ}
    {first middle last : List Edit}
    (left : WeightedTracePath Independent swapCost
      leftCount leftCost first middle)
    (right : WeightedTracePath Independent swapCost
      rightCount rightCost middle last) :
    WeightedTracePath Independent swapCost
      (leftCount + rightCount) (leftCost + rightCost) first last := by
  induction left with
  | refl edits => simpa using right
  | @step count stepCost tailCost first second target edge rest
      inductionHypothesis =>
      simpa [Nat.add_assoc, Nat.add_comm, Nat.add_left_comm, add_assoc] using
        WeightedTracePath.step edge (inductionHypothesis right)

theorem WeightedTracePath.symm
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {count : Nat} {cost : ℝ} {first second : List Edit}
    (path : WeightedTracePath Independent swapCost
      count cost first second) :
    WeightedTracePath Independent swapCost
      count cost second first := by
  induction path with
  | refl edits => exact .refl edits
  | @step count stepCost tailCost first middle target edge rest
      inductionHypothesis =>
      have finalEdge : WeightedTracePath Independent swapCost
          1 stepCost middle first := by
        simpa using WeightedTracePath.step
          (edge.symm Independent swapCost)
          (WeightedTracePath.refl
            (Independent := Independent) (swapCost := swapCost) first)
      simpa [Nat.add_comm, add_comm] using
        inductionHypothesis.append Independent swapCost finalEdge

theorem WeightedTracePath.toTraceCertificate
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {count : Nat} {cost : ℝ} {first second : List Edit}
    (path : WeightedTracePath Independent swapCost
      count cost first second) :
    TraceCertificate Independent swapCost cost first second := by
  induction path with
  | refl edits => exact .refl edits
  | step edge rest inductionHypothesis =>
      exact (edge.toTraceCertificate Independent swapCost).trans
        inductionHypothesis

theorem TraceCertificate.exists_weightedTracePath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent swapCost cost first second) :
    ∃ count, WeightedTracePath Independent swapCost
      count cost first second := by
  induction certificate with
  | refl edits => exact ⟨0, .refl edits⟩
  | swap before after first second independent =>
      exact ⟨1, by
        simpa using WeightedTracePath.step
          (WeightedSwapStep.forward before after first second independent)
          (WeightedTracePath.refl
            (Independent := Independent) (swapCost := swapCost)
            (before ++ second :: first :: after))⟩
  | symm certificate inductionHypothesis =>
      obtain ⟨count, path⟩ := inductionHypothesis
      exact ⟨count, path.symm Independent swapCost⟩
  | trans left right leftHypothesis rightHypothesis =>
      obtain ⟨leftCount, leftPath⟩ := leftHypothesis
      obtain ⟨rightCount, rightPath⟩ := rightHypothesis
      exact ⟨leftCount + rightCount,
        leftPath.append Independent swapCost rightPath⟩

def PrimitiveSwapCostLowerBound {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    epsilon ≤ swapCost before after first second

theorem WeightedSwapStep.cost_lower_bound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (primitiveLower : PrimitiveSwapCostLowerBound
      Independent swapCost epsilon)
    {cost : ℝ} {first second : List Edit}
    (step : WeightedSwapStep Independent swapCost cost first second) :
    epsilon ≤ cost := by
  cases step with
  | forward before after first second independent =>
      exact primitiveLower before after first second independent
  | backward before after first second independent =>
      exact primitiveLower before after first second independent

theorem WeightedTracePath.count_mul_le_cost
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (primitiveLower : PrimitiveSwapCostLowerBound
      Independent swapCost epsilon)
    {count : Nat} {cost : ℝ} {first second : List Edit}
    (path : WeightedTracePath Independent swapCost
      count cost first second) :
    (count : ℝ) * epsilon ≤ cost := by
  induction path with
  | refl edits => simp
  | step edge rest inductionHypothesis =>
      have edgeLower := edge.cost_lower_bound
        Independent swapCost epsilon primitiveLower
      rw [Nat.cast_add, Nat.cast_one, add_mul]
      linarith

/-- Finite scan of all symmetric certificate edges leaving one trace. The
same adjacent target may occur twice with different costs when forward and
backward primitive declarations differ. -/
def weightedSwapStepChoicesListAux {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (before : List Edit) : List Edit → List (ℝ × List Edit)
  | first :: second :: after =>
      let next := before ++ second :: first :: after
      let forward :=
        if Independent first second then
          [(swapCost before after first second, next)]
        else []
      let backward :=
        if Independent second first then
          [(swapCost before after second first, next)]
        else []
      forward ++ backward ++
        weightedSwapStepChoicesListAux Independent swapCost
          (before ++ [first]) (second :: after)
  | _ => []

def weightedSwapStepChoicesList {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit) : List (ℝ × List Edit) :=
  weightedSwapStepChoicesListAux Independent swapCost [] current

theorem weightedSwapStepChoicesListAux_sound
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (before remaining : List Edit) {cost : ℝ} {next : List Edit}
    (member : (cost, next) ∈
      weightedSwapStepChoicesListAux
        Independent swapCost before remaining) :
    WeightedSwapStep Independent swapCost cost
      (before ++ remaining) next := by
  induction remaining generalizing before cost next with
  | nil => simp [weightedSwapStepChoicesListAux] at member
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => simp [weightedSwapStepChoicesListAux] at member
      | cons second after =>
          by_cases forward : Independent first second
          · by_cases backward : Independent second first
            · rw [weightedSwapStepChoicesListAux] at member
              simp only [if_pos forward, if_pos backward,
                List.singleton_append] at member
              rcases List.mem_cons.mp member with
                forwardMember | remainingMember
              · have pairEq : (cost, next) =
                    (swapCost before after first second,
                      before ++ second :: first :: after) := forwardMember
                cases pairEq
                simpa using WeightedSwapStep.forward
                  before after first second forward
              · rcases List.mem_cons.mp remainingMember with
                  backwardMember | tailMember
                · have pairEq : (cost, next) =
                      (swapCost before after second first,
                        before ++ second :: first :: after) := backwardMember
                  cases pairEq
                  simpa using WeightedSwapStep.backward
                    before after second first backward
                · simpa [List.append_assoc] using
                    inductionHypothesis
                      (before := before ++ [first]) tailMember
            · rw [weightedSwapStepChoicesListAux] at member
              simp only [if_pos forward, if_neg backward,
                List.singleton_append] at member
              rcases List.mem_cons.mp member with forwardMember | tailMember
              · have pairEq : (cost, next) =
                    (swapCost before after first second,
                      before ++ second :: first :: after) := forwardMember
                cases pairEq
                simpa using WeightedSwapStep.forward
                  before after first second forward
              · simpa [List.append_assoc] using
                  inductionHypothesis
                    (before := before ++ [first]) tailMember
          · by_cases backward : Independent second first
            · rw [weightedSwapStepChoicesListAux] at member
              simp only [if_neg forward, if_pos backward,
                List.nil_append, List.singleton_append] at member
              rcases List.mem_cons.mp member with backwardMember | tailMember
              · have pairEq : (cost, next) =
                    (swapCost before after second first,
                      before ++ second :: first :: after) := backwardMember
                cases pairEq
                simpa using WeightedSwapStep.backward
                  before after second first backward
              · simpa [List.append_assoc] using
                  inductionHypothesis
                    (before := before ++ [first]) tailMember
            · rw [weightedSwapStepChoicesListAux] at member
              simp only [if_neg forward, if_neg backward,
                List.nil_append] at member
              simpa [List.append_assoc] using
                inductionHypothesis
                  (before := before ++ [first]) member

theorem weightedSwapStepChoicesListAux_forward_complete
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (context before after : List Edit) (first second : Edit)
    (independent : Independent first second) :
    (swapCost (context ++ before) after first second,
        (context ++ before) ++ second :: first :: after) ∈
      weightedSwapStepChoicesListAux Independent swapCost context
        (before ++ first :: second :: after) := by
  induction before generalizing context with
  | nil =>
      simp [weightedSwapStepChoicesListAux, independent]
  | cons head before inductionHypothesis =>
      have tailMember := inductionHypothesis (context := context ++ [head])
      cases before with
      | nil =>
          change _ ∈ weightedSwapStepChoicesListAux Independent swapCost
            context (head :: first :: second :: after)
          rw [weightedSwapStepChoicesListAux]
          apply List.mem_append_right
          simpa [List.append_assoc] using tailMember
      | cons nextHead nextBefore =>
          change _ ∈ weightedSwapStepChoicesListAux Independent swapCost
            context (head :: nextHead ::
              (nextBefore ++ first :: second :: after))
          rw [weightedSwapStepChoicesListAux]
          apply List.mem_append_right
          simpa [List.append_assoc] using tailMember

theorem weightedSwapStepChoicesListAux_backward_complete
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (context before after : List Edit) (first second : Edit)
    (independent : Independent first second) :
    (swapCost (context ++ before) after first second,
        (context ++ before) ++ first :: second :: after) ∈
      weightedSwapStepChoicesListAux Independent swapCost context
        (before ++ second :: first :: after) := by
  induction before generalizing context with
  | nil =>
      simp [weightedSwapStepChoicesListAux, independent]
  | cons head before inductionHypothesis =>
      have tailMember := inductionHypothesis (context := context ++ [head])
      cases before with
      | nil =>
          change _ ∈ weightedSwapStepChoicesListAux Independent swapCost
            context (head :: second :: first :: after)
          rw [weightedSwapStepChoicesListAux]
          apply List.mem_append_right
          simpa [List.append_assoc] using tailMember
      | cons nextHead nextBefore =>
          change _ ∈ weightedSwapStepChoicesListAux Independent swapCost
            context (head :: nextHead ::
              (nextBefore ++ second :: first :: after))
          rw [weightedSwapStepChoicesListAux]
          apply List.mem_append_right
          simpa [List.append_assoc] using tailMember

theorem weightedSwapStepChoicesList_enumerates
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit) (cost : ℝ) (next : List Edit) :
    (cost, next) ∈ weightedSwapStepChoicesList
        Independent swapCost current ↔
      WeightedSwapStep Independent swapCost cost current next := by
  constructor
  · intro member
    simpa [weightedSwapStepChoicesList] using
      weightedSwapStepChoicesListAux_sound
        Independent swapCost [] current member
  · intro step
    cases step with
    | forward before after first second independent =>
        simpa [weightedSwapStepChoicesList] using
          weightedSwapStepChoicesListAux_forward_complete
            Independent swapCost [] before after first second independent
    | backward before after first second independent =>
        simpa [weightedSwapStepChoicesList] using
          weightedSwapStepChoicesListAux_backward_complete
            Independent swapCost [] before after first second independent

/-- All weighted path outcomes reachable in at most `fuel` primitive edges.
The reflexive outcome is retained at every fuel. -/
def weightedTracePathOutcomesList {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    Nat → List Edit → List (ℝ × List Edit)
  | 0, current => [(0, current)]
  | fuel + 1, current =>
      (0, current) ::
        (weightedSwapStepChoicesList Independent swapCost current).flatMap
          fun edge =>
            (weightedTracePathOutcomesList
              Independent swapCost fuel edge.2).map
                fun tail => (edge.1 + tail.1, tail.2)

theorem weightedTracePathOutcomesList_sound
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (fuel : Nat) (current : List Edit) {cost : ℝ} {target : List Edit}
    (member : (cost, target) ∈
      weightedTracePathOutcomesList
        Independent swapCost fuel current) :
    ∃ count, count ≤ fuel ∧
      WeightedTracePath Independent swapCost
        count cost current target := by
  induction fuel generalizing current cost target with
  | zero =>
      simp [weightedTracePathOutcomesList] at member
      obtain ⟨rfl, rfl⟩ := member
      exact ⟨0, le_rfl, .refl target⟩
  | succ fuel inductionHypothesis =>
      rw [weightedTracePathOutcomesList] at member
      rcases List.mem_cons.mp member with reflexive | stepped
      · have pairEq : (cost, target) = (0, current) := reflexive
        cases pairEq
        exact ⟨0, Nat.zero_le _, .refl current⟩
      · obtain ⟨edge, edgeMember, mappedMember⟩ :=
          List.mem_flatMap.mp stepped
        obtain ⟨stepCost, next⟩ := edge
        obtain ⟨tail, tailMember, outcomeEq⟩ :=
          List.mem_map.mp mappedMember
        obtain ⟨tailCost, tailTarget⟩ := tail
        have pairEq :
            (cost, target) = (stepCost + tailCost, tailTarget) :=
          outcomeEq.symm
        cases pairEq
        obtain ⟨count, countLe, tailPath⟩ :=
          inductionHypothesis next tailMember
        have edgeStep :=
          (weightedSwapStepChoicesList_enumerates
            Independent swapCost current stepCost next).mp edgeMember
        exact ⟨count + 1, Nat.add_le_add_right countLe 1,
          .step edgeStep tailPath⟩

theorem weightedTracePathOutcomesList_complete
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {count fuel : Nat} {cost : ℝ} {current target : List Edit}
    (path : WeightedTracePath Independent swapCost
      count cost current target)
    (countLe : count ≤ fuel) :
    (cost, target) ∈ weightedTracePathOutcomesList
      Independent swapCost fuel current := by
  induction fuel generalizing count cost current target with
  | zero =>
      have countZero : count = 0 := Nat.eq_zero_of_le_zero countLe
      subst count
      cases path with
      | refl edits => simp [weightedTracePathOutcomesList]
  | succ fuel inductionHypothesis =>
      cases path with
      | refl edits => simp [weightedTracePathOutcomesList]
      | @step count stepCost tailCost first second target edge rest =>
          have tailCountLe : count ≤ fuel := by omega
          have tailMember := inductionHypothesis rest tailCountLe
          have edgeMember : (stepCost, second) ∈
              weightedSwapStepChoicesList
                Independent swapCost _ :=
            (weightedSwapStepChoicesList_enumerates
              Independent swapCost _ stepCost second).mpr edge
          rw [weightedTracePathOutcomesList]
          apply List.mem_cons_of_mem
          apply List.mem_flatMap.mpr
          refine ⟨(stepCost, second), edgeMember, ?_⟩
          apply List.mem_map.mpr
          exact ⟨(tailCost, target), tailMember, rfl⟩

/-- A strictly positive lower bound on every primitive edge turns the
otherwise unbounded certificate search into a finite search below any known
feasible cost. Therefore the minimum between two fixed traces is attained,
without requiring a dual potential. -/
theorem minimumTraceCertificate_exists_of_positiveLower
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon)
    (primitiveLower : PrimitiveSwapCostLowerBound
      Independent swapCost epsilon)
    {baseCost : ℝ} {first target : List Edit}
    (baseCertificate : TraceCertificate Independent swapCost
      baseCost first target) :
    ∃ minimumCost,
      TraceCertificate Independent swapCost minimumCost first target ∧
      ∀ {otherCost},
        TraceCertificate Independent swapCost otherCost first target →
        minimumCost ≤ otherCost := by
  classical
  obtain ⟨baseCount, basePath⟩ :=
    TraceCertificate.exists_weightedTracePath
      Independent swapCost baseCertificate
  obtain ⟨fuel, fuelBound⟩ :=
    exists_nat_gt (baseCost / epsilon)
  have count_lt_fuel_of_cost_le_base
      {count : Nat} {cost : ℝ}
      (path : WeightedTracePath Independent swapCost
        count cost first target)
      (costLe : cost ≤ baseCost) : count < fuel := by
    have pathLower := path.count_mul_le_cost
      Independent swapCost epsilon primitiveLower
    have countLeRatio : (count : ℝ) ≤ baseCost / epsilon := by
      apply (le_div_iff₀ epsilonPositive).2
      exact pathLower.trans costLe
    have countCastLt : (count : ℝ) < (fuel : ℝ) :=
      countLeRatio.trans_lt fuelBound
    exact_mod_cast countCastLt
  have baseCountLt : baseCount < fuel :=
    count_lt_fuel_of_cost_le_base basePath le_rfl
  let outcomes := weightedTracePathOutcomesList
    Independent swapCost fuel first
  let targetOutcomes := outcomes.filter fun outcome => outcome.2 = target
  let candidates : Finset (ℝ × List Edit) := targetOutcomes.toFinset
  have baseOutcomeMember : (baseCost, target) ∈ outcomes :=
    weightedTracePathOutcomesList_complete
      Independent swapCost basePath (Nat.le_of_lt baseCountLt)
  have baseTargetMember : (baseCost, target) ∈ targetOutcomes := by
    exact List.mem_filter.mpr ⟨baseOutcomeMember, by simp⟩
  have baseCandidateMember : (baseCost, target) ∈ candidates := by
    simpa [candidates] using baseTargetMember
  have candidatesNonempty : candidates.Nonempty :=
    ⟨(baseCost, target), baseCandidateMember⟩
  obtain ⟨best, bestMember, bestMinimum⟩ :=
    Finset.exists_min_image candidates Prod.fst candidatesNonempty
  obtain ⟨minimumCost, bestTarget⟩ := best
  have bestTargetListMember : (minimumCost, bestTarget) ∈ targetOutcomes := by
    simpa [candidates] using bestMember
  have bestParts := List.mem_filter.mp bestTargetListMember
  have bestTargetEq : bestTarget = target := by
    simpa using bestParts.2
  subst bestTarget
  obtain ⟨minimumCount, minimumCountLe, minimumPath⟩ :=
    weightedTracePathOutcomesList_sound
      Independent swapCost fuel first bestParts.1
  refine ⟨minimumCost,
    minimumPath.toTraceCertificate Independent swapCost, ?_⟩
  intro otherCost otherCertificate
  obtain ⟨otherCount, otherPath⟩ :=
    TraceCertificate.exists_weightedTracePath
      Independent swapCost otherCertificate
  by_cases otherLe : otherCost ≤ baseCost
  · have otherCountLt : otherCount < fuel :=
      count_lt_fuel_of_cost_le_base otherPath otherLe
    have otherOutcomeMember : (otherCost, target) ∈ outcomes :=
      weightedTracePathOutcomesList_complete
        Independent swapCost otherPath (Nat.le_of_lt otherCountLt)
    have otherTargetMember : (otherCost, target) ∈ targetOutcomes :=
      List.mem_filter.mpr ⟨otherOutcomeMember, by simp⟩
    have otherCandidateMember : (otherCost, target) ∈ candidates := by
      simpa [candidates] using otherTargetMember
    exact bestMinimum (otherCost, target) otherCandidateMember
  · have baseLe : baseCost ≤ otherCost := le_of_not_ge otherLe
    exact (bestMinimum (baseCost, target) baseCandidateMember).trans baseLe

/-- For propagated observation costs with a uniform positive primitive floor,
the intrinsic certificate infimum between any equivalent fixed traces is a
minimum and is represented by a concrete certificate. -/
theorem optimalPropagatedCost_attained_of_positiveLower
    {Edit : Type u} {State : Type*} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (initial : State) (epsilon : ℝ) (epsilonPositive : 0 < epsilon)
    (primitiveLower : PrimitiveSwapCostLowerBound Independent
      (propagatedObservableSwapCost observe apply initial) epsilon)
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) :
    ∃ minimumCost,
      TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          minimumCost first second ∧
        optimalPropagatedCost observe apply Independent initial first second =
          ENNReal.ofReal minimumCost ∧
        ∀ {otherCost},
          TraceCertificate Independent
              (propagatedObservableSwapCost observe apply initial)
              otherCost first second →
          minimumCost ≤ otherCost := by
  obtain ⟨baseCost, baseCertificate⟩ :=
    exists_propagatedCertificate
      observe apply Independent initial equivalent
  obtain ⟨minimumCost, minimumCertificate, minimum⟩ :=
    minimumTraceCertificate_exists_of_positiveLower
      Independent
      (propagatedObservableSwapCost observe apply initial)
      epsilon epsilonPositive primitiveLower baseCertificate
  refine ⟨minimumCost, minimumCertificate, ?_, minimum⟩
  apply le_antisymm
  · exact optimalPropagatedCost_le_certificate
      observe apply Independent initial minimumCertificate
  · apply le_iInf
    intro otherCost
    apply le_iInf
    intro otherCertificate
    exact ENNReal.ofReal_le_ofReal (minimum otherCertificate)

def negativeSwapCost
    (_before _after : List Bool) (_first _second : Bool) : ℝ :=
  -1

theorem negativeCycleCertificate :
    TraceCertificate (@AllIndependent Bool) negativeSwapCost (-2)
      [false, true] [false, true] := by
  have forward :
      TraceCertificate (@AllIndependent Bool) negativeSwapCost (-1)
        [false, true] [true, false] := by
    simpa [negativeSwapCost] using
      (TraceCertificate.swap
        (Independent := @AllIndependent Bool)
        (swapCost := negativeSwapCost)
        [] [] false true (by simp [AllIndependent]))
  have cycle := forward.trans forward.symm
  norm_num at cycle
  exact cycle

/-- Load-bearing failure outside the nonnegative-cost domain: a negative
two-edge cycle can be prefixed to every self-certificate, so no minimum cost
certificate exists. -/
theorem negativeCycle_has_no_minimum :
    ¬∃ minimumCost,
      TraceCertificate (@AllIndependent Bool) negativeSwapCost
          minimumCost [false, true] [false, true] ∧
        ∀ {otherCost},
          TraceCertificate (@AllIndependent Bool) negativeSwapCost
              otherCost [false, true] [false, true] →
          minimumCost ≤ otherCost := by
  rintro ⟨minimumCost, certificate, minimum⟩
  have cheaper :
      TraceCertificate (@AllIndependent Bool) negativeSwapCost
        (-2 + minimumCost) [false, true] [false, true] :=
    negativeCycleCertificate.trans certificate
  have impossible := minimum cheaper
  linarith

end Sprawlens.PositiveCostAttainment
