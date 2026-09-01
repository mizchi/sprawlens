import Mathlib.Data.ENNReal.Operations
import Sprawlens.PropagatedConfluence

namespace Sprawlens.OptimalPropagatedConfluence

open LayoutConfluence
open AposterioriConfluence
open PropagatedConfluence

universe u v

noncomputable section

/-- Derivation-invariant intrinsic cost: the infimum of all propagated
certificate costs, or `∞` when no trace-equivalence certificate exists. -/
def optimalPropagatedCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (first second : List Edit) : ENNReal :=
  ⨅ (cost : ℝ)
    (_ : TraceCertificate Independent
      (propagatedObservableSwapCost observe apply initial)
      cost first second),
    ENNReal.ofReal cost

/-- The intrinsic cost is no greater than any concrete certificate. -/
theorem optimalPropagatedCost_le_certificate
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (propagatedObservableSwapCost observe apply initial)
      cost first second) :
    optimalPropagatedCost observe apply Independent initial first second ≤
      ENNReal.ofReal cost := by
  exact iInf_le_of_le cost (iInf_le_of_le certificate le_rfl)

/-- Observation distance is a lower bound of every certificate and therefore
of their infimum. -/
theorem ofReal_observable_dist_le_optimalPropagatedCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (first second : List Edit) :
    ENNReal.ofReal
        (dist (observe (runEdits apply first initial))
          (observe (runEdits apply second initial))) ≤
      optimalPropagatedCost observe apply Independent initial first second := by
  apply le_iInf
  intro cost
  apply le_iInf
  intro certificate
  exact ENNReal.ofReal_le_ofReal
    (observable_dist_runEdits_le_propagatedCertificate
      observe apply Independent initial certificate)

theorem observable_edist_le_optimalPropagatedCost
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (first second : List Edit) :
    edist (observe (runEdits apply first initial))
        (observe (runEdits apply second initial)) ≤
      optimalPropagatedCost observe apply Independent initial first second := by
  simpa only [edist_dist] using
    ofReal_observable_dist_le_optimalPropagatedCost
      observe apply Independent initial first second

theorem optimalPropagatedCost_self
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (edits : List Edit) :
    optimalPropagatedCost observe apply Independent initial edits edits = 0 := by
  apply le_antisymm
  · simpa using
      (optimalPropagatedCost_le_certificate
        observe apply Independent initial
        (TraceCertificate.refl edits :
          TraceCertificate Independent
            (propagatedObservableSwapCost observe apply initial)
            0 edits edits))
  · exact bot_le

theorem optimalPropagatedCost_symm
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (first second : List Edit) :
    optimalPropagatedCost observe apply Independent initial first second =
      optimalPropagatedCost observe apply Independent initial second first := by
  apply le_antisymm
  · apply le_iInf
    intro cost
    apply le_iInf
    intro certificate
    exact optimalPropagatedCost_le_certificate
      observe apply Independent initial certificate.symm
  · apply le_iInf
    intro cost
    apply le_iInf
    intro certificate
    exact optimalPropagatedCost_le_certificate
      observe apply Independent initial certificate.symm

theorem optimalPropagatedCost_triangle
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (first second third : List Edit) :
    optimalPropagatedCost observe apply Independent initial first third ≤
      optimalPropagatedCost observe apply Independent initial first second +
        optimalPropagatedCost observe apply Independent initial second third := by
  apply ENNReal.le_iInf₂_add_iInf₂
  intro leftCost leftCertificate rightCost rightCertificate
  exact (optimalPropagatedCost_le_certificate
    observe apply Independent initial
    (leftCertificate.trans rightCertificate)).trans ENNReal.ofReal_add_le

theorem optimalPropagatedCost_eq_top_of_not_traceEquivalent
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    {first second : List Edit}
    (notEquivalent : ¬ TraceEquivalent Independent first second) :
    optimalPropagatedCost observe apply Independent initial first second = ⊤ := by
  apply top_unique
  apply le_iInf
  intro cost
  apply le_iInf
  intro certificate
  exact (notEquivalent
    (TraceCertificate.toTraceEquivalent
      Independent (propagatedObservableSwapCost observe apply initial)
      certificate)).elim

theorem optimalPropagatedCost_ne_top_of_traceEquivalent
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    {first second : List Edit}
    (equivalent : TraceEquivalent Independent first second) :
    optimalPropagatedCost observe apply Independent initial first second ≠ ⊤ := by
  obtain ⟨cost, certificate⟩ :=
    exists_propagatedCertificate observe apply Independent initial equivalent
  have upper := optimalPropagatedCost_le_certificate
    observe apply Independent initial certificate
  exact ne_top_of_le_ne_top ENNReal.ofReal_ne_top upper

theorem optimalPropagatedCost_eq_top_iff_not_traceEquivalent
    {Edit : Type u} {State : Type v} {Observation : Type*}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (Independent : Edit → Edit → Prop) (initial : State)
    (first second : List Edit) :
    optimalPropagatedCost observe apply Independent initial first second = ⊤ ↔
      ¬ TraceEquivalent Independent first second := by
  constructor
  · intro costTop equivalent
    exact (optimalPropagatedCost_ne_top_of_traceEquivalent
      observe apply Independent initial equivalent) costTop
  · exact optimalPropagatedCost_eq_top_of_not_traceEquivalent
      observe apply Independent initial

/-- Separation intentionally fails: different traces with identical observed
endpoints have intrinsic cost zero. -/
def applyIdentityEdit (_ : Bool) (state : Bool) : Bool :=
  state

def BoolIndependent (_ _ : Bool) : Prop :=
  True

def observeBool (_ : Bool) : ℝ :=
  0

theorem identityTrace_propagatedCertificate :
    TraceCertificate BoolIndependent
      (propagatedObservableSwapCost observeBool applyIdentityEdit false)
      0 [false, true] [true, false] := by
  simpa [propagatedObservableSwapCost, runEdits, applyIdentityEdit,
    observeBool, BoolIndependent] using
    (TraceCertificate.swap
      (Independent := BoolIndependent)
      (swapCost := propagatedObservableSwapCost
        observeBool applyIdentityEdit false)
      [] [] false true trivial)

theorem identityTrace_optimalPropagatedCost_zero :
    optimalPropagatedCost observeBool applyIdentityEdit BoolIndependent false
      [false, true] [true, false] = 0 := by
  apply le_antisymm
  · simpa using
      (optimalPropagatedCost_le_certificate
        observeBool applyIdentityEdit BoolIndependent false
        identityTrace_propagatedCertificate)
  · exact bot_le

theorem identityTrace_lists_differ :
    [false, true] ≠ [true, false] := by
  decide

end


end Sprawlens.OptimalPropagatedConfluence
