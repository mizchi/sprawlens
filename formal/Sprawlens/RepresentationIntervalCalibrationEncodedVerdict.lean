import Sprawlens.RepresentationIntervalCalibrationJointQuantization

namespace Sprawlens.RepresentationIntervalCalibrationEncodedVerdict

open FixedPointEncodedCost
open FixedPointQuantization
open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationEndpointResidual
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive
open RepresentationIntervalCalibrationCostSeparation
open RepresentationIntervalCalibrationFixedPointCost
open RepresentationIntervalCalibrationFixedPointRegret
open RepresentationIntervalCalibrationJointQuantization

universe u v

inductive EncodedCommonCenterVerdict where
  | certifiedCommonCenter
  | inconclusive
deriving DecidableEq, Repr

noncomputable def positiveBoundVerdict (bound : ℝ) : EncodedCommonCenterVerdict :=
  if 0 < bound then .certifiedCommonCenter else .inconclusive

@[simp] theorem positiveBoundVerdict_eq_certified_iff (bound : ℝ) :
    positiveBoundVerdict bound = .certifiedCommonCenter ↔ 0 < bound := by
  unfold positiveBoundVerdict
  by_cases positive : 0 < bound <;> simp [positive]

@[simp] theorem positiveBoundVerdict_eq_inconclusive_iff (bound : ℝ) :
    positiveBoundVerdict bound = .inconclusive ↔ bound ≤ 0 := by
  unfold positiveBoundVerdict
  by_cases positive : 0 < bound
  · simp [positive, not_le_of_gt positive]
  · simp [positive, le_of_not_gt positive]

noncomputable def encodedExactCanonicalActiveVerdict
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
    (scale : PositiveScale) : EncodedCommonCenterVerdict :=
  positiveBoundVerdict
    (encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family scale)

@[simp] theorem encodedExactCanonicalActiveVerdict_eq_certified_iff
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
    (scale : PositiveScale) :
    encodedExactCanonicalActiveVerdict pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale = .certifiedCommonCenter ↔
      0 < encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family scale := by
  exact positiveBoundVerdict_eq_certified_iff _

/-- The public certified branch is sound for the observed interval family. -/
theorem encodedExactCanonicalActiveVerdict_certified_sound
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
    (certified : encodedExactCanonicalActiveVerdict pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family scale = .certifiedCommonCenter) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply observedCommonCenter_of_encodedExactCanonicalActiveGapLowerBound_pos
    pipeline exactLower exactUpper observedLower observedUpper artifact
      constraints nonempty family scale
  exact (encodedExactCanonicalActiveVerdict_eq_certified_iff pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale).mp certified

/-- A one-quantum exact bound is a design-time completeness condition for the
runtime certified branch. -/
theorem encodedExactCanonicalActiveVerdict_certified_of_quantum_le
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
    (quantumLe : quantum scale ≤
      exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family) :
    encodedExactCanonicalActiveVerdict pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family scale =
        .certifiedCommonCenter := by
  rw [encodedExactCanonicalActiveVerdict_eq_certified_iff]
  exact encodedExactCanonicalActiveGapLowerBound_pos_of_quantum_le pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale quantumLe

/-- If the exact canonical lower bound is nonpositive, upward sum encoding
cannot produce the certified branch. -/
theorem encodedExactCanonicalActiveVerdict_inconclusive_of_exactBound_nonpositive
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
    (nonpositive : exactCanonicalActiveGapLowerBound pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family ≤ 0) :
    encodedExactCanonicalActiveVerdict pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family scale =
        .inconclusive := by
  unfold encodedExactCanonicalActiveVerdict
  rw [positiveBoundVerdict_eq_inconclusive_iff]
  exact (encodedExactCanonicalActiveGapLowerBound_mem_interval pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale).2.trans nonpositive

def stableZeroEndpoint (_artifact : Unit) (_constraint : Unit) : ℝ :=
  0

noncomputable def stableZeroTraceFamily :
    @StagewiseIntervalTraceFamilyAt Unit Unit
      (fun first second => LinearOrder.toDecidableEq first second)
      allCalibrationDomain allCalibrationDomain zeroLowerIdentityPipeline
      stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
        stableZeroEndpoint () Finset.univ where
  lowerTrace := fun _ _ => zeroBoundaryUpperTrace
  lowerOutput := by
    intro constraint _
    cases constraint
    rfl
  upperTrace := fun _ _ => zeroBoundaryUpperTrace
  upperOutput := by
    intro constraint _
    cases constraint
    rfl

theorem stableZero_canonicalEnvelopeSum_eq_zero :
    lowerTraceEnvelopeAt stableZeroTraceFamily
          (canonicalLowerActiveConstraint zeroLowerIdentityPipeline
            stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
              stableZeroEndpoint () (Finset.univ : Finset Unit)
                Finset.univ_nonempty stableZeroTraceFamily) +
        upperTraceEnvelopeAt stableZeroTraceFamily
          (canonicalUpperActiveConstraint zeroLowerIdentityPipeline
            stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
              stableZeroEndpoint () (Finset.univ : Finset Unit)
                Finset.univ_nonempty stableZeroTraceFamily) = 0 := by
  have lowerId :
      canonicalLowerActiveConstraint zeroLowerIdentityPipeline
          stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
            stableZeroEndpoint () (Finset.univ : Finset Unit)
              Finset.univ_nonempty stableZeroTraceFamily = () :=
    Subsingleton.elim _ _
  have upperId :
      canonicalUpperActiveConstraint zeroLowerIdentityPipeline
          stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
            stableZeroEndpoint () (Finset.univ : Finset Unit)
              Finset.univ_nonempty stableZeroTraceFamily = () :=
    Subsingleton.elim _ _
  rw [lowerId, upperId]
  change (0 : ℝ) + 0 = 0
  norm_num

theorem stableZero_encodedEnvelopeSum_eq_zero :
    encodedExactCanonicalActiveEnvelopeSum zeroLowerIdentityPipeline
      stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
        stableZeroEndpoint () (Finset.univ : Finset Unit)
          Finset.univ_nonempty stableZeroTraceFamily unitScale = 0 := by
  rw [encodedExactCanonicalActiveEnvelopeSum_eq_quantizedComponentSum,
    stableZero_canonicalEnvelopeSum_eq_zero]
  norm_num [decode_quantizeUp, unitScale]

theorem stableZero_encodedGapLowerBound_eq_zero :
    encodedExactCanonicalActiveGapLowerBound zeroLowerIdentityPipeline
      stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
        stableZeroEndpoint () (Finset.univ : Finset Unit)
          Finset.univ_nonempty stableZeroTraceFamily unitScale = 0 := by
  unfold encodedExactCanonicalActiveGapLowerBound
  rw [stableZero_encodedEnvelopeSum_eq_zero]
  norm_num [zeroLowerIdentityPipeline, zeroLowerIdentityStage,
    CalibrationPipeline.lowerSlope, zeroSlope]

theorem stableZero_has_observedCommonCenter :
    CommonIntervalCenterAt stableZeroEndpoint stableZeroEndpoint ()
      (Finset.univ : Finset Unit) := by
  refine ⟨0, ?_⟩
  intro constraint _
  cases constraint
  exact ⟨le_rfl, le_rfl⟩

theorem zeroBoundary_verdict_inconclusive :
    encodedExactCanonicalActiveVerdict zeroLowerIdentityPipeline
      zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower zeroBoundaryUpper ()
        (Finset.univ : Finset Unit) Finset.univ_nonempty
          zeroBoundaryTraceFamily unitScale = .inconclusive := by
  unfold encodedExactCanonicalActiveVerdict
  rw [zeroBoundary_encodedGapLowerBound_eq_zero]
  simp

theorem stableZero_verdict_inconclusive :
    encodedExactCanonicalActiveVerdict zeroLowerIdentityPipeline
      stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
        stableZeroEndpoint () (Finset.univ : Finset Unit)
          Finset.univ_nonempty stableZeroTraceFamily unitScale = .inconclusive := by
  unfold encodedExactCanonicalActiveVerdict
  rw [stableZero_encodedGapLowerBound_eq_zero]
  simp

/-- The zero encoded boundary contains both feasible and infeasible systems;
therefore the only sound binary refinement is to leave it inconclusive. -/
theorem zeroEncodedBound_has_divergentCommonCenterSemantics :
    encodedExactCanonicalActiveVerdict zeroLowerIdentityPipeline
          zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower
            zeroBoundaryUpper () (Finset.univ : Finset Unit)
              Finset.univ_nonempty zeroBoundaryTraceFamily unitScale =
        .inconclusive ∧
      encodedExactCanonicalActiveVerdict zeroLowerIdentityPipeline
          stableZeroEndpoint stableZeroEndpoint stableZeroEndpoint
            stableZeroEndpoint () (Finset.univ : Finset Unit)
              Finset.univ_nonempty stableZeroTraceFamily unitScale =
        .inconclusive ∧
      ¬CommonIntervalCenterAt zeroBoundaryLower zeroBoundaryUpper ()
        (Finset.univ : Finset Unit) ∧
      CommonIntervalCenterAt stableZeroEndpoint stableZeroEndpoint ()
        (Finset.univ : Finset Unit) := by
  exact ⟨zeroBoundary_verdict_inconclusive, stableZero_verdict_inconclusive,
    zeroBoundary_has_no_observedCommonCenter,
    stableZero_has_observedCommonCenter⟩

end Sprawlens.RepresentationIntervalCalibrationEncodedVerdict
