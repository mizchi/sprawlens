import Sprawlens.CostCalibrationInvariant

namespace Sprawlens.NormalTargetMargin

open DijkstraInvariant
open PositiveCostAttainment

universe u

/-- Accept every original normal target except one selected representative. -/
def OtherNormal {Edit : Type u}
    (Normal : List Edit → Prop) (excluded target : List Edit) : Prop :=
  Normal target ∧ target ≠ excluded

instance otherNormalDecidablePred
    {Edit : Type u} [DecidableEq Edit]
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (excluded : List Edit) :
    DecidablePred (OtherNormal Normal excluded) := by
  intro target
  unfold OtherNormal
  infer_instance

/-- A reusable exact separation contract for target identity. -/
def TargetSeparatedBy {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) (source : List Edit)
    (bestCost : ℝ) (bestTarget : List Edit) (margin : ℝ) : Prop :=
  ∀ {otherCount otherCost otherTarget},
    Normal otherTarget →
    WeightedTracePath Independent swapCost
      otherCount otherCost source otherTarget →
    otherTarget ≠ bestTarget →
    bestCost + margin ≤ otherCost

/-- Re-run verified Dijkstra after excluding the best target. -/
noncomputable def dijkstraSecondNormalTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source excluded : List Edit) : Option (ℝ × List Edit) :=
  dijkstraSearch Independent swapCost (OtherNormal Normal excluded) source

/-- Any returned second target is different from the excluded target and is
globally cheapest among every path to every other acceptable target. -/
theorem dijkstraSecondNormalTarget_some_spec
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source excluded : List Edit)
    {secondCost : ℝ} {secondTarget : List Edit}
    (searchEq : dijkstraSecondNormalTarget Independent swapCost Normal
      source excluded = some (secondCost, secondTarget)) :
    Normal secondTarget ∧ secondTarget ≠ excluded ∧
      ∃ secondCount,
        WeightedTracePath Independent swapCost
            secondCount secondCost source secondTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            otherTarget ≠ excluded →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            secondCost ≤ otherCost := by
  have rawEq : dijkstraSearch Independent swapCost
      (OtherNormal Normal excluded) source =
        some (secondCost, secondTarget) := by
    simpa [dijkstraSecondNormalTarget] using searchEq
  obtain ⟨secondOtherNormal, secondCount, secondPath, minimum⟩ :=
    dijkstraSearch_some_globalNormalizingMinimum Independent swapCost
      (OtherNormal Normal excluded) primitiveNonnegative source rawEq
  exact ⟨secondOtherNormal.1, secondOtherNormal.2, secondCount,
    secondPath, fun otherNormal otherDifferent otherPath =>
      minimum ⟨otherNormal, otherDifferent⟩ otherPath⟩

/-- `none` from the second-target search is a proof that no different normal
target has any path; it is not an inconclusive search failure. -/
theorem dijkstraSecondNormalTarget_eq_none_iff_no_otherNormalPath
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source excluded : List Edit) :
    dijkstraSecondNormalTarget Independent swapCost Normal
        source excluded = none ↔
      ¬∃ count cost target,
        Normal target ∧ target ≠ excluded ∧
        WeightedTracePath Independent swapCost
          count cost source target := by
  rw [dijkstraSecondNormalTarget,
    dijkstraSearch_eq_none_iff_no_normalPath
      Independent swapCost (OtherNormal Normal excluded)
      primitiveNonnegative source]
  simp only [OtherNormal]
  constructor
  · intro noPath
    rintro ⟨count, cost, target, normal, different, path⟩
    exact noPath ⟨count, cost, target, ⟨normal, different⟩, path⟩
  · intro noOther countCostTarget
    obtain ⟨count, cost, target, ⟨normal, different⟩, path⟩ :=
      countCostTarget
    exact noOther ⟨count, cost, target, normal, different, path⟩

/-- The best-to-second cost difference is a certified lower margin from the
best cost to every path ending at a different acceptable target. -/
theorem secondNormalTarget_marginCertificate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source bestTarget : List Edit) (bestCost : ℝ)
    {secondCost : ℝ} {secondTarget : List Edit}
    (searchEq : dijkstraSecondNormalTarget Independent swapCost Normal
      source bestTarget = some (secondCost, secondTarget)) :
    TargetSeparatedBy Independent swapCost Normal source
      bestCost bestTarget (secondCost - bestCost) := by
  obtain ⟨secondNormal, secondDifferent, secondCount,
      secondPath, secondMinimum⟩ :=
    dijkstraSecondNormalTarget_some_spec Independent swapCost Normal
      primitiveNonnegative source bestTarget searchEq
  intro otherCount otherCost otherTarget otherNormal otherPath otherDifferent
  have secondLe := secondMinimum otherNormal otherDifferent otherPath
  linarith

/-- When both searches return, the computed margin is nonnegative because
the first result is globally minimal even against the second target. -/
theorem secondNormalTarget_margin_nonnegative
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit)
    {bestCost secondCost : ℝ} {bestTarget secondTarget : List Edit}
    (bestEq : dijkstraSearch Independent swapCost Normal source =
      some (bestCost, bestTarget))
    (secondEq : dijkstraSecondNormalTarget Independent swapCost Normal
      source bestTarget = some (secondCost, secondTarget)) :
    0 ≤ secondCost - bestCost := by
  obtain ⟨bestNormal, bestCount, bestPath, bestMinimum⟩ :=
    dijkstraSearch_some_globalNormalizingMinimum Independent swapCost Normal
      primitiveNonnegative source bestEq
  obtain ⟨secondNormal, secondDifferent, secondCount,
      secondPath, secondMinimum⟩ :=
    dijkstraSecondNormalTarget_some_spec Independent swapCost Normal
      primitiveNonnegative source bestTarget secondEq
  have bestLeSecond := bestMinimum secondNormal secondPath
  linarith

structure TargetMarginResult (Edit : Type u) where
  bestCost : ℝ
  bestTarget : List Edit
  secondCost : ℝ
  secondTarget : List Edit
  margin : ℝ

/-- Compute the best and best-different-target results and expose their cost
difference. `none` means either no normal target or no second distinct target. -/
noncomputable def dijkstraTargetMargin?
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) : Option (TargetMarginResult Edit) :=
  match dijkstraSearch Independent swapCost Normal source with
  | none => none
  | some (bestCost, bestTarget) =>
      match dijkstraSecondNormalTarget Independent swapCost Normal
          source bestTarget with
      | none => none
      | some (secondCost, secondTarget) =>
          some {
            bestCost
            bestTarget
            secondCost
            secondTarget
            margin := secondCost - bestCost
          }

/-- A returned result is a complete proof-carrying target-margin instrument:
both paths exist, the first is globally optimal, the second is globally
optimal among distinct targets, and their nonnegative difference separates
the best target from every different target path. -/
theorem dijkstraTargetMargin?_some_spec
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (returned : dijkstraTargetMargin? Independent swapCost Normal source =
      some result) :
    Normal result.bestTarget ∧
      (∃ bestCount,
        WeightedTracePath Independent swapCost
            bestCount result.bestCost source result.bestTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            result.bestCost ≤ otherCost) ∧
      Normal result.secondTarget ∧
      result.secondTarget ≠ result.bestTarget ∧
      (∃ secondCount,
        WeightedTracePath Independent swapCost
            secondCount result.secondCost source result.secondTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            otherTarget ≠ result.bestTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            result.secondCost ≤ otherCost) ∧
      result.margin = result.secondCost - result.bestCost ∧
      TargetSeparatedBy Independent swapCost Normal source
        result.bestCost result.bestTarget result.margin ∧
      0 ≤ result.margin := by
  unfold dijkstraTargetMargin? at returned
  cases bestEq : dijkstraSearch Independent swapCost Normal source with
  | none => simp [bestEq] at returned
  | some best =>
      obtain ⟨bestCost, bestTarget⟩ := best
      cases secondEq : dijkstraSecondNormalTarget Independent swapCost Normal
          source bestTarget with
      | none => simp [bestEq, secondEq] at returned
      | some second =>
          obtain ⟨secondCost, secondTarget⟩ := second
          simp [bestEq, secondEq] at returned
          subst result
          obtain ⟨bestNormal, bestCount, bestPath, bestMinimum⟩ :=
            dijkstraSearch_some_globalNormalizingMinimum Independent swapCost
              Normal primitiveNonnegative source bestEq
          obtain ⟨secondNormal, secondDifferent, secondCount,
              secondPath, secondMinimum⟩ :=
            dijkstraSecondNormalTarget_some_spec Independent swapCost Normal
              primitiveNonnegative source bestTarget secondEq
          have marginCertificate :
              TargetSeparatedBy Independent swapCost Normal source
                bestCost bestTarget (secondCost - bestCost) :=
            secondNormalTarget_marginCertificate Independent swapCost Normal
              primitiveNonnegative source bestTarget bestCost secondEq
          have marginNonnegative := secondNormalTarget_margin_nonnegative
            Independent swapCost Normal primitiveNonnegative source
            bestEq secondEq
          exact ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
            secondNormal, secondDifferent,
            ⟨secondCount, secondPath, secondMinimum⟩,
            rfl, marginCertificate, marginNonnegative⟩

/-- End-to-end use of the instrument: if the computed exact best-to-second
target margin dominates the verified two-sided approximation budget, then
approximate Dijkstra returns the exact best target. -/
theorem approximateDijkstra_target_stable_of_computedMargin
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within :
      ApproximateWeightedNormalization.PrimitiveSwapCostWithin
        Independent exactCost approximateCost epsilon)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (marginResult : dijkstraTargetMargin? Independent exactCost Normal
      source = some result)
    (marginDominates :
      2 * ((ReachableTraceClass.reachableTraceVerticesList
        Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (ReachableTraceClass.reachableTraceVerticesList
          Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent,
      ⟨secondCount, secondPath, secondMinimum⟩,
      marginEq, separated, marginNonnegative⟩ :=
    dijkstraTargetMargin?_some_spec Independent exactCost Normal
      exactNonnegative source marginResult
  exact ApproximateWeightedNormalization.approximateDijkstra_target_stable_of_margin
    Independent exactCost approximateCost Normal epsilon result.margin
    epsilonNonnegative within exactNonnegative approximateNonnegative source
    bestNormal bestPath separated marginDominates

/-- Computed-margin specialization for a pointwise overestimate. -/
theorem approximateDijkstra_target_stable_of_computedMargin_overestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within :
      ApproximateWeightedNormalization.PrimitiveSwapCostWithin
        Independent exactCost approximateCost epsilon)
    (overestimate :
      ApproximateWeightedNormalization.PrimitiveSwapCostLe
        Independent exactCost approximateCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (marginResult : dijkstraTargetMargin? Independent exactCost Normal
      source = some result)
    (marginDominates :
      ((ReachableTraceClass.reachableTraceVerticesList
        Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (ReachableTraceClass.reachableTraceVerticesList
          Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent,
      ⟨secondCount, secondPath, secondMinimum⟩,
      marginEq, separated, marginNonnegative⟩ :=
    dijkstraTargetMargin?_some_spec Independent exactCost Normal
      exactNonnegative source marginResult
  exact ApproximateWeightedNormalization.approximateDijkstra_target_stable_of_overestimate_margin
    Independent exactCost approximateCost Normal epsilon result.margin
    epsilonNonnegative within overestimate exactNonnegative
    approximateNonnegative source bestNormal bestPath separated
    marginDominates

/-- Computed-margin specialization for a pointwise underestimate. -/
theorem approximateDijkstra_target_stable_of_computedMargin_underestimate
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (epsilon : ℝ) (epsilonNonnegative : 0 ≤ epsilon)
    (within :
      ApproximateWeightedNormalization.PrimitiveSwapCostWithin
        Independent exactCost approximateCost epsilon)
    (underestimate :
      ApproximateWeightedNormalization.PrimitiveSwapCostLe
        Independent approximateCost exactCost)
    (exactNonnegative : PrimitiveSwapCostLowerBound
      Independent exactCost 0)
    (approximateNonnegative : PrimitiveSwapCostLowerBound
      Independent approximateCost 0)
    (source : List Edit) {result : TargetMarginResult Edit}
    (marginResult : dijkstraTargetMargin? Independent exactCost Normal
      source = some result)
    (marginDominates :
      ((ReachableTraceClass.reachableTraceVerticesList
        Independent source).length : ℝ) * epsilon < result.margin) :
    ∃ selectedCount selectedApproximateCost selectedExactCost,
      dijkstraSearch Independent approximateCost Normal source =
        some (selectedApproximateCost, result.bestTarget) ∧
      selectedCount <
        (ReachableTraceClass.reachableTraceVerticesList
          Independent source).length ∧
      WeightedTracePath Independent approximateCost
        selectedCount selectedApproximateCost source result.bestTarget ∧
      WeightedTracePath Independent exactCost
        selectedCount selectedExactCost source result.bestTarget := by
  obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩,
      secondNormal, secondDifferent,
      ⟨secondCount, secondPath, secondMinimum⟩,
      marginEq, separated, marginNonnegative⟩ :=
    dijkstraTargetMargin?_some_spec Independent exactCost Normal
      exactNonnegative source marginResult
  exact ApproximateWeightedNormalization.approximateDijkstra_target_stable_of_underestimate_margin
    Independent exactCost approximateCost Normal epsilon result.margin
    epsilonNonnegative within underestimate exactNonnegative
    approximateNonnegative source bestNormal bestPath separated
    marginDominates

end Sprawlens.NormalTargetMargin
