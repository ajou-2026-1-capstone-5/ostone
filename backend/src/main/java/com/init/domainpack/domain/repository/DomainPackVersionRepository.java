package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.util.List;
import java.util.Optional;

public interface DomainPackVersionRepository {

  Optional<DomainPackVersion> findById(Long id);

  Optional<DomainPackVersion> findByIdAndWorkspaceId(Long workspaceId, Long versionId);

  Optional<DomainPackVersion> findByIdForUpdate(Long versionId);

  Optional<DomainPackVersion> findCurrentPublishedByDomainPackId(Long domainPackId);

  Optional<DomainPackVersion> findCurrentPublishedByWorkspaceId(Long workspaceId);

  Optional<DomainPackVersion> findFirstByDomainPackIdAndLifecycleStatusOrderByVersionNoDesc(
      Long domainPackId, String lifecycleStatus);

  List<DomainPackVersion> findAllByDomainPackIdOrderByVersionNoDesc(Long domainPackId);

  Optional<Integer> findMaxVersionNoByDomainPackId(Long domainPackId);

  boolean existsByDomainPackIdAndLifecycleStatus(Long domainPackId, String lifecycleStatus);

  DomainPackVersion save(DomainPackVersion version);

  DomainPackVersion saveAndFlush(DomainPackVersion version);

  void delete(DomainPackVersion version);

  void flush();
}
