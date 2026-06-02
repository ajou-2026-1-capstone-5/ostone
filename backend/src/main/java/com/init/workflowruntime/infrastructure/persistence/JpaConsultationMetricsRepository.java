package com.init.workflowruntime.infrastructure.persistence;

import static com.init.shared.infrastructure.persistence.NativeQueryColumnConverter.toLong;
import static com.init.shared.infrastructure.persistence.NativeQueryColumnConverter.toOffsetDateTime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.ConsultationMetricsRepository;
import com.init.workflowruntime.domain.ConsultationMetricsSessionFact;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Repository;

@Repository
public class JpaConsultationMetricsRepository implements ConsultationMetricsRepository {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private final EntityManager entityManager;

  public JpaConsultationMetricsRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public List<ConsultationMetricsSessionFact> findSessionFacts(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    Query query =
        entityManager.createNativeQuery(
            """
            with scoped_sessions as (
              select
                cs.id,
                cs.status,
                cs.started_at,
                cs.ended_at,
                cs.meta_json
              from runtime.chat_session cs
              where cs.workspace_id = :workspaceId
                and (
                  (cs.started_at >= :periodStart and cs.started_at < :periodEnd)
                  or (cs.ended_at >= :periodStart and cs.ended_at < :periodEnd and cs.status = 'COMPLETED')
                  or cs.status = 'RESOLVED'
                )
            ),
            first_customer as (
              select ss.id as session_id, min(cm.created_at) as first_customer_at
              from scoped_sessions ss
              join runtime.chat_message cm on cm.chat_session_id = ss.id
              where ss.started_at >= :periodStart
                and ss.started_at < :periodEnd
                and cm.sender_role in ('USER', 'CUSTOMER')
              group by ss.id
            )
            select
              ss.id as session_id,
              fc.first_customer_at,
              (
                select min(response.created_at)
                from runtime.chat_message response
                where response.chat_session_id = ss.id
                  and fc.first_customer_at is not null
                  and response.created_at > fc.first_customer_at
                  and response.sender_role in ('ASSISTANT', 'COUNSELOR', 'AGENT')
              ) as first_response_at,
              (
                select min(response.created_at)
                from runtime.chat_message response
                where response.chat_session_id = ss.id
                  and fc.first_customer_at is not null
                  and response.created_at > fc.first_customer_at
                  and response.sender_role = 'ASSISTANT'
              ) as first_llm_response_at,
              (
                select min(response.created_at)
                from runtime.chat_message response
                where response.chat_session_id = ss.id
                  and fc.first_customer_at is not null
                  and response.created_at > fc.first_customer_at
                  and response.sender_role in ('COUNSELOR', 'AGENT')
              ) as first_human_response_at,
              (
                ss.status = 'COMPLETED'
                and ss.ended_at >= :periodStart
                and ss.ended_at < :periodEnd
              ) as completed_today,
              exists (
                select 1
                from runtime.chat_message llm_message
                where llm_message.chat_session_id = ss.id
                  and llm_message.sender_role = 'ASSISTANT'
              ) as has_llm_message,
              exists (
                select 1
                from runtime.chat_message human_message
                where human_message.chat_session_id = ss.id
                  and human_message.sender_role in ('COUNSELOR', 'AGENT')
              ) as has_human_message,
              ss.status,
              ss.started_at,
              ss.meta_json
            from scoped_sessions ss
            left join first_customer fc on fc.session_id = ss.id
            """);

    query.setParameter("workspaceId", workspaceId);
    query.setParameter("periodStart", periodStart);
    query.setParameter("periodEnd", periodEnd);

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream()
        .map(row -> toSessionFact(row, periodStart, periodEnd))
        .filter(Objects::nonNull)
        .toList();
  }

  private ConsultationMetricsSessionFact toSessionFact(
      Object[] row, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    boolean handledToday =
        toBoolean(row[5]) || isResolvedToday(row[8], row[10], periodStart, periodEnd);
    if (!isInPeriod(toOffsetDateTime(row[9]), periodStart, periodEnd) && !handledToday) {
      return null;
    }
    return new ConsultationMetricsSessionFact(
        toLong(row[0]),
        toOffsetDateTime(row[1]),
        toOffsetDateTime(row[2]),
        toOffsetDateTime(row[3]),
        toOffsetDateTime(row[4]),
        handledToday,
        toBoolean(row[6]),
        toBoolean(row[7]));
  }

  private boolean isResolvedToday(
      Object statusValue,
      Object metaJsonValue,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd) {
    if (!"RESOLVED".equals(String.valueOf(statusValue))) {
      return false;
    }
    String metaJson = toJsonText(metaJsonValue);
    if (metaJson == null || metaJson.isBlank()) {
      return false;
    }
    try {
      JsonNode meta = OBJECT_MAPPER.readTree(metaJson);
      if (meta.isTextual()) {
        meta = OBJECT_MAPPER.readTree(meta.asText());
      }
      String resolvedAtValue = meta.path("resolution").path("resolvedAt").asText(null);
      if (resolvedAtValue == null || resolvedAtValue.isBlank()) {
        return false;
      }
      return isInPeriod(OffsetDateTime.parse(resolvedAtValue), periodStart, periodEnd);
    } catch (JsonProcessingException | DateTimeParseException e) {
      return false;
    }
  }

  private boolean isInPeriod(
      OffsetDateTime value, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    return value != null && !value.isBefore(periodStart) && value.isBefore(periodEnd);
  }

  private String toJsonText(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof byte[] bytes) {
      return new String(bytes, StandardCharsets.UTF_8);
    }
    return String.valueOf(value);
  }

  private boolean toBoolean(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    return Boolean.parseBoolean(String.valueOf(value));
  }
}
