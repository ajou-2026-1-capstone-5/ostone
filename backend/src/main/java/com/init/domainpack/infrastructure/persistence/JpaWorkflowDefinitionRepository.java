package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkflowDefinitionRepository
    extends JpaRepository<WorkflowDefinition, Long>, WorkflowDefinitionRepository {

  @Override
  List<WorkflowDefinition> findAllByDomainPackVersionId(Long domainPackVersionId);

  @Override
  List<WorkflowDefinitionSummaryRow> findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(
      Long domainPackVersionId);

  @Override
  Optional<WorkflowDefinition> findByIdAndDomainPackVersionId(Long id, Long domainPackVersionId);

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "SELECT w FROM WorkflowDefinition w"
          + " WHERE w.id = :id AND w.domainPackVersionId = :domainPackVersionId")
  Optional<WorkflowDefinition> findByIdAndDomainPackVersionIdForUpdate(
      @Param("id") Long id, @Param("domainPackVersionId") Long domainPackVersionId);

  @Override
  @Query(
      value =
          """
          SELECT CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END
          FROM pack.workflow_definition
          WHERE domain_pack_version_id = :versionId
            AND graph_json -> 'nodes' @> jsonb_build_array(jsonb_build_object('policyRef', :policyCode))
          """,
      nativeQuery = true)
  boolean existsByDomainPackVersionIdAndPolicyRef(
      @Param("versionId") Long versionId, @Param("policyCode") String policyCode);
}
