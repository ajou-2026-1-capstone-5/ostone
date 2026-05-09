package com.init.domainpack.presentation.dto;

import com.init.domainpack.application.DomainPackDraftVersionResult;

public record DomainPackDraftVersionResponse(
    Long versionId,
    Integer versionNo,
    String lifecycleStatus,
    String sourceType,
    Long baseVersionId,
    Integer baseVersionNo,
    String reason) {

  public static DomainPackDraftVersionResponse from(DomainPackDraftVersionResult result) {
    return new DomainPackDraftVersionResponse(
        result.versionId(),
        result.versionNo(),
        result.lifecycleStatus(),
        result.sourceType(),
        result.baseVersionId(),
        result.baseVersionNo(),
        result.reason());
  }
}
