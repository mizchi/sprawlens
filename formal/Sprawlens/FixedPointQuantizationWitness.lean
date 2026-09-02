import Sprawlens.FixedPointPathDataWitness
import Sprawlens.FixedPointQuantization

namespace Sprawlens.FixedPointQuantizationWitness

open FixedPointEncodedCost
open FixedPointPathDataWitness
open FixedPointQuantization
open PathwiseReliabilityVerdict

noncomputable def halfMilli : ℝ := 1 / 2000

noncomputable def threeQuarterMilli : ℝ := 3 / 4000

theorem quantum_milliScale : quantum milliScale = (1 : ℝ) / 1000 := by
  norm_num [quantum, milliScale]

theorem quantizeUp_halfMilli :
    quantizeUp milliScale halfMilli = oneMilliUnit := by
  apply ext_iff.mpr
  change Int.ofNat ⌈halfMilli * (milliScale.denominator : ℝ)⌉₊ = 1
  have scaledEq :
      halfMilli * (milliScale.denominator : ℝ) = (2 : ℝ)⁻¹ := by
    norm_num [halfMilli, milliScale]
  rw [scaledEq]
  have ceilHalf : ⌈(2 : ℝ)⁻¹⌉₊ = 1 := by
    rw [Nat.ceil_eq_iff (by norm_num : (1 : Nat) ≠ 0)]
    norm_num
  rw [ceilHalf]
  rfl

theorem decode_quantizeUp_halfMilli :
    decode (quantizeUp milliScale halfMilli) = (1 : ℝ) / 1000 := by
  rw [quantizeUp_halfMilli]
  exact oneMilliUnit_decode

theorem halfMilli_quantizationError :
    decode (quantizeUp milliScale halfMilli) - halfMilli =
      (1 : ℝ) / 2000 := by
  rw [decode_quantizeUp_halfMilli]
  norm_num [halfMilli]

theorem halfMilli_quantizationError_lt_quantum :
    decode (quantizeUp milliScale halfMilli) - halfMilli <
      quantum milliScale := by
  rw [halfMilli_quantizationError, quantum_milliScale]
  norm_num

noncomputable def actualHalfMilliReport : PathwiseReliabilityReport Bool :=
  overestimateReport [] [] threeQuarterMilli halfMilli

noncomputable def quantizedHalfMilliReport :
    PathwiseReliabilityReport Bool :=
  overestimateReport [] [] threeQuarterMilli
    (decode (quantizeUp milliScale halfMilli))

theorem actualHalfMilliReport_certified :
    actualHalfMilliReport.verdict = .certifiedStable := by
  unfold actualHalfMilliReport
  rw [overestimateReport_certified_iff]
  norm_num [halfMilli, threeQuarterMilli]

theorem quantizedHalfMilliReport_inconclusive :
    quantizedHalfMilliReport.verdict = .inconclusive := by
  rw [PathwiseReliabilityReport.verdict_eq_inconclusive_iff]
  norm_num [quantizedHalfMilliReport, overestimateReport,
    PathwiseReliabilityReport.requiredError, threeQuarterMilli,
    decode_quantizeUp_halfMilli]

/-- Upward quantization is conservative but incomplete: a report can be
certified before quantization and inconclusive afterwards. -/
theorem upwardQuantization_certification_converse_fails :
    ∃ actual quantized : PathwiseReliabilityReport Bool,
      actual.verdict = .certifiedStable ∧
      quantized.verdict = .inconclusive ∧
      actual.selectedTarget = quantized.selectedTarget ∧
      actual.bestTarget = quantized.bestTarget := by
  exact ⟨actualHalfMilliReport, quantizedHalfMilliReport,
    actualHalfMilliReport_certified,
    quantizedHalfMilliReport_inconclusive, rfl, rfl⟩

def fineScale : PositiveScale where
  denominator := 5000
  positive := by norm_num

theorem quantizeUp_halfMilli_fineScale_units :
    (quantizeUp fineScale halfMilli).units = 3 := by
  change Int.ofNat ⌈halfMilli * (fineScale.denominator : ℝ)⌉₊ = 3
  have scaledEq :
      halfMilli * (fineScale.denominator : ℝ) = (5 : ℝ) / 2 := by
    norm_num [halfMilli, fineScale]
  rw [scaledEq]
  have ceilFiveHalves : ⌈(5 : ℝ) / 2⌉₊ = 3 := by
    rw [Nat.ceil_eq_iff (by norm_num : (3 : Nat) ≠ 0)]
    norm_num
  rw [ceilFiveHalves]
  rfl

theorem decode_quantizeUp_halfMilli_fineScale :
    decode (quantizeUp fineScale halfMilli) = (3 : ℝ) / 5000 := by
  rw [decode]
  rw [quantizeUp_halfMilli_fineScale_units]
  norm_num [fineScale]

noncomputable def fineQuantizedHalfMilliReport :
    PathwiseReliabilityReport Bool :=
  overestimateReport [] [] threeQuarterMilli
    (decode (quantizeUp fineScale halfMilli))

theorem fineQuantizedHalfMilliReport_certified :
    fineQuantizedHalfMilliReport.verdict = .certifiedStable := by
  unfold fineQuantizedHalfMilliReport
  rw [overestimateReport_certified_iff]
  rw [decode_quantizeUp_halfMilli_fineScale]
  norm_num [threeQuarterMilli]

theorem finerScale_recovers_certification :
    quantizedHalfMilliReport.verdict = .inconclusive ∧
      fineQuantizedHalfMilliReport.verdict = .certifiedStable :=
  ⟨quantizedHalfMilliReport_inconclusive,
    fineQuantizedHalfMilliReport_certified⟩

end Sprawlens.FixedPointQuantizationWitness
