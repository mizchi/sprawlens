import Sprawlens.PathwiseApproximationChain

namespace Sprawlens.PathwiseUniformDominance

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PathwiseTargetReliability
open PositiveCostAttainment
open ReachableTraceClass
open TargetReliabilityClassification

universe u

/-- A local error-cost function has a uniform upper envelope on every
admissible primitive swap. -/
def PrimitiveErrorCostBound {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    errorCost before after first second ≤ epsilon

theorem primitiveErrorCostBound_zero
    {Edit : Type u} (Independent : Edit → Edit → Prop) :
    PrimitiveErrorCostBound Independent
      (PathwiseApproximationChain.zeroPrimitiveErrorCost (Edit := Edit)) 0 := by
  intro before after first second independent
  rfl

theorem primitiveErrorCostBound_add
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (firstError secondError :
      List Edit → List Edit → Edit → Edit → ℝ)
    (firstEpsilon secondEpsilon : ℝ)
    (firstBound : PrimitiveErrorCostBound
      Independent firstError firstEpsilon)
    (secondBound : PrimitiveErrorCostBound
      Independent secondError secondEpsilon) :
    PrimitiveErrorCostBound Independent
      (PathwiseTargetReliability.addPrimitiveErrorCost
        firstError secondError)
      (firstEpsilon + secondEpsilon) := by
  intro before after first second independent
  exact add_le_add
    (firstBound before after first second independent)
    (secondBound before after first second independent)

/-- A non-uniform endpoint contract plus a uniform envelope recovers the
corresponding uniform endpoint contract. -/
theorem PrimitiveSwapCostWithinBy.toWithin_of_errorBound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon) :
    PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon := by
  intro before after first second independent
  exact le_trans
    (within before after first second independent)
    (bounded before after first second independent)

theorem WeightedSwapStep.cost_le_of_errorBound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    {edgeCost : ℝ} {first target : List Edit}
    (edge : WeightedSwapStep Independent errorCost
      edgeCost first target) :
    edgeCost ≤ epsilon := by
  cases edge with
  | forward before after left right independent =>
      exact bounded before after left right independent
  | backward before after left right independent =>
      exact bounded before after left right independent

/-- The accumulated local error on a concrete path is bounded by its actual
edge count, not by the size of the whole reachable class. -/
theorem WeightedTracePath.cost_le_count_mul_of_errorBound
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    {count : Nat} {pathError : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent errorCost
      count pathError source target) :
    pathError ≤ (count : ℝ) * epsilon := by
  induction path with
  | refl edits => simp
  | @step count edgeCost tailCost first second target edge rest
      inductionHypothesis =>
      calc
        edgeCost + tailCost ≤ epsilon + (count : ℝ) * epsilon :=
          add_le_add
            (WeightedSwapStep.cost_le_of_errorBound
              Independent errorCost epsilon bounded edge)
            inductionHypothesis
        _ = ((count + 1 : Nat) : ℝ) * epsilon := by
          push_cast
          ring

/-- A simple path's concrete error is no larger than the previous uniform
reachable-class envelope. -/
theorem WeightedTracePath.cost_le_reachableClass_mul_of_errorBound
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    {count : Nat} {pathError : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent errorCost
      count pathError source target)
    (countLt : count <
      (reachableTraceVerticesList Independent source).length) :
    pathError ≤
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon := by
  have countLe :
      (count : ℝ) ≤
        ((reachableTraceVerticesList Independent source).length : ℝ) := by
    exact_mod_cast Nat.le_of_lt countLt
  exact le_trans
    (WeightedTracePath.cost_le_count_mul_of_errorBound
      Independent errorCost epsilon bounded path)
    (mul_le_mul_of_nonneg_right countLe epsilonNonnegative)

/-- The sum of the two concrete path errors used by a two-sided certificate
is bounded by its old `2 * reachable-class-size * epsilon` envelope. -/
theorem twoPathErrors_le_two_reachableClass_mul
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    {selectedCount bestCount : Nat}
    {selectedError bestError : ℝ}
    {source selectedTarget bestTarget : List Edit}
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
    WeightedTracePath.cost_le_reachableClass_mul_of_errorBound
      Independent errorCost epsilon epsilonNonnegative bounded
      selectedPath selectedCountLt
  have bestBound :=
    WeightedTracePath.cost_le_reachableClass_mul_of_errorBound
      Independent errorCost epsilon epsilonNonnegative bounded
      bestPath bestCountLt
  linarith

theorem onePathError_lt_margin_of_uniformMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon margin : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    {count : Nat} {pathError : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent errorCost
      count pathError source target)
    (countLt : count <
      (reachableTraceVerticesList Independent source).length)
    (uniformMargin :
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < margin) :
    pathError < margin :=
  lt_of_le_of_lt
    (WeightedTracePath.cost_le_reachableClass_mul_of_errorBound
      Independent errorCost epsilon epsilonNonnegative bounded path countLt)
    uniformMargin

theorem twoPathErrors_lt_margin_of_uniformMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (errorCost : List Edit → List Edit → Edit → Edit → ℝ)
    (epsilon margin : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    {selectedCount bestCount : Nat}
    {selectedError bestError : ℝ}
    {source selectedTarget bestTarget : List Edit}
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
    (twoPathErrors_le_two_reachableClass_mul
      Independent errorCost epsilon epsilonNonnegative bounded
      selectedPath bestPath selectedCountLt bestCountLt)
    uniformMargin

/-- The implication is genuinely one-way: an instance-specific pathwise
criterion may pass even when the reachable-class uniform criterion fails. -/
theorem pathwiseMargin_can_hold_when_twoSidedUniformMargin_fails :
    ∃ selectedError bestError epsilon margin : ℝ,
      0 ≤ epsilon ∧
      selectedError + bestError < margin ∧
      ¬2 * (2 : ℝ) * epsilon < margin := by
  exact ⟨0, 0, 1, 1, by norm_num, by norm_num, by norm_num⟩

/-- The old two-sided uniform margin rule factors through the sharper
pathwise certificate: the actual two error paths are first bounded, then the
pathwise target implication is applied. -/
theorem competingClassification_target_stable_of_twoSidedErrorEnvelope
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (uniformMargin :
      2 * ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (selectedApproximateCost, result.bestTarget) ∧
        selectedCount <
          (reachableTraceVerticesList Independent source).length ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source result.bestTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source result.bestTarget := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedError, selectedTarget,
      bestCount, bestExactCost, bestApproximateCost, bestError,
      searchEq, selectedNormal, selectedCountLt,
      selectedApproximatePath, selectedExactPath, selectedErrorPath,
      bestExactPath, bestApproximatePath, bestErrorPath, bestCountLt,
      bestCostLe, selectedCostLe, stable⟩ :=
    competingClassification_twoSidedPathwiseCertificate
      Independent exactCost approximateCost errorCost Normal within
      exactNonnegative approximateNonnegative source classified
  have errorBelowMargin :=
    twoPathErrors_lt_margin_of_uniformMargin
      Independent errorCost epsilon result.margin epsilonNonnegative bounded
      selectedErrorPath bestErrorPath selectedCountLt bestCountLt
      uniformMargin
  have targetEq := stable errorBelowMargin
  subst selectedTarget
  exact ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    searchEq, selectedCountLt, selectedApproximatePath, selectedExactPath⟩

/-- Overestimation factors through only the concrete exact-best error path. -/
theorem competingClassification_target_stable_of_overestimateErrorEnvelope
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (uniformMargin :
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (selectedApproximateCost, result.bestTarget) ∧
        selectedCount <
          (reachableTraceVerticesList Independent source).length ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source result.bestTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source result.bestTarget := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedTarget, bestCount, bestExactCost, bestApproximateCost,
      bestError, searchEq, selectedNormal, selectedCountLt,
      selectedApproximatePath, selectedExactPath, bestExactPath,
      bestApproximatePath, bestErrorPath, bestCountLt,
      bestCostLe, selectedCostLe, stable⟩ :=
    competingClassification_overestimatePathwiseCertificate
      Independent exactCost approximateCost errorCost Normal within
      overestimate exactNonnegative approximateNonnegative source classified
  have errorBelowMargin :=
    onePathError_lt_margin_of_uniformMargin
      Independent errorCost epsilon result.margin epsilonNonnegative bounded
      bestErrorPath bestCountLt uniformMargin
  have targetEq := stable errorBelowMargin
  subst selectedTarget
  exact ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    searchEq, selectedCountLt, selectedApproximatePath, selectedExactPath⟩

/-- Underestimation factors through only the approximate-selected error
path. -/
theorem competingClassification_target_stable_of_underestimateErrorEnvelope
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost errorCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithinBy
      Independent exactCost approximateCost errorCost)
    (bounded : PrimitiveErrorCostBound
      Independent errorCost epsilon)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (uniformMargin :
      ((reachableTraceVerticesList Independent source).length : ℝ) *
        epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (selectedApproximateCost, result.bestTarget) ∧
        selectedCount <
          (reachableTraceVerticesList Independent source).length ∧
        WeightedTracePath Independent approximateCost
          selectedCount selectedApproximateCost source result.bestTarget ∧
        WeightedTracePath Independent exactCost
          selectedCount selectedExactCost source result.bestTarget := by
  obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
      selectedError, selectedTarget, searchEq, selectedNormal,
      selectedCountLt, selectedApproximatePath, selectedExactPath,
      selectedErrorPath, selectedCostLe, stable⟩ :=
    competingClassification_underestimatePathwiseCertificate
      Independent exactCost approximateCost errorCost Normal within
      underestimate exactNonnegative approximateNonnegative source classified
  have errorBelowMargin :=
    onePathError_lt_margin_of_uniformMargin
      Independent errorCost epsilon result.margin epsilonNonnegative bounded
      selectedErrorPath selectedCountLt uniformMargin
  have targetEq := stable errorBelowMargin
  subst selectedTarget
  exact ⟨selectedCount, selectedApproximateCost, selectedExactCost,
    searchEq, selectedCountLt, selectedApproximatePath, selectedExactPath⟩

end Sprawlens.PathwiseUniformDominance
