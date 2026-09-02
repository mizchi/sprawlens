import Sprawlens.FixedPointJournalDurability
import Sprawlens.SameEndpointConsistency

namespace Sprawlens.RepresentationFactorization

open FixedPointAtomicCounterPublication
open FixedPointJournalDurability
open FixedPointRepeatedCounterPublication
open FixedPointTransactionalResourceCounter
open HistorySelectorConfluence
open LayoutConfluence
open SameEndpointConsistency

universe u v w x

/-- A representation is reliable on each artifact fiber when arbitrary hidden
history states cannot change its output. -/
def ArtifactFiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry) : Prop :=
  ∀ artifact firstHidden secondHidden,
    render artifact firstHidden = render artifact secondHidden

/-- The same contract stated as factorization through the artifact projection. -/
def FactorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry) : Prop :=
  ∃ pure : Artifact → Geometry,
    ∀ artifact hidden, render artifact hidden = pure artifact

theorem factorsThroughArtifact_implies_fiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (factors : FactorsThroughArtifact render) :
    ArtifactFiberIndependent render := by
  obtain ⟨pure, factorEq⟩ := factors
  intro artifact firstHidden secondHidden
  rw [factorEq artifact firstHidden, factorEq artifact secondHidden]

theorem fiberIndependent_implies_factorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry)
    (independent : ArtifactFiberIndependent render) :
    FactorsThroughArtifact render := by
  refine ⟨fun artifact => render artifact default, ?_⟩
  intro artifact hidden
  exact independent artifact hidden default

theorem fiberIndependent_iff_factorsThroughArtifact
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry) :
    ArtifactFiberIndependent render ↔ FactorsThroughArtifact render := by
  constructor
  · exact fiberIndependent_implies_factorsThroughArtifact render
  · exact factorsThroughArtifact_implies_fiberIndependent render

def ReachableFiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (reachable : Artifact → Hidden → Prop)
    (render : Artifact → Hidden → Geometry) : Prop :=
  ∀ artifact firstHidden secondHidden,
    reachable artifact firstHidden → reachable artifact secondHidden →
      render artifact firstHidden = render artifact secondHidden

def FiberComplete
    {Artifact : Type u} {Hidden : Type v}
    (reachable : Artifact → Hidden → Prop) : Prop :=
  ∀ artifact hidden, reachable artifact hidden

theorem fiberIndependent_implies_reachableFiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (reachable : Artifact → Hidden → Prop)
    (render : Artifact → Hidden → Geometry)
    (independent : ArtifactFiberIndependent render) :
    ReachableFiberIndependent reachable render := by
  intro artifact firstHidden secondHidden _ _
  exact independent artifact firstHidden secondHidden

theorem reachableFiberIndependent_implies_global_of_complete
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (reachable : Artifact → Hidden → Prop)
    (render : Artifact → Hidden → Geometry)
    (complete : FiberComplete reachable)
    (independent : ReachableFiberIndependent reachable render) :
    ArtifactFiberIndependent render := by
  intro artifact firstHidden secondHidden
  exact independent artifact firstHidden secondHidden
    (complete artifact firstHidden) (complete artifact secondHidden)

def liftPure
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Geometry) : Artifact → Hidden → Geometry :=
  fun artifact _hidden => render artifact

theorem liftPure_fiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Geometry) :
    ArtifactFiberIndependent (liftPure (Hidden := Hidden) render) := by
  intro _ _ _
  rfl

theorem pureRepresentation_has_no_historyLeakage
    (render : Nat → Bool)
    : ArtifactFiberIndependent (fun artifact (_hidden : Unit) => render artifact) := by
  exact liftPure_fiberIndependent render

structure RepresentationState (Artifact : Type u) (Hidden : Type v) where
  artifact : Artifact
  hidden : Hidden

def renderState
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (state : RepresentationState Artifact Hidden) : Geometry :=
  render state.artifact state.hidden

inductive HiddenEdit (Hidden : Type v) where
  | set (hidden : Hidden)

def applyHiddenEdit
    {Artifact : Type u} {Hidden : Type v} :
    HiddenEdit Hidden → RepresentationState Artifact Hidden →
      RepresentationState Artifact Hidden
  | .set hidden, state => { state with hidden }

theorem fiberIndependent_implies_sameEndpointConsistent
    {Edit : Type u} {Artifact : Type v} {Hidden : Type w}
    {Geometry : Type x}
    (render : Artifact → Hidden → Geometry)
    (apply : Edit → RepresentationState Artifact Hidden →
      RepresentationState Artifact Hidden)
    (independent : ArtifactFiberIndependent render) :
    SameEndpointConsistent
      (fun state => state.artifact) (renderState render) apply := by
  intro first second state sameArtifact
  unfold EndpointEquivalentAt at sameArtifact
  change (runEdits apply first state).artifact =
    (runEdits apply second state).artifact at sameArtifact
  change render (runEdits apply first state).artifact
      (runEdits apply first state).hidden =
    render (runEdits apply second state).artifact
      (runEdits apply second state).hidden
  rw [sameArtifact]
  exact independent _ _ _

theorem sameEndpointConsistent_hiddenEdit_implies_fiberIndependent
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry)
    (consistent : SameEndpointConsistent
      (fun state : RepresentationState Artifact Hidden => state.artifact)
      (renderState render) applyHiddenEdit) :
    ArtifactFiberIndependent render := by
  intro artifact firstHidden secondHidden
  let initial : RepresentationState Artifact Hidden :=
    { artifact, hidden := firstHidden }
  have sameArtifact : EndpointEquivalentAt
      (fun state : RepresentationState Artifact Hidden => state.artifact)
      applyHiddenEdit [.set firstHidden] [.set secondHidden] initial := by
    rfl
  have sameGeometry := consistent [.set firstHidden] [.set secondHidden]
    initial sameArtifact
  simpa [renderState, runEdits, applyHiddenEdit, initial] using sameGeometry

theorem fiberIndependent_iff_sameEndpointConsistent_hiddenEdit
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    (render : Artifact → Hidden → Geometry) :
    ArtifactFiberIndependent render ↔
      SameEndpointConsistent
        (fun state : RepresentationState Artifact Hidden => state.artifact)
        (renderState render) applyHiddenEdit := by
  constructor
  · intro independent
    exact fiberIndependent_implies_sameEndpointConsistent render applyHiddenEdit
      independent
  · exact sameEndpointConsistent_hiddenEdit_implies_fiberIndependent render

theorem factorsThroughArtifact_iff_sameEndpointConsistent_hiddenEdit
    {Artifact : Type u} {Hidden : Type v} {Geometry : Type w}
    [Inhabited Hidden]
    (render : Artifact → Hidden → Geometry) :
    FactorsThroughArtifact render ↔
      SameEndpointConsistent
        (fun state : RepresentationState Artifact Hidden => state.artifact)
        (renderState render) applyHiddenEdit := by
  rw [← fiberIndependent_iff_factorsThroughArtifact render,
    fiberIndependent_iff_sameEndpointConsistent_hiddenEdit]

def recoveredRepresentation
    {History : Type u} {Artifact : Type v} {Hidden : Type w}
    {Geometry : Type x}
    (recover : History → Option Artifact)
    (hidden : History → Hidden)
    (render : Artifact → Hidden → Geometry)
    (history : History) : Option Geometry :=
  (recover history).map fun artifact => render artifact (hidden history)

theorem recoveredRepresentation_eq_of_sameArtifact
    {History : Type u} {Artifact : Type v} {Hidden : Type w}
    {Geometry : Type x}
    (recover : History → Option Artifact)
    (hidden : History → Hidden)
    (render : Artifact → Hidden → Geometry)
    (independent : ArtifactFiberIndependent render)
    (first second : History)
    (sameRecovery : recover first = recover second) :
    recoveredRepresentation recover hidden render first =
      recoveredRepresentation recover hidden render second := by
  unfold recoveredRepresentation
  rw [sameRecovery]
  cases recoveredEq : recover second with
  | none => rfl
  | some artifact =>
      exact congrArg some (independent artifact (hidden first) (hidden second))

theorem recoveredRepresentation_factors_to_pure
    {History : Type u} {Artifact : Type v} {Hidden : Type w}
    {Geometry : Type x}
    (recover : History → Option Artifact)
    (hidden : History → Hidden)
    (render : Artifact → Hidden → Geometry)
    (factors : FactorsThroughArtifact render) :
    ∃ pure : Artifact → Geometry,
      ∀ history,
        recoveredRepresentation recover hidden render history =
          (recover history).map pure := by
  obtain ⟨pure, factorEq⟩ := factors
  refine ⟨pure, ?_⟩
  intro history
  cases recoveredEq : recover history with
  | none => simp [recoveredRepresentation, recoveredEq]
  | some artifact =>
      simp [recoveredRepresentation, recoveredEq,
        factorEq artifact (hidden history)]

def selectorLeakingRender
    (_artifact : Bool × Bool) (hidden : Bool) : Bool :=
  hidden

theorem selectorLeakingRender_not_fiberIndependent :
    ¬ArtifactFiberIndependent selectorLeakingRender := by
  intro independent
  have impossible := independent (true, true) false true
  simp [selectorLeakingRender] at impossible

theorem selectorLeakingRender_not_factorsThroughArtifact :
    ¬FactorsThroughArtifact selectorLeakingRender := by
  intro factors
  exact selectorLeakingRender_not_fiberIndependent
    (factorsThroughArtifact_implies_fiberIndependent
      selectorLeakingRender factors)

def falseOnlyReachable
    (_artifact : Bool × Bool) (hidden : Bool) : Prop :=
  hidden = false

/-- Testing only one reachable hidden state per artifact can look reliable even
when the renderer globally leaks history. Fiber coverage is load-bearing for
the converse factorization claim. -/
theorem selectorLeakingRender_reliable_on_falseOnlyReachable :
    ReachableFiberIndependent falseOnlyReachable selectorLeakingRender := by
  intro artifact firstHidden secondHidden firstReachable secondReachable
  subst firstHidden
  subst secondHidden
  rfl

theorem falseOnlyReachable_not_fiberComplete :
    ¬FiberComplete falseOnlyReachable := by
  intro complete
  have impossible := complete (true, true) true
  simp [falseOnlyReachable] at impossible

theorem finiteSelector_is_artifactFiber_violation :
    let ab := applyInputEdit .enableB (applyInputEdit .enableA base)
    let ba := applyInputEdit .enableA (applyInputEdit .enableB base)
    inputProjection ab = inputProjection ba ∧ ab.selected ≠ ba.selected := by
  exact ⟨input_endpoint_commutes, selected_endpoint_differs⟩

/-- Apply a potentially hidden-state representation only after verified
recovery. Epoch and journal slot metadata are deliberately projected away. -/
def recoveredHiddenRepresentation
    {Hidden : Type u} {Geometry : Type v}
    (render : ResourceCounterState → Hidden → Geometry)
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation)
    (hidden : Hidden) : Option Geometry :=
  (recoverDurabilityEntry snapshot counters observation).map
    fun entry => render entry.counters hidden

theorem acknowledgedRecoveries_sameArtifact_noninterference
    {Hidden : Type u} {Geometry : Type v}
    (render : ResourceCounterState → Hidden → Geometry)
    (independent : ArtifactFiberIndependent render)
    (firstSnapshot secondSnapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (firstObservation secondObservation : DurabilityObservation)
    (firstHidden secondHidden : Hidden)
    (firstValid : firstSnapshot.Valid)
    (secondValid : secondSnapshot.Valid)
    (firstSafe : SafeAckPolicy firstObservation)
    (secondSafe : SafeAckPolicy secondObservation)
    (firstAck : firstObservation.acknowledged = true)
    (secondAck : secondObservation.acknowledged = true) :
    recoveredHiddenRepresentation render firstSnapshot counters firstObservation
        firstHidden =
      recoveredHiddenRepresentation render secondSnapshot counters secondObservation
        secondHidden := by
  have firstRecovered := acknowledgedUpdate_survives_crash firstSnapshot counters
    firstObservation firstValid firstSafe firstAck
  have secondRecovered := acknowledgedUpdate_survives_crash secondSnapshot counters
    secondObservation secondValid secondSafe secondAck
  unfold recoveredHiddenRepresentation
  rw [firstRecovered, secondRecovered]
  simp [nextEntry, independent counters firstHidden secondHidden]

def laterDurabilitySnapshot : JournalSnapshot :=
  { currentSlot := .right,
    current := { epoch := 100, counters := crashOld },
    previous := none }

def fullyDurableAck : DurabilityObservation :=
  { candidateDurable := true, markerDurable := true, acknowledged := true }

/-- Journal epoch is hidden metadata. Rendering it directly reintroduces a
history difference even though both recovered payload artifacts are equal. -/
theorem storageEpoch_leaks_if_rendered_witness :
    let first := recoverDurabilityEntry durabilitySnapshot crashNew fullyDurableAck
    let second := recoverDurabilityEntry laterDurabilitySnapshot crashNew
      fullyDurableAck
    first.map JournalEntry.counters = second.map JournalEntry.counters ∧
      first.map JournalEntry.epoch ≠ second.map JournalEntry.epoch := by
  native_decide

end Sprawlens.RepresentationFactorization
