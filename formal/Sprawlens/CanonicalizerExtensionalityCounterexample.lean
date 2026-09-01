import Sprawlens.WindingCanonicalizer

namespace Sprawlens.CanonicalizerExtensionalityCounterexample

open ExactGeometry
open HalfPlaneClipPoints
open HalfPlaneIntersection
open OrderedTriples
open PolygonSeamCanonicalizer
open SemanticReclassification
open WindingCanonicalizer

def lowerLeft : Vec2 Rat := { x := 0, y := 0 }
def lowerMiddle : Vec2 Rat := { x := 1, y := 0 }
def lowerRight : Vec2 Rat := { x := 2, y := 0 }
def upperRight : Vec2 Rat := { x := 2, y := 2 }
def upperLeft : Vec2 Rat := { x := 0, y := 2 }

/-- A square represented only by its extreme corners. -/
def square : List (Vec2 Rat) :=
  [lowerLeft, lowerRight, upperRight, upperLeft]

/-- The same square with one redundant collinear boundary vertex. -/
def subdividedSquare : List (Vec2 Rat) :=
  [lowerLeft, lowerMiddle, lowerRight, upperRight, upperLeft]

theorem lowerMiddle_on_lowerEdge :
    OnClosedSegment lowerLeft lowerRight lowerMiddle := by
  refine ⟨(1 / 2 : Rat), by norm_num, ?_⟩
  norm_num [lowerLeft, lowerMiddle, lowerRight, interpolatePoint]

theorem square_ordered : AllOrderedCCW square := by
  norm_num [square, AllOrderedCCW, AllOrderedTriples,
    List.triplewise_cons, List.pairwise_cons, lowerLeft, lowerRight,
    upperRight, upperLeft, orientation]

theorem subdividedSquare_ordered : AllOrderedCCW subdividedSquare := by
  norm_num [subdividedSquare, AllOrderedCCW, AllOrderedTriples,
    List.triplewise_cons, List.pairwise_cons, lowerLeft, lowerMiddle,
    lowerRight, upperRight, upperLeft, orientation]

theorem square_nodup : square.Nodup := by
  native_decide

theorem subdividedSquare_nodup : subdividedSquare.Nodup := by
  native_decide

/-- Adding the boundary midpoint changes the finite generator list but not
its convex hull. -/
theorem subdividedSquare_same_region :
    listConvexRegion subdividedSquare = listConvexRegion square := by
  apply Set.Subset.antisymm
  · unfold listConvexRegion
    apply convexHull_min
    · intro point member
      change point ∈ subdividedSquare at member
      simp only [subdividedSquare, List.mem_cons, List.not_mem_nil,
        or_false] at member
      rcases member with pointEq | pointEq | pointEq | pointEq | pointEq
      · subst point
        exact subset_convexHull Rat _ (by simp [square])
      · subst point
        have middleMathlib :
            lowerMiddle ∈ segment Rat lowerLeft lowerRight := by
          rw [← degenerateSegment_region_eq_segment]
          exact lowerMiddle_on_lowerEdge
        exact segment_subset_convexHull (𝕜 := Rat)
          (by simp [square]) (by simp [square]) middleMathlib
      · subst point
        exact subset_convexHull Rat _ (by simp [square])
      · subst point
        exact subset_convexHull Rat _ (by simp [square])
      · subst point
        exact subset_convexHull Rat _ (by simp [square])
    · exact convex_convexHull Rat _
  · unfold listConvexRegion
    apply convexHull_mono
    intro point member
    change point ∈ square at member
    change point ∈ subdividedSquare
    simp only [square, List.mem_cons, List.not_mem_nil, or_false] at member
    rcases member with rfl | rfl | rfl | rfl <;>
      simp [subdividedSquare]

/-- Therefore the current vertex-preserving polygon representation is not
extensionally unique on convex regions: redundant boundary subdivision is a
real counterexample, not a missing proof. -/
theorem same_region_but_distinct_canonical_artifacts :
    listConvexRegion subdividedSquare = listConvexRegion square ∧
      canonicalizeSeamed subdividedSquare ≠ canonicalizeSeamed square := by
  refine ⟨subdividedSquare_same_region, ?_⟩
  native_decide

end Sprawlens.CanonicalizerExtensionalityCounterexample
