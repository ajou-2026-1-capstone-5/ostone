package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.repository.DomainPackVersionReferencePort;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

@Repository
public class JpaDomainPackVersionReferenceAdapter implements DomainPackVersionReferencePort {

  private final EntityManager entityManager;

  public JpaDomainPackVersionReferenceAdapter(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public boolean existsExternalReference(Long domainPackVersionId) {
    Object result =
        entityManager
            .createNativeQuery(
                """
                SELECT EXISTS (
                  SELECT 1 FROM review.review_session WHERE domain_pack_version_id = :versionId
                  UNION ALL
                  SELECT 1 FROM runtime.chat_session WHERE domain_pack_version_id = :versionId
                  UNION ALL
                  SELECT 1 FROM pipeline.taxonomy_drift_log WHERE from_version_id = :versionId
                  UNION ALL
                  SELECT 1 FROM pipeline.taxonomy_drift_log WHERE to_version_id = :versionId
                  LIMIT 1
                )
                """)
            .setParameter("versionId", domainPackVersionId)
            .getSingleResult();
    if (result instanceof Boolean exists) {
      return exists;
    }
    if (result instanceof Number exists) {
      return exists.longValue() > 0;
    }
    return Boolean.parseBoolean(String.valueOf(result));
  }
}
