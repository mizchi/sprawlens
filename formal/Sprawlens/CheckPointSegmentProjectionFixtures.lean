import Lean.Data.Json
import Sprawlens.ExactGeometry
import Sprawlens.SegmentProjection

open Lean

namespace Sprawlens.CheckPointSegmentProjectionFixtures

open ExactGeometry

structure PointFixture where
  x : Int
  y : Int
  deriving Repr, FromJson

structure RationalFixture where
  numerator : Int
  denominator : Int
  deriving Repr, FromJson

structure ProjectionCase where
  name : String
  point : PointFixture
  start : PointFixture
  finish : PointFixture
  expectedSquaredDistance : RationalFixture
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array ProjectionCase
  deriving Repr, FromJson

private abbrev QPoint := Vec2 ℚ

private def PointFixture.toModel (point : PointFixture) : QPoint :=
  { x := point.x, y := point.y }

/-- Executable exact-rational instance of the clamped formula whose real
inner-product-space contract is proved in `SegmentProjection`. -/
private def pointSegmentSquaredDistance
    (point start finish : QPoint) : ℚ :=
  let dx := finish.x - start.x
  let dy := finish.y - start.y
  let lengthSquared := dx * dx + dy * dy
  if lengthSquared = 0 then
    let residualX := point.x - start.x
    let residualY := point.y - start.y
    residualX * residualX + residualY * residualY
  else
    let rawParameter :=
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        lengthSquared
    let parameter := max 0 (min 1 rawParameter)
    let projectionX := start.x + parameter * dx
    let projectionY := start.y + parameter * dy
    let residualX := point.x - projectionX
    let residualY := point.y - projectionY
    residualX * residualX + residualY * residualY

private def expectedValue (value : RationalFixture) : Except String ℚ := do
  if value.denominator = 0 then
    throw "expected squared-distance denominator must be non-zero"
  return (value.numerator : ℚ) / (value.denominator : ℚ)

private def checkCase (testCase : ProjectionCase) : Except String Unit := do
  let expected ← expectedValue testCase.expectedSquaredDistance
  let actual := pointSegmentSquaredDistance
    testCase.point.toModel testCase.start.toModel testCase.finish.toModel
  if actual ≠ expected then
    throw s!"{testCase.name}: expected {repr expected}, received {repr actual}"

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

end Sprawlens.CheckPointSegmentProjectionFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ←
          Sprawlens.CheckPointSegmentProjectionFixtures.decodeFixture path
        match Sprawlens.CheckPointSegmentProjectionFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean point-segment projection conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-point-segment-projection-fixtures <fixture.json>"
      return 1
