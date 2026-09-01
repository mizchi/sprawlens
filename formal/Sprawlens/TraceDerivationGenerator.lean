import Sprawlens.QuantitativeConfluence

namespace Sprawlens.TraceDerivationGenerator

open QuantitativeConfluence

universe u

/-- Prefixing both traces preserves the exact adjacent-swap count. -/
theorem TraceEquivalentIn.prepend
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (context : List Edit)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    TraceEquivalentIn Independent cost
      (context ++ first) (context ++ second) := by
  induction equivalent with
  | refl edits => exact .refl (context ++ edits)
  | swap before after first second independent =>
      simpa only [List.append_assoc, List.cons_append] using
        (TraceEquivalentIn.swap
          (Independent := Independent)
          (context ++ before) after first second independent)
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- Appending the same suffix to both traces preserves the exact swap count. -/
theorem TraceEquivalentIn.append
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (context : List Edit)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    TraceEquivalentIn Independent cost
      (first ++ context) (second ++ context) := by
  induction equivalent with
  | refl edits => exact .refl (edits ++ context)
  | swap before after first second independent =>
      simpa only [List.append_assoc, List.cons_append] using
        (TraceEquivalentIn.swap
          (Independent := Independent)
          before (after ++ context) first second independent)
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- Mapping edit labels preserves a counted derivation whenever primitive
independence is preserved by the map. -/
theorem TraceEquivalentIn.map
    {Edit : Type u} {Target : Type*}
    (Independent : Edit → Edit → Prop)
    (TargetIndependent : Target → Target → Prop)
    (transform : Edit → Target)
    (preservesIndependent : ∀ first second,
      Independent first second →
        TargetIndependent (transform first) (transform second))
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    TraceEquivalentIn TargetIndependent cost
      (first.map transform) (second.map transform) := by
  induction equivalent with
  | refl edits => exact .refl (edits.map transform)
  | swap before after first second independent =>
      simpa [List.map_append] using
        (TraceEquivalentIn.swap
          (Independent := TargetIndependent)
          (before.map transform) (after.map transform)
          (transform first) (transform second)
          (preservesIndependent first second independent))
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- Weakening the independence relation preserves a counted derivation. -/
theorem TraceEquivalentIn.mono
    {Edit : Type u}
    (Independent Stronger : Edit → Edit → Prop)
    (preservesIndependent : ∀ first second,
      Independent first second → Stronger first second)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    TraceEquivalentIn Stronger cost first second := by
  induction equivalent with
  | refl edits => exact .refl edits
  | swap before after first second independent =>
      exact .swap before after first second
        (preservesIndependent first second independent)
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- If no primitive pair is independent, every counted derivation is an
identity derivation. -/
theorem TraceEquivalentIn.eq_of_no_independent
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (noIndependent : ∀ first second, ¬Independent first second)
    {cost : Nat} {first second : List Edit}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    first = second := by
  induction equivalent with
  | refl edits => rfl
  | swap before after first second independent =>
      exact (noIndependent first second independent).elim
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      exact leftHypothesis.trans rightHypothesis

/-- Deterministically move one edit across an independent suffix. The
constructed derivation uses exactly one adjacent swap per suffix element. -/
theorem moveRight
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (edit : Edit) (rest : List Edit)
    (independent : ∀ other, other ∈ rest → Independent edit other) :
    TraceEquivalentIn Independent rest.length
      (edit :: rest) (rest ++ [edit]) := by
  induction rest with
  | nil =>
      simpa using
        (TraceEquivalentIn.refl (Independent := Independent) [edit])
  | cons other tail inductionHypothesis =>
      have editOther : Independent edit other := independent other (by simp)
      have editTail : ∀ candidate, candidate ∈ tail → Independent edit candidate := by
        intro candidate candidateMem
        exact independent candidate (by simp [candidateMem])
      have firstSwap :
          TraceEquivalentIn Independent 1
            (edit :: other :: tail) (other :: edit :: tail) := by
        simpa using
          (TraceEquivalentIn.swap
            (Independent := Independent)
            [] tail edit other editOther)
      have moveTail :=
        Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
          Independent [other] (inductionHypothesis editTail)
      simpa [List.cons_append, Nat.add_comm] using
        firstSwap.trans moveTail

theorem moveLeft
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (edit : Edit) (rest : List Edit)
    (independent : ∀ other, other ∈ rest → Independent edit other) :
    TraceEquivalentIn Independent rest.length
      (rest ++ [edit]) (edit :: rest) :=
  (moveRight Independent edit rest independent).symm

def BlocksIndependent {Edit : Type u}
    (Independent : Edit → Edit → Prop)
    (left right : List Edit) : Prop :=
  ∀ first, first ∈ left → ∀ second, second ∈ right →
    Independent first second

/-- Swap two internally ordered independent blocks. The constructive upper
bound is the Cartesian product of block lengths. -/
theorem swapBlocks
    {Edit : Type u} (Independent : Edit → Edit → Prop)
    (left right : List Edit)
    (independent : BlocksIndependent Independent left right) :
    TraceEquivalentIn Independent (left.length * right.length)
      (left ++ right) (right ++ left) := by
  induction left with
  | nil =>
      simpa using
        (TraceEquivalentIn.refl (Independent := Independent) right)
  | cons head tail inductionHypothesis =>
      have tailIndependent : BlocksIndependent Independent tail right := by
        intro first firstMem second secondMem
        exact independent first (by simp [firstMem]) second secondMem
      have headIndependent :
          ∀ second, second ∈ right → Independent head second := by
        intro second secondMem
        exact independent head (by simp) second secondMem
      have moveTail :=
        Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
          Independent [head] (inductionHypothesis tailIndependent)
      have moveHead :=
        Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.append
          Independent tail (moveRight Independent head right headIndependent)
      simpa [List.cons_append, List.append_assoc, Nat.succ_mul] using
        moveTail.trans moveHead

def AllIndependent {Edit : Type u} (_ _ : Edit) : Prop :=
  True

/-- Executable-size sanity witness for the block construction: two edits cross
three edits in six primitive swaps. -/
theorem twoByThreeBlockSwap :
    TraceEquivalentIn (@AllIndependent Bool) 6
      ([false, true] ++ [true, false, true])
      ([true, false, true] ++ [false, true]) := by
  simpa using
    (swapBlocks (@AllIndependent Bool)
      [false, true] [true, false, true]
      (by simp [BlocksIndependent, AllIndependent]))

/-- Number of out-of-order `true`-before-`false` pairs in a binary trace. -/
def inversionCount : List Bool → Nat
  | [] => 0
  | false :: rest => inversionCount rest
  | true :: rest => rest.count false + inversionCount rest

/-- One adjacent swap changes the binary inversion potential by at most one in
either direction, even inside an arbitrary context. -/
theorem inversionCount_adjacent_swap_bounds
    (before after : List Bool) (first second : Bool) :
    inversionCount (before ++ first :: second :: after) ≤
        inversionCount (before ++ second :: first :: after) + 1 ∧
      inversionCount (before ++ second :: first :: after) ≤
        inversionCount (before ++ first :: second :: after) + 1 := by
  induction before with
  | nil =>
      cases first <;> cases second <;>
        simp [inversionCount] <;> omega
  | cons head before inductionHypothesis =>
      cases head with
      | false =>
          simpa [inversionCount] using inductionHypothesis
      | true =>
          simp only [List.cons_append, inversionCount]
          have countEq :
              (before ++ first :: second :: after).count false =
                (before ++ second :: first :: after).count false := by
            cases first <;> cases second <;>
              simp [List.count_append, Nat.add_comm, Nat.add_left_comm]
          rw [countEq]
          omega

/-- The inversion potential difference lower-bounds the cost index of every
binary adjacent-swap derivation. -/
theorem inversionCount_bounds_of_traceEquivalentIn
    (Independent : Bool → Bool → Prop)
    {cost : Nat} {first second : List Bool}
    (equivalent : TraceEquivalentIn Independent cost first second) :
    inversionCount first ≤ inversionCount second + cost ∧
      inversionCount second ≤ inversionCount first + cost := by
  induction equivalent with
  | refl edits => omega
  | swap before after first second independent =>
      exact inversionCount_adjacent_swap_bounds before after first second
  | symm equivalent inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans left right leftHypothesis rightHypothesis =>
      omega

@[simp] theorem count_false_replicate_true (count : Nat) :
    (List.replicate count true).count false = 0 := by
  induction count with
  | zero => simp
  | succ count inductionHypothesis =>
      simp [List.replicate_succ, inductionHypothesis]

@[simp] theorem count_false_replicate_false (count : Nat) :
    (List.replicate count false).count false = count := by
  induction count with
  | zero => simp
  | succ count inductionHypothesis =>
      simp [List.replicate_succ, inductionHypothesis]

@[simp] theorem inversionCount_replicate_true (count : Nat) :
    inversionCount (List.replicate count true) = 0 := by
  induction count with
  | zero => simp [inversionCount]
  | succ count inductionHypothesis =>
      simp [List.replicate_succ, inversionCount, inductionHypothesis]

@[simp] theorem inversionCount_replicate_false (count : Nat) :
    inversionCount (List.replicate count false) = 0 := by
  induction count with
  | zero => simp [inversionCount]
  | succ count inductionHypothesis =>
      simp [List.replicate_succ, inversionCount, inductionHypothesis]

theorem inversionCount_true_false_blocks (leftCount rightCount : Nat) :
    inversionCount
      (List.replicate leftCount true ++
        List.replicate rightCount false) =
      leftCount * rightCount := by
  induction leftCount with
  | zero => simp
  | succ leftCount inductionHypothesis =>
      simp [List.replicate_succ, inversionCount, List.count_append,
        inductionHypothesis, Nat.succ_mul, Nat.add_comm]

theorem inversionCount_false_true_blocks (leftCount rightCount : Nat) :
    inversionCount
      (List.replicate rightCount false ++
        List.replicate leftCount true) = 0 := by
  induction rightCount with
  | zero => simp
  | succ rightCount inductionHypothesis =>
      simp [List.replicate_succ, inversionCount, inductionHypothesis]

/-- Canonical binary trace: every `false` edit precedes every `true` edit,
while multiplicities are preserved. -/
def canonicalBinary (edits : List Bool) : List Bool :=
  List.replicate (edits.count false) false ++
    List.replicate (edits.count true) true

theorem cons_replicate_eq_replicate_append_singleton
    {Item : Type u} (item : Item) (count : Nat) :
    item :: List.replicate count item =
      List.replicate count item ++ [item] := by
  induction count with
  | zero => simp
  | succ count inductionHypothesis =>
      simpa only [List.replicate_succ, List.cons_append] using
        congrArg (List.cons item) inductionHypothesis

@[simp] theorem canonicalBinary_cons_false (rest : List Bool) :
    canonicalBinary (false :: rest) = false :: canonicalBinary rest := by
  simp [canonicalBinary, List.replicate_succ]

@[simp] theorem canonicalBinary_cons_true (rest : List Bool) :
    canonicalBinary (true :: rest) = canonicalBinary rest ++ [true] := by
  simpa [canonicalBinary, List.replicate_succ, List.append_assoc] using
    (cons_replicate_eq_replicate_append_singleton
      true (rest.count true))

@[simp] theorem inversionCount_canonicalBinary (edits : List Bool) :
    inversionCount (canonicalBinary edits) = 0 := by
  simp [canonicalBinary, inversionCount_false_true_blocks]

/-- Stable binary canonicalization uses exactly the inversion potential as its
adjacent-swap cost. -/
theorem canonicalizeBinary (edits : List Bool) :
    TraceEquivalentIn (@AllIndependent Bool) (inversionCount edits)
      edits (canonicalBinary edits) := by
  induction edits with
  | nil =>
      simpa [canonicalBinary, inversionCount] using
        (TraceEquivalentIn.refl (Independent := @AllIndependent Bool) [])
  | cons head rest inductionHypothesis =>
      cases head with
      | false =>
          simpa [inversionCount] using
            (Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (@AllIndependent Bool) [false] inductionHypothesis)
      | true =>
          let falseBlock := List.replicate (rest.count false) false
          let trueBlock := List.replicate (rest.count true) true
          have normalizeTail :
              TraceEquivalentIn (@AllIndependent Bool) (inversionCount rest)
                (true :: rest) (true :: canonicalBinary rest) :=
            Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.prepend
              (@AllIndependent Bool) [true] inductionHypothesis
          have moveAcrossFalse :
              TraceEquivalentIn (@AllIndependent Bool) (rest.count false)
                (true :: canonicalBinary rest)
                (canonicalBinary rest ++ [true]) := by
            have move :=
              Sprawlens.TraceDerivationGenerator.TraceEquivalentIn.append
                (@AllIndependent Bool) trueBlock
                (moveRight (@AllIndependent Bool) true falseBlock (by
                  simp [AllIndependent]))
            have endEq :
                falseBlock ++ true :: trueBlock =
                  canonicalBinary rest ++ [true] := by
              rw [cons_replicate_eq_replicate_append_singleton]
              simp [canonicalBinary, falseBlock, List.append_assoc]
            rw [← endEq]
            simpa [canonicalBinary, falseBlock, trueBlock,
              List.append_assoc] using move
          simpa [inversionCount, Nat.add_comm] using
            normalizeTail.trans moveAcrossFalse

/-- The inversion potential is also a lower bound for every derivation into
the canonical binary trace. -/
theorem canonicalizeBinary_cost_lower_bound
    (edits : List Bool) {cost : Nat}
    (equivalent : TraceEquivalentIn (@AllIndependent Bool) cost
      edits (canonicalBinary edits)) :
    inversionCount edits ≤ cost := by
  have potentialBound :=
    (inversionCount_bounds_of_traceEquivalentIn
      (@AllIndependent Bool) equivalent).1
  simpa using potentialBound

/-- Exact shortest-path certificate for deterministic canonicalization of an
arbitrary binary trace. -/
theorem canonicalizeBinary_cost_exact (edits : List Bool) :
    TraceEquivalentIn (@AllIndependent Bool) (inversionCount edits)
        edits (canonicalBinary edits) ∧
      ∀ {cost}, TraceEquivalentIn (@AllIndependent Bool) cost
          edits (canonicalBinary edits) →
        inversionCount edits ≤ cost := by
  exact ⟨canonicalizeBinary edits,
    canonicalizeBinary_cost_lower_bound edits⟩

theorem canonicalBinary_eq_of_counts
    {first second : List Bool}
    (falseCount : first.count false = second.count false)
    (trueCount : first.count true = second.count true) :
    canonicalBinary first = canonicalBinary second := by
  simp [canonicalBinary, falseCount, trueCount]

/-- Canonicalization gives a deterministic derivation between arbitrary
binary traces with equal multiplicities. Its cost is a certified upper bound,
not a claim of pairwise shortest-path optimality. -/
theorem equivalentBinary_of_counts
    {first second : List Bool}
    (falseCount : first.count false = second.count false)
    (trueCount : first.count true = second.count true) :
    TraceEquivalentIn (@AllIndependent Bool)
      (inversionCount first + inversionCount second) first second := by
  have canonicalEq : canonicalBinary first = canonicalBinary second :=
    canonicalBinary_eq_of_counts falseCount trueCount
  have firstToCanonical := canonicalizeBinary first
  have canonicalToSecond := (canonicalizeBinary second).symm
  rw [← canonicalEq] at canonicalToSecond
  exact firstToCanonical.trans canonicalToSecond

/-- Every binary derivation lies between the inversion-potential lower bound
and the canonicalization upper-bound construction. -/
theorem binaryDerivation_bounds
    {first second : List Bool} {cost : Nat}
    (equivalent : TraceEquivalentIn (@AllIndependent Bool) cost first second)
    (falseCount : first.count false = second.count false)
    (trueCount : first.count true = second.count true) :
    (inversionCount first ≤ inversionCount second + cost ∧
       inversionCount second ≤ inversionCount first + cost) ∧
      TraceEquivalentIn (@AllIndependent Bool)
        (inversionCount first + inversionCount second) first second := by
  exact ⟨inversionCount_bounds_of_traceEquivalentIn
      (@AllIndependent Bool) equivalent,
    equivalentBinary_of_counts falseCount trueCount⟩

/-- The block generator realizes the `m*n` binary crossing cost. -/
theorem binaryBlockSwap
    (leftCount rightCount : Nat) :
    TraceEquivalentIn (@AllIndependent Bool) (leftCount * rightCount)
      (List.replicate leftCount true ++ List.replicate rightCount false)
      (List.replicate rightCount false ++ List.replicate leftCount true) := by
  simpa using
    (swapBlocks (@AllIndependent Bool)
      (List.replicate leftCount true)
      (List.replicate rightCount false)
      (by simp [BlocksIndependent, AllIndependent]))

/-- No adjacent-swap derivation can exchange the two binary blocks with fewer
than `m*n` swaps. -/
theorem binaryBlockSwap_cost_lower_bound
    (leftCount rightCount : Nat) {cost : Nat}
    (equivalent : TraceEquivalentIn (@AllIndependent Bool) cost
      (List.replicate leftCount true ++ List.replicate rightCount false)
      (List.replicate rightCount false ++ List.replicate leftCount true)) :
    leftCount * rightCount ≤ cost := by
  have potentialBound :=
    (inversionCount_bounds_of_traceEquivalentIn
      (@AllIndependent Bool) equivalent).1
  rw [inversionCount_true_false_blocks,
    inversionCount_false_true_blocks] at potentialBound
  omega

/-- Exact optimality certificate for the deterministic binary block-swap
generator. -/
theorem binaryBlockSwap_cost_exact (leftCount rightCount : Nat) :
    TraceEquivalentIn (@AllIndependent Bool) (leftCount * rightCount)
        (List.replicate leftCount true ++ List.replicate rightCount false)
        (List.replicate rightCount false ++ List.replicate leftCount true) ∧
      ∀ {cost}, TraceEquivalentIn (@AllIndependent Bool) cost
          (List.replicate leftCount true ++ List.replicate rightCount false)
          (List.replicate rightCount false ++ List.replicate leftCount true) →
        leftCount * rightCount ≤ cost := by
  exact ⟨binaryBlockSwap leftCount rightCount,
    binaryBlockSwap_cost_lower_bound leftCount rightCount⟩

end Sprawlens.TraceDerivationGenerator
