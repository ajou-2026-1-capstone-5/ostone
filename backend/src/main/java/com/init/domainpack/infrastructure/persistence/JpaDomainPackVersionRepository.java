package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT v FROM DomainPackVersion v WHERE v.id = :versionId")
  Optional<DomainPackVersion> findByIdForUpdate(@Param("versionId") Long versionId);

  @Query(
      value =
          """
          SELECT *
          FROM pack.domain_pack_version
          WHERE domain_pack_id = :domainPackId
            AND lifecycle_status = 'PUBLISHED'
            AND NOT EXISTS (
              SELECT 1
              FROM pack.intent_definition i
              WHERE i.domain_pack_version_id = pack.domain_pack_version.id
                AND i.status = 'DRAFT'
            )
          ORDER BY published_at DESC NULLS LAST, version_no DESC, id DESC
          LIMIT 1
          """,
      nativeQuery = true)
  Optional<DomainPackVersion> findCurrentPublishedByDomainPackId(
      @Param("domainPackId") Long domainPackId);

  @Query(
      value =
          """
          SELECT v.*
          FROM pack.domain_pack_version v
          JOIN pack.domain_pack p ON p.id = v.domain_pack_id
          WHERE p.workspace_id = :workspaceId
            AND v.lifecycle_status = 'PUBLISHED'
            AND NOT EXISTS (
              SELECT 1
              FROM pack.intent_definition i
              WHERE i.domain_pack_version_id = v.id
                AND i.status = 'DRAFT'
            )
          ORDER BY v.published_at DESC NULLS LAST, v.version_no DESC, v.id DESC
          LIMIT 1
          """,
      nativeQuery = true)
  Optional<DomainPackVersion> findCurrentPublishedByWorkspaceId(
      @Param("workspaceId") Long workspaceId);

  @Query("SELECT MAX(v.versionNo) FROM DomainPackVersion v WHERE v.domainPackId = :domainPackId")
  Optional<Integer> findMaxVersionNoByDomainPackId(@Param("domainPackId") Long domainPackId);
}
