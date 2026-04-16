package com.init.pipelinejob.application;

public record ReceiveIntentDraftCallbackResult(
    String status,
    String externalEventId,
    Long domainPackVersionId,
    Integer addedIntentCount,
    Integer skippedIntentCount,
    Integer totalIntentCount,
    Long sourcePipelineJobId) {

  public static ReceiveIntentDraftCallbackResult created(
      String externalEventId,
      Long domainPackVersionId,
      int addedIntentCount,
      int skippedIntentCount,
      int totalIntentCount,
      Long sourcePipelineJobId) {
    return new ReceiveIntentDraftCallbackResult(
        "CREATED",
        externalEventId,
        domainPackVersionId,
        addedIntentCount,
        skippedIntentCount,
        totalIntentCount,
        sourcePipelineJobId);
  }

  public static ReceiveIntentDraftCallbackResult duplicateIgnored(String externalEventId) {
    return new ReceiveIntentDraftCallbackResult(
        "DUPLICATE_IGNORED", externalEventId, null, null, null, null, null);
  }
}
