package com.init.domainpack.infrastructure.persistence;

import jakarta.persistence.EntityManager;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class IntentDefinitionStatusPreflight implements ApplicationRunner {

  private final EntityManager entityManager;

  public IntentDefinitionStatusPreflight(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  @Transactional(readOnly = true)
  public void run(ApplicationArguments args) {
    Number tableCount =
        (Number)
            entityManager
                .createNativeQuery(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE lower(table_schema) = 'pack'
                      AND lower(table_name) = 'intent_definition'
                    """)
                .getSingleResult();
    if (tableCount.longValue() == 0) {
      return;
    }
    Number activeCount =
        (Number)
            entityManager
                .createNativeQuery(
                    "SELECT COUNT(*) FROM pack.intent_definition WHERE status = 'ACTIVE'")
                .getSingleResult();
    if (activeCount.longValue() > 0) {
      throw new IllegalStateException(
          "Legacy ACTIVE intent_definition rows remain. Run the status normalization migration first.");
    }
  }
}
