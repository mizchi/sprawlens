import Sprawlens.SimpleNormalizingSearch

namespace Sprawlens.ReachableTraceClass

open AposterioriConfluence
open LayoutConfluence
open NonnegativeCostAttainment
open NonnegativeCostAttainment.WeightedTraceWalk
open PositiveCostAttainment
open SimpleNormalizingSearch

universe u

/-- Cost-erased view of the symmetric adjacent-swap graph. -/
def zeroSwapCost {Edit : Type u} :
    List Edit → List Edit → Edit → Edit → ℝ :=
  fun _before _after _first _second => 0

theorem zeroSwapCost_nonnegative
    {Edit : Type u} (Independent : Edit → Edit → Prop) :
    PrimitiveSwapCostLowerBound Independent
      (zeroSwapCost (Edit := Edit)) 0 := by
  intro before after first second independent
  rfl

/-- Every declarative trace equivalence has a sequential zero-cost path. -/
theorem TraceEquivalent.exists_zeroWeightedTracePath
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    {first target : List Edit}
    (equivalent : TraceEquivalent Independent first target) :
    ∃ count, WeightedTracePath Independent
      (zeroSwapCost (Edit := Edit)) count 0 first target := by
  induction equivalent with
  | refl edits => exact ⟨0, .refl edits⟩
  | swap before after left right independent =>
      exact ⟨1, by
        simpa [zeroSwapCost] using WeightedTracePath.step
          (WeightedSwapStep.forward before after left right independent)
          (WeightedTracePath.refl
            (Independent := Independent)
            (swapCost := zeroSwapCost (Edit := Edit))
            (before ++ right :: left :: after))⟩
  | symm equivalent inductionHypothesis =>
      obtain ⟨count, path⟩ := inductionHypothesis
      exact ⟨count, path.symm Independent zeroSwapCost⟩
  | trans left right leftHypothesis rightHypothesis =>
      obtain ⟨leftCount, leftPath⟩ := leftHypothesis
      obtain ⟨rightCount, rightPath⟩ := rightHypothesis
      exact ⟨leftCount + rightCount, by
        simpa using leftPath.append Independent zeroSwapCost rightPath⟩

/-- Duplicate-free finite enumeration of exactly the trace-equivalence class
of `source`. The fuel is the number of distinct syntactic permutations; the
final `dedup` removes multiple simple paths to the same trace. -/
def reachableTraceVerticesList
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) : List (List Edit) :=
  ((simpleWeightedTracePathOutcomesList Independent
      (zeroSwapCost (Edit := Edit))
      source.permutations.toFinset.card source).map Prod.snd).dedup

theorem reachableTraceVerticesList_nodup
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) :
    (reachableTraceVerticesList Independent source).Nodup := by
  exact List.nodup_dedup _

theorem reachableTraceVerticesList_sound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source target : List Edit)
    (member : target ∈ reachableTraceVerticesList Independent source) :
    TraceEquivalent Independent source target := by
  have mappedMember : target ∈
      (simpleWeightedTracePathOutcomesList Independent
        (zeroSwapCost (Edit := Edit))
        source.permutations.toFinset.card source).map Prod.snd := by
    simpa [reachableTraceVerticesList] using member
  obtain ⟨outcome, outcomeMember, targetEq⟩ :=
    List.mem_map.mp mappedMember
  obtain ⟨cost, candidate⟩ := outcome
  simp only at targetEq
  subst candidate
  obtain ⟨walk, countLe, costEq, nodup⟩ :=
    simpleWeightedTracePathOutcomesList_sound Independent zeroSwapCost
      source.permutations.toFinset.card source outcomeMember
  exact (walk.toWeightedTracePath.toTraceCertificate
    Independent zeroSwapCost).toTraceEquivalent Independent zeroSwapCost

theorem reachableTraceVerticesList_complete
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source target : List Edit)
    (equivalent : TraceEquivalent Independent source target) :
    target ∈ reachableTraceVerticesList Independent source := by
  obtain ⟨count, path⟩ :=
    Sprawlens.ReachableTraceClass.TraceEquivalent.exists_zeroWeightedTracePath
      Independent equivalent
  obtain ⟨walk, countEq, costEq⟩ :=
    WeightedTraceWalk.exists_of_weightedTracePath
      Independent zeroSwapCost path
  obtain ⟨simple, simpleNodup, simpleCostLe, simpleSubset⟩ :=
    walk.exists_loopErased Independent zeroSwapCost
      (zeroSwapCost_nonnegative Independent)
  have simpleCountLe :
      simple.count ≤ source.permutations.toFinset.card :=
    Nat.le_of_lt (simple.count_lt_uniquePermutations_of_nodup
      Independent zeroSwapCost simpleNodup)
  have outcomeMember : (simple.cost, target) ∈
      simpleWeightedTracePathOutcomesList Independent zeroSwapCost
        source.permutations.toFinset.card source :=
    simpleWeightedTracePathOutcomesList_complete Independent zeroSwapCost
      simple simpleCountLe simpleNodup
  have mappedMember : target ∈
      (simpleWeightedTracePathOutcomesList Independent zeroSwapCost
        source.permutations.toFinset.card source).map Prod.snd :=
    List.mem_map.mpr ⟨(simple.cost, target), outcomeMember, rfl⟩
  simpa [reachableTraceVerticesList] using mappedMember

theorem mem_reachableTraceVerticesList_iff
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source target : List Edit) :
    target ∈ reachableTraceVerticesList Independent source ↔
      TraceEquivalent Independent source target := by
  exact ⟨reachableTraceVerticesList_sound Independent source target,
    reachableTraceVerticesList_complete Independent source target⟩

/-- Equivalent starting representatives define the same reachable class as
a set, even though the deterministic enumeration order may differ. -/
theorem reachableTraceVerticesList_membership_congr
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second)
    (target : List Edit) :
    target ∈ reachableTraceVerticesList Independent first ↔
      target ∈ reachableTraceVerticesList Independent second := by
  rw [mem_reachableTraceVerticesList_iff,
    mem_reachableTraceVerticesList_iff]
  exact ⟨fun firstToTarget => equivalent.symm.trans firstToTarget,
    fun secondToTarget => equivalent.trans secondToTarget⟩

/-- Consequently the two duplicate-free enumerations are permutations of
one another. This avoids claiming that their incidental DFS order is equal. -/
theorem reachableTraceVerticesList_perm_of_traceEquivalent
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) :
    (reachableTraceVerticesList Independent first).Perm
      (reachableTraceVerticesList Independent second) := by
  apply (List.perm_ext_iff_of_nodup
    (reachableTraceVerticesList_nodup Independent first)
    (reachableTraceVerticesList_nodup Independent second)).mpr
  intro target
  exact reachableTraceVerticesList_membership_congr
    Independent equivalent target

/-- The reachable-class cardinality used by search and error bounds is
invariant under the choice of an equivalent source representative. -/
theorem reachableTraceVerticesList_length_eq_of_traceEquivalent
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) :
    (reachableTraceVerticesList Independent first).length =
      (reachableTraceVerticesList Independent second).length :=
  (reachableTraceVerticesList_perm_of_traceEquivalent
    Independent equivalent).length_eq

/-- Every intermediate vertex of a sequential walk is reachable from the
walk's source, not merely a syntactic permutation of it. -/
theorem WeightedTraceWalk.vertex_traceEquivalent_first
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {first target vertex : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (member : vertex ∈ walk.vertices) :
    TraceEquivalent Independent first vertex := by
  induction walk with
  | nil current =>
      simp at member
      subst vertex
      exact .refl current
  | @cons first second target stepCost edge rest inductionHypothesis =>
      rcases List.mem_cons.mp member with vertexEq | tailMember
      · subst vertex
        exact .refl first
      · exact (edge.toTraceCertificate Independent swapCost
          |>.toTraceEquivalent Independent swapCost).trans
            (inductionHypothesis tailMember)

/-- A duplicate-free walk has fewer edges than the exact number of traces
reachable by the declared independence swaps. -/
theorem WeightedTraceWalk.count_lt_reachableTraceVerticesList_of_nodup
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {first target : List Edit}
    (walk : WeightedTraceWalk Independent swapCost first target)
    (nodup : walk.vertices.Nodup) :
    walk.count < (reachableTraceVerticesList Independent first).length := by
  have subset : walk.vertices ⊆
      reachableTraceVerticesList Independent first := by
    intro vertex member
    exact reachableTraceVerticesList_complete Independent first vertex
      (Sprawlens.ReachableTraceClass.WeightedTraceWalk.vertex_traceEquivalent_first
        Independent swapCost walk member)
  have lengthLe := nodup.length_le_of_subset subset
  rw [walk.vertices_length] at lengthLe
  omega

/-- Loop erasure with the exact reachable-class cardinality as its path
length bound. -/
theorem TraceCertificate.exists_simpleWeightedTracePath_of_nonnegative_reachableBound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (primitiveNonneg : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    {cost : ℝ} {first target : List Edit}
    (certificate : TraceCertificate Independent swapCost
      cost first target) :
    ∃ simpleCount simpleCost,
      simpleCount < (reachableTraceVerticesList Independent first).length ∧
      WeightedTracePath Independent swapCost
        simpleCount simpleCost first target ∧
      simpleCost ≤ cost := by
  obtain ⟨count, path⟩ :=
    Sprawlens.PositiveCostAttainment.TraceCertificate.exists_weightedTracePath
      Independent swapCost certificate
  obtain ⟨walk, countEq, costEq⟩ :=
    WeightedTraceWalk.exists_of_weightedTracePath
      Independent swapCost path
  obtain ⟨simple, simpleNodup, simpleCostLe, simpleSubset⟩ :=
    walk.exists_loopErased Independent swapCost primitiveNonneg
  exact ⟨simple.count, simple.cost,
    Sprawlens.ReachableTraceClass.WeightedTraceWalk.count_lt_reachableTraceVerticesList_of_nodup
      Independent swapCost simple simpleNodup,
    simple.toWeightedTracePath,
    simpleCostLe.trans_eq costEq⟩

theorem source_mem_reachableTraceVerticesList
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) :
    source ∈ reachableTraceVerticesList Independent source :=
  reachableTraceVerticesList_complete Independent source source (.refl source)

theorem reachableTraceVerticesList_length_pos
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) :
    0 < (reachableTraceVerticesList Independent source).length :=
  List.length_pos_iff_ne_nil.mpr
    (List.ne_nil_of_mem
      (source_mem_reachableTraceVerticesList Independent source))

theorem reachableTraceVerticesList_length_le_uniquePermutations
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) :
    (reachableTraceVerticesList Independent source).length ≤
      source.permutations.toFinset.card := by
  let reachable := reachableTraceVerticesList Independent source
  have subset : reachable.toFinset ⊆ source.permutations.toFinset := by
    intro target targetMember
    simp only [List.mem_toFinset] at targetMember ⊢
    have equivalent :=
      reachableTraceVerticesList_sound Independent source target targetMember
    exact List.mem_permutations.mpr
      (Sprawlens.NonnegativeCostAttainment.TraceEquivalent.perm
        Independent equivalent).symm
  have cardLe := Finset.card_le_card subset
  rwa [List.toFinset_card_of_nodup
    (reachableTraceVerticesList_nodup Independent source)] at cardLe

end Sprawlens.ReachableTraceClass
