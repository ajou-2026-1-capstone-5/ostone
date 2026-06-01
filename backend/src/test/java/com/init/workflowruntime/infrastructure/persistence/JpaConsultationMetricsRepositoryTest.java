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

    Long mixedSessionId =
        persistSession(
            workspaceId,
            ChatSessionStatus.COMPLETED,
            at("2026-05-27T11:00:00+09:00"),
            at("2026-05-27T11:10:00+09:00"));
    persistMessage(mixedSessionId, 1, "CUSTOMER", at("2026-05-27T11:00:00+09:00"));
    persistMessage(mixedSessionId, 2, "ASSISTANT", at("2026-05-27T11:00:02+09:00"));
    persistMessage(mixedSessionId, 3, "AGENT", at("2026-05-27T11:05:00+09:00"));

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

    persistSession(workspaceId, ChatSessionStatus.OPEN, at("2026-05-26T16:00:00+09:00"), null);

    List<ConsultationMetricsSessionFact> facts =
        repository.findSessionFacts(workspaceId, PERIOD_START, PERIOD_END);
    Map<Long, ConsultationMetricsSessionFact> bySessionId =
        facts.stream()
            .collect(
                Collectors.toMap(ConsultationMetricsSessionFact::sessionId, Function.identity()));

    assertThat(bySessionId)
        .containsOnlyKeys(
            llmOnlySessionId, mixedSessionId, oldHumanCompletedSessionId, resolvedTodaySessionId);
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
    assertThat(bySessionId.get(llmOnlySessionId).handledToday()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).hasLlmMessage()).isTrue();
    assertThat(bySessionId.get(llmOnlySessionId).hasHumanMessage()).isFalse();

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

    assertThat(bySessionId.get(oldHumanCompletedSessionId).firstCustomerAt()).isNull();
    assertThat(bySessionId.get(oldHumanCompletedSessionId).handledToday()).isTrue();
    assertThat(bySessionId.get(oldHumanCompletedSessionId).hasHumanMessage()).isTrue();

    assertThat(bySessionId.get(resolvedTodaySessionId).firstCustomerAt()).isNull();
    assertThat(bySessionId.get(resolvedTodaySessionId).handledToday()).isTrue();
    assertThat(bySessionId.get(resolvedTodaySessionId).hasHumanMessage()).isTrue();
    assertThat(bySessionId).doesNotContainKey(oldResolvedSessionId);
  }

  private Long persistWorkspaceAndVersion() {
    update(
        """
        insert into app.workspace (id, workspace_key, name, status, created_at, updated_at)
        values (2, 'consultation-metrics', 'Consultation Metrics', 'ACTIVE', :now, :now)
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
    return 2L;
  }

  private Long persistSession(
      Long workspaceId,
      ChatSessionStatus status,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt) {
    return persistSession(workspaceId, status, startedAt, endedAt, "{}");
  }

  private Long persistResolvedSession(
      Long workspaceId, OffsetDateTime startedAt, OffsetDateTime resolvedAt) {
    String metaJson =
        """
        {"resolution":{"outcome":"RESOLVED","label":"해결됨","status":"RESOLVED","resolvedAt":"%s"}}
        """
            .formatted(resolvedAt);
    return persistSession(workspaceId, ChatSessionStatus.RESOLVED, startedAt, null, metaJson);
  }

  private Long persistSession(
      Long workspaceId,
      ChatSessionStatus status,
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
              (id, workspace_id, domain_pack_version_id, status, channel, meta_json, response_mode, started_at, ended_at)
            values (:id, :workspaceId, 20, :status, 'WEB', cast(:metaJson as jsonb), 'AI_ACTIVE', :startedAt, :endedAt)
            """);
    query.setParameter("id", sessionId);
    query.setParameter("workspaceId", workspaceId);
    query.setParameter("status", status.name());
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

  private void update(String sql, Map<String, Object> params) {
    var query = entityManager.createNativeQuery(sql);
    params.forEach(query::setParameter);
    query.executeUpdate();
  }

  private OffsetDateTime at(String value) {
    return OffsetDateTime.parse(value);
  }
}
