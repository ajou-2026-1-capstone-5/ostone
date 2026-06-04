package com.init.workflowruntime.infrastructure.persistence;

import com.init.shared.infrastructure.persistence.NativeQueryColumnConverter;
import com.init.workflowruntime.domain.WorkflowRankingExecutionRow;
import com.init.workflowruntime.domain.WorkflowRankingRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class JpaWorkflowRankingRepository implements WorkflowRankingRepository {

  private final EntityManager entityManager;

  public JpaWorkflowRankingRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public long countOperationalConsultations(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    Query query =
        entityManager.createNativeQuery(
            """
            select count(*)
            from runtime.chat_session cs
            where cs.workspace_id = :workspaceId
              and cs.started_at >= :periodStart
              and cs.started_at < :periodEnd
              and (
                cs.channel is null
                or (
                  upper(cs.channel) not in ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                  and upper(cs.channel) not like 'SIMULATION%'
                )
              )
            """);
    query.setParameter("workspaceId", workspaceId);
    query.setParameter("periodStart", periodStart);
    query.setParameter("periodEnd", periodEnd);
    return ((Number) query.getSingleResult()).longValue();
  }

  @Override
  public List<WorkflowRankingExecutionRow> findExecutionRows(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    Query query =
        entityManager.createNativeQuery(
            """
            select
              we.id as execution_id,
              we.workflow_definition_id,
              dp.id as domain_pack_id,
              wd.domain_pack_version_id,
              wd.workflow_code,
              wd.name as workflow_name,
              we.status,
              we.started_at,
              we.finished_at,
              exists (
                select 1
                from runtime.chat_message cm
                where cm.chat_session_id = cs.id
                  and cm.sender_role in ('COUNSELOR', 'AGENT')
              ) as has_human_message
            from runtime.workflow_execution we
            join runtime.chat_session cs on cs.id = we.chat_session_id
            left join pack.workflow_definition wd on wd.id = we.workflow_definition_id
            left join pack.domain_pack_version dpv on dpv.id = wd.domain_pack_version_id
            left join pack.domain_pack dp on dp.id = dpv.domain_pack_id
            where cs.workspace_id = :workspaceId
              and we.started_at >= :periodStart
              and we.started_at < :periodEnd
              and (
                cs.channel is null
                or (
                  upper(cs.channel) not in ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                  and upper(cs.channel) not like 'SIMULATION%'
                )
              )
            """);
    query.setParameter("workspaceId", workspaceId);
    query.setParameter("periodStart", periodStart);
    query.setParameter("periodEnd", periodEnd);

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(this::toExecutionRow).toList();
  }

  private WorkflowRankingExecutionRow toExecutionRow(Object[] row) {
    return new WorkflowRankingExecutionRow(
        NativeQueryColumnConverter.toLong(row[0]),
        NativeQueryColumnConverter.toLong(row[1]),
        NativeQueryColumnConverter.toLong(row[2]),
        NativeQueryColumnConverter.toLong(row[3]),
        toStringValue(row[4]),
        toStringValue(row[5]),
        toStringValue(row[6]),
        NativeQueryColumnConverter.toOffsetDateTime(row[7]),
        NativeQueryColumnConverter.toOffsetDateTime(row[8]),
        toBoolean(row[9]));
  }

  private String toStringValue(Object value) {
    return value == null ? null : String.valueOf(value);
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
