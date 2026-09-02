import Sprawlens.FixedPointWirePolicyMonotonicity

namespace Sprawlens.FixedPointWireVerifierMonotonicity

open EncodedWeightedPathDataVerifier
open FixedPointCanonicalArtifact
open FixedPointCanonicalDecimal
open FixedPointCanonicalMargin
open FixedPointCanonicalProvenance
open FixedPointEncodedCost
open FixedPointIntegerReport
open FixedPointWireArtifact
open FixedPointWireDiagnostic
open FixedPointWirePayloadBudget
open FixedPointWirePolicyMonotonicity
open FixedPointWireResourceLimits
open FixedPointWireValidationLimits
open FixedPointPathDataWitness
open PathwiseNontrivialImprovementWitness

universe u

theorem parseSerializedCostAtScaleWithinBytes_mono
    (expected : PositiveScale) {smaller larger : Nat}
    (limitLe : smaller ≤ larger)
    (raw : SerializedTaggedIntCost) (parsed : ScaledIntCost expected)
    (accepted : parseSerializedCostAtScaleWithinBytes expected smaller raw =
      some parsed) :
    parseSerializedCostAtScaleWithinBytes expected larger raw = some parsed := by
  have info :=
    (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected smaller raw
      parsed).mp accepted
  exact (parseSerializedCostAtScaleWithinBytes_eq_some_iff expected larger raw
    parsed).mpr ⟨info.1, info.2.1.trans limitLe, info.2.2⟩

theorem parseSerializedStepsAtScaleAux_mono
    {Edit : Type u} (expected : PositiveScale)
    {smaller larger : Nat} (limitLe : smaller ≤ larger)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit))
    (accepted : parseSerializedStepsAtScaleAux expected smaller raw =
      some parsed) :
    parseSerializedStepsAtScaleAux expected larger raw = some parsed := by
  induction raw generalizing parsed with
  | nil => simpa [parseSerializedStepsAtScaleAux] using accepted
  | cons step remaining inductionHypothesis =>
      simp only [parseSerializedStepsAtScaleAux] at accepted ⊢
      cases costEq : parseSerializedCostAtScaleWithinBytes expected smaller
          step.cost with
      | none => simp [costEq] at accepted
      | some cost =>
          cases remainingEq : parseSerializedStepsAtScaleAux expected smaller
              remaining with
          | none => simp [costEq, remainingEq] at accepted
          | some parsedRemaining =>
              simp [costEq, remainingEq] at accepted
              subst parsed
              rw [parseSerializedCostAtScaleWithinBytes_mono expected limitLe
                  step.cost cost costEq,
                inductionHypothesis parsedRemaining remainingEq]

theorem parseSerializedStepsAtScale_mono
    {Edit : Type u} (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (raw : List (SerializedTaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit))
    (accepted : parseSerializedStepsAtScale expected stepsSmaller bytesSmaller
      raw = some parsed) :
    parseSerializedStepsAtScale expected stepsLarger bytesLarger raw =
      some parsed := by
  have info := (parseSerializedStepsAtScale_eq_some_iff expected stepsSmaller
    bytesSmaller raw parsed).mp accepted
  exact (parseSerializedStepsAtScale_eq_some_iff expected stepsLarger
    bytesLarger raw parsed).mpr ⟨info.1.trans stepsLe,
      parseSerializedStepsAtScaleAux_mono expected bytesLe raw parsed info.2⟩

theorem verifySerializedWeightedPathData_mono
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (raw : List (SerializedTaggedPathStep Edit))
    (result : Nat × ScaledIntCost expected × List Edit)
    (accepted : verifySerializedWeightedPathData expected stepsSmaller
      bytesSmaller Independent encodedCost source raw = some result) :
    verifySerializedWeightedPathData expected stepsLarger bytesLarger
      Independent encodedCost source raw = some result := by
  unfold verifySerializedWeightedPathData at accepted ⊢
  cases parsedEq : parseSerializedStepsAtScale expected stepsSmaller
      bytesSmaller raw with
  | none => simp [parsedEq] at accepted
  | some parsed =>
      have parsedLarger := parseSerializedStepsAtScale_mono expected stepsLe
        bytesLe raw parsed parsedEq
      simp only [parsedEq] at accepted
      rw [parsedLarger]
      exact accepted

theorem verifySerializedPathField_mono
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source target : List Edit) (cost : ScaledIntCost expected)
    (raw : List (SerializedTaggedPathStep Edit)) (count : Nat)
    (accepted : verifySerializedPathField expected stepsSmaller bytesSmaller
      Independent encodedCost source target cost raw = some count) :
    verifySerializedPathField expected stepsLarger bytesLarger Independent
      encodedCost source target cost raw = some count := by
  apply (verifySerializedPathField_eq_some_iff expected stepsLarger
    bytesLarger Independent encodedCost source target cost raw count).mpr
  exact verifySerializedWeightedPathData_mono expected stepsLe bytesLe
    Independent encodedCost source raw (count, cost, target)
    ((verifySerializedPathField_eq_some_iff expected stepsSmaller bytesSmaller
      Independent encodedCost source target cost raw count).mp accepted)

theorem parseSerializedReportAtScale_mono
    {Edit : Type u} (expected : PositiveScale)
    {smaller larger : Nat} (limitLe : smaller ≤ larger)
    (raw : SerializedTaggedIntegerReport Edit)
    (parsed : IntegerReliabilityReport Edit expected)
    (accepted : parseSerializedReportAtScale expected smaller raw =
      some parsed) :
    parseSerializedReportAtScale expected larger raw = some parsed := by
  obtain ⟨margin, selectedError, comparisonError, marginEq, selectedEq,
      comparisonEq, valueEq⟩ :=
    parseSerializedReportAtScale_components expected smaller raw parsed
      accepted
  have marginLarger := parseSerializedCostAtScaleWithinBytes_mono expected
    limitLe raw.margin margin marginEq
  have selectedLarger := parseSerializedCostAtScaleWithinBytes_mono expected
    limitLe raw.selectedError selectedError selectedEq
  have comparisonLarger := parseSerializedCostAtScaleWithinBytes_mono expected
    limitLe raw.comparisonError comparisonError comparisonEq
  unfold parseSerializedReportAtScale
  rw [marginLarger, selectedLarger, comparisonLarger]
  simpa using congrArg some valueEq

theorem verifyCanonicalReliabilityArtifact_mono
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (result : IntegerReliabilityReport Edit expected)
    (accepted : verifyCanonicalReliabilityArtifact expected stepsSmaller
      bytesSmaller Independent encodedCost source rawReport paths =
        some result) :
    verifyCanonicalReliabilityArtifact expected stepsLarger bytesLarger
      Independent encodedCost source rawReport paths = some result := by
  unfold verifyCanonicalReliabilityArtifact at accepted ⊢
  cases reportEq : parseSerializedReportAtScale expected bytesSmaller
      rawReport with
  | none => simp [reportEq] at accepted
  | some report =>
      have reportLarger := parseSerializedReportAtScale_mono expected bytesLe
        rawReport report reportEq
      simp only [reportEq] at accepted
      rw [reportLarger]
      cases modeEq : report.mode with
      | twoSided =>
          cases paths with
          | twoSided selected comparison =>
              simp only [modeEq] at accepted ⊢
              cases selectedEq : verifySerializedPathField expected
                  stepsSmaller bytesSmaller Independent encodedCost source
                  report.selectedTarget report.selectedError selected with
              | none => simp [selectedEq] at accepted
              | some selectedCount =>
                  have selectedLarger := verifySerializedPathField_mono
                    expected stepsLe bytesLe Independent encodedCost source
                    report.selectedTarget report.selectedError selected
                    selectedCount selectedEq
                  cases comparisonEq : verifySerializedPathField expected
                      stepsSmaller bytesSmaller Independent encodedCost source
                      report.bestTarget report.comparisonError comparison with
                  | none => simp [selectedEq, comparisonEq] at accepted
                  | some comparisonCount =>
                      have comparisonLarger := verifySerializedPathField_mono
                        expected stepsLe bytesLe Independent encodedCost source
                        report.bestTarget report.comparisonError comparison
                        comparisonCount comparisonEq
                      simp [selectedEq, comparisonEq] at accepted
                      simpa [selectedLarger, comparisonLarger] using accepted
          | overestimate comparison => simp [modeEq] at accepted
          | underestimate selected => simp [modeEq] at accepted
      | overestimate =>
          cases paths with
          | twoSided selected comparison => simp [modeEq] at accepted
          | overestimate comparison =>
              simp only [modeEq] at accepted ⊢
              by_cases unusedZero : report.selectedError = zero expected
              · simp only [unusedZero, ↓reduceIte] at accepted ⊢
                cases comparisonEq : verifySerializedPathField expected
                    stepsSmaller bytesSmaller Independent encodedCost source
                    report.bestTarget report.comparisonError comparison with
                | none => simp [comparisonEq] at accepted
                | some comparisonCount =>
                    have comparisonLarger := verifySerializedPathField_mono
                      expected stepsLe bytesLe Independent encodedCost source
                      report.bestTarget report.comparisonError comparison
                      comparisonCount comparisonEq
                    simp [comparisonEq] at accepted
                    simpa [comparisonLarger] using accepted
              · simp [unusedZero] at accepted
          | underestimate selected => simp [modeEq] at accepted
      | underestimate =>
          cases paths with
          | twoSided selected comparison => simp [modeEq] at accepted
          | overestimate comparison => simp [modeEq] at accepted
          | underestimate selected =>
              simp only [modeEq] at accepted ⊢
              by_cases unusedZero : report.comparisonError = zero expected
              · simp only [unusedZero, ↓reduceIte] at accepted ⊢
                cases selectedEq : verifySerializedPathField expected
                    stepsSmaller bytesSmaller Independent encodedCost source
                    report.selectedTarget report.selectedError selected with
                | none => simp [selectedEq] at accepted
                | some selectedCount =>
                    have selectedLarger := verifySerializedPathField_mono
                      expected stepsLe bytesLe Independent encodedCost source
                      report.selectedTarget report.selectedError selected
                      selectedCount selectedEq
                    simp [selectedEq] at accepted
                    simpa [selectedLarger] using accepted
              · simp [unusedZero] at accepted

theorem verifyCanonicalReliabilityArtifactWithMargin_mono
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : SerializedTaggedIntegerReport Edit)
    (paths : SerializedModePaths Edit)
    (result : IntegerReliabilityReport Edit expected)
    (accepted : verifyCanonicalReliabilityArtifactWithMargin expected
      stepsSmaller bytesSmaller Independent encodedCost source actualMargin
      rawReport paths = some result) :
    verifyCanonicalReliabilityArtifactWithMargin expected stepsLarger
      bytesLarger Independent encodedCost source actualMargin rawReport paths =
        some result := by
  have info := (verifyCanonicalReliabilityArtifactWithMargin_eq_some_iff
    expected stepsSmaller bytesSmaller Independent encodedCost source
    actualMargin rawReport paths result).mp accepted
  exact (verifyCanonicalReliabilityArtifactWithMargin_eq_some_iff expected
    stepsLarger bytesLarger Independent encodedCost source actualMargin
    rawReport paths result).mpr
      ⟨verifyCanonicalReliabilityArtifact_mono expected stepsLe bytesLe
          Independent encodedCost source rawReport paths result info.1,
        info.2⟩

theorem parseWireCostTag_mono
    (expected : PositiveScale) {smaller larger : Nat}
    (limitLe : smaller ≤ larger)
    (raw : WireTaggedIntCost) (parsed : SerializedTaggedIntCost)
    (accepted : parseWireCostTag expected smaller raw = some parsed) :
    parseWireCostTag expected larger raw = some parsed := by
  have info := (parseWireCostTag_eq_some_iff expected smaller raw parsed).mp
    accepted
  exact (parseWireCostTag_eq_some_iff expected larger raw parsed).mpr
    ⟨⟨info.1.1.trans limitLe, info.1.2⟩, info.2⟩

theorem parseWireStepsAux_mono
    {Edit : Type u} (expected : PositiveScale)
    {smaller larger : Nat} (limitLe : smaller ≤ larger)
    (raw : List (WireTaggedPathStep Edit))
    (parsed : List (SerializedTaggedPathStep Edit))
    (accepted : parseWireStepsAux expected smaller raw = some parsed) :
    parseWireStepsAux expected larger raw = some parsed := by
  induction raw generalizing parsed with
  | nil => simpa [parseWireStepsAux] using accepted
  | cons step remaining inductionHypothesis =>
      simp only [parseWireStepsAux] at accepted ⊢
      cases costEq : parseWireCostTag expected smaller step.cost with
      | none => simp [costEq] at accepted
      | some cost =>
          cases remainingEq : parseWireStepsAux expected smaller remaining with
          | none => simp [costEq, remainingEq] at accepted
          | some parsedRemaining =>
              simp [costEq, remainingEq] at accepted
              subst parsed
              rw [parseWireCostTag_mono expected limitLe step.cost cost costEq,
                inductionHypothesis parsedRemaining remainingEq]

theorem parseWireSteps_mono
    {Edit : Type u} (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (raw : List (WireTaggedPathStep Edit))
    (parsed : List (SerializedTaggedPathStep Edit))
    (accepted : parseWireSteps expected stepsSmaller bytesSmaller raw =
      some parsed) :
    parseWireSteps expected stepsLarger bytesLarger raw = some parsed := by
  have info := (exists_parseWireSteps_iff expected stepsSmaller bytesSmaller
    raw).mp ⟨parsed, accepted⟩
  have auxAccepted := accepted
  simp [parseWireSteps, info.1] at auxAccepted
  have auxLarger := parseWireStepsAux_mono expected bytesLe raw parsed
    auxAccepted
  simp [parseWireSteps, info.1.trans stepsLe, auxLarger]

theorem parseWireReport_mono
    {Edit : Type u} (expected : PositiveScale)
    {smaller larger : Nat} (limitLe : smaller ≤ larger)
    (raw : WireTaggedIntegerReport Edit)
    (parsed : SerializedTaggedIntegerReport Edit)
    (accepted : parseWireReport expected smaller raw = some parsed) :
    parseWireReport expected larger raw = some parsed := by
  unfold parseWireReport at accepted ⊢
  cases marginEq : parseWireCostTag expected smaller raw.margin with
  | none => simp [marginEq] at accepted
  | some margin =>
      have marginLarger := parseWireCostTag_mono expected limitLe raw.margin
        margin marginEq
      cases selectedEq : parseWireCostTag expected smaller raw.selectedError with
      | none => simp [marginEq, selectedEq] at accepted
      | some selectedError =>
          have selectedLarger := parseWireCostTag_mono expected limitLe
            raw.selectedError selectedError selectedEq
          cases comparisonEq : parseWireCostTag expected smaller
              raw.comparisonError with
          | none => simp [marginEq, selectedEq, comparisonEq] at accepted
          | some comparisonError =>
              have comparisonLarger := parseWireCostTag_mono expected limitLe
                raw.comparisonError comparisonError comparisonEq
              simp [marginEq, selectedEq, comparisonEq] at accepted
              simpa [marginLarger, selectedLarger, comparisonLarger] using
                accepted

theorem parseWireModePaths_mono
    {Edit : Type u} (expected : PositiveScale)
    {stepsSmaller stepsLarger bytesSmaller bytesLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (bytesLe : bytesSmaller ≤ bytesLarger)
    (raw : WireModePaths Edit) (parsed : SerializedModePaths Edit)
    (accepted : parseWireModePaths expected stepsSmaller bytesSmaller raw =
      some parsed) :
    parseWireModePaths expected stepsLarger bytesLarger raw = some parsed := by
  cases raw with
  | twoSided selected comparison =>
      unfold parseWireModePaths at accepted ⊢
      cases selectedEq : parseWireSteps expected stepsSmaller bytesSmaller
          selected with
      | none => simp [selectedEq] at accepted
      | some parsedSelected =>
          have selectedLarger := parseWireSteps_mono expected stepsLe bytesLe
            selected parsedSelected selectedEq
          cases comparisonEq : parseWireSteps expected stepsSmaller bytesSmaller
              comparison with
          | none => simp [selectedEq, comparisonEq] at accepted
          | some parsedComparison =>
              have comparisonLarger := parseWireSteps_mono expected stepsLe
                bytesLe comparison parsedComparison comparisonEq
              simp [selectedEq, comparisonEq] at accepted
              simpa [selectedLarger, comparisonLarger] using accepted
  | overestimate comparison =>
      unfold parseWireModePaths at accepted ⊢
      cases comparisonEq : parseWireSteps expected stepsSmaller bytesSmaller
          comparison with
      | none => simp [comparisonEq] at accepted
      | some parsedComparison =>
          have comparisonLarger := parseWireSteps_mono expected stepsLe
            bytesLe comparison parsedComparison comparisonEq
          simp [comparisonEq] at accepted
          simpa [comparisonLarger] using accepted
  | underestimate selected =>
      unfold parseWireModePaths at accepted ⊢
      cases selectedEq : parseWireSteps expected stepsSmaller bytesSmaller
          selected with
      | none => simp [selectedEq] at accepted
      | some parsedSelected =>
          have selectedLarger := parseWireSteps_mono expected stepsLe bytesLe
            selected parsedSelected selectedEq
          simp [selectedEq] at accepted
          simpa [selectedLarger] using accepted

theorem verifyWireReliabilityArtifactWithMargin_mono
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    {stepsSmaller stepsLarger scaleSmaller scaleLarger unitSmaller
      unitLarger : Nat}
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit expected)
    (accepted : verifyWireReliabilityArtifactWithMargin expected stepsSmaller
      scaleSmaller unitSmaller Independent encodedCost source actualMargin
      rawReport rawPaths = some result) :
    verifyWireReliabilityArtifactWithMargin expected stepsLarger scaleLarger
      unitLarger Independent encodedCost source actualMargin rawReport rawPaths =
        some result := by
  obtain ⟨report, paths, reportEq, pathsEq, canonicalAccepted⟩ :=
    (verifyWireReliabilityArtifactWithMargin_eq_some_iff expected stepsSmaller
      scaleSmaller unitSmaller Independent encodedCost source actualMargin
      rawReport rawPaths result).mp accepted
  exact (verifyWireReliabilityArtifactWithMargin_eq_some_iff expected
    stepsLarger scaleLarger unitLarger Independent encodedCost source
    actualMargin rawReport rawPaths result).mpr
      ⟨report, paths,
        parseWireReport_mono expected scaleLe rawReport report reportEq,
        parseWireModePaths_mono expected stepsLe scaleLe rawPaths paths
          pathsEq,
        verifyCanonicalReliabilityArtifactWithMargin_mono expected stepsLe
          unitLe Independent encodedCost source actualMargin report paths
          result canonicalAccepted⟩

/-- Increasing every resource limit preserves the exact accepted report. The
artifact, cost model, trusted margin, and edit-weight function stay fixed. -/
theorem checkWire_accepted_mono_allLimits
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (stepsSmaller stepsLarger scaleSmaller scaleLarger unitSmaller
      unitLarger targetSmaller targetLarger totalSmaller totalLarger : Nat)
    (stepsLe : stepsSmaller ≤ stepsLarger)
    (scaleLe : scaleSmaller ≤ scaleLarger)
    (unitLe : unitSmaller ≤ unitLarger)
    (targetLe : targetSmaller ≤ targetLarger)
    (totalLe : totalSmaller ≤ totalLarger)
    (editWeight : Edit → Nat)
    (schemaSmaller schemaLarger : Nat)
    (schemaLe : schemaSmaller ≤ schemaLarger)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (actualMargin : ℝ)
    (rawReport : WireTaggedIntegerReport Edit)
    (rawPaths : WireModePaths Edit)
    (result : IntegerReliabilityReport Edit expected)
    (accepted : checkWireReliabilityArtifact expected stepsSmaller
      scaleSmaller unitSmaller targetSmaller totalSmaller editWeight
      schemaSmaller Independent encodedCost source actualMargin rawReport
      rawPaths = .accepted result) :
    checkWireReliabilityArtifact expected stepsLarger scaleLarger unitLarger
      targetLarger totalLarger editWeight schemaLarger Independent encodedCost
      source actualMargin rawReport rawPaths = .accepted result := by
  have info := (checkWire_eq_accepted_iff expected stepsSmaller scaleSmaller
    unitSmaller targetSmaller totalSmaller editWeight schemaSmaller
    Independent encodedCost source actualMargin rawReport rawPaths result).mp
      accepted
  exact (checkWire_eq_accepted_iff expected stepsLarger scaleLarger unitLarger
    targetLarger totalLarger editWeight schemaLarger Independent encodedCost
    source actualMargin rawReport rawPaths result).mpr
      ⟨wireArtifactWithinStructuralLimits_mono targetLe totalLe rawReport
          rawPaths info.1,
        wireArtifactWithinSchemaBudget_mono editWeight schemaLe rawReport
          rawPaths info.2.1,
        wireArtifactWithinValidationLimits_mono stepsLe scaleLe unitLe
          rawReport rawPaths info.2.2.1,
        verifyWireReliabilityArtifactWithMargin_mono expected stepsLe scaleLe
          unitLe Independent encodedCost source actualMargin rawReport rawPaths
          result info.2.2.2⟩

theorem componentWireArtifact_accepted_under_all_relaxedLimits :
    checkWireReliabilityArtifact milliScale 2 5 5 4 10 oneBytePerEdit 100
      NontrivialIndependent componentMilliErrorCost nontrivialSource 1
      componentWireReport componentWirePaths =
        .accepted componentCanonicalIntegerReport := by
  exact checkWire_accepted_mono_allLimits milliScale 1 2 4 5 4 5 3 4 9 10
    (by omega) (by omega) (by omega) (by omega) (by omega) oneBytePerEdit
    32 100 (by omega) NontrivialIndependent componentMilliErrorCost
    nontrivialSource 1 componentWireReport componentWirePaths
    componentCanonicalIntegerReport componentWireArtifact_diagnostic_accepted

end Sprawlens.FixedPointWireVerifierMonotonicity
