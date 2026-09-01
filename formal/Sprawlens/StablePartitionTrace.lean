import Sprawlens.TraceDerivationGenerator

namespace Sprawlens.StablePartitionTrace

open QuantitativeConfluence
open TraceDerivationGenerator

universe u

def lowEdits {Edit : Type u}
    (classifier : Edit → Bool) (edits : List Edit) : List Edit :=
  edits.filter fun edit => !classifier edit

def highEdits {Edit : Type u}
    (classifier : Edit → Bool) (edits : List Edit) : List Edit :=
  edits.filter classifier

/-- Stable two-class normal form. Within-class edit order is preserved. -/
def stablePartition {Edit : Type u}
    (classifier : Edit → Bool) (edits : List Edit) : List Edit :=
  lowEdits classifier edits ++ highEdits classifier edits

/-- Only edits from different classes may commute. Edits can retain arbitrary
identities and payloads within each class. -/
def CrossClassIndependent {Edit : Type u}
    (classifier : Edit → Bool) (first second : Edit) : Prop :=
  classifier first ≠ classifier second

/-- Number of high-before-low class inversions, ignoring edit identity. -/
def classInversionCount {Edit : Type u}
    (classifier : Edit → Bool) (edits : List Edit) : Nat :=
  inversionCount (edits.map classifier)

@[simp] theorem stablePartition_cons_false
    {Edit : Type u} (classifier : Edit → Bool)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = false) :
    stablePartition classifier (edit :: rest) =
      edit :: stablePartition classifier rest := by
  simp [stablePartition, lowEdits, highEdits, editClass]

@[simp] theorem stablePartition_cons_true
    {Edit : Type u} (classifier : Edit → Bool)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = true) :
    stablePartition classifier (edit :: rest) =
      lowEdits classifier rest ++ edit :: highEdits classifier rest := by
  simp [stablePartition, lowEdits, highEdits, editClass]

@[simp] theorem count_false_map_classifier
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    (edits.map classifier).count false =
      (lowEdits classifier edits).length := by
  induction edits with
  | nil => simp [lowEdits]
  | cons edit rest inductionHypothesis =>
      cases editClass : classifier edit <;>
        simp [lowEdits, editClass, inductionHypothesis]

@[simp] theorem map_classifier_lowEdits
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    (lowEdits classifier edits).map classifier =
      List.replicate (lowEdits classifier edits).length false := by
  induction edits with
  | nil => simp [lowEdits]
  | cons edit rest inductionHypothesis =>
      have tailHypothesis :
          (List.filter (fun candidate => !classifier candidate) rest).map
              classifier =
            List.replicate
              (List.filter (fun candidate => !classifier candidate) rest).length
              false := by
        simpa only [lowEdits] using inductionHypothesis
      cases editClass : classifier edit <;>
        simp [lowEdits, editClass, tailHypothesis,
          List.replicate_succ]

@[simp] theorem map_classifier_highEdits
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    (highEdits classifier edits).map classifier =
      List.replicate (highEdits classifier edits).length true := by
  induction edits with
  | nil => simp [highEdits]
  | cons edit rest inductionHypothesis =>
      have tailHypothesis :
          (List.filter classifier rest).map classifier =
            List.replicate (List.filter classifier rest).length true := by
        simpa only [highEdits] using inductionHypothesis
      cases editClass : classifier edit <;>
        simp [highEdits, editClass, tailHypothesis,
          List.replicate_succ]

@[simp] theorem classInversionCount_cons_false
    {Edit : Type u} (classifier : Edit → Bool)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = false) :
    classInversionCount classifier (edit :: rest) =
      classInversionCount classifier rest := by
  simp [classInversionCount, inversionCount, editClass]

@[simp] theorem classInversionCount_cons_true
    {Edit : Type u} (classifier : Edit → Bool)
    (edit : Edit) (rest : List Edit)
    (editClass : classifier edit = true) :
    classInversionCount classifier (edit :: rest) =
      (lowEdits classifier rest).length +
        classInversionCount classifier rest := by
  simp [classInversionCount, inversionCount, editClass]

@[simp] theorem classInversionCount_stablePartition
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    classInversionCount classifier (stablePartition classifier edits) = 0 := by
  simp [classInversionCount, stablePartition,
    inversionCount_false_true_blocks]

theorem stablePartition_idempotent
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    stablePartition classifier (stablePartition classifier edits) =
      stablePartition classifier edits := by
  simp [stablePartition, lowEdits, highEdits, List.filter_append]

/-- Stable partition is constructible using exactly one adjacent swap per
high-before-low inversion, while never swapping edits within the same class. -/
theorem stablePartitionTrace
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    TraceEquivalentIn (CrossClassIndependent classifier)
      (classInversionCount classifier edits)
      edits (stablePartition classifier edits) := by
  induction edits with
  | nil =>
      simpa [stablePartition, lowEdits, highEdits, classInversionCount,
        inversionCount] using
        (TraceEquivalentIn.refl
          (Independent := CrossClassIndependent classifier) [])
  | cons edit rest inductionHypothesis =>
      cases editClass : classifier edit with
      | false =>
          simpa [editClass] using
            (Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (CrossClassIndependent classifier) [edit]
              inductionHypothesis)
      | true =>
          let low := lowEdits classifier rest
          let high := highEdits classifier rest
          have normalizeTail :
              TraceEquivalentIn (CrossClassIndependent classifier)
                (classInversionCount classifier rest)
                (edit :: rest) (edit :: stablePartition classifier rest) :=
            Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (CrossClassIndependent classifier) [edit]
              inductionHypothesis
          have editIndependentLow :
              ∀ other, other ∈ low →
                CrossClassIndependent classifier edit other := by
            intro other otherMem
            have otherClass : classifier other = false := by
              simp [low, lowEdits] at otherMem
              exact otherMem.2
            simp [CrossClassIndependent, editClass, otherClass]
          have moveAcrossLow :
              TraceEquivalentIn (CrossClassIndependent classifier) low.length
                (edit :: stablePartition classifier rest)
                (stablePartition classifier (edit :: rest)) := by
            have move :=
              Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.append
                (CrossClassIndependent classifier) high
                (moveRight (CrossClassIndependent classifier)
                  edit low editIndependentLow)
            rw [stablePartition_cons_true classifier edit rest editClass]
            simpa [stablePartition, low, high,
              List.append_assoc] using move
          simpa [editClass, low, Nat.add_comm] using
            normalizeTail.trans moveAcrossLow

/-- Class inversion potential changes by at most one along every allowed
primitive swap, hence lower-bounds all partial-independence derivations. -/
theorem classInversionCount_bounds_of_traceEquivalentIn
    {Edit : Type u} (classifier : Edit → Bool)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn (CrossClassIndependent classifier)
      cost first second) :
    classInversionCount classifier first ≤
        classInversionCount classifier second + cost ∧
      classInversionCount classifier second ≤
        classInversionCount classifier first + cost := by
  have mapped :=
    Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.map
      (CrossClassIndependent classifier) (@AllIndependent Bool)
      classifier (by simp [AllIndependent]) equivalent
  exact inversionCount_bounds_of_traceEquivalentIn
    (@AllIndependent Bool) mapped

/-- Exact shortest-path certificate for stable normalization of arbitrary edit
payloads under two-class partial independence. -/
theorem stablePartitionTrace_cost_exact
    {Edit : Type u} (classifier : Edit → Bool) (edits : List Edit) :
    TraceEquivalentIn (CrossClassIndependent classifier)
        (classInversionCount classifier edits)
        edits (stablePartition classifier edits) ∧
      ∀ {cost}, TraceEquivalentIn (CrossClassIndependent classifier)
          cost edits (stablePartition classifier edits) →
        classInversionCount classifier edits ≤ cost := by
  refine ⟨stablePartitionTrace classifier edits, ?_⟩
  intro cost equivalent
  have potentialBound :=
    (classInversionCount_bounds_of_traceEquivalentIn classifier equivalent).1
  simpa using potentialBound

end Sprawlens.StablePartitionTrace
