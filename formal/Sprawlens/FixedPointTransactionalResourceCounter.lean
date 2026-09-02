import Sprawlens.FixedPointResourceCounterSafety

namespace Sprawlens.FixedPointTransactionalResourceCounter

open FixedPointResourceCounterSafety
open FixedPointStreamingDecompression

/-- The two counters that must describe one accepted chunk prefix. -/
structure ResourceCounterState where
  work : Nat
  bytes : Nat
deriving DecidableEq, Repr

/-- A rejected transition carries the state that remains observable after the
attempt. The safe transition below always puts the original state there. -/
inductive TransactionalAdvanceResult where
  | workLimitExceeded (state : ResourceCounterState)
  | expandedBudgetExceeded (state : ResourceCounterState)
  | accepted (state : ResourceCounterState)
deriving DecidableEq, Repr

def TransactionalAdvanceResult.state :
    TransactionalAdvanceResult → ResourceCounterState
  | .workLimitExceeded state => state
  | .expandedBudgetExceeded state => state
  | .accepted state => state

def TransactionalAdvanceResult.IsRejected :
    TransactionalAdvanceResult → Prop
  | .workLimitExceeded _ => True
  | .expandedBudgetExceeded _ => True
  | .accepted _ => False

instance TransactionalAdvanceResult.decidableIsRejected
    (result : TransactionalAdvanceResult) : Decidable result.IsRejected := by
  cases result with
  | workLimitExceeded _ =>
      change Decidable True
      exact inferInstance
  | expandedBudgetExceeded _ =>
      change Decidable True
      exact inferInstance
  | accepted _ =>
      change Decidable False
      exact inferInstance

/-- Compute both prospective counter values before committing either one. -/
def transactionalAdvance
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunk : DecompressionChunk) : TransactionalAdvanceResult :=
  match checkedAddWithin maxWork state.work chunk.work with
  | none => .workLimitExceeded state
  | some nextWork =>
      match checkedAddWithin maxExpandedBytes state.bytes chunk.bytes with
      | none => .expandedBudgetExceeded state
      | some nextBytes => .accepted { work := nextWork, bytes := nextBytes }

theorem transactionalAdvance_eq_workLimitExceeded_iff
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunk : DecompressionChunk) :
    transactionalAdvance maxWork maxExpandedBytes state chunk =
        .workLimitExceeded state ↔
      maxWork < state.work ∨ maxWork < state.work + chunk.work := by
  cases workEq : checkedAddWithin maxWork state.work chunk.work with
  | none =>
      simpa [transactionalAdvance, workEq] using
        checkedAddWithin_eq_none_iff maxWork state.work chunk.work
  | some nextWork =>
      have workInfo :=
        (checkedAddWithin_eq_some_iff maxWork state.work chunk.work
          nextWork).mp workEq
      rcases workInfo with ⟨_, workWithin, _⟩
      cases byteEq : checkedAddWithin maxExpandedBytes state.bytes chunk.bytes with
      | none =>
          simp [transactionalAdvance, workEq, byteEq]
          omega
      | some nextBytes =>
          simp [transactionalAdvance, workEq, byteEq]
          omega

theorem transactionalAdvance_eq_expandedBudgetExceeded_iff
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunk : DecompressionChunk) :
    transactionalAdvance maxWork maxExpandedBytes state chunk =
        .expandedBudgetExceeded state ↔
      state.work + chunk.work ≤ maxWork ∧
        (maxExpandedBytes < state.bytes ∨
          maxExpandedBytes < state.bytes + chunk.bytes) := by
  cases workEq : checkedAddWithin maxWork state.work chunk.work with
  | none =>
      have workFailure :=
        (checkedAddWithin_eq_none_iff maxWork state.work chunk.work).mp workEq
      simp [transactionalAdvance, workEq]
      omega
  | some nextWork =>
      have workInfo :=
        (checkedAddWithin_eq_some_iff maxWork state.work chunk.work
          nextWork).mp workEq
      cases byteEq : checkedAddWithin maxExpandedBytes state.bytes chunk.bytes with
      | none =>
          have byteFailure :=
            (checkedAddWithin_eq_none_iff maxExpandedBytes state.bytes
              chunk.bytes).mp byteEq
          simp [transactionalAdvance, workEq, byteEq]
          omega
      | some nextBytes =>
          have byteInfo :=
            (checkedAddWithin_eq_some_iff maxExpandedBytes state.bytes
              chunk.bytes nextBytes).mp byteEq
          simp [transactionalAdvance, workEq, byteEq]
          omega

theorem transactionalAdvance_eq_accepted_iff
    (maxWork maxExpandedBytes : Nat)
    (state next : ResourceCounterState)
    (chunk : DecompressionChunk) :
    transactionalAdvance maxWork maxExpandedBytes state chunk = .accepted next ↔
      state.work + chunk.work ≤ maxWork ∧
        state.bytes + chunk.bytes ≤ maxExpandedBytes ∧
        next =
          { work := state.work + chunk.work,
            bytes := state.bytes + chunk.bytes } := by
  cases workEq : checkedAddWithin maxWork state.work chunk.work with
  | none =>
      have workFailure :=
        (checkedAddWithin_eq_none_iff maxWork state.work chunk.work).mp workEq
      simp [transactionalAdvance, workEq]
      omega
  | some nextWork =>
      have workInfo :=
        (checkedAddWithin_eq_some_iff maxWork state.work chunk.work
          nextWork).mp workEq
      cases byteEq : checkedAddWithin maxExpandedBytes state.bytes chunk.bytes with
      | none =>
          have byteFailure :=
            (checkedAddWithin_eq_none_iff maxExpandedBytes state.bytes
              chunk.bytes).mp byteEq
          simp [transactionalAdvance, workEq, byteEq]
          omega
      | some nextBytes =>
          have byteInfo :=
            (checkedAddWithin_eq_some_iff maxExpandedBytes state.bytes
              chunk.bytes nextBytes).mp byteEq
          rcases workInfo with ⟨_, workWithin, rfl⟩
          rcases byteInfo with ⟨_, byteWithin, rfl⟩
          simp [transactionalAdvance, workEq, byteEq, workWithin, byteWithin,
            eq_comm]

theorem transactionalAdvance_rejection_preserves_state
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunk : DecompressionChunk)
    (result : TransactionalAdvanceResult)
    (advanceEq : transactionalAdvance maxWork maxExpandedBytes state chunk = result)
    (rejected : result.IsRejected) :
    result.state = state := by
  subst result
  cases workEq : checkedAddWithin maxWork state.work chunk.work with
  | none =>
      simp [transactionalAdvance, workEq,
        TransactionalAdvanceResult.state]
  | some nextWork =>
      cases byteEq : checkedAddWithin maxExpandedBytes state.bytes chunk.bytes with
      | none =>
          simp [transactionalAdvance, workEq, byteEq,
            TransactionalAdvanceResult.state]
      | some nextBytes =>
          simp [transactionalAdvance, workEq, byteEq,
            TransactionalAdvanceResult.IsRejected] at rejected

theorem transactionalAdvance_rejected_retry_stable
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunk : DecompressionChunk)
    (result : TransactionalAdvanceResult)
    (advanceEq : transactionalAdvance maxWork maxExpandedBytes state chunk = result)
    (rejected : result.IsRejected) :
    transactionalAdvance maxWork maxExpandedBytes result.state chunk = result := by
  rw [transactionalAdvance_rejection_preserves_state
    maxWork maxExpandedBytes state chunk result advanceEq rejected]
  exact advanceEq

theorem transactionalAdvance_accepted_mono_limits
    {smallerWork largerWork smallerBytes largerBytes : Nat}
    (workLimitLe : smallerWork ≤ largerWork)
    (byteLimitLe : smallerBytes ≤ largerBytes)
    (state next : ResourceCounterState)
    (chunk : DecompressionChunk)
    (accepted : transactionalAdvance smallerWork smallerBytes state chunk =
      .accepted next) :
    transactionalAdvance largerWork largerBytes state chunk = .accepted next := by
  have acceptedInfo :=
    (transactionalAdvance_eq_accepted_iff smallerWork smallerBytes state next
      chunk).mp accepted
  exact (transactionalAdvance_eq_accepted_iff largerWork largerBytes state next
    chunk).mpr ⟨acceptedInfo.1.trans workLimitLe,
      acceptedInfo.2.1.trans byteLimitLe, acceptedInfo.2.2⟩

/-- A finite runner retains both the accepted prefix and the exact committed
counter state at the first rejection. -/
inductive TransactionalRunResult where
  | completed (state : ResourceCounterState)
  | workLimitExceeded
      (state : ResourceCounterState)
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
  | expandedBudgetExceeded
      (state : ResourceCounterState)
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
deriving DecidableEq, Repr

def TransactionalRunResult.prependAccepted
    (chunk : DecompressionChunk) :
    TransactionalRunResult → TransactionalRunResult
  | .completed state => .completed state
  | .workLimitExceeded state accepted rejected remaining =>
      .workLimitExceeded state (chunk :: accepted) rejected remaining
  | .expandedBudgetExceeded state accepted rejected remaining =>
      .expandedBudgetExceeded state (chunk :: accepted) rejected remaining

@[simp] theorem TransactionalRunResult.prependAccepted_eq_completed_iff
    (chunk : DecompressionChunk)
    (result : TransactionalRunResult)
    (final : ResourceCounterState) :
    result.prependAccepted chunk = .completed final ↔
      result = .completed final := by
  cases result <;> simp [TransactionalRunResult.prependAccepted]

def TransactionalRunResult.eraseState :
    TransactionalRunResult → StreamScanResult
  | .completed _ => .within
  | .workLimitExceeded _ accepted rejected remaining =>
      .workLimitExceeded accepted rejected remaining
  | .expandedBudgetExceeded _ accepted rejected remaining =>
      .expandedBudgetExceeded accepted rejected remaining

@[simp] theorem TransactionalRunResult.eraseState_prependAccepted
    (chunk : DecompressionChunk)
    (result : TransactionalRunResult) :
    (result.prependAccepted chunk).eraseState =
      result.eraseState.prependAccepted chunk := by
  cases result <;> rfl

def transactionalRunAux
    (maxWork maxExpandedBytes : Nat) :
    ResourceCounterState → List DecompressionChunk → TransactionalRunResult
  | state, [] => .completed state
  | state, chunk :: remaining =>
      match transactionalAdvance maxWork maxExpandedBytes state chunk with
      | .workLimitExceeded unchanged =>
          .workLimitExceeded unchanged [] chunk remaining
      | .expandedBudgetExceeded unchanged =>
          .expandedBudgetExceeded unchanged [] chunk remaining
      | .accepted next =>
          (transactionalRunAux maxWork maxExpandedBytes next remaining).prependAccepted
            chunk

def transactionalRun
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) : TransactionalRunResult :=
  transactionalRunAux maxWork maxExpandedBytes { work := 0, bytes := 0 } chunks

/-- Replacing direct arithmetic checks with the fail-atomic transition does
not alter the existing scanner's observable decision or first-failure trace. -/
theorem transactionalRunAux_eraseState_eq_scan
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunks : List DecompressionChunk) :
    (transactionalRunAux maxWork maxExpandedBytes state chunks).eraseState =
      scanDecompressionChunksAux maxWork maxExpandedBytes state.work state.bytes
        chunks := by
  induction chunks generalizing state with
  | nil => rfl
  | cons chunk remaining inductionHypothesis =>
      by_cases workWithin : state.work + chunk.work ≤ maxWork
      · have workEq : checkedAddWithin maxWork state.work chunk.work =
            some (state.work + chunk.work) :=
          (checkedAddWithin_eq_some_iff maxWork state.work chunk.work
            (state.work + chunk.work)).mpr ⟨by omega, workWithin, rfl⟩
        by_cases byteWithin : state.bytes + chunk.bytes ≤ maxExpandedBytes
        · have byteEq : checkedAddWithin maxExpandedBytes state.bytes chunk.bytes =
              some (state.bytes + chunk.bytes) :=
            (checkedAddWithin_eq_some_iff maxExpandedBytes state.bytes chunk.bytes
              (state.bytes + chunk.bytes)).mpr ⟨by omega, byteWithin, rfl⟩
          simp [transactionalRunAux, transactionalAdvance, workEq, byteEq,
            scanDecompressionChunksAux, workWithin, byteWithin,
            inductionHypothesis]
        · have byteEq : checkedAddWithin maxExpandedBytes state.bytes chunk.bytes =
              none :=
            (checkedAddWithin_eq_none_iff maxExpandedBytes state.bytes
              chunk.bytes).mpr (by omega)
          simp [transactionalRunAux, transactionalAdvance, workEq, byteEq,
            TransactionalRunResult.eraseState,
            scanDecompressionChunksAux, workWithin, byteWithin]
      · have workEq : checkedAddWithin maxWork state.work chunk.work = none :=
          (checkedAddWithin_eq_none_iff maxWork state.work chunk.work).mpr (by omega)
        simp [transactionalRunAux, transactionalAdvance, workEq,
          TransactionalRunResult.eraseState,
          scanDecompressionChunksAux, workWithin]

theorem transactionalRun_eraseState_eq_scan
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) :
    (transactionalRun maxWork maxExpandedBytes chunks).eraseState =
      scanDecompressionChunks maxWork maxExpandedBytes chunks := by
  exact transactionalRunAux_eraseState_eq_scan maxWork maxExpandedBytes
    { work := 0, bytes := 0 } chunks

/-- A successful run commits the mathematical totals of exactly all chunks. -/
theorem transactionalRunAux_completed_state_exact
    (maxWork maxExpandedBytes : Nat)
    (initial final : ResourceCounterState)
    (chunks : List DecompressionChunk)
    (completed : transactionalRunAux maxWork maxExpandedBytes initial chunks =
      .completed final) :
    final =
      { work := initial.work + totalChunkWork chunks,
        bytes := initial.bytes + totalChunkBytes chunks } := by
  induction chunks generalizing initial with
  | nil =>
      simpa [transactionalRunAux, totalChunkWork, totalChunkBytes] using completed.symm
  | cons chunk remaining inductionHypothesis =>
      cases advanceEq : transactionalAdvance maxWork maxExpandedBytes initial chunk with
      | workLimitExceeded unchanged =>
          simp [transactionalRunAux, advanceEq] at completed
      | expandedBudgetExceeded unchanged =>
          simp [transactionalRunAux, advanceEq] at completed
      | accepted next =>
          have nextInfo :=
            (transactionalAdvance_eq_accepted_iff maxWork maxExpandedBytes initial
              next chunk).mp advanceEq
          have remainingCompleted :
              transactionalRunAux maxWork maxExpandedBytes next remaining =
                .completed final := by
            simpa [transactionalRunAux, advanceEq,
              TransactionalRunResult.prependAccepted_eq_completed_iff] using completed
          have finalInfo := inductionHypothesis next remainingCompleted
          rcases nextInfo with ⟨_, _, rfl⟩
          simpa [totalChunkWork, totalChunkBytes, Nat.add_assoc] using finalInfo

theorem transactionalRun_completed_state_exact
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk)
    (final : ResourceCounterState)
    (completed : transactionalRun maxWork maxExpandedBytes chunks =
      .completed final) :
    final =
      { work := totalChunkWork chunks,
        bytes := totalChunkBytes chunks } := by
  simpa [transactionalRun] using
    transactionalRunAux_completed_state_exact maxWork maxExpandedBytes
      { work := 0, bytes := 0 } final chunks completed

theorem transactionalRun_completed_iff
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) :
    (∃ final, transactionalRun maxWork maxExpandedBytes chunks = .completed final) ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes := by
  rw [← scanDecompressionChunks_eq_within_iff]
  constructor
  · rintro ⟨final, completed⟩
    rw [← transactionalRun_eraseState_eq_scan]
    simp [completed, TransactionalRunResult.eraseState]
  · intro within
    cases runEq : transactionalRun maxWork maxExpandedBytes chunks with
    | completed final => exact ⟨final, rfl⟩
    | workLimitExceeded state accepted rejected remaining =>
        have erased :
            (transactionalRun maxWork maxExpandedBytes chunks).eraseState ≠ .within := by
          simp [runEq, TransactionalRunResult.eraseState]
        rw [transactionalRun_eraseState_eq_scan, within] at erased
        exact False.elim (erased rfl)
    | expandedBudgetExceeded state accepted rejected remaining =>
        have erased :
            (transactionalRun maxWork maxExpandedBytes chunks).eraseState ≠ .within := by
          simp [runEq, TransactionalRunResult.eraseState]
        rw [transactionalRun_eraseState_eq_scan, within] at erased
        exact False.elim (erased rfl)

/-- Broken comparison model: it commits work before checking bytes. A byte
rejection therefore makes an unaccepted chunk visible in later retries. -/
def naiveSequentialAdvance
    (maxWork maxExpandedBytes : Nat)
    (state : ResourceCounterState)
    (chunk : DecompressionChunk) : TransactionalAdvanceResult :=
  match checkedAddWithin maxWork state.work chunk.work with
  | none => .workLimitExceeded state
  | some nextWork =>
      let afterWork := { state with work := nextWork }
      match checkedAddWithin maxExpandedBytes state.bytes chunk.bytes with
      | none => .expandedBudgetExceeded afterWork
      | some nextBytes => .accepted { work := nextWork, bytes := nextBytes }

def retryFixtureChunk : DecompressionChunk :=
  { payload := "xxxx", work := 1 }

def retryFixtureStart : ResourceCounterState :=
  { work := 7, bytes := 7 }

def retryFixtureAfterOneNaiveFailure : ResourceCounterState :=
  { work := 8, bytes := 7 }

def retryFixtureAfterTwoNaiveFailures : ResourceCounterState :=
  { work := 9, bytes := 7 }

def retryFixtureAfterThreeNaiveFailures : ResourceCounterState :=
  { work := 10, bytes := 7 }

/-- One rejected chunk has already contaminated the work counter. -/
theorem naiveSequentialAdvance_partial_update_witness :
    naiveSequentialAdvance 10 10 retryFixtureStart retryFixtureChunk =
      .expandedBudgetExceeded retryFixtureAfterOneNaiveFailure := by
  native_decide

/-- Repeating the same rejected request eventually changes its diagnostic from
byte-budget failure to work-budget failure, solely because earlier failures
were partially committed. -/
theorem naiveSequentialAdvance_retry_history_changes_failure_class :
    naiveSequentialAdvance 10 10 retryFixtureStart retryFixtureChunk =
        .expandedBudgetExceeded retryFixtureAfterOneNaiveFailure ∧
      naiveSequentialAdvance 10 10 retryFixtureAfterOneNaiveFailure
          retryFixtureChunk =
        .expandedBudgetExceeded retryFixtureAfterTwoNaiveFailures ∧
      naiveSequentialAdvance 10 10 retryFixtureAfterTwoNaiveFailures
          retryFixtureChunk =
        .expandedBudgetExceeded retryFixtureAfterThreeNaiveFailures ∧
      naiveSequentialAdvance 10 10 retryFixtureAfterThreeNaiveFailures
          retryFixtureChunk =
        .workLimitExceeded retryFixtureAfterThreeNaiveFailures := by
  native_decide

theorem transactional_retryFixture_first_rejected_without_mutation :
    transactionalAdvance 10 10 retryFixtureStart retryFixtureChunk =
      .expandedBudgetExceeded retryFixtureStart := by
  native_decide

theorem transactional_retryFixture_is_history_independent :
    let first := transactionalAdvance 10 10 retryFixtureStart retryFixtureChunk
    first.IsRejected ∧
      transactionalAdvance 10 10 first.state retryFixtureChunk = first := by
  native_decide

def acceptedFixtureStart : ResourceCounterState :=
  { work := 7, bytes := 5 }

theorem transactionalAdvance_both_counters_commit_together :
    transactionalAdvance 10 10 acceptedFixtureStart retryFixtureChunk =
      .accepted { work := 8, bytes := 9 } := by
  native_decide

end Sprawlens.FixedPointTransactionalResourceCounter
