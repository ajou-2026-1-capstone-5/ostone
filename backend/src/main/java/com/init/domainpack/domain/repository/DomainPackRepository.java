package com.init.domainpack.domain.repository;

public interface DomainPackRepository {

  boolean existsByIdAndWorkspaceId(Long packId, Long workspaceId);
}
