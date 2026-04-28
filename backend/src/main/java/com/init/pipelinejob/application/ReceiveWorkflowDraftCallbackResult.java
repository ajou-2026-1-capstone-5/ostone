package com.init.pipelinejob.application;

public record ReceiveWorkflowDraftCallbackResult(
    String status,
    String externalEventId,
    Long domainPackId,
    Long domainPackVersionId,
    Integer addedSlotCount,
    Integer addedPolicyCount,
    Integer addedRiskCount,
    Integer addedWorkflowCount,
    Integer addedIntentSlotBindingCount,
    Integer addedIntentWorkflowBindingCount,
    Long sourcePipelineJobId) {

  public static ReceiveWorkflowDraftCallbackResult created(
      String externalEventId,
      Long domainPackId,
      Long domainPackVersionId,
      int addedSlotCount,
      int addedPolicyCount,
      int addedRiskCount,
      int addedWorkflowCount,
      int addedIntentSlotBindingCount,
      int addedIntentWorkflowBindingCount,
      Long sourcePipelineJobId) {
    return new ReceiveWorkflowDraftCallbackResult(
        "CREATED",
        externalEventId,
        domainPackId,
        domainPackVersionId,
        addedSlotCount,
        addedPolicyCount,
        addedRiskCount,
        addedWorkflowCount,
        addedIntentSlotBindingCount,
        addedIntentWorkflowBindingCount,
        sourcePipelineJobId);
  }

  public static ReceiveWorkflowDraftCallbackResult duplicateIgnored(String externalEventId) {
    return new ReceiveWorkflowDraftCallbackResult(
        "DUPLICATE_IGNORED", externalEventId, null, null, null, null, null, null, null, null, null);
  }
}
