package com.init.workflowruntime.infrastructure.persistence;

import static com.init.shared.infrastructure.persistence.NativeQueryColumnConverter.toLong;
import static com.init.shared.infrastructure.persistence.NativeQueryColumnConverter.toOffsetDateTime;

import com.init.workflowruntime.domain.WorkflowBottleneckAnalysisRepository;
import com.init.workflowruntime.domain.WorkflowBottleneckDecisionRow;
import com.init.workflowruntime.domain.WorkflowBottleneckExecutionRow;
import com.init.workflowruntime.domain.WorkflowBottleneckStepRow;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class JpaWorkflowBottleneckAnalysisRepository
    implements WorkflowBottleneckAnalysisRepository {

  private final EntityManager entityManager;

  public JpaWorkflowBottleneckAnalysisRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public List<WorkflowBottleneckExecutionRow> findExecutionRows(
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd) {
    Query query =
        scopedQuery(
            """
            select
              we.id,
              we.status,
              we.current_state,
              we.started_at,
              we.finished_at
            from runtime.workflow_execution we
            join runtime.chat_session cs on cs.id = we.chat_session_id
            where cs.workspace_id = :workspaceId
              and we.workflow_definition_id = :workflowDefinitionId
              and we.started_at >= :periodStart
              and we.started_at < :periodEnd
              and (
                cs.channel is null
                or (
                  upper(cs.channel) not in ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                  and upper(cs.channel) not like 'SIMULATION%'
                )
              )
            order by we.started_at asc, we.id asc
            """,
            workspaceId, workflowDefinitionId, periodStart, periodEnd);

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(this::toExecutionRow).toList();
  }

  @Override
  public List<WorkflowBottleneckStepRow> findStepRows(
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd) {
    Query query =
        scopedQuery(
            """
            select
              wes.workflow_execution_id,
              wes.state_from,
              wes.state_to,
              wes.action_type,
              wes.created_at
            from runtime.workflow_execution_step wes
            join runtime.workflow_execution we on we.id = wes.workflow_execution_id
            join runtime.chat_session cs on cs.id = we.chat_session_id
            where cs.workspace_id = :workspaceId
              and we.workflow_definition_id = :workflowDefinitionId
              and we.started_at >= :periodStart
              and we.started_at < :periodEnd
              and (
                cs.channel is null
                or (
                  upper(cs.channel) not in ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                  and upper(cs.channel) not like 'SIMULATION%'
                )
              )
            order by wes.workflow_execution_id asc, wes.seq_no asc, wes.id asc
            """,
            workspaceId, workflowDefinitionId, periodStart, periodEnd);

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(this::toStepRow).toList();
  }

  @Override
  public List<WorkflowBottleneckDecisionRow> findDecisionRows(
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd) {
    Query query =
        scopedQuery(
            """
            select
              dl.workflow_execution_id,
              dl.state_name,
              dl.selected_action,
              dl.missing_slots_json,
              dl.policy_hits_json,
              dl.risk_hits_json,
              dl.created_at
            from runtime.decision_log dl
            join runtime.workflow_execution we on we.id = dl.workflow_execution_id
            join runtime.chat_session cs on cs.id = we.chat_session_id
            where cs.workspace_id = :workspaceId
              and we.workflow_definition_id = :workflowDefinitionId
              and we.started_at >= :periodStart
              and we.started_at < :periodEnd
              and (
                cs.channel is null
                or (
                  upper(cs.channel) not in ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                  and upper(cs.channel) not like 'SIMULATION%'
                )
              )
            order by dl.workflow_execution_id asc, dl.step_seq_no asc, dl.id asc
            """,
            workspaceId, workflowDefinitionId, periodStart, periodEnd);

    @SuppressWarnings("unchecked")
    List<Object[]> rows = query.getResultList();
    return rows.stream().map(this::toDecisionRow).toList();
  }

  private Query scopedQuery(
      String sql,
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd) {
    Query query = entityManager.createNativeQuery(sql);
    query.setParameter("workspaceId", workspaceId);
    query.setParameter("workflowDefinitionId", workflowDefinitionId);
    query.setParameter("periodStart", periodStart);
    query.setParameter("periodEnd", periodEnd);
    return query;
  }

  private WorkflowBottleneckExecutionRow toExecutionRow(Object[] row) {
    return new WorkflowBottleneckExecutionRow(
        toLong(row[0]),
        toStringValue(row[1]),
        toStringValue(row[2]),
        toOffsetDateTime(row[3]),
        toOffsetDateTime(row[4]));
  }

  private WorkflowBottleneckStepRow toStepRow(Object[] row) {
    return new WorkflowBottleneckStepRow(
        toLong(row[0]),
        toStringValue(row[1]),
        toStringValue(row[2]),
        toStringValue(row[3]),
        toOffsetDateTime(row[4]));
  }

  private WorkflowBottleneckDecisionRow toDecisionRow(Object[] row) {
    return new WorkflowBottleneckDecisionRow(
        toLong(row[0]),
        toStringValue(row[1]),
        toStringValue(row[2]),
        toJsonText(row[3]),
        toJsonText(row[4]),
        toJsonText(row[5]),
        toOffsetDateTime(row[6]));
  }

  private String toStringValue(Object value) {
    return value == null ? null : String.valueOf(value);
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
}
