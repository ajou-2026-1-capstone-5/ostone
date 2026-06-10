package com.init.workspace.infrastructure.persistence;

import com.init.workspace.application.WorkspaceDashboardDecisionSignalResult;
import com.init.workspace.application.WorkspaceDashboardGenerationResult;
import com.init.workspace.application.WorkspaceDashboardHealthResult;
import com.init.workspace.application.WorkspaceDashboardKnowledgePackResult;
import com.init.workspace.application.WorkspaceDashboardLogUploadResult;
import com.init.workspace.application.WorkspaceDashboardQueryPort;
import com.init.workspace.application.WorkspaceDashboardRecommendationSignalsResult;
import com.init.workspace.application.WorkspaceDashboardSimulationSignalResult;
import com.init.workspace.application.WorkspaceDashboardWorkflowRecommendationSignal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcWorkspaceDashboardQueryAdapter implements WorkspaceDashboardQueryPort {

  private static final double LOW_CONFIDENCE_THRESHOLD = 0.6;
  private static final int LOW_COMPLETION_MIN_EXECUTION_COUNT = 3;
  private static final double LOW_COMPLETION_RATE_THRESHOLD = 70.0;
  private static final double HOTPATH_SURGE_CHANGE_RATE_THRESHOLD = 30.0;

  private final NamedParameterJdbcTemplate jdbcTemplate;

  public JdbcWorkspaceDashboardQueryAdapter(NamedParameterJdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public WorkspaceDashboardHealthResult findKnowledgePackHealth(Long workspaceId) {
    return new WorkspaceDashboardHealthResult(
        findActiveKnowledgePack(workspaceId),
        findLastLogUpload(workspaceId),
        findLastKnowledgePackGeneration(workspaceId),
        countPendingReviewTasks(workspaceId),
        findLatestOpenReviewPipelineJobId(workspaceId));
  }

  @Override
  public WorkspaceDashboardRecommendationSignalsResult findRecommendationSignals(
      Long workspaceId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd,
      OffsetDateTime previousPeriodStart) {
    return new WorkspaceDashboardRecommendationSignalsResult(
        periodStart,
        periodEnd,
        findKnowledgePackHealth(workspaceId),
        findDecisionSignals(workspaceId, periodStart, periodEnd),
        findDecisionSignals(workspaceId, previousPeriodStart, periodStart),
        findHotpathSurgeWorkflow(workspaceId, periodStart, periodEnd, previousPeriodStart),
        findLowCompletionWorkflow(workspaceId, periodStart, periodEnd),
        findSimulationSignals(workspaceId));
  }

  private WorkspaceDashboardKnowledgePackResult findActiveKnowledgePack(Long workspaceId) {
    List<WorkspaceDashboardKnowledgePackResult> rows =
        jdbcTemplate.query(
            """
            SELECT
              p.id AS pack_id,
              p.name AS pack_name,
              v.id AS version_id,
              v.version_no,
              v.published_at,
              v.created_at,
              v.source_pipeline_job_id
            FROM pack.domain_pack_version v
            JOIN pack.domain_pack p ON p.id = v.domain_pack_id
            WHERE p.workspace_id = :workspaceId
              AND p.status = 'ACTIVE'
              AND v.lifecycle_status = 'PUBLISHED'
              AND NOT EXISTS (
                SELECT 1
                FROM pack.intent_definition i
                WHERE i.domain_pack_version_id = v.id
                  AND i.status = 'DRAFT'
              )
            ORDER BY v.published_at DESC NULLS LAST, v.version_no DESC, v.id DESC
            LIMIT 1
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) -> mapKnowledgePack(rs));
    return rows.stream().findFirst().orElse(null);
  }

  private WorkspaceDashboardLogUploadResult findLastLogUpload(Long workspaceId) {
    List<WorkspaceDashboardLogUploadResult> rows =
        jdbcTemplate.query(
            """
            SELECT
              id AS dataset_id,
              dataset_key,
              name AS dataset_name,
              status AS dataset_status,
              created_at AS uploaded_at
            FROM corpus.dataset
            WHERE workspace_id = :workspaceId
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) -> mapLogUpload(rs));
    return rows.stream().findFirst().orElse(null);
  }

  private WorkspaceDashboardGenerationResult findLastKnowledgePackGeneration(Long workspaceId) {
    List<WorkspaceDashboardGenerationResult> rows =
        jdbcTemplate.query(
            """
            SELECT
              id AS pipeline_job_id,
              dataset_id,
              domain_pack_id,
              status,
              requested_at,
              started_at,
              finished_at,
              last_error_message
            FROM pipeline.pipeline_job
            WHERE workspace_id = :workspaceId
              AND job_type = 'DOMAIN_PACK_GENERATION'
            ORDER BY requested_at DESC, id DESC
            LIMIT 1
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) -> mapGeneration(rs));
    return rows.stream().findFirst().orElse(null);
  }

  private long countPendingReviewTasks(Long workspaceId) {
    Long count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM review.review_task rt
            JOIN review.review_session rs ON rs.id = rt.review_session_id
            WHERE rs.workspace_id = :workspaceId
              AND rs.status = 'OPEN'
              AND rt.status = 'OPEN'
            """,
            new MapSqlParameterSource("workspaceId", workspaceId),
            Long.class);
    return count != null ? count : 0L;
  }

  private Long findLatestOpenReviewPipelineJobId(Long workspaceId) {
    List<Long> rows =
        jdbcTemplate.query(
            """
            SELECT rs.pipeline_job_id
            FROM review.review_session rs
            WHERE rs.workspace_id = :workspaceId
              AND rs.status = 'OPEN'
              AND rs.pipeline_job_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM review.review_task rt
                WHERE rt.review_session_id = rs.id
                  AND rt.status = 'OPEN'
              )
            ORDER BY rs.opened_at DESC, rs.id DESC
            LIMIT 1
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) -> rs.getLong("pipeline_job_id"));
    return rows.stream().findFirst().orElse(null);
  }

  private WorkspaceDashboardDecisionSignalResult findDecisionSignals(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("workspaceId", workspaceId)
            .addValue("periodStart", periodStart)
            .addValue("periodEnd", periodEnd)
            .addValue("lowConfidenceThreshold", LOW_CONFIDENCE_THRESHOLD);
    return jdbcTemplate.queryForObject(
        """
        SELECT
          COUNT(dl.id) AS decision_log_count,
          COUNT(dl.id) FILTER (
            WHERE jsonb_array_length(dl.missing_slots_json) > 0
          ) AS missing_slot_hit_count,
          COUNT(dl.id) FILTER (
            WHERE jsonb_array_length(dl.risk_hits_json) > 0
          ) AS risk_hit_count,
          COUNT(dl.id) FILTER (
            WHERE dl.confidence_score IS NOT NULL
              AND dl.confidence_score < :lowConfidenceThreshold
          ) AS low_confidence_count
        FROM runtime.decision_log dl
        JOIN runtime.workflow_execution we ON we.id = dl.workflow_execution_id
        JOIN runtime.chat_session cs ON cs.id = we.chat_session_id
        WHERE cs.workspace_id = :workspaceId
          AND we.started_at >= :periodStart
          AND we.started_at < :periodEnd
          AND (
            cs.channel IS NULL
            OR (
              UPPER(cs.channel) NOT IN ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
              AND UPPER(cs.channel) NOT LIKE 'SIMULATION%'
            )
          )
        """,
        params,
        (rs, rowNum) ->
            new WorkspaceDashboardDecisionSignalResult(
                rs.getLong("decision_log_count"),
                rs.getLong("missing_slot_hit_count"),
                rs.getLong("risk_hit_count"),
                rs.getLong("low_confidence_count")));
  }

  private WorkspaceDashboardWorkflowRecommendationSignal findHotpathSurgeWorkflow(
      Long workspaceId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd,
      OffsetDateTime previousPeriodStart) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("workspaceId", workspaceId)
            .addValue("periodStart", periodStart)
            .addValue("periodEnd", periodEnd)
            .addValue("previousPeriodStart", previousPeriodStart)
            .addValue("surgeThreshold", HOTPATH_SURGE_CHANGE_RATE_THRESHOLD);
    List<WorkspaceDashboardWorkflowRecommendationSignal> rows =
        jdbcTemplate.query(
            workflowAggregateQuery(
                """
                WHERE p.execution_count > 0
                  AND ((c.execution_count - p.execution_count) * 100.0 / p.execution_count) >= :surgeThreshold
                ORDER BY change_rate DESC, c.execution_count DESC, workflow_name ASC
                LIMIT 1
                """),
            params,
            (rs, rowNum) -> mapWorkflowSignal(rs));
    return rows.stream().findFirst().orElse(null);
  }

  private WorkspaceDashboardWorkflowRecommendationSignal findLowCompletionWorkflow(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("workspaceId", workspaceId)
            .addValue("periodStart", periodStart)
            .addValue("periodEnd", periodEnd)
            .addValue("previousPeriodStart", periodStart)
            .addValue("minExecutionCount", LOW_COMPLETION_MIN_EXECUTION_COUNT)
            .addValue("completionRateThreshold", LOW_COMPLETION_RATE_THRESHOLD);
    List<WorkspaceDashboardWorkflowRecommendationSignal> rows =
        jdbcTemplate.query(
            workflowAggregateQuery(
                """
                WHERE c.execution_count >= :minExecutionCount
                  AND (c.completed_count * 100.0 / c.execution_count) < :completionRateThreshold
                ORDER BY completion_rate ASC, c.execution_count DESC, workflow_name ASC
                LIMIT 1
                """),
            params,
            (rs, rowNum) -> mapWorkflowSignal(rs));
    return rows.stream().findFirst().orElse(null);
  }

  private WorkspaceDashboardSimulationSignalResult findSimulationSignals(Long workspaceId) {
    MapSqlParameterSource params = new MapSqlParameterSource("workspaceId", workspaceId);
    WorkspaceDashboardSimulationSignalResult counts =
        jdbcTemplate.queryForObject(
            """
            WITH latest_replay AS (
              SELECT DISTINCT ON (golden_case_id)
                golden_case_id,
                status
              FROM runtime.simulation_golden_case_replay_result
              WHERE workspace_id = :workspaceId
              ORDER BY golden_case_id, created_at DESC, id DESC
            )
            SELECT
              (
                SELECT COUNT(*)
                FROM runtime.simulation_feedback
                WHERE workspace_id = :workspaceId
                  AND status = 'OPEN'
              ) AS open_feedback_count,
              (
                SELECT COUNT(*)
                FROM runtime.simulation_improvement_candidate
                WHERE workspace_id = :workspaceId
                  AND status = 'READY_FOR_REVIEW'
              ) AS ready_for_review_candidate_count,
              (
                SELECT COUNT(*)
                FROM latest_replay
                WHERE status = 'FAIL'
              ) AS failed_golden_case_count
            """,
            params,
            (rs, rowNum) ->
                new WorkspaceDashboardSimulationSignalResult(
                    rs.getLong("open_feedback_count"),
                    rs.getLong("ready_for_review_candidate_count"),
                    rs.getLong("failed_golden_case_count"),
                    null,
                    0));
    WorkspaceDashboardSimulationFeedbackTypeSignal topFeedbackType =
        findTopOpenFeedbackType(workspaceId);
    if (counts == null) {
      counts = new WorkspaceDashboardSimulationSignalResult(0, 0, 0, null, 0);
    }
    return new WorkspaceDashboardSimulationSignalResult(
        counts.openFeedbackCount(),
        counts.readyForReviewCandidateCount(),
        counts.failedGoldenCaseCount(),
        topFeedbackType != null ? topFeedbackType.feedbackType() : null,
        topFeedbackType != null ? topFeedbackType.feedbackCount() : 0);
  }

  private WorkspaceDashboardSimulationFeedbackTypeSignal findTopOpenFeedbackType(Long workspaceId) {
    List<WorkspaceDashboardSimulationFeedbackTypeSignal> rows =
        jdbcTemplate.query(
            """
            SELECT feedback_type, COUNT(*) AS feedback_count
            FROM runtime.simulation_feedback
            WHERE workspace_id = :workspaceId
              AND status = 'OPEN'
            GROUP BY feedback_type
            ORDER BY feedback_count DESC, feedback_type ASC
            LIMIT 1
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) ->
                new WorkspaceDashboardSimulationFeedbackTypeSignal(
                    rs.getString("feedback_type"), rs.getLong("feedback_count")));
    return rows.stream().findFirst().orElse(null);
  }

  private String workflowAggregateQuery(String tailSql) {
    return """
        WITH current_workflows AS (
          SELECT
            COALESCE('workflow:' || we.workflow_definition_id::text, 'code:' || wd.workflow_code, 'unknown') AS group_key,
            we.workflow_definition_id,
            dp.id AS domain_pack_id,
            wd.domain_pack_version_id,
            COALESCE(NULLIF(wd.name, ''), '워크플로우 #' || we.workflow_definition_id::text, '미확인 워크플로우') AS workflow_name,
            COUNT(*) AS execution_count,
            COUNT(*) FILTER (WHERE we.status = 'COMPLETED') AS completed_count
          FROM runtime.workflow_execution we
          JOIN runtime.chat_session cs ON cs.id = we.chat_session_id
          LEFT JOIN pack.workflow_definition wd ON wd.id = we.workflow_definition_id
          LEFT JOIN pack.domain_pack_version dpv ON dpv.id = wd.domain_pack_version_id
          LEFT JOIN pack.domain_pack dp ON dp.id = dpv.domain_pack_id
          WHERE cs.workspace_id = :workspaceId
            AND we.started_at >= :periodStart
            AND we.started_at < :periodEnd
            AND (
              cs.channel IS NULL
              OR (
                UPPER(cs.channel) NOT IN ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                AND UPPER(cs.channel) NOT LIKE 'SIMULATION%'
              )
            )
          GROUP BY group_key, we.workflow_definition_id, dp.id, wd.domain_pack_version_id, workflow_name
        ),
        previous_workflows AS (
          SELECT
            COALESCE('workflow:' || we.workflow_definition_id::text, 'code:' || wd.workflow_code, 'unknown') AS group_key,
            COUNT(*) AS execution_count
          FROM runtime.workflow_execution we
          JOIN runtime.chat_session cs ON cs.id = we.chat_session_id
          LEFT JOIN pack.workflow_definition wd ON wd.id = we.workflow_definition_id
          WHERE cs.workspace_id = :workspaceId
            AND we.started_at >= :previousPeriodStart
            AND we.started_at < :periodStart
            AND (
              cs.channel IS NULL
              OR (
                UPPER(cs.channel) NOT IN ('DEMO', 'DEMO_WEB', 'SIMULATION', 'SIMULATION_WEB')
                AND UPPER(cs.channel) NOT LIKE 'SIMULATION%'
              )
            )
          GROUP BY group_key
        )
        SELECT
          c.workflow_definition_id,
          c.domain_pack_id,
          c.domain_pack_version_id,
          c.workflow_name,
          c.execution_count,
          ROUND((c.completed_count * 100.0 / c.execution_count)::numeric, 1) AS completion_rate,
          CASE
            WHEN p.execution_count > 0 THEN ROUND(((c.execution_count - p.execution_count) * 100.0 / p.execution_count)::numeric, 1)
            ELSE NULL
          END AS change_rate
        FROM current_workflows c
        LEFT JOIN previous_workflows p ON p.group_key = c.group_key
        """
        + tailSql;
  }

  private WorkspaceDashboardKnowledgePackResult mapKnowledgePack(ResultSet rs) throws SQLException {
    return new WorkspaceDashboardKnowledgePackResult(
        rs.getLong("pack_id"),
        rs.getString("pack_name"),
        rs.getLong("version_id"),
        rs.getInt("version_no"),
        offsetDateTime(rs, "published_at"),
        offsetDateTime(rs, "created_at"),
        nullableLong(rs, "source_pipeline_job_id"));
  }

  private WorkspaceDashboardLogUploadResult mapLogUpload(ResultSet rs) throws SQLException {
    return new WorkspaceDashboardLogUploadResult(
        rs.getLong("dataset_id"),
        rs.getString("dataset_key"),
        rs.getString("dataset_name"),
        rs.getString("dataset_status"),
        offsetDateTime(rs, "uploaded_at"));
  }

  private WorkspaceDashboardGenerationResult mapGeneration(ResultSet rs) throws SQLException {
    return new WorkspaceDashboardGenerationResult(
        rs.getLong("pipeline_job_id"),
        nullableLong(rs, "dataset_id"),
        nullableLong(rs, "domain_pack_id"),
        rs.getString("status"),
        offsetDateTime(rs, "requested_at"),
        offsetDateTime(rs, "started_at"),
        offsetDateTime(rs, "finished_at"),
        rs.getString("last_error_message"));
  }

  private WorkspaceDashboardWorkflowRecommendationSignal mapWorkflowSignal(ResultSet rs)
      throws SQLException {
    return new WorkspaceDashboardWorkflowRecommendationSignal(
        nullableLong(rs, "workflow_definition_id"),
        nullableLong(rs, "domain_pack_id"),
        nullableLong(rs, "domain_pack_version_id"),
        rs.getString("workflow_name"),
        rs.getLong("execution_count"),
        nullableDouble(rs, "completion_rate"),
        nullableDouble(rs, "change_rate"));
  }

  private Long nullableLong(ResultSet rs, String columnName) throws SQLException {
    long value = rs.getLong(columnName);
    return rs.wasNull() ? null : value;
  }

  private Double nullableDouble(ResultSet rs, String columnName) throws SQLException {
    double value = rs.getDouble(columnName);
    return rs.wasNull() ? null : value;
  }

  private OffsetDateTime offsetDateTime(ResultSet rs, String columnName) throws SQLException {
    return rs.getObject(columnName, OffsetDateTime.class);
  }

  private record WorkspaceDashboardSimulationFeedbackTypeSignal(
      String feedbackType, long feedbackCount) {}
}
