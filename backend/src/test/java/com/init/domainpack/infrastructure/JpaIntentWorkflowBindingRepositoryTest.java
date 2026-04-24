package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.infrastructure.persistence.JpaIntentWorkflowBindingRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-iworkflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
    })
@DisplayName("JpaIntentWorkflowBindingRepository")
class JpaIntentWorkflowBindingRepositoryTest extends AbstractDomainPackJpaTest {

  @Autowired private TestEntityManager em;
  @Autowired private JpaIntentWorkflowBindingRepository repository;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() {
    // given
    IntentWorkflowBinding entity = IntentWorkflowBinding.create(1L, 2L, true, "{\"priority\":1}");
    em.persistAndFlush(entity);
    em.clear();

    // when
    IntentWorkflowBinding found = repository.findById(entity.getId()).orElseThrow();

    // then
    assertThat(found.getRouteConditionJson()).contains("priority");
  }
}
