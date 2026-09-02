import Sprawlens.FixedPointCompressedResidentPipeline

namespace Sprawlens.FixedPointStreamingCpuRefinement

open FixedPointCompressedResidentPipeline
open FixedPointCompressedStreamingProducer
open FixedPointStreamingDecompression
open FixedPointStreamingResidentMemory

universe u v w

def totalObservedChunkWork
    (observedWork : DecompressionChunk → Nat) :
    List DecompressionChunk → Nat
  | [] => 0
  | chunk :: remaining =>
      observedWork chunk + totalObservedChunkWork observedWork remaining

def ObservedChunkWorkRefinesClaim
    (observedWork : DecompressionChunk → Nat) : Prop :=
  ∀ chunk, observedWork chunk ≤ chunk.work

theorem totalObservedChunkWork_le_totalChunkWork
    (observedWork : DecompressionChunk → Nat)
    (refines : ObservedChunkWorkRefinesClaim observedWork)
    (chunks : List DecompressionChunk) :
    totalObservedChunkWork observedWork chunks ≤ totalChunkWork chunks := by
  induction chunks with
  | nil => rfl
  | cons chunk remaining inductionHypothesis =>
      simp [totalObservedChunkWork, totalChunkWork]
      exact Nat.add_le_add (refines chunk) inductionHypothesis

/-- The final `+1` pull observes `done`; it is not represented by a chunk. -/
def estimatedCpuWork
    (observedChunkWork : DecompressionChunk → Nat)
    (perPullOverhead : Nat)
    (accepted : List DecompressionChunk) : Nat :=
  totalObservedChunkWork observedChunkWork accepted +
    (accepted.length + 1) * perPullOverhead

theorem estimatedCpuWork_le_policyBound
    (observedChunkWork : DecompressionChunk → Nat)
    (refines : ObservedChunkWorkRefinesClaim observedChunkWork)
    (perPullOverhead maxWork maxPulls : Nat)
    (accepted : List DecompressionChunk)
    (claimedWithin : totalChunkWork accepted ≤ maxWork)
    (pullsWithin : accepted.length + 1 ≤ maxPulls) :
    estimatedCpuWork observedChunkWork perPullOverhead accepted ≤
      maxWork + maxPulls * perPullOverhead := by
  apply Nat.add_le_add
  · exact (totalObservedChunkWork_le_totalChunkWork observedChunkWork refines
      accepted).trans claimedWithin
  · exact Nat.mul_le_mul_right perPullOverhead pullsWithin

theorem runResidentProducer_completed_cpu_bound
    {State : Type u}
    (maxPulls maxWork maxExpandedBytes maxMemory : Nat)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (observedChunkWork : DecompressionChunk → Nat)
    (refines : ObservedChunkWorkRefinesClaim observedChunkWork)
    (perPullOverhead : Nat)
    (initial finalState : State) (accepted : List DecompressionChunk)
    (raw : String)
    (completed : runResidentProducer maxPulls maxWork maxExpandedBytes
      maxMemory stateWeight temporaryWeight pull initial =
        .completed accepted finalState raw) :
    estimatedCpuWork observedChunkWork perPullOverhead accepted ≤
      maxWork + maxPulls * perPullOverhead := by
  have resources := runResidentProducer_completed_resource_sound maxPulls
    maxWork maxExpandedBytes maxMemory stateWeight temporaryWeight pull
    initial finalState accepted raw completed
  have pulls := runResidentProducer_completed_pull_bound maxPulls maxWork
    maxExpandedBytes maxMemory stateWeight temporaryWeight pull initial
    finalState accepted raw completed
  exact estimatedCpuWork_le_policyBound observedChunkWork refines
    perPullOverhead maxWork maxPulls accepted resources.1 pulls

theorem checkCompressedResidentEnvelopeThen_checked_cpu_bound
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio maxMemory : Nat)
    (startProducer : Compressed → Option State)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (observedChunkWork : DecompressionChunk → Nat)
    (refines : ObservedChunkWorkRefinesClaim observedChunkWork)
    (perPullOverhead : Nat)
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : Result)
    (checked : checkCompressedResidentEnvelopeThen compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      maxMemory startProducer stateWeight temporaryWeight pull decode check
      input = .resident (.checked accepted finalState result)) :
    estimatedCpuWork observedChunkWork perPullOverhead accepted ≤
      maxWork + maxPulls * perPullOverhead := by
  obtain ⟨_, initial, raw, artifact, _, completed, _, _⟩ :=
    (checkCompressedResidentEnvelopeThen_eq_checked_iff compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      maxMemory startProducer stateWeight temporaryWeight pull decode check
      input accepted finalState result).mp checked
  exact runResidentProducer_completed_cpu_bound maxPulls maxWork
    (effectiveExpandedBudget compressedWeight maxExpandedBytes
      maxExpansionRatio input) maxMemory stateWeight temporaryWeight pull
    observedChunkWork refines perPullOverhead initial finalState accepted raw
    completed

def hiddenCpuChunk : DecompressionChunk := ⟨"", 0⟩

def hiddenCpuChunks : List DecompressionChunk := [hiddenCpuChunk]

def hiddenObservedWork (_ : DecompressionChunk) : Nat := 100

theorem zeroClaimedWork_does_not_bound_observedCpu :
    runResidentProducer 2 0 0 0 zeroStateWeight zeroTemporaryWeight
        budgetedListProducer hiddenCpuChunks =
          .completed hiddenCpuChunks [] "" ∧
      totalChunkWork hiddenCpuChunks = 0 ∧
      totalObservedChunkWork hiddenObservedWork hiddenCpuChunks = 100 := by
  native_decide

theorem hiddenObservedWork_does_not_refine_claim :
    ¬ObservedChunkWorkRefinesClaim hiddenObservedWork := by
  intro refines
  have impossible := refines hiddenCpuChunk
  simp [hiddenObservedWork, hiddenCpuChunk] at impossible

def claimedWork (chunk : DecompressionChunk) : Nat := chunk.work

theorem claimedWork_refines : ObservedChunkWorkRefinesClaim claimedWork := by
  intro chunk
  exact Nat.le_refl _

theorem emptyChunkSequence_still_has_terminalPullOverhead :
    totalChunkWork [] = 0 ∧
      estimatedCpuWork claimedWork 5 [] = 5 := by
  native_decide

theorem twoBraceCpuPolicyBound_tight :
    runResidentProducer 3 2 2 2 zeroStateWeight zeroTemporaryWeight
        budgetedListProducer twoBraceChunks =
          .completed twoBraceChunks [] "{}" ∧
      estimatedCpuWork claimedWork 3 twoBraceChunks = 11 ∧
      2 + 3 * 3 = 11 := by
  native_decide

end Sprawlens.FixedPointStreamingCpuRefinement
