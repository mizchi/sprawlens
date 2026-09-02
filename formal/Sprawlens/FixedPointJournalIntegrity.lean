import Sprawlens.FixedPointRepeatedCounterPublication

namespace Sprawlens.FixedPointJournalIntegrity

open FixedPointAtomicCounterPublication
open FixedPointRepeatedCounterPublication
open FixedPointTransactionalResourceCounter

abbrev EntryChecksum := JournalEntry → Nat

structure TaggedEntry where
  entry : JournalEntry
  tag : Nat
deriving DecidableEq, Repr

def protectEntry
    (checksum : EntryChecksum)
    (entry : JournalEntry) : TaggedEntry :=
  { entry, tag := checksum entry }

def verifyEntry
    (checksum : EntryChecksum)
    (tagged : TaggedEntry) : Option JournalEntry :=
  if tagged.tag = checksum tagged.entry then some tagged.entry else none

theorem verifyEntry_eq_some_iff
    (checksum : EntryChecksum)
    (tagged : TaggedEntry)
    (entry : JournalEntry) :
    verifyEntry checksum tagged = some entry ↔
      tagged.tag = checksum tagged.entry ∧ entry = tagged.entry := by
  by_cases valid : tagged.tag = checksum tagged.entry
  · simp [verifyEntry, valid, eq_comm]
  · simp [verifyEntry, valid]

theorem verify_protectEntry
    (checksum : EntryChecksum)
    (entry : JournalEntry) :
    verifyEntry checksum (protectEntry checksum entry) = some entry := by
  simp [verifyEntry, protectEntry]

def constantChecksum : EntryChecksum := fun _ => 0

def integrityOld : JournalEntry :=
  { epoch := 7, counters := crashOld }

def integrityNew : JournalEntry :=
  { epoch := 8, counters := crashNew }

/-- A checksum contract without a collision/detection premise proves nothing:
the old tag can validate a different payload. -/
theorem constantChecksum_collision_accepts_changed_entry :
    integrityOld ≠ integrityNew ∧
      verifyEntry constantChecksum
        { entry := integrityNew, tag := constantChecksum integrityOld } =
          some integrityNew := by
  native_decide

/-- Recomputing a valid tag for arbitrary changed data always passes this
integrity check. It is not an authentication theorem. -/
theorem recomputedTag_accepts_arbitrary_entry
    (checksum : EntryChecksum)
    (changed : JournalEntry) :
    verifyEntry checksum (protectEntry checksum changed) = some changed := by
  exact verify_protectEntry checksum changed

inductive UnboundSlotRecord where
  | empty
  | pending (tagged : TaggedEntry)
  | committed (tagged : TaggedEntry)
deriving DecidableEq, Repr

def UnboundSlotRecord.verifiedCommitted?
    (checksum : EntryChecksum) : UnboundSlotRecord → Option JournalEntry
  | .empty => none
  | .pending _ => none
  | .committed tagged => verifyEntry checksum tagged

structure UnboundTwoSlotStore where
  left : UnboundSlotRecord
  right : UnboundSlotRecord
deriving DecidableEq, Repr

def recoverUnboundEntry
    (checksum : EntryChecksum)
    (store : UnboundTwoSlotStore) : Option JournalEntry :=
  chooseNewest (store.left.verifiedCommitted? checksum)
    (store.right.verifiedCommitted? checksum)

def protectUnboundSlot
    (checksum : EntryChecksum) : SlotRecord → UnboundSlotRecord
  | .empty => .empty
  | .pending entry => .pending (protectEntry checksum entry)
  | .committed entry => .committed (protectEntry checksum entry)

def protectUnboundStore
    (checksum : EntryChecksum)
    (store : TwoSlotStore) : UnboundTwoSlotStore :=
  { left := protectUnboundSlot checksum store.left,
    right := protectUnboundSlot checksum store.right }

theorem recover_protectedUnboundStore_eq
    (checksum : EntryChecksum)
    (store : TwoSlotStore) :
    recoverUnboundEntry checksum (protectUnboundStore checksum store) =
      recoverEntry store := by
  cases store with
  | mk left right =>
      cases left <;> cases right <;>
        simp [recoverUnboundEntry, protectUnboundStore, protectUnboundSlot,
          UnboundSlotRecord.verifiedCommitted?, verifyEntry, protectEntry,
          recoverEntry, SlotRecord.committedEntry?]

def payloadChangedKeepingTag
    (checksum : EntryChecksum)
    (original changed : JournalEntry) : TaggedEntry :=
  { entry := changed, tag := checksum original }

/-- If the latest payload changes while its old tag remains and the checksum
distinguishes those two entries, recovery rejects it and falls back to the
previous valid committed slot. -/
theorem latestPayloadCorruption_fallsBack
    (checksum : EntryChecksum)
    (previous latest changed : JournalEntry)
    (detected : checksum latest ≠ checksum changed) :
    recoverUnboundEntry checksum
        { left := .committed (protectEntry checksum previous),
          right := .committed
            (payloadChangedKeepingTag checksum latest changed) } =
      some previous := by
  simp [recoverUnboundEntry, UnboundSlotRecord.verifiedCommitted?,
    protectEntry, payloadChangedKeepingTag, verifyEntry, detected, chooseNewest]

theorem bothInvalidSlots_recover_none
    (checksum : EntryChecksum)
    (left right : TaggedEntry)
    (leftInvalid : left.tag ≠ checksum left.entry)
    (rightInvalid : right.tag ≠ checksum right.entry) :
    recoverUnboundEntry checksum
        { left := .committed left, right := .committed right } = none := by
  simp [recoverUnboundEntry, UnboundSlotRecord.verifiedCommitted?, verifyEntry,
    leftInvalid, rightInvalid, chooseNewest]

/-- Broken design: the pending/committed marker is outside the checksum. -/
def flipPendingToCommitted : UnboundSlotRecord → UnboundSlotRecord
  | .pending tagged => .committed tagged
  | record => record

def markerFlippedFixture : UnboundTwoSlotStore :=
  { left := .committed (protectEntry constantChecksum integrityOld),
    right := flipPendingToCommitted
      (.pending (protectEntry constantChecksum integrityNew)) }

theorem markerOutsideChecksum_exposes_pending_witness :
    recoverUnboundEntry constantChecksum markerFlippedFixture =
      some integrityNew := by
  native_decide

theorem markerOutsideChecksum_exposes_pending
    (checksum : EntryChecksum)
    (old candidate : JournalEntry)
    (newer : old.epoch < candidate.epoch) :
    recoverUnboundEntry checksum
        { left := .committed (protectEntry checksum old),
          right := flipPendingToCommitted
            (.pending (protectEntry checksum candidate)) } =
      some candidate := by
  simp [recoverUnboundEntry, UnboundSlotRecord.verifiedCommitted?,
    flipPendingToCommitted, protectEntry, verifyEntry, chooseNewest, newer]

inductive IntegrityPhase where
  | pending
  | committed
deriving DecidableEq, Repr

abbrev PhaseChecksum := IntegrityPhase → JournalEntry → Nat

structure PhaseTaggedEntry where
  phase : IntegrityPhase
  entry : JournalEntry
  tag : Nat
deriving DecidableEq, Repr

def protectPhaseEntry
    (checksum : PhaseChecksum)
    (phase : IntegrityPhase)
    (entry : JournalEntry) : PhaseTaggedEntry :=
  { phase, entry, tag := checksum phase entry }

def verifyCommittedPhaseEntry
    (checksum : PhaseChecksum)
    (record : PhaseTaggedEntry) : Option JournalEntry :=
  match record.phase with
  | .pending => none
  | .committed =>
      if record.tag = checksum .committed record.entry then some record.entry
      else none

theorem verifyCommittedPhaseEntry_pending_none
    (checksum : PhaseChecksum)
    (entry : JournalEntry) :
    verifyCommittedPhaseEntry checksum
      (protectPhaseEntry checksum .pending entry) = none := by
  rfl

theorem verifyCommittedPhaseEntry_committed_some
    (checksum : PhaseChecksum)
    (entry : JournalEntry) :
    verifyCommittedPhaseEntry checksum
      (protectPhaseEntry checksum .committed entry) = some entry := by
  simp [verifyCommittedPhaseEntry, protectPhaseEntry]

def flipPhaseToCommitted (record : PhaseTaggedEntry) : PhaseTaggedEntry :=
  { record with phase := .committed }

/-- Binding phase into the integrity domain rejects a marker-only flip exactly
when pending and committed tags differ for that entry. -/
theorem phaseFlip_rejected_of_domainSeparated
    (checksum : PhaseChecksum)
    (entry : JournalEntry)
    (phaseSeparated : checksum .pending entry ≠ checksum .committed entry) :
    verifyCommittedPhaseEntry checksum
      (flipPhaseToCommitted (protectPhaseEntry checksum .pending entry)) = none := by
  simp [verifyCommittedPhaseEntry, flipPhaseToCommitted, protectPhaseEntry,
    phaseSeparated]

def phaseInsensitiveChecksum
    (checksum : EntryChecksum) : PhaseChecksum :=
  fun _ entry => checksum entry

/-- If phase is omitted from the integrity domain, changing only the marker is
accepted even with an otherwise perfect entry checksum. -/
theorem phaseInsensitiveChecksum_accepts_markerFlip
    (checksum : EntryChecksum)
    (entry : JournalEntry) :
    verifyCommittedPhaseEntry (phaseInsensitiveChecksum checksum)
      (flipPhaseToCommitted
        (protectPhaseEntry (phaseInsensitiveChecksum checksum) .pending entry)) =
      some entry := by
  simp [verifyCommittedPhaseEntry, phaseInsensitiveChecksum,
    flipPhaseToCommitted, protectPhaseEntry]

/-- A torn candidate may alter both phase and payload while retaining the tag
written for the original pending entry. -/
def tornPendingToCommitted
    (checksum : PhaseChecksum)
    (original changed : JournalEntry) : PhaseTaggedEntry :=
  { phase := .committed,
    entry := changed,
    tag := checksum .pending original }

theorem tornPendingToCommitted_rejected_of_tagMismatch
    (checksum : PhaseChecksum)
    (original changed : JournalEntry)
    (detected : checksum .pending original ≠ checksum .committed changed) :
    verifyCommittedPhaseEntry checksum
      (tornPendingToCommitted checksum original changed) = none := by
  simp [verifyCommittedPhaseEntry, tornPendingToCommitted, detected]

inductive BoundSlotRecord where
  | empty
  | record (tagged : PhaseTaggedEntry)
deriving DecidableEq, Repr

def BoundSlotRecord.verifiedCommitted?
    (checksum : PhaseChecksum) : BoundSlotRecord → Option JournalEntry
  | .empty => none
  | .record tagged => verifyCommittedPhaseEntry checksum tagged

structure BoundTwoSlotStore where
  left : BoundSlotRecord
  right : BoundSlotRecord
deriving DecidableEq, Repr

def recoverBoundEntry
    (checksum : PhaseChecksum)
    (store : BoundTwoSlotStore) : Option JournalEntry :=
  chooseNewest (store.left.verifiedCommitted? checksum)
    (store.right.verifiedCommitted? checksum)

def boundPendingStore
    (checksum : PhaseChecksum)
    (old candidate : JournalEntry) : BoundTwoSlotStore :=
  { left := .record (protectPhaseEntry checksum .committed old),
    right := .record (protectPhaseEntry checksum .pending candidate) }

def boundMarkerFlippedStore
    (checksum : PhaseChecksum)
    (old candidate : JournalEntry) : BoundTwoSlotStore :=
  { left := .record (protectPhaseEntry checksum .committed old),
    right := .record
      (flipPhaseToCommitted (protectPhaseEntry checksum .pending candidate)) }

def boundCommittedStore
    (checksum : PhaseChecksum)
    (old candidate : JournalEntry) : BoundTwoSlotStore :=
  { left := .record (protectPhaseEntry checksum .committed old),
    right := .record (protectPhaseEntry checksum .committed candidate) }

def boundTornCandidateStore
    (checksum : PhaseChecksum)
    (old original changed : JournalEntry) : BoundTwoSlotStore :=
  { left := .record (protectPhaseEntry checksum .committed old),
    right := .record (tornPendingToCommitted checksum original changed) }

def changedCommittedPayloadKeepingTag
    (checksum : PhaseChecksum)
    (original changed : JournalEntry) : PhaseTaggedEntry :=
  { phase := .committed,
    entry := changed,
    tag := checksum .committed original }

theorem boundPendingStore_recovers_old
    (checksum : PhaseChecksum)
    (old candidate : JournalEntry) :
    recoverBoundEntry checksum (boundPendingStore checksum old candidate) =
      some old := by
  simp [recoverBoundEntry, boundPendingStore,
    BoundSlotRecord.verifiedCommitted?, verifyCommittedPhaseEntry,
    protectPhaseEntry, chooseNewest]

theorem boundMarkerFlip_recovers_old_of_domainSeparated
    (checksum : PhaseChecksum)
    (old candidate : JournalEntry)
    (phaseSeparated :
      checksum .pending candidate ≠ checksum .committed candidate) :
    recoverBoundEntry checksum
        (boundMarkerFlippedStore checksum old candidate) = some old := by
  simp [recoverBoundEntry, boundMarkerFlippedStore,
    BoundSlotRecord.verifiedCommitted?, verifyCommittedPhaseEntry,
    flipPhaseToCommitted, protectPhaseEntry, phaseSeparated, chooseNewest]

theorem boundTornCandidate_recovers_old_of_tagMismatch
    (checksum : PhaseChecksum)
    (old original changed : JournalEntry)
    (detected : checksum .pending original ≠ checksum .committed changed) :
    recoverBoundEntry checksum
        (boundTornCandidateStore checksum old original changed) = some old := by
  simp [recoverBoundEntry, boundTornCandidateStore,
    BoundSlotRecord.verifiedCommitted?, verifyCommittedPhaseEntry,
    tornPendingToCommitted, protectPhaseEntry, detected, chooseNewest]

theorem boundLatestPayloadCorruption_recovers_old
    (checksum : PhaseChecksum)
    (old latest changed : JournalEntry)
    (detected : checksum .committed latest ≠ checksum .committed changed) :
    recoverBoundEntry checksum
        { left := .record (protectPhaseEntry checksum .committed old),
          right := .record
            (changedCommittedPayloadKeepingTag checksum latest changed) } =
      some old := by
  simp [recoverBoundEntry, BoundSlotRecord.verifiedCommitted?,
    verifyCommittedPhaseEntry, protectPhaseEntry,
    changedCommittedPayloadKeepingTag, detected, chooseNewest]

theorem boundCommittedStore_recovers_new
    (checksum : PhaseChecksum)
    (old candidate : JournalEntry)
    (newer : old.epoch < candidate.epoch) :
    recoverBoundEntry checksum (boundCommittedStore checksum old candidate) =
      some candidate := by
  simp [recoverBoundEntry, boundCommittedStore,
    BoundSlotRecord.verifiedCommitted?, verifyCommittedPhaseEntry,
    protectPhaseEntry, chooseNewest, newer]

end Sprawlens.FixedPointJournalIntegrity
