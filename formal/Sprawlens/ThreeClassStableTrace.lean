import Sprawlens.NatInversionTrace

namespace Sprawlens.ThreeClassStableTrace

open NatInversionTrace
open QuantitativeConfluence
open TraceDerivationGenerator

universe u

inductive Tier3
  | low
  | middle
  | high
  deriving DecidableEq, Repr

@[simp] def tierRank : Tier3 → Nat
  | .low => 0
  | .middle => 1
  | .high => 2

def editsOfTier {Edit : Type u}
    (classifier : Edit → Tier3) (tier : Tier3)
    (edits : List Edit) : List Edit :=
  edits.filter fun edit => decide (classifier edit = tier)

/-- Stable three-class normal form. Payload order within every tier is
preserved. -/
def threeClassCanonical {Edit : Type u}
    (classifier : Edit → Tier3) (edits : List Edit) : List Edit :=
  editsOfTier classifier .low edits ++
    editsOfTier classifier .middle edits ++
      editsOfTier classifier .high edits

def CrossTierIndependent {Edit : Type u}
    (classifier : Edit → Tier3) (first second : Edit) : Prop :=
  classifier first ≠ classifier second

def threeClassInversionCount {Edit : Type u}
    (classifier : Edit → Tier3) (edits : List Edit) : Nat :=
  rankInversionCount (fun edit => tierRank (classifier edit)) edits

theorem classifier_eq_of_mem_editsOfTier
    {Edit : Type u} (classifier : Edit → Tier3)
    (tier : Tier3) {edit : Edit} {edits : List Edit}
    (member : edit ∈ editsOfTier classifier tier edits) :
    classifier edit = tier := by
  simp [editsOfTier] at member
  exact member.2

@[simp] theorem map_tierRank_editsOfTier
    {Edit : Type u} (classifier : Edit → Tier3)
    (tier : Tier3) (edits : List Edit) :
    (editsOfTier classifier tier edits).map
        (fun edit => tierRank (classifier edit)) =
      List.replicate (editsOfTier classifier tier edits).length
        (tierRank tier) := by
  induction edits with
  | nil => simp [editsOfTier]
  | cons edit rest inductionHypothesis =>
      cases tier <;> cases editClass : classifier edit <;>
        simp [editsOfTier, editClass,
          List.replicate_succ] at inductionHypothesis ⊢ <;>
        exact inductionHypothesis

@[simp] theorem threeClassCanonical_cons_low
    {Edit : Type u} (classifier : Edit → Tier3)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = .low) :
    threeClassCanonical classifier (edit :: rest) =
      edit :: threeClassCanonical classifier rest := by
  simp [threeClassCanonical, editsOfTier, editClass]

@[simp] theorem threeClassCanonical_cons_middle
    {Edit : Type u} (classifier : Edit → Tier3)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = .middle) :
    threeClassCanonical classifier (edit :: rest) =
      editsOfTier classifier .low rest ++
        edit :: editsOfTier classifier .middle rest ++
          editsOfTier classifier .high rest := by
  simp [threeClassCanonical, editsOfTier, editClass]

@[simp] theorem threeClassCanonical_cons_high
    {Edit : Type u} (classifier : Edit → Tier3)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = .high) :
    threeClassCanonical classifier (edit :: rest) =
      editsOfTier classifier .low rest ++
        editsOfTier classifier .middle rest ++
          edit :: editsOfTier classifier .high rest := by
  simp [threeClassCanonical, editsOfTier, editClass]

@[simp] theorem lowerCount_rank_low
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    lowerCount (tierRank .low)
      (edits.map fun edit => tierRank (classifier edit)) = 0 := by
  apply lowerCount_eq_zero_of_forall_ge
  intro value valueMem
  simp

@[simp] theorem lowerCount_rank_middle
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    lowerCount (tierRank .middle)
        (edits.map fun edit => tierRank (classifier edit)) =
      (editsOfTier classifier .low edits).length := by
  induction edits with
  | nil => simp [editsOfTier]
  | cons edit rest inductionHypothesis =>
      cases editClass : classifier edit with
      | low | middle | high =>
          simp only [List.map_cons, editClass]
          rw [lowerCount_cons, inductionHypothesis]
          simp [tierRank, editsOfTier, editClass, Nat.add_comm]

@[simp] theorem lowerCount_rank_high
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    lowerCount (tierRank .high)
        (edits.map fun edit => tierRank (classifier edit)) =
      (editsOfTier classifier .low edits).length +
        (editsOfTier classifier .middle edits).length := by
  induction edits with
  | nil => simp [editsOfTier]
  | cons edit rest inductionHypothesis =>
      cases editClass : classifier edit with
      | low | middle | high =>
          simp only [List.map_cons, editClass]
          rw [lowerCount_cons, inductionHypothesis]
          simp [tierRank, editsOfTier, editClass]
          all_goals omega

@[simp] theorem threeClassInversionCount_cons_low
    {Edit : Type u} (classifier : Edit → Tier3)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = .low) :
    threeClassInversionCount classifier (edit :: rest) =
      threeClassInversionCount classifier rest := by
  unfold threeClassInversionCount rankInversionCount
  simp only [List.map_cons, editClass, natInversionCount]
  rw [lowerCount_rank_low classifier rest]
  simp

@[simp] theorem threeClassInversionCount_cons_middle
    {Edit : Type u} (classifier : Edit → Tier3)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = .middle) :
    threeClassInversionCount classifier (edit :: rest) =
      (editsOfTier classifier .low rest).length +
        threeClassInversionCount classifier rest := by
  unfold threeClassInversionCount rankInversionCount
  simp only [List.map_cons, editClass, natInversionCount]
  rw [lowerCount_rank_middle classifier rest]

@[simp] theorem threeClassInversionCount_cons_high
    {Edit : Type u} (classifier : Edit → Tier3)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = .high) :
    threeClassInversionCount classifier (edit :: rest) =
      ((editsOfTier classifier .low rest).length +
          (editsOfTier classifier .middle rest).length) +
        threeClassInversionCount classifier rest := by
  unfold threeClassInversionCount rankInversionCount
  simp only [List.map_cons, editClass, natInversionCount]
  rw [lowerCount_rank_high classifier rest]

theorem map_rank_threeClassCanonical
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    (threeClassCanonical classifier edits).map
        (fun edit => tierRank (classifier edit)) =
      List.replicate (editsOfTier classifier .low edits).length 0 ++
        List.replicate (editsOfTier classifier .middle edits).length 1 ++
          List.replicate (editsOfTier classifier .high edits).length 2 := by
  simp only [threeClassCanonical, List.map_append]
  rw [map_tierRank_editsOfTier,
    map_tierRank_editsOfTier,
    map_tierRank_editsOfTier]
  rfl

@[simp] theorem threeClassInversionCount_canonical
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    threeClassInversionCount classifier
      (threeClassCanonical classifier edits) = 0 := by
  unfold threeClassInversionCount rankInversionCount
  rw [map_rank_threeClassCanonical]
  apply natInversionCount_eq_zero_of_pairwise_le
  simp [List.pairwise_append]

@[simp] theorem editsOfTier_self
    {Edit : Type u} (classifier : Edit → Tier3)
    (tier : Tier3) (edits : List Edit) :
    editsOfTier classifier tier (editsOfTier classifier tier edits) =
      editsOfTier classifier tier edits := by
  simp [editsOfTier, List.filter_filter]

@[simp] theorem editsOfTier_cross
    {Edit : Type u} (classifier : Edit → Tier3)
    {first second : Tier3} (different : first ≠ second)
    (edits : List Edit) :
    editsOfTier classifier first (editsOfTier classifier second edits) = [] := by
  rw [editsOfTier, editsOfTier, List.filter_filter,
    List.filter_eq_nil_iff]
  intro edit editMem bothClasses
  simp only [Bool.and_eq_true, decide_eq_true_eq] at bothClasses
  exact different (bothClasses.1.symm.trans bothClasses.2)

@[simp] theorem editsOfTier_append
    {Edit : Type u} (classifier : Edit → Tier3)
    (tier : Tier3) (first second : List Edit) :
    editsOfTier classifier tier (first ++ second) =
      editsOfTier classifier tier first ++
        editsOfTier classifier tier second := by
  simp [editsOfTier, List.filter_append]

theorem threeClassCanonical_idempotent
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    threeClassCanonical classifier
        (threeClassCanonical classifier edits) =
      threeClassCanonical classifier edits := by
  simp [threeClassCanonical,
    editsOfTier_cross, editsOfTier_self]

/-- Stable three-tier canonicalization uses exactly one permitted adjacent
swap per rank inversion. -/
theorem threeClassStableTrace
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    TraceEquivalentIn (CrossTierIndependent classifier)
      (threeClassInversionCount classifier edits)
      edits (threeClassCanonical classifier edits) := by
  induction edits with
  | nil =>
      simpa [threeClassCanonical, editsOfTier,
        threeClassInversionCount, rankInversionCount,
        natInversionCount] using
        (TraceEquivalentIn.refl
          (Independent := CrossTierIndependent classifier) [])
  | cons edit rest inductionHypothesis =>
      cases editClass : classifier edit with
      | low =>
          simpa [editClass] using
            (Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (CrossTierIndependent classifier) [edit]
              inductionHypothesis)
      | middle =>
          let low := editsOfTier classifier .low rest
          let middle := editsOfTier classifier .middle rest
          let high := editsOfTier classifier .high rest
          have normalizeTail :
              TraceEquivalentIn (CrossTierIndependent classifier)
                (threeClassInversionCount classifier rest)
                (edit :: rest)
                (edit :: threeClassCanonical classifier rest) :=
            Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (CrossTierIndependent classifier) [edit]
              inductionHypothesis
          have editIndependentLow :
              ∀ other, other ∈ low →
                CrossTierIndependent classifier edit other := by
            intro other otherMem
            have otherClass : classifier other = .low :=
              classifier_eq_of_mem_editsOfTier
                classifier .low otherMem
            simp [CrossTierIndependent, editClass, otherClass]
          have moveAcrossLow :
              TraceEquivalentIn (CrossTierIndependent classifier) low.length
                (edit :: threeClassCanonical classifier rest)
                (threeClassCanonical classifier (edit :: rest)) := by
            have move :=
              Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.append
                (CrossTierIndependent classifier) (middle ++ high)
                (moveRight (CrossTierIndependent classifier)
                  edit low editIndependentLow)
            rw [threeClassCanonical_cons_middle
              classifier edit rest editClass]
            simpa [threeClassCanonical, low, middle, high,
              List.append_assoc] using move
          simpa [editClass, low, Nat.add_comm] using
            normalizeTail.trans moveAcrossLow
      | high =>
          let low := editsOfTier classifier .low rest
          let middle := editsOfTier classifier .middle rest
          let high := editsOfTier classifier .high rest
          let crossed := low ++ middle
          have normalizeTail :
              TraceEquivalentIn (CrossTierIndependent classifier)
                (threeClassInversionCount classifier rest)
                (edit :: rest)
                (edit :: threeClassCanonical classifier rest) :=
            Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (CrossTierIndependent classifier) [edit]
              inductionHypothesis
          have editIndependentCrossed :
              ∀ other, other ∈ crossed →
                CrossTierIndependent classifier edit other := by
            intro other otherMem
            simp only [crossed, List.mem_append] at otherMem
            rcases otherMem with lowMem | middleMem
            · have otherClass : classifier other = .low :=
                classifier_eq_of_mem_editsOfTier
                  classifier .low lowMem
              simp [CrossTierIndependent, editClass, otherClass]
            · have otherClass : classifier other = .middle :=
                classifier_eq_of_mem_editsOfTier
                  classifier .middle middleMem
              simp [CrossTierIndependent, editClass, otherClass]
          have moveAcrossLower :
              TraceEquivalentIn (CrossTierIndependent classifier)
                crossed.length
                (edit :: threeClassCanonical classifier rest)
                (threeClassCanonical classifier (edit :: rest)) := by
            have move :=
              Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.append
                (CrossTierIndependent classifier) high
                (moveRight (CrossTierIndependent classifier)
                  edit crossed editIndependentCrossed)
            rw [threeClassCanonical_cons_high
              classifier edit rest editClass]
            simpa [threeClassCanonical, crossed, low, middle, high,
              List.append_assoc] using move
          simpa [editClass, crossed, low, middle,
            List.length_append, Nat.add_comm, Nat.add_left_comm,
            Nat.add_assoc] using
            normalizeTail.trans moveAcrossLower

theorem threeClassInversionCount_bounds_of_traceEquivalentIn
    {Edit : Type u} (classifier : Edit → Tier3)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn (CrossTierIndependent classifier)
      cost first second) :
    threeClassInversionCount classifier first ≤
        threeClassInversionCount classifier second + cost ∧
      threeClassInversionCount classifier second ≤
        threeClassInversionCount classifier first + cost := by
  exact rankInversionCount_bounds_of_traceEquivalentIn
    (fun edit => tierRank (classifier edit))
    (CrossTierIndependent classifier) equivalent

/-- Exact shortest-path certificate for stable normalization of arbitrary
payloads across three ordered classes. -/
theorem threeClassStableTrace_cost_exact
    {Edit : Type u} (classifier : Edit → Tier3) (edits : List Edit) :
    TraceEquivalentIn (CrossTierIndependent classifier)
        (threeClassInversionCount classifier edits)
        edits (threeClassCanonical classifier edits) ∧
      ∀ {cost}, TraceEquivalentIn (CrossTierIndependent classifier)
          cost edits (threeClassCanonical classifier edits) →
        threeClassInversionCount classifier edits ≤ cost := by
  refine ⟨threeClassStableTrace classifier edits, ?_⟩
  intro cost equivalent
  have potentialBound :=
    (threeClassInversionCount_bounds_of_traceEquivalentIn
      classifier equivalent).1
  simpa using potentialBound

theorem reverseThreeTiers_cost_exact :
    TraceEquivalentIn (CrossTierIndependent id) 3
        [.high, .middle, .low]
        [.low, .middle, .high] ∧
      ∀ {cost}, TraceEquivalentIn (CrossTierIndependent id) cost
          [.high, .middle, .low]
          [.low, .middle, .high] →
        3 ≤ cost := by
  simpa [threeClassInversionCount, rankInversionCount,
    natInversionCount, lowerCount, threeClassCanonical,
    editsOfTier] using
    (threeClassStableTrace_cost_exact id [.high, .middle, .low])

end Sprawlens.ThreeClassStableTrace
