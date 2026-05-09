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
    Number count =
        (Number)
            entityManager
                .createNativeQuery(
                    """
                    SELECT
                      (SELECT COUNT(*) FROM review.review_session WHERE domain_pack_version_id = :versionId)
                      + (SELECT COUNT(*) FROM runtime.chat_session WHERE domain_pack_version_id = :versionId)
                      + (SELECT COUNT(*) FROM pipeline.taxonomy_drift_log WHERE from_version_id = :versionId)
                      + (SELECT COUNT(*) FROM pipeline.taxonomy_drift_log WHERE to_version_id = :versionId)
                    """)
                .setParameter("versionId", domainPackVersionId)
                .getSingleResult();
    return count.longValue() > 0;
  }
}
