import Sprawlens.WeightedNormalizationPolicy

namespace Sprawlens.UniformWeightedNormalization

open AposterioriConfluence
open DeterministicRankNormalization
open LayoutConfluence
open QuantitativeConfluence
open ReachableRankNormalization

universe u

def uniformSwapCost {Edit : Type u} (weight : ℝ)
    (_before _after : List Edit) (_first _second : Edit) : ℝ :=
  weight

/-- A counted derivation becomes a certificate whose cost is exactly the
swap count times a context-independent primitive weight. -/
theorem TraceEquivalentIn.toUniformCertificate
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (weight : ℝ)
    {count : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent count first second) :
    TraceCertificate Independent (uniformSwapCost weight)
      ((count : ℝ) * weight) first second := by
  induction equivalent with
  | refl edits =>
      simpa using
        (TraceCertificate.refl
          (Independent := Independent)
          (swapCost := uniformSwapCost weight) edits)
  | swap before after first second independent =>
      simpa [uniformSwapCost] using
        (TraceCertificate.swap
          (Independent := Independent)
          (swapCost := uniformSwapCost weight)
          before after first second independent)
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      simpa [Nat.cast_add, add_mul] using
        leftHypothesis.trans rightHypothesis

/-- Conversely, every uniform-cost certificate exposes an ordinary counted
derivation and its real cost is exactly count times weight. -/
theorem TraceCertificate.uniformCost_has_count
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (weight : ℝ)
    {cost : ℝ} {first second : List Edit}
    (certificate : TraceCertificate Independent
      (uniformSwapCost weight) cost first second) :
    ∃ count,
      TraceEquivalentIn Independent count first second ∧
      cost = (count : ℝ) * weight := by
  induction certificate with
  | refl edits =>
      exact ⟨0, .refl edits, by simp⟩
  | swap before after first second independent =>
      exact ⟨1, .swap before after first second independent,
        by simp [uniformSwapCost]⟩
  | symm certificate inductionHypothesis =>
      obtain ⟨count, equivalent, costEq⟩ := inductionHypothesis
      exact ⟨count, equivalent.symm, costEq⟩
  | trans left right leftHypothesis rightHypothesis =>
      obtain ⟨leftCount, leftEquivalent, leftCostEq⟩ := leftHypothesis
      obtain ⟨rightCount, rightEquivalent, rightCostEq⟩ := rightHypothesis
      refine ⟨leftCount + rightCount,
        leftEquivalent.trans rightEquivalent, ?_⟩
      rw [leftCostEq, rightCostEq, Nat.cast_add, add_mul]

/-- Uniqueness is restricted to normal forms reachable from this concrete
input trace. It is weaker than global confluence. -/
def ReachableNormalFormsUniqueFrom
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) : Prop :=
  ∀ target,
    TraceEquivalent Independent edits target →
    IsReachableRankNormalForm rank Independent target →
    target = deterministicNormalForm rank Independent edits

theorem deterministicUniformCertificate
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (weight : ℝ) (edits : List Edit) :
    TraceCertificate Independent (uniformSwapCost weight)
      ((deterministicNormalizationCost rank Independent edits : ℝ) *
        weight)
      edits (deterministicNormalForm rank Independent edits) := by
  exact TraceEquivalentIn.toUniformCertificate Independent weight
    ((deterministicNormalization_descending
      rank Independent edits).toTraceEquivalentIn rank Independent)

/-- Sufficient condition for global normalizing-cost optimality: nonnegative
uniform primitive weight plus a unique reachable normal form. -/
theorem deterministicUniformCertificate_minimum_of_unique
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (weight : ℝ) (weightNonneg : 0 ≤ weight)
    (edits : List Edit)
    (unique : ReachableNormalFormsUniqueFrom rank Independent edits) :
    TraceCertificate Independent (uniformSwapCost weight)
        ((deterministicNormalizationCost rank Independent edits : ℝ) *
          weight)
        edits (deterministicNormalForm rank Independent edits) ∧
      IsReachableRankNormalForm rank Independent
        (deterministicNormalForm rank Independent edits) ∧
      ∀ otherCost otherTarget,
        TraceCertificate Independent (uniformSwapCost weight)
            otherCost edits otherTarget →
        IsReachableRankNormalForm rank Independent otherTarget →
        (deterministicNormalizationCost rank Independent edits : ℝ) *
            weight ≤
          otherCost := by
  refine ⟨deterministicUniformCertificate
      rank Independent weight edits,
    deterministicNormalForm_isNormalForm rank Independent edits, ?_⟩
  intro otherCost otherTarget certificate normalForm
  have targetEq : otherTarget =
      deterministicNormalForm rank Independent edits :=
    unique otherTarget
      (certificate.toTraceEquivalent Independent (uniformSwapCost weight))
      normalForm
  subst otherTarget
  obtain ⟨count, equivalent, costEq⟩ :=
    TraceCertificate.uniformCost_has_count
      Independent weight certificate
  have countBound :=
    deterministicNormalizationCost_minimal_to_selectedTarget
      rank Independent edits equivalent
  rw [costEq]
  apply mul_le_mul_of_nonneg_right _ weightNonneg
  exact_mod_cast countBound

/-- The uniqueness premise above is load-bearing: the symmetric fork has two
different reachable normal forms. -/
theorem fork_reachableNormalForms_not_unique :
    ¬ReachableNormalFormsUniqueFrom
      forkRank ForkIndependent [.high, .middle, .low] := by
  intro unique
  have rightEquivalent :
      TraceEquivalent ForkIndependent
        [.high, .middle, .low] [.high, .low, .middle] :=
    (fork_right_reachable.toTraceEquivalentIn
      forkRank ForkIndependent).toTraceEquivalent ForkIndependent
  have rightEq := unique [.high, .low, .middle]
    rightEquivalent fork_right_normalForm
  have selectedEq :
      deterministicNormalForm forkRank ForkIndependent
        [.high, .middle, .low] = [.middle, .high, .low] := by
    native_decide
  rw [selectedEq] at rightEq
  have distinct :
      ([ForkEdit.high, ForkEdit.low, ForkEdit.middle] : List ForkEdit) ≠
        [ForkEdit.middle, ForkEdit.high, ForkEdit.low] := by
    decide
  exact distinct rightEq

end Sprawlens.UniformWeightedNormalization
