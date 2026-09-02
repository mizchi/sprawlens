import Sprawlens.RepresentationCoverageGeneralization

namespace Sprawlens.RepresentationApproximateFactorization

open RepresentationCoverageGeneralization
open RepresentationFactorization
open RepresentationFiberDiameter
open RepresentationToleranceMultiplicity

universe u v w

/-- A stateful renderer is uniformly close to some pure artifact renderer.
The center is allowed to be any geometry, not necessarily an observed output. -/
def ApproximatelyFactorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (radius : NNReal) : Prop :=
  ∃ pure : Artifact → Geometry,
    ∀ artifact hidden,
      nndist (render artifact hidden) (pure artifact) ≤ radius

theorem approximatelyFactors_mono_radius
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {smallerRadius largerRadius : NNReal}
    (approximate :
      ApproximatelyFactorsThroughArtifact render smallerRadius)
    (radiusLe : smallerRadius ≤ largerRadius) :
    ApproximatelyFactorsThroughArtifact render largerRadius := by
  obtain ⟨pure, errorLe⟩ := approximate
  exact ⟨pure, fun artifact hidden =>
    (errorLe artifact hidden).trans radiusLe⟩

theorem factorsThroughArtifact_implies_approximatelyZero
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (factors : FactorsThroughArtifact render) :
    ApproximatelyFactorsThroughArtifact render 0 := by
  obtain ⟨pure, factorEq⟩ := factors
  refine ⟨pure, ?_⟩
  intro artifact hidden
  exact le_zero_iff.mpr (by simp [factorEq artifact hidden])

theorem approximatelyZero_implies_factorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (approximate : ApproximatelyFactorsThroughArtifact render 0) :
    FactorsThroughArtifact render := by
  obtain ⟨pure, errorLe⟩ := approximate
  refine ⟨pure, ?_⟩
  intro artifact hidden
  apply eq_of_nndist_eq_zero
  exact le_zero_iff.mp (errorLe artifact hidden)

theorem approximatelyZero_iff_factorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry]
    (render : Artifact → Hidden → Geometry) :
    ApproximatelyFactorsThroughArtifact render 0 ↔
      FactorsThroughArtifact render := by
  constructor
  · exact approximatelyZero_implies_factorsThroughArtifact render
  · exact factorsThroughArtifact_implies_approximatelyZero render

/-- A radius-r pure center bounds every pair in the same fiber by 2r. -/
theorem approximateFactorization_implies_globalWithin_twoRadius
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (radius : NNReal)
    (approximate : ApproximatelyFactorsThroughArtifact render radius) :
    ∀ artifact, GlobalWithinNNTolerance render artifact (2 * radius) := by
  obtain ⟨pure, errorLe⟩ := approximate
  intro artifact firstHidden secondHidden
  calc
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
        nndist (render artifact firstHidden) (pure artifact) +
          nndist (pure artifact) (render artifact secondHidden) :=
      nndist_triangle _ _ _
    _ = nndist (render artifact firstHidden) (pure artifact) +
        nndist (render artifact secondHidden) (pure artifact) := by
      rw [nndist_comm (pure artifact) (render artifact secondHidden)]
    _ ≤ radius + radius :=
      add_le_add (errorLe artifact firstHidden)
        (errorLe artifact secondHidden)
    _ = 2 * radius := by ring

/-- Pairwise radius ε always yields an approximate pure renderer of radius ε
by choosing one hidden state as the center. Midpoints are not assumed to exist. -/
theorem globalWithin_implies_approximateFactorization
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry)
    (tolerance : NNReal)
    (global : ∀ artifact,
      GlobalWithinNNTolerance render artifact tolerance) :
    ApproximatelyFactorsThroughArtifact render tolerance := by
  refine ⟨fun artifact => render artifact default, ?_⟩
  intro artifact hidden
  exact global artifact hidden default

theorem approximateFactorization_pair_lower_bound
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (radius : NNReal)
    (approximate : ApproximatelyFactorsThroughArtifact render radius)
    (artifact : Artifact)
    (firstHidden secondHidden : Hidden) :
    nndist (render artifact firstHidden) (render artifact secondHidden) ≤
      2 * radius := by
  exact approximateFactorization_implies_globalWithin_twoRadius render radius
    approximate artifact firstHidden secondHidden

theorem coveredGeneralization_implies_approximateFactorization
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [PseudoMetricSpace Geometry]
    [DecidableEq Hidden] [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry)
    (coverage : Finset Hidden)
    (netRadius lipschitzConstant tolerance : NNReal)
    (net : FiberRadiusNet coverage netRadius)
    (lipschitz : ∀ artifact,
      FiberLipschitzAt render artifact lipschitzConstant)
    (budget : ∀ artifact,
      coveredFiberDiameter render artifact coverage +
          2 * (lipschitzConstant * netRadius) ≤ tolerance) :
    ApproximatelyFactorsThroughArtifact render tolerance := by
  apply globalWithin_implies_approximateFactorization render tolerance
  intro artifact
  exact coveredDiameter_add_penalty_certifies_global render artifact coverage
    netRadius lipschitzConstant tolerance net (lipschitz artifact)
      (budget artifact)

theorem zeroNet_zeroDiameter_implies_exactFactorization
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Hidden] [MetricSpace Geometry]
    [DecidableEq Hidden] [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry)
    (coverage : Finset Hidden)
    (lipschitzConstant : NNReal)
    (net : FiberRadiusNet coverage 0)
    (lipschitz : ∀ artifact,
      FiberLipschitzAt render artifact lipschitzConstant)
    (diameterZero : ∀ artifact,
      coveredFiberDiameter render artifact coverage = 0) :
    FactorsThroughArtifact render := by
  apply approximatelyZero_implies_factorsThroughArtifact render
  apply coveredGeneralization_implies_approximateFactorization render coverage
    0 lipschitzConstant 0 net lipschitz
  intro artifact
  simp [diameterZero artifact]

def sharpApproxRender (_artifact : Unit) (hidden : Bool) : ℝ :=
  if hidden then 1 else -1

theorem sharpApprox_factorization_radius_one :
    ApproximatelyFactorsThroughArtifact sharpApproxRender 1 := by
  refine ⟨fun _ => 0, ?_⟩
  intro artifact hidden
  cases hidden <;>
    apply NNReal.coe_le_coe.mp <;>
    norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

theorem sharpApprox_pair_distance_two :
    nndist (sharpApproxRender () false) (sharpApproxRender () true) = 2 := by
  apply NNReal.eq
  norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

theorem sharpApprox_globalWithin_two :
    GlobalWithinNNTolerance sharpApproxRender () 2 := by
  simpa using
    (approximateFactorization_implies_globalWithin_twoRadius
      sharpApproxRender 1 sharpApprox_factorization_radius_one ())

theorem sharpApprox_not_factorization_below_one
    (radius : NNReal)
    (radiusLt : radius < 1) :
    ¬ApproximatelyFactorsThroughArtifact sharpApproxRender radius := by
  intro approximate
  have pairLe := approximateFactorization_pair_lower_bound sharpApproxRender
    radius approximate () false true
  rw [sharpApprox_pair_distance_two] at pairLe
  have twiceLt : 2 * radius < 2 := by
    calc
      2 * radius < 2 * 1 := by gcongr
      _ = 2 := by norm_num
  exact (not_lt_of_ge pairLe) twiceLt

theorem sharpApprox_factorization_iff_one_le_radius
    (radius : NNReal) :
    ApproximatelyFactorsThroughArtifact sharpApproxRender radius ↔
      1 ≤ radius := by
  constructor
  · intro approximate
    by_contra notLe
    exact sharpApprox_not_factorization_below_one radius (lt_of_not_ge notLe)
      approximate
  · intro oneLe
    exact approximatelyFactors_mono_radius sharpApprox_factorization_radius_one
      oneLe

/-- Choosing an observed endpoint as the pure anchor can be twice as costly as
using an external center available in the geometry space. -/
theorem sharpApprox_observedAnchor_error_two :
    nndist (sharpApproxRender () true) (sharpApproxRender () false) = 2 ∧
      ApproximatelyFactorsThroughArtifact sharpApproxRender 1 := by
  exact ⟨by simpa [nndist_comm] using sharpApprox_pair_distance_two,
    sharpApprox_factorization_radius_one⟩

end Sprawlens.RepresentationApproximateFactorization
