import Sprawlens.PositiveCostAttainment

namespace Sprawlens.WeightedPathDataVerifier

open PositiveCostAttainment

universe u

/-- Check an untrusted claimed edge against the executable primitive-step
enumerator. Cost equality is injected so runtime backends can choose an exact
numeric representation instead of inheriting Lean's noncomputable real
equality. -/
def edgeDataAccepted
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit) (claimedCost : ℝ) (next : List Edit) : Bool :=
  (weightedSwapStepChoicesList Independent swapCost current).any
    fun candidate =>
      costEq candidate.1 claimedCost && decide (candidate.2 = next)

theorem edgeDataAccepted_sound
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (current : List Edit) (claimedCost : ℝ) (next : List Edit)
    (accepted : edgeDataAccepted costEq Independent swapCost current
      claimedCost next = true) :
    WeightedSwapStep Independent swapCost claimedCost current next := by
  rw [edgeDataAccepted, List.any_eq_true] at accepted
  obtain ⟨candidate, member, matched⟩ := accepted
  rcases candidate with ⟨candidateCost, candidateTarget⟩
  simp only [Bool.and_eq_true, decide_eq_true_eq] at matched
  obtain ⟨costMatches, targetEq⟩ := matched
  have costEq' : candidateCost = claimedCost :=
    costEq_sound candidateCost claimedCost costMatches
  subst candidateCost
  subst candidateTarget
  exact (weightedSwapStepChoicesList_enumerates
    Independent swapCost current claimedCost next).mp member

/-- The serialized payload is a sequence of `(claimed edge cost, next vertex)`
pairs. Successful verification returns the derived edge count, total cost, and
final vertex; none of those aggregate values are trusted inputs. -/
def verifyWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ) :
    List Edit → List (ℝ × List Edit) → Option (Nat × ℝ × List Edit)
  | current, [] => some (0, 0, current)
  | current, (stepCost, next) :: remaining =>
      if edgeDataAccepted costEq Independent swapCost current stepCost next
      then
        match verifyWeightedPathData costEq Independent swapCost
            next remaining with
        | some (count, tailCost, target) =>
            some (count + 1, stepCost + tailCost, target)
        | none => none
      else none

/-- A successful check reconstructs the logical path proposition with exactly
the count, accumulated cost, source, and target returned by the checker. -/
theorem verifyWeightedPathData_sound
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (costEq_sound : ∀ left right, costEq left right = true → left = right)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    (source : List Edit) (steps : List (ℝ × List Edit))
    {count : Nat} {pathCost : ℝ} {target : List Edit}
    (verified : verifyWeightedPathData costEq Independent swapCost
      source steps = some (count, pathCost, target)) :
    WeightedTracePath Independent swapCost count pathCost source target := by
  induction steps generalizing source count pathCost target with
  | nil =>
      simp [verifyWeightedPathData] at verified
      obtain ⟨rfl, rfl, rfl⟩ := verified
      exact .refl source
  | cons head remaining inductionHypothesis =>
      rcases head with ⟨stepCost, next⟩
      simp only [verifyWeightedPathData] at verified
      split at verified
      next accepted =>
        cases tailEq : verifyWeightedPathData costEq Independent swapCost
            next remaining with
        | none => simp [tailEq] at verified
        | some tailResult =>
            rcases tailResult with ⟨tailCount, tailCost, finalTarget⟩
            simp [tailEq] at verified
            obtain ⟨rfl, rfl, rfl⟩ := verified
            exact .step
              (edgeDataAccepted_sound costEq costEq_sound Independent
                swapCost source stepCost next accepted)
              (inductionHypothesis next tailEq)
      next rejected => simp at verified

/-- Logical completeness: every proved path admits some serialized step list
accepted by the checker. This deliberately remains existential; extracting the
list from a Prop-valued path proof is not an executable operation. -/
theorem verifyWeightedPathData_complete
    {Edit : Type u} [DecidableEq Edit]
    (costEq : ℝ → ℝ → Bool)
    (costEq_refl : ∀ cost, costEq cost cost = true)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (swapCost : List Edit → List Edit → Edit → Edit → ℝ)
    {count : Nat} {pathCost : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent swapCost
      count pathCost source target) :
    ∃ steps : List (ℝ × List Edit),
      steps.length = count ∧
      verifyWeightedPathData costEq Independent swapCost source steps =
        some (count, pathCost, target) := by
  induction path with
  | refl edits => exact ⟨[], rfl, rfl⟩
  | @step count stepCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨steps, lengthEq, verified⟩ := inductionHypothesis
      have edgeMember : (stepCost, second) ∈
          weightedSwapStepChoicesList Independent swapCost first :=
        (weightedSwapStepChoicesList_enumerates Independent swapCost
          first stepCost second).mpr edge
      have edgeAccepted : edgeDataAccepted costEq Independent swapCost
          first stepCost second = true := by
        rw [edgeDataAccepted, List.any_eq_true]
        exact ⟨(stepCost, second), edgeMember, by
          simp [costEq_refl stepCost]⟩
      refine ⟨(stepCost, second) :: steps, ?_, ?_⟩
      · simp [lengthEq]
      · simp [verifyWeightedPathData, edgeAccepted, verified]

/-- Exact real equality is useful inside the specification. Production
backends should instantiate `costEq` with equality on their serialized numeric
domain and prove/refine the corresponding soundness property separately. -/
noncomputable def exactRealEq (left right : ℝ) : Bool :=
  decide (left = right)

theorem exactRealEq_sound (left right : ℝ)
    (equal : exactRealEq left right = true) : left = right := by
  simpa [exactRealEq] using equal

@[simp] theorem exactRealEq_refl (cost : ℝ) :
    exactRealEq cost cost = true := by
  simp [exactRealEq]

end Sprawlens.WeightedPathDataVerifier
