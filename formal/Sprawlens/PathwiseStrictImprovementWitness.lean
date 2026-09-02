import Sprawlens.PathwiseUniformDominance

namespace Sprawlens.PathwiseStrictImprovementWitness

open DijkstraInvariant
open ApproximateWeightedNormalization
open NormalTargetMargin
open PathwiseTargetReliability
open PathwiseUniformDominance
open PositiveCostAttainment
open ReachableTraceClass
open TargetReliabilityClassification

def WitnessIndependent (_ _ : Bool) : Prop := True

instance witnessIndependentDecidable : DecidableRel WitnessIndependent :=
  fun _ _ => isTrue trivial

def witnessExactCost
    (_before _after : List Bool) (_first _second : Bool) : ℝ := 1

/-- The only approximation error is deliberately placed in a three-element
context unreachable from the two-element source. -/
def witnessApproximateCost
    (before _after : List Bool) (_first _second : Bool) : ℝ :=
  if before = [false] then 2 else 1

def witnessErrorCost
    (before _after : List Bool) (_first _second : Bool) : ℝ :=
  if before = [false] then 1 else 0

def WitnessNormal (_ : List Bool) : Prop := True

instance witnessNormalDecidable : DecidablePred WitnessNormal :=
  fun _ => isTrue trivial

def witnessSource : List Bool := [false, true]

def witnessSecond : List Bool := [true, false]

theorem witness_reachableTraceVerticesList :
    reachableTraceVerticesList WitnessIndependent witnessSource =
      [witnessSource, witnessSecond] := by
  native_decide

theorem witness_exact_dijkstraSearch :
    dijkstraSearch WitnessIndependent witnessExactCost WitnessNormal
      witnessSource = some (0, witnessSource) := by
  norm_num [dijkstraSearch, dijkstraSearchFuel, dijkstraStep,
    initialSearchState, pruneSettledFrontier,
    SimpleNormalizingSearch.minimumBy?, WitnessNormal, witnessSource]

theorem witness_exact_dijkstraSecondNormalTarget :
    dijkstraSecondNormalTarget WitnessIndependent witnessExactCost
      WitnessNormal witnessSource witnessSource =
        some (1, witnessSecond) := by
  rw [dijkstraSecondNormalTarget, dijkstraSearch,
    witness_reachableTraceVerticesList]
  norm_num [dijkstraSearchFuel, dijkstraStep, initialSearchState,
    pruneSettledFrontier, advanceFrontier, relaxWeightedFrontierEntry,
    weightedSwapStepChoicesList, weightedSwapStepChoicesListAux,
    SimpleNormalizingSearch.minimumBy?, OtherNormal, WitnessNormal,
    WitnessIndependent, witnessExactCost, witnessSource, witnessSecond]

theorem witness_approximate_dijkstraSearch :
    dijkstraSearch WitnessIndependent witnessApproximateCost WitnessNormal
      witnessSource = some (0, witnessSource) := by
  norm_num [dijkstraSearch, dijkstraSearchFuel, dijkstraStep,
    initialSearchState, pruneSettledFrontier,
    SimpleNormalizingSearch.minimumBy?, WitnessNormal, witnessSource]

def witnessMarginResult : TargetMarginResult Bool where
  bestCost := 0
  bestTarget := witnessSource
  secondCost := 1
  secondTarget := witnessSecond
  margin := 1

theorem witness_competingClassification :
    classifyTargetReliability WitnessIndependent witnessExactCost
      WitnessNormal witnessSource =
        .competingNormalTargets witnessMarginResult := by
  simp [classifyTargetReliability, witness_exact_dijkstraSearch,
    witness_exact_dijkstraSecondNormalTarget, witnessMarginResult]

theorem witness_exactCost_nonnegative :
    PrimitiveSwapCostLowerBound WitnessIndependent witnessExactCost 0 := by
  intro before after first second independent
  norm_num [witnessExactCost]

theorem witness_approximateCost_nonnegative :
    PrimitiveSwapCostLowerBound
      WitnessIndependent witnessApproximateCost 0 := by
  intro before after first second independent
  simp only [witnessApproximateCost]
  split <;> norm_num

theorem witness_costs_withinBy :
    PrimitiveSwapCostWithinBy WitnessIndependent witnessExactCost
      witnessApproximateCost witnessErrorCost := by
  intro before after first second independent
  simp only [witnessExactCost, witnessApproximateCost, witnessErrorCost]
  split <;> norm_num

theorem witness_errorCost_bounded_by_one :
    PrimitiveErrorCostBound WitnessIndependent witnessErrorCost 1 := by
  intro before after first second independent
  simp only [witnessErrorCost]
  split <;> norm_num

theorem witness_approximateCost_overestimates :
    PrimitiveSwapCostLe WitnessIndependent witnessExactCost
      witnessApproximateCost := by
  intro before after first second independent
  simp only [witnessExactCost, witnessApproximateCost]
  split <;> norm_num

/-- The global envelope cannot be tightened below one: the deliberately
unreachable three-element context realizes error exactly one. -/
theorem witness_uniformError_at_least_one
    {epsilon : ℝ}
    (within : PrimitiveSwapCostWithin WitnessIndependent witnessExactCost
      witnessApproximateCost epsilon) :
    1 ≤ epsilon := by
  have realized := within [false] [] false true trivial
  norm_num [witnessExactCost, witnessApproximateCost] at realized
  exact realized

theorem witness_errorEnvelope_at_least_one
    {epsilon : ℝ}
    (bounded : PrimitiveErrorCostBound
      WitnessIndependent witnessErrorCost epsilon) :
    1 ≤ epsilon := by
  simpa [witnessErrorCost] using
    bounded [false] [] false true trivial

theorem witness_selectedErrorPath :
    WeightedTracePath WitnessIndependent witnessErrorCost
      0 0 witnessSource witnessSource :=
  .refl witnessSource

theorem witness_bestErrorPath :
    WeightedTracePath WitnessIndependent witnessErrorCost
      0 0 witnessSource witnessSource :=
  .refl witnessSource

theorem witness_pathwise_twoSided_margin_holds :
    (0 : ℝ) + 0 < witnessMarginResult.margin := by
  norm_num [witnessMarginResult]

theorem witness_pathwise_oneSided_margin_holds :
    (0 : ℝ) < witnessMarginResult.margin := by
  norm_num [witnessMarginResult]

/-- No valid global uniform error bound can satisfy the legacy two-sided
margin rule for this realized search instance. -/
theorem witness_twoSided_uniformMargin_impossible
    {epsilon : ℝ}
    (within : PrimitiveSwapCostWithin WitnessIndependent witnessExactCost
      witnessApproximateCost epsilon) :
    ¬2 *
        ((reachableTraceVerticesList
          WitnessIndependent witnessSource).length : ℝ) * epsilon <
      witnessMarginResult.margin := by
  have epsilonLower := witness_uniformError_at_least_one within
  rw [witness_reachableTraceVerticesList]
  norm_num [witnessMarginResult] at epsilonLower ⊢
  linarith

/-- Even the one-sided overestimate rule fails for every valid uniform
envelope, while its concrete best-path error is zero. -/
theorem witness_oneSided_uniformMargin_impossible
    {epsilon : ℝ}
    (within : PrimitiveSwapCostWithin WitnessIndependent witnessExactCost
      witnessApproximateCost epsilon) :
    ¬((reachableTraceVerticesList
        WitnessIndependent witnessSource).length : ℝ) * epsilon <
      witnessMarginResult.margin := by
  have epsilonLower := witness_uniformError_at_least_one within
  rw [witness_reachableTraceVerticesList]
  norm_num [witnessMarginResult] at epsilonLower ⊢
  linarith

/-- A fully realized strict-improvement witness: exact classification and
approximate Dijkstra preserve the best target, both relevant error paths have
cost zero, yet no valid uniform envelope can pass either legacy margin rule. -/
theorem witness_pathwise_strictly_improves_uniform :
    classifyTargetReliability WitnessIndependent witnessExactCost
          WitnessNormal witnessSource =
        .competingNormalTargets witnessMarginResult ∧
      dijkstraSearch WitnessIndependent witnessApproximateCost WitnessNormal
          witnessSource = some (0, witnessMarginResult.bestTarget) ∧
      WeightedTracePath WitnessIndependent witnessErrorCost
          0 0 witnessSource witnessMarginResult.bestTarget ∧
      (0 : ℝ) + 0 < witnessMarginResult.margin ∧
      (∀ epsilon,
        PrimitiveSwapCostWithin WitnessIndependent witnessExactCost
            witnessApproximateCost epsilon →
          ¬2 *
              ((reachableTraceVerticesList
                WitnessIndependent witnessSource).length : ℝ) * epsilon <
            witnessMarginResult.margin) ∧
      (∀ epsilon,
        PrimitiveSwapCostWithin WitnessIndependent witnessExactCost
            witnessApproximateCost epsilon →
          ¬((reachableTraceVerticesList
              WitnessIndependent witnessSource).length : ℝ) * epsilon <
            witnessMarginResult.margin) := by
  refine ⟨witness_competingClassification,
    ?_, ?_, witness_pathwise_twoSided_margin_holds,
    (fun epsilon within =>
      witness_twoSided_uniformMargin_impossible within),
    (fun epsilon within =>
      witness_oneSided_uniformMargin_impossible within)⟩
  · simpa [witnessMarginResult] using witness_approximate_dijkstraSearch
  · simpa [witnessMarginResult] using witness_bestErrorPath

end Sprawlens.PathwiseStrictImprovementWitness
