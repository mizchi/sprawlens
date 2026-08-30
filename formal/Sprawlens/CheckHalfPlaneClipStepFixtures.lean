import Lean.Data.Json
import Sprawlens.HalfPlaneClipStep

open Lean

namespace Sprawlens.CheckHalfPlaneClipStepFixtures

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

private def classify (current next : Int) : String :=
  if current ≤ 0 then
    if next ≤ 0 then "inside" else "leaving"
  else if next ≤ 0 then "entering" else "outside"

private def outputDistances (current next : Int) : Array Int :=
  match classify current next with
  | "inside" => #[current]
  | "leaving" => if current = 0 then #[current] else #[current, 0]
  | "entering" => #[0]
  | _ => #[]

private def checkCase (testCase : EdgeCase) : Except String Unit := do
  let actual := classify testCase.currentDistance testCase.nextDistance
  if actual != testCase.expectedClass then
    throw s!"{testCase.name}: expected {testCase.expectedClass}, received {actual}"
  let actualOutput := outputDistances testCase.currentDistance testCase.nextDistance
  if actualOutput != testCase.expectedOutputDistances then
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
