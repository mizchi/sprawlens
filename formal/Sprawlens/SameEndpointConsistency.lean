import Sprawlens.ConfluenceDefect
import Sprawlens.HistorySelectorConfluence

namespace Sprawlens.SameEndpointConsistency

open LayoutConfluence
open HistorySelectorConfluence

universe u v w x

/-- Minimum contract for a representation discrepancy. Unlike a metric, this
does not require symmetry or a triangle inequality; it requires only
nonnegativity and separation of distinct observations. -/
structure RepresentationDiscrepancy (Observation : Type u) where
  difference : Observation → Observation → ℝ
  nonnegative : ∀ first second, 0 ≤ difference first second
  eq_zero_iff : ∀ first second, difference first second = 0 ↔ first = second

theorem RepresentationDiscrepancy.pos_iff_ne
    {Observation : Type u} (discrepancy : RepresentationDiscrepancy Observation)
    (first second : Observation) :
    0 < discrepancy.difference first second ↔ first ≠ second := by
  constructor
  · intro positive equal
    subst second
    have zero := (discrepancy.eq_zero_iff first first).mpr rfl
    linarith
  · intro different
    have nonzero : discrepancy.difference first second ≠ 0 := by
      intro zero
      exact different ((discrepancy.eq_zero_iff first second).mp zero)
    exact lt_of_le_of_ne (discrepancy.nonnegative first second) nonzero.symm

def metricRepresentationDiscrepancy
    (Observation : Type u) [MetricSpace Observation] :
    RepresentationDiscrepancy Observation where
  difference := dist
  nonnegative := fun _ _ => dist_nonneg
  eq_zero_iff := fun _ _ => dist_eq_zero

/-- Two edit paths have the same declared input endpoint at one initial state.
The projection deliberately excludes layout history and rendered geometry. -/
def EndpointEquivalentAt
    {Edit : Type u} {State : Type v} {Input : Type w}
    (input : State → Input) (apply : Edit → State → State)
    (first second : List Edit) (state : State) : Prop :=
  input (runEdits apply first state) = input (runEdits apply second state)

/-- Distance between the observed representations produced by two paths. -/
def observablePathDefect
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : List Edit) (state : State) : ℝ :=
  dist (observe (runEdits apply first state))
    (observe (runEdits apply second state))

/-- Path discrepancy for measurements that separate observations but need not
satisfy all metric laws. -/
def observablePathDiscrepancy
    {Edit : Type u} {State : Type v} {Observation : Type w}
    (discrepancy : RepresentationDiscrepancy Observation)
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : List Edit) (state : State) : ℝ :=
  discrepancy.difference (observe (runEdits apply first state))
    (observe (runEdits apply second state))

/-- A same-endpoint violation requires both equal declared inputs and unequal
observed representations. Neither condition alone is sufficient. -/
def SameEndpointViolationAt
    {Edit : Type u} {State : Type v} {Input : Type w}
    {Observation : Type x}
    (input : State → Input) (observe : State → Observation)
    (apply : Edit → State → State)
    (first second : List Edit) (state : State) : Prop :=
  EndpointEquivalentAt input apply first second state ∧
    observe (runEdits apply first state) ≠
      observe (runEdits apply second state)

/-- A transition system is same-endpoint consistent when every pair of paths
with equal declared input endpoints has equal observed representations. -/
def SameEndpointConsistent
    {Edit : Type u} {State : Type v} {Input : Type w}
    {Observation : Type x}
    (input : State → Input) (observe : State → Observation)
    (apply : Edit → State → State) : Prop :=
  ∀ first second state,
    EndpointEquivalentAt input apply first second state →
      observe (runEdits apply first state) =
        observe (runEdits apply second state)

theorem observablePathDefect_nonnegative
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : List Edit) (state : State) :
    0 ≤ observablePathDefect observe apply first second state := by
  exact dist_nonneg

/-- For a genuine observation metric, zero defect is exactly equality of the
two observed representations. -/
theorem observablePathDefect_eq_zero_iff
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [MetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : List Edit) (state : State) :
    observablePathDefect observe apply first second state = 0 ↔
      observe (runEdits apply first state) =
        observe (runEdits apply second state) := by
  exact dist_eq_zero

/-- Positive observable defect is equivalent to a same-endpoint violation,
provided the observation distance is a metric rather than a pseudometric. -/
theorem sameEndpointViolationAt_iff_defect_pos
    {Edit : Type u} {State : Type v} {Input : Type w}
    {Observation : Type x} [MetricSpace Observation]
    (input : State → Input) (observe : State → Observation)
    (apply : Edit → State → State)
    (first second : List Edit) (state : State) :
    SameEndpointViolationAt input observe apply first second state ↔
      EndpointEquivalentAt input apply first second state ∧
        0 < observablePathDefect observe apply first second state := by
  unfold SameEndpointViolationAt observablePathDefect
  constructor
  · intro violation
    exact ⟨violation.1, dist_pos.mpr violation.2⟩
  · intro violation
    exact ⟨violation.1, dist_pos.mp violation.2⟩

/-- Detection of a same-endpoint violation needs only a separating discrepancy,
not symmetry or the triangle inequality. -/
theorem sameEndpointViolationAt_iff_discrepancy_pos
    {Edit : Type u} {State : Type v} {Input : Type w}
    {Observation : Type x}
    (input : State → Input)
    (discrepancy : RepresentationDiscrepancy Observation)
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : List Edit) (state : State) :
    SameEndpointViolationAt input observe apply first second state ↔
      EndpointEquivalentAt input apply first second state ∧
        0 < observablePathDiscrepancy
          discrepancy observe apply first second state := by
  unfold SameEndpointViolationAt observablePathDiscrepancy
  rw [discrepancy.pos_iff_ne]

/-- The global consistency property can equivalently be stated as zero defect
for every pair of paths whose declared input endpoints agree. -/
theorem sameEndpointConsistent_iff_defect_zero
    {Edit : Type u} {State : Type v} {Input : Type w}
    {Observation : Type x} [MetricSpace Observation]
    (input : State → Input) (observe : State → Observation)
    (apply : Edit → State → State) :
    SameEndpointConsistent input observe apply ↔
      ∀ first second state,
        EndpointEquivalentAt input apply first second state →
          observablePathDefect observe apply first second state = 0 := by
  constructor
  · intro consistent first second state sameEndpoint
    exact (observablePathDefect_eq_zero_iff
      observe apply first second state).mpr
      (consistent first second state sameEndpoint)
  · intro zeroDefect first second state sameEndpoint
    exact (observablePathDefect_eq_zero_iff
      observe apply first second state).mp
      (zeroDefect first second state sameEndpoint)

theorem not_sameEndpointConsistent_of_violation
    {Edit : Type u} {State : Type v} {Input : Type w}
    {Observation : Type x}
    (input : State → Input) (observe : State → Observation)
    (apply : Edit → State → State)
    (first second : List Edit) (state : State)
    (violation : SameEndpointViolationAt
      input observe apply first second state) :
    ¬SameEndpointConsistent input observe apply := by
  intro consistent
  exact violation.2 (consistent first second state violation.1)

/-- AB/BA defect is the observable commutator residual. -/
def commutatorDefect
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : Edit) (state : State) : ℝ :=
  observablePathDefect observe apply [first, second] [second, first] state

/-- A reversal-loop defect compares the initial observation with the result of
applying a forward edit followed by its proposed reverse. -/
def loopDefect
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (forward backward : Edit) (state : State) : ℝ :=
  observablePathDefect observe apply [] [forward, backward] state

/-- Noise-adjusted residual used by the empirical protocol. The theorem only
formalizes threshold subtraction; it does not justify how the noise floor or
margin was estimated. -/
def excessDefect (pathDefect noiseFloor margin : ℝ) : ℝ :=
  max 0 (pathDefect - noiseFloor - margin)

theorem excessDefect_nonnegative
    (pathDefect noiseFloor margin : ℝ) :
    0 ≤ excessDefect pathDefect noiseFloor margin := by
  exact le_max_left _ _

theorem excessDefect_eq_zero_iff
    (pathDefect noiseFloor margin : ℝ) :
    excessDefect pathDefect noiseFloor margin = 0 ↔
      pathDefect ≤ noiseFloor + margin := by
  constructor
  · intro zeroExcess
    by_contra aboveThreshold
    have positiveResidual :
        0 < pathDefect - noiseFloor - margin := by
      linarith
    rw [excessDefect,
      max_eq_right (le_of_lt positiveResidual)] at zeroExcess
    linarith
  · intro belowThreshold
    rw [excessDefect, max_eq_left]
    linarith

theorem excessDefect_pos_iff
    (pathDefect noiseFloor margin : ℝ) :
    0 < excessDefect pathDefect noiseFloor margin ↔
      noiseFloor + margin < pathDefect := by
  constructor
  · intro positiveExcess
    by_contra belowThreshold
    have nonpositiveResidual :
        pathDefect - noiseFloor - margin ≤ 0 := by
      linarith
    rw [excessDefect, max_eq_left nonpositiveResidual] at positiveExcess
    exact (lt_irrefl 0) positiveExcess
  · intro aboveThreshold
    have positiveResidual :
        0 < pathDefect - noiseFloor - margin := by
      linarith
    rw [excessDefect,
      max_eq_right (le_of_lt positiveResidual)]
    exact positiveResidual

/-- Interval extension used by the confirmatory runner. A path-defect interval
and a noise-floor interval enclose the exact excess defect when the lower path
bound is paired with the upper noise bound, and conversely for the upper
bound. -/
theorem excessDefect_interval_bounds
    (pathLower path pathUpper noiseLower noise noiseUpper margin : ℝ)
    (pathLower_le : pathLower ≤ path)
    (path_le_upper : path ≤ pathUpper)
    (noiseLower_le : noiseLower ≤ noise)
    (noise_le_upper : noise ≤ noiseUpper) :
    excessDefect pathLower noiseUpper margin ≤
        excessDefect path noise margin ∧
      excessDefect path noise margin ≤
        excessDefect pathUpper noiseLower margin := by
  constructor
  · unfold excessDefect
    apply max_le_max (le_refl 0)
    linarith
  · unfold excessDefect
    apply max_le_max (le_refl 0)
    linarith

/-- Pointwise certified intervals remain certified after the arithmetic mean
used for stable-cell, seed, sequence, and repository aggregation. -/
theorem arithmeticMean_interval_bounds
    {Index : Type u} [DecidableEq Index]
    (indices : Finset Index) (lower exact upper : Index → ℝ)
    (nonempty : indices.Nonempty)
    (lower_le : ∀ index ∈ indices, lower index ≤ exact index)
    (le_upper : ∀ index ∈ indices, exact index ≤ upper index) :
    (∑ index ∈ indices, lower index) / indices.card ≤
        (∑ index ∈ indices, exact index) / indices.card ∧
      (∑ index ∈ indices, exact index) / indices.card ≤
        (∑ index ∈ indices, upper index) / indices.card := by
  have cardPositive : (0 : ℝ) < indices.card := by
    exact_mod_cast nonempty.card_pos
  constructor
  · exact div_le_div_of_nonneg_right
      (Finset.sum_le_sum fun index membership => lower_le index membership)
      cardPositive.le
  · exact div_le_div_of_nonneg_right
      (Finset.sum_le_sum fun index membership => le_upper index membership)
      cardPositive.le

/-- On the full state metric, the path-level AB/BA definition reduces to the
local square defect. -/
theorem commutatorDefect_id_eq_squareDefect
    {Edit : Type u} {State : Type v} [PseudoMetricSpace State]
    (apply : Edit → State → State) (first second : Edit) (state : State) :
    commutatorDefect id apply first second state =
      ConfluenceDefect.squareDefect apply first second state := by
  rfl

/-- Reversing AB and BA from the same initial observation cannot change their
loop residuals by more than the AB/BA commutator defect. -/
theorem abs_loopDefect_sub_loopDefect_le_commutatorDefect
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : Edit) (state : State) :
    |loopDefect observe apply first second state -
        loopDefect observe apply second first state| ≤
      commutatorDefect observe apply first second state := by
  simpa [loopDefect, commutatorDefect, observablePathDefect,
    runEdits, dist_comm] using
    (abs_dist_sub_le
      (observe (apply second (apply first state)))
      (observe (apply first (apply second state)))
      (observe state))

/-- If the BA loop exactly recovers the initial observation, the AB loop
residual is exactly the AB/BA commutator defect. -/
theorem commutatorDefect_eq_loopDefect_of_reverse_recovers
    {Edit : Type u} {State : Type v} {Observation : Type w}
    [PseudoMetricSpace Observation]
    (observe : State → Observation) (apply : Edit → State → State)
    (first second : Edit) (state : State)
    (reverseRecovers :
      observe (apply first (apply second state)) = observe state) :
    commutatorDefect observe apply first second state =
      loopDefect observe apply first second state := by
  simp [commutatorDefect, loopDefect, observablePathDefect, runEdits,
    reverseRecovers, dist_comm]

/-- The executable predecessor-sensitive selector is an exact witness against
universal same-endpoint consistency: its input endpoint agrees but its selected
geometry does not. -/
theorem finiteSelector_sameEndpointViolation :
    SameEndpointViolationAt inputProjection SelectorState.selected
      applyInputEdit [.enableA, .enableB] [.enableB, .enableA] base := by
  constructor
  · simpa [EndpointEquivalentAt, runEdits] using input_endpoint_commutes
  · simpa [runEdits] using selected_endpoint_differs

theorem finiteSelector_not_sameEndpointConsistent :
    ¬SameEndpointConsistent inputProjection SelectorState.selected
      applyInputEdit := by
  exact not_sameEndpointConsistent_of_violation
    inputProjection SelectorState.selected applyInputEdit
    [.enableA, .enableB] [.enableB, .enableA] base
    finiteSelector_sameEndpointViolation

end Sprawlens.SameEndpointConsistency
