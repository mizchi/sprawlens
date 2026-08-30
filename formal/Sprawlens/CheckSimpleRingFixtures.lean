import Lean.Data.Json
import Sprawlens.SimpleRing

open Lean

namespace Sprawlens.CheckSimpleRingFixtures

structure PointFixture where
  x : Int
  y : Int
  deriving Repr, FromJson

structure RingCase where
  name : String
  vertices : Array PointFixture
  expected : Bool
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array RingCase
  deriving Repr, FromJson

private abbrev QPoint := ExactGeometry.Vec2 ℚ

private def PointFixture.toModel (point : PointFixture) : QPoint :=
  { x := point.x, y := point.y }

private def pointAt (vertices : Array PointFixture) (index : Nat) : QPoint :=
  (vertices[index]?.getD { x := 0, y := 0 }).toModel

private def indexPairs (size : Nat) : List (Nat × Nat) :=
  (List.range size).flatMap fun left =>
    (List.range size).filterMap fun right =>
      if left < right then some (left, right) else none

private def hasDuplicateVertex (vertices : Array PointFixture) : Bool :=
  (indexPairs vertices.size).any fun (left, right) =>
    decide (pointAt vertices left = pointAt vertices right)

private def hasZeroLengthEdge (vertices : Array PointFixture) : Bool :=
  (List.range vertices.size).any fun index =>
    decide (pointAt vertices index = pointAt vertices ((index + 1) % vertices.size))

private def edgesAdjacent (size left right : Nat) : Bool :=
  left == right || (left + 1) % size == right || (right + 1) % size == left

private def hasSelfIntersection (vertices : Array PointFixture) : Bool :=
  (indexPairs vertices.size).any fun (left, right) =>
    if edgesAdjacent vertices.size left right then false
    else
      SimpleRing.segmentsConflictBool
        (pointAt vertices left)
        (pointAt vertices ((left + 1) % vertices.size))
        (pointAt vertices right)
        (pointAt vertices ((right + 1) % vertices.size))

private def isSimpleOpenRing (vertices : Array PointFixture) : Bool :=
  if vertices.size < 3 then false
  else
    !hasDuplicateVertex vertices &&
      !hasZeroLengthEdge vertices &&
      !hasSelfIntersection vertices

private def checkCase (testCase : RingCase) : Except String Unit := do
  let actual := isSimpleOpenRing testCase.vertices
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

end Sprawlens.CheckSimpleRingFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckSimpleRingFixtures.decodeFixture path
        match Sprawlens.CheckSimpleRingFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean simple-open-ring conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-simple-ring-fixtures <fixture.json>"
      return 1
