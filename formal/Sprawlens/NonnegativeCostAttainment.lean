import Mathlib.Data.List.Permutation
import Sprawlens.PositiveCostAttainment

namespace Sprawlens.NonnegativeCostAttainment

open AposterioriConfluence
open LayoutConfluence
open OptimalPropagatedConfluence
open PositiveCostAttainment
open PropagatedConfluence

universe u

/-- Type-valued counterpart of `WeightedTracePath`. Keeping the edge sequence
as data allows loop erasure; proofs are later projected back to `Prop`. -/
inductive WeightedTraceWalk {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    List Edit → List Edit → Type (u + 1) where
  | nil (vertex : List Edit) :
      WeightedTraceWalk Independent swapCost vertex vertex
  | cons {first second target : List Edit} {stepCost : ℝ}
      (edge : WeightedSwapStep Independent swapCost
        stepCost first second)
      (rest : WeightedTraceWalk Independent swapCost second target) :
      WeightedTraceWalk Independent swapCost first target

namespace WeightedTraceWalk

def count
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first target : List Edit} :
    WeightedTraceWalk Independent swapCost first target → Nat
  | .nil _ => 0
  | .cons _ rest => rest.count + 1

def cost
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first target : List Edit} :
    WeightedTraceWalk Independent swapCost first target → ℝ
  | .nil _ => 0
  | .cons (stepCost := stepCost) _ rest => stepCost + rest.cost

def vertices
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first target : List Edit} :
    WeightedTraceWalk Independent swapCost first target →
      List (List Edit)
  | .nil vertex => [vertex]
  | .cons (first := first) _ rest => first :: rest.vertices

@[simp] theorem count_nil
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    (vertex : List Edit) :
    (WeightedTraceWalk.nil
      (Independent := Independent) (swapCost := swapCost) vertex).count = 0 :=
  rfl

@[simp] theorem count_cons
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first second target : List Edit} {stepCost : ℝ}
    (edge : WeightedSwapStep Independent swapCost
      stepCost first second)
    (rest : WeightedTraceWalk Independent swapCost second target) :
    (WeightedTraceWalk.cons edge rest).count = rest.count + 1 := rfl

@[simp] theorem cost_nil
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    (vertex : List Edit) :
    (WeightedTraceWalk.nil
      (Independent := Independent) (swapCost := swapCost) vertex).cost = 0 :=
  rfl

@[simp] theorem cost_cons
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first second target : List Edit} {stepCost : ℝ}
    (edge : WeightedSwapStep Independent swapCost
      stepCost first second)
    (rest : WeightedTraceWalk Independent swapCost second target) :
    (WeightedTraceWalk.cons edge rest).cost = stepCost + rest.cost := rfl

@[simp] theorem vertices_nil
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    (vertex : List Edit) :
    (WeightedTraceWalk.nil
      (Independent := Independent) (swapCost := swapCost) vertex).vertices =
      [vertex] := rfl

@[simp] theorem vertices_cons
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first second target : List Edit} {stepCost : ℝ}
    (edge : WeightedSwapStep Independent swapCost
      stepCost first second)
    (rest : WeightedTraceWalk Independent swapCost second target) :
    (WeightedTraceWalk.cons edge rest).vertices = first :: rest.vertices := rfl

theorem toWeightedTracePath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target) :
    WeightedTracePath Independent swapCost
      walk.count walk.cost first target := by
  induction walk with
  | nil vertex => exact .refl vertex
  | cons edge rest inductionHypothesis =>
      exact .step edge inductionHypothesis

theorem exists_of_weightedTracePath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {count : Nat} {pathCost : ℝ} {first target : List Edit}
    (path : WeightedTracePath Independent swapCost
      count pathCost first target) :
    ∃ walk : WeightedTraceWalk Independent swapCost first target,
      walk.count = count ∧ walk.cost = pathCost := by
  induction path with
  | refl edits => exact ⟨.nil edits, rfl, rfl⟩
  | step edge rest inductionHypothesis =>
      obtain ⟨walk, countEq, costEq⟩ := inductionHypothesis
      exact ⟨.cons edge walk, by simp [countEq], by simp [costEq]⟩

theorem edgeCost_nonneg
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {stepCost : ℝ} {first second : List Edit}
    (edge : WeightedSwapStep Independent swapCost
      stepCost first second) :
    0 ≤ stepCost :=
  edge.cost_lower_bound Independent swapCost 0 primitiveNonneg

theorem cost_nonneg
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target) :
    0 ≤ walk.cost := by
  induction walk with
  | nil vertex => simp
  | cons edge rest inductionHypothesis =>
      exact add_nonneg
        (edgeCost_nonneg Independent swapCost primitiveNonneg edge)
        inductionHypothesis

/-- Any visited vertex determines a suffix walk. Removing the preceding
segment does not increase cost when primitive edges are nonnegative. -/
theorem exists_suffix_of_mem_vertices
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {first target vertex : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (member : vertex ∈ walk.vertices) :
    ∃ suffix : WeightedTraceWalk Independent swapCost vertex target,
      suffix.count ≤ walk.count ∧
      suffix.cost ≤ walk.cost ∧
      ∀ candidate, candidate ∈ suffix.vertices →
        candidate ∈ walk.vertices := by
  induction walk with
  | nil current =>
      simp at member
      subst vertex
      exact ⟨.nil current, le_rfl, le_rfl, by simp⟩
  | @cons first second target stepCost edge rest inductionHypothesis =>
      rcases List.mem_cons.mp member with vertexEq | tailMember
      · subst vertex
        exact ⟨.cons edge rest, le_rfl, le_rfl, fun _ => id⟩
      · obtain ⟨suffix, countLe, costLe, verticesSubset⟩ :=
          inductionHypothesis tailMember
        refine ⟨suffix, ?_, ?_, ?_⟩
        · exact countLe.trans (Nat.le_add_right rest.count 1)
        · calc
            suffix.cost ≤ rest.cost := costLe
            _ ≤ stepCost + rest.cost := by
              linarith [edgeCost_nonneg
                Independent swapCost primitiveNonneg edge]
        · intro candidate candidateMember
          exact List.mem_cons_of_mem first
            (verticesSubset candidate candidateMember)

/-- Bounded loop erasure. The explicit step bound makes the recursive
decrease independent of the dependent endpoints carried by a walk. -/
private theorem exists_loopErased_bounded
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {target : List Edit} (bound : Nat) {first : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (countLe : walk.count ≤ bound) :
    ∃ simple : WeightedTraceWalk Independent swapCost first target,
      simple.vertices.Nodup ∧
      simple.cost ≤ walk.cost ∧
      ∀ candidate, candidate ∈ simple.vertices →
        candidate ∈ walk.vertices := by
  induction bound generalizing first with
  | zero =>
      cases walk with
      | nil _ => exact ⟨.nil target, by simp, by simp, by simp⟩
      | cons edge rest => simp at countLe
  | succ bound inductionHypothesis =>
      cases walk with
      | nil _ => exact ⟨.nil target, by simp, by simp, by simp⟩
      | @cons first second target stepCost edge rest =>
          have restCountLe : rest.count ≤ bound := by
            apply Nat.le_of_succ_le_succ
            simpa only [count_cons, Nat.succ_eq_add_one] using countLe
          by_cases firstLater : first ∈ rest.vertices
          · obtain ⟨suffix, suffixCountLe, suffixCostLe, suffixSubset⟩ :=
              exists_suffix_of_mem_vertices
                Independent swapCost primitiveNonneg rest firstLater
            obtain ⟨simple, simpleNodup, simpleCostLe, simpleSubset⟩ :=
              inductionHypothesis suffix
                (suffixCountLe.trans restCountLe)
            refine ⟨simple, simpleNodup, ?_, ?_⟩
            · calc
                simple.cost ≤ suffix.cost := simpleCostLe
                _ ≤ rest.cost := suffixCostLe
                _ ≤ stepCost + rest.cost := by
                  linarith [edgeCost_nonneg
                    Independent swapCost primitiveNonneg edge]
            · intro candidate candidateMember
              exact List.mem_cons_of_mem first
                (suffixSubset candidate
                  (simpleSubset candidate candidateMember))
          · obtain ⟨simpleRest, restNodup, restCostLe, restSubset⟩ :=
              inductionHypothesis rest restCountLe
            have firstNotInSimple : first ∉ simpleRest.vertices := by
              intro member
              exact firstLater (restSubset first member)
            refine ⟨.cons edge simpleRest, ?_, ?_, ?_⟩
            · exact List.nodup_cons.mpr ⟨firstNotInSimple, restNodup⟩
            · simpa only [cost_cons] using
                add_le_add le_rfl restCostLe
            · intro candidate candidateMember
              rcases List.mem_cons.mp candidateMember with
                candidateEq | tailMember
              · simp [candidateEq]
              · exact List.mem_cons_of_mem first
                  (restSubset candidate tailMember)

/-- Loop erasure for nonnegative weighted walks. The resulting vertex list is
duplicate-free, cost never increases, and no new vertex is introduced. -/
theorem exists_loopErased
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target) :
    ∃ simple : WeightedTraceWalk Independent swapCost first target,
      simple.vertices.Nodup ∧
      simple.cost ≤ walk.cost ∧
      ∀ candidate, candidate ∈ simple.vertices →
        candidate ∈ walk.vertices :=
  exists_loopErased_bounded Independent swapCost primitiveNonneg
    walk.count walk le_rfl

theorem vertices_length
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target) :
    walk.vertices.length = walk.count + 1 := by
  induction walk with
  | nil vertex => simp
  | cons edge rest inductionHypothesis =>
      simp [inductionHypothesis, Nat.add_comm]

end WeightedTraceWalk

theorem WeightedSwapStep.perm
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cost : ℝ} {first second : List Edit}
    (step : WeightedSwapStep Independent swapCost cost first second) :
    first.Perm second := by
  cases step with
  | forward before after first second independent =>
      exact (List.Perm.swap first second after).symm.append_left before
  | backward before after first second independent =>
      exact (List.Perm.swap first second after).append_left before

namespace WeightedTraceWalk

theorem vertex_perm_first
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {first target vertex : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (member : vertex ∈ walk.vertices) :
    vertex.Perm first := by
  induction walk with
  | nil current =>
      simp at member
      subst vertex
      exact .refl current
  | @cons first second target stepCost edge rest inductionHypothesis =>
      rcases List.mem_cons.mp member with vertexEq | tailMember
      · subst vertex
        exact .refl first
      · exact (inductionHypothesis tailMember).trans
          (Sprawlens.NonnegativeCostAttainment.WeightedSwapStep.perm
            Independent swapCost edge).symm

/-- A loop-erased walk has fewer edges than the number of syntactic
permutations of its initial trace. This finite bound remains valid when
primitive costs are zero. -/
theorem count_lt_permutations_length_of_nodup
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (nodup : walk.vertices.Nodup) :
    walk.count < first.permutations.length := by
  have subset : walk.vertices ⊆ first.permutations := by
    intro vertex member
    exact List.mem_permutations.mpr
      (walk.vertex_perm_first Independent swapCost member)
  have lengthLe := nodup.length_le_of_subset subset
  rw [walk.vertices_length] at lengthLe
  omega

end WeightedTraceWalk

/-- Nonnegative primitive costs suffice for global minimum attainment between
two fixed traces. Zero-cost cycles are erased first; every remaining simple
walk lies in the finite permutation graph of the initial trace. -/
theorem minimumTraceCertificate_exists_of_nonnegative
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {baseCost : ℝ} {first target : List Edit}
    (baseCertificate : TraceCertificate Independent swapCost
      baseCost first target) :
    ∃ minimumCost,
      TraceCertificate Independent swapCost minimumCost first target ∧
      ∀ {otherCost},
        TraceCertificate Independent swapCost otherCost first target →
        minimumCost ≤ otherCost := by
  classical
  let fuel := first.permutations.length
  obtain ⟨baseCount, basePath⟩ :=
    TraceCertificate.exists_weightedTracePath
      Independent swapCost baseCertificate
  obtain ⟨baseWalk, baseCountEq, baseCostEq⟩ :=
    WeightedTraceWalk.exists_of_weightedTracePath
      Independent swapCost basePath
  obtain ⟨simpleBase, simpleBaseNodup, simpleBaseCostLe, simpleBaseSubset⟩ :=
    baseWalk.exists_loopErased Independent swapCost primitiveNonneg
  have simpleBaseCountLt : simpleBase.count < fuel := by
    exact simpleBase.count_lt_permutations_length_of_nodup
      Independent swapCost simpleBaseNodup
  let outcomes := weightedTracePathOutcomesList
    Independent swapCost fuel first
  let targetOutcomes := outcomes.filter fun outcome => outcome.2 = target
  let candidates : Finset (ℝ × List Edit) := targetOutcomes.toFinset
  have baseOutcomeMember : (simpleBase.cost, target) ∈ outcomes := by
    exact weightedTracePathOutcomesList_complete
      Independent swapCost simpleBase.toWeightedTracePath
      (Nat.le_of_lt simpleBaseCountLt)
  have baseTargetMember : (simpleBase.cost, target) ∈ targetOutcomes := by
    exact List.mem_filter.mpr ⟨baseOutcomeMember, by simp⟩
  have baseCandidateMember : (simpleBase.cost, target) ∈ candidates := by
    simpa [candidates] using baseTargetMember
  have candidatesNonempty : candidates.Nonempty :=
    ⟨(simpleBase.cost, target), baseCandidateMember⟩
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
  obtain ⟨otherWalk, otherCountEq, otherCostEq⟩ :=
    WeightedTraceWalk.exists_of_weightedTracePath
      Independent swapCost otherPath
  obtain ⟨simpleOther, simpleOtherNodup, simpleOtherCostLe,
      simpleOtherSubset⟩ :=
    otherWalk.exists_loopErased Independent swapCost primitiveNonneg
  have simpleOtherCountLt : simpleOther.count < fuel := by
    exact simpleOther.count_lt_permutations_length_of_nodup
      Independent swapCost simpleOtherNodup
  have otherOutcomeMember : (simpleOther.cost, target) ∈ outcomes := by
    exact weightedTracePathOutcomesList_complete
      Independent swapCost simpleOther.toWeightedTracePath
      (Nat.le_of_lt simpleOtherCountLt)
  have otherTargetMember : (simpleOther.cost, target) ∈ targetOutcomes :=
    List.mem_filter.mpr ⟨otherOutcomeMember, by simp⟩
  have otherCandidateMember : (simpleOther.cost, target) ∈ candidates := by
    simpa [candidates] using otherTargetMember
  exact (bestMinimum (simpleOther.cost, target) otherCandidateMember).trans
    (simpleOtherCostLe.trans_eq otherCostEq)

/-- Propagated observation distance is always nonnegative, so the intrinsic
certificate infimum between equivalent fixed traces is attained even when
some primitive swaps have zero observed cost. -/
theorem optimalPropagatedCost_attained_of_nonnegative
    {Edit : Type u} {State : Type*} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (initial : State) {first second : List Edit}
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
  have primitiveNonneg : PrimitiveSwapCostLowerBound Independent
      (propagatedObservableSwapCost observe apply initial) 0 := by
    intro before after first second independent
    exact propagatedObservableSwapCost_nonneg
      observe apply initial before after first second
  obtain ⟨baseCost, baseCertificate⟩ :=
    exists_propagatedCertificate
      observe apply Independent initial equivalent
  obtain ⟨minimumCost, minimumCertificate, minimum⟩ :=
    minimumTraceCertificate_exists_of_nonnegative
      Independent
      (propagatedObservableSwapCost observe apply initial)
      primitiveNonneg baseCertificate
  refine ⟨minimumCost, minimumCertificate, ?_, minimum⟩
  apply le_antisymm
  · exact optimalPropagatedCost_le_certificate
      observe apply Independent initial minimumCertificate
  · apply le_iInf
    intro otherCost
    apply le_iInf
    intro otherCertificate
    exact ENNReal.ofReal_le_ofReal (minimum otherCertificate)

end Sprawlens.NonnegativeCostAttainment
