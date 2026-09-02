import Mathlib.Data.Prod.Lex
import Sprawlens.RepresentationIntervalCalibrationFixedPointRegret

namespace Sprawlens.RepresentationIntervalCalibrationJointQuantization

open FixedPointEncodedCost
open FixedPointQuantization
open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration
open RepresentationIntervalCalibrationComposition
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive
open RepresentationIntervalCalibrationCostSeparation
open RepresentationIntervalCalibrationFixedPointCost
open RepresentationIntervalCalibrationFixedPointRegret

universe u v w

noncomputable def lexProductSet
    {Left : Type u} {Right : Type v}
    [DecidableEq Left] [DecidableEq Right]
    (left : Finset Left) (right : Finset Right) :
    Finset (Left ×ₗ Right) :=
  (left.product right).map (@toLex (Left × Right)).toEmbedding

@[simp] theorem mem_lexProductSet_iff
    {Left : Type u} {Right : Type v}
    [DecidableEq Left] [DecidableEq Right]
    (left : Finset Left) (right : Finset Right)
    (pair : Left ×ₗ Right) :
    pair ∈ lexProductSet left right ↔
      (ofLex pair).1 ∈ left ∧ (ofLex pair).2 ∈ right := by
  simp [lexProductSet]

theorem lexProductSet_nonempty
    {Left : Type u} {Right : Type v}
    [DecidableEq Left] [DecidableEq Right]
    {left : Finset Left} {right : Finset Right}
    (leftNonempty : left.Nonempty) (rightNonempty : right.Nonempty) :
    (lexProductSet left right).Nonempty := by
  obtain ⟨leftValue, leftMem⟩ := leftNonempty
  obtain ⟨rightValue, rightMem⟩ := rightNonempty
  exact ⟨toLex (leftValue, rightValue), by simp [leftMem, rightMem]⟩

def additivePairCost
    {Left : Type u} {Right : Type v}
    (leftCost : Left → ℝ) (rightCost : Right → ℝ)
    (pair : Left ×ₗ Right) : ℝ :=
  leftCost (ofLex pair).1 + rightCost (ofLex pair).2

/-- Lexicographic canonicalization of an additive product objective factors
into the canonical argmin of each independent component. -/
theorem finiteCanonicalArgmin_additiveLexProduct_eq
    {Left : Type u} {Right : Type v}
    [LinearOrder Left] [LinearOrder Right]
    (left : Finset Left) (right : Finset Right)
    (leftNonempty : left.Nonempty) (rightNonempty : right.Nonempty)
    (leftCost : Left → ℝ) (rightCost : Right → ℝ) :
    finiteCanonicalArgmin (lexProductSet left right)
        (lexProductSet_nonempty leftNonempty rightNonempty)
        (additivePairCost leftCost rightCost) =
      toLex (finiteCanonicalArgmin left leftNonempty leftCost,
        finiteCanonicalArgmin right rightNonempty rightCost) := by
  let leftBest := finiteCanonicalArgmin left leftNonempty leftCost
  let rightBest := finiteCanonicalArgmin right rightNonempty rightCost
  let pairBest : Left ×ₗ Right := toLex (leftBest, rightBest)
  have leftCanonical :=
    finiteCanonicalArgmin_isCanonical left leftNonempty leftCost
  have rightCanonical :=
    finiteCanonicalArgmin_isCanonical right rightNonempty rightCost
  apply isFiniteCanonicalArgmin_unique
    (lexProductSet left right) (additivePairCost leftCost rightCost)
    (finiteCanonicalArgmin (lexProductSet left right)
      (lexProductSet_nonempty leftNonempty rightNonempty)
      (additivePairCost leftCost rightCost)) pairBest
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨?_, ?_, ?_⟩
    · exact mem_lexProductSet_iff left right pairBest |>.2
        ⟨leftCanonical.1, rightCanonical.1⟩
    · intro other otherMem
      have otherParts := (mem_lexProductSet_iff left right other).1 otherMem
      exact add_le_add
        (leftCanonical.2.1 (ofLex other).1 otherParts.1)
        (rightCanonical.2.1 (ofLex other).2 otherParts.2)
    · intro other otherMem costEq
      have otherParts := (mem_lexProductSet_iff left right other).1 otherMem
      have leftLe := leftCanonical.2.1 (ofLex other).1 otherParts.1
      have rightLe := rightCanonical.2.1 (ofLex other).2 otherParts.2
      have leftCostEq : leftCost (ofLex other).1 = leftCost leftBest := by
        unfold additivePairCost at costEq
        dsimp only [pairBest] at costEq
        simp only [ofLex_toLex] at costEq
        linarith
      have rightCostEq : rightCost (ofLex other).2 = rightCost rightBest := by
        unfold additivePairCost at costEq
        dsimp only [pairBest] at costEq
        simp only [ofLex_toLex] at costEq
        linarith
      have leftIdLe := leftCanonical.2.2 (ofLex other).1 otherParts.1
        leftCostEq
      have rightIdLe := rightCanonical.2.2 (ofLex other).2 otherParts.2
        rightCostEq
      rw [Prod.Lex.le_iff']
      simp only [pairBest, ofLex_toLex]
      exact ⟨leftIdLe, fun _ => rightIdLe⟩

noncomputable def activeEndpointPairSet
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    (observedLower observedUpper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) : Finset (Constraint ×ₗ Constraint) :=
  lexProductSet
    (observedLowerActiveSet observedLower artifact constraints nonempty)
    (observedUpperActiveSet observedUpper artifact constraints nonempty)

theorem activeEndpointPairSet_nonempty
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    (observedLower observedUpper : Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty) :
    (activeEndpointPairSet observedLower observedUpper artifact constraints
      nonempty).Nonempty := by
  exact lexProductSet_nonempty
    (observedLowerActiveSet_nonempty observedLower artifact constraints
      nonempty)
    (observedUpperActiveSet_nonempty observedUpper artifact constraints
      nonempty)

noncomputable def activeEndpointPairCost
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (pair : Constraint ×ₗ Constraint) : ℝ :=
  additivePairCost (lowerTraceEnvelopeAt family)
    (upperTraceEnvelopeAt family) pair

noncomputable def exactCanonicalActivePair
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
      observedLower observedUpper artifact constraints) :
    Constraint ×ₗ Constraint :=
  finiteCanonicalArgmin
    (activeEndpointPairSet observedLower observedUpper artifact constraints
      nonempty)
    (activeEndpointPairSet_nonempty observedLower observedUpper artifact
      constraints nonempty)
    (activeEndpointPairCost family)

/-- Joint additive selection does not alter the exact policy: its lexicographic
canonical pair is exactly the two independently canonical active IDs. -/
theorem exactCanonicalActivePair_eq_components
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
      observedLower observedUpper artifact constraints) :
    exactCanonicalActivePair pipeline exactLower exactUpper observedLower
        observedUpper artifact constraints nonempty family =
      toLex
        (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family,
          canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) := by
  exact finiteCanonicalArgmin_additiveLexProduct_eq _ _ _ _ _ _

theorem exactCanonicalActivePair_cost_eq_components
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
      observedLower observedUpper artifact constraints) :
    activeEndpointPairCost family
        (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family) =
      lowerTraceEnvelopeAt family
          (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        upperTraceEnvelopeAt family
          (canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) := by
  rw [exactCanonicalActivePair_eq_components]
  rfl

theorem activeEndpointPairCost_nonnegative
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact} {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    {pair : Constraint ×ₗ Constraint}
    (pairMem : pair ∈ activeEndpointPairSet observedLower observedUpper artifact
      constraints nonempty) :
    0 ≤ activeEndpointPairCost family pair := by
  have parts := (mem_lexProductSet_iff
    (observedLowerActiveSet observedLower artifact constraints nonempty)
    (observedUpperActiveSet observedUpper artifact constraints nonempty)
    pair).1 pairMem
  exact add_nonneg
    (lowerTraceEnvelopeAt_nonnegative_of_active family parts.1)
    (upperTraceEnvelopeAt_nonnegative_of_active family parts.2)

noncomputable def jointQuantizedActivePair
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
    (scale : PositiveScale) : Constraint ×ₗ Constraint :=
  quantizedCanonicalArgmin
    (activeEndpointPairSet observedLower observedUpper artifact constraints
      nonempty)
    (activeEndpointPairSet_nonempty observedLower observedUpper artifact
      constraints nonempty)
    (activeEndpointPairCost family) scale

theorem jointQuantizedActivePair_exactRegret_bounds
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
    0 ≤ activeEndpointPairCost family
          (jointQuantizedActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family scale) -
        activeEndpointPairCost family
          (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family) ∧
      activeEndpointPairCost family
            (jointQuantizedActivePair pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family
                scale) -
          activeEndpointPairCost family
            (exactCanonicalActivePair pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) <
        quantum scale := by
  exact quantizedCanonical_exactRegret_bounds _ _ _ scale
    (fun _ pairMem => activeEndpointPairCost_nonnegative family pairMem)

theorem jointQuantizedActivePair_eq_exact_of_quantumSeparation
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
    (separated : ∀ other ∈
        activeEndpointPairSet observedLower observedUpper artifact constraints
          nonempty,
      other ≠ exactCanonicalActivePair pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family →
      activeEndpointPairCost family
            (exactCanonicalActivePair pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          quantum scale ≤ activeEndpointPairCost family other) :
    jointQuantizedActivePair pipeline exactLower exactUpper observedLower
        observedUpper artifact constraints nonempty family scale =
      exactCanonicalActivePair pipeline exactLower exactUpper observedLower
        observedUpper artifact constraints nonempty family := by
  exact finiteCanonicalArgmin_quantizedUp_eq_of_quantumSeparation _ _ _ scale
    (fun _ pairMem => activeEndpointPairCost_nonnegative family pairMem)
    separated

noncomputable def jointQuantizedActiveGapLowerBound
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
    (scale : PositiveScale) : ℝ :=
  pipeline.lowerSlope artifact *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty -
    quantizedUpScalarCost scale (activeEndpointPairCost family)
      (jointQuantizedActivePair pipeline exactLower exactUpper observedLower
        observedUpper artifact constraints nonempty family scale)

/-- Quantizing the selected lower-plus-upper envelope once halves the generic
certificate degradation interval from two quanta to one. -/
theorem jointQuantizedActiveGapLowerBound_mem_interval
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
    exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family -
        quantum scale <
      jointQuantizedActiveGapLowerBound pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale ∧
    jointQuantizedActiveGapLowerBound pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale ≤
      exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family := by
  have encodedUpper :=
    quantizedCanonical_quantizedCost_lt_exactBest_add_quantum
      (activeEndpointPairSet observedLower observedUpper artifact constraints
        nonempty)
      (activeEndpointPairSet_nonempty observedLower observedUpper artifact
        constraints nonempty)
      (activeEndpointPairCost family) scale
      (fun _ pairMem => activeEndpointPairCost_nonnegative family pairMem)
  change
    quantizedUpScalarCost scale (activeEndpointPairCost family)
          (jointQuantizedActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family scale) <
      activeEndpointPairCost family
          (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family) +
        quantum scale at encodedUpper
  have exactRegret := jointQuantizedActivePair_exactRegret_bounds pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale
  have exactSelectedLeEncoded :
      activeEndpointPairCost family
          (jointQuantizedActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family scale) ≤
        quantizedUpScalarCost scale (activeEndpointPairCost family)
          (jointQuantizedActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family scale) :=
    value_le_decode_quantizeUp scale _
  have encodedLower :
      activeEndpointPairCost family
          (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family) ≤
        quantizedUpScalarCost scale (activeEndpointPairCost family)
          (jointQuantizedActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family scale) := by
    linarith [exactRegret.1]
  have exactCostEq := exactCanonicalActivePair_cost_eq_components pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family
  constructor
  · unfold exactCanonicalActiveGapLowerBound
      jointQuantizedActiveGapLowerBound
    linarith
  · unfold exactCanonicalActiveGapLowerBound
      jointQuantizedActiveGapLowerBound
    linarith

/-- Production-oriented path: keep the exact canonical IDs and encode only
their already-minimized envelope sum. No product search is required. -/
noncomputable def encodedExactCanonicalActiveEnvelopeSum
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
    (scale : PositiveScale) : ℝ :=
  quantizedUpScalarCost scale (activeEndpointPairCost family)
    (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
      observedUpper artifact constraints nonempty family)

theorem encodedExactCanonicalActiveEnvelopeSum_eq_quantizedComponentSum
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
    encodedExactCanonicalActiveEnvelopeSum pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family scale =
      decode (quantizeUp scale
        (lowerTraceEnvelopeAt family
            (canonicalLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          upperTraceEnvelopeAt family
            (canonicalUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty
                family))) := by
  unfold encodedExactCanonicalActiveEnvelopeSum quantizedUpScalarCost
  rw [exactCanonicalActivePair_cost_eq_components]

noncomputable def encodedExactCanonicalActiveGapLowerBound
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
    (scale : PositiveScale) : ℝ :=
  pipeline.lowerSlope artifact *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty -
    encodedExactCanonicalActiveEnvelopeSum pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family scale

/-- Choosing exact canonical IDs first and serializing their sum once always
preserves ID determinism and keeps the decoded bound in `(B - q, B]`, without
any pair-objective separation premise. -/
theorem encodedExactCanonicalActiveGapLowerBound_mem_interval
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
    exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family -
        quantum scale <
      encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale ∧
    encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale ≤
      exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family := by
  have exactPairMem :
      exactCanonicalActivePair pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family ∈
        activeEndpointPairSet observedLower observedUpper artifact constraints
          nonempty := by
    exact finiteCanonicalArgmin_mem _ _ _
  have pairCostNonnegative :
      0 ≤ activeEndpointPairCost family
        (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family) :=
    activeEndpointPairCost_nonnegative family exactPairMem
  have encodedLower :
      activeEndpointPairCost family
          (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
            observedUpper artifact constraints nonempty family) ≤
        encodedExactCanonicalActiveEnvelopeSum pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale :=
    value_le_decode_quantizeUp scale _
  have encodedUpper :
      encodedExactCanonicalActiveEnvelopeSum pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family
            scale <
        activeEndpointPairCost family
            (exactCanonicalActivePair pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          quantum scale :=
    decode_quantizeUp_lt_add_quantum scale pairCostNonnegative
  have exactCostEq := exactCanonicalActivePair_cost_eq_components pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family
  constructor
  · unfold exactCanonicalActiveGapLowerBound
      encodedExactCanonicalActiveGapLowerBound
    linarith
  · unfold exactCanonicalActiveGapLowerBound
      encodedExactCanonicalActiveGapLowerBound
    linarith

theorem exactGap_pos_of_exactCanonicalActiveGapLowerBound_pos
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
    (boundPositive : 0 <
      exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family) :
    0 < intervalFeasibilityGap exactLower exactUpper artifact constraints
      nonempty := by
  have exactPairMem :
      exactCanonicalActivePair pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family ∈
        activeEndpointPairSet observedLower observedUpper artifact constraints
          nonempty := by
    exact finiteCanonicalArgmin_mem _ _ _
  have pairCostNonnegative :
      0 ≤ activeEndpointPairCost family
        (exactCanonicalActivePair pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family) :=
    activeEndpointPairCost_nonnegative family exactPairMem
  have exactCostEq := exactCanonicalActivePair_cost_eq_components pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family
  have envelopeSumNonnegative :
      0 ≤ lowerTraceEnvelopeAt family
            (canonicalLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          upperTraceEnvelopeAt family
            (canonicalUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) := by
    rw [← exactCostEq]
    exact pairCostNonnegative
  have lowerSlopeNonnegative : 0 ≤ pipeline.lowerSlope artifact :=
    (secantDistortion pipeline artifact).1
  by_contra gapNotPositive
  have gapNonpositive :
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty ≤ 0 := le_of_not_gt gapNotPositive
  have productNonpositive :
      pipeline.lowerSlope artifact *
        intervalFeasibilityGap exactLower exactUpper artifact constraints
          nonempty ≤ 0 :=
    mul_nonpos_of_nonneg_of_nonpos lowerSlopeNonnegative gapNonpositive
  unfold exactCanonicalActiveGapLowerBound at boundPositive
  linarith

theorem exactGap_pos_of_quantum_le_exactCanonicalActiveGapLowerBound
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
    0 < intervalFeasibilityGap exactLower exactUpper artifact constraints
      nonempty := by
  apply exactGap_pos_of_exactCanonicalActiveGapLowerBound_pos pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family
  exact (quantum_pos scale).trans_le quantumLe

theorem encodedExactCanonicalActiveGapLowerBound_le_observedGap
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
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty) :
    encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family scale ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  exact (encodedExactCanonicalActiveGapLowerBound_mem_interval pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale).2.trans
    (exactCanonicalActiveGapLowerBound_le_observedGap pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family exactFeasible)

theorem encodedExactCanonicalActiveGapLowerBound_pos_of_quantum_le
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
    0 < encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family scale := by
  have interval := encodedExactCanonicalActiveGapLowerBound_mem_interval
    pipeline exactLower exactUpper observedLower observedUpper artifact
      constraints nonempty family scale
  linarith

/-- Runtime acceptance can inspect the encoded bound directly. Strict
positivity alone implies exact feasibility and an observed common center. -/
theorem observedCommonCenter_of_encodedExactCanonicalActiveGapLowerBound_pos
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
    (encodedPositive : 0 <
      encodedExactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family scale) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  have encodedInterval :=
    encodedExactCanonicalActiveGapLowerBound_mem_interval pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family scale
  have exactBoundPositive : 0 <
      exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family :=
    encodedPositive.trans_le encodedInterval.2
  have exactGapPositive :=
    exactGap_pos_of_exactCanonicalActiveGapLowerBound_pos pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family exactBoundPositive
  have encodedLeObserved :=
    encodedExactCanonicalActiveGapLowerBound_le_observedGap pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family scale exactGapPositive.le
  apply (commonCenter_iff_feasibilityGap_nonnegative observedLower observedUpper
    artifact constraints nonempty).mpr
  exact encodedPositive.le.trans encodedLeObserved

/-- A single machine-checkable gate, `quantum ≤ exact canonical bound`, is
enough for the sum-only fixed-point report to certify an observed common
center. Exact feasibility follows from the gate rather than being assumed. -/
theorem observedCommonCenter_of_quantum_le_exactCanonicalActiveGapLowerBound
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
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  have encodedPositive :=
    encodedExactCanonicalActiveGapLowerBound_pos_of_quantum_le pipeline
      exactLower exactUpper observedLower observedUpper artifact constraints
        nonempty family scale quantumLe
  exact observedCommonCenter_of_encodedExactCanonicalActiveGapLowerBound_pos
    pipeline exactLower exactUpper observedLower observedUpper artifact
      constraints nonempty family scale encodedPositive

noncomputable def oneTenth : ℝ :=
  1 / 10

theorem unitScale_quantizedUp_oneTenth_eq_one :
    decode (quantizeUp unitScale oneTenth) = 1 := by
  have ceilTenth : ⌈(oneTenth : ℝ)⌉₊ = 1 := by
    rw [Nat.ceil_eq_iff (by norm_num : (1 : Nat) ≠ 0)]
    norm_num [oneTenth]
  rw [decode_quantizeUp]
  norm_num [unitScale, ceilTenth]

theorem unitScale_quantizedUp_twoTenths_eq_one :
    decode (quantizeUp unitScale (oneTenth + oneTenth)) = 1 := by
  have ceilTwoTenths : ⌈(oneTenth + oneTenth : ℝ)⌉₊ = 1 := by
    rw [Nat.ceil_eq_iff (by norm_num : (1 : Nat) ≠ 0)]
    norm_num [oneTenth]
  rw [decode_quantizeUp]
  norm_num [unitScale, ceilTwoTenths]

/-- Two separately encoded endpoint envelopes consume two units, while
encoding their exact sum once consumes only one. -/
theorem jointQuantization_halves_fixture_encoded_sum :
    decode (quantizeUp unitScale oneTenth) +
          decode (quantizeUp unitScale oneTenth) = 2 ∧
      decode (quantizeUp unitScale (oneTenth + oneTenth)) = 1 ∧
      decode (quantizeUp unitScale (oneTenth + oneTenth)) <
        decode (quantizeUp unitScale oneTenth) +
          decode (quantizeUp unitScale oneTenth) := by
  rw [unitScale_quantizedUp_oneTenth_eq_one,
    unitScale_quantizedUp_twoTenths_eq_one]
  norm_num

def zeroSlope (_artifact : Unit) : ℝ :=
  0

theorem identityCalibration_secantDistortion_zero_one_on_all :
    SecantDistortionOnAt artifactWideIdentity zeroSlope hingeLowerSlope
      allCalibrationDomain () := by
  refine ⟨by norm_num [zeroSlope], by norm_num [zeroSlope, hingeLowerSlope], ?_⟩
  intro first _ second _ ordered
  change
    0 * (second - first) ≤
          identityCalibration second - identityCalibration first ∧
      identityCalibration second - identityCalibration first ≤
        1 * (second - first)
  simp only [identityCalibration, OrderEmbedding.coe_ofStrictMono, id_eq]
  constructor
  · simpa using sub_nonneg.mpr ordered
  · simpa only [one_mul] using le_refl (second - first)

noncomputable def zeroLowerIdentityStage :
    CalibrationStage Unit allCalibrationDomain allCalibrationDomain where
  calibration := artifactWideIdentity
  lowerSlope := zeroSlope
  upperSlope := hingeLowerSlope
  distortion := fun _ => identityCalibration_secantDistortion_zero_one_on_all
  mapsDomain := by
    intro _ value _
    simp [allCalibrationDomain]

noncomputable def zeroLowerIdentityPipeline :
    CalibrationPipeline Unit allCalibrationDomain allCalibrationDomain :=
  .single zeroLowerIdentityStage

def zeroBoundaryLower (_artifact : Unit) (_constraint : Unit) : ℝ :=
  1

def zeroBoundaryUpper (_artifact : Unit) (_constraint : Unit) : ℝ :=
  0

noncomputable def zeroBoundaryLowerTrace :
    StagewiseResidualTraceAt () zeroLowerIdentityPipeline 1 := by
  refine .single zeroLowerIdentityStage 1 1 0
    (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_
  change |(1 : ℝ) - 1| ≤ 0
  norm_num

noncomputable def zeroBoundaryUpperTrace :
    StagewiseResidualTraceAt () zeroLowerIdentityPipeline 0 := by
  refine .single zeroLowerIdentityStage 0 0 0
    (by simp [allCalibrationDomain])
    (by simp [allCalibrationDomain]) (by norm_num) ?_
  change |(0 : ℝ) - 0| ≤ 0
  norm_num

noncomputable def zeroBoundaryTraceFamily :
    @StagewiseIntervalTraceFamilyAt Unit Unit
      (fun first second => LinearOrder.toDecidableEq first second)
      allCalibrationDomain allCalibrationDomain zeroLowerIdentityPipeline
      zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower zeroBoundaryUpper ()
        Finset.univ where
  lowerTrace := fun _ _ => zeroBoundaryLowerTrace
  lowerOutput := by
    intro constraint _
    cases constraint
    rfl
  upperTrace := fun _ _ => zeroBoundaryUpperTrace
  upperOutput := by
    intro constraint _
    cases constraint
    rfl

theorem zeroBoundary_gap_eq_neg_one :
    @intervalFeasibilityGap Unit Unit
      (fun first second => LinearOrder.toDecidableEq first second)
      zeroBoundaryLower zeroBoundaryUpper () (Finset.univ : Finset Unit)
        Finset.univ_nonempty = -1 := by
  have maxEq :
      @maxLowerCenter Unit Unit
        (fun first second => LinearOrder.toDecidableEq first second)
        zeroBoundaryLower () (Finset.univ : Finset Unit)
          Finset.univ_nonempty = 1 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      @maxLowerCenter_is_attained Unit Unit
        (fun first second => LinearOrder.toDecidableEq first second)
        zeroBoundaryLower () (Finset.univ : Finset Unit)
          Finset.univ_nonempty
    cases constraint
    simpa [zeroBoundaryLower] using endpointEq.symm
  have minEq :
      @minUpperCenter Unit Unit
        (fun first second => LinearOrder.toDecidableEq first second)
        zeroBoundaryUpper () (Finset.univ : Finset Unit)
          Finset.univ_nonempty = 0 := by
    obtain ⟨constraint, _, endpointEq⟩ :=
      @minUpperCenter_is_attained Unit Unit
        (fun first second => LinearOrder.toDecidableEq first second)
        zeroBoundaryUpper () (Finset.univ : Finset Unit)
          Finset.univ_nonempty
    cases constraint
    simpa [zeroBoundaryUpper] using endpointEq.symm
  rw [intervalFeasibilityGap, maxEq, minEq]
  norm_num

theorem zeroBoundary_canonicalEnvelopeSum_eq_zero :
    lowerTraceEnvelopeAt zeroBoundaryTraceFamily
          (canonicalLowerActiveConstraint zeroLowerIdentityPipeline
            zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower
              zeroBoundaryUpper () (Finset.univ : Finset Unit)
                Finset.univ_nonempty zeroBoundaryTraceFamily) +
        upperTraceEnvelopeAt zeroBoundaryTraceFamily
          (canonicalUpperActiveConstraint zeroLowerIdentityPipeline
            zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower
              zeroBoundaryUpper () (Finset.univ : Finset Unit)
                Finset.univ_nonempty zeroBoundaryTraceFamily) = 0 := by
  have lowerId :
      canonicalLowerActiveConstraint zeroLowerIdentityPipeline
          zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower
            zeroBoundaryUpper () (Finset.univ : Finset Unit)
              Finset.univ_nonempty zeroBoundaryTraceFamily = () :=
    Subsingleton.elim _ _
  have upperId :
      canonicalUpperActiveConstraint zeroLowerIdentityPipeline
          zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower
            zeroBoundaryUpper () (Finset.univ : Finset Unit)
              Finset.univ_nonempty zeroBoundaryTraceFamily = () :=
    Subsingleton.elim _ _
  rw [lowerId, upperId]
  change (0 : ℝ) + 0 = 0
  norm_num

theorem zeroBoundary_encodedEnvelopeSum_eq_zero :
    encodedExactCanonicalActiveEnvelopeSum zeroLowerIdentityPipeline
      zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower zeroBoundaryUpper ()
        (Finset.univ : Finset Unit) Finset.univ_nonempty
          zeroBoundaryTraceFamily unitScale = 0 := by
  rw [encodedExactCanonicalActiveEnvelopeSum_eq_quantizedComponentSum,
    zeroBoundary_canonicalEnvelopeSum_eq_zero]
  norm_num [decode_quantizeUp, unitScale]

theorem zeroBoundary_encodedGapLowerBound_eq_zero :
    encodedExactCanonicalActiveGapLowerBound zeroLowerIdentityPipeline
      zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower zeroBoundaryUpper ()
        (Finset.univ : Finset Unit) Finset.univ_nonempty
          zeroBoundaryTraceFamily unitScale = 0 := by
  unfold encodedExactCanonicalActiveGapLowerBound
  rw [zeroBoundary_gap_eq_neg_one, zeroBoundary_encodedEnvelopeSum_eq_zero]
  norm_num [zeroLowerIdentityPipeline, zeroLowerIdentityStage,
    CalibrationPipeline.lowerSlope, zeroSlope]

theorem zeroBoundary_has_no_observedCommonCenter :
    ¬CommonIntervalCenterAt zeroBoundaryLower zeroBoundaryUpper ()
      (Finset.univ : Finset Unit) := by
  intro centerExists
  obtain ⟨center, accepted⟩ := centerExists
  have unitAccepted := accepted () (by simp)
  change 1 ≤ center ∧ center ≤ 0 at unitAccepted
  linarith [unitAccepted.1, unitAccepted.2]

/-- Replacing the runtime strict-positive check with nonnegativity is
unsound: a valid zero-lower-slope calibration has encoded bound zero while
the observed interval family is infeasible. -/
theorem nonnegativeEncodedGapBound_does_not_imply_commonCenter :
    0 ≤ encodedExactCanonicalActiveGapLowerBound zeroLowerIdentityPipeline
          zeroBoundaryLower zeroBoundaryUpper zeroBoundaryLower
            zeroBoundaryUpper () (Finset.univ : Finset Unit)
              Finset.univ_nonempty zeroBoundaryTraceFamily unitScale ∧
      ¬CommonIntervalCenterAt zeroBoundaryLower zeroBoundaryUpper ()
        (Finset.univ : Finset Unit) := by
  rw [zeroBoundary_encodedGapLowerBound_eq_zero]
  exact ⟨le_rfl, zeroBoundary_has_no_observedCommonCenter⟩

end Sprawlens.RepresentationIntervalCalibrationJointQuantization
