import Mathlib.Data.Set.Basic

namespace Sprawlens.LayoutNoninterference

universe u v

/-- A layout is modeled extensionally as the cell assigned to each stable ID. -/
abbrev Layout (Id : Type u) (Cell : Type v) := Id → Cell

/-- A local repair is an explicit finite-or-infinite pointwise patch. `none`
means that the existing cell is framed through unchanged. -/
abbrev Patch (Id : Type u) (Cell : Type v) := Id → Option Cell

def applyPatch {Id : Type u} {Cell : Type v}
    (patch : Patch Id Cell) (layout : Layout Id Cell) : Layout Id Cell :=
  fun id => (patch id).getD (layout id)

def SupportedIn {Id : Type u} {Cell : Type v}
    (patch : Patch Id Cell) (affected : Set Id) : Prop :=
  ∀ id, id ∉ affected → patch id = none

/-- Frame rule: applying a patch cannot alter any cell outside its declared
affected set. -/
theorem applyPatch_eq_outside_of_supported
    {Id : Type u} {Cell : Type v}
    (patch : Patch Id Cell) (layout : Layout Id Cell) (affected : Set Id)
    (supported : SupportedIn patch affected)
    (id : Id) (outside : id ∉ affected) :
    applyPatch patch layout id = layout id := by
  simp [applyPatch, supported id outside]

def composePatch {Id : Type u} {Cell : Type v}
    (first second : Patch Id Cell) : Patch Id Cell :=
  fun id => match second id with
    | some cell => some cell
    | none => first id

theorem applyPatch_compose
    {Id : Type u} {Cell : Type v}
    (first second : Patch Id Cell) (layout : Layout Id Cell) :
    applyPatch (composePatch first second) layout =
      applyPatch second (applyPatch first layout) := by
  funext id
  simp only [applyPatch, composePatch]
  cases second id <;> rfl

/-- Sequential local repairs remain supported inside the union of their
declared affected sets. -/
theorem composePatch_supported_union
    {Id : Type u} {Cell : Type v}
    (first second : Patch Id Cell) (firstAffected secondAffected : Set Id)
    (firstSupported : SupportedIn first firstAffected)
    (secondSupported : SupportedIn second secondAffected) :
    SupportedIn (composePatch first second) (firstAffected ∪ secondAffected) := by
  intro id outside
  simp only [Set.mem_union, not_or] at outside
  simp [composePatch, firstSupported id outside.1, secondSupported id outside.2]

/-- Two patches have disjoint writes when no ID receives values from both. -/
def DisjointWrites {Id : Type u} {Cell : Type v}
    (first second : Patch Id Cell) : Prop :=
  ∀ id, first id = none ∨ second id = none

/-- Independently generated disjoint patches commute when applied. This theorem
does not claim that a state-dependent patch generator is itself local. -/
theorem applyPatch_commute_of_disjoint
    {Id : Type u} {Cell : Type v}
    (first second : Patch Id Cell) (layout : Layout Id Cell)
    (disjoint : DisjointWrites first second) :
    applyPatch second (applyPatch first layout) =
      applyPatch first (applyPatch second layout) := by
  funext id
  rcases disjoint id with firstNone | secondNone
  · simp [applyPatch, firstNone]
  · simp [applyPatch, secondNone]

/-- A state-dependent patch generator is stable under another patch when its
output does not change after that patch is applied. This is the explicit read
footprint obligation missing from write support alone. -/
def GeneratorStableUnder {Id : Type u} {Cell : Type v}
    (generator : Layout Id Cell → Patch Id Cell) (patch : Patch Id Cell) : Prop :=
  ∀ layout, generator (applyPatch patch layout) = generator layout

/-- Disjoint writes commute even when patches are regenerated between steps,
provided each generator is stable under the other generated patch. -/
theorem generatedPatches_commute
    {Id : Type u} {Cell : Type v}
    (firstGenerator secondGenerator : Layout Id Cell → Patch Id Cell)
    (layout : Layout Id Cell)
    (firstStable : firstGenerator
      (applyPatch (secondGenerator layout) layout) = firstGenerator layout)
    (secondStable : secondGenerator
      (applyPatch (firstGenerator layout) layout) = secondGenerator layout)
    (disjoint : DisjointWrites
      (firstGenerator layout) (secondGenerator layout)) :
    applyPatch
        (secondGenerator (applyPatch (firstGenerator layout) layout))
        (applyPatch (firstGenerator layout) layout) =
      applyPatch
        (firstGenerator (applyPatch (secondGenerator layout) layout))
        (applyPatch (secondGenerator layout) layout) := by
  rw [firstStable, secondStable]
  exact applyPatch_commute_of_disjoint
    (firstGenerator layout) (secondGenerator layout) layout disjoint

end Sprawlens.LayoutNoninterference
