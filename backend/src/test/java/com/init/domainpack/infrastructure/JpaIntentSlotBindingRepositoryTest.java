package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.infrastructure.persistence.JpaIntentSlotBindingRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-islot;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE"
    })
@DisplayName("JpaIntentSlotBindingRepository")
class JpaIntentSlotBindingRepositoryTest extends AbstractDomainPackJpaTest {

  @Autowired private TestEntityManager em;
  @Autowired private JpaIntentSlotBindingRepository repository;

  @Test
  @DisplayName("JSONB 필드 persist → flush → find 후 값 보존")
  void should_jsonb필드보존_when_저장후조회() {
    // given
    IntentSlotBinding entity =
        IntentSlotBinding.create(1L, 2L, true, 1, "주문번호를 입력해주세요", "{\"required\":true}");
    em.persistAndFlush(entity);
    em.clear();

    // when
    IntentSlotBinding found = repository.findById(entity.getId()).orElseThrow();

    // then
    assertThat(found.getConditionJson()).contains("required");
  }
}
