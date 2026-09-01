import Mathlib.Data.List.Permutation
import Sprawlens.ExecutableCanonicalizer

namespace Sprawlens.PolygonSeamCanonicalizer

open ExactGeometry
open ConvexClipContract
open CyclicBinaryBlocks
open DegenerateClip
open ExecutableCanonicalizer
open FullDimensionalSupportSemantics
open ListReclipClassification
open OrderedTriples
open SeamSupportSemantics
open SemanticReclassification
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Coordinate key with the lexicographic order inherited from `R × R`. -/
def pointKey (point : Vec2 R) : Lex (R × R) :=
  toLex (point.x, point.y)

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
theorem pointKey_injective : Function.Injective (pointKey (R := R)) := by
  intro left right equal
  cases left
  cases right
  simp [pointKey] at equal
  simp_all

/-- Rotate a polygon list so that its lexicographically least vertex is the
first element.  `List.argmin` makes the procedure executable and fixes its
tie-breaking rule. -/
def canonicalPolygon (points : List (Vec2 R)) : List (Vec2 R) :=
  match List.argmin pointKey points with
  | none => points
  | some point => points.rotate (List.idxOf point points)

omit [Field R] [IsStrictOrderedRing R] in
/-- Seam normalization is only a cyclic permutation. -/
theorem canonicalPolygon_perm (points : List (Vec2 R)) :
    (canonicalPolygon points).Perm points := by
  unfold canonicalPolygon
  split
  · rfl
  · exact List.rotate_perm _ _

omit [Field R] [IsStrictOrderedRing R] in
/-- Seam normalization stays in the same cyclic equivalence class. -/
theorem canonicalPolygon_isRotated (points : List (Vec2 R)) :
    points ~r canonicalPolygon points := by
  unfold canonicalPolygon
  split
  · exact List.IsRotated.refl points
  · exact ⟨_, rfl⟩

omit [Field R] [IsStrictOrderedRing R] in
theorem canonicalPolygon_length (points : List (Vec2 R)) :
    (canonicalPolygon points).length = points.length :=
  (canonicalPolygon_perm points).length_eq

omit [Field R] [IsStrictOrderedRing R] in
theorem canonicalPolygon_nodup_iff (points : List (Vec2 R)) :
    (canonicalPolygon points).Nodup ↔ points.Nodup :=
  (canonicalPolygon_perm points).nodup_iff

omit [IsStrictOrderedRing R] in
/-- Moving the seam preserves the polygon's convex-hull semantics. -/
theorem canonicalPolygon_region (points : List (Vec2 R)) :
    listConvexRegion (canonicalPolygon points) = listConvexRegion points := by
  unfold listConvexRegion
  congr 1
  ext point
  exact (canonicalPolygon_perm points).mem_iff

omit [Field R] [IsStrictOrderedRing R] in
/-- With an injective key, `argmin` depends only on list membership, not on
the order in which the values are materialized. -/
theorem argmin_pointKey_eq_of_perm
    {first second : List (Vec2 R)} (permutation : first.Perm second) :
    List.argmin pointKey first = List.argmin pointKey second := by
  cases selected : List.argmin pointKey first with
  | none =>
      have firstEmpty : first = [] := List.argmin_eq_none.mp selected
      subst first
      have secondEmpty : second = [] := permutation.symm.eq_nil
      subst second
      simp
  | some minimum =>
      rcases List.argmin_eq_some_iff.mp selected with
        ⟨minimumMember, minimumLe, _⟩
      symm
      apply List.argmin_eq_some_iff.mpr
      refine ⟨permutation.mem_iff.mp minimumMember, ?_, ?_⟩
      · intro point member
        exact minimumLe point (permutation.mem_iff.mpr member)
      · intro point member pointLe
        have minimumLePoint : pointKey minimum ≤ pointKey point :=
          minimumLe point (permutation.mem_iff.mpr member)
        have keyEqual : pointKey point = pointKey minimum :=
          le_antisymm pointLe minimumLePoint
        have pointEqual : point = minimum := pointKey_injective keyEqual
        subst point
        exact le_rfl

omit [Field R] [LinearOrder R] [IsStrictOrderedRing R] in
/-- Two cyclic rotations of a duplicate-free nonempty list are equal once
their heads agree. -/
theorem isRotated_eq_of_nodup_of_head?_eq
    {first second : List (Vec2 R)} (rotated : first ~r second)
    (nodup : first.Nodup) (nonempty : first ≠ [])
    (sameHead : first.head? = second.head?) : first = second := by
  rcases rotated with ⟨count, rfl⟩
  have lengthPositive : 0 < first.length := List.length_pos_iff.mpr nonempty
  have modulusBound : count % first.length < first.length :=
    Nat.mod_lt count lengthPositive
  have headAtModulus :
      first.head? = (first.rotate (count % first.length)).head? := by
    simpa only [List.rotate_mod] using sameHead
  rw [List.head?_eq_getElem?, List.head?_rotate modulusBound] at headAtModulus
  rw [List.getElem?_eq_getElem lengthPositive,
    List.getElem?_eq_getElem modulusBound] at headAtModulus
  injection headAtModulus with valuesEqual
  have indicesEqual : 0 = count % first.length :=
    nodup.getElem_inj_iff.mp valuesEqual
  have rotationSelf : first.rotate count = first :=
    nodup.rotate_eq_self_iff.mpr (Or.inl indicesEqual.symm)
  exact rotationSelf.symm

omit [Field R] [IsStrictOrderedRing R] in
/-- The chosen minimum becomes the first materialized vertex. -/
theorem canonicalPolygon_head?_eq_argmin
    (points : List (Vec2 R)) (minimum : Vec2 R)
    (selected : List.argmin pointKey points = some minimum) :
    (canonicalPolygon points).head? = some minimum := by
  have optionMember : minimum ∈ List.argmin pointKey points := by
    simp [selected]
  have member : minimum ∈ points := List.argmin_mem optionMember
  have indexBound : List.idxOf minimum points < points.length :=
    List.idxOf_lt_length_iff.mpr member
  rw [canonicalPolygon]
  split
  · rename_i none
    rw [none] at selected
    contradiction
  · rename_i point some
    rw [some] at selected
    injection selected with pointEq
    subst point
    rw [List.head?_rotate indexBound]
    exact List.getElem?_idxOf member

omit [Field R] [IsStrictOrderedRing R] in
/-- Rotation preserves the selected minimum.  Injectivity of the coordinate
key turns all key ties into equality of vertices. -/
theorem canonicalPolygon_argmin
    (points : List (Vec2 R)) (minimum : Vec2 R)
    (selected : List.argmin pointKey points = some minimum) :
    List.argmin pointKey (canonicalPolygon points) = some minimum := by
  rcases List.argmin_eq_some_iff.mp selected with
    ⟨minimumMember, minimumLe, _⟩
  rw [List.argmin_eq_some_iff]
  refine ⟨(canonicalPolygon_perm points).mem_iff.mpr minimumMember, ?_, ?_⟩
  · intro point member
    exact minimumLe point ((canonicalPolygon_perm points).mem_iff.mp member)
  · intro point member pointLe
    have minimumLePoint : pointKey minimum ≤ pointKey point :=
      minimumLe point ((canonicalPolygon_perm points).mem_iff.mp member)
    have keyEqual : pointKey point = pointKey minimum :=
      le_antisymm pointLe minimumLePoint
    have pointEqual : point = minimum := pointKey_injective keyEqual
    subst point
    exact le_rfl

omit [Field R] [IsStrictOrderedRing R] in
/-- Once the least coordinate is at the seam, applying seam normalization
again changes nothing. -/
theorem canonicalPolygon_idempotent (points : List (Vec2 R)) :
    canonicalPolygon (canonicalPolygon points) = canonicalPolygon points := by
  cases selected : List.argmin pointKey points with
  | none =>
      have empty : points = [] := List.argmin_eq_none.mp selected
      subst points
      simp [canonicalPolygon]
  | some minimum =>
      have selectedAgain := canonicalPolygon_argmin points minimum selected
      have head := canonicalPolygon_head?_eq_argmin points minimum selected
      cases normalizedEq : canonicalPolygon points with
      | nil =>
          simp [normalizedEq] at head
      | cons first remaining =>
          have firstEq : first = minimum := by
            simpa [normalizedEq] using head
          subst first
          have selectedCons :
              List.argmin pointKey (minimum :: remaining) = some minimum := by
            simpa [normalizedEq] using selectedAgain
          simp [canonicalPolygon, selectedCons]

omit [Field R] [IsStrictOrderedRing R] in
/-- On duplicate-free polygon materializations, the selected seam is
independent of the caller's cyclic start index. -/
theorem canonicalPolygon_rotate
    (points : List (Vec2 R)) (nodup : points.Nodup) (count : Nat) :
    canonicalPolygon (points.rotate count) = canonicalPolygon points := by
  by_cases empty : points = []
  · subst points
    simp [canonicalPolygon]
  cases selected : List.argmin pointKey points with
  | none =>
      exact False.elim (empty (List.argmin_eq_none.mp selected))
  | some minimum =>
      have selectedRotated :
          List.argmin pointKey (points.rotate count) = some minimum := by
        rw [argmin_pointKey_eq_of_perm (List.rotate_perm points count)]
        exact selected
      have rotatedRelation :
          canonicalPolygon (points.rotate count) ~r
            canonicalPolygon points := by
        exact (canonicalPolygon_isRotated (points.rotate count)).symm.trans
          ((List.IsRotated.forall points count).trans
            (canonicalPolygon_isRotated points))
      have rotatedNodup : (canonicalPolygon (points.rotate count)).Nodup :=
        (canonicalPolygon_nodup_iff (points.rotate count)).mpr
          (List.nodup_rotate.mpr nodup)
      have rotatedNonempty : canonicalPolygon (points.rotate count) ≠ [] := by
        intro normalizedEmpty
        have lengthEq := canonicalPolygon_length (points.rotate count)
        rw [normalizedEmpty] at lengthEq
        simp only [List.length_nil, List.length_rotate] at lengthEq
        have pointsEmpty : points = [] :=
          List.length_eq_zero_iff.mp lengthEq.symm
        exact empty pointsEmpty
      have rotatedHead := canonicalPolygon_head?_eq_argmin
        (points.rotate count) minimum selectedRotated
      have originalHead := canonicalPolygon_head?_eq_argmin
        points minimum selected
      apply isRotated_eq_of_nodup_of_head?_eq rotatedRelation rotatedNodup
        rotatedNonempty
      exact rotatedHead.trans originalHead.symm

omit [IsStrictOrderedRing R] in
/-- Weak global order is preserved when the list seam is rotated. -/
theorem allOrderedCCW_rotate
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) (count : Nat) :
    AllOrderedCCW (points.rotate count) := by
  by_cases lengthAtLeastThree : 3 ≤ points.length
  · let rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length := by
      simpa using lengthAtLeastThree
    have vertexOrdered : IsLinearlyOrderedCCW
        (listVertex points lengthAtLeastThree) := by
      rw [linearlyOrdered_iff_indexedVertices_triplewise]
      rw [indexedVertices_listVertex]
      exact ordered
    let start : RingIndex (points.length - 3) :=
      ⟨count % points.length, by
        have positive : 0 < points.length := by omega
        have bound := Nat.mod_lt count positive
        omega⟩
    have rotatedOrdered := linearlyOrdered_rotateVertex vertexOrdered start
    have reindexedOrdered : IsLinearlyOrderedCCW
        (listVertex (points.rotate count) rotatedLengthAtLeastThree) := by
      convert rotatedOrdered using 1
      · simp
      · apply (Fin.heq_fun_iff (by simp)).2
        intro index
        simp [listVertex, StrictConvexContract.rotateVertex, rotateIndex,
          start, Nat.add_comm]
        apply congrArg points.get
        apply Fin.ext
        simp only
        rw [show 3 + (points.length - 3) = points.length by omega]
        rw [Nat.add_comm index.val (count % points.length)]
        rw [Nat.mod_add_mod, Nat.add_comm]
    rw [linearlyOrdered_iff_indexedVertices_triplewise] at reindexedOrdered
    rw [indexedVertices_listVertex] at reindexedOrdered
    exact reindexedOrdered
  · unfold AllOrderedCCW
    apply allOrderedTriples_of_length_le_two
    simp
    omega

omit [IsStrictOrderedRing R] in
/-- A positive cyclic adjacent turn always yields a positive increasing-index
triple; wraparound only cyclically permutes the same determinant. -/
theorem hasPositiveCyclicTurn_hasPositiveTriple
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (positiveTurn : HasPositiveCyclicTurn vertex) :
    HasPositiveTriple vertex := by
  rcases positiveTurn with ⟨start, positive⟩
  let zero : RingIndex extraVertices := ⟨0, by omega⟩
  by_cases twoInRange : start.val + 2 < extraVertices + 3
  · let second : RingIndex extraVertices :=
      ⟨start.val + 1, by omega⟩
    let third : RingIndex extraVertices :=
      ⟨start.val + 2, twoInRange⟩
    have nextEq : nextIndex start = second := by
      apply Fin.ext
      simp only [nextIndex, second]
      rw [Nat.mod_eq_of_lt (by omega)]
    have nextNextEq : nextIndex second = third := by
      apply Fin.ext
      simp only [nextIndex, second, third]
      rw [Nat.mod_eq_of_lt twoInRange]
    refine ⟨start, second, third, by simp [second], ?_, ?_⟩
    · simp [second, third]
    · rwa [nextEq, nextNextEq] at positive
  · by_cases oneInRange : start.val + 1 < extraVertices + 3
    · let second : RingIndex extraVertices :=
        ⟨start.val + 1, oneInRange⟩
      have startValue : start.val = extraVertices + 1 := by omega
      have nextEq : nextIndex start = second := by
        apply Fin.ext
        simp [nextIndex, second, Nat.mod_eq_of_lt oneInRange]
      have nextNextEq : nextIndex second = zero := by
        apply Fin.ext
        simp [nextIndex, second, zero, startValue]
      refine ⟨zero, start, second, by simp [zero, startValue],
        by simp [second], ?_⟩
      rw [nextEq, nextNextEq] at positive
      rw [orientation_cycle (vertex second) (vertex zero) (vertex start)]
      rw [orientation_cycle (vertex start) (vertex second) (vertex zero)]
      exact positive
    · have startValue : start.val = extraVertices + 2 := by omega
      let one : RingIndex extraVertices := ⟨1, by omega⟩
      have nextEq : nextIndex start = zero := by
        apply Fin.ext
        simp [nextIndex, zero, startValue]
      have nextNextEq : nextIndex zero = one := by
        apply Fin.ext
        simp [nextIndex, zero, one]
      refine ⟨zero, one, start, by simp [zero, one],
        by simp [one, startValue], ?_⟩
      rw [nextEq, nextNextEq] at positive
      rw [orientation_cycle (vertex start) (vertex zero) (vertex one)]
      exact positive

omit [IsStrictOrderedRing R] in
/-- Positive cyclic turns are invariant under changing the finite-index
materialization seam. -/
theorem hasPositiveCyclicTurn_rotateVertex
    {extraVertices : Nat}
    (vertex : RingIndex extraVertices → Vec2 R)
    (positiveTurn : HasPositiveCyclicTurn vertex)
    (offset : RingIndex extraVertices) :
    HasPositiveCyclicTurn (rotateVertex offset vertex) := by
  rcases positiveTurn with ⟨turnStart, positive⟩
  let shiftedStart : RingIndex extraVertices :=
    rotateIndex (by omega) (inverseStart (by omega) offset) turnStart
  refine ⟨shiftedStart, ?_⟩
  simp only [rotateVertex]
  rw [rotateIndex_nextIndex, rotateIndex_nextIndex,
    rotateIndex_nextIndex]
  have unshifted :
      rotateIndex (by omega) offset shiftedStart = turnStart := by
    dsimp only [shiftedStart]
    exact rotateIndex_inverseStart_right (by omega) offset turnStart
  rw [unshifted]
  exact positive

omit [IsStrictOrderedRing R] in
/-- The concrete `List.rotate`/`listVertex` representation transports a
positive cyclic turn exactly as `rotateVertex` does. -/
theorem hasPositiveCyclicTurn_listVertex_rotate
    (points : List (Vec2 R))
    (lengthAtLeastThree : 3 ≤ points.length)
    (positiveTurn : HasPositiveCyclicTurn
      (listVertex points lengthAtLeastThree))
    (count : Nat)
    (rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length) :
    HasPositiveCyclicTurn
      (listVertex (points.rotate count) rotatedLengthAtLeastThree) := by
  let start : RingIndex (points.length - 3) :=
    ⟨count % points.length, by
      have positive : 0 < points.length := by omega
      have bound := Nat.mod_lt count positive
      omega⟩
  have rotatedPositive := hasPositiveCyclicTurn_rotateVertex
    (listVertex points lengthAtLeastThree) positiveTurn start
  convert rotatedPositive using 1
  · simp
  · apply (Fin.heq_fun_iff (by simp)).2
    intro index
    simp [listVertex, StrictConvexContract.rotateVertex, rotateIndex, start,
      Nat.add_comm]
    apply congrArg points.get
    apply Fin.ext
    simp only
    rw [show 3 + (points.length - 3) = points.length by omega]
    rw [Nat.add_comm index.val (count % points.length)]
    rw [Nat.mod_add_mod, Nat.add_comm]

omit [IsStrictOrderedRing R] in
/-- Full affine dimension is preserved when a duplicate-free weakly ordered
list is cyclically rotated. -/
theorem hasPositiveTriple_listVertex_rotate
    (points : List (Vec2 R))
    (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllOrderedCCW points) (nodup : points.Nodup)
    (fullDimensional : HasPositiveTriple
      (listVertex points lengthAtLeastThree))
    (count : Nat)
    (rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length) :
    HasPositiveTriple
      (listVertex (points.rotate count) rotatedLengthAtLeastThree) := by
  have vertexOrdered : IsLinearlyOrderedCCW
      (listVertex points lengthAtLeastThree) := by
    rw [linearlyOrdered_iff_indexedVertices_triplewise]
    rw [indexedVertices_listVertex]
    exact ordered
  have vertexInjective : Function.Injective
      (listVertex points lengthAtLeastThree) :=
    listVertex_injective_of_nodup lengthAtLeastThree nodup
  have positiveTurn : HasPositiveCyclicTurn
      (listVertex points lengthAtLeastThree) :=
    hasPositiveTriple_hasPositiveCyclicTurn
      (listVertex points lengthAtLeastThree) vertexOrdered vertexInjective
        fullDimensional
  exact hasPositiveCyclicTurn_hasPositiveTriple _
    (hasPositiveCyclicTurn_listVertex_rotate
      points lengthAtLeastThree positiveTurn count
        rotatedLengthAtLeastThree)

omit [IsStrictOrderedRing R] in
/-- For duplicate-free weakly ordered lists, the executable affine-dimension
predicate is invariant under every cyclic choice of input seam. -/
theorem hasPositiveTriple_listVertex_rotate_iff
    (points : List (Vec2 R))
    (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllOrderedCCW points) (nodup : points.Nodup)
    (count : Nat)
    (rotatedLengthAtLeastThree : 3 ≤ (points.rotate count).length) :
    HasPositiveTriple
        (listVertex (points.rotate count) rotatedLengthAtLeastThree) ↔
      HasPositiveTriple (listVertex points lengthAtLeastThree) := by
  constructor
  · intro rotatedFull
    let rotated := points.rotate count
    let reverseCount := rotated.length - count % rotated.length
    have restored : rotated.rotate reverseCount = points := by
      dsimp only [rotated, reverseCount]
      exact (List.rotate_eq_iff.mp (rfl : points.rotate count =
        points.rotate count)).symm
    have rotatedOrdered : AllOrderedCCW rotated := by
      exact allOrderedCCW_rotate points ordered count
    have rotatedNodup : rotated.Nodup := by
      exact List.nodup_rotate.mpr nodup
    have restoredLengthAtLeastThree :
        3 ≤ (rotated.rotate reverseCount).length := by
      rw [restored]
      exact lengthAtLeastThree
    have restoredFull := hasPositiveTriple_listVertex_rotate
      rotated rotatedLengthAtLeastThree rotatedOrdered rotatedNodup
        rotatedFull reverseCount restoredLengthAtLeastThree
    let positiveFor : List (Vec2 R) → Prop := fun values =>
      ∀ lengthProof : 3 ≤ values.length,
        HasPositiveTriple (listVertex values lengthProof)
    have restoredAll : positiveFor (rotated.rotate reverseCount) := by
      intro lengthProof
      simpa only using restoredFull
    have propertyEq := congrArg positiveFor restored
    exact propertyEq.mp restoredAll lengthAtLeastThree
  · intro fullDimensional
    exact hasPositiveTriple_listVertex_rotate
      points lengthAtLeastThree ordered nodup fullDimensional count
        rotatedLengthAtLeastThree

omit [IsStrictOrderedRing R] in
/-- A duplicate-free weakly ordered full-dimensional polygon remains in the
positive-triple branch after moving its seam to the least coordinate. -/
theorem canonicalPolygon_hasPositiveTriple
    (points : List (Vec2 R))
    (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllOrderedCCW points) (nodup : points.Nodup)
    (fullDimensional : HasPositiveTriple
      (listVertex points lengthAtLeastThree))
    (canonicalLengthAtLeastThree : 3 ≤ (canonicalPolygon points).length) :
    HasPositiveTriple
      (listVertex (canonicalPolygon points) canonicalLengthAtLeastThree) := by
  have vertexOrdered : IsLinearlyOrderedCCW
      (listVertex points lengthAtLeastThree) := by
    rw [linearlyOrdered_iff_indexedVertices_triplewise]
    rw [indexedVertices_listVertex]
    exact ordered
  have vertexInjective : Function.Injective
      (listVertex points lengthAtLeastThree) :=
    listVertex_injective_of_nodup lengthAtLeastThree nodup
  have positiveTurn : HasPositiveCyclicTurn
      (listVertex points lengthAtLeastThree) :=
    hasPositiveTriple_hasPositiveCyclicTurn
      (listVertex points lengthAtLeastThree) vertexOrdered vertexInjective
        fullDimensional
  cases selected : List.argmin pointKey points with
  | none =>
      have empty : points = [] := List.argmin_eq_none.mp selected
      subst points
      simp at lengthAtLeastThree
  | some minimum =>
      let count := List.idxOf minimum points
      have canonicalEq : canonicalPolygon points = points.rotate count := by
        simp [canonicalPolygon, selected, count]
      let positiveFor : List (Vec2 R) → Prop := fun values =>
        ∀ lengthProof : 3 ≤ values.length,
          HasPositiveTriple (listVertex values lengthProof)
      have rotatedAll : positiveFor (points.rotate count) := by
        intro rotatedLengthAtLeastThree
        apply hasPositiveCyclicTurn_hasPositiveTriple
        exact hasPositiveCyclicTurn_listVertex_rotate
          points lengthAtLeastThree positiveTurn count
            rotatedLengthAtLeastThree
      have propertyEq := congrArg positiveFor canonicalEq
      exact propertyEq.mpr rotatedAll canonicalLengthAtLeastThree

omit [IsStrictOrderedRing R] in
/-- A duplicate-free list with at least three vertices and a positive triple
is selected by the executable base canonicalizer's polygon branch. -/
theorem canonicalize_eq_polygon_of_nodup_of_positive
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (lengthAtLeastThree : 3 ≤ points.length)
    (fullDimensional : HasPositiveTriple
      (listVertex points lengthAtLeastThree)) :
    ExecutableCanonicalizer.canonicalize points =
      CanonicalArtifact.polygon points := by
  rw [ExecutableCanonicalizer.canonicalize,
    List.dedup_eq_self.mpr nodup]
  cases points with
  | nil => simp at lengthAtLeastThree
  | cons first rest =>
      cases rest with
      | nil => simp at lengthAtLeastThree
      | cons second tail =>
          cases tail with
          | nil => simp at lengthAtLeastThree
          | cons third remaining =>
              simp only [ExecutableCanonicalizer.canonicalizeNormalized]
              split
              · rfl
              · rename_i notPositive
                apply False.elim
                apply notPositive
                simpa using fullDimensional

/-- Apply seam normalization only to the polygon branch of an already
dimension-classified artifact. -/
def normalizePolygonSeam :
    CanonicalArtifact R → CanonicalArtifact R
  | .polygon points => .polygon (canonicalPolygon points)
  | .empty => .empty
  | .point point => .point point
  | .segment lower upper => .segment lower upper

/-- Public composition of dimension-aware canonicalization and polygon seam
normalization. -/
def canonicalizeSeamed (points : List (Vec2 R)) : CanonicalArtifact R :=
  normalizePolygonSeam (ExecutableCanonicalizer.canonicalize points)

omit [Field R] [IsStrictOrderedRing R] in
theorem normalizePolygonSeam_canonicalSegment
    (start finish : Vec2 R) :
    normalizePolygonSeam
        (ExecutableCanonicalizer.canonicalSegment start finish) =
      ExecutableCanonicalizer.canonicalSegment start finish := by
  unfold ExecutableCanonicalizer.canonicalSegment
  split <;> rfl

omit [IsStrictOrderedRing R] in
/-- The composed canonicalizer fixes a seam-normalized full-dimensional
polygon after materialization. -/
theorem canonicalizeSeamed_canonicalPolygon_fixed
    (points : List (Vec2 R))
    (lengthAtLeastThree : 3 ≤ points.length)
    (ordered : AllOrderedCCW points) (nodup : points.Nodup)
    (fullDimensional : HasPositiveTriple
      (listVertex points lengthAtLeastThree)) :
    canonicalizeSeamed (canonicalPolygon points) =
      CanonicalArtifact.polygon (canonicalPolygon points) := by
  have canonicalLength : 3 ≤ (canonicalPolygon points).length := by
    simpa [canonicalPolygon_length] using lengthAtLeastThree
  have canonicalNodup : (canonicalPolygon points).Nodup :=
    (canonicalPolygon_nodup_iff points).mpr nodup
  have canonicalPositive := canonicalPolygon_hasPositiveTriple
    points lengthAtLeastThree ordered nodup fullDimensional canonicalLength
  rw [canonicalizeSeamed,
    canonicalize_eq_polygon_of_nodup_of_positive
      (canonicalPolygon points) canonicalNodup canonicalLength
        canonicalPositive]
  simp only [normalizePolygonSeam]
  rw [canonicalPolygon_idempotent]

/-- Every duplicate-free weakly ordered input is a fixed point after the
composed artifact is materialized and canonicalized again. -/
theorem canonicalizeSeamed_normalized_materialized_fixed
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllOrderedCCW points) :
    canonicalizeSeamed
        (normalizePolygonSeam
          (ExecutableCanonicalizer.canonicalizeNormalized points)).points =
      normalizePolygonSeam
        (ExecutableCanonicalizer.canonicalizeNormalized points) := by
  cases points with
  | nil =>
      simp [canonicalizeSeamed, normalizePolygonSeam,
        ExecutableCanonicalizer.canonicalize,
        ExecutableCanonicalizer.canonicalizeNormalized,
        CanonicalArtifact.points]
  | cons first rest =>
      cases rest with
      | nil =>
          simp [canonicalizeSeamed, normalizePolygonSeam,
            ExecutableCanonicalizer.canonicalize,
            ExecutableCanonicalizer.canonicalizeNormalized,
            CanonicalArtifact.points]
      | cons second tail =>
          cases tail with
          | nil =>
              have distinct : first ≠ second := by
                intro equal
                apply (List.nodup_cons.mp nodup).1
                simp [equal]
              change canonicalizeSeamed
                  (normalizePolygonSeam
                    (ExecutableCanonicalizer.canonicalSegment
                      first second)).points =
                normalizePolygonSeam
                  (ExecutableCanonicalizer.canonicalSegment first second)
              rw [normalizePolygonSeam_canonicalSegment]
              rw [canonicalizeSeamed,
                ExecutableCanonicalizer.canonicalize_canonicalSegment_points
                  first second distinct,
                normalizePolygonSeam_canonicalSegment]
          | cons third remaining =>
              let values := first :: second :: third :: remaining
              let lengthAtLeastThree : 3 ≤ values.length := by simp [values]
              let vertex := listVertex values lengthAtLeastThree
              by_cases fullDimensional : HasPositiveTriple vertex
              · have result : normalizePolygonSeam
                    (ExecutableCanonicalizer.canonicalizeNormalized values) =
                    CanonicalArtifact.polygon
                      (canonicalPolygon values) := by
                  simp [ExecutableCanonicalizer.canonicalizeNormalized,
                    normalizePolygonSeam, values, vertex, fullDimensional]
                rw [result]
                change canonicalizeSeamed (canonicalPolygon values) = _
                exact canonicalizeSeamed_canonicalPolygon_fixed
                  values lengthAtLeastThree ordered nodup fullDimensional
              · let lower := ExecutableCanonicalizer.lowerEndpoint
                    first second (third :: remaining)
                let upper := ExecutableCanonicalizer.upperEndpoint
                    first second (third :: remaining)
                have firstDistinct : first ≠ second := by
                  intro equal
                  apply (List.nodup_cons.mp nodup).1
                  simp [equal]
                have endpointDistinct : lower ≠ upper := by
                  exact ExecutableCanonicalizer.lowerEndpoint_ne_upperEndpoint
                    first second (third :: remaining) firstDistinct
                have result : normalizePolygonSeam
                    (ExecutableCanonicalizer.canonicalizeNormalized values) =
                    ExecutableCanonicalizer.canonicalSegment lower upper := by
                  have baseResult :
                      ExecutableCanonicalizer.canonicalizeNormalized values =
                        ExecutableCanonicalizer.canonicalSegment lower upper := by
                    simp [ExecutableCanonicalizer.canonicalizeNormalized,
                      values, vertex, fullDimensional, lower, upper]
                  rw [baseResult]
                  exact normalizePolygonSeam_canonicalSegment lower upper
                rw [result]
                rw [canonicalizeSeamed,
                  ExecutableCanonicalizer.canonicalize_canonicalSegment_points
                    lower upper endpointDistinct]
                exact normalizePolygonSeam_canonicalSegment lower upper

/-- End-to-end materialization idempotence of the composed executable
canonicalizer on its weakly ordered input domain. -/
theorem canonicalizeSeamed_materialized_idempotent
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    canonicalizeSeamed (canonicalizeSeamed points).points =
      canonicalizeSeamed points := by
  change canonicalizeSeamed
      (normalizePolygonSeam
        (ExecutableCanonicalizer.canonicalizeNormalized points.dedup)).points =
    normalizePolygonSeam
      (ExecutableCanonicalizer.canonicalizeNormalized points.dedup)
  exact canonicalizeSeamed_normalized_materialized_fixed
    points.dedup (List.nodup_dedup points)
      (AllOrderedCCW.sublist (List.dedup_sublist points) ordered)

omit [IsStrictOrderedRing R] in
/-- Artifact-level seam normalization preserves continuous semantics. -/
theorem normalizePolygonSeam_region
    (artifact : CanonicalArtifact R) :
    (normalizePolygonSeam artifact).region = artifact.region := by
  cases artifact with
  | empty => rfl
  | point point => rfl
  | segment lower upper => rfl
  | polygon points =>
      exact canonicalPolygon_region points

omit [Field R] [IsStrictOrderedRing R] in
/-- Artifact-level seam normalization is idempotent. -/
theorem normalizePolygonSeam_idempotent
    (artifact : CanonicalArtifact R) :
    normalizePolygonSeam (normalizePolygonSeam artifact) =
      normalizePolygonSeam artifact := by
  cases artifact with
  | empty => rfl
  | point point => rfl
  | segment lower upper => rfl
  | polygon points =>
      simp only [normalizePolygonSeam]
      rw [canonicalPolygon_idempotent]

/-- The composed executable canonicalizer retains the proved convex-region
semantics of the dimension-aware base canonicalizer. -/
theorem canonicalizeSeamed_region
    (points : List (Vec2 R)) (ordered : AllOrderedCCW points) :
    (canonicalizeSeamed points).region = listConvexRegion points := by
  rw [canonicalizeSeamed,
    normalizePolygonSeam_region]
  exact ExecutableCanonicalizer.canonicalize_region points ordered

omit [Field R] [IsStrictOrderedRing R] in
/-- On polygon artifacts, seam normalization identifies every cyclic shift
of a duplicate-free materialization. -/
theorem normalizePolygonSeam_polygon_rotate
    (points : List (Vec2 R)) (nodup : points.Nodup) (count : Nat) :
    normalizePolygonSeam
        (CanonicalArtifact.polygon (points.rotate count)) =
      normalizePolygonSeam (CanonicalArtifact.polygon points) := by
  simp only [normalizePolygonSeam]
  rw [canonicalPolygon_rotate points nodup count]

omit [IsStrictOrderedRing R] in
/-- Cyclically moving the materialization seam preserves the convex-hull
region of any list. -/
theorem listConvexRegion_rotate
    (points : List (Vec2 R)) (count : Nat) :
    listConvexRegion (points.rotate count) = listConvexRegion points := by
  unfold listConvexRegion
  congr 1
  ext point
  exact (List.rotate_perm points count).mem_iff

/-- End-to-end seam independence: on duplicate-free weakly ordered inputs,
the composed executable canonicalizer returns exactly the same artifact for
every cyclic choice of starting vertex.  This covers empty, point, segment,
arbitrarily long collinear, and full-dimensional polygon branches. -/
theorem canonicalizeSeamed_rotate
    (points : List (Vec2 R)) (nodup : points.Nodup)
    (ordered : AllOrderedCCW points) (count : Nat) :
    canonicalizeSeamed (points.rotate count) =
      canonicalizeSeamed points := by
  cases points with
  | nil =>
      simp [canonicalizeSeamed, ExecutableCanonicalizer.canonicalize,
        ExecutableCanonicalizer.canonicalizeNormalized,
        normalizePolygonSeam]
  | cons first rest =>
      cases rest with
      | nil =>
          simp [canonicalizeSeamed, ExecutableCanonicalizer.canonicalize,
            ExecutableCanonicalizer.canonicalizeNormalized,
            normalizePolygonSeam]
      | cons second tail =>
          cases tail with
          | nil =>
              have distinct : first ≠ second := by
                intro equal
                apply (List.nodup_cons.mp nodup).1
                simp [equal]
              have originalResult :
                  canonicalizeSeamed [first, second] =
                    ExecutableCanonicalizer.canonicalSegment first second := by
                rw [canonicalizeSeamed,
                  ExecutableCanonicalizer.canonicalize_pair
                    first second distinct]
                exact normalizePolygonSeam_canonicalSegment first second
              have rotatedPermutation :
                  ([first, second].rotate count).Perm [first, second] :=
                List.rotate_perm [first, second] count
              rcases List.perm_pair.mp rotatedPermutation with
                unchanged | reversed
              · rw [unchanged]
              · rw [reversed, originalResult]
                rw [canonicalizeSeamed,
                  ExecutableCanonicalizer.canonicalize_pair
                    second first distinct.symm,
                  normalizePolygonSeam_canonicalSegment]
                exact ExecutableCanonicalizer.canonicalSegment_comm
                  second first
          | cons third remaining =>
              let values := first :: second :: third :: remaining
              let lengthAtLeastThree : 3 ≤ values.length := by simp [values]
              let rotatedLengthAtLeastThree :
                  3 ≤ (values.rotate count).length := by
                simpa using lengthAtLeastThree
              have rotatedNodup : (values.rotate count).Nodup :=
                List.nodup_rotate.mpr nodup
              have rotatedOrdered : AllOrderedCCW (values.rotate count) :=
                allOrderedCCW_rotate values ordered count
              have dimensionInvariant :=
                hasPositiveTriple_listVertex_rotate_iff
                  values lengthAtLeastThree ordered nodup count
                    rotatedLengthAtLeastThree
              by_cases fullDimensional : HasPositiveTriple
                  (listVertex values lengthAtLeastThree)
              · have rotatedFull : HasPositiveTriple
                    (listVertex (values.rotate count)
                      rotatedLengthAtLeastThree) :=
                  dimensionInvariant.mpr fullDimensional
                have originalClassifier :=
                  canonicalize_eq_polygon_of_nodup_of_positive
                    values nodup lengthAtLeastThree fullDimensional
                have rotatedClassifier :=
                  canonicalize_eq_polygon_of_nodup_of_positive
                    (values.rotate count) rotatedNodup
                      rotatedLengthAtLeastThree rotatedFull
                rw [canonicalizeSeamed, rotatedClassifier,
                  normalizePolygonSeam, canonicalizeSeamed,
                  originalClassifier, normalizePolygonSeam]
                exact congrArg CanonicalArtifact.polygon
                  (canonicalPolygon_rotate values nodup count)
              · have rotatedNotFull : ¬HasPositiveTriple
                    (listVertex (values.rotate count)
                      rotatedLengthAtLeastThree) := by
                  intro rotatedFull
                  exact fullDimensional (dimensionInvariant.mp rotatedFull)
                rcases
                    ExecutableCanonicalizer.canonicalizeNormalized_eq_segment_of_not_positive
                      values nodup lengthAtLeastThree fullDimensional with
                  ⟨start, finish, distinct, originalBase⟩
                rcases
                    ExecutableCanonicalizer.canonicalizeNormalized_eq_segment_of_not_positive
                      (values.rotate count) rotatedNodup
                        rotatedLengthAtLeastThree rotatedNotFull with
                  ⟨rotatedStart, rotatedFinish, rotatedDistinct, rotatedBase⟩
                have originalResult : canonicalizeSeamed values =
                    ExecutableCanonicalizer.canonicalSegment
                      start finish := by
                  rw [canonicalizeSeamed,
                    ExecutableCanonicalizer.canonicalize,
                    List.dedup_eq_self.mpr nodup, originalBase]
                  exact normalizePolygonSeam_canonicalSegment start finish
                have rotatedResult : canonicalizeSeamed
                      (values.rotate count) =
                    ExecutableCanonicalizer.canonicalSegment
                      rotatedStart rotatedFinish := by
                  rw [canonicalizeSeamed,
                    ExecutableCanonicalizer.canonicalize,
                    List.dedup_eq_self.mpr rotatedNodup, rotatedBase]
                  exact normalizePolygonSeam_canonicalSegment
                    rotatedStart rotatedFinish
                have sameSegmentRegion :
                    (ExecutableCanonicalizer.canonicalSegment
                        rotatedStart rotatedFinish).region =
                      (ExecutableCanonicalizer.canonicalSegment
                        start finish).region := by
                  rw [← rotatedResult, ← originalResult,
                    canonicalizeSeamed_region
                      (values.rotate count) rotatedOrdered,
                    canonicalizeSeamed_region values ordered,
                    listConvexRegion_rotate]
                rw [rotatedResult, originalResult]
                exact
                  ExecutableCanonicalizer.canonicalSegment_eq_of_region_eq
                    rotatedStart rotatedFinish start finish
                      rotatedDistinct sameSegmentRegion

end Sprawlens.PolygonSeamCanonicalizer
