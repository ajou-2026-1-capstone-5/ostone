package com.init.payment.infrastructure;

import com.init.payment.application.WorkspaceQuota;
import com.init.payment.application.WorkspaceQuotaQueryPort;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcWorkspaceQuotaRepository implements WorkspaceQuotaQueryPort {

  private final JdbcClient jdbcClient;

  public JdbcWorkspaceQuotaRepository(JdbcClient jdbcClient) {
    this.jdbcClient = jdbcClient;
  }

  @Override
  public Optional<WorkspaceQuota> findCurrentQuota(Long workspaceId, OffsetDateTime at) {
    return jdbcClient
        .sql(
            """
            SELECT s.workspace_id,
                   p.plan_key,
                   p.member_limit,
                   p.dataset_upload_limit,
                   p.pipeline_run_limit,
                   p.pipeline_run_hourly_limit,
                   s.current_period_start,
                   s.current_period_end
              FROM payment.subscription s
              JOIN payment.plan p ON p.id = s.plan_id
             WHERE s.workspace_id = :workspaceId
               AND s.status IN ('ACTIVE', 'PAST_DUE')
               AND s.current_period_start <= :at
               AND s.current_period_end > :at
             ORDER BY s.current_period_end DESC, s.id DESC
             LIMIT 1
            """)
        .param("workspaceId", workspaceId)
        .param("at", at)
        .query(
            (rs, rowNum) ->
                new WorkspaceQuota(
                    rs.getLong("workspace_id"),
                    rs.getString("plan_key"),
                    rs.getInt("member_limit"),
                    rs.getInt("dataset_upload_limit"),
                    rs.getInt("pipeline_run_limit"),
                    rs.getInt("pipeline_run_hourly_limit"),
                    rs.getObject("current_period_start", OffsetDateTime.class),
                    rs.getObject("current_period_end", OffsetDateTime.class)))
        .optional();
  }

  @Override
  public boolean hasFreeOnboardingAllowance(Long workspaceId) {
    return Boolean.TRUE.equals(
        jdbcClient
            .sql(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM app.workspace
                     WHERE id = :workspaceId
                       AND free_onboarding_status IN ('AVAILABLE', 'IN_PROGRESS')
                )
                """)
            .param("workspaceId", workspaceId)
            .query(Boolean.class)
            .single());
  }
}
