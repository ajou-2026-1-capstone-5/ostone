package com.init.domainpack.domain.repository;

public interface DomainPackDraftEntryRow {

  Long getWorkspaceId();

  Long getPackId();

  Long getVersionId();

  String getPackName();

  Integer getVersionNo();
}
