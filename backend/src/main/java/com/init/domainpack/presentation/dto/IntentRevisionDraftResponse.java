package com.init.domainpack.presentation.dto;

import com.init.domainpack.application.IntentRevisionDraftResult;

public record IntentRevisionDraftResponse(DomainPackDraftVersionResponse draftVersion) {

  public static IntentRevisionDraftResponse from(IntentRevisionDraftResult result) {
    return new IntentRevisionDraftResponse(
        DomainPackDraftVersionResponse.from(result.draftVersion()));
  }
}
