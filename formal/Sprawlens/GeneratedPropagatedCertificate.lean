import Sprawlens.PropagatedConfluence
import Sprawlens.StablePartitionTrace
import Sprawlens.ThreeClassStableTrace
import Sprawlens.NaturalRankStableTrace

namespace Sprawlens.GeneratedPropagatedCertificate

open AposterioriConfluence
open ConfluenceDefect
open LayoutConfluence
open NatInversionTrace
open PropagatedConfluence
open QuantitativeConfluence
open NaturalRankStableTrace
open StablePartitionTrace
open ThreeClassStableTrace
open TraceDerivationGenerator

universe u v

/-- A uniform upper bound on the cost of every independent primitive swap.
The context remains explicit because propagated replay cost depends on both
the reachable prefix and the common suffix. -/
def PrimitiveSwapCostBound
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (budget : ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    swapCost before after first second ≤ budget

/-- A counted adjacent-swap derivation can be replayed into a real-valued
certificate. If every primitive costs at most `budget`, the total certificate
cost is at most `swapCount * budget`. -/
theorem exists_certificate_le_swapCount_mul
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound Independent swapCost budget)
    {swapCount : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent swapCount first second) :
    ∃ cost,
      TraceCertificate Independent swapCost cost first second ∧
      cost ≤ (swapCount : ℝ) * budget := by
  induction equivalent with
  | refl edits =>
      exact ⟨0, .refl edits, by simp⟩
  | swap before after first second independent =>
      exact ⟨swapCost before after first second,
        .swap before after first second independent,
        by simpa using primitiveBound before after first second independent⟩
  | symm equivalent inductionHypothesis =>
      obtain ⟨cost, certificate, bound⟩ := inductionHypothesis
      exact ⟨cost, certificate.symm, bound⟩
  | @trans leftCount rightCount first second third left right
      leftHypothesis rightHypothesis =>
      obtain ⟨leftCost, leftCertificate, leftBound⟩ := leftHypothesis
      obtain ⟨rightCost, rightCertificate, rightBound⟩ := rightHypothesis
      refine ⟨leftCost + rightCost,
        leftCertificate.trans rightCertificate, ?_⟩
      calc
        leftCost + rightCost ≤
            (leftCount : ℝ) * budget + (rightCount : ℝ) * budget :=
          add_le_add leftBound rightBound
        _ = ((leftCount + rightCount : Nat) : ℝ) * budget := by
          rw [Nat.cast_add, add_mul]

/-- The generated propagated certificate simultaneously carries its endpoint
bound and the counted-derivation budget. No continuity premise is used. -/
theorem exists_propagatedCertificate_le_swapCount_mul
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound Independent
      (propagatedObservableSwapCost observe apply initial) budget)
    {swapCount : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent swapCount first second) :
    ∃ cost,
      TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          cost first second ∧
        dist (observe (runEdits apply first initial))
            (observe (runEdits apply second initial)) ≤ cost ∧
        cost ≤ (swapCount : ℝ) * budget := by
  obtain ⟨cost, certificate, costBound⟩ :=
    exists_certificate_le_swapCount_mul Independent
      (propagatedObservableSwapCost observe apply initial)
      budget primitiveBound equivalent
  exact ⟨cost, certificate,
    observable_dist_runEdits_le_propagatedCertificate
      observe apply Independent initial certificate,
    costBound⟩

/-- For an arbitrary binary trace, deterministic canonicalization yields a
propagated endpoint certificate bounded by `inversionCount * budget`. -/
theorem exists_binaryCanonical_propagatedCertificate
    {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Bool → State → State)
    (initial : State) (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound (@AllIndependent Bool)
      (propagatedObservableSwapCost observe apply initial) budget)
    (edits : List Bool) :
    ∃ cost,
      TraceCertificate (@AllIndependent Bool)
          (propagatedObservableSwapCost observe apply initial)
          cost edits (canonicalBinary edits) ∧
        dist (observe (runEdits apply edits initial))
            (observe (runEdits apply (canonicalBinary edits) initial)) ≤ cost ∧
        cost ≤ (inversionCount edits : ℝ) * budget := by
  exact exists_propagatedCertificate_le_swapCount_mul
    observe apply (@AllIndependent Bool) initial budget primitiveBound
    (canonicalizeBinary edits)

/-- Equal-multiplicity binary traces can be joined by a deterministic
propagated certificate through their shared canonical form. -/
theorem exists_binaryPair_propagatedCertificate
    {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Bool → State → State)
    (initial : State) (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound (@AllIndependent Bool)
      (propagatedObservableSwapCost observe apply initial) budget)
    {first second : List Bool}
    (falseCount : first.count false = second.count false)
    (trueCount : first.count true = second.count true) :
    ∃ cost,
      TraceCertificate (@AllIndependent Bool)
          (propagatedObservableSwapCost observe apply initial)
          cost first second ∧
        dist (observe (runEdits apply first initial))
            (observe (runEdits apply second initial)) ≤ cost ∧
        cost ≤
          ((inversionCount first + inversionCount second : Nat) : ℝ) *
            budget := by
  exact exists_propagatedCertificate_le_swapCount_mul
    observe apply (@AllIndependent Bool) initial budget primitiveBound
    (equivalentBinary_of_counts falseCount trueCount)

/-- Arbitrary edit payloads under two-class partial independence inherit the
same generated geometry certificate. Within-class edit order is preserved. -/
theorem exists_stablePartition_propagatedCertificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (classifier : Edit → Bool)
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound
      (CrossClassIndependent classifier)
      (propagatedObservableSwapCost observe apply initial) budget)
    (edits : List Edit) :
    ∃ cost,
      TraceCertificate (CrossClassIndependent classifier)
          (propagatedObservableSwapCost observe apply initial)
          cost edits (stablePartition classifier edits) ∧
        dist (observe (runEdits apply edits initial))
            (observe
              (runEdits apply (stablePartition classifier edits) initial)) ≤
          cost ∧
        cost ≤ (classInversionCount classifier edits : ℝ) * budget := by
  exact exists_propagatedCertificate_le_swapCount_mul
    observe apply (CrossClassIndependent classifier) initial
    budget primitiveBound (stablePartitionTrace classifier edits)

/-- Three ordered edit classes with arbitrary payloads inherit the generated
propagated endpoint certificate from their exact stable canonicalization. -/
theorem exists_threeClassCanonical_propagatedCertificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (classifier : Edit → Tier3)
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound
      (CrossTierIndependent classifier)
      (propagatedObservableSwapCost observe apply initial) budget)
    (edits : List Edit) :
    ∃ cost,
      TraceCertificate (CrossTierIndependent classifier)
          (propagatedObservableSwapCost observe apply initial)
          cost edits (threeClassCanonical classifier edits) ∧
        dist (observe (runEdits apply edits initial))
            (observe
              (runEdits apply
                (threeClassCanonical classifier edits) initial)) ≤ cost ∧
        cost ≤
          (threeClassInversionCount classifier edits : ℝ) * budget := by
  exact exists_propagatedCertificate_le_swapCount_mul
    observe apply (CrossTierIndependent classifier) initial
    budget primitiveBound (threeClassStableTrace classifier edits)

/-- Arbitrarily many natural-number-ranked edit classes inherit a generated
propagated endpoint certificate from stable insertion-sort canonicalization. -/
theorem exists_naturalRankCanonical_propagatedCertificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (rank : Edit → Nat)
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (budget : ℝ)
    (primitiveBound : PrimitiveSwapCostBound
      (CrossRankIndependent rank)
      (propagatedObservableSwapCost observe apply initial) budget)
    (edits : List Edit) :
    ∃ cost,
      TraceCertificate (CrossRankIndependent rank)
          (propagatedObservableSwapCost observe apply initial)
          cost edits (rankCanonical rank edits) ∧
        dist (observe (runEdits apply edits initial))
            (observe (runEdits apply (rankCanonical rank edits) initial)) ≤
          cost ∧
        cost ≤ (rankInversionCount rank edits : ℝ) * budget := by
  exact exists_propagatedCertificate_le_swapCount_mul
    observe apply (CrossRankIndependent rank) initial
    budget primitiveBound (naturalRankStableTrace rank edits)

/-- For a general dependence graph, the same propagated certificate exists
when every rank inversion present in the concrete input is independent. -/
theorem exists_naturalRankCanonical_propagatedCertificate_of_inversionsIndependent
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (budget : ℝ)
    (edits : List Edit)
    (inversionsIndependent : InversionsIndependent rank Independent edits)
    (primitiveBound : PrimitiveSwapCostBound Independent
      (propagatedObservableSwapCost observe apply initial) budget)
    :
    ∃ cost,
      TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          cost edits (rankCanonical rank edits) ∧
        dist (observe (runEdits apply edits initial))
            (observe (runEdits apply (rankCanonical rank edits) initial)) ≤
          cost ∧
        cost ≤ (rankInversionCount rank edits : ℝ) * budget := by
  exact exists_propagatedCertificate_le_swapCount_mul
    observe apply Independent initial budget primitiveBound
    (naturalRankStableTrace_of_inversionsIndependent
      rank Independent edits inversionsIndependent)

/-- A two-edit witness in which the generated `swapCount * budget` bound is
attained exactly. `false` resets and `true` increments. -/
def applyBinaryWitness : Bool → ℝ → ℝ
  | false, _ => 0
  | true, state => state + 1

theorem applyBinaryWitness_nonexpansive (edit : Bool) :
    IsNonexpansive (applyBinaryWitness edit) := by
  intro first second
  cases edit with
  | false => simp [applyBinaryWitness]
  | true => simp [applyBinaryWitness, Real.dist_eq]

theorem applyBinaryWitness_squareDefect_le_one
    (first second : Bool) (state : ℝ) :
    squareDefect applyBinaryWitness first second state ≤ 1 := by
  cases first <;> cases second <;>
    norm_num [squareDefect, applyBinaryWitness, Real.dist_eq]

theorem applyBinaryWitness_primitiveBound :
    PrimitiveSwapCostBound (@AllIndependent Bool)
      (propagatedObservableSwapCost id applyBinaryWitness 0) 1 := by
  intro before after first second independent
  calc
    propagatedObservableSwapCost id applyBinaryWitness 0
        before after first second ≤
        squareDefect applyBinaryWitness first second
          (runEdits applyBinaryWitness before 0) := by
      simpa [propagatedObservableSwapCost] using
        (runEdits_swap_dist_le_squareDefect applyBinaryWitness
          applyBinaryWitness_nonexpansive before after first second 0)
    _ ≤ 1 := applyBinaryWitness_squareDefect_le_one first second _

theorem applyBinaryWitness_endpoint_distance :
    dist
        (runEdits applyBinaryWitness [true, false] 0)
        (runEdits applyBinaryWitness [false, true] 0) = 1 := by
  norm_num [runEdits, applyBinaryWitness, Real.dist_eq]

theorem binaryCanonical_propagatedCertificate_tight :
    ∃ cost,
      TraceCertificate (@AllIndependent Bool)
          (propagatedObservableSwapCost id applyBinaryWitness 0)
          cost [true, false] [false, true] ∧
        cost = 1 ∧
        dist
            (runEdits applyBinaryWitness [true, false] 0)
            (runEdits applyBinaryWitness [false, true] 0) = 1 := by
  obtain ⟨cost, certificate, endpointBound, costBound⟩ :=
    exists_binaryCanonical_propagatedCertificate
      id applyBinaryWitness 0 1 applyBinaryWitness_primitiveBound [true, false]
  have canonicalEq : canonicalBinary [true, false] = [false, true] := by
    decide
  rw [canonicalEq] at certificate endpointBound
  have endpointExact := applyBinaryWitness_endpoint_distance
  have costEq : cost = 1 := by
    have endpointBound' :
        dist
            (runEdits applyBinaryWitness [true, false] 0)
            (runEdits applyBinaryWitness [false, true] 0) ≤ cost := by
      simpa using endpointBound
    rw [endpointExact] at endpointBound'
    norm_num [inversionCount] at costBound
    linarith
  exact ⟨cost, certificate, costEq, endpointExact⟩

end Sprawlens.GeneratedPropagatedCertificate
