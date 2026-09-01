import Sprawlens.OptimalPropagatedConfluence

namespace Sprawlens.CertificatePotentialDuality

open AposterioriConfluence
open LayoutConfluence
open OptimalPropagatedConfluence
open PropagatedConfluence

universe u v

noncomputable section

/-- A dual lower-bound witness: every independent primitive swap costs at
least the absolute change of a real-valued trace potential. -/
def PrimitivePotentialBound
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (potential : List Edit → ℝ) : Prop :=
  ∀ before after first second, Independent first second →
    |potential (before ++ first :: second :: after) -
        potential (before ++ second :: first :: after)| ≤
      swapCost before after first second

/-- Potential difference lower-bounds the cost of every certificate. This is
the weighted analogue of an inversion-count lower-bound argument and remains
valid for context-dependent primitive costs. -/
theorem potentialDifference_le_certificate
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (potential : List Edit → ℝ)
    (primitiveBound : PrimitivePotentialBound
      Independent swapCost potential)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent swapCost cost first second) :
    |potential first - potential second| ≤ cost := by
  induction certificate with
  | refl edits => simp
  | swap before after first second independent =>
      exact primitiveBound before after first second independent
  | symm certificate inductionHypothesis =>
      simpa only [abs_sub_comm] using inductionHypothesis
  | @trans leftCost rightCost first second third left right
      leftHypothesis rightHypothesis =>
      calc
        |potential first - potential third| =
            |(potential first - potential second) +
              (potential second - potential third)| := by
          congr 1
          ring
        _ ≤ |potential first - potential second| +
              |potential second - potential third| := abs_add_le _ _
        _ ≤ leftCost + rightCost :=
          add_le_add leftHypothesis rightHypothesis

/-- A certificate attaining its potential lower bound is globally minimal
among all certificates between the same traces. -/
theorem certificate_minimal_of_potential_exact
    {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (potential : List Edit → ℝ)
    (primitiveBound : PrimitivePotentialBound
      Independent swapCost potential)
    {cost : ℝ} {first second : List Edit}
    (_certificate : TraceCertificate Independent swapCost cost first second)
    (exactCost : cost = |potential first - potential second|) :
    ∀ {otherCost},
      TraceCertificate Independent swapCost otherCost first second →
      cost ≤ otherCost := by
  intro otherCost otherCertificate
  rw [exactCost]
  exact potentialDifference_le_certificate
    Independent swapCost potential primitiveBound otherCertificate

/-- A valid potential lower-bounds the intrinsic infimum itself, not only each
individual concrete certificate. -/
theorem ofReal_potentialDifference_le_optimalPropagatedCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (potential : List Edit → ℝ)
    (primitiveBound : PrimitivePotentialBound Independent
      (propagatedObservableSwapCost observe apply initial) potential)
    (first second : List Edit) :
    ENNReal.ofReal |potential first - potential second| ≤
      optimalPropagatedCost observe apply Independent initial first second := by
  apply le_iInf
  intro cost
  apply le_iInf
  intro certificate
  exact ENNReal.ofReal_le_ofReal
    (potentialDifference_le_certificate Independent
      (propagatedObservableSwapCost observe apply initial)
      potential primitiveBound certificate)

/-- Dual attainment closes the infimum gap: when a propagated certificate
matches a valid potential difference, the intrinsic infimum equals that
concrete certificate cost. -/
theorem optimalPropagatedCost_eq_certificate_of_potentialExact
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (potential : List Edit → ℝ)
    (primitiveBound : PrimitivePotentialBound Independent
      (propagatedObservableSwapCost observe apply initial) potential)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (propagatedObservableSwapCost observe apply initial)
      cost first second)
    (exactCost : cost = |potential first - potential second|) :
    optimalPropagatedCost observe apply Independent initial first second =
      ENNReal.ofReal cost := by
  apply le_antisymm
  · exact optimalPropagatedCost_le_certificate
      observe apply Independent initial certificate
  · apply le_iInf
    intro otherCost
    apply le_iInf
    intro otherCertificate
    exact ENNReal.ofReal_le_ofReal
      (certificate_minimal_of_potential_exact
        Independent
        (propagatedObservableSwapCost observe apply initial)
        potential primitiveBound certificate exactCost otherCertificate)

/-- For real-valued observations, the executed endpoint itself is always a
valid potential: each primitive propagated cost is exactly its endpoint
potential change. -/
def endpointRealPotential
    {Edit : Type u} {State : Type v}
    (observe : State → ℝ) (apply : Edit → State → State)
    (initial : State) (edits : List Edit) : ℝ :=
  observe (runEdits apply edits initial)

theorem endpointRealPotential_primitiveBound
    {Edit : Type u} {State : Type v}
    (observe : State → ℝ) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State) :
    PrimitivePotentialBound Independent
      (propagatedObservableSwapCost observe apply initial)
      (endpointRealPotential observe apply initial) := by
  intro before after first second independent
  simp [endpointRealPotential, propagatedObservableSwapCost, Real.dist_eq]

/-- Positive attained witness: the hard-switch trace pair has intrinsic
propagated cost exactly two, not merely an upper or lower bound of two. -/
theorem hardSuffix_optimalPropagatedCost_eq_two
    (epsilon : ℝ) (epsilonPositive : 0 < epsilon) :
    optimalPropagatedCost id (applyHardSuffixEdit epsilon)
      HardSuffixIndependent 0
      [.reset, .increment, .select]
      [.increment, .reset, .select] = 2 := by
  have certificate :=
    hardSuffix_propagated_traceCertificate epsilon epsilonPositive
  have exactCost :
      (2 : ℝ) =
        |endpointRealPotential id (applyHardSuffixEdit epsilon) 0
              [.reset, .increment, .select] -
          endpointRealPotential id (applyHardSuffixEdit epsilon) 0
              [.increment, .reset, .select]| := by
    simpa [endpointRealPotential, Real.dist_eq] using
      (hardSuffix_endpoint_distance epsilon epsilonPositive).symm
  simpa using
    (optimalPropagatedCost_eq_certificate_of_potentialExact
      id (applyHardSuffixEdit epsilon) HardSuffixIndependent 0
      (endpointRealPotential id (applyHardSuffixEdit epsilon) 0)
      (endpointRealPotential_primitiveBound
        id (applyHardSuffixEdit epsilon) HardSuffixIndependent 0)
      certificate exactCost)

end

end Sprawlens.CertificatePotentialDuality
