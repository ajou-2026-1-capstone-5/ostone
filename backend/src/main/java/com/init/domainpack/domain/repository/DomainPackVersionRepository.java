package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.util.Optional;

public interface DomainPackVersionRepository {

  Optional<DomainPackVersion> findById(Long id);

  Optional<DomainPackVersion> findByIdAndWorkspaceId(Long workspaceId, Long versionId);

  Optional<Integer> findMaxVersionNoByDomainPackId(Long domainPackId);

  DomainPackVersion save(DomainPackVersion version);

  DomainPackVersion saveAndFlush(DomainPackVersion version);
}
