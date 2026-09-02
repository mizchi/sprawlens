import Sprawlens.FixedPointStreamingProducer

namespace Sprawlens.FixedPointCompressedStreamingProducer

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointCompressedEnvelopeBoundary
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

def effectiveExpandedBudget
    {Compressed : Type u}
    (compressedWeight : Compressed → Nat)
    (maxExpandedBytes maxExpansionRatio : Nat)
    (input : Compressed) : Nat :=
  min maxExpandedBytes (maxExpansionRatio * compressedWeight input)

theorem effectiveExpandedBudget_le_absolute
    {Compressed : Type u}
    (compressedWeight : Compressed → Nat)
    (maxExpandedBytes maxExpansionRatio : Nat)
    (input : Compressed) :
    effectiveExpandedBudget compressedWeight maxExpandedBytes
      maxExpansionRatio input ≤ maxExpandedBytes := by
  exact Nat.min_le_left _ _

theorem effectiveExpandedBudget_le_ratio
    {Compressed : Type u}
    (compressedWeight : Compressed → Nat)
    (maxExpandedBytes maxExpansionRatio : Nat)
    (input : Compressed) :
    effectiveExpandedBudget compressedWeight maxExpandedBytes
      maxExpansionRatio input ≤
        maxExpansionRatio * compressedWeight input := by
  exact Nat.min_le_right _ _

theorem effectiveExpandedBudget_mono
    {Compressed : Type u}
    (compressedWeight : Compressed → Nat)
    {expandedSmaller expandedLarger ratioSmaller ratioLarger : Nat}
    (expandedLe : expandedSmaller ≤ expandedLarger)
    (ratioLe : ratioSmaller ≤ ratioLarger)
    (input : Compressed) :
    effectiveExpandedBudget compressedWeight expandedSmaller ratioSmaller
        input ≤
      effectiveExpandedBudget compressedWeight expandedLarger ratioLarger
        input := by
  exact min_le_min expandedLe
    (Nat.mul_le_mul_right (compressedWeight input) ratioLe)

/-- The outer transport and decompressor-initialization refusals remain
separate from the complete pull-based producer diagnostic. -/
inductive CompressedProducerEnvelopeResult
    (State : Type u) (Result : Type v) where
  | compressedBudgetExceeded
  | initializationRejected
  | producer (result : ProducerEnvelopeCheckResult State Result)

def checkCompressedProducerEnvelopeThen
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) : CompressedProducerEnvelopeResult State Result :=
  if _compressedWithin : compressedWeight input ≤ maxCompressedBytes then
    match startProducer input with
    | none => .initializationRejected
    | some initial =>
        .producer (checkProducerEnvelopeThen maxPulls maxWork
          (effectiveExpandedBudget compressedWeight maxExpandedBytes
            maxExpansionRatio input) pull decode check initial)
  else .compressedBudgetExceeded

theorem checkCompressedProducerEnvelopeThen_eq_compressedBudgetExceeded_iff
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    checkCompressedProducerEnvelopeThen compressedWeight maxCompressedBytes
        maxPulls maxWork maxExpandedBytes maxExpansionRatio startProducer pull
        decode check input = .compressedBudgetExceeded ↔
      ¬compressedWeight input ≤ maxCompressedBytes := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases initializedEq : startProducer input <;>
      simp [checkCompressedProducerEnvelopeThen, compressedWithin,
        initializedEq]
  · simp [checkCompressedProducerEnvelopeThen, compressedWithin]

theorem checkCompressedProducerEnvelopeThen_eq_initializationRejected_iff
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    checkCompressedProducerEnvelopeThen compressedWeight maxCompressedBytes
        maxPulls maxWork maxExpandedBytes maxExpansionRatio startProducer pull
        decode check input = .initializationRejected ↔
      compressedWeight input ≤ maxCompressedBytes ∧ startProducer input = none := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases initializedEq : startProducer input <;>
      simp [checkCompressedProducerEnvelopeThen, compressedWithin,
        initializedEq]
  · simp [checkCompressedProducerEnvelopeThen, compressedWithin]

theorem checkCompressedProducerEnvelopeThen_eq_checked_iff
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : Result) :
    checkCompressedProducerEnvelopeThen compressedWeight maxCompressedBytes
        maxPulls maxWork maxExpandedBytes maxExpansionRatio startProducer pull
        decode check input = .producer (.checked accepted finalState result) ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        ∃ initial raw artifact,
          startProducer input = some initial ∧
          runProducer maxPulls maxWork
            (effectiveExpandedBudget compressedWeight maxExpandedBytes
              maxExpansionRatio input) pull initial =
                .completed accepted finalState raw ∧
          decode raw = some artifact ∧
          check artifact = result := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases initializedEq : startProducer input with
    | none =>
        simp [checkCompressedProducerEnvelopeThen, compressedWithin,
          initializedEq]
    | some initial =>
        rw [checkCompressedProducerEnvelopeThen, dif_pos compressedWithin,
          initializedEq]
        simp only [CompressedProducerEnvelopeResult.producer.injEq]
        rw [checkProducerEnvelopeThen_eq_checked_iff]
        constructor
        · rintro ⟨raw, artifact, runEq, decodedEq, checkedEq⟩
          exact ⟨compressedWithin, initial, raw, artifact, rfl,
            runEq, decodedEq, checkedEq⟩
        · rintro ⟨_, witnessInitial, raw, artifact, witnessInitialized,
            runEq, decodedEq, checkedEq⟩
          cases witnessInitialized
          exact ⟨raw, artifact, runEq, decodedEq, checkedEq⟩
  · simp [checkCompressedProducerEnvelopeThen, compressedWithin]

theorem checkCompressedProducerEnvelopeThen_checked_expansion_caps
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : Result)
    (checked : checkCompressedProducerEnvelopeThen compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      startProducer pull decode check input =
        .producer (.checked accepted finalState result)) :
    ∃ raw,
      raw = materializeChunks accepted ∧
      raw.utf8ByteSize ≤ maxExpandedBytes ∧
      raw.utf8ByteSize ≤ maxExpansionRatio * compressedWeight input := by
  obtain ⟨_, initial, raw, artifact, _, runEq, _, _⟩ :=
    (checkCompressedProducerEnvelopeThen_eq_checked_iff compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      startProducer pull decode check input accepted finalState result).mp checked
  have output := runProducer_completed_output_sound maxPulls maxWork
    (effectiveExpandedBudget compressedWeight maxExpandedBytes
      maxExpansionRatio input) pull initial finalState accepted raw runEq
  have effectiveInfo := Nat.le_min.mp output.2.2
  exact ⟨raw, output.1, effectiveInfo.1, effectiveInfo.2⟩

theorem checkCompressedProducerEnvelopeThen_checked_mono
    {Compressed : Type u} {State : Type v}
    {Artifact : Type w} {Result : Type*}
    (compressedWeight : Compressed → Nat)
    {compressedSmaller compressedLarger pullsSmaller pullsLarger
      workSmaller workLarger expandedSmaller expandedLarger
      ratioSmaller ratioLarger : Nat}
    (compressedLe : compressedSmaller ≤ compressedLarger)
    (pullsLe : pullsSmaller ≤ pullsLarger)
    (workLe : workSmaller ≤ workLarger)
    (expandedLe : expandedSmaller ≤ expandedLarger)
    (ratioLe : ratioSmaller ≤ ratioLarger)
    (startProducer : Compressed → Option State)
    (pull : State → ProducerStep State)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : Result)
    (checked : checkCompressedProducerEnvelopeThen compressedWeight
      compressedSmaller pullsSmaller workSmaller expandedSmaller ratioSmaller
      startProducer pull decode check input =
        .producer (.checked accepted finalState result)) :
    checkCompressedProducerEnvelopeThen compressedWeight compressedLarger
      pullsLarger workLarger expandedLarger ratioLarger startProducer pull
      decode check input = .producer (.checked accepted finalState result) := by
  obtain ⟨compressedWithin, initial, raw, artifact, initialized, completed,
      decoded, checkedArtifact⟩ :=
    (checkCompressedProducerEnvelopeThen_eq_checked_iff compressedWeight
      compressedSmaller pullsSmaller workSmaller expandedSmaller ratioSmaller
      startProducer pull decode check input accepted finalState result).mp
      checked
  apply (checkCompressedProducerEnvelopeThen_eq_checked_iff compressedWeight
    compressedLarger pullsLarger workLarger expandedLarger ratioLarger
    startProducer pull decode check input accepted finalState result).mpr
  exact ⟨compressedWithin.trans compressedLe, initial, raw, artifact,
    initialized,
    runProducer_completed_mono pullsLe workLe
      (effectiveExpandedBudget_mono compressedWeight expandedLe ratioLe input)
      pull initial finalState accepted raw completed,
    decoded, checkedArtifact⟩

noncomputable def checkCompressedProducerWireEnvelope
    {Compressed : Type u} {State : Type v}
    {Edit : Type w} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
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
    (input : Compressed) :
    CompressedProducerEnvelopeResult State
      (WireArtifactCheckResult Edit scale) :=
  checkCompressedProducerEnvelopeThen compressedWeight maxCompressedBytes
    maxPulls maxWork maxExpandedBytes maxExpansionRatio startProducer pull decode
    (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) input

theorem checkCompressedProducerWireEnvelope_eq_checked_accepted_iff
    {Compressed : Type u} {State : Type v}
    {Edit : Type w} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
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
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : IntegerReliabilityReport Edit scale) :
    checkCompressedProducerWireEnvelope compressedWeight maxCompressedBytes
        maxPulls maxWork maxExpandedBytes maxExpansionRatio startProducer pull
        decode scale maxSteps maxScaleBytes maxUnitBytes maxTargetLength
        maxTotalTargetEdits editWeight maxSchemaWeight Independent encodedCost
        source actualMargin input =
      .producer (.checked accepted finalState (.accepted result)) ↔
    compressedWeight input ≤ maxCompressedBytes ∧
      ∃ initial raw artifact,
        startProducer input = some initial ∧
        runProducer maxPulls maxWork
          (effectiveExpandedBudget compressedWeight maxExpandedBytes
            maxExpansionRatio input) pull initial =
              .completed accepted finalState raw ∧
        decode raw = some artifact ∧
        checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
          maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
          Independent encodedCost source actualMargin artifact.report
          artifact.paths = .accepted result := by
  exact checkCompressedProducerEnvelopeThen_eq_checked_iff compressedWeight
    maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
    startProducer pull decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) input accepted finalState (.accepted result)

theorem checkCompressedProducerWireEnvelope_target_eq_of_certified
    {Compressed : Type u} {State : Type v}
    {Edit : Type w} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio : Nat)
    (startProducer : Compressed → Option State)
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
    (input : Compressed) (accepted : List DecompressionChunk)
    (finalState : State) (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (checked : checkCompressedProducerWireEnvelope compressedWeight
      maxCompressedBytes maxPulls maxWork maxExpandedBytes maxExpansionRatio
      startProducer pull decode scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin input =
        .producer (.checked accepted finalState (.accepted result)))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, _, _, artifact, _, _, _, wireAccepted⟩ :=
    (checkCompressedProducerWireEnvelope_eq_checked_accepted_iff
      compressedWeight maxCompressedBytes maxPulls maxWork maxExpandedBytes
      maxExpansionRatio startProducer pull decode scale maxSteps maxScaleBytes
      maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin input
      accepted finalState result).mp checked
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

def componentCompressedProducerInitializer
    (input : String) : Option (List DecompressionChunk) :=
  if input = "c" then some componentStreamChunks
  else if input = "m" then some malformedStreamChunks
  else none

theorem componentCompressedProducerWire_exactBoundary_accepted :
    checkCompressedProducerWireEnvelope stringUtf8Weight 1 2 1 9 9
      componentCompressedProducerInitializer listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "c" =
        .producer (.checked componentStreamChunks []
          (.accepted componentCanonicalIntegerReport)) := by
  apply (checkCompressedProducerWireEnvelope_eq_checked_accepted_iff
    stringUtf8Weight 1 2 1 9 9 componentCompressedProducerInitializer
    listChunkProducer componentWireEnvelopeDecoder milliScale 1 4 4 3 9
    oneBytePerEdit 32 NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 "c" componentStreamChunks []
    componentCanonicalIntegerReport).mpr
  exact ⟨by native_decide, componentStreamChunks, componentWireEnvelope,
    ⟨componentWireReport, componentWirePaths⟩,
    by simp [componentCompressedProducerInitializer], by native_decide,
    by simp [componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentCompressedProducerWire_compressedBudgetExceeded :
    checkCompressedProducerWireEnvelope stringUtf8Weight 0 2 1 9 9
      componentCompressedProducerInitializer listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "c" =
        .compressedBudgetExceeded := by
  apply (checkCompressedProducerEnvelopeThen_eq_compressedBudgetExceeded_iff
    stringUtf8Weight 0 2 1 9 9 componentCompressedProducerInitializer
    listChunkProducer componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "c").mpr
  native_decide

theorem componentCompressedProducerWire_initializationRejected :
    checkCompressedProducerWireEnvelope stringUtf8Weight 1 2 1 9 9
      componentCompressedProducerInitializer listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "q" =
        .initializationRejected := by
  apply (checkCompressedProducerEnvelopeThen_eq_initializationRejected_iff
    stringUtf8Weight 1 2 1 9 9 componentCompressedProducerInitializer
    listChunkProducer componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "q").mpr
  exact ⟨by native_decide,
    by simp [componentCompressedProducerInitializer]⟩

theorem componentCompressedProducerWire_ratioExceeded :
    checkCompressedProducerWireEnvelope stringUtf8Weight 1 2 1 9 8
      componentCompressedProducerInitializer listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "c" =
        .producer (.expandedBudgetExceeded [] componentStreamChunk []) := by
  have compressedWithin : stringUtf8Weight "c" ≤ 1 := by native_decide
  have initialized :
      componentCompressedProducerInitializer "c" =
        some componentStreamChunks := by
    simp [componentCompressedProducerInitializer]
  have runner :
      runProducer 2 1
          (effectiveExpandedBudget stringUtf8Weight 9 8 "c")
          listChunkProducer componentStreamChunks =
        .expandedBudgetExceeded [] componentStreamChunk [] := by
    native_decide
  simp [checkCompressedProducerWireEnvelope,
    checkCompressedProducerEnvelopeThen, compressedWithin, initialized,
    checkProducerEnvelopeThen, runner]

theorem malformedCompressedProducerWire_decodeRejected :
    checkCompressedProducerWireEnvelope stringUtf8Weight 1 2 1 9 9
      componentCompressedProducerInitializer listChunkProducer
      componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "m" =
        .producer (.decodeRejected malformedStreamChunks []) := by
  have compressedWithin : stringUtf8Weight "m" ≤ 1 := by native_decide
  have initialized :
      componentCompressedProducerInitializer "m" =
        some malformedStreamChunks := by
    simp [componentCompressedProducerInitializer]
  have runner :
      runProducer 2 1
          (effectiveExpandedBudget stringUtf8Weight 9 9 "m")
          listChunkProducer malformedStreamChunks =
        .completed malformedStreamChunks [] "x" := by
    native_decide
  have decoded : componentWireEnvelopeDecoder "x" = none := by
    simp [componentWireEnvelopeDecoder, componentWireEnvelope]
  simp [checkCompressedProducerWireEnvelope,
    checkCompressedProducerEnvelopeThen, compressedWithin, initialized,
    checkProducerEnvelopeThen, runner, decoded]

end Sprawlens.FixedPointCompressedStreamingProducer
