import Lean.Data.Json
import Sprawlens.ExternalSupport

open Lean
open Sprawlens.ExternalSupport

namespace Sprawlens.CheckExternalSupportFixtures

structure RequestFactsFixture where
  validBoundary : Bool
  validGraph : Bool
  boundaryCovered : Bool
  initializationCovered : Bool
  nodeCountCovered : Bool
  deriving Repr, FromJson

def RequestFactsFixture.toModel (facts : RequestFactsFixture) : RequestFacts := {
  validBoundary := facts.validBoundary
  validGraph := facts.validGraph
  boundaryCovered := facts.boundaryCovered
  initializationCovered := facts.initializationCovered
  nodeCountCovered := facts.nodeCountCovered
}

structure SupportCase where
  name : String
  facts : RequestFactsFixture
  expected : Bool
  deriving Repr, FromJson

structure ResponseCase where
  name : String
  expectedSupported : Bool
  status : String
  expected : String
  deriving Repr, FromJson

structure PathGateFixture where
  responseOk : Bool
  hostValid : Bool
  expectedSupported : Bool
  metadataMatches : Bool
  deriving Repr, FromJson

def PathGateFixture.toModel (path : PathGateFixture) : PathGate := {
  responseOk := path.responseOk
  hostValid := path.hostValid
  expectedSupported := path.expectedSupported
  metadataMatches := path.metadataMatches
}

structure EffectCase where
  name : String
  paths : Array PathGateFixture
  expected : Bool
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  supportCases : Array SupportCase
  responseCases : Array ResponseCase
  effectCases : Array EffectCase
  deriving Repr, FromJson

private def parseStatus : String → Except String ResponseStatus
  | "ok" => pure .ok
  | "unsupported" => pure .unsupported
  | "failed" => pure .failed
  | "execution-failed" => pure .executionFailed
  | status => throw s!"unknown response status: {status}"

private def className : ResponseClass → String
  | .accepted => "accepted"
  | .expectedMissingness => "expected-missingness"
  | .unexpectedUnsupported => "unexpected-unsupported"
  | .capabilityViolation => "capability-violation"
  | .failed => "failed"
  | .executionFailed => "execution-failed"

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
  for testCase in fixture.supportCases do
    let actual := expectedSupported testCase.facts.toModel
    if actual != testCase.expected then
      throw s!"{testCase.name}: expected support {testCase.expected}, received {actual}"
  for testCase in fixture.responseCases do
    let status ← parseStatus testCase.status
    let actual := className (classifyResponse testCase.expectedSupported status)
    if actual != testCase.expected then
      throw s!"{testCase.name}: expected class {testCase.expected}, received {actual}"
  for testCase in fixture.effectCases do
    let actual := canProduceEffect (testCase.paths.toList.map PathGateFixture.toModel)
    if actual != testCase.expected then
      throw s!"{testCase.name}: expected effect gate {testCase.expected}, received {actual}"

end Sprawlens.CheckExternalSupportFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckExternalSupportFixtures.decodeFixture path
        match Sprawlens.CheckExternalSupportFixtures.checkFixture fixture with
        | .ok _ =>
            let count :=
              fixture.supportCases.size + fixture.responseCases.size + fixture.effectCases.size
            IO.println s!"Lean external support conformance passed: {count} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-external-support-fixtures <fixture.json>"
      return 1
