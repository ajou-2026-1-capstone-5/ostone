package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.infrastructure.persistence.JpaSlotDefinitionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-slot;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
    })
@DisplayName("JpaSlotDefinitionRepository")
class JpaSlotDefinitionRepositoryTest extends AbstractDomainPackJpaTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private TestEntityManager em;
  @Autowired private JpaSlotDefinitionRepository repository;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() {
    // given
    SlotDefinition entity =
        SlotDefinition.create(
            VERSION_ID,
            "slot_001",
            "주문번호",
            null,
            "STRING",
            false,
            "{\"minLength\":1}",
            "{\"value\":\"default\"}",
            "{\"version\":1}");
    em.persistAndFlush(entity);
    em.clear();

    // when
    SlotDefinition found = repository.findByIdOrThrow(entity.getId());

    // then
    assertThat(found.getValidationRuleJson()).contains("minLength");
    assertThat(found.getDefaultValueJson()).contains("value");
    assertThat(found.getMetaJson()).contains("version");
  }

  @Test
  @DisplayName("defaultValueJson null 저장 → 조회 시 null 반환")
  void should_null반환_when_defaultValueJson이null() {
    // given
    SlotDefinition entity =
        SlotDefinition.create(
            VERSION_ID, "slot_002", "선택값", null, "STRING", false, "{}", null, "{}");
    em.persistAndFlush(entity);
    em.clear();

    // when
    SlotDefinition found = repository.findByIdOrThrow(entity.getId());

    // then
    assertThat(found.getDefaultValueJson()).isNull();
  }
}
