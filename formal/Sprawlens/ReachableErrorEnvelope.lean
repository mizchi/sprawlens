import Sprawlens.PathwiseNontrivialImprovementWitness

namespace Sprawlens.ReachableErrorEnvelope

open LayoutConfluence
open PathwiseNontrivialImprovementWitness
open PathwiseTargetReliability
open PathwiseUniformDominance
open PositiveCostAttainment
open ReachableTraceClass

universe u

/-- A uniform error envelope restricted to primitive contexts reachable from
one root trace. The canonical context is the forward orientation; a backward
edge reaches it by reversing the same primitive swap. -/
def ReachablePrimitiveErrorCostBound {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (root : List Edit) (epsilon : ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    TraceEquivalent Independent root
      (before ++ first :: second :: after) →
    errorCost before after first second ≤ epsilon

theorem primitiveErrorCostBound_restrictsToReachable
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (root : List Edit) (epsilon : ℝ)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon) :
    ReachablePrimitiveErrorCostBound
      Independent errorCost root epsilon := by
  intro before after first second independent reachable
  exact bounded before after first second independent

theorem reachablePrimitiveErrorCostBound_zero
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (root : List Edit) :
    ReachablePrimitiveErrorCostBound Independent
      (PathwiseApproximationChain.zeroPrimitiveErrorCost (Edit := Edit))
      root 0 := by
  intro before after first second independent reachable
  rfl

theorem reachablePrimitiveErrorCostBound_add
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstError secondError :
      List Edit → List Edit → Edit → Edit → ℝ)
    (root : List Edit) (firstEpsilon secondEpsilon : ℝ)
    (firstBound : ReachablePrimitiveErrorCostBound
      Independent firstError root firstEpsilon)
    (secondBound : ReachablePrimitiveErrorCostBound
      Independent secondError root secondEpsilon) :
    ReachablePrimitiveErrorCostBound Independent
      (addPrimitiveErrorCost firstError secondError)
      root (firstEpsilon + secondEpsilon) := by
  intro before after first second independent reachable
  exact add_le_add
    (firstBound before after first second independent reachable)
    (secondBound before after first second independent reachable)

theorem WeightedSwapStep.cost_le_of_reachableErrorBound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (root : List Edit) (epsilon : ℝ)
    (bounded : ReachablePrimitiveErrorCostBound
      Independent errorCost root epsilon)
    {edgeCost : ℝ} {first target : List Edit}
    (firstReachable : TraceEquivalent Independent root first)
    (edge : WeightedSwapStep Independent errorCost
      edgeCost first target) :
    edgeCost ≤ epsilon := by
  cases edge with
  | forward before after left right independent =>
      exact bounded before after left right independent firstReachable
  | backward before after left right independent =>
      have canonicalReachable := firstReachable.trans
        (TraceEquivalent.swap before after left right independent).symm
      exact bounded before after left right independent canonicalReachable

/-- Every edge in a concrete path is reachable from the root through its
prefix, so a reachable-local envelope still bounds the accumulated error by
the actual path length. -/
theorem WeightedTracePath.cost_le_count_mul_of_reachableErrorBound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (root : List Edit) (epsilon : ℝ)
    (bounded : ReachablePrimitiveErrorCostBound
      Independent errorCost root epsilon)
    {count : Nat} {pathError : ℝ} {source target : List Edit}
    (sourceReachable : TraceEquivalent Independent root source)
    (path : WeightedTracePath Independent errorCost
      count pathError source target) :
    pathError ≤ (count : ℝ) * epsilon := by
  induction path with
  | refl edits => simp
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      have edgeBound := WeightedSwapStep.cost_le_of_reachableErrorBound
        Independent errorCost root epsilon bounded sourceReachable edge
      have nextReachable : TraceEquivalent Independent root second :=
        sourceReachable.trans
          ((edge.toTraceCertificate Independent errorCost).toTraceEquivalent
            Independent errorCost)
      have tailBound := inductionHypothesis nextReachable
      calc
        edgeCost + tailCost ≤ epsilon + (count : ℝ) * epsilon :=
          add_le_add edgeBound tailBound
        _ = ((count + 1 : Nat) : ℝ) * epsilon := by
          push_cast
          ring

theorem WeightedTracePath.cost_le_reachableClass_mul_of_reachableErrorBound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    {source : List Edit}
    (bounded : ReachablePrimitiveErrorCostBound
      Independent errorCost source epsilon)
    {count : Nat} {pathError : ℝ} {target : List Edit}
    (path : WeightedTracePath Independent errorCost
      count pathError source target)
    (countLt : count <
      (reachableTraceVerticesList Independent source).length) :
    pathError ≤
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon := by
  have pathBound :=
    WeightedTracePath.cost_le_count_mul_of_reachableErrorBound
      Independent errorCost source epsilon bounded
      (.refl source) path
  have countLe :
      (count : ℝ) ≤
        ((reachableTraceVerticesList Independent source).length : ℝ) := by
    exact_mod_cast Nat.le_of_lt countLt
  exact le_trans pathBound
    (mul_le_mul_of_nonneg_right countLe epsilonNonnegative)

theorem twoPathErrors_le_two_reachableClass_mul_of_reachableErrorBound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    {source : List Edit}
    (bounded : ReachablePrimitiveErrorCostBound
      Independent errorCost source epsilon)
    {selectedCount bestCount : Nat}
    {selectedError bestError : ℝ}
    {selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent errorCost
      selectedCount selectedError source selectedTarget)
    (bestPath : WeightedTracePath Independent errorCost
      bestCount bestError source bestTarget)
    (selectedCountLt : selectedCount <
      (reachableTraceVerticesList Independent source).length)
    (bestCountLt : bestCount <
      (reachableTraceVerticesList Independent source).length) :
    selectedError + bestError ≤
      2 * ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon := by
  have selectedBound :=
    WeightedTracePath.cost_le_reachableClass_mul_of_reachableErrorBound
      Independent errorCost epsilon epsilonNonnegative bounded
      selectedPath selectedCountLt
  have bestBound :=
    WeightedTracePath.cost_le_reachableClass_mul_of_reachableErrorBound
      Independent errorCost epsilon epsilonNonnegative bounded
      bestPath bestCountLt
  linarith

theorem onePathError_lt_margin_of_reachableUniformMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon margin : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    {source : List Edit}
    (bounded : ReachablePrimitiveErrorCostBound
      Independent errorCost source epsilon)
    {count : Nat} {pathError : ℝ} {target : List Edit}
    (path : WeightedTracePath Independent errorCost
      count pathError source target)
    (countLt : count <
      (reachableTraceVerticesList Independent source).length)
    (uniformMargin :
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < margin) :
    pathError < margin :=
  lt_of_le_of_lt
    (WeightedTracePath.cost_le_reachableClass_mul_of_reachableErrorBound
      Independent errorCost epsilon epsilonNonnegative bounded path countLt)
    uniformMargin

theorem twoPathErrors_lt_margin_of_reachableUniformMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon margin : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    {source : List Edit}
    (bounded : ReachablePrimitiveErrorCostBound
      Independent errorCost source epsilon)
    {selectedCount bestCount : Nat}
    {selectedError bestError : ℝ}
    {selectedTarget bestTarget : List Edit}
    (selectedPath : WeightedTracePath Independent errorCost
      selectedCount selectedError source selectedTarget)
    (bestPath : WeightedTracePath Independent errorCost
      bestCount bestError source bestTarget)
    (selectedCountLt : selectedCount <
      (reachableTraceVerticesList Independent source).length)
    (bestCountLt : bestCount <
      (reachableTraceVerticesList Independent source).length)
    (uniformMargin :
      2 * ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < margin) :
    selectedError + bestError < margin :=
  lt_of_le_of_lt
    (twoPathErrors_le_two_reachableClass_mul_of_reachableErrorBound
      Independent errorCost epsilon epsilonNonnegative bounded
      selectedPath bestPath selectedCountLt bestCountLt)
    uniformMargin

/-- In the nontrivial witness, every context reachable from the three-edit
source has length three. Therefore the deliberately longer error context is
excluded and the tight reachable envelope is zero. -/
theorem nontrivialErrorCost_reachableBound_zero :
    ReachablePrimitiveErrorCostBound NontrivialIndependent
      nontrivialErrorCost nontrivialSource 0 := by
  intro before after left right independent reachable
  by_cases longPrefix :
      before = [NontrivialEdit.first, .second, .third]
  · subst before
    have permutation :=
      Sprawlens.NonnegativeCostAttainment.TraceEquivalent.perm
        NontrivialIndependent reachable
    have lengthEq := permutation.length_eq
    simp [nontrivialSource] at lengthEq
  · simp [nontrivialErrorCost, longPrefix]

/-- The witness separates global from source-reachable uniform envelopes:
zero is valid locally but impossible globally. -/
theorem nontrivial_reachableEnvelope_strictly_better_than_global :
    ReachablePrimitiveErrorCostBound NontrivialIndependent
        nontrivialErrorCost nontrivialSource 0 ∧
      ¬PrimitiveErrorCostBound
        NontrivialIndependent nontrivialErrorCost 0 := by
  refine ⟨nontrivialErrorCost_reachableBound_zero, ?_⟩
  intro globalZero
  have lower := nontrivial_errorEnvelope_at_least_one globalZero
  norm_num at lower

theorem nontrivial_reachableUniformMargins_hold :
    2 *
          ((reachableTraceVerticesList
            NontrivialIndependent nontrivialSource).length : ℝ) * 0 <
        nontrivialMarginResult.margin ∧
      ((reachableTraceVerticesList
          NontrivialIndependent nontrivialSource).length : ℝ) * 0 <
        nontrivialMarginResult.margin := by
  rw [nontrivial_reachableTraceVerticesList_length]
  norm_num [nontrivialMarginResult]

/-- Consequently the nonzero best error path is also certified by the
reachable-local uniform route with exact bound zero. -/
theorem nontrivial_bestErrorPath_le_reachableEnvelope :
    (0 : ℝ) ≤
      ((reachableTraceVerticesList
        NontrivialIndependent nontrivialSource).length : ℝ) * 0 := by
  exact WeightedTracePath.cost_le_reachableClass_mul_of_reachableErrorBound
    NontrivialIndependent nontrivialErrorCost 0 (by norm_num)
    nontrivialErrorCost_reachableBound_zero
    nontrivial_bestErrorPath (by
      rw [nontrivial_reachableTraceVerticesList_length]
      omega)

end Sprawlens.ReachableErrorEnvelope
