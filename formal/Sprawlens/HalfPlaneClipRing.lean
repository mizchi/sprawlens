import Sprawlens.CyclicClosure
import Sprawlens.HalfPlaneClipPoints

namespace Sprawlens.HalfPlaneClipRing

open ExactGeometry
open HalfPlaneClipFold
open HalfPlaneClipPoints
open CyclicClosure
open OrderedTriples

universe u

variable {R : Type u} [Field R] [LinearOrder R] [IsStrictOrderedRing R]

/-- Fold exact point outputs from all cyclic input edges, removing adjacent duplicates. -/
def clipOutputPoints (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) : List (Vec2 R) :=
  joinDistinct (edges.map fun edge => outputPoints plane edge.1 edge.2)

omit [IsStrictOrderedRing R] in
theorem outputPointFlatten_eq_nil_of_each_empty
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (eachEmpty : ∀ edge ∈ edges, outputPoints plane edge.1 edge.2 = []) :
    (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten = [] := by
  induction edges with
  | nil => rfl
  | cons edge rest inductionHypothesis =>
      rw [List.map_cons, List.flatten_cons, eachEmpty edge (by simp),
        inductionHypothesis (fun later member => eachEmpty later (by simp [member]))]
      rfl

omit [IsStrictOrderedRing R] in
theorem outputPointFlatten_boundary_pairs_of_strict_crossings
    (plane : HalfPlane R)
    (enteringCurrent enteringNext following leavingCurrent leavingNext : Vec2 R)
    (remainingEdges restEdges beforeLeaving trailingEdges : List (Vec2 R × Vec2 R))
    (remainingStarts :
      remainingEdges = (enteringNext, following) :: restEdges)
    (remainingContainsLeaving :
      remainingEdges = beforeLeaving ++
        ((leavingCurrent, leavingNext) :: trailingEdges))
    (trailingEmpty : ∀ edge ∈ trailingEdges,
      outputPoints plane edge.1 edge.2 = [])
    (enteringCurrentOutside : 0 < signedDistance plane enteringCurrent)
    (enteringNextInside : signedDistance plane enteringNext < 0)
    (leavingCurrentInside : signedDistance plane leavingCurrent < 0)
    (leavingNextOutside : 0 < signedDistance plane leavingNext) :
    List.IsPrefix
        [boundaryPoint plane enteringCurrent enteringNext, enteringNext]
        (((enteringCurrent, enteringNext) :: remainingEdges).map fun edge =>
          outputPoints plane edge.1 edge.2).flatten ∧
      List.IsSuffix
        [leavingCurrent, boundaryPoint plane leavingCurrent leavingNext]
        (((enteringCurrent, enteringNext) :: remainingEdges).map fun edge =>
          outputPoints plane edge.1 edge.2).flatten := by
  have enteringOutput := outputPoints_eq_singleton_of_strict_entering
    plane enteringCurrent enteringNext enteringCurrentOutside enteringNextInside
  obtain ⟨followingOutput, firstRemainingOutput⟩ :=
    outputPoints_cons_of_current_strictly_inside
      plane enteringNext following enteringNextInside
  have leavingOutput := outputPoints_eq_pair_of_strict_leaving
    plane leavingCurrent leavingNext leavingCurrentInside leavingNextOutside
  have trailingFlattenEmpty := outputPointFlatten_eq_nil_of_each_empty
    plane trailingEdges trailingEmpty
  constructor
  · rw [remainingStarts]
    simp only [List.map_cons, List.flatten_cons]
    rw [enteringOutput, firstRemainingOutput]
    simp
  · rw [remainingContainsLeaving]
    simp only [List.map_cons, List.map_append,
      List.flatten_cons, List.flatten_append]
    rw [leavingOutput, trailingFlattenEmpty]
    rw [List.suffix_iff_exists_eq_append]
    refine ⟨outputPoints plane enteringCurrent enteringNext ++
      (beforeLeaving.map fun edge => outputPoints plane edge.1 edge.2).flatten, ?_⟩
    simp [List.append_assoc]

omit [IsStrictOrderedRing R] in
theorem clipOutputPoints_isChain
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) :
    (clipOutputPoints plane edges).IsChain (· ≠ ·) := by
  exact joinDistinct_isChain _

theorem clipOutputPoints_nonpos
    (plane : HalfPlane R) {edges : List (Vec2 R × Vec2 R)} {point : Vec2 R}
    (emitted : point ∈ clipOutputPoints plane edges) : signedDistance plane point ≤ 0 := by
  have flattened := mem_flatten_of_mem_joinDistinct emitted
  simp only [List.mem_flatten, List.mem_map] at flattened
  obtain ⟨output, ⟨edge, edgeMember, rfl⟩, pointMember⟩ := flattened
  exact outputPoints_nonpos plane edge.1 edge.2 point pointMember

theorem clipOutputPoints_on_input_edge
    (plane : HalfPlane R) {edges : List (Vec2 R × Vec2 R)} {point : Vec2 R}
    (emitted : point ∈ clipOutputPoints plane edges) :
    ∃ edge ∈ edges, OnClosedSegment edge.1 edge.2 point := by
  have flattened := mem_flatten_of_mem_joinDistinct emitted
  simp only [List.mem_flatten, List.mem_map] at flattened
  obtain ⟨output, ⟨edge, edgeMember, rfl⟩, pointMember⟩ := flattened
  exact ⟨edge, edgeMember, outputPoints_onClosedSegment plane edge.1 edge.2 point pointMember⟩

omit [IsStrictOrderedRing R] in
theorem clipOutputPoints_allOrderedCCW
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (ordered : AllOrderedCCW
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten) :
    AllOrderedCCW (clipOutputPoints plane edges) := by
  exact joinDistinct_allOrderedCCW ordered

/-- Normalize the explicit closing duplicate used by an open-ring representation. -/
def closedClipOutputPoints
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) : List (Vec2 R) :=
  normalizeClosure (clipOutputPoints plane edges)

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_closureNormalized
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) :
    ClosureNormalized (closedClipOutputPoints plane edges) := by
  exact normalizeClosure_closureNormalized_of_isChain _
    (clipOutputPoints_isChain plane edges)

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_isChain
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R)) :
    (closedClipOutputPoints plane edges).IsChain (· ≠ ·) := by
  exact normalizeClosure_isChain (clipOutputPoints_isChain plane edges)

theorem closedClipOutputPoints_nonpos
    (plane : HalfPlane R) {edges : List (Vec2 R × Vec2 R)} {point : Vec2 R}
    (emitted : point ∈ closedClipOutputPoints plane edges) : signedDistance plane point ≤ 0 := by
  apply clipOutputPoints_nonpos plane
  exact mem_original_of_mem_normalizeClosure emitted

theorem closedClipOutputPoints_on_input_edge
    (plane : HalfPlane R) {edges : List (Vec2 R × Vec2 R)} {point : Vec2 R}
    (emitted : point ∈ closedClipOutputPoints plane edges) :
    ∃ edge ∈ edges, OnClosedSegment edge.1 edge.2 point := by
  apply clipOutputPoints_on_input_edge plane
  exact mem_original_of_mem_normalizeClosure emitted

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_prefix_pair
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (first second : Vec2 R) (rest : List (Vec2 R))
    (flattened :
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten =
        first :: second :: rest)
    (distinct : first ≠ second) :
    List.IsPrefix [first, second] (closedClipOutputPoints plane edges) := by
  apply normalizeClosure_prefix_pair
  · exact joinDistinct_prefix_pair first second rest flattened distinct
  · exact distinct

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_boundary_pairs_of_flatten
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (first second penultimate last : Vec2 R)
    (flattenedPrefix : List.IsPrefix [first, second]
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten)
    (flattenedSuffix : List.IsSuffix [penultimate, last]
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten)
    (firstPairDistinct : first ≠ second)
    (lastPairDistinct : penultimate ≠ last)
    (endpointsDistinct : first ≠ last) :
    List.IsPrefix [first, second] (closedClipOutputPoints plane edges) ∧
      List.IsSuffix [penultimate, last] (closedClipOutputPoints plane edges) := by
  apply normalizeClosure_boundary_pairs first second penultimate last
  · exact joinDistinct_prefix_pair_of_prefix first second
      flattenedPrefix firstPairDistinct
  · exact joinDistinct_suffix_pair_of_suffix penultimate last
      flattenedSuffix lastPairDistinct
  · exact endpointsDistinct

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_boundary_pairs
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (first second penultimate last : Vec2 R)
    (afterPrefix beforeSuffix : List (Vec2 R))
    (flattenedPrefix :
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten =
        first :: second :: afterPrefix)
    (flattenedSuffix :
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten =
        beforeSuffix ++ [penultimate, last])
    (firstPairDistinct : first ≠ second)
    (lastPairDistinct : penultimate ≠ last)
    (endpointsDistinct : first ≠ last) :
    List.IsPrefix [first, second] (closedClipOutputPoints plane edges) ∧
      List.IsSuffix [penultimate, last] (closedClipOutputPoints plane edges) := by
  apply closedClipOutputPoints_boundary_pairs_of_flatten
    plane edges first second penultimate last
  · rw [List.prefix_iff_exists_eq_append]
    exact ⟨afterPrefix, flattenedPrefix⟩
  · rw [List.suffix_iff_exists_eq_append]
    exact ⟨beforeSuffix, flattenedSuffix⟩
  · exact firstPairDistinct
  · exact lastPairDistinct
  · exact endpointsDistinct

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_cyclicTurnsNonnegative
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (ordered : AllOrderedCCW
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten) :
    CyclicTurnsNonnegative (closedClipOutputPoints plane edges) := by
  exact (normalizeClosure_allOrderedCCW
    (clipOutputPoints_allOrderedCCW plane edges ordered)).cyclic

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_adjacentTurnsNonnegative
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (ordered : AllOrderedCCW
      (edges.map fun edge => outputPoints plane edge.1 edge.2).flatten) :
    AdjacentTurnsNonnegative (closedClipOutputPoints plane edges) := by
  exact (closedClipOutputPoints_cyclicTurnsNonnegative plane edges ordered).1

omit [IsStrictOrderedRing R] in
theorem closedClipOutputPoints_adjacentTurnsNonnegative_of_orderedChunks
    (plane : HalfPlane R) (edges : List (Vec2 R × Vec2 R))
    (ordered : AllOrderedCCWChunks
      (edges.map fun edge => outputPoints plane edge.1 edge.2)) :
    AdjacentTurnsNonnegative (closedClipOutputPoints plane edges) := by
  exact closedClipOutputPoints_adjacentTurnsNonnegative plane edges ordered.flatten

/-- Witness that distance-only folding is too coarse for ring geometry. -/
def boundaryEdgeWitnessPlane : HalfPlane Rat where
  normalX := 1
  normalY := 0
  offset := 0

def boundaryEdgeWitnessEdges : List (Vec2 Rat × Vec2 Rat) :=
  [
    ({ x := -1, y := -1 }, { x := 1, y := -1 }),
    ({ x := 1, y := -1 }, { x := 1, y := 1 }),
    ({ x := 1, y := 1 }, { x := -1, y := 1 }),
    ({ x := -1, y := 1 }, { x := -1, y := -1 })
  ]

theorem point_fold_retains_distinct_boundary_vertices :
    clipOutputPoints boundaryEdgeWitnessPlane boundaryEdgeWitnessEdges =
      [{ x := -1, y := -1 }, { x := 0, y := -1 },
        { x := 0, y := 1 }, { x := -1, y := 1 }] := by
  native_decide

theorem distance_fold_collapses_the_boundary_edge :
    clipOutputDistances [(-1, 1), (1, 1), (1, -1), (-1, -1)] =
      ([-1, 0, -1] : List Rat) := by
  native_decide

end Sprawlens.HalfPlaneClipRing
