package com.init.domainpack.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateWorkflowTransitionRequest(
    @Valid ConditionPatch condition, @Valid ActionPatch action, @Valid OutcomePatch outcome) {

  public record ConditionPatch(
      @NotBlank(message = "condition.label은 필수 항목입니다.")
          @Size(max = 255, message = "condition.label은 255자 이하여야 합니다.")
          String label) {}

  public record ActionPatch(
      @NotBlank(message = "action.policyRef는 필수 항목입니다.")
          @Size(max = 100, message = "action.policyRef는 100자 이하여야 합니다.")
          @Pattern(
              regexp = "[A-Za-z0-9_-]+",
              message = "action.policyRef는 영문, 숫자, _, -만 사용할 수 있습니다.")
          String policyRef) {}

  public record OutcomePatch(
      @Size(max = 100, message = "outcome.state는 100자 이하여야 합니다.")
          @Pattern(regexp = "[A-Za-z0-9_-]+", message = "outcome.state는 영문, 숫자, _, -만 사용할 수 있습니다.")
          String state,
      @Size(max = 255, message = "outcome.label은 255자 이하여야 합니다.") String label) {}
}
