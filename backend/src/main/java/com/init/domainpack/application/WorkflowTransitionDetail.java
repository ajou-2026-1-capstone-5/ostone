package com.init.domainpack.application;

import java.util.List;
import java.util.Optional;

public record WorkflowTransitionDetail(
    String id,
    Long workflowDefinitionId,
    Long domainPackVersionId,
    String from,
    String to,
    String fromType,
    String toType,
    String label,
    String toPolicyRef,
    TransitionConditionDetail condition,
    TransitionActionDetail action,
    TransitionOutcomeDetail outcome) {

  public WorkflowTransitionDetail(
      String id,
      Long workflowDefinitionId,
      Long domainPackVersionId,
      String from,
      String to,
      String label,
      String toPolicyRef) {
    this(
        id,
        workflowDefinitionId,
        domainPackVersionId,
        from,
        to,
        null,
        null,
        label,
        toPolicyRef,
        new TransitionConditionDetail(label != null, label),
        new TransitionActionDetail(toPolicyRef != null, toPolicyRef),
        new TransitionOutcomeDetail(false, null, null));
  }

  static List<WorkflowTransitionDetail> listFromGraphJson(
      String graphJson, Long workflowId, Long versionId) {
    return WorkflowGraphDocument.parse(graphJson, workflowId).listTransitionDetails(versionId);
  }

  static Optional<WorkflowTransitionDetail> fromGraphJson(
      String graphJson, String transitionId, Long workflowId, Long versionId) {
    return WorkflowGraphDocument.parse(graphJson, workflowId)
        .findTransitionDetail(transitionId, versionId);
  }

  public record TransitionConditionDetail(boolean editable, String label) {}

  public record TransitionActionDetail(boolean editable, String policyRef) {}

  public record TransitionOutcomeDetail(boolean editable, String state, String label) {}
}
