package com.init.payment.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Toss 웹훅 멱등 기록. transmission_id unique로 중복 처리를 차단한다 (U-003). */
@Entity
@Table(name = "webhook_event", schema = "payment")
public class WebhookEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "transmission_id", nullable = false, unique = true)
  private String transmissionId;

  @Column(name = "event_type")
  private String eventType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload", columnDefinition = "jsonb")
  private String payload;

  @Column(name = "processed_at")
  private OffsetDateTime processedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected WebhookEvent() {}

  public static WebhookEvent received(String transmissionId, String eventType, String payload) {
    if (transmissionId == null || transmissionId.isBlank()) {
      throw new IllegalArgumentException("transmissionId must not be blank");
    }
    WebhookEvent event = new WebhookEvent();
    event.transmissionId = transmissionId;
    event.eventType = eventType;
    event.payload = payload;
    return event;
  }

  public void markProcessed(OffsetDateTime processedAt) {
    if (processedAt == null) {
      throw new IllegalArgumentException("processedAt must not be null");
    }
    this.processedAt = processedAt;
  }

  public boolean isProcessed() {
    return processedAt != null;
  }

  @PrePersist
  protected void onPersist() {
    this.createdAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getTransmissionId() {
    return transmissionId;
  }

  public String getEventType() {
    return eventType;
  }

  public String getPayload() {
    return payload;
  }

  public OffsetDateTime getProcessedAt() {
    return processedAt;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
