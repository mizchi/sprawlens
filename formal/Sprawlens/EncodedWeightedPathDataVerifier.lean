import Sprawlens.WeightedPathDataVerifier

namespace Sprawlens.EncodedWeightedPathDataVerifier

open PositiveCostAttainment

universe u v

def decodePrimitiveCost
    {Edit : Type u} {EncodedCost : Type v}
    (decode : EncodedCost → ℝ)
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost) :
    List Edit → List Edit → Edit → Edit → ℝ :=
  fun before after first second =>
    decode (encodedCost before after first second)

/-- Cost-generic copy of the primitive adjacent-swap enumerator. Unlike the
real-valued specification enumerator, this list can carry an executable
serialized domain such as `Int` or a reduced rational representation. -/
def encodedSwapStepChoicesListAux
    {Edit : Type u} {EncodedCost : Type v}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (before : List Edit) : List Edit → List (EncodedCost × List Edit)
  | first :: second :: after =>
      let next := before ++ second :: first :: after
      let forward :=
        if Independent first second then
          [(encodedCost before after first second, next)]
        else []
      let backward :=
        if Independent second first then
          [(encodedCost before after second first, next)]
        else []
      forward ++ backward ++
        encodedSwapStepChoicesListAux Independent encodedCost
          (before ++ [first]) (second :: after)
  | _ => []

def encodedSwapStepChoicesList
    {Edit : Type u} {EncodedCost : Type v}
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (current : List Edit) : List (EncodedCost × List Edit) :=
  encodedSwapStepChoicesListAux Independent encodedCost [] current

theorem encodedSwapStepChoicesListAux_map_decode
    {Edit : Type u} {EncodedCost : Type v}
    (decode : EncodedCost → ℝ)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (before remaining : List Edit) :
    (encodedSwapStepChoicesListAux Independent encodedCost before remaining).map
        (fun candidate => (decode candidate.1, candidate.2)) =
      weightedSwapStepChoicesListAux Independent
        (decodePrimitiveCost decode encodedCost) before remaining := by
  induction remaining generalizing before with
  | nil => rfl
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => rfl
      | cons second after =>
          simp only [encodedSwapStepChoicesListAux,
            weightedSwapStepChoicesListAux, List.map_append]
          split <;> split <;>
            simp [decodePrimitiveCost,
              inductionHypothesis (before := before ++ [first])]

theorem encodedSwapStepChoicesList_map_decode
    {Edit : Type u} {EncodedCost : Type v}
    (decode : EncodedCost → ℝ)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (current : List Edit) :
    (encodedSwapStepChoicesList Independent encodedCost current).map
        (fun candidate => (decode candidate.1, candidate.2)) =
      weightedSwapStepChoicesList Independent
        (decodePrimitiveCost decode encodedCost) current := by
  exact encodedSwapStepChoicesListAux_map_decode decode Independent
    encodedCost [] current

theorem encodedSwapStepChoicesList_sound
    {Edit : Type u} {EncodedCost : Type v}
    (decode : EncodedCost → ℝ)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (current : List Edit) (claimedCost : EncodedCost) (next : List Edit)
    (member : (claimedCost, next) ∈
      encodedSwapStepChoicesList Independent encodedCost current) :
    WeightedSwapStep Independent (decodePrimitiveCost decode encodedCost)
      (decode claimedCost) current next := by
  have mappedMember : (decode claimedCost, next) ∈
      (encodedSwapStepChoicesList Independent encodedCost current).map
        (fun candidate => (decode candidate.1, candidate.2)) :=
    List.mem_map_of_mem
      (f := fun candidate => (decode candidate.1, candidate.2)) member
  rw [encodedSwapStepChoicesList_map_decode] at mappedMember
  exact (weightedSwapStepChoicesList_enumerates Independent
    (decodePrimitiveCost decode encodedCost) current
    (decode claimedCost) next).mp mappedMember

theorem encodedSwapStepChoicesList_complete
    {Edit : Type u} {EncodedCost : Type v}
    (decode : EncodedCost → ℝ)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    {current next : List Edit} {stepCost : ℝ}
    (edge : WeightedSwapStep Independent
      (decodePrimitiveCost decode encodedCost) stepCost current next) :
    ∃ claimedCost : EncodedCost,
      (claimedCost, next) ∈
        encodedSwapStepChoicesList Independent encodedCost current ∧
      decode claimedCost = stepCost := by
  have realMember : (stepCost, next) ∈
      weightedSwapStepChoicesList Independent
        (decodePrimitiveCost decode encodedCost) current :=
    (weightedSwapStepChoicesList_enumerates Independent
      (decodePrimitiveCost decode encodedCost) current stepCost next).mpr edge
  rw [← encodedSwapStepChoicesList_map_decode] at realMember
  obtain ⟨candidate, member, candidateEq⟩ := List.mem_map.mp realMember
  rcases candidate with ⟨claimedCost, candidateTarget⟩
  have pairEq : (decode claimedCost, candidateTarget) =
      (stepCost, next) := candidateEq
  injection pairEq with costEq targetEq
  subst candidateTarget
  exact ⟨claimedCost, member, costEq⟩

def encodedEdgeDataAccepted
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (current : List Edit) (claimedCost : EncodedCost)
    (next : List Edit) : Bool :=
  decide ((claimedCost, next) ∈
    encodedSwapStepChoicesList Independent encodedCost current)

theorem encodedEdgeDataAccepted_sound
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (decode : EncodedCost → ℝ)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (current : List Edit) (claimedCost : EncodedCost) (next : List Edit)
    (accepted : encodedEdgeDataAccepted Independent encodedCost current
      claimedCost next = true) :
    WeightedSwapStep Independent (decodePrimitiveCost decode encodedCost)
      (decode claimedCost) current next := by
  have member : (claimedCost, next) ∈
      encodedSwapStepChoicesList Independent encodedCost current := by
    simpa [encodedEdgeDataAccepted] using accepted
  exact encodedSwapStepChoicesList_sound decode Independent encodedCost
    current claimedCost next member

/-- Fully executable checker over an encoded cost domain. Equality, zero, and
addition all remain in that domain; decoding to reals appears only in the
soundness theorem. -/
def verifyEncodedWeightedPathData
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost) :
    List Edit → List (EncodedCost × List Edit) →
      Option (Nat × EncodedCost × List Edit)
  | current, [] => some (0, zero, current)
  | current, (stepCost, next) :: remaining =>
      if encodedEdgeDataAccepted Independent encodedCost current stepCost next
      then
        match verifyEncodedWeightedPathData zero add Independent encodedCost
            next remaining with
        | some (count, tailCost, target) =>
            some (count + 1, add stepCost tailCost, target)
        | none => none
      else none

theorem verifyEncodedWeightedPathData_sound
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (decode : EncodedCost → ℝ)
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (source : List Edit) (steps : List (EncodedCost × List Edit))
    {count : Nat} {encodedPathCost : EncodedCost} {target : List Edit}
    (verified : verifyEncodedWeightedPathData zero add Independent encodedCost
      source steps = some (count, encodedPathCost, target)) :
    WeightedTracePath Independent (decodePrimitiveCost decode encodedCost)
      count (decode encodedPathCost) source target := by
  induction steps generalizing source count encodedPathCost target with
  | nil =>
      simp [verifyEncodedWeightedPathData] at verified
      obtain ⟨rfl, rfl, rfl⟩ := verified
      simpa [decode_zero] using
        (WeightedTracePath.refl
          (Independent := Independent)
          (swapCost := decodePrimitiveCost decode encodedCost) source)
  | cons head remaining inductionHypothesis =>
      rcases head with ⟨stepCost, next⟩
      simp only [verifyEncodedWeightedPathData] at verified
      split at verified
      next accepted =>
        cases tailEq : verifyEncodedWeightedPathData zero add Independent
            encodedCost next remaining with
        | none => simp [tailEq] at verified
        | some tailResult =>
            rcases tailResult with ⟨tailCount, tailCost, finalTarget⟩
            simp [tailEq] at verified
            obtain ⟨rfl, rfl, rfl⟩ := verified
            simpa [decode_add] using
              (WeightedTracePath.step
                (encodedEdgeDataAccepted_sound decode Independent encodedCost
                  source stepCost next accepted)
                (inductionHypothesis next tailEq))
      next rejected => simp at verified

theorem verifyEncodedWeightedPathData_count_eq_length
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    (source : List Edit) (steps : List (EncodedCost × List Edit))
    {count : Nat} {encodedPathCost : EncodedCost} {target : List Edit}
    (verified : verifyEncodedWeightedPathData zero add Independent encodedCost
      source steps = some (count, encodedPathCost, target)) :
    count = steps.length := by
  induction steps generalizing source count encodedPathCost target with
  | nil =>
      simp [verifyEncodedWeightedPathData] at verified
      exact verified.1.symm
  | cons head remaining inductionHypothesis =>
      rcases head with ⟨stepCost, next⟩
      simp only [verifyEncodedWeightedPathData] at verified
      split at verified
      next accepted =>
        cases tailEq : verifyEncodedWeightedPathData zero add Independent
            encodedCost next remaining with
        | none => simp [tailEq] at verified
        | some tailResult =>
            rcases tailResult with ⟨tailCount, tailCost, finalTarget⟩
            simp [tailEq] at verified
            obtain ⟨rfl, rfl, rfl⟩ := verified
            simp [inductionHypothesis next tailEq]
      next rejected => simp at verified

theorem verifyEncodedWeightedPathData_complete
    {Edit : Type u} [DecidableEq Edit]
    {EncodedCost : Type v} [DecidableEq EncodedCost]
    (decode : EncodedCost → ℝ)
    (zero : EncodedCost) (add : EncodedCost → EncodedCost → EncodedCost)
    (decode_zero : decode zero = 0)
    (decode_add : ∀ left right,
      decode (add left right) = decode left + decode right)
    (Independent : Edit → Edit → Prop) [DecidableRel Independent]
    (encodedCost : List Edit → List Edit → Edit → Edit → EncodedCost)
    {count : Nat} {pathCost : ℝ} {source target : List Edit}
    (path : WeightedTracePath Independent
      (decodePrimitiveCost decode encodedCost)
      count pathCost source target) :
    ∃ steps : List (EncodedCost × List Edit),
      ∃ encodedPathCost : EncodedCost,
      steps.length = count ∧
      verifyEncodedWeightedPathData zero add Independent encodedCost
        source steps = some (count, encodedPathCost, target) ∧
      decode encodedPathCost = pathCost := by
  induction path with
  | refl edits => exact ⟨[], zero, rfl, rfl, decode_zero⟩
  | @step count stepCost tailCost first second target edge rest
      inductionHypothesis =>
      obtain ⟨claimedCost, member, decodeEq⟩ :=
        encodedSwapStepChoicesList_complete decode Independent encodedCost edge
      obtain ⟨steps, encodedTailCost, lengthEq, verified, tailDecodeEq⟩ :=
        inductionHypothesis
      have edgeAccepted : encodedEdgeDataAccepted Independent encodedCost
          first claimedCost second = true := by
        simpa [encodedEdgeDataAccepted] using member
      refine ⟨(claimedCost, second) :: steps,
        add claimedCost encodedTailCost, ?_, ?_, ?_⟩
      · simp [lengthEq]
      · simp [verifyEncodedWeightedPathData, edgeAccepted, verified]
      · rw [decode_add, decodeEq, tailDecodeEq]

end Sprawlens.EncodedWeightedPathDataVerifier
