import Sprawlens.NonnegativeNormalizingAttainment

namespace Sprawlens.SimpleNormalizingSearch

open AposterioriConfluence
open LayoutConfluence
open NonnegativeCostAttainment
open NonnegativeCostAttainment.WeightedTraceWalk
open NonnegativeNormalizingAttainment
open OptimalPropagatedConfluence
open PositiveCostAttainment
open PropagatedConfluence
open ReachableRankNormalization
open WeightedNormalizationPolicy

universe u v

/-- Universe-polymorphic deterministic minimum. Exact cost ties keep the
earlier list element, so the search order is the explicit tie-break. -/
def minimumBy? {Candidate : Type u} {Cost : Type v} [LinearOrder Cost]
    (cost : Candidate → Cost) : List Candidate → Option Candidate
  | [] => none
  | first :: rest =>
      match minimumBy? cost rest with
      | none => some first
      | some selected =>
          if cost selected < cost first then some selected else some first

theorem minimumBy?_eq_none_iff
    {Candidate : Type u} {Cost : Type v} [LinearOrder Cost]
    (cost : Candidate → Cost) (candidates : List Candidate) :
    minimumBy? cost candidates = none ↔ candidates = [] := by
  cases candidates with
  | nil => simp [minimumBy?]
  | cons first rest =>
      cases selectedEq : minimumBy? cost rest with
      | none => simp [minimumBy?, selectedEq]
      | some selected =>
          by_cases better : cost selected < cost first <;>
            simp [minimumBy?, selectedEq, better]

theorem mem_of_minimumBy?_eq_some
    {Candidate : Type u} {Cost : Type v} [LinearOrder Cost]
    (cost : Candidate → Cost)
    {candidates : List Candidate} {selected : Candidate}
    (selectedEq : minimumBy? cost candidates = some selected) :
    selected ∈ candidates := by
  induction candidates generalizing selected with
  | nil => simp [minimumBy?] at selectedEq
  | cons first rest inductionHypothesis =>
      cases restEq : minimumBy? cost rest with
      | none =>
          simp [minimumBy?, restEq] at selectedEq
          subst selected
          simp
      | some restSelected =>
          by_cases better : cost restSelected < cost first
          · simp [minimumBy?, restEq, better] at selectedEq
            subst selected
            exact List.mem_cons_of_mem first (inductionHypothesis restEq)
          · simp [minimumBy?, restEq, better] at selectedEq
            subst selected
            simp

theorem minimumBy?_cost_le_of_mem
    {Candidate : Type u} {Cost : Type v} [LinearOrder Cost]
    (cost : Candidate → Cost)
    {candidates : List Candidate} {selected candidate : Candidate}
    (selectedEq : minimumBy? cost candidates = some selected)
    (candidateMem : candidate ∈ candidates) :
    cost selected ≤ cost candidate := by
  induction candidates generalizing selected candidate with
  | nil => simp at candidateMem
  | cons first rest inductionHypothesis =>
      cases restEq : minimumBy? cost rest with
      | none =>
          have restNil := (minimumBy?_eq_none_iff cost rest).mp restEq
          subst rest
          simp [minimumBy?] at selectedEq candidateMem
          subst selected
          subst candidate
          exact le_rfl
      | some restSelected =>
          by_cases better : cost restSelected < cost first
          · simp [minimumBy?, restEq, better] at selectedEq
            subst selected
            rcases List.mem_cons.mp candidateMem with candidateEq | tailMem
            · subst candidate
              exact le_of_lt better
            · exact inductionHypothesis restEq tailMem
          · simp [minimumBy?, restEq, better] at selectedEq
            subst selected
            rcases List.mem_cons.mp candidateMem with candidateEq | tailMem
            · subst candidate
              exact le_rfl
            · exact (le_of_not_gt better).trans
                (inductionHypothesis restEq tailMem)

/-- Depth-bounded enumeration of weighted walks that never revisit a vertex.
`visited` contains vertices from the strict prefix of the current search
branch. Reflexive termination remains available at every depth. -/
def simpleWeightedTraceWalkOutcomesList {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    Nat → List (List Edit) → List Edit → List (ℝ × List Edit)
  | 0, _visited, current => [(0, current)]
  | fuel + 1, visited, current =>
      (0, current) ::
        ((weightedSwapStepChoicesList Independent swapCost current).filter
          fun edge => edge.2 ∉ current :: visited).flatMap fun edge =>
            (simpleWeightedTraceWalkOutcomesList
              Independent swapCost fuel (current :: visited) edge.2).map
                fun tail => (edge.1 + tail.1, tail.2)

def simpleWeightedTracePathOutcomesList {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (fuel : Nat) (current : List Edit) : List (ℝ × List Edit) :=
  simpleWeightedTraceWalkOutcomesList
    Independent swapCost fuel [] current

theorem weightedTraceWalk_first_mem_vertices
    {Edit : Type u} {Independent : Edit → Edit → Prop}
    {swapCost : List Edit → List Edit → Edit → Edit → ℝ}
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target) :
    first ∈ walk.vertices := by
  cases walk <;> simp

/-- Soundness of the pruned search: every returned outcome has a concrete
walk whose vertices are duplicate-free and avoid the incoming visited set. -/
theorem simpleWeightedTraceWalkOutcomesList_sound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (fuel : Nat) (visited : List (List Edit)) (current : List Edit)
    (currentFresh : current ∉ visited)
    {cost : ℝ} {target : List Edit}
    (member : (cost, target) ∈
      simpleWeightedTraceWalkOutcomesList
        Independent swapCost fuel visited current) :
    ∃ walk : WeightedTraceWalk Independent swapCost current target,
      walk.count ≤ fuel ∧
      walk.cost = cost ∧
      walk.vertices.Nodup ∧
      ∀ vertex, vertex ∈ walk.vertices → vertex ∉ visited := by
  induction fuel generalizing visited current cost target with
  | zero =>
      simp [simpleWeightedTraceWalkOutcomesList] at member
      obtain ⟨rfl, rfl⟩ := member
      exact ⟨.nil target, by simp, by simp, by simp,
        by simpa using currentFresh⟩
  | succ fuel inductionHypothesis =>
      rw [simpleWeightedTraceWalkOutcomesList] at member
      rcases List.mem_cons.mp member with reflexive | stepped
      · have pairEq : (cost, target) = (0, current) := reflexive
        cases pairEq
        exact ⟨.nil current, Nat.zero_le _, by simp, by simp,
          by simpa using currentFresh⟩
      · obtain ⟨edge, edgeMember, mappedMember⟩ :=
          List.mem_flatMap.mp stepped
        obtain ⟨stepCost, next⟩ := edge
        have edgeParts := List.mem_filter.mp edgeMember
        have nextFresh : next ∉ current :: visited := by
          simpa using edgeParts.2
        obtain ⟨tail, tailMember, outcomeEq⟩ :=
          List.mem_map.mp mappedMember
        obtain ⟨tailCost, tailTarget⟩ := tail
        have pairEq :
            (cost, target) = (stepCost + tailCost, tailTarget) :=
          outcomeEq.symm
        cases pairEq
        obtain ⟨rest, restCountLe, restCostEq, restNodup, restAvoids⟩ :=
          inductionHypothesis (current :: visited) next nextFresh tailMember
        have edgeStep :=
          (weightedSwapStepChoicesList_enumerates
            Independent swapCost current stepCost next).mp edgeParts.1
        have currentNotInRest : current ∉ rest.vertices := by
          intro currentMember
          exact (restAvoids current currentMember) (by simp)
        refine ⟨.cons edgeStep rest, ?_, ?_, ?_, ?_⟩
        · simp
          omega
        · simp [restCostEq]
        · simp [currentNotInRest, restNodup]
        · intro vertex vertexMember
          rcases List.mem_cons.mp vertexMember with vertexEq | restMember
          · simpa [vertexEq] using currentFresh
          · have avoidsCons := restAvoids vertex restMember
            exact fun inVisited => avoidsCons (by simp [inVisited])

/-- Completeness of pruning: every duplicate-free walk avoiding the incoming
visited set remains in the enumeration. -/
theorem simpleWeightedTraceWalkOutcomesList_complete
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {fuel : Nat} {visited : List (List Edit)} {current target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost current target)
    (countLe : walk.count ≤ fuel)
    (nodup : walk.vertices.Nodup)
    (avoids : ∀ vertex, vertex ∈ walk.vertices → vertex ∉ visited) :
    (walk.cost, target) ∈ simpleWeightedTraceWalkOutcomesList
      Independent swapCost fuel visited current := by
  induction fuel generalizing visited current target with
  | zero =>
      have countZero : walk.count = 0 := Nat.eq_zero_of_le_zero countLe
      cases walk with
      | nil vertex => simp [simpleWeightedTraceWalkOutcomesList]
      | cons edge rest => simp at countZero
  | succ fuel inductionHypothesis =>
      cases walk with
      | nil vertex => simp [simpleWeightedTraceWalkOutcomesList]
      | @cons _ second target stepCost edge rest =>
          have restCountLe : rest.count ≤ fuel := by
            simp only [count_cons] at countLe
            omega
          have nodupParts := List.nodup_cons.mp (by simpa using nodup)
          have secondMember : second ∈ rest.vertices :=
            weightedTraceWalk_first_mem_vertices rest
          have secondFresh : second ∉ current :: visited := by
            simp only [List.mem_cons, not_or]
            exact ⟨fun secondEq => nodupParts.1 (secondEq ▸ secondMember),
              avoids second (by simp [secondMember])⟩
          have restAvoids :
              ∀ vertex, vertex ∈ rest.vertices →
                vertex ∉ current :: visited := by
            intro vertex vertexMember
            simp only [List.mem_cons, not_or]
            exact ⟨fun vertexEq => nodupParts.1 (vertexEq ▸ vertexMember),
              avoids vertex (by simp [vertexMember])⟩
          have tailMember := inductionHypothesis
            rest restCountLe nodupParts.2 restAvoids
          have edgeChoice : (stepCost, second) ∈
              weightedSwapStepChoicesList Independent swapCost current :=
            (weightedSwapStepChoicesList_enumerates
              Independent swapCost current stepCost second).mpr edge
          have filteredEdge : (stepCost, second) ∈
              (weightedSwapStepChoicesList
                Independent swapCost current).filter
                  fun candidate => candidate.2 ∉ current :: visited :=
            List.mem_filter.mpr ⟨edgeChoice, by simpa using secondFresh⟩
          rw [simpleWeightedTraceWalkOutcomesList]
          apply List.mem_cons_of_mem
          apply List.mem_flatMap.mpr
          refine ⟨(stepCost, second), filteredEdge, ?_⟩
          apply List.mem_map.mpr
          exact ⟨(rest.cost, target), tailMember, rfl⟩

theorem simpleWeightedTracePathOutcomesList_sound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (fuel : Nat) (current : List Edit) {cost : ℝ} {target : List Edit}
    (member : (cost, target) ∈
      simpleWeightedTracePathOutcomesList
        Independent swapCost fuel current) :
    ∃ walk : WeightedTraceWalk Independent swapCost current target,
      walk.count ≤ fuel ∧ walk.cost = cost ∧ walk.vertices.Nodup := by
  obtain ⟨walk, countLe, costEq, nodup, avoids⟩ :=
    simpleWeightedTraceWalkOutcomesList_sound
      Independent swapCost fuel [] current (by simp) member
  exact ⟨walk, countLe, costEq, nodup⟩

theorem simpleWeightedTracePathOutcomesList_complete
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {fuel : Nat} {current target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost current target)
    (countLe : walk.count ≤ fuel) (nodup : walk.vertices.Nodup) :
    (walk.cost, target) ∈ simpleWeightedTracePathOutcomesList
      Independent swapCost fuel current :=
  simpleWeightedTraceWalkOutcomesList_complete
    Independent swapCost walk countLe nodup (by simp)

def simpleNormalizingOutcomesList {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (first : List Edit) : List (ℝ × List Edit) :=
  (simpleWeightedTracePathOutcomesList Independent swapCost
    first.permutations.length first).filter fun outcome => Normal outcome.2

noncomputable def minimumSimpleNormalizingOutcome?
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (first : List Edit) : Option (ℝ × List Edit) :=
  minimumBy? Prod.fst
    (simpleNormalizingOutcomesList
      Independent swapCost Normal first)

/-- The pruned deterministic selector is a verified algorithmic
specification of global normalizing search. Given one feasible normal target
and nonnegative primitive costs, it returns a simple path that is no more
expensive than every certificate to every acceptable target. -/
theorem minimumSimpleNormalizingOutcome?_spec
    {Edit : Type u} [DecidableEq Edit]
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
      minimumSimpleNormalizingOutcome?
          Independent swapCost Normal first =
        some (minimumCost, minimumTarget) ∧
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
  let candidates := simpleNormalizingOutcomesList
    Independent swapCost Normal first
  obtain ⟨baseCount, basePath⟩ :=
    Sprawlens.PositiveCostAttainment.TraceCertificate.exists_weightedTracePath
      Independent swapCost baseCertificate
  obtain ⟨baseWalk, baseCountEq, baseCostEq⟩ :=
    WeightedTraceWalk.exists_of_weightedTracePath
      Independent swapCost basePath
  obtain ⟨simpleBase, simpleBaseNodup, simpleBaseCostLe,
      simpleBaseSubset⟩ :=
    baseWalk.exists_loopErased Independent swapCost primitiveNonneg
  have simpleBaseCountLt : simpleBase.count < first.permutations.length :=
    simpleBase.count_lt_permutations_length_of_nodup
      Independent swapCost simpleBaseNodup
  have baseSearchMember : (simpleBase.cost, baseTarget) ∈
      simpleWeightedTracePathOutcomesList Independent swapCost
        first.permutations.length first :=
    simpleWeightedTracePathOutcomesList_complete
      Independent swapCost simpleBase
      (Nat.le_of_lt simpleBaseCountLt) simpleBaseNodup
  have baseCandidateMember : (simpleBase.cost, baseTarget) ∈ candidates := by
    exact List.mem_filter.mpr ⟨baseSearchMember, by simpa using baseNormal⟩
  have candidatesNe : candidates ≠ [] := List.ne_nil_of_mem baseCandidateMember
  cases selectedEq : minimumBy? Prod.fst candidates with
  | none =>
      have candidatesNil :=
        (minimumBy?_eq_none_iff Prod.fst candidates).mp selectedEq
      exact (candidatesNe candidatesNil).elim
  | some selected =>
      obtain ⟨minimumCost, minimumTarget⟩ := selected
      have selectedMember : (minimumCost, minimumTarget) ∈ candidates :=
        mem_of_minimumBy?_eq_some Prod.fst selectedEq
      have selectedParts := List.mem_filter.mp selectedMember
      have minimumNormal : Normal minimumTarget := by
        simpa using selectedParts.2
      obtain ⟨minimumWalk, minimumCountLe, minimumCostEq,
          minimumNodup⟩ :=
        simpleWeightedTracePathOutcomesList_sound
          Independent swapCost first.permutations.length first
          selectedParts.1
      have minimumCountLt :
          minimumWalk.count < first.permutations.length :=
        minimumWalk.count_lt_permutations_length_of_nodup
          Independent swapCost minimumNodup
      have returned : minimumSimpleNormalizingOutcome?
          Independent swapCost Normal first =
          some (minimumCost, minimumTarget) := by
        simpa [minimumSimpleNormalizingOutcome?, candidates] using selectedEq
      refine ⟨minimumWalk.count, minimumCost, minimumTarget,
        returned, minimumCountLt, minimumNormal, ?_, ?_⟩
      · simpa [minimumCostEq] using minimumWalk.toWeightedTracePath
      · intro otherCost otherTarget otherNormal otherCertificate
        obtain ⟨otherCount, otherPath⟩ :=
          Sprawlens.PositiveCostAttainment.TraceCertificate.exists_weightedTracePath
            Independent swapCost otherCertificate
        obtain ⟨otherWalk, otherCountEq, otherCostEq⟩ :=
          WeightedTraceWalk.exists_of_weightedTracePath
            Independent swapCost otherPath
        obtain ⟨simpleOther, simpleOtherNodup, simpleOtherCostLe,
            simpleOtherSubset⟩ :=
          otherWalk.exists_loopErased
            Independent swapCost primitiveNonneg
        have simpleOtherCountLt :
            simpleOther.count < first.permutations.length :=
          simpleOther.count_lt_permutations_length_of_nodup
            Independent swapCost simpleOtherNodup
        have otherSearchMember : (simpleOther.cost, otherTarget) ∈
            simpleWeightedTracePathOutcomesList Independent swapCost
              first.permutations.length first :=
          simpleWeightedTracePathOutcomesList_complete
            Independent swapCost simpleOther
            (Nat.le_of_lt simpleOtherCountLt) simpleOtherNodup
        have otherCandidateMember :
            (simpleOther.cost, otherTarget) ∈ candidates :=
          List.mem_filter.mpr
            ⟨otherSearchMember, by simpa using otherNormal⟩
        have selectedLe := minimumBy?_cost_le_of_mem
          Prod.fst selectedEq otherCandidateMember
        exact selectedLe.trans
          (simpleOtherCostLe.trans_eq otherCostEq)

/-- Concrete positive sanity case: the pruned selector repairs the fork's
leftmost-policy gap and returns the right normal target at exact cost `1`. -/
theorem weightedFork_minimumSimpleNormalizingOutcome?_eq :
    minimumSimpleNormalizingOutcome? ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)
      (IsReachableRankNormalForm forkRank ForkIndependent)
      [.high, .middle, .low] =
        some (1, [.high, .low, .middle]) := by
  have primitiveNonneg : PrimitiveSwapCostLowerBound ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0) 0 := by
    intro before after first second independent
    exact propagatedObservableSwapCost_nonneg
      id applyWeightedFork 0 before after first second
  obtain ⟨minimumCount, minimumCost, minimumTarget, returned,
      countLt, minimumNormal, minimumPath, minimum⟩ :=
    minimumSimpleNormalizingOutcome?_spec ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)
      (IsReachableRankNormalForm forkRank ForkIndependent)
      primitiveNonneg fork_right_normalForm weightedFork_right_certificate
  have minimumEquivalent : TraceEquivalent ForkIndependent
      [.high, .middle, .low] minimumTarget :=
    (minimumPath.toTraceCertificate ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)).toTraceEquivalent
        ForkIndependent
        (propagatedObservableSwapCost id applyWeightedFork 0)
  have costLeOne : minimumCost ≤ 1 :=
    minimum fork_right_normalForm weightedFork_right_certificate
  rcases weightedFork_normal_equivalent_target_cases
      minimumEquivalent minimumNormal with targetLeft | targetRight
  · subst minimumTarget
    have endpointLower :=
      observable_dist_runEdits_le_propagatedCertificate
        id applyWeightedFork ForkIndependent 0
        (minimumPath.toTraceCertificate ForkIndependent
          (propagatedObservableSwapCost id applyWeightedFork 0))
    norm_num [runEdits, applyWeightedFork, Real.dist_eq] at endpointLower
    linarith
  · subst minimumTarget
    have endpointLower :=
      observable_dist_runEdits_le_propagatedCertificate
        id applyWeightedFork ForkIndependent 0
        (minimumPath.toTraceCertificate ForkIndependent
          (propagatedObservableSwapCost id applyWeightedFork 0))
    norm_num [runEdits, applyWeightedFork, Real.dist_eq] at endpointLower
    have costEq : minimumCost = 1 := le_antisymm costLeOne endpointLower
    simpa [costEq] using returned

end Sprawlens.SimpleNormalizingSearch
