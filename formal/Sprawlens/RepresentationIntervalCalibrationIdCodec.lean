import Sprawlens.RepresentationIntervalCalibrationCanonicalActive

namespace Sprawlens.RepresentationIntervalCalibrationIdCodec

open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive

universe u v w

/-- The abstract contract required from a production constraint-ID codec.
The wire representation must preserve and reflect the public ID order, and
every encoded ID must decode back to itself. -/
structure OrderedIdCodec
    (Id : Type u) (Wire : Type v)
    [LinearOrder Id] [LinearOrder Wire] where
  encode : Id →o Wire
  decode : Wire → Option Id
  decode_encode : ∀ id, decode (encode id) = some id

def encodedIdCost
    {Id : Type u} {Wire : Type v}
    [LinearOrder Id] [LinearOrder Wire]
    (codec : OrderedIdCodec Id Wire)
    (cost : Id → ℝ)
    (wire : Wire) : ℝ :=
  match codec.decode wire with
  | some id => cost id
  | none => 0

theorem encodedIdCost_encode
    {Id : Type u} {Wire : Type v}
    [LinearOrder Id] [LinearOrder Wire]
    (codec : OrderedIdCodec Id Wire)
    (cost : Id → ℝ)
    (id : Id) :
    encodedIdCost codec cost (codec.encode id) = cost id := by
  simp [encodedIdCost, codec.decode_encode]

theorem encodedCanonicalArgmin_eq_encode
    {Id : Type u} {Wire : Type v}
    [LinearOrder Id] [LinearOrder Wire]
    (codec : OrderedIdCodec Id Wire)
    (ids : Finset Id)
    (nonempty : ids.Nonempty)
    (cost : Id → ℝ) :
    finiteCanonicalArgmin (ids.image codec.encode) (nonempty.image codec.encode)
        (encodedIdCost codec cost) =
      codec.encode (finiteCanonicalArgmin ids nonempty cost) := by
  apply isFiniteCanonicalArgmin_unique
    (ids.image codec.encode) (encodedIdCost codec cost)
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨Finset.mem_image.mpr
        ⟨finiteCanonicalArgmin ids nonempty cost,
          finiteCanonicalArgmin_mem ids nonempty cost, rfl⟩, ?_, ?_⟩
    · intro wire wireMem
      obtain ⟨id, idMem, rfl⟩ := Finset.mem_image.mp wireMem
      simpa only [encodedIdCost_encode] using
        (finiteCanonicalArgmin_cost_le ids nonempty cost id idMem)
    · intro wire wireMem costEq
      obtain ⟨id, idMem, rfl⟩ := Finset.mem_image.mp wireMem
      simp only [encodedIdCost_encode] at costEq
      exact codec.encode.monotone
        (finiteCanonicalArgmin_le_of_cost_eq ids nonempty cost id idMem costEq)

theorem decode_encodedCanonicalArgmin
    {Id : Type u} {Wire : Type v}
    [LinearOrder Id] [LinearOrder Wire]
    (codec : OrderedIdCodec Id Wire)
    (ids : Finset Id)
    (nonempty : ids.Nonempty)
    (cost : Id → ℝ) :
    codec.decode
        (finiteCanonicalArgmin (ids.image codec.encode)
          (nonempty.image codec.encode) (encodedIdCost codec cost)) =
      some (finiteCanonicalArgmin ids nonempty cost) := by
  rw [encodedCanonicalArgmin_eq_encode]
  exact codec.decode_encode _

theorem encodedCanonicalActiveConstraints_eq
    {Artifact : Type u} {Constraint : Type v} {Wire : Type w}
    [LinearOrder Constraint] [LinearOrder Wire]
    {source target : Artifact → Set ℝ}
    (codec : OrderedIdCodec Constraint Wire)
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints) :
    finiteCanonicalArgmin
          ((observedLowerActiveSet observedLower artifact constraints nonempty).image
            codec.encode)
          ((observedLowerActiveSet_nonempty observedLower artifact constraints
            nonempty).image codec.encode)
          (encodedIdCost codec (lowerTraceEnvelopeAt family)) =
        codec.encode
          (canonicalLowerActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) ∧
      finiteCanonicalArgmin
          ((observedUpperActiveSet observedUpper artifact constraints nonempty).image
            codec.encode)
          ((observedUpperActiveSet_nonempty observedUpper artifact constraints
            nonempty).image codec.encode)
          (encodedIdCost codec (upperTraceEnvelopeAt family)) =
        codec.encode
          (canonicalUpperActiveConstraint pipeline exactLower exactUpper
            observedLower observedUpper artifact constraints nonempty family) := by
  exact ⟨encodedCanonicalArgmin_eq_encode codec _ _ _,
    encodedCanonicalArgmin_eq_encode codec _ _ _⟩

theorem decode_encodedCanonicalActiveConstraints
    {Artifact : Type u} {Constraint : Type v} {Wire : Type w}
    [LinearOrder Constraint] [LinearOrder Wire]
    {source target : Artifact → Set ℝ}
    (codec : OrderedIdCodec Constraint Wire)
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints) :
    codec.decode
          (finiteCanonicalArgmin
            ((observedLowerActiveSet observedLower artifact constraints
              nonempty).image codec.encode)
            ((observedLowerActiveSet_nonempty observedLower artifact constraints
              nonempty).image codec.encode)
            (encodedIdCost codec (lowerTraceEnvelopeAt family))) =
        some (canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family) ∧
      codec.decode
          (finiteCanonicalArgmin
            ((observedUpperActiveSet observedUpper artifact constraints
              nonempty).image codec.encode)
            ((observedUpperActiveSet_nonempty observedUpper artifact constraints
              nonempty).image codec.encode)
            (encodedIdCost codec (upperTraceEnvelopeAt family))) =
        some (canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family) := by
  exact ⟨decode_encodedCanonicalArgmin codec _ _ _,
    decode_encodedCanonicalArgmin codec _ _ _⟩

def boolNatValue (id : Bool) : ℕ :=
  if id then 1 else 0

def boolNatEncode : Bool →o ℕ :=
  OrderEmbedding.ofStrictMono boolNatValue (by
    intro first second firstLtSecond
    obtain ⟨rfl, rfl⟩ := Bool.lt_iff.mp firstLtSecond
    norm_num [boolNatValue])

def boolNatDecode (wire : ℕ) : Option Bool :=
  if wire = 0 then some false
  else if wire = 1 then some true
  else none

def boolNatCodec : OrderedIdCodec Bool ℕ where
  encode := boolNatEncode
  decode := boolNatDecode
  decode_encode := by
    intro id
    cases id <;> rfl

def zeroBoolCost (_id : Bool) : ℝ :=
  0

theorem false_isCanonical_zeroBoolCost :
    IsFiniteCanonicalArgmin Finset.univ zeroBoolCost false := by
  refine ⟨by simp, ?_, ?_⟩
  · intro other _
    simp [zeroBoolCost]
  · intro other _ _
    cases other <;> simp

theorem zeroBoolCost_canonicalArgmin_eq_false :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
      zeroBoolCost = false := by
  exact (isFiniteCanonicalArgmin_unique (Finset.univ : Finset Bool)
    zeroBoolCost _ false
      (finiteCanonicalArgmin_isCanonical (Finset.univ : Finset Bool) (by simp)
        zeroBoolCost) false_isCanonical_zeroBoolCost)

theorem boolNatCodec_encodedCanonicalArgmin_eq_zero :
    finiteCanonicalArgmin
        ((Finset.univ : Finset Bool).image boolNatCodec.encode)
        ((show (Finset.univ : Finset Bool).Nonempty by simp).image
          boolNatCodec.encode)
        (encodedIdCost boolNatCodec zeroBoolCost) = 0 := by
  rw [encodedCanonicalArgmin_eq_encode boolNatCodec
      (Finset.univ : Finset Bool) (by simp) zeroBoolCost,
    zeroBoolCost_canonicalArgmin_eq_false]
  rfl

theorem boolNatCodec_decodesCanonicalArgmin_to_false :
    boolNatCodec.decode
        (finiteCanonicalArgmin
          ((Finset.univ : Finset Bool).image boolNatCodec.encode)
          ((show (Finset.univ : Finset Bool).Nonempty by simp).image
            boolNatCodec.encode)
          (encodedIdCost boolNatCodec zeroBoolCost)) = some false := by
  rw [decode_encodedCanonicalArgmin boolNatCodec
      (Finset.univ : Finset Bool) (by simp) zeroBoolCost,
    zeroBoolCost_canonicalArgmin_eq_false]

/-- A codec that collapses two IDs to one wire value cannot satisfy even the
round-trip part of the contract. -/
theorem boolUnit_roundtrip_impossible :
    ¬ ∃ decode : Unit → Option Bool,
      ∀ id : Bool, decode () = some id := by
  rintro ⟨decode, roundtrip⟩
  have falseRoundtrip := roundtrip false
  have trueRoundtrip := roundtrip true
  rw [falseRoundtrip] at trueRoundtrip
  simp at trueRoundtrip

def reversedBoolNatEncode (id : Bool) : ℕ :=
  if id then 0 else 1

def reversedBoolNatDecode (wire : ℕ) : Option Bool :=
  if wire = 0 then some true
  else if wire = 1 then some false
  else none

theorem reversedBoolNat_roundtrip (id : Bool) :
    reversedBoolNatDecode (reversedBoolNatEncode id) = some id := by
  cases id <;> rfl

theorem reversedBoolNatEncode_not_monotone :
    ¬ Monotone reversedBoolNatEncode := by
  intro monotone
  have encodedOrder := monotone Bool.false_lt_true.le
  norm_num [reversedBoolNatEncode] at encodedOrder

def reversedEncodedZeroCost (_wire : ℕ) : ℝ :=
  0

theorem zero_isCanonical_reversedEncodedZeroCost :
    IsFiniteCanonicalArgmin
      ((Finset.univ : Finset Bool).image reversedBoolNatEncode)
      reversedEncodedZeroCost 0 := by
  refine ⟨Finset.mem_image.mpr ⟨true, by simp, rfl⟩, ?_, ?_⟩
  · intro other _
    simp [reversedEncodedZeroCost]
  · intro other _ _
    exact Nat.zero_le other

theorem reversedRoundtrip_changes_equalCost_canonicalId :
    finiteCanonicalArgmin
          ((Finset.univ : Finset Bool).image reversedBoolNatEncode)
          ((show (Finset.univ : Finset Bool).Nonempty by simp).image
            reversedBoolNatEncode)
          reversedEncodedZeroCost = 0 ∧
      reversedBoolNatDecode 0 = some true ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) (by simp)
          zeroBoolCost = false := by
  constructor
  · exact isFiniteCanonicalArgmin_unique _ _ _ 0
      (finiteCanonicalArgmin_isCanonical _ _ _)
      zero_isCanonical_reversedEncodedZeroCost
  · exact ⟨rfl, zeroBoolCost_canonicalArgmin_eq_false⟩

end Sprawlens.RepresentationIntervalCalibrationIdCodec
