import Lean.Data.Json
import Sprawlens.EmpiricalQuantile

open Lean
open Sprawlens.EmpiricalQuantile

namespace Sprawlens.CheckEmpiricalQuantileFixtures

structure QuantileCase where
  name : String
  values : Array Int
  probabilityNumerator : Nat
  probabilityDenominator : Nat
  expected : Int
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array QuantileCase
  deriving Repr, FromJson

def decodeFixture (path : String) : IO Fixture := do
  let contents ← IO.FS.readFile path
  let json ← match Json.parse contents with
    | .ok value => pure value
    | .error message => throw <| IO.userError s!"invalid JSON: {message}"
  match fromJson? json with
  | .ok fixture => pure fixture
  | .error message => throw <| IO.userError s!"invalid fixture: {message}"

private def checkCase (testCase : QuantileCase) : Except String Unit := do
  if testCase.values.isEmpty then
    throw s!"{testCase.name}: values must be non-empty"
  if testCase.probabilityDenominator = 0 then
    throw s!"{testCase.name}: probability denominator must be positive"
  if testCase.probabilityNumerator = 0 ||
      testCase.probabilityDenominator < testCase.probabilityNumerator then
    throw s!"{testCase.name}: probability must be in (0, 1]"
  let rankOneBased :=
    (testCase.probabilityNumerator * testCase.values.size +
      testCase.probabilityDenominator - 1) /
      testCase.probabilityDenominator
  if rankValid : 0 < rankOneBased ∧ rankOneBased ≤ testCase.values.size then
    let rank : Fin testCase.values.size := ⟨rankOneBased - 1, by omega⟩
    let actual := empiricalNearestRank (fun index => testCase.values[index]) rank
    if actual ≠ testCase.expected then
      throw s!"{testCase.name}: expected {testCase.expected}, received {actual}"
  else
    throw s!"{testCase.name}: derived nearest rank is outside the sample"

def checkFixture (fixture : Fixture) : Except String Unit := do
  if fixture.schemaVersion != 1 then throw "unsupported fixture schemaVersion"
  for testCase in fixture.cases do checkCase testCase

end Sprawlens.CheckEmpiricalQuantileFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckEmpiricalQuantileFixtures.decodeFixture path
        match Sprawlens.CheckEmpiricalQuantileFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean empirical nearest-rank conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-empirical-quantile-fixtures <fixture.json>"
      return 1
