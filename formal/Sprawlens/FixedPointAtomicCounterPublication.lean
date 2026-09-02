import Sprawlens.FixedPointTransactionalResourceCounter

namespace Sprawlens.FixedPointAtomicCounterPublication

open FixedPointTransactionalResourceCounter

/-- Broken persistence model: each field becomes durable independently. -/
def writeWork
    (current candidate : ResourceCounterState) : ResourceCounterState :=
  { current with work := candidate.work }

def writeBytes
    (current candidate : ResourceCounterState) : ResourceCounterState :=
  { current with bytes := candidate.bytes }

def recoverFieldwise (durable : ResourceCounterState) : ResourceCounterState :=
  durable

def crashOld : ResourceCounterState := { work := 7, bytes := 5 }
def crashNew : ResourceCounterState := { work := 8, bytes := 9 }

/-- A crash after the first field write exposes neither the old nor the new
transactional state. -/
theorem fieldwiseCrash_exposes_hybrid_witness :
    let observed := recoverFieldwise (writeWork crashOld crashNew)
    observed = { work := 8, bytes := 5 } ∧
      observed ≠ crashOld ∧ observed ≠ crashNew := by
  native_decide

/-- The three durable points in a candidate-then-marker protocol. The model
assumes each transition below is itself atomic; concrete torn-write handling is
a separate refinement obligation. -/
inductive PublicationPhase where
  | initial
  | candidateDurable
  | markerDurable
deriving DecidableEq, Repr

structure MarkerPublicationStore where
  committed : ResourceCounterState
  candidate : Option ResourceCounterState
  marker : Bool
deriving DecidableEq, Repr

def markerStoreAt
    (old new : ResourceCounterState) :
    PublicationPhase → MarkerPublicationStore
  | .initial =>
      { committed := old, candidate := none, marker := false }
  | .candidateDurable =>
      { committed := old, candidate := some new, marker := false }
  | .markerDurable =>
      { committed := old, candidate := some new, marker := true }

/-- Recovery trusts a candidate only after the marker is durable. A malformed
marked store without a candidate fails closed to the committed state. -/
def recoverMarkerStore
    (store : MarkerPublicationStore) : ResourceCounterState :=
  if store.marker then store.candidate.getD store.committed
  else store.committed

/-- A crash discards volatile execution but does not mutate the durable model. -/
def crashMarkerStore
    (store : MarkerPublicationStore) : MarkerPublicationStore :=
  store

theorem recoverMarkerStore_after_crash
    (store : MarkerPublicationStore) :
    recoverMarkerStore (crashMarkerStore store) = recoverMarkerStore store := by
  rfl

theorem markerStoreAt_initial_recovers_old
    (old new : ResourceCounterState) :
    recoverMarkerStore (markerStoreAt old new .initial) = old := by
  rfl

theorem markerStoreAt_candidateDurable_recovers_old
    (old new : ResourceCounterState) :
    recoverMarkerStore (markerStoreAt old new .candidateDurable) = old := by
  rfl

theorem markerStoreAt_markerDurable_recovers_new
    (old new : ResourceCounterState) :
    recoverMarkerStore (markerStoreAt old new .markerDurable) = new := by
  rfl

/-- Every modeled crash point recovers an all-old or all-new pair, never a
fieldwise hybrid. -/
theorem markerProtocol_recovery_old_or_new
    (old new : ResourceCounterState)
    (phase : PublicationPhase) :
    recoverMarkerStore (crashMarkerStore (markerStoreAt old new phase)) = old ∨
      recoverMarkerStore (crashMarkerStore (markerStoreAt old new phase)) = new := by
  cases phase <;> simp [crashMarkerStore, markerStoreAt, recoverMarkerStore]

theorem markerProtocol_commit_is_linearization_point
    (old new : ResourceCounterState)
    (phase : PublicationPhase)
    (statesDifferent : old ≠ new) :
    phase = .markerDurable ↔
      recoverMarkerStore (markerStoreAt old new phase) = new := by
  cases phase <;> simp [markerStoreAt, recoverMarkerStore, statesDifferent]

/-- A versioned state supplies an abstract compare-and-swap publication point. -/
structure VersionedCounterState where
  version : Nat
  counters : ResourceCounterState
deriving DecidableEq, Repr

inductive CasPublishResult where
  | stale (current : VersionedCounterState)
  | published (next : VersionedCounterState)
deriving DecidableEq, Repr

def casPublish
    (expectedVersion : Nat)
    (candidate : ResourceCounterState)
    (current : VersionedCounterState) : CasPublishResult :=
  if current.version = expectedVersion then
    .published
      { version := current.version + 1,
        counters := candidate }
  else .stale current

theorem casPublish_eq_published_iff
    (expectedVersion : Nat)
    (candidate : ResourceCounterState)
    (current next : VersionedCounterState) :
    casPublish expectedVersion candidate current = .published next ↔
      current.version = expectedVersion ∧
        next =
          { version := current.version + 1,
            counters := candidate } := by
  by_cases versionEq : current.version = expectedVersion
  · simp [casPublish, versionEq, eq_comm]
  · simp [casPublish, versionEq]

theorem casPublish_eq_stale_iff
    (expectedVersion : Nat)
    (candidate : ResourceCounterState)
    (current observed : VersionedCounterState) :
    casPublish expectedVersion candidate current = .stale observed ↔
      current.version ≠ expectedVersion ∧ observed = current := by
  by_cases versionEq : current.version = expectedVersion
  · simp [casPublish, versionEq]
  · simp [casPublish, versionEq, eq_comm]

theorem casPublish_currentVersion_succeeds
    (candidate : ResourceCounterState)
    (current : VersionedCounterState) :
    casPublish current.version candidate current =
      .published
        { version := current.version + 1,
          counters := candidate } := by
  simp [casPublish]

/-- Once one writer publishes at `expectedVersion`, every other candidate
computed for that same version is stale and cannot overwrite it. -/
theorem casPublish_same_expected_stale_after_success
    (expectedVersion : Nat)
    (firstCandidate secondCandidate : ResourceCounterState)
    (current afterFirst : VersionedCounterState)
    (firstPublished :
      casPublish expectedVersion firstCandidate current = .published afterFirst) :
    casPublish expectedVersion secondCandidate afterFirst = .stale afterFirst := by
  obtain ⟨versionEq, rfl⟩ :=
    (casPublish_eq_published_iff expectedVersion firstCandidate current
      afterFirst).mp firstPublished
  have staleVersion : current.version + 1 ≠ expectedVersion := by omega
  simp [casPublish, staleVersion]

/-- A candidate proved safe by `transactionalAdvance` is published unchanged
when the CAS observes the current version. -/
theorem transactionalAccepted_cas_publishes_exact_counters
    (maxWork maxExpandedBytes : Nat)
    (current : VersionedCounterState)
    (chunk : FixedPointStreamingDecompression.DecompressionChunk)
    (candidate : ResourceCounterState)
    (accepted : transactionalAdvance maxWork maxExpandedBytes current.counters
      chunk = .accepted candidate) :
    casPublish current.version candidate current =
      .published
        { version := current.version + 1,
          counters :=
            { work := current.counters.work + chunk.work,
              bytes := current.counters.bytes + chunk.bytes } } := by
  have candidateEq :=
    (transactionalAdvance_eq_accepted_iff maxWork maxExpandedBytes
      current.counters candidate chunk).mp accepted |>.2.2
  subst candidate
  exact casPublish_currentVersion_succeeds _ current

/-- One abstract operation computes against a snapshot and publishes only if
that snapshot's version is still current. -/
inductive AtomicAdvanceResult where
  | resourceRejected
      (reason : TransactionalAdvanceResult)
      (current : VersionedCounterState)
  | stale (current : VersionedCounterState)
  | published (next : VersionedCounterState)
deriving DecidableEq, Repr

def attemptAtomicAdvance
    (maxWork maxExpandedBytes : Nat)
    (snapshot current : VersionedCounterState)
    (chunk : FixedPointStreamingDecompression.DecompressionChunk) :
    AtomicAdvanceResult :=
  match transactionalAdvance maxWork maxExpandedBytes snapshot.counters chunk with
  | .workLimitExceeded unchanged =>
      .resourceRejected (.workLimitExceeded unchanged) current
  | .expandedBudgetExceeded unchanged =>
      .resourceRejected (.expandedBudgetExceeded unchanged) current
  | .accepted candidate =>
      match casPublish snapshot.version candidate current with
      | .stale unchanged => .stale unchanged
      | .published next => .published next

theorem attemptAtomicAdvance_rejection_does_not_publish
    (maxWork maxExpandedBytes : Nat)
    (snapshot current : VersionedCounterState)
    (chunk : FixedPointStreamingDecompression.DecompressionChunk)
    (reason : TransactionalAdvanceResult)
    (advanceEq : transactionalAdvance maxWork maxExpandedBytes snapshot.counters
      chunk = reason)
    (rejected : reason.IsRejected) :
    attemptAtomicAdvance maxWork maxExpandedBytes snapshot current chunk =
      .resourceRejected reason current := by
  cases reason with
  | workLimitExceeded unchanged =>
      simp [attemptAtomicAdvance, advanceEq]
  | expandedBudgetExceeded unchanged =>
      simp [attemptAtomicAdvance, advanceEq]
  | accepted candidate =>
      simp [TransactionalAdvanceResult.IsRejected] at rejected

theorem attemptAtomicAdvance_sameSnapshot_eq_published_iff
    (maxWork maxExpandedBytes : Nat)
    (current next : VersionedCounterState)
    (chunk : FixedPointStreamingDecompression.DecompressionChunk) :
    attemptAtomicAdvance maxWork maxExpandedBytes current current chunk =
        .published next ↔
      ∃ candidate,
        transactionalAdvance maxWork maxExpandedBytes current.counters chunk =
            .accepted candidate ∧
          next =
            { version := current.version + 1,
              counters := candidate } := by
  cases advanceEq : transactionalAdvance maxWork maxExpandedBytes current.counters
    chunk with
  | workLimitExceeded unchanged =>
      simp [attemptAtomicAdvance, advanceEq]
  | expandedBudgetExceeded unchanged =>
      simp [attemptAtomicAdvance, advanceEq]
  | accepted candidate =>
      simp [attemptAtomicAdvance, advanceEq, casPublish, eq_comm]

theorem attemptAtomicAdvance_stale_snapshot_does_not_publish
    (maxWork maxExpandedBytes : Nat)
    (snapshot current : VersionedCounterState)
    (chunk : FixedPointStreamingDecompression.DecompressionChunk)
    (candidate : ResourceCounterState)
    (accepted : transactionalAdvance maxWork maxExpandedBytes snapshot.counters
      chunk = .accepted candidate)
    (versionChanged : snapshot.version ≠ current.version) :
    attemptAtomicAdvance maxWork maxExpandedBytes snapshot current chunk =
      .stale current := by
  have currentNotExpected : current.version ≠ snapshot.version := by
    exact fun reversed => versionChanged reversed.symm
  simp [attemptAtomicAdvance, accepted, casPublish, currentNotExpected]

/-- Every successful operation linearizes one version step and publishes the
exact simultaneous counter sums computed from its snapshot. -/
theorem attemptAtomicAdvance_published_exact
    (maxWork maxExpandedBytes : Nat)
    (snapshot current next : VersionedCounterState)
    (chunk : FixedPointStreamingDecompression.DecompressionChunk)
    (published : attemptAtomicAdvance maxWork maxExpandedBytes snapshot current
      chunk = .published next) :
    snapshot.version = current.version ∧
      next.version = current.version + 1 ∧
      next.counters =
        { work := snapshot.counters.work + chunk.work,
          bytes := snapshot.counters.bytes + chunk.bytes } ∧
      snapshot.counters.work + chunk.work ≤ maxWork ∧
      snapshot.counters.bytes + chunk.bytes ≤ maxExpandedBytes := by
  cases advanceEq : transactionalAdvance maxWork maxExpandedBytes
    snapshot.counters chunk with
  | workLimitExceeded unchanged =>
      simp [attemptAtomicAdvance, advanceEq] at published
  | expandedBudgetExceeded unchanged =>
      simp [attemptAtomicAdvance, advanceEq] at published
  | accepted candidate =>
      have candidateInfo :=
        (transactionalAdvance_eq_accepted_iff maxWork maxExpandedBytes
          snapshot.counters candidate chunk).mp advanceEq
      cases casEq : casPublish snapshot.version candidate current with
      | stale unchanged =>
          simp [attemptAtomicAdvance, advanceEq, casEq] at published
      | published nextState =>
          have casInfo :=
            (casPublish_eq_published_iff snapshot.version candidate current
              nextState).mp casEq
          simp [attemptAtomicAdvance, advanceEq, casEq] at published
          subst next
          rcases casInfo with ⟨versionEq, rfl⟩
          rcases candidateInfo with ⟨workWithin, bytesWithin, rfl⟩
          simp [versionEq, workWithin, bytesWithin]

/-- Broken concurrency comparison: a blind writer has no version precondition
and can replace a previously published independent candidate. -/
def blindPublish
    (candidate : ResourceCounterState)
    (current : VersionedCounterState) : VersionedCounterState :=
  { version := current.version + 1,
    counters := candidate }

def concurrentBase : VersionedCounterState :=
  { version := 0, counters := { work := 0, bytes := 0 } }

def concurrentWorkCandidate : ResourceCounterState :=
  { work := 1, bytes := 0 }

def concurrentByteCandidate : ResourceCounterState :=
  { work := 0, bytes := 1 }

theorem blindPublish_last_writer_loses_first_witness :
    let afterWork := blindPublish concurrentWorkCandidate concurrentBase
    let afterByte := blindPublish concurrentByteCandidate afterWork
    afterByte.counters = concurrentByteCandidate ∧
      afterByte.counters ≠ concurrentWorkCandidate ∧
      afterByte.counters ≠ { work := 1, bytes := 1 } := by
  native_decide

theorem casPublish_second_same_snapshot_is_stale_witness :
    let afterWork : VersionedCounterState :=
      { version := 1, counters := concurrentWorkCandidate }
    casPublish 0 concurrentWorkCandidate concurrentBase = .published afterWork ∧
      casPublish 0 concurrentByteCandidate afterWork = .stale afterWork := by
  native_decide

end Sprawlens.FixedPointAtomicCounterPublication
