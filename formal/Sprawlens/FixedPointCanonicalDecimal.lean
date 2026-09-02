import Sprawlens.FixedPointResourceLimits
import Std.Data.String.ToInt

namespace Sprawlens.FixedPointCanonicalDecimal

open FixedPointEncodedCost

/-- Parse with Lean's decimal parser, then require byte-for-byte equality with
the unique `Int.repr` rendering. This rejects leading zeros, `-0`, plus signs,
whitespace, and every other alias for the same integer. -/
def parseCanonicalInt (text : String) : Option Int :=
  match text.toInt? with
  | none => none
  | some value =>
      if value.repr = text then some value else none

def CanonicalDecimal (text : String) : Prop :=
  ∃ value : Int, text = value.repr

theorem parseCanonicalInt_eq_some_iff
    (text : String) (value : Int) :
    parseCanonicalInt text = some value ↔
      text.toInt? = some value ∧ value.repr = text := by
  cases parsedEq : text.toInt? with
  | none => simp [parseCanonicalInt, parsedEq]
  | some parsed =>
      by_cases canonical : parsed.repr = text
      · constructor
        · intro accepted
          have same : parsed = value := by
            simpa [parseCanonicalInt, parsedEq, canonical] using accepted
          subst value
          exact ⟨rfl, canonical⟩
        · rintro ⟨valueEq, _⟩
          have same : parsed = value :=
            Option.some.inj valueEq
          subst value
          simp [parseCanonicalInt, parsedEq, canonical]
      · constructor
        · intro accepted
          simp [parseCanonicalInt, parsedEq, canonical] at accepted
        · rintro ⟨valueEq, valueCanonical⟩
          have same : parsed = value :=
            Option.some.inj valueEq
          subst value
          exact (canonical valueCanonical).elim

/-- Every integer's standard rendering is accepted. -/
@[simp] theorem parseCanonicalInt_repr (value : Int) :
    parseCanonicalInt value.repr = some value := by
  simp [parseCanonicalInt, Int.toInt?_repr]

/-- Every accepted string is exactly the standard rendering of its result. -/
theorem repr_eq_of_parseCanonicalInt_eq_some
    {text : String} {value : Int}
    (accepted : parseCanonicalInt text = some value) :
    value.repr = text :=
  (parseCanonicalInt_eq_some_iff text value).mp accepted |>.2

theorem parseCanonicalInt_eq_some_iff_repr
    (text : String) (value : Int) :
    parseCanonicalInt text = some value ↔ text = value.repr := by
  constructor
  · exact fun accepted =>
      (repr_eq_of_parseCanonicalInt_eq_some accepted).symm
  · intro canonical
    subst text
    exact parseCanonicalInt_repr value

theorem canonicalDecimal_iff_exists_parse
    (text : String) :
    CanonicalDecimal text ↔
      ∃ value, parseCanonicalInt text = some value := by
  constructor
  · rintro ⟨value, rfl⟩
    exact ⟨value, parseCanonicalInt_repr value⟩
  · rintro ⟨value, accepted⟩
    exact ⟨value, (repr_eq_of_parseCanonicalInt_eq_some accepted).symm⟩

theorem parseCanonicalInt_eq_none_iff
    (text : String) :
    parseCanonicalInt text = none ↔ ¬CanonicalDecimal text := by
  constructor
  · intro rejected canonical
    obtain ⟨value, accepted⟩ :=
      (canonicalDecimal_iff_exists_parse text).mp canonical
    rw [rejected] at accepted
    contradiction
  · intro notCanonical
    cases parsedEq : parseCanonicalInt text with
    | none => rfl
    | some value =>
        exfalso
        exact notCanonical ((canonicalDecimal_iff_exists_parse text).mpr
          ⟨value, parsedEq⟩)

/-- Canonical parsing is injective in its result and representation. -/
theorem parseCanonicalInt_functional
    {text : String} {first second : Int}
    (firstAccepted : parseCanonicalInt text = some first)
    (secondAccepted : parseCanonicalInt text = some second) :
    first = second := by
  rw [firstAccepted] at secondAccepted
  exact Option.some.inj secondAccepted

/-- Character-count guard is evaluated before integer parsing. For ASCII
decimal strings this is also the decimal digit/sign resource bound. -/
def parseCanonicalIntWithinLength
    (maxLength : Nat) (text : String) : Option Int :=
  if _lengthOk : text.length ≤ maxLength
  then parseCanonicalInt text
  else none

theorem parseCanonicalIntWithinLength_eq_some_iff
    (maxLength : Nat) (text : String) (value : Int) :
    parseCanonicalIntWithinLength maxLength text = some value ↔
      text.length ≤ maxLength ∧
        parseCanonicalInt text = some value := by
  by_cases lengthOk : text.length ≤ maxLength <;>
    simp [parseCanonicalIntWithinLength, lengthOk]

theorem parseCanonicalIntWithinLength_sound
    {maxLength : Nat} {text : String} {value : Int}
    (accepted : parseCanonicalIntWithinLength maxLength text = some value) :
    text.length ≤ maxLength ∧ text = value.repr := by
  have info := (parseCanonicalIntWithinLength_eq_some_iff
    maxLength text value).mp accepted
  exact ⟨info.1,
    (repr_eq_of_parseCanonicalInt_eq_some info.2).symm⟩

theorem parseCanonicalIntWithinLength_complete
    (maxLength : Nat) (value : Int)
    (fits : value.repr.length ≤ maxLength) :
    parseCanonicalIntWithinLength maxLength value.repr = some value :=
  (parseCanonicalIntWithinLength_eq_some_iff
    maxLength value.repr value).mpr
      ⟨fits, parseCanonicalInt_repr value⟩

/-- Raw JSON-compatible shape before the decimal string and scale tag are
trusted. -/
structure SerializedTaggedIntCost where
  denominator : Nat
  unitsDecimal : String
deriving DecidableEq, Repr

def parseSerializedCostAtScale
    (expected : PositiveScale) (maxLength : Nat)
    (raw : SerializedTaggedIntCost) : Option (ScaledIntCost expected) :=
  if _tagOk : raw.denominator = expected.denominator then
    match parseCanonicalIntWithinLength maxLength raw.unitsDecimal with
    | none => none
    | some units => some ⟨units⟩
  else
    none

theorem parseSerializedCostAtScale_eq_some_iff_parsed
    (expected : PositiveScale) (maxLength : Nat)
    (raw : SerializedTaggedIntCost) (parsed : ScaledIntCost expected) :
    parseSerializedCostAtScale expected maxLength raw = some parsed ↔
      raw.denominator = expected.denominator ∧
      parseCanonicalIntWithinLength maxLength raw.unitsDecimal =
        some parsed.units := by
  by_cases tagOk : raw.denominator = expected.denominator
  · cases unitsEq :
        parseCanonicalIntWithinLength maxLength raw.unitsDecimal <;>
      simp [parseSerializedCostAtScale, tagOk, unitsEq,
        FixedPointEncodedCost.ext_iff]
  · simp [parseSerializedCostAtScale, tagOk]

theorem parseSerializedCostAtScale_eq_some_iff
    (expected : PositiveScale) (maxLength : Nat)
    (raw : SerializedTaggedIntCost) (parsed : ScaledIntCost expected) :
    parseSerializedCostAtScale expected maxLength raw = some parsed ↔
      raw.denominator = expected.denominator ∧
      raw.unitsDecimal.length ≤ maxLength ∧
      raw.unitsDecimal = parsed.units.repr := by
  rw [parseSerializedCostAtScale_eq_some_iff_parsed]
  simp only [parseCanonicalIntWithinLength_eq_some_iff,
    parseCanonicalInt_eq_some_iff_repr]

example : parseCanonicalInt "0" = some 0 := by native_decide
example : parseCanonicalInt "123" = some 123 := by native_decide
example : parseCanonicalInt "-123" = some (-123) := by native_decide
example : parseCanonicalInt "01" = none := by native_decide
example : parseCanonicalInt "-01" = none := by native_decide
example : parseCanonicalInt "-0" = none := by native_decide
example : parseCanonicalInt "+1" = none := by native_decide
example : parseCanonicalInt " 1" = none := by native_decide
example : parseCanonicalInt "1 " = none := by native_decide

def serialized999 : SerializedTaggedIntCost := ⟨1000, "999"⟩

theorem serialized999_parses :
    parseSerializedCostAtScale ⟨1000, by norm_num⟩ 3 serialized999 =
      some ⟨999⟩ := by native_decide

def serializedLeadingZero : SerializedTaggedIntCost := ⟨1000, "0999"⟩

theorem serializedLeadingZero_rejected :
    parseSerializedCostAtScale ⟨1000, by norm_num⟩ 4
      serializedLeadingZero = none := by native_decide

theorem serialized999_too_long_rejected :
    parseSerializedCostAtScale ⟨1000, by norm_num⟩ 2 serialized999 = none := by
  native_decide

def serializedWrongScale : SerializedTaggedIntCost := ⟨500, "999"⟩

theorem serializedWrongScale_rejected :
    parseSerializedCostAtScale ⟨1000, by norm_num⟩ 3
      serializedWrongScale = none := by native_decide

end Sprawlens.FixedPointCanonicalDecimal
