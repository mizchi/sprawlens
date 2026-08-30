import Mathlib.Algebra.BigOperators.Ring.Finset
import Sprawlens.ExactGeometry

namespace Sprawlens.PolygonArea

open ExactGeometry
open scoped BigOperators

universe u v

variable {R : Type u} [Field R]
variable {ι : Type v} [Fintype ι]

def edgeCross (start finish : Vec2 R) : R :=
  start.x * finish.y - finish.x * start.y

/-- Shoelace sum over a finite cyclic successor permutation. -/
def signedTwiceArea (next : Equiv.Perm ι) (vertex : ι → Vec2 R) : R :=
  ∑ index, edgeCross (vertex index) (vertex (next index))

theorem edgeCross_swap (start finish : Vec2 R) :
    edgeCross finish start = -edgeCross start finish := by
  simp only [edgeCross]
  ring

theorem signedTwiceArea_scale (next : Equiv.Perm ι) (vertex : ι → Vec2 R) (factor : R) :
    signedTwiceArea next (fun index => scale factor (vertex index)) =
      factor ^ 2 * signedTwiceArea next vertex := by
  unfold signedTwiceArea
  calc
    (∑ index, edgeCross (scale factor (vertex index)) (scale factor (vertex (next index)))) =
        ∑ index, factor ^ 2 * edgeCross (vertex index) (vertex (next index)) := by
          apply Finset.sum_congr rfl
          intro index _
          simp only [edgeCross, scale]
          ring
    _ = factor ^ 2 * ∑ index, edgeCross (vertex index) (vertex (next index)) := by
      rw [Finset.mul_sum]

theorem signedTwiceArea_translate
    (next : Equiv.Perm ι) (vertex : ι → Vec2 R) (offset : Vec2 R) :
    signedTwiceArea next (fun index => translate (vertex index) offset) =
      signedTwiceArea next vertex := by
  have sumNextX : (∑ index, (vertex (next index)).x) = ∑ index, (vertex index).x :=
    next.bijective.sum_comp fun index => (vertex index).x
  have sumNextY : (∑ index, (vertex (next index)).y) = ∑ index, (vertex index).y :=
    next.bijective.sum_comp fun index => (vertex index).y
  have deltaX : (∑ index, ((vertex index).x - (vertex (next index)).x)) = 0 := by
    rw [Finset.sum_sub_distrib, sumNextX]
    ring
  have deltaY : (∑ index, ((vertex (next index)).y - (vertex index).y)) = 0 := by
    rw [Finset.sum_sub_distrib, sumNextY]
    ring
  unfold signedTwiceArea
  calc
    (∑ index, edgeCross (translate (vertex index) offset)
        (translate (vertex (next index)) offset)) =
      ∑ index, (edgeCross (vertex index) (vertex (next index)) +
        ((vertex index).x - (vertex (next index)).x) * offset.y +
        offset.x * ((vertex (next index)).y - (vertex index).y)) := by
          apply Finset.sum_congr rfl
          intro index _
          simp only [edgeCross, translate]
          ring
    _ = (∑ index, edgeCross (vertex index) (vertex (next index))) +
        (∑ index, ((vertex index).x - (vertex (next index)).x)) * offset.y +
        offset.x * (∑ index, ((vertex (next index)).y - (vertex index).y)) := by
          rw [Finset.sum_add_distrib, Finset.sum_add_distrib]
          rw [Finset.sum_mul, Finset.mul_sum]
    _ = ∑ index, edgeCross (vertex index) (vertex (next index)) := by
      rw [deltaX, deltaY]
      ring

theorem signedTwiceArea_reverse (next : Equiv.Perm ι) (vertex : ι → Vec2 R) :
    signedTwiceArea next.symm vertex = -signedTwiceArea next vertex := by
  unfold signedTwiceArea
  calc
    (∑ index, edgeCross (vertex index) (vertex (next.symm index))) =
        ∑ index, edgeCross (vertex (next index)) (vertex index) := by
          symm
          simpa using next.bijective.sum_comp
            (fun index => edgeCross (vertex index) (vertex (next.symm index)))
    _ = ∑ index, -edgeCross (vertex index) (vertex (next index)) := by
      apply Finset.sum_congr rfl
      intro index _
      exact edgeCross_swap (vertex index) (vertex (next index))
    _ = -∑ index, edgeCross (vertex index) (vertex (next index)) := by
      rw [Finset.sum_neg_distrib]

def triangleSignedTwiceArea (a b c : Vec2 R) : R :=
  edgeCross a b + edgeCross b c + edgeCross c a

theorem triangleSignedTwiceArea_eq_orientation (a b c : Vec2 R) :
    triangleSignedTwiceArea a b c = orientation a b c := by
  simp only [triangleSignedTwiceArea, edgeCross, orientation]
  ring

end Sprawlens.PolygonArea
