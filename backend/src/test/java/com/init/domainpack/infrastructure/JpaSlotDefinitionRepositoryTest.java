package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.SlotDefinition;
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
      "spring.datasource.url=jdbc:h2:mem:testdb-slot;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@DisplayName("JpaSlotDefinitionRepository")
class JpaSlotDefinitionRepositoryTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private TestEntityManager em;

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

    // when — SlotDefinitionRepository.findById(Long) vs CrudRepository.findById(ID) ambiguity로 em.find() 사용
    SlotDefinition found = em.find(SlotDefinition.class, entity.getId());

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

    // when — SlotDefinitionRepository.findById(Long) vs CrudRepository.findById(ID) ambiguity로 em.find() 사용
    SlotDefinition found = em.find(SlotDefinition.class, entity.getId());

    // then
    assertThat(found.getDefaultValueJson()).isNull();
  }
}
