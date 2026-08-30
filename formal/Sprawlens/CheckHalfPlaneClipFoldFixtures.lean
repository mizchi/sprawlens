import Lean.Data.Json
import Sprawlens.CyclicClosure

open Lean

namespace Sprawlens.CheckHalfPlaneClipFoldFixtures

structure FoldCase where
  name : String
  chunks : Array (Array Int)
  expectedOutput : Array Int
  expectedClosedOutput : Array Int
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array FoldCase
  deriving Repr, FromJson

private def destutterTail (previous : Int) : List Int → List Int
  | [] => []
  | value :: rest =>
      if previous = value then destutterTail previous rest
      else value :: destutterTail value rest

private def destutter : List Int → List Int
  | [] => []
  | value :: rest => value :: destutterTail value rest

private def normalizeClosure : List Int → List Int
  | [] => []
  | [value] => [value]
  | output@(first :: _ :: _) =>
      if output.getLast? = some first then output.dropLast else output

private def checkCase (testCase : FoldCase) : Except String Unit := do
  let flattened := testCase.chunks.toList.flatMap Array.toList
  let actual := destutter flattened
  if actual != testCase.expectedOutput.toList then
    throw s!"{testCase.name}: folded output differs"
  if !actual.all (· ≤ 0) then
    throw s!"{testCase.name}: folded output contains an outside distance"
  let actualClosed := normalizeClosure actual
  if actualClosed != testCase.expectedClosedOutput.toList then
    throw s!"{testCase.name}: cyclic closure output differs"

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

end Sprawlens.CheckHalfPlaneClipFoldFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckHalfPlaneClipFoldFixtures.decodeFixture path
        match Sprawlens.CheckHalfPlaneClipFoldFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean half-plane clip-fold conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-half-plane-clip-fold-fixtures <fixture.json>"
      return 1
