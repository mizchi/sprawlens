import Sprawlens.RepresentationIntervalCalibrationFixedPointCost

namespace Sprawlens.RepresentationIntervalCalibrationFixedPointRegret

open FixedPointEncodedCost
open FixedPointQuantization
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalRobustness
open RepresentationIntervalCalibrationResidualPropagation
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive
open RepresentationIntervalCalibrationCostSeparation
open RepresentationIntervalCalibrationFixedPointCost

universe u v

noncomputable def quantizedCanonicalArgmin
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (scale : PositiveScale) : Index :=
  finiteCanonicalArgmin indices nonempty (quantizedUpScalarCost scale cost)

/-- Even without enough separation to preserve the ID, the encoded cost of
the quantized winner is strictly below the exact optimum plus one quantum. -/
theorem quantizedCanonical_quantizedCost_lt_exactBest_add_quantum
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (scale : PositiveScale)
    (costNonnegative : ∀ index ∈ indices, 0 ≤ cost index) :
    quantizedUpScalarCost scale cost
        (quantizedCanonicalArgmin indices nonempty cost scale) <
      cost (finiteCanonicalArgmin indices nonempty cost) + quantum scale := by
  let selected := quantizedCanonicalArgmin indices nonempty cost scale
  let best := finiteCanonicalArgmin indices nonempty cost
  have bestMem : best ∈ indices :=
    finiteCanonicalArgmin_mem indices nonempty cost
  have selectedLeBest :
      quantizedUpScalarCost scale cost selected ≤
        quantizedUpScalarCost scale cost best := by
    exact finiteCanonicalArgmin_cost_le indices nonempty
      (quantizedUpScalarCost scale cost) best bestMem
  have bestUpper : quantizedUpScalarCost scale cost best <
      cost best + quantum scale :=
    decode_quantizeUp_lt_add_quantum scale
      (costNonnegative best bestMem)
  exact selectedLeBest.trans_lt bestUpper

/-- The exact cost of the quantized winner has nonnegative regret and that
regret is strictly less than one quantum. -/
theorem quantizedCanonical_exactRegret_bounds
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (scale : PositiveScale)
    (costNonnegative : ∀ index ∈ indices, 0 ≤ cost index) :
    0 ≤ cost (quantizedCanonicalArgmin indices nonempty cost scale) -
          cost (finiteCanonicalArgmin indices nonempty cost) ∧
      cost (quantizedCanonicalArgmin indices nonempty cost scale) -
          cost (finiteCanonicalArgmin indices nonempty cost) < quantum scale := by
  let selected := quantizedCanonicalArgmin indices nonempty cost scale
  let best := finiteCanonicalArgmin indices nonempty cost
  have selectedMem : selected ∈ indices :=
    finiteCanonicalArgmin_mem indices nonempty
      (quantizedUpScalarCost scale cost)
  have bestLeSelected : cost best ≤ cost selected :=
    finiteCanonicalArgmin_cost_le indices nonempty cost selected selectedMem
  have selectedExactLeQuantized :
      cost selected ≤ quantizedUpScalarCost scale cost selected :=
    value_le_decode_quantizeUp scale (cost selected)
  have quantizedUpper : quantizedUpScalarCost scale cost selected <
      cost best + quantum scale :=
    quantizedCanonical_quantizedCost_lt_exactBest_add_quantum
      indices nonempty cost scale costNonnegative
  constructor <;> linarith

noncomputable def quantizedLowerActiveConstraint
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
    (scale : PositiveScale) : Constraint :=
  quantizedCanonicalArgmin
    (observedLowerActiveSet observedLower artifact constraints nonempty)
    (observedLowerActiveSet_nonempty observedLower artifact constraints
      nonempty)
    (lowerTraceEnvelopeAt family) scale

noncomputable def quantizedUpperActiveConstraint
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
    (scale : PositiveScale) : Constraint :=
  quantizedCanonicalArgmin
    (observedUpperActiveSet observedUpper artifact constraints nonempty)
    (observedUpperActiveSet_nonempty observedUpper artifact constraints
      nonempty)
    (upperTraceEnvelopeAt family) scale

theorem lowerTraceEnvelopeAt_nonnegative_of_active
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact}
    {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    {constraint : Constraint}
    (active : constraint ∈
      observedLowerActiveSet observedLower artifact constraints nonempty) :
    0 ≤ lowerTraceEnvelopeAt family constraint := by
  have constraintMem := (Finset.mem_filter.mp active).1
  simp only [lowerTraceEnvelopeAt, dif_pos constraintMem]
  exact stagewiseResidualTrace_residualEnvelope_nonnegative _

theorem upperTraceEnvelopeAt_nonnegative_of_active
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    {source target : Artifact → Set ℝ}
    {pipeline : CalibrationPipeline Artifact source target}
    {exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ}
    {artifact : Artifact}
    {constraints : Finset Constraint}
    {nonempty : constraints.Nonempty}
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    {constraint : Constraint}
    (active : constraint ∈
      observedUpperActiveSet observedUpper artifact constraints nonempty) :
    0 ≤ upperTraceEnvelopeAt family constraint := by
  have constraintMem := (Finset.mem_filter.mp active).1
  simp only [upperTraceEnvelopeAt, dif_pos constraintMem]
  exact stagewiseResidualTrace_residualEnvelope_nonnegative _

/-- Each active endpoint's exact envelope regret stays below one quantum,
regardless of whether fixed-point ties change either canonical ID. -/
theorem quantizedActiveConstraints_exactRegret_bounds
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
    0 ≤ lowerTraceEnvelopeAt family
          (quantizedLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) -
        lowerTraceEnvelopeAt family
          (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) ∧
      lowerTraceEnvelopeAt family
            (quantizedLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family
                scale) -
          lowerTraceEnvelopeAt family
            (canonicalLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) <
        quantum scale ∧
      0 ≤ upperTraceEnvelopeAt family
          (quantizedUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) -
        upperTraceEnvelopeAt family
          (canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) ∧
      upperTraceEnvelopeAt family
            (quantizedUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family
                scale) -
          upperTraceEnvelopeAt family
            (canonicalUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) <
        quantum scale := by
  have lowerBounds := quantizedCanonical_exactRegret_bounds
    (observedLowerActiveSet observedLower artifact constraints nonempty)
    (observedLowerActiveSet_nonempty observedLower artifact constraints
      nonempty)
    (lowerTraceEnvelopeAt family) scale
    (fun _ active => lowerTraceEnvelopeAt_nonnegative_of_active family active)
  have upperBounds := quantizedCanonical_exactRegret_bounds
    (observedUpperActiveSet observedUpper artifact constraints nonempty)
    (observedUpperActiveSet_nonempty observedUpper artifact constraints
      nonempty)
    (upperTraceEnvelopeAt family) scale
    (fun _ active => upperTraceEnvelopeAt_nonnegative_of_active family active)
  exact ⟨lowerBounds.1, lowerBounds.2, upperBounds.1, upperBounds.2⟩

/-- The combined exact lower-plus-upper envelope selected after quantization
loses strictly less than two quanta relative to the exact canonical pair. -/
theorem quantizedActiveExactEnvelopeSum_lt_add_twoQuantum
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
    lowerTraceEnvelopeAt family
          (quantizedLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) +
        upperTraceEnvelopeAt family
          (quantizedUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) <
      lowerTraceEnvelopeAt family
          (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        upperTraceEnvelopeAt family
          (canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        2 * quantum scale := by
  have bounds := quantizedActiveConstraints_exactRegret_bounds pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale
  linarith [bounds.2.1, bounds.2.2.2]

/-- The decoded fixed-point envelope sum itself obeys the same two-quantum
degradation bound relative to the exact canonical pair. -/
theorem quantizedActiveEncodedEnvelopeSum_lt_add_twoQuantum
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
    quantizedUpScalarCost scale (lowerTraceEnvelopeAt family)
          (quantizedLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) +
        quantizedUpScalarCost scale (upperTraceEnvelopeAt family)
          (quantizedUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) <
      lowerTraceEnvelopeAt family
          (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        upperTraceEnvelopeAt family
          (canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        2 * quantum scale := by
  have lowerBound :=
    quantizedCanonical_quantizedCost_lt_exactBest_add_quantum
      (observedLowerActiveSet observedLower artifact constraints nonempty)
      (observedLowerActiveSet_nonempty observedLower artifact constraints
        nonempty)
      (lowerTraceEnvelopeAt family) scale
      (fun _ active => lowerTraceEnvelopeAt_nonnegative_of_active family active)
  have upperBound :=
    quantizedCanonical_quantizedCost_lt_exactBest_add_quantum
      (observedUpperActiveSet observedUpper artifact constraints nonempty)
      (observedUpperActiveSet_nonempty observedUpper artifact constraints
        nonempty)
      (upperTraceEnvelopeAt family) scale
      (fun _ active => upperTraceEnvelopeAt_nonnegative_of_active family active)
  change
    quantizedUpScalarCost scale (lowerTraceEnvelopeAt family)
          (quantizedLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) <
      lowerTraceEnvelopeAt family
          (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        quantum scale at lowerBound
  change
    quantizedUpScalarCost scale (upperTraceEnvelopeAt family)
          (quantizedUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) <
      upperTraceEnvelopeAt family
          (canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) +
        quantum scale at upperBound
  linarith

noncomputable def exactCanonicalActiveGapLowerBound
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
      observedLower observedUpper artifact constraints) : ℝ :=
  pipeline.lowerSlope artifact *
      intervalFeasibilityGap exactLower exactUpper artifact constraints
        nonempty -
    lowerTraceEnvelopeAt family
      (canonicalLowerActiveConstraint pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family) -
    upperTraceEnvelopeAt family
      (canonicalUpperActiveConstraint pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family)

theorem canonicalActiveEndpointTraceCertificate_lowerEnvelope_eq
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
    (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).lowerEnvelope =
      lowerTraceEnvelopeAt family
        (canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family) := by
  have canonicalMem := (Finset.mem_filter.mp
    (canonicalLowerActiveConstraint_mem pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)).1
  unfold canonicalActiveEndpointTraceCertificate
  simp only [ActiveEndpointTraceCertificateAt.lowerEnvelope]
  simp only [lowerTraceEnvelopeAt, dif_pos canonicalMem]

theorem canonicalActiveEndpointTraceCertificate_upperEnvelope_eq
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
    (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).upperEnvelope =
      upperTraceEnvelopeAt family
        (canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family) := by
  have canonicalMem := (Finset.mem_filter.mp
    (canonicalUpperActiveConstraint_mem pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)).1
  unfold canonicalActiveEndpointTraceCertificate
  simp only [ActiveEndpointTraceCertificateAt.upperEnvelope]
  simp only [upperTraceEnvelopeAt, dif_pos canonicalMem]

theorem exactCanonicalActiveGapLowerBound_le_observedGap
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
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty) :
    exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  have bound := activeEndpointTraceCertificate_pipelineGap_bound pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family
      (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family)
      exactFeasible
  rw [canonicalActiveEndpointTraceCertificate_lowerEnvelope_eq,
    canonicalActiveEndpointTraceCertificate_upperEnvelope_eq] at bound
  exact bound

noncomputable def quantizedActiveGapLowerBound
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
    quantizedUpScalarCost scale (lowerTraceEnvelopeAt family)
      (quantizedLowerActiveConstraint pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family scale) -
    quantizedUpScalarCost scale (upperTraceEnvelopeAt family)
      (quantizedUpperActiveConstraint pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family scale)

/-- The decoded fixed-point gap lower bound is conservative relative to the
exact canonical bound, but loses strictly less than two quanta. -/
theorem quantizedActiveGapLowerBound_mem_interval
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
        2 * quantum scale <
      quantizedActiveGapLowerBound pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family scale ∧
    quantizedActiveGapLowerBound pipeline exactLower exactUpper observedLower
          observedUpper artifact constraints nonempty family scale ≤
      exactCanonicalActiveGapLowerBound pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family := by
  have exactRegrets := quantizedActiveConstraints_exactRegret_bounds pipeline
    exactLower exactUpper observedLower observedUpper artifact constraints
      nonempty family scale
  have encodedSumUpper :=
    quantizedActiveEncodedEnvelopeSum_lt_add_twoQuantum pipeline exactLower
      exactUpper observedLower observedUpper artifact constraints nonempty
        family scale
  have lowerExactLeEncoded :
      lowerTraceEnvelopeAt family
          (quantizedLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) ≤
        quantizedUpScalarCost scale (lowerTraceEnvelopeAt family)
          (quantizedLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) :=
    value_le_decode_quantizeUp scale _
  have upperExactLeEncoded :
      upperTraceEnvelopeAt family
          (quantizedUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) ≤
        quantizedUpScalarCost scale (upperTraceEnvelopeAt family)
          (quantizedUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family
              scale) :=
    value_le_decode_quantizeUp scale _
  have encodedSumLower :
      lowerTraceEnvelopeAt family
            (canonicalLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          upperTraceEnvelopeAt family
            (canonicalUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) ≤
        quantizedUpScalarCost scale (lowerTraceEnvelopeAt family)
            (quantizedLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family
                scale) +
          quantizedUpScalarCost scale (upperTraceEnvelopeAt family)
            (quantizedUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family
                scale) := by
    linarith [exactRegrets.1, exactRegrets.2.2.1]
  constructor
  · unfold exactCanonicalActiveGapLowerBound quantizedActiveGapLowerBound
    linarith
  · unfold exactCanonicalActiveGapLowerBound quantizedActiveGapLowerBound
    linarith

/-- The sub-quantum fixture changes the ID but still realizes the promised
bounded exact regret. -/
theorem subQuantumIdChange_has_halfQuantumRegret :
    quantizedCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          subQuantumExactBoolCost unitScale = false ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          subQuantumExactBoolCost = true ∧
      subQuantumExactBoolCost false - subQuantumExactBoolCost true =
        (1 : ℝ) / 2 ∧
      subQuantumExactBoolCost false - subQuantumExactBoolCost true <
        quantum unitScale := by
  exact ⟨subQuantumQuantizedCost_canonicalArgmin_eq_false,
    subQuantumExactBoolCost_canonicalArgmin_eq_true,
    by norm_num [subQuantumExactBoolCost],
    by norm_num [subQuantumExactBoolCost, unitScale_quantum]⟩

noncomputable def nearQuantumExactBoolCost (rho : ℝ) (id : Bool) : ℝ :=
  if id then (1 - rho) / 2 else 1

theorem nearQuantumExactBoolCost_canonicalArgmin_eq_true
    (rho : ℝ) (rhoNonnegative : 0 ≤ rho) :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      (nearQuantumExactBoolCost rho) = true := by
  apply isFiniteCanonicalArgmin_unique _ _ _ true
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨by simp, ?_, ?_⟩
    · intro other _
      cases other
      · simp [nearQuantumExactBoolCost]
        linarith
      · exact le_rfl
    · intro other _ costEq
      cases other
      · simp [nearQuantumExactBoolCost] at costEq
        linarith
      · exact le_rfl

theorem quantizedUp_nearQuantumExactBoolCost_eq_one
    (rho : ℝ) (rhoNonnegative : 0 ≤ rho) (rhoLtOne : rho < 1) :
    quantizedUpScalarCost unitScale (nearQuantumExactBoolCost rho) =
      fun _ => 1 := by
  have ceilBest : ⌈((1 - rho) / 2 : ℝ)⌉₊ = 1 := by
    rw [Nat.ceil_eq_iff (by norm_num : (1 : Nat) ≠ 0)]
    constructor <;> linarith
  funext id
  cases id <;>
    norm_num [quantizedUpScalarCost, nearQuantumExactBoolCost,
      decode_quantizeUp, unitScale, ceilBest]

theorem nearQuantumQuantizedCost_canonicalArgmin_eq_false
    (rho : ℝ) (rhoNonnegative : 0 ≤ rho) (rhoLtOne : rho < 1) :
    quantizedCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      (nearQuantumExactBoolCost rho) unitScale = false := by
  unfold quantizedCanonicalArgmin
  rw [quantizedUp_nearQuantumExactBoolCost_eq_one rho rhoNonnegative rhoLtOne]
  apply isFiniteCanonicalArgmin_unique _ _ _ false
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨by simp, ?_, ?_⟩
    · intro other _
      exact le_rfl
    · intro other _ _
      cases other <;> simp

/-- The coefficient one in the uniform regret bound is sharp: for every
putative coefficient `rho < 1`, an upward-quantized two-candidate instance
changes ID and has exact regret strictly greater than `rho * quantum`. -/
theorem oneQuantumRegretCoefficient_isSharp
    (rho : ℝ) (rhoNonnegative : 0 ≤ rho) (rhoLtOne : rho < 1) :
    quantizedCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          (nearQuantumExactBoolCost rho) unitScale = false ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          (nearQuantumExactBoolCost rho) = true ∧
      rho * quantum unitScale <
        nearQuantumExactBoolCost rho false -
          nearQuantumExactBoolCost rho true ∧
      nearQuantumExactBoolCost rho false -
          nearQuantumExactBoolCost rho true < quantum unitScale := by
  refine ⟨nearQuantumQuantizedCost_canonicalArgmin_eq_false rho
      rhoNonnegative rhoLtOne,
    nearQuantumExactBoolCost_canonicalArgmin_eq_true rho rhoNonnegative,
    ?_, ?_⟩
  · rw [unitScale_quantum]
    simp only [nearQuantumExactBoolCost, Bool.false_eq_true, ↓reduceIte,
      ↓reduceIte]
    linarith
  · rw [unitScale_quantum]
    simp only [nearQuantumExactBoolCost, Bool.false_eq_true, ↓reduceIte,
      ↓reduceIte]
    linarith

end Sprawlens.RepresentationIntervalCalibrationFixedPointRegret
