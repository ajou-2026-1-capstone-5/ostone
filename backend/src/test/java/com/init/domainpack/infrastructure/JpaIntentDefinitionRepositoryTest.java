package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.infrastructure.persistence.JpaIntentDefinitionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-intent;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
    })
@DisplayName("JpaIntentDefinitionRepository")
class JpaIntentDefinitionRepositoryTest extends AbstractDomainPackJpaTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private TestEntityManager em;
  @Autowired private JpaIntentDefinitionRepository repository;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() {
    // given
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

    // when
    IntentDefinition found = repository.findByIdAndDomainPackVersionId(
        entity.getId(), VERSION_ID).orElseThrow();

    // then
    assertThat(found.getSourceClusterRef()).contains("cluster");
    assertThat(found.getEntryConditionJson()).contains("condition");
    assertThat(found.getEvidenceJson()).contains("log");
    assertThat(found.getMetaJson()).contains("version");
  }
}
