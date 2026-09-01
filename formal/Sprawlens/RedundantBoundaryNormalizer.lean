import Sprawlens.CanonicalizerExtensionalityCounterexample
import Sprawlens.SegmentContact

namespace Sprawlens.RedundantBoundaryNormalizer

open CollinearExtrema
open DegenerateClip
open ExactGeometry
open ExecutableCanonicalizer
open HalfPlaneClipPoints
open HalfPlaneIntersection
open OrderedTriples
open PolygonSeamCanonicalizer
open SegmentContact
open SemanticReclassification
open WindingCanonicalizer

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

omit [Field R] [IsStrictOrderedRing R] in
/-- Strict scalar betweenness implies inclusive betweenness. -/
theorem betweenInclusive_of_strictBetween
    {value first second : R} (strict : StrictBetween value first second) :
    BetweenInclusive value first second := by
  rcases strict with forward | backward
  · exact Or.inl ⟨le_of_lt forward.1, le_of_lt forward.2⟩
  · exact Or.inr ⟨le_of_lt backward.1, le_of_lt backward.2⟩

/-- Normalizing an inclusively-between scalar to the affine coordinate of
two distinct endpoints produces a parameter in `[0, 1]`. -/
theorem normalizedParameter_mem_Icc
    (value first second : R) (distinct : second ≠ first)
    (between : BetweenInclusive value first second) :
    (value - first) / (second - first) ∈ Set.Icc (0 : R) 1 := by
  rcases between with forward | backward
  · have denominatorPositive : 0 < second - first := by
      have firstLeSecond : first ≤ second :=
        le_trans forward.1 forward.2
      have firstLtSecond : first < second :=
        lt_of_le_of_ne firstLeSecond distinct.symm
      linarith
    constructor
    · exact div_nonneg (sub_nonneg.mpr forward.1)
        (le_of_lt denominatorPositive)
    · exact (div_le_one denominatorPositive).mpr (by linarith)
  · have denominatorNegative : second - first < 0 := by
      have secondLeFirst : second ≤ first :=
        le_trans backward.1 backward.2
      have secondLtFirst : second < first :=
        lt_of_le_of_ne secondLeFirst distinct
      linarith
    constructor
    · exact div_nonneg_of_nonpos (sub_nonpos.mpr backward.2)
        (le_of_lt denominatorNegative)
    · exact (div_le_one_of_neg denominatorNegative).mpr (by linarith)

/-- The existing executable open-segment predicate is strong enough for the
closed-segment witness required by convex-hull deletion semantics. -/
theorem pointInOpenSegment_onClosedSegment
    (start finish point : Vec2 R)
    (interior : PointInOpenSegment start finish point) :
    OnClosedSegment start finish point := by
  have distinct : start ≠ finish :=
    pointInOpenSegment_segment_nondegenerate start finish point interior
  have xBetween : BetweenInclusive point.x start.x finish.x := by
    rcases interior.2 with horizontal | vertical
    · exact betweenInclusive_of_strictBetween horizontal.1
    · exact vertical.2
  have yBetween : BetweenInclusive point.y start.y finish.y := by
    rcases interior.2 with horizontal | vertical
    · exact horizontal.2
    · exact betweenInclusive_of_strictBetween vertical.1
  let parameter := lineParameter start finish point
  have parameterBounds : parameter ∈ Set.Icc (0 : R) 1 := by
    by_cases vertical : finish.x = start.x
    · have yDistinct : finish.y ≠ start.y := by
        intro yEqual
        apply distinct
        cases start
        cases finish
        simp_all
      simpa [parameter, lineParameter, vertical] using
        normalizedParameter_mem_Icc point.y start.y finish.y
          yDistinct yBetween
    · simpa [parameter, lineParameter, vertical] using
        normalizedParameter_mem_Icc point.x start.x finish.x
          vertical xBetween
  refine ⟨parameter, parameterBounds, ?_⟩
  exact (interpolatePoint_lineParameter start finish point
    distinct interior.1).symm

omit [IsStrictOrderedRing R] in
/-- Permuting a finite generator list preserves its convex-hull semantics. -/
theorem listConvexRegion_eq_of_perm
    {first second : List (Vec2 R)} (permutation : first.Perm second) :
    listConvexRegion first = listConvexRegion second := by
  unfold listConvexRegion
  congr 1
  ext point
  exact permutation.mem_iff

omit [IsStrictOrderedRing R] in
/-- Adding a generator already contained in the remaining convex hull does
not change the represented region. -/
theorem listConvexRegion_cons_eq_of_mem
    (point : Vec2 R) (remaining : List (Vec2 R))
    (contained : point ∈ listConvexRegion remaining) :
    listConvexRegion (point :: remaining) = listConvexRegion remaining := by
  unfold listConvexRegion at contained ⊢
  apply Set.Subset.antisymm
  · apply convexHull_min
    · intro candidate member
      change candidate ∈ point :: remaining at member
      simp only [List.mem_cons] at member
      rcases member with rfl | member
      · exact contained
      · exact subset_convexHull R _ member
    · exact convex_convexHull R _
  · apply convexHull_mono
    intro candidate member
    change candidate ∈ point :: remaining
    exact List.mem_cons_of_mem point member

omit [IsStrictOrderedRing R] in
/-- Consing the same generator respects equality of tail convex regions. -/
theorem listConvexRegion_cons_congr
    (point : Vec2 R) {first second : List (Vec2 R)}
    (sameTailRegion : listConvexRegion first = listConvexRegion second) :
    listConvexRegion (point :: first) =
      listConvexRegion (point :: second) := by
  unfold listConvexRegion at sameTailRegion ⊢
  let firstSet : Set (Vec2 R) := {value | value ∈ first}
  let secondSet : Set (Vec2 R) := {value | value ∈ second}
  have firstGenerators :
      {value : Vec2 R | value ∈ point :: first} = {point} ∪ firstSet := by
    ext value
    simp [firstSet]
  have secondGenerators :
      {value : Vec2 R | value ∈ point :: second} = {point} ∪ secondSet := by
    ext value
    simp [secondSet]
  change convexHull R firstSet = convexHull R secondSet at sameTailRegion
  rw [firstGenerators, secondGenerators,
    ← convexHull_convexHull_union_right (𝕜 := R), sameTailRegion,
    convexHull_convexHull_union_right]

/-- Deleting a point lying on a segment between two retained generators
preserves the list convex region. -/
theorem listConvexRegion_cons_redundant
    (point start finish : Vec2 R) (remaining : List (Vec2 R))
    (startMember : start ∈ remaining) (finishMember : finish ∈ remaining)
    (pointOnSegment : OnClosedSegment start finish point) :
    listConvexRegion (point :: remaining) = listConvexRegion remaining := by
  apply listConvexRegion_cons_eq_of_mem
  have mathlibSegment : point ∈ segment R start finish := by
    rw [← degenerateSegment_region_eq_segment]
    exact pointOnSegment
  exact segment_subset_convexHull (𝕜 := R)
    (s := {value : Vec2 R | value ∈ remaining})
      startMember finishMember mathlibSegment

/-- Remove redundant interior points from an open chain.  A successful local
deletion restarts at the preceding endpoint so newly exposed triples are
checked immediately. -/
def normalizeOpenBoundary : List (Vec2 R) → List (Vec2 R)
  | first :: middle :: finish :: remaining =>
      if pointInOpenSegmentBool first finish middle then
        normalizeOpenBoundary (first :: finish :: remaining)
      else
        first :: normalizeOpenBoundary (middle :: finish :: remaining)
  | points => points
termination_by points => points.length

/-- The open-chain normalizer preserves convex-hull semantics for every input,
without requiring convexity or a winding assumption. -/
theorem normalizeOpenBoundary_region :
    ∀ points : List (Vec2 R),
      listConvexRegion (normalizeOpenBoundary points) =
        listConvexRegion points
  | [] => by simp [normalizeOpenBoundary]
  | [point] => by simp [normalizeOpenBoundary]
  | [first, finish] => by simp [normalizeOpenBoundary]
  | first :: middle :: finish :: remaining => by
      by_cases redundant :
          pointInOpenSegmentBool first finish middle = true
      · rw [normalizeOpenBoundary, if_pos redundant]
        rw [normalizeOpenBoundary_region (first :: finish :: remaining)]
        symm
        have pointOnSegment : OnClosedSegment first finish middle :=
          pointInOpenSegment_onClosedSegment first finish middle
            ((pointInOpenSegmentBool_eq_true first finish middle).mp redundant)
        have removed :
            listConvexRegion
                (middle :: first :: finish :: remaining) =
              listConvexRegion (first :: finish :: remaining) :=
          listConvexRegion_cons_redundant middle first finish
            (first :: finish :: remaining) (by simp) (by simp)
              pointOnSegment
        rw [← removed]
        exact listConvexRegion_eq_of_perm
          (List.Perm.swap first middle (finish :: remaining)).symm
      · rw [normalizeOpenBoundary, if_neg redundant]
        exact listConvexRegion_cons_congr first
          (normalizeOpenBoundary_region (middle :: finish :: remaining))
termination_by points => points.length

omit [IsStrictOrderedRing R] in
/-- Open-boundary normalization only removes existing vertices. -/
theorem normalizeOpenBoundary_sublist :
    ∀ points : List (Vec2 R),
      (normalizeOpenBoundary points).Sublist points
  | [] => by simp [normalizeOpenBoundary]
  | [point] => by simp [normalizeOpenBoundary]
  | [first, finish] => by simp [normalizeOpenBoundary]
  | first :: middle :: finish :: remaining => by
      by_cases redundant :
          pointInOpenSegmentBool first finish middle = true
      · rw [normalizeOpenBoundary, if_pos redundant]
        exact (normalizeOpenBoundary_sublist
          (first :: finish :: remaining)).trans
            (List.Sublist.cons_cons first
              (List.Sublist.cons middle
                (List.Sublist.refl (finish :: remaining))))
      · rw [normalizeOpenBoundary, if_neg redundant]
        exact List.Sublist.cons_cons first
          (normalizeOpenBoundary_sublist (middle :: finish :: remaining))
termination_by points => points.length

omit [IsStrictOrderedRing R] in
/-- Open-boundary normalization cannot increase the number of vertices. -/
theorem normalizeOpenBoundary_length_le (points : List (Vec2 R)) :
    (normalizeOpenBoundary points).length ≤ points.length :=
  (normalizeOpenBoundary_sublist points).length_le

omit [IsStrictOrderedRing R] in
/-- Deleting redundant vertices cannot introduce a duplicate vertex. -/
theorem normalizeOpenBoundary_nodup
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    (normalizeOpenBoundary points).Nodup :=
  nodup.sublist (normalizeOpenBoundary_sublist points)

omit [IsStrictOrderedRing R] in
/-- If an open normalization pass keeps the same length, it deleted nothing. -/
theorem normalizeOpenBoundary_eq_of_length_eq
    (points : List (Vec2 R))
    (sameLength : (normalizeOpenBoundary points).length = points.length) :
    normalizeOpenBoundary points = points :=
  (normalizeOpenBoundary_sublist points).eq_of_length sameLength

omit [IsStrictOrderedRing R] in
/-- Removing redundant open-chain vertices preserves weak global order. -/
theorem normalizeOpenBoundary_ordered
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    AllOrderedCCW (normalizeOpenBoundary points) :=
  AllOrderedCCW.sublist (normalizeOpenBoundary_sublist points) ordered

/-- Repeatedly move the seam by one vertex and normalize the exposed open
chain.  The explicit fuel separates termination from the shrinking list. -/
def normalizeCyclicBoundaryFuel : Nat → List (Vec2 R) → List (Vec2 R)
  | 0, points => points
  | fuel + 1, points =>
      normalizeCyclicBoundaryFuel fuel
        (normalizeOpenBoundary (points.rotate 1))

/-- Every finite sequence of rotated open-chain passes preserves the convex
region exactly. -/
theorem normalizeCyclicBoundaryFuel_region :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      listConvexRegion (normalizeCyclicBoundaryFuel fuel points) =
        listConvexRegion points
  | 0, _ => rfl
  | fuel + 1, points => by
      rw [normalizeCyclicBoundaryFuel,
        normalizeCyclicBoundaryFuel_region fuel,
        normalizeOpenBoundary_region,
        PolygonSeamCanonicalizer.listConvexRegion_rotate]

omit [IsStrictOrderedRing R] in
/-- Every rotated open-chain pass preserves weak global order. -/
theorem normalizeCyclicBoundaryFuel_ordered :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      AllOrderedCCW points →
        AllOrderedCCW (normalizeCyclicBoundaryFuel fuel points)
  | 0, _, ordered => ordered
  | fuel + 1, points, ordered => by
      apply normalizeCyclicBoundaryFuel_ordered fuel
      apply normalizeOpenBoundary_ordered
      exact allOrderedCCW_rotate points ordered 1

omit [IsStrictOrderedRing R] in
/-- Every fueled cyclic pass is length-nonincreasing. -/
theorem normalizeCyclicBoundaryFuel_length_le :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      (normalizeCyclicBoundaryFuel fuel points).length ≤ points.length
  | 0, _ => Nat.le_refl _
  | fuel + 1, points => by
      apply (normalizeCyclicBoundaryFuel_length_le fuel
        (normalizeOpenBoundary (points.rotate 1))).trans
      apply (normalizeOpenBoundary_length_le (points.rotate 1)).trans_eq
      exact List.length_rotate points 1

omit [IsStrictOrderedRing R] in
/-- Every fueled cyclic pass preserves duplicate-freedom. -/
theorem normalizeCyclicBoundaryFuel_nodup :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      points.Nodup →
        (normalizeCyclicBoundaryFuel fuel points).Nodup
  | 0, _, nodup => nodup
  | fuel + 1, points, nodup => by
      apply normalizeCyclicBoundaryFuel_nodup fuel
      apply normalizeOpenBoundary_nodup
      exact (List.nodup_rotate.mpr nodup)

omit [IsStrictOrderedRing R] in
/-- A fueled pass that keeps every vertex can only change the cyclic seam. -/
theorem normalizeCyclicBoundaryFuel_isRotated_of_length_eq :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      (normalizeCyclicBoundaryFuel fuel points).length = points.length →
        points ~r normalizeCyclicBoundaryFuel fuel points
  | 0, points, _ => List.IsRotated.refl points
  | fuel + 1, points, sameLength => by
      let rotated := points.rotate 1
      let opened := normalizeOpenBoundary rotated
      let output := normalizeCyclicBoundaryFuel fuel opened
      have outputLeOpened : output.length ≤ opened.length :=
        normalizeCyclicBoundaryFuel_length_le fuel opened
      have openedLeRotated : opened.length ≤ rotated.length :=
        normalizeOpenBoundary_length_le rotated
      have rotatedLength : rotated.length = points.length :=
        List.length_rotate points 1
      have outputLength : output.length = points.length := by
        simpa [output, opened, rotated, normalizeCyclicBoundaryFuel] using
          sameLength
      have rotatedLeOpened : rotated.length ≤ opened.length := by
        calc
          rotated.length = points.length := rotatedLength
          _ = output.length := outputLength.symm
          _ ≤ opened.length := outputLeOpened
      have openedLength : opened.length = rotated.length :=
        Nat.le_antisymm openedLeRotated rotatedLeOpened
      have openedEq : opened = rotated :=
        normalizeOpenBoundary_eq_of_length_eq rotated openedLength
      have outputLengthOpened : output.length = opened.length := by
        calc
          output.length = points.length := outputLength
          _ = rotated.length := rotatedLength.symm
          _ = opened.length := openedLength.symm
      have openedRotatedOutput : opened ~r output :=
        normalizeCyclicBoundaryFuel_isRotated_of_length_eq fuel opened
          outputLengthOpened
      have pointsRotatedOpened : points ~r opened := by
        rw [openedEq]
        exact ⟨1, rfl⟩
      simpa [output, opened, rotated, normalizeCyclicBoundaryFuel] using
        pointsRotatedOpened.trans openedRotatedOutput

omit [IsStrictOrderedRing R] in
/-- If a fueled traversal keeps its total length, every seam it visited had
an open pass that was already fixed. -/
theorem normalizeCyclicBoundaryFuel_all_open_fixed_of_length_eq :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      (normalizeCyclicBoundaryFuel fuel points).length = points.length →
      ∀ count, 1 ≤ count → count ≤ fuel →
        normalizeOpenBoundary (points.rotate count) = points.rotate count
  | 0, _, _, count, positive, bounded => by omega
  | fuel + 1, points, sameLength, count, positive, bounded => by
      let rotated := points.rotate 1
      let opened := normalizeOpenBoundary rotated
      let output := normalizeCyclicBoundaryFuel fuel opened
      have outputLeOpened : output.length ≤ opened.length :=
        normalizeCyclicBoundaryFuel_length_le fuel opened
      have openedLeRotated : opened.length ≤ rotated.length :=
        normalizeOpenBoundary_length_le rotated
      have rotatedLength : rotated.length = points.length :=
        List.length_rotate points 1
      have outputLength : output.length = points.length := by
        simpa [output, opened, rotated, normalizeCyclicBoundaryFuel] using
          sameLength
      have rotatedLeOpened : rotated.length ≤ opened.length := by
        calc
          rotated.length = points.length := rotatedLength
          _ = output.length := outputLength.symm
          _ ≤ opened.length := outputLeOpened
      have openedLength : opened.length = rotated.length :=
        Nat.le_antisymm openedLeRotated rotatedLeOpened
      have openedEq : opened = rotated :=
        normalizeOpenBoundary_eq_of_length_eq rotated openedLength
      by_cases firstPass : count = 1
      · subst count
        simpa [opened, rotated] using openedEq
      · have successor : 1 < count := Nat.lt_of_le_of_ne positive
            (Ne.symm firstPass)
        obtain ⟨previous, countEq⟩ := Nat.exists_eq_add_of_le positive
        have previousPositive : 1 ≤ previous := by omega
        have previousBounded : previous ≤ fuel := by omega
        have outputLengthOpened : output.length = opened.length := by
          calc
            output.length = points.length := outputLength
            _ = rotated.length := rotatedLength.symm
            _ = opened.length := openedLength.symm
        have tailFixed :=
          normalizeCyclicBoundaryFuel_all_open_fixed_of_length_eq
            fuel opened outputLengthOpened previous
              previousPositive previousBounded
        simpa [openedEq, rotated, List.rotate_rotate, countEq,
          Nat.add_comm, Nat.add_left_comm, Nat.add_assoc] using tailFixed

omit [IsStrictOrderedRing R] in
/-- The leading cyclic triple is not removable by the open-segment rule. -/
def OpenHeadIrredundant (points : List (Vec2 R)) : Prop :=
  match points with
  | first :: middle :: finish :: _ =>
      pointInOpenSegmentBool first finish middle = false
  | _ => True

omit [IsStrictOrderedRing R] in
/-- An open pass that is fixed cannot have a removable leading triple. -/
theorem normalizeOpenBoundary_fixed_head_irredundant
    (points : List (Vec2 R))
    (fixed : normalizeOpenBoundary points = points) :
    OpenHeadIrredundant points := by
  cases points with
  | nil => trivial
  | cons first tail =>
      cases tail with
      | nil => trivial
      | cons middle tail =>
          cases tail with
          | nil => trivial
          | cons finish remaining =>
              by_cases redundant :
                  pointInOpenSegmentBool first finish middle = true
              · have shortened :=
                  normalizeOpenBoundary_length_le
                    (first :: finish :: remaining)
                have fixedLength := congrArg List.length fixed
                rw [normalizeOpenBoundary, if_pos redundant] at fixedLength
                simp only [List.length_cons] at fixedLength shortened
                omega
              · exact Bool.eq_false_of_not_eq_true redundant

/-- Every cyclic seam begins with a locally irredundant triple.  This is the
operational postcondition needed to state deletion completeness. -/
def CyclicallyIrredundant (points : List (Vec2 R)) : Prop :=
  ∀ count, count < points.length →
    OpenHeadIrredundant (points.rotate count)

/-- Cyclic redundant-boundary normalization.  Using the original length as
fuel exposes every original seam position at least once; final polygon seam
normalization restores deterministic materialization. -/
def normalizeCyclicBoundary (points : List (Vec2 R)) : List (Vec2 R) :=
  canonicalPolygon
    (normalizeCyclicBoundaryFuel points.length points)

omit [IsStrictOrderedRing R] in
/-- Moving to the least-coordinate seam preserves weak global order. -/
theorem canonicalPolygon_ordered
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    AllOrderedCCW (canonicalPolygon points) := by
  unfold canonicalPolygon
  split
  · exact ordered
  · exact allOrderedCCW_rotate points ordered _

/-- The cyclic boundary normalizer preserves convex-hull semantics on every
input list. -/
theorem normalizeCyclicBoundary_region (points : List (Vec2 R)) :
    listConvexRegion (normalizeCyclicBoundary points) =
      listConvexRegion points := by
  rw [normalizeCyclicBoundary, canonicalPolygon_region,
    normalizeCyclicBoundaryFuel_region]

omit [IsStrictOrderedRing R] in
/-- Cyclic redundant-boundary normalization preserves weak global order. -/
theorem normalizeCyclicBoundary_ordered
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    AllOrderedCCW (normalizeCyclicBoundary points) := by
  apply canonicalPolygon_ordered
  exact normalizeCyclicBoundaryFuel_ordered points.length points ordered

omit [IsStrictOrderedRing R] in
/-- Full cyclic normalization cannot increase the number of vertices. -/
theorem normalizeCyclicBoundary_length_le (points : List (Vec2 R)) :
    (normalizeCyclicBoundary points).length ≤ points.length := by
  rw [normalizeCyclicBoundary, canonicalPolygon_length]
  exact normalizeCyclicBoundaryFuel_length_le points.length points

omit [IsStrictOrderedRing R] in
/-- Full cyclic normalization preserves duplicate-freedom. -/
theorem normalizeCyclicBoundary_nodup
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    (normalizeCyclicBoundary points).Nodup := by
  rw [normalizeCyclicBoundary, canonicalPolygon_nodup_iff]
  exact normalizeCyclicBoundaryFuel_nodup points.length points nodup

omit [IsStrictOrderedRing R] in
/-- A normalized output is already at the deterministic polygon seam. -/
theorem canonicalPolygon_normalizeCyclicBoundary (points : List (Vec2 R)) :
    canonicalPolygon (normalizeCyclicBoundary points) =
      normalizeCyclicBoundary points := by
  rw [normalizeCyclicBoundary, canonicalPolygon_idempotent]

omit [IsStrictOrderedRing R] in
/-- If full cyclic normalization keeps the same length on a duplicate-free
input, its only possible change is deterministic seam selection. -/
theorem normalizeCyclicBoundary_eq_canonicalPolygon_of_length_eq
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (sameLength : (normalizeCyclicBoundary points).length = points.length) :
    normalizeCyclicBoundary points = canonicalPolygon points := by
  have fuelLength :
      (normalizeCyclicBoundaryFuel points.length points).length =
        points.length := by
    simpa [normalizeCyclicBoundary, canonicalPolygon_length] using sameLength
  obtain ⟨count, rotatedEq⟩ :=
    normalizeCyclicBoundaryFuel_isRotated_of_length_eq
      points.length points fuelLength
  rw [normalizeCyclicBoundary, ← rotatedEq]
  exact canonicalPolygon_rotate points nodup count

/-- Iterate cyclic reduction while it strictly decreases vertex count.  The
fuel is separated from the data so the executable definition stays
proof-free. -/
def normalizeCyclicBoundaryFixedFuel : Nat → List (Vec2 R) → List (Vec2 R)
  | 0, points => points
  | fuel + 1, points =>
      let next := normalizeCyclicBoundary points
      if next.length < points.length then
        normalizeCyclicBoundaryFixedFuel fuel next
      else
        next

/-- Start finite descent from a canonical seam with enough fuel for every
possible strict decrease in vertex count. -/
def normalizeCyclicBoundaryFixed (points : List (Vec2 R)) : List (Vec2 R) :=
  normalizeCyclicBoundaryFixedFuel points.length (canonicalPolygon points)

/-- Finite descent preserves the convex region at every recursive step. -/
theorem normalizeCyclicBoundaryFixedFuel_region :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      listConvexRegion (normalizeCyclicBoundaryFixedFuel fuel points) =
        listConvexRegion points
  | 0, _ => rfl
  | fuel + 1, points => by
      simp only [normalizeCyclicBoundaryFixedFuel]
      split
      · rw [normalizeCyclicBoundaryFixedFuel_region fuel,
          normalizeCyclicBoundary_region]
      · exact normalizeCyclicBoundary_region points

omit [IsStrictOrderedRing R] in
/-- Finite descent preserves weak global order. -/
theorem normalizeCyclicBoundaryFixedFuel_ordered :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      AllOrderedCCW points →
        AllOrderedCCW (normalizeCyclicBoundaryFixedFuel fuel points)
  | 0, _, ordered => ordered
  | fuel + 1, points, ordered => by
      simp only [normalizeCyclicBoundaryFixedFuel]
      split
      · exact normalizeCyclicBoundaryFixedFuel_ordered fuel _
          (normalizeCyclicBoundary_ordered points ordered)
      · exact normalizeCyclicBoundary_ordered points ordered

omit [IsStrictOrderedRing R] in
/-- Finite descent preserves duplicate-freedom. -/
theorem normalizeCyclicBoundaryFixedFuel_nodup :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      points.Nodup →
        (normalizeCyclicBoundaryFixedFuel fuel points).Nodup
  | 0, _, nodup => nodup
  | fuel + 1, points, nodup => by
      simp only [normalizeCyclicBoundaryFixedFuel]
      split
      · exact normalizeCyclicBoundaryFixedFuel_nodup fuel _
          (normalizeCyclicBoundary_nodup points nodup)
      · exact normalizeCyclicBoundary_nodup points nodup

omit [IsStrictOrderedRing R] in
/-- Once a cyclic reduction step is fixed, every fueled descent is fixed. -/
theorem normalizeCyclicBoundaryFixedFuel_eq_self_of_step_eq
    (fuel : Nat) (points : List (Vec2 R))
    (fixed : normalizeCyclicBoundary points = points) :
    normalizeCyclicBoundaryFixedFuel fuel points = points := by
  cases fuel with
  | zero => rfl
  | succ fuel =>
      simp [normalizeCyclicBoundaryFixedFuel, fixed]

omit [IsStrictOrderedRing R] in
/-- With enough fuel, finite descent reaches a genuine fixed point.  The
duplicate-free hypothesis makes equal-length cyclic passes rigid after seam
canonicalization. -/
theorem normalizeCyclicBoundaryFixedFuel_step_fixed :
    ∀ (fuel : Nat) (points : List (Vec2 R)),
      points.Nodup →
      canonicalPolygon points = points →
      points.length ≤ fuel →
        normalizeCyclicBoundary
            (normalizeCyclicBoundaryFixedFuel fuel points) =
          normalizeCyclicBoundaryFixedFuel fuel points
  | 0, points, _, _, lengthBound => by
      have empty : points = [] := by
        simpa using lengthBound
      subst points
      simp [normalizeCyclicBoundaryFixedFuel, normalizeCyclicBoundary,
        normalizeCyclicBoundaryFuel, canonicalPolygon]
  | fuel + 1, points, nodup, canonical, lengthBound => by
      let next := normalizeCyclicBoundary points
      have nextLe : next.length ≤ points.length :=
        normalizeCyclicBoundary_length_le points
      by_cases shrinks : next.length < points.length
      · rw [normalizeCyclicBoundaryFixedFuel, if_pos shrinks]
        apply normalizeCyclicBoundaryFixedFuel_step_fixed fuel next
        · exact normalizeCyclicBoundary_nodup points nodup
        · exact canonicalPolygon_normalizeCyclicBoundary points
        · omega
      · have sameLength : next.length = points.length :=
          Nat.le_antisymm nextLe (Nat.le_of_not_gt shrinks)
        have nextEq : next = points := by
          calc
            next = canonicalPolygon points :=
              normalizeCyclicBoundary_eq_canonicalPolygon_of_length_eq
                points nodup sameLength
            _ = points := canonical
        rw [normalizeCyclicBoundaryFixedFuel, if_neg shrinks]
        change normalizeCyclicBoundary next = next
        rw [nextEq]
        exact nextEq

/-- The fixed-point normalizer preserves convex-hull semantics. -/
theorem normalizeCyclicBoundaryFixed_region (points : List (Vec2 R)) :
    listConvexRegion (normalizeCyclicBoundaryFixed points) =
      listConvexRegion points := by
  rw [normalizeCyclicBoundaryFixed,
    normalizeCyclicBoundaryFixedFuel_region,
    canonicalPolygon_region]

omit [IsStrictOrderedRing R] in
/-- The fixed-point normalizer preserves weak global order. -/
theorem normalizeCyclicBoundaryFixed_ordered
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    AllOrderedCCW (normalizeCyclicBoundaryFixed points) := by
  apply normalizeCyclicBoundaryFixedFuel_ordered
  exact canonicalPolygon_ordered points ordered

omit [IsStrictOrderedRing R] in
/-- The fixed-point normalizer preserves duplicate-freedom. -/
theorem normalizeCyclicBoundaryFixed_nodup
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    (normalizeCyclicBoundaryFixed points).Nodup := by
  apply normalizeCyclicBoundaryFixedFuel_nodup
  exact (canonicalPolygon_nodup_iff points).mpr nodup

omit [IsStrictOrderedRing R] in
/-- On duplicate-free inputs, the finite descent result is fixed by one more
cyclic reduction step. -/
theorem normalizeCyclicBoundaryFixed_step_fixed
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    normalizeCyclicBoundary (normalizeCyclicBoundaryFixed points) =
      normalizeCyclicBoundaryFixed points := by
  apply normalizeCyclicBoundaryFixedFuel_step_fixed
  · exact (canonicalPolygon_nodup_iff points).mpr nodup
  · exact canonicalPolygon_idempotent points
  · exact (canonicalPolygon_length points).le

omit [IsStrictOrderedRing R] in
/-- A duplicate-free fixed point of the cyclic pass has no cyclically
consecutive vertex lying in the open segment between its neighbors. -/
theorem cyclicallyIrredundant_of_normalizeCyclicBoundary_fixed
    (points : List (Vec2 R))
    (fixed : normalizeCyclicBoundary points = points) :
    CyclicallyIrredundant points := by
  have fuelLength :
      (normalizeCyclicBoundaryFuel points.length points).length =
        points.length := by
    have normalizedLength := congrArg List.length fixed
    simpa [normalizeCyclicBoundary, canonicalPolygon_length] using
      normalizedLength
  intro count countBound
  by_cases zero : count = 0
  · subst count
    have lengthPositive : 1 ≤ points.length := by omega
    have lastPass :=
      normalizeCyclicBoundaryFuel_all_open_fixed_of_length_eq
        points.length points fuelLength points.length
          lengthPositive (Nat.le_refl _)
    have lastIrredundant :=
      normalizeOpenBoundary_fixed_head_irredundant
        (points.rotate points.length) lastPass
    simpa only [List.rotate_length, List.rotate_zero] using lastIrredundant
  · have countPositive : 1 ≤ count := Nat.one_le_iff_ne_zero.mpr zero
    have countLe : count ≤ points.length := Nat.le_of_lt countBound
    have passFixed :=
      normalizeCyclicBoundaryFuel_all_open_fixed_of_length_eq
        points.length points fuelLength count countPositive countLe
    exact normalizeOpenBoundary_fixed_head_irredundant
      (points.rotate count) passFixed

omit [IsStrictOrderedRing R] in
/-- The finite-descent normalizer removes every locally redundant cyclic
boundary vertex on duplicate-free inputs. -/
theorem normalizeCyclicBoundaryFixed_irredundant
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    CyclicallyIrredundant (normalizeCyclicBoundaryFixed points) := by
  apply cyclicallyIrredundant_of_normalizeCyclicBoundary_fixed
  exact normalizeCyclicBoundaryFixed_step_fixed points nodup

omit [IsStrictOrderedRing R] in
/-- The complete redundant-boundary normalizer is idempotent on
duplicate-free inputs. -/
theorem normalizeCyclicBoundaryFixed_idempotent
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    normalizeCyclicBoundaryFixed (normalizeCyclicBoundaryFixed points) =
      normalizeCyclicBoundaryFixed points := by
  let output := normalizeCyclicBoundaryFixed points
  have outputNodup : output.Nodup :=
    normalizeCyclicBoundaryFixed_nodup points nodup
  have outputStepFixed : normalizeCyclicBoundary output = output :=
    normalizeCyclicBoundaryFixed_step_fixed points nodup
  have outputCanonical : canonicalPolygon output = output := by
    rw [← outputStepFixed]
    exact canonicalPolygon_normalizeCyclicBoundary output
  rw [normalizeCyclicBoundaryFixed, outputCanonical]
  exact normalizeCyclicBoundaryFixedFuel_eq_self_of_step_eq
    output.length output outputStepFixed

/-- Public composition that first chooses CCW winding, removes redundant
boundary subdivisions, and finally performs dimension/seam canonicalization. -/
def canonicalizeReducedWindingSeamed
    (points : List (Vec2 R)) : CanonicalArtifact R :=
  canonicalizeSeamed
    (normalizeCyclicBoundaryFixed (normalizeWinding points))

/-- The reduced winding-aware composition preserves convex-hull semantics on
the explicit forward-or-reverse weak-order domain. -/
theorem canonicalizeReducedWindingSeamed_region
    (points : List (Vec2 R))
    (bidirectionallyOrdered :
      AllOrderedCCW points ∨ AllOrderedCCW points.reverse) :
    (canonicalizeReducedWindingSeamed points).region =
      listConvexRegion points := by
  rw [canonicalizeReducedWindingSeamed,
    canonicalizeSeamed_region _
      (normalizeCyclicBoundaryFixed_ordered _
        (normalizeWinding_ordered points bidirectionallyOrdered)),
    normalizeCyclicBoundaryFixed_region,
    normalizeWinding_region]

open CanonicalizerExtensionalityCounterexample in
/-- The normalizer collapses the formal semantic-extensionality counterexample
to the same corner-only square representation. -/
theorem normalizeCyclicBoundary_subdividedSquare :
    normalizeCyclicBoundary subdividedSquare = square := by
  native_decide

open CanonicalizerExtensionalityCounterexample in
/-- The irredundant square is already a fixed point. -/
theorem normalizeCyclicBoundary_square :
    normalizeCyclicBoundary square = square := by
  native_decide

open CanonicalizerExtensionalityCounterexample in
/-- The finite-descent normalizer removes the known redundant square vertex. -/
theorem normalizeCyclicBoundaryFixed_subdividedSquare :
    normalizeCyclicBoundaryFixed subdividedSquare = square := by
  native_decide

open CanonicalizerExtensionalityCounterexample in
/-- The corner-only square is also fixed by finite descent. -/
theorem normalizeCyclicBoundaryFixed_square :
    normalizeCyclicBoundaryFixed square = square := by
  native_decide

open CanonicalizerExtensionalityCounterexample in
/-- After redundant-boundary normalization, the previously distinct formal
counterexample inputs produce exactly the same canonical artifact. -/
theorem reducedCanonicalizer_repairs_subdividedSquare :
    canonicalizeReducedWindingSeamed subdividedSquare =
      canonicalizeReducedWindingSeamed square := by
  change canonicalizeSeamed
      (normalizeCyclicBoundaryFixed (normalizeWinding subdividedSquare)) =
    canonicalizeSeamed
      (normalizeCyclicBoundaryFixed (normalizeWinding square))
  rw [
    normalizeWinding_eq_self subdividedSquare subdividedSquare_ordered,
    normalizeWinding_eq_self square square_ordered,
    normalizeCyclicBoundaryFixed_subdividedSquare,
    normalizeCyclicBoundaryFixed_square]

end Sprawlens.RedundantBoundaryNormalizer
