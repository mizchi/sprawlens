import Sprawlens.FixedPointStreamingCpuRefinement

namespace Sprawlens.FixedPointResourceCounterSafety

open FixedPointStreamingDecompression

universe u

def wrappedAdd (modulus left right : Nat) : Nat :=
  (left + right) % modulus

def wrappedWithinLimit
    (modulus limit used delta : Nat) : Bool :=
  decide (wrappedAdd modulus used delta ≤ limit)

/-- A finite-width-style add-then-compare can accept after wraparound even
though the mathematical counter crossed its limit. -/
theorem wrappedAdd_can_bypass_limit :
    wrappedAdd 256 255 2 = 1 ∧
      wrappedWithinLimit 256 255 255 2 = true ∧
      255 < 255 + 2 := by
  native_decide

/-- Check `delta ≤ limit - used` only after proving `used ≤ limit`.
The final addition is then known to stay at or below `limit`. -/
def checkedAddWithin
    (limit used delta : Nat) : Option Nat :=
  if _usedWithin : used ≤ limit then
    if _deltaWithin : delta ≤ limit - used then some (used + delta)
    else none
  else none

theorem checkedAddWithin_eq_some_iff
    (limit used delta total : Nat) :
    checkedAddWithin limit used delta = some total ↔
      used ≤ limit ∧ used + delta ≤ limit ∧ total = used + delta := by
  by_cases usedWithin : used ≤ limit
  · by_cases deltaWithin : delta ≤ limit - used
    · simp [checkedAddWithin, usedWithin, deltaWithin]
      omega
    · simp [checkedAddWithin, usedWithin, deltaWithin]
      omega
  · simp [checkedAddWithin, usedWithin]

theorem checkedAddWithin_eq_none_iff
    (limit used delta : Nat) :
    checkedAddWithin limit used delta = none ↔
      limit < used ∨ limit < used + delta := by
  by_cases usedWithin : used ≤ limit
  · by_cases deltaWithin : delta ≤ limit - used
    · simp [checkedAddWithin, usedWithin, deltaWithin]
      omega
    · simp [checkedAddWithin, usedWithin, deltaWithin]
      omega
  · simp [checkedAddWithin, usedWithin]
    omega

theorem checkedAddWithin_exists_iff
    (limit used delta : Nat) :
    (∃ total, checkedAddWithin limit used delta = some total) ↔
      used + delta ≤ limit := by
  constructor
  · rintro ⟨total, accepted⟩
    exact (checkedAddWithin_eq_some_iff limit used delta total).mp accepted |>.2.1
  · intro within
    exact ⟨used + delta,
      (checkedAddWithin_eq_some_iff limit used delta (used + delta)).mpr
        ⟨by omega, within, rfl⟩⟩

theorem checkedAddWithin_success_machineBound
    (machineMax limit used delta total : Nat)
    (limitWithinMachine : limit ≤ machineMax)
    (accepted : checkedAddWithin limit used delta = some total) :
    total ≤ machineMax := by
  obtain ⟨_, sumWithin, rfl⟩ :=
    (checkedAddWithin_eq_some_iff limit used delta total).mp accepted
  exact sumWithin.trans limitWithinMachine

theorem checkedAddWithin_mono_limit
    {smaller larger used delta total : Nat}
    (limitLe : smaller ≤ larger)
    (accepted : checkedAddWithin smaller used delta = some total) :
    checkedAddWithin larger used delta = some total := by
  obtain ⟨usedWithin, sumWithin, totalEq⟩ :=
    (checkedAddWithin_eq_some_iff smaller used delta total).mp accepted
  exact (checkedAddWithin_eq_some_iff larger used delta total).mpr
    ⟨usedWithin.trans limitLe, sumWithin.trans limitLe, totalEq⟩

def totalWeight
    (weight : α → Nat) : List α → Nat
  | [] => 0
  | item :: remaining => weight item + totalWeight weight remaining

def checkedAccumulateAux
    (limit : Nat) (weight : α → Nat) : Nat → List α → Option Nat
  | used, [] => if used ≤ limit then some used else none
  | used, item :: remaining =>
      match checkedAddWithin limit used (weight item) with
      | none => none
      | some next => checkedAccumulateAux limit weight next remaining

def checkedAccumulate
    (limit : Nat) (weight : α → Nat) (items : List α) : Option Nat :=
  checkedAccumulateAux limit weight 0 items

theorem checkedAccumulateAux_eq_some_iff
    (limit : Nat) (weight : α → Nat)
    (used : Nat) (items : List α) (total : Nat) :
    checkedAccumulateAux limit weight used items = some total ↔
      used + totalWeight weight items ≤ limit ∧
        total = used + totalWeight weight items := by
  induction items generalizing used total with
  | nil =>
      simp [checkedAccumulateAux, totalWeight, eq_comm]
  | cons item remaining inductionHypothesis =>
      cases addEq : checkedAddWithin limit used (weight item) with
      | none =>
          have addFailure := (checkedAddWithin_eq_none_iff limit used
            (weight item)).mp addEq
          simp [checkedAccumulateAux, addEq, totalWeight]
          omega
      | some next =>
          have addInfo := (checkedAddWithin_eq_some_iff limit used
            (weight item) next).mp addEq
          rw [checkedAccumulateAux, addEq,
            inductionHypothesis next total]
          simp only [totalWeight]
          omega

theorem checkedAccumulate_eq_some_iff
    (limit : Nat) (weight : α → Nat) (items : List α) (total : Nat) :
    checkedAccumulate limit weight items = some total ↔
      totalWeight weight items ≤ limit ∧ total = totalWeight weight items := by
  simpa [checkedAccumulate] using
    checkedAccumulateAux_eq_some_iff limit weight 0 items total

theorem checkedAccumulate_exists_iff
    (limit : Nat) (weight : α → Nat) (items : List α) :
    (∃ total, checkedAccumulate limit weight items = some total) ↔
      totalWeight weight items ≤ limit := by
  constructor
  · rintro ⟨total, accepted⟩
    exact (checkedAccumulate_eq_some_iff limit weight items total).mp
      accepted |>.1
  · intro within
    exact ⟨totalWeight weight items,
      (checkedAccumulate_eq_some_iff limit weight items
        (totalWeight weight items)).mpr ⟨within, rfl⟩⟩

theorem checkedAccumulate_eq_none_iff
    (limit : Nat) (weight : α → Nat) (items : List α) :
    checkedAccumulate limit weight items = none ↔
      limit < totalWeight weight items := by
  constructor
  · intro rejected
    by_contra notExceeded
    have within : totalWeight weight items ≤ limit := by omega
    obtain ⟨total, accepted⟩ :=
      (checkedAccumulate_exists_iff limit weight items).mpr within
    rw [rejected] at accepted
    simp at accepted
  · intro exceeded
    cases accumulatedEq : checkedAccumulate limit weight items with
    | none => rfl
    | some total =>
        have within := (checkedAccumulate_eq_some_iff limit weight items
          total).mp accumulatedEq |>.1
        omega

theorem checkedAccumulate_mono_limit
    {smaller larger : Nat}
    (limitLe : smaller ≤ larger)
    (weight : α → Nat) (items : List α) (total : Nat)
    (accepted : checkedAccumulate smaller weight items = some total) :
    checkedAccumulate larger weight items = some total := by
  obtain ⟨within, totalEq⟩ :=
    (checkedAccumulate_eq_some_iff smaller weight items total).mp accepted
  exact (checkedAccumulate_eq_some_iff larger weight items total).mpr
    ⟨within.trans limitLe, totalEq⟩

theorem totalWeight_chunkWork_eq
    (chunks : List DecompressionChunk) :
    totalWeight (fun chunk => chunk.work) chunks = totalChunkWork chunks := by
  induction chunks with
  | nil => rfl
  | cons chunk remaining inductionHypothesis =>
      simp [totalWeight, totalChunkWork, inductionHypothesis]

theorem totalWeight_chunkBytes_eq
    (chunks : List DecompressionChunk) :
    totalWeight DecompressionChunk.bytes chunks = totalChunkBytes chunks := by
  induction chunks with
  | nil => rfl
  | cons chunk remaining inductionHypothesis =>
      simp [totalWeight, totalChunkBytes, inductionHypothesis]

def checkedChunkWork
    (limit : Nat) (chunks : List DecompressionChunk) : Option Nat :=
  checkedAccumulate limit (fun chunk => chunk.work) chunks

def checkedChunkBytes
    (limit : Nat) (chunks : List DecompressionChunk) : Option Nat :=
  checkedAccumulate limit DecompressionChunk.bytes chunks

theorem checkedChunkWork_eq_some_iff
    (limit total : Nat) (chunks : List DecompressionChunk) :
    checkedChunkWork limit chunks = some total ↔
      totalChunkWork chunks ≤ limit ∧ total = totalChunkWork chunks := by
  simpa [checkedChunkWork, totalWeight_chunkWork_eq] using
    checkedAccumulate_eq_some_iff limit (fun chunk => chunk.work) chunks total

theorem checkedChunkBytes_eq_some_iff
    (limit total : Nat) (chunks : List DecompressionChunk) :
    checkedChunkBytes limit chunks = some total ↔
      totalChunkBytes chunks ≤ limit ∧ total = totalChunkBytes chunks := by
  simpa [checkedChunkBytes, totalWeight_chunkBytes_eq] using
    checkedAccumulate_eq_some_iff limit DecompressionChunk.bytes chunks total

def twoThreeWeights : List Nat := [2, 3]

theorem checkedAccumulate_exactBoundary :
    checkedAccumulate 5 id twoThreeWeights = some 5 := by
  native_decide

theorem checkedAccumulate_oneBelow_rejected :
    checkedAccumulate 4 id twoThreeWeights = none := by
  native_decide

theorem twoBraceCheckedCounters_exactBoundary :
    checkedChunkWork 2 twoBraceChunks = some 2 ∧
      checkedChunkBytes 2 twoBraceChunks = some 2 := by
  native_decide

end Sprawlens.FixedPointResourceCounterSafety
