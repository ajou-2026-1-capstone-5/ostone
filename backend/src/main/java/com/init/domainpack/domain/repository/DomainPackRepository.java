package com.init.domainpack.domain.repository;

import java.util.Optional;

public interface DomainPackRepository {

  boolean existsByIdAndWorkspaceId(Long packId, Long workspaceId);

  Optional<DomainPackDraftEntryRow> findLatestDraftEntryByWorkspaceId(Long workspaceId);
}
