import Sprawlens.TotalIteratedClip

namespace Sprawlens.ExecutableCanonicalizer

open AffineDimensionClassification
open CollinearExtrema
open ConvexClipContract
open DegenerateClip
open ExactGeometry
open FullDimensionalSupportSemantics
open HalfPlaneClipPoints
open HalfPlaneIntersection
open ListReclipClassification
open OrderedTriples
open SemanticReclassification
open SimpleRing
open TotalSemanticReclassification
open Vec2Linear

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Proof-free artifact returned by the executable canonicalizer. -/
inductive CanonicalArtifact (R : Type u) where
  | empty
  | point (value : Vec2 R)
  | segment (lower upper : Vec2 R)
  | polygon (points : List (Vec2 R))
  deriving Repr, DecidableEq

/-- Continuous semantics of a proof-free canonical artifact. -/
def CanonicalArtifact.region : CanonicalArtifact R → Set (Vec2 R)
  | .empty => (DegenerateArtifact.empty : DegenerateArtifact R).region
  | .point value => (DegenerateArtifact.point value).region
  | .segment lower upper =>
      (DegenerateArtifact.segment lower upper).region
  | .polygon points => listConvexRegion points

/-- Materialized representation accepted by a subsequent canonicalization. -/
def CanonicalArtifact.points : CanonicalArtifact R → List (Vec2 R)
  | .empty => []
  | .point value => [value]
  | .segment lower upper => [lower, upper]
  | .polygon points => points

/-- Executable finite decision procedure for the positive-triple proposition. -/
def decidableHasPositiveTriple {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R) :
    Decidable (HasPositiveTriple vertex) := by
  unfold HasPositiveTriple
  exact Fintype.decidableExistsFintype

/-- Deterministic lower endpoint, with an unreachable fallback for empty
lists. -/
def lowerEndpoint (first second : Vec2 R) (remaining : List (Vec2 R)) :
    Vec2 R :=
  (List.argmin (lineParameter first second)
    (first :: second :: remaining)).getD first

/-- Deterministic upper endpoint, with an unreachable fallback for empty
lists. -/
def upperEndpoint (first second : Vec2 R) (remaining : List (Vec2 R)) :
    Vec2 R :=
  (List.argmax (lineParameter first second)
    (first :: second :: remaining)).getD second

/-- Lexicographic coordinate order used only to choose a
traversal-independent materialization. -/
def PointLexLE (left right : Vec2 R) : Prop :=
  left.x < right.x ∨ (left.x = right.x ∧ left.y ≤ right.y)

instance (left right : Vec2 R) : Decidable (PointLexLE left right) :=
  inferInstanceAs (Decidable
    (left.x < right.x ∨ (left.x = right.x ∧ left.y ≤ right.y)))

omit [Field R] [IsStrictOrderedRing R] in
theorem pointLexLE_total (left right : Vec2 R) :
    PointLexLE left right ∨ PointLexLE right left := by
  unfold PointLexLE
  rcases lt_trichotomy left.x right.x with xLess | xEqual | xGreater
  · exact Or.inl (Or.inl xLess)
  · rcases le_total left.y right.y with yLe | yGe
    · exact Or.inl (Or.inr ⟨xEqual, yLe⟩)
    · exact Or.inr (Or.inr ⟨xEqual.symm, yGe⟩)
  · exact Or.inr (Or.inl xGreater)

/-- Coordinate-ordered segment artifact, independent of input traversal
direction. -/
def canonicalSegment (start finish : Vec2 R) : CanonicalArtifact R :=
  if PointLexLE start finish then
    .segment start finish
  else
    .segment finish start

/-- Ordering endpoints changes no continuous segment semantics. -/
theorem canonicalSegment_region (start finish : Vec2 R) :
    (canonicalSegment start finish).region =
      (DegenerateArtifact.segment start finish).region := by
  by_cases ordered : PointLexLE start finish
  · simp [canonicalSegment, ordered, CanonicalArtifact.region]
  · simp only [canonicalSegment, ordered, ↓reduceIte,
      CanonicalArtifact.region, degenerateSegment_region_eq_segment]
    exact segment_symm R finish start

/-- Reversing the traversal of a segment produces the same coordinate-
ordered artifact. -/
theorem canonicalSegment_comm (start finish : Vec2 R) :
    canonicalSegment start finish = canonicalSegment finish start := by
  by_cases forward : PointLexLE start finish
  · by_cases backward : PointLexLE finish start
    · have equal : start = finish := by
        unfold PointLexLE at forward backward
        rcases forward with xLess | ⟨xEqual, yLe⟩
        · rcases backward with xGreater | ⟨_, _⟩ <;> linarith
        · rcases backward with xGreater | ⟨_, yGe⟩
          · linarith
          · cases start
            cases finish
            congr
            exact le_antisymm yLe yGe
      subst finish
      rfl
    · simp [canonicalSegment, forward, backward]
  · have backward : PointLexLE finish start :=
      (pointLexLE_total start finish).resolve_left forward
    simp [canonicalSegment, forward, backward]

omit [LinearOrder R] [IsStrictOrderedRing R] in
/-- Interpolation along a nondegenerate segment has a unique parameter. -/
theorem interpolatePoint_injective_of_ne
    (start finish : Vec2 R) (distinct : start ≠ finish) :
    Function.Injective (interpolatePoint start finish) := by
  intro firstParameter secondParameter equalPoints
  apply AffineMap.lineMap_injective R distinct
  have lineMapEq (parameter : R) :
      AffineMap.lineMap start finish parameter =
        interpolatePoint start finish parameter := by
    simp only [AffineMap.lineMap_apply_module]
    exact affineCombination_eq_interpolatePoint
      start finish (1 - parameter) parameter (by ring)
  rw [lineMapEq, lineMapEq]
  exact equalPoints

/-- A nondegenerate closed segment determines its endpoint pair up to
reversal. -/
theorem segment_endpoints_eq_or_swap
    (firstStart firstFinish secondStart secondFinish : Vec2 R)
    (firstDistinct : firstStart ≠ firstFinish)
    (sameRegion :
      (DegenerateArtifact.segment firstStart firstFinish).region =
        (DegenerateArtifact.segment secondStart secondFinish).region) :
    (firstStart = secondStart ∧ firstFinish = secondFinish) ∨
      (firstStart = secondFinish ∧ firstFinish = secondStart) := by
  have secondStartOnFirst :
      OnClosedSegment firstStart firstFinish secondStart := by
    change secondStart ∈
      (DegenerateArtifact.segment firstStart firstFinish).region
    rw [sameRegion]
    exact onClosedSegment_start secondStart secondFinish
  have secondFinishOnFirst :
      OnClosedSegment firstStart firstFinish secondFinish := by
    change secondFinish ∈
      (DegenerateArtifact.segment firstStart firstFinish).region
    rw [sameRegion]
    exact onClosedSegment_finish secondStart secondFinish
  have firstStartOnSecond :
      OnClosedSegment secondStart secondFinish firstStart := by
    change firstStart ∈
      (DegenerateArtifact.segment secondStart secondFinish).region
    rw [← sameRegion]
    exact onClosedSegment_start firstStart firstFinish
  have firstFinishOnSecond :
      OnClosedSegment secondStart secondFinish firstFinish := by
    change firstFinish ∈
      (DegenerateArtifact.segment secondStart secondFinish).region
    rw [← sameRegion]
    exact onClosedSegment_finish firstStart firstFinish
  rcases secondStartOnFirst with
    ⟨startParameter, startBounds, secondStartEq⟩
  rcases secondFinishOnFirst with
    ⟨finishParameter, finishBounds, secondFinishEq⟩
  rcases firstStartOnSecond with
    ⟨firstWitness, firstWitnessBounds, firstStartEq⟩
  rcases firstFinishOnSecond with
    ⟨finishWitness, finishWitnessBounds, firstFinishEq⟩
  have parameterZero :
      startParameter +
          (finishParameter - startParameter) * firstWitness = 0 := by
    apply interpolatePoint_injective_of_ne firstStart firstFinish firstDistinct
    rw [interpolatePoint_zero]
    rw [← interpolatePoint_between_parameters,
      ← secondStartEq, ← secondFinishEq]
    exact firstStartEq.symm
  have parameterOne :
      startParameter +
          (finishParameter - startParameter) * finishWitness = 1 := by
    apply interpolatePoint_injective_of_ne firstStart firstFinish firstDistinct
    rw [interpolatePoint_one]
    rw [← interpolatePoint_between_parameters,
      ← secondStartEq, ← secondFinishEq]
    exact firstFinishEq.symm
  rcases le_total startParameter finishParameter with forward | backward
  · have firstProduct :
        0 ≤ (finishParameter - startParameter) * firstWitness :=
      mul_nonneg (sub_nonneg.mpr forward) firstWitnessBounds.1
    have finishRemainder :
        0 ≤ (finishParameter - startParameter) * (1 - finishWitness) :=
      mul_nonneg (sub_nonneg.mpr forward)
        (sub_nonneg.mpr finishWitnessBounds.2)
    have startZero : startParameter = 0 := by
      nlinarith [startBounds.1]
    have finishOne : finishParameter = 1 := by
      nlinarith [finishBounds.2]
    left
    constructor
    · rw [secondStartEq, startZero, interpolatePoint_zero]
    · rw [secondFinishEq, finishOne, interpolatePoint_one]
  · have startRemainder :
        0 ≤ (startParameter - finishParameter) * (1 - firstWitness) :=
      mul_nonneg (sub_nonneg.mpr backward)
        (sub_nonneg.mpr firstWitnessBounds.2)
    have finishProduct :
        0 ≤ (startParameter - finishParameter) * finishWitness :=
      mul_nonneg (sub_nonneg.mpr backward) finishWitnessBounds.1
    have finishZero : finishParameter = 0 := by
      nlinarith [finishBounds.1]
    have startOne : startParameter = 1 := by
      nlinarith [startBounds.2]
    right
    constructor
    · rw [secondFinishEq, finishZero, interpolatePoint_zero]
    · rw [secondStartEq, startOne, interpolatePoint_one]

/-- Equal nondegenerate segment regions have the same coordinate-ordered
artifact, even when their source traversals or base directions differ. -/
theorem canonicalSegment_eq_of_region_eq
    (firstStart firstFinish secondStart secondFinish : Vec2 R)
    (firstDistinct : firstStart ≠ firstFinish)
    (sameRegion :
      (canonicalSegment firstStart firstFinish).region =
        (canonicalSegment secondStart secondFinish).region) :
    canonicalSegment firstStart firstFinish =
      canonicalSegment secondStart secondFinish := by
  have rawRegion :
      (DegenerateArtifact.segment firstStart firstFinish).region =
        (DegenerateArtifact.segment secondStart secondFinish).region := by
    rw [← canonicalSegment_region, ← canonicalSegment_region]
    exact sameRegion
  rcases segment_endpoints_eq_or_swap firstStart firstFinish
      secondStart secondFinish firstDistinct rawRegion with
    aligned | reversed
  · rw [aligned.1, aligned.2]
  · rw [reversed.1, reversed.2]
    exact canonicalSegment_comm secondFinish secondStart

/-- The executable endpoint selector cannot collapse two distinct base
points to one endpoint: their parameters are zero and one. -/
theorem lowerEndpoint_ne_upperEndpoint
    (first second : Vec2 R) (remaining : List (Vec2 R))
    (distinct : first ≠ second) :
    lowerEndpoint first second remaining ≠
      upperEndpoint first second remaining := by
  let points := first :: second :: remaining
  let parameter := lineParameter first second
  cases lowerEq : List.argmin parameter points with
  | none =>
      have empty := List.argmin_eq_none.mp lowerEq
      simp [points] at empty
  | some lower =>
      cases upperEq : List.argmax parameter points with
      | none =>
          have empty := List.argmax_eq_none.mp upperEq
          simp [points] at empty
      | some upper =>
          have lowerOptionMember : lower ∈ List.argmin parameter points := by
            simp [lowerEq]
          have upperOptionMember : upper ∈ List.argmax parameter points := by
            simp [upperEq]
          have firstMember : first ∈ points := by simp [points]
          have secondMember : second ∈ points := by simp [points]
          have lowerLeZero : parameter lower ≤ 0 := by
            rw [← lineParameter_start first second distinct]
            exact List.le_of_mem_argmin firstMember lowerOptionMember
          have oneLeUpper : 1 ≤ parameter upper := by
            rw [← lineParameter_finish first second distinct]
            exact List.le_of_mem_argmax secondMember upperOptionMember
          have selectedLower : lowerEndpoint first second remaining = lower := by
            simp [lowerEndpoint, points, parameter, lowerEq]
          have selectedUpper : upperEndpoint first second remaining = upper := by
            simp [upperEndpoint, points, parameter, upperEq]
          rw [selectedLower, selectedUpper]
          intro equal
          have oneLeLower : 1 ≤ parameter lower := by
            rw [equal]
            exact oneLeUpper
          linarith

/-- Canonicalize a duplicate-free weakly ordered list.  Lists of affine
dimension two remain polygons.  Collinear lists of length at least three use
the deterministic first-occurrence tie-breaking of `List.argmin/argmax`. -/
def canonicalizeNormalized (points : List (Vec2 R)) : CanonicalArtifact R :=
  match points with
  | [] => .empty
  | [first] => .point first
  | [first, second] => canonicalSegment first second
  | first :: second :: third :: remaining =>
      let normalized := first :: second :: third :: remaining
      let lengthAtLeastThree : 3 ≤ normalized.length := by simp [normalized]
      let vertex := listVertex normalized lengthAtLeastThree
      letI := decidableHasPositiveTriple vertex
      if _fullDimensional : HasPositiveTriple vertex then
        .polygon normalized
      else
        canonicalSegment
          (lowerEndpoint first second (third :: remaining))
          (upperEndpoint first second (third :: remaining))

/-- Public executable canonicalizer: global duplicate removal precedes the
affine-dimension dispatch. -/
def canonicalize (points : List (Vec2 R)) : CanonicalArtifact R :=
  canonicalizeNormalized points.dedup

/-- A duplicate-free list of length at least three that fails the positive-
triple test is represented by a nondegenerate canonical segment. -/
theorem canonicalizeNormalized_eq_segment_of_not_positive
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (lengthAtLeastThree : 3 ≤ points.length)
    (notFullDimensional : ¬HasPositiveTriple
      (listVertex points lengthAtLeastThree)) :
    ∃ start finish, start ≠ finish ∧
      canonicalizeNormalized points = canonicalSegment start finish := by
  cases points with
  | nil => simp at lengthAtLeastThree
  | cons first rest =>
      cases rest with
      | nil => simp at lengthAtLeastThree
      | cons second tail =>
          cases tail with
          | nil => simp at lengthAtLeastThree
          | cons third remaining =>
              let start := lowerEndpoint first second (third :: remaining)
              let finish := upperEndpoint first second (third :: remaining)
              have firstDistinct : first ≠ second := by
                intro equal
                apply (List.nodup_cons.mp nodup).1
                simp [equal]
              have endpointsDistinct : start ≠ finish :=
                lowerEndpoint_ne_upperEndpoint first second
                  (third :: remaining) firstDistinct
              refine ⟨start, finish, endpointsDistinct, ?_⟩
              simp only [canonicalizeNormalized]
              split
              · rename_i positive
                apply False.elim
                apply notFullDimensional
                simpa only using positive
              · rfl

omit [IsStrictOrderedRing R] in
/-- In the collinear fork, every materialized value is collinear with the
first two distinct values. -/
theorem allCollinear_with_first_two
    (first second third : Vec2 R) (remaining : List (Vec2 R))
    (ordered : AllOrderedCCW (first :: second :: third :: remaining))
    (notFullDimensional : ¬HasPositiveTriple
      (listVertex (first :: second :: third :: remaining) (by simp))) :
    ∀ point ∈ first :: second :: third :: remaining,
      orientation first second point = 0 := by
  let points := first :: second :: third :: remaining
  let lengthAtLeastThree : 3 ≤ points.length := by simp [points]
  let vertex := listVertex points lengthAtLeastThree
  have vertexOrdered : IsLinearlyOrderedCCW vertex := by
    rw [linearlyOrdered_iff_indexedVertices_triplewise]
    rw [indexedVertices_listVertex]
    exact ordered
  have notFull : ¬HasPositiveTriple vertex := by
    simpa [vertex, points] using notFullDimensional
  have collinear : AllOrderedTriplesCollinear vertex :=
    (linearlyOrdered_dimensionDichotomy vertex vertexOrdered).resolve_left
      notFull
  let baseStart : RingIndex (points.length - 3) := ⟨0, by omega⟩
  let baseFinish : RingIndex (points.length - 3) := ⟨1, by omega⟩
  have firstEq : vertex baseStart = first := by
    simp [vertex, points, baseStart, listVertex]
  have secondEq : vertex baseFinish = second := by
    simp [vertex, points, baseFinish, listVertex]
  have baseCollinear (index : RingIndex (points.length - 3)) :
      orientation (vertex baseStart) (vertex baseFinish) (vertex index) = 0 := by
    by_cases atStart : index = baseStart
    · subst index
      simp [orientation]
    by_cases atFinish : index = baseFinish
    · subst index
      simp only [orientation]
      ring
    apply collinear baseStart baseFinish index
    · simp [baseStart, baseFinish]
    · have indexNotZero : index.val ≠ 0 := by
        intro equal
        apply atStart
        apply Fin.ext
        simpa [baseStart] using equal
      have indexNotOne : index.val ≠ 1 := by
        intro equal
        apply atFinish
        apply Fin.ext
        simpa [baseFinish] using equal
      change 1 < index.val
      omega
  intro point member
  have indexedMember : point ∈ indexedVertices vertex := by
    rw [indexedVertices_listVertex]
    exact member
  change point ∈ List.ofFn vertex at indexedMember
  rcases List.mem_ofFn.mp indexedMember with ⟨index, pointEq⟩
  simpa [firstEq, secondEq, pointEq] using baseCollinear index

/-- The executable normalized canonicalizer preserves convex point-set
semantics on its weakly ordered, duplicate-free domain. -/
theorem canonicalizeNormalized_region
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllOrderedCCW points) :
    (canonicalizeNormalized points).region = listConvexRegion points := by
  cases points with
  | nil =>
      simp [canonicalizeNormalized, CanonicalArtifact.region,
        listConvexRegion, DegenerateArtifact.region]
  | cons first rest =>
      cases rest with
      | nil =>
          simpa [canonicalizeNormalized, CanonicalArtifact.region,
            SemanticallyReclassifies, IteratedArtifact.region] using
            (point_semanticallyReclassifies first).symm
      | cons second tail =>
          cases tail with
          | nil =>
              rw [canonicalizeNormalized, canonicalSegment_region]
              simpa [SemanticallyReclassifies,
                IteratedArtifact.region] using
                (segment_semanticallyReclassifies first second).symm
          | cons third remaining =>
              let points := first :: second :: third :: remaining
              let lengthAtLeastThree : 3 ≤ points.length := by simp [points]
              let vertex := listVertex points lengthAtLeastThree
              by_cases fullDimensional : HasPositiveTriple vertex
              · simp [canonicalizeNormalized, points, vertex,
                  fullDimensional, CanonicalArtifact.region]
              · have firstDistinct : first ≠ second := by
                  intro equal
                  apply (List.nodup_cons.mp nodup).1
                  simp [equal]
                have allCollinear : ∀ point ∈ points,
                    orientation first second point = 0 := by
                  apply allCollinear_with_first_two
                  · exact ordered
                  · simpa [vertex, points, lengthAtLeastThree] using
                      fullDimensional
                rcases argmin_argmax_segment_contains
                    first second (third :: remaining) firstDistinct
                    (by simpa [points] using allCollinear) with
                  ⟨lower, upper, lowerEq, upperEq, allOn⟩
                have lowerOptionMember : lower ∈
                    List.argmin (lineParameter first second) points := by
                  simp [points, lowerEq]
                have upperOptionMember : upper ∈
                    List.argmax (lineParameter first second) points := by
                  simp [points, upperEq]
                have lowerMember : lower ∈ points :=
                  List.argmin_mem lowerOptionMember
                have upperMember : upper ∈ points :=
                  List.argmax_mem upperOptionMember
                have classified := list_semanticallyReclassifies_segment
                  points lower upper lowerMember upperMember
                    (by simpa [points] using allOn)
                change
                  (canonicalizeNormalized
                    (first :: second :: third :: remaining)).region =
                    listConvexRegion points
                simp only [canonicalizeNormalized]
                split
                · rename_i positive
                  apply False.elim
                  apply fullDimensional
                  simpa [vertex, points, lengthAtLeastThree] using positive
                · rename_i notPositive
                  simp only [lowerEndpoint, upperEndpoint]
                  rw [lowerEq, upperEq]
                  rw [canonicalSegment_region]
                  exact classified.symm

/-- End-to-end semantic preservation of the public executable canonicalizer. -/
theorem canonicalize_region
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    (canonicalize points).region = listConvexRegion points := by
  rw [canonicalize]
  rw [canonicalizeNormalized_region]
  · exact listConvexRegion_dedup points
  · exact List.nodup_dedup points
  · exact AllOrderedCCW.sublist (List.dedup_sublist points) ordered

omit [IsStrictOrderedRing R] in
/-- A coordinate-ordered nondegenerate segment is a fixed point of the public
canonicalizer after materialization. -/
theorem canonicalize_canonicalSegment_points
    (start finish : Vec2 R) (distinct : start ≠ finish) :
    canonicalize (canonicalSegment start finish).points =
      canonicalSegment start finish := by
  by_cases forward : PointLexLE start finish
  · simp [canonicalSegment, forward, canonicalize, canonicalizeNormalized,
      CanonicalArtifact.points, distinct]
  · have backward : PointLexLE finish start :=
      (pointLexLE_total start finish).resolve_left forward
    simp [canonicalSegment, forward, backward, canonicalize,
      canonicalizeNormalized, CanonicalArtifact.points,
      distinct.symm]

/-- A duplicate-free normalized input is a fixed point after materializing its
canonical artifact and canonicalizing once more. -/
theorem canonicalizeNormalized_materialized_fixed
    (points : List (Vec2 R)) (nodup : points.Nodup) :
    canonicalize (canonicalizeNormalized points).points =
      canonicalizeNormalized points := by
  cases points with
  | nil =>
      simp [canonicalize, canonicalizeNormalized, CanonicalArtifact.points]
  | cons first rest =>
      cases rest with
      | nil =>
          simp [canonicalize, canonicalizeNormalized,
            CanonicalArtifact.points]
      | cons second tail =>
          cases tail with
          | nil =>
              have distinct : first ≠ second := by
                intro equal
                apply (List.nodup_cons.mp nodup).1
                simp [equal]
              exact canonicalize_canonicalSegment_points
                first second distinct
          | cons third remaining =>
              let points := first :: second :: third :: remaining
              let lengthAtLeastThree : 3 ≤ points.length := by simp [points]
              let vertex := listVertex points lengthAtLeastThree
              have dedupEq : points.dedup = points :=
                List.dedup_eq_self.mpr nodup
              by_cases fullDimensional : HasPositiveTriple vertex
              · have result : canonicalizeNormalized points =
                    .polygon points := by
                  simp [canonicalizeNormalized, points, vertex,
                    fullDimensional]
                rw [result]
                change canonicalize points = .polygon points
                rw [canonicalize, dedupEq, result]
              · let lower :=
                    lowerEndpoint first second (third :: remaining)
                let upper :=
                    upperEndpoint first second (third :: remaining)
                have firstDistinct : first ≠ second := by
                  intro equal
                  apply (List.nodup_cons.mp nodup).1
                  simp [equal]
                have endpointDistinct : lower ≠ upper := by
                  exact lowerEndpoint_ne_upperEndpoint
                    first second (third :: remaining) firstDistinct
                have result : canonicalizeNormalized points =
                    canonicalSegment lower upper := by
                  simp [canonicalizeNormalized, points, vertex,
                    fullDimensional, lower, upper]
                rw [result]
                exact canonicalize_canonicalSegment_points
                  lower upper endpointDistinct

/-- Public idempotence: canonicalizing the materialization of a canonical
artifact returns the same artifact. -/
theorem canonicalize_materialized_idempotent (points : List (Vec2 R)) :
    canonicalize (canonicalize points).points = canonicalize points := by
  exact canonicalizeNormalized_materialized_fixed points.dedup
    (List.nodup_dedup points)

omit [IsStrictOrderedRing R] in
/-- A two-point input is represented by its coordinate-ordered segment. -/
theorem canonicalize_pair (start finish : Vec2 R) (distinct : start ≠ finish) :
    canonicalize [start, finish] = canonicalSegment start finish := by
  simp [canonicalize, canonicalizeNormalized, distinct]

/-- Reversing a nondegenerate segment preserves the represented region. -/
theorem reversed_pair_same_region
    (start finish : Vec2 R) (distinct : start ≠ finish) :
    (canonicalize [start, finish]).region =
      (canonicalize [finish, start]).region := by
  rw [canonicalize_pair start finish distinct]
  rw [canonicalize_pair finish start distinct.symm]
  exact congrArg CanonicalArtifact.region
    (canonicalSegment_comm start finish)

/-- The repaired segment branch is traversal-independent at artifact level. -/
theorem reversed_pair_same_artifact
    (start finish : Vec2 R) (distinct : start ≠ finish) :
    canonicalize [start, finish] = canonicalize [finish, start] := by
  rw [canonicalize_pair start finish distinct]
  rw [canonicalize_pair finish start distinct.symm]
  exact canonicalSegment_comm start finish

end Sprawlens.ExecutableCanonicalizer
