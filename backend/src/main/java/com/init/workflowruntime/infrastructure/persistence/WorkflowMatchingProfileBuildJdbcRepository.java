package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.application.matching.EmbeddingProperties;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildJob;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WorkflowMatchingProfileBuildJdbcRepository {

  private final JdbcTemplate jdbcTemplate;
  private final EmbeddingProperties properties;

  public WorkflowMatchingProfileBuildJdbcRepository(
      JdbcTemplate jdbcTemplate, EmbeddingProperties properties) {
    this.jdbcTemplate = jdbcTemplate;
    this.properties = properties;
  }

  public void enqueue(Long domainPackVersionId, String triggerType) {
    String profileVersion = "v" + domainPackVersionId + "-" + Instant.now().toEpochMilli();
    jdbcTemplate.update(
        """
        INSERT INTO pack.workflow_matching_profile_build
            (domain_pack_version_id, trigger_type, profile_version)
        VALUES (?, ?, ?)
        """,
        domainPackVersionId,
        triggerType,
        profileVersion);
  }

  public Optional<WorkflowMatchingProfileBuildJob> claimNext() {
    markExhaustedRunningJobsFailed();
    return jdbcTemplate
        .query(
            """
            UPDATE pack.workflow_matching_profile_build
            SET status = 'RUNNING',
                retry_count = retry_count + 1,
                started_at = NOW(),
                updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM pack.workflow_matching_profile_build
                WHERE status = 'QUEUED'
                   OR (status = 'FAILED' AND retry_count < max_retries)
                   OR (
                       status = 'RUNNING'
                       AND retry_count < max_retries
                       AND COALESCE(started_at, created_at) < NOW() - (? * INTERVAL '1 second')
                   )
                ORDER BY created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING id, domain_pack_version_id, trigger_type, profile_version
            """,
            (rs, rowNum) -> mapJob(rs),
            properties.profileBuildRunningTimeoutOrDefault().toSeconds())
        .stream()
        .findFirst();
  }

  private void markExhaustedRunningJobsFailed() {
    jdbcTemplate.update(
        """
        UPDATE pack.workflow_matching_profile_build
        SET status = 'FAILED',
            finished_at = NOW(),
            updated_at = NOW(),
            error_json = jsonb_build_object(
                'type', 'ProfileBuildTimeout',
                'message', 'Profile build exceeded retry limit while RUNNING'
            )
        WHERE status = 'RUNNING'
          AND retry_count >= max_retries
          AND COALESCE(started_at, created_at) < NOW() - (? * INTERVAL '1 second')
        """,
        properties.profileBuildRunningTimeoutOrDefault().toSeconds());
  }

  public void markSucceeded(Long jobId) {
    jdbcTemplate.update(
        """
        UPDATE pack.workflow_matching_profile_build
        SET status = 'SUCCEEDED',
            finished_at = NOW(),
            updated_at = NOW(),
            error_json = '{}'::jsonb
        WHERE id = ?
        """,
        jobId);
  }

  public void markFailed(Long jobId, String errorJson) {
    jdbcTemplate.update(
        """
        UPDATE pack.workflow_matching_profile_build
        SET status = 'FAILED',
            finished_at = NOW(),
            updated_at = NOW(),
            error_json = COALESCE(?::jsonb, '{}'::jsonb)
        WHERE id = ?
        """,
        errorJson,
        jobId);
  }

  private WorkflowMatchingProfileBuildJob mapJob(ResultSet rs) throws SQLException {
    return new WorkflowMatchingProfileBuildJob(
        rs.getLong("id"),
        rs.getLong("domain_pack_version_id"),
        rs.getString("trigger_type"),
        rs.getString("profile_version"));
  }
}
