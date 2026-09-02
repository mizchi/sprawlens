import Sprawlens.FixedPointAtomicCounterPublication

namespace Sprawlens.FixedPointRepeatedCounterPublication

open FixedPointAtomicCounterPublication
open FixedPointTransactionalResourceCounter

inductive SlotIndex where
  | left
  | right
deriving DecidableEq, Repr

def SlotIndex.other : SlotIndex → SlotIndex
  | .left => .right
  | .right => .left

@[simp] theorem SlotIndex.other_other (slot : SlotIndex) :
    slot.other.other = slot := by
  cases slot <;> rfl

structure JournalEntry where
  epoch : Nat
  counters : ResourceCounterState
deriving DecidableEq, Repr

inductive SlotRecord where
  | empty
  | pending (entry : JournalEntry)
  | committed (entry : JournalEntry)
deriving DecidableEq, Repr

def SlotRecord.committedEntry? : SlotRecord → Option JournalEntry
  | .committed entry => some entry
  | .empty => none
  | .pending _ => none

structure TwoSlotStore where
  left : SlotRecord
  right : SlotRecord
deriving DecidableEq, Repr

/-- Choose the committed entry with the greatest unbounded epoch. Equal epochs
are resolved to the left entry, but valid snapshots below never rely on ties. -/
def chooseNewest
    (left right : Option JournalEntry) : Option JournalEntry :=
  match left, right with
  | none, none => none
  | some entry, none => some entry
  | none, some entry => some entry
  | some leftEntry, some rightEntry =>
      if leftEntry.epoch < rightEntry.epoch then some rightEntry
      else some leftEntry

def recoverEntry (store : TwoSlotStore) : Option JournalEntry :=
  chooseNewest store.left.committedEntry? store.right.committedEntry?

def recoverTwoSlot (store : TwoSlotStore) : Option ResourceCounterState :=
  (recoverEntry store).map JournalEntry.counters

/-- `current` is the newest committed record. `previous`, when present, is its
immediate or older fallback. -/
structure JournalSnapshot where
  currentSlot : SlotIndex
  current : JournalEntry
  previous : Option JournalEntry
deriving DecidableEq, Repr

def JournalSnapshot.Valid (snapshot : JournalSnapshot) : Prop :=
  match snapshot.previous with
  | none => True
  | some previous => previous.epoch < snapshot.current.epoch

def previousRecord : Option JournalEntry → SlotRecord
  | none => .empty
  | some previous => .committed previous

def materializeSnapshot (snapshot : JournalSnapshot) : TwoSlotStore :=
  match snapshot.currentSlot with
  | .left =>
      { left := .committed snapshot.current,
        right := previousRecord snapshot.previous }
  | .right =>
      { left := previousRecord snapshot.previous,
        right := .committed snapshot.current }

def nextEntry
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : JournalEntry :=
  { epoch := snapshot.current.epoch + 1, counters }

/-- The inactive slot has been overwritten with an uncommitted candidate. -/
def pendingUpdateStore
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : TwoSlotStore :=
  match snapshot.currentSlot with
  | .left =>
      { left := .committed snapshot.current,
        right := .pending (nextEntry snapshot counters) }
  | .right =>
      { left := .pending (nextEntry snapshot counters),
        right := .committed snapshot.current }

/-- The marker turns the complete inactive-slot candidate into the next
committed generation. -/
def committedUpdateStore
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : TwoSlotStore :=
  match snapshot.currentSlot with
  | .left =>
      { left := .committed snapshot.current,
        right := .committed (nextEntry snapshot counters) }
  | .right =>
      { left := .committed (nextEntry snapshot counters),
        right := .committed snapshot.current }

def nextSnapshot
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : JournalSnapshot :=
  { currentSlot := snapshot.currentSlot.other,
    current := nextEntry snapshot counters,
    previous := some snapshot.current }

theorem nextSnapshot_valid
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) :
    (nextSnapshot snapshot counters).Valid := by
  simp [JournalSnapshot.Valid, nextSnapshot, nextEntry]

theorem materialize_nextSnapshot_eq_committedUpdateStore
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) :
    materializeSnapshot (nextSnapshot snapshot counters) =
      committedUpdateStore snapshot counters := by
  cases slotEq : snapshot.currentSlot <;>
    simp [materializeSnapshot, nextSnapshot, committedUpdateStore, slotEq,
      SlotIndex.other, previousRecord, nextEntry]

theorem recover_materializedSnapshot_eq_current
    (snapshot : JournalSnapshot)
    (valid : snapshot.Valid) :
    recoverEntry (materializeSnapshot snapshot) = some snapshot.current := by
  cases slotEq : snapshot.currentSlot <;>
    cases previousEq : snapshot.previous with
    | none =>
        simp [materializeSnapshot, slotEq, previousEq, previousRecord, recoverEntry,
          chooseNewest, SlotRecord.committedEntry?]
    | some previous =>
        have previousOlder : previous.epoch < snapshot.current.epoch := by
          simpa [JournalSnapshot.Valid, previousEq] using valid
        have currentNotOlder : ¬snapshot.current.epoch < previous.epoch := by
          omega
        simp [materializeSnapshot, slotEq, previousEq, previousRecord,
          recoverEntry, chooseNewest, SlotRecord.committedEntry?, previousOlder,
          currentNotOlder]

theorem recover_pendingUpdateStore_eq_current
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) :
    recoverEntry (pendingUpdateStore snapshot counters) = some snapshot.current := by
  cases slotEq : snapshot.currentSlot <;>
    simp [pendingUpdateStore, slotEq, recoverEntry, chooseNewest,
      SlotRecord.committedEntry?]

theorem recover_committedUpdateStore_eq_next
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) :
    recoverEntry (committedUpdateStore snapshot counters) =
      some (nextEntry snapshot counters) := by
  cases slotEq : snapshot.currentSlot <;>
    simp [committedUpdateStore, slotEq, recoverEntry, chooseNewest,
      SlotRecord.committedEntry?, nextEntry]

def crashTwoSlot (store : TwoSlotStore) : TwoSlotStore := store

inductive UpdatePhase where
  | beforeCandidate
  | candidateDurable
  | markerDurable
deriving DecidableEq, Repr

def storeAtUpdatePhase
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : UpdatePhase → TwoSlotStore
  | .beforeCandidate => materializeSnapshot snapshot
  | .candidateDurable => pendingUpdateStore snapshot counters
  | .markerDurable => committedUpdateStore snapshot counters

/-- In every crash phase, recovery is exactly the previously committed entry
or the complete next entry. -/
theorem repeatedProtocol_crash_recovers_old_or_new
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (phase : UpdatePhase)
    (valid : snapshot.Valid) :
    recoverEntry (crashTwoSlot (storeAtUpdatePhase snapshot counters phase)) =
        some snapshot.current ∨
      recoverEntry (crashTwoSlot (storeAtUpdatePhase snapshot counters phase)) =
        some (nextEntry snapshot counters) := by
  cases phase with
  | beforeCandidate =>
      left
      exact recover_materializedSnapshot_eq_current snapshot valid
  | candidateDurable =>
      left
      exact recover_pendingUpdateStore_eq_current snapshot counters
  | markerDurable =>
      right
      exact recover_committedUpdateStore_eq_next snapshot counters

theorem repeatedProtocol_marker_is_linearization_point
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (phase : UpdatePhase)
    (valid : snapshot.Valid) :
    phase = .markerDurable ↔
      recoverEntry (storeAtUpdatePhase snapshot counters phase) =
        some (nextEntry snapshot counters) := by
  have entriesDifferent : snapshot.current ≠ nextEntry snapshot counters := by
    intro entriesEqual
    have epochEqual := congrArg JournalEntry.epoch entriesEqual
    simp [nextEntry] at epochEqual
  cases phase with
  | beforeCandidate =>
      rw [show recoverEntry
          (storeAtUpdatePhase snapshot counters .beforeCandidate) =
            some snapshot.current by
        exact recover_materializedSnapshot_eq_current snapshot valid]
      simp [entriesDifferent]
  | candidateDurable =>
      rw [show recoverEntry
          (storeAtUpdatePhase snapshot counters .candidateDurable) =
            some snapshot.current by
        exact recover_pendingUpdateStore_eq_current snapshot counters]
      simp [entriesDifferent]
  | markerDurable =>
      rw [show recoverEntry
          (storeAtUpdatePhase snapshot counters .markerDurable) =
            some (nextEntry snapshot counters) by
        exact recover_committedUpdateStore_eq_next snapshot counters]
      simp

def applyCommittedUpdates :
    JournalSnapshot → List ResourceCounterState → JournalSnapshot
  | snapshot, [] => snapshot
  | snapshot, counters :: remaining =>
      applyCommittedUpdates (nextSnapshot snapshot counters) remaining

def latestCounters :
    ResourceCounterState → List ResourceCounterState → ResourceCounterState
  | initial, [] => initial
  | _, counters :: remaining => latestCounters counters remaining

theorem applyCommittedUpdates_valid
    (snapshot : JournalSnapshot)
    (updates : List ResourceCounterState)
    (valid : snapshot.Valid) :
    (applyCommittedUpdates snapshot updates).Valid := by
  induction updates generalizing snapshot with
  | nil => exact valid
  | cons counters remaining inductionHypothesis =>
      exact inductionHypothesis (nextSnapshot snapshot counters)
        (nextSnapshot_valid snapshot counters)

theorem applyCommittedUpdates_epoch_exact
    (snapshot : JournalSnapshot)
    (updates : List ResourceCounterState) :
    (applyCommittedUpdates snapshot updates).current.epoch =
      snapshot.current.epoch + updates.length := by
  induction updates generalizing snapshot with
  | nil => simp [applyCommittedUpdates]
  | cons counters remaining inductionHypothesis =>
      rw [applyCommittedUpdates, inductionHypothesis]
      simp [nextSnapshot, nextEntry]
      omega

theorem applyCommittedUpdates_counters_exact
    (snapshot : JournalSnapshot)
    (updates : List ResourceCounterState) :
    (applyCommittedUpdates snapshot updates).current.counters =
      latestCounters snapshot.current.counters updates := by
  induction updates generalizing snapshot with
  | nil => rfl
  | cons counters remaining inductionHypothesis =>
      simpa [applyCommittedUpdates, latestCounters, nextSnapshot, nextEntry] using
        inductionHypothesis (nextSnapshot snapshot counters)

theorem recover_after_arbitrary_committed_updates
    (snapshot : JournalSnapshot)
    (updates : List ResourceCounterState)
    (valid : snapshot.Valid) :
    recoverTwoSlot (materializeSnapshot (applyCommittedUpdates snapshot updates)) =
      some (latestCounters snapshot.current.counters updates) := by
  have finalValid := applyCommittedUpdates_valid snapshot updates valid
  have recovered := recover_materializedSnapshot_eq_current
    (applyCommittedUpdates snapshot updates) finalValid
  simp [recoverTwoSlot, recovered, applyCommittedUpdates_counters_exact]

theorem crash_during_next_update_after_arbitrary_history
    (snapshot : JournalSnapshot)
    (updates : List ResourceCounterState)
    (nextCounters : ResourceCounterState)
    (phase : UpdatePhase)
    (valid : snapshot.Valid) :
    let finalSnapshot := applyCommittedUpdates snapshot updates
    recoverEntry
          (crashTwoSlot
            (storeAtUpdatePhase finalSnapshot nextCounters phase)) =
        some finalSnapshot.current ∨
      recoverEntry
          (crashTwoSlot
            (storeAtUpdatePhase finalSnapshot nextCounters phase)) =
        some (nextEntry finalSnapshot nextCounters) := by
  exact repeatedProtocol_crash_recovers_old_or_new
    (applyCommittedUpdates snapshot updates) nextCounters phase
    (applyCommittedUpdates_valid snapshot updates valid)

theorem applyCommittedUpdates_epoch_strict_of_nonempty
    (snapshot : JournalSnapshot)
    (updates : List ResourceCounterState)
    (nonempty : updates ≠ []) :
    snapshot.current.epoch <
      (applyCommittedUpdates snapshot updates).current.epoch := by
  rw [applyCommittedUpdates_epoch_exact]
  have positiveLength : 0 < updates.length := by
    cases updates with
    | nil => exact False.elim (nonempty rfl)
    | cons _ _ => simp
  omega

/-- A finite epoch implementation that compares ordinary numeric epochs can
select the old slot after wraparound. -/
def wrappedNextEntry
    (modulus : Nat)
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : JournalEntry :=
  { epoch := (snapshot.current.epoch + 1) % modulus, counters }

def wrappedCommittedUpdateStore
    (modulus : Nat)
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState) : TwoSlotStore :=
  match snapshot.currentSlot with
  | .left =>
      { left := .committed snapshot.current,
        right := .committed (wrappedNextEntry modulus snapshot counters) }
  | .right =>
      { left := .committed (wrappedNextEntry modulus snapshot counters),
        right := .committed snapshot.current }

theorem wrappedNextEntry_eq_nextEntry_of_noWrap
    (modulus : Nat)
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (noWrap : snapshot.current.epoch + 1 < modulus) :
    wrappedNextEntry modulus snapshot counters = nextEntry snapshot counters := by
  simp [wrappedNextEntry, nextEntry, Nat.mod_eq_of_lt noWrap]

theorem wrappedCommittedUpdateStore_eq_of_noWrap
    (modulus : Nat)
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (noWrap : snapshot.current.epoch + 1 < modulus) :
    wrappedCommittedUpdateStore modulus snapshot counters =
      committedUpdateStore snapshot counters := by
  cases slotEq : snapshot.currentSlot <;>
    simp [wrappedCommittedUpdateStore, committedUpdateStore, slotEq,
      wrappedNextEntry_eq_nextEntry_of_noWrap modulus snapshot counters noWrap]

theorem recover_wrappedCommittedUpdateStore_of_noWrap
    (modulus : Nat)
    (snapshot : JournalSnapshot)
    (counters : ResourceCounterState)
    (noWrap : snapshot.current.epoch + 1 < modulus) :
    recoverEntry (wrappedCommittedUpdateStore modulus snapshot counters) =
      some (nextEntry snapshot counters) := by
  rw [wrappedCommittedUpdateStore_eq_of_noWrap modulus snapshot counters noWrap]
  exact recover_committedUpdateStore_eq_next snapshot counters

def wrappedEpochSnapshot : JournalSnapshot :=
  { currentSlot := .left,
    current := { epoch := 255, counters := crashOld },
    previous := none }

def wrappedCommittedFixture : TwoSlotStore :=
  wrappedCommittedUpdateStore 256 wrappedEpochSnapshot crashNew

theorem wrappedEpoch_can_hide_committed_update_witness :
    recoverTwoSlot wrappedCommittedFixture = some crashOld := by
  native_decide

theorem wrappedEpoch_new_entry_is_zero_witness :
    (wrappedNextEntry 256 wrappedEpochSnapshot crashNew).epoch = 0 ∧
      (wrappedNextEntry 256 wrappedEpochSnapshot crashNew).counters = crashNew := by
  native_decide

def casPublishWrapped
    (modulus expectedVersion : Nat)
    (candidate : ResourceCounterState)
    (current : VersionedCounterState) : CasPublishResult :=
  if current.version = expectedVersion then
    .published
      { version := (current.version + 1) % modulus,
        counters := candidate }
  else .stale current

theorem casPublishWrapped_eq_casPublish_of_noWrap
    (modulus expectedVersion : Nat)
    (candidate : ResourceCounterState)
    (current : VersionedCounterState)
    (noWrap : current.version + 1 < modulus) :
    casPublishWrapped modulus expectedVersion candidate current =
      casPublish expectedVersion candidate current := by
  by_cases versionEq : current.version = expectedVersion
  · have expectedNoWrap : expectedVersion + 1 < modulus := by
      simpa [versionEq] using noWrap
    simp [casPublishWrapped, casPublish, versionEq,
      Nat.mod_eq_of_lt expectedNoWrap]
  · simp [casPublishWrapped, casPublish, versionEq]

def abaBase : VersionedCounterState :=
  { version := 0, counters := { work := 0, bytes := 0 } }

def abaAfterFirst : VersionedCounterState :=
  { version := 1, counters := concurrentWorkCandidate }

def abaAfterSecond : VersionedCounterState :=
  { version := 0, counters := concurrentByteCandidate }

def abaAfterStalePublish : VersionedCounterState :=
  { version := 1, counters := crashNew }

/-- Modulus two returns to version zero after two intervening commits, so a
candidate computed from the original version-zero snapshot is accepted again. -/
theorem wrappedCas_aba_reaccepts_stale_snapshot_witness :
    casPublishWrapped 2 0 concurrentWorkCandidate abaBase =
        .published abaAfterFirst ∧
      casPublishWrapped 2 1 concurrentByteCandidate abaAfterFirst =
        .published abaAfterSecond ∧
      casPublishWrapped 2 0 crashNew abaAfterSecond =
        .published abaAfterStalePublish := by
  native_decide

theorem casPublishWrapped_rejects_distinct_version
    (modulus expectedVersion : Nat)
    (candidate : ResourceCounterState)
    (current : VersionedCounterState)
    (versionDifferent : current.version ≠ expectedVersion) :
    casPublishWrapped modulus expectedVersion candidate current = .stale current := by
  simp [casPublishWrapped, versionDifferent]

end Sprawlens.FixedPointRepeatedCounterPublication
