import Sprawlens.ClassifiedApproximateReliability

namespace Sprawlens.TargetRobustnessRadius

open ApproximateWeightedNormalization
open ClassifiedApproximateReliability
open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment
open ReachableTraceClass
open TargetMarginSemantics
open TargetReliabilityClassification

universe u

/-- Exact finite reachable-state cardinality, embedded in the cost field. -/
noncomputable def reachableClassSizeReal
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) : ℝ :=
  (reachableTraceVerticesList Independent source).length

theorem reachableClassSizeReal_pos
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) :
    0 < reachableClassSizeReal Independent source := by
  unfold reachableClassSizeReal
  exact_mod_cast reachableTraceVerticesList_length_pos Independent source

/-- Largest open per-edge error radius certified by the general two-sided
path comparison. Equality is deliberately excluded by the stability theorem. -/
noncomputable def twoSidedTargetRobustnessRadius
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) : ℝ :=
  margin / (2 * reachableClassSizeReal Independent source)

/-- Per-edge radius when approximation errors are pointwise one-sided. -/
noncomputable def oneSidedTargetRobustnessRadius
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) : ℝ :=
  margin / reachableClassSizeReal Independent source

theorem epsilon_lt_twoSidedTargetRobustnessRadius_iff
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin epsilon : ℝ) :
    epsilon < twoSidedTargetRobustnessRadius
        Independent source margin ↔
      2 * reachableClassSizeReal Independent source * epsilon < margin := by
  have denominatorPositive :
      0 < 2 * reachableClassSizeReal Independent source :=
    mul_pos (by norm_num) (reachableClassSizeReal_pos Independent source)
  unfold twoSidedTargetRobustnessRadius
  rw [lt_div_iff₀ denominatorPositive]
  ring_nf

theorem epsilon_lt_oneSidedTargetRobustnessRadius_iff
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin epsilon : ℝ) :
    epsilon < oneSidedTargetRobustnessRadius
        Independent source margin ↔
      reachableClassSizeReal Independent source * epsilon < margin := by
  have denominatorPositive := reachableClassSizeReal_pos Independent source
  unfold oneSidedTargetRobustnessRadius
  rw [lt_div_iff₀ denominatorPositive]
  ring_nf

theorem twoSidedTargetRobustnessRadius_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) (marginNonnegative : 0 ≤ margin) :
    0 ≤ twoSidedTargetRobustnessRadius Independent source margin := by
  unfold twoSidedTargetRobustnessRadius
  exact div_nonneg marginNonnegative
    (mul_nonneg (by norm_num)
      (reachableClassSizeReal_pos Independent source).le)

theorem oneSidedTargetRobustnessRadius_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) (marginNonnegative : 0 ≤ margin) :
    0 ≤ oneSidedTargetRobustnessRadius Independent source margin := by
  unfold oneSidedTargetRobustnessRadius
  exact div_nonneg marginNonnegative
    (reachableClassSizeReal_pos Independent source).le

theorem twoSidedTargetRobustnessRadius_pos_iff_margin_pos
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) :
    0 < twoSidedTargetRobustnessRadius Independent source margin ↔
      0 < margin := by
  let denominator := 2 * reachableClassSizeReal Independent source
  have denominatorPositive : 0 < denominator :=
    mul_pos (by norm_num) (reachableClassSizeReal_pos Independent source)
  have denominatorNe : denominator ≠ 0 := ne_of_gt denominatorPositive
  constructor
  · intro radiusPositive
    have productPositive :
        0 < (margin / denominator) * denominator :=
      mul_pos radiusPositive denominatorPositive
    simpa [denominator, twoSidedTargetRobustnessRadius,
      div_mul_cancel₀ margin denominatorNe] using productPositive
  · intro marginPositive
    exact div_pos marginPositive denominatorPositive

theorem oneSidedTargetRobustnessRadius_pos_iff_margin_pos
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) :
    0 < oneSidedTargetRobustnessRadius Independent source margin ↔
      0 < margin := by
  let denominator := reachableClassSizeReal Independent source
  have denominatorPositive : 0 < denominator :=
    reachableClassSizeReal_pos Independent source
  have denominatorNe : denominator ≠ 0 := ne_of_gt denominatorPositive
  constructor
  · intro radiusPositive
    have productPositive :
        0 < (margin / denominator) * denominator :=
      mul_pos radiusPositive denominatorPositive
    simpa [denominator, oneSidedTargetRobustnessRadius,
      div_mul_cancel₀ margin denominatorNe] using productPositive
  · intro marginPositive
    exact div_pos marginPositive denominatorPositive

/-- One-sided information doubles the certified per-edge radius exactly. -/
theorem oneSidedTargetRobustnessRadius_eq_two_mul_twoSided
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (source : List Edit) (margin : ℝ) :
    oneSidedTargetRobustnessRadius Independent source margin =
      2 * twoSidedTargetRobustnessRadius Independent source margin := by
  have sizeNe : reachableClassSizeReal Independent source ≠ 0 :=
    ne_of_gt (reachableClassSizeReal_pos Independent source)
  unfold oneSidedTargetRobustnessRadius twoSidedTargetRobustnessRadius
  field_simp [sizeNe]

/-- For a classified competing result, positive certified radius is exactly
objective-level uniqueness of the best target. -/
theorem competingTwoSidedRadius_pos_iff_uniqueOptimalTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent swapCost Normal
      source = .competingNormalTargets result) :
    0 < twoSidedTargetRobustnessRadius
        Independent source result.margin ↔
      HasUniqueOptimalTarget Independent swapCost Normal source
        result.bestCost result.bestTarget := by
  rw [twoSidedTargetRobustnessRadius_pos_iff_margin_pos,
    competingMargin_pos_iff_uniqueOptimalTarget
      Independent swapCost Normal primitiveNonnegative source classified]

/-- Radius-form end-to-end two-sided reliability theorem. -/
theorem competingClassification_target_stable_within_twoSidedRadius
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (withinRadius : epsilon < twoSidedTargetRobustnessRadius
      Independent source result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  apply competingClassification_target_stable_of_twoSidedMargin
    Independent exactCost approximateCost Normal epsilon
    epsilonNonnegative within exactNonnegative approximateNonnegative
    source classified
  simpa [reachableClassSizeReal] using
    (epsilon_lt_twoSidedTargetRobustnessRadius_iff
      Independent source result.margin epsilon).mp withinRadius

/-- Radius-form end-to-end reliability for pointwise overestimates. -/
theorem competingClassification_target_stable_within_overestimateRadius
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (overestimate : PrimitiveSwapCostLe
      Independent exactCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (withinRadius : epsilon < oneSidedTargetRobustnessRadius
      Independent source result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  apply competingClassification_target_stable_of_overestimateMargin
    Independent exactCost approximateCost Normal epsilon
    epsilonNonnegative within overestimate exactNonnegative
    approximateNonnegative source classified
  simpa [reachableClassSizeReal] using
    (epsilon_lt_oneSidedTargetRobustnessRadius_iff
      Independent source result.margin epsilon).mp withinRadius

/-- Radius-form end-to-end reliability for pointwise underestimates. -/
theorem competingClassification_target_stable_within_underestimateRadius
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within : PrimitiveSwapCostWithin
      Independent exactCost approximateCost epsilon)
    (underestimate : PrimitiveSwapCostLe
      Independent approximateCost exactCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (classified : classifyTargetReliability Independent exactCost Normal
      source = .competingNormalTargets result)
    (withinRadius : epsilon < oneSidedTargetRobustnessRadius
      Independent source result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (reachableTraceVerticesList Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  apply competingClassification_target_stable_of_underestimateMargin
    Independent exactCost approximateCost Normal epsilon
    epsilonNonnegative within underestimate exactNonnegative
    approximateNonnegative source classified
  simpa [reachableClassSizeReal] using
    (epsilon_lt_oneSidedTargetRobustnessRadius_iff
      Independent source result.margin epsilon).mp withinRadius

end Sprawlens.TargetRobustnessRadius
