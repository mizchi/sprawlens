import Sprawlens.GeneratedPropagatedCertificate
import Sprawlens.DeterministicRankNormalization
import Sprawlens.PropagatedConfluence

namespace Sprawlens.WeightedNormalizationPolicy

open AposterioriConfluence
open DeterministicRankNormalization
open LayoutConfluence
open PropagatedConfluence
open QuantitativeConfluence
open ReachableRankNormalization

/-- A concrete context-sensitive observation model for the non-confluent
fork: high resets, middle increments, and low doubles. -/
def applyWeightedFork : ForkEdit → ℝ → ℝ
  | .high, _ => 0
  | .middle, state => state + 1
  | .low, state => 2 * state

theorem weightedFork_original_endpoint :
    runEdits applyWeightedFork
      [.high, .middle, .low] 0 = 2 := by
  norm_num [runEdits, applyWeightedFork]

theorem weightedFork_left_endpoint :
    runEdits applyWeightedFork
      [.middle, .high, .low] 0 = 0 := by
  norm_num [runEdits, applyWeightedFork]

theorem weightedFork_right_endpoint :
    runEdits applyWeightedFork
      [.high, .low, .middle] 0 = 1 := by
  norm_num [runEdits, applyWeightedFork]

theorem weightedFork_left_swapCost :
    propagatedObservableSwapCost id applyWeightedFork 0
      [] [.low] .high .middle = 2 := by
  norm_num [propagatedObservableSwapCost, runEdits,
    applyWeightedFork, Real.dist_eq]

theorem weightedFork_right_swapCost :
    propagatedObservableSwapCost id applyWeightedFork 0
      [.high] [] .middle .low = 1 := by
  norm_num [propagatedObservableSwapCost, runEdits,
    applyWeightedFork, Real.dist_eq]

theorem weightedFork_left_certificate :
    TraceCertificate ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)
      2
      [.high, .middle, .low]
      [.middle, .high, .low] := by
  simpa [weightedFork_left_swapCost] using
    (TraceCertificate.swap
      (Independent := ForkIndependent)
      (swapCost := propagatedObservableSwapCost id applyWeightedFork 0)
      [] [.low] .high .middle (by simp [ForkIndependent]))

theorem weightedFork_right_certificate :
    TraceCertificate ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)
      1
      [.high, .middle, .low]
      [.high, .low, .middle] := by
  simpa [weightedFork_right_swapCost] using
    (TraceCertificate.swap
      (Independent := ForkIndependent)
      (swapCost := propagatedObservableSwapCost id applyWeightedFork 0)
      [.high] [] .middle .low (by simp [ForkIndependent]))

def IsMinimumNormalizingCertificate
    (cost : ℝ) (target : List ForkEdit) : Prop :=
  TraceCertificate ForkIndependent
      (propagatedObservableSwapCost id applyWeightedFork 0)
      cost [.high, .middle, .low] target ∧
    IsReachableRankNormalForm forkRank ForkIndependent target ∧
    ∀ otherCost otherTarget,
      TraceCertificate ForkIndependent
          (propagatedObservableSwapCost id applyWeightedFork 0)
          otherCost [.high, .middle, .low] otherTarget →
      IsReachableRankNormalForm forkRank ForkIndependent otherTarget →
      cost ≤ otherCost

/-- Load-bearing weighted counterexample: the executable leftmost policy
selects the left normal form with propagated cost 2, while another reachable
normal form has propagated cost 1. Hence the policy is deterministic and
terminating, but is not an arbitrary-weight optimum. -/
theorem deterministic_leftmost_not_minimum_weighted :
    deterministicNormalizationResult forkRank ForkIndependent
        [.high, .middle, .low] =
          (1, [.middle, .high, .low]) ∧
      ¬IsMinimumNormalizingCertificate
        2 [.middle, .high, .low] := by
  refine ⟨deterministicForkNormalization, ?_⟩
  rintro ⟨leftCertificate, leftNormal, minimum⟩
  have impossible : (2 : ℝ) ≤ 1 :=
    minimum 1 [.high, .low, .middle]
      weightedFork_right_certificate fork_right_normalForm
  norm_num at impossible

end Sprawlens.WeightedNormalizationPolicy
