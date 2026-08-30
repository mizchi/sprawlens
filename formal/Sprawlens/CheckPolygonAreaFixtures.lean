import Lean.Data.Json
import Sprawlens.PolygonArea

open Lean

namespace Sprawlens.CheckPolygonAreaFixtures

structure PointFixture where
  x : Int
  y : Int
  deriving Repr, FromJson

structure AreaCase where
  name : String
  vertices : Array PointFixture
  expectedTwiceArea : Int
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array AreaCase
  deriving Repr, FromJson

private def pointAt (vertices : Array PointFixture) (index : Nat) : PointFixture :=
  vertices[index]?.getD { x := 0, y := 0 }

private def signedTwiceArea (vertices : Array PointFixture) : Int :=
  if vertices.size < 3 then 0
  else
    (List.range vertices.size).foldl (fun total index =>
      let start := pointAt vertices index
      let finish := pointAt vertices ((index + 1) % vertices.size)
      total + start.x * finish.y - finish.x * start.y) 0

private def checkCase (testCase : AreaCase) : Except String Unit := do
  let actual := signedTwiceArea testCase.vertices
  if actual != testCase.expectedTwiceArea then
    throw s!"{testCase.name}: expected {testCase.expectedTwiceArea}, received {actual}"

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

end Sprawlens.CheckPolygonAreaFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckPolygonAreaFixtures.decodeFixture path
        match Sprawlens.CheckPolygonAreaFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean polygon signed-area conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-polygon-area-fixtures <fixture.json>"
      return 1
