import Sprawlens.TargetRobustnessRadius

namespace Sprawlens.TargetRobustnessReport

open ApproximateWeightedNormalization
open DijkstraInvariant
open NormalTargetMargin
open PositiveCostAttainment
open TargetReliabilityClassification
open TargetRobustnessRadius

universe u

/-- A machine-facing radius is either structurally unbounded or a finite
open threshold. `finite r` certifies errors strictly below `r`, not equality. -/
inductive CertifiedErrorRadius where
  | unbounded
  | finite (radius : ℝ)

def CertifiedErrorRadius.Allows
    (radius : CertifiedErrorRadius) (epsilon : ℝ) : Prop :=
  match radius with
  | .unbounded => True
  | .finite threshold => epsilon < threshold

/-- Operational permission adds the exact-model point `epsilon = 0` to the
open radius. This is justified separately by deterministic search extensionality. -/
def CertifiedErrorRadius.Permits
    (radius : CertifiedErrorRadius) (epsilon : ℝ) : Prop :=
  epsilon = 0 ∨ radius.Allows epsilon

structure CertifiedTargetReport (Edit : Type u) where
  bestCost : ℝ
  bestTarget : List Edit
  twoSidedRadius : CertifiedErrorRadius
  oneSidedRadius : CertifiedErrorRadius

/-- Total reliability report. `none` means infeasible; a returned report has
either unbounded structural uniqueness or finite best-to-second radii. -/
noncomputable def targetRobustnessReport?
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) : Option (CertifiedTargetReport Edit) :=
  match classifyTargetReliability Independent swapCost Normal source with
  | .noNormalTarget => none
  | .uniqueNormalTarget bestCost bestTarget =>
      some {
        bestCost
        bestTarget
        twoSidedRadius := .unbounded
        oneSidedRadius := .unbounded
      }
  | .competingNormalTargets result =>
      some {
        bestCost := result.bestCost
        bestTarget := result.bestTarget
        twoSidedRadius := .finite
          (twoSidedTargetRobustnessRadius
            Independent source result.margin)
        oneSidedRadius := .finite
          (oneSidedTargetRobustnessRadius
            Independent source result.margin)
      }

theorem targetRobustnessReport?_eq_none_iff_classified_noNormalTarget
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) :
    targetRobustnessReport? Independent swapCost Normal source = none ↔
      classifyTargetReliability Independent swapCost Normal source =
        .noNormalTarget := by
  cases classifiedEq :
      classifyTargetReliability Independent swapCost Normal source <;>
    simp [targetRobustnessReport?, classifiedEq]

/-- `none` is a complete infeasibility result. -/
theorem targetRobustnessReport?_eq_none_iff_no_normalPath
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) :
    targetRobustnessReport? Independent swapCost Normal source = none ↔
      ¬∃ count cost target,
        Normal target ∧
        WeightedTracePath Independent swapCost
          count cost source target := by
  rw [targetRobustnessReport?_eq_none_iff_classified_noNormalTarget,
    classifyTargetReliability_eq_noNormalTarget_iff_no_normalPath
      Independent swapCost Normal primitiveNonnegative source]

/-- Every returned report names a feasible globally minimum target. -/
theorem targetRobustnessReport?_some_best_spec
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (primitiveNonnegative : PrimitiveSwapCostLowerBound
      Independent swapCost 0)
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent swapCost Normal source =
      some report) :
    Normal report.bestTarget ∧
      ∃ bestCount,
        WeightedTracePath Independent swapCost
            bestCount report.bestCost source report.bestTarget ∧
          ∀ {otherCount otherCost otherTarget},
            Normal otherTarget →
            WeightedTracePath Independent swapCost
              otherCount otherCost source otherTarget →
            report.bestCost ≤ otherCost := by
  cases classifiedEq :
      classifyTargetReliability Independent swapCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      obtain ⟨bestNormal, bestSpec, noOther⟩ :=
        classifyTargetReliability_uniqueNormalTarget_spec
          Independent swapCost Normal primitiveNonnegative source
          classifiedEq
      exact ⟨bestNormal, bestSpec⟩
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      obtain ⟨bestNormal, bestSpec, secondNormal, secondDifferent,
          secondSpec, marginEq, separated, marginNonnegative⟩ :=
        classifyTargetReliability_competingNormalTargets_spec
          Independent swapCost Normal primitiveNonnegative source
          classifiedEq
      exact ⟨bestNormal, bestSpec⟩

/-- The best pair stored in every report is the exact deterministic Dijkstra
result, not merely some abstract global minimizer. -/
theorem targetRobustnessReport?_some_search_eq
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent swapCost Normal source =
      some report) :
    dijkstraSearch Independent swapCost Normal source =
      some (report.bestCost, report.bestTarget) := by
  cases classifiedEq :
      classifyTargetReliability Independent swapCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      exact (classifyTargetReliability_eq_uniqueNormalTarget_iff
        Independent swapCost Normal source bestCost bestTarget).mp
        classifiedEq |>.1
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      exact classifyTargetReliability_competing_bestSearch_eq
        Independent swapCost Normal source classifiedEq

/-- Unbounded radius is exactly the structural-uniqueness branch. -/
theorem targetRobustnessReport_unbounded_iff_uniqueClassification
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent swapCost Normal source =
      some report) :
    report.twoSidedRadius = .unbounded ↔
      classifyTargetReliability Independent swapCost Normal source =
        .uniqueNormalTarget report.bestCost report.bestTarget := by
  cases classifiedEq :
      classifyTargetReliability Independent swapCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      simp
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      simp

/-- A finite two-sided radius can only come from the competing branch and
is exactly the normalized margin stored by that branch. -/
theorem targetRobustnessReport_finiteTwoSided_spec
    {Edit : Type u} [DecidableEq Edit]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (Normal : List Edit → Prop) [DecidablePred Normal]
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent swapCost Normal source =
      some report)
    {radius : ℝ} (finiteEq : report.twoSidedRadius = .finite radius) :
    ∃ result,
      classifyTargetReliability Independent swapCost Normal source =
          .competingNormalTargets result ∧
        report.bestCost = result.bestCost ∧
        report.bestTarget = result.bestTarget ∧
        radius = twoSidedTargetRobustnessRadius
          Independent source result.margin := by
  cases classifiedEq :
      classifyTargetReliability Independent swapCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      simp at finiteEq
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      injection finiteEq with radiusEq
      exact ⟨result, rfl, rfl, rfl, radiusEq.symm⟩

/-- The two-sided report is directly consumable: unbounded means structural
uniqueness; finite means the supplied error lies strictly below the verified
radius. Both imply approximate target identity. -/
theorem targetRobustnessReport_target_stable_of_twoSidedAllowance
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
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (allowed : report.twoSidedRadius.Allows epsilon) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  cases classifiedEq :
      classifyTargetReliability Independent exactCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩, noOther⟩ :=
        classifyTargetReliability_uniqueNormalTarget_spec
          Independent exactCost Normal exactNonnegative source classifiedEq
      obtain ⟨selectedCount, selectedCost, selectedSearchEq,
          selectedNormal, selectedPath, selectedMinimum⟩ :=
        classifyTargetReliability_uniqueTarget_stable_under_recost
          Independent exactCost approximateCost Normal
          exactNonnegative approximateNonnegative source classifiedEq
      exact ⟨selectedCount, selectedCost, bestCount, bestCost,
        selectedSearchEq, selectedPath, bestPath⟩
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      simp [CertifiedErrorRadius.Allows] at allowed
      obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
          selectedSearchEq, selectedLength, selectedApproximatePath,
          selectedExactPath⟩ :=
        competingClassification_target_stable_within_twoSidedRadius
          Independent exactCost approximateCost Normal epsilon
          epsilonNonnegative within exactNonnegative approximateNonnegative
          source classifiedEq allowed
      exact ⟨selectedCount, selectedApproximateCost,
        selectedCount, selectedExactCost, selectedSearchEq,
        selectedApproximatePath, selectedExactPath⟩

/-- Report consumer for pointwise approximate overestimates. -/
theorem targetRobustnessReport_target_stable_of_overestimateAllowance
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
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (allowed : report.oneSidedRadius.Allows epsilon) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  cases classifiedEq :
      classifyTargetReliability Independent exactCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩, noOther⟩ :=
        classifyTargetReliability_uniqueNormalTarget_spec
          Independent exactCost Normal exactNonnegative source classifiedEq
      obtain ⟨selectedCount, selectedCost, selectedSearchEq,
          selectedNormal, selectedPath, selectedMinimum⟩ :=
        classifyTargetReliability_uniqueTarget_stable_under_recost
          Independent exactCost approximateCost Normal
          exactNonnegative approximateNonnegative source classifiedEq
      exact ⟨selectedCount, selectedCost, bestCount, bestCost,
        selectedSearchEq, selectedPath, bestPath⟩
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      simp [CertifiedErrorRadius.Allows] at allowed
      obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
          selectedSearchEq, selectedLength, selectedApproximatePath,
          selectedExactPath⟩ :=
        competingClassification_target_stable_within_overestimateRadius
          Independent exactCost approximateCost Normal epsilon
          epsilonNonnegative within overestimate exactNonnegative
          approximateNonnegative source classifiedEq allowed
      exact ⟨selectedCount, selectedApproximateCost,
        selectedCount, selectedExactCost, selectedSearchEq,
        selectedApproximatePath, selectedExactPath⟩

/-- Report consumer for pointwise approximate underestimates. -/
theorem targetRobustnessReport_target_stable_of_underestimateAllowance
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
    (source : List Edit) {report : CertifiedTargetReport Edit}
    (returned : targetRobustnessReport? Independent exactCost Normal source =
      some report)
    (allowed : report.oneSidedRadius.Allows epsilon) :
    ∃ approximateCount approximatePathCost exactCount exactPathCost,
      dijkstraSearch Independent approximateCost Normal source =
          some (approximatePathCost, report.bestTarget) ∧
        WeightedTracePath Independent approximateCost
          approximateCount approximatePathCost source report.bestTarget ∧
        WeightedTracePath Independent exactCost
          exactCount exactPathCost source report.bestTarget := by
  cases classifiedEq :
      classifyTargetReliability Independent exactCost Normal source with
  | noNormalTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
  | uniqueNormalTarget bestCost bestTarget =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      obtain ⟨bestNormal, ⟨bestCount, bestPath, bestMinimum⟩, noOther⟩ :=
        classifyTargetReliability_uniqueNormalTarget_spec
          Independent exactCost Normal exactNonnegative source classifiedEq
      obtain ⟨selectedCount, selectedCost, selectedSearchEq,
          selectedNormal, selectedPath, selectedMinimum⟩ :=
        classifyTargetReliability_uniqueTarget_stable_under_recost
          Independent exactCost approximateCost Normal
          exactNonnegative approximateNonnegative source classifiedEq
      exact ⟨selectedCount, selectedCost, bestCount, bestCost,
        selectedSearchEq, selectedPath, bestPath⟩
  | competingNormalTargets result =>
      simp [targetRobustnessReport?, classifiedEq] at returned
      subst report
      simp [CertifiedErrorRadius.Allows] at allowed
      obtain ⟨selectedCount, selectedApproximateCost, selectedExactCost,
          selectedSearchEq, selectedLength, selectedApproximatePath,
          selectedExactPath⟩ :=
        competingClassification_target_stable_within_underestimateRadius
          Independent exactCost approximateCost Normal epsilon
          epsilonNonnegative within underestimate exactNonnegative
          approximateNonnegative source classifiedEq allowed
      exact ⟨selectedCount, selectedApproximateCost,
        selectedCount, selectedExactCost, selectedSearchEq,
        selectedApproximatePath, selectedExactPath⟩

end Sprawlens.TargetRobustnessReport
