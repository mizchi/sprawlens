import Sprawlens.EncodedWeightedPathDataVerifier
import Sprawlens.EncodedPathwiseSerializableReport
import Sprawlens.PathwiseSerializableReport

namespace Sprawlens.EncodedPathDataWitness

open EncodedWeightedPathDataVerifier
open EncodedPathwiseSerializableReport
open PathwiseCertificateIncompleteness
open PathwiseNontrivialImprovementWitness
open PathwiseReliabilityVerdict
open PositiveCostAttainment
open ReachablePathwiseStrictWitness

def intCostToReal (cost : Int) : ℝ := cost

@[simp] theorem intCostToReal_zero : intCostToReal 0 = 0 := by
  simp [intCostToReal]

@[simp] theorem intCostToReal_add (left right : Int) :
    intCostToReal (left + right) =
      intCostToReal left + intCostToReal right := by
  simp [intCostToReal]

def componentEncodedErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : Int :=
  if before = [.first] then 1 else 0

theorem decode_componentEncodedErrorCost :
    decodePrimitiveCost intCostToReal componentEncodedErrorCost =
      componentErrorCost := by
  funext before after left right
  simp [decodePrimitiveCost, intCostToReal, componentEncodedErrorCost,
    componentErrorCost]

def componentEncodedBestSteps : List (Int × List NontrivialEdit) :=
  [(0, nontrivialBest)]

theorem componentEncodedBestSteps_accepted :
    verifyEncodedWeightedPathData 0 (· + ·) NontrivialIndependent
      componentEncodedErrorCost nontrivialSource componentEncodedBestSteps =
        some (1, 0, nontrivialBest) := by
  norm_num [componentEncodedBestSteps, verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, componentEncodedErrorCost,
    NontrivialIndependent, nontrivialSource, nontrivialBest]

def componentEncodedTamperedCostSteps : List (Int × List NontrivialEdit) :=
  [(1, nontrivialBest)]

theorem componentEncodedTamperedCostSteps_rejected :
    verifyEncodedWeightedPathData 0 (· + ·) NontrivialIndependent
      componentEncodedErrorCost nontrivialSource
        componentEncodedTamperedCostSteps = none := by
  norm_num [componentEncodedTamperedCostSteps,
    verifyEncodedWeightedPathData, encodedEdgeDataAccepted,
    encodedSwapStepChoicesList, encodedSwapStepChoicesListAux,
    componentEncodedErrorCost, NontrivialIndependent,
    nontrivialSource, nontrivialBest]

theorem componentEncodedBestSteps_sound_path :
    WeightedTracePath NontrivialIndependent componentErrorCost
      1 0 nontrivialSource nontrivialBest := by
  have path := verifyEncodedWeightedPathData_sound intCostToReal
    0 (· + ·) intCostToReal_zero intCostToReal_add
    NontrivialIndependent componentEncodedErrorCost nontrivialSource
    componentEncodedBestSteps componentEncodedBestSteps_accepted
  rw [decode_componentEncodedErrorCost] at path
  simpa [intCostToReal] using path

def componentEncodedAcceptedData : AcceptedEncodedWeightedPathData
    (0 : Int) (· + ·) NontrivialIndependent componentEncodedErrorCost
    nontrivialSource nontrivialBest 0 where
  count := 1
  steps := componentEncodedBestSteps
  accepted := componentEncodedBestSteps_accepted

def componentEncodedSerializableReport :
    EncodedSerializablePathwiseReliabilityReport NontrivialEdit Int
      intCostToReal 0 (· + ·) NontrivialIndependent nontrivialExactCost
      componentApproximateCost componentEncodedErrorCost nontrivialSource where
  report := overestimateReport nontrivialBest nontrivialBest
    nontrivialMarginResult.margin (intCostToReal 0)
  within := by
    rw [decode_componentEncodedErrorCost]
    exact component_costs_withinBy
  evidence := EncodedSerializablePathwiseErrorEvidence.overestimate
    componentEncodedAcceptedData

theorem componentEncodedSerializableReport_verdict :
    componentEncodedSerializableReport.report.verdict =
      .certifiedStable := by
  unfold componentEncodedSerializableReport
  rw [overestimateReport_certified_iff]
  norm_num [intCostToReal, nontrivialMarginResult]

theorem componentEncodedSerializableReport_toProvenanced_verdict :
    (componentEncodedSerializableReport.toProvenanced
      intCostToReal_zero intCostToReal_add).report.verdict =
        .certifiedStable := by
  rw [componentEncodedSerializableReport.toProvenanced_report
    intCostToReal_zero intCostToReal_add]
  exact componentEncodedSerializableReport_verdict

def boundaryEncodedErrorCost
    (before _after : List NontrivialEdit)
    (_left _right : NontrivialEdit) : Int :=
  if before = [] then 1 else 0

theorem decode_boundaryEncodedErrorCost :
    decodePrimitiveCost intCostToReal boundaryEncodedErrorCost =
      boundaryErrorCost := by
  funext before after left right
  simp [decodePrimitiveCost, intCostToReal, boundaryEncodedErrorCost,
    boundaryErrorCost]

def boundaryEncodedBestSteps : List (Int × List NontrivialEdit) :=
  [(1, nontrivialBest)]

theorem boundaryEncodedBestSteps_accepted :
    verifyEncodedWeightedPathData 0 (· + ·) NontrivialIndependent
      boundaryEncodedErrorCost nontrivialSource boundaryEncodedBestSteps =
        some (1, 1, nontrivialBest) := by
  norm_num [boundaryEncodedBestSteps, verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, boundaryEncodedErrorCost,
    NontrivialIndependent, nontrivialSource, nontrivialBest]

def boundaryEncodedTamperedCostSteps : List (Int × List NontrivialEdit) :=
  [(0, nontrivialBest)]

theorem boundaryEncodedTamperedCostSteps_rejected :
    verifyEncodedWeightedPathData 0 (· + ·) NontrivialIndependent
      boundaryEncodedErrorCost nontrivialSource
        boundaryEncodedTamperedCostSteps = none := by
  norm_num [boundaryEncodedTamperedCostSteps,
    verifyEncodedWeightedPathData, encodedEdgeDataAccepted,
    encodedSwapStepChoicesList, encodedSwapStepChoicesListAux,
    boundaryEncodedErrorCost, NontrivialIndependent,
    nontrivialSource, nontrivialBest]

theorem boundaryEncodedBestSteps_sound_path :
    WeightedTracePath NontrivialIndependent boundaryErrorCost
      1 1 nontrivialSource nontrivialBest := by
  have path := verifyEncodedWeightedPathData_sound intCostToReal
    0 (· + ·) intCostToReal_zero intCostToReal_add
    NontrivialIndependent boundaryEncodedErrorCost nontrivialSource
    boundaryEncodedBestSteps boundaryEncodedBestSteps_accepted
  rw [decode_boundaryEncodedErrorCost] at path
  simpa [intCostToReal] using path

def boundaryEncodedAcceptedData : AcceptedEncodedWeightedPathData
    (0 : Int) (· + ·) NontrivialIndependent boundaryEncodedErrorCost
    nontrivialSource nontrivialBest 1 where
  count := 1
  steps := boundaryEncodedBestSteps
  accepted := boundaryEncodedBestSteps_accepted

def boundaryEncodedSerializableReport :
    EncodedSerializablePathwiseReliabilityReport NontrivialEdit Int
      intCostToReal 0 (· + ·) NontrivialIndependent nontrivialExactCost
      boundaryApproximateCost boundaryEncodedErrorCost nontrivialSource where
  report := overestimateReport nontrivialBest nontrivialBest
    nontrivialMarginResult.margin (intCostToReal 1)
  within := by
    rw [decode_boundaryEncodedErrorCost]
    exact boundary_costs_withinBy
  evidence := EncodedSerializablePathwiseErrorEvidence.overestimate
    boundaryEncodedAcceptedData

theorem boundaryEncodedSerializableReport_verdict :
    boundaryEncodedSerializableReport.report.verdict = .inconclusive := by
  rw [PathwiseReliabilityReport.verdict_eq_inconclusive_iff]
  norm_num [boundaryEncodedSerializableReport, overestimateReport,
    PathwiseReliabilityReport.requiredError, intCostToReal,
    nontrivialMarginResult]

theorem boundaryEncodedSerializableReport_toProvenanced_verdict :
    (boundaryEncodedSerializableReport.toProvenanced
      intCostToReal_zero intCostToReal_add).report.verdict =
        .inconclusive := by
  rw [boundaryEncodedSerializableReport.toProvenanced_report
    intCostToReal_zero intCostToReal_add]
  exact boundaryEncodedSerializableReport_verdict

end Sprawlens.EncodedPathDataWitness
