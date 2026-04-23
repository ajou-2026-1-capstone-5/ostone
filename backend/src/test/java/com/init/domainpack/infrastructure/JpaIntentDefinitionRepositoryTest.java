package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.IntentDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-intent;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@DisplayName("JpaIntentDefinitionRepository")
class JpaIntentDefinitionRepositoryTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private TestEntityManager em;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() {
    IntentDefinition entity =
        IntentDefinition.create(
            VERSION_ID,
            "intent_001",
            "환불 의도",
            null,
            1,
            "{\"cluster\":\"refund\"}",
            "{\"condition\":\"always\"}",
            "[{\"log\":\"entry\"}]",
            "{\"version\":1}");

    em.persistAndFlush(entity);
    em.clear();

    IntentDefinition found = em.find(IntentDefinition.class, entity.getId());
    assertThat(found).isNotNull();
    assertThat(found.getSourceClusterRef()).isNotNull();
    assertThat(found.getEntryConditionJson()).isNotNull();
    assertThat(found.getEvidenceJson()).isNotNull();
    assertThat(found.getMetaJson()).isNotNull();
  }
}
