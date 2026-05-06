package com.init.domainpack.infrastructure;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.pipelinejob.application.DomainPackVersionPort;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class DomainPackVersionPortAdapter implements DomainPackVersionPort {

  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackRepository domainPackRepository;

  public DomainPackVersionPortAdapter(
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackRepository domainPackRepository) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackRepository = domainPackRepository;
  }

  @Override
  public Optional<Long> findDomainPackIdByVersionId(Long versionId) {
    return domainPackVersionRepository.findById(versionId).map(DomainPackVersion::getDomainPackId);
  }

  @Override
  public boolean existsByDomainPackIdAndWorkspaceId(Long domainPackId, Long workspaceId) {
    return domainPackRepository.existsByIdAndWorkspaceId(domainPackId, workspaceId);
  }
}
