import Sprawlens.ReachableRankNormalization

namespace Sprawlens.DeterministicRankNormalization

open NatInversionTrace
open QuantitativeConfluence
open ReachableRankNormalization

universe u

theorem RankReduction.prepend
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    (head : Edit) {next current : List Edit}
    (reduction : RankReduction rank Independent next current) :
    RankReduction rank Independent (head :: next) (head :: current) := by
  obtain ⟨before, after, first, second,
    currentEq, nextEq, independent, inversion⟩ := reduction
  exact ⟨head :: before, after, first, second,
    by simp [currentEq], by simp [nextEq], independent, inversion⟩

/-- Deterministically swap the leftmost adjacent independent strict rank
inversion, if one exists. -/
def reduceFirst? {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] : List Edit → Option (List Edit)
  | first :: second :: rest =>
      if Independent first second ∧ rank second < rank first then
        some (second :: first :: rest)
      else
        (reduceFirst? rank Independent (second :: rest)).map
          fun reduced => first :: reduced
  | _ => none

theorem reduceFirst?_some_rankReduction
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    {edits next : List Edit}
    (reduced : reduceFirst? rank Independent edits = some next) :
    RankReduction rank Independent next edits := by
  induction edits generalizing next with
  | nil => simp [reduceFirst?] at reduced
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => simp [reduceFirst?] at reduced
      | cons second tail =>
          by_cases direct :
              Independent first second ∧ rank second < rank first
          · simp [reduceFirst?, direct] at reduced
            subst next
            exact ⟨[], tail, first, second, rfl, rfl,
              direct.1, direct.2⟩
          · simp only [reduceFirst?, direct, ↓reduceIte]
              at reduced
            cases tailResult :
                reduceFirst? rank Independent (second :: tail) with
            | none => simp [tailResult] at reduced
            | some reducedTail =>
                simp [tailResult] at reduced
                subst next
                exact RankReduction.prepend rank Independent first
                  (inductionHypothesis tailResult)

theorem reduceFirst?_none_iff_normalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    reduceFirst? rank Independent edits = none ↔
      IsReachableRankNormalForm rank Independent edits := by
  induction edits with
  | nil => simp [reduceFirst?, IsReachableRankNormalForm,
      HasReducibleAdjacent]
  | cons first rest inductionHypothesis =>
      cases rest with
      | nil => simp [reduceFirst?, IsReachableRankNormalForm,
          HasReducibleAdjacent]
      | cons second tail =>
          by_cases direct :
              Independent first second ∧ rank second < rank first
          · simp [reduceFirst?, IsReachableRankNormalForm,
              HasReducibleAdjacent, direct]
          · simp [reduceFirst?, IsReachableRankNormalForm,
              HasReducibleAdjacent, direct, inductionHypothesis]

/-- The result carries the number of swaps and the selected representative.
The fuel is an implementation guard; the public normalizer supplies the
initial inversion count. -/
def normalizationResultFuel {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] :
    Nat → List Edit → Nat × List Edit
  | 0, edits => (0, edits)
  | fuel + 1, edits =>
      match reduceFirst? rank Independent edits with
      | none => (0, edits)
      | some next =>
          let result := normalizationResultFuel
            rank Independent fuel next
          (result.1 + 1, result.2)

theorem normalizationResultFuel_descending
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (fuel : Nat) (edits : List Edit) :
    DescendingTraceIn rank Independent
      (normalizationResultFuel rank Independent fuel edits).1
      edits
      (normalizationResultFuel rank Independent fuel edits).2 := by
  induction fuel generalizing edits with
  | zero => simp [normalizationResultFuel, DescendingTraceIn.refl]
  | succ fuel inductionHypothesis =>
      cases step : reduceFirst? rank Independent edits with
      | none =>
          simpa [normalizationResultFuel, step] using
            (DescendingTraceIn.refl
              (rank := rank) (Independent := Independent) edits)
      | some next =>
          have firstStep :=
            (reduceFirst?_some_rankReduction
              rank Independent step).toDescendingTraceIn
                rank Independent
          have rest := inductionHypothesis next
          simpa [normalizationResultFuel, step, Nat.add_comm] using
            firstStep.trans rest

theorem normalizationResultFuel_normalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (fuel : Nat) (edits : List Edit)
    (enough : rankInversionCount rank edits ≤ fuel) :
    IsReachableRankNormalForm rank Independent
      (normalizationResultFuel rank Independent fuel edits).2 := by
  induction fuel generalizing edits with
  | zero =>
      have inversionZero : rankInversionCount rank edits = 0 := by omega
      have noReduction : ¬∃ next,
          RankReduction rank Independent next edits := by
        rintro ⟨next, reduction⟩
        have decrease := reduction.rankInversionCount_lt rank Independent
        omega
      have normalForm :=
        (exists_rankReduction_iff_hasReducibleAdjacent
          rank Independent edits).not.mp noReduction
      simpa [normalizationResultFuel, IsReachableRankNormalForm] using
        normalForm
  | succ fuel inductionHypothesis =>
      cases step : reduceFirst? rank Independent edits with
      | none =>
          have normalForm :=
            (reduceFirst?_none_iff_normalForm
              rank Independent edits).mp step
          simpa [normalizationResultFuel, step] using normalForm
      | some next =>
          have reduction := reduceFirst?_some_rankReduction
            rank Independent step
          have decrease := reduction.rankInversionCount_lt rank Independent
          have nextEnough : rankInversionCount rank next ≤ fuel := by
            omega
          have normalForm := inductionHypothesis next nextEnough
          simpa [normalizationResultFuel, step] using normalForm

def deterministicNormalizationResult {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) : Nat × List Edit :=
  normalizationResultFuel rank Independent
    (rankInversionCount rank edits) edits

def deterministicNormalizationCost {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) : Nat :=
  (deterministicNormalizationResult rank Independent edits).1

def deterministicNormalForm {Edit : Type u}
    (rank : Edit → Nat) (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) : List Edit :=
  (deterministicNormalizationResult rank Independent edits).2

theorem deterministicNormalization_descending
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    DescendingTraceIn rank Independent
      (deterministicNormalizationCost rank Independent edits)
      edits (deterministicNormalForm rank Independent edits) := by
  exact normalizationResultFuel_descending rank Independent
    (rankInversionCount rank edits) edits

theorem deterministicNormalForm_isNormalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    IsReachableRankNormalForm rank Independent
      (deterministicNormalForm rank Independent edits) := by
  exact normalizationResultFuel_normalForm rank Independent
    (rankInversionCount rank edits) edits (by rfl)

theorem deterministicNormalization_exact_accounting
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    rankInversionCount rank edits =
      deterministicNormalizationCost rank Independent edits +
        rankInversionCount rank
          (deterministicNormalForm rank Independent edits) := by
  exact (deterministicNormalization_descending
    rank Independent edits).rankInversionCount_eq rank Independent

theorem deterministicNormalizationCost_le_initialInversions
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    deterministicNormalizationCost rank Independent edits ≤
      rankInversionCount rank edits := by
  exact (deterministicNormalization_descending
    rank Independent edits).cost_le_initialInversions rank Independent

/-- Although the selected irreducible target can depend on the leftmost
policy, the generated path is shortest in unweighted adjacent-swap count to
that selected target. -/
theorem deterministicNormalizationCost_minimal_to_selectedTarget
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit)
    {cost : Nat}
    (equivalent : TraceEquivalentIn Independent cost edits
      (deterministicNormalForm rank Independent edits)) :
    deterministicNormalizationCost rank Independent edits ≤ cost := by
  have accounting := deterministicNormalization_exact_accounting
    rank Independent edits
  have potentialBound :=
    (rankInversionCount_bounds_of_traceEquivalentIn
      rank Independent equivalent).1
  omega

theorem deterministicNormalization_cost_exact
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    DescendingTraceIn rank Independent
        (deterministicNormalizationCost rank Independent edits)
        edits (deterministicNormalForm rank Independent edits) ∧
      ∀ {cost}, TraceEquivalentIn Independent cost edits
          (deterministicNormalForm rank Independent edits) →
        deterministicNormalizationCost rank Independent edits ≤ cost := by
  exact ⟨deterministicNormalization_descending rank Independent edits,
    fun equivalent =>
      deterministicNormalizationCost_minimal_to_selectedTarget
        rank Independent edits equivalent⟩

theorem normalizationResultFuel_eq_self_of_normalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent]
    (fuel : Nat) (edits : List Edit)
    (normalForm : IsReachableRankNormalForm rank Independent edits) :
    normalizationResultFuel rank Independent fuel edits = (0, edits) := by
  cases fuel with
  | zero => rfl
  | succ fuel =>
      have none := (reduceFirst?_none_iff_normalForm
        rank Independent edits).mpr normalForm
      simp [normalizationResultFuel, none]

theorem deterministicNormalForm_eq_self_of_normalForm
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit)
    (normalForm : IsReachableRankNormalForm rank Independent edits) :
    deterministicNormalForm rank Independent edits = edits := by
  simp [deterministicNormalForm, deterministicNormalizationResult,
    normalizationResultFuel_eq_self_of_normalForm
      rank Independent _ edits normalForm]

theorem deterministicNormalForm_idempotent
    {Edit : Type u} (rank : Edit → Nat)
    (Independent : Edit → Edit → Prop)
    [DecidableRel Independent] (edits : List Edit) :
    deterministicNormalForm rank Independent
        (deterministicNormalForm rank Independent edits) =
      deterministicNormalForm rank Independent edits := by
  apply deterministicNormalForm_eq_self_of_normalForm
  exact deterministicNormalForm_isNormalForm rank Independent edits

instance forkIndependentDecidable : DecidableRel ForkIndependent := by
  intro first second
  cases first <;> cases second <;> unfold ForkIndependent <;> infer_instance

/-- The explicit leftmost policy resolves the non-confluent fork by selecting
the left branch. The theorem records a policy choice, not an intrinsic unique
normal form. -/
theorem deterministicForkNormalization :
    deterministicNormalizationResult forkRank ForkIndependent
      [ForkEdit.high, ForkEdit.middle, ForkEdit.low] =
        (1, [ForkEdit.middle, ForkEdit.high, ForkEdit.low]) := by
  native_decide

end Sprawlens.DeterministicRankNormalization
