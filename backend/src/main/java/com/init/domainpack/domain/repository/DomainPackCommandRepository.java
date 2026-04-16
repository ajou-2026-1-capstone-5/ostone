package com.init.domainpack.domain.repository;

import com.init.domainpack.domain.model.DomainPack;
import java.util.Optional;

public interface DomainPackCommandRepository {

  Optional<DomainPack> findByWorkspaceIdAndPackKey(Long workspaceId, String packKey);

  DomainPack saveAndFlush(DomainPack domainPack);
}
