package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.repository.DomainPackCommandRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackCommandRepository
    extends JpaRepository<DomainPack, Long>, DomainPackCommandRepository {

  Optional<DomainPack> findByWorkspaceIdAndPackKey(Long workspaceId, String packKey);
}
