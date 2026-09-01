import Mathlib.Data.List.Rotate
import Sprawlens.CyclicClosure

namespace Sprawlens.CyclicDestutter

open CyclicClosure

universe u

/-- Remove linear adjacent duplicates and then remove the duplicate created
by representing a cyclic run at both ends of the list. -/
def cyclicDestutter {α : Type u} [DecidableEq α] (values : List α) : List α :=
  normalizeClosure (values.destutter (· ≠ ·))

theorem getLast?_cons_of_ne_nil
    {α : Type u} (first : α) {rest : List α} (nonempty : rest ≠ []) :
    (first :: rest).getLast? = rest.getLast? := by
  cases rest with
  | nil => exact (nonempty rfl).elim
  | cons next tail => simp

theorem destutter'_append_singleton
    {α : Type u} [DecidableEq α] (value : α) :
    ∀ (rest : List α) (last : α),
      (rest ++ [last]).destutter' (· ≠ ·) value =
        let compressed := rest.destutter' (· ≠ ·) value
        if compressed.getLast? = some last then compressed
        else compressed ++ [last]
  | [], last => by
      by_cases distinct : value ≠ last <;> simp [distinct]
  | next :: rest, last => by
      rw [List.cons_append, List.destutter'_cons]
      by_cases distinct : value ≠ next
      · rw [if_pos distinct, destutter'_append_singleton next rest last]
        have step : (next :: rest).destutter' (· ≠ ·) value =
            value :: rest.destutter' (· ≠ ·) next := by
          rw [List.destutter'_cons, if_pos distinct]
        rw [step]
        let compressed := rest.destutter' (· ≠ ·) next
        have compressedNonempty : compressed ≠ [] :=
          List.destutter'_ne_nil (l := rest) (R := (· ≠ ·)) (a := next)
        have lastEq : (value :: compressed).getLast? = compressed.getLast? :=
          getLast?_cons_of_ne_nil value compressedNonempty
        change value ::
            (if compressed.getLast? = some last then compressed
            else compressed ++ [last]) =
          if (value :: compressed).getLast? = some last then
            value :: compressed
          else (value :: compressed) ++ [last]
        rw [lastEq]
        by_cases closing : compressed.getLast? = some last <;>
          simp [closing]
      · have equal : value = next := not_ne_iff.mp distinct
        subst next
        simp [destutter'_append_singleton]

/-- Appending one value either extends the compressed chain or merges it
with its last run. -/
theorem destutter_append_singleton
    {α : Type u} [DecidableEq α] (values : List α) (last : α) :
    (values ++ [last]).destutter (· ≠ ·) =
      match values.destutter (· ≠ ·) with
      | [] => [last]
      | compressed =>
          if compressed.getLast? = some last then compressed
          else compressed ++ [last] := by
  cases values with
  | nil => simp
  | cons first rest =>
      have nonempty : rest.destutter' (· ≠ ·) first ≠ [] :=
        List.destutter'_ne_nil (l := rest) (R := (· ≠ ·)) (a := first)
      cases compressedEq : rest.destutter' (· ≠ ·) first with
      | nil => exact (nonempty compressedEq).elim
      | cons head tail =>
          simpa [List.destutter_cons', compressedEq] using
            destutter'_append_singleton first rest last

/-- Moving the first raw value across the materialization seam changes the
cyclically destuttered result by at most a list rotation. -/
theorem cyclicDestutter_cons_append_singleton
    {α : Type u} [DecidableEq α] (first : α) (rest : List α) :
    cyclicDestutter (first :: rest) ~r
      cyclicDestutter (rest ++ [first]) := by
  cases rest with
  | nil => simp [cyclicDestutter]
  | cons next tail =>
      rcases HalfPlaneClipFold.destutter'_starts_with
          (· ≠ ·) next tail with ⟨compressedTail, startsWith⟩
      have compressedEq :
          (next :: tail).destutter (· ≠ ·) = next :: compressedTail := by
        simpa [List.destutter_cons'] using startsWith
      rw [cyclicDestutter, cyclicDestutter,
        destutter_append_singleton, compressedEq]
      by_cases same : first = next
      · subst next
        simp only [List.destutter_cons_cons, ne_eq, not_true_eq_false,
          if_false, startsWith]
        cases compressedTail with
        | nil => simp
        | cons second remaining =>
            by_cases closing :
                (first :: second :: remaining).getLast? = some first
            · rw [if_pos closing]
            · rw [if_neg closing]
              rw [normalizeClosure_eq_self_of_open
                first second remaining closing]
              have targetEq :
                  normalizeClosure
                    ((first :: second :: remaining) ++ [first]) =
                    first :: second :: remaining := by
                rw [List.cons_append, List.cons_append]
                rw [normalizeClosure_eq_dropLast_of_closing
                  first second (remaining ++ [first])]
                · rw [List.dropLast_cons_cons]
                  change first ::
                    ((second :: remaining) ++ [first]).dropLast =
                      first :: second :: remaining
                  rw [List.dropLast_concat]
                · rw [List.getLast?_eq_getLast_of_ne_nil (by simp)]
                  simp
              rw [targetEq]
      · have distinct : first ≠ next := same
        simp only [List.destutter_cons_cons]
        rw [if_pos distinct, startsWith]
        by_cases closing :
            (next :: compressedTail).getLast? = some first
        · rw [if_pos closing]
          cases compressedTail with
          | nil =>
              simp at closing
              exact (distinct closing.symm).elim
          | cons second remaining =>
              have sourceClosing :
                  (first :: next :: second :: remaining).getLast? =
                    some first := by
                rw [getLast?_cons_of_ne_nil first (by simp)]
                exact closing
              rw [normalizeClosure_eq_dropLast_of_closing
                first next (second :: remaining) sourceClosing]
              have targetOpen :
                  (next :: second :: remaining).getLast? ≠ some next := by
                intro targetClosing
                rw [closing] at targetClosing
                exact distinct (Option.some.inj targetClosing)
              rw [normalizeClosure_eq_self_of_open
                next second remaining targetOpen]
              have nonempty : next :: second :: remaining ≠ [] := by simp
              have lastValue :
                  (next :: second :: remaining).getLast nonempty = first := by
                rw [List.getLast?_eq_getLast_of_ne_nil nonempty] at closing
                exact Option.some.inj closing
              have rotated := List.IsRotated.cons_getLast_dropLast
                (next :: second :: remaining) nonempty
              rw [lastValue] at rotated
              simpa using rotated
        · rw [if_neg closing]
          have sourceOpen :
              (first :: next :: compressedTail).getLast? ≠ some first := by
            rw [getLast?_cons_of_ne_nil first (by simp)]
            exact closing
          rw [normalizeClosure_eq_self_of_open
            first next compressedTail sourceOpen]
          have targetOpen :
              ((next :: compressedTail) ++ [first]).getLast? ≠ some next := by
            rw [List.getLast?_append_of_ne_nil (next :: compressedTail)
              (by simp)]
            simpa using distinct
          cases compressedTail with
          | nil =>
              change [first, next] ~r normalizeClosure [next, first]
              rw [normalizeClosure_eq_self_of_open next first []]
              · exact List.IsRotated.cons_append_singleton
              · simpa using targetOpen
          | cons second remaining =>
              change first :: next :: second :: remaining ~r
                normalizeClosure (next :: second :: (remaining ++ [first]))
              rw [normalizeClosure_eq_self_of_open
                next second (remaining ++ [first])]
              · exact List.IsRotated.cons_append_singleton
              · simpa using targetOpen

/-- Cyclic destuttering is equivariant under every list rotation. -/
theorem cyclicDestutter_rotate
    {α : Type u} [DecidableEq α] (values : List α) :
    ∀ count : Nat,
      cyclicDestutter (values.rotate count) ~r cyclicDestutter values
  | 0 => by
      rw [List.rotate_zero]
  | count + 1 => by
      rw [← List.rotate_rotate]
      exact (cyclicDestutter_cons_append_singleton_of_rotate_one
        (values.rotate count)).trans (cyclicDestutter_rotate values count)

where
  cyclicDestutter_cons_append_singleton_of_rotate_one
      {α : Type u} [DecidableEq α] (values : List α) :
      cyclicDestutter (values.rotate 1) ~r cyclicDestutter values := by
    cases values with
    | nil => simp [cyclicDestutter]
    | cons first rest =>
        simpa using (cyclicDestutter_cons_append_singleton first rest).symm

/-- Cyclic destuttering depends only on the cyclic list represented by its
input, not on the selected seam. -/
theorem IsRotated.cyclicDestutter
    {α : Type u} [DecidableEq α] {first second : List α}
    (rotated : first ~r second) :
    cyclicDestutter first ~r cyclicDestutter second := by
  rcases rotated with ⟨count, rfl⟩
  exact (cyclicDestutter_rotate first count).symm

/-- Rotating a list of chunks rotates its flattened value stream by the
total size of the chunks moved across the seam. -/
theorem flatten_rotate_isRotated
    {α : Type u} (chunks : List (List α)) (count : Nat) :
    (chunks.rotate count).flatten ~r chunks.flatten := by
  rw [List.rotate_eq_drop_append_take_mod]
  simp only [List.flatten_append]
  let cut := count % chunks.length
  have split :
      (chunks.take cut).flatten ++ (chunks.drop cut).flatten =
        chunks.flatten := by
    rw [← List.flatten_append, List.take_append_drop]
  rw [← split]
  exact List.isRotated_append.symm

/-- Flattening preserves cyclic equivalence even when chunks have different
lengths. -/
theorem IsRotated.flatten
    {α : Type u} {first second : List (List α)}
    (rotated : first ~r second) : first.flatten ~r second.flatten := by
  rcases rotated with ⟨count, rfl⟩
  exact (flatten_rotate_isRotated first count).symm

/-- The normalized flattened stream is therefore independent of the seam
chosen between chunks. -/
theorem IsRotated.cyclicDestutter_flatten
    {α : Type u} [DecidableEq α] {first second : List (List α)}
    (rotated : first ~r second) :
    Sprawlens.CyclicDestutter.cyclicDestutter first.flatten ~r
      Sprawlens.CyclicDestutter.cyclicDestutter second.flatten :=
  IsRotated.cyclicDestutter (IsRotated.flatten rotated)

end Sprawlens.CyclicDestutter
