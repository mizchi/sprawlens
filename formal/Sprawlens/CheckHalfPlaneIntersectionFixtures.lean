import Lean.Data.Json
import Sprawlens.HalfPlaneIntersection

open Lean

namespace Sprawlens.CheckHalfPlaneIntersectionFixtures

structure BoundaryCase where
  name : String
  currentDistance : Int
  nextDistance : Int
  expectedNumerator : Int
  expectedDenominator : Int
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array BoundaryCase
  deriving Repr, FromJson

private def hasCrossingClassification (testCase : BoundaryCase) : Bool :=
  (testCase.currentDistance ≤ 0 && 0 < testCase.nextDistance) ||
    (0 < testCase.currentDistance && testCase.nextDistance ≤ 0)

private def checkCase (testCase : BoundaryCase) : Except String Unit := do
  let denominator := testCase.currentDistance - testCase.nextDistance
  if denominator = 0 then throw s!"{testCase.name}: distances must be distinct"
  if !hasCrossingClassification testCase then
    throw s!"{testCase.name}: distances do not cross the closed half-plane boundary"
  if testCase.expectedDenominator ≤ 0 then
    throw s!"{testCase.name}: expected denominator must be positive"
  if testCase.expectedNumerator < 0 || testCase.expectedDenominator < testCase.expectedNumerator then
    throw s!"{testCase.name}: expected parameter is outside [0, 1]"
  if testCase.currentDistance * testCase.expectedDenominator !=
      testCase.expectedNumerator * denominator then
    throw s!"{testCase.name}: expected rational does not equal the boundary parameter"

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
  for testCase in fixture.cases do checkCase testCase

end Sprawlens.CheckHalfPlaneIntersectionFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckHalfPlaneIntersectionFixtures.decodeFixture path
        match Sprawlens.CheckHalfPlaneIntersectionFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean half-plane boundary-parameter conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-half-plane-intersection-fixtures <fixture.json>"
      return 1
