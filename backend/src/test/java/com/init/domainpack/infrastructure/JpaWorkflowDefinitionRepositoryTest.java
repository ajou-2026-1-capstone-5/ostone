package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import com.init.domainpack.infrastructure.persistence.JpaWorkflowDefinitionRepository;
import java.util.List;
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
      "spring.datasource.url=jdbc:h2:mem:testdb-workflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@DisplayName("JpaWorkflowDefinitionRepository")
class JpaWorkflowDefinitionRepositoryTest {

  private static final Long VERSION_ID = 101L;

  @Autowired private JpaWorkflowDefinitionRepository repository;

  @Autowired private TestEntityManager em;

  @Test
  @DisplayName("findAllByDomainPackVersionIdOrderByWorkflowCodeAsc: workflowCode ASC 정렬 반환")
  void should_workflowCodeAsc정렬반환_when_역순저장() {
    // given — reverse order 저장
    em.persistAndFlush(workflow(VERSION_ID, "z_flow", "Z 플로우"));
    em.persistAndFlush(workflow(VERSION_ID, "m_flow", "M 플로우"));
    em.persistAndFlush(workflow(VERSION_ID, "a_flow", "A 플로우"));

    // when
    List<WorkflowDefinitionSummaryRow> results =
        repository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(VERSION_ID);

    // then
    assertThat(results).hasSize(3);
    assertThat(results.get(0).getWorkflowCode()).isEqualTo("a_flow");
    assertThat(results.get(1).getWorkflowCode()).isEqualTo("m_flow");
    assertThat(results.get(2).getWorkflowCode()).isEqualTo("z_flow");
  }

  @Test
  @DisplayName("findAllByDomainPackVersionIdOrderByWorkflowCodeAsc: 프로젝션 필드 정상 노출")
  void should_프로젝션필드노출_when_단건저장() {
    // given
    em.persistAndFlush(workflow(VERSION_ID, "refund_flow", "환불 플로우"));

    // when
    List<WorkflowDefinitionSummaryRow> results =
        repository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(VERSION_ID);

    // then
    assertThat(results).hasSize(1);
    WorkflowDefinitionSummaryRow row = results.get(0);
    assertThat(row.getId()).isNotNull();
    assertThat(row.getDomainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(row.getWorkflowCode()).isEqualTo("refund_flow");
    assertThat(row.getName()).isEqualTo("환불 플로우");
    assertThat(row.getCreatedAt()).isNotNull();
    assertThat(row.getUpdatedAt()).isNotNull();
  }

  @Test
  @DisplayName("findAllByDomainPackVersionIdOrderByWorkflowCodeAsc: 다른 versionId 제외")
  void should_다른버전제외_when_다른버전저장() {
    // given
    em.persistAndFlush(workflow(VERSION_ID, "refund_flow", "환불 플로우"));
    em.persistAndFlush(workflow(999L, "other_flow", "다른 버전"));

    // when
    List<WorkflowDefinitionSummaryRow> results =
        repository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(VERSION_ID);

    // then
    assertThat(results).hasSize(1);
    assertThat(results.get(0).getWorkflowCode()).isEqualTo("refund_flow");
  }

  @Test
  @DisplayName("findAllByDomainPackVersionIdOrderByWorkflowCodeAsc: workflow 없으면 빈 목록 반환")
  void should_빈목록반환_when_workflow없음() {
    List<WorkflowDefinitionSummaryRow> results =
        repository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(VERSION_ID);

    assertThat(results).isEmpty();
  }

  private WorkflowDefinition workflow(Long versionId, String code, String name) {
    return WorkflowDefinition.create(
        versionId,
        code,
        name,
        null,
        "{\"direction\":\"LR\",\"nodes\":[],\"edges\":[]}",
        "start",
        "[\"done\"]",
        "[]",
        "{}");
  }
}
