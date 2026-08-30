import Lean.Data.Json

open Lean

namespace Sprawlens.CheckFixtures

structure ConstraintFixture where
  name : String
  tolerance : Int
  epsilon : Int
  deriving Repr, FromJson

structure CandidateFixture where
  id : String
  valid : Bool
  scores : Array Int
  cost : Int
  tieBreak : Int
  deriving Repr, FromJson

structure ExpectedFixture where
  selectedId : String
  eligibleIds : Array String
  usedFallback : Bool
  deriving Repr, BEq, FromJson

structure CaseFixture where
  name : String
  baselineId : String
  constraints : Array ConstraintFixture
  candidates : Array CandidateFixture
  expected : ExpectedFixture
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array CaseFixture
  deriving Repr, FromJson

private def meetsFloors :
    List ConstraintFixture → List Int → List Int → Bool
  | [], [], [] => true
  | constraint :: constraints, baseline :: baselineScores, score :: scores =>
      decide (baseline - constraint.tolerance ≤ score + constraint.epsilon) &&
        meetsFloors constraints baselineScores scores
  | _, _, _ => false

private def eligible
    (testCase : CaseFixture) (baseline candidate : CandidateFixture) : Bool :=
  candidate.valid &&
    meetsFloors testCase.constraints.toList baseline.scores.toList candidate.scores.toList

/-- Lower cost wins, then lower explicit tie-break; exact ties preserve input order. -/
private def prefer (left right : CandidateFixture) : CandidateFixture :=
  if right.cost < left.cost then right
  else if left.cost < right.cost then left
  else if right.tieBreak < left.tieBreak then right
  else left

private def selectCase (testCase : CaseFixture) : Except String ExpectedFixture := do
  if testCase.constraints.isEmpty then
    throw s!"{testCase.name}: at least one constraint is required"
  let baseline ←
    match testCase.candidates.find? (fun candidate => candidate.id == testCase.baselineId) with
    | some candidate => pure candidate
    | none => throw s!"{testCase.name}: baseline is missing"
  let eligibleCandidates :=
    testCase.candidates.toList.filter (eligible testCase baseline)
  let selected := match eligibleCandidates with
    | [] => baseline
    | first :: rest => rest.foldl prefer first
  return {
    selectedId := selected.id
    eligibleIds := eligibleCandidates.map (·.id) |>.toArray
    usedFallback := eligibleCandidates.isEmpty
  }

private def decodeFixture (path : String) : IO Fixture := do
  let contents ← IO.FS.readFile path
  let json ← match Json.parse contents with
    | .ok value => pure value
    | .error message => throw <| IO.userError s!"invalid JSON: {message}"
  match fromJson? json with
  | .ok fixture => pure fixture
  | .error message => throw <| IO.userError s!"invalid fixture: {message}"

private def checkFixture (fixture : Fixture) : Except String Unit := do
  if fixture.schemaVersion != 1 then throw "unsupported fixture schemaVersion"
  for testCase in fixture.cases do
    let actual ← selectCase testCase
    if actual != testCase.expected then
      throw s!"{testCase.name}: expected {repr testCase.expected}, received {repr actual}"

end Sprawlens.CheckFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckFixtures.decodeFixture path
        match Sprawlens.CheckFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-fixtures <fixture.json>"
      return 1
