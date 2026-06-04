package com.init.payment.infrastructure.persistence;

import com.init.payment.application.AdminBillingCustomerSummary;
import com.init.payment.application.AdminBillingQueryRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(readOnly = true)
public class AdminBillingJdbcQueryRepository implements AdminBillingQueryRepository {

  private static final String SUMMARY_SQL =
      """
      WITH latest_subscription AS (
        SELECT s.*,
               row_number() OVER (PARTITION BY s.workspace_id ORDER BY s.created_at DESC, s.id DESC) AS rn
        FROM payment.subscription s
      ),
      latest_payment AS (
        SELECT p.*,
               row_number() OVER (
                 PARTITION BY p.workspace_id
                 ORDER BY COALESCE(p.approved_at, p.created_at) DESC, p.id DESC
               ) AS rn
        FROM payment.payment p
      )
      SELECT w.id AS workspace_id,
             w.workspace_key,
             w.name AS workspace_name,
             s.status AS subscription_status,
             s.current_period_start,
             s.current_period_end,
             CASE
               WHEN s.status = 'ACTIVE' THEN s.current_period_end
               ELSE s.next_retry_at
             END AS next_billing_at,
             pl.name AS plan_name,
             pl.amount AS plan_amount,
             p.id AS recent_payment_id,
             p.amount AS recent_payment_amount,
             p.status AS recent_payment_status,
             p.approved_at AS recent_payment_approved_at,
             CASE
               WHEN s.status = 'PAST_DUE' THEN 'PAST_DUE'
               WHEN p.status IN ('ABORTED', 'EXPIRED') THEN p.status
               ELSE NULL
             END AS failed_status
      FROM app.workspace w
      LEFT JOIN latest_subscription s ON s.workspace_id = w.id AND s.rn = 1
      LEFT JOIN payment.plan pl ON pl.id = s.plan_id
      LEFT JOIN latest_payment p ON p.workspace_id = w.id AND p.rn = 1
      ORDER BY w.name ASC, w.id ASC
      """;

  private final JdbcTemplate jdbcTemplate;

  public AdminBillingJdbcQueryRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public List<AdminBillingCustomerSummary> findCustomerSummaries() {
    return jdbcTemplate.query(SUMMARY_SQL, this::mapSummary);
  }

  private AdminBillingCustomerSummary mapSummary(ResultSet rs, int rowNum) throws SQLException {
    return new AdminBillingCustomerSummary(
        rs.getLong("workspace_id"),
        rs.getString("workspace_key"),
        rs.getString("workspace_name"),
        rs.getString("subscription_status"),
        offsetDateTime(rs, "current_period_start"),
        offsetDateTime(rs, "current_period_end"),
        offsetDateTime(rs, "next_billing_at"),
        rs.getString("plan_name"),
        nullableLong(rs, "plan_amount"),
        nullableLong(rs, "recent_payment_id"),
        nullableLong(rs, "recent_payment_amount"),
        rs.getString("recent_payment_status"),
        offsetDateTime(rs, "recent_payment_approved_at"),
        rs.getString("failed_status"));
  }

  @Nullable
  private OffsetDateTime offsetDateTime(ResultSet rs, String columnName) throws SQLException {
    return rs.getObject(columnName, OffsetDateTime.class);
  }

  @Nullable
  private Long nullableLong(ResultSet rs, String columnName) throws SQLException {
    long value = rs.getLong(columnName);
    return rs.wasNull() ? null : value;
  }
}
