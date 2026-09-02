import Sprawlens.RepresentationValidApproximateFactorization

namespace Sprawlens.RepresentationProtectedCenter

open RepresentationApproximateFactorization
open RepresentationCoverageGeneralization
open RepresentationValidApproximateFactorization

universe u v w x

def SatisfiesProtected
    {Artifact : Type u} {Constraint : Type v} {Geometry : Type w}
    (accepted : Artifact → Constraint → Geometry → Prop)
    (artifact : Artifact)
    (geometry : Geometry) : Prop :=
  ∀ constraint, accepted artifact constraint geometry

def ProtectedValid
    {Artifact : Type u} {Constraint : Type v} {Geometry : Type w}
    (valid : Artifact → Geometry → Prop)
    (accepted : Artifact → Constraint → Geometry → Prop)
    (artifact : Artifact)
    (geometry : Geometry) : Prop :=
  valid artifact geometry ∧ SatisfiesProtected accepted artifact geometry

def ProtectedApproximatelyFactorsThroughArtifact
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (accepted : Artifact → Constraint → Geometry → Prop)
    (radius : NNReal) : Prop :=
  ValidApproximatelyFactorsThroughArtifact render
    (ProtectedValid valid accepted) radius

def ProtectedFactorsThroughArtifact
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (accepted : Artifact → Constraint → Geometry → Prop) : Prop :=
  ValidFactorsThroughArtifact render (ProtectedValid valid accepted)

theorem protectedApproximate_forgets_constraints
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {valid : Artifact → Geometry → Prop}
    {accepted : Artifact → Constraint → Geometry → Prop}
    {radius : NNReal}
    (certificate : ProtectedApproximatelyFactorsThroughArtifact render valid
      accepted radius) :
    ValidApproximatelyFactorsThroughArtifact render valid radius := by
  obtain ⟨center, centerProtected, errorLe⟩ := certificate
  exact ⟨center, fun artifact => (centerProtected artifact).1, errorLe⟩

theorem protectedApproximate_has_commonCenter
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {valid : Artifact → Geometry → Prop}
    {accepted : Artifact → Constraint → Geometry → Prop}
    {radius : NNReal}
    (certificate : ProtectedApproximatelyFactorsThroughArtifact render valid
      accepted radius) :
    ∃ center : Artifact → Geometry,
      ∀ artifact,
        valid artifact (center artifact) ∧
          SatisfiesProtected accepted artifact (center artifact) := by
  obtain ⟨center, centerProtected, _⟩ := certificate
  exact ⟨center, centerProtected⟩

theorem protectedApproximatelyZero_iff_protectedFactors
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [MetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (accepted : Artifact → Constraint → Geometry → Prop) :
    ProtectedApproximatelyFactorsThroughArtifact render valid accepted 0 ↔
      ProtectedFactorsThroughArtifact render valid accepted := by
  exact validApproximatelyZero_iff_validFactors render
    (ProtectedValid valid accepted)

/-- Weakening every protected acceptance predicate preserves a witness. -/
theorem protectedApproximate_mono_constraints
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {valid : Artifact → Geometry → Prop}
    {strong weak : Artifact → Constraint → Geometry → Prop}
    {radius : NNReal}
    (weaken : ∀ artifact constraint geometry,
      strong artifact constraint geometry →
        weak artifact constraint geometry)
    (certificate : ProtectedApproximatelyFactorsThroughArtifact render valid
      strong radius) :
    ProtectedApproximatelyFactorsThroughArtifact render valid weak radius := by
  obtain ⟨center, centerProtected, errorLe⟩ := certificate
  refine ⟨center, ?_, errorLe⟩
  intro artifact
  exact ⟨(centerProtected artifact).1, fun constraint =>
    weaken artifact constraint (center artifact)
      ((centerProtected artifact).2 constraint)⟩

theorem globalWithin_protectedAnchor_implies_protectedApproximate
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [PseudoMetricSpace Geometry] [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (accepted : Artifact → Constraint → Geometry → Prop)
    (tolerance : NNReal)
    (global : ∀ artifact,
      GlobalWithinNNTolerance render artifact tolerance)
    (anchorValid : ∀ artifact, valid artifact (render artifact default))
    (anchorProtected : ∀ artifact,
      SatisfiesProtected accepted artifact (render artifact default)) :
    ProtectedApproximatelyFactorsThroughArtifact render valid accepted
      tolerance := by
  exact globalWithin_validAnchor_implies_validApproximate render
    (ProtectedValid valid accepted) tolerance global fun artifact =>
      ⟨anchorValid artifact, anchorProtected artifact⟩

theorem repairedProtectedCenter_yields_protectedApproximate
    {Artifact : Type u} {Constraint : Type v}
    {Hidden : Type w} {Geometry : Type x}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (valid : Artifact → Geometry → Prop)
    (accepted : Artifact → Constraint → Geometry → Prop)
    (center repaired : Artifact → Geometry)
    (radius repairPenalty : NNReal)
    (centerError : ∀ artifact hidden,
      nndist (render artifact hidden) (center artifact) ≤ radius)
    (repairedValid : ∀ artifact, valid artifact (repaired artifact))
    (repairedProtected : ∀ artifact,
      SatisfiesProtected accepted artifact (repaired artifact))
    (repairDistance : ∀ artifact,
      nndist (center artifact) (repaired artifact) ≤ repairPenalty) :
    ProtectedApproximatelyFactorsThroughArtifact render valid accepted
      (radius + repairPenalty) := by
  exact repairedCenter_yields_validApproximate render
    (ProtectedValid valid accepted) center repaired radius repairPenalty
      centerError (fun artifact =>
        ⟨repairedValid artifact, repairedProtected artifact⟩)
      repairDistance

def separatedAccepted
    (_artifact : Unit) (constraint : Bool) (geometry : ℝ) : Prop :=
  if constraint then geometry = 1 else geometry = -1

theorem separated_constraints_individually_feasible :
    ∀ constraint, ∃ geometry,
      endpointValid () geometry ∧
        separatedAccepted () constraint geometry := by
  intro constraint
  cases constraint
  · exact ⟨-1, by simp [endpointValid], by simp [separatedAccepted]⟩
  · exact ⟨1, by simp [endpointValid], by simp [separatedAccepted]⟩

theorem separated_constraints_individually_convex :
    ∀ constraint,
      Convex ℝ {geometry : ℝ | separatedAccepted () constraint geometry} := by
  intro constraint
  cases constraint
  · simp [separatedAccepted]
  · simp [separatedAccepted]

theorem separated_constraints_have_no_commonCenter :
    ¬∃ geometry,
      endpointValid () geometry ∧
        SatisfiesProtected separatedAccepted () geometry := by
  rintro ⟨geometry, _, satisfiesAll⟩
  have left := satisfiesAll false
  have right := satisfiesAll true
  simp [separatedAccepted] at left right
  rw [left] at right
  norm_num at right

/-- No amount of metric tolerance repairs an empty protected intersection. -/
theorem separated_constraints_forbid_protectedApproximate
    (radius : NNReal) :
    ¬ProtectedApproximatelyFactorsThroughArtifact sharpApproxRender
      endpointValid separatedAccepted radius := by
  intro certificate
  obtain ⟨center, common⟩ :=
    protectedApproximate_has_commonCenter certificate
  exact separated_constraints_have_no_commonCenter
    ⟨center (), common ()⟩

def meetingAccepted
    (_artifact : Unit) (constraint : Bool) (geometry : ℝ) : Prop :=
  if constraint then 0 ≤ geometry else geometry ≤ 0

theorem meeting_constraints_iff_zero
    (geometry : ℝ) :
    SatisfiesProtected meetingAccepted () geometry ↔ geometry = 0 := by
  constructor
  · intro satisfiesAll
    have nonpositive := satisfiesAll false
    have nonnegative := satisfiesAll true
    simp [meetingAccepted] at nonpositive nonnegative
    linarith
  · intro geometryZero constraint
    subst geometry
    cases constraint <;> simp [meetingAccepted]

theorem sharpApprox_meetingProtected_radius_one :
    ProtectedApproximatelyFactorsThroughArtifact sharpApproxRender
      intervalValid meetingAccepted 1 := by
  refine ⟨fun _ => 0, ?_, ?_⟩
  · intro artifact
    exact ⟨by norm_num [intervalValid],
      (meeting_constraints_iff_zero 0).mpr rfl⟩
  · intro artifact hidden
    cases hidden <;>
      apply NNReal.coe_le_coe.mp <;>
      norm_num [coe_nndist, sharpApproxRender, Real.dist_eq]

end Sprawlens.RepresentationProtectedCenter
