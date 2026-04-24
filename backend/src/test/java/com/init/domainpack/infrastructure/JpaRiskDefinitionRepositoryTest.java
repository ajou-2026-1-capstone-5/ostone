package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.infrastructure.persistence.JpaRiskDefinitionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-risk;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
    })
@DisplayName("JpaRiskDefinitionRepository")
class JpaRiskDefinitionRepositoryTest extends AbstractDomainPackJpaTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private TestEntityManager em;
  @Autowired private JpaRiskDefinitionRepository repository;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() throws Exception {
    // given
    RiskDefinition entity =
        RiskDefinition.create(
            VERSION_ID,
            "risk_001",
            "사기 위험",
            null,
            "HIGH",
            "{\"field\":\"amount\"}",
            "{\"action\":\"block\"}",
            "[{\"source\":\"log\"}]",
            "{\"version\":1}");
    em.persistAndFlush(entity);
    em.clear();

    // when
    RiskDefinition found = repository.findByIdOrThrow(entity.getId());

    // then — ObjectMapper 파싱: H2의 이중 직렬화(quoted-string) 방어를 위해 TextNode 언래핑 적용
    ObjectMapper objectMapper = new ObjectMapper();

    JsonNode triggerCondition = parseJson(objectMapper, found.getTriggerConditionJson());
    assertThat(triggerCondition.path("field").asText()).isEqualTo("amount");

    JsonNode handlingAction = parseJson(objectMapper, found.getHandlingActionJson());
    assertThat(handlingAction.path("action").asText()).isEqualTo("block");

    JsonNode evidence = parseJson(objectMapper, found.getEvidenceJson());
    assertThat(evidence.isArray()).isTrue();
    assertThat(evidence.get(0).path("source").asText()).isEqualTo("log");

    JsonNode meta = parseJson(objectMapper, found.getMetaJson());
    assertThat(meta.path("version").asInt()).isEqualTo(1);
  }

  private static JsonNode parseJson(ObjectMapper om, String json) throws Exception {
    JsonNode node = om.readTree(json);
    return node.isTextual() ? om.readTree(node.asText()) : node;
  }
}
