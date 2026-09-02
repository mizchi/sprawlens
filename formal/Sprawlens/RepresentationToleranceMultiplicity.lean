import Sprawlens.RepresentationFiberMultiplicity

namespace Sprawlens.RepresentationToleranceMultiplicity

open RepresentationFiberMultiplicity
open RepresentationFactorization

universe u v w x

def WithinTolerance
    {Geometry : Type u} [PseudoMetricSpace Geometry]
    (tolerance : ℝ) (first second : Geometry) : Prop :=
  dist first second ≤ tolerance

theorem withinTolerance_refl
    {Geometry : Type u} [PseudoMetricSpace Geometry]
    (tolerance : ℝ) (nonnegative : 0 ≤ tolerance)
    (geometry : Geometry) :
    WithinTolerance tolerance geometry geometry := by
  simp [WithinTolerance, nonnegative]

theorem withinTolerance_symm
    {Geometry : Type u} [PseudoMetricSpace Geometry]
    (tolerance : ℝ) (first second : Geometry) :
    WithinTolerance tolerance first second ↔
      WithinTolerance tolerance second first := by
  simp [WithinTolerance, dist_comm]

theorem unitTolerance_not_transitive :
    WithinTolerance 1 (0 : ℝ) 1 ∧
      WithinTolerance 1 (1 : ℝ) 2 ∧
      ¬WithinTolerance 1 (0 : ℝ) 2 := by
  norm_num [WithinTolerance, Real.dist_eq]

/-- Equality of bucket identifiers is transitive, so it cannot characterize a
nontransitive tolerance relation in both directions. -/
theorem no_exactBucket_of_nontransitive
    {Geometry : Type u} [PseudoMetricSpace Geometry]
    {Bucket : Type v}
    (tolerance : ℝ)
    (first middle last : Geometry)
    (firstMiddle : WithinTolerance tolerance first middle)
    (middleLast : WithinTolerance tolerance middle last)
    (firstLastFar : ¬WithinTolerance tolerance first last) :
    ¬∃ bucket : Geometry → Bucket,
      ∀ left right,
        bucket left = bucket right ↔ WithinTolerance tolerance left right := by
  rintro ⟨bucket, exactBucket⟩
  have firstMiddleBucket := (exactBucket first middle).mpr firstMiddle
  have middleLastBucket := (exactBucket middle last).mpr middleLast
  exact firstLastFar ((exactBucket first last).mp
    (firstMiddleBucket.trans middleLastBucket))

theorem unitTolerance_has_no_exactBucket
    (Bucket : Type v) :
    ¬∃ bucket : ℝ → Bucket,
      ∀ left right,
        bucket left = bucket right ↔ WithinTolerance 1 left right := by
  exact no_exactBucket_of_nontransitive 1 (0 : ℝ) 1 2
    unitTolerance_not_transitive.1
    unitTolerance_not_transitive.2.1
    unitTolerance_not_transitive.2.2

def ToleranceConnected
    {Geometry : Type u} [PseudoMetricSpace Geometry]
    (tolerance : ℝ) : Geometry → Geometry → Prop :=
  Relation.ReflTransGen (WithinTolerance tolerance)

/-- Transitive closure repairs equivalence-like connectivity but introduces
single-linkage chaining: endpoints outside tolerance can share a component. -/
theorem unitTolerance_chain_connects_far_endpoints :
    ToleranceConnected 1 (0 : ℝ) 2 ∧
      ¬WithinTolerance 1 (0 : ℝ) 2 := by
  constructor
  · exact (Relation.ReflTransGen.single unitTolerance_not_transitive.1).trans
      (Relation.ReflTransGen.single unitTolerance_not_transitive.2.1)
  · exact unitTolerance_not_transitive.2.2

structure ToleranceSummaryAt
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : ℝ)
    (Bucket : Type x) where
  summarize : Hidden → Bucket
  sameSummary_sound : ∀ firstHidden secondHidden,
    summarize firstHidden = summarize secondHidden →
      WithinTolerance tolerance
        (render artifact firstHidden) (render artifact secondHidden)

def certifiedMultiplicity
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Bucket]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden) : Nat :=
  fiberMultiplicity (fun (_ : Unit) hidden => certificate.summarize hidden)
    () coverage

def CoveredSummaryCollapsed
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden) : Prop :=
  ∀ firstHidden ∈ coverage, ∀ secondHidden ∈ coverage,
    certificate.summarize firstHidden = certificate.summarize secondHidden

def CoveredWithinTolerance
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (tolerance : ℝ)
    (coverage : Finset Hidden) : Prop :=
  ∀ firstHidden ∈ coverage, ∀ secondHidden ∈ coverage,
    WithinTolerance tolerance
      (render artifact firstHidden) (render artifact secondHidden)

theorem certifiedMultiplicity_eq_one_iff_collapsed
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Bucket]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden)
    (nonempty : coverage.Nonempty) :
    certifiedMultiplicity certificate coverage = 1 ↔
      CoveredSummaryCollapsed certificate coverage := by
  simpa [certifiedMultiplicity, CoveredSummaryCollapsed,
    CoveredFiberIndependent] using
    fiberMultiplicity_eq_one_iff_coveredIndependent
      (fun (_ : Unit) hidden => certificate.summarize hidden) () coverage nonempty

theorem certifiedMultiplicity_one_implies_coveredTolerance
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Bucket]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden)
    (nonempty : coverage.Nonempty)
    (multiplicityOne : certifiedMultiplicity certificate coverage = 1) :
    CoveredWithinTolerance render artifact tolerance coverage := by
  have collapsed := (certifiedMultiplicity_eq_one_iff_collapsed certificate
    coverage nonempty).mp multiplicityOne
  intro firstHidden firstMem secondHidden secondMem
  exact certificate.sameSummary_sound firstHidden secondHidden
    (collapsed firstHidden firstMem secondHidden secondMem)

inductive ToleranceMultiplicityVerdict where
  | certifiedWithinTolerance
  | inconclusive
deriving DecidableEq, Repr

def classifyToleranceMultiplicity
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Bucket]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden) : ToleranceMultiplicityVerdict :=
  if coverage = ∅ then .inconclusive
  else if certifiedMultiplicity certificate coverage = 1 then
    .certifiedWithinTolerance
  else .inconclusive

theorem classifyToleranceMultiplicity_eq_certified_iff
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Bucket]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden) :
    classifyToleranceMultiplicity certificate coverage =
        .certifiedWithinTolerance ↔
      coverage.Nonempty ∧ certifiedMultiplicity certificate coverage = 1 := by
  by_cases empty : coverage = ∅
  · simp [classifyToleranceMultiplicity, empty]
  · simp [classifyToleranceMultiplicity, empty, Finset.nonempty_iff_ne_empty]

theorem classifyToleranceMultiplicity_certified_sound
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry] [DecidableEq Hidden] [DecidableEq Bucket]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact} {tolerance : ℝ}
    (certificate : ToleranceSummaryAt render artifact tolerance Bucket)
    (coverage : Finset Hidden)
    (certified : classifyToleranceMultiplicity certificate coverage =
      .certifiedWithinTolerance) :
    CoveredWithinTolerance render artifact tolerance coverage := by
  obtain ⟨nonempty, multiplicityOne⟩ :=
    (classifyToleranceMultiplicity_eq_certified_iff certificate coverage).mp
      certified
  exact certifiedMultiplicity_one_implies_coveredTolerance certificate coverage
    nonempty multiplicityOne

structure CenteredSummaryAt
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [PseudoMetricSpace Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (Bucket : Type x) where
  summarize : Hidden → Bucket
  center : Bucket → Geometry
  radius : ℝ
  member_bound : ∀ hidden,
    dist (render artifact hidden) (center (summarize hidden)) ≤ radius

theorem CenteredSummaryAt.sameSummary_distance_le_twoRadius
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact}
    (certificate : CenteredSummaryAt render artifact Bucket)
    (firstHidden secondHidden : Hidden)
    (sameSummary : certificate.summarize firstHidden =
      certificate.summarize secondHidden) :
    dist (render artifact firstHidden) (render artifact secondHidden) ≤
      2 * certificate.radius := by
  calc
    dist (render artifact firstHidden) (render artifact secondHidden) ≤
        dist (render artifact firstHidden)
            (certificate.center (certificate.summarize firstHidden)) +
          dist (certificate.center (certificate.summarize firstHidden))
            (render artifact secondHidden) :=
      dist_triangle _ _ _
    _ = dist (render artifact firstHidden)
            (certificate.center (certificate.summarize firstHidden)) +
          dist (render artifact secondHidden)
            (certificate.center (certificate.summarize secondHidden)) := by
      rw [dist_comm
        (certificate.center (certificate.summarize firstHidden))
        (render artifact secondHidden), sameSummary]
    _ ≤ certificate.radius + certificate.radius :=
      add_le_add (certificate.member_bound firstHidden)
        (certificate.member_bound secondHidden)
    _ = 2 * certificate.radius := by ring

def CenteredSummaryAt.toToleranceSummary
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Bucket : Type x}
    [PseudoMetricSpace Geometry]
    {render : Artifact → Hidden → Geometry}
    {artifact : Artifact}
    (certificate : CenteredSummaryAt render artifact Bucket) :
    ToleranceSummaryAt render artifact (2 * certificate.radius) Bucket where
  summarize := certificate.summarize
  sameSummary_sound := by
    intro firstHidden secondHidden sameSummary
    exact certificate.sameSummary_distance_le_twoRadius
      firstHidden secondHidden sameSummary

def closeRender (_artifact : Unit) (hidden : Bool) : ℝ :=
  if hidden then 1 else 0

def splitCloseCertificate :
    ToleranceSummaryAt closeRender () 2 Bool where
  summarize := id
  sameSummary_sound := by
    intro firstHidden secondHidden sameSummary
    have hiddenEq : firstHidden = secondHidden := by
      simpa using sameSummary
    subst secondHidden
    simp [WithinTolerance]

def mergedCloseCertificate :
    ToleranceSummaryAt closeRender () 2 Unit where
  summarize := fun _ => ()
  sameSummary_sound := by
    intro firstHidden secondHidden _
    cases firstHidden <;> cases secondHidden <;>
      norm_num [WithinTolerance, closeRender, Real.dist_eq]

def boolCoverage : Finset Bool := Finset.univ

/-- A conservative certificate may split geometries that are mutually close. -/
theorem splitClose_pairwiseWithinTolerance :
    CoveredWithinTolerance closeRender () 2 boolCoverage := by
  intro firstHidden _ secondHidden _
  cases firstHidden <;> cases secondHidden <;>
    norm_num [WithinTolerance, closeRender, Real.dist_eq]

theorem splitClose_certifiedMultiplicity_two :
    certifiedMultiplicity splitCloseCertificate boolCoverage = 2 := by
  native_decide

theorem coveredTolerance_does_not_force_certifiedMultiplicity_one :
    CoveredWithinTolerance closeRender () 2 boolCoverage ∧
      certifiedMultiplicity splitCloseCertificate boolCoverage = 2 := by
  exact ⟨splitClose_pairwiseWithinTolerance,
    splitClose_certifiedMultiplicity_two⟩

theorem splitClose_verdict_inconclusive :
    classifyToleranceMultiplicity splitCloseCertificate boolCoverage =
      .inconclusive := by
  native_decide

theorem mergedClose_verdict_certified :
    classifyToleranceMultiplicity mergedCloseCertificate boolCoverage =
      .certifiedWithinTolerance := by
  native_decide

theorem emptyToleranceCoverage_inconclusive :
    classifyToleranceMultiplicity mergedCloseCertificate ∅ = .inconclusive := by
  native_decide

def sharpRender (_artifact : Unit) (hidden : Bool) : ℝ :=
  if hidden then 1 else -1

def sharpCenteredCertificate : CenteredSummaryAt sharpRender () Unit where
  summarize := fun _ => ()
  center := fun _ => 0
  radius := 1
  member_bound := by
    intro hidden
    cases hidden <;> norm_num [sharpRender, Real.dist_eq]

/-- The factor two in a center-radius diameter certificate is attained. -/
theorem centeredSummary_factorTwo_tight :
    dist (sharpRender () false) (sharpRender () true) =
      2 * sharpCenteredCertificate.radius := by
  norm_num [sharpRender, sharpCenteredCertificate, Real.dist_eq]

end Sprawlens.RepresentationToleranceMultiplicity
