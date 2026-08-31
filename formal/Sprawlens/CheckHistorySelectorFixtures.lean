import Lean.Data.Json
import Sprawlens.HistorySelectorConfluence

open Lean

namespace Sprawlens.CheckHistorySelectorFixtures

open HistorySelectorConfluence

structure SelectorCase where
  name : String
  editA : Bool
  editB : Bool
  previous : Bool
  expected : Bool
  deriving Repr, FromJson

structure PathCase where
  name : String
  expectedInputA : Bool
  expectedInputB : Bool
  expectedAB : Bool
  expectedBA : Bool
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  selectorCases : Array SelectorCase
  pathCase : PathCase
  deriving Repr, FromJson

private def checkSelectorCase (testCase : SelectorCase) : Except String Unit := do
  let actual := selectByHistory testCase.editA testCase.editB testCase.previous
  if actual != testCase.expected then
    throw s!"{testCase.name}: expected {testCase.expected}, received {actual}"

private def checkPathCase (testCase : PathCase) : Except String Unit := do
  let ab := applyInputEdit .enableB (applyInputEdit .enableA base)
  let ba := applyInputEdit .enableA (applyInputEdit .enableB base)
  if ab.editA != testCase.expectedInputA || ab.editB != testCase.expectedInputB then
    throw s!"{testCase.name}: AB input projection differs"
  if ba.editA != ab.editA || ba.editB != ab.editB then
    throw s!"{testCase.name}: AB/BA endpoint inputs differ"
  if ab.selected != testCase.expectedAB then
    throw s!"{testCase.name}: unexpected AB selection"
  if ba.selected != testCase.expectedBA then
    throw s!"{testCase.name}: unexpected BA selection"
  if ab.selected = ba.selected then
    throw s!"{testCase.name}: expected path-dependent selections"

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
  for testCase in fixture.selectorCases do checkSelectorCase testCase
  checkPathCase fixture.pathCase

end Sprawlens.CheckHistorySelectorFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckHistorySelectorFixtures.decodeFixture path
        match Sprawlens.CheckHistorySelectorFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean history-selector conformance passed: {fixture.selectorCases.size + 1} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-history-selector-fixtures <fixture.json>"
      return 1
