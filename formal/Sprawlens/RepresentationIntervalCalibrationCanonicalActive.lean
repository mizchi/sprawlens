import Sprawlens.RepresentationIntervalCalibrationActiveMinimum

namespace Sprawlens.RepresentationIntervalCalibrationCanonicalActive

open RepresentationIntervalRobustness
open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationEndpointResidual
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationActiveTie

universe u v

noncomputable def finiteMinimumCost
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ) : ℝ :=
  (indices.image cost).min' (nonempty.image cost)

noncomputable def finiteMinimizers
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ) : Finset Index := by
  classical
  exact indices.filter fun index =>
    cost index = finiteMinimumCost indices nonempty cost

theorem finiteMinimizers_nonempty
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ) :
    (finiteMinimizers indices nonempty cost).Nonempty := by
  classical
  have minimumMem := Finset.min'_mem (indices.image cost)
    (nonempty.image cost)
  obtain ⟨index, indexMem, costEq⟩ := Finset.mem_image.mp minimumMem
  exact ⟨index, Finset.mem_filter.mpr ⟨indexMem, costEq⟩⟩

noncomputable def finiteCanonicalArgmin
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ) : Index :=
  (finiteMinimizers indices nonempty cost).min'
    (finiteMinimizers_nonempty indices nonempty cost)

def IsFiniteCanonicalArgmin
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (cost : Index → ℝ)
    (candidate : Index) : Prop :=
  candidate ∈ indices ∧
    (∀ other ∈ indices, cost candidate ≤ cost other) ∧
    (∀ other ∈ indices, cost other = cost candidate → candidate ≤ other)

theorem finiteCanonicalArgmin_mem
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ) :
    finiteCanonicalArgmin indices nonempty cost ∈ indices := by
  classical
  exact (Finset.mem_filter.mp
    (Finset.min'_mem (finiteMinimizers indices nonempty cost)
      (finiteMinimizers_nonempty indices nonempty cost))).1

theorem finiteCanonicalArgmin_cost_le
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (other : Index)
    (otherMem : other ∈ indices) :
    cost (finiteCanonicalArgmin indices nonempty cost) ≤ cost other := by
  classical
  have canonicalInMinimizers :=
    Finset.min'_mem (finiteMinimizers indices nonempty cost)
      (finiteMinimizers_nonempty indices nonempty cost)
  have canonicalCost := (Finset.mem_filter.mp canonicalInMinimizers).2
  have minimumLeOther := Finset.min'_le (indices.image cost) (cost other)
    (Finset.mem_image.mpr ⟨other, otherMem, rfl⟩)
  change
    cost ((finiteMinimizers indices nonempty cost).min'
      (finiteMinimizers_nonempty indices nonempty cost)) ≤ cost other
  rw [canonicalCost]
  exact minimumLeOther

theorem finiteCanonicalArgmin_le_of_cost_eq
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ)
    (other : Index)
    (otherMem : other ∈ indices)
    (costEq : cost other = cost (finiteCanonicalArgmin indices nonempty cost)) :
    finiteCanonicalArgmin indices nonempty cost ≤ other := by
  classical
  have canonicalInMinimizers :=
    Finset.min'_mem (finiteMinimizers indices nonempty cost)
      (finiteMinimizers_nonempty indices nonempty cost)
  have canonicalCost := (Finset.mem_filter.mp canonicalInMinimizers).2
  have otherInMinimizers : other ∈ finiteMinimizers indices nonempty cost :=
    Finset.mem_filter.mpr ⟨otherMem, costEq.trans canonicalCost⟩
  exact Finset.min'_le (finiteMinimizers indices nonempty cost) other
    otherInMinimizers

theorem finiteCanonicalArgmin_isCanonical
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (cost : Index → ℝ) :
    IsFiniteCanonicalArgmin indices cost
      (finiteCanonicalArgmin indices nonempty cost) := by
  exact ⟨finiteCanonicalArgmin_mem indices nonempty cost,
    finiteCanonicalArgmin_cost_le indices nonempty cost,
    finiteCanonicalArgmin_le_of_cost_eq indices nonempty cost⟩

theorem isFiniteCanonicalArgmin_unique
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (cost : Index → ℝ)
    (first second : Index)
    (firstCanonical : IsFiniteCanonicalArgmin indices cost first)
    (secondCanonical : IsFiniteCanonicalArgmin indices cost second) :
    first = second := by
  have firstCostLeSecond := firstCanonical.2.1 second secondCanonical.1
  have secondCostLeFirst := secondCanonical.2.1 first firstCanonical.1
  have costEq : cost first = cost second :=
    le_antisymm firstCostLeSecond secondCostLeFirst
  exact le_antisymm
    (firstCanonical.2.2 second secondCanonical.1 costEq.symm)
    (secondCanonical.2.2 first firstCanonical.1 costEq)

noncomputable def canonicalLowerActiveConstraint
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
      observedLower observedUpper artifact constraints) : Constraint :=
  finiteCanonicalArgmin
    (observedLowerActiveSet observedLower artifact constraints nonempty)
    (observedLowerActiveSet_nonempty observedLower artifact constraints
      nonempty)
    (lowerTraceEnvelopeAt family)

noncomputable def canonicalUpperActiveConstraint
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
      observedLower observedUpper artifact constraints) : Constraint :=
  finiteCanonicalArgmin
    (observedUpperActiveSet observedUpper artifact constraints nonempty)
    (observedUpperActiveSet_nonempty observedUpper artifact constraints
      nonempty)
    (upperTraceEnvelopeAt family)

theorem canonicalLowerActiveConstraint_mem
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
    canonicalLowerActiveConstraint pipeline exactLower exactUpper observedLower
        observedUpper artifact constraints nonempty family ∈
      observedLowerActiveSet observedLower artifact constraints nonempty := by
  exact finiteCanonicalArgmin_mem _ _ _

theorem canonicalUpperActiveConstraint_mem
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
    canonicalUpperActiveConstraint pipeline exactLower exactUpper observedLower
        observedUpper artifact constraints nonempty family ∈
      observedUpperActiveSet observedUpper artifact constraints nonempty := by
  exact finiteCanonicalArgmin_mem _ _ _

noncomputable def canonicalActiveEndpointTraceCertificate
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
    ActiveEndpointTraceCertificateAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty := by
  let lowerConstraint := canonicalLowerActiveConstraint pipeline exactLower
    exactUpper observedLower observedUpper artifact constraints nonempty family
  let upperConstraint := canonicalUpperActiveConstraint pipeline exactLower
    exactUpper observedLower observedUpper artifact constraints nonempty family
  have lowerActive := canonicalLowerActiveConstraint_mem pipeline exactLower
    exactUpper observedLower observedUpper artifact constraints nonempty family
  have upperActive := canonicalUpperActiveConstraint_mem pipeline exactLower
    exactUpper observedLower observedUpper artifact constraints nonempty family
  have lowerParts := Finset.mem_filter.mp lowerActive
  have upperParts := Finset.mem_filter.mp upperActive
  exact {
    lowerConstraint := lowerConstraint
    lowerMem := lowerParts.1
    lowerObservedIsMax := lowerParts.2
    lowerTrace := family.lowerTrace lowerConstraint lowerParts.1
    lowerOutput := family.lowerOutput lowerConstraint lowerParts.1
    upperConstraint := upperConstraint
    upperMem := upperParts.1
    upperObservedIsMin := upperParts.2
    upperTrace := family.upperTrace upperConstraint upperParts.1
    upperOutput := family.upperOutput upperConstraint upperParts.1
  }

theorem canonicalActiveEndpointTraceCertificate_lowerEnvelope_le
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
    (other : Constraint)
    (otherActive : other ∈
      observedLowerActiveSet observedLower artifact constraints nonempty) :
    (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).lowerEnvelope ≤
      lowerTraceEnvelopeAt family other := by
  have canonicalMem := (Finset.mem_filter.mp
    (canonicalLowerActiveConstraint_mem pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)).1
  rw [show
    (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).lowerEnvelope =
      lowerTraceEnvelopeAt family
        (canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family) by
    unfold canonicalActiveEndpointTraceCertificate
    simp only [ActiveEndpointTraceCertificateAt.lowerEnvelope]
    simp only [lowerTraceEnvelopeAt, dif_pos canonicalMem]]
  exact finiteCanonicalArgmin_cost_le
    (observedLowerActiveSet observedLower artifact constraints nonempty)
    (observedLowerActiveSet_nonempty observedLower artifact constraints
      nonempty)
    (lowerTraceEnvelopeAt family) other otherActive

theorem canonicalActiveEndpointTraceCertificate_upperEnvelope_le
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
    (other : Constraint)
    (otherActive : other ∈
      observedUpperActiveSet observedUpper artifact constraints nonempty) :
    (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).upperEnvelope ≤
      upperTraceEnvelopeAt family other := by
  have canonicalMem := (Finset.mem_filter.mp
    (canonicalUpperActiveConstraint_mem pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)).1
  rw [show
    (canonicalActiveEndpointTraceCertificate pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family).upperEnvelope =
      upperTraceEnvelopeAt family
        (canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family) by
    unfold canonicalActiveEndpointTraceCertificate
    simp only [ActiveEndpointTraceCertificateAt.upperEnvelope]
    simp only [upperTraceEnvelopeAt, dif_pos canonicalMem]]
  exact finiteCanonicalArgmin_cost_le
    (observedUpperActiveSet observedUpper artifact constraints nonempty)
    (observedUpperActiveSet_nonempty observedUpper artifact constraints
      nonempty)
    (upperTraceEnvelopeAt family) other otherActive

theorem canonicalLowerActiveConstraint_isCanonical
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
    IsFiniteCanonicalArgmin
      (observedLowerActiveSet observedLower artifact constraints nonempty)
      (lowerTraceEnvelopeAt family)
      (canonicalLowerActiveConstraint pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family) := by
  exact finiteCanonicalArgmin_isCanonical _ _ _

theorem canonicalUpperActiveConstraint_isCanonical
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
    IsFiniteCanonicalArgmin
      (observedUpperActiveSet observedUpper artifact constraints nonempty)
      (upperTraceEnvelopeAt family)
      (canonicalUpperActiveConstraint pipeline exactLower exactUpper
        observedLower observedUpper artifact constraints nonempty family) := by
  exact finiteCanonicalArgmin_isCanonical _ _ _

theorem canonicalLowerActiveConstraint_unique
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
    (candidate : Constraint)
    (candidateCanonical : IsFiniteCanonicalArgmin
      (observedLowerActiveSet observedLower artifact constraints nonempty)
      (lowerTraceEnvelopeAt family) candidate) :
    candidate = canonicalLowerActiveConstraint pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family := by
  exact isFiniteCanonicalArgmin_unique _ _ candidate _ candidateCanonical
    (canonicalLowerActiveConstraint_isCanonical pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)

theorem canonicalUpperActiveConstraint_unique
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
    (candidate : Constraint)
    (candidateCanonical : IsFiniteCanonicalArgmin
      (observedUpperActiveSet observedUpper artifact constraints nonempty)
      (upperTraceEnvelopeAt family) candidate) :
    candidate = canonicalUpperActiveConstraint pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family := by
  exact isFiniteCanonicalArgmin_unique _ _ candidate _ candidateCanonical
    (canonicalUpperActiveConstraint_isCanonical pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints nonempty family)

theorem tiedLowerTraceEnvelopeAt_true_eq_hundred :
    lowerTraceEnvelopeAt tiedTraceFamily true = 100 := by
  rfl

theorem tiedUpperTraceEnvelopeAt_true_eq_zero :
    upperTraceEnvelopeAt tiedTraceFamily true = 0 := by
  rfl

theorem tiedFalse_isCanonicalLowerArgmin :
    IsFiniteCanonicalArgmin
      (observedLowerActiveSet tiedObservedLower () Finset.univ
        Finset.univ_nonempty)
      (lowerTraceEnvelopeAt tiedTraceFamily) false := by
  refine ⟨tiedFalse_mem_observedLowerActiveSet, ?_, ?_⟩
  · intro other _
    cases other
    · exact le_rfl
    · rw [tiedLowerTraceEnvelopeAt_false_eq_zero,
        tiedLowerTraceEnvelopeAt_true_eq_hundred]
      norm_num
  · intro other _ _
    cases other <;> simp

theorem tiedFalse_isCanonicalUpperArgmin :
    IsFiniteCanonicalArgmin
      (observedUpperActiveSet tiedObservedUpper () Finset.univ
        Finset.univ_nonempty)
      (upperTraceEnvelopeAt tiedTraceFamily) false := by
  refine ⟨tiedFalse_mem_observedUpperActiveSet, ?_, ?_⟩
  · intro other _
    cases other
    · exact le_rfl
    · rw [tiedUpperTraceEnvelopeAt_false_eq_zero,
        tiedUpperTraceEnvelopeAt_true_eq_zero]
  · intro other _ _
    cases other <;> simp

theorem tiedCanonicalLowerActiveConstraint_eq_false :
    canonicalLowerActiveConstraint oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty tiedTraceFamily = false := by
  exact (canonicalLowerActiveConstraint_unique oneIdentityPipeline
    tiedExactLower tiedExactUpper tiedObservedLower tiedObservedUpper ()
      Finset.univ Finset.univ_nonempty tiedTraceFamily false
        tiedFalse_isCanonicalLowerArgmin).symm

theorem tiedCanonicalUpperActiveConstraint_eq_false :
    canonicalUpperActiveConstraint oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty tiedTraceFamily = false := by
  exact (canonicalUpperActiveConstraint_unique oneIdentityPipeline
    tiedExactLower tiedExactUpper tiedObservedLower tiedObservedUpper ()
      Finset.univ Finset.univ_nonempty tiedTraceFamily false
        tiedFalse_isCanonicalUpperArgmin).symm

noncomputable def tiedCanonicalActiveCertificate :
    ActiveEndpointTraceCertificateAt oneIdentityPipeline tiedExactLower
      tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty :=
  canonicalActiveEndpointTraceCertificate oneIdentityPipeline tiedExactLower
    tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
      Finset.univ_nonempty tiedTraceFamily

theorem tiedCanonicalActiveCertificate_constraints_eq_false :
    tiedCanonicalActiveCertificate.lowerConstraint = false ∧
      tiedCanonicalActiveCertificate.upperConstraint = false := by
  change
    canonicalLowerActiveConstraint oneIdentityPipeline tiedExactLower
          tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
            Finset.univ_nonempty tiedTraceFamily = false ∧
      canonicalUpperActiveConstraint oneIdentityPipeline tiedExactLower
          tiedExactUpper tiedObservedLower tiedObservedUpper () Finset.univ
            Finset.univ_nonempty tiedTraceFamily = false
  exact ⟨tiedCanonicalLowerActiveConstraint_eq_false,
    tiedCanonicalUpperActiveConstraint_eq_false⟩

theorem tiedCanonicalActiveCertificate_envelopes_eq_zero :
    tiedCanonicalActiveCertificate.lowerEnvelope = 0 ∧
      tiedCanonicalActiveCertificate.upperEnvelope = 0 := by
  constructor
  · have leZero :=
      canonicalActiveEndpointTraceCertificate_lowerEnvelope_le
        oneIdentityPipeline tiedExactLower tiedExactUpper tiedObservedLower
          tiedObservedUpper () Finset.univ Finset.univ_nonempty tiedTraceFamily
            false tiedFalse_mem_observedLowerActiveSet
    rw [tiedLowerTraceEnvelopeAt_false_eq_zero] at leZero
    exact le_antisymm leZero
      (activeEndpointTraceCertificate_lowerEnvelope_nonnegative
        tiedCanonicalActiveCertificate)
  · have leZero :=
      canonicalActiveEndpointTraceCertificate_upperEnvelope_le
        oneIdentityPipeline tiedExactLower tiedExactUpper tiedObservedLower
          tiedObservedUpper () Finset.univ Finset.univ_nonempty tiedTraceFamily
            false tiedFalse_mem_observedUpperActiveSet
    rw [tiedUpperTraceEnvelopeAt_false_eq_zero] at leZero
    exact le_antisymm leZero
      (activeEndpointTraceCertificate_upperEnvelope_nonnegative
        tiedCanonicalActiveCertificate)

theorem tiedCanonicalActiveCertificate_bound_is_exact :
    oneIdentityPipeline.lowerSlope () *
          intervalFeasibilityGap tiedExactLower tiedExactUpper () Finset.univ
            Finset.univ_nonempty -
        tiedCanonicalActiveCertificate.lowerEnvelope -
        tiedCanonicalActiveCertificate.upperEnvelope =
      intervalFeasibilityGap tiedObservedLower tiedObservedUpper () Finset.univ
        Finset.univ_nonempty := by
  rw [tiedExact_gap_eq_ten, tiedObserved_gap_eq_ten,
    tiedCanonicalActiveCertificate_envelopes_eq_zero.1,
    tiedCanonicalActiveCertificate_envelopes_eq_zero.2]
  norm_num [oneIdentityPipeline, identityStage,
    CalibrationPipeline.lowerSlope,
    RepresentationIntervalMetricCalibration.hingeLowerSlope]

end Sprawlens.RepresentationIntervalCalibrationCanonicalActive
