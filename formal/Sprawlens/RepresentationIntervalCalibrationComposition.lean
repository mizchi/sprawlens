import Sprawlens.RepresentationIntervalLocalCalibration

namespace Sprawlens.RepresentationIntervalCalibrationComposition

open RepresentationIntervalHellyCenter
open RepresentationIntervalRobustness
open RepresentationIntervalMonotoneCalibration
open RepresentationIntervalMetricCalibration
open RepresentationIntervalLocalCalibration

universe u v

noncomputable def composeCalibration
    {Artifact : Type u}
    (first second : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact) : ℝ ↪o ℝ :=
  (first artifact).trans (second artifact)

def multiplySlope
    {Artifact : Type u}
    (first second : Artifact → ℝ)
    (artifact : Artifact) : ℝ :=
  first artifact * second artifact

def MapsCalibrationDomainAt
    {Artifact : Type u}
    (calibration : Artifact → ℝ ↪o ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact) : Prop :=
  ∀ value ∈ source artifact,
    calibration artifact value ∈ intermediate artifact

theorem localSecantDistortion_compose
    {Artifact : Type u}
    (first second : Artifact → ℝ ↪o ℝ)
    (firstLower firstUpper secondLower secondUpper : Artifact → ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact)
    (firstDistortion : SecantDistortionOnAt first firstLower firstUpper source
      artifact)
    (secondDistortion : SecantDistortionOnAt second secondLower secondUpper
      intermediate artifact)
    (mapsDomain : MapsCalibrationDomainAt first source intermediate artifact) :
    SecantDistortionOnAt (composeCalibration first second)
      (multiplySlope firstLower secondLower)
      (multiplySlope firstUpper secondUpper) source artifact := by
  refine ⟨mul_nonneg firstDistortion.1 secondDistortion.1, ?_, ?_⟩
  · exact mul_le_mul firstDistortion.2.1 secondDistortion.2.1
      secondDistortion.1 (firstDistortion.1.trans firstDistortion.2.1)
  · intro firstValue firstMem secondValue secondMem firstLeSecond
    have firstBounds := firstDistortion.2.2 firstValue firstMem secondValue
      secondMem firstLeSecond
    have mappedFirstMem := mapsDomain firstValue firstMem
    have mappedSecondMem := mapsDomain secondValue secondMem
    have mappedOrder := (first artifact).monotone firstLeSecond
    have secondBounds := secondDistortion.2.2 (first artifact firstValue)
      mappedFirstMem (first artifact secondValue) mappedSecondMem mappedOrder
    have secondUpperNonnegative : 0 ≤ secondUpper artifact :=
      secondDistortion.1.trans secondDistortion.2.1
    change
      firstLower artifact * secondLower artifact *
            (secondValue - firstValue) ≤
          second artifact (first artifact secondValue) -
            second artifact (first artifact firstValue) ∧
        second artifact (first artifact secondValue) -
            second artifact (first artifact firstValue) ≤
          firstUpper artifact * secondUpper artifact *
            (secondValue - firstValue)
    constructor
    · calc
        firstLower artifact * secondLower artifact *
              (secondValue - firstValue) =
            secondLower artifact *
              (firstLower artifact * (secondValue - firstValue)) := by ring
        _ ≤ secondLower artifact *
              (first artifact secondValue - first artifact firstValue) :=
          mul_le_mul_of_nonneg_left firstBounds.1 secondDistortion.1
        _ ≤ second artifact (first artifact secondValue) -
              second artifact (first artifact firstValue) := secondBounds.1
    · calc
        second artifact (first artifact secondValue) -
              second artifact (first artifact firstValue) ≤
            secondUpper artifact *
              (first artifact secondValue - first artifact firstValue) :=
          secondBounds.2
        _ ≤ secondUpper artifact *
              (firstUpper artifact * (secondValue - firstValue)) :=
          mul_le_mul_of_nonneg_left firstBounds.2 secondUpperNonnegative
        _ = firstUpper artifact * secondUpper artifact *
              (secondValue - firstValue) := by ring

theorem composeCalibration_apply
    {Artifact : Type u}
    (first second : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (value : ℝ) :
    composeCalibration first second artifact value =
      second artifact (first artifact value) := rfl

theorem composeCalibration_assoc
    {Artifact : Type u}
    (first second third : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact) :
    composeCalibration (composeCalibration first second) third artifact =
      composeCalibration first (composeCalibration second third) artifact := by
  rfl

theorem calibratedEndpoint_compose
    {Artifact : Type u} {Constraint : Type v}
    (endpoint : Artifact → Constraint → ℝ)
    (first second : Artifact → ℝ ↪o ℝ)
    (artifact : Artifact)
    (constraint : Constraint) :
    calibratedEndpoint (calibratedEndpoint endpoint first) second artifact
        constraint =
      calibratedEndpoint endpoint (composeCalibration first second) artifact
        constraint := rfl

theorem mappedEndpointsInIntermediateDomain
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (first : Artifact → ℝ ↪o ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt lower upper
      source artifact constraints)
    (mapsDomain : MapsCalibrationDomainAt first source intermediate artifact) :
    IntervalEndpointsInCalibrationDomainAt (calibratedEndpoint lower first)
      (calibratedEndpoint upper first) intermediate artifact constraints := by
  intro constraint constraintMem
  exact ⟨mapsDomain _ (endpointsInSource constraint constraintMem).1,
    mapsDomain _ (endpointsInSource constraint constraintMem).2⟩

theorem feasibleGap_composedCalibrationBounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (first second : Artifact → ℝ ↪o ℝ)
    (firstLower firstUpper secondLower secondUpper : Artifact → ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (firstDistortion : SecantDistortionOnAt first firstLower firstUpper source
      artifact)
    (secondDistortion : SecantDistortionOnAt second secondLower secondUpper
      intermediate artifact)
    (mapsDomain : MapsCalibrationDomainAt first source intermediate artifact)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt lower upper
      source artifact constraints)
    (feasible : 0 ≤
      intervalFeasibilityGap lower upper artifact constraints nonempty) :
    multiplySlope firstLower secondLower artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty ≤
        intervalFeasibilityGap
          (calibratedEndpoint lower (composeCalibration first second))
          (calibratedEndpoint upper (composeCalibration first second)) artifact
            constraints nonempty ∧
      intervalFeasibilityGap
          (calibratedEndpoint lower (composeCalibration first second))
          (calibratedEndpoint upper (composeCalibration first second)) artifact
            constraints nonempty ≤
        multiplySlope firstUpper secondUpper artifact *
          intervalFeasibilityGap lower upper artifact constraints nonempty := by
  apply feasibleGap_localMetricDistortionBounds_of_endpoints lower upper
    (composeCalibration first second) (multiplySlope firstLower secondLower)
      (multiplySlope firstUpper secondUpper) source artifact constraints nonempty
  · exact localSecantDistortion_compose first second firstLower firstUpper
      secondLower secondUpper source intermediate artifact firstDistortion
        secondDistortion mapsDomain
  · exact endpointsInSource
  · exact feasible

theorem infeasibleDeficit_composedCalibrationBounds
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (lower upper : Artifact → Constraint → ℝ)
    (first second : Artifact → ℝ ↪o ℝ)
    (firstLower firstUpper secondLower secondUpper : Artifact → ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (firstDistortion : SecantDistortionOnAt first firstLower firstUpper source
      artifact)
    (secondDistortion : SecantDistortionOnAt second secondLower secondUpper
      intermediate artifact)
    (mapsDomain : MapsCalibrationDomainAt first source intermediate artifact)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt lower upper
      source artifact constraints)
    (infeasible :
      intervalFeasibilityGap lower upper artifact constraints nonempty ≤ 0) :
    multiplySlope firstLower secondLower artifact *
          (-intervalFeasibilityGap lower upper artifact constraints nonempty) ≤
        -intervalFeasibilityGap
          (calibratedEndpoint lower (composeCalibration first second))
          (calibratedEndpoint upper (composeCalibration first second)) artifact
            constraints nonempty ∧
      -intervalFeasibilityGap
          (calibratedEndpoint lower (composeCalibration first second))
          (calibratedEndpoint upper (composeCalibration first second)) artifact
            constraints nonempty ≤
        multiplySlope firstUpper secondUpper artifact *
          (-intervalFeasibilityGap lower upper artifact constraints nonempty) := by
  apply infeasibleGap_localMetricDistortionBounds lower upper
    (composeCalibration first second) (multiplySlope firstLower secondLower)
      (multiplySlope firstUpper secondUpper) source artifact constraints nonempty
  · exact localSecantDistortion_compose first second firstLower firstUpper
      secondLower secondUpper source intermediate artifact firstDistortion
        secondDistortion mapsDomain
  · exact intervalEndpointsInDomain_implies_extremaInDomain lower upper source
      artifact constraints nonempty endpointsInSource
  · exact infeasible

theorem observedGap_ge_composedLowerSlope_sub_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (first second : Artifact → ℝ ↪o ℝ)
    (firstLower firstUpper secondLower secondUpper : Artifact → ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (firstDistortion : SecantDistortionOnAt first firstLower firstUpper source
      artifact)
    (secondDistortion : SecantDistortionOnAt second secondLower secondUpper
      intermediate artifact)
    (mapsDomain : MapsCalibrationDomainAt first source intermediate artifact)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (residual : MetricCalibrationResidualBoundAt exactLower exactUpper
      observedLower observedUpper (composeCalibration first second) artifact
        constraints residualError) :
    multiplySlope firstLower secondLower artifact *
          intervalFeasibilityGap exactLower exactUpper artifact constraints
            nonempty -
        2 * residualError ≤
      intervalFeasibilityGap observedLower observedUpper artifact constraints
        nonempty := by
  apply observedGap_ge_localLowerScaledExactGap_sub_twoResidual exactLower
    exactUpper observedLower observedUpper (composeCalibration first second)
      (multiplySlope firstLower secondLower)
      (multiplySlope firstUpper secondUpper) source artifact constraints nonempty
        residualError
  · exact localSecantDistortion_compose first second firstLower firstUpper
      secondLower secondUpper source intermediate artifact firstDistortion
        secondDistortion mapsDomain
  · exact endpointsInSource
  · exact exactFeasible
  · exact residual

theorem commonCenter_preserved_of_composedGap_ge_twoResidual
    {Artifact : Type u} {Constraint : Type v}
    [DecidableEq Constraint]
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (first second : Artifact → ℝ ↪o ℝ)
    (firstLower firstUpper secondLower secondUpper : Artifact → ℝ)
    (source intermediate : Artifact → Set ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (residualError : ℝ)
    (firstDistortion : SecantDistortionOnAt first firstLower firstUpper source
      artifact)
    (secondDistortion : SecantDistortionOnAt second secondLower secondUpper
      intermediate artifact)
    (mapsDomain : MapsCalibrationDomainAt first source intermediate artifact)
    (endpointsInSource : IntervalEndpointsInCalibrationDomainAt exactLower
      exactUpper source artifact constraints)
    (exactFeasible : 0 ≤ intervalFeasibilityGap exactLower exactUpper artifact
      constraints nonempty)
    (residual : MetricCalibrationResidualBoundAt exactLower exactUpper
      observedLower observedUpper (composeCalibration first second) artifact
        constraints residualError)
    (robustGap : 2 * residualError ≤
      multiplySlope firstLower secondLower artifact *
        intervalFeasibilityGap exactLower exactUpper artifact constraints
          nonempty) :
    CommonIntervalCenterAt observedLower observedUpper artifact constraints := by
  apply commonCenter_preserved_of_localDistortedGap_ge_twoResidual exactLower
    exactUpper observedLower observedUpper (composeCalibration first second)
      (multiplySlope firstLower secondLower)
      (multiplySlope firstUpper secondUpper) source artifact constraints nonempty
        residualError
  · exact localSecantDistortion_compose first second firstLower firstUpper
      secondLower secondUpper source intermediate artifact firstDistortion
        secondDistortion mapsDomain
  · exact endpointsInSource
  · exact exactFeasible
  · exact residual
  · exact robustGap

noncomputable def identityCalibration : ℝ ↪o ℝ :=
  OrderEmbedding.ofStrictMono id strictMono_id

noncomputable def artifactWideIdentity (_artifact : Unit) : ℝ ↪o ℝ :=
  identityCalibration

def allCalibrationDomain (_artifact : Unit) : Set ℝ :=
  Set.univ

theorem identityCalibration_secantDistortion_one_one_on_all :
    SecantDistortionOnAt artifactWideIdentity hingeLowerSlope hingeLowerSlope
      allCalibrationDomain () := by
  refine ⟨by norm_num [hingeLowerSlope], le_rfl, ?_⟩
  intro first _ second _ _
  change
    1 * (second - first) ≤
          identityCalibration second - identityCalibration first ∧
      identityCalibration second - identityCalibration first ≤
        1 * (second - first)
  simp only [identityCalibration, OrderEmbedding.coe_ofStrictMono, id_eq]
  constructor <;> ring_nf <;> exact le_rfl

/-- Identity maps the global source outside the hinge's nonpositive certified
domain, so the load-bearing domain-map premise is false. -/
theorem identity_does_not_map_all_to_nonpositive :
    ¬MapsCalibrationDomainAt artifactWideIdentity allCalibrationDomain
      nonpositiveCalibrationDomain () := by
  intro mapsDomain
  have oneMapped := mapsDomain 1 (by simp [allCalibrationDomain])
  norm_num [artifactWideIdentity, identityCalibration,
    nonpositiveCalibrationDomain, OrderEmbedding.ofStrictMono] at oneMapped

/-- Both local stage certificates hold, but without the domain-map premise the
product slope `1` is false for their composition, whose `[0,1]` secant is the
hinge's expanded slope `2`. -/
theorem localCertificates_do_not_compose_without_domainMap :
    SecantDistortionOnAt artifactWideIdentity hingeLowerSlope hingeLowerSlope
        allCalibrationDomain () ∧
      SecantDistortionOnAt artifactWideHinge hingeLowerSlope hingeLowerSlope
        nonpositiveCalibrationDomain () ∧
      ¬MapsCalibrationDomainAt artifactWideIdentity allCalibrationDomain
        nonpositiveCalibrationDomain () ∧
      composeCalibration artifactWideIdentity artifactWideHinge () 1 -
          composeCalibration artifactWideIdentity artifactWideHinge () 0 ≠
        multiplySlope hingeLowerSlope hingeLowerSlope () * ((1 : ℝ) - 0) := by
  refine ⟨identityCalibration_secantDistortion_one_one_on_all,
    hingeCalibration_secantDistortion_one_one_on_nonpositive,
    identity_does_not_map_all_to_nonpositive, ?_⟩
  norm_num [composeCalibration, artifactWideIdentity, identityCalibration,
    artifactWideHinge, hingeCalibration, hingeValue, multiplySlope,
    hingeLowerSlope, OrderEmbedding.ofStrictMono]

end Sprawlens.RepresentationIntervalCalibrationComposition
