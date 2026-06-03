package com.init.workspace.infrastructure.persistence;

import com.init.workspace.application.WorkspaceDashboardGenerationResult;
import com.init.workspace.application.WorkspaceDashboardHealthResult;
import com.init.workspace.application.WorkspaceDashboardKnowledgePackResult;
import com.init.workspace.application.WorkspaceDashboardLogUploadResult;
import com.init.workspace.application.WorkspaceDashboardQueryPort;
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
        countPendingReviewTasks(workspaceId));
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

  private Long nullableLong(ResultSet rs, String columnName) throws SQLException {
    long value = rs.getLong(columnName);
    return rs.wasNull() ? null : value;
  }

  private OffsetDateTime offsetDateTime(ResultSet rs, String columnName) throws SQLException {
    return rs.getObject(columnName, OffsetDateTime.class);
  }
}
