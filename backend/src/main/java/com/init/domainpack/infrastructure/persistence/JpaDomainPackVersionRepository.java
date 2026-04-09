package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackVersionRepository
    extends JpaRepository<DomainPackVersion, Long>, DomainPackVersionRepository {

  @Query(
      "SELECT v FROM DomainPackVersion v WHERE v.id = :versionId"
          + " AND EXISTS (SELECT p FROM DomainPackRef p WHERE p.id = v.domainPackId AND p.workspaceId = :workspaceId)")
  Optional<DomainPackVersion> findByIdAndWorkspaceId(
      @Param("workspaceId") Long workspaceId, @Param("versionId") Long versionId);
}
