import Sprawlens.SegmentContact

namespace Sprawlens.CollinearOverlap

open ExactGeometry
open SegmentContact

universe u

variable {R : Type u} [Field R] [LinearOrder R]

/-- Two nondegenerate collinear segment interiors overlap by positive length. -/
def OpenSegmentsOverlap (a b c d : Vec2 R) : Prop :=
  a ≠ b ∧ c ≠ d ∧
    (PointInOpenSegment a b c ∨
      PointInOpenSegment a b d ∨
      PointInOpenSegment c d a ∨
      PointInOpenSegment c d b ∨
      (a = c ∧ b = d) ∨
      (a = d ∧ b = c))

def openSegmentsOverlapBool [DecidableEq R] [DecidableLT R] [DecidableLE R]
    (a b c d : Vec2 R) : Bool :=
  decide (a ≠ b) && decide (c ≠ d) &&
    (pointInOpenSegmentBool a b c ||
      pointInOpenSegmentBool a b d ||
      pointInOpenSegmentBool c d a ||
      pointInOpenSegmentBool c d b ||
      (decide (a = c) && decide (b = d)) ||
      (decide (a = d) && decide (b = c)))

theorem openSegmentsOverlapBool_eq_true
    [DecidableEq R] [DecidableLT R] [DecidableLE R] (a b c d : Vec2 R) :
    openSegmentsOverlapBool a b c d = true ↔ OpenSegmentsOverlap a b c d := by
  simp [openSegmentsOverlapBool, OpenSegmentsOverlap, pointInOpenSegmentBool_eq_true,
    and_assoc, or_assoc]

theorem openSegmentsOverlap_first_nondegenerate (a b c d : Vec2 R)
    (overlap : OpenSegmentsOverlap a b c d) : a ≠ b :=
  overlap.1

theorem openSegmentsOverlap_second_nondegenerate (a b c d : Vec2 R)
    (overlap : OpenSegmentsOverlap a b c d) : c ≠ d :=
  overlap.2.1

theorem openSegmentsOverlap_swap_segments (a b c d : Vec2 R) :
    OpenSegmentsOverlap c d a b ↔ OpenSegmentsOverlap a b c d := by
  unfold OpenSegmentsOverlap
  constructor <;> rintro ⟨firstNondegenerate, secondNondegenerate, overlap⟩
  · refine ⟨secondNondegenerate, firstNondegenerate, ?_⟩
    aesop
  · refine ⟨secondNondegenerate, firstNondegenerate, ?_⟩
    aesop

theorem openSegmentsOverlap_identical (a b : Vec2 R) (nondegenerate : a ≠ b) :
    OpenSegmentsOverlap a b a b := by
  exact ⟨nondegenerate, nondegenerate, Or.inr <| Or.inr <| Or.inr <| Or.inr <|
    Or.inl ⟨rfl, rfl⟩⟩

theorem openSegmentsOverlap_reversed (a b : Vec2 R) (nondegenerate : a ≠ b) :
    OpenSegmentsOverlap a b b a := by
  exact ⟨nondegenerate, Ne.symm nondegenerate, Or.inr <| Or.inr <| Or.inr <| Or.inr <|
    Or.inr ⟨rfl, rfl⟩⟩

end Sprawlens.CollinearOverlap
