package com.init.pipelinejob.infrastructure.persistence;

import com.init.pipelinejob.application.DomainPackGenerationConcurrencyGuard;
import com.init.pipelinejob.domain.model.PipelineJob;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

@Component
public class PostgreSqlDomainPackGenerationConcurrencyGuard
    implements DomainPackGenerationConcurrencyGuard {

  private final EntityManager entityManager;

  public PostgreSqlDomainPackGenerationConcurrencyGuard(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public void lockTriggerCreation(Long workspaceId, Long datasetId) {
    String lockText =
        "workspace:"
            + workspaceId
            + ":dataset:"
            + datasetId
            + ":jobType:"
            + PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION;
    entityManager
        .createNativeQuery("select pg_advisory_xact_lock(hashtextextended(:lockText, 0))")
        .setParameter("lockText", lockText)
        .getSingleResult();
  }
}
