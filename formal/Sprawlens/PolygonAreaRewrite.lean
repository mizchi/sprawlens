import Mathlib.Order.Interval.Set.Basic
import Mathlib.Data.List.Destutter
import Mathlib.Data.List.Triplewise
import Sprawlens.CyclicClosure
import Sprawlens.PolygonArea

namespace Sprawlens.PolygonAreaRewrite

open ExactGeometry
open HalfPlaneIntersection
open PolygonArea
open CyclicClosure

universe u

variable {R : Type u} [Field R]

/-- Shoelace edge sum for an open vertex path. -/
def pathEdgeCrossSum : List (Vec2 R) → R
  | first :: second :: rest =>
      edgeCross first second + pathEdgeCrossSum (second :: rest)
  | _ => 0

/-- Shoelace sum for a materialized cyclic vertex list. -/
def closedEdgeCrossSum : List (Vec2 R) → R
  | [] => 0
  | first :: rest =>
      pathEdgeCrossSum (first :: rest) +
        edgeCross ((first :: rest).getLast (by simp)) first

theorem pathEdgeCrossSum_append_singleton
    (first last : Vec2 R) (rest : List (Vec2 R)) :
    pathEdgeCrossSum ((first :: rest) ++ [last]) =
      pathEdgeCrossSum (first :: rest) +
        edgeCross ((first :: rest).getLast (by simp)) last := by
  induction rest generalizing first with
  | nil => simp [pathEdgeCrossSum]
  | cons second rest inductionHypothesis =>
      simp only [List.cons_append, pathEdgeCrossSum]
      have appended := inductionHypothesis second
      simp only [List.cons_append] at appended
      rw [appended]
      simp
      ring

/-- Moving the first materialized vertex to the end preserves cyclic shoelace area. -/
theorem closedEdgeCrossSum_rotate_one
    (first : Vec2 R) (rest : List (Vec2 R)) :
    closedEdgeCrossSum (first :: rest) =
      closedEdgeCrossSum (rest ++ [first]) := by
  cases rest with
  | nil => simp [closedEdgeCrossSum, pathEdgeCrossSum]
  | cons second rest =>
      rw [closedEdgeCrossSum]
      rw [List.cons_append, closedEdgeCrossSum]
      have appended := pathEdgeCrossSum_append_singleton second first rest
      simp only [List.cons_append] at appended
      rw [appended]
      simp only [pathEdgeCrossSum]
      simp
      ring

theorem closedEdgeCrossSum_rotate
    (points : List (Vec2 R)) (amount : Nat) :
    closedEdgeCrossSum (points.rotate amount) = closedEdgeCrossSum points := by
  induction amount generalizing points with
  | zero => simp
  | succ amount inductionHypothesis =>
      cases points with
      | nil => simp [closedEdgeCrossSum]
      | cons first rest =>
          rw [List.rotate_cons_succ]
          calc
            closedEdgeCrossSum ((rest ++ [first]).rotate amount) =
                closedEdgeCrossSum (rest ++ [first]) :=
              inductionHypothesis (rest ++ [first])
    _ = closedEdgeCrossSum (first :: rest) :=
      (closedEdgeCrossSum_rotate_one first rest).symm

/-- Cyclic shoelace area is invariant under exchanging a prefix and suffix. -/
theorem closedEdgeCrossSum_append_comm
    (left right : List (Vec2 R)) :
    closedEdgeCrossSum (left ++ right) =
      closedEdgeCrossSum (right ++ left) := by
  calc
    closedEdgeCrossSum (left ++ right) =
        closedEdgeCrossSum ((left ++ right).rotate left.length) :=
      (closedEdgeCrossSum_rotate _ left.length).symm
    _ = closedEdgeCrossSum (right ++ left) := by
      rw [List.rotate_append_length_eq]

/-- Rotating a list of variable-length chunks preserves the area of its flattening. -/
theorem closedEdgeCrossSum_flatten_rotate
    (chunks : List (List (Vec2 R))) (amount : Nat) :
    closedEdgeCrossSum (chunks.rotate amount).flatten =
      closedEdgeCrossSum chunks.flatten := by
  rw [List.rotate_eq_drop_append_take_mod, List.flatten_append]
  calc
    closedEdgeCrossSum
        ((chunks.drop (amount % chunks.length)).flatten ++
          (chunks.take (amount % chunks.length)).flatten) =
        closedEdgeCrossSum
          ((chunks.take (amount % chunks.length)).flatten ++
            (chunks.drop (amount % chunks.length)).flatten) :=
      closedEdgeCrossSum_append_comm _ _
    _ = closedEdgeCrossSum
        ((chunks.take (amount % chunks.length) ++
          chunks.drop (amount % chunks.length)).flatten) := by
      rw [List.flatten_append]
    _ = closedEdgeCrossSum chunks.flatten := by
      rw [List.take_append_drop]

/-- Repeating the first vertex explicitly at the end does not change cyclic area. -/
theorem closedEdgeCrossSum_append_head
    (first : Vec2 R) (rest : List (Vec2 R)) :
    closedEdgeCrossSum ((first :: rest) ++ [first]) =
      closedEdgeCrossSum (first :: rest) := by
  cases rest with
  | nil => simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]
  | cons second rest =>
      simp only [List.cons_append]
      rw [closedEdgeCrossSum, closedEdgeCrossSum]
      have appended := pathEdgeCrossSum_append_singleton
        first first (second :: rest)
      simp only [List.cons_append] at appended
      rw [appended]
      simp [edgeCross]

/-- Removing an adjacent duplicate at the materialized head preserves cyclic area. -/
theorem closedEdgeCrossSum_duplicate_head
    (point : Vec2 R) (rest : List (Vec2 R)) :
    closedEdgeCrossSum (point :: point :: rest) =
      closedEdgeCrossSum (point :: rest) := by
  cases rest with
  | nil => simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]
  | cons next rest =>
      simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]

/-- Removing an adjacent duplicate anywhere in a cyclic materialization preserves area. -/
theorem closedEdgeCrossSum_erase_adjacent_duplicate
    (front : List (Vec2 R)) (point : Vec2 R) (suffix : List (Vec2 R)) :
    closedEdgeCrossSum (front ++ point :: point :: suffix) =
      closedEdgeCrossSum (front ++ point :: suffix) := by
  calc
    closedEdgeCrossSum (front ++ point :: point :: suffix) =
        closedEdgeCrossSum ((front ++ point :: point :: suffix).rotate front.length) :=
      (closedEdgeCrossSum_rotate _ front.length).symm
    _ = closedEdgeCrossSum (point :: point :: (suffix ++ front)) := by
      rw [List.rotate_append_length_eq]
      simp
    _ = closedEdgeCrossSum (point :: (suffix ++ front)) :=
      closedEdgeCrossSum_duplicate_head point (suffix ++ front)
    _ = closedEdgeCrossSum ((front ++ point :: suffix).rotate front.length) := by
      rw [List.rotate_append_length_eq]
      simp
    _ = closedEdgeCrossSum (front ++ point :: suffix) :=
      closedEdgeCrossSum_rotate _ front.length

theorem closedEdgeCrossSum_destutter'_ne
    [DecidableEq R] (front : List (Vec2 R)) (current : Vec2 R) :
    ∀ rest : List (Vec2 R),
      closedEdgeCrossSum
          (front ++ rest.destutter' (· ≠ ·) current) =
        closedEdgeCrossSum (front ++ current :: rest)
  | [] => by simp
  | next :: rest => by
      rw [List.destutter'_cons]
      by_cases distinct : current ≠ next
      · rw [if_pos distinct]
        calc
          closedEdgeCrossSum
              (front ++ current :: rest.destutter' (· ≠ ·) next) =
              closedEdgeCrossSum
                ((front ++ [current]) ++ rest.destutter' (· ≠ ·) next) := by
            congr 1
            simp
          _ = closedEdgeCrossSum ((front ++ [current]) ++ next :: rest) :=
            closedEdgeCrossSum_destutter'_ne (front ++ [current]) next rest
          _ = closedEdgeCrossSum (front ++ current :: next :: rest) := by
            congr 1
            simp
      · have equal : next = current := (not_ne_iff.mp distinct).symm
        subst next
        rw [if_neg (by simp)]
        calc
          closedEdgeCrossSum
              (front ++ rest.destutter' (· ≠ ·) current) =
              closedEdgeCrossSum (front ++ current :: rest) :=
            closedEdgeCrossSum_destutter'_ne front current rest
          _ = closedEdgeCrossSum (front ++ current :: current :: rest) :=
            (closedEdgeCrossSum_erase_adjacent_duplicate
              front current rest).symm

/-- `destutter (· ≠ ·)` only removes zero-length edges and preserves shoelace area. -/
theorem closedEdgeCrossSum_destutter_ne [DecidableEq R]
    (points : List (Vec2 R)) :
    closedEdgeCrossSum (points.destutter (· ≠ ·)) =
      closedEdgeCrossSum points := by
  cases points with
  | nil => rfl
  | cons first rest =>
      exact closedEdgeCrossSum_destutter'_ne [] first rest

theorem closedEdgeCrossSum_destutter'_ne_between [DecidableEq R]
    (front : List (Vec2 R)) (current : Vec2 R) :
    ∀ (rest back : List (Vec2 R)),
      closedEdgeCrossSum
          (front ++ rest.destutter' (· ≠ ·) current ++ back) =
        closedEdgeCrossSum (front ++ current :: rest ++ back)
  | [], back => by simp
  | next :: rest, back => by
      rw [List.destutter'_cons]
      by_cases distinct : current ≠ next
      · rw [if_pos distinct]
        calc
          closedEdgeCrossSum
              (front ++ current :: rest.destutter' (· ≠ ·) next ++ back) =
              closedEdgeCrossSum
                ((front ++ [current]) ++
                  rest.destutter' (· ≠ ·) next ++ back) := by
            congr 1
            simp
          _ = closedEdgeCrossSum
              ((front ++ [current]) ++ next :: rest ++ back) :=
            closedEdgeCrossSum_destutter'_ne_between
              (front ++ [current]) next rest back
          _ = closedEdgeCrossSum (front ++ current :: next :: rest ++ back) := by
            congr 1
            simp
      · have equal : next = current := (not_ne_iff.mp distinct).symm
        subst next
        rw [if_neg (by simp)]
        calc
          closedEdgeCrossSum
              (front ++ rest.destutter' (· ≠ ·) current ++ back) =
              closedEdgeCrossSum (front ++ current :: rest ++ back) :=
            closedEdgeCrossSum_destutter'_ne_between front current rest back
          _ = closedEdgeCrossSum (front ++ current :: current :: rest ++ back) := by
            simpa [List.append_assoc] using
              (closedEdgeCrossSum_erase_adjacent_duplicate
                front current (rest ++ back)).symm

theorem closedEdgeCrossSum_destutter_ne_between [DecidableEq R]
    (front points back : List (Vec2 R)) :
    closedEdgeCrossSum (front ++ points.destutter (· ≠ ·) ++ back) =
      closedEdgeCrossSum (front ++ points ++ back) := by
  cases points with
  | nil => simp
  | cons first rest =>
      exact closedEdgeCrossSum_destutter'_ne_between front first rest back

/-- Destuttering each emitted chunk independently preserves the flattened cyclic area. -/
theorem closedEdgeCrossSum_flatten_map_destutter_ne [DecidableEq R]
    (chunks : List (List (Vec2 R))) :
    closedEdgeCrossSum
        ((chunks.map fun chunk => chunk.destutter (· ≠ ·)).flatten) =
      closedEdgeCrossSum chunks.flatten := by
  have generalized : ∀ (front : List (Vec2 R))
      (remaining : List (List (Vec2 R))),
      closedEdgeCrossSum
          (front ++
            (remaining.map fun chunk => chunk.destutter (· ≠ ·)).flatten) =
        closedEdgeCrossSum (front ++ remaining.flatten) := by
    intro front remaining
    induction remaining generalizing front with
    | nil => simp
    | cons chunk rest inductionHypothesis =>
        simp only [List.map_cons, List.flatten_cons, ← List.append_assoc]
        calc
          closedEdgeCrossSum
              (front ++ chunk.destutter (· ≠ ·) ++
                (rest.map fun later => later.destutter (· ≠ ·)).flatten) =
              closedEdgeCrossSum
                (front ++ chunk ++
                  (rest.map fun later => later.destutter (· ≠ ·)).flatten) :=
            closedEdgeCrossSum_destutter_ne_between front chunk _
          _ = closedEdgeCrossSum (front ++ chunk ++ rest.flatten) :=
            inductionHypothesis (front ++ chunk)
  simpa using generalized [] chunks

/-- Removing an explicit closing duplicate preserves shoelace area. -/
theorem closedEdgeCrossSum_normalizeClosure [DecidableEq R]
    (points : List (Vec2 R)) :
    closedEdgeCrossSum (normalizeClosure points) = closedEdgeCrossSum points := by
  cases points with
  | nil => rfl
  | cons first rest =>
      cases rest with
      | nil => rfl
      | cons second rest =>
          by_cases closing :
              (first :: second :: rest).getLast? = some first
          · rw [normalizeClosure_eq_dropLast_of_closing first second rest closing]
            have firstInLast : first ∈ (first :: second :: rest).getLast? := by
              simpa using closing
            have rebuild := List.dropLast_append_getLast? first firstInLast
            calc
              closedEdgeCrossSum (first :: second :: rest).dropLast =
                  closedEdgeCrossSum (first :: (second :: rest).dropLast) := by
                simp
              _ = closedEdgeCrossSum
                  ((first :: (second :: rest).dropLast) ++ [first]) :=
                (closedEdgeCrossSum_append_head
                  first (second :: rest).dropLast).symm
              _ = closedEdgeCrossSum (first :: second :: rest) := by
                rw [← rebuild]
                simp
          · rw [normalizeClosure_eq_self_of_open first second rest closing]

@[simp]
theorem closedEdgeCrossSum_triangle (a b c : Vec2 R) :
    closedEdgeCrossSum [a, b, c] = triangleSignedTwiceArea a b c := by
  simp [closedEdgeCrossSum, pathEdgeCrossSum, triangleSignedTwiceArea]

theorem closedEdgeCrossSum_eq_zero_of_length_le_two
    (points : List (Vec2 R)) (lengthBound : points.length ≤ 2) :
    closedEdgeCrossSum points = 0 := by
  cases points with
  | nil => rfl
  | cons first rest =>
      cases rest with
      | nil => simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]
      | cons second rest =>
          have restEmpty : rest = [] := by
            cases rest <;> simp_all
          subst rest
          simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]

/-- Replacing one corner by points on its incident edges removes exactly one triangle. -/
theorem pathEdgeCrossSum_interpolate_corner
    (a b c : Vec2 R) (startParameter finishParameter : R)
    (tail : List (Vec2 R)) :
    let entry := interpolatePoint a b startParameter
    let exit := interpolatePoint b c finishParameter
    pathEdgeCrossSum (a :: entry :: exit :: c :: tail) =
      pathEdgeCrossSum (a :: b :: c :: tail) -
        triangleSignedTwiceArea entry b exit := by
  dsimp only
  simp only [pathEdgeCrossSum]
  simp only [edgeCross, interpolatePoint, triangleSignedTwiceArea]
  ring

/-- The same corner identity after adding the unchanged cyclic closing edge. -/
theorem closedEdgeCrossSum_interpolate_corner
    (a b c : Vec2 R) (startParameter finishParameter : R)
    (tail : List (Vec2 R)) :
    let entry := interpolatePoint a b startParameter
    let exit := interpolatePoint b c finishParameter
    closedEdgeCrossSum (a :: entry :: exit :: c :: tail) =
      closedEdgeCrossSum (a :: b :: c :: tail) -
        triangleSignedTwiceArea entry b exit := by
  dsimp only
  rw [closedEdgeCrossSum, closedEdgeCrossSum]
  rw [pathEdgeCrossSum_interpolate_corner]
  simp
  ring

theorem pathEdgeCrossSum_interpolate_corner_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {startParameter finishParameter : R}
    (startAtMostOne : startParameter ≤ 1)
    (finishNonnegative : 0 ≤ finishParameter)
    (turnNonnegative : 0 ≤ orientation a b c)
    (tail : List (Vec2 R)) :
    let entry := interpolatePoint a b startParameter
    let exit := interpolatePoint b c finishParameter
    pathEdgeCrossSum (a :: entry :: exit :: c :: tail) ≤
      pathEdgeCrossSum (a :: b :: c :: tail) := by
  dsimp only
  rw [pathEdgeCrossSum_interpolate_corner]
  have removedNonnegative :
      0 ≤ triangleSignedTwiceArea
        (interpolatePoint a b startParameter) b
        (interpolatePoint b c finishParameter) := by
    rw [triangleSignedTwiceArea_interpolate_both]
    exact mul_nonneg
      (mul_nonneg (sub_nonneg.mpr startAtMostOne) finishNonnegative)
      (by simpa [triangleSignedTwiceArea_eq_orientation] using turnNonnegative)
  linarith

/-- The geometric segment-membership form used by a clipping proof. -/
theorem pathEdgeCrossSum_interpolate_corner_le_of_mem_Icc
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {startParameter finishParameter : R}
    (startInSegment : startParameter ∈ Set.Icc (0 : R) 1)
    (finishInSegment : finishParameter ∈ Set.Icc (0 : R) 1)
    (turnNonnegative : 0 ≤ orientation a b c)
    (tail : List (Vec2 R)) :
    let entry := interpolatePoint a b startParameter
    let exit := interpolatePoint b c finishParameter
    pathEdgeCrossSum (a :: entry :: exit :: c :: tail) ≤
      pathEdgeCrossSum (a :: b :: c :: tail) := by
  exact pathEdgeCrossSum_interpolate_corner_le a b c
    startInSegment.2 finishInSegment.1 turnNonnegative tail

theorem closedEdgeCrossSum_interpolate_corner_le_of_mem_Icc
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R) {startParameter finishParameter : R}
    (startInSegment : startParameter ∈ Set.Icc (0 : R) 1)
    (finishInSegment : finishParameter ∈ Set.Icc (0 : R) 1)
    (turnNonnegative : 0 ≤ orientation a b c)
    (tail : List (Vec2 R)) :
    let entry := interpolatePoint a b startParameter
    let exit := interpolatePoint b c finishParameter
    closedEdgeCrossSum (a :: entry :: exit :: c :: tail) ≤
      closedEdgeCrossSum (a :: b :: c :: tail) := by
  dsimp only
  rw [closedEdgeCrossSum_interpolate_corner]
  have removedNonnegative :
      0 ≤ triangleSignedTwiceArea
        (interpolatePoint a b startParameter) b
        (interpolatePoint b c finishParameter) := by
    rw [triangleSignedTwiceArea_interpolate_both]
    exact mul_nonneg
      (mul_nonneg (sub_nonneg.mpr startInSegment.2) finishInSegment.1)
      (by simpa [triangleSignedTwiceArea_eq_orientation] using turnNonnegative)
  linarith

/-- Deleting one materialized corner removes exactly its signed ear area. -/
theorem closedEdgeCrossSum_delete_corner
    (a b c : Vec2 R) (tail : List (Vec2 R)) :
    closedEdgeCrossSum (a :: c :: tail) =
      closedEdgeCrossSum (a :: b :: c :: tail) -
        triangleSignedTwiceArea a b c := by
  rw [closedEdgeCrossSum, closedEdgeCrossSum]
  simp only [pathEdgeCrossSum]
  simp
  simp only [triangleSignedTwiceArea, edgeCross]
  ring

theorem closedEdgeCrossSum_delete_corner_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (a b c : Vec2 R)
    (turnNonnegative : 0 ≤ orientation a b c)
    (tail : List (Vec2 R)) :
    closedEdgeCrossSum (a :: c :: tail) ≤
      closedEdgeCrossSum (a :: b :: c :: tail) := by
  rw [closedEdgeCrossSum_delete_corner]
  rw [triangleSignedTwiceArea_eq_orientation]
  linarith

theorem closedEdgeCrossSum_nonnegative_of_triplewise
    [LinearOrder R] [IsStrictOrderedRing R]
    (points : List (Vec2 R))
    (ordered : points.Triplewise
      (fun first second third => 0 ≤ orientation first second third)) :
    0 ≤ closedEdgeCrossSum points := by
  cases points with
  | nil => simp [closedEdgeCrossSum]
  | cons first rest =>
      cases rest with
      | nil => simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]
      | cons second rest =>
          cases rest with
          | nil =>
              simp [closedEdgeCrossSum, pathEdgeCrossSum, edgeCross]
          | cons third tail =>
              have afterFirst := List.triplewise_cons.mp ordered
              have afterSecond := List.triplewise_cons.mp afterFirst.2
              have smallerOrdered :
                  (first :: third :: tail).Triplewise
                    (fun a b c => 0 ≤ orientation a b c) :=
                List.triplewise_cons.mpr
                  ⟨(List.pairwise_cons.mp afterFirst.1).2, afterSecond.2⟩
              have smallerNonnegative :=
                closedEdgeCrossSum_nonnegative_of_triplewise
                  (first :: third :: tail) smallerOrdered
              exact smallerNonnegative.trans
                (closedEdgeCrossSum_delete_corner_le
                  first second third
                  ((List.pairwise_cons.mp afterFirst.1).1 third (by simp)) tail)
termination_by points.length

/-- The fan turns needed to delete a contiguous chain between fixed endpoints. -/
def FanTurnsNonnegative [LinearOrder R]
    (a c : Vec2 R) : List (Vec2 R) → Prop
  | [] => True
  | [b] => 0 ≤ orientation a b c
  | b :: d :: rest =>
      0 ≤ orientation a b d ∧ FanTurnsNonnegative a c (d :: rest)

theorem fanTurnsNonnegative_of_triplewise
    [LinearOrder R]
    (a c : Vec2 R) (removed : List (Vec2 R))
    (ordered : (a :: (removed ++ [c])).Triplewise
      (fun first second third => 0 ≤ orientation first second third)) :
    FanTurnsNonnegative a c removed := by
  induction removed with
  | nil => simp [FanTurnsNonnegative]
  | cons b rest inductionHypothesis =>
      cases rest with
      | nil => simpa [FanTurnsNonnegative] using ordered
      | cons d rest =>
          have afterA := (List.triplewise_cons.mp ordered)
          have pairwiseAfterB := (List.pairwise_cons.mp afterA.1)
          have afterB := (List.triplewise_cons.mp afterA.2)
          constructor
          · exact pairwiseAfterB.1 d (by simp)
          · apply inductionHypothesis
            exact List.triplewise_cons.mpr ⟨pairwiseAfterB.2, afterB.2⟩

theorem closedEdgeCrossSum_delete_chain_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (a c : Vec2 R) (removed tail : List (Vec2 R))
    (fanTurns : FanTurnsNonnegative a c removed) :
    closedEdgeCrossSum (a :: c :: tail) ≤
      closedEdgeCrossSum (a :: (removed ++ c :: tail)) := by
  induction removed with
  | nil => simp
  | cons b rest inductionHypothesis =>
      cases rest with
      | nil =>
          simpa [FanTurnsNonnegative] using
            closedEdgeCrossSum_delete_corner_le a b c fanTurns tail
      | cons d rest =>
          have remainingTurns : FanTurnsNonnegative a c (d :: rest) :=
            fanTurns.2
          have removeRemaining :
              closedEdgeCrossSum (a :: c :: tail) ≤
                closedEdgeCrossSum (a :: ((d :: rest) ++ c :: tail)) :=
            inductionHypothesis remainingTurns
          have removeFirst :
              closedEdgeCrossSum (a :: ((d :: rest) ++ c :: tail)) ≤
                closedEdgeCrossSum (a :: b :: d :: (rest ++ c :: tail)) := by
            simpa only [List.cons_append] using
              closedEdgeCrossSum_delete_corner_le
                a b d fanTurns.1 (rest ++ c :: tail)
          exact removeRemaining.trans (by simpa only [List.cons_append] using removeFirst)

theorem closedEdgeCrossSum_delete_chain_le_of_triplewise
    [LinearOrder R] [IsStrictOrderedRing R]
    (a c : Vec2 R) (removed tail : List (Vec2 R))
    (ordered : (a :: (removed ++ [c])).Triplewise
      (fun first second third => 0 ≤ orientation first second third)) :
    closedEdgeCrossSum (a :: c :: tail) ≤
      closedEdgeCrossSum (a :: (removed ++ c :: tail)) := by
  exact closedEdgeCrossSum_delete_chain_le a c removed tail
    (fanTurnsNonnegative_of_triplewise a c removed ordered)

/-- Delete a chain after a fixed leading vertex by rotating the cyclic list once. -/
theorem closedEdgeCrossSum_delete_middle_chain_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (leading a c : Vec2 R) (removed suffix : List (Vec2 R))
    (ordered : (a :: (removed ++ [c])).Triplewise
      (fun first second third => 0 ≤ orientation first second third)) :
    closedEdgeCrossSum (leading :: a :: c :: suffix) ≤
      closedEdgeCrossSum (leading :: a :: (removed ++ c :: suffix)) := by
  calc
    closedEdgeCrossSum (leading :: a :: c :: suffix) =
        closedEdgeCrossSum ((a :: c :: suffix) ++ [leading]) :=
      closedEdgeCrossSum_rotate_one leading (a :: c :: suffix)
    _ ≤ closedEdgeCrossSum
        (a :: (removed ++ c :: (suffix ++ [leading]))) := by
      exact closedEdgeCrossSum_delete_chain_le_of_triplewise
        a c removed (suffix ++ [leading]) ordered
    _ = closedEdgeCrossSum
        ((a :: (removed ++ c :: suffix)) ++ [leading]) := by
      congr 1
      simp [List.append_assoc]
    _ = closedEdgeCrossSum (leading :: a :: (removed ++ c :: suffix)) :=
      (closedEdgeCrossSum_rotate_one
        leading (a :: (removed ++ c :: suffix))).symm

/-- Replacing the two outside endpoints of a cut chain by its boundary intersections. -/
theorem closedEdgeCrossSum_two_boundary_replacement_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (insideLast outsideFirst outsideLast insideFirst : Vec2 R)
    {exitParameter entryParameter : R}
    (exitInSegment : exitParameter ∈ Set.Icc (0 : R) 1)
    (entryInSegment : entryParameter ∈ Set.Icc (0 : R) 1)
    (firstTurn : 0 ≤ orientation insideLast outsideFirst outsideLast)
    (middleTurn : 0 ≤ orientation insideLast outsideLast insideFirst)
    (lastTurn : 0 ≤ orientation outsideFirst outsideLast insideFirst)
    (tail : List (Vec2 R)) :
    let exit := interpolatePoint insideLast outsideFirst exitParameter
    let entry := interpolatePoint outsideLast insideFirst entryParameter
    closedEdgeCrossSum (insideLast :: exit :: entry :: insideFirst :: tail) ≤
      closedEdgeCrossSum
        (insideLast :: outsideFirst :: outsideLast :: insideFirst :: tail) := by
  dsimp only
  let exit := interpolatePoint insideLast outsideFirst exitParameter
  let entry := interpolatePoint outsideLast insideFirst entryParameter
  have firstRemovedNonnegative :
      0 ≤ orientation exit outsideFirst outsideLast := by
    dsimp [exit]
    exact HalfPlaneIntersection.orientation_interpolate_start_nonneg
      insideLast outsideFirst outsideLast exitInSegment.2 firstTurn
  have exitToInsideNonnegative :
      0 ≤ orientation exit outsideLast insideFirst := by
    dsimp [exit]
    exact HalfPlaneIntersection.orientation_interpolate_first_nonneg
      insideLast outsideFirst outsideLast insideFirst
      exitInSegment.1 exitInSegment.2 middleTurn lastTurn
  have secondRemovedNonnegative :
      0 ≤ orientation exit outsideLast entry := by
    dsimp [entry]
    exact HalfPlaneIntersection.orientation_interpolate_finish_nonneg
      exit outsideLast insideFirst entryInSegment.1 exitToInsideNonnegative
  have areaIdentity :
      closedEdgeCrossSum (insideLast :: exit :: entry :: insideFirst :: tail) =
        closedEdgeCrossSum
          (insideLast :: outsideFirst :: outsideLast :: insideFirst :: tail) -
          orientation exit outsideFirst outsideLast -
          orientation exit outsideLast entry := by
    rw [closedEdgeCrossSum, closedEdgeCrossSum]
    simp only [pathEdgeCrossSum]
    simp
    simp only [edgeCross, orientation]
    dsimp [exit, entry, interpolatePoint]
    ring
  rw [areaIdentity]
  linarith

/-- Canonical mixed clip: remove an outside chain, then replace its two endpoints. -/
theorem closedEdgeCrossSum_canonical_clip_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (insideLast outsideFirst outsideLast insideFirst : Vec2 R)
    (outsideMiddle insideTail : List (Vec2 R))
    {exitParameter entryParameter : R}
    (outsideOrdered :
      (outsideFirst :: (outsideMiddle ++ [outsideLast])).Triplewise
        (fun first second third => 0 ≤ orientation first second third))
    (exitInSegment : exitParameter ∈ Set.Icc (0 : R) 1)
    (entryInSegment : entryParameter ∈ Set.Icc (0 : R) 1)
    (firstTurn : 0 ≤ orientation insideLast outsideFirst outsideLast)
    (middleTurn : 0 ≤ orientation insideLast outsideLast insideFirst)
    (lastTurn : 0 ≤ orientation outsideFirst outsideLast insideFirst) :
    let exit := interpolatePoint insideLast outsideFirst exitParameter
    let entry := interpolatePoint outsideLast insideFirst entryParameter
    closedEdgeCrossSum (insideLast :: exit :: entry :: insideFirst :: insideTail) ≤
      closedEdgeCrossSum
        (insideLast :: outsideFirst ::
          (outsideMiddle ++ outsideLast :: insideFirst :: insideTail)) := by
  dsimp only
  exact (closedEdgeCrossSum_two_boundary_replacement_le
    insideLast outsideFirst outsideLast insideFirst
    exitInSegment entryInSegment firstTurn middleTurn lastTurn insideTail).trans
      (closedEdgeCrossSum_delete_middle_chain_le
        insideLast outsideFirst outsideLast outsideMiddle
        (insideFirst :: insideTail) outsideOrdered)

/-- Canonical clip when the retained input block consists of one vertex. -/
theorem closedEdgeCrossSum_singleton_inside_clip_le
    [LinearOrder R] [IsStrictOrderedRing R]
    (inside outsideFirst outsideLast : Vec2 R)
    (outsideMiddle : List (Vec2 R))
    {exitParameter entryParameter : R}
    (outsideOrdered :
      (outsideFirst :: (outsideMiddle ++ [outsideLast])).Triplewise
        (fun first second third => 0 ≤ orientation first second third))
    (exitInSegment : exitParameter ∈ Set.Icc (0 : R) 1)
    (entryInSegment : entryParameter ∈ Set.Icc (0 : R) 1)
    (firstTurn : 0 ≤ orientation inside outsideFirst outsideLast)
    (middleTurn : 0 ≤ orientation inside outsideLast inside)
    (lastTurn : 0 ≤ orientation outsideFirst outsideLast inside) :
    let exit := interpolatePoint inside outsideFirst exitParameter
    let entry := interpolatePoint outsideLast inside entryParameter
    closedEdgeCrossSum [inside, exit, entry] ≤
      closedEdgeCrossSum (inside :: outsideFirst :: (outsideMiddle ++ [outsideLast])) := by
  dsimp only
  calc
    closedEdgeCrossSum [inside,
        interpolatePoint inside outsideFirst exitParameter,
        interpolatePoint outsideLast inside entryParameter] =
        closedEdgeCrossSum ([inside,
          interpolatePoint inside outsideFirst exitParameter,
          interpolatePoint outsideLast inside entryParameter] ++ [inside]) :=
      (closedEdgeCrossSum_append_head inside
        [interpolatePoint inside outsideFirst exitParameter,
          interpolatePoint outsideLast inside entryParameter]).symm
    _ ≤ closedEdgeCrossSum
        ([inside, outsideFirst] ++ outsideMiddle ++ [outsideLast, inside]) := by
      simpa only [List.cons_append, List.nil_append, List.append_assoc] using
        closedEdgeCrossSum_canonical_clip_le
          inside outsideFirst outsideLast inside outsideMiddle []
          outsideOrdered exitInSegment entryInSegment
          firstTurn middleTurn lastTurn
    _ = closedEdgeCrossSum
        ((inside :: outsideFirst :: (outsideMiddle ++ [outsideLast])) ++ [inside]) := by
      congr 1
      simp [List.append_assoc]
    _ = closedEdgeCrossSum
        (inside :: outsideFirst :: (outsideMiddle ++ [outsideLast])) :=
      closedEdgeCrossSum_append_head inside
        (outsideFirst :: (outsideMiddle ++ [outsideLast]))

end Sprawlens.PolygonAreaRewrite
