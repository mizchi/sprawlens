namespace Sprawlens.ControlledPaths

universe u v w

/-- The discrete graph state used by controlled paths. List order is observable. -/
structure Node (Id : Type u) (Weight : Type v) where
  id : Id
  weight : Weight
  deriving Repr

structure Edge (Id : Type u) where
  source : Id
  target : Id
  deriving Repr

structure Graph (Id : Type u) (Weight : Type v) where
  nodes : List (Node Id Weight)
  edges : List (Edge Id)
  deriving Repr

structure Path (GraphState : Type w) where
  initial : GraphState
  middle : GraphState
  final : GraphState

variable {Id : Type u} {Weight : Type v}

private def updateNode [DecidableEq Id]
    (target : Id) (newWeight : Weight) (node : Node Id Weight) : Node Id Weight :=
  if node.id = target then { node with weight := newWeight } else node

/-- Change one declared node weight without changing node or edge order. -/
def changeWeight [DecidableEq Id]
    (target : Id) (newWeight : Weight) (graph : Graph Id Weight) : Graph Id Weight :=
  { graph with nodes := graph.nodes.map (updateNode target newWeight) }

/-- Append a fresh leaf without changing existing node or edge order. -/
def insertLeaf (inserted : Node Id Weight) (graph : Graph Id Weight) : Graph Id Weight :=
  { graph with nodes := graph.nodes ++ [inserted] }

private def updateEdge [DecidableEq Id]
    (source oldTarget newTarget : Id) (edge : Edge Id) : Edge Id :=
  if edge.source = source ∧ edge.target = oldTarget then
    { source, target := newTarget }
  else edge

/-- Rewire one declared directed edge without changing node or edge order. -/
def rewire [DecidableEq Id]
    (source oldTarget newTarget : Id) (graph : Graph Id Weight) : Graph Id Weight :=
  { graph with edges := graph.edges.map (updateEdge source oldTarget newTarget) }

def noOpPath (base : Graph Id Weight) : Path (Graph Id Weight) :=
  { initial := base, middle := base, final := base }

def reversalPath (base middle : Graph Id Weight) : Path (Graph Id Weight) :=
  { initial := base, middle, final := base }

theorem noOp_endpoint (base : Graph Id Weight) :
    (noOpPath base).final = (noOpPath base).initial := by
  rfl

theorem reversal_endpoint (base middle : Graph Id Weight) :
    (reversalPath base middle).final = (reversalPath base middle).initial := by
  rfl

/-- Weight change and fresh leaf insertion commute, including exact list order. -/
theorem changeWeight_insertLeaf_commute [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (inserted : Node Id Weight) (freshForChange : inserted.id ≠ target) :
    changeWeight target newWeight (insertLeaf inserted base) =
      insertLeaf inserted (changeWeight target newWeight base) := by
  simp [changeWeight, insertLeaf, updateNode, freshForChange]

/-- Weight change and edge rewiring commute because they update disjoint fields. -/
theorem changeWeight_rewire_commute [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (source oldTarget newTarget : Id) :
    changeWeight target newWeight (rewire source oldTarget newTarget base) =
      rewire source oldTarget newTarget (changeWeight target newWeight base) := by
  rfl

def externalOrderAB [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (inserted : Node Id Weight) : Path (Graph Id Weight) :=
  { initial := base
    middle := changeWeight target newWeight base
    final := insertLeaf inserted (changeWeight target newWeight base) }

def externalOrderBA [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (inserted : Node Id Weight) : Path (Graph Id Weight) :=
  { initial := base
    middle := insertLeaf inserted base
    final := changeWeight target newWeight (insertLeaf inserted base) }

/-- The external-common AB/BA paths have the same exact endpoint graph. -/
theorem external_order_endpoint_equivalent [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (inserted : Node Id Weight) (freshForChange : inserted.id ≠ target) :
    (externalOrderAB base target newWeight inserted).final =
      (externalOrderBA base target newWeight inserted).final := by
  exact (changeWeight_insertLeaf_commute base target newWeight inserted freshForChange).symm

def dependencyOrderAB [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (source oldTarget newTarget : Id) : Path (Graph Id Weight) :=
  { initial := base
    middle := changeWeight target newWeight base
    final := rewire source oldTarget newTarget (changeWeight target newWeight base) }

def dependencyOrderBA [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (source oldTarget newTarget : Id) : Path (Graph Id Weight) :=
  { initial := base
    middle := rewire source oldTarget newTarget base
    final := changeWeight target newWeight (rewire source oldTarget newTarget base) }

/-- The dependency-aware AB/BA paths have the same exact endpoint graph. -/
theorem dependency_order_endpoint_equivalent [DecidableEq Id]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (source oldTarget newTarget : Id) :
    (dependencyOrderAB base target newWeight source oldTarget newTarget).final =
      (dependencyOrderBA base target newWeight source oldTarget newTarget).final := by
  exact (changeWeight_rewire_commute base target newWeight source oldTarget newTarget).symm

def nodeIds (graph : Graph Id Weight) : List Id := graph.nodes.map Node.id

/-- A fresh appended ID preserves uniqueness of the observable node order. -/
theorem insertLeaf_preserves_unique_ids
    (base : Graph Id Weight) (inserted : Node Id Weight)
    (baseUnique : (nodeIds base).Nodup) (fresh : inserted.id ∉ nodeIds base) :
    (nodeIds (insertLeaf inserted base)).Nodup := by
  rw [show nodeIds (insertLeaf inserted base) = nodeIds base ++ [inserted.id] by
    simp [nodeIds, insertLeaf]]
  rw [List.nodup_append]
  refine ⟨baseUnique, by simp, ?_⟩
  intro existing existingMem appended appendedMem
  simp only [List.mem_singleton] at appendedMem
  subst appended
  exact fun equal => fresh (equal ▸ existingMem)

def PositiveWeights [LT Weight] [OfNat Weight 0] (graph : Graph Id Weight) : Prop :=
  ∀ node, node ∈ graph.nodes → 0 < node.weight

theorem insertLeaf_preserves_positive_weights [LT Weight] [OfNat Weight 0]
    (base : Graph Id Weight) (inserted : Node Id Weight)
    (basePositive : PositiveWeights base) (insertedPositive : 0 < inserted.weight) :
    PositiveWeights (insertLeaf inserted base) := by
  intro node nodeMem
  simp [insertLeaf] at nodeMem
  rcases nodeMem with nodeMem | rfl
  · exact basePositive node nodeMem
  · exact insertedPositive

theorem changeWeight_preserves_positive_weights [DecidableEq Id] [LT Weight] [OfNat Weight 0]
    (base : Graph Id Weight) (target : Id) (newWeight : Weight)
    (basePositive : PositiveWeights base) (newPositive : 0 < newWeight) :
    PositiveWeights (changeWeight target newWeight base) := by
  intro node nodeMem
  rcases List.mem_map.mp nodeMem with ⟨original, originalMem, rfl⟩
  simp only [updateNode]
  split
  · exact newPositive
  · exact basePositive original originalMem

end Sprawlens.ControlledPaths
