import Sprawlens.FixedPointScaleTag

namespace Sprawlens.FixedPointTaggedPathVerifier

open EncodedWeightedPathDataVerifier
open FixedPointEncodedCost
open FixedPointPathDataWitness
open FixedPointScaleTag
open PathwiseNontrivialImprovementWitness
open PositiveCostAttainment

universe u

structure TaggedPathStep (Edit : Type u) where
  cost : TaggedIntCost
  next : List Edit
deriving DecidableEq, Repr

/-- Recursive tag predicate that does not need element equality or list
membership. -/
def AllStepTagsMatch
    {Edit : Type u} (expected : PositiveScale) :
    List (TaggedPathStep Edit) → Prop
  | [] => True
  | step :: remaining =>
      step.cost.denominator = expected.denominator ∧
        AllStepTagsMatch expected remaining

instance allStepTagsMatchDecidable
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit)) :
    Decidable (AllStepTagsMatch expected steps) := by
  induction steps with
  | nil => exact isTrue trivial
  | cons step remaining inductionHypothesis =>
      simp [AllStepTagsMatch]
      infer_instance

/-- Strip tags only after `AllStepTagsMatch` has been checked. The function is
also exposed separately to state the unsafe counterexample. -/
def eraseStepTags
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit)) :
    List (ScaledIntCost expected × List Edit) :=
  steps.map fun step => (⟨step.cost.units⟩, step.next)

def parseTaggedStepsAtScale
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit)) :
    Option (List (ScaledIntCost expected × List Edit)) :=
  if _allTags : AllStepTagsMatch expected steps
  then some (eraseStepTags expected steps)
  else none

theorem parseTaggedStepsAtScale_eq_some_iff
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit))
    (parsed : List (ScaledIntCost expected × List Edit)) :
    parseTaggedStepsAtScale expected steps = some parsed ↔
      AllStepTagsMatch expected steps ∧
        eraseStepTags expected steps = parsed := by
  by_cases allTags : AllStepTagsMatch expected steps <;>
    simp [parseTaggedStepsAtScale, allTags]

theorem parseTaggedStepsAtScale_eq_none_iff
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit)) :
    parseTaggedStepsAtScale expected steps = none ↔
      ¬AllStepTagsMatch expected steps := by
  by_cases allTags : AllStepTagsMatch expected steps <;>
    simp [parseTaggedStepsAtScale, allTags]

@[simp] theorem eraseStepTags_length
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit)) :
    (eraseStepTags expected steps).length = steps.length := by
  simp [eraseStepTags]

@[simp] theorem eraseStepTags_targets
    {Edit : Type u} (expected : PositiveScale)
    (steps : List (TaggedPathStep Edit)) :
    (eraseStepTags expected steps).map Prod.snd =
      steps.map TaggedPathStep.next := by
  simp [eraseStepTags]

/-- Parse all edge scale tags, then invoke the existing encoded path checker.
No edge reaches cost comparison before homogeneous-scale validation. -/
def verifyTaggedWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit)) :
    Option (Nat × ScaledIntCost expected × List Edit) :=
  match parseTaggedStepsAtScale expected rawSteps with
  | none => none
  | some steps =>
      verifyEncodedWeightedPathData (zero expected) FixedPointEncodedCost.add
        Independent encodedCost source steps

/-- Successful tagged verification yields a genuine decoded weighted path. -/
theorem verifyTaggedWeightedPathData_sound
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    {count : Nat} {encodedPathCost : ScaledIntCost expected}
    {target : List Edit}
    (accepted : verifyTaggedWeightedPathData expected Independent
      encodedCost source rawSteps =
        some (count, encodedPathCost, target)) :
    WeightedTracePath Independent
      (decodePrimitiveCost FixedPointEncodedCost.decode encodedCost)
      count (FixedPointEncodedCost.decode encodedPathCost) source target := by
  unfold verifyTaggedWeightedPathData at accepted
  cases parsedEq : parseTaggedStepsAtScale expected rawSteps with
  | none => simp [parsedEq] at accepted
  | some parsedSteps =>
      simp only [parsedEq] at accepted
      exact verifyEncodedWeightedPathData_sound
        FixedPointEncodedCost.decode (zero expected)
        FixedPointEncodedCost.add (decode_zero expected)
        FixedPointEncodedCost.decode_add Independent encodedCost
        source parsedSteps accepted

/-- The returned count is the raw serialized step count, not a trusted input
field. -/
theorem verifyTaggedWeightedPathData_count_eq_length
    {Edit : Type u} [DecidableEq Edit]
    (expected : PositiveScale)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost :
      List Edit → List Edit → Edit → Edit → ScaledIntCost expected)
    (source : List Edit) (rawSteps : List (TaggedPathStep Edit))
    {count : Nat} {encodedPathCost : ScaledIntCost expected}
    {target : List Edit}
    (accepted : verifyTaggedWeightedPathData expected Independent
      encodedCost source rawSteps =
        some (count, encodedPathCost, target)) :
    count = rawSteps.length := by
  unfold verifyTaggedWeightedPathData at accepted
  cases parsedEq : parseTaggedStepsAtScale expected rawSteps with
  | none => simp [parsedEq] at accepted
  | some parsedSteps =>
      simp only [parsedEq] at accepted
      have countEq := verifyEncodedWeightedPathData_count_eq_length
        (zero expected) FixedPointEncodedCost.add Independent encodedCost
        source parsedSteps accepted
      have parsedDescription := (parseTaggedStepsAtScale_eq_some_iff
        expected rawSteps parsedSteps).mp parsedEq
      rw [← parsedDescription.2] at countEq
      simpa using countEq

def homogeneousBoundaryTaggedSteps :
    List (TaggedPathStep NontrivialEdit) :=
  [⟨⟨1000, 1000⟩, nontrivialBest⟩]

theorem homogeneousBoundaryTaggedSteps_accepted :
    verifyTaggedWeightedPathData milliScale NontrivialIndependent
      boundaryMilliErrorCost nontrivialSource homogeneousBoundaryTaggedSteps =
      some (1, wholeMilli 1, nontrivialBest) := by
  norm_num [verifyTaggedWeightedPathData, parseTaggedStepsAtScale,
    AllStepTagsMatch, homogeneousBoundaryTaggedSteps, eraseStepTags,
    verifyEncodedWeightedPathData,
    encodedEdgeDataAccepted, encodedSwapStepChoicesList,
    encodedSwapStepChoicesListAux, boundaryMilliErrorCost,
    FixedPointEncodedCost.add, wholeMilli, ofInt,
    FixedPointEncodedCost.zero, NontrivialIndependent,
    nontrivialSource, nontrivialBest, milliScale]

/-- The raw units match the valid boundary cost, but the serialized tag says
scale 500. Stripping the tag first makes the old typed checker accept it as a
scale-1000 cost. -/
def mixedScaleBoundaryTaggedSteps :
    List (TaggedPathStep NontrivialEdit) :=
  [⟨⟨500, 1000⟩, nontrivialBest⟩]

theorem mixedScaleBoundary_unsafe_tag_erasure_accepted :
    verifyEncodedWeightedPathData (zero milliScale)
      FixedPointEncodedCost.add NontrivialIndependent boundaryMilliErrorCost
      nontrivialSource (eraseStepTags milliScale mixedScaleBoundaryTaggedSteps) =
      some (1, wholeMilli 1, nontrivialBest) := by
  norm_num [mixedScaleBoundaryTaggedSteps, eraseStepTags,
    verifyEncodedWeightedPathData, encodedEdgeDataAccepted,
    encodedSwapStepChoicesList, encodedSwapStepChoicesListAux,
    boundaryMilliErrorCost, FixedPointEncodedCost.add,
    wholeMilli, ofInt, FixedPointEncodedCost.zero,
    NontrivialIndependent, nontrivialSource, nontrivialBest, milliScale]

theorem mixedScaleBoundary_safe_checker_rejects :
    verifyTaggedWeightedPathData milliScale NontrivialIndependent
      boundaryMilliErrorCost nontrivialSource mixedScaleBoundaryTaggedSteps =
      none := by
  norm_num [verifyTaggedWeightedPathData, parseTaggedStepsAtScale,
    AllStepTagsMatch, mixedScaleBoundaryTaggedSteps, milliScale]

end Sprawlens.FixedPointTaggedPathVerifier
