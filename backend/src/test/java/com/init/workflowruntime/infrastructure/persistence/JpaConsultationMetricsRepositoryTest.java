package com.init.workflowruntime.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.ConsultationMetricsSessionFact;
import jakarta.persistence.EntityManager;
import java.time.Duration;
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
@Import(JpaConsultationMetricsRepository.class)
@DisplayName("JpaConsultationMetricsRepository")
class JpaConsultationMetricsRepositoryTest {

  private static final OffsetDateTime PERIOD_START =
      OffsetDateTime.parse("2026-05-27T00:00:00+09:00");
  private static final OffsetDateTime PERIOD_END =
      OffsetDateTime.parse("2026-05-28T00:00:00+09:00");

  @Autowired private JpaConsultationMetricsRepository repository;

  @Autowired private EntityManager entityManager;

  @Test
  @DisplayName("findSessionFacts: 오늘 시작 세션의 첫응답과 오늘 종료 세션의 처리 분류를 집계한다")
  void should_findSessionFacts_when_sessionsStartedOrCompletedToday() {
    Long workspaceId = persistWorkspaceAndVersion();

    Long llmOnlySessionId =
        persistSession(
            workspaceId,
            ChatSessionStatus.COMPLETED,
            at("2026-05-27T09:00:00+09:00"),
            at("2026-05-27T09:05:00+09:00"));
    persistMessage(llmOnlySessionId, 1, "USER", at("2026-05-27T09:00:00+09:00"));
    persistMessage(llmOnlySessionId, 2, "ASSISTANT", at("2026-05-27T09:00:03+09:00"));
    Long llmOnlyExecutionId = persistExecution(llmOnlySessionId, 30L, 40L);
    persistDecisionLog(llmOnlyExecutionId, 1, "INTENT_SELECTED", 40L, 0.92, "ASSIGN_WORKFLOW");
    persistWorkflowMatchDecision(
        llmOnlySessionId, "CONFIDENT", 0.92, 30L, 40L, at("2026-05-27T09:00:01+09:00"));

    Long mixedSessionId =
        persistSession(
            workspaceId,
            ChatSessionStatus.COMPLETED,
            at("2026-05-27T11:00:00+09:00"),
            at("2026-05-27T11:10:00+09:00"));
    persistMessage(mixedSessionId, 1, "CUSTOMER", at("2026-05-27T11:00:00+09:00"));
    persistMessage(mixedSessionId, 2, "ASSISTANT", at("2026-05-27T11:00:02+09:00"));
    persistMessage(mixedSessionId, 3, "AGENT", at("2026-05-27T11:05:00+09:00"));
    Long mixedExecutionId = persistExecution(mixedSessionId, 30L, 40L);
    persistDecisionLog(mixedExecutionId, 1, "INTENT_SELECTED", 40L, 0.63, "HANDOFF");
    persistWorkflowMatchDecision(
        mixedSessionId, "AMBIGUOUS", 0.63, 30L, 40L, at("2026-05-27T11:00:01+09:00"));

    Long oldHumanCompletedSessionId =
        persistSession(
            workspaceId,
            ChatSessionStatus.COMPLETED,
            at("2026-05-26T15:00:00+09:00"),
            at("2026-05-27T12:00:00+09:00"));
    persistMessage(oldHumanCompletedSessionId, 1, "USER", at("2026-05-26T15:00:00+09:00"));
    persistMessage(oldHumanCompletedSessionId, 2, "COUNSELOR", at("2026-05-26T15:02:00+09:00"));

    Long resolvedTodaySessionId =
        persistResolvedSession(
            workspaceId, at("2026-05-26T16:00:00+09:00"), at("2026-05-27T13:00:00+09:00"));
    persistMessage(resolvedTodaySessionId, 1, "CUSTOMER", at("2026-05-26T16:00:00+09:00"));
    persistMessage(resolvedTodaySessionId, 2, "AGENT", at("2026-05-26T16:01:00+09:00"));

    Long oldResolvedSessionId =
        persistResolvedSession(
            workspaceId, at("2026-05-26T17:00:00+09:00"), at("2026-05-26T18:00:00+09:00"));
    persistMessage(oldResolvedSessionId, 1, "CUSTOMER", at("2026-05-26T17:00:00+09:00"));
    persistMessage(oldResolvedSessionId, 2, "AGENT", at("2026-05-26T17:01:00+09:00"));

    Long openTodaySessionId =
        persistSession(workspaceId, ChatSessionStatus.OPEN, at("2026-05-27T14:00:00+09:00"), null);
    persistMessage(openTodaySessionId, 1, "CUSTOMER", at("2026-05-27T14:00:00+09:00"));
    persistWorkflowMatchDecision(
        openTodaySessionId, "UNKNOWN", 0.05, null, null, at("2026-05-27T14:00:01+09:00"));

    Long demoSessionId =
        persistSession(
            workspaceId,
            ChatSessionStatus.COMPLETED,
            "DEMO_WEB",
            at("2026-05-27T15:00:00+09:00"),
            at("2026-05-27T15:05:00+09:00"));
    persistMessage(demoSessionId, 1, "CUSTOMER", at("2026-05-27T15:00:00+09:00"));
    persistMessage(demoSessionId, 2, "ASSISTANT", at("2026-05-27T15:00:03+09:00"));

    persistSession(workspaceId, ChatSessionStatus.OPEN, at("2026-05-26T16:00:00+09:00"), null);

    List<ConsultationMetricsSessionFact> facts =
        repository.findSessionFacts(workspaceId, PERIOD_START, PERIOD_END);
    Map<Long, ConsultationMetricsSessionFact> bySessionId =
        facts.stream()
            .collect(
                Collectors.toMap(ConsultationMetricsSessionFact::sessionId, Function.identity()));

    assertThat(bySessionId)
        .containsOnlyKeys(
            llmOnlySessionId,
            mixedSessionId,
            oldHumanCompletedSessionId,
            resolvedTodaySessionId,
            openTodaySessionId);
    assertThat(
            Duration.between(
                    bySessionId.get(llmOnlySessionId).firstCustomerAt(),
                    bySessionId.get(llmOnlySessionId).firstResponseAt())
                .getSeconds())
        .isEqualTo(3);
    assertThat(
            Duration.between(
                    bySessionId.get(llmOnlySessionId).firstCustomerAt(),
                    bySessionId.get(llmOnlySessionId).firstLlmResponseAt())
                .getSeconds())
        .isEqualTo(3);
    assertThat(bySessionId.get(llmOnlySessionId).firstHumanResponseAt()).isNull();
    assertThat(bySessionId.get(llmOnlySessionId).startedInPeriod()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).handledInPeriod()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).unresolvedInPeriod()).isFalse();
    assertThat(bySessionId.get(llmOnlySessionId).hasLlmMessage()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).hasHumanMessage()).isFalse();
    assertThat(bySessionId.get(llmOnlySessionId).workflowMatched()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).intentClassified()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).lowConfidence()).isFalse();
    assertThat(bySessionId.get(llmOnlySessionId).unmatched()).isFalse();
    assertThat(bySessionId.get(llmOnlySessionId).coverageLogAvailable()).isTrue();

    assertThat(
            Duration.between(
                    bySessionId.get(mixedSessionId).firstCustomerAt(),
                    bySessionId.get(mixedSessionId).firstResponseAt())
                .getSeconds())
        .isEqualTo(2);
    assertThat(
            Duration.between(
                    bySessionId.get(mixedSessionId).firstCustomerAt(),
                    bySessionId.get(mixedSessionId).firstHumanResponseAt())
                .getSeconds())
        .isEqualTo(300);
    assertThat(bySessionId.get(mixedSessionId).hasLlmMessage()).isTrue();
    assertThat(bySessionId.get(mixedSessionId).hasHumanMessage()).isTrue();
    assertThat(bySessionId.get(mixedSessionId).handoffSelected()).isTrue();
    assertThat(bySessionId.get(mixedSessionId).workflowMatched()).isTrue();
    assertThat(bySessionId.get(mixedSessionId).intentClassified()).isTrue();
    assertThat(bySessionId.get(mixedSessionId).lowConfidence()).isTrue();
    assertThat(bySessionId.get(mixedSessionId).coverageLogAvailable()).isTrue();

    assertThat(bySessionId.get(oldHumanCompletedSessionId).firstCustomerAt()).isNull();
    assertThat(bySessionId.get(oldHumanCompletedSessionId).startedInPeriod()).isFalse();
    assertThat(bySessionId.get(oldHumanCompletedSessionId).handledInPeriod()).isTrue();
    assertThat(bySessionId.get(oldHumanCompletedSessionId).hasHumanMessage()).isTrue();

    assertThat(bySessionId.get(resolvedTodaySessionId).firstCustomerAt()).isNull();
    assertThat(bySessionId.get(resolvedTodaySessionId).handledInPeriod()).isTrue();
    assertThat(bySessionId.get(resolvedTodaySessionId).hasHumanMessage()).isTrue();
    assertThat(bySessionId.get(openTodaySessionId).startedInPeriod()).isTrue();
    assertThat(bySessionId.get(openTodaySessionId).handledInPeriod()).isFalse();
    assertThat(bySessionId.get(openTodaySessionId).unresolvedInPeriod()).isTrue();
    assertThat(bySessionId.get(openTodaySessionId).workflowMatched()).isFalse();
    assertThat(bySessionId.get(openTodaySessionId).intentClassified()).isFalse();
    assertThat(bySessionId.get(openTodaySessionId).unmatched()).isTrue();
    assertThat(bySessionId.get(openTodaySessionId).coverageLogAvailable()).isTrue();
    assertThat(bySessionId).doesNotContainKey(oldResolvedSessionId);
    assertThat(bySessionId).doesNotContainKey(demoSessionId);
  }

  private Long persistWorkspaceAndVersion() {
    createWorkflowMatchDecisionTable();
    update(
        """
        insert into app.workspace
          (id, workspace_key, name, status, free_onboarding_status, created_at, updated_at)
        values (2, 'consultation-metrics', 'Consultation Metrics', 'ACTIVE', 'AVAILABLE', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.domain_pack
          (id, workspace_id, pack_key, name, status, created_at, updated_at)
        values (10, 2, 'consultation-metrics-pack', 'Metrics Pack', 'ACTIVE', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.domain_pack_version
          (id, domain_pack_id, version_no, lifecycle_status, summary_json, created_at, updated_at, version)
        values (20, 10, 1, 'DRAFT', '{}', :now, :now, 0)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.intent_definition
          (id, domain_pack_version_id, intent_code, name, taxonomy_level, status,
           source_cluster_ref, entry_condition_json, evidence_json, meta_json, created_at, updated_at)
        values (40, 20, 'refund', 'Refund', 1, 'PUBLISHED',
                '{}', '{}', '[]', '{}', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    update(
        """
        insert into pack.workflow_definition
          (id, domain_pack_version_id, intent_definition_id, workflow_code, name, graph_json,
           is_primary, route_condition_json, terminal_states_json, evidence_json, meta_json,
           created_at, updated_at)
        values (30, 20, 40, 'refund-flow', 'Refund Flow', '{}',
                true, '{}', '[]', '[]', '{}', :now, :now)
        """,
        Map.of("now", PERIOD_START));
    return 2L;
  }

  private void createWorkflowMatchDecisionTable() {
    update(
        """
        create table if not exists runtime.workflow_match_decision (
          id bigint not null primary key,
          chat_session_id bigint not null,
          domain_pack_version_id bigint not null,
          selected_workflow_id bigint,
          selected_intent_id bigint,
          status varchar(50) not null,
          confidence_score double precision not null,
          redacted_text_hash varchar(64) not null,
          threshold_json jsonb not null,
          score_breakdown_json jsonb not null,
          top_candidates_json jsonb not null,
          created_at timestamp(6) with time zone not null
        )
        """,
        Map.of());
  }

  private Long persistSession(
      Long workspaceId,
      ChatSessionStatus status,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt) {
    return persistSession(workspaceId, status, "WEB", startedAt, endedAt, "{}");
  }

  private Long persistSession(
      Long workspaceId,
      ChatSessionStatus status,
      String channel,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt) {
    return persistSession(workspaceId, status, channel, startedAt, endedAt, "{}");
  }

  private Long persistResolvedSession(
      Long workspaceId, OffsetDateTime startedAt, OffsetDateTime resolvedAt) {
    String metaJson =
        """
        {"resolution":{"outcome":"RESOLVED","label":"해결됨","status":"RESOLVED","resolvedAt":"%s"}}
        """
            .formatted(resolvedAt);
    return persistSession(
        workspaceId, ChatSessionStatus.RESOLVED, "WEB", startedAt, null, metaJson);
  }

  private Long persistSession(
      Long workspaceId,
      ChatSessionStatus status,
      String channel,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt,
      String metaJson) {
    Long sessionId =
        ((Number)
                entityManager
                    .createNativeQuery("select coalesce(max(id), 0) + 1 from runtime.chat_session")
                    .getSingleResult())
            .longValue();
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.chat_session
              (id, workspace_id, domain_pack_version_id, status, channel, meta_json,
               response_mode, started_at, ended_at)
            values (:id, :workspaceId, 20, :status, :channel, cast(:metaJson as jsonb),
                    'AI_ACTIVE', :startedAt, :endedAt)
            """);
    query.setParameter("id", sessionId);
    query.setParameter("workspaceId", workspaceId);
    query.setParameter("status", status.name());
    query.setParameter("channel", channel);
    query.setParameter("metaJson", metaJson);
    query.setParameter("startedAt", startedAt);
    query.setParameter("endedAt", endedAt);
    query.executeUpdate();
    return sessionId;
  }

  private void persistMessage(
      Long sessionId, int seqNo, String senderRole, OffsetDateTime createdAt) {
    Long messageId =
        ((Number)
                entityManager
                    .createNativeQuery("select coalesce(max(id), 0) + 1 from runtime.chat_message")
                    .getSingleResult())
            .longValue();
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.chat_message
              (id, chat_session_id, seq_no, sender_role, message_type, content, payload_json, created_at)
            values (:id, :sessionId, :seqNo, :senderRole, 'TEXT', :senderRole, '{}', :createdAt)
            """);
    query.setParameter("id", messageId);
    query.setParameter("sessionId", sessionId);
    query.setParameter("seqNo", seqNo);
    query.setParameter("senderRole", senderRole);
    query.setParameter("createdAt", createdAt);
    query.executeUpdate();
  }

  private Long persistExecution(
      Long sessionId, Long workflowDefinitionId, Long intentDefinitionId) {
    Long executionId =
        ((Number)
                entityManager
                    .createNativeQuery(
                        "select coalesce(max(id), 0) + 1 from runtime.workflow_execution")
                    .getSingleResult())
            .longValue();
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.workflow_execution
              (id, chat_session_id, workflow_definition_id, intent_definition_id, status,
               current_state, slot_values_json, policy_snapshot_json, risk_snapshot_json, started_at)
            values (:id, :sessionId, :workflowDefinitionId, :intentDefinitionId, 'RUNNING',
                    'start', '{}', '{}', '{}', :startedAt)
            """);
    query.setParameter("id", executionId);
    query.setParameter("sessionId", sessionId);
    query.setParameter("workflowDefinitionId", workflowDefinitionId);
    query.setParameter("intentDefinitionId", intentDefinitionId);
    query.setParameter("startedAt", PERIOD_START);
    query.executeUpdate();
    return executionId;
  }

  private void persistDecisionLog(
      Long executionId,
      int stepSeqNo,
      String decisionType,
      Long intentDefinitionId,
      Double confidenceScore,
      String selectedAction) {
    Long decisionLogId =
        ((Number)
                entityManager
                    .createNativeQuery("select coalesce(max(id), 0) + 1 from runtime.decision_log")
                    .getSingleResult())
            .longValue();
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.decision_log
              (id, workflow_execution_id, step_seq_no, decision_type, intent_definition_id,
               state_name, confidence_score, selected_action, missing_slots_json, policy_hits_json,
               risk_hits_json, evidence_json, payload_json, created_at)
            values (:id, :executionId, :stepSeqNo, :decisionType, :intentDefinitionId,
                    'start', :confidenceScore, :selectedAction, '[]', '[]', '[]', '[]', '{}',
                    :createdAt)
            """);
    query.setParameter("id", decisionLogId);
    query.setParameter("executionId", executionId);
    query.setParameter("stepSeqNo", stepSeqNo);
    query.setParameter("decisionType", decisionType);
    query.setParameter("intentDefinitionId", intentDefinitionId);
    query.setParameter("confidenceScore", confidenceScore);
    query.setParameter("selectedAction", selectedAction);
    query.setParameter("createdAt", PERIOD_START);
    query.executeUpdate();
  }

  private void persistWorkflowMatchDecision(
      Long sessionId,
      String status,
      double confidenceScore,
      Long workflowDefinitionId,
      Long intentDefinitionId,
      OffsetDateTime createdAt) {
    Long decisionId =
        ((Number)
                entityManager
                    .createNativeQuery(
                        "select coalesce(max(id), 0) + 1 from runtime.workflow_match_decision")
                    .getSingleResult())
            .longValue();
    var query =
        entityManager.createNativeQuery(
            """
            insert into runtime.workflow_match_decision
              (id, chat_session_id, domain_pack_version_id, selected_workflow_id,
               selected_intent_id, status, confidence_score, redacted_text_hash, threshold_json,
               score_breakdown_json, top_candidates_json, created_at)
            values (:id, :sessionId, 20, :workflowDefinitionId, :intentDefinitionId, :status,
                    :confidenceScore, :hash, '{}', '{}', '[]', :createdAt)
            """);
    query.setParameter("id", decisionId);
    query.setParameter("sessionId", sessionId);
    query.setParameter("workflowDefinitionId", workflowDefinitionId);
    query.setParameter("intentDefinitionId", intentDefinitionId);
    query.setParameter("status", status);
    query.setParameter("confidenceScore", confidenceScore);
    query.setParameter("hash", "hash-%s".formatted(decisionId));
    query.setParameter("createdAt", createdAt);
    query.executeUpdate();
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
