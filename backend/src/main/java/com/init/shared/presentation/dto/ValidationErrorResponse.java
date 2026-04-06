package com.init.shared.presentation.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record ValidationErrorResponse(String code, List<String> errors) {
  public ValidationErrorResponse {
    Objects.requireNonNull(errors, "errors must not be null");
    errors = List.copyOf(new ArrayList<>(errors));
  }
}
