package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.DomainPack;
import java.util.Optional;

public interface DomainPackRepository {

  boolean existsByIdAndWorkspaceId(Long packId, Long workspaceId);

  Optional<DomainPack> findByIdAndWorkspaceId(Long packId, Long workspaceId);

  Optional<DomainPackDraftEntryRow> findLatestDraftEntryByWorkspaceId(Long workspaceId);
}
