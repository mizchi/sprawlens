import Sprawlens.SimpleNormalizingSearch

namespace Sprawlens.PrefixDominance

open AposterioriConfluence
open PositiveCostAttainment
open ReachableRankNormalization
open WeightedNormalizationPolicy

universe u

/-- A cost is minimal among all sequential weighted paths between the same
ordered endpoint pair. Counts may differ. -/
def PathCostMinimal {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (cost : ℝ) (first target : List Edit) : Prop :=
  ∀ {otherCount otherCost},
    WeightedTracePath Independent swapCost
      otherCount otherCost first target →
    cost ≤ otherCost

/-- Exact-vertex dominance rule. If two prefixes reach the same trace, every
fixed suffix completion of the cheaper prefix is no more expensive than the
corresponding completion of the expensive prefix. This is the local rewrite
that permits a best-cost table keyed by the full trace. -/
theorem prefixDominance_preserves_completion
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cheapCount expensiveCount suffixCount : Nat}
    {cheapCost expensiveCost suffixCost : ℝ}
    {first middle target : List Edit}
    (cheap : WeightedTracePath Independent swapCost
      cheapCount cheapCost first middle)
    (_expensive : WeightedTracePath Independent swapCost
      expensiveCount expensiveCost first middle)
    (suffix : WeightedTracePath Independent swapCost
      suffixCount suffixCost middle target)
    (dominates : cheapCost ≤ expensiveCost) :
    WeightedTracePath Independent swapCost
        (cheapCount + suffixCount) (cheapCost + suffixCost) first target ∧
      cheapCost + suffixCost ≤ expensiveCost + suffixCost := by
  exact ⟨cheap.append Independent swapCost suffix,
    add_le_add dominates le_rfl⟩

/-- Bellman optimal substructure for the certificate graph. If a complete
path is globally minimum, then every explicit prefix is minimum among all
paths to that exact intermediate trace; otherwise replacing the prefix and
reusing the same suffix would improve the complete path. -/
theorem prefix_minimal_of_append_minimal
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {prefixCount suffixCount : Nat} {prefixCost suffixCost : ℝ}
    {first middle target : List Edit}
    (_prefixPath : WeightedTracePath Independent swapCost
      prefixCount prefixCost first middle)
    (suffix : WeightedTracePath Independent swapCost
      suffixCount suffixCost middle target)
    (globalMinimum : PathCostMinimal Independent swapCost
      (prefixCost + suffixCost) first target) :
    PathCostMinimal Independent swapCost prefixCost first middle := by
  intro otherCount otherCost otherPrefix
  have alternative := otherPrefix.append Independent swapCost suffix
  have totalLe : prefixCost + suffixCost ≤ otherCost + suffixCost :=
    globalMinimum alternative
  linarith

/-- Certificate-level form of exact-vertex dominance. The derivation tree
may differ arbitrarily before the common middle trace. -/
theorem certificatePrefixDominance_preserves_completion
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {cheapCost expensiveCost suffixCost : ℝ}
    {first middle target : List Edit}
    (cheap : TraceCertificate Independent swapCost
      cheapCost first middle)
    (_expensive : TraceCertificate Independent swapCost
      expensiveCost first middle)
    (suffix : TraceCertificate Independent swapCost
      suffixCost middle target)
    (dominates : cheapCost ≤ expensiveCost) :
    TraceCertificate Independent swapCost
        (cheapCost + suffixCost) first target ∧
      cheapCost + suffixCost ≤ expensiveCost + suffixCost := by
  exact ⟨cheap.trans suffix, add_le_add dominates le_rfl⟩

/-- Load-bearing boundary for state merging: the two fork branches share the
coarse key "rank normal form" but are distinct traces and have costs `2` and
`1`. A dominance table may therefore key by exact trace, but not merely by
normality or another quotient that fails to preserve all suffix costs. -/
theorem fork_normalForm_key_not_safe_for_dominance :
    IsReachableRankNormalForm forkRank ForkIndependent
        [.middle, .high, .low] ∧
      IsReachableRankNormalForm forkRank ForkIndependent
        [.high, .low, .middle] ∧
      [.middle, .high, .low] ≠
        ([.high, .low, .middle] : List ForkEdit) ∧
      TraceCertificate ForkIndependent
        (PropagatedConfluence.propagatedObservableSwapCost
          id applyWeightedFork 0)
        2 [.high, .middle, .low] [.middle, .high, .low] ∧
      TraceCertificate ForkIndependent
        (PropagatedConfluence.propagatedObservableSwapCost
          id applyWeightedFork 0)
        1 [.high, .middle, .low] [.high, .low, .middle] ∧
      (1 : ℝ) < 2 := by
  exact ⟨fork_left_normalForm, fork_right_normalForm, by decide,
    weightedFork_left_certificate, weightedFork_right_certificate, by norm_num⟩

end Sprawlens.PrefixDominance
