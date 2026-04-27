package com.init.domainpack.application;

import com.init.domainpack.domain.repository.DomainPackDraftEntryRow;

public record DomainPackDraftEntryResult(
    Long workspaceId, Long packId, Long versionId, String packName, Integer versionNo) {

  public static DomainPackDraftEntryResult from(DomainPackDraftEntryRow row) {
    return new DomainPackDraftEntryResult(
        row.getWorkspaceId(),
        row.getPackId(),
        row.getVersionId(),
        row.getPackName(),
        row.getVersionNo());
  }
}
