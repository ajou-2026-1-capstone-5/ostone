package com.init.pipelinejob.application;

public record ReceiveDomainPackDraftCallbackResult(
    String status,
    String externalEventId,
    Long domainPackId,
    Long domainPackVersionId,
    Integer versionNo,
    String packKey,
    Boolean createdPack,
    Long sourcePipelineJobId) {

  public static ReceiveDomainPackDraftCallbackResult created(
      String externalEventId,
      Long domainPackId,
      Long domainPackVersionId,
      Integer versionNo,
      String packKey,
      boolean createdPack,
      Long sourcePipelineJobId) {
    return new ReceiveDomainPackDraftCallbackResult(
        "CREATED",
        externalEventId,
        domainPackId,
        domainPackVersionId,
        versionNo,
        packKey,
        createdPack,
        sourcePipelineJobId);
  }

  public static ReceiveDomainPackDraftCallbackResult duplicateIgnored(String externalEventId) {
    return new ReceiveDomainPackDraftCallbackResult(
        "DUPLICATE_IGNORED", externalEventId, null, null, null, null, null, null);
  }
}
