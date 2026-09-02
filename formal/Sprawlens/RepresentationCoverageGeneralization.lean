import Sprawlens.RepresentationFiberDiameter

namespace Sprawlens.RepresentationCoverageGeneralization

open RepresentationFactorization
open RepresentationFiberDiameter
open RepresentationToleranceMultiplicity

universe u v w

/-- Every hidden state is represented by an explicitly covered state within a
fixed radius. This is a proof obligation, not a consequence of finite testing. -/
structure FiberRadiusNet
    {Hidden : Type v} [PseudoMetricSpace Hidden] [DecidableEq Hidden]
    (coverage : Finset Hidden)
    (radius : NNReal) : Prop where
  cover : ∀ hidden, ∃ covered ∈ coverage, nndist hidden covered ≤ radius

/-- Sensitivity of one artifact fiber with respect to its hidden-state metric. -/
def FiberLipschitzAt
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (constant : NNReal) : Prop :=
  ∀ firstHidden secondHidden,
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
      constant * nndist firstHidden secondHidden

def GlobalWithinNNTolerance
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : NNReal) : Prop :=
  ∀ firstHidden secondHidden,
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
      tolerance

theorem FiberRadiusNet.mono_radius
    {Hidden : Type v} [PseudoMetricSpace Hidden] [DecidableEq Hidden]
    {coverage : Finset Hidden} {smallerRadius largerRadius : NNReal}
    (net : FiberRadiusNet coverage smallerRadius)
    (radiusLe : smallerRadius ≤ largerRadius) :
    FiberRadiusNet coverage largerRadius := by
  constructor
  intro hidden
  obtain ⟨covered, coveredMem, distanceLe⟩ := net.cover hidden
  exact ⟨covered, coveredMem, distanceLe.trans radiusLe⟩

theorem FiberLipschitzAt.mono_constant
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {smallerConstant largerConstant : NNReal}
    (lipschitz : FiberLipschitzAt render artifact smallerConstant)
    (constantLe : smallerConstant ≤ largerConstant) :
    FiberLipschitzAt render artifact largerConstant := by
  intro firstHidden secondHidden
  exact (lipschitz firstHidden secondHidden).trans (by
    gcongr)

theorem global_nndist_le_coveredDiameter_add_penalty
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (radius constant : NNReal)
    (net : FiberRadiusNet coverage radius)
    (lipschitz : FiberLipschitzAt render artifact constant)
    (firstHidden secondHidden : Hidden) :
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
      coveredFiberDiameter render artifact coverage +
        2 * (constant * radius) := by
  obtain ⟨firstCovered, firstCoveredMem, firstCoverLe⟩ :=
    net.cover firstHidden
  obtain ⟨secondCovered, secondCoveredMem, secondCoverLe⟩ :=
    net.cover secondHidden
  have firstRenderLe :
      nndist (render artifact firstHidden) (render artifact firstCovered) ≤
        constant * radius :=
    (lipschitz firstHidden firstCovered).trans
      (by gcongr)
  have secondRenderLe :
      nndist (render artifact secondCovered) (render artifact secondHidden) ≤
        constant * radius := by
    have hiddenDistanceLe : nndist secondCovered secondHidden ≤ radius := by
      simpa [nndist_comm] using secondCoverLe
    exact (lipschitz secondCovered secondHidden).trans
      (by gcongr)
  have coveredRenderLe :
      nndist (render artifact firstCovered) (render artifact secondCovered) ≤
        coveredFiberDiameter render artifact coverage :=
    pair_nndist_le_coveredFiberDiameter render artifact coverage
      firstCovered secondCovered firstCoveredMem secondCoveredMem
  calc
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
        nndist (render artifact firstHidden) (render artifact firstCovered) +
          nndist (render artifact firstCovered)
            (render artifact secondHidden) := nndist_triangle _ _ _
    _ ≤ nndist (render artifact firstHidden) (render artifact firstCovered) +
        (nndist (render artifact firstCovered)
            (render artifact secondCovered) +
          nndist (render artifact secondCovered)
            (render artifact secondHidden)) := by
      gcongr
      exact nndist_triangle _ _ _
    _ ≤ constant * radius +
        (coveredFiberDiameter render artifact coverage +
          constant * radius) := by
      gcongr
    _ = coveredFiberDiameter render artifact coverage +
        2 * (constant * radius) := by ring

theorem coveredDiameter_add_penalty_certifies_global
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (radius constant tolerance : NNReal)
    (net : FiberRadiusNet coverage radius)
    (lipschitz : FiberLipschitzAt render artifact constant)
    (budget : coveredFiberDiameter render artifact coverage +
      2 * (constant * radius) ≤ tolerance) :
    GlobalWithinNNTolerance render artifact tolerance := by
  intro firstHidden secondHidden
  exact (global_nndist_le_coveredDiameter_add_penalty render artifact coverage
    radius constant net lipschitz firstHidden secondHidden).trans budget

theorem zeroRadius_coveredDiameter_certifies_global
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (constant tolerance : NNReal)
    (net : FiberRadiusNet coverage 0)
    (lipschitz : FiberLipschitzAt render artifact constant)
    (diameterLe : coveredFiberDiameter render artifact coverage ≤ tolerance) :
    GlobalWithinNNTolerance render artifact tolerance := by
  apply coveredDiameter_add_penalty_certifies_global render artifact coverage
    0 constant tolerance net lipschitz
  simpa using diameterLe

theorem finiteVerdict_with_penalty_certifies_global
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (radius constant coveredTolerance globalTolerance : NNReal)
    (net : FiberRadiusNet coverage radius)
    (lipschitz : FiberLipschitzAt render artifact constant)
    (finiteCertified :
      classifyFiberDiameter render artifact coveredTolerance coverage =
        .certifiedWithinTolerance)
    (budget : coveredTolerance + 2 * (constant * radius) ≤ globalTolerance) :
    GlobalWithinNNTolerance render artifact globalTolerance := by
  have diameterLe :=
    (classifyFiberDiameter_eq_certified_iff render artifact coveredTolerance
      coverage).mp finiteCertified |>.2
  apply coveredDiameter_add_penalty_certifies_global render artifact coverage
    radius constant globalTolerance net lipschitz
  have penalizedDiameterLe :
      coveredFiberDiameter render artifact coverage +
          2 * (constant * radius) ≤
        coveredTolerance + 2 * (constant * radius) := by
    gcongr
  exact penalizedDiameterLe.trans budget

theorem globalWithinZero_iff_fiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry]
    (render : Artifact → Hidden → Geometry) :
    (∀ artifact, GlobalWithinNNTolerance render artifact 0) ↔
      ArtifactFiberIndependent render := by
  constructor
  · intro global artifact firstHidden secondHidden
    apply eq_of_nndist_eq_zero
    exact le_zero_iff.mp (global artifact firstHidden secondHidden)
  · intro independent artifact firstHidden secondHidden
    exact le_zero_iff.mpr
      (nndist_eq_zero.mpr (independent artifact firstHidden secondHidden))

inductive BinaryHidden where
  | low
  | high
deriving DecidableEq, Repr

instance : Fintype BinaryHidden where
  elems := {.low, .high}
  complete := by
    intro hidden
    cases hidden <;> simp

def binaryHiddenValue : BinaryHidden → ℝ
  | .low => 0
  | .high => 1

theorem binaryHiddenValue_injective :
    Function.Injective binaryHiddenValue := by
  intro first second sameValue
  cases first <;> cases second <;>
    simp [binaryHiddenValue] at sameValue ⊢

instance : MetricSpace BinaryHidden :=
  MetricSpace.induced binaryHiddenValue binaryHiddenValue_injective inferInstance

@[simp] theorem binaryHidden_dist_eq (first second : BinaryHidden) :
    dist first second = dist (binaryHiddenValue first) (binaryHiddenValue second) :=
  rfl

@[simp] theorem binaryHidden_nndist_eq (first second : BinaryHidden) :
    nndist first second =
      nndist (binaryHiddenValue first) (binaryHiddenValue second) :=
  rfl

def falseCoverage : Finset BinaryHidden := {.low}

theorem falseCoverage_radiusOne_net :
    FiberRadiusNet falseCoverage 1 := by
  constructor
  intro hidden
  refine ⟨.low, by simp [falseCoverage], ?_⟩
  cases hidden <;>
    apply NNReal.coe_le_coe.mp <;>
    norm_num [coe_nndist, binaryHiddenValue]

theorem falseCoverage_not_zeroRadiusNet :
  ¬FiberRadiusNet falseCoverage 0 := by
  intro net
  obtain ⟨covered, coveredMem, distanceLe⟩ := net.cover .high
  have coveredFalse : covered = .low := by
    simpa [falseCoverage] using coveredMem
  subst covered
  have distanceOne : nndist BinaryHidden.high BinaryHidden.low = 1 := by
    apply NNReal.eq
    norm_num [coe_nndist, binaryHiddenValue]
  rw [distanceOne] at distanceLe
  norm_num at distanceLe

def spikeRender (_artifact : Unit) (hidden : BinaryHidden) : ℝ :=
  match hidden with
  | .low => 0
  | .high => 100

theorem spike_falseCoverage_diameter_zero :
    coveredFiberDiameter spikeRender () falseCoverage = 0 := by
  apply (coveredFiberDiameter_eq_zero_iff_coveredIndependent spikeRender ()
    falseCoverage).mpr
  intro firstHidden firstMem secondHidden secondMem
  have firstFalse : firstHidden = .low := by
    simpa [falseCoverage] using firstMem
  have secondFalse : secondHidden = .low := by
    simpa [falseCoverage] using secondMem
  subst firstHidden
  subst secondHidden
  rfl

theorem spike_not_globalWithinZero :
    ¬GlobalWithinNNTolerance spikeRender () 0 := by
  intro global
  have impossible := global .low .high
  have distanceHundred :
      nndist (spikeRender () .low) (spikeRender () .high) = 100 := by
    apply NNReal.eq
    norm_num [coe_nndist, spikeRender, Real.dist_eq]
  rw [distanceHundred] at impossible
  norm_num at impossible

theorem spike_not_zeroLipschitz :
    ¬FiberLipschitzAt spikeRender () 0 := by
  intro zeroLipschitz
  have impossible := zeroLipschitz .low .high
  have distanceHundred :
      nndist (spikeRender () .low) (spikeRender () .high) = 100 := by
    apply NNReal.eq
    norm_num [coe_nndist, spikeRender, Real.dist_eq]
  rw [distanceHundred] at impossible
  norm_num at impossible

/-- A radius-one net plus a zero observed diameter does not by itself control
an unseen spike; a valid sensitivity constant is load-bearing. -/
theorem radiusNet_and_zeroDiameter_do_not_suffice_without_lipschitz :
    FiberRadiusNet falseCoverage 1 ∧
      coveredFiberDiameter spikeRender () falseCoverage = 0 ∧
      ¬GlobalWithinNNTolerance spikeRender () 0 := by
  exact ⟨falseCoverage_radiusOne_net, spike_falseCoverage_diameter_zero,
    spike_not_globalWithinZero⟩

def binaryCoverage : Finset BinaryHidden := Finset.univ

theorem binaryCoverage_zeroRadiusNet :
    FiberRadiusNet binaryCoverage 0 := by
  constructor
  intro hidden
  exact ⟨hidden, by simp [binaryCoverage], by simp⟩

def binaryCloseRender (_artifact : Unit) : BinaryHidden → ℝ
  | .low => 0
  | .high => 1

theorem binaryCloseRender_lipschitz_one :
    FiberLipschitzAt binaryCloseRender () 1 := by
  intro firstHidden secondHidden
  cases firstHidden <;> cases secondHidden <;>
    apply NNReal.coe_le_coe.mp <;>
    norm_num [coe_nndist, binaryCloseRender, binaryHiddenValue, Real.dist_eq]

theorem binaryCloseRender_fullCoverage_diameter_one :
    coveredFiberDiameter binaryCloseRender () binaryCoverage = 1 := by
  apply le_antisymm
  · rw [coveredFiberDiameter_le_iff]
    intro firstHidden _ secondHidden _
    cases firstHidden <;> cases secondHidden <;>
      apply NNReal.coe_le_coe.mp <;>
      norm_num [coe_nndist, binaryCloseRender, Real.dist_eq]
  · calc
      1 = nndist (binaryCloseRender () .low)
          (binaryCloseRender () .high) := by
        symm
        apply NNReal.eq
        norm_num [coe_nndist, binaryCloseRender, Real.dist_eq]
      _ ≤ coveredFiberDiameter binaryCloseRender () binaryCoverage :=
        pair_nndist_le_coveredFiberDiameter binaryCloseRender () binaryCoverage
          .low .high (by simp [binaryCoverage]) (by simp [binaryCoverage])

theorem binaryCloseRender_fullCoverage_certifies_global_one :
    GlobalWithinNNTolerance binaryCloseRender () 1 := by
  apply zeroRadius_coveredDiameter_certifies_global binaryCloseRender ()
    binaryCoverage 1 1 binaryCoverage_zeroRadiusNet
      binaryCloseRender_lipschitz_one
  rw [binaryCloseRender_fullCoverage_diameter_one]

inductive TernaryHidden where
  | left
  | center
  | right
deriving DecidableEq, Repr

def ternaryHiddenValue : TernaryHidden → ℝ
  | .left => -1
  | .center => 0
  | .right => 1

theorem ternaryHiddenValue_injective :
    Function.Injective ternaryHiddenValue := by
  intro first second sameValue
  cases first <;> cases second <;>
    simp [ternaryHiddenValue] at sameValue ⊢
  all_goals norm_num at sameValue

instance : MetricSpace TernaryHidden :=
  MetricSpace.induced ternaryHiddenValue ternaryHiddenValue_injective
    inferInstance

@[simp] theorem ternaryHidden_nndist_eq (first second : TernaryHidden) :
    nndist first second =
      nndist (ternaryHiddenValue first) (ternaryHiddenValue second) :=
  rfl

def centerCoverage : Finset TernaryHidden := {.center}

theorem centerCoverage_radiusOne_net :
    FiberRadiusNet centerCoverage 1 := by
  constructor
  intro hidden
  refine ⟨.center, by simp [centerCoverage], ?_⟩
  cases hidden <;>
    apply NNReal.coe_le_coe.mp <;>
    norm_num [coe_nndist, ternaryHiddenValue, Real.dist_eq]

def lineRender (_artifact : Unit) (hidden : TernaryHidden) : ℝ :=
  ternaryHiddenValue hidden

theorem lineRender_lipschitz_one :
    FiberLipschitzAt lineRender () 1 := by
  intro firstHidden secondHidden
  simp [lineRender]

theorem lineRender_centerCoverage_diameter_zero :
    coveredFiberDiameter lineRender () centerCoverage = 0 := by
  apply (coveredFiberDiameter_eq_zero_iff_coveredIndependent lineRender ()
    centerCoverage).mpr
  intro firstHidden firstMem secondHidden secondMem
  have firstCenter : firstHidden = .center := by
    simpa [centerCoverage] using firstMem
  have secondCenter : secondHidden = .center := by
    simpa [centerCoverage] using secondMem
  subst firstHidden
  subst secondHidden
  rfl

/-- The factor two cannot be reduced for a uniform radius certificate: both
unseen endpoints can lie on opposite sides of one covered center. -/
theorem coveredDiameter_add_twoRadius_factor_tight :
    nndist (lineRender () .left) (lineRender () .right) =
      coveredFiberDiameter lineRender () centerCoverage + 2 * (1 * 1) := by
  rw [lineRender_centerCoverage_diameter_zero]
  apply NNReal.eq
  norm_num [coe_nndist, lineRender, ternaryHiddenValue, Real.dist_eq]

theorem lineRender_centerNet_certifies_global_two :
    GlobalWithinNNTolerance lineRender () 2 := by
  apply coveredDiameter_add_penalty_certifies_global lineRender ()
    centerCoverage 1 1 2 centerCoverage_radiusOne_net
      lineRender_lipschitz_one
  rw [lineRender_centerCoverage_diameter_zero]
  norm_num

end Sprawlens.RepresentationCoverageGeneralization
