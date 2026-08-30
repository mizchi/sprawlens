import Lean.Data.Json
import Sprawlens.HalfPlaneIntersection

open Lean

namespace Sprawlens.CheckInterpolationOrientationFixtures

structure PointFixture where
  x : Int
  y : Int
  deriving Repr, FromJson

structure OrientationCase where
  name : String
  a : PointFixture
  b : PointFixture
  c : PointFixture
  parameterNumerator : Int
  parameterDenominator : Int
  deriving Repr, FromJson

structure Fixture where
  schemaVersion : Nat
  cases : Array OrientationCase
  deriving Repr, FromJson

private def orientation (a b c : PointFixture) : Int :=
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

private def interpolatedNumerator
    (start finish : PointFixture) (numerator denominator : Int) : PointFixture :=
  {
    x := start.x * denominator + (finish.x - start.x) * numerator
    y := start.y * denominator + (finish.y - start.y) * numerator
  }

private def rationalOrientationNumerator
    (a b : PointFixture) (cNumerator : PointFixture) (denominator : Int) : Int :=
  (b.x - a.x) * (cNumerator.y - a.y * denominator) -
    (b.y - a.y) * (cNumerator.x - a.x * denominator)

private def rationalStartOrientationNumerator
    (aNumerator b c : PointFixture) (denominator : Int) : Int :=
  (b.x * denominator - aNumerator.x) * (c.y * denominator - aNumerator.y) -
    (b.y * denominator - aNumerator.y) * (c.x * denominator - aNumerator.x)

private def rationalMiddleOrientationNumerator
    (a : PointFixture) (bNumerator : PointFixture) (c : PointFixture) (denominator : Int) : Int :=
  (bNumerator.x - a.x * denominator) * (c.y - a.y) -
    (bNumerator.y - a.y * denominator) * (c.x - a.x)

private def checkCase (testCase : OrientationCase) : Except String Unit := do
  if testCase.parameterDenominator ≤ 0 then
    throw s!"{testCase.name}: parameter denominator must be positive"
  if testCase.parameterNumerator < 0 ||
      testCase.parameterDenominator < testCase.parameterNumerator then
    throw s!"{testCase.name}: parameter must be in [0, 1]"
  let base := orientation testCase.a testCase.b testCase.c
  let finishPoint := interpolatedNumerator testCase.b testCase.c
    testCase.parameterNumerator testCase.parameterDenominator
  let finishOrientation := rationalOrientationNumerator testCase.a testCase.b finishPoint
    testCase.parameterDenominator
  if finishOrientation != testCase.parameterNumerator * base then
    throw s!"{testCase.name}: finish interpolation orientation differs"
  let startPoint := interpolatedNumerator testCase.a testCase.b
    testCase.parameterNumerator testCase.parameterDenominator
  let startOrientation := rationalStartOrientationNumerator startPoint testCase.b testCase.c
    testCase.parameterDenominator
  if startOrientation !=
      (testCase.parameterDenominator - testCase.parameterNumerator) *
        testCase.parameterDenominator * base then
    throw s!"{testCase.name}: start interpolation orientation differs"
  let middleOrientation := rationalMiddleOrientationNumerator testCase.a finishPoint testCase.c
    testCase.parameterDenominator
  if middleOrientation != (testCase.parameterDenominator - testCase.parameterNumerator) * base then
    throw s!"{testCase.name}: middle interpolation orientation differs"

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

end Sprawlens.CheckInterpolationOrientationFixtures

def main (args : List String) : IO UInt32 := do
  match args with
  | [path] =>
      try
        let fixture ← Sprawlens.CheckInterpolationOrientationFixtures.decodeFixture path
        match Sprawlens.CheckInterpolationOrientationFixtures.checkFixture fixture with
        | .ok _ =>
            IO.println s!"Lean interpolation-orientation conformance passed: {fixture.cases.size} cases"
            return 0
        | .error message =>
            IO.eprintln message
            return 1
      catch error =>
        IO.eprintln error.toString
        return 1
  | _ =>
      IO.eprintln "usage: check-interpolation-orientation-fixtures <fixture.json>"
      return 1
