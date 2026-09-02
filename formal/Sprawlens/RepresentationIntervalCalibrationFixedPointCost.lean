import Sprawlens.FixedPointQuantization
import Sprawlens.RepresentationIntervalCalibrationCostSeparation

namespace Sprawlens.RepresentationIntervalCalibrationFixedPointCost

open FixedPointEncodedCost
open FixedPointQuantization
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive
open RepresentationIntervalCalibrationCostSeparation

universe u v

noncomputable def quantizedUpScalarCost
    {Index : Type u}
    (scale : PositiveScale)
    (cost : Index → ℝ)
    (index : Index) : ℝ :=
  decode (quantizeUp scale (cost index))

/-- For upward fixed-point quantization, a single quantum of exact separation
is sufficient. Equality is allowed because every upward slack is strictly
less than one quantum and competitors are never rounded downward. -/
theorem finiteCanonicalArgmin_quantizedUp_eq_of_quantumSeparation
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (scale : PositiveScale)
    (costNonnegative : ∀ index ∈ indices, 0 ≤ cost index)
    (separated : let best := finiteCanonicalArgmin indices nonempty cost
      ∀ other ∈ indices, other ≠ best →
        cost best + quantum scale ≤ cost other) :
    finiteCanonicalArgmin indices nonempty
        (quantizedUpScalarCost scale cost) =
      finiteCanonicalArgmin indices nonempty cost := by
  let best := finiteCanonicalArgmin indices nonempty cost
  change finiteCanonicalArgmin indices nonempty
      (quantizedUpScalarCost scale cost) = best
  dsimp only at separated
  change ∀ other ∈ indices, other ≠ best →
    cost best + quantum scale ≤ cost other at separated
  have bestMem : best ∈ indices :=
    finiteCanonicalArgmin_mem indices nonempty cost
  have bestUpper : quantizedUpScalarCost scale cost best <
      cost best + quantum scale := by
    exact decode_quantizeUp_lt_add_quantum scale
      (costNonnegative best bestMem)
  have bestStrictlyBeats : ∀ other ∈ indices, other ≠ best →
      quantizedUpScalarCost scale cost best <
        quantizedUpScalarCost scale cost other := by
    intro other otherMem otherNe
    have gap := separated other otherMem otherNe
    have otherLower : cost other ≤ quantizedUpScalarCost scale cost other :=
      value_le_decode_quantizeUp scale (cost other)
    exact bestUpper.trans_le (gap.trans otherLower)
  apply isFiniteCanonicalArgmin_unique indices
    (quantizedUpScalarCost scale cost)
    (finiteCanonicalArgmin indices nonempty
      (quantizedUpScalarCost scale cost)) best
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨bestMem, ?_, ?_⟩
    · intro other otherMem
      by_cases otherEq : other = best
      · subst other
        exact le_rfl
      · exact (bestStrictlyBeats other otherMem otherEq).le
    · intro other otherMem costEq
      by_cases otherEq : other = best
      · subst other
        exact le_rfl
      · have strict := bestStrictlyBeats other otherMem otherEq
        linarith

/-- The fixed-point theorem applies directly to both canonical active
residual-envelope IDs; residual envelopes supply nonnegativity internally. -/
theorem canonicalActiveConstraints_quantizedUp_eq_of_quantumSeparation
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (scale : PositiveScale)
    (lowerSeparated : ∀ other ∈
        observedLowerActiveSet observedLower artifact constraints nonempty,
      other ≠ canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family →
      lowerTraceEnvelopeAt family
            (canonicalLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          quantum scale ≤ lowerTraceEnvelopeAt family other)
    (upperSeparated : ∀ other ∈
        observedUpperActiveSet observedUpper artifact constraints nonempty,
      other ≠ canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family →
      upperTraceEnvelopeAt family
            (canonicalUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          quantum scale ≤ upperTraceEnvelopeAt family other) :
    finiteCanonicalArgmin
          (observedLowerActiveSet observedLower artifact constraints nonempty)
          (observedLowerActiveSet_nonempty observedLower artifact constraints
            nonempty)
          (quantizedUpScalarCost scale (lowerTraceEnvelopeAt family)) =
        canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family ∧
      finiteCanonicalArgmin
          (observedUpperActiveSet observedUpper artifact constraints nonempty)
          (observedUpperActiveSet_nonempty observedUpper artifact constraints
            nonempty)
          (quantizedUpScalarCost scale (upperTraceEnvelopeAt family)) =
        canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family := by
  constructor
  · apply finiteCanonicalArgmin_quantizedUp_eq_of_quantumSeparation
    · intro constraint constraintActive
      have constraintMem := (Finset.mem_filter.mp constraintActive).1
      simp only [lowerTraceEnvelopeAt, dif_pos constraintMem]
      exact stagewiseResidualTrace_residualEnvelope_nonnegative _
    · exact lowerSeparated
  · apply finiteCanonicalArgmin_quantizedUp_eq_of_quantumSeparation
    · intro constraint constraintActive
      have constraintMem := (Finset.mem_filter.mp constraintActive).1
      simp only [upperTraceEnvelopeAt, dif_pos constraintMem]
      exact stagewiseResidualTrace_residualEnvelope_nonnegative _
    · exact upperSeparated

def unitScale : PositiveScale where
  denominator := 1
  positive := by norm_num

theorem unitScale_quantum : quantum unitScale = 1 := by
  norm_num [quantum, unitScale]

def oneQuantumExactBoolCost (id : Bool) : ℝ :=
  if id then 0 else 1

theorem oneQuantumExactBoolCost_nonnegative :
    ∀ id ∈ (Finset.univ : Finset Bool),
      0 ≤ oneQuantumExactBoolCost id := by
  intro id _
  cases id <;> norm_num [oneQuantumExactBoolCost]

theorem oneQuantumExactBoolCost_separated :
    let best := finiteCanonicalArgmin (Finset.univ : Finset Bool)
      boolUniv_nonempty oneQuantumExactBoolCost
    ∀ other ∈ (Finset.univ : Finset Bool), other ≠ best →
      oneQuantumExactBoolCost best + quantum unitScale ≤
        oneQuantumExactBoolCost other := by
  dsimp only
  have canonical :
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
        oneQuantumExactBoolCost = true := by
    apply isFiniteCanonicalArgmin_unique _ _ _ true
    · exact finiteCanonicalArgmin_isCanonical _ _ _
    · refine ⟨by simp, ?_, ?_⟩
      · intro other _
        cases other <;> norm_num [oneQuantumExactBoolCost]
      · intro other _ costEq
        cases other
        · norm_num [oneQuantumExactBoolCost] at costEq
        · exact le_rfl
  rw [canonical]
  intro other _ otherNe
  cases other
  · norm_num [oneQuantumExactBoolCost, unitScale_quantum]
  · simp at otherNe

theorem exactOneQuantumBoundary_preservesCanonicalId :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
        (quantizedUpScalarCost unitScale oneQuantumExactBoolCost) =
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
        oneQuantumExactBoolCost := by
  exact finiteCanonicalArgmin_quantizedUp_eq_of_quantumSeparation _ _ _ _
    oneQuantumExactBoolCost_nonnegative oneQuantumExactBoolCost_separated

noncomputable def subQuantumExactBoolCost (id : Bool) : ℝ :=
  if id then (1 : ℝ) / 2 else 1

theorem subQuantumExactBoolCost_canonicalArgmin_eq_true :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      subQuantumExactBoolCost = true := by
  apply isFiniteCanonicalArgmin_unique _ _ _ true
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨by simp, ?_, ?_⟩
    · intro other _
      cases other <;> norm_num [subQuantumExactBoolCost]
    · intro other _ costEq
      cases other
      · norm_num [subQuantumExactBoolCost] at costEq
      · exact le_rfl

theorem quantizedUp_subQuantumExactBoolCost_eq_one :
    quantizedUpScalarCost unitScale subQuantumExactBoolCost = fun _ => 1 := by
  have ceilHalf : ⌈((1 : ℝ) / 2)⌉₊ = 1 := by
    rw [Nat.ceil_eq_iff (by norm_num : (1 : Nat) ≠ 0)]
    norm_num
  funext id
  cases id <;>
    norm_num [quantizedUpScalarCost, subQuantumExactBoolCost,
      decode_quantizeUp, unitScale, ceilHalf]

theorem subQuantumQuantizedCost_canonicalArgmin_eq_false :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      (quantizedUpScalarCost unitScale subQuantumExactBoolCost) = false := by
  rw [quantizedUp_subQuantumExactBoolCost_eq_one]
  apply isFiniteCanonicalArgmin_unique _ _ _ false
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨by simp, ?_, ?_⟩
    · intro other _
      exact le_rfl
    · intro other _ _
      cases other <;> simp

/-- Below one quantum, upward rounding can merge a strict exact winner with a
larger competitor and expose the secondary ID tie-break. -/
theorem subQuantumGap_canChangeCanonicalId :
    subQuantumExactBoolCost false - subQuantumExactBoolCost true <
        quantum unitScale ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          subQuantumExactBoolCost = true ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          (quantizedUpScalarCost unitScale subQuantumExactBoolCost) = false := by
  exact ⟨by norm_num [subQuantumExactBoolCost, unitScale_quantum],
    subQuantumExactBoolCost_canonicalArgmin_eq_true,
    subQuantumQuantizedCost_canonicalArgmin_eq_false⟩

end Sprawlens.RepresentationIntervalCalibrationFixedPointCost
