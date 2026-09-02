import Sprawlens.RepresentationApproximateFactorization
import Sprawlens.SoftSelectorValidity

namespace Sprawlens.RepresentationValidApproximateFactorization

open RepresentationApproximateFactorization
open RepresentationCoverageGeneralization
open RepresentationFactorization
open SoftSelectorValidity

universe u v w

def ValidFactorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop) : Prop :=
  ∃ pure : Artifact → Geometry,
    (∀ artifact, valid artifact (pure artifact)) ∧
      ∀ artifact hidden, render artifact hidden = pure artifact

/-- Approximate factorization whose artifact center is itself admissible. -/
def ValidApproximatelyFactorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (radius : NNReal) : Prop :=
  ∃ pure : Artifact → Geometry,
    (∀ artifact, valid artifact (pure artifact)) ∧
      ∀ artifact hidden,
        nndist (render artifact hidden) (pure artifact) ≤ radius

theorem validApproximate_forgets_validity
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {valid : Artifact → Geometry → Prop}
    {radius : NNReal}
    (validApproximate :
      ValidApproximatelyFactorsThroughArtifact render valid radius) :
    ApproximatelyFactorsThroughArtifact render radius := by
  obtain ⟨pure, _, errorLe⟩ := validApproximate
  exact ⟨pure, errorLe⟩

theorem validApproximate_mono_radius
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {valid : Artifact → Geometry → Prop}
    {smallerRadius largerRadius : NNReal}
    (validApproximate :
      ValidApproximatelyFactorsThroughArtifact render valid smallerRadius)
    (radiusLe : smallerRadius ≤ largerRadius) :
    ValidApproximatelyFactorsThroughArtifact render valid largerRadius := by
  obtain ⟨pure, pureValid, errorLe⟩ := validApproximate
  exact ⟨pure, pureValid, fun artifact hidden =>
    (errorLe artifact hidden).trans radiusLe⟩

theorem validFactors_implies_validApproximatelyZero
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (factors : ValidFactorsThroughArtifact render valid) :
    ValidApproximatelyFactorsThroughArtifact render valid 0 := by
  obtain ⟨pure, pureValid, factorEq⟩ := factors
  refine ⟨pure, pureValid, ?_⟩
  intro artifact hidden
  exact le_zero_iff.mpr (by simp [factorEq artifact hidden])

theorem validApproximatelyZero_implies_validFactors
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (approximate :
      ValidApproximatelyFactorsThroughArtifact render valid 0) :
    ValidFactorsThroughArtifact render valid := by
  obtain ⟨pure, pureValid, errorLe⟩ := approximate
  refine ⟨pure, pureValid, ?_⟩
  intro artifact hidden
  apply eq_of_nndist_eq_zero
  exact le_zero_iff.mp (errorLe artifact hidden)

theorem validApproximatelyZero_iff_validFactors
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [MetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop) :
    ValidApproximatelyFactorsThroughArtifact render valid 0 ↔
      ValidFactorsThroughArtifact render valid := by
  constructor
  · exact validApproximatelyZero_implies_validFactors render valid
  · exact validFactors_implies_validApproximatelyZero render valid

theorem validApproximate_implies_globalWithin_twoRadius
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (radius : NNReal)
    (validApproximate :
      ValidApproximatelyFactorsThroughArtifact render valid radius) :
    ∀ artifact, GlobalWithinNNTolerance render artifact (2 * radius) := by
  exact approximateFactorization_implies_globalWithin_twoRadius render radius
    (validApproximate_forgets_validity validApproximate)

/-- An observed output is automatically a valid center when the selected
anchor is valid. This may use radius ε rather than an optimal smaller radius. -/
theorem globalWithin_validAnchor_implies_validApproximate
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (tolerance : NNReal)
    (global : ∀ artifact,
      GlobalWithinNNTolerance render artifact tolerance)
    (anchorValid : ∀ artifact, valid artifact (render artifact default)) :
    ValidApproximatelyFactorsThroughArtifact render valid tolerance := by
  refine ⟨fun artifact => render artifact default, anchorValid, ?_⟩
  intro artifact hidden
  exact global artifact hidden default

/-- Moving an approximate center by at most ρ to an admissible center adds at
most ρ to the certified radius. -/
theorem repairedCenter_yields_validApproximate
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (center repaired : Artifact → Geometry)
    (radius repairPenalty : NNReal)
    (centerError : ∀ artifact hidden,
      nndist (render artifact hidden) (center artifact) ≤ radius)
    (repairedValid : ∀ artifact, valid artifact (repaired artifact))
    (repairDistance : ∀ artifact,
      nndist (center artifact) (repaired artifact) ≤ repairPenalty) :
    ValidApproximatelyFactorsThroughArtifact render valid
      (radius + repairPenalty) := by
  refine ⟨repaired, repairedValid, ?_⟩
  intro artifact hidden
  exact (nndist_triangle (render artifact hidden) (center artifact)
    (repaired artifact)).trans
      (add_le_add (centerError artifact hidden) (repairDistance artifact))

def endpointValid (_artifact : Unit) (geometry : ℝ) : Prop :=
  geometry = -1 ∨ geometry = 1

theorem sharpApprox_outputs_endpointValid
    (hidden : Bool) :
    endpointValid () (sharpApproxRender () hidden) := by
  cases hidden <;> simp [endpointValid, sharpApproxRender]

theorem sharpApprox_validFactorization_radius_two :
    ValidApproximatelyFactorsThroughArtifact sharpApproxRender endpointValid 2 := by
  refine ⟨fun _ => -1, by simp [endpointValid], ?_⟩
  intro artifact hidden
  cases hidden <;>
    apply NNReal.coe_le_coe.mp <;>
    norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

theorem sharpApprox_not_validFactorization_below_two
    (radius : NNReal)
    (radiusLt : radius < 2) :
    ¬ValidApproximatelyFactorsThroughArtifact sharpApproxRender
      endpointValid radius := by
  rintro ⟨center, centerValid, errorLe⟩
  rcases centerValid () with centerLow | centerHigh
  · have error := errorLe () true
    have distanceTwo :
        nndist (sharpApproxRender () true) (center ()) = 2 := by
      rw [centerLow]
      apply NNReal.eq
      norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]
    rw [distanceTwo] at error
    exact (not_le_of_gt radiusLt) error
  · have error := errorLe () false
    have distanceTwo :
        nndist (sharpApproxRender () false) (center ()) = 2 := by
      rw [centerHigh]
      apply NNReal.eq
      norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]
    rw [distanceTwo] at error
    exact (not_le_of_gt radiusLt) error

theorem sharpApprox_validFactorization_iff_two_le_radius
    (radius : NNReal) :
    ValidApproximatelyFactorsThroughArtifact sharpApproxRender endpointValid
        radius ↔
      2 ≤ radius := by
  constructor
  · intro validApproximate
    by_contra notLe
    exact sharpApprox_not_validFactorization_below_two radius
      (lt_of_not_ge notLe) validApproximate
  · intro twoLe
    exact validApproximate_mono_radius
      sharpApprox_validFactorization_radius_two twoLe

theorem endpointValidity_doubles_minimum_radius :
    ApproximatelyFactorsThroughArtifact sharpApproxRender 1 ∧
      ¬ValidApproximatelyFactorsThroughArtifact sharpApproxRender
        endpointValid 1 ∧
      ValidApproximatelyFactorsThroughArtifact sharpApproxRender
        endpointValid 2 := by
  exact ⟨sharpApprox_factorization_radius_one,
    sharpApprox_not_validFactorization_below_two 1 (by norm_num),
    sharpApprox_validFactorization_radius_two⟩

def intervalValid (_artifact : Unit) (geometry : ℝ) : Prop :=
  -1 ≤ geometry ∧ geometry ≤ 1

theorem endpointValid_not_convex :
    ¬Convex ℝ {geometry : ℝ | endpointValid () geometry} := by
  intro convex
  have midpoint := convex.lineMap_mem
    (show endpointValid () (-1) by simp [endpointValid])
    (show endpointValid () 1 by simp [endpointValid])
    (show (1 / 2 : ℝ) ∈ Set.Icc 0 1 by norm_num)
  have midpointEq :
      AffineMap.lineMap (-1 : ℝ) 1 (1 / 2 : ℝ) = 0 := by
    simp only [AffineMap.lineMap_apply_module]
    norm_num
  rw [midpointEq] at midpoint
  norm_num [endpointValid] at midpoint

theorem sharpApprox_intervalValidFactorization_radius_one :
    ValidApproximatelyFactorsThroughArtifact sharpApproxRender intervalValid 1 := by
  refine ⟨fun _ => 0, by norm_num [intervalValid], ?_⟩
  intro artifact hidden
  cases hidden <;>
    apply NNReal.coe_le_coe.mp <;>
    norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

/-- Repairing the optimal center 0 to the valid endpoint -1 moves it by one;
the opposite output then attains the additive radius 1 + 1 = 2. -/
theorem sharpApprox_endpointRepair_additive_bound_tight :
    nndist (0 : ℝ) (-1) = 1 ∧
      nndist (sharpApproxRender () true) (-1) = 2 := by
  constructor <;>
    apply NNReal.eq <;>
    norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

end Sprawlens.RepresentationValidApproximateFactorization
