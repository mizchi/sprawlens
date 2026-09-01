import Sprawlens.NonnegativeCostAttainment
import Sprawlens.DeterministicRankNormalization
import Sprawlens.WeightedNormalizationPolicy

namespace Sprawlens.NonnegativeNormalizingAttainment

open AposterioriConfluence
open DeterministicRankNormalization
open LayoutConfluence
open NonnegativeCostAttainment
open OptimalPropagatedConfluence
open PositiveCostAttainment
open PropagatedConfluence
open ReachableRankNormalization
open WeightedNormalizationPolicy

universe u v

noncomputable section

/-- Nonnegative edge costs admit a globally cheapest certificate to any
acceptable target. The target need not be unique, and competitors may use
arbitrary symmetric detours. The returned shortest witness is simple and has
fewer edges than the number of syntactic permutations of the input trace. -/
theorem minimumNormalizingCertificate_exists_of_nonnegative
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {baseCost : ℝ} {first baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (baseCertificate : TraceCertificate Independent swapCost
      baseCost first baseTarget) :
    ∃ minimumCount minimumCost minimumTarget,
      minimumCount < first.permutations.length ∧
      Normal minimumTarget ∧
      WeightedTracePath Independent swapCost
        minimumCount minimumCost first minimumTarget ∧
      ∀ {otherCost otherTarget},
        Normal otherTarget →
        TraceCertificate Independent swapCost
          otherCost first otherTarget →
        minimumCost ≤ otherCost := by
  classical
  let fuel := first.permutations.length
  let outcomes := weightedTracePathOutcomesList
    Independent swapCost fuel first
  let normalOutcomes := outcomes.filter fun outcome => Normal outcome.2
  let candidates : Finset (ℝ × List Edit) := normalOutcomes.toFinset
  obtain ⟨baseCount, simpleBaseCost, baseCountLt, simpleBase,
      simpleBaseCostLe⟩ :=
    Sprawlens.NonnegativeCostAttainment.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative
      Independent swapCost primitiveNonneg baseCertificate
  have baseOutcomeMember : (simpleBaseCost, baseTarget) ∈ outcomes :=
    weightedTracePathOutcomesList_complete
      Independent swapCost simpleBase (Nat.le_of_lt baseCountLt)
  have baseNormalMember : (simpleBaseCost, baseTarget) ∈ normalOutcomes :=
    List.mem_filter.mpr ⟨baseOutcomeMember, by simpa using baseNormal⟩
  have baseCandidateMember : (simpleBaseCost, baseTarget) ∈ candidates := by
    simpa [candidates] using baseNormalMember
  have candidatesNonempty : candidates.Nonempty :=
    ⟨(simpleBaseCost, baseTarget), baseCandidateMember⟩
  obtain ⟨best, bestMember, bestMinimum⟩ :=
    Finset.exists_min_image candidates Prod.fst candidatesNonempty
  obtain ⟨minimumCost, minimumTarget⟩ := best
  have bestListMember : (minimumCost, minimumTarget) ∈ normalOutcomes := by
    simpa [candidates] using bestMember
  have bestParts := List.mem_filter.mp bestListMember
  have minimumNormal : Normal minimumTarget := by
    simpa using bestParts.2
  obtain ⟨boundedCount, boundedCountLe, boundedPath⟩ :=
    weightedTracePathOutcomesList_sound
      Independent swapCost fuel first bestParts.1
  have boundedCertificate :=
    boundedPath.toTraceCertificate Independent swapCost
  obtain ⟨minimumCount, simpleCost, minimumCountLt, simplePath,
      simpleCostLe⟩ :=
    Sprawlens.NonnegativeCostAttainment.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative
      Independent swapCost primitiveNonneg boundedCertificate
  have simpleOutcomeMember : (simpleCost, minimumTarget) ∈ outcomes :=
    weightedTracePathOutcomesList_complete
      Independent swapCost simplePath (Nat.le_of_lt minimumCountLt)
  have simpleNormalMember : (simpleCost, minimumTarget) ∈ normalOutcomes :=
    List.mem_filter.mpr ⟨simpleOutcomeMember, by simpa using minimumNormal⟩
  have simpleCandidateMember : (simpleCost, minimumTarget) ∈ candidates := by
    simpa [candidates] using simpleNormalMember
  have bestLeSimple :=
    bestMinimum (simpleCost, minimumTarget) simpleCandidateMember
  have simpleCostEq : simpleCost = minimumCost :=
    le_antisymm simpleCostLe bestLeSimple
  subst simpleCost
  refine ⟨minimumCount, minimumCost, minimumTarget,
    minimumCountLt, minimumNormal, simplePath, ?_⟩
  intro otherCost otherTarget otherNormal otherCertificate
  obtain ⟨simpleCount, simpleCost, simpleCountLt, simplePath,
      simpleCostLe⟩ :=
    Sprawlens.NonnegativeCostAttainment.TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative
      Independent swapCost primitiveNonneg otherCertificate
  have otherOutcomeMember : (simpleCost, otherTarget) ∈ outcomes :=
    weightedTracePathOutcomesList_complete
      Independent swapCost simplePath (Nat.le_of_lt simpleCountLt)
  have otherNormalMember : (simpleCost, otherTarget) ∈ normalOutcomes :=
    List.mem_filter.mpr ⟨otherOutcomeMember, by simpa using otherNormal⟩
  have otherCandidateMember : (simpleCost, otherTarget) ∈ candidates := by
    simpa [candidates] using otherNormalMember
  exact (bestMinimum (simpleCost, otherTarget) otherCandidateMember).trans
    simpleCostLe

/-- Intrinsic propagated cost from one trace to its cheapest acceptable
representative. -/
def optimalNormalizingPropagatedCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (Normal : List Edit → Prop) (first : List Edit) : ENNReal :=
  ⨅ target, ⨅ (_ : Normal target),
    optimalPropagatedCost observe apply Independent initial first target

/-- The global optimum over all acceptable targets is attained for
propagated observation cost, without target uniqueness or a positive cost
floor. -/
theorem optimalNormalizingPropagatedCost_attained
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (initial : State) (Normal : List Edit → Prop) [DecidablePred Normal]
    {first baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (baseEquivalent : TraceEquivalent Independent first baseTarget) :
    ∃ minimumCount minimumCost minimumTarget,
      minimumCount < first.permutations.length ∧
      Normal minimumTarget ∧
      WeightedTracePath Independent
          (propagatedObservableSwapCost observe apply initial)
          minimumCount minimumCost first minimumTarget ∧
      optimalNormalizingPropagatedCost
          observe apply Independent initial Normal first =
        ENNReal.ofReal minimumCost ∧
      ∀ {otherCost otherTarget},
        Normal otherTarget →
        TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          otherCost first otherTarget →
        minimumCost ≤ otherCost := by
  have primitiveNonneg : PrimitiveSwapCostLowerBound Independent
      (propagatedObservableSwapCost observe apply initial) 0 := by
    intro before after left right independent
    exact propagatedObservableSwapCost_nonneg
      observe apply initial before after left right
  obtain ⟨baseCost, baseCertificate⟩ :=
    exists_propagatedCertificate
      observe apply Independent initial baseEquivalent
  obtain ⟨minimumCount, minimumCost, minimumTarget, countLt,
      minimumNormal, minimumPath, minimum⟩ :=
    minimumNormalizingCertificate_exists_of_nonnegative
      Independent
      (propagatedObservableSwapCost observe apply initial)
      Normal primitiveNonneg baseNormal baseCertificate
  refine ⟨minimumCount, minimumCost, minimumTarget, countLt,
    minimumNormal, minimumPath, ?_, minimum⟩
  apply le_antisymm
  · exact iInf_le_of_le minimumTarget
      (iInf_le_of_le minimumNormal
        (optimalPropagatedCost_le_certificate
          observe apply Independent initial
          (minimumPath.toTraceCertificate Independent
            (propagatedObservableSwapCost observe apply initial))))
  · apply le_iInf
    intro otherTarget
    apply le_iInf
    intro otherNormal
    apply le_iInf
    intro otherCost
    apply le_iInf
    intro otherCertificate
    exact ENNReal.ofReal_le_ofReal
      (minimum otherNormal otherCertificate)

/-- For rank normalization under an arbitrary decidable dependence graph,
there is a globally cheapest propagated certificate among all reachable-rank
normal forms. The deterministic leftmost normal form supplies feasibility but
does not constrain the selected optimum. -/
theorem optimalRankNormalizingPropagatedCost_attained
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (rank : Edit → Nat)
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (initial : State) (edits : List Edit) :
    ∃ minimumCount minimumCost minimumTarget,
      minimumCount < edits.permutations.length ∧
      IsReachableRankNormalForm rank Independent minimumTarget ∧
      WeightedTracePath Independent
          (propagatedObservableSwapCost observe apply initial)
          minimumCount minimumCost edits minimumTarget ∧
      optimalNormalizingPropagatedCost observe apply Independent initial
          (IsReachableRankNormalForm rank Independent) edits =
        ENNReal.ofReal minimumCost ∧
      ∀ {otherCost otherTarget},
        IsReachableRankNormalForm rank Independent otherTarget →
        TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          otherCost edits otherTarget →
        minimumCost ≤ otherCost := by
  classical
  let selected := deterministicNormalForm rank Independent edits
  have selectedNormal :
      IsReachableRankNormalForm rank Independent selected :=
    deterministicNormalForm_isNormalForm rank Independent edits
  have descending :=
    deterministicNormalization_descending rank Independent edits
  have selectedEquivalent : TraceEquivalent Independent edits selected :=
    (descending.toTraceEquivalentIn rank Independent).toTraceEquivalent
      Independent
  exact optimalNormalizingPropagatedCost_attained
    observe apply Independent initial
    (IsReachableRankNormalForm rank Independent)
    selectedNormal selectedEquivalent

def keepForkOuter : ForkEdit → Bool
  | .middle => false
  | _ => true

/-- In the concrete non-confluent fork, the only rank-normal targets in the
initial trace-equivalence class are the left and right branches. -/
theorem weightedFork_normal_equivalent_target_cases
    {target : List ForkEdit}
    (equivalent : TraceEquivalent ForkIndependent
      [.high, .middle, .low] target)
    (normal : IsReachableRankNormalForm
      forkRank ForkIndependent target) :
    target = [.middle, .high, .low] ∨
      target = [.high, .low, .middle] := by
  have perm :=
    Sprawlens.NonnegativeCostAttainment.TraceEquivalent.perm
      ForkIndependent equivalent
  have member : target ∈ [.high, .middle, .low].permutations :=
    List.mem_permutations.mpr perm.symm
  have filtered :=
    Sprawlens.NonnegativeCostAttainment.TraceEquivalent.filter_eq
      ForkIndependent keepForkOuter (by
        intro first second independent
        cases first <;> cases second <;>
          simp [ForkIndependent, keepForkOuter, List.filter]
            at independent ⊢)
      equivalent
  have permutationListEq :
      ([ForkEdit.high, ForkEdit.middle, ForkEdit.low] :
        List ForkEdit).permutations = [
          [ForkEdit.high, ForkEdit.middle, ForkEdit.low],
          [ForkEdit.middle, ForkEdit.high, ForkEdit.low],
          [ForkEdit.low, ForkEdit.middle, ForkEdit.high],
          [ForkEdit.middle, ForkEdit.low, ForkEdit.high],
          [ForkEdit.low, ForkEdit.high, ForkEdit.middle],
          [ForkEdit.high, ForkEdit.low, ForkEdit.middle]] := by
    native_decide
  rw [permutationListEq] at member
  simp only [List.mem_cons, List.not_mem_nil, or_false] at member
  rcases member with h | h | h | h | h | h
  all_goals subst target
  all_goals simp [IsReachableRankNormalForm, HasReducibleAdjacent,
    ForkIndependent, forkRank, keepForkOuter, List.filter]
      at normal filtered ⊢

/-- The target-agnostic global objective repairs the leftmost-policy gap in
the fork: its exact optimum is the right normal form's propagated cost `1`,
not the leftmost normal form's cost `2`. -/
theorem weightedFork_optimalNormalizingPropagatedCost_eq_one :
    optimalNormalizingPropagatedCost id applyWeightedFork ForkIndependent 0
      (IsReachableRankNormalForm forkRank ForkIndependent)
      [.high, .middle, .low] = 1 := by
  apply le_antisymm
  · have certificateUpper := optimalPropagatedCost_le_certificate
      id applyWeightedFork ForkIndependent 0 weightedFork_right_certificate
    have selectedUpper :
        optimalNormalizingPropagatedCost id applyWeightedFork
            ForkIndependent 0
            (IsReachableRankNormalForm forkRank ForkIndependent)
            [.high, .middle, .low] ≤ ENNReal.ofReal 1 := by
      exact iInf_le_of_le
        ([ForkEdit.high, ForkEdit.low, ForkEdit.middle] : List ForkEdit)
        (iInf_le_of_le fork_right_normalForm certificateUpper)
    simpa using selectedUpper
  · apply le_iInf
    intro target
    apply le_iInf
    intro normal
    by_cases equivalent : TraceEquivalent ForkIndependent
        [.high, .middle, .low] target
    · rcases weightedFork_normal_equivalent_target_cases equivalent normal with
        rfl | rfl
      · have lower := ofReal_observable_dist_le_optimalPropagatedCost
          id applyWeightedFork ForkIndependent 0
          [.high, .middle, .low] [.middle, .high, .low]
        norm_num [runEdits, applyWeightedFork, Real.dist_eq] at lower ⊢
        exact le_trans (by norm_num) lower
      · have lower := ofReal_observable_dist_le_optimalPropagatedCost
          id applyWeightedFork ForkIndependent 0
          [.high, .middle, .low] [.high, .low, .middle]
        norm_num [runEdits, applyWeightedFork, Real.dist_eq] at lower ⊢
        exact lower
    · rw [optimalPropagatedCost_eq_top_of_not_traceEquivalent
        id applyWeightedFork ForkIndependent 0 equivalent]
      exact le_top

end

end Sprawlens.NonnegativeNormalizingAttainment
