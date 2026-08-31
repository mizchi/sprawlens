import Sprawlens.LayoutNoninterference

namespace Sprawlens.HierarchyNoninterference

open LayoutNoninterference

universe u v

/-- One upward hierarchy step from a child to its declared parent. -/
def ParentStep {Id : Type u} (parent : Id → Option Id) (child ancestor : Id) : Prop :=
  parent child = some ancestor

/-- Reflexive ancestor relation: a node is its own ancestor. -/
def IsAncestor {Id : Type u} (parent : Id → Option Id)
    (ancestor node : Id) : Prop :=
  Relation.ReflTransGen (ParentStep parent) node ancestor

/-- All changed nodes and every ancestor reachable through the parent map. -/
def ancestorClosure {Id : Type u}
    (parent : Id → Option Id) (changed : Set Id) : Set Id :=
  { ancestor | ∃ node ∈ changed, IsAncestor parent ancestor node }

theorem changed_subset_ancestorClosure
    {Id : Type u} (parent : Id → Option Id) (changed : Set Id) :
    changed ⊆ ancestorClosure parent changed := by
  intro node changedNode
  exact ⟨node, changedNode, Relation.ReflTransGen.refl⟩

theorem ancestorClosure_mono
    {Id : Type u} (parent : Id → Option Id) {first second : Set Id}
    (subset : first ⊆ second) :
    ancestorClosure parent first ⊆ ancestorClosure parent second := by
  rintro ancestor ⟨node, changedNode, path⟩
  exact ⟨node, subset changedNode, path⟩

/-- Once a node is affected, its direct parent is also in the ancestor closure. -/
theorem parent_mem_ancestorClosure
    {Id : Type u} (parent : Id → Option Id) (changed : Set Id)
    {node directParent : Id}
    (nodeAffected : node ∈ ancestorClosure parent changed)
    (parentEq : parent node = some directParent) :
    directParent ∈ ancestorClosure parent changed := by
  rcases nodeAffected with ⟨changedNode, changedMem, path⟩
  exact ⟨changedNode, changedMem,
    path.trans (Relation.ReflTransGen.single parentEq)⟩

/-- Hierarchical frame rule: a patch supported on changed nodes and their
ancestors leaves every other cell exactly unchanged. -/
theorem hierarchyPatch_eq_outside_ancestorClosure
    {Id : Type u} {Cell : Type v}
    (parent : Id → Option Id) (changed : Set Id)
    (patch : Patch Id Cell) (layout : Layout Id Cell)
    (supported : SupportedIn patch (ancestorClosure parent changed))
    (id : Id) (outside : id ∉ ancestorClosure parent changed) :
    applyPatch patch layout id = layout id := by
  exact applyPatch_eq_outside_of_supported
    patch layout (ancestorClosure parent changed) supported id outside

/-- A domain-readable sufficient condition for disjoint affected regions. -/
def DisjointAffected {Id : Type u} (first second : Set Id) : Prop :=
  ∀ id, id ∈ first → id ∉ second

theorem supportedPatches_disjointWrites
    {Id : Type u} {Cell : Type v}
    (first second : Patch Id Cell) (firstAffected secondAffected : Set Id)
    (firstSupported : SupportedIn first firstAffected)
    (secondSupported : SupportedIn second secondAffected)
    (affectedDisjoint : DisjointAffected firstAffected secondAffected) :
    DisjointWrites first second := by
  intro id
  by_cases inFirst : id ∈ firstAffected
  · exact Or.inr (secondSupported id (affectedDisjoint id inFirst))
  · exact Or.inl (firstSupported id inFirst)

/-- Patches for disjoint ancestor closures commute. -/
theorem hierarchyPatches_commute
    {Id : Type u} {Cell : Type v}
    (parent : Id → Option Id) (firstChanged secondChanged : Set Id)
    (first second : Patch Id Cell) (layout : Layout Id Cell)
    (firstSupported : SupportedIn first (ancestorClosure parent firstChanged))
    (secondSupported : SupportedIn second (ancestorClosure parent secondChanged))
    (closuresDisjoint : DisjointAffected
      (ancestorClosure parent firstChanged) (ancestorClosure parent secondChanged)) :
    applyPatch second (applyPatch first layout) =
      applyPatch first (applyPatch second layout) := by
  exact applyPatch_commute_of_disjoint first second layout
    (supportedPatches_disjointWrites first second
      (ancestorClosure parent firstChanged) (ancestorClosure parent secondChanged)
      firstSupported secondSupported closuresDisjoint)

end Sprawlens.HierarchyNoninterference
