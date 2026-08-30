import Lean.Data.Json
import Sprawlens.SegmentContact

open Lean

namespace Sprawlens.CheckSegmentContactFixtures

structure PointFixture where
  x : Int
  y : Int
  deriving Repr, FromJson

structure ContactCase where
  name : String
  a : PointFixture
  b : PointFixture
  point : PointFixture
  expected : Bool
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array ContactCase
  deriving Repr, FromJson

private def PointFixture.toModel (point : PointFixture) : ExactGeometry.Vec2 ℚ :=
  { x := point.x, y := point.y }

private def checkCase (testCase : ContactCase) : Except String Unit := do
  let actual := SegmentContact.pointInOpenSegmentBool
    testCase.a.toModel testCase.b.toModel testCase.point.toModel
  if actual != testCase.expected then
    throw s!"{testCase.name}: expected {testCase.expected}, received {actual}"

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

end Sprawlens.CheckSegmentContactFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckSegmentContactFixtures.decodeFixture path
        match Sprawlens.CheckSegmentContactFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean point-in-open-segment conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-segment-contact-fixtures <fixture.json>"
      return 1
