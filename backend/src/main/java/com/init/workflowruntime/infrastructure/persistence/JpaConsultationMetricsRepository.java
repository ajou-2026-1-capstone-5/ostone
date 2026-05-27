package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ConsultationMetricsRepository;
import com.init.workflowruntime.domain.ConsultationMetricsSessionFact;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class JpaConsultationMetricsRepository implements ConsultationMetricsRepository {

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
              select cs.id, cs.status, cs.started_at, cs.ended_at
              from runtime.chat_session cs
              where cs.workspace_id = :workspaceId
                and (
                  (cs.started_at >= :periodStart and cs.started_at < :periodEnd)
                  or (cs.ended_at >= :periodStart and cs.ended_at < :periodEnd and cs.status = 'COMPLETED')
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
              ) as handled_today,
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
              ) as has_human_message
            from scoped_sessions ss
            left join first_customer fc on fc.session_id = ss.id
            """);

    query.setParameter("workspaceId", workspaceId);
    query.setParameter("periodStart", periodStart);
    query.setParameter("periodEnd", periodEnd);

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(this::toSessionFact).toList();
  }

  private ConsultationMetricsSessionFact toSessionFact(Object[] row) {
    return new ConsultationMetricsSessionFact(
        toLong(row[0]),
        toOffsetDateTime(row[1]),
        toOffsetDateTime(row[2]),
        toOffsetDateTime(row[3]),
        toOffsetDateTime(row[4]),
        toBoolean(row[5]),
        toBoolean(row[6]),
        toBoolean(row[7]));
  }

  private Long toLong(Object value) {
    return value instanceof Number number ? number.longValue() : null;
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

  private OffsetDateTime toOffsetDateTime(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof OffsetDateTime offsetDateTime) {
      return offsetDateTime;
    }
    if (value instanceof Instant instant) {
      return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
    if (value instanceof Timestamp timestamp) {
      return OffsetDateTime.ofInstant(timestamp.toInstant(), ZoneOffset.UTC);
    }
    if (value instanceof LocalDateTime localDateTime) {
      return localDateTime.atOffset(ZoneOffset.UTC);
    }
    throw new IllegalArgumentException(
        "Unsupported timestamp value: " + value.getClass().getName());
  }
}
