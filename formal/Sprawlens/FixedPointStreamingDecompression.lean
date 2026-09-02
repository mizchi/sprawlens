import Sprawlens.FixedPointCompressedEnvelopeBoundary

namespace Sprawlens.FixedPointStreamingDecompression

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointRawEnvelopeBoundary
open FixedPointWireArtifact
open FixedPointWireDiagnostic
open FixedPointWirePayloadBudget
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u v

structure DecompressionChunk where
  payload : String
  work : Nat
deriving DecidableEq, Repr

def DecompressionChunk.bytes (chunk : DecompressionChunk) : Nat :=
  chunk.payload.utf8ByteSize

def totalChunkWork : List DecompressionChunk → Nat
  | [] => 0
  | chunk :: remaining => chunk.work + totalChunkWork remaining

def totalChunkBytes : List DecompressionChunk → Nat
  | [] => 0
  | chunk :: remaining => chunk.bytes + totalChunkBytes remaining

def materializeChunks : List DecompressionChunk → String
  | [] => ""
  | chunk :: remaining => chunk.payload ++ materializeChunks remaining

/-- The rejected chunk is not part of `acceptedPrefix`; `remaining` has not
been inspected. This records the first resource failure. -/
inductive StreamScanResult where
  | within
  | workLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
  | expandedBudgetExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
deriving DecidableEq, Repr

def StreamScanResult.prependAccepted
    (chunk : DecompressionChunk) : StreamScanResult → StreamScanResult
  | .within => .within
  | .workLimitExceeded scanned rejected remaining =>
      .workLimitExceeded (chunk :: scanned) rejected remaining
  | .expandedBudgetExceeded scanned rejected remaining =>
      .expandedBudgetExceeded (chunk :: scanned) rejected remaining

@[simp] theorem StreamScanResult.prependAccepted_eq_within_iff
    (chunk : DecompressionChunk) (result : StreamScanResult) :
    result.prependAccepted chunk = .within ↔ result = .within := by
  cases result <;> simp [StreamScanResult.prependAccepted]

def scanDecompressionChunksAux
    (maxWork maxExpandedBytes usedWork usedBytes : Nat) :
    List DecompressionChunk → StreamScanResult
  | [] => .within
  | chunk :: remaining =>
      if _workWithin : usedWork + chunk.work ≤ maxWork then
        if _bytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes then
          (scanDecompressionChunksAux maxWork maxExpandedBytes
            (usedWork + chunk.work) (usedBytes + chunk.bytes) remaining).prependAccepted
              chunk
        else .expandedBudgetExceeded [] chunk remaining
      else .workLimitExceeded [] chunk remaining

def scanDecompressionChunks
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) : StreamScanResult :=
  scanDecompressionChunksAux maxWork maxExpandedBytes 0 0 chunks

theorem scanDecompressionChunksAux_eq_within_iff
    (maxWork maxExpandedBytes usedWork usedBytes : Nat)
    (chunks : List DecompressionChunk)
    (usedWorkWithin : usedWork ≤ maxWork)
    (usedBytesWithin : usedBytes ≤ maxExpandedBytes) :
    scanDecompressionChunksAux maxWork maxExpandedBytes usedWork usedBytes
        chunks = .within ↔
      usedWork + totalChunkWork chunks ≤ maxWork ∧
        usedBytes + totalChunkBytes chunks ≤ maxExpandedBytes := by
  induction chunks generalizing usedWork usedBytes with
  | nil =>
      simp [scanDecompressionChunksAux, totalChunkWork, totalChunkBytes,
        usedWorkWithin, usedBytesWithin]
  | cons chunk remaining inductionHypothesis =>
      by_cases workWithin : usedWork + chunk.work ≤ maxWork
      · by_cases bytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes
        · have remainingInfo := inductionHypothesis
            (usedWork + chunk.work) (usedBytes + chunk.bytes) workWithin
            bytesWithin
          simp [scanDecompressionChunksAux, totalChunkWork, totalChunkBytes,
            workWithin, bytesWithin, remainingInfo]
          omega
        · simp [scanDecompressionChunksAux, totalChunkWork, totalChunkBytes,
            workWithin, bytesWithin]
          omega
      · simp [scanDecompressionChunksAux, totalChunkWork, totalChunkBytes,
          workWithin]
        omega

theorem scanDecompressionChunks_eq_within_iff
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) :
    scanDecompressionChunks maxWork maxExpandedBytes chunks = .within ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes := by
  simpa [scanDecompressionChunks] using
    scanDecompressionChunksAux_eq_within_iff maxWork maxExpandedBytes 0 0
      chunks (Nat.zero_le _) (Nat.zero_le _)

theorem materializeChunks_utf8ByteSize
    (chunks : List DecompressionChunk) :
    (materializeChunks chunks).utf8ByteSize = totalChunkBytes chunks := by
  induction chunks with
  | nil => rfl
  | cons chunk remaining inductionHypothesis =>
      simp [materializeChunks, totalChunkBytes, DecompressionChunk.bytes,
        String.utf8ByteSize_append, inductionHypothesis]

inductive StreamingDecompressionResult where
  | workLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
  | expandedBudgetExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
  | completed (raw : String)
deriving DecidableEq, Repr

def checkStreamingDecompression
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) : StreamingDecompressionResult :=
  match scanDecompressionChunks maxWork maxExpandedBytes chunks with
  | .within => .completed (materializeChunks chunks)
  | .workLimitExceeded scanned rejected remaining =>
      .workLimitExceeded scanned rejected remaining
  | .expandedBudgetExceeded scanned rejected remaining =>
      .expandedBudgetExceeded scanned rejected remaining

theorem checkStreamingDecompression_eq_completed_iff
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) :
    checkStreamingDecompression maxWork maxExpandedBytes chunks =
        .completed (materializeChunks chunks) ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes := by
  rw [← scanDecompressionChunks_eq_within_iff]
  cases scannedEq : scanDecompressionChunks maxWork maxExpandedBytes chunks <;>
    simp [checkStreamingDecompression, scannedEq]

theorem completed_output_utf8ByteSize_le
    (maxWork maxExpandedBytes : Nat)
    (chunks : List DecompressionChunk) (raw : String)
    (completed : checkStreamingDecompression maxWork maxExpandedBytes chunks =
      .completed raw) :
    raw = materializeChunks chunks ∧ raw.utf8ByteSize ≤ maxExpandedBytes := by
  unfold checkStreamingDecompression at completed
  cases scannedEq : scanDecompressionChunks maxWork maxExpandedBytes chunks with
  | within =>
      simp [scannedEq] at completed
      subst raw
      exact ⟨rfl, by
        rw [materializeChunks_utf8ByteSize]
        exact (scanDecompressionChunks_eq_within_iff maxWork maxExpandedBytes
          chunks).mp scannedEq |>.2⟩
  | workLimitExceeded scanned rejected remaining => simp [scannedEq] at completed
  | expandedBudgetExceeded scanned rejected remaining =>
      simp [scannedEq] at completed

/-! ## First-failure prefix witnesses -/

theorem scanDecompressionChunksAux_workFailure_witness
    (maxWork maxExpandedBytes usedWork usedBytes : Nat)
    (chunks scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (usedWorkWithin : usedWork ≤ maxWork)
    (usedBytesWithin : usedBytes ≤ maxExpandedBytes)
    (failure : scanDecompressionChunksAux maxWork maxExpandedBytes usedWork
      usedBytes chunks = .workLimitExceeded scanned rejected remaining) :
    chunks = scanned ++ rejected :: remaining ∧
      usedWork + totalChunkWork scanned ≤ maxWork ∧
      maxWork < usedWork + totalChunkWork scanned + rejected.work ∧
      usedBytes + totalChunkBytes scanned ≤ maxExpandedBytes := by
  induction chunks generalizing usedWork usedBytes scanned rejected remaining with
  | nil => simp [scanDecompressionChunksAux] at failure
  | cons chunk suffix inductionHypothesis =>
      by_cases workWithin : usedWork + chunk.work ≤ maxWork
      · by_cases bytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes
        · cases recursiveEq : scanDecompressionChunksAux maxWork
              maxExpandedBytes (usedWork + chunk.work)
              (usedBytes + chunk.bytes) suffix with
          | within =>
              simp [scanDecompressionChunksAux, workWithin, bytesWithin,
                recursiveEq, StreamScanResult.prependAccepted] at failure
          | workLimitExceeded innerScanned innerRejected innerRemaining =>
              have innerInfo := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                innerScanned innerRejected innerRemaining workWithin bytesWithin
                recursiveEq
              simp [scanDecompressionChunksAux, workWithin, bytesWithin,
                recursiveEq, StreamScanResult.prependAccepted] at failure
              rcases failure with ⟨rfl, rfl, rfl⟩
              rcases innerInfo with
                ⟨suffixEq, innerWorkWithin, innerWorkExceeded,
                  innerBytesWithin⟩
              subst suffix
              simp only [List.cons_append, totalChunkWork, totalChunkBytes]
              exact ⟨trivial, by omega, by omega, by omega⟩
          | expandedBudgetExceeded innerScanned innerRejected innerRemaining =>
              simp [scanDecompressionChunksAux, workWithin, bytesWithin,
                recursiveEq, StreamScanResult.prependAccepted] at failure
        · simp [scanDecompressionChunksAux, workWithin, bytesWithin] at failure
      · simp [scanDecompressionChunksAux, workWithin] at failure
        rcases failure with ⟨rfl, rfl, rfl⟩
        exact ⟨by simp, usedWorkWithin, by omega, usedBytesWithin⟩

theorem scanDecompressionChunksAux_expandedFailure_witness
    (maxWork maxExpandedBytes usedWork usedBytes : Nat)
    (chunks scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (usedWorkWithin : usedWork ≤ maxWork)
    (usedBytesWithin : usedBytes ≤ maxExpandedBytes)
    (failure : scanDecompressionChunksAux maxWork maxExpandedBytes usedWork
      usedBytes chunks = .expandedBudgetExceeded scanned rejected remaining) :
    chunks = scanned ++ rejected :: remaining ∧
      usedWork + totalChunkWork scanned + rejected.work ≤ maxWork ∧
      usedBytes + totalChunkBytes scanned ≤ maxExpandedBytes ∧
      maxExpandedBytes <
        usedBytes + totalChunkBytes scanned + rejected.bytes := by
  induction chunks generalizing usedWork usedBytes scanned rejected remaining with
  | nil => simp [scanDecompressionChunksAux] at failure
  | cons chunk suffix inductionHypothesis =>
      by_cases workWithin : usedWork + chunk.work ≤ maxWork
      · by_cases bytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes
        · cases recursiveEq : scanDecompressionChunksAux maxWork
              maxExpandedBytes (usedWork + chunk.work)
              (usedBytes + chunk.bytes) suffix with
          | within =>
              simp [scanDecompressionChunksAux, workWithin, bytesWithin,
                recursiveEq, StreamScanResult.prependAccepted] at failure
          | workLimitExceeded innerScanned innerRejected innerRemaining =>
              simp [scanDecompressionChunksAux, workWithin, bytesWithin,
                recursiveEq, StreamScanResult.prependAccepted] at failure
          | expandedBudgetExceeded innerScanned innerRejected innerRemaining =>
              have innerInfo := inductionHypothesis
                (usedWork + chunk.work) (usedBytes + chunk.bytes)
                innerScanned innerRejected innerRemaining workWithin bytesWithin
                recursiveEq
              simp [scanDecompressionChunksAux, workWithin, bytesWithin,
                recursiveEq, StreamScanResult.prependAccepted] at failure
              rcases failure with ⟨rfl, rfl, rfl⟩
              rcases innerInfo with
                ⟨suffixEq, innerWorkWithin, innerBytesWithin,
                  innerBytesExceeded⟩
              subst suffix
              simp only [List.cons_append, totalChunkWork, totalChunkBytes]
              exact ⟨trivial, by omega, by omega, by omega⟩
        · simp [scanDecompressionChunksAux, workWithin, bytesWithin] at failure
          rcases failure with ⟨rfl, rfl, rfl⟩
          exact ⟨by simp, workWithin, usedBytesWithin, by omega⟩
      · simp [scanDecompressionChunksAux, workWithin] at failure

theorem scanDecompressionChunksAux_workFailure_of_bounds
    (maxWork maxExpandedBytes usedWork usedBytes : Nat)
    (scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (acceptedWorkWithin :
      usedWork + totalChunkWork scanned ≤ maxWork)
    (rejectedWorkExceeded :
      maxWork < usedWork + totalChunkWork scanned + rejected.work)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes scanned ≤ maxExpandedBytes) :
    scanDecompressionChunksAux maxWork maxExpandedBytes usedWork usedBytes
        (scanned ++ rejected :: remaining) =
      .workLimitExceeded scanned rejected remaining := by
  induction scanned generalizing usedWork usedBytes with
  | nil =>
      have workExceeded : ¬usedWork + rejected.work ≤ maxWork := by
        simp [totalChunkWork] at rejectedWorkExceeded
        omega
      simp [scanDecompressionChunksAux, workExceeded]
  | cons chunk scanned inductionHypothesis =>
      have chunkWorkWithin : usedWork + chunk.work ≤ maxWork := by
        simp [totalChunkWork] at acceptedWorkWithin
        omega
      have chunkBytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes := by
        simp [totalChunkBytes] at acceptedBytesWithin
        omega
      have recursive := inductionHypothesis (usedWork + chunk.work)
        (usedBytes + chunk.bytes) (by
          simp [totalChunkWork] at acceptedWorkWithin ⊢
          omega) (by
          simp [totalChunkWork] at rejectedWorkExceeded ⊢
          omega) (by
          simp [totalChunkBytes] at acceptedBytesWithin ⊢
          omega)
      simp [scanDecompressionChunksAux, chunkWorkWithin, chunkBytesWithin,
        recursive, StreamScanResult.prependAccepted]

theorem scanDecompressionChunksAux_expandedFailure_of_bounds
    (maxWork maxExpandedBytes usedWork usedBytes : Nat)
    (scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (rejectedWorkWithin :
      usedWork + totalChunkWork scanned + rejected.work ≤ maxWork)
    (acceptedBytesWithin :
      usedBytes + totalChunkBytes scanned ≤ maxExpandedBytes)
    (rejectedBytesExceeded :
      maxExpandedBytes <
        usedBytes + totalChunkBytes scanned + rejected.bytes) :
    scanDecompressionChunksAux maxWork maxExpandedBytes usedWork usedBytes
        (scanned ++ rejected :: remaining) =
      .expandedBudgetExceeded scanned rejected remaining := by
  induction scanned generalizing usedWork usedBytes with
  | nil =>
      have workWithin : usedWork + rejected.work ≤ maxWork := by
        simpa [totalChunkWork] using rejectedWorkWithin
      have bytesExceeded :
          ¬usedBytes + rejected.bytes ≤ maxExpandedBytes := by
        simp [totalChunkBytes] at rejectedBytesExceeded
        omega
      simp [scanDecompressionChunksAux, workWithin, bytesExceeded]
  | cons chunk scanned inductionHypothesis =>
      have chunkWorkWithin : usedWork + chunk.work ≤ maxWork := by
        simp [totalChunkWork] at rejectedWorkWithin
        omega
      have chunkBytesWithin : usedBytes + chunk.bytes ≤ maxExpandedBytes := by
        simp [totalChunkBytes] at acceptedBytesWithin
        omega
      have recursive := inductionHypothesis (usedWork + chunk.work)
        (usedBytes + chunk.bytes) (by
          simp [totalChunkWork] at rejectedWorkWithin ⊢
          omega) (by
          simp [totalChunkBytes] at acceptedBytesWithin ⊢
          omega) (by
          simp [totalChunkBytes] at rejectedBytesExceeded ⊢
          omega)
      simp [scanDecompressionChunksAux, chunkWorkWithin, chunkBytesWithin,
        recursive, StreamScanResult.prependAccepted]

theorem scanDecompressionChunks_workFailure_witness
    (maxWork maxExpandedBytes : Nat)
    (chunks scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (failure : scanDecompressionChunks maxWork maxExpandedBytes chunks =
      .workLimitExceeded scanned rejected remaining) :
    chunks = scanned ++ rejected :: remaining ∧
      totalChunkWork scanned ≤ maxWork ∧
      maxWork < totalChunkWork scanned + rejected.work ∧
      totalChunkBytes scanned ≤ maxExpandedBytes := by
  simpa using scanDecompressionChunksAux_workFailure_witness maxWork
    maxExpandedBytes 0 0 chunks scanned rejected remaining (Nat.zero_le _)
    (Nat.zero_le _) failure

theorem scanDecompressionChunks_expandedFailure_witness
    (maxWork maxExpandedBytes : Nat)
    (chunks scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (failure : scanDecompressionChunks maxWork maxExpandedBytes chunks =
      .expandedBudgetExceeded scanned rejected remaining) :
    chunks = scanned ++ rejected :: remaining ∧
      totalChunkWork scanned + rejected.work ≤ maxWork ∧
      totalChunkBytes scanned ≤ maxExpandedBytes ∧
      maxExpandedBytes < totalChunkBytes scanned + rejected.bytes := by
  simpa using scanDecompressionChunksAux_expandedFailure_witness maxWork
    maxExpandedBytes 0 0 chunks scanned rejected remaining (Nat.zero_le _)
    (Nat.zero_le _) failure

theorem scanDecompressionChunks_eq_workLimitExceeded_iff
    (maxWork maxExpandedBytes : Nat)
    (chunks scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk) :
    scanDecompressionChunks maxWork maxExpandedBytes chunks =
        .workLimitExceeded scanned rejected remaining ↔
      chunks = scanned ++ rejected :: remaining ∧
        totalChunkWork scanned ≤ maxWork ∧
        maxWork < totalChunkWork scanned + rejected.work ∧
        totalChunkBytes scanned ≤ maxExpandedBytes := by
  constructor
  · exact scanDecompressionChunks_workFailure_witness maxWork
      maxExpandedBytes chunks scanned rejected remaining
  · rintro ⟨rfl, acceptedWorkWithin, rejectedWorkExceeded,
      acceptedBytesWithin⟩
    exact scanDecompressionChunksAux_workFailure_of_bounds maxWork
      maxExpandedBytes 0 0 scanned rejected remaining
      (by simpa using acceptedWorkWithin)
      (by simpa using rejectedWorkExceeded)
      (by simpa using acceptedBytesWithin)

theorem scanDecompressionChunks_eq_expandedBudgetExceeded_iff
    (maxWork maxExpandedBytes : Nat)
    (chunks scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk) :
    scanDecompressionChunks maxWork maxExpandedBytes chunks =
        .expandedBudgetExceeded scanned rejected remaining ↔
      chunks = scanned ++ rejected :: remaining ∧
        totalChunkWork scanned + rejected.work ≤ maxWork ∧
        totalChunkBytes scanned ≤ maxExpandedBytes ∧
        maxExpandedBytes < totalChunkBytes scanned + rejected.bytes := by
  constructor
  · exact scanDecompressionChunks_expandedFailure_witness maxWork
      maxExpandedBytes chunks scanned rejected remaining
  · rintro ⟨rfl, rejectedWorkWithin, acceptedBytesWithin,
      rejectedBytesExceeded⟩
    exact scanDecompressionChunksAux_expandedFailure_of_bounds maxWork
      maxExpandedBytes 0 0 scanned rejected remaining
      (by simpa using rejectedWorkWithin)
      (by simpa using acceptedBytesWithin)
      (by simpa using rejectedBytesExceeded)

theorem scanDecompressionChunks_append_after_workFailure
    (maxWork maxExpandedBytes : Nat)
    (chunks suffix scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (failure : scanDecompressionChunks maxWork maxExpandedBytes chunks =
      .workLimitExceeded scanned rejected remaining) :
    scanDecompressionChunks maxWork maxExpandedBytes (chunks ++ suffix) =
      .workLimitExceeded scanned rejected (remaining ++ suffix) := by
  obtain ⟨chunksEq, acceptedWorkWithin, rejectedWorkExceeded,
      acceptedBytesWithin⟩ :=
    (scanDecompressionChunks_eq_workLimitExceeded_iff maxWork
      maxExpandedBytes chunks scanned rejected remaining).mp failure
  apply (scanDecompressionChunks_eq_workLimitExceeded_iff maxWork
    maxExpandedBytes (chunks ++ suffix) scanned rejected
    (remaining ++ suffix)).mpr
  exact ⟨by simp [chunksEq, List.append_assoc], acceptedWorkWithin,
    rejectedWorkExceeded, acceptedBytesWithin⟩

theorem scanDecompressionChunks_append_after_expandedFailure
    (maxWork maxExpandedBytes : Nat)
    (chunks suffix scanned : List DecompressionChunk)
    (rejected : DecompressionChunk) (remaining : List DecompressionChunk)
    (failure : scanDecompressionChunks maxWork maxExpandedBytes chunks =
      .expandedBudgetExceeded scanned rejected remaining) :
    scanDecompressionChunks maxWork maxExpandedBytes (chunks ++ suffix) =
      .expandedBudgetExceeded scanned rejected (remaining ++ suffix) := by
  obtain ⟨chunksEq, rejectedWorkWithin, acceptedBytesWithin,
      rejectedBytesExceeded⟩ :=
    (scanDecompressionChunks_eq_expandedBudgetExceeded_iff maxWork
      maxExpandedBytes chunks scanned rejected remaining).mp failure
  apply (scanDecompressionChunks_eq_expandedBudgetExceeded_iff maxWork
    maxExpandedBytes (chunks ++ suffix) scanned rejected
    (remaining ++ suffix)).mpr
  exact ⟨by simp [chunksEq, List.append_assoc], rejectedWorkWithin,
    acceptedBytesWithin, rejectedBytesExceeded⟩

theorem checkStreamingDecompression_completed_mono
    {workSmaller workLarger bytesSmaller bytesLarger : Nat}
    (workLe : workSmaller ≤ workLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (chunks : List DecompressionChunk)
    (completed : checkStreamingDecompression workSmaller bytesSmaller chunks =
      .completed (materializeChunks chunks)) :
    checkStreamingDecompression workLarger bytesLarger chunks =
      .completed (materializeChunks chunks) := by
  have limits := (checkStreamingDecompression_eq_completed_iff workSmaller
    bytesSmaller chunks).mp completed
  exact (checkStreamingDecompression_eq_completed_iff workLarger bytesLarger
    chunks).mpr ⟨limits.1.trans workLe, limits.2.trans bytesLe⟩

def openBraceChunk : DecompressionChunk := ⟨"{", 1⟩
def closeBraceChunk : DecompressionChunk := ⟨"}", 1⟩
def twoBraceChunks : List DecompressionChunk :=
  [openBraceChunk, closeBraceChunk]

theorem twoBraceChunks_totals :
    totalChunkWork twoBraceChunks = 2 ∧
      totalChunkBytes twoBraceChunks = 2 ∧
      materializeChunks twoBraceChunks = "{}" := by
  native_decide

theorem twoBraceChunks_exactBoundary_completed :
    checkStreamingDecompression 2 2 twoBraceChunks = .completed "{}" := by
  native_decide

theorem twoBraceChunks_workLimit_firstFailure :
    checkStreamingDecompression 1 2 twoBraceChunks =
      .workLimitExceeded [openBraceChunk] closeBraceChunk [] := by
  native_decide

theorem twoBraceChunks_expandedLimit_firstFailure :
    checkStreamingDecompression 2 1 twoBraceChunks =
      .expandedBudgetExceeded [openBraceChunk] closeBraceChunk [] := by
  native_decide

theorem twoBraceChunks_completed_under_relaxedLimits :
    checkStreamingDecompression 3 3 twoBraceChunks = .completed "{}" := by
  simpa [twoBraceChunks, openBraceChunk, closeBraceChunk, materializeChunks] using
    checkStreamingDecompression_completed_mono
      (workSmaller := 2) (workLarger := 3)
      (bytesSmaller := 2) (bytesLarger := 3)
      (by omega) (by omega) twoBraceChunks
      twoBraceChunks_exactBoundary_completed

inductive StreamingEnvelopeCheckResult (Result : Type u) where
  | workLimitExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
  | expandedBudgetExceeded
      (acceptedPrefix : List DecompressionChunk)
      (rejected : DecompressionChunk)
      (remaining : List DecompressionChunk)
  | decodeRejected
  | checked (result : Result)

def StreamingEnvelopeCheckResult.toOption {Result : Type u} :
    StreamingEnvelopeCheckResult Result → Option Result
  | .workLimitExceeded _ _ _ => none
  | .expandedBudgetExceeded _ _ _ => none
  | .decodeRejected => none
  | .checked result => some result

def checkStreamingEnvelopeThen
    {Artifact : Type u} {Result : Type v}
    (maxWork maxExpandedBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (chunks : List DecompressionChunk) : StreamingEnvelopeCheckResult Result :=
  match scanDecompressionChunks maxWork maxExpandedBytes chunks with
  | .workLimitExceeded scanned rejected remaining =>
      .workLimitExceeded scanned rejected remaining
  | .expandedBudgetExceeded scanned rejected remaining =>
      .expandedBudgetExceeded scanned rejected remaining
  | .within =>
      match decode (materializeChunks chunks) with
      | none => .decodeRejected
      | some artifact => .checked (check artifact)

theorem checkStreamingEnvelopeThen_eq_checked_iff
    {Artifact : Type u} {Result : Type v}
    (maxWork maxExpandedBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (chunks : List DecompressionChunk) (result : Result) :
    checkStreamingEnvelopeThen maxWork maxExpandedBytes decode check chunks =
        .checked result ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes ∧
        ∃ artifact,
          decode (materializeChunks chunks) = some artifact ∧
          check artifact = result := by
  cases scannedEq : scanDecompressionChunks maxWork maxExpandedBytes chunks with
  | within =>
      have limits := (scanDecompressionChunks_eq_within_iff maxWork
        maxExpandedBytes chunks).mp scannedEq
      cases decodedEq : decode (materializeChunks chunks) with
      | none => simp [checkStreamingEnvelopeThen, scannedEq, decodedEq, limits]
      | some artifact =>
          simp [checkStreamingEnvelopeThen, scannedEq, decodedEq, limits]
  | workLimitExceeded scanned rejected remaining =>
      have outside := (scanDecompressionChunks_eq_within_iff maxWork
        maxExpandedBytes chunks).not.mp (by simp [scannedEq])
      constructor
      · intro impossible
        simp [checkStreamingEnvelopeThen, scannedEq] at impossible
      · rintro ⟨workWithin, bytesWithin, _⟩
        exact (outside ⟨workWithin, bytesWithin⟩).elim
  | expandedBudgetExceeded scanned rejected remaining =>
      have outside := (scanDecompressionChunks_eq_within_iff maxWork
        maxExpandedBytes chunks).not.mp (by simp [scannedEq])
      constructor
      · intro impossible
        simp [checkStreamingEnvelopeThen, scannedEq] at impossible
      · rintro ⟨workWithin, bytesWithin, _⟩
        exact (outside ⟨workWithin, bytesWithin⟩).elim

theorem checkStreamingEnvelopeThen_eq_decodeRejected_iff
    {Artifact : Type u} {Result : Type v}
    (maxWork maxExpandedBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (chunks : List DecompressionChunk) :
    checkStreamingEnvelopeThen maxWork maxExpandedBytes decode check chunks =
        .decodeRejected ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes ∧
        decode (materializeChunks chunks) = none := by
  cases scannedEq : scanDecompressionChunks maxWork maxExpandedBytes chunks with
  | within =>
      have limits := (scanDecompressionChunks_eq_within_iff maxWork
        maxExpandedBytes chunks).mp scannedEq
      cases decodedEq : decode (materializeChunks chunks) <;>
        simp [checkStreamingEnvelopeThen, scannedEq, decodedEq, limits]
  | workLimitExceeded scanned rejected remaining =>
      have outside := (scanDecompressionChunks_eq_within_iff maxWork
        maxExpandedBytes chunks).not.mp (by simp [scannedEq])
      constructor
      · intro impossible
        simp [checkStreamingEnvelopeThen, scannedEq] at impossible
      · rintro ⟨workWithin, bytesWithin, _⟩
        exact (outside ⟨workWithin, bytesWithin⟩).elim
  | expandedBudgetExceeded scanned rejected remaining =>
      have outside := (scanDecompressionChunks_eq_within_iff maxWork
        maxExpandedBytes chunks).not.mp (by simp [scannedEq])
      constructor
      · intro impossible
        simp [checkStreamingEnvelopeThen, scannedEq] at impossible
      · rintro ⟨workWithin, bytesWithin, _⟩
        exact (outside ⟨workWithin, bytesWithin⟩).elim

theorem checkStreamingEnvelopeThen_checked_mono
    {Artifact : Type u} {Result : Type v}
    {workSmaller workLarger bytesSmaller bytesLarger : Nat}
    (workLe : workSmaller ≤ workLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (chunks : List DecompressionChunk) (result : Result)
    (accepted : checkStreamingEnvelopeThen workSmaller bytesSmaller decode
      check chunks = .checked result) :
    checkStreamingEnvelopeThen workLarger bytesLarger decode check chunks =
      .checked result := by
  obtain ⟨workWithin, bytesWithin, artifact, decoded, checked⟩ :=
    (checkStreamingEnvelopeThen_eq_checked_iff workSmaller bytesSmaller
      decode check chunks result).mp accepted
  exact (checkStreamingEnvelopeThen_eq_checked_iff workLarger bytesLarger
    decode check chunks result).mpr
      ⟨workWithin.trans workLe, bytesWithin.trans bytesLe, artifact,
        decoded, checked⟩

/-! ## Composition with the wire reliability checker -/

noncomputable def checkStreamingWireEnvelope
    {Edit : Type u} [DecidableEq Edit]
    (maxWork maxExpandedBytes : Nat)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (chunks : List DecompressionChunk) :
    StreamingEnvelopeCheckResult (WireArtifactCheckResult Edit scale) :=
  checkStreamingEnvelopeThen maxWork maxExpandedBytes decode (fun artifact =>
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin artifact.report
      artifact.paths) chunks

theorem checkStreamingWireEnvelope_eq_checked_accepted_iff
    {Edit : Type u} [DecidableEq Edit]
    (maxWork maxExpandedBytes : Nat)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (chunks : List DecompressionChunk)
    (result : IntegerReliabilityReport Edit scale) :
    checkStreamingWireEnvelope maxWork maxExpandedBytes decode scale maxSteps
        maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
        editWeight maxSchemaWeight Independent encodedCost source actualMargin
        chunks = .checked (.accepted result) ↔
      totalChunkWork chunks ≤ maxWork ∧
        totalChunkBytes chunks ≤ maxExpandedBytes ∧
        ∃ artifact,
          decode (materializeChunks chunks) = some artifact ∧
          checkWireReliabilityArtifact scale maxSteps maxScaleBytes
            maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
            maxSchemaWeight Independent encodedCost source actualMargin
            artifact.report artifact.paths = .accepted result := by
  exact checkStreamingEnvelopeThen_eq_checked_iff maxWork maxExpandedBytes
    decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) chunks (.accepted result)

theorem checkStreamingWireEnvelope_target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (maxWork maxExpandedBytes : Nat)
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
    (chunks : List DecompressionChunk)
    (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (accepted : checkStreamingWireEnvelope maxWork maxExpandedBytes decode
      scale maxSteps maxScaleBytes maxUnitBytes maxTargetLength
      maxTotalTargetEdits editWeight maxSchemaWeight Independent encodedCost
      source actualMargin chunks = .checked (.accepted result))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, _, artifact, _, wireAccepted⟩ :=
    (checkStreamingWireEnvelope_eq_checked_accepted_iff maxWork
      maxExpandedBytes decode scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin chunks result).mp accepted
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

def componentStreamChunk : DecompressionChunk :=
  ⟨componentWireEnvelope, 1⟩

def componentStreamChunks : List DecompressionChunk :=
  [componentStreamChunk]

theorem componentStreamChunks_totals :
    totalChunkWork componentStreamChunks = 1 ∧
      totalChunkBytes componentStreamChunks = 9 ∧
      materializeChunks componentStreamChunks = componentWireEnvelope := by
  native_decide

theorem componentStreamingWireEnvelope_exactBoundary_accepted :
    checkStreamingWireEnvelope 1 9 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .checked (.accepted componentCanonicalIntegerReport) := by
  apply (checkStreamingWireEnvelope_eq_checked_accepted_iff 1 9
    componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentStreamChunks componentCanonicalIntegerReport).mpr
  exact ⟨by native_decide, by native_decide,
    ⟨componentWireReport, componentWirePaths⟩,
    by simp [componentStreamChunks, componentStreamChunk,
      materializeChunks, componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentStreamingWireEnvelope_accepted_under_relaxedBudgets :
    checkStreamingWireEnvelope 2 10 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .checked (.accepted componentCanonicalIntegerReport) := by
  exact checkStreamingEnvelopeThen_checked_mono (by omega) (by omega)
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) componentStreamChunks
    (.accepted componentCanonicalIntegerReport)
    componentStreamingWireEnvelope_exactBoundary_accepted

theorem componentStreamingWireEnvelope_workLimit_firstFailure :
    checkStreamingWireEnvelope 0 9 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .workLimitExceeded [] componentStreamChunk [] := by
  simp [checkStreamingWireEnvelope, checkStreamingEnvelopeThen,
    scanDecompressionChunks, scanDecompressionChunksAux,
    componentStreamChunks, componentStreamChunk]

theorem componentStreamingWireEnvelope_expandedLimit_firstFailure :
    checkStreamingWireEnvelope 1 8 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentStreamChunks =
        .expandedBudgetExceeded [] componentStreamChunk [] := by
  simp [checkStreamingWireEnvelope, checkStreamingEnvelopeThen,
    scanDecompressionChunks, scanDecompressionChunksAux,
    componentStreamChunks, componentStreamChunk,
    DecompressionChunk.bytes, componentWireEnvelope_size]

def malformedStreamChunks : List DecompressionChunk :=
  [⟨"x", 1⟩]

theorem malformedStreamingWireEnvelope_decodeRejected :
    checkStreamingWireEnvelope 1 1 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 malformedStreamChunks =
        .decodeRejected := by
  apply (checkStreamingEnvelopeThen_eq_decodeRejected_iff 1 1
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) malformedStreamChunks).mpr
  exact ⟨by native_decide, by native_decide,
    by simp [malformedStreamChunks, materializeChunks,
      componentWireEnvelopeDecoder, componentWireEnvelope]⟩

end Sprawlens.FixedPointStreamingDecompression
