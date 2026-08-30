import Lean.Data.Json
import Sprawlens.TemporalBarycenter

open Lean
open scoped BigOperators

namespace Sprawlens.CheckBarycenterFixtures

structure PointFixture where
  x : Int
  y : Int
  deriving Repr, FromJson

structure SampleFixture extends PointFixture where
  weight : Int
  deriving Repr, FromJson

structure RationalPointFixture where
  xNumerator : Int
  xDenominator : Int
  yNumerator : Int
  yDenominator : Int
  deriving Repr, FromJson

structure WeightedCase where
  name : String
  samples : Array SampleFixture
  expected : Option RationalPointFixture
  deriving Repr, FromJson

structure AffineCase where
  name : String
  current : PointFixture
  previous : PointFixture
  mixNumerator : Int
  mixDenominator : Int
  expected : RationalPointFixture
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  weightedCases : Array WeightedCase
  affineCases : Array AffineCase
  deriving Repr, FromJson

private abbrev QPoint := ℚ × ℚ

private def PointFixture.toModel (point : PointFixture) : QPoint :=
  (point.x, point.y)

private def rationalPoint (point : RationalPointFixture) : Except String QPoint := do
  if point.xDenominator = 0 || point.yDenominator = 0 then
    throw "rational point denominator must be non-zero"
  return (
    (point.xNumerator : ℚ) / (point.xDenominator : ℚ),
    (point.yNumerator : ℚ) / (point.yDenominator : ℚ)
  )

private def sampleAt (samples : Array SampleFixture) (index : Nat) : SampleFixture :=
  samples[index]?.getD { x := 0, y := 0, weight := 0 }

private def checkWeightedCase (testCase : WeightedCase) : Except String Unit := do
  if testCase.samples.any (fun sample => sample.weight < 0) then
    throw s!"{testCase.name}: fixture weights must be non-negative"
  let indices := Finset.range testCase.samples.size
  let weight : Nat → ℚ := fun index => (sampleAt testCase.samples index).weight
  let point : Nat → QPoint := fun index => (sampleAt testCase.samples index).toPointFixture.toModel
  let total := ∑ index ∈ indices, weight index
  if total = 0 then
    if testCase.expected.isSome then
      throw s!"{testCase.name}: expected no center for zero total weight"
  else
    let expectedFixture ←
      match testCase.expected with
      | some expected => pure expected
      | none => throw s!"{testCase.name}: expected center is missing"
    let expected ← rationalPoint expectedFixture
    let actual := Sprawlens.TemporalBarycenter.barycenter indices weight point
    if actual ≠ expected then
      throw s!"{testCase.name}: expected {repr expected}, received {repr actual}"

private def checkAffineCase (testCase : AffineCase) : Except String Unit := do
  if testCase.mixDenominator = 0 then
    throw s!"{testCase.name}: mix denominator must be non-zero"
  let historyMix : ℚ :=
    (testCase.mixNumerator : ℚ) / (testCase.mixDenominator : ℚ)
  if historyMix < 0 || 1 < historyMix then
    throw s!"{testCase.name}: history mix must be inside 0..1"
  let expected ← rationalPoint testCase.expected
  let actual := Sprawlens.TemporalBarycenter.affineBarycenter
    (R := ℚ) testCase.current.toModel testCase.previous.toModel historyMix
  if actual ≠ expected then
    throw s!"{testCase.name}: expected {repr expected}, received {repr actual}"

def decodeFixture (path : String) : IO Fixture := do
  let contents ← IO.FS.readFile path
  let json ← match Json.parse contents with
    | .ok value => pure value
    | .error message => throw <| IO.userError s!"invalid JSON: {message}"
  match fromJson? json with
  | .ok fixture => pure fixture
  | .error message => throw <| IO.userError s!"invalid fixture: {message}"

def checkFixture (fixture : Fixture) : Except String Unit := do
  if fixture.schemaVersion != 1 then throw "unsupported fixture schemaVersion"
  for testCase in fixture.weightedCases do checkWeightedCase testCase
  for testCase in fixture.affineCases do checkAffineCase testCase

end Sprawlens.CheckBarycenterFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckBarycenterFixtures.decodeFixture path
        match Sprawlens.CheckBarycenterFixtures.checkFixture fixture with
        | .ok _ =>
            let count := fixture.weightedCases.size + fixture.affineCases.size
            IO.println s!"Lean barycenter conformance passed: {count} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-barycenter-fixtures <fixture.json>"
      return 1
