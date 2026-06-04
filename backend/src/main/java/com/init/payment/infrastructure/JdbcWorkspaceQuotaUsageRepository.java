package com.init.payment.infrastructure;

import com.init.payment.application.WorkspaceQuotaUsagePort;
import java.time.OffsetDateTime;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcWorkspaceQuotaUsageRepository implements WorkspaceQuotaUsagePort {

  private final JdbcClient jdbcClient;

  public JdbcWorkspaceQuotaUsageRepository(JdbcClient jdbcClient) {
    this.jdbcClient = jdbcClient;
  }

  @Override
  public long countMembers(Long workspaceId) {
    return jdbcClient
        .sql("SELECT COUNT(*) FROM app.workspace_member WHERE workspace_id = :workspaceId")
        .param("workspaceId", workspaceId)
        .query(Long.class)
        .single();
  }

  @Override
  public long countDatasetUploads(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive) {
    return jdbcClient
        .sql(
            """
            SELECT COUNT(*)
              FROM corpus.dataset
             WHERE workspace_id = :workspaceId
               AND created_at >= :fromInclusive
               AND created_at < :toExclusive
            """)
        .param("workspaceId", workspaceId)
        .param("fromInclusive", fromInclusive)
        .param("toExclusive", toExclusive)
        .query(Long.class)
        .single();
  }

  @Override
  public long countPipelineRuns(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive) {
    return jdbcClient
        .sql(
            """
            SELECT COUNT(*)
              FROM pipeline.pipeline_job
             WHERE workspace_id = :workspaceId
               AND job_type = 'DOMAIN_PACK_GENERATION'
               AND requested_at >= :fromInclusive
               AND requested_at < :toExclusive
            """)
        .param("workspaceId", workspaceId)
        .param("fromInclusive", fromInclusive)
        .param("toExclusive", toExclusive)
        .query(Long.class)
        .single();
  }

  @Override
  public long countDatasetUploads(Long workspaceId) {
    return jdbcClient
        .sql("SELECT COUNT(*) FROM corpus.dataset WHERE workspace_id = :workspaceId")
        .param("workspaceId", workspaceId)
        .query(Long.class)
        .single();
  }

  @Override
  public long countPipelineRuns(Long workspaceId) {
    return jdbcClient
        .sql(
            """
            SELECT COUNT(*)
              FROM pipeline.pipeline_job
             WHERE workspace_id = :workspaceId
               AND job_type = 'DOMAIN_PACK_GENERATION'
            """)
        .param("workspaceId", workspaceId)
        .query(Long.class)
        .single();
  }
}
