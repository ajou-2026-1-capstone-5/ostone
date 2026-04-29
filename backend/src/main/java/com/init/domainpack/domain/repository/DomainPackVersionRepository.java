package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.util.List;
import java.util.Optional;

public interface DomainPackVersionRepository {

  Optional<DomainPackVersion> findById(Long id);

  Optional<DomainPackVersion> findByIdAndWorkspaceId(Long workspaceId, Long versionId);

  List<DomainPackVersion> findAllByDomainPackIdOrderByVersionNoDesc(Long domainPackId);

  Optional<Integer> findMaxVersionNoByDomainPackId(Long domainPackId);

  DomainPackVersion save(DomainPackVersion version);

  DomainPackVersion saveAndFlush(DomainPackVersion version);
}
