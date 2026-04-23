package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.infrastructure.persistence.JpaPolicyDefinitionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-policy;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
    })
@DisplayName("JpaPolicyDefinitionRepository")
class JpaPolicyDefinitionRepositoryTest extends AbstractDomainPackJpaTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private TestEntityManager em;
  @Autowired private JpaPolicyDefinitionRepository repository;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() {
    // given
    PolicyDefinition entity =
        PolicyDefinition.create(
            VERSION_ID,
            "policy_001",
            "환불 정책",
            null,
            "HIGH",
            "{\"field\":\"amount\"}",
            "{\"type\":\"refund\"}",
            "[{\"source\":\"log\"}]",
            "{\"version\":1}");
    em.persistAndFlush(entity);
    em.clear();

    // when
    PolicyDefinition found = repository.findByIdOrThrow(entity.getId());

    // then
    assertThat(found.getConditionJson()).contains("field");
    assertThat(found.getActionJson()).contains("type");
    assertThat(found.getEvidenceJson()).contains("source");
    assertThat(found.getMetaJson()).contains("version");
  }
}
