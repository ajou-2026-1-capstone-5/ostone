package com.init.pipelinejob.application;

import java.util.Optional;

public interface DomainPackVersionPort {

  Optional<Long> findDomainPackIdByVersionId(Long versionId);

  boolean existsByDomainPackIdAndWorkspaceId(Long domainPackId, Long workspaceId);
}
