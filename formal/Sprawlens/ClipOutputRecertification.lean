import Sprawlens.ConvexClipArea
import Sprawlens.ListReclipClassification

namespace Sprawlens.ClipOutputRecertification

open ConvexClipArea
open ConvexClipContract
open ConvexHalfPlaneSigns
open CyclicClosure
open ExactGeometry
open FullDimensionalSupportSemantics
open HalfPlaneClipFold
open HalfPlaneClipPoints
open HalfPlaneClipRing
open HalfPlaneIntersection
open ListReclipClassification
open ReclipCertificate
open SimpleRing
open StrictConvexContract

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- In the canonical mixed-sign rotation, the executable emitter is exactly
the ideal retained/crossing sequence followed by adjacent and closing
duplicate normalization.  This exposes the concrete list on which
nondegeneracy and uniqueness still have to be proved. -/
theorem clipIndexedRing_eq_normalized_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    clipIndexedRing plane vertex =
      normalizeClosure
        ((vertex ⟨0, by omega⟩ ::
          boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩) ::
          boundaryPoint plane (vertex ⟨count, by omega⟩)
            (vertex ⟨count + 1, by omega⟩) ::
          retainedBlockVertices (count := count) vertex).destutter (· ≠ ·)) := by
  rw [clipIndexedRing, closedClipOutputPoints, clipOutputPoints, joinDistinct]
  simp_rw [outputPoints_eq_destutter_ideal]
  have chunksEq :
      (indexedEdges vertex).map (fun edge ↦
        (idealOutputPoints plane edge.1 edge.2).destutter (· ≠ ·)) =
        (idealIndexedChunks plane vertex).map
          (fun chunk ↦ chunk.destutter (· ≠ ·)) := by
    rw [idealIndexedChunks, List.map_map]
    rfl
  rw [chunksEq]
  change normalizeClosure
      ((((idealIndexedChunks plane vertex).map
        fun chunk ↦ chunk.destutter (· ≠ ·)).flatten).destutter (· ≠ ·)) = _
  rw [idealIndexedChunks_eq_of_rotatedBlock plane vertex countPositive
    countBound countNextBound outsideIff]
  simp [canonicalChunkBlock, retainedBlockVertices, Function.comp_def,
    flatten_ofFn_singleton]
  split
  · rename_i duplicateExit
    rw [← duplicateExit]
    simp only [List.singleton_append, List.destutter_cons_cons,
      List.destutter'_cons, not_true_eq_false, if_false]
  · rfl

theorem retainedBlockVertices_nodup_of_strict
    {extraVertices count : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    (retainedBlockVertices (count := count) vertex).Nodup := by
  rw [retainedBlockVertices]
  apply List.nodup_ofFn_ofInjective
  intro first second equalVertices
  have equalIndices := ordered.injective equalVertices
  apply Fin.ext
  have equalValues := congrArg Fin.val equalIndices
  simp at equalValues ⊢
  omega

theorem zero_not_mem_retainedBlockVertices_of_strict
    {extraVertices count : Nat}
    {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex) :
    vertex ⟨0, by omega⟩ ∉ retainedBlockVertices (count := count) vertex := by
  rw [retainedBlockVertices, List.mem_ofFn']
  rintro ⟨index, equalVertices⟩
  have equalIndices := ordered.injective equalVertices
  have equalValues := congrArg Fin.val equalIndices
  simp at equalValues

theorem leavingBoundary_not_mem_retainedBlockVertices_of_strict
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) :
    boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩) ∉
      retainedBlockVertices (count := count) vertex := by
  rw [retainedBlockVertices, List.mem_ofFn']
  rintro ⟨index, equalPoint⟩
  let zero : RingIndex extraVertices := ⟨0, by omega⟩
  let first : RingIndex extraVertices := ⟨1, by omega⟩
  let retained : RingIndex extraVertices :=
    ⟨count + 1 + index.val, by omega⟩
  have sourceTurn :
      0 < orientation (vertex zero) (vertex first) (vertex retained) := by
    apply ordered
    · simp [zero, first]
    · simp [first, retained]
      omega
  have boundaryTurn : orientation (vertex zero) (vertex first)
      (boundaryPoint plane (vertex zero) (vertex first)) = 0 := by
    simp [boundaryPoint, orientation_interpolate_third]
  have equalPoint' :
      boundaryPoint plane (vertex zero) (vertex first) = vertex retained := by
    simpa [zero, first, retained] using equalPoint.symm
  rw [equalPoint'] at boundaryTurn
  linarith

theorem zero_ne_enteringBoundary_of_strict
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countNextBound : count + 1 < extraVertices + 3) :
    vertex ⟨0, by omega⟩ ≠
      boundaryPoint plane (vertex ⟨count, by omega⟩)
        (vertex ⟨count + 1, by omega⟩) := by
  intro equalPoint
  have sourceTurn : 0 < orientation
      (vertex (⟨0, by omega⟩ : RingIndex extraVertices))
      (vertex ⟨count, by omega⟩)
      (vertex ⟨count + 1, by omega⟩) := by
    apply ordered
    · change 0 < count
      exact countPositive
    · change count < count + 1
      omega
  have boundaryTurn : orientation
      (boundaryPoint plane (vertex ⟨count, by omega⟩)
        (vertex ⟨count + 1, by omega⟩))
      (vertex ⟨count, by omega⟩)
      (vertex ⟨count + 1, by omega⟩) = 0 := by
    rw [boundaryPoint, orientation_interpolate_first]
    simp
  rw [← equalPoint] at boundaryTurn
  linarith

theorem enteringBoundary_not_mem_retainedBlockTail_of_strict
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countNextBound : count + 1 < extraVertices + 3) :
    boundaryPoint plane (vertex ⟨count, by omega⟩)
        (vertex ⟨count + 1, by omega⟩) ∉
      (retainedBlockVertices (count := count) vertex).tail := by
  let entering := boundaryPoint plane (vertex ⟨count, by omega⟩)
    (vertex ⟨count + 1, by omega⟩)
  let next : RingIndex extraVertices := ⟨count + 1, by omega⟩
  have retainedEq := retainedBlockVertices_eq_cons
    (count := count) vertex countNextBound
  have retainedNodup := retainedBlockVertices_nodup_of_strict
    (count := count) ordered
  rw [retainedEq] at retainedNodup
  have nextNotMemTail :
      vertex next ∉ (retainedBlockVertices (count := count) vertex).tail := by
    exact (List.nodup_cons.mp (by simpa [next] using retainedNodup)).1
  intro enteringMember
  by_cases enteringIsNext : entering = vertex next
  · exact nextNotMemTail (enteringIsNext ▸ enteringMember)
  have enteringMemberRetained :
      entering ∈ retainedBlockVertices (count := count) vertex := by
    rw [retainedEq]
    exact List.mem_cons_of_mem _ enteringMember
  rw [retainedBlockVertices, List.mem_ofFn'] at enteringMemberRetained
  rcases enteringMemberRetained with ⟨index, equalPoint⟩
  have indexPositive : 0 < index.val := by
    apply Nat.pos_of_ne_zero
    intro indexZero
    have equalNext :
        vertex ⟨count + 1 + index.val, by omega⟩ = vertex next := by
      apply congrArg vertex
      apply Fin.ext
      simp [next, indexZero]
    exact enteringIsNext (by
      rw [← equalPoint]
      exact equalNext)
  let later : RingIndex extraVertices :=
    ⟨count + 1 + index.val, by omega⟩
  have sourceTurn : 0 < orientation
      (vertex (⟨count, by omega⟩ : RingIndex extraVertices))
      (vertex next) (vertex later) := by
    apply ordered
    · change count < count + 1
      omega
    · simp [next, later]
      omega
  have boundaryTurn : orientation
      (vertex (⟨count, by omega⟩ : RingIndex extraVertices))
      (vertex next) entering = 0 := by
    simp [entering, next, boundaryPoint, orientation_interpolate_third]
  have equalPoint' : vertex later = entering := by
    simpa [later] using equalPoint
  rw [← equalPoint'] at boundaryTurn
  linarith

theorem leavingBoundary_ne_enteringBoundary_of_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩) ≠
      boundaryPoint plane (vertex ⟨count, by omega⟩)
        (vertex ⟨count + 1, by omega⟩) := by
  let zero : RingIndex extraVertices := ⟨0, by omega⟩
  let first : RingIndex extraVertices := ⟨1, by omega⟩
  let last : RingIndex extraVertices := ⟨count, countBound⟩
  let next : RingIndex extraVertices := ⟨count + 1, countNextBound⟩
  have zeroInside : signedDistance plane (vertex zero) ≤ 0 := by
    apply le_of_not_gt
    intro outside
    have impossible := (outsideIff zero).mp outside
    simp [zero] at impossible
  have firstOutside : 0 < signedDistance plane (vertex first) := by
    apply (outsideIff first).mpr
    constructor
    · simp [first]
    · change 1 ≤ count
      omega
  have lastOutside : 0 < signedDistance plane (vertex last) := by
    apply (outsideIff last).mpr
    exact ⟨countPositive, le_rfl⟩
  have nextInside : signedDistance plane (vertex next) ≤ 0 := by
    apply le_of_not_gt
    intro outside
    have impossible := (outsideIff next).mp outside
    simp [next] at impossible
  let exitParameter := boundaryParameter
    (signedDistance plane (vertex zero))
    (signedDistance plane (vertex first))
  let entryParameter := boundaryParameter
    (signedDistance plane (vertex last))
    (signedDistance plane (vertex next))
  let leaving := boundaryPoint plane (vertex zero) (vertex first)
  let entering := boundaryPoint plane (vertex last) (vertex next)
  have exitBounds : exitParameter ∈ Set.Icc (0 : R) 1 := by
    exact boundaryParameter_mem_Icc_of_inside_outside zeroInside firstOutside
  have exitBelowOne : exitParameter < 1 := by
    exact boundaryParameter_lt_one_of_inside_outside zeroInside firstOutside
  have entryPositive : 0 < entryParameter := by
    exact boundaryParameter_pos_of_outside_inside lastOutside nextInside
  have distinct : leaving ≠ entering := by
    by_cases singletonOutside : count = 1
    · subst count
      have sourceTurn : 0 < orientation
          (vertex zero) (vertex first) (vertex next) := by
        apply ordered
        · simp [zero, first]
        · simp [first, next]
      have turnIdentity : orientation leaving (vertex first) entering =
          (1 - exitParameter) * entryParameter *
            orientation (vertex zero) (vertex first) (vertex next) := by
        simp only [leaving, entering, boundaryPoint, exitParameter, entryParameter,
          last, first]
        exact orientation_interpolate_both _ _ _ _ _
      have positiveTurn : 0 < orientation leaving (vertex first) entering := by
        rw [turnIdentity]
        exact mul_pos (mul_pos (sub_pos.mpr exitBelowOne) entryPositive) sourceTurn
      exact strict_left_turn_start_ne_end _ _ _ positiveTurn
    · have countAtLeastTwo : 2 ≤ count := by omega
      have firstSourceTurn : 0 < orientation
          (vertex zero) (vertex last) (vertex next) := by
        apply ordered
        · simp [zero, last]
          omega
        · simp [last, next]
      have secondSourceTurn : 0 < orientation
          (vertex first) (vertex last) (vertex next) := by
        apply ordered
        · simp [first, last]
          omega
        · simp [last, next]
      have leavingTurnIdentity : orientation leaving (vertex last) (vertex next) =
          (1 - exitParameter) *
              orientation (vertex zero) (vertex last) (vertex next) +
            exitParameter *
              orientation (vertex first) (vertex last) (vertex next) := by
        simp only [leaving, boundaryPoint, exitParameter]
        exact orientation_interpolate_first _ _ _ _ _
      have leavingTurnPositive :
          0 < orientation leaving (vertex last) (vertex next) := by
        rw [leavingTurnIdentity]
        have firstTermPositive : 0 < (1 - exitParameter) *
            orientation (vertex zero) (vertex last) (vertex next) :=
          mul_pos (sub_pos.mpr exitBelowOne) firstSourceTurn
        have secondTermNonnegative : 0 ≤ exitParameter *
            orientation (vertex first) (vertex last) (vertex next) :=
          mul_nonneg exitBounds.1 (le_of_lt secondSourceTurn)
        linarith
      have outputTurnIdentity : orientation leaving (vertex last) entering =
          entryParameter * orientation leaving (vertex last) (vertex next) := by
        simp only [entering, boundaryPoint, entryParameter]
        exact orientation_interpolate_finish _ _ _ _
      have positiveTurn : 0 < orientation leaving (vertex last) entering := by
        rw [outputTurnIdentity]
        exact mul_pos entryPositive leavingTurnPositive
      exact strict_left_turn_start_ne_end _ _ _ positiveTurn
  simpa [leaving, entering, zero, first, last, next] using distinct

theorem clipIndexedRing_nodup_of_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    (clipIndexedRing plane vertex).Nodup := by
  let zero : RingIndex extraVertices := ⟨0, by omega⟩
  let first : RingIndex extraVertices := ⟨1, by omega⟩
  let last : RingIndex extraVertices := ⟨count, countBound⟩
  let next : RingIndex extraVertices := ⟨count + 1, countNextBound⟩
  let leaving := boundaryPoint plane (vertex zero) (vertex first)
  let entering := boundaryPoint plane (vertex last) (vertex next)
  let tail := (retainedBlockVertices (count := count) vertex).tail
  have retainedEq := retainedBlockVertices_eq_cons
    (count := count) vertex countNextBound
  have retainedNodup := retainedBlockVertices_nodup_of_strict
    (count := count) ordered
  rw [retainedEq] at retainedNodup
  have tailNodup : tail.Nodup := by
    exact (List.nodup_cons.mp (by simpa [next, tail] using retainedNodup)).2
  have nextNotMemTail : vertex next ∉ tail := by
    exact (List.nodup_cons.mp (by simpa [next, tail] using retainedNodup)).1
  have nextTailChain : (vertex next :: tail).IsChain (· ≠ ·) :=
    ((by
      simpa [next, tail] using retainedNodup :
        (vertex next :: tail).Nodup).pairwise_of_forall_ne
          fun _ _ _ _ distinct ↦ distinct).isChain
  have tailDestutterFixed :
      tail.destutter' (· ≠ ·) (vertex next) = vertex next :: tail :=
    List.destutter'_of_isChain_cons tail (· ≠ ·) nextTailChain
  have zeroNotRetained := zero_not_mem_retainedBlockVertices_of_strict
    (count := count) ordered
  rw [retainedEq] at zeroNotRetained
  have zeroParts : vertex zero ≠ vertex next ∧ vertex zero ∉ tail := by
    simpa [zero, next, tail] using zeroNotRetained
  have zeroNeNext : vertex zero ≠ vertex next := by
    exact zeroParts.1
  have zeroNotMemTail : vertex zero ∉ tail := by
    exact zeroParts.2
  have leavingNotRetained := leavingBoundary_not_mem_retainedBlockVertices_of_strict
    (count := count) plane ordered countPositive
  rw [retainedEq] at leavingNotRetained
  have leavingParts : leaving ≠ vertex next ∧ leaving ∉ tail := by
    simpa [leaving, zero, first, next, tail] using leavingNotRetained
  have leavingNeNext : leaving ≠ vertex next := by
    exact leavingParts.1
  have leavingNotMemTail : leaving ∉ tail := by
    exact leavingParts.2
  have enteringNotMemTail : entering ∉ tail := by
    simpa [entering, last, next, tail] using
      enteringBoundary_not_mem_retainedBlockTail_of_strict
        (count := count) plane ordered countNextBound
  have zeroNeEntering : vertex zero ≠ entering := by
    simpa [zero, entering, last, next] using
      zero_ne_enteringBoundary_of_strict
        (count := count) plane ordered countPositive countNextBound
  have leavingNeEntering : leaving ≠ entering := by
    simpa [leaving, entering, zero, first, last, next] using
      leavingBoundary_ne_enteringBoundary_of_rotatedBlock
        plane ordered countPositive countBound countNextBound outsideIff
  rw [clipIndexedRing_eq_normalized_rotatedBlock
    plane vertex countPositive countBound countNextBound outsideIff]
  rw [retainedEq]
  change (normalizeClosure
    (([vertex zero, leaving, entering, vertex next] ++ tail).destutter
      (· ≠ ·))).Nodup
  by_cases zeroIsLeaving : vertex zero = leaving
  · by_cases enteringIsNext : entering = vertex next
    · have canonicalNodup :
          (vertex zero :: vertex next :: tail).Nodup := by
        simp [zeroNeNext, zeroNotMemTail, nextNotMemTail, tailNodup]
      have canonicalChain :
          (vertex zero :: vertex next :: tail).IsChain (· ≠ ·) :=
        (canonicalNodup.pairwise_of_forall_ne
          fun _ _ _ _ distinct ↦ distinct).isChain
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) = vertex zero :: vertex next :: tail := by
        rw [← zeroIsLeaving, enteringIsNext]
        simp only [List.cons_append, List.nil_append]
        rw [List.destutter_cons_cons, if_neg (by simp)]
        rw [List.destutter'_cons_pos _ zeroNeNext]
        rw [List.destutter'_cons_neg _ (by simp), tailDestutterFixed]
      rw [destutterEq, normalizeClosure_eq_self_of_nodup _ canonicalNodup]
      exact canonicalNodup

    · have canonicalNodup :
          (vertex zero :: entering :: vertex next :: tail).Nodup := by
        simp [zeroNeEntering, zeroNeNext, zeroNotMemTail, enteringIsNext,
          enteringNotMemTail, nextNotMemTail, tailNodup]
      have canonicalChain :
          (vertex zero :: entering :: vertex next :: tail).IsChain (· ≠ ·) :=
        (canonicalNodup.pairwise_of_forall_ne
          fun _ _ _ _ distinct ↦ distinct).isChain
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) = vertex zero :: entering :: vertex next :: tail := by
        rw [← zeroIsLeaving]
        simp only [List.cons_append, List.nil_append]
        rw [List.destutter_cons_cons, if_neg (by simp)]
        rw [List.destutter'_cons_pos _ zeroNeEntering]
        rw [List.destutter'_cons_pos _ enteringIsNext, tailDestutterFixed]
      rw [destutterEq, normalizeClosure_eq_self_of_nodup _ canonicalNodup]
      exact canonicalNodup
  · by_cases enteringIsNext : entering = vertex next
    · have canonicalNodup :
          (vertex zero :: leaving :: vertex next :: tail).Nodup := by
        simp [zeroIsLeaving, zeroNeNext, zeroNotMemTail, leavingNeNext,
          leavingNotMemTail, nextNotMemTail, tailNodup]
      have canonicalChain :
          (vertex zero :: leaving :: vertex next :: tail).IsChain (· ≠ ·) :=
        (canonicalNodup.pairwise_of_forall_ne
          fun _ _ _ _ distinct ↦ distinct).isChain
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) = vertex zero :: leaving :: vertex next :: tail := by
        rw [enteringIsNext]
        simp only [List.cons_append, List.nil_append]
        rw [List.destutter_cons_cons, if_pos zeroIsLeaving]
        rw [List.destutter'_cons_pos _ leavingNeNext]
        rw [List.destutter'_cons_neg _ (by simp), tailDestutterFixed]
      rw [destutterEq, normalizeClosure_eq_self_of_nodup _ canonicalNodup]
      exact canonicalNodup
    · have canonicalNodup :
          (vertex zero :: leaving :: entering :: vertex next :: tail).Nodup := by
        simp [zeroIsLeaving, zeroNeEntering, zeroNeNext, zeroNotMemTail, leavingNeEntering,
          leavingNeNext, leavingNotMemTail, enteringIsNext,
          enteringNotMemTail, nextNotMemTail, tailNodup]
      have canonicalChain :
          (vertex zero :: leaving :: entering :: vertex next :: tail).IsChain
              (· ≠ ·) :=
        (canonicalNodup.pairwise_of_forall_ne
          fun _ _ _ _ distinct ↦ distinct).isChain
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) =
            vertex zero :: leaving :: entering :: vertex next :: tail := by
        exact List.destutter_of_isChain (· ≠ ·) _ canonicalChain
      rw [destutterEq, normalizeClosure_eq_self_of_nodup _ canonicalNodup]
      exact canonicalNodup

/-- The duplicate classification above discharges the injectivity component
of the polygon-output residual certificate for every non-singleton-inside
mixed rotation. -/
theorem clipOutput_listVertex_injective_of_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing plane vertex).length) :
    Function.Injective
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) :=
  listVertex_injective_of_nodup lengthAtLeastThree
    (clipIndexedRing_nodup_of_rotatedBlock plane ordered countPositive
      countBound countNextBound outsideIff)

/-- A normalized mixed output with at least three vertices contains a
positive ordered triple.  Endpoint-on-boundary duplicates are handled
separately; in the only case where both crossings collapse to retained
endpoints, the length premise supplies the next strict source vertex. -/
theorem clipOutput_listVertex_hasPositiveTriple_of_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) {vertex : RingIndex extraVertices → Vec2 R}
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing plane vertex).length) :
    HasPositiveTriple
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) := by
  let zero : RingIndex extraVertices := ⟨0, by omega⟩
  let first : RingIndex extraVertices := ⟨1, by omega⟩
  let last : RingIndex extraVertices := ⟨count, countBound⟩
  let next : RingIndex extraVertices := ⟨count + 1, countNextBound⟩
  let leaving := boundaryPoint plane (vertex zero) (vertex first)
  let entering := boundaryPoint plane (vertex last) (vertex next)
  let tail := (retainedBlockVertices (count := count) vertex).tail
  have retainedEq := retainedBlockVertices_eq_cons
    (count := count) vertex countNextBound
  have retainedNodup := retainedBlockVertices_nodup_of_strict
    (count := count) ordered
  rw [retainedEq] at retainedNodup
  have nextTailNodup : (vertex next :: tail).Nodup := by
    simpa [next, tail] using retainedNodup
  have tailNodup : tail.Nodup := (List.nodup_cons.mp nextTailNodup).2
  have nextNotMemTail : vertex next ∉ tail :=
    (List.nodup_cons.mp nextTailNodup).1
  have nextTailChain : (vertex next :: tail).IsChain (· ≠ ·) :=
    (nextTailNodup.pairwise_of_forall_ne
      fun _ _ _ _ distinct ↦ distinct).isChain
  have tailDestutterFixed :
      tail.destutter' (· ≠ ·) (vertex next) = vertex next :: tail :=
    List.destutter'_of_isChain_cons tail (· ≠ ·) nextTailChain
  have zeroNotRetained := zero_not_mem_retainedBlockVertices_of_strict
    (count := count) ordered
  rw [retainedEq] at zeroNotRetained
  have zeroParts : vertex zero ≠ vertex next ∧ vertex zero ∉ tail := by
    simpa [zero, next, tail] using zeroNotRetained
  have leavingNotRetained := leavingBoundary_not_mem_retainedBlockVertices_of_strict
    (count := count) plane ordered countPositive
  rw [retainedEq] at leavingNotRetained
  have leavingParts : leaving ≠ vertex next ∧ leaving ∉ tail := by
    simpa [leaving, zero, first, next, tail] using leavingNotRetained
  have enteringNotMemTail : entering ∉ tail := by
    simpa [entering, last, next, tail] using
      enteringBoundary_not_mem_retainedBlockTail_of_strict
        (count := count) plane ordered countNextBound
  have zeroNeEntering : vertex zero ≠ entering := by
    simpa [zero, entering, last, next] using
      zero_ne_enteringBoundary_of_strict
        (count := count) plane ordered countPositive countNextBound
  have leavingNeEntering : leaving ≠ entering := by
    simpa [leaving, entering, zero, first, last, next] using
      leavingBoundary_ne_enteringBoundary_of_rotatedBlock
        plane ordered countPositive countBound countNextBound outsideIff
  have zeroInside : signedDistance plane (vertex zero) ≤ 0 := by
    apply le_of_not_gt
    intro outside
    have impossible := (outsideIff zero).mp outside
    simp [zero] at impossible
  have firstOutside : 0 < signedDistance plane (vertex first) := by
    apply (outsideIff first).mpr
    constructor
    · simp [first]
    · change 1 ≤ count
      omega
  have lastOutside : 0 < signedDistance plane (vertex last) := by
    apply (outsideIff last).mpr
    exact ⟨countPositive, le_rfl⟩
  have nextInside : signedDistance plane (vertex next) ≤ 0 := by
    apply le_of_not_gt
    intro outside
    have impossible := (outsideIff next).mp outside
    simp [next] at impossible
  let exitParameter := boundaryParameter
    (signedDistance plane (vertex zero))
    (signedDistance plane (vertex first))
  let entryParameter := boundaryParameter
    (signedDistance plane (vertex last))
    (signedDistance plane (vertex next))
  have exitBounds : exitParameter ∈ Set.Icc (0 : R) 1 :=
    boundaryParameter_mem_Icc_of_inside_outside zeroInside firstOutside
  have entryBounds : entryParameter ∈ Set.Icc (0 : R) 1 :=
    boundaryParameter_mem_Icc_of_outside_inside lastOutside nextInside
  have entryPositive : 0 < entryParameter :=
    boundaryParameter_pos_of_outside_inside lastOutside nextInside
  have exactOutput := clipIndexedRing_eq_normalized_rotatedBlock
    plane vertex countPositive countBound countNextBound outsideIff
  rw [retainedEq] at exactOutput
  change clipIndexedRing plane vertex = normalizeClosure
    (([vertex zero, leaving, entering, vertex next] ++ tail).destutter
      (· ≠ ·)) at exactOutput
  by_cases zeroIsLeaving : vertex zero = leaving
  · by_cases enteringIsNext : entering = vertex next
    · have canonicalNodup : (vertex zero :: vertex next :: tail).Nodup := by
        simp [zeroParts.1, zeroParts.2, nextNotMemTail, tailNodup]
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) = vertex zero :: vertex next :: tail := by
        rw [← zeroIsLeaving, enteringIsNext]
        simp only [List.cons_append, List.nil_append]
        rw [List.destutter_cons_cons, if_neg (by simp)]
        rw [List.destutter'_cons_pos _ zeroParts.1]
        rw [List.destutter'_cons_neg _ (by simp), tailDestutterFixed]
      have outputEq : clipIndexedRing plane vertex = vertex zero :: vertex next :: tail := by
        rw [exactOutput, destutterEq]
        exact normalizeClosure_eq_self_of_nodup _ canonicalNodup
      have tailNonempty : tail ≠ [] := by
        intro tailEmpty
        have impossible := lengthAtLeastThree
        rw [outputEq, tailEmpty] at impossible
        norm_num at impossible
      let third := tail.head tailNonempty
      let rest := tail.tail
      have tailEq : tail = third :: rest := by
        exact (List.cons_head_tail tailNonempty).symm
      have thirdMemberTail : third ∈ tail := by
        exact List.head_mem tailNonempty
      have thirdMember : third ∈
          retainedBlockVertices (count := count) vertex := by
        rw [retainedEq]
        exact List.mem_cons_of_mem _ thirdMemberTail
      rw [retainedBlockVertices, List.mem_ofFn'] at thirdMember
      rcases thirdMember with ⟨index, equalThird⟩
      have indexPositive : 0 < index.val := by
        apply Nat.pos_of_ne_zero
        intro indexZero
        have thirdIsNext : third = vertex next := by
          rw [← equalThird]
          apply congrArg vertex
          apply Fin.ext
          simp [next, indexZero]
        exact nextNotMemTail (thirdIsNext ▸ thirdMemberTail)
      let later : RingIndex extraVertices :=
        ⟨count + 1 + index.val, by omega⟩
      have positive : 0 < orientation (vertex zero) (vertex next) third := by
        have sourceTurn : 0 < orientation
            (vertex zero) (vertex next) (vertex later) := by
          apply ordered
          · simp [zero, next]
          · simp [next, later]
            omega
        simpa [later] using (equalThird ▸ sourceTurn)
      have prefixEq : clipIndexedRing plane vertex =
          vertex zero :: vertex next :: third :: rest := by
        rw [outputEq, tailEq]
      exact listVertex_hasPositiveTriple_of_prefix
        lengthAtLeastThree prefixEq positive
    · have entryBelowOne : entryParameter < 1 := by
        apply lt_of_le_of_ne entryBounds.2
        intro entryIsOne
        apply enteringIsNext
        simp [entering, boundaryPoint, entryParameter, entryIsOne]
      have sourceTurn : 0 < orientation (vertex zero) (vertex last) (vertex next) := by
        apply ordered
        · simp [zero, last]
          omega
        · simp [last, next]
      have positive : 0 < orientation (vertex zero) entering (vertex next) := by
        have identity : orientation (vertex zero) entering (vertex next) =
            (1 - entryParameter) *
              orientation (vertex zero) (vertex last) (vertex next) := by
          simp only [entering, boundaryPoint, entryParameter]
          exact orientation_interpolate_middle _ _ _ _
        rw [identity]
        exact mul_pos (sub_pos.mpr entryBelowOne) sourceTurn
      have canonicalNodup :
          (vertex zero :: entering :: vertex next :: tail).Nodup := by
        simp [zeroNeEntering, zeroParts.1, zeroParts.2, enteringIsNext,
          enteringNotMemTail, nextNotMemTail, tailNodup]
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) = vertex zero :: entering :: vertex next :: tail := by
        rw [← zeroIsLeaving]
        simp only [List.cons_append, List.nil_append]
        rw [List.destutter_cons_cons, if_neg (by simp)]
        rw [List.destutter'_cons_pos _ zeroNeEntering]
        rw [List.destutter'_cons_pos _ enteringIsNext, tailDestutterFixed]
      have outputEq :
          clipIndexedRing plane vertex = vertex zero :: entering :: vertex next :: tail := by
        rw [exactOutput, destutterEq]
        exact normalizeClosure_eq_self_of_nodup _ canonicalNodup
      exact listVertex_hasPositiveTriple_of_prefix
        lengthAtLeastThree outputEq positive
  · have exitPositive : 0 < exitParameter := by
      apply lt_of_le_of_ne exitBounds.1
      intro exitIsZero
      apply zeroIsLeaving
      have parameterZero : exitParameter = 0 := exitIsZero.symm
      simp [leaving, boundaryPoint, exitParameter, parameterZero]
    have firstToLastNonnegative :
        0 ≤ orientation (vertex zero) (vertex first) (vertex last) := by
      by_cases singletonOutside : count = 1
      · subst count
        simp [first, last]
      · apply le_of_lt
        apply ordered
        · simp [zero, first]
        · simp [first, last]
          omega
    have firstToNextPositive :
        0 < orientation (vertex zero) (vertex first) (vertex next) := by
      apply ordered
      · simp [zero, first]
      · simp [first, next]
        omega
    have positive : 0 < orientation (vertex zero) leaving entering := by
      have enteringIdentity : orientation (vertex zero) (vertex first) entering =
          (1 - entryParameter) *
              orientation (vertex zero) (vertex first) (vertex last) +
            entryParameter *
              orientation (vertex zero) (vertex first) (vertex next) := by
        simp only [entering, boundaryPoint, entryParameter]
        exact orientation_interpolate_third _ _ _ _ _
      have enteringTurnPositive :
          0 < orientation (vertex zero) (vertex first) entering := by
        rw [enteringIdentity]
        have firstTermNonnegative : 0 ≤ (1 - entryParameter) *
            orientation (vertex zero) (vertex first) (vertex last) :=
          mul_nonneg (sub_nonneg.mpr entryBounds.2) firstToLastNonnegative
        have secondTermPositive : 0 < entryParameter *
            orientation (vertex zero) (vertex first) (vertex next) :=
          mul_pos entryPositive firstToNextPositive
        linarith
      have leavingIdentity : orientation (vertex zero) leaving entering =
          exitParameter * orientation (vertex zero) (vertex first) entering := by
        simp only [leaving, boundaryPoint, exitParameter]
        rw [orientation_interpolate_second]
        simp
      rw [leavingIdentity]
      exact mul_pos exitPositive enteringTurnPositive
    by_cases enteringIsNext : entering = vertex next
    · have canonicalNodup :
          (vertex zero :: leaving :: vertex next :: tail).Nodup := by
        simp [zeroIsLeaving, zeroParts.1, zeroParts.2, leavingParts.1,
          leavingParts.2, nextNotMemTail, tailNodup]
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) = vertex zero :: leaving :: vertex next :: tail := by
        rw [enteringIsNext]
        simp only [List.cons_append, List.nil_append]
        rw [List.destutter_cons_cons, if_pos zeroIsLeaving]
        rw [List.destutter'_cons_pos _ leavingParts.1]
        rw [List.destutter'_cons_neg _ (by simp), tailDestutterFixed]
      have outputEq :
          clipIndexedRing plane vertex = vertex zero :: leaving :: vertex next :: tail := by
        rw [exactOutput, destutterEq]
        exact normalizeClosure_eq_self_of_nodup _ canonicalNodup
      apply listVertex_hasPositiveTriple_of_prefix lengthAtLeastThree outputEq
      simpa [enteringIsNext] using positive
    · have canonicalNodup :
          (vertex zero :: leaving :: entering :: vertex next :: tail).Nodup := by
        simp [zeroIsLeaving, zeroNeEntering, zeroParts.1, zeroParts.2,
          leavingNeEntering, leavingParts.1, leavingParts.2, enteringIsNext,
          enteringNotMemTail, nextNotMemTail, tailNodup]
      have canonicalChain :
          (vertex zero :: leaving :: entering :: vertex next :: tail).IsChain
              (· ≠ ·) :=
        (canonicalNodup.pairwise_of_forall_ne
          fun _ _ _ _ distinct ↦ distinct).isChain
      have destutterEq :
          ([vertex zero, leaving, entering, vertex next] ++ tail).destutter
              (· ≠ ·) =
            vertex zero :: leaving :: entering :: vertex next :: tail :=
        List.destutter_of_isChain (· ≠ ·) _ canonicalChain
      have outputEq : clipIndexedRing plane vertex =
          vertex zero :: leaving :: entering :: vertex next :: tail := by
        rw [exactOutput, destutterEq]
        exact normalizeClosure_eq_self_of_nodup _ canonicalNodup
      exact listVertex_hasPositiveTriple_of_prefix
        lengthAtLeastThree outputEq positive

/-- The singleton-retained rotation has the same exact executable shape, but
without a retained tail after the entering crossing. -/
theorem clipIndexedRing_eq_normalized_singletonInsideBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (countPositive : 0 < count)
    (countLast : count + 1 = extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    clipIndexedRing plane vertex =
      normalizeClosure
        ([vertex ⟨0, by omega⟩,
          boundaryPoint plane (vertex ⟨0, by omega⟩) (vertex ⟨1, by omega⟩),
          boundaryPoint plane (vertex ⟨count, by omega⟩)
            (vertex ⟨0, by omega⟩)].destutter (· ≠ ·)) := by
  rw [clipIndexedRing, closedClipOutputPoints, clipOutputPoints, joinDistinct]
  simp_rw [outputPoints_eq_destutter_ideal]
  have chunksEq :
      (indexedEdges vertex).map (fun edge ↦
        (idealOutputPoints plane edge.1 edge.2).destutter (· ≠ ·)) =
        (idealIndexedChunks plane vertex).map
          (fun chunk ↦ chunk.destutter (· ≠ ·)) := by
    rw [idealIndexedChunks, List.map_map]
    rfl
  rw [chunksEq]
  change normalizeClosure
      ((((idealIndexedChunks plane vertex).map
        fun chunk ↦ chunk.destutter (· ≠ ·)).flatten).destutter (· ≠ ·)) = _
  rw [idealIndexedChunks_eq_of_singleton_inside_block
    plane vertex countPositive countLast outsideIff]
  simp [canonicalChunkBlock]
  split
  · rename_i duplicateExit
    rw [← duplicateExit]
    simp only [List.singleton_append, List.destutter_cons_cons,
      List.destutter'_cons, not_true_eq_false, if_false]
  · rfl

/-- A mixed clip retaining exactly one source vertex is already fully
recertified whenever its normalized output is a polygon.  The length premise
forces the retained vertex to be strictly inside; the two boundary crossings
then form a positively oriented triangle with it. -/
theorem clipOutput_reclipCertified_of_singletonInsideBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countLast : count + 1 = extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing plane vertex).length) :
    IsReclipCertified
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) := by
  let zero : RingIndex extraVertices := ⟨0, by omega⟩
  let first : RingIndex extraVertices := ⟨1, by omega⟩
  let last : RingIndex extraVertices := ⟨count, by omega⟩
  have countAtLeastTwo : 2 ≤ count := by omega
  have zeroInside : signedDistance plane (vertex zero) ≤ 0 := by
    apply le_of_not_gt
    intro outside
    have impossible := (outsideIff zero).mp outside
    simp [zero] at impossible
  have firstOutside : 0 < signedDistance plane (vertex first) := by
    apply (outsideIff first).mpr
    simp [first]
    omega
  have lastOutside : 0 < signedDistance plane (vertex last) := by
    apply (outsideIff last).mpr
    constructor
    · simpa [last] using countPositive
    · rfl
  have zeroStrictInside : signedDistance plane (vertex zero) < 0 := by
    apply lt_of_le_of_ne zeroInside
    intro zeroDistance
    have zeroBoundary : signedDistance plane (vertex zero) = 0 := zeroDistance
    have exitEq : boundaryPoint plane (vertex zero) (vertex first) = vertex zero :=
      boundaryPoint_eq_current_of_current_boundary
        plane (vertex zero) (vertex first) zeroBoundary
    have entryEq : boundaryPoint plane (vertex last) (vertex zero) = vertex zero :=
      boundaryPoint_eq_next_of_next_boundary
        plane (vertex last) (vertex zero) (ne_of_gt lastOutside) zeroBoundary
    have outputSingleton : clipIndexedRing plane vertex = [vertex zero] := by
      rw [clipIndexedRing_eq_normalized_singletonInsideBlock
        plane vertex countPositive countLast outsideIff]
      change normalizeClosure
        (([vertex zero,
          boundaryPoint plane (vertex zero) (vertex first),
          boundaryPoint plane (vertex last) (vertex zero)] : List (Vec2 R)).destutter
            (· ≠ ·)) = _
      rw [exitEq, entryEq]
      have destutterEq :
          ([vertex zero, vertex zero, vertex zero] : List (Vec2 R)).destutter
              (· ≠ ·) = [vertex zero] := by
        rw [List.destutter_cons_cons]
        simp
      rw [destutterEq]
      exact normalizeClosure_singleton _
    rw [outputSingleton] at lengthAtLeastThree
    norm_num at lengthAtLeastThree
  let exitParameter := boundaryParameter
    (signedDistance plane (vertex zero))
    (signedDistance plane (vertex first))
  let entryParameter := boundaryParameter
    (signedDistance plane (vertex last))
    (signedDistance plane (vertex zero))
  let exit := boundaryPoint plane (vertex zero) (vertex first)
  let entry := boundaryPoint plane (vertex last) (vertex zero)
  have exitParameterPositive : 0 < exitParameter := by
    dsimp [exitParameter, boundaryParameter]
    have denominatorNegative :
        signedDistance plane (vertex zero) -
          signedDistance plane (vertex first) < 0 := by linarith
    exact div_pos_of_neg_of_neg zeroStrictInside denominatorNegative
  have entryParameterBelowOne : entryParameter < 1 := by
    dsimp [entryParameter, boundaryParameter]
    have denominatorPositive :
        0 < signedDistance plane (vertex last) -
          signedDistance plane (vertex zero) := by linarith
    rw [div_lt_iff₀ denominatorPositive]
    linarith
  have sourceTurn :
      0 < orientation (vertex zero) (vertex first) (vertex last) := by
    apply ordered
    · simp [zero, first]
    · simp [first, last]
      omega
  have outputTurn :
      0 < orientation (vertex zero) exit entry := by
    have identity :
        orientation (vertex zero) exit entry =
          exitParameter * (1 - entryParameter) *
            orientation (vertex zero) (vertex first) (vertex last) := by
      simp only [exit, entry, boundaryPoint, exitParameter, entryParameter]
      simp only [orientation, interpolatePoint]
      ring
    rw [identity]
    exact mul_pos (mul_pos exitParameterPositive
      (sub_pos.mpr entryParameterBelowOne)) sourceTurn
  have zeroNeExit : vertex zero ≠ exit :=
    strict_left_turn_start_ne_middle _ _ _ outputTurn
  have zeroNeEntry : vertex zero ≠ entry :=
    strict_left_turn_start_ne_end _ _ _ outputTurn
  have exitNeEntry : exit ≠ entry :=
    strict_left_turn_middle_ne_end _ _ _ outputTurn
  have canonicalNodup : ([vertex zero, exit, entry] : List (Vec2 R)).Nodup := by
    simp [zeroNeExit, zeroNeEntry, exitNeEntry]
  have canonicalChain :
      ([vertex zero, exit, entry] : List (Vec2 R)).IsChain (· ≠ ·) :=
    (canonicalNodup.pairwise_of_forall_ne
      fun _ _ _ _ distinct ↦ distinct).isChain
  have outputEq :
      clipIndexedRing plane vertex = [vertex zero, exit, entry] := by
    rw [clipIndexedRing_eq_normalized_singletonInsideBlock
      plane vertex countPositive countLast outsideIff]
    change normalizeClosure
      (([vertex zero, exit, entry] : List (Vec2 R)).destutter (· ≠ ·)) = _
    rw [List.destutter_of_isChain (· ≠ ·) _ canonicalChain]
    exact normalizeClosure_eq_self_of_nodup _ canonicalNodup
  have outputStrict : IsStrictVertexOrderedConvexCCW
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) := by
    intro firstIndex secondIndex thirdIndex firstBefore secondBefore
    have outputLength : (clipIndexedRing plane vertex).length = 3 := by
      rw [outputEq]
      simp
    have firstBound : firstIndex.val < 3 := by
      have bound := firstIndex.isLt
      simp [outputLength] at bound
      exact bound
    have secondBound : secondIndex.val < 3 := by
      have bound := secondIndex.isLt
      simp [outputLength] at bound
      exact bound
    have thirdBound : thirdIndex.val < 3 := by
      have bound := thirdIndex.isLt
      simp [outputLength] at bound
      exact bound
    have firstValue : firstIndex.val = 0 := by
      omega
    have secondValue : secondIndex.val = 1 := by
      omega
    have thirdValue : thirdIndex.val = 2 := by
      omega
    have firstEq : firstIndex = ⟨0, by
        rw [outputEq]
        simp⟩ := Fin.ext firstValue
    have secondEq : secondIndex = ⟨1, by
        rw [outputEq]
        simp⟩ := Fin.ext secondValue
    have thirdEq : thirdIndex = ⟨2, by
        rw [outputEq]
        simp⟩ := Fin.ext thirdValue
    rw [firstEq, secondEq, thirdEq]
    simpa [listVertex, outputEq] using outputTurn
  exact ReclipCertificate.IsStrictVertexOrderedConvexCCW.reclipCertified outputStrict

/-- Therefore the variable-length emitter is exhaustively classified in the
singleton-retained branch: a degenerate result remains a list of at most two
points, while every polygon result is immediately reusable by the next clip. -/
theorem clipOutputReclassification_of_singletonInsideBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count)
    (countLast : count + 1 = extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    OutputReclassification (clipIndexedRing plane vertex) := by
  apply clipOutputReclassification
  intro lengthAtLeastThree
  exact clipOutput_reclipCertified_of_singletonInsideBlock
    plane vertex ordered countPositive countLast outsideIff lengthAtLeastThree

/-- Every non-singleton-inside canonical mixed output with at least three
vertices is reclip-certified.  The emitter supplies weak global order, while
the exact materialization proofs above supply injectivity and full
dimensionality; the weak half-plane sign theorem supplies the final cyclic
block condition. -/
theorem clipOutput_reclipCertified_of_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count)
    (lengthAtLeastThree : 3 ≤ (clipIndexedRing plane vertex).length) :
    IsReclipCertified
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) := by
  have outputOrdered : IsLinearlyOrderedCCW
      (listVertex (clipIndexedRing plane vertex) lengthAtLeastThree) :=
    clipOutput_listVertex_linearlyOrdered
      plane vertex ordered.strict.weak lengthAtLeastThree
  exact ReclipCertificate.IsLinearlyOrderedCCW.reclipCertified_of_injective_fullDimensional
    outputOrdered
    (clipOutput_listVertex_injective_of_rotatedBlock
      plane ordered countPositive countBound countNextBound outsideIff
      lengthAtLeastThree)
    (clipOutput_listVertex_hasPositiveTriple_of_rotatedBlock
      plane ordered countPositive countBound countNextBound outsideIff
      lengthAtLeastThree)

/-- Therefore every non-singleton-inside canonical mixed output is
exhaustively reclassified as empty, point, segment, or a reusable polygon. -/
theorem clipOutputReclassification_of_rotatedBlock
    {extraVertices count : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (countPositive : 0 < count) (countBound : count < extraVertices + 3)
    (countNextBound : count + 1 < extraVertices + 3)
    (outsideIff : ∀ index,
      0 < signedDistance plane (vertex index) ↔
        0 < index.val ∧ index.val ≤ count) :
    OutputReclassification (clipIndexedRing plane vertex) := by
  apply clipOutputReclassification
  intro lengthAtLeastThree
  exact clipOutput_reclipCertified_of_rotatedBlock
    plane vertex ordered countPositive countBound countNextBound outsideIff
    lengthAtLeastThree

/-- Every mixed strict input admits a seam immediately before its outside
block whose executable output is exhaustively reclassified.  This is the
representation-level canonicalization theorem needed by an implementation
that is allowed to rotate the cyclic input before emitting the next ring. -/
theorem exists_rotation_clipOutputReclassification_of_mixed
    {extraVertices : Nat}
    (plane : HalfPlane R) (vertex : RingIndex extraVertices → Vec2 R)
    (ordered : IsStrictVertexOrderedConvexCCW vertex)
    (hasOutside : ∃ index, 0 < signedDistance plane (vertex index))
    (hasInside : ∃ index, signedDistance plane (vertex index) ≤ 0) :
    ∃ start : RingIndex extraVertices,
      OutputReclassification
        (clipIndexedRing plane (rotateVertex start vertex)) := by
  rcases outside_rotatedBlock plane vertex ordered hasOutside hasInside with
    ⟨_, start, count, countPositive, countBound, blockIff⟩
  let rotated := rotateVertex start vertex
  have rotatedOrdered : IsStrictVertexOrderedConvexCCW rotated :=
    ordered.strict.rotateVertex start
  have rotatedOutsideIff : ∀ index,
      0 < signedDistance plane (rotated index) ↔
        0 < index.val ∧ index.val ≤ count := by
    intro index
    simpa [rotated, rotateVertex] using blockIff index
  refine ⟨start, ?_⟩
  by_cases countNextBound : count + 1 < extraVertices + 3
  · exact clipOutputReclassification_of_rotatedBlock
      plane rotated rotatedOrdered countPositive countBound countNextBound
      rotatedOutsideIff
  · have countLast : count + 1 = extraVertices + 3 := by omega
    exact clipOutputReclassification_of_singletonInsideBlock
      plane rotated rotatedOrdered countPositive countLast rotatedOutsideIff

end Sprawlens.ClipOutputRecertification
