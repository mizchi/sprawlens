import Sprawlens.RepresentationIntervalCalibrationCostEncoding

namespace Sprawlens.RepresentationIntervalCalibrationCostSeparation

open RepresentationIntervalCalibrationPipeline
open RepresentationIntervalCalibrationActiveResidual
open RepresentationIntervalCalibrationActiveMinimum
open RepresentationIntervalCalibrationCanonicalActive

universe u v

/-- Candidate-specific absolute error contract for a represented cost. -/
def CostApproximationWithinByOn
    {Index : Type u}
    (indices : Finset Index)
    (exactCost approximateCost error : Index → ℝ) : Prop :=
  ∀ index ∈ indices,
    |approximateCost index - exactCost index| ≤ error index

/-- The exact canonical winner is separated from every other candidate by
the sum of the two candidate-specific error envelopes. -/
def CanonicalCostSeparatedBy
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (exactCost error : Index → ℝ) : Prop :=
  let best := finiteCanonicalArgmin indices nonempty exactCost
  ∀ other ∈ indices, other ≠ best →
    exactCost best + error best + error other < exactCost other

/-- Candidate-specific cost error preserves the complete canonical argmin
when the exact winner clears the sum of its own and each competitor's error. -/
theorem finiteCanonicalArgmin_eq_of_costErrorAndSeparation
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (exactCost approximateCost error : Index → ℝ)
    (within : CostApproximationWithinByOn indices exactCost approximateCost
      error)
    (separated : CanonicalCostSeparatedBy indices nonempty exactCost error) :
    finiteCanonicalArgmin indices nonempty approximateCost =
      finiteCanonicalArgmin indices nonempty exactCost := by
  let best := finiteCanonicalArgmin indices nonempty exactCost
  change finiteCanonicalArgmin indices nonempty approximateCost = best
  change ∀ other ∈ indices, other ≠ best →
    exactCost best + error best + error other < exactCost other at separated
  have bestMem : best ∈ indices := by
    exact finiteCanonicalArgmin_mem indices nonempty exactCost
  have bestUpper : approximateCost best ≤ exactCost best + error best := by
    have bound := (abs_le.mp (within best bestMem)).2
    linarith
  have bestStrictlyBeats : ∀ other ∈ indices, other ≠ best →
      approximateCost best < approximateCost other := by
    intro other otherMem otherNe
    have otherBound := (abs_le.mp (within other otherMem)).1
    have gap := separated other otherMem otherNe
    linarith
  apply isFiniteCanonicalArgmin_unique indices approximateCost
    (finiteCanonicalArgmin indices nonempty approximateCost) best
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨bestMem, ?_, ?_⟩
    · intro other otherMem
      by_cases otherEq : other = best
      · subst other
        exact le_rfl
      · exact (bestStrictlyBeats other otherMem otherEq).le
    · intro other otherMem costEq
      by_cases otherEq : other = best
      · subst other
        exact le_rfl
      · have strict := bestStrictlyBeats other otherMem otherEq
        linarith

def UniformCostApproximationOn
    {Index : Type u}
    (indices : Finset Index)
    (exactCost approximateCost : Index → ℝ)
    (epsilon : ℝ) : Prop :=
  ∀ index ∈ indices,
    |approximateCost index - exactCost index| ≤ epsilon

def CanonicalCostSeparatedByUniform
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (exactCost : Index → ℝ)
    (epsilon : ℝ) : Prop :=
  let best := finiteCanonicalArgmin indices nonempty exactCost
  ∀ other ∈ indices, other ≠ best →
    exactCost best + 2 * epsilon < exactCost other

/-- A uniform error envelope `epsilon` costs at most `2 * epsilon` when
comparing the represented winner with any represented competitor. -/
theorem finiteCanonicalArgmin_eq_of_uniformCostErrorAndSeparation
    {Index : Type u} [LinearOrder Index]
    (indices : Finset Index)
    (nonempty : indices.Nonempty)
    (exactCost approximateCost : Index → ℝ)
    (epsilon : ℝ)
    (within : UniformCostApproximationOn indices exactCost approximateCost
      epsilon)
    (separated : CanonicalCostSeparatedByUniform indices nonempty exactCost
      epsilon) :
    finiteCanonicalArgmin indices nonempty approximateCost =
      finiteCanonicalArgmin indices nonempty exactCost := by
  apply finiteCanonicalArgmin_eq_of_costErrorAndSeparation indices nonempty
    exactCost approximateCost (fun _ => epsilon)
  · exact within
  · intro other otherMem otherNe
    have gap := separated other otherMem otherNe
    linarith

/-- The same separation gate applies independently to the lower and upper
active residual-envelope selections. -/
theorem canonicalActiveConstraints_eq_of_uniformCostErrorAndSeparation
    {Artifact : Type u} {Constraint : Type v}
    [LinearOrder Constraint]
    {source target : Artifact → Set ℝ}
    (pipeline : CalibrationPipeline Artifact source target)
    (exactLower exactUpper observedLower observedUpper :
      Artifact → Constraint → ℝ)
    (artifact : Artifact)
    (constraints : Finset Constraint)
    (nonempty : constraints.Nonempty)
    (family : StagewiseIntervalTraceFamilyAt pipeline exactLower exactUpper
      observedLower observedUpper artifact constraints)
    (approximateLowerEnvelope approximateUpperEnvelope : Constraint → ℝ)
    (lowerEpsilon upperEpsilon : ℝ)
    (lowerWithin : ∀ constraint ∈
        observedLowerActiveSet observedLower artifact constraints nonempty,
      |approximateLowerEnvelope constraint -
          lowerTraceEnvelopeAt family constraint| ≤ lowerEpsilon)
    (upperWithin : ∀ constraint ∈
        observedUpperActiveSet observedUpper artifact constraints nonempty,
      |approximateUpperEnvelope constraint -
          upperTraceEnvelopeAt family constraint| ≤ upperEpsilon)
    (lowerSeparated : ∀ other ∈
        observedLowerActiveSet observedLower artifact constraints nonempty,
      other ≠ canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family →
      lowerTraceEnvelopeAt family
            (canonicalLowerActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          2 * lowerEpsilon < lowerTraceEnvelopeAt family other)
    (upperSeparated : ∀ other ∈
        observedUpperActiveSet observedUpper artifact constraints nonempty,
      other ≠ canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family →
      upperTraceEnvelopeAt family
            (canonicalUpperActiveConstraint pipeline exactLower exactUpper
              observedLower observedUpper artifact constraints nonempty family) +
          2 * upperEpsilon < upperTraceEnvelopeAt family other) :
    finiteCanonicalArgmin
          (observedLowerActiveSet observedLower artifact constraints nonempty)
          (observedLowerActiveSet_nonempty observedLower artifact constraints
            nonempty)
          approximateLowerEnvelope =
        canonicalLowerActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family ∧
      finiteCanonicalArgmin
          (observedUpperActiveSet observedUpper artifact constraints nonempty)
          (observedUpperActiveSet_nonempty observedUpper artifact constraints
            nonempty)
          approximateUpperEnvelope =
        canonicalUpperActiveConstraint pipeline exactLower exactUpper
          observedLower observedUpper artifact constraints nonempty family := by
  constructor
  · exact finiteCanonicalArgmin_eq_of_uniformCostErrorAndSeparation _ _ _ _ _
      lowerWithin lowerSeparated
  · exact finiteCanonicalArgmin_eq_of_uniformCostErrorAndSeparation _ _ _ _ _
      upperWithin upperSeparated

theorem boolUniv_nonempty : (Finset.univ : Finset Bool).Nonempty := by
  simp

def boundaryExactBoolCost (id : Bool) : ℝ :=
  if id then 0 else 2

def boundaryApproximateBoolCost (_id : Bool) : ℝ :=
  1

theorem boundaryBoolCost_uniformErrorOne :
    UniformCostApproximationOn Finset.univ boundaryExactBoolCost
      boundaryApproximateBoolCost 1 := by
  intro id _
  cases id <;> norm_num [boundaryExactBoolCost,
    boundaryApproximateBoolCost]

theorem boundaryExactBoolCost_canonicalArgmin_eq_true :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      boundaryExactBoolCost = true := by
  apply isFiniteCanonicalArgmin_unique _ _ _ true
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨by simp, ?_, ?_⟩
    · intro other _
      cases other <;> norm_num [boundaryExactBoolCost]
    · intro other _ costEq
      cases other
      · norm_num [boundaryExactBoolCost] at costEq
      · exact le_rfl

theorem boundaryApproximateBoolCost_canonicalArgmin_eq_false :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      boundaryApproximateBoolCost = false := by
  apply isFiniteCanonicalArgmin_unique _ _ _ false
  · exact finiteCanonicalArgmin_isCanonical _ _ _
  · refine ⟨by simp, ?_, ?_⟩
    · intro other _
      cases other <;> norm_num [boundaryApproximateBoolCost]
    · intro other _ _
      cases other <;> simp

/-- At the closed `2 * epsilon` boundary both represented costs can tie, so
the secondary ID order can replace the exact winner. Strict separation is
therefore load-bearing. -/
theorem nonstrictTwoEpsilonBoundary_changesCanonicalId :
    (∀ other ∈ (Finset.univ : Finset Bool), other ≠ true →
        boundaryExactBoolCost true + 2 * (1 : ℝ) ≤
          boundaryExactBoolCost other) ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          boundaryExactBoolCost = true ∧
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
          boundaryApproximateBoolCost = false := by
  refine ⟨?_, boundaryExactBoolCost_canonicalArgmin_eq_true,
    boundaryApproximateBoolCost_canonicalArgmin_eq_false⟩
  intro other _ otherNe
  cases other
  · norm_num [boundaryExactBoolCost]
  · simp at otherNe

def separatedExactBoolCost (id : Bool) : ℝ :=
  if id then 0 else 3

def separatedApproximateBoolCost (id : Bool) : ℝ :=
  if id then 1 else 2

theorem separatedBoolCost_uniformErrorOne :
    UniformCostApproximationOn Finset.univ separatedExactBoolCost
      separatedApproximateBoolCost 1 := by
  intro id _
  cases id <;> norm_num [separatedExactBoolCost,
    separatedApproximateBoolCost]

theorem separatedBoolCost_canonicalSeparation :
    CanonicalCostSeparatedByUniform (Finset.univ : Finset Bool)
      boolUniv_nonempty
      separatedExactBoolCost 1 := by
  unfold CanonicalCostSeparatedByUniform
  dsimp only
  have canonical :
      finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
        separatedExactBoolCost = true := by
    apply isFiniteCanonicalArgmin_unique _ _ _ true
    · exact finiteCanonicalArgmin_isCanonical _ _ _
    · refine ⟨by simp, ?_, ?_⟩
      · intro other _
        cases other <;> norm_num [separatedExactBoolCost]
      · intro other _ costEq
        cases other
        · norm_num [separatedExactBoolCost] at costEq
        · exact le_rfl
  rw [canonical]
  intro other _ otherNe
  cases other
  · norm_num [separatedExactBoolCost]
  · simp at otherNe

theorem strictTwoEpsilonSeparation_preservesCanonicalId :
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      separatedApproximateBoolCost =
    finiteCanonicalArgmin (Finset.univ : Finset Bool) boolUniv_nonempty
      separatedExactBoolCost := by
  exact finiteCanonicalArgmin_eq_of_uniformCostErrorAndSeparation _ _ _ _ _
    separatedBoolCost_uniformErrorOne separatedBoolCost_canonicalSeparation

end Sprawlens.RepresentationIntervalCalibrationCostSeparation
