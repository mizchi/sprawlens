import Sprawlens.FixedPointStreamingResidentMemory

namespace Sprawlens.FixedPointCompressedResidentPipeline

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointCompressedEnvelopeBoundary
open FixedPointCompressedStreamingProducer
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointRawEnvelopeBoundary
open FixedPointStreamingDecompression
open FixedPointStreamingProducer
open FixedPointStreamingResidentMemory
open FixedPointWireArtifact
open FixedPointWireDiagnostic
open FixedPointWirePayloadBudget
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u v w

inductive CompressedResidentEnvelopeResult
    (State : Type u) (Result : Type v) where
  | compressedBudgetExceeded
  | initializationRejected
  | resident (result : ResidentProducerEnvelopeResult State Result)

def checkCompressedResidentEnvelopeThen
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
    (input : Compressed) : CompressedResidentEnvelopeResult State Result :=
  if _compressedWithin : compressedWeight input ≤ maxCompressedBytes then
    match startProducer input with
    | none => .initializationRejected
    | some initial =>
        .resident (checkResidentProducerEnvelopeThen maxPulls maxWork
          (effectiveExpandedBudget compressedWeight maxExpandedBytes
            maxExpansionRatio input) maxMemory stateWeight temporaryWeight
          pull decode check initial)
  else .compressedBudgetExceeded

theorem checkCompressedResidentEnvelopeThen_eq_checked_iff
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
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : Result) :
    checkCompressedResidentEnvelopeThen compressedWeight maxCompressedBytes
        maxPulls maxWork maxExpandedBytes maxExpansionRatio maxMemory
        startProducer stateWeight temporaryWeight pull decode check input =
      .resident (.checked accepted finalState result) ↔
    compressedWeight input ≤ maxCompressedBytes ∧
      ∃ initial raw artifact,
        startProducer input = some initial ∧
        runResidentProducer maxPulls maxWork
          (effectiveExpandedBudget compressedWeight maxExpandedBytes
            maxExpansionRatio input) maxMemory stateWeight temporaryWeight pull
            initial = .completed accepted finalState raw ∧
        decode raw = some artifact ∧
        check artifact = result := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases initializedEq : startProducer input with
    | none =>
        simp [checkCompressedResidentEnvelopeThen, compressedWithin,
          initializedEq]
    | some initial =>
        rw [checkCompressedResidentEnvelopeThen, dif_pos compressedWithin,
          initializedEq]
        simp only [CompressedResidentEnvelopeResult.resident.injEq]
        rw [checkResidentProducerEnvelopeThen_eq_checked_iff]
        constructor
        · rintro ⟨raw, artifact, runEq, decodedEq, checkedEq⟩
          exact ⟨compressedWithin, initial, raw, artifact, rfl, runEq,
            decodedEq, checkedEq⟩
        · rintro ⟨_, witnessInitial, raw, artifact, witnessInitialized,
            runEq, decodedEq, checkedEq⟩
          cases witnessInitialized
          exact ⟨raw, artifact, runEq, decodedEq, checkedEq⟩
  · simp [checkCompressedResidentEnvelopeThen, compressedWithin]

theorem checkCompressedResidentEnvelopeThen_checked_resource_caps
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio maxMemory : Nat)
    (startProducer : Compressed → Option State)
    (stateWeight : State → Nat)
    (temporaryWeight : DecompressionChunk → Nat)
    (pull : Nat → State → BudgetedProducerStep State)
    (honors : HonorsResidentBudget stateWeight temporaryWeight pull)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : Result)
    (checked : checkCompressedResidentEnvelopeThen compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      maxMemory startProducer stateWeight temporaryWeight pull decode check
      input = .resident (.checked accepted finalState result)) :
    ∃ raw,
      raw = materializeChunks accepted ∧
      raw.utf8ByteSize ≤ maxExpandedBytes ∧
      raw.utf8ByteSize ≤ maxExpansionRatio * compressedWeight input ∧
      raw.utf8ByteSize + stateWeight finalState ≤ maxMemory := by
  obtain ⟨_, initial, raw, artifact, _, completed, _, _⟩ :=
    (checkCompressedResidentEnvelopeThen_eq_checked_iff compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      maxMemory startProducer stateWeight temporaryWeight pull decode check
      input accepted finalState result).mp checked
  have memoryInfo := runResidentProducer_completed_memory_sound maxPulls
    maxWork (effectiveExpandedBudget compressedWeight maxExpandedBytes
      maxExpansionRatio input) maxMemory stateWeight temporaryWeight pull
    honors initial finalState accepted raw completed
  have resourceInfo := runResidentProducer_completed_resource_sound maxPulls
    maxWork (effectiveExpandedBudget compressedWeight maxExpandedBytes
      maxExpansionRatio input) maxMemory stateWeight temporaryWeight pull
    initial finalState accepted raw completed
  have expandedEffective :
      raw.utf8ByteSize ≤ effectiveExpandedBudget compressedWeight
        maxExpandedBytes maxExpansionRatio input := by
    rw [memoryInfo.1, materializeChunks_utf8ByteSize]
    exact resourceInfo.2
  have expandedCaps := Nat.le_min.mp expandedEffective
  exact ⟨raw, memoryInfo.1, expandedCaps.1, expandedCaps.2, memoryInfo.2⟩

noncomputable def checkCompressedResidentWireEnvelope
    {Compressed : Type u} {State : Type v}
    {Edit : Type w} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio maxMemory : Nat)
    (startProducer : Compressed → Option State)
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
    (input : Compressed) :
    CompressedResidentEnvelopeResult State (WireArtifactCheckResult Edit scale) :=
  checkCompressedResidentEnvelopeThen compressedWeight maxCompressedBytes
    maxPulls maxWork maxExpandedBytes maxExpansionRatio maxMemory startProducer
    stateWeight temporaryWeight pull decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) input

theorem checkCompressedResidentWireEnvelope_eq_checked_accepted_iff
    {Compressed : Type u} {State : Type v}
    {Edit : Type w} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio maxMemory : Nat)
    (startProducer : Compressed → Option State)
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
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : IntegerReliabilityReport Edit scale) :
    checkCompressedResidentWireEnvelope compressedWeight maxCompressedBytes
        maxPulls maxWork maxExpandedBytes maxExpansionRatio maxMemory
        startProducer stateWeight temporaryWeight pull decode scale maxSteps
        maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
        editWeight maxSchemaWeight Independent encodedCost source actualMargin
        input = .resident (.checked accepted finalState (.accepted result)) ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        ∃ initial raw artifact,
          startProducer input = some initial ∧
          runResidentProducer maxPulls maxWork
            (effectiveExpandedBudget compressedWeight maxExpandedBytes
              maxExpansionRatio input) maxMemory stateWeight temporaryWeight
              pull initial = .completed accepted finalState raw ∧
          decode raw = some artifact ∧
          checkWireReliabilityArtifact scale maxSteps maxScaleBytes
            maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
            maxSchemaWeight Independent encodedCost source actualMargin
            artifact.report artifact.paths = .accepted result := by
  exact checkCompressedResidentEnvelopeThen_eq_checked_iff compressedWeight
    maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
    maxMemory startProducer stateWeight temporaryWeight pull decode
    (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) input accepted finalState (.accepted result)

theorem checkCompressedResidentWireEnvelope_target_eq_of_certified
    {Compressed : Type u} {State : Type v}
    {Edit : Type w} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio maxMemory : Nat)
    (startProducer : Compressed → Option State)
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
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (checked : checkCompressedResidentWireEnvelope compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      maxMemory startProducer stateWeight temporaryWeight pull decode scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      input = .resident (.checked accepted finalState (.accepted result)))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, _, _, artifact, _, _, _, wireAccepted⟩ :=
    (checkCompressedResidentWireEnvelope_eq_checked_accepted_iff
      compressedWeight maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio maxMemory startProducer stateWeight temporaryWeight
      pull decode scale maxSteps maxScaleBytes maxUnitBytes maxTargetLength
      maxTotalTargetEdits editWeight maxSchemaWeight Independent encodedCost
      source actualMargin input accepted finalState result).mp checked
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

def componentCompressedResidentInitializer
    (input : String) : Option (List DecompressionChunk) :=
  if input = "c" then some componentStreamChunks else none

theorem componentCompressedResidentWire_exactBoundary_accepted :
    checkCompressedResidentWireEnvelope stringUtf8Weight 1 2 1 9 9 9
      componentCompressedResidentInitializer zeroStateWeight
      zeroTemporaryWeight budgetedListProducer componentWireEnvelopeDecoder
      milliScale 1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .resident (.checked componentStreamChunks []
          (.accepted componentCanonicalIntegerReport)) := by
  apply (checkCompressedResidentWireEnvelope_eq_checked_accepted_iff
    stringUtf8Weight 1 2 1 9 9 9 componentCompressedResidentInitializer
    zeroStateWeight zeroTemporaryWeight budgetedListProducer
    componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "c"
    componentStreamChunks [] componentCanonicalIntegerReport).mpr
  exact ⟨by native_decide, componentStreamChunks, componentWireEnvelope,
    ⟨componentWireReport, componentWirePaths⟩,
    by simp [componentCompressedResidentInitializer], by native_decide,
    by simp [componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentCompressedResidentWire_ratioExceeded :
    checkCompressedResidentWireEnvelope stringUtf8Weight 1 2 1 9 8 9
      componentCompressedResidentInitializer zeroStateWeight
      zeroTemporaryWeight budgetedListProducer componentWireEnvelopeDecoder
      milliScale 1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .resident (.expandedBudgetExceeded [] componentStreamChunk []) := by
  have compressedWithin : stringUtf8Weight "c" ≤ 1 := by native_decide
  have initialized : componentCompressedResidentInitializer "c" =
      some componentStreamChunks := by
    simp [componentCompressedResidentInitializer]
  have runner :
      runResidentProducer 2 1
          (effectiveExpandedBudget stringUtf8Weight 9 8 "c") 9
          zeroStateWeight zeroTemporaryWeight budgetedListProducer
          componentStreamChunks =
        .expandedBudgetExceeded [] componentStreamChunk [] := by
    native_decide
  simp [checkCompressedResidentWireEnvelope,
    checkCompressedResidentEnvelopeThen, compressedWithin, initialized,
    checkResidentProducerEnvelopeThen, runner]

theorem componentCompressedResidentWire_memoryRefused :
    checkCompressedResidentWireEnvelope stringUtf8Weight 1 2 1 9 9 8
      componentCompressedResidentInitializer zeroStateWeight
      zeroTemporaryWeight budgetedListProducer componentWireEnvelopeDecoder
      milliScale 1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .resident (.memoryRefused [] componentStreamChunks) := by
  have compressedWithin : stringUtf8Weight "c" ≤ 1 := by native_decide
  have initialized : componentCompressedResidentInitializer "c" =
      some componentStreamChunks := by
    simp [componentCompressedResidentInitializer]
  have runner :
      runResidentProducer 2 1
          (effectiveExpandedBudget stringUtf8Weight 9 9 "c") 8
          zeroStateWeight zeroTemporaryWeight budgetedListProducer
          componentStreamChunks = .memoryRefused [] componentStreamChunks := by
    native_decide
  simp [checkCompressedResidentWireEnvelope,
    checkCompressedResidentEnvelopeThen, compressedWithin, initialized,
    checkResidentProducerEnvelopeThen, runner]

end Sprawlens.FixedPointCompressedResidentPipeline
