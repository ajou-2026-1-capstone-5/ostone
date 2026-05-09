package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;

public record DomainPackVersionCloneResult(
    DomainPackVersion draftVersion,
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
        draftVersion, sourceType, baseVersion.getId(), baseVersion.getVersionNo(), reason);
  }
}
