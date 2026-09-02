import Sprawlens.RepresentationToleranceMultiplicity

namespace Sprawlens.RepresentationFiberDiameter

open RepresentationFactorization
open RepresentationFiberMultiplicity
open RepresentationToleranceMultiplicity

universe u v w

/-- Maximum observable separation among the explicitly covered hidden states
for one artifact. Empty coverage has diameter zero. -/
def coveredFiberDiameter
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) : NNReal :=
  (coverage.product coverage).sup fun pair ↦
    nndist (render artifact pair.1) (render artifact pair.2)

@[simp] theorem coveredFiberDiameter_empty
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact) :
    coveredFiberDiameter render artifact ∅ = 0 := by
  simp [coveredFiberDiameter]

theorem pair_nndist_le_coveredFiberDiameter
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (firstHidden secondHidden : Hidden)
    (firstMem : firstHidden ∈ coverage)
    (secondMem : secondHidden ∈ coverage) :
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
      coveredFiberDiameter render artifact coverage := by
  simpa [coveredFiberDiameter] using
    (Finset.le_sup (s := coverage.product coverage)
      (f := fun pair ↦
        nndist (render artifact pair.1) (render artifact pair.2))
      (b := (firstHidden, secondHidden))
      (Finset.mem_product.mpr ⟨firstMem, secondMem⟩))

theorem coveredFiberDiameter_le_iff
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (bound : NNReal) :
    coveredFiberDiameter render artifact coverage ≤ bound ↔
      ∀ firstHidden ∈ coverage, ∀ secondHidden ∈ coverage,
        nndist (render artifact firstHidden) (render artifact secondHidden) ≤
          bound := by
  constructor
  · intro diameterLe firstHidden firstMem secondHidden secondMem
    exact (pair_nndist_le_coveredFiberDiameter render artifact coverage
      firstHidden secondHidden firstMem secondMem).trans diameterLe
  · intro pairwiseLe
    apply Finset.sup_le
    intro pair pairMem
    obtain ⟨firstMem, secondMem⟩ := Finset.mem_product.mp pairMem
    exact pairwiseLe pair.1 firstMem pair.2 secondMem

theorem coveredFiberDiameter_mono_coverage
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    {smaller larger : Finset Hidden}
    (coverageLe : smaller ⊆ larger) :
    coveredFiberDiameter render artifact smaller ≤
      coveredFiberDiameter render artifact larger := by
  apply Finset.sup_mono
  intro pair pairMem
  obtain ⟨firstMem, secondMem⟩ := Finset.mem_product.mp pairMem
  exact Finset.mem_product.mpr
    ⟨coverageLe firstMem, coverageLe secondMem⟩

theorem coveredFiberDiameter_le_iff_coveredWithinTolerance
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (tolerance : NNReal) :
    coveredFiberDiameter render artifact coverage ≤ tolerance ↔
      CoveredWithinTolerance render artifact (tolerance : ℝ) coverage := by
  rw [coveredFiberDiameter_le_iff]
  constructor
  · intro pairwise firstHidden firstMem secondHidden secondMem
    have distanceLe := pairwise firstHidden firstMem secondHidden secondMem
    exact_mod_cast distanceLe
  · intro covered firstHidden firstMem secondHidden secondMem
    have distanceLe := covered firstHidden firstMem secondHidden secondMem
    exact_mod_cast distanceLe

def CoveredToleranceViolation
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal)
    (coverage : Finset Hidden) : Prop :=
  ∃ firstHidden ∈ coverage, ∃ secondHidden ∈ coverage,
    tolerance <
      nndist (render artifact firstHidden) (render artifact secondHidden)

theorem tolerance_lt_coveredFiberDiameter_iff_violation
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (tolerance : NNReal) :
    tolerance < coveredFiberDiameter render artifact coverage ↔
      CoveredToleranceViolation render artifact tolerance coverage := by
  constructor
  · intro toleranceLt
    by_contra noViolation
    have allPairsLe :
        ∀ firstHidden ∈ coverage, ∀ secondHidden ∈ coverage,
          nndist (render artifact firstHidden)
              (render artifact secondHidden) ≤ tolerance := by
      intro firstHidden firstMem secondHidden secondMem
      by_contra notLe
      apply noViolation
      exact ⟨firstHidden, firstMem, secondHidden, secondMem,
        lt_of_not_ge notLe⟩
    exact (not_lt_of_ge
      ((coveredFiberDiameter_le_iff render artifact coverage tolerance).mpr
        allPairsLe)) toleranceLt
  · rintro ⟨firstHidden, firstMem, secondHidden, secondMem, toleranceLt⟩
    exact toleranceLt.trans_le
      (pair_nndist_le_coveredFiberDiameter render artifact coverage
        firstHidden secondHidden firstMem secondMem)

inductive FiberDiameterVerdict where
  | certifiedWithinTolerance
  | exceedsTolerance
  | inconclusive
deriving DecidableEq, Repr

/-- Empty coverage remains inconclusive. On nonempty finite coverage, unlike a
conservative bucket summary, direct diameter can certify either side. -/
noncomputable def classifyFiberDiameter
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal)
    (coverage : Finset Hidden) : FiberDiameterVerdict :=
  if coverage = ∅ then .inconclusive
  else if coveredFiberDiameter render artifact coverage ≤ tolerance then
    .certifiedWithinTolerance
  else .exceedsTolerance

theorem classifyFiberDiameter_eq_certified_iff
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal)
    (coverage : Finset Hidden) :
    classifyFiberDiameter render artifact tolerance coverage =
        .certifiedWithinTolerance ↔
      coverage.Nonempty ∧
        coveredFiberDiameter render artifact coverage ≤ tolerance := by
  by_cases empty : coverage = ∅
  · simp [classifyFiberDiameter, empty]
  · simp [classifyFiberDiameter, empty, Finset.nonempty_iff_ne_empty]

theorem classifyFiberDiameter_eq_exceeds_iff
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal)
    (coverage : Finset Hidden) :
    classifyFiberDiameter render artifact tolerance coverage =
        .exceedsTolerance ↔
      coverage.Nonempty ∧
        CoveredToleranceViolation render artifact tolerance coverage := by
  by_cases empty : coverage = ∅
  · simp [classifyFiberDiameter, empty]
  · by_cases diameterLe :
        coveredFiberDiameter render artifact coverage ≤ tolerance
    · have noViolation :
          ¬CoveredToleranceViolation render artifact tolerance coverage := by
        intro violation
        exact (not_lt_of_ge diameterLe)
          ((tolerance_lt_coveredFiberDiameter_iff_violation render artifact
            coverage tolerance).mpr violation)
      simp [classifyFiberDiameter, empty, diameterLe,
        Finset.nonempty_iff_ne_empty, noViolation]
    · have violation :
          CoveredToleranceViolation render artifact tolerance coverage :=
        (tolerance_lt_coveredFiberDiameter_iff_violation render artifact
          coverage tolerance).mp (lt_of_not_ge diameterLe)
      simp [classifyFiberDiameter, empty, diameterLe,
        Finset.nonempty_iff_ne_empty, violation]

theorem classifyFiberDiameter_certified_sound
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal)
    (coverage : Finset Hidden)
    (certified : classifyFiberDiameter render artifact tolerance coverage =
      .certifiedWithinTolerance) :
    CoveredWithinTolerance render artifact (tolerance : ℝ) coverage := by
  have diameterLe :=
    (classifyFiberDiameter_eq_certified_iff render artifact tolerance
      coverage).mp certified |>.2
  exact (coveredFiberDiameter_le_iff_coveredWithinTolerance render artifact
    coverage tolerance).mp diameterLe

theorem coveredFiberDiameter_eq_zero_iff_coveredIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) :
    coveredFiberDiameter render artifact coverage = 0 ↔
      CoveredFiberIndependent render artifact coverage := by
  change
    ((coverage.product coverage).sup fun pair ↦
      nndist (render artifact pair.1) (render artifact pair.2)) =
        (⊥ : NNReal) ↔ _
  rw [Finset.sup_eq_bot_iff]
  constructor
  · intro allZero firstHidden firstMem secondHidden secondMem
    apply eq_of_nndist_eq_zero
    exact allZero (firstHidden, secondHidden)
      (Finset.mem_product.mpr ⟨firstMem, secondMem⟩)
  · intro independent pair pairMem
    obtain ⟨firstMem, secondMem⟩ := Finset.mem_product.mp pairMem
    exact nndist_eq_zero.mpr
      (independent pair.1 firstMem pair.2 secondMem)

theorem coveredFiberDiameter_eq_zero_iff_fiberMultiplicity_one
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (nonempty : coverage.Nonempty) :
    coveredFiberDiameter render artifact coverage = 0 ↔
      fiberMultiplicity render artifact coverage = 1 := by
  exact (coveredFiberDiameter_eq_zero_iff_coveredIndependent render artifact
    coverage).trans
      (fiberMultiplicity_eq_one_iff_coveredIndependent render artifact coverage
        nonempty).symm

theorem coveredFiberDiameter_pos_iff_leakageWitness
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) :
    0 < coveredFiberDiameter render artifact coverage ↔
      CoveredLeakageWitness render artifact coverage := by
  constructor
  · intro positive
    have notIndependent :
        ¬CoveredFiberIndependent render artifact coverage := by
      intro independent
      exact (ne_of_gt positive)
        ((coveredFiberDiameter_eq_zero_iff_coveredIndependent render artifact
          coverage).mpr independent)
    exact (not_coveredIndependent_iff_leakageWitness render artifact coverage).mp
      notIndependent
  · intro witness
    apply pos_iff_ne_zero.mpr
    intro diameterZero
    have independent :=
      (coveredFiberDiameter_eq_zero_iff_coveredIndependent render artifact
        coverage).mp diameterZero
    exact ((not_coveredIndependent_iff_leakageWitness render artifact
      coverage).mpr witness) independent

theorem closeRender_boolCoverage_diameter_one :
    coveredFiberDiameter closeRender () boolCoverage = 1 := by
  apply le_antisymm
  · rw [coveredFiberDiameter_le_iff]
    intro firstHidden _ secondHidden _
    cases firstHidden <;> cases secondHidden <;>
      apply NNReal.coe_le_coe.mp <;>
      norm_num [coe_nndist, closeRender, Real.dist_eq]
  · calc
      1 = nndist (closeRender () false) (closeRender () true) := by
        symm
        apply NNReal.eq
        norm_num [coe_nndist, closeRender, Real.dist_eq]
      _ ≤ coveredFiberDiameter closeRender () boolCoverage :=
        pair_nndist_le_coveredFiberDiameter closeRender () boolCoverage
          false true (by simp [boolCoverage]) (by simp [boolCoverage])

/-- Bucket multiplicity may be inconclusive because of harmless over-splitting,
while the direct diameter still gives the exact pairwise certificate. -/
theorem splitClose_inconclusive_but_directDiameter_certifies :
    classifyToleranceMultiplicity splitCloseCertificate boolCoverage =
        .inconclusive ∧
      coveredFiberDiameter closeRender () boolCoverage ≤ 2 := by
  constructor
  · exact splitClose_verdict_inconclusive
  · rw [closeRender_boolCoverage_diameter_one]
    norm_num

theorem splitClose_bucketInconclusive_directCertified :
    classifyToleranceMultiplicity splitCloseCertificate boolCoverage =
        .inconclusive ∧
      classifyFiberDiameter closeRender () 2 boolCoverage =
        .certifiedWithinTolerance := by
  constructor
  · exact splitClose_verdict_inconclusive
  · apply (classifyFiberDiameter_eq_certified_iff closeRender () 2
      boolCoverage).mpr
    constructor
    · simp [boolCoverage]
    · rw [closeRender_boolCoverage_diameter_one]
      norm_num

def chainRender (_artifact : Unit) (hidden : Fin 3) : ℝ := hidden.val

def chainCoverage : Finset (Fin 3) := Finset.univ

theorem chainRender_diameter_two :
    coveredFiberDiameter chainRender () chainCoverage = 2 := by
  apply le_antisymm
  · rw [coveredFiberDiameter_le_iff]
    intro firstHidden _ secondHidden _
    fin_cases firstHidden <;> fin_cases secondHidden <;>
      apply NNReal.coe_le_coe.mp <;>
      norm_num [coe_nndist, chainRender, Real.dist_eq]
  · calc
      2 = nndist (chainRender () (0 : Fin 3))
          (chainRender () (2 : Fin 3)) := by
        symm
        apply NNReal.eq
        norm_num [coe_nndist, chainRender, Real.dist_eq]
      _ ≤ coveredFiberDiameter chainRender () chainCoverage :=
        pair_nndist_le_coveredFiberDiameter chainRender () chainCoverage
          (0 : Fin 3) (2 : Fin 3)
          (by simp [chainCoverage]) (by simp [chainCoverage])

/-- Single-linkage connectivity can join the endpoints although their direct
fiber diameter exceeds the tolerance. -/
theorem toleranceConnected_does_not_bound_directDiameter :
    ToleranceConnected 1 (chainRender () (0 : Fin 3))
        (chainRender () (2 : Fin 3)) ∧
      ¬coveredFiberDiameter chainRender () chainCoverage ≤ 1 := by
  constructor
  · simpa [chainRender] using unitTolerance_chain_connects_far_endpoints.1
  · rw [chainRender_diameter_two]
    norm_num

theorem chainRender_directVerdict_exceeds :
    classifyFiberDiameter chainRender () 1 chainCoverage =
      .exceedsTolerance := by
  apply (classifyFiberDiameter_eq_exceeds_iff chainRender () 1
    chainCoverage).mpr
  constructor
  · simp [chainCoverage]
  · exact ⟨(0 : Fin 3), by simp [chainCoverage],
      (2 : Fin 3), by simp [chainCoverage], by
        apply NNReal.coe_lt_coe.mp
        norm_num [coe_nndist, chainRender, Real.dist_eq]⟩

theorem emptyFiberDiameterVerdict_inconclusive
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal) :
    classifyFiberDiameter render artifact tolerance ∅ = .inconclusive := by
  simp [classifyFiberDiameter]

end Sprawlens.RepresentationFiberDiameter
