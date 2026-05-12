package com.init.domainpack.presentation.dto;

public record UpdateWorkflowTransitionRequest(
    ConditionPatch condition, ActionPatch action, OutcomePatch outcome) {

  public record ConditionPatch(String label) {}

  public record ActionPatch(String policyRef) {}

  public record OutcomePatch(String state, String label) {}
}
