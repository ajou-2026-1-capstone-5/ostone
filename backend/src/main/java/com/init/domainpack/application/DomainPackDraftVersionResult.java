package com.init.domainpack.application;

public record DomainPackDraftVersionResult(
    Long versionId,
    Integer versionNo,
    String lifecycleStatus,
    String sourceType,
    Long baseVersionId,
    Integer baseVersionNo,
    String reason) {

  public static DomainPackDraftVersionResult from(DomainPackVersionCloneResult result) {
    return new DomainPackDraftVersionResult(
        result.draftVersionId(),
        result.draftVersionNo(),
        result.draftLifecycleStatus(),
        result.sourceType().name(),
        result.baseVersionId(),
        result.baseVersionNo(),
        result.reason());
  }
}
