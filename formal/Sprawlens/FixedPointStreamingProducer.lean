import Sprawlens.FixedPointStreamingDecompression

namespace Sprawlens.FixedPointStreamingProducer

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointRawEnvelopeBoundary
open FixedPointStreamingDecompression
open FixedPointWireArtifact
open FixedPointWireDiagnostic
open FixedPointWirePayloadBudget
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u v w

/-- One lazy decompressor observation. `emit` exposes exactly one chunk and an
opaque continuation state; observing another chunk requires another pull. -/
inductive ProducerStep (State : Type u) where
  | done
  | rejected
  | emit (chunk : DecompressionChunk) (continuation : State)
deriving DecidableEq, Repr

/-- Every result records only the accepted prefix. On a resource failure the
continuation is the state after the rejected chunk was emitted, but has not
itself been pulled. -/
inductive ProducerRunResult (State : Type u) where
  | pullLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | producerRejected
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | workLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (continuation : State)
  | expandedBudgetExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (continuation : State)
  | completed
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
      (raw : String)
deriving DecidableEq, Repr

def ProducerRunResult.acceptedChunks
    {State : Type u} : ProducerRunResult State → List DecompressionChunk
  | .pullLimitExceeded accepted _ => accepted
  | .producerRejected accepted _ => accepted
  | .workLimitExceeded accepted _ _ => accepted
  | .expandedBudgetExceeded accepted _ _ => accepted
  | .completed accepted _ _ => accepted

def ProducerRunResult.prependAccepted
    {State : Type u} (chunk : DecompressionChunk) :
    ProducerRunResult State → ProducerRunResult State
  | .pullLimitExceeded accepted continuation =>
      .pullLimitExceeded (chunk :: accepted) continuation
  | .producerRejected accepted continuation =>
      .producerRejected (chunk :: accepted) continuation
  | .workLimitExceeded accepted rejected continuation =>
      .workLimitExceeded (chunk :: accepted) rejected continuation
  | .expandedBudgetExceeded accepted rejected continuation =>
      .expandedBudgetExceeded (chunk :: accepted) rejected continuation
  | .completed accepted continuation raw =>
      .completed (chunk :: accepted) continuation (chunk.payload ++ raw)

@[simp] theorem ProducerRunResult.acceptedChunks_prependAccepted
    {State : Type u} (chunk : DecompressionChunk)
    (result : ProducerRunResult State) :
    (result.prependAccepted chunk).acceptedChunks =
      chunk :: result.acceptedChunks := by
  cases result <;> rfl

/-- `pullsLeft` is a cap on producer observations, separate from decompressor
work. Resource checks happen before recursively pulling the continuation. -/
def runProducerAux
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) :
    Nat → Nat → Nat → State → ProducerRunResult State
  | 0, _, _, state => .pullLimitExceeded [] state
  | pullsLeft + 1, usedWork, usedBytes, state =>
      match pull state with
      | .done => .completed [] state ""
      | .rejected => .producerRejected [] state
      | .emit chunk continuation =>
          if _workWithin : usedWork + chunk.work ≤ maxWork then
            if _bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes then
              (runProducerAux maxWork maxExpandedBytes pull pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                continuation).prependAccepted chunk
            else .expandedBudgetExceeded [] chunk continuation
          else .workLimitExceeded [] chunk continuation

def runProducer
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (initial : State) : ProducerRunResult State :=
  runProducerAux maxWork maxExpandedBytes pull maxPulls 0 0 initial

theorem runProducerAux_acceptedChunks_within
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State)
    (usedWorkWithin : usedWork ≤ maxWork)
    (usedBytesWithin : usedBytes ≤ maxExpandedBytes) :
    let result := runProducerAux maxWork maxExpandedBytes pull pullsLeft
      usedWork usedBytes state
    usedWork + totalChunkWork result.acceptedChunks ≤ maxWork ∧
      usedBytes + totalChunkBytes result.acceptedChunks ≤ maxExpandedBytes := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simp [runProducerAux, ProducerRunResult.acceptedChunks,
        totalChunkWork, totalChunkBytes, usedWorkWithin, usedBytesWithin]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull state with
      | done =>
          simp [runProducerAux, pulledEq, ProducerRunResult.acceptedChunks,
            totalChunkWork, totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | rejected =>
          simp [runProducerAux, pulledEq, ProducerRunResult.acceptedChunks,
            totalChunkWork, totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                continuation workWithin bytesWithin
              simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                ProducerRunResult.acceptedChunks_prependAccepted,
                totalChunkWork, totalChunkBytes] at recursive ⊢
              omega
            · simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                ProducerRunResult.acceptedChunks, totalChunkWork,
                totalChunkBytes, usedWorkWithin, usedBytesWithin]
          · simp [runProducerAux, pulledEq, workWithin,
              ProducerRunResult.acceptedChunks, totalChunkWork,
              totalChunkBytes, usedWorkWithin, usedBytesWithin]

theorem runProducer_acceptedChunks_within
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial : State) :
    totalChunkWork
        (runProducer maxPulls maxWork maxExpandedBytes pull initial).acceptedChunks ≤
      maxWork ∧
    totalChunkBytes
        (runProducer maxPulls maxWork maxExpandedBytes pull initial).acceptedChunks ≤
      maxExpandedBytes := by
  simpa [runProducer] using runProducerAux_acceptedChunks_within maxWork
    maxExpandedBytes pull maxPulls 0 0 initial (Nat.zero_le _)
    (Nat.zero_le _)

def ProducerRunResult.resourceSound
    {State : Type u}
    (maxWork maxExpandedBytes usedWork usedBytes : Nat) :
    ProducerRunResult State → Prop
  | .pullLimitExceeded accepted _ =>
      usedWork + totalChunkWork accepted ≤ maxWork ∧
        usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes
  | .producerRejected accepted _ =>
      usedWork + totalChunkWork accepted ≤ maxWork ∧
        usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes
  | .workLimitExceeded accepted rejected _ =>
      usedWork + totalChunkWork accepted ≤ maxWork ∧
        maxWork < usedWork + totalChunkWork accepted + rejected.work ∧
        usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes
  | .expandedBudgetExceeded accepted rejected _ =>
      usedWork + totalChunkWork accepted + rejected.work ≤ maxWork ∧
        usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes ∧
        maxExpandedBytes <
          usedBytes + totalChunkBytes accepted + rejected.bytes
  | .completed accepted _ _ =>
      usedWork + totalChunkWork accepted ≤ maxWork ∧
        usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes

def ProducerRunResult.rawMatchesAccepted
    {State : Type u} : ProducerRunResult State → Prop
  | .completed accepted _ raw => raw = materializeChunks accepted
  | _ => True

theorem runProducerAux_resourceSound
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State)
    (usedWorkWithin : usedWork ≤ maxWork)
    (usedBytesWithin : usedBytes ≤ maxExpandedBytes) :
    (runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork
      usedBytes state).resourceSound maxWork maxExpandedBytes usedWork
        usedBytes := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simp [runProducerAux, ProducerRunResult.resourceSound,
        totalChunkWork, totalChunkBytes, usedWorkWithin, usedBytesWithin]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull state with
      | done =>
          simp [runProducerAux, pulledEq, ProducerRunResult.resourceSound,
            totalChunkWork, totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | rejected =>
          simp [runProducerAux, pulledEq, ProducerRunResult.resourceSound,
            totalChunkWork, totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                continuation workWithin bytesWithin
              cases recursiveEq : runProducerAux maxWork maxExpandedBytes pull
                  pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation <;>
                simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                  recursiveEq, ProducerRunResult.prependAccepted,
                  ProducerRunResult.resourceSound, totalChunkWork,
                  totalChunkBytes] at recursive ⊢ <;>
                omega
            · simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                ProducerRunResult.resourceSound, totalChunkWork,
                totalChunkBytes]
              omega
          · simp [runProducerAux, pulledEq, workWithin,
              ProducerRunResult.resourceSound, totalChunkWork,
              totalChunkBytes, usedBytesWithin]
            omega

theorem runProducerAux_rawMatchesAccepted
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State) :
    (runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork
      usedBytes state).rawMatchesAccepted := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero => simp [runProducerAux, ProducerRunResult.rawMatchesAccepted]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull state with
      | done =>
          simp [runProducerAux, pulledEq,
            ProducerRunResult.rawMatchesAccepted, materializeChunks]
      | rejected =>
          simp [runProducerAux, pulledEq,
            ProducerRunResult.rawMatchesAccepted]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes) continuation
              cases recursiveEq : runProducerAux maxWork maxExpandedBytes pull
                  pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation <;>
                simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                  recursiveEq, ProducerRunResult.prependAccepted,
                  ProducerRunResult.rawMatchesAccepted, materializeChunks]
                  at recursive ⊢
              exact recursive
            · simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                ProducerRunResult.rawMatchesAccepted]
          · simp [runProducerAux, pulledEq, workWithin,
              ProducerRunResult.rawMatchesAccepted]

theorem runProducer_workFailure_witness
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (failure : runProducer maxPulls maxWork maxExpandedBytes pull initial =
      .workLimitExceeded accepted rejected continuation) :
    totalChunkWork accepted ≤ maxWork ∧
      maxWork < totalChunkWork accepted + rejected.work ∧
    totalChunkBytes accepted ≤ maxExpandedBytes := by
  have failureAux :
      runProducerAux maxWork maxExpandedBytes pull maxPulls 0 0 initial =
        .workLimitExceeded accepted rejected continuation := by
    simpa [runProducer] using failure
  have sound := runProducerAux_resourceSound maxWork maxExpandedBytes pull
    maxPulls 0 0 initial (Nat.zero_le _) (Nat.zero_le _)
  rw [failureAux] at sound
  simpa [ProducerRunResult.resourceSound] using sound

theorem runProducer_expandedFailure_witness
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (failure : runProducer maxPulls maxWork maxExpandedBytes pull initial =
      .expandedBudgetExceeded accepted rejected continuation) :
    totalChunkWork accepted + rejected.work ≤ maxWork ∧
      totalChunkBytes accepted ≤ maxExpandedBytes ∧
      maxExpandedBytes < totalChunkBytes accepted + rejected.bytes := by
  have failureAux :
      runProducerAux maxWork maxExpandedBytes pull maxPulls 0 0 initial =
        .expandedBudgetExceeded accepted rejected continuation := by
    simpa [runProducer] using failure
  have sound := runProducerAux_resourceSound maxWork maxExpandedBytes pull
    maxPulls 0 0 initial (Nat.zero_le _) (Nat.zero_le _)
  rw [failureAux] at sound
  simpa [ProducerRunResult.resourceSound] using sound

theorem runProducer_completed_output_sound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial finalState : State)
    (accepted : List DecompressionChunk) (raw : String)
    (completed : runProducer maxPulls maxWork maxExpandedBytes pull initial =
      .completed accepted finalState raw) :
    raw = materializeChunks accepted ∧
      totalChunkWork accepted ≤ maxWork ∧
      raw.utf8ByteSize ≤ maxExpandedBytes := by
  have completedAux :
      runProducerAux maxWork maxExpandedBytes pull maxPulls 0 0 initial =
        .completed accepted finalState raw := by
    simpa [runProducer] using completed
  have resources := runProducerAux_resourceSound maxWork maxExpandedBytes pull
    maxPulls 0 0 initial (Nat.zero_le _) (Nat.zero_le _)
  have rawMatches := runProducerAux_rawMatchesAccepted maxWork
    maxExpandedBytes pull maxPulls 0 0 initial
  rw [completedAux] at resources rawMatches
  have resourceInfo :
      totalChunkWork accepted ≤ maxWork ∧
        totalChunkBytes accepted ≤ maxExpandedBytes := by
    simpa [ProducerRunResult.resourceSound] using resources
  have rawEq : raw = materializeChunks accepted := by
    simpa [ProducerRunResult.rawMatchesAccepted] using rawMatches
  exact ⟨rawEq, resourceInfo.1, by
    rw [rawEq, materializeChunks_utf8ByteSize]
    exact resourceInfo.2⟩

/-! ## Producer-observation trace and pull accounting -/

inductive ProducerEmits
    {State : Type u}
    (pull : State → ProducerStep State) :
    State → List DecompressionChunk → State → Prop
  | nil (state : State) : ProducerEmits pull state [] state
  | cons
      {state continuation finalState : State}
      {chunk : DecompressionChunk} {remaining : List DecompressionChunk}
      (head : pull state = .emit chunk continuation)
      (tail : ProducerEmits pull continuation remaining finalState) :
      ProducerEmits pull state (chunk :: remaining) finalState

def ProducerRunResult.traceSound
    {State : Type u}
    (pull : State → ProducerStep State) (initial : State) :
    ProducerRunResult State → Prop
  | .pullLimitExceeded accepted continuation =>
      ProducerEmits pull initial accepted continuation
  | .producerRejected accepted continuation =>
      ProducerEmits pull initial accepted continuation ∧
        pull continuation = .rejected
  | .workLimitExceeded accepted rejected continuation =>
      ProducerEmits pull initial (accepted ++ [rejected]) continuation
  | .expandedBudgetExceeded accepted rejected continuation =>
      ProducerEmits pull initial (accepted ++ [rejected]) continuation
  | .completed accepted continuation _ =>
      ProducerEmits pull initial accepted continuation ∧
        pull continuation = .done

def ProducerRunResult.pullBudgetSound
    {State : Type u} (maxPulls : Nat) : ProducerRunResult State → Prop
  | .pullLimitExceeded accepted _ => accepted.length = maxPulls
  | .producerRejected accepted _ => accepted.length + 1 ≤ maxPulls
  | .workLimitExceeded accepted _ _ => accepted.length + 1 ≤ maxPulls
  | .expandedBudgetExceeded accepted _ _ => accepted.length + 1 ≤ maxPulls
  | .completed accepted _ _ => accepted.length + 1 ≤ maxPulls

theorem ProducerRunResult.traceSound_prependAccepted
    {State : Type u}
    (pull : State → ProducerStep State)
    (state continuation : State) (chunk : DecompressionChunk)
    (result : ProducerRunResult State)
    (pulled : pull state = .emit chunk continuation)
    (sound : result.traceSound pull continuation) :
    (result.prependAccepted chunk).traceSound pull state := by
  cases result with
  | pullLimitExceeded accepted finalState =>
      exact ProducerEmits.cons pulled sound
  | producerRejected accepted finalState =>
      exact ⟨ProducerEmits.cons pulled sound.1, sound.2⟩
  | workLimitExceeded accepted rejected finalState =>
      simpa [ProducerRunResult.prependAccepted,
        ProducerRunResult.traceSound, List.cons_append] using
        ProducerEmits.cons pulled sound
  | expandedBudgetExceeded accepted rejected finalState =>
      simpa [ProducerRunResult.prependAccepted,
        ProducerRunResult.traceSound, List.cons_append] using
        ProducerEmits.cons pulled sound
  | completed accepted finalState raw =>
      exact ⟨ProducerEmits.cons pulled sound.1, sound.2⟩

theorem ProducerRunResult.pullBudgetSound_prependAccepted
    {State : Type u}
    (pullsLeft : Nat) (chunk : DecompressionChunk)
    (result : ProducerRunResult State)
    (sound : result.pullBudgetSound pullsLeft) :
    (result.prependAccepted chunk).pullBudgetSound (pullsLeft + 1) := by
  cases result <;>
    simp [ProducerRunResult.prependAccepted,
      ProducerRunResult.pullBudgetSound] at sound ⊢ <;>
    omega

theorem runProducerAux_traceSound
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State) :
    (runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork
      usedBytes state).traceSound pull state := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      exact ProducerEmits.nil state
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull state with
      | done =>
          simpa [runProducerAux, pulledEq,
            ProducerRunResult.traceSound] using
            And.intro (ProducerEmits.nil state) pulledEq
      | rejected =>
          simpa [runProducerAux, pulledEq,
            ProducerRunResult.traceSound] using
            And.intro (ProducerEmits.nil state) pulledEq
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have prep :=
                ProducerRunResult.traceSound_prependAccepted pull state
                  continuation chunk
                  (runProducerAux maxWork maxExpandedBytes pull pullsLeft
                    (usedWork + chunk.work) (usedBytes + chunk.bytes)
                    continuation) pulledEq
                  (inductionHypothesis (usedWork + chunk.work)
                    (usedBytes + chunk.bytes) continuation)
              simpa [runProducerAux, pulledEq, workWithin, bytesWithin] using
                prep
            · simpa [runProducerAux, pulledEq, workWithin, bytesWithin,
                ProducerRunResult.traceSound] using
                (ProducerEmits.cons pulledEq
                  (ProducerEmits.nil continuation))
          · simpa [runProducerAux, pulledEq, workWithin,
              ProducerRunResult.traceSound] using
              (ProducerEmits.cons pulledEq
                (ProducerEmits.nil continuation))

theorem runProducerAux_pullBudgetSound
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State) :
    (runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork
      usedBytes state).pullBudgetSound pullsLeft := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simp [runProducerAux, ProducerRunResult.pullBudgetSound]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull state with
      | done =>
          simp [runProducerAux, pulledEq,
            ProducerRunResult.pullBudgetSound]
      | rejected =>
          simp [runProducerAux, pulledEq,
            ProducerRunResult.pullBudgetSound]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have prep :=
                ProducerRunResult.pullBudgetSound_prependAccepted pullsLeft
                  chunk
                  (runProducerAux maxWork maxExpandedBytes pull pullsLeft
                    (usedWork + chunk.work) (usedBytes + chunk.bytes)
                    continuation)
                  (inductionHypothesis (usedWork + chunk.work)
                    (usedBytes + chunk.bytes) continuation)
              simpa [runProducerAux, pulledEq, workWithin, bytesWithin] using
                prep
            · simp [runProducerAux, pulledEq, workWithin, bytesWithin,
                ProducerRunResult.pullBudgetSound]
          · simp [runProducerAux, pulledEq, workWithin,
              ProducerRunResult.pullBudgetSound]

theorem runProducer_traceSound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial : State) :
    (runProducer maxPulls maxWork maxExpandedBytes pull initial).traceSound
      pull initial := by
  exact runProducerAux_traceSound maxWork maxExpandedBytes pull maxPulls 0 0
    initial

theorem runProducer_pullBudgetSound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial : State) :
    (runProducer maxPulls maxWork maxExpandedBytes pull initial).pullBudgetSound
      maxPulls := by
  exact runProducerAux_pullBudgetSound maxWork maxExpandedBytes pull maxPulls
    0 0 initial

theorem runProducer_completed_trace
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial finalState : State)
    (accepted : List DecompressionChunk) (raw : String)
    (completed : runProducer maxPulls maxWork maxExpandedBytes pull initial =
      .completed accepted finalState raw) :
    ProducerEmits pull initial accepted finalState ∧
      pull finalState = .done ∧
      accepted.length + 1 ≤ maxPulls := by
  have trace := runProducer_traceSound maxPulls maxWork maxExpandedBytes pull
    initial
  have budget := runProducer_pullBudgetSound maxPulls maxWork
    maxExpandedBytes pull initial
  rw [completed] at trace budget
  exact ⟨trace.1, trace.2, budget⟩

theorem runProducer_workFailure_trace
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (failure : runProducer maxPulls maxWork maxExpandedBytes pull initial =
      .workLimitExceeded accepted rejected continuation) :
    ProducerEmits pull initial (accepted ++ [rejected]) continuation ∧
      accepted.length + 1 ≤ maxPulls := by
  have trace := runProducer_traceSound maxPulls maxWork maxExpandedBytes pull
    initial
  have budget := runProducer_pullBudgetSound maxPulls maxWork
    maxExpandedBytes pull initial
  rw [failure] at trace budget
  exact ⟨trace, budget⟩

theorem runProducer_expandedFailure_trace
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (failure : runProducer maxPulls maxWork maxExpandedBytes pull initial =
      .expandedBudgetExceeded accepted rejected continuation) :
    ProducerEmits pull initial (accepted ++ [rejected]) continuation ∧
      accepted.length + 1 ≤ maxPulls := by
  have trace := runProducer_traceSound maxPulls maxWork maxExpandedBytes pull
    initial
  have budget := runProducer_pullBudgetSound maxPulls maxWork
    maxExpandedBytes pull initial
  rw [failure] at trace budget
  exact ⟨trace, budget⟩

theorem runProducerAux_workFailure_of_trace
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat)
    (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (trace : ProducerEmits pull initial (accepted ++ [rejected]) continuation)
    (pullsWithin : accepted.length + 1 ≤ pullsLeft)
    (acceptedWorkWithin :
      usedWork + totalChunkWork accepted ≤ maxWork)
    (rejectedWorkExceeded :
      maxWork < usedWork + totalChunkWork accepted + rejected.work)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes) :
    runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork usedBytes
        initial = .workLimitExceeded accepted rejected continuation := by
  induction accepted generalizing pullsLeft usedWork usedBytes initial with
  | nil =>
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              cases tail
              have workExceeded : ¬usedWork + rejected.work ≤ maxWork := by
                simp [totalChunkWork] at rejectedWorkExceeded
                omega
              simp [runProducerAux, pulled, workExceeded]
  | cons chunk accepted inductionHypothesis =>
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              have workWithin : usedWork + chunk.work ≤ maxWork := by
                simp [totalChunkWork] at acceptedWorkWithin
                omega
              have bytesWithin :
                  usedBytes + chunk.bytes ≤ maxExpandedBytes := by
                simp [totalChunkBytes] at acceptedBytesWithin
                omega
              have recursive := inductionHypothesis pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes) _ tail
                (by simp at pullsWithin ⊢; omega)
                (by simp [totalChunkWork] at acceptedWorkWithin ⊢; omega)
                (by simp [totalChunkWork] at rejectedWorkExceeded ⊢; omega)
                (by simp [totalChunkBytes] at acceptedBytesWithin ⊢; omega)
              simp [runProducerAux, pulled, workWithin, bytesWithin,
                recursive, ProducerRunResult.prependAccepted]

theorem runProducer_eq_workLimitExceeded_iff
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk) :
    runProducer maxPulls maxWork maxExpandedBytes pull initial =
        .workLimitExceeded accepted rejected continuation ↔
      ProducerEmits pull initial (accepted ++ [rejected]) continuation ∧
        accepted.length + 1 ≤ maxPulls ∧
        totalChunkWork accepted ≤ maxWork ∧
        maxWork < totalChunkWork accepted + rejected.work ∧
        totalChunkBytes accepted ≤ maxExpandedBytes := by
  constructor
  · intro failure
    have trace := runProducer_workFailure_trace maxPulls maxWork
      maxExpandedBytes pull initial continuation accepted rejected failure
    have resources := runProducer_workFailure_witness maxPulls maxWork
      maxExpandedBytes pull initial continuation accepted rejected failure
    exact ⟨trace.1, trace.2, resources.1, resources.2.1,
      resources.2.2⟩
  · rintro ⟨trace, pullsWithin, acceptedWorkWithin,
      rejectedWorkExceeded, acceptedBytesWithin⟩
    exact runProducerAux_workFailure_of_trace maxWork maxExpandedBytes pull
      maxPulls 0 0 initial continuation accepted rejected trace pullsWithin
      (by simpa using acceptedWorkWithin)
      (by simpa using rejectedWorkExceeded)
      (by simpa using acceptedBytesWithin)

theorem runProducerAux_expandedFailure_of_trace
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat)
    (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (trace : ProducerEmits pull initial (accepted ++ [rejected]) continuation)
    (pullsWithin : accepted.length + 1 ≤ pullsLeft)
    (rejectedWorkWithin :
      usedWork + totalChunkWork accepted + rejected.work ≤ maxWork)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes)
    (rejectedBytesExceeded :
      maxExpandedBytes <
        usedBytes + totalChunkBytes accepted + rejected.bytes) :
    runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork usedBytes
        initial = .expandedBudgetExceeded accepted rejected continuation := by
  induction accepted generalizing pullsLeft usedWork usedBytes initial with
  | nil =>
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              cases tail
              have workWithin : usedWork + rejected.work ≤ maxWork := by
                simpa [totalChunkWork] using rejectedWorkWithin
              have bytesExceeded :
                  ¬usedBytes + rejected.bytes ≤ maxExpandedBytes := by
                simp [totalChunkBytes] at rejectedBytesExceeded
                omega
              simp [runProducerAux, pulled, workWithin, bytesExceeded]
  | cons chunk accepted inductionHypothesis =>
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              have workWithin : usedWork + chunk.work ≤ maxWork := by
                simp [totalChunkWork] at rejectedWorkWithin
                omega
              have bytesWithin :
                  usedBytes + chunk.bytes ≤ maxExpandedBytes := by
                simp [totalChunkBytes] at acceptedBytesWithin
                omega
              have recursive := inductionHypothesis pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes) _ tail
                (by simp at pullsWithin ⊢; omega)
                (by simp [totalChunkWork] at rejectedWorkWithin ⊢; omega)
                (by simp [totalChunkBytes] at acceptedBytesWithin ⊢; omega)
                (by simp [totalChunkBytes] at rejectedBytesExceeded ⊢; omega)
              simp [runProducerAux, pulled, workWithin, bytesWithin,
                recursive, ProducerRunResult.prependAccepted]

theorem runProducer_eq_expandedBudgetExceeded_iff
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk) :
    runProducer maxPulls maxWork maxExpandedBytes pull initial =
        .expandedBudgetExceeded accepted rejected continuation ↔
      ProducerEmits pull initial (accepted ++ [rejected]) continuation ∧
        accepted.length + 1 ≤ maxPulls ∧
        totalChunkWork accepted + rejected.work ≤ maxWork ∧
        totalChunkBytes accepted ≤ maxExpandedBytes ∧
        maxExpandedBytes < totalChunkBytes accepted + rejected.bytes := by
  constructor
  · intro failure
    have trace := runProducer_expandedFailure_trace maxPulls maxWork
      maxExpandedBytes pull initial continuation accepted rejected failure
    have resources := runProducer_expandedFailure_witness maxPulls maxWork
      maxExpandedBytes pull initial continuation accepted rejected failure
    exact ⟨trace.1, trace.2, resources.1, resources.2.1,
      resources.2.2⟩
  · rintro ⟨trace, pullsWithin, rejectedWorkWithin,
      acceptedBytesWithin, rejectedBytesExceeded⟩
    exact runProducerAux_expandedFailure_of_trace maxWork maxExpandedBytes
      pull maxPulls 0 0 initial continuation accepted rejected trace
      pullsWithin (by simpa using rejectedWorkWithin)
      (by simpa using acceptedBytesWithin)
      (by simpa using rejectedBytesExceeded)

theorem runProducer_workFailure_of_sameEmittedPrefix
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull₁ pull₂ : State → ProducerStep State)
    (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (failure : runProducer maxPulls maxWork maxExpandedBytes pull₁ initial =
      .workLimitExceeded accepted rejected continuation)
    (sameObservedPrefix :
      ProducerEmits pull₂ initial (accepted ++ [rejected]) continuation) :
    runProducer maxPulls maxWork maxExpandedBytes pull₂ initial =
      .workLimitExceeded accepted rejected continuation := by
  obtain ⟨_, pullsWithin, acceptedWorkWithin, rejectedWorkExceeded,
      acceptedBytesWithin⟩ :=
    (runProducer_eq_workLimitExceeded_iff maxPulls maxWork maxExpandedBytes
      pull₁ initial continuation accepted rejected).mp failure
  exact (runProducer_eq_workLimitExceeded_iff maxPulls maxWork
    maxExpandedBytes pull₂ initial continuation accepted rejected).mpr
      ⟨sameObservedPrefix, pullsWithin, acceptedWorkWithin,
        rejectedWorkExceeded, acceptedBytesWithin⟩

theorem runProducer_expandedFailure_of_sameEmittedPrefix
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull₁ pull₂ : State → ProducerStep State)
    (initial continuation : State)
    (accepted : List DecompressionChunk) (rejected : DecompressionChunk)
    (failure : runProducer maxPulls maxWork maxExpandedBytes pull₁ initial =
      .expandedBudgetExceeded accepted rejected continuation)
    (sameObservedPrefix :
      ProducerEmits pull₂ initial (accepted ++ [rejected]) continuation) :
    runProducer maxPulls maxWork maxExpandedBytes pull₂ initial =
      .expandedBudgetExceeded accepted rejected continuation := by
  obtain ⟨_, pullsWithin, rejectedWorkWithin, acceptedBytesWithin,
      rejectedBytesExceeded⟩ :=
    (runProducer_eq_expandedBudgetExceeded_iff maxPulls maxWork
      maxExpandedBytes pull₁ initial continuation accepted rejected).mp failure
  exact (runProducer_eq_expandedBudgetExceeded_iff maxPulls maxWork
    maxExpandedBytes pull₂ initial continuation accepted rejected).mpr
      ⟨sameObservedPrefix, pullsWithin, rejectedWorkWithin,
        acceptedBytesWithin, rejectedBytesExceeded⟩

theorem runProducerAux_completed_of_trace
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat)
    (initial finalState : State)
    (accepted : List DecompressionChunk)
    (trace : ProducerEmits pull initial accepted finalState)
    (doneAtFinal : pull finalState = .done)
    (pullsWithin : accepted.length + 1 ≤ pullsLeft)
    (acceptedWorkWithin :
      usedWork + totalChunkWork accepted ≤ maxWork)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes) :
    runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork usedBytes
        initial =
      .completed accepted finalState (materializeChunks accepted) := by
  induction accepted generalizing pullsLeft usedWork usedBytes initial with
  | nil =>
      cases trace
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          simp [runProducerAux, doneAtFinal, materializeChunks]
  | cons chunk accepted inductionHypothesis =>
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              have workWithin : usedWork + chunk.work ≤ maxWork := by
                simp [totalChunkWork] at acceptedWorkWithin
                omega
              have bytesWithin :
                  usedBytes + chunk.bytes ≤ maxExpandedBytes := by
                simp [totalChunkBytes] at acceptedBytesWithin
                omega
              have recursive := inductionHypothesis pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes) _ tail
                (by simp at pullsWithin ⊢; omega)
                (by simp [totalChunkWork] at acceptedWorkWithin ⊢; omega)
                (by simp [totalChunkBytes] at acceptedBytesWithin ⊢; omega)
              simp [runProducerAux, pulled, workWithin, bytesWithin,
                recursive, ProducerRunResult.prependAccepted,
                materializeChunks]

theorem runProducer_eq_completed_iff
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial finalState : State)
    (accepted : List DecompressionChunk) (raw : String) :
    runProducer maxPulls maxWork maxExpandedBytes pull initial =
        .completed accepted finalState raw ↔
      ProducerEmits pull initial accepted finalState ∧
        pull finalState = .done ∧
        accepted.length + 1 ≤ maxPulls ∧
        totalChunkWork accepted ≤ maxWork ∧
        totalChunkBytes accepted ≤ maxExpandedBytes ∧
        raw = materializeChunks accepted := by
  constructor
  · intro completed
    have traceInfo := runProducer_completed_trace maxPulls maxWork
      maxExpandedBytes pull initial finalState accepted raw completed
    have outputInfo := runProducer_completed_output_sound maxPulls maxWork
      maxExpandedBytes pull initial finalState accepted raw completed
    exact ⟨traceInfo.1, traceInfo.2.1, traceInfo.2.2, outputInfo.2.1,
      by simpa [outputInfo.1, materializeChunks_utf8ByteSize] using
        outputInfo.2.2,
      outputInfo.1⟩
  · rintro ⟨trace, doneAtFinal, pullsWithin, acceptedWorkWithin,
      acceptedBytesWithin, rfl⟩
    exact runProducerAux_completed_of_trace maxWork maxExpandedBytes pull
      maxPulls 0 0 initial finalState accepted trace doneAtFinal pullsWithin
      (by simpa using acceptedWorkWithin)
      (by simpa using acceptedBytesWithin)

theorem runProducer_completed_mono
    {State : Type u}
    {pullsSmaller pullsLarger workSmaller workLarger
      bytesSmaller bytesLarger : Nat}
    (pullsLe : pullsSmaller ≤ pullsLarger)
    (workLe : workSmaller ≤ workLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (pull : State → ProducerStep State) (initial finalState : State)
    (accepted : List DecompressionChunk) (raw : String)
    (completed : runProducer pullsSmaller workSmaller bytesSmaller pull
      initial = .completed accepted finalState raw) :
    runProducer pullsLarger workLarger bytesLarger pull initial =
      .completed accepted finalState raw := by
  obtain ⟨trace, doneAtFinal, pullsWithin, workWithin, bytesWithin,
      rawEq⟩ :=
    (runProducer_eq_completed_iff pullsSmaller workSmaller bytesSmaller pull
      initial finalState accepted raw).mp completed
  exact (runProducer_eq_completed_iff pullsLarger workLarger bytesLarger pull
    initial finalState accepted raw).mpr
      ⟨trace, doneAtFinal, pullsWithin.trans pullsLe,
        workWithin.trans workLe, bytesWithin.trans bytesLe, rawEq⟩

theorem runProducerAux_producerRejected_of_trace
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat)
    (initial finalState : State)
    (accepted : List DecompressionChunk)
    (trace : ProducerEmits pull initial accepted finalState)
    (rejectedAtFinal : pull finalState = .rejected)
    (pullsWithin : accepted.length + 1 ≤ pullsLeft)
    (acceptedWorkWithin :
      usedWork + totalChunkWork accepted ≤ maxWork)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes) :
    runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork usedBytes
        initial = .producerRejected accepted finalState := by
  induction accepted generalizing pullsLeft usedWork usedBytes initial with
  | nil =>
      cases trace
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          simp [runProducerAux, rejectedAtFinal]
  | cons chunk accepted inductionHypothesis =>
      cases pullsLeft with
      | zero => simp at pullsWithin
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              have workWithin : usedWork + chunk.work ≤ maxWork := by
                simp [totalChunkWork] at acceptedWorkWithin
                omega
              have bytesWithin :
                  usedBytes + chunk.bytes ≤ maxExpandedBytes := by
                simp [totalChunkBytes] at acceptedBytesWithin
                omega
              have recursive := inductionHypothesis pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes) _ tail
                (by simp at pullsWithin ⊢; omega)
                (by simp [totalChunkWork] at acceptedWorkWithin ⊢; omega)
                (by simp [totalChunkBytes] at acceptedBytesWithin ⊢; omega)
              simp [runProducerAux, pulled, workWithin, bytesWithin,
                recursive, ProducerRunResult.prependAccepted]

theorem runProducer_eq_producerRejected_iff
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial finalState : State)
    (accepted : List DecompressionChunk) :
    runProducer maxPulls maxWork maxExpandedBytes pull initial =
        .producerRejected accepted finalState ↔
      ProducerEmits pull initial accepted finalState ∧
        pull finalState = .rejected ∧
        accepted.length + 1 ≤ maxPulls ∧
        totalChunkWork accepted ≤ maxWork ∧
        totalChunkBytes accepted ≤ maxExpandedBytes := by
  constructor
  · intro rejected
    have trace := runProducer_traceSound maxPulls maxWork maxExpandedBytes
      pull initial
    have budget := runProducer_pullBudgetSound maxPulls maxWork
      maxExpandedBytes pull initial
    have resources := runProducer_acceptedChunks_within maxPulls maxWork
      maxExpandedBytes pull initial
    rw [rejected] at trace budget resources
    exact ⟨trace.1, trace.2, budget, resources.1, resources.2⟩
  · rintro ⟨trace, rejectedAtFinal, pullsWithin, acceptedWorkWithin,
      acceptedBytesWithin⟩
    exact runProducerAux_producerRejected_of_trace maxWork maxExpandedBytes
      pull maxPulls 0 0 initial finalState accepted trace rejectedAtFinal
      pullsWithin (by simpa using acceptedWorkWithin)
      (by simpa using acceptedBytesWithin)

theorem runProducerAux_pullLimitExceeded_of_trace
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (pullsLeft usedWork usedBytes : Nat)
    (initial finalState : State)
    (accepted : List DecompressionChunk)
    (trace : ProducerEmits pull initial accepted finalState)
    (pullsExact : accepted.length = pullsLeft)
    (acceptedWorkWithin :
      usedWork + totalChunkWork accepted ≤ maxWork)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes accepted ≤ maxExpandedBytes) :
    runProducerAux maxWork maxExpandedBytes pull pullsLeft usedWork usedBytes
        initial = .pullLimitExceeded accepted finalState := by
  induction accepted generalizing pullsLeft usedWork usedBytes initial with
  | nil =>
      cases trace
      simp at pullsExact
      subst pullsLeft
      rfl
  | cons chunk accepted inductionHypothesis =>
      cases pullsLeft with
      | zero => simp at pullsExact
      | succ pullsLeft =>
          cases trace with
          | cons pulled tail =>
              have workWithin : usedWork + chunk.work ≤ maxWork := by
                simp [totalChunkWork] at acceptedWorkWithin
                omega
              have bytesWithin :
                  usedBytes + chunk.bytes ≤ maxExpandedBytes := by
                simp [totalChunkBytes] at acceptedBytesWithin
                omega
              have recursive := inductionHypothesis pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes) _ tail
                (by simp at pullsExact ⊢; omega)
                (by simp [totalChunkWork] at acceptedWorkWithin ⊢; omega)
                (by simp [totalChunkBytes] at acceptedBytesWithin ⊢; omega)
              simp [runProducerAux, pulled, workWithin, bytesWithin,
                recursive, ProducerRunResult.prependAccepted]

theorem runProducer_eq_pullLimitExceeded_iff
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State) (initial finalState : State)
    (accepted : List DecompressionChunk) :
    runProducer maxPulls maxWork maxExpandedBytes pull initial =
        .pullLimitExceeded accepted finalState ↔
      ProducerEmits pull initial accepted finalState ∧
        accepted.length = maxPulls ∧
        totalChunkWork accepted ≤ maxWork ∧
        totalChunkBytes accepted ≤ maxExpandedBytes := by
  constructor
  · intro exhausted
    have trace := runProducer_traceSound maxPulls maxWork maxExpandedBytes
      pull initial
    have budget := runProducer_pullBudgetSound maxPulls maxWork
      maxExpandedBytes pull initial
    have resources := runProducer_acceptedChunks_within maxPulls maxWork
      maxExpandedBytes pull initial
    rw [exhausted] at trace budget resources
    exact ⟨trace, budget, resources.1, resources.2⟩
  · rintro ⟨trace, pullsExact, acceptedWorkWithin,
      acceptedBytesWithin⟩
    exact runProducerAux_pullLimitExceeded_of_trace maxWork
      maxExpandedBytes pull maxPulls 0 0 initial finalState accepted trace
      pullsExact (by simpa using acceptedWorkWithin)
      (by simpa using acceptedBytesWithin)

/-! ## Refinement by a finite list producer -/

def listChunkProducer :
    List DecompressionChunk → ProducerStep (List DecompressionChunk)
  | [] => .done
  | chunk :: remaining => .emit chunk remaining

def producerResultOfScan
    (chunks : List DecompressionChunk) :
    StreamScanResult → ProducerRunResult (List DecompressionChunk)
  | .within => .completed chunks [] (materializeChunks chunks)
  | .workLimitExceeded accepted rejected remaining =>
      .workLimitExceeded accepted rejected remaining
  | .expandedBudgetExceeded accepted rejected remaining =>
      .expandedBudgetExceeded accepted rejected remaining

theorem producerResultOfScan_prependAccepted
    (chunk : DecompressionChunk) (remaining : List DecompressionChunk)
    (result : StreamScanResult) :
    producerResultOfScan (chunk :: remaining)
        (result.prependAccepted chunk) =
      (producerResultOfScan remaining result).prependAccepted chunk := by
  cases result <;>
    simp [producerResultOfScan, StreamScanResult.prependAccepted,
      ProducerRunResult.prependAccepted, materializeChunks]

theorem runListProducerAux_eq_producerResultOfScan
    (maxWork maxExpandedBytes usedWork usedBytes : Nat)
    (chunks : List DecompressionChunk) :
    runProducerAux maxWork maxExpandedBytes listChunkProducer
        (chunks.length + 1) usedWork usedBytes chunks =
      producerResultOfScan chunks
        (scanDecompressionChunksAux maxWork maxExpandedBytes usedWork
          usedBytes chunks) := by
  induction chunks generalizing usedWork usedBytes with
  | nil =>
      simp [runProducerAux, listChunkProducer, scanDecompressionChunksAux,
        producerResultOfScan, materializeChunks]
  | cons chunk remaining inductionHypothesis =>
      by_cases workWithin : usedWork + chunk.work ≤ maxWork
      · by_cases bytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes
        · have recursive := inductionHypothesis
            (usedWork + chunk.work) (usedBytes + chunk.bytes)
          simp [runProducerAux, listChunkProducer,
            scanDecompressionChunksAux, workWithin, bytesWithin, recursive,
            producerResultOfScan_prependAccepted]
        · simp [runProducerAux, listChunkProducer,
            scanDecompressionChunksAux, workWithin, bytesWithin,
            producerResultOfScan]
      · simp [runProducerAux, listChunkProducer,
          scanDecompressionChunksAux, workWithin, producerResultOfScan]

theorem runListProducer_eq_producerResultOfScan
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) :
    runProducer (chunks.length + 1) maxWork maxExpandedBytes
        listChunkProducer chunks =
      producerResultOfScan chunks
        (scanDecompressionChunks maxWork maxExpandedBytes chunks) := by
  simpa [runProducer, scanDecompressionChunks] using
    runListProducerAux_eq_producerResultOfScan maxWork maxExpandedBytes 0 0
      chunks

@[simp] theorem producerResultOfScan_eq_completed_iff
    (chunks : List DecompressionChunk) (result : StreamScanResult) :
    producerResultOfScan chunks result =
        .completed chunks [] (materializeChunks chunks) ↔
      result = .within := by
  cases result <;> simp [producerResultOfScan]

theorem runListProducer_exactCompletion_iff
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) :
    runProducer (chunks.length + 1) maxWork maxExpandedBytes
        listChunkProducer chunks =
        .completed chunks [] (materializeChunks chunks) ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes := by
  rw [runListProducer_eq_producerResultOfScan,
    producerResultOfScan_eq_completed_iff,
    scanDecompressionChunks_eq_within_iff]

theorem runListProducer_completed_requires_length_succ_pulls
    (maxPulls maxWork maxExpandedBytes : Nat)
    (chunks accepted : List DecompressionChunk)
    (finalState : List DecompressionChunk) (raw : String)
    (completed : runProducer maxPulls maxWork maxExpandedBytes
      listChunkProducer chunks = .completed accepted finalState raw) :
    accepted.length + 1 ≤ maxPulls :=
  (runProducer_completed_trace maxPulls maxWork maxExpandedBytes
    listChunkProducer chunks finalState accepted raw completed).2.2

/-! ## Decoder and wire-checker composition -/

inductive ProducerEnvelopeCheckResult
    (State : Type u) (Result : Type v) where
  | pullLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | producerRejected
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | workLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (continuation : State)
  | expandedBudgetExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (continuation : State)
  | decodeRejected
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | checked
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
      (result : Result)

def checkProducerEnvelopeThen
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial : State) : ProducerEnvelopeCheckResult State Result :=
  match runProducer maxPulls maxWork maxExpandedBytes pull initial with
  | .pullLimitExceeded accepted continuation =>
      .pullLimitExceeded accepted continuation
  | .producerRejected accepted continuation =>
      .producerRejected accepted continuation
  | .workLimitExceeded accepted rejected continuation =>
      .workLimitExceeded accepted rejected continuation
  | .expandedBudgetExceeded accepted rejected continuation =>
      .expandedBudgetExceeded accepted rejected continuation
  | .completed accepted continuation raw =>
      match decode raw with
      | none => .decodeRejected accepted continuation
      | some artifact => .checked accepted continuation (check artifact)

theorem checkProducerEnvelopeThen_eq_checked_iff
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial finalState : State)
    (accepted : List DecompressionChunk) (result : Result) :
    checkProducerEnvelopeThen maxPulls maxWork maxExpandedBytes pull decode
        check initial = .checked accepted finalState result ↔
      ∃ raw artifact,
        runProducer maxPulls maxWork maxExpandedBytes pull initial =
          .completed accepted finalState raw ∧
        decode raw = some artifact ∧
        check artifact = result := by
  cases runEq : runProducer maxPulls maxWork maxExpandedBytes pull initial with
  | pullLimitExceeded runAccepted continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | producerRejected runAccepted continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | workLimitExceeded runAccepted rejected continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | expandedBudgetExceeded runAccepted rejected continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | completed runAccepted continuation raw =>
      cases decodedEq : decode raw with
      | none => simp [checkProducerEnvelopeThen, runEq, decodedEq]
      | some artifact =>
          simp [checkProducerEnvelopeThen, runEq, decodedEq, and_assoc]

theorem checkProducerEnvelopeThen_checked_mono
    {State : Type u} {Artifact : Type v} {Result : Type w}
    {pullsSmaller pullsLarger workSmaller workLarger
      bytesSmaller bytesLarger : Nat}
    (pullsLe : pullsSmaller ≤ pullsLarger)
    (workLe : workSmaller ≤ workLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial finalState : State)
    (accepted : List DecompressionChunk) (result : Result)
    (checked : checkProducerEnvelopeThen pullsSmaller workSmaller
      bytesSmaller pull decode check initial =
        .checked accepted finalState result) :
    checkProducerEnvelopeThen pullsLarger workLarger bytesLarger pull decode
      check initial = .checked accepted finalState result := by
  obtain ⟨raw, artifact, completed, decoded, checkedArtifact⟩ :=
    (checkProducerEnvelopeThen_eq_checked_iff pullsSmaller workSmaller
      bytesSmaller pull decode check initial finalState accepted result).mp
      checked
  apply (checkProducerEnvelopeThen_eq_checked_iff pullsLarger workLarger
    bytesLarger pull decode check initial finalState accepted result).mpr
  exact ⟨raw, artifact,
    runProducer_completed_mono pullsLe workLe bytesLe pull initial finalState
      accepted raw completed,
    decoded, checkedArtifact⟩

theorem checkProducerEnvelopeThen_eq_decodeRejected_iff
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial finalState : State)
    (accepted : List DecompressionChunk) :
    checkProducerEnvelopeThen maxPulls maxWork maxExpandedBytes pull decode
        check initial = .decodeRejected accepted finalState ↔
      ∃ raw,
        runProducer maxPulls maxWork maxExpandedBytes pull initial =
          .completed accepted finalState raw ∧
        decode raw = none := by
  cases runEq : runProducer maxPulls maxWork maxExpandedBytes pull initial with
  | pullLimitExceeded runAccepted continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | producerRejected runAccepted continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | workLimitExceeded runAccepted rejected continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | expandedBudgetExceeded runAccepted rejected continuation =>
      simp [checkProducerEnvelopeThen, runEq]
  | completed runAccepted continuation raw =>
      cases decodedEq : decode raw with
      | none => simp [checkProducerEnvelopeThen, runEq, decodedEq]
      | some artifact => simp [checkProducerEnvelopeThen, runEq, decodedEq]

noncomputable def checkProducerWireEnvelope
    {State : Type u} {Edit : Type v} [DecidableEq Edit]
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (initial : State) :
    ProducerEnvelopeCheckResult State (WireArtifactCheckResult Edit scale) :=
  checkProducerEnvelopeThen maxPulls maxWork maxExpandedBytes pull decode
    (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) initial

theorem checkProducerWireEnvelope_eq_checked_accepted_iff
    {State : Type u} {Edit : Type v} [DecidableEq Edit]
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (initial finalState : State)
    (accepted : List DecompressionChunk)
    (result : IntegerReliabilityReport Edit scale) :
    checkProducerWireEnvelope maxPulls maxWork maxExpandedBytes pull decode
        scale maxSteps maxScaleBytes maxUnitBytes maxTargetLength
        maxTotalTargetEdits editWeight maxSchemaWeight Independent encodedCost
        source actualMargin initial =
      .checked accepted finalState (.accepted result) ↔
    ∃ raw artifact,
      runProducer maxPulls maxWork maxExpandedBytes pull initial =
        .completed accepted finalState raw ∧
      decode raw = some artifact ∧
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths = .accepted result := by
  exact checkProducerEnvelopeThen_eq_checked_iff maxPulls maxWork
    maxExpandedBytes pull decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) initial finalState accepted (.accepted result)

theorem checkProducerWireEnvelope_target_eq_of_certified
    {State : Type u} {Edit : Type v} [DecidableEq Edit]
    (maxPulls maxWork maxExpandedBytes : Nat)
    (pull : State → ProducerStep State)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (exactCost approximateCost :
      List Edit → List Edit → Edit → Edit → ℝ)
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (initial finalState : State)
    (accepted : List DecompressionChunk)
    (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (checked : checkProducerWireEnvelope maxPulls maxWork maxExpandedBytes
      pull decode scale maxSteps maxScaleBytes maxUnitBytes maxTargetLength
      maxTotalTargetEdits editWeight maxSchemaWeight Independent encodedCost
      source actualMargin initial =
        .checked accepted finalState (.accepted result))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, artifact, _, _, wireAccepted⟩ :=
    (checkProducerWireEnvelope_eq_checked_accepted_iff maxPulls maxWork
      maxExpandedBytes pull decode scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin initial finalState accepted
      result).mp checked
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

theorem componentProducerWireEnvelope_exactBoundary_accepted :
    checkProducerWireEnvelope 2 1 9 listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentStreamChunks =
        .checked componentStreamChunks []
          (.accepted componentCanonicalIntegerReport) := by
  apply (checkProducerWireEnvelope_eq_checked_accepted_iff 2 1 9
    listChunkProducer componentWireEnvelopeDecoder milliScale 1 4 4 3 9
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentStreamChunks [] componentStreamChunks
    componentCanonicalIntegerReport).mpr
  exact ⟨componentWireEnvelope,
    ⟨componentWireReport, componentWirePaths⟩,
    by native_decide,
    by simp [componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentProducerWireEnvelope_pullLimitExceeded :
    checkProducerWireEnvelope 0 1 9 listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentStreamChunks =
        .pullLimitExceeded [] componentStreamChunks := by
  simp [checkProducerWireEnvelope, checkProducerEnvelopeThen, runProducer,
    runProducerAux]

theorem componentProducerWireEnvelope_workLimitExceeded :
    checkProducerWireEnvelope 2 0 9 listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentStreamChunks =
        .workLimitExceeded [] componentStreamChunk [] := by
  simp [checkProducerWireEnvelope, checkProducerEnvelopeThen, runProducer,
    runProducerAux, listChunkProducer, componentStreamChunks,
    componentStreamChunk]

theorem componentProducerWireEnvelope_expandedLimitExceeded :
    checkProducerWireEnvelope 2 1 8 listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentStreamChunks =
        .expandedBudgetExceeded [] componentStreamChunk [] := by
  simp [checkProducerWireEnvelope, checkProducerEnvelopeThen, runProducer,
    runProducerAux, listChunkProducer, componentStreamChunks,
    componentStreamChunk, DecompressionChunk.bytes,
    componentWireEnvelope_size]

theorem malformedProducerWireEnvelope_decodeRejected :
    checkProducerWireEnvelope 2 1 1 listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      malformedStreamChunks =
        .decodeRejected malformedStreamChunks [] := by
  apply (checkProducerEnvelopeThen_eq_decodeRejected_iff 2 1 1
    listChunkProducer componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) malformedStreamChunks []
    malformedStreamChunks).mpr
  exact ⟨"x", by native_decide,
    by simp [componentWireEnvelopeDecoder, componentWireEnvelope]⟩

def rejectingProducer (_ : Unit) : ProducerStep Unit := .rejected

theorem rejectingProducerWireEnvelope_producerRejected :
    checkProducerWireEnvelope 1 1 9 rejectingProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1 () =
        .producerRejected [] () := by
  simp [checkProducerWireEnvelope, checkProducerEnvelopeThen, runProducer,
    runProducerAux, rejectingProducer]

end Sprawlens.FixedPointStreamingProducer
