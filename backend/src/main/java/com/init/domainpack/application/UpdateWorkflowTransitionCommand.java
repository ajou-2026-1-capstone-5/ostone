package com.init.domainpack.application;

public record UpdateWorkflowTransitionCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long workflowId,
    String transitionId,
    Long requesterId,
    ConditionPatch condition,
    ActionPatch action,
    OutcomePatch outcome) {

  public record ConditionPatch(String label) {}

  public record ActionPatch(String policyRef) {}

  public record OutcomePatch(String state, String label) {}
}
