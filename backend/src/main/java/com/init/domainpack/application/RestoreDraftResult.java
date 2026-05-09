package com.init.domainpack.application;

public record RestoreDraftResult(DomainPackDraftVersionResult draftVersion) {

  public static RestoreDraftResult from(DomainPackVersionCloneResult result) {
    return new RestoreDraftResult(DomainPackDraftVersionResult.from(result));
  }
}
