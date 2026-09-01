import Sprawlens.PrefixDominance

namespace Sprawlens.DijkstraInvariant

open AposterioriConfluence
open DeterministicRankNormalization
open LayoutConfluence
open NonnegativeCostAttainment
open NonnegativeCostAttainment.WeightedTraceWalk
open NonnegativeNormalizingAttainment
open OptimalPropagatedConfluence
open PositiveCostAttainment
open PrefixDominance
open PropagatedConfluence
open QuantitativeConfluence
open ReachableRankNormalization
open SimpleNormalizingSearch
open TraceDerivationGenerator
open WeightedNormalizationPolicy

universe u

/-- Every queue entry is backed by a concrete path from the fixed source. -/
def FrontierSound {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (frontier : List (ℝ × List Edit)) : Prop :=
  ∀ cost target, (cost, target) ∈ frontier →
    ∃ count, WeightedTracePath Independent swapCost
      count cost source target

/-- Cut invariant used by Dijkstra: every path from the source to an
unsettled target has cost at least one current frontier entry. The witnessing
entry need not have the same target; it represents the first queue crossing
of the path through the settled/unsettled cut. -/
def FrontierCoversUnsettledPaths {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit)) : Prop :=
  ∀ target, target ∉ settled →
    ∀ {count cost},
      WeightedTracePath Independent swapCost count cost source target →
      ∃ entry, entry ∈ frontier ∧ entry.1 ≤ cost

/-- Strong cut witness used to prove update preservation. Each path to an
unsettled target is bounded by a frontier prefix followed by a duplicate-free
suffix that avoids every settled vertex. -/
def FrontierSimpleCutCoverage {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit)) : Prop :=
  ∀ target, target ∉ settled →
    ∀ {count cost},
      WeightedTracePath Independent swapCost count cost source target →
      ∃ entry, entry ∈ frontier ∧
        ∃ suffix : WeightedTraceWalk Independent swapCost entry.2 target,
          suffix.vertices.Nodup ∧
          (∀ vertex, vertex ∈ suffix.vertices → vertex ∉ settled) ∧
          entry.1 + suffix.cost ≤ cost

/-- A visited vertex determines an actual list suffix of a walk. For
nonnegative edges, dropping the preceding segment does not increase cost. -/
theorem exists_suffix_sublist_of_mem_vertices
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {first target vertex : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (member : vertex ∈ walk.vertices) :
    ∃ suffix : WeightedTraceWalk Independent swapCost vertex target,
      suffix.cost ≤ walk.cost ∧
      suffix.vertices.Sublist walk.vertices := by
  induction walk with
  | nil current =>
      simp at member
      subst vertex
      exact ⟨.nil current, le_rfl, .refl _⟩
  | @cons first second target stepCost edge rest inductionHypothesis =>
      rcases List.mem_cons.mp member with vertexEq | tailMember
      · subst vertex
        exact ⟨.cons edge rest, le_rfl, .refl _⟩
      · obtain ⟨suffix, suffixCostLe, suffixSublist⟩ :=
          inductionHypothesis tailMember
        refine ⟨suffix, ?_, suffixSublist.cons first⟩
        calc
          suffix.cost ≤ rest.cost := suffixCostLe
          _ ≤ stepCost + rest.cost := by
            linarith [WeightedTraceWalk.edgeCost_nonneg
              Independent swapCost primitiveNonneg edge]

/-- Nonnegative costs turn the strong suffix witness into the scalar cut
lower bound used by the settle theorem. -/
theorem frontierSimpleCutCoverage_implies_covers
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    (coverage : FrontierSimpleCutCoverage
      Independent swapCost source settled frontier) :
    FrontierCoversUnsettledPaths
      Independent swapCost source settled frontier := by
  intro target targetFresh count cost path
  obtain ⟨entry, entryMember, suffix, suffixNodup,
      suffixAvoids, totalLe⟩ := coverage target targetFresh path
  refine ⟨entry, entryMember, ?_⟩
  have suffixNonneg := suffix.cost_nonneg
    Independent swapCost primitiveNonneg
  linarith

/-- The source-only queue satisfies the strong coverage invariant. An
arbitrary path is first loop-erased, so the suffix witness is simple even if
the input derivation contains zero-cost cycles. -/
theorem initialFrontier_simpleCutCoverage_of_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    FrontierSimpleCutCoverage
      Independent swapCost source [] [(0, source)] := by
  intro target targetFresh count cost path
  obtain ⟨walk, countEq, costEq⟩ :=
    WeightedTraceWalk.exists_of_weightedTracePath
      Independent swapCost path
  obtain ⟨simple, simpleNodup, simpleCostLe, simpleSubset⟩ :=
    walk.exists_loopErased Independent swapCost primitiveNonneg
  refine ⟨(0, source), by simp, simple, simpleNodup, by simp, ?_⟩
  simpa [costEq] using simpleCostLe

/-- Dijkstra settle theorem, factored at the exact invariant boundary. A
minimum-cost queue entry whose target is not settled is globally shortest to
that exact target. Nonnegativity is needed to establish and preserve the cut
invariant, not by this final order argument itself. -/
theorem minimumFrontierEntry_is_pathCostMinimal
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    {selectedCost : ℝ} {selectedTarget : List Edit}
    (selectedEq : minimumBy? Prod.fst frontier =
      some (selectedCost, selectedTarget))
    (selectedFresh : selectedTarget ∉ settled)
    (sound : FrontierSound Independent swapCost source frontier)
    (covers : FrontierCoversUnsettledPaths
      Independent swapCost source settled frontier) :
    ∃ selectedCount,
      WeightedTracePath Independent swapCost
          selectedCount selectedCost source selectedTarget ∧
        PathCostMinimal Independent swapCost
          selectedCost source selectedTarget := by
  have selectedMember : (selectedCost, selectedTarget) ∈ frontier :=
    mem_of_minimumBy?_eq_some Prod.fst selectedEq
  obtain ⟨selectedCount, selectedPath⟩ :=
    sound selectedCost selectedTarget selectedMember
  refine ⟨selectedCount, selectedPath, ?_⟩
  intro otherCount otherCost otherPath
  obtain ⟨entry, entryMember, entryLe⟩ :=
    covers selectedTarget selectedFresh otherPath
  exact (minimumBy?_cost_le_of_mem
    Prod.fst selectedEq entryMember).trans entryLe

theorem initialFrontier_sound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) :
    FrontierSound Independent swapCost source [(0, source)] := by
  intro cost target member
  simp at member
  obtain ⟨rfl, rfl⟩ := member
  exact ⟨0, .refl target⟩

/-- Nonnegative primitive costs establish the initial cut invariant: the
zero-cost source entry lower-bounds every path cost. -/
theorem initialFrontier_covers_of_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    FrontierCoversUnsettledPaths
      Independent swapCost source [] [(0, source)] := by
  intro target targetFresh count cost path
  refine ⟨(0, source), by simp, ?_⟩
  have lower := path.count_mul_le_cost
    Independent swapCost 0 primitiveNonneg
  simpa using lower

/-- Queue candidates obtained by relaxing every symmetric adjacent-swap edge
from one entry. -/
def relaxWeightedFrontierEntry {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (entry : ℝ × List Edit) : List (ℝ × List Edit) :=
  (weightedSwapStepChoicesList Independent swapCost entry.2).map
    fun edge => (entry.1 + edge.1, edge.2)

/-- Relaxation preserves queue soundness locally: each generated candidate
extends the parent path by exactly one certified edge. -/
theorem relaxWeightedFrontierEntry_sound
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {source : List Edit} {prefixCount : Nat}
    {prefixCost : ℝ} {current : List Edit}
    (prefixPath : WeightedTracePath Independent swapCost
      prefixCount prefixCost source current)
    {cost : ℝ} {target : List Edit}
    (member : (cost, target) ∈ relaxWeightedFrontierEntry
      Independent swapCost (prefixCost, current)) :
    ∃ stepCost,
      cost = prefixCost + stepCost ∧
      WeightedTracePath Independent swapCost
        (prefixCount + 1) cost source target := by
  obtain ⟨edge, edgeMember, outcomeEq⟩ := List.mem_map.mp member
  obtain ⟨stepCost, next⟩ := edge
  have pairEq : (cost, target) = (prefixCost + stepCost, next) :=
    outcomeEq.symm
  cases pairEq
  have edgeStep :=
    (weightedSwapStepChoicesList_enumerates
      Independent swapCost current stepCost target).mp edgeMember
  have oneStep : WeightedTracePath Independent swapCost
      1 stepCost current target := by
    simpa using WeightedTracePath.step edgeStep
      (WeightedTracePath.refl
        (Independent := Independent) (swapCost := swapCost) target)
  exact ⟨stepCost, rfl,
    prefixPath.append Independent swapCost oneStep⟩

/-- Expanding a sound queue entry and appending all of its relaxations keeps
the whole frontier sound. -/
theorem frontierSound_relax_append
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {source : List Edit} {frontier : List (ℝ × List Edit)}
    {prefixCost : ℝ} {current : List Edit}
    (sound : FrontierSound Independent swapCost source frontier)
    (prefixMember : (prefixCost, current) ∈ frontier) :
    FrontierSound Independent swapCost source
      (relaxWeightedFrontierEntry
        Independent swapCost (prefixCost, current) ++ frontier) := by
  obtain ⟨prefixCount, prefixPath⟩ :=
    sound prefixCost current prefixMember
  intro cost target member
  rcases List.mem_append.mp member with relaxed | retained
  · obtain ⟨stepCost, costEq, path⟩ :=
      relaxWeightedFrontierEntry_sound
        Independent swapCost prefixPath relaxed
    exact ⟨prefixCount + 1, path⟩
  · exact sound cost target retained

/-- Under nonnegative primitive costs, relaxation never decreases tentative
cost. This is the monotonicity used by a min-priority queue. -/
theorem relaxWeightedFrontierEntry_cost_mono
    {Edit : Type u}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (prefixCost : ℝ) (current : List Edit)
    {cost : ℝ} {target : List Edit}
    (member : (cost, target) ∈ relaxWeightedFrontierEntry
      Independent swapCost (prefixCost, current)) :
    prefixCost ≤ cost := by
  obtain ⟨edge, edgeMember, outcomeEq⟩ := List.mem_map.mp member
  obtain ⟨stepCost, next⟩ := edge
  have pairEq : (cost, target) = (prefixCost + stepCost, next) :=
    outcomeEq.symm
  cases pairEq
  have edgeStep :=
    (weightedSwapStepChoicesList_enumerates
      Independent swapCost current stepCost target).mp edgeMember
  have stepNonneg := edgeStep.cost_lower_bound
    Independent swapCost 0 primitiveNonneg
  linarith

/-- One Dijkstra update: generate relaxations from the selected entry and
drop all stale queue entries whose exact target has just been settled. -/
def advanceFrontier {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (selected : ℝ × List Edit) (frontier : List (ℝ × List Edit)) :
    List (ℝ × List Edit) :=
  relaxWeightedFrontierEntry Independent swapCost selected ++
    frontier.filter fun entry => entry.2 ≠ selected.2

theorem advanceFrontier_sound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {source : List Edit} {frontier : List (ℝ × List Edit)}
    {selectedCost : ℝ} {selectedTarget : List Edit}
    (sound : FrontierSound Independent swapCost source frontier)
    (selectedMember : (selectedCost, selectedTarget) ∈ frontier) :
    FrontierSound Independent swapCost source
      (advanceFrontier Independent swapCost
        (selectedCost, selectedTarget) frontier) := by
  obtain ⟨selectedCount, selectedPath⟩ :=
    sound selectedCost selectedTarget selectedMember
  intro cost target member
  rcases List.mem_append.mp member with relaxed | retained
  · obtain ⟨stepCost, costEq, path⟩ :=
      relaxWeightedFrontierEntry_sound
        Independent swapCost selectedPath relaxed
    exact ⟨selectedCount + 1, path⟩
  · exact sound cost target (List.mem_filter.mp retained).1

/-- Full cut-preservation step. If a selected trace occurs in an old simple
suffix witness, cut that suffix at the selected trace, relax its first edge,
and retain the rest. If it does not occur, the old frontier witness survives
the exact-target filter. -/
theorem advanceFrontier_preserves_simpleCutCoverage
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    {selectedCost : ℝ} {selectedTarget : List Edit}
    (selectedEq : minimumBy? Prod.fst frontier =
      some (selectedCost, selectedTarget))
    (coverage : FrontierSimpleCutCoverage
      Independent swapCost source settled frontier) :
    FrontierSimpleCutCoverage Independent swapCost source
      (selectedTarget :: settled)
      (advanceFrontier Independent swapCost
        (selectedCost, selectedTarget) frontier) := by
  have selectedMember : (selectedCost, selectedTarget) ∈ frontier :=
    mem_of_minimumBy?_eq_some Prod.fst selectedEq
  intro target targetFresh count cost path
  have targetFreshOld : target ∉ settled := by
    intro targetSettled
    exact targetFresh (by simp [targetSettled])
  obtain ⟨entry, entryMember, suffix, suffixNodup,
      suffixAvoids, totalLe⟩ := coverage target targetFreshOld path
  by_cases selectedInSuffix : selectedTarget ∈ suffix.vertices
  · obtain ⟨selectedSuffix, selectedSuffixCostLe, selectedSublist⟩ :=
      exists_suffix_sublist_of_mem_vertices
        Independent swapCost primitiveNonneg suffix selectedInSuffix
    have selectedSuffixNodup : selectedSuffix.vertices.Nodup :=
      selectedSublist.nodup suffixNodup
    have selectedSuffixAvoidsOld :
        ∀ vertex, vertex ∈ selectedSuffix.vertices → vertex ∉ settled := by
      intro vertex vertexMember
      exact suffixAvoids vertex (selectedSublist.subset vertexMember)
    cases selectedSuffix with
    | nil vertex =>
        exfalso
        exact targetFresh (by simp)
    | @cons first second target stepCost edge rest =>
        have nodupParts := List.nodup_cons.mp
          (by simpa using selectedSuffixNodup)
        have restAvoidsNew :
            ∀ vertex, vertex ∈ rest.vertices →
              vertex ∉ selectedTarget :: settled := by
          intro vertex vertexMember
          simp only [List.mem_cons, not_or]
          exact ⟨fun vertexEq => nodupParts.1 (vertexEq ▸ vertexMember),
            selectedSuffixAvoidsOld vertex (by simp [vertexMember])⟩
        have edgeChoice : (stepCost, second) ∈
            weightedSwapStepChoicesList
              Independent swapCost selectedTarget :=
          (weightedSwapStepChoicesList_enumerates
            Independent swapCost selectedTarget stepCost second).mpr edge
        have relaxedMember :
            (selectedCost + stepCost, second) ∈
              relaxWeightedFrontierEntry Independent swapCost
                (selectedCost, selectedTarget) :=
          List.mem_map.mpr ⟨(stepCost, second), edgeChoice, rfl⟩
        have advancedMember :
            (selectedCost + stepCost, second) ∈
              advanceFrontier Independent swapCost
                (selectedCost, selectedTarget) frontier :=
          List.mem_append_left _ relaxedMember
        have selectedLeEntry : selectedCost ≤ entry.1 :=
          minimumBy?_cost_le_of_mem Prod.fst selectedEq entryMember
        refine ⟨(selectedCost + stepCost, second), advancedMember,
          rest, nodupParts.2, restAvoidsNew, ?_⟩
        have selectedSuffixCostLe' :
            stepCost + rest.cost ≤ suffix.cost := by
          simpa only [WeightedTraceWalk.cost_cons] using selectedSuffixCostLe
        linarith
  · have entryNe : entry.2 ≠ selectedTarget := by
      intro entryEq
      apply selectedInSuffix
      rw [← entryEq]
      exact weightedTraceWalk_first_mem_vertices suffix
    have retainedMember : entry ∈ frontier.filter
        fun candidate => candidate.2 ≠ selectedTarget :=
      List.mem_filter.mpr ⟨entryMember, by simpa using entryNe⟩
    have advancedMember : entry ∈
        advanceFrontier Independent swapCost
          (selectedCost, selectedTarget) frontier :=
      List.mem_append_right _ retainedMember
    have suffixAvoidsNew :
        ∀ vertex, vertex ∈ suffix.vertices →
          vertex ∉ selectedTarget :: settled := by
      intro vertex vertexMember
      simp only [List.mem_cons, not_or]
      exact ⟨fun vertexEq => selectedInSuffix (vertexEq ▸ vertexMember),
        suffixAvoids vertex vertexMember⟩
    exact ⟨entry, advancedMember, suffix, suffixNodup,
      suffixAvoidsNew, totalLe⟩

/-- Inductive state contract for the verified Dijkstra loop. -/
def SearchInvariant {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit)) : Prop :=
  FrontierSound Independent swapCost source frontier ∧
    FrontierSimpleCutCoverage
      Independent swapCost source settled frontier

theorem initialSearchInvariant_of_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    SearchInvariant Independent swapCost source [] [(0, source)] :=
  ⟨initialFrontier_sound Independent swapCost source,
    initialFrontier_simpleCutCoverage_of_nonnegative
      Independent swapCost primitiveNonneg source⟩

/-- The state invariant is preserved by settling the queue minimum, removing
all stale entries for that exact trace, and appending its relaxations. -/
theorem advanceSearchInvariant
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    {selectedCost : ℝ} {selectedTarget : List Edit}
    (selectedEq : minimumBy? Prod.fst frontier =
      some (selectedCost, selectedTarget))
    (invariant : SearchInvariant
      Independent swapCost source settled frontier) :
    SearchInvariant Independent swapCost source
      (selectedTarget :: settled)
      (advanceFrontier Independent swapCost
        (selectedCost, selectedTarget) frontier) := by
  have selectedMember : (selectedCost, selectedTarget) ∈ frontier :=
    mem_of_minimumBy?_eq_some Prod.fst selectedEq
  exact ⟨advanceFrontier_sound
      Independent swapCost invariant.1 selectedMember,
    advanceFrontier_preserves_simpleCutCoverage
      Independent swapCost primitiveNonneg source settled frontier
      selectedEq invariant.2⟩

/-- At every invariant-preserving loop iteration, a fresh minimum queue
entry can be finalized as the exact shortest cost to its trace. -/
theorem searchInvariant_minimum_is_pathCostMinimal
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    {selectedCost : ℝ} {selectedTarget : List Edit}
    (selectedEq : minimumBy? Prod.fst frontier =
      some (selectedCost, selectedTarget))
    (selectedFresh : selectedTarget ∉ settled)
    (invariant : SearchInvariant
      Independent swapCost source settled frontier) :
    ∃ selectedCount,
      WeightedTracePath Independent swapCost
          selectedCount selectedCost source selectedTarget ∧
        PathCostMinimal Independent swapCost
          selectedCost source selectedTarget :=
  minimumFrontierEntry_is_pathCostMinimal
    Independent swapCost source settled frontier
    selectedEq selectedFresh invariant.1
    (frontierSimpleCutCoverage_implies_covers
      Independent swapCost primitiveNonneg source settled frontier invariant.2)

/-- Remove queue entries whose exact trace is already settled. -/
def pruneSettledFrontier {Edit : Type u} [DecidableEq Edit]
    (settled : List (List Edit)) (frontier : List (ℝ × List Edit)) :
    List (ℝ × List Edit) :=
  frontier.filter fun entry => entry.2 ∉ settled

theorem pruneSettledFrontier_sound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    (sound : FrontierSound Independent swapCost source frontier) :
    FrontierSound Independent swapCost source
      (pruneSettledFrontier settled frontier) := by
  intro cost target member
  exact sound cost target (List.mem_filter.mp member).1

theorem pruneSettledFrontier_preserves_simpleCutCoverage
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    (coverage : FrontierSimpleCutCoverage
      Independent swapCost source settled frontier) :
    FrontierSimpleCutCoverage Independent swapCost source settled
      (pruneSettledFrontier settled frontier) := by
  intro target targetFresh count cost path
  obtain ⟨entry, entryMember, suffix, suffixNodup,
      suffixAvoids, totalLe⟩ := coverage target targetFresh path
  have entryFresh : entry.2 ∉ settled :=
    suffixAvoids entry.2 (weightedTraceWalk_first_mem_vertices suffix)
  have prunedMember : entry ∈ pruneSettledFrontier settled frontier :=
    List.mem_filter.mpr ⟨entryMember, by simpa using entryFresh⟩
  exact ⟨entry, prunedMember, suffix, suffixNodup, suffixAvoids, totalLe⟩

theorem pruneSettledFrontier_preserves_searchInvariant
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (settled : List (List Edit))
    (frontier : List (ℝ × List Edit))
    (invariant : SearchInvariant
      Independent swapCost source settled frontier) :
    SearchInvariant Independent swapCost source settled
      (pruneSettledFrontier settled frontier) :=
  ⟨pruneSettledFrontier_sound
      Independent swapCost source settled frontier invariant.1,
    pruneSettledFrontier_preserves_simpleCutCoverage
      Independent swapCost source settled frontier invariant.2⟩

theorem minimum_prunedFrontier_target_fresh
    {Edit : Type u} [DecidableEq Edit]
    (settled : List (List Edit)) (frontier : List (ℝ × List Edit))
    {selectedCost : ℝ} {selectedTarget : List Edit}
    (selectedEq : minimumBy? Prod.fst
      (pruneSettledFrontier settled frontier) =
        some (selectedCost, selectedTarget)) :
    selectedTarget ∉ settled := by
  have selectedMember :=
    mem_of_minimumBy?_eq_some Prod.fst selectedEq
  exact of_decide_eq_true (List.mem_filter.mp selectedMember).2

structure SearchState (Edit : Type u) where
  settled : List (List Edit)
  frontier : List (ℝ × List Edit)

inductive SearchStepResult (Edit : Type u) where
  | exhausted
  | found (cost : ℝ) (target : List Edit)
  | continue (state : SearchState Edit)

def SettledNonNormal {Edit : Type u}
    (Normal : List Edit → Prop) (settled : List (List Edit)) : Prop :=
  ∀ target, target ∈ settled → ¬Normal target

def SettledPermutations {Edit : Type u}
    (source : List Edit) (settled : List (List Edit)) : Prop :=
  ∀ target, target ∈ settled → target.Perm source

def FullSearchInvariant {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit)
    (state : SearchState Edit) : Prop :=
  SearchInvariant Independent swapCost source
      state.settled state.frontier ∧
    SettledNonNormal Normal state.settled ∧
    state.settled.Nodup ∧
    SettledPermutations source state.settled

/-- One executable list-priority-queue iteration. Stale settled entries are
filtered before minimum selection. -/
noncomputable def dijkstraStep {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (state : SearchState Edit) : SearchStepResult Edit :=
  let fresh := pruneSettledFrontier state.settled state.frontier
  match minimumBy? Prod.fst fresh with
  | none => .exhausted
  | some selected =>
      if Normal selected.2 then .found selected.1 selected.2
      else
        .continue {
          settled := selected.2 :: state.settled
          frontier := advanceFrontier
            Independent swapCost selected fresh
        }

theorem initialFullSearchInvariant_of_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    FullSearchInvariant Independent swapCost Normal source
      ⟨[], [(0, source)]⟩ := by
  exact ⟨initialSearchInvariant_of_nonnegative
      Independent swapCost primitiveNonneg source,
    by simp [SettledNonNormal], by simp,
    by simp [SettledPermutations]⟩

/-- A `continue` result preserves both graph-search invariants and records a
new distinct non-normal settled trace. -/
theorem dijkstraStep_continue_preserves_fullInvariant
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (state next : SearchState Edit)
    (invariant : FullSearchInvariant
      Independent swapCost Normal source state)
    (stepEq : dijkstraStep Independent swapCost Normal state =
      .continue next) :
    FullSearchInvariant Independent swapCost Normal source next ∧
      next.settled.length = state.settled.length + 1 := by
  let fresh := pruneSettledFrontier state.settled state.frontier
  have freshInvariant :=
    pruneSettledFrontier_preserves_searchInvariant
      Independent swapCost source state.settled state.frontier invariant.1
  cases selectedEq : minimumBy? Prod.fst fresh with
  | none =>
      simp [dijkstraStep, fresh, selectedEq] at stepEq
  | some selected =>
      obtain ⟨selectedCost, selectedTarget⟩ := selected
      by_cases normal : Normal selectedTarget
      · simp [dijkstraStep, fresh, selectedEq, normal] at stepEq
      · simp [dijkstraStep, fresh, selectedEq, normal] at stepEq
        subst next
        have selectedFresh : selectedTarget ∉ state.settled :=
          minimum_prunedFrontier_target_fresh
            state.settled state.frontier selectedEq
        have selectedMember : (selectedCost, selectedTarget) ∈ fresh :=
          mem_of_minimumBy?_eq_some Prod.fst selectedEq
        obtain ⟨selectedCount, selectedPath⟩ :=
          freshInvariant.1 selectedCost selectedTarget selectedMember
        have selectedPerm : selectedTarget.Perm source :=
          (Sprawlens.NonnegativeCostAttainment.TraceCertificate.perm
            Independent swapCost
            (selectedPath.toTraceCertificate Independent swapCost)).symm
        have advancedInvariant := advanceSearchInvariant
          Independent swapCost primitiveNonneg source state.settled fresh
          selectedEq freshInvariant
        refine ⟨⟨advancedInvariant, ?_, ?_, ?_⟩, by simp⟩
        · intro target targetMember
          rcases List.mem_cons.mp targetMember with targetEq | oldMember
          · simpa [targetEq]
          · exact invariant.2.1 target oldMember
        · exact List.nodup_cons.mpr ⟨selectedFresh, invariant.2.2.1⟩
        · intro target targetMember
          rcases List.mem_cons.mp targetMember with targetEq | oldMember
          · simpa [targetEq] using selectedPerm
          · exact invariant.2.2.2 target oldMember

/-- If one iteration returns a normal target, that queue entry is globally
minimum across every path to every acceptable normal target, not merely
minimum to its own endpoint. -/
theorem dijkstraStep_found_globalNormalizingMinimum
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (state : SearchState Edit)
    {minimumCost : ℝ} {minimumTarget : List Edit}
    (invariant : FullSearchInvariant
      Independent swapCost Normal source state)
    (stepEq : dijkstraStep Independent swapCost Normal state =
      .found minimumCost minimumTarget) :
    Normal minimumTarget ∧
      ∃ minimumCount,
        WeightedTracePath Independent swapCost
            minimumCount minimumCost source minimumTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            minimumCost ≤ otherCost := by
  let fresh := pruneSettledFrontier state.settled state.frontier
  have freshInvariant :=
    pruneSettledFrontier_preserves_searchInvariant
      Independent swapCost source state.settled state.frontier invariant.1
  cases selectedEq : minimumBy? Prod.fst fresh with
  | none =>
      simp [dijkstraStep, fresh, selectedEq] at stepEq
  | some selected =>
      obtain ⟨selectedCost, selectedTarget⟩ := selected
      by_cases normal : Normal selectedTarget
      · simp [dijkstraStep, fresh, selectedEq, normal] at stepEq
        obtain ⟨rfl, rfl⟩ := stepEq
        have selectedMember : (selectedCost, selectedTarget) ∈ fresh :=
          mem_of_minimumBy?_eq_some Prod.fst selectedEq
        obtain ⟨minimumCount, minimumPath⟩ :=
          freshInvariant.1 selectedCost selectedTarget selectedMember
        refine ⟨normal, minimumCount, minimumPath, ?_⟩
        intro otherCount otherCost otherTarget otherNormal otherPath
        have otherFresh : otherTarget ∉ state.settled := by
          intro otherSettled
          exact (invariant.2.1 otherTarget otherSettled) otherNormal
        have covers := frontierSimpleCutCoverage_implies_covers
          Independent swapCost primitiveNonneg source state.settled fresh
          freshInvariant.2
        obtain ⟨entry, entryMember, entryLe⟩ :=
          covers otherTarget otherFresh otherPath
        exact (minimumBy?_cost_le_of_mem
          Prod.fst selectedEq entryMember).trans entryLe
      · simp [dijkstraStep, fresh, selectedEq, normal] at stepEq

/-- A valid normalizing path prevents premature queue exhaustion. -/
theorem dijkstraStep_not_exhausted_of_normal_path
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) (state : SearchState Edit)
    (invariant : FullSearchInvariant
      Independent swapCost Normal source state)
    {count : Nat} {cost : ℝ} {target : List Edit}
    (targetNormal : Normal target)
    (path : WeightedTracePath Independent swapCost
      count cost source target) :
    dijkstraStep Independent swapCost Normal state ≠ .exhausted := by
  let fresh := pruneSettledFrontier state.settled state.frontier
  have freshCoverage :=
    pruneSettledFrontier_preserves_simpleCutCoverage
      Independent swapCost source state.settled state.frontier invariant.1.2
  have targetFresh : target ∉ state.settled := by
    intro targetSettled
    exact (invariant.2.1 target targetSettled) targetNormal
  obtain ⟨entry, entryMember, suffix, suffixNodup,
      suffixAvoids, totalLe⟩ := freshCoverage target targetFresh path
  intro exhaustedEq
  cases selectedEq : minimumBy? Prod.fst fresh with
  | none =>
      have freshNil := (minimumBy?_eq_none_iff Prod.fst fresh).mp selectedEq
      exact (List.ne_nil_of_mem entryMember) freshNil
  | some selected =>
      obtain ⟨selectedCost, selectedTarget⟩ := selected
      by_cases normal : Normal selectedTarget <;>
        simp [dijkstraStep, fresh, selectedEq, normal] at exhaustedEq

theorem settled_length_le_permutations_length
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit)
    (state : SearchState Edit)
    (invariant : FullSearchInvariant
      Independent swapCost Normal source state) :
    state.settled.length ≤ source.permutations.length := by
  apply invariant.2.2.1.length_le_of_subset
  intro target targetMember
  exact List.mem_permutations.mpr
    (invariant.2.2.2 target targetMember)

/-- Fuel-bounded executable Dijkstra loop over the finite trace-permutation
component. -/
noncomputable def dijkstraSearchFuel
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal] :
    Nat → SearchState Edit → Option (ℝ × List Edit)
  | 0, _state => none
  | fuel + 1, state =>
      match dijkstraStep Independent swapCost Normal state with
      | .exhausted => none
      | .found cost target => some (cost, target)
      | .continue next =>
          dijkstraSearchFuel Independent swapCost Normal fuel next

/-- Any result returned by the loop is a globally minimum normalizing path. -/
theorem dijkstraSearchFuel_some_globalNormalizingMinimum
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (fuel : Nat) (state : SearchState Edit)
    {minimumCost : ℝ} {minimumTarget : List Edit}
    (invariant : FullSearchInvariant
      Independent swapCost Normal source state)
    (searchEq : dijkstraSearchFuel Independent swapCost Normal fuel state =
      some (minimumCost, minimumTarget)) :
    Normal minimumTarget ∧
      ∃ minimumCount,
        WeightedTracePath Independent swapCost
            minimumCount minimumCost source minimumTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            minimumCost ≤ otherCost := by
  induction fuel generalizing state minimumCost minimumTarget with
  | zero => simp [dijkstraSearchFuel] at searchEq
  | succ fuel inductionHypothesis =>
      cases stepEq : dijkstraStep Independent swapCost Normal state with
      | exhausted =>
          simp [dijkstraSearchFuel, stepEq] at searchEq
      | found foundCost foundTarget =>
          simp [dijkstraSearchFuel, stepEq] at searchEq
          obtain ⟨rfl, rfl⟩ := searchEq
          exact dijkstraStep_found_globalNormalizingMinimum
            Independent swapCost Normal primitiveNonneg source state
            invariant stepEq
      | «continue» next =>
          have nextInvariant :=
            (dijkstraStep_continue_preserves_fullInvariant
              Independent swapCost Normal primitiveNonneg source state next
              invariant stepEq).1
          exact inductionHypothesis next nextInvariant
            (by simpa [dijkstraSearchFuel, stepEq] using searchEq)

/-- With more fuel than the number of still-unsettled permutations, a known
normal path guarantees that the loop returns a result. -/
theorem dijkstraSearchFuel_ne_none_of_remaining_capacity
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) (fuel : Nat) (state : SearchState Edit)
    (invariant : FullSearchInvariant
      Independent swapCost Normal source state)
    {count : Nat} {cost : ℝ} {target : List Edit}
    (targetNormal : Normal target)
    (path : WeightedTracePath Independent swapCost
      count cost source target)
    (capacity : source.permutations.length - state.settled.length < fuel) :
    dijkstraSearchFuel Independent swapCost Normal fuel state ≠ none := by
  induction fuel generalizing state with
  | zero => omega
  | succ fuel inductionHypothesis =>
      cases stepEq : dijkstraStep Independent swapCost Normal state with
      | exhausted =>
          exact (dijkstraStep_not_exhausted_of_normal_path
            Independent swapCost Normal source state invariant
            targetNormal path stepEq).elim
      | found foundCost foundTarget =>
          simp [dijkstraSearchFuel, stepEq]
      | «continue» next =>
          obtain ⟨nextInvariant, lengthEq⟩ :=
            dijkstraStep_continue_preserves_fullInvariant
              Independent swapCost Normal primitiveNonneg source state next
              invariant stepEq
          have stateLengthLe := settled_length_le_permutations_length
            Independent swapCost Normal source state invariant
          have nextLengthLe := settled_length_le_permutations_length
            Independent swapCost Normal source next nextInvariant
          have nextCapacity :
              source.permutations.length - next.settled.length < fuel := by
            omega
          have nextNe := inductionHypothesis next nextInvariant nextCapacity
          simpa [dijkstraSearchFuel, stepEq] using nextNe

def initialSearchState {Edit : Type u} (source : List Edit) :
    SearchState Edit :=
  ⟨[], [(0, source)]⟩

/-- Public finite search. One more iteration than the number of syntactic
permutations is sufficient because every `continue` settles a fresh
permutation. -/
noncomputable def dijkstraSearch
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) : Option (ℝ × List Edit) :=
  dijkstraSearchFuel Independent swapCost Normal
    (source.permutations.length + 1) (initialSearchState source)

/-- End-to-end correctness and completeness of the finite list-priority-
queue implementation. -/
theorem dijkstraSearch_complete_and_optimal
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit)
    {baseCount : Nat} {baseCost : ℝ} {baseTarget : List Edit}
    (baseNormal : Normal baseTarget)
    (basePath : WeightedTracePath Independent swapCost
      baseCount baseCost source baseTarget) :
    ∃ minimumCount minimumCost minimumTarget,
      dijkstraSearch Independent swapCost Normal source =
        some (minimumCost, minimumTarget) ∧
      Normal minimumTarget ∧
      WeightedTracePath Independent swapCost
        minimumCount minimumCost source minimumTarget ∧
      ∀ {otherCount otherCost otherTarget},
        Normal otherTarget →
        WeightedTracePath Independent swapCost
          otherCount otherCost source otherTarget →
        minimumCost ≤ otherCost := by
  let state := initialSearchState source
  have invariant : FullSearchInvariant
      Independent swapCost Normal source state :=
    initialFullSearchInvariant_of_nonnegative
      Independent swapCost Normal primitiveNonneg source
  have capacity :
      source.permutations.length - state.settled.length <
        source.permutations.length + 1 := by
    simp [state, initialSearchState]
  have searchNe := dijkstraSearchFuel_ne_none_of_remaining_capacity
    Independent swapCost Normal primitiveNonneg source
    (source.permutations.length + 1) state invariant
    baseNormal basePath capacity
  cases searchEq : dijkstraSearchFuel Independent swapCost Normal
      (source.permutations.length + 1) state with
  | none => exact (searchNe searchEq).elim
  | some result =>
      obtain ⟨minimumCost, minimumTarget⟩ := result
      obtain ⟨minimumNormal, minimumCount, minimumPath, minimum⟩ :=
        dijkstraSearchFuel_some_globalNormalizingMinimum
          Independent swapCost Normal primitiveNonneg source
          (source.permutations.length + 1) state invariant searchEq
      exact ⟨minimumCount, minimumCost, minimumTarget,
        by simpa [dijkstraSearch, state] using searchEq,
        minimumNormal, minimumPath, minimum⟩

/-- Production-facing exact-real specialization. For arbitrary decidable
rank dependence, Dijkstra returns a globally cheapest propagated certificate
to any reachable-rank normal form, and that cost attains the target-agnostic
intrinsic infimum. -/
theorem dijkstraRankNormalizingPropagatedCost_attained
    {Edit : Type u} [DecidableEq Edit]
    {State : Type*} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (rank : Edit → Nat)
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (initial : State) (source : List Edit) :
    ∃ minimumCount minimumCost minimumTarget,
      dijkstraSearch Independent
          (propagatedObservableSwapCost observe apply initial)
          (IsReachableRankNormalForm rank Independent) source =
        some (minimumCost, minimumTarget) ∧
      IsReachableRankNormalForm rank Independent minimumTarget ∧
      WeightedTracePath Independent
        (propagatedObservableSwapCost observe apply initial)
        minimumCount minimumCost source minimumTarget ∧
      optimalNormalizingPropagatedCost observe apply Independent initial
          (IsReachableRankNormalForm rank Independent) source =
        ENNReal.ofReal minimumCost ∧
      ∀ {otherCost otherTarget},
        IsReachableRankNormalForm rank Independent otherTarget →
        TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          otherCost source otherTarget →
        minimumCost ≤ otherCost := by
  have primitiveNonneg : PrimitiveSwapCostLowerBound Independent
      (propagatedObservableSwapCost observe apply initial) 0 := by
    intro before after first second independent
    exact propagatedObservableSwapCost_nonneg
      observe apply initial before after first second
  let selected := deterministicNormalForm rank Independent source
  have selectedNormal :
      IsReachableRankNormalForm rank Independent selected :=
    deterministicNormalForm_isNormalForm rank Independent source
  have descending :=
    deterministicNormalization_descending rank Independent source
  have selectedEquivalent : TraceEquivalent Independent source selected :=
    (descending.toTraceEquivalentIn rank Independent).toTraceEquivalent
      Independent
  obtain ⟨baseCost, baseCertificate⟩ :=
    exists_propagatedCertificate
      observe apply Independent initial selectedEquivalent
  obtain ⟨baseCount, basePath⟩ :=
    Sprawlens.PositiveCostAttainment.TraceCertificate.exists_weightedTracePath
      Independent
      (propagatedObservableSwapCost observe apply initial)
      baseCertificate
  obtain ⟨minimumCount, minimumCost, minimumTarget, searchEq,
      minimumNormal, minimumPath, minimumPathwise⟩ :=
    dijkstraSearch_complete_and_optimal Independent
      (propagatedObservableSwapCost observe apply initial)
      (IsReachableRankNormalForm rank Independent)
      primitiveNonneg source selectedNormal basePath
  have minimumCertificate := minimumPath.toTraceCertificate
    Independent (propagatedObservableSwapCost observe apply initial)
  have certificateMinimum :
      ∀ {otherCost otherTarget},
        IsReachableRankNormalForm rank Independent otherTarget →
        TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          otherCost source otherTarget →
        minimumCost ≤ otherCost := by
    intro otherCost otherTarget otherNormal otherCertificate
    obtain ⟨otherCount, otherPath⟩ :=
      Sprawlens.PositiveCostAttainment.TraceCertificate.exists_weightedTracePath
        Independent
        (propagatedObservableSwapCost observe apply initial)
        otherCertificate
    exact minimumPathwise otherNormal otherPath
  refine ⟨minimumCount, minimumCost, minimumTarget, searchEq,
    minimumNormal, minimumPath, ?_, certificateMinimum⟩
  apply le_antisymm
  · exact iInf_le_of_le minimumTarget
      (iInf_le_of_le minimumNormal
        (optimalPropagatedCost_le_certificate
          observe apply Independent initial minimumCertificate))
  · apply le_iInf
    intro otherTarget
    apply le_iInf
    intro otherNormal
    apply le_iInf
    intro otherCost
    apply le_iInf
    intro otherCertificate
    exact ENNReal.ofReal_le_ofReal
      (certificateMinimum otherNormal otherCertificate)

/-- Concrete end-to-end regression: the verified Dijkstra loop returns the
right fork branch at exact propagated cost `1`. -/
theorem weightedFork_dijkstraSearch_eq :
    dijkstraSearch ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)
      (IsReachableRankNormalForm forkRank ForkIndependent)
      [.high, .middle, .low] =
        some (1, [.high, .low, .middle]) := by
  obtain ⟨minimumCount, minimumCost, minimumTarget, searchEq,
      minimumNormal, minimumPath, optimumEq, minimum⟩ :=
    dijkstraRankNormalizingPropagatedCost_attained
      (rank := forkRank) (observe := (id : ℝ → ℝ))
      (apply := applyWeightedFork)
      (Independent := ForkIndependent) (initial := (0 : ℝ))
      (source := [.high, .middle, .low])
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
    simpa [costEq] using searchEq

/-- The nonnegative premise is load-bearing even at initialization. With the
abstract negative edge model, the source queue entry at cost zero does not
lower-bound the one-step path of cost `-1`. -/
theorem negativeCost_initialFrontier_not_covering :
    ¬FrontierCoversUnsettledPaths (@AllIndependent Bool) negativeSwapCost
      [false, true] [] [(0, [false, true])] := by
  intro covers
  have edge : WeightedSwapStep (@AllIndependent Bool) negativeSwapCost (-1)
      [false, true] [true, false] := by
    simpa [negativeSwapCost] using
      (WeightedSwapStep.forward
        (Independent := @AllIndependent Bool)
        (swapCost := negativeSwapCost)
        [] [] false true (by simp [AllIndependent]))
  have path : WeightedTracePath (@AllIndependent Bool) negativeSwapCost
      1 (-1) [false, true] [true, false] := by
    simpa using WeightedTracePath.step edge
      (WeightedTracePath.refl
        (Independent := @AllIndependent Bool)
        (swapCost := negativeSwapCost) [true, false])
  obtain ⟨entry, entryMember, entryLe⟩ :=
    covers [true, false] (by simp) path
  simp at entryMember
  subst entry
  norm_num at entryLe

end Sprawlens.DijkstraInvariant
