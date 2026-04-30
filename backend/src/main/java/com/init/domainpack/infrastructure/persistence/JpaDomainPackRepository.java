package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.repository.DomainPackDraftEntryRow;
import com.init.domainpack.domain.repository.DomainPackRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackRepository
    extends JpaRepository<DomainPackRef, Long>, DomainPackRepository {

  boolean existsByIdAndWorkspaceId(Long id, Long workspaceId);

  @Query("SELECT p FROM DomainPack p WHERE p.id = :packId AND p.workspaceId = :workspaceId")
  Optional<DomainPack> findByIdAndWorkspaceId(
      @Param("packId") Long packId, @Param("workspaceId") Long workspaceId);

  @Query(
      value =
          """
          -- Keep status literals aligned with DomainPack.STATUS_ACTIVE and draft lifecycle values.
          SELECT
            p.workspace_id AS "workspaceId",
            p.id AS "packId",
            v.id AS "versionId",
            p.name AS "packName",
            v.version_no AS "versionNo"
          FROM pack.domain_pack p
          JOIN pack.domain_pack_version v ON v.domain_pack_id = p.id
          WHERE p.workspace_id = :workspaceId
            AND p.status = 'ACTIVE'
            AND v.lifecycle_status = 'DRAFT'
          ORDER BY v.created_at DESC, v.id DESC
          LIMIT 1
          """,
      nativeQuery = true)
  Optional<DomainPackDraftEntryRow> findLatestDraftEntryByWorkspaceId(
      @Param("workspaceId") Long workspaceId);
}
