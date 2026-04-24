package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
  void should_jsonb필드보존_when_저장후조회() throws Exception {
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

    // then — ObjectMapper 파싱: H2의 이중 직렬화(quoted-string) 방어를 위해 TextNode 언래핑 적용
    ObjectMapper objectMapper = new ObjectMapper();

    JsonNode condition = parseJson(objectMapper, found.getConditionJson());
    assertThat(condition.path("field").asText()).isEqualTo("amount");

    JsonNode action = parseJson(objectMapper, found.getActionJson());
    assertThat(action.path("type").asText()).isEqualTo("refund");

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
