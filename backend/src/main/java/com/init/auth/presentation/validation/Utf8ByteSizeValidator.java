package com.init.auth.presentation.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

public class Utf8ByteSizeValidator implements ConstraintValidator<Utf8ByteSize, String> {

  private int min;
  private int max;

  @Override
  public void initialize(Utf8ByteSize constraintAnnotation) {
    this.min = constraintAnnotation.min();
    this.max = constraintAnnotation.max();
    if (min < 0) {
      throw new IllegalArgumentException("Utf8ByteSize min must be >= 0. min=" + min);
    }
    if (max < min) {
      throw new IllegalArgumentException(
          "Utf8ByteSize max must be >= min. min=" + min + ", max=" + max);
    }
  }

  @Override
  public boolean isValid(String value, ConstraintValidatorContext context) {
    if (value == null) {
      return true;
    }

    int byteLength = value.getBytes(StandardCharsets.UTF_8).length;
    return byteLength >= min && byteLength <= max;
  }
}
