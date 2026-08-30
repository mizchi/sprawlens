import Lean.Data.Json
import Sprawlens.HalfPlaneClipPoints

open Lean

namespace Sprawlens.CheckHalfPlaneClipStepFixtures

open Sprawlens.ExactGeometry
open Sprawlens.HalfPlaneClipStep
open Sprawlens.HalfPlaneClipPoints

structure EdgeCase where
  name : String
  currentDistance : Int
  nextDistance : Int
  expectedClass : String
  expectedOutputDistances : Array Int
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array EdgeCase
  deriving Repr, FromJson

private def className : EdgeClass → String
  | .inside => "inside"
  | .leaving => "leaving"
  | .entering => "entering"
  | .outside => "outside"

private def xNonpos : HalfPlane Rat where
  normalX := 1
  normalY := 0
  offset := 0

private def pointAtDistance (distance : Int) : Vec2 Rat where
  x := distance
  y := 1

private def checkCase (testCase : EdgeCase) : Except String Unit := do
  let current := pointAtDistance testCase.currentDistance
  let next := pointAtDistance testCase.nextDistance
  let currentDistance := signedDistance xNonpos current
  let nextDistance := signedDistance xNonpos next
  let actual := className (classify currentDistance nextDistance)
  if actual != testCase.expectedClass then
    throw s!"{testCase.name}: expected {testCase.expectedClass}, received {actual}"
  let actualOutput := (outputPoints xNonpos current next).map (signedDistance xNonpos)
  let expectedOutput := testCase.expectedOutputDistances.toList.map (fun value => (value : Rat))
  if actualOutput != expectedOutput then
    throw s!"{testCase.name}: emitted distances differ"

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

end Sprawlens.CheckHalfPlaneClipStepFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckHalfPlaneClipStepFixtures.decodeFixture path
        match Sprawlens.CheckHalfPlaneClipStepFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean half-plane edge-classification conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-half-plane-clip-step-fixtures <fixture.json>"
      return 1
