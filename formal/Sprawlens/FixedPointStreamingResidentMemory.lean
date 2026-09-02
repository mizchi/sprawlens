import Sprawlens.FixedPointCompressedStreamingProducer

namespace Sprawlens.FixedPointStreamingResidentMemory

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointRawEnvelopeBoundary
open FixedPointStreamingDecompression
open FixedPointStreamingProducer
open FixedPointWireArtifact
open FixedPointWireDiagnostic
open FixedPointWirePayloadBudget
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u v w

/-- A budget-aware producer receives the remaining resident-memory allowance
before it may emit a new continuation. `memoryRefused` is semantically prior to
an emission; a concrete library must refine that ordering. -/
inductive BudgetedProducerStep (State : Type u) where
  | done
  | rejected
  | memoryRefused
  | emit (chunk : DecompressionChunk) (continuation : State)
deriving DecidableEq, Repr

/-- The transition contract counts the current producer state, the emitted
payload, the next producer state, and caller-specified temporary overhead.
Already retained output bytes are removed from `allowance` by the runner. -/
def HonorsResidentBudget
    {State : Type u}
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State) : Prop :=
  ∀ allowance state chunk continuation,
    pull allowance state = .emit chunk continuation →
      stateWeight state + chunk.bytes + stateWeight continuation +
          temporaryWeight chunk ≤ allowance

/-- Raising an allowance must preserve every non-memory-refusal observation.
Without this independent contract, memory-policy monotonicity is false even
when every emitted transition honors its stated allowance. -/
def StableUnderLargerAllowance
    {State : Type u}
    (pull : Nat → State → BudgetedProducerStep State) : Prop :=
  ∀ smaller larger state step,
    smaller ≤ larger →
    pull smaller state = step →
    step ≠ .memoryRefused →
    pull larger state = step

inductive ResidentProducerRunResult (State : Type u) where
  | initialMemoryLimitExceeded (initial : State)
  | pullLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | producerRejected
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | memoryRefused
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

def ResidentProducerRunResult.acceptedChunks
    {State : Type u} :
    ResidentProducerRunResult State → List DecompressionChunk
  | .initialMemoryLimitExceeded _ => []
  | .pullLimitExceeded accepted _ => accepted
  | .producerRejected accepted _ => accepted
  | .memoryRefused accepted _ => accepted
  | .workLimitExceeded accepted _ _ => accepted
  | .expandedBudgetExceeded accepted _ _ => accepted
  | .completed accepted _ _ => accepted

def ResidentProducerRunResult.prependAccepted
    {State : Type u} (chunk : DecompressionChunk) :
    ResidentProducerRunResult State → ResidentProducerRunResult State
  | .initialMemoryLimitExceeded initial => .initialMemoryLimitExceeded initial
  | .pullLimitExceeded accepted continuation =>
      .pullLimitExceeded (chunk :: accepted) continuation
  | .producerRejected accepted continuation =>
      .producerRejected (chunk :: accepted) continuation
  | .memoryRefused accepted continuation =>
      .memoryRefused (chunk :: accepted) continuation
  | .workLimitExceeded accepted rejected continuation =>
      .workLimitExceeded (chunk :: accepted) rejected continuation
  | .expandedBudgetExceeded accepted rejected continuation =>
      .expandedBudgetExceeded (chunk :: accepted) rejected continuation
  | .completed accepted continuation raw =>
      .completed (chunk :: accepted) continuation (chunk.payload ++ raw)

def ResidentProducerRunResult.residentSound
    {State : Type u}
    (maxMemory usedBytes : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat) :
    ResidentProducerRunResult State → Prop
  | .initialMemoryLimitExceeded _ => True
  | .pullLimitExceeded accepted continuation =>
      usedBytes + totalChunkBytes accepted + stateWeight continuation ≤
        maxMemory
  | .producerRejected accepted continuation =>
      usedBytes + totalChunkBytes accepted + stateWeight continuation ≤
        maxMemory
  | .memoryRefused accepted continuation =>
      usedBytes + totalChunkBytes accepted + stateWeight continuation ≤
        maxMemory
  | .workLimitExceeded accepted rejected continuation =>
      usedBytes + totalChunkBytes accepted + rejected.bytes +
          stateWeight continuation + temporaryWeight rejected ≤ maxMemory
  | .expandedBudgetExceeded accepted rejected continuation =>
      usedBytes + totalChunkBytes accepted + rejected.bytes +
          stateWeight continuation + temporaryWeight rejected ≤ maxMemory
  | .completed accepted continuation _ =>
      usedBytes + totalChunkBytes accepted + stateWeight continuation ≤
        maxMemory

def ResidentProducerRunResult.rawMatchesAccepted
    {State : Type u} : ResidentProducerRunResult State → Prop
  | .completed accepted _ raw => raw = materializeChunks accepted
  | _ => True

def ResidentProducerRunResult.pullBudgetSound
    {State : Type u} (maxPulls : Nat) :
    ResidentProducerRunResult State → Prop
  | .initialMemoryLimitExceeded _ => True
  | .pullLimitExceeded accepted _ => accepted.length = maxPulls
  | .producerRejected accepted _ => accepted.length + 1 ≤ maxPulls
  | .memoryRefused accepted _ => accepted.length + 1 ≤ maxPulls
  | .workLimitExceeded accepted _ _ => accepted.length + 1 ≤ maxPulls
  | .expandedBudgetExceeded accepted _ _ => accepted.length + 1 ≤ maxPulls
  | .completed accepted _ _ => accepted.length + 1 ≤ maxPulls

def runResidentProducerAux
    {State : Type u}
    (maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State) :
    Nat → Nat → Nat → State → ResidentProducerRunResult State
  | 0, _, _, state => .pullLimitExceeded [] state
  | pullsLeft + 1, usedWork, usedBytes, state =>
      match pull (maxMemory - usedBytes) state with
      | .done => .completed [] state ""
      | .rejected => .producerRejected [] state
      | .memoryRefused => .memoryRefused [] state
      | .emit chunk continuation =>
          if _workWithin : usedWork + chunk.work ≤ maxWork then
            if _bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes then
              (runResidentProducerAux maxWork maxExpandedBytes maxMemory
                stateWeight temporaryWeight pull pullsLeft
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                continuation).prependAccepted chunk
            else .expandedBudgetExceeded [] chunk continuation
          else .workLimitExceeded [] chunk continuation

def runResidentProducer
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (initial : State) : ResidentProducerRunResult State :=
  if _initialWithin : stateWeight initial ≤ maxMemory then
    runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
      temporaryWeight pull maxPulls 0 0 initial
  else .initialMemoryLimitExceeded initial

theorem runResidentProducerAux_acceptedChunks_within
    {State : Type u}
    (maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State)
    (usedWorkWithin : usedWork ≤ maxWork)
    (usedBytesWithin : usedBytes ≤ maxExpandedBytes) :
    let result := runResidentProducerAux maxWork maxExpandedBytes maxMemory
      stateWeight temporaryWeight pull pullsLeft usedWork usedBytes state
    usedWork + totalChunkWork result.acceptedChunks ≤ maxWork ∧
      usedBytes + totalChunkBytes result.acceptedChunks ≤ maxExpandedBytes := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simp [runResidentProducerAux,
        ResidentProducerRunResult.acceptedChunks, totalChunkWork,
        totalChunkBytes, usedWorkWithin, usedBytesWithin]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull (maxMemory - usedBytes) state with
      | done =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.acceptedChunks, totalChunkWork,
            totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | rejected =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.acceptedChunks, totalChunkWork,
            totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | memoryRefused =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.acceptedChunks, totalChunkWork,
            totalChunkBytes, usedWorkWithin, usedBytesWithin]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                continuation workWithin bytesWithin
              cases recursiveEq : runResidentProducerAux maxWork
                  maxExpandedBytes maxMemory stateWeight temporaryWeight pull
                  pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation <;>
                simp [runResidentProducerAux, pulledEq, workWithin,
                  bytesWithin, recursiveEq,
                  ResidentProducerRunResult.prependAccepted,
                  ResidentProducerRunResult.acceptedChunks, totalChunkWork,
                  totalChunkBytes] at recursive ⊢ <;>
                omega
            · simp [runResidentProducerAux, pulledEq, workWithin,
                bytesWithin, ResidentProducerRunResult.acceptedChunks,
                totalChunkWork, totalChunkBytes, usedWorkWithin,
                usedBytesWithin]
          · simp [runResidentProducerAux, pulledEq, workWithin,
              ResidentProducerRunResult.acceptedChunks, totalChunkWork,
              totalChunkBytes, usedWorkWithin, usedBytesWithin]

theorem runResidentProducerAux_pullBudgetSound
    {State : Type u}
    (maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State) :
    (runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
      temporaryWeight pull pullsLeft usedWork usedBytes state).pullBudgetSound
        pullsLeft := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simp [runResidentProducerAux,
        ResidentProducerRunResult.pullBudgetSound]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull (maxMemory - usedBytes) state with
      | done =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.pullBudgetSound]
      | rejected =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.pullBudgetSound]
      | memoryRefused =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.pullBudgetSound]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes) continuation
              cases recursiveEq : runResidentProducerAux maxWork
                  maxExpandedBytes maxMemory stateWeight temporaryWeight pull
                  pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation <;>
                simp [runResidentProducerAux, pulledEq, workWithin,
                  bytesWithin, recursiveEq,
                  ResidentProducerRunResult.prependAccepted,
                  ResidentProducerRunResult.pullBudgetSound]
                  at recursive ⊢ <;>
                omega
            · simp [runResidentProducerAux, pulledEq, workWithin,
                bytesWithin, ResidentProducerRunResult.pullBudgetSound]
          · simp [runResidentProducerAux, pulledEq, workWithin,
              ResidentProducerRunResult.pullBudgetSound]

theorem runResidentProducer_completed_resource_sound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (initial finalState : State) (accepted : List DecompressionChunk)
    (raw : String)
    (completed : runResidentProducer maxPulls maxWork maxExpandedBytes
      maxMemory stateWeight temporaryWeight pull initial =
        .completed accepted finalState raw) :
    totalChunkWork accepted ≤ maxWork ∧
      totalChunkBytes accepted ≤ maxExpandedBytes := by
  by_cases initialWithin : stateWeight initial ≤ maxMemory
  · have completedAux :
        runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
            temporaryWeight pull maxPulls 0 0 initial =
          .completed accepted finalState raw := by
      simpa [runResidentProducer, initialWithin] using completed
    have resources := runResidentProducerAux_acceptedChunks_within maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull maxPulls
      0 0 initial (Nat.zero_le _) (Nat.zero_le _)
    rw [completedAux] at resources
    simpa [ResidentProducerRunResult.acceptedChunks] using resources
  · simp [runResidentProducer, initialWithin] at completed

theorem runResidentProducer_completed_pull_bound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (initial finalState : State) (accepted : List DecompressionChunk)
    (raw : String)
    (completed : runResidentProducer maxPulls maxWork maxExpandedBytes
      maxMemory stateWeight temporaryWeight pull initial =
        .completed accepted finalState raw) :
    accepted.length + 1 ≤ maxPulls := by
  by_cases initialWithin : stateWeight initial ≤ maxMemory
  · have completedAux :
        runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
            temporaryWeight pull maxPulls 0 0 initial =
          .completed accepted finalState raw := by
      simpa [runResidentProducer, initialWithin] using completed
    have budget := runResidentProducerAux_pullBudgetSound maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull maxPulls
      0 0 initial
    rw [completedAux] at budget
    simpa [ResidentProducerRunResult.pullBudgetSound] using budget
  · simp [runResidentProducer, initialWithin] at completed

theorem honoredEmission_peak_within
    {State : Type u}
    (maxMemory usedBytes : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (honors : HonorsResidentBudget stateWeight temporaryWeight pull)
    (state continuation : State) (chunk : DecompressionChunk)
    (currentWithin : usedBytes + stateWeight state ≤ maxMemory)
    (emitted : pull (maxMemory - usedBytes) state =
      .emit chunk continuation) :
    usedBytes + stateWeight state + chunk.bytes + stateWeight continuation +
        temporaryWeight chunk ≤ maxMemory := by
  have withinAllowance := honors (maxMemory - usedBytes) state chunk
    continuation emitted
  have usedWithin : usedBytes ≤ maxMemory := by omega
  omega

theorem runResidentProducerAux_residentSound
    {State : Type u}
    (maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (honors : HonorsResidentBudget stateWeight temporaryWeight pull)
    (pullsLeft usedWork usedBytes : Nat) (state : State)
    (currentWithin : usedBytes + stateWeight state ≤ maxMemory) :
    (runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
      temporaryWeight pull pullsLeft usedWork usedBytes state).residentSound
        maxMemory usedBytes stateWeight temporaryWeight := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simpa [runResidentProducerAux,
        ResidentProducerRunResult.residentSound, totalChunkBytes] using
        currentWithin
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull (maxMemory - usedBytes) state with
      | done =>
          simpa [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.residentSound, totalChunkBytes] using
            currentWithin
      | rejected =>
          simpa [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.residentSound, totalChunkBytes] using
            currentWithin
      | memoryRefused =>
          simpa [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.residentSound, totalChunkBytes] using
            currentWithin
      | emit chunk continuation =>
          have transitionWithin :
              usedBytes + stateWeight state + chunk.bytes +
                  stateWeight continuation + temporaryWeight chunk ≤
                maxMemory := by
            exact honoredEmission_peak_within maxMemory usedBytes stateWeight
              temporaryWeight pull honors state continuation chunk
              currentWithin pulledEq
          have continuationWithin :
              usedBytes + chunk.bytes + stateWeight continuation ≤
                maxMemory := by
            omega
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis (usedWork + chunk.work)
                (usedBytes + chunk.bytes) continuation continuationWithin
              cases recursiveEq : runResidentProducerAux maxWork
                  maxExpandedBytes maxMemory stateWeight temporaryWeight pull
                  pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation <;>
                simp [runResidentProducerAux, pulledEq, workWithin,
                  bytesWithin, recursiveEq,
                  ResidentProducerRunResult.prependAccepted,
                  ResidentProducerRunResult.residentSound, totalChunkBytes]
                  at recursive ⊢ <;>
                omega
            · simp [runResidentProducerAux, pulledEq, workWithin,
                bytesWithin, ResidentProducerRunResult.residentSound,
                totalChunkBytes]
              omega
          · simp [runResidentProducerAux, pulledEq, workWithin,
              ResidentProducerRunResult.residentSound, totalChunkBytes]
            omega

theorem runResidentProducerAux_rawMatchesAccepted
    {State : Type u}
    (maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (pullsLeft usedWork usedBytes : Nat) (state : State) :
    (runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
      temporaryWeight pull pullsLeft usedWork usedBytes state).rawMatchesAccepted := by
  induction pullsLeft generalizing usedWork usedBytes state with
  | zero =>
      simp [runResidentProducerAux,
        ResidentProducerRunResult.rawMatchesAccepted]
  | succ pullsLeft inductionHypothesis =>
      cases pulledEq : pull (maxMemory - usedBytes) state with
      | done =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.rawMatchesAccepted, materializeChunks]
      | rejected =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.rawMatchesAccepted]
      | memoryRefused =>
          simp [runResidentProducerAux, pulledEq,
            ResidentProducerRunResult.rawMatchesAccepted]
      | emit chunk continuation =>
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · have recursive := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes) continuation
              cases recursiveEq : runResidentProducerAux maxWork
                  maxExpandedBytes maxMemory stateWeight temporaryWeight pull
                  pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation <;>
                simp [runResidentProducerAux, pulledEq, workWithin,
                  bytesWithin, recursiveEq,
                  ResidentProducerRunResult.prependAccepted,
                  ResidentProducerRunResult.rawMatchesAccepted,
                  materializeChunks] at recursive ⊢
              exact recursive
            · simp [runResidentProducerAux, pulledEq, workWithin,
                bytesWithin, ResidentProducerRunResult.rawMatchesAccepted]
          · simp [runResidentProducerAux, pulledEq, workWithin,
              ResidentProducerRunResult.rawMatchesAccepted]

theorem runResidentProducer_completed_memory_sound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (honors : HonorsResidentBudget stateWeight temporaryWeight pull)
    (initial finalState : State) (accepted : List DecompressionChunk)
    (raw : String)
    (completed : runResidentProducer maxPulls maxWork maxExpandedBytes
      maxMemory stateWeight temporaryWeight pull initial =
        .completed accepted finalState raw) :
    raw = materializeChunks accepted ∧
      raw.utf8ByteSize + stateWeight finalState ≤ maxMemory := by
  by_cases initialWithin : stateWeight initial ≤ maxMemory
  · have completedAux :
        runResidentProducerAux maxWork maxExpandedBytes maxMemory stateWeight
            temporaryWeight pull maxPulls 0 0 initial =
          .completed accepted finalState raw := by
      simpa [runResidentProducer, initialWithin] using completed
    have resident := runResidentProducerAux_residentSound maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull honors
      maxPulls 0 0 initial (by simpa using initialWithin)
    have rawMatches := runResidentProducerAux_rawMatchesAccepted maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull maxPulls
      0 0 initial
    rw [completedAux] at resident rawMatches
    have rawEq : raw = materializeChunks accepted := by
      simpa [ResidentProducerRunResult.rawMatchesAccepted] using rawMatches
    have memoryInfo :
        totalChunkBytes accepted + stateWeight finalState ≤ maxMemory := by
      simpa [ResidentProducerRunResult.residentSound] using resident
    exact ⟨rawEq, by
      rw [rawEq, materializeChunks_utf8ByteSize]
      exact memoryInfo⟩
  · simp [runResidentProducer, initialWithin] at completed

theorem runResidentProducerAux_completed_mono_memory
    {State : Type u}
    (maxWork maxExpandedBytes : Nat)
    {memorySmaller memoryLarger : Nat}
    (memoryLe : memorySmaller ≤ memoryLarger)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (stable : StableUnderLargerAllowance pull)
    (pullsLeft usedWork usedBytes : Nat) (state finalState : State)
    (accepted : List DecompressionChunk) (raw : String)
    (completed : runResidentProducerAux maxWork maxExpandedBytes
      memorySmaller stateWeight temporaryWeight pull pullsLeft usedWork
      usedBytes state = .completed accepted finalState raw) :
    runResidentProducerAux maxWork maxExpandedBytes memoryLarger stateWeight
      temporaryWeight pull pullsLeft usedWork usedBytes state =
        .completed accepted finalState raw := by
  induction pullsLeft generalizing usedWork usedBytes state accepted finalState
      raw with
  | zero => simp [runResidentProducerAux] at completed
  | succ pullsLeft inductionHypothesis =>
      cases pulledSmallerEq : pull (memorySmaller - usedBytes) state with
      | done =>
          have allowanceLe :
              memorySmaller - usedBytes ≤ memoryLarger - usedBytes := by
            omega
          have pulledLargerEq := stable (memorySmaller - usedBytes)
            (memoryLarger - usedBytes) state .done allowanceLe
            pulledSmallerEq (by simp)
          simp [runResidentProducerAux, pulledSmallerEq] at completed
          rcases completed with ⟨rfl, rfl, rfl⟩
          simp [runResidentProducerAux, pulledLargerEq]
      | rejected =>
          simp [runResidentProducerAux, pulledSmallerEq] at completed
      | memoryRefused =>
          simp [runResidentProducerAux, pulledSmallerEq] at completed
      | emit chunk continuation =>
          have allowanceLe :
              memorySmaller - usedBytes ≤ memoryLarger - usedBytes := by
            omega
          have pulledLargerEq := stable (memorySmaller - usedBytes)
            (memoryLarger - usedBytes) state (.emit chunk continuation)
            allowanceLe pulledSmallerEq (by simp)
          by_cases workWithin : usedWork + chunk.work ≤ maxWork
          · by_cases bytesWithin :
                usedBytes + chunk.bytes ≤ maxExpandedBytes
            · cases recursiveEq : runResidentProducerAux maxWork
                  maxExpandedBytes memorySmaller stateWeight temporaryWeight
                  pull pullsLeft (usedWork + chunk.work)
                  (usedBytes + chunk.bytes) continuation with
              | initialMemoryLimitExceeded initial =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
              | pullLimitExceeded innerAccepted innerContinuation =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
              | producerRejected innerAccepted innerContinuation =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
              | memoryRefused innerAccepted innerContinuation =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
              | workLimitExceeded innerAccepted rejected innerContinuation =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
              | expandedBudgetExceeded innerAccepted rejected innerContinuation =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
              | completed innerAccepted innerFinal innerRaw =>
                  simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                    bytesWithin, recursiveEq,
                    ResidentProducerRunResult.prependAccepted] at completed
                  rcases completed with ⟨rfl, rfl, rfl⟩
                  have recursiveLarger := inductionHypothesis
                    (usedWork + chunk.work) (usedBytes + chunk.bytes)
                    continuation innerFinal innerAccepted innerRaw recursiveEq
                  simp [runResidentProducerAux, pulledLargerEq, workWithin,
                    bytesWithin, recursiveLarger,
                    ResidentProducerRunResult.prependAccepted]
            · simp [runResidentProducerAux, pulledSmallerEq, workWithin,
                bytesWithin] at completed
          · simp [runResidentProducerAux, pulledSmallerEq, workWithin] at completed

theorem runResidentProducer_completed_mono_memory
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes : Nat)
    {memorySmaller memoryLarger : Nat}
    (memoryLe : memorySmaller ≤ memoryLarger)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (stable : StableUnderLargerAllowance pull)
    (initial finalState : State) (accepted : List DecompressionChunk)
    (raw : String)
    (completed : runResidentProducer maxPulls maxWork maxExpandedBytes
      memorySmaller stateWeight temporaryWeight pull initial =
        .completed accepted finalState raw) :
    runResidentProducer maxPulls maxWork maxExpandedBytes memoryLarger
      stateWeight temporaryWeight pull initial =
        .completed accepted finalState raw := by
  by_cases initialWithin : stateWeight initial ≤ memorySmaller
  · have initialWithinLarger := initialWithin.trans memoryLe
    have completedAux :
        runResidentProducerAux maxWork maxExpandedBytes memorySmaller
            stateWeight temporaryWeight pull maxPulls 0 0 initial =
          .completed accepted finalState raw := by
      simpa [runResidentProducer, initialWithin] using completed
    simp only [runResidentProducer, dif_pos initialWithinLarger]
    exact runResidentProducerAux_completed_mono_memory maxWork
      maxExpandedBytes memoryLe stateWeight temporaryWeight pull stable
      maxPulls 0 0 initial finalState accepted raw completedAux
  · simp [runResidentProducer, initialWithin] at completed

def hugeStateWeight (state : Bool) : Nat :=
  if state then 100 else 0

def zeroTemporaryWeight (_ : DecompressionChunk) : Nat := 0

def zeroStateWeight {State : Type u} (_ : State) : Nat := 0

def hugeStateUnbudgetedProducer (_ : Bool) : ProducerStep Bool := .done

theorem emptyExpandedOutput_does_not_bound_residentState :
    runProducer 1 0 0 hugeStateUnbudgetedProducer true =
        .completed [] true "" ∧
      "".utf8ByteSize = 0 ∧ hugeStateWeight true = 100 := by
  native_decide

def hugeStateBudgetedProducer
    (_allowance : Nat) (_state : Bool) : BudgetedProducerStep Bool := .done

theorem hugeStateBudgetedProducer_honors :
    HonorsResidentBudget hugeStateWeight zeroTemporaryWeight
      hugeStateBudgetedProducer := by
  intro allowance state chunk continuation impossible
  simp [hugeStateBudgetedProducer] at impossible

theorem hugeInitialState_rejected_before_firstPull :
    runResidentProducer 1 0 0 0 hugeStateWeight zeroTemporaryWeight
      hugeStateBudgetedProducer true = .initialMemoryLimitExceeded true := by
  native_decide

theorem zeroInitialState_exactBoundary_completed :
    runResidentProducer 1 0 0 0 hugeStateWeight zeroTemporaryWeight
      hugeStateBudgetedProducer false = .completed [] false "" := by
  native_decide

def nonmonotoneAllowanceProducer
    (allowance : Nat) (_state : Unit) : BudgetedProducerStep Unit :=
  if allowance = 1 then .done else .memoryRefused

theorem nonmonotoneAllowanceProducer_honors :
    HonorsResidentBudget (zeroStateWeight : Unit → Nat)
      zeroTemporaryWeight nonmonotoneAllowanceProducer := by
  intro allowance state chunk continuation emitted
  by_cases exactAllowance : allowance = 1 <;>
    simp [nonmonotoneAllowanceProducer, exactAllowance] at emitted

theorem largerMemory_can_lose_completion_without_allowance_stability :
    runResidentProducer 1 0 0 1 zeroStateWeight zeroTemporaryWeight
        nonmonotoneAllowanceProducer () = .completed [] () "" ∧
      runResidentProducer 1 0 0 2 zeroStateWeight zeroTemporaryWeight
        nonmonotoneAllowanceProducer () = .memoryRefused [] () := by
  native_decide

/-! ## Decoder and wire-checker composition -/

inductive ResidentProducerEnvelopeResult
    (State : Type u) (Result : Type v) where
  | initialMemoryLimitExceeded (initial : State)
  | pullLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | producerRejected
      (acceptedPrefix : List DecompressionChunk)
      (continuation : State)
  | memoryRefused
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

def checkResidentProducerEnvelopeThen
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial : State) : ResidentProducerEnvelopeResult State Result :=
  match runResidentProducer maxPulls maxWork maxExpandedBytes maxMemory
      stateWeight temporaryWeight pull initial with
  | .initialMemoryLimitExceeded state => .initialMemoryLimitExceeded state
  | .pullLimitExceeded accepted continuation =>
      .pullLimitExceeded accepted continuation
  | .producerRejected accepted continuation =>
      .producerRejected accepted continuation
  | .memoryRefused accepted continuation =>
      .memoryRefused accepted continuation
  | .workLimitExceeded accepted rejected continuation =>
      .workLimitExceeded accepted rejected continuation
  | .expandedBudgetExceeded accepted rejected continuation =>
      .expandedBudgetExceeded accepted rejected continuation
  | .completed accepted continuation raw =>
      match decode raw with
      | none => .decodeRejected accepted continuation
      | some artifact => .checked accepted continuation (check artifact)

theorem checkResidentProducerEnvelopeThen_eq_checked_iff
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial finalState : State)
    (accepted : List DecompressionChunk) (result : Result) :
    checkResidentProducerEnvelopeThen maxPulls maxWork maxExpandedBytes
        maxMemory stateWeight temporaryWeight pull decode check initial =
        .checked accepted finalState result ↔
      ∃ raw artifact,
        runResidentProducer maxPulls maxWork maxExpandedBytes maxMemory
            stateWeight temporaryWeight pull initial =
          .completed accepted finalState raw ∧
        decode raw = some artifact ∧
        check artifact = result := by
  cases runEq : runResidentProducer maxPulls maxWork maxExpandedBytes
      maxMemory stateWeight temporaryWeight pull initial with
  | initialMemoryLimitExceeded state =>
      simp [checkResidentProducerEnvelopeThen, runEq]
  | pullLimitExceeded runAccepted continuation =>
      simp [checkResidentProducerEnvelopeThen, runEq]
  | producerRejected runAccepted continuation =>
      simp [checkResidentProducerEnvelopeThen, runEq]
  | memoryRefused runAccepted continuation =>
      simp [checkResidentProducerEnvelopeThen, runEq]
  | workLimitExceeded runAccepted rejected continuation =>
      simp [checkResidentProducerEnvelopeThen, runEq]
  | expandedBudgetExceeded runAccepted rejected continuation =>
      simp [checkResidentProducerEnvelopeThen, runEq]
  | completed runAccepted continuation raw =>
      cases decodedEq : decode raw with
      | none =>
          simp [checkResidentProducerEnvelopeThen, runEq, decodedEq]
      | some artifact =>
          simp [checkResidentProducerEnvelopeThen, runEq, decodedEq,
            and_assoc]

theorem checkResidentProducerEnvelopeThen_checked_mono_memory
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes : Nat)
    {memorySmaller memoryLarger : Nat}
    (memoryLe : memorySmaller ≤ memoryLarger)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (stable : StableUnderLargerAllowance pull)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial finalState : State)
    (accepted : List DecompressionChunk) (result : Result)
    (checked : checkResidentProducerEnvelopeThen maxPulls maxWork
      maxExpandedBytes memorySmaller stateWeight temporaryWeight pull decode
      check initial = .checked accepted finalState result) :
    checkResidentProducerEnvelopeThen maxPulls maxWork maxExpandedBytes
      memoryLarger stateWeight temporaryWeight pull decode check initial =
        .checked accepted finalState result := by
  obtain ⟨raw, artifact, completed, decoded, checkedArtifact⟩ :=
    (checkResidentProducerEnvelopeThen_eq_checked_iff maxPulls maxWork
      maxExpandedBytes memorySmaller stateWeight temporaryWeight pull decode
      check initial finalState accepted result).mp checked
  apply (checkResidentProducerEnvelopeThen_eq_checked_iff maxPulls maxWork
    maxExpandedBytes memoryLarger stateWeight temporaryWeight pull decode
    check initial finalState accepted result).mpr
  exact ⟨raw, artifact,
    runResidentProducer_completed_mono_memory maxPulls maxWork
      maxExpandedBytes memoryLe stateWeight temporaryWeight pull stable initial
      finalState accepted raw completed,
    decoded, checkedArtifact⟩

theorem checkResidentProducerEnvelopeThen_checked_memory_sound
    {State : Type u} {Artifact : Type v} {Result : Type w}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (honors : HonorsResidentBudget stateWeight temporaryWeight pull)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (initial finalState : State)
    (accepted : List DecompressionChunk) (result : Result)
    (checked : checkResidentProducerEnvelopeThen maxPulls maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull decode check
      initial = .checked accepted finalState result) :
    ∃ raw,
      raw = materializeChunks accepted ∧
      raw.utf8ByteSize + stateWeight finalState ≤ maxMemory := by
  obtain ⟨raw, artifact, completed, _, _⟩ :=
    (checkResidentProducerEnvelopeThen_eq_checked_iff maxPulls maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull decode check
      initial finalState accepted result).mp checked
  exact ⟨raw, runResidentProducer_completed_memory_sound maxPulls maxWork
    maxExpandedBytes maxMemory stateWeight temporaryWeight pull honors initial
    finalState accepted raw completed⟩

noncomputable def checkResidentProducerWireEnvelope
    {State : Type u} {Edit : Type v} [DecidableEq Edit]
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
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
    ResidentProducerEnvelopeResult State (WireArtifactCheckResult Edit scale) :=
  checkResidentProducerEnvelopeThen maxPulls maxWork maxExpandedBytes
    maxMemory stateWeight temporaryWeight pull decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) initial

theorem checkResidentProducerWireEnvelope_eq_checked_accepted_iff
    {State : Type u} {Edit : Type v} [DecidableEq Edit]
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
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
    checkResidentProducerWireEnvelope maxPulls maxWork maxExpandedBytes
        maxMemory stateWeight temporaryWeight pull decode scale maxSteps
        maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
        editWeight maxSchemaWeight Independent encodedCost source actualMargin
        initial = .checked accepted finalState (.accepted result) ↔
      ∃ raw artifact,
        runResidentProducer maxPulls maxWork maxExpandedBytes maxMemory
            stateWeight temporaryWeight pull initial =
          .completed accepted finalState raw ∧
        decode raw = some artifact ∧
        checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
          maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
          Independent encodedCost source actualMargin artifact.report
          artifact.paths = .accepted result := by
  exact checkResidentProducerEnvelopeThen_eq_checked_iff maxPulls maxWork
    maxExpandedBytes maxMemory stateWeight temporaryWeight pull decode
    (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) initial finalState accepted (.accepted result)

theorem checkResidentProducerWireEnvelope_target_eq_of_certified
    {State : Type u} {Edit : Type v} [DecidableEq Edit]
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
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
    (checked : checkResidentProducerWireEnvelope maxPulls maxWork
      maxExpandedBytes maxMemory stateWeight temporaryWeight pull decode scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      initial = .checked accepted finalState (.accepted result))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, artifact, _, _, wireAccepted⟩ :=
    (checkResidentProducerWireEnvelope_eq_checked_accepted_iff maxPulls
      maxWork maxExpandedBytes maxMemory stateWeight temporaryWeight pull
      decode scale maxSteps maxScaleBytes maxUnitBytes maxTargetLength
      maxTotalTargetEdits editWeight maxSchemaWeight Independent encodedCost
      source actualMargin initial finalState accepted result).mp checked
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

def budgetedListProducer
    (allowance : Nat) :
    List DecompressionChunk → BudgetedProducerStep (List DecompressionChunk)
  | [] => .done
  | chunk :: remaining =>
      if chunk.bytes ≤ allowance then .emit chunk remaining
      else .memoryRefused

theorem budgetedListProducer_honors :
    HonorsResidentBudget
      (zeroStateWeight : List DecompressionChunk → Nat)
      zeroTemporaryWeight budgetedListProducer := by
  intro allowance state chunk continuation emitted
  cases state with
  | nil => simp [budgetedListProducer] at emitted
  | cons head remaining =>
      by_cases within : head.bytes ≤ allowance
      · simp [budgetedListProducer, within] at emitted
        rcases emitted with ⟨rfl, rfl⟩
        simpa [zeroStateWeight, zeroTemporaryWeight] using within
      · simp [budgetedListProducer, within] at emitted

theorem budgetedListProducer_stableUnderLargerAllowance :
    StableUnderLargerAllowance budgetedListProducer := by
  intro smaller larger state step allowanceLe observed notRefused
  cases state with
  | nil =>
      simpa [budgetedListProducer] using observed
  | cons chunk remaining =>
      by_cases withinSmaller : chunk.bytes ≤ smaller
      · have withinLarger := withinSmaller.trans allowanceLe
        simpa [budgetedListProducer, withinSmaller, withinLarger] using observed
      · have refused : step = .memoryRefused := by
          simpa [budgetedListProducer, withinSmaller] using observed.symm
        exact (notRefused refused).elim

theorem componentResidentProducerWire_exactMemoryBoundary_accepted :
    checkResidentProducerWireEnvelope 2 1 9 9 zeroStateWeight
      zeroTemporaryWeight budgetedListProducer componentWireEnvelopeDecoder
      milliScale 1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .checked componentStreamChunks []
          (.accepted componentCanonicalIntegerReport) := by
  apply (checkResidentProducerWireEnvelope_eq_checked_accepted_iff 2 1 9 9
    zeroStateWeight zeroTemporaryWeight budgetedListProducer
    componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentStreamChunks [] componentStreamChunks
    componentCanonicalIntegerReport).mpr
  exact ⟨componentWireEnvelope,
    ⟨componentWireReport, componentWirePaths⟩,
    by native_decide,
    by simp [componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentResidentProducerWire_memoryRefused :
    checkResidentProducerWireEnvelope 2 1 9 8 zeroStateWeight
      zeroTemporaryWeight budgetedListProducer componentWireEnvelopeDecoder
      milliScale 1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .memoryRefused [] componentStreamChunks := by
  simp [checkResidentProducerWireEnvelope,
    checkResidentProducerEnvelopeThen, runResidentProducer,
    runResidentProducerAux, budgetedListProducer, componentStreamChunks,
    componentStreamChunk, DecompressionChunk.bytes, componentWireEnvelope_size,
    zeroStateWeight]

theorem componentResidentProducerWire_accepted_under_relaxedMemory :
    checkResidentProducerWireEnvelope 2 1 9 10 zeroStateWeight
      zeroTemporaryWeight budgetedListProducer componentWireEnvelopeDecoder
      milliScale 1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .checked componentStreamChunks []
          (.accepted componentCanonicalIntegerReport) := by
  exact checkResidentProducerEnvelopeThen_checked_mono_memory 2 1 9
    (by omega) zeroStateWeight zeroTemporaryWeight budgetedListProducer
    budgetedListProducer_stableUnderLargerAllowance
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) componentStreamChunks []
    componentStreamChunks (.accepted componentCanonicalIntegerReport)
    componentResidentProducerWire_exactMemoryBoundary_accepted

end Sprawlens.FixedPointStreamingResidentMemory
