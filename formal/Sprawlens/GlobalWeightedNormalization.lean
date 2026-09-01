import Sprawlens.FiniteWeightedNormalization
import Sprawlens.CertificatePotentialDuality

namespace Sprawlens.GlobalWeightedNormalization

open AposterioriConfluence
open CertificatePotentialDuality
open FiniteWeightedNormalization
open LayoutConfluence
open QuantitativeConfluence
open ReachableRankNormalization

universe u

/-- All normal forms reachable from one concrete input have the same potential
as the selected representative. This does not require the artifact lists to
be equal. -/
def NormalFormPotentialConstantFrom
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (potential : List Edit → ℝ)
    (initial selected : List Edit) : Prop :=
  ∀ target,
    TraceEquivalent Independent initial target →
    IsReachableRankNormalForm rank Independent target →
    potential target = potential selected

/-- A directed minimum that attains a valid potential lower bound is globally
minimum even against inversion-increasing detours and different normal-form
targets, provided all reachable normal forms have the same potential value. -/
theorem directedMinimum_global_of_potential_exact
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (potential : List Edit → ℝ)
    (primitiveBound : PrimitivePotentialBound
      Independent swapCost potential)
    {initial : List Edit}
    (result : MinimumWeightedNormalization
      rank Independent swapCost initial)
    (normalPotential : NormalFormPotentialConstantFrom
      rank Independent potential initial result.target)
    (exactCost : result.cost =
      |potential initial - potential result.target|) :
    ∀ {otherCost otherTarget},
      TraceCertificate Independent swapCost
        otherCost initial otherTarget →
      IsReachableRankNormalForm rank Independent otherTarget →
      result.cost ≤ otherCost := by
  intro otherCost otherTarget certificate normalForm
  have potentialEq : potential otherTarget = potential result.target :=
    normalPotential otherTarget
      (certificate.toTraceEquivalent Independent swapCost) normalForm
  rw [exactCost]
  have lowerBound := potentialDifference_le_certificate
    Independent swapCost potential primitiveBound certificate
  rwa [potentialEq] at lowerBound

/-- The previous theorem packages the chosen directed path, its ordinary
certificate, and global optimality among all certificates ending in any
reachable normal form. -/
theorem exists_globalMinimum_of_directed_potential_exact
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (potential : List Edit → ℝ)
    (primitiveBound : PrimitivePotentialBound
      Independent swapCost potential)
    {initial : List Edit}
    (result : MinimumWeightedNormalization
      rank Independent swapCost initial)
    (normalPotential : NormalFormPotentialConstantFrom
      rank Independent potential initial result.target)
    (exactCost : result.cost =
      |potential initial - potential result.target|) :
    WeightedNormalizingPath rank Independent swapCost
        result.cost initial result.target ∧
      TraceCertificate Independent swapCost
        result.cost initial result.target ∧
      IsReachableRankNormalForm rank Independent result.target ∧
      ∀ {otherCost otherTarget},
        TraceCertificate Independent swapCost
          otherCost initial otherTarget →
        IsReachableRankNormalForm rank Independent otherTarget →
        result.cost ≤ otherCost := by
  exact ⟨result.path,
    result.path.toTraceCertificate rank Independent swapCost,
    result.path.target_normalForm rank Independent swapCost,
    directedMinimum_global_of_potential_exact
      rank Independent swapCost potential primitiveBound
      result normalPotential exactCost⟩

/-- In the weighted fork, endpoint observation is not constant across the two
reachable normal forms; this is exactly why endpoint potential cannot promote
the directed choice to a global normalizing optimum. -/
theorem weightedFork_endpointPotential_not_constant :
    ¬NormalFormPotentialConstantFrom
      forkRank ForkIndependent
      (endpointRealPotential id
        WeightedNormalizationPolicy.applyWeightedFork 0)
      [.high, .middle, .low]
      [.middle, .high, .low] := by
  intro constant
  have rightEquivalent :
      TraceEquivalent ForkIndependent
        [.high, .middle, .low] [.high, .low, .middle] :=
    (fork_right_reachable.toTraceEquivalentIn
      forkRank ForkIndependent).toTraceEquivalent ForkIndependent
  have impossible := constant [.high, .low, .middle]
    rightEquivalent fork_right_normalForm
  norm_num [endpointRealPotential, runEdits,
    WeightedNormalizationPolicy.applyWeightedFork] at impossible

end Sprawlens.GlobalWeightedNormalization
