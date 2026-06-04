package com.init.workflowruntime.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowRankingExecutionRow;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(JpaWorkflowRankingRepository.class)
@DisplayName("JpaWorkflowRankingRepository")
class JpaWorkflowRankingRepositoryTest {

  private static final OffsetDateTime PERIOD_START =
      OffsetDateTime.parse("2026-05-27T00:00:00+09:00");
  private static final OffsetDateTime PERIOD_END =
      OffsetDateTime.parse("2026-05-28T00:00:00+09:00");

  @Autowired private JpaWorkflowRankingRepository repository;

  @Autowired private EntityManager entityManager;

  @Test
  @DisplayName("findExecutionRows: 운영 실행만 조회하고 미연결 정의도 유지한다")
  void should_findExecutionRows_when_operationalWorkflowExecutionsExist() {
    Long workspaceId = persistWorkspaceAndWorkflow();

    Long refundSessionId = persistSession(workspaceId, "WEB", "COMPLETED", 22L);
    persistMessage(refundSessionId, 1, "CUSTOMER");
    persistMessage(refundSessionId, 2, "AGENT");
    Long refundExecutionId =
        persistExecution(
            refundSessionId,
            100L,
            WorkflowExecution.STATUS_COMPLETED,
            at("2026-05-27T09:00:00+09:00"),
            at("2026-05-27T09:03:00+09:00"));

    Long unknownSessionId = persistSession(workspaceId, "WEB", "OPEN", 22L);
    Long unknownExecutionId =
        persistExecution(
            unknownSessionId,
            null,
            WorkflowExecution.STATUS_RUNNING,
            at("2026-05-27T10:00:00+09:00"),
            null);

    Long simulationSessionId = persistSession(workspaceId, "SIMULATION_WEB", "COMPLETED", 22L);
    persistExecution(
        simulationSessionId,
        100L,
        WorkflowExecution.STATUS_COMPLETED,
        at("2026-05-27T11:00:00+09:00"),
        at("2026-05-27T11:01:00+09:00"));

    assertThat(repository.countOperationalConsultations(workspaceId, PERIOD_START, PERIOD_END))
        .isEqualTo(2L);

    List<WorkflowRankingExecutionRow> rows =
        repository.findExecutionRows(workspaceId, PERIOD_START, PERIOD_END);
    Map<Long, WorkflowRankingExecutionRow> byExecutionId =
        rows.stream()
            .collect(
                Collectors.toMap(WorkflowRankingExecutionRow::executionId, Function.identity()));

    assertThat(byExecutionId).containsOnlyKeys(refundExecutionId, unknownExecutionId);
    assertThat(byExecutionId.get(refundExecutionId).workflowDefinitionId()).isEqualTo(100L);
    assertThat(byExecutionId.get(refundExecutionId).domainPackId()).isEqualTo(11L);
    assertThat(byExecutionId.get(refundExecutionId).domainPackVersionId()).isEqualTo(22L);
    assertThat(byExecutionId.get(refundExecutionId).workflowCode()).isEqualTo("refund_flow");
    assertThat(byExecutionId.get(refundExecutionId).workflowName()).isEqualTo("환불 처리");
    assertThat(byExecutionId.get(refundExecutionId).hasHumanMessage()).isTrue();
    assertThat(byExecutionId.get(unknownExecutionId).workflowDefinitionId()).isNull();
    assertThat(byExecutionId.get(unknownExecutionId).workflowName()).isNull();
  }

  private Long persistWorkspaceAndWorkflow() {
    update(
        """
        insert into app.workspace
          (id, workspace_key, name, status, free_onboarding_status, created_at, updated_at)
        values (2, 'workflow-ranking', 'Workflow Ranking', 'ACTIVE', 'AVAILABLE', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.domain_pack
          (id, workspace_id, pack_key, name, status, created_at, updated_at)
        values (11, 2, 'workflow-ranking-pack', 'Workflow Ranking Pack', 'ACTIVE', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.domain_pack_version
          (id, domain_pack_id, version_no, lifecycle_status, summary_json,
           created_at, updated_at, version)
        values (22, 11, 1, 'PUBLISHED', '{}', :now, :now, 0)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.intent_definition
          (id, domain_pack_version_id, intent_code, name, taxonomy_level, status,
           source_cluster_ref,
           entry_condition_json, evidence_json, meta_json, created_at, updated_at)
        values (33, 22, 'refund', '환불', 1, 'PUBLISHED', '{}', '{}', '[]', '{}', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.workflow_definition
          (id, domain_pack_version_id, intent_definition_id, workflow_code, name, graph_json,
           terminal_states_json, is_primary, route_condition_json, evidence_json, meta_json,
           created_at, updated_at)
        values (100, 22, 33, 'refund_flow', '환불 처리', '{}', '[]', true, '{}', '[]', '{}',
                :now, :now)
        """,
        Map.of("now", PERIOD_START));
    return 2L;
  }

  private Long persistSession(
      Long workspaceId, String channel, String status, Long domainPackVersionId) {
    Long sessionId = nextId("runtime.chat_session");
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.chat_session
              (id, workspace_id, domain_pack_version_id, status, channel, meta_json, response_mode,
               started_at, ended_at)
            values (:id, :workspaceId, :domainPackVersionId, :status, :channel, '{}', 'AI_ACTIVE',
                    :startedAt, :endedAt)
            """);
    query.setParameter("id", sessionId);
    query.setParameter("workspaceId", workspaceId);
    query.setParameter("domainPackVersionId", domainPackVersionId);
    query.setParameter("status", status);
    query.setParameter("channel", channel);
    query.setParameter("startedAt", at("2026-05-27T09:00:00+09:00"));
    query.setParameter(
        "endedAt", "COMPLETED".equals(status) ? at("2026-05-27T09:05:00+09:00") : null);
    query.executeUpdate();
    return sessionId;
  }

  private Long persistExecution(
      Long sessionId,
      Long workflowDefinitionId,
      String status,
      OffsetDateTime startedAt,
      OffsetDateTime finishedAt) {
    Long executionId = nextId("runtime.workflow_execution");
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.workflow_execution
              (id, chat_session_id, workflow_definition_id, status, slot_values_json,
               policy_snapshot_json, risk_snapshot_json, started_at, finished_at)
            values (:id, :sessionId, :workflowDefinitionId, :status, '{}', '{}', '{}',
                    :startedAt, :finishedAt)
            """);
    query.setParameter("id", executionId);
    query.setParameter("sessionId", sessionId);
    query.setParameter("workflowDefinitionId", workflowDefinitionId);
    query.setParameter("status", status);
    query.setParameter("startedAt", startedAt);
    query.setParameter("finishedAt", finishedAt);
    query.executeUpdate();
    return executionId;
  }

  private void persistMessage(Long sessionId, int seqNo, String senderRole) {
    Long messageId = nextId("runtime.chat_message");
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.chat_message
              (id, chat_session_id, seq_no, sender_role, message_type, content, payload_json,
               created_at)
            values (:id, :sessionId, :seqNo, :senderRole, 'TEXT', :senderRole, '{}', :createdAt)
            """);
    query.setParameter("id", messageId);
    query.setParameter("sessionId", sessionId);
    query.setParameter("seqNo", seqNo);
    query.setParameter("senderRole", senderRole);
    query.setParameter("createdAt", at("2026-05-27T09:01:00+09:00"));
    query.executeUpdate();
  }

  private Long nextId(String table) {
    return ((Number)
            entityManager
                .createNativeQuery("select coalesce(max(id), 0) + 1 from " + table)
                .getSingleResult())
        .longValue();
  }

  private void update(String sql, Map<String, Object> params) {
    var query = entityManager.createNativeQuery(sql);
    params.forEach(query::setParameter);
    query.executeUpdate();
  }

  private OffsetDateTime at(String value) {
    return OffsetDateTime.parse(value);
  }
}
