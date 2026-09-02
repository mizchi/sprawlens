import Sprawlens.FixedPointJournalIntegrity

namespace Sprawlens.FixedPointJournalDurability

open FixedPointAtomicCounterPublication
open FixedPointRepeatedCounterPublication
open FixedPointTransactionalResourceCounter

/-- These booleans are observations promised by a storage refinement. Lean does
not establish that an OS or device flush makes them true. -/
structure DurabilityObservation where
  candidateDurable : Bool
  markerDurable : Bool
  acknowledged : Bool
deriving DecidableEq, Repr

/-- The phase-bound integrity layer fails safe when a marker reaches durable
storage without its complete candidate: only both durable bits expose `new`. -/
def failSafeStoreFromDurability
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation) : TwoSlotStore :=
  if observation.candidateDurable then
    if observation.markerDurable then committedUpdateStore snapshot counters
    else pendingUpdateStore snapshot counters
  else materializeSnapshot snapshot

def recoverDurabilityEntry
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation) : Option JournalEntry :=
  recoverEntry (failSafeStoreFromDurability snapshot counters observation)

theorem current_ne_nextEntry
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) :
    snapshot.current ≠ nextEntry snapshot counters := by
  intro entriesEqual
  have epochEqual := congrArg JournalEntry.epoch entriesEqual
  simp [nextEntry] at epochEqual

theorem nextEntry_ne_current
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) :
    nextEntry snapshot counters ≠ snapshot.current :=
  Ne.symm (current_ne_nextEntry snapshot counters)

/-- Exposing the complete new record is equivalent to both durable facts. -/
theorem recoverDurabilityEntry_eq_next_iff
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation)
    (valid : snapshot.Valid) :
    recoverDurabilityEntry snapshot counters observation =
        some (nextEntry snapshot counters) ↔
      observation.candidateDurable = true ∧
        observation.markerDurable = true := by
  cases observation with
  | mk candidateDurable markerDurable acknowledged =>
      cases candidateDurable <;> cases markerDurable <;>
        simp [recoverDurabilityEntry, failSafeStoreFromDurability,
          recover_materializedSnapshot_eq_current snapshot valid,
          recover_pendingUpdateStore_eq_current,
          recover_committedUpdateStore_eq_next,
          current_ne_nextEntry snapshot counters]

theorem recoverDurabilityEntry_eq_current_iff
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation)
    (valid : snapshot.Valid) :
    recoverDurabilityEntry snapshot counters observation =
        some snapshot.current ↔
      observation.candidateDurable = false ∨
        observation.markerDurable = false := by
  cases observation with
  | mk candidateDurable markerDurable acknowledged =>
      cases candidateDurable <;> cases markerDurable <;>
        simp [recoverDurabilityEntry, failSafeStoreFromDurability,
          recover_materializedSnapshot_eq_current snapshot valid,
          recover_pendingUpdateStore_eq_current,
          recover_committedUpdateStore_eq_next,
          nextEntry_ne_current snapshot counters]

def SafeAckPolicy (observation : DurabilityObservation) : Prop :=
  observation.acknowledged = true →
    observation.candidateDurable = true ∧ observation.markerDurable = true

theorem acknowledgedUpdate_survives_crash
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation)
    (valid : snapshot.Valid)
    (safeAck : SafeAckPolicy observation)
    (acknowledged : observation.acknowledged = true) :
    recoverDurabilityEntry snapshot counters observation =
      some (nextEntry snapshot counters) := by
  exact (recoverDurabilityEntry_eq_next_iff snapshot counters observation valid).mpr
    (safeAck acknowledged)

theorem safeAckPolicy_iff_ack_implies_recovery
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation)
    (valid : snapshot.Valid) :
    SafeAckPolicy observation ↔
      (observation.acknowledged = true →
        recoverDurabilityEntry snapshot counters observation =
          some (nextEntry snapshot counters)) := by
  constructor
  · intro safeAck acknowledged
    exact acknowledgedUpdate_survives_crash snapshot counters observation valid
      safeAck acknowledged
  · intro survives acknowledged
    exact (recoverDurabilityEntry_eq_next_iff snapshot counters observation
      valid).mp (survives acknowledged)

/-- For an acknowledged observation, crash survival is not merely implied by
the two durable facts; it is equivalent to them in this model. -/
theorem acknowledgedRecovery_iff_bothDurable
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (observation : DurabilityObservation)
    (valid : snapshot.Valid)
    (_acknowledged : observation.acknowledged = true) :
    recoverDurabilityEntry snapshot counters observation =
        some (nextEntry snapshot counters) ↔
      observation.candidateDurable = true ∧
        observation.markerDurable = true := by
  exact recoverDurabilityEntry_eq_next_iff snapshot counters observation valid

def durabilitySnapshot : JournalSnapshot :=
  { currentSlot := .left,
    current := { epoch := 7, counters := crashOld },
    previous := none }

theorem durabilitySnapshot_valid : durabilitySnapshot.Valid := by
  simp [durabilitySnapshot, JournalSnapshot.Valid]

def recoverDurabilityFixture
    (observation : DurabilityObservation) : Option ResourceCounterState :=
  (recoverDurabilityEntry durabilitySnapshot crashNew observation).map
    JournalEntry.counters

def earlyAck : DurabilityObservation :=
  { candidateDurable := false, markerDurable := false, acknowledged := true }

def candidateOnlyAck : DurabilityObservation :=
  { candidateDurable := true, markerDurable := false, acknowledged := true }

def reorderedMarkerAck : DurabilityObservation :=
  { candidateDurable := false, markerDurable := true, acknowledged := true }

theorem earlyAck_can_lose_update_witness :
    earlyAck.acknowledged = true ∧
      recoverDurabilityFixture earlyAck = some crashOld := by
  native_decide

theorem candidateOnlyAck_can_lose_update_witness :
    candidateOnlyAck.acknowledged = true ∧
      recoverDurabilityFixture candidateOnlyAck = some crashOld := by
  native_decide

theorem reorderedMarkerAck_can_lose_update_witness :
    reorderedMarkerAck.acknowledged = true ∧
      reorderedMarkerAck.markerDurable = true ∧
      recoverDurabilityFixture reorderedMarkerAck = some crashOld := by
  native_decide

inductive OrderedFlushPhase where
  | initial
  | candidateBuffered
  | candidateFlushed
  | markerBuffered
  | markerFlushed
  | acknowledged
deriving DecidableEq, Repr

def observationAt : OrderedFlushPhase → DurabilityObservation
  | .initial =>
      { candidateDurable := false, markerDurable := false,
        acknowledged := false }
  | .candidateBuffered =>
      { candidateDurable := false, markerDurable := false,
        acknowledged := false }
  | .candidateFlushed =>
      { candidateDurable := true, markerDurable := false,
        acknowledged := false }
  | .markerBuffered =>
      { candidateDurable := true, markerDurable := false,
        acknowledged := false }
  | .markerFlushed =>
      { candidateDurable := true, markerDurable := true,
        acknowledged := false }
  | .acknowledged =>
      { candidateDurable := true, markerDurable := true,
        acknowledged := true }

theorem observationAt_safeAckPolicy
    (phase : OrderedFlushPhase) :
    SafeAckPolicy (observationAt phase) := by
  cases phase <;> simp [SafeAckPolicy, observationAt]

theorem observationAt_acknowledged_iff
    (phase : OrderedFlushPhase) :
    (observationAt phase).acknowledged = true ↔ phase = .acknowledged := by
  cases phase <;> simp [observationAt]

/-- The new entry becomes recoverable exactly at marker flush; acknowledgment
is later and does not move the linearization point. -/
theorem orderedFlush_recovery_new_iff
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (phase : OrderedFlushPhase)
    (valid : snapshot.Valid) :
    recoverDurabilityEntry snapshot counters (observationAt phase) =
        some (nextEntry snapshot counters) ↔
      phase = .markerFlushed ∨ phase = .acknowledged := by
  rw [recoverDurabilityEntry_eq_next_iff snapshot counters
    (observationAt phase) valid]
  cases phase <;> simp [observationAt]

theorem orderedFlush_acknowledged_survives_crash
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (phase : OrderedFlushPhase)
    (valid : snapshot.Valid)
    (acknowledged : (observationAt phase).acknowledged = true) :
    recoverDurabilityEntry snapshot counters (observationAt phase) =
      some (nextEntry snapshot counters) := by
  exact acknowledgedUpdate_survives_crash snapshot counters
    (observationAt phase) valid (observationAt_safeAckPolicy phase) acknowledged

/-- A response can be lost after the durable linearization point. Recovery is
new even though the client has not observed an acknowledgment. -/
theorem markerFlushed_beforeAck_recovers_new
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (valid : snapshot.Valid) :
    (observationAt .markerFlushed).acknowledged = false ∧
      recoverDurabilityEntry snapshot counters (observationAt .markerFlushed) =
        some (nextEntry snapshot counters) := by
  constructor
  · rfl
  · exact (recoverDurabilityEntry_eq_next_iff snapshot counters
      (observationAt .markerFlushed) valid).mpr ⟨rfl, rfl⟩

/-- Retrying from the pre-commit epoch after a lost response cannot blindly
publish again: the recovered epoch is one greater, so the old CAS is stale. -/
theorem retry_after_lostAck_is_stale
    (snapshot : JournalSnapshot)
    (committedCounters retryCandidate : ResourceCounterState) :
    let recovered : VersionedCounterState :=
      { version := (nextEntry snapshot committedCounters).epoch,
        counters := committedCounters }
    casPublish snapshot.current.epoch retryCandidate recovered = .stale recovered := by
  have versionChanged :
      (nextEntry snapshot committedCounters).epoch ≠ snapshot.current.epoch := by
    simp [nextEntry]
  simp [casPublish, versionChanged]

end Sprawlens.FixedPointJournalDurability
