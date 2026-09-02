import Sprawlens.RepresentationIntervalCalibrationIdCodec

namespace Sprawlens.RepresentationIntervalCalibrationCostEncoding

open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive
open RepresentationIntervalCalibrationIdCodec

universe u v

/-- Strict order preservation of serialized envelope costs is sufficient to
preserve the complete two-key canonical argmin, including its ID tie-break. -/
theorem finiteCanonicalArgmin_costOrderEmbedding_eq
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (transform : ℝ ↪o ℝ) :
    finiteCanonicalArgmin indices nonempty
        (fun index => transform (cost index)) =
      finiteCanonicalArgmin indices nonempty cost := by
  apply isFiniteCanonicalArgmin_unique indices
    (fun index => transform (cost index))
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · have sourceCanonical :=
      finiteCanonicalArgmin_isCanonical indices nonempty cost
    refine ⟨sourceCanonical.1, ?_, ?_⟩
    · intro other otherMem
      exact transform.monotone (sourceCanonical.2.1 other otherMem)
    · intro other otherMem transformedEq
      exact sourceCanonical.2.2 other otherMem
        (transform.injective transformedEq)

theorem canonicalActiveConstraints_costOrderEmbedding_eq
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
    (transform : ℝ ↪o ℝ) :
    finiteCanonicalArgmin
          (observedLowerActiveSet observedLower artifact constraints nonempty)
          (observedLowerActiveSet_nonempty observedLower artifact constraints
            nonempty)
          (fun constraint => transform (lowerTraceEnvelopeAt family constraint)) =
        canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family ∧
      finiteCanonicalArgmin
          (observedUpperActiveSet observedUpper artifact constraints nonempty)
          (observedUpperActiveSet_nonempty observedUpper artifact constraints
            nonempty)
          (fun constraint => transform (upperTraceEnvelopeAt family constraint)) =
        canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family := by
  exact ⟨finiteCanonicalArgmin_costOrderEmbedding_eq _ _ _ transform,
    finiteCanonicalArgmin_costOrderEmbedding_eq _ _ _ transform⟩

def strictBoolCost (id : Bool) : ℝ :=
  if id then 0 else 1

theorem true_isCanonical_strictBoolCost :
    IsFiniteCanonicalArgmin Finset.univ strictBoolCost true := by
  refine ⟨by simp, ?_, ?_⟩
  · intro other _
    cases other <;> norm_num [strictBoolCost]
  · intro other _ costEq
    cases other
    · norm_num [strictBoolCost] at costEq
    · exact le_rfl

theorem strictBoolCost_canonicalArgmin_eq_true :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
      strictBoolCost = true := by
  exact isFiniteCanonicalArgmin_unique _ _ _ true
    (finiteCanonicalArgmin_isCanonical _ _ _)
    true_isCanonical_strictBoolCost

def collapseCost (_cost : ℝ) : ℝ :=
  0

theorem collapseCost_monotone : Monotone collapseCost := by
  intro _ _ _
  exact le_rfl

theorem collapseCost_not_injective : ¬ Function.Injective collapseCost := by
  intro injective
  have zeroEqOne : (0 : ℝ) = 1 := injective rfl
  norm_num at zeroEqOne

theorem collapsedStrictBoolCost_eq_zeroBoolCost :
    (fun id => collapseCost (strictBoolCost id)) = zeroBoolCost := by
  funext id
  rfl

/-- Non-injective rounding can create a tie and let the secondary ID order
replace the true minimum-cost ID. -/
theorem collapsedCost_changes_canonicalId :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
          strictBoolCost = true ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
          (fun id => collapseCost (strictBoolCost id)) = false := by
  rw [strictBoolCost_canonicalArgmin_eq_true,
    collapsedStrictBoolCost_eq_zeroBoolCost,
    zeroBoolCost_canonicalArgmin_eq_false]
  exact ⟨rfl, rfl⟩

def doubleShiftCostValue (cost : ℝ) : ℝ :=
  2 * cost + 7

noncomputable def doubleShiftCost : ℝ ↪o ℝ :=
  OrderEmbedding.ofStrictMono doubleShiftCostValue (by
    intro first second firstLtSecond
    unfold doubleShiftCostValue
    linarith)

theorem doubleShiftCost_preserves_strictBoolCanonicalId :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
        (fun id => doubleShiftCost (strictBoolCost id)) = true := by
  calc
    finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
          (fun id => doubleShiftCost (strictBoolCost id)) =
        finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
          strictBoolCost :=
      finiteCanonicalArgmin_costOrderEmbedding_eq _ _ _ doubleShiftCost
    _ = true := strictBoolCost_canonicalArgmin_eq_true

end Sprawlens.RepresentationIntervalCalibrationCostEncoding
