import Sprawlens.EncodedPathwiseSerializableReport
import Sprawlens.FixedPointEncodedCost
import Sprawlens.PathwiseCertificateIncompleteness

namespace Sprawlens.FixedPointPathDataWitness

open EncodedPathwiseSerializableReport
open EncodedWeightedPathDataVerifier
open FixedPointEncodedCost
open PathwiseCertificateIncompleteness
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment
open ReachablePathwiseStrictWitness

def milliScale : PositiveScale where
  denominator := 1000
  positive := by norm_num

abbrev MilliCost := ScaledIntCost milliScale

def milliZero : MilliCost := zero milliScale

def milliAdd (left right : MilliCost) : MilliCost := add left right

noncomputable def milliDecode (cost : MilliCost) : ℝ := decode cost

def wholeMilli (value : Int) : MilliCost := ofInt milliScale value

def oneMilliUnit : MilliCost := ⟨1⟩

def oneLessThanWhole : MilliCost := ⟨999⟩

@[simp] theorem milliDecode_zero : milliDecode milliZero = 0 := by
  simp [milliDecode, milliZero]

@[simp] theorem milliDecode_add (left right : MilliCost) :
    milliDecode (milliAdd left right) =
      milliDecode left + milliDecode right := by
  simp [milliDecode, milliAdd]

@[simp] theorem milliDecode_whole (value : Int) :
    milliDecode (wholeMilli value) = (value : ℝ) := by
  simp [milliDecode, wholeMilli]

theorem oneMilliUnit_decode :
    milliDecode oneMilliUnit = (1 : ℝ) / 1000 := by
  norm_num [milliDecode, oneMilliUnit, decode, milliScale]

theorem oneLessThanWhole_decode :
    milliDecode oneLessThanWhole = (999 : ℝ) / 1000 := by
  norm_num [milliDecode, oneLessThanWhole, decode, milliScale]

theorem whole_one_tamper_gap :
    milliDecode (wholeMilli 1) - milliDecode oneLessThanWhole =
      (1 : ℝ) / 1000 := by
  rw [milliDecode_whole, oneLessThanWhole_decode]
  norm_num

def componentMilliErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : MilliCost :=
  if before = [.first] then wholeMilli 1 else milliZero

theorem decode_componentMilliErrorCost :
    decodePrimitiveCost milliDecode componentMilliErrorCost =
      componentErrorCost := by
  funext before after left right
  by_cases special : before = [.first]
  · simp [decodePrimitiveCost, componentMilliErrorCost, componentErrorCost,
      milliDecode, wholeMilli, special]
  · simp [decodePrimitiveCost, componentMilliErrorCost, componentErrorCost,
      milliDecode, milliZero, special]

def componentMilliBestSteps : List (MilliCost × List NontrivialEdit) :=
  [(milliZero, nontrivialBest)]

theorem componentMilliBestSteps_accepted :
    verifyEncodedWeightedPathData milliZero milliAdd
      NontrivialIndependent componentMilliErrorCost nontrivialSource
        componentMilliBestSteps =
      some (1, milliZero, nontrivialBest) := by
  norm_num [componentMilliBestSteps, verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, componentMilliErrorCost,
    milliAdd, add, milliZero, zero, NontrivialIndependent, nontrivialSource,
    nontrivialBest]

def componentMilliTamperedSteps : List (MilliCost × List NontrivialEdit) :=
  [(oneMilliUnit, nontrivialBest)]

theorem componentMilliTamperedSteps_rejected :
    verifyEncodedWeightedPathData milliZero milliAdd
      NontrivialIndependent componentMilliErrorCost nontrivialSource
        componentMilliTamperedSteps = none := by
  norm_num [componentMilliTamperedSteps, verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, componentMilliErrorCost,
    oneMilliUnit, milliZero, zero, NontrivialIndependent,
    nontrivialSource, nontrivialBest]

def componentMilliAcceptedData : AcceptedEncodedWeightedPathData
    milliZero milliAdd NontrivialIndependent componentMilliErrorCost
    nontrivialSource nontrivialBest milliZero where
  count := 1
  steps := componentMilliBestSteps
  accepted := componentMilliBestSteps_accepted

noncomputable def componentMilliSerializableReport :
    EncodedSerializablePathwiseReliabilityReport NontrivialEdit MilliCost
      milliDecode milliZero milliAdd NontrivialIndependent
      nontrivialExactCost componentApproximateCost componentMilliErrorCost
      nontrivialSource where
  report := overestimateReport nontrivialBest nontrivialBest
    nontrivialMarginResult.margin (milliDecode milliZero)
  within := by
    rw [decode_componentMilliErrorCost]
    exact component_costs_withinBy
  evidence := EncodedSerializablePathwiseErrorEvidence.overestimate
    componentMilliAcceptedData

theorem componentMilliSerializableReport_verdict :
    componentMilliSerializableReport.report.verdict = .certifiedStable := by
  unfold componentMilliSerializableReport
  rw [overestimateReport_certified_iff]
  norm_num [nontrivialMarginResult]

theorem componentMilliSerializableReport_toProvenanced_verdict :
    (componentMilliSerializableReport.toProvenanced
      milliDecode_zero milliDecode_add).report.verdict =
        .certifiedStable := by
  rw [componentMilliSerializableReport.toProvenanced_report
    milliDecode_zero milliDecode_add]
  exact componentMilliSerializableReport_verdict

def boundaryMilliErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : MilliCost :=
  if before = [] then wholeMilli 1 else milliZero

theorem decode_boundaryMilliErrorCost :
    decodePrimitiveCost milliDecode boundaryMilliErrorCost =
      boundaryErrorCost := by
  funext before after left right
  by_cases special : before = []
  · simp [decodePrimitiveCost, boundaryMilliErrorCost, boundaryErrorCost,
      milliDecode, wholeMilli, special]
  · simp [decodePrimitiveCost, boundaryMilliErrorCost, boundaryErrorCost,
      milliDecode, milliZero, special]

def boundaryMilliBestSteps : List (MilliCost × List NontrivialEdit) :=
  [(wholeMilli 1, nontrivialBest)]

theorem boundaryMilliBestSteps_accepted :
    verifyEncodedWeightedPathData milliZero milliAdd
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
        boundaryMilliBestSteps =
      some (1, wholeMilli 1, nontrivialBest) := by
  norm_num [boundaryMilliBestSteps, verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, boundaryMilliErrorCost,
    milliAdd, add, wholeMilli, ofInt, milliZero, zero, NontrivialIndependent,
    nontrivialSource, nontrivialBest, milliScale]

def boundaryMilliTamperedSteps : List (MilliCost × List NontrivialEdit) :=
  [(oneLessThanWhole, nontrivialBest)]

theorem boundaryMilliTamperedSteps_rejected :
    verifyEncodedWeightedPathData milliZero milliAdd
      NontrivialIndependent boundaryMilliErrorCost nontrivialSource
        boundaryMilliTamperedSteps = none := by
  norm_num [boundaryMilliTamperedSteps, verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, boundaryMilliErrorCost,
    oneLessThanWhole, wholeMilli, ofInt, milliZero, zero,
    NontrivialIndependent, nontrivialSource, nontrivialBest, milliScale]

def boundaryMilliAcceptedData : AcceptedEncodedWeightedPathData
    milliZero milliAdd NontrivialIndependent boundaryMilliErrorCost
    nontrivialSource nontrivialBest (wholeMilli 1) where
  count := 1
  steps := boundaryMilliBestSteps
  accepted := boundaryMilliBestSteps_accepted

noncomputable def boundaryMilliSerializableReport :
    EncodedSerializablePathwiseReliabilityReport NontrivialEdit MilliCost
      milliDecode milliZero milliAdd NontrivialIndependent
      nontrivialExactCost boundaryApproximateCost boundaryMilliErrorCost
      nontrivialSource where
  report := overestimateReport nontrivialBest nontrivialBest
    nontrivialMarginResult.margin (milliDecode (wholeMilli 1))
  within := by
    rw [decode_boundaryMilliErrorCost]
    exact boundary_costs_withinBy
  evidence := EncodedSerializablePathwiseErrorEvidence.overestimate
    boundaryMilliAcceptedData

theorem boundaryMilliSerializableReport_verdict :
    boundaryMilliSerializableReport.report.verdict = .inconclusive := by
  rw [PathwiseReliabilityReport.verdict_eq_inconclusive_iff]
  norm_num [boundaryMilliSerializableReport, overestimateReport,
    PathwiseReliabilityReport.requiredError, nontrivialMarginResult]

theorem boundaryMilliSerializableReport_toProvenanced_verdict :
    (boundaryMilliSerializableReport.toProvenanced
      milliDecode_zero milliDecode_add).report.verdict = .inconclusive := by
  rw [boundaryMilliSerializableReport.toProvenanced_report
    milliDecode_zero milliDecode_add]
  exact boundaryMilliSerializableReport_verdict

end Sprawlens.FixedPointPathDataWitness
