import Sprawlens.SegmentProjection

namespace Sprawlens.ProjectionInputError

/-- Error budget caused by independently perturbing both inputs of one real
multiplication. -/
def productPerturbationBound
    (exactLeft exactRight approximateLeft approximateRight : ℝ) : ℝ :=
  |approximateLeft - exactLeft| * |exactRight| +
    |exactLeft| * |approximateRight - exactRight| +
    |approximateLeft - exactLeft| *
      |approximateRight - exactRight|

theorem abs_mul_sub_mul_le_productPerturbationBound
    (exactLeft exactRight approximateLeft approximateRight : ℝ) :
    |approximateLeft * approximateRight - exactLeft * exactRight| ≤
      productPerturbationBound
        exactLeft exactRight approximateLeft approximateRight := by
  have identity :
      approximateLeft * approximateRight - exactLeft * exactRight =
        (approximateLeft - exactLeft) *
            (approximateRight - exactRight) +
          (approximateLeft - exactLeft) * exactRight +
          exactLeft * (approximateRight - exactRight) := by
    ring
  rw [identity, productPerturbationBound]
  calc
    |(approximateLeft - exactLeft) *
          (approximateRight - exactRight) +
        (approximateLeft - exactLeft) * exactRight +
        exactLeft * (approximateRight - exactRight)| ≤
        |(approximateLeft - exactLeft) *
            (approximateRight - exactRight)| +
          |(approximateLeft - exactLeft) * exactRight| +
          |exactLeft * (approximateRight - exactRight)| := by
      exact abs_add_three _ _ _
    _ = |approximateLeft - exactLeft| * |exactRight| +
          |exactLeft| * |approximateRight - exactRight| +
          |approximateLeft - exactLeft| *
            |approximateRight - exactRight| := by
      rw [abs_mul, abs_mul, abs_mul]
      ring

/-- Uniform scale/error specialization of one product's perturbation bound. -/
theorem productPerturbationBound_le_uniform
    (exactLeft exactRight approximateLeft approximateRight : ℝ)
    (scale coordinateError : ℝ)
    (scaleNonnegative : 0 ≤ scale)
    (coordinateErrorNonnegative : 0 ≤ coordinateError)
    (exactLeftBound : |exactLeft| ≤ scale)
    (exactRightBound : |exactRight| ≤ scale)
    (approximateLeftError :
      |approximateLeft - exactLeft| ≤ coordinateError)
    (approximateRightError :
      |approximateRight - exactRight| ≤ coordinateError) :
    productPerturbationBound
        exactLeft exactRight approximateLeft approximateRight ≤
      2 * scale * coordinateError + coordinateError ^ 2 := by
  rw [productPerturbationBound, pow_two]
  calc
    |approximateLeft - exactLeft| * |exactRight| +
          |exactLeft| * |approximateRight - exactRight| +
          |approximateLeft - exactLeft| *
            |approximateRight - exactRight| ≤
        coordinateError * scale + scale * coordinateError +
          coordinateError * coordinateError := by
      gcongr
    _ = 2 * scale * coordinateError +
          coordinateError * coordinateError := by
      ring

/-- Componentwise perturbation bound for a two-dimensional dot product,
including an explicit final arithmetic error in the approximate dot result. -/
theorem abs_approximateDot2_sub_exactDot2_le
    (exactLeftX exactLeftY exactRightX exactRightY : ℝ)
    (approximateLeftX approximateLeftY : ℝ)
    (approximateRightX approximateRightY approximateDot : ℝ)
    (arithmeticError : ℝ)
    (approximateDotError :
      |approximateDot -
        (approximateLeftX * approximateRightX +
          approximateLeftY * approximateRightY)| ≤ arithmeticError) :
    |approximateDot -
        (exactLeftX * exactRightX + exactLeftY * exactRightY)| ≤
      arithmeticError +
        productPerturbationBound
          exactLeftX exactRightX approximateLeftX approximateRightX +
        productPerturbationBound
          exactLeftY exactRightY approximateLeftY approximateRightY := by
  let approximateProducts :=
    approximateLeftX * approximateRightX +
      approximateLeftY * approximateRightY
  let exactProducts :=
    exactLeftX * exactRightX + exactLeftY * exactRightY
  calc
    |approximateDot - exactProducts| =
        |(approximateDot - approximateProducts) +
          (approximateProducts - exactProducts)| := by
      congr 1
      ring
    _ ≤ |approximateDot - approximateProducts| +
          |approximateProducts - exactProducts| := abs_add_le _ _
    _ ≤ arithmeticError +
          |approximateProducts - exactProducts| := by
      gcongr
    _ ≤ arithmeticError +
        (|approximateLeftX * approximateRightX -
            exactLeftX * exactRightX| +
          |approximateLeftY * approximateRightY -
            exactLeftY * exactRightY|) := by
      apply add_le_add_right
      dsimp only [approximateProducts, exactProducts]
      have identity :
          approximateLeftX * approximateRightX +
              approximateLeftY * approximateRightY -
              (exactLeftX * exactRightX + exactLeftY * exactRightY) =
            (approximateLeftX * approximateRightX -
              exactLeftX * exactRightX) +
            (approximateLeftY * approximateRightY -
              exactLeftY * exactRightY) := by
        ring
      rw [identity]
      exact abs_add_le _ _
    _ ≤ arithmeticError +
        productPerturbationBound
          exactLeftX exactRightX approximateLeftX approximateRightX +
        productPerturbationBound
          exactLeftY exactRightY approximateLeftY approximateRightY := by
      rw [add_assoc]
      apply add_le_add_right
      exact add_le_add
        (abs_mul_sub_mul_le_productPerturbationBound
          exactLeftX exactRightX approximateLeftX approximateRightX)
        (abs_mul_sub_mul_le_productPerturbationBound
          exactLeftY exactRightY approximateLeftY approximateRightY)

/-- Specialization of the dot-product bound to the squared length used as the
projection denominator. -/
theorem abs_approximateSquaredNorm2_sub_exact_le
    (exactX exactY approximateX approximateY approximateSquaredNorm : ℝ)
    (arithmeticError : ℝ)
    (approximateSquaredNormError :
      |approximateSquaredNorm -
        (approximateX * approximateX + approximateY * approximateY)| ≤
          arithmeticError) :
    |approximateSquaredNorm - (exactX * exactX + exactY * exactY)| ≤
      arithmeticError +
        productPerturbationBound exactX exactX approximateX approximateX +
        productPerturbationBound exactY exactY approximateY approximateY := by
  exact abs_approximateDot2_sub_exactDot2_le
    exactX exactY exactX exactY
    approximateX approximateY approximateX approximateY
    approximateSquaredNorm arithmeticError approximateSquaredNormError

/-- A convenient common-scale specialization for 2D dot products. -/
theorem abs_approximateDot2_sub_exactDot2_le_uniform
    (exactLeftX exactLeftY exactRightX exactRightY : ℝ)
    (approximateLeftX approximateLeftY : ℝ)
    (approximateRightX approximateRightY approximateDot : ℝ)
    (scale coordinateError arithmeticError : ℝ)
    (scaleNonnegative : 0 ≤ scale)
    (coordinateErrorNonnegative : 0 ≤ coordinateError)
    (exactLeftXBound : |exactLeftX| ≤ scale)
    (exactLeftYBound : |exactLeftY| ≤ scale)
    (exactRightXBound : |exactRightX| ≤ scale)
    (exactRightYBound : |exactRightY| ≤ scale)
    (approximateLeftXError :
      |approximateLeftX - exactLeftX| ≤ coordinateError)
    (approximateLeftYError :
      |approximateLeftY - exactLeftY| ≤ coordinateError)
    (approximateRightXError :
      |approximateRightX - exactRightX| ≤ coordinateError)
    (approximateRightYError :
      |approximateRightY - exactRightY| ≤ coordinateError)
    (approximateDotError :
      |approximateDot -
        (approximateLeftX * approximateRightX +
          approximateLeftY * approximateRightY)| ≤ arithmeticError) :
    |approximateDot -
        (exactLeftX * exactRightX + exactLeftY * exactRightY)| ≤
      arithmeticError +
        4 * scale * coordinateError + 2 * coordinateError ^ 2 := by
  calc
    |approximateDot -
        (exactLeftX * exactRightX + exactLeftY * exactRightY)| ≤
      arithmeticError +
        productPerturbationBound
          exactLeftX exactRightX approximateLeftX approximateRightX +
        productPerturbationBound
          exactLeftY exactRightY approximateLeftY approximateRightY :=
      abs_approximateDot2_sub_exactDot2_le
        exactLeftX exactLeftY exactRightX exactRightY
        approximateLeftX approximateLeftY
        approximateRightX approximateRightY approximateDot
        arithmeticError approximateDotError
    _ ≤ arithmeticError +
        (2 * scale * coordinateError + coordinateError ^ 2) +
        (2 * scale * coordinateError + coordinateError ^ 2) := by
      gcongr
      · exact productPerturbationBound_le_uniform
          exactLeftX exactRightX approximateLeftX approximateRightX
          scale coordinateError scaleNonnegative coordinateErrorNonnegative
          exactLeftXBound exactRightXBound
          approximateLeftXError approximateRightXError
      · exact productPerturbationBound_le_uniform
          exactLeftY exactRightY approximateLeftY approximateRightY
          scale coordinateError scaleNonnegative coordinateErrorNonnegative
          exactLeftYBound exactRightYBound
          approximateLeftYError approximateRightYError
    _ = arithmeticError +
        4 * scale * coordinateError + 2 * coordinateError ^ 2 := by
      ring

/-- Common-scale bound for the squared edge length denominator. -/
theorem abs_approximateSquaredNorm2_sub_exact_le_uniform
    (exactX exactY approximateX approximateY approximateSquaredNorm : ℝ)
    (scale coordinateError arithmeticError : ℝ)
    (scaleNonnegative : 0 ≤ scale)
    (coordinateErrorNonnegative : 0 ≤ coordinateError)
    (exactXBound : |exactX| ≤ scale)
    (exactYBound : |exactY| ≤ scale)
    (approximateXError : |approximateX - exactX| ≤ coordinateError)
    (approximateYError : |approximateY - exactY| ≤ coordinateError)
    (approximateSquaredNormError :
      |approximateSquaredNorm -
        (approximateX * approximateX + approximateY * approximateY)| ≤
          arithmeticError) :
    |approximateSquaredNorm - (exactX * exactX + exactY * exactY)| ≤
      arithmeticError +
        4 * scale * coordinateError + 2 * coordinateError ^ 2 := by
  exact abs_approximateDot2_sub_exactDot2_le_uniform
    exactX exactY exactX exactY
    approximateX approximateY approximateX approximateY
    approximateSquaredNorm scale coordinateError arithmeticError
    scaleNonnegative coordinateErrorNonnegative
    exactXBound exactYBound exactXBound exactYBound
    approximateXError approximateYError
    approximateXError approximateYError approximateSquaredNormError

end Sprawlens.ProjectionInputError
