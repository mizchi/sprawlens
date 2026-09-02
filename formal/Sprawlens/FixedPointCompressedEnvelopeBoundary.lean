import Sprawlens.FixedPointRawEnvelopeBoundary

namespace Sprawlens.FixedPointCompressedEnvelopeBoundary

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

universe u v w

/-- Every transport/decompression/decoding failure remains distinguishable
from the downstream checked result. -/
inductive CompressedEnvelopeCheckResult (Result : Type u) where
  | compressedBudgetExceeded
  | decompressionRejected
  | expandedBudgetExceeded
  | decodeRejected
  | checked (result : Result)

def CompressedEnvelopeCheckResult.toOption {Result : Type u} :
    CompressedEnvelopeCheckResult Result → Option Result
  | .compressedBudgetExceeded => none
  | .decompressionRejected => none
  | .expandedBudgetExceeded => none
  | .decodeRejected => none
  | .checked result => some result

/-- `compressedWeight` can be instantiated with a real byte-buffer length;
the decompressed representation is bounded before the decoder is called. -/
def checkCompressedEnvelopeThen
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) : CompressedEnvelopeCheckResult Result :=
  if _compressedWithin : compressedWeight input ≤ maxCompressedBytes then
    match decompress input with
    | none => .decompressionRejected
    | some raw =>
        if _expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes then
          match decode raw with
          | none => .decodeRejected
          | some artifact => .checked (check artifact)
        else .expandedBudgetExceeded
  else .compressedBudgetExceeded

theorem checkCompressedEnvelopeThen_eq_compressedBudgetExceeded_iff
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
        maxExpandedBytes decompress decode check input =
        .compressedBudgetExceeded ↔
      ¬compressedWeight input ≤ maxCompressedBytes := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases decompressed : decompress input with
    | none => simp [checkCompressedEnvelopeThen, compressedWithin, decompressed]
    | some raw =>
        by_cases expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes
        · cases decoded : decode raw <;>
            simp [checkCompressedEnvelopeThen, compressedWithin,
              decompressed, expandedWithin, decoded]
        · simp [checkCompressedEnvelopeThen, compressedWithin,
            decompressed, expandedWithin]
  · simp [checkCompressedEnvelopeThen, compressedWithin]

theorem checkCompressedEnvelopeThen_eq_decompressionRejected_iff
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
        maxExpandedBytes decompress decode check input =
        .decompressionRejected ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        decompress input = none := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases decompressed : decompress input with
    | none => simp [checkCompressedEnvelopeThen, compressedWithin, decompressed]
    | some raw =>
        by_cases expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes
        · cases decoded : decode raw <;>
            simp [checkCompressedEnvelopeThen, compressedWithin,
              decompressed, expandedWithin, decoded]
        · simp [checkCompressedEnvelopeThen, compressedWithin,
            decompressed, expandedWithin]
  · simp [checkCompressedEnvelopeThen, compressedWithin]

theorem checkCompressedEnvelopeThen_eq_expandedBudgetExceeded_iff
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
        maxExpandedBytes decompress decode check input =
        .expandedBudgetExceeded ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        ∃ raw, decompress input = some raw ∧
          ¬raw.utf8ByteSize ≤ maxExpandedBytes := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases decompressed : decompress input with
    | none => simp [checkCompressedEnvelopeThen, compressedWithin, decompressed]
    | some raw =>
        by_cases expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes
        · cases decoded : decode raw <;>
            simp [checkCompressedEnvelopeThen, compressedWithin,
              decompressed, expandedWithin, decoded]
        · simp [checkCompressedEnvelopeThen, compressedWithin,
            decompressed, expandedWithin]
          omega
  · simp [checkCompressedEnvelopeThen, compressedWithin]

theorem checkCompressedEnvelopeThen_eq_decodeRejected_iff
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
        maxExpandedBytes decompress decode check input = .decodeRejected ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        ∃ raw, decompress input = some raw ∧
          raw.utf8ByteSize ≤ maxExpandedBytes ∧ decode raw = none := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases decompressed : decompress input with
    | none => simp [checkCompressedEnvelopeThen, compressedWithin, decompressed]
    | some raw =>
        by_cases expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes
        · cases decoded : decode raw <;>
            simp [checkCompressedEnvelopeThen, compressedWithin,
              decompressed, expandedWithin, decoded]
        · simp [checkCompressedEnvelopeThen, compressedWithin,
            decompressed, expandedWithin]
  · simp [checkCompressedEnvelopeThen, compressedWithin]

theorem checkCompressedEnvelopeThen_eq_checked_iff
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) (result : Result) :
    checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
        maxExpandedBytes decompress decode check input = .checked result ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        ∃ raw artifact,
          decompress input = some raw ∧
          raw.utf8ByteSize ≤ maxExpandedBytes ∧
          decode raw = some artifact ∧ check artifact = result := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases decompressed : decompress input with
    | none => simp [checkCompressedEnvelopeThen, compressedWithin, decompressed]
    | some raw =>
        by_cases expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes
        · cases decoded : decode raw with
          | none => simp [checkCompressedEnvelopeThen, compressedWithin,
              decompressed, expandedWithin, decoded]
          | some artifact =>
              simp [checkCompressedEnvelopeThen, compressedWithin,
                decompressed, expandedWithin, decoded]
        · simp [checkCompressedEnvelopeThen, compressedWithin,
            decompressed, expandedWithin]
  · simp [checkCompressedEnvelopeThen, compressedWithin]

def decodeCompressedEnvelopeWithinBudgetsThen
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) : Option Result :=
  if compressedWeight input ≤ maxCompressedBytes then
    match decompress input with
    | none => none
    | some raw =>
        if raw.utf8ByteSize ≤ maxExpandedBytes then
          (decode raw).map check
        else none
  else none

theorem checkCompressedEnvelopeThen_toOption_eq
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (input : Compressed) :
    (checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
      maxExpandedBytes decompress decode check input).toOption =
        decodeCompressedEnvelopeWithinBudgetsThen compressedWeight
          maxCompressedBytes maxExpandedBytes decompress decode check input := by
  by_cases compressedWithin : compressedWeight input ≤ maxCompressedBytes
  · cases decompressed : decompress input with
    | none => simp [checkCompressedEnvelopeThen,
        decodeCompressedEnvelopeWithinBudgetsThen,
        CompressedEnvelopeCheckResult.toOption, compressedWithin,
        decompressed]
    | some raw =>
        by_cases expandedWithin : raw.utf8ByteSize ≤ maxExpandedBytes
        · cases decoded : decode raw <;>
            simp [checkCompressedEnvelopeThen,
              decodeCompressedEnvelopeWithinBudgetsThen,
              CompressedEnvelopeCheckResult.toOption, compressedWithin,
              decompressed, expandedWithin, decoded]
        · simp [checkCompressedEnvelopeThen,
            decodeCompressedEnvelopeWithinBudgetsThen,
            CompressedEnvelopeCheckResult.toOption, compressedWithin,
            decompressed, expandedWithin]
  · simp [checkCompressedEnvelopeThen,
      decodeCompressedEnvelopeWithinBudgetsThen,
      CompressedEnvelopeCheckResult.toOption, compressedWithin]

theorem checkCompressedEnvelopeThen_decodeRejected_mono
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    {compressedSmaller compressedLarger expandedSmaller expandedLarger : Nat}
    (compressedLe : compressedSmaller ≤ compressedLarger)
    (expandedLe : expandedSmaller ≤ expandedLarger)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result) (input : Compressed)
    (rejected : checkCompressedEnvelopeThen compressedWeight compressedSmaller
      expandedSmaller decompress decode check input = .decodeRejected) :
    checkCompressedEnvelopeThen compressedWeight compressedLarger
      expandedLarger decompress decode check input = .decodeRejected := by
  have info := (checkCompressedEnvelopeThen_eq_decodeRejected_iff
    compressedWeight compressedSmaller expandedSmaller decompress decode check
    input).mp rejected
  obtain ⟨compressedWithin, raw, decompressed, expandedWithin, decoded⟩ := info
  exact (checkCompressedEnvelopeThen_eq_decodeRejected_iff compressedWeight
    compressedLarger expandedLarger decompress decode check input).mpr
      ⟨compressedWithin.trans compressedLe, raw, decompressed,
        expandedWithin.trans expandedLe, decoded⟩

theorem checkCompressedEnvelopeThen_checked_mono
    {Compressed : Type u} {Artifact : Type v} {Result : Type w}
    (compressedWeight : Compressed → Nat)
    {compressedSmaller compressedLarger expandedSmaller expandedLarger : Nat}
    (compressedLe : compressedSmaller ≤ compressedLarger)
    (expandedLe : expandedSmaller ≤ expandedLarger)
    (decompress : Compressed → Option String)
    (decode : String → Option Artifact)
    (check : Artifact → Result) (input : Compressed) (result : Result)
    (accepted : checkCompressedEnvelopeThen compressedWeight compressedSmaller
      expandedSmaller decompress decode check input = .checked result) :
    checkCompressedEnvelopeThen compressedWeight compressedLarger
      expandedLarger decompress decode check input = .checked result := by
  have info := (checkCompressedEnvelopeThen_eq_checked_iff compressedWeight
    compressedSmaller expandedSmaller decompress decode check input result).mp
      accepted
  obtain ⟨compressedWithin, raw, artifact, decompressed, expandedWithin,
    decoded, checked⟩ := info
  exact (checkCompressedEnvelopeThen_eq_checked_iff compressedWeight
    compressedLarger expandedLarger decompress decode check input result).mpr
      ⟨compressedWithin.trans compressedLe, raw, artifact, decompressed,
        expandedWithin.trans expandedLe, decoded, checked⟩

def stringUtf8Weight (input : String) : Nat := input.utf8ByteSize

def toyDecompressor (input : String) : Option String :=
  if input = "z" then some " {}"
  else if input = "c" then some "{}"
  else if input = "m" then some "x"
  else none

theorem compressedSize_does_not_bound_expandedSize :
    stringUtf8Weight "z" = 1 ∧
      toyDecompressor "z" = some " {}" ∧
      " {}".utf8ByteSize = 3 ∧
      ¬" {}".utf8ByteSize ≤ 2 := by
  unfold stringUtf8Weight toyDecompressor
  native_decide

theorem toyCompressedEnvelope_expandedBudgetExceeded :
    checkCompressedEnvelopeThen stringUtf8Weight 1 2 toyDecompressor
      paddingTolerantUnitDecoder (fun _ => true) "z" =
        .expandedBudgetExceeded := by
  apply (checkCompressedEnvelopeThen_eq_expandedBudgetExceeded_iff
    stringUtf8Weight 1 2 toyDecompressor paddingTolerantUnitDecoder
    (fun _ => true) "z").mpr
  exact ⟨by native_decide, " {}", by native_decide, by native_decide⟩

theorem toyCompressedEnvelope_exactBoundary_checked :
    checkCompressedEnvelopeThen stringUtf8Weight 1 2 toyDecompressor
      paddingTolerantUnitDecoder (fun _ => true) "c" = .checked true := by
  apply (checkCompressedEnvelopeThen_eq_checked_iff stringUtf8Weight 1 2
    toyDecompressor paddingTolerantUnitDecoder (fun _ => true) "c" true).mpr
  exact ⟨by native_decide, "{}", (), by native_decide, by native_decide,
    by native_decide, rfl⟩

theorem toyCompressedEnvelope_compressedBudgetExceeded :
    checkCompressedEnvelopeThen stringUtf8Weight 0 2 toyDecompressor
      paddingTolerantUnitDecoder (fun _ => true) "c" =
        .compressedBudgetExceeded := by
  exact (checkCompressedEnvelopeThen_eq_compressedBudgetExceeded_iff
    stringUtf8Weight 0 2 toyDecompressor paddingTolerantUnitDecoder
    (fun _ => true) "c").mpr (by native_decide)

theorem toyCompressedEnvelope_decompressionRejected :
    checkCompressedEnvelopeThen stringUtf8Weight 1 2 toyDecompressor
      paddingTolerantUnitDecoder (fun _ => true) "q" =
        .decompressionRejected := by
  exact (checkCompressedEnvelopeThen_eq_decompressionRejected_iff
    stringUtf8Weight 1 2 toyDecompressor paddingTolerantUnitDecoder
    (fun _ => true) "q").mpr (by native_decide)

theorem toyCompressedEnvelope_decodeRejected :
    checkCompressedEnvelopeThen stringUtf8Weight 1 2 toyDecompressor
      paddingTolerantUnitDecoder (fun _ => true) "m" = .decodeRejected := by
  apply (checkCompressedEnvelopeThen_eq_decodeRejected_iff stringUtf8Weight
    1 2 toyDecompressor paddingTolerantUnitDecoder (fun _ => true) "m").mpr
  exact ⟨by native_decide, "x", by native_decide, by native_decide,
    by native_decide⟩

/-! ## Composition with the wire reliability checker -/

noncomputable def checkCompressedWireEnvelope
    {Compressed : Type u} {Edit : Type v} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
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
    CompressedEnvelopeCheckResult (WireArtifactCheckResult Edit scale) :=
  checkCompressedEnvelopeThen compressedWeight maxCompressedBytes
    maxExpandedBytes decompress decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) input

theorem checkCompressedWireEnvelope_eq_checked_accepted_iff
    {Compressed : Type u} {Edit : Type v} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (input : Compressed) (result : IntegerReliabilityReport Edit scale) :
    checkCompressedWireEnvelope compressedWeight maxCompressedBytes
        maxExpandedBytes decompress decode scale maxSteps maxScaleBytes
        maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
        maxSchemaWeight Independent encodedCost source actualMargin input =
        .checked (.accepted result) ↔
      compressedWeight input ≤ maxCompressedBytes ∧
        ∃ raw artifact,
          decompress input = some raw ∧
          raw.utf8ByteSize ≤ maxExpandedBytes ∧
          decode raw = some artifact ∧
          checkWireReliabilityArtifact scale maxSteps maxScaleBytes
            maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
            maxSchemaWeight Independent encodedCost source actualMargin
            artifact.report artifact.paths = .accepted result := by
  exact checkCompressedEnvelopeThen_eq_checked_iff compressedWeight
    maxCompressedBytes maxExpandedBytes decompress decode (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) input (.accepted result)

theorem checkCompressedWireEnvelope_target_eq_of_certified
    {Compressed : Type u} {Edit : Type v} [DecidableEq Edit]
    (compressedWeight : Compressed → Nat)
    (maxCompressedBytes maxExpandedBytes : Nat)
    (decompress : Compressed → Option String)
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
    (input : Compressed) (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (accepted : checkCompressedWireEnvelope compressedWeight
      maxCompressedBytes maxExpandedBytes decompress decode scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin input =
        .checked (.accepted result))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, raw, artifact, _, _, _, wireAccepted⟩ :=
    (checkCompressedWireEnvelope_eq_checked_accepted_iff compressedWeight
      maxCompressedBytes maxExpandedBytes decompress decode scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin input
      result).mp accepted
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

def componentWireDecompressor (input : String) : Option String :=
  if input = "c" then some componentWireEnvelope
  else if input = "m" then some "x"
  else none

theorem componentCompressedWireEnvelope_exactBoundary_accepted :
    checkCompressedWireEnvelope stringUtf8Weight 1 9
      componentWireDecompressor componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .checked (.accepted componentCanonicalIntegerReport) := by
  apply (checkCompressedWireEnvelope_eq_checked_accepted_iff
    stringUtf8Weight 1 9 componentWireDecompressor
    componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1 "c"
    componentCanonicalIntegerReport).mpr
  exact ⟨by native_decide, componentWireEnvelope,
    ⟨componentWireReport, componentWirePaths⟩, by native_decide,
    by native_decide, by simp [componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentCompressedWireEnvelope_accepted_under_relaxedBudgets :
    checkCompressedWireEnvelope stringUtf8Weight 2 10
      componentWireDecompressor componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .checked (.accepted componentCanonicalIntegerReport) := by
  exact checkCompressedEnvelopeThen_checked_mono stringUtf8Weight
    (by omega) (by omega) componentWireDecompressor
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "c"
    (.accepted componentCanonicalIntegerReport)
    componentCompressedWireEnvelope_exactBoundary_accepted

theorem componentCompressedWireEnvelope_compressedBudgetExceeded :
    checkCompressedWireEnvelope stringUtf8Weight 0 9
      componentWireDecompressor componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .compressedBudgetExceeded := by
  apply (checkCompressedEnvelopeThen_eq_compressedBudgetExceeded_iff
    stringUtf8Weight 0 9 componentWireDecompressor
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "c").mpr
  native_decide

theorem componentCompressedWireEnvelope_expandedBudgetExceeded :
    checkCompressedWireEnvelope stringUtf8Weight 1 8
      componentWireDecompressor componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "c" =
        .expandedBudgetExceeded := by
  apply (checkCompressedEnvelopeThen_eq_expandedBudgetExceeded_iff
    stringUtf8Weight 1 8 componentWireDecompressor
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "c").mpr
  exact ⟨by native_decide, componentWireEnvelope, by native_decide,
    by native_decide⟩

theorem componentCompressedWireEnvelope_decompressionRejected :
    checkCompressedWireEnvelope stringUtf8Weight 1 9
      componentWireDecompressor componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "q" =
        .decompressionRejected := by
  apply (checkCompressedEnvelopeThen_eq_decompressionRejected_iff
    stringUtf8Weight 1 9 componentWireDecompressor
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "q").mpr
  native_decide

theorem componentCompressedWireEnvelope_decodeRejected :
    checkCompressedWireEnvelope stringUtf8Weight 1 9
      componentWireDecompressor componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "m" = .decodeRejected := by
  apply (checkCompressedEnvelopeThen_eq_decodeRejected_iff stringUtf8Weight
    1 9 componentWireDecompressor componentWireEnvelopeDecoder
    (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "m").mpr
  exact ⟨by native_decide, "x", by native_decide, by native_decide,
    by native_decide⟩

end Sprawlens.FixedPointCompressedEnvelopeBoundary
