import Sprawlens.RepresentationFactorization
import Mathlib.Data.Finset.Card

namespace Sprawlens.RepresentationFiberMultiplicity

open RepresentationFactorization

universe u v w x

def ObservationalEquivalentAt
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (firstHidden secondHidden : Hidden) : Prop :=
  render artifact firstHidden = render artifact secondHidden

def observationSetoid
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact) : Setoid Hidden where
  r := ObservationalEquivalentAt render artifact
  iseqv := {
    refl := fun _ => rfl
    symm := fun equal => equal.symm
    trans := fun first second => first.trans second
  }

def ObservationClass
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact) : Type v :=
  Quotient (observationSetoid render artifact)

def observationClassOf
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (hidden : Hidden) : ObservationClass render artifact :=
  Quotient.mk (observationSetoid render artifact) hidden

theorem observationClassOf_eq_iff
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (firstHidden secondHidden : Hidden) :
    observationClassOf render artifact firstHidden =
        observationClassOf render artifact secondHidden ↔
      render artifact firstHidden = render artifact secondHidden := by
  constructor
  · intro classesEqual
    exact Quotient.exact classesEqual
  · intro geometryEqual
    exact Quotient.sound geometryEqual

def quotientGeometry
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact) : ObservationClass render artifact → Geometry :=
  Quotient.lift (render artifact) fun _ _ equivalent => equivalent

@[simp] theorem quotientGeometry_observationClassOf
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (hidden : Hidden) :
    quotientGeometry render artifact (observationClassOf render artifact hidden) =
      render artifact hidden := by
  rfl

def SummarySufficientAt
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Summary : Type x}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (summarize : Hidden → Summary) : Prop :=
  ∃ decode : Summary → Geometry,
    ∀ hidden, render artifact hidden = decode (summarize hidden)

theorem sufficientSummary_equal_implies_equalGeometry
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Summary : Type x}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (summarize : Hidden → Summary)
    (sufficient : SummarySufficientAt render artifact summarize)
    (firstHidden secondHidden : Hidden)
    (sameSummary : summarize firstHidden = summarize secondHidden) :
    render artifact firstHidden = render artifact secondHidden := by
  obtain ⟨decode, decodeEq⟩ := sufficient
  rw [decodeEq firstHidden, decodeEq secondHidden, sameSummary]

/-- Every sufficient summary refines the observational quotient: it may retain
extra distinctions, but it cannot merge two different geometry classes. -/
theorem sufficientSummary_refines_observationQuotient
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Summary : Type x}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (summarize : Hidden → Summary)
    (sufficient : SummarySufficientAt render artifact summarize)
    (firstHidden secondHidden : Hidden)
    (sameSummary : summarize firstHidden = summarize secondHidden) :
    observationClassOf render artifact firstHidden =
      observationClassOf render artifact secondHidden := by
  exact (observationClassOf_eq_iff render artifact firstHidden secondHidden).mpr
    (sufficientSummary_equal_implies_equalGeometry render artifact summarize
      sufficient firstHidden secondHidden sameSummary)

theorem sufficientSummary_distinguishes_differentGeometry
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    {Summary : Type x}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (summarize : Hidden → Summary)
    (sufficient : SummarySufficientAt render artifact summarize)
    (firstHidden secondHidden : Hidden)
    (differentGeometry :
      render artifact firstHidden ≠ render artifact secondHidden) :
    summarize firstHidden ≠ summarize secondHidden := by
  intro sameSummary
  exact differentGeometry
    (sufficientSummary_equal_implies_equalGeometry render artifact summarize
      sufficient firstHidden secondHidden sameSummary)

theorem observationQuotient_is_sufficient
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact) :
    SummarySufficientAt render artifact
      (observationClassOf render artifact) := by
  refine ⟨quotientGeometry render artifact, ?_⟩
  intro hidden
  rfl

def coveredGeometries
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) : Finset Geometry :=
  coverage.image (render artifact)

def fiberMultiplicity
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) : Nat :=
  (coveredGeometries render artifact coverage).card

def CoveredFiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) : Prop :=
  ∀ firstHidden ∈ coverage, ∀ secondHidden ∈ coverage,
    render artifact firstHidden = render artifact secondHidden

def CoveredLeakageWitness
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) : Prop :=
  ∃ firstHidden ∈ coverage, ∃ secondHidden ∈ coverage,
    render artifact firstHidden ≠ render artifact secondHidden

theorem fiberMultiplicity_le_coverage
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) :
    fiberMultiplicity render artifact coverage ≤ coverage.card := by
  exact Finset.card_image_le

theorem fiberMultiplicity_mono_coverage
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    {smaller larger : Finset Hidden}
    (coverageLe : smaller ⊆ larger) :
    fiberMultiplicity render artifact smaller ≤
      fiberMultiplicity render artifact larger := by
  apply Finset.card_le_card
  intro geometry geometryMem
  obtain ⟨hidden, hiddenMem, rfl⟩ := Finset.mem_image.mp geometryMem
  exact Finset.mem_image.mpr ⟨hidden, coverageLe hiddenMem, rfl⟩

theorem fiberMultiplicity_pos_of_nonempty
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (nonempty : coverage.Nonempty) :
    0 < fiberMultiplicity render artifact coverage := by
  apply Finset.card_pos.mpr
  obtain ⟨hidden, hiddenMem⟩ := nonempty
  exact ⟨render artifact hidden,
    Finset.mem_image.mpr ⟨hidden, hiddenMem, rfl⟩⟩

theorem fiberMultiplicity_eq_zero_iff_coverage_empty
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) :
    fiberMultiplicity render artifact coverage = 0 ↔ coverage = ∅ := by
  constructor
  · intro multiplicityZero
    by_contra coverageNonempty
    have nonempty : coverage.Nonempty := Finset.nonempty_iff_ne_empty.mpr
      coverageNonempty
    have positive := fiberMultiplicity_pos_of_nonempty render artifact coverage
      nonempty
    omega
  · intro coverageEmpty
    subst coverage
    rfl

theorem fiberMultiplicity_eq_one_iff_coveredIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (nonempty : coverage.Nonempty) :
    fiberMultiplicity render artifact coverage = 1 ↔
      CoveredFiberIndependent render artifact coverage := by
  constructor
  · intro multiplicityOne
    obtain ⟨geometry, imageEq⟩ := Finset.card_eq_one.mp multiplicityOne
    intro firstHidden firstMem secondHidden secondMem
    have firstGeometryMem :
        render artifact firstHidden ∈ coveredGeometries render artifact coverage :=
      Finset.mem_image.mpr ⟨firstHidden, firstMem, rfl⟩
    have secondGeometryMem :
        render artifact secondHidden ∈ coveredGeometries render artifact coverage :=
      Finset.mem_image.mpr ⟨secondHidden, secondMem, rfl⟩
    rw [imageEq] at firstGeometryMem secondGeometryMem
    simp at firstGeometryMem secondGeometryMem
    exact firstGeometryMem.trans secondGeometryMem.symm
  · intro independent
    obtain ⟨reference, referenceMem⟩ := nonempty
    apply Finset.card_eq_one.mpr
    refine ⟨render artifact reference, ?_⟩
    ext geometry
    constructor
    · intro geometryMem
      obtain ⟨hidden, hiddenMem, rfl⟩ := Finset.mem_image.mp geometryMem
      have sameGeometry := independent hidden hiddenMem reference referenceMem
      simp [sameGeometry]
    · intro geometryMem
      have geometryEq : geometry = render artifact reference := by
        simpa using geometryMem
      subst geometry
      exact Finset.mem_image.mpr ⟨reference, referenceMem, rfl⟩

theorem not_coveredIndependent_iff_leakageWitness
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden) :
    ¬CoveredFiberIndependent render artifact coverage ↔
      CoveredLeakageWitness render artifact coverage := by
  constructor
  · intro notIndependent
    by_contra noWitness
    apply notIndependent
    intro firstHidden firstMem secondHidden secondMem
    by_contra different
    exact noWitness ⟨firstHidden, firstMem, secondHidden, secondMem, different⟩
  · rintro ⟨firstHidden, firstMem, secondHidden, secondMem, different⟩
      independent
    exact different (independent firstHidden firstMem secondHidden secondMem)

theorem fiberMultiplicity_gt_one_iff_leakageWitness
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [DecidableEq Hidden] [DecidableEq Geometry]
    (render : Artifact → Hidden → Geometry)
    (artifact : Artifact)
    (coverage : Finset Hidden)
    (nonempty : coverage.Nonempty) :
    1 < fiberMultiplicity render artifact coverage ↔
      CoveredLeakageWitness render artifact coverage := by
  rw [← not_coveredIndependent_iff_leakageWitness]
  have positive := fiberMultiplicity_pos_of_nonempty render artifact coverage
    nonempty
  have reliabilityIff := fiberMultiplicity_eq_one_iff_coveredIndependent
    render artifact coverage nonempty
  constructor
  · intro greater independent
    have equalOne := reliabilityIff.mpr independent
    omega
  · intro notIndependent
    have notOne : fiberMultiplicity render artifact coverage ≠ 1 := by
      intro equalOne
      exact notIndependent (reliabilityIff.mp equalOne)
    omega

def fullBoolCoverage : Finset Bool := Finset.univ

def falseOnlyCoverage : Finset Bool := {false}

theorem selector_fullFiberMultiplicity_two :
    fiberMultiplicity selectorLeakingRender (true, true) fullBoolCoverage = 2 := by
  native_decide

theorem selector_restrictedFiberMultiplicity_one :
    fiberMultiplicity selectorLeakingRender (true, true) falseOnlyCoverage = 1 := by
  native_decide

theorem selector_emptyFiberMultiplicity_zero :
    fiberMultiplicity selectorLeakingRender (true, true) ∅ = 0 := by
  native_decide

theorem selector_fullCoverage_has_leakageWitness :
    CoveredLeakageWitness selectorLeakingRender (true, true) fullBoolCoverage := by
  refine ⟨false, by decide, true, by decide, ?_⟩
  decide

end Sprawlens.RepresentationFiberMultiplicity
