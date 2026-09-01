import Sprawlens.CertificatePotentialDuality
import Sprawlens.GeneratedPropagatedCertificate

namespace Sprawlens.GeneratedOptimalityGap

open AposterioriConfluence
open CertificatePotentialDuality
open GeneratedPropagatedCertificate
open LayoutConfluence
open NaturalRankStableTrace
open NatInversionTrace
open OptimalPropagatedConfluence
open PropagatedConfluence
open QuantitativeConfluence

universe u v

noncomputable section

/-- A generated derivation and a dual potential produce a fully checked
optimality sandwich. The concrete certificate's additive gap above the dual
lower bound is nonnegative and bounded by the corresponding uniform-budget
gap. -/
theorem exists_generatedCertificate_with_potentialSandwich
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (budget : ℝ)
    (primitiveUpper : PrimitiveSwapCostBound Independent
      (propagatedObservableSwapCost observe apply initial) budget)
    (potential : List Edit → ℝ)
    (primitiveLower : PrimitivePotentialBound Independent
      (propagatedObservableSwapCost observe apply initial) potential)
    {swapCount : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent swapCount first second) :
    ∃ cost,
      TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          cost first second ∧
        dist (observe (runEdits apply first initial))
            (observe (runEdits apply second initial)) ≤ cost ∧
        |potential first - potential second| ≤ cost ∧
        cost ≤ (swapCount : ℝ) * budget ∧
        0 ≤ cost - |potential first - potential second| ∧
        cost - |potential first - potential second| ≤
          (swapCount : ℝ) * budget -
            |potential first - potential second| ∧
        ENNReal.ofReal |potential first - potential second| ≤
          optimalPropagatedCost observe apply Independent initial first second ∧
        optimalPropagatedCost observe apply Independent initial first second ≤
          ENNReal.ofReal cost := by
  obtain ⟨cost, certificate, endpointBound, costUpper⟩ :=
    exists_propagatedCertificate_le_swapCount_mul
      observe apply Independent initial budget primitiveUpper equivalent
  have potentialLower : |potential first - potential second| ≤ cost :=
    potentialDifference_le_certificate Independent
      (propagatedObservableSwapCost observe apply initial)
      potential primitiveLower certificate
  have intrinsicLower :
      ENNReal.ofReal |potential first - potential second| ≤
        optimalPropagatedCost observe apply Independent initial first second :=
    ofReal_potentialDifference_le_optimalPropagatedCost
      observe apply Independent initial potential primitiveLower first second
  have intrinsicUpper :
      optimalPropagatedCost observe apply Independent initial first second ≤
        ENNReal.ofReal cost :=
    optimalPropagatedCost_le_certificate
      observe apply Independent initial certificate
  exact ⟨cost, certificate, endpointBound, potentialLower, costUpper,
    sub_nonneg.mpr potentialLower,
    sub_le_sub_right costUpper _, intrinsicLower, intrinsicUpper⟩

/-- Specialization to the stable natural-rank generator under a general
dependence graph. Only inversions in the concrete input must be independent. -/
theorem exists_naturalRankCertificate_with_potentialSandwich
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    (observe : State → Observation) (apply : Edit → State → State)
    (initial : State) (budget : ℝ) (edits : List Edit)
    (inversionsIndependent : InversionsIndependent rank Independent edits)
    (primitiveUpper : PrimitiveSwapCostBound Independent
      (propagatedObservableSwapCost observe apply initial) budget)
    (potential : List Edit → ℝ)
    (primitiveLower : PrimitivePotentialBound Independent
      (propagatedObservableSwapCost observe apply initial) potential) :
    ∃ cost,
      TraceCertificate Independent
          (propagatedObservableSwapCost observe apply initial)
          cost edits (rankCanonical rank edits) ∧
        dist (observe (runEdits apply edits initial))
            (observe (runEdits apply (rankCanonical rank edits) initial)) ≤
          cost ∧
        |potential edits - potential (rankCanonical rank edits)| ≤ cost ∧
        cost ≤ (rankInversionCount rank edits : ℝ) * budget ∧
        0 ≤ cost -
          |potential edits - potential (rankCanonical rank edits)| ∧
        cost - |potential edits - potential (rankCanonical rank edits)| ≤
          (rankInversionCount rank edits : ℝ) * budget -
            |potential edits - potential (rankCanonical rank edits)| ∧
        ENNReal.ofReal
            |potential edits - potential (rankCanonical rank edits)| ≤
          optimalPropagatedCost observe apply Independent initial
            edits (rankCanonical rank edits) ∧
        optimalPropagatedCost observe apply Independent initial
            edits (rankCanonical rank edits) ≤
          ENNReal.ofReal cost := by
  exact exists_generatedCertificate_with_potentialSandwich
    observe apply Independent initial budget primitiveUpper
    potential primitiveLower
    (naturalRankStableTrace_of_inversionsIndependent
      rank Independent edits inversionsIndependent)

end

end Sprawlens.GeneratedOptimalityGap
