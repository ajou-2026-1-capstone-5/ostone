package com.init.domainpack.application;

public record IntentRevisionDraftResult(DomainPackDraftVersionResult draftVersion) {

  public static IntentRevisionDraftResult from(DomainPackVersionCloneResult result) {
    return new IntentRevisionDraftResult(DomainPackDraftVersionResult.from(result));
  }
}
