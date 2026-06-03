package com.init.workspace.infrastructure.persistence;

import com.init.workspace.application.AdminCustomerBillingSummaryResult;
import com.init.workspace.application.AdminCustomerDetailResult;
import com.init.workspace.application.AdminCustomerListQuery;
import com.init.workspace.application.AdminCustomerMemberEntryResult;
import com.init.workspace.application.AdminCustomerMemberSummaryResult;
import com.init.workspace.application.AdminCustomerPipelineJobResult;
import com.init.workspace.application.AdminCustomerPipelineSummaryResult;
import com.init.workspace.application.AdminCustomerQueryPort;
import com.init.workspace.application.AdminCustomerSliceResult;
import com.init.workspace.application.AdminCustomerSummaryResult;
import com.init.workspace.application.AdminCustomerUploadSummaryResult;
import com.init.workspace.application.AdminCustomerWorkspaceResult;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcAdminCustomerQueryAdapter implements AdminCustomerQueryPort {

  private final NamedParameterJdbcTemplate jdbcTemplate;

  public JdbcAdminCustomerQueryAdapter(NamedParameterJdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public AdminCustomerSliceResult findCustomers(AdminCustomerListQuery query) {
    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("search", likePattern(query.search()))
            .addValue("status", query.status())
            .addValue("limit", query.size() + 1)
            .addValue("offset", query.page() * query.size());
    List<AdminCustomerSummaryResult> rows =
        jdbcTemplate.query(
            """
            SELECT
              w.id,
              w.workspace_key,
              w.name,
              w.description,
              w.status,
              w.free_onboarding_status,
              w.free_onboarding_dataset_id,
              w.free_onboarding_pipeline_job_id,
              w.free_onboarding_started_at,
              w.free_onboarding_consumed_at,
              w.created_at,
              w.updated_at,
              (SELECT COUNT(*) FROM app.workspace_member wm WHERE wm.workspace_id = w.id) AS member_count,
              d.id AS dataset_id,
              d.dataset_key,
              d.name AS dataset_name,
              d.status AS dataset_status,
              d.created_at AS dataset_created_at,
              pj.id AS pipeline_job_id,
              pj.job_type,
              pj.status AS pipeline_status,
              pj.requested_at,
              pj.started_at,
              pj.finished_at
            FROM app.workspace w
            LEFT JOIN LATERAL (
              SELECT id, dataset_key, name, status, created_at
              FROM corpus.dataset
              WHERE workspace_id = w.id
              ORDER BY created_at DESC, id DESC
              LIMIT 1
            ) d ON TRUE
            LEFT JOIN LATERAL (
              SELECT id, job_type, status, requested_at, started_at, finished_at
              FROM pipeline.pipeline_job
              WHERE workspace_id = w.id
              ORDER BY requested_at DESC, id DESC
              LIMIT 1
            ) pj ON TRUE
            WHERE (:search IS NULL OR LOWER(w.name) LIKE :search OR LOWER(w.workspace_key) LIKE :search)
              AND (:status IS NULL OR w.status = :status)
            ORDER BY w.id DESC
            LIMIT :limit OFFSET :offset
            """,
            params,
            (rs, rowNum) -> mapSummary(rs));
    boolean hasNext = rows.size() > query.size();
    List<AdminCustomerSummaryResult> content = hasNext ? rows.subList(0, query.size()) : rows;
    return new AdminCustomerSliceResult(content, query.page(), query.size(), hasNext);
  }

  @Override
  public Optional<AdminCustomerDetailResult> findCustomerDetail(Long workspaceId) {
    Optional<AdminCustomerWorkspaceResult> workspace = findWorkspace(workspaceId);
    if (workspace.isEmpty()) {
      return Optional.empty();
    }
    AdminCustomerUploadSummaryResult latestUpload = findLatestUpload(workspaceId);
    AdminCustomerPipelineSummaryResult pipeline = findPipelineSummary(workspaceId);
    return Optional.of(
        new AdminCustomerDetailResult(
            workspace.get(),
            findMemberSummary(workspaceId),
            AdminCustomerBillingSummaryResult.unavailable(),
            latestUpload,
            pipeline));
  }

  private Optional<AdminCustomerWorkspaceResult> findWorkspace(Long workspaceId) {
    List<AdminCustomerWorkspaceResult> rows =
        jdbcTemplate.query(
            """
            SELECT
              id,
              workspace_key,
              name,
              description,
              status,
              free_onboarding_status,
              free_onboarding_dataset_id,
              free_onboarding_pipeline_job_id,
              free_onboarding_started_at,
              free_onboarding_consumed_at,
              created_at,
              updated_at
            FROM app.workspace
            WHERE id = :workspaceId
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) -> mapWorkspace(rs));
    return rows.stream().findFirst();
  }

  private AdminCustomerMemberSummaryResult findMemberSummary(Long workspaceId) {
    MapSqlParameterSource params = new MapSqlParameterSource("workspaceId", workspaceId);
    AdminCustomerMemberSummaryResult counts =
        jdbcTemplate.queryForObject(
            """
            SELECT
              COUNT(*) AS total_count,
              COUNT(*) FILTER (WHERE member_role = 'OWNER') AS owner_count,
              COUNT(*) FILTER (WHERE member_role = 'ADMIN') AS admin_count,
              COUNT(*) FILTER (WHERE member_role = 'REVIEWER') AS reviewer_count,
              COUNT(*) FILTER (WHERE member_role = 'OPERATOR') AS operator_count
            FROM app.workspace_member
            WHERE workspace_id = :workspaceId
            """,
            params,
            (rs, rowNum) ->
                new AdminCustomerMemberSummaryResult(
                    rs.getLong("total_count"),
                    rs.getLong("owner_count"),
                    rs.getLong("admin_count"),
                    rs.getLong("reviewer_count"),
                    rs.getLong("operator_count"),
                    List.of()));
    List<AdminCustomerMemberEntryResult> recentMembers =
        jdbcTemplate.query(
            """
            SELECT
              wm.id AS member_id,
              wm.user_id,
              u.name,
              u.email,
              wm.member_role,
              u.status AS account_status,
              wm.joined_at
            FROM app.workspace_member wm
            JOIN app.app_user u ON u.id = wm.user_id
            WHERE wm.workspace_id = :workspaceId
            ORDER BY wm.joined_at DESC, wm.id DESC
            LIMIT 5
            """,
            params,
            (rs, rowNum) ->
                new AdminCustomerMemberEntryResult(
                    rs.getLong("member_id"),
                    rs.getLong("user_id"),
                    rs.getString("name"),
                    rs.getString("email"),
                    rs.getString("member_role"),
                    rs.getString("account_status"),
                    offsetDateTime(rs, "joined_at")));
    return new AdminCustomerMemberSummaryResult(
        counts.totalCount(),
        counts.ownerCount(),
        counts.adminCount(),
        counts.reviewerCount(),
        counts.operatorCount(),
        recentMembers);
  }

  private AdminCustomerUploadSummaryResult findLatestUpload(Long workspaceId) {
    List<AdminCustomerUploadSummaryResult> rows =
        jdbcTemplate.query(
            """
            SELECT
              id AS dataset_id,
              dataset_key,
              name AS dataset_name,
              status AS dataset_status,
              created_at AS dataset_created_at
            FROM corpus.dataset
            WHERE workspace_id = :workspaceId
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            Map.of("workspaceId", workspaceId),
            (rs, rowNum) -> mapUpload(rs));
    return rows.stream().findFirst().orElse(null);
  }

  private AdminCustomerPipelineSummaryResult findPipelineSummary(Long workspaceId) {
    MapSqlParameterSource params = new MapSqlParameterSource("workspaceId", workspaceId);
    AdminCustomerPipelineSummaryResult counts =
        jdbcTemplate.queryForObject(
            """
            SELECT
              COUNT(*) AS total_count,
              COUNT(*) FILTER (
                WHERE status IN (
                  'QUEUED',
                  'RUNNING',
                  'WAITING_DOMAIN_CONFIRMATION',
                  'WAITING_HUMAN_FEEDBACK',
                  'WAITING_INTENT_CALLBACK',
                  'WAITING_WORKFLOW_CALLBACK'
                )
              ) AS running_count,
              COUNT(*) FILTER (WHERE status = 'SUCCEEDED') AS succeeded_count,
              COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count
            FROM pipeline.pipeline_job
            WHERE workspace_id = :workspaceId
            """,
            params,
            (rs, rowNum) ->
                new AdminCustomerPipelineSummaryResult(
                    rs.getLong("total_count"),
                    rs.getLong("running_count"),
                    rs.getLong("succeeded_count"),
                    rs.getLong("failed_count"),
                    null,
                    List.of()));
    List<AdminCustomerPipelineJobResult> recentJobs =
        jdbcTemplate.query(
            """
            SELECT
              id AS pipeline_job_id,
              job_type,
              status AS pipeline_status,
              requested_at,
              started_at,
              finished_at
            FROM pipeline.pipeline_job
            WHERE workspace_id = :workspaceId
            ORDER BY requested_at DESC, id DESC
            LIMIT 5
            """,
            params,
            (rs, rowNum) -> mapPipelineJob(rs, "pipeline_"));
    AdminCustomerPipelineJobResult latestJob = recentJobs.isEmpty() ? null : recentJobs.getFirst();
    return new AdminCustomerPipelineSummaryResult(
        counts.totalCount(),
        counts.runningCount(),
        counts.succeededCount(),
        counts.failedCount(),
        latestJob,
        recentJobs);
  }

  private AdminCustomerSummaryResult mapSummary(ResultSet rs) throws SQLException {
    return new AdminCustomerSummaryResult(
        mapWorkspace(rs),
        rs.getLong("member_count"),
        AdminCustomerBillingSummaryResult.unavailable(),
        mapUpload(rs),
        mapPipelineJob(rs, "pipeline_"));
  }

  private AdminCustomerWorkspaceResult mapWorkspace(ResultSet rs) throws SQLException {
    return new AdminCustomerWorkspaceResult(
        rs.getLong("id"),
        rs.getString("workspace_key"),
        rs.getString("name"),
        rs.getString("description"),
        rs.getString("status"),
        offsetDateTime(rs, "created_at"),
        offsetDateTime(rs, "updated_at"),
        rs.getString("free_onboarding_status"),
        nullableLong(rs, "free_onboarding_dataset_id"),
        nullableLong(rs, "free_onboarding_pipeline_job_id"),
        offsetDateTime(rs, "free_onboarding_started_at"),
        offsetDateTime(rs, "free_onboarding_consumed_at"));
  }

  private AdminCustomerUploadSummaryResult mapUpload(ResultSet rs) throws SQLException {
    Long datasetId = nullableLong(rs, "dataset_id");
    if (datasetId == null) {
      return null;
    }
    return new AdminCustomerUploadSummaryResult(
        datasetId,
        rs.getString("dataset_key"),
        rs.getString("dataset_name"),
        rs.getString("dataset_status"),
        offsetDateTime(rs, "dataset_created_at"));
  }

  private AdminCustomerPipelineJobResult mapPipelineJob(ResultSet rs, String prefix)
      throws SQLException {
    Long id = nullableLong(rs, prefix + "job_id");
    if (id == null) {
      return null;
    }
    return new AdminCustomerPipelineJobResult(
        id,
        rs.getString("job_type"),
        rs.getString(prefix + "status"),
        offsetDateTime(rs, "requested_at"),
        offsetDateTime(rs, "started_at"),
        offsetDateTime(rs, "finished_at"));
  }

  private String likePattern(String value) {
    if (value == null) {
      return null;
    }
    return "%" + value.toLowerCase() + "%";
  }

  private Long nullableLong(ResultSet rs, String columnName) throws SQLException {
    long value = rs.getLong(columnName);
    return rs.wasNull() ? null : value;
  }

  private OffsetDateTime offsetDateTime(ResultSet rs, String columnName) throws SQLException {
    return rs.getObject(columnName, OffsetDateTime.class);
  }
}
