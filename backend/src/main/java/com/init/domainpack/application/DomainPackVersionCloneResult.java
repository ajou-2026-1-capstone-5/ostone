package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;

public record DomainPackVersionCloneResult(
    Long draftVersionId,
    Integer draftVersionNo,
    String draftLifecycleStatus,
    DomainPackDraftSourceType sourceType,
    Long baseVersionId,
    Integer baseVersionNo,
    String reason) {

  public static DomainPackVersionCloneResult from(
      DomainPackVersion draftVersion,
      DomainPackDraftSourceType sourceType,
      DomainPackVersion baseVersion,
      String reason) {
    return new DomainPackVersionCloneResult(
        draftVersion.getId(),
        draftVersion.getVersionNo(),
        draftVersion.getLifecycleStatus(),
        sourceType,
        baseVersion.getId(),
        baseVersion.getVersionNo(),
        reason);
  }
}
