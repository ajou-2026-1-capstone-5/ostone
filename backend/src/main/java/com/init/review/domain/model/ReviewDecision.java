package com.init.review.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "review_decision", schema = "review")
public class ReviewDecision {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "review_session_id", nullable = false, updatable = false)
  private Long reviewSessionId;

  @Column(name = "target_type", nullable = false)
  private String targetType;

  @Column(name = "target_id")
  private Long targetId;

  @Column(name = "decision_type", nullable = false)
  private String decisionType;

  @Column(name = "reason")
  private String reason;

  @Column(name = "decided_by", nullable = false)
  private Long decidedBy;

  @Column(name = "decision_payload_json", columnDefinition = "jsonb", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String decisionPayloadJson;

  @Column(name = "decided_at", nullable = false, updatable = false)
  private OffsetDateTime decidedAt;

  protected ReviewDecision() {}

  public static ReviewDecision create(
      Long reviewSessionId,
      String targetType,
      Long targetId,
      String decisionType,
      String reason,
      Long decidedBy,
      String decisionPayloadJson,
      OffsetDateTime decidedAt) {
    ReviewDecision decision = new ReviewDecision();
    decision.reviewSessionId = reviewSessionId;
    decision.targetType = targetType;
    decision.targetId = targetId;
    decision.decisionType = decisionType;
    decision.reason = reason;
    decision.decidedBy = decidedBy;
    decision.decisionPayloadJson = decisionPayloadJson != null ? decisionPayloadJson : "{}";
    decision.decidedAt = decidedAt;
    return decision;
  }

  public Long getId() {
    return id;
  }

  public String getDecisionPayloadJson() {
    return decisionPayloadJson;
  }
}
