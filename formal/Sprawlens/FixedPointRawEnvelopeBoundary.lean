import Sprawlens.FixedPointWireVerifierMonotonicity

namespace Sprawlens.FixedPointRawEnvelopeBoundary

open ApproximateWeightedNormalization
open EncodedWeightedPathDataVerifier
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointPathDataWitness
open FixedPointWireArtifact
open FixedPointWireDiagnostic
open FixedPointWirePayloadBudget
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict

universe u v

/-- Result of the transport boundary before domain validation. The raw byte
budget and decoder rejection remain distinct from every downstream result. -/
inductive RawEnvelopeCheckResult (Result : Type u) where
  | envelopeBudgetExceeded
  | decodeRejected
  | checked (result : Result)

def RawEnvelopeCheckResult.toOption {Result : Type u} :
    RawEnvelopeCheckResult Result → Option Result
  | .envelopeBudgetExceeded => none
  | .decodeRejected => none
  | .checked result => some result

/-- The byte guard is evaluated on the received string before the decoder is
called. The checker sees only a successfully decoded artifact. -/
def checkRawEnvelopeThen
    {Artifact : Type u} {Result : Type v}
    (maxEnvelopeBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (raw : String) : RawEnvelopeCheckResult Result :=
  if _within : raw.utf8ByteSize ≤ maxEnvelopeBytes then
    match decode raw with
    | none => .decodeRejected
    | some artifact => .checked (check artifact)
  else .envelopeBudgetExceeded

theorem checkRawEnvelopeThen_eq_envelopeBudgetExceeded_iff
    {Artifact : Type u} {Result : Type v}
    (maxEnvelopeBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (raw : String) :
    checkRawEnvelopeThen maxEnvelopeBytes decode check raw =
        .envelopeBudgetExceeded ↔
      ¬raw.utf8ByteSize ≤ maxEnvelopeBytes := by
  by_cases within : raw.utf8ByteSize ≤ maxEnvelopeBytes
  · cases decoded : decode raw <;>
      simp [checkRawEnvelopeThen, within, decoded]
  · simp [checkRawEnvelopeThen, within]

theorem checkRawEnvelopeThen_eq_decodeRejected_iff
    {Artifact : Type u} {Result : Type v}
    (maxEnvelopeBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (raw : String) :
    checkRawEnvelopeThen maxEnvelopeBytes decode check raw =
        .decodeRejected ↔
      raw.utf8ByteSize ≤ maxEnvelopeBytes ∧ decode raw = none := by
  by_cases within : raw.utf8ByteSize ≤ maxEnvelopeBytes
  · cases decoded : decode raw <;>
      simp [checkRawEnvelopeThen, within, decoded]
  · simp [checkRawEnvelopeThen, within]

theorem checkRawEnvelopeThen_eq_checked_iff
    {Artifact : Type u} {Result : Type v}
    (maxEnvelopeBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (raw : String) (result : Result) :
    checkRawEnvelopeThen maxEnvelopeBytes decode check raw =
        .checked result ↔
      raw.utf8ByteSize ≤ maxEnvelopeBytes ∧
        ∃ artifact, decode raw = some artifact ∧ check artifact = result := by
  by_cases within : raw.utf8ByteSize ≤ maxEnvelopeBytes
  · cases decoded : decode raw with
    | none => simp [checkRawEnvelopeThen, within, decoded]
    | some artifact =>
        constructor
        · intro outputEq
          have checkEq : check artifact = result := by
            simpa [checkRawEnvelopeThen, within, decoded] using outputEq
          exact ⟨within, artifact, rfl, checkEq⟩
        · rintro ⟨_, other, otherDecoded, otherResult⟩
          have sameArtifact : artifact = other := Option.some.inj otherDecoded
          subst other
          simpa [checkRawEnvelopeThen, within, decoded] using otherResult
  · simp [checkRawEnvelopeThen, within]

def decodeRawEnvelopeWithinBudgetThen
    {Artifact : Type u} {Result : Type v}
    (maxEnvelopeBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (raw : String) : Option Result :=
  if raw.utf8ByteSize ≤ maxEnvelopeBytes then
    (decode raw).map check
  else none

theorem checkRawEnvelopeThen_toOption_eq
    {Artifact : Type u} {Result : Type v}
    (maxEnvelopeBytes : Nat)
    (decode : String → Option Artifact)
    (check : Artifact → Result)
    (raw : String) :
    (checkRawEnvelopeThen maxEnvelopeBytes decode check raw).toOption =
      decodeRawEnvelopeWithinBudgetThen maxEnvelopeBytes decode check raw := by
  by_cases within : raw.utf8ByteSize ≤ maxEnvelopeBytes
  · cases decoded : decode raw <;>
      simp [checkRawEnvelopeThen, decodeRawEnvelopeWithinBudgetThen,
        RawEnvelopeCheckResult.toOption, within, decoded]
  · simp [checkRawEnvelopeThen, decodeRawEnvelopeWithinBudgetThen,
      RawEnvelopeCheckResult.toOption, within]

theorem checkRawEnvelopeThen_decodeRejected_mono
    {Artifact : Type u} {Result : Type v}
    {smaller larger : Nat} (budgetLe : smaller ≤ larger)
    (decode : String → Option Artifact)
    (check : Artifact → Result) (raw : String)
    (rejected : checkRawEnvelopeThen smaller decode check raw =
      .decodeRejected) :
    checkRawEnvelopeThen larger decode check raw = .decodeRejected := by
  have info := (checkRawEnvelopeThen_eq_decodeRejected_iff smaller decode
    check raw).mp rejected
  exact (checkRawEnvelopeThen_eq_decodeRejected_iff larger decode check
    raw).mpr ⟨info.1.trans budgetLe, info.2⟩

theorem checkRawEnvelopeThen_checked_mono
    {Artifact : Type u} {Result : Type v}
    {smaller larger : Nat} (budgetLe : smaller ≤ larger)
    (decode : String → Option Artifact)
    (check : Artifact → Result) (raw : String) (result : Result)
    (accepted : checkRawEnvelopeThen smaller decode check raw =
      .checked result) :
    checkRawEnvelopeThen larger decode check raw = .checked result := by
  have info := (checkRawEnvelopeThen_eq_checked_iff smaller decode check raw
    result).mp accepted
  exact (checkRawEnvelopeThen_eq_checked_iff larger decode check raw
    result).mpr ⟨info.1.trans budgetLe, info.2⟩

/-- A post-decode canonical re-encoding check. The counterexample below shows
why it cannot replace the pre-decode raw guard. -/
def CanonicalReencodingWithinBudget
    {Artifact : Type u} (encode : Artifact → String)
    (maxEnvelopeBytes : Nat) (artifact : Artifact) : Prop :=
  (encode artifact).utf8ByteSize ≤ maxEnvelopeBytes

def canonicalUnitEnvelope (_ : Unit) : String := "{}"

def paddingTolerantUnitDecoder (raw : String) : Option Unit :=
  if raw = "{}" ∨ raw = " {}" then some () else none

theorem canonicalUnitEnvelope_size :
    (canonicalUnitEnvelope ()).utf8ByteSize = 2 := by
  native_decide

theorem paddedUnitEnvelope_size : " {}".utf8ByteSize = 3 := by
  native_decide

/-- The decoder accepts a three-byte padded representation whose canonical
re-encoding fits two bytes. Checking only the latter undercounts received
bytes. -/
theorem canonicalReencoding_does_not_bound_rawEnvelope :
    paddingTolerantUnitDecoder " {}" = some () ∧
      CanonicalReencodingWithinBudget canonicalUnitEnvelope 2 () ∧
      ¬" {}".utf8ByteSize ≤ 2 := by
  unfold paddingTolerantUnitDecoder CanonicalReencodingWithinBudget
    canonicalUnitEnvelope
  native_decide

theorem paddedUnitEnvelope_predecode_rejected :
    checkRawEnvelopeThen 2 paddingTolerantUnitDecoder (fun _ => true) " {}" =
      .envelopeBudgetExceeded := by
  exact (checkRawEnvelopeThen_eq_envelopeBudgetExceeded_iff 2
    paddingTolerantUnitDecoder (fun _ => true) " {}").mpr (by native_decide)

theorem malformedUnitEnvelope_decodeRejected :
    checkRawEnvelopeThen 2 paddingTolerantUnitDecoder (fun _ => true) "x" =
      .decodeRejected := by
  exact (checkRawEnvelopeThen_eq_decodeRejected_iff 2
    paddingTolerantUnitDecoder (fun _ => true) "x").mpr (by native_decide)

theorem canonicalUnitEnvelope_exactBoundary_checked :
    checkRawEnvelopeThen 2 paddingTolerantUnitDecoder (fun _ => true) "{}" =
      .checked true := by
  exact (checkRawEnvelopeThen_eq_checked_iff 2 paddingTolerantUnitDecoder
    (fun _ => true) "{}" true).mpr ⟨by native_decide, (), by native_decide⟩

/-! ## Composition with the wire reliability checker -/

structure DecodedWireArtifact (Edit : Type u) where
  report : WireTaggedIntegerReport Edit
  paths : WireModePaths Edit

/-- The decoder itself remains an explicit production refinement obligation.
Whatever it returns is still subjected to the full proved wire checker. -/
noncomputable def checkRawWireEnvelope
    {Edit : Type u} [DecidableEq Edit]
    (maxEnvelopeBytes : Nat)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (raw : String) : RawEnvelopeCheckResult (WireArtifactCheckResult Edit scale) :=
  checkRawEnvelopeThen maxEnvelopeBytes decode (fun artifact =>
    checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
      maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
      Independent encodedCost source actualMargin artifact.report
      artifact.paths) raw

theorem checkRawWireEnvelope_eq_checked_accepted_iff
    {Edit : Type u} [DecidableEq Edit]
    (maxEnvelopeBytes : Nat)
    (decode : String → Option (DecodedWireArtifact Edit))
    (scale : PositiveScale)
    (maxSteps maxScaleBytes maxUnitBytes : Nat)
    (maxTargetLength maxTotalTargetEdits : Nat)
    (editWeight : Edit → Nat) (maxSchemaWeight : Nat)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost scale)
    (source : List Edit) (actualMargin : ℝ)
    (raw : String) (result : IntegerReliabilityReport Edit scale) :
    checkRawWireEnvelope maxEnvelopeBytes decode scale maxSteps maxScaleBytes
        maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
        maxSchemaWeight Independent encodedCost source actualMargin raw =
        .checked (.accepted result) ↔
      raw.utf8ByteSize ≤ maxEnvelopeBytes ∧
        ∃ artifact, decode raw = some artifact ∧
          checkWireReliabilityArtifact scale maxSteps maxScaleBytes
            maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
            maxSchemaWeight Independent encodedCost source actualMargin
            artifact.report artifact.paths = .accepted result := by
  exact checkRawEnvelopeThen_eq_checked_iff maxEnvelopeBytes decode
    (fun artifact =>
      checkWireReliabilityArtifact scale maxSteps maxScaleBytes maxUnitBytes
        maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
        Independent encodedCost source actualMargin artifact.report
        artifact.paths) raw (.accepted result)

theorem checkRawWireEnvelope_target_eq_of_certified
    {Edit : Type u} [DecidableEq Edit]
    (maxEnvelopeBytes : Nat)
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
    (raw : String) (result : IntegerReliabilityReport Edit scale)
    (within : PrimitiveSwapCostWithinBy Independent exactCost approximateCost
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost))
    (marginNonnegative : 0 ≤ actualMargin)
    (stable : result.decode.requiredError < actualMargin →
      result.selectedTarget = result.bestTarget)
    (accepted : checkRawWireEnvelope maxEnvelopeBytes decode scale maxSteps
      maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight
      maxSchemaWeight Independent encodedCost source actualMargin raw =
        .checked (.accepted result))
    (certified : result.verdict = .certifiedStable) :
    result.selectedTarget = result.bestTarget := by
  obtain ⟨_, artifact, _, wireAccepted⟩ :=
    (checkRawWireEnvelope_eq_checked_accepted_iff maxEnvelopeBytes decode scale
      maxSteps maxScaleBytes maxUnitBytes maxTargetLength maxTotalTargetEdits
      editWeight maxSchemaWeight Independent encodedCost source actualMargin
      raw result).mp accepted
  exact checkWire_target_eq_of_certified scale maxSteps maxScaleBytes
    maxUnitBytes maxTargetLength maxTotalTargetEdits editWeight maxSchemaWeight
    Independent exactCost approximateCost encodedCost source actualMargin
    artifact.report artifact.paths result within marginNonnegative stable
    wireAccepted certified

def componentWireEnvelope : String := "component"

def componentWireEnvelopeDecoder
    (raw : String) : Option (DecodedWireArtifact NontrivialEdit) :=
  if raw = componentWireEnvelope then
    some ⟨componentWireReport, componentWirePaths⟩
  else none

theorem componentWireEnvelope_size : componentWireEnvelope.utf8ByteSize = 9 := by
  native_decide

theorem componentRawWireEnvelope_exactBoundary_accepted :
    checkRawWireEnvelope 9 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireEnvelope =
        .checked (.accepted componentCanonicalIntegerReport) := by
  apply (checkRawWireEnvelope_eq_checked_accepted_iff 9
    componentWireEnvelopeDecoder milliScale 1 4 4 3 9 oneBytePerEdit 32
    NontrivialIndependent componentMilliErrorCost nontrivialSource 1
    componentWireEnvelope componentCanonicalIntegerReport).mpr
  exact ⟨by native_decide, ⟨componentWireReport, componentWirePaths⟩,
    by simp [componentWireEnvelopeDecoder],
    componentWireArtifact_diagnostic_accepted⟩

theorem componentRawWireEnvelope_budget_rejected :
    checkRawWireEnvelope 8 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireEnvelope =
        .envelopeBudgetExceeded := by
  apply (checkRawEnvelopeThen_eq_envelopeBudgetExceeded_iff 8
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) componentWireEnvelope).mpr
  native_decide

theorem componentRawWireEnvelope_accepted_under_relaxedBudget :
    checkRawWireEnvelope 10 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 componentWireEnvelope =
        .checked (.accepted componentCanonicalIntegerReport) := by
  exact checkRawEnvelopeThen_checked_mono (by omega)
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) componentWireEnvelope
    (.accepted componentCanonicalIntegerReport)
    componentRawWireEnvelope_exactBoundary_accepted

theorem malformedRawWireEnvelope_decodeRejected :
    checkRawWireEnvelope 9 componentWireEnvelopeDecoder milliScale
      1 4 4 3 9 oneBytePerEdit 32 NontrivialIndependent
      componentMilliErrorCost nontrivialSource 1 "x" = .decodeRejected := by
  apply (checkRawEnvelopeThen_eq_decodeRejected_iff 9
    componentWireEnvelopeDecoder (fun artifact =>
      checkWireReliabilityArtifact milliScale 1 4 4 3 9 oneBytePerEdit 32
        NontrivialIndependent componentMilliErrorCost nontrivialSource 1
        artifact.report artifact.paths) "x").mpr
  native_decide

end Sprawlens.FixedPointRawEnvelopeBoundary
