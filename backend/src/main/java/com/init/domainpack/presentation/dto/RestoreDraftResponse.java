package com.init.domainpack.presentation.dto;

import com.init.domainpack.application.RestoreDraftResult;

public record RestoreDraftResponse(DomainPackDraftVersionResponse draftVersion) {

  public static RestoreDraftResponse from(RestoreDraftResult result) {
    return new RestoreDraftResponse(DomainPackDraftVersionResponse.from(result.draftVersion()));
  }
}
