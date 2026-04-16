package com.init.pipelinejob.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "webhook_receipt", schema = "pipeline")
public class WebhookReceipt {

  public static final String STATUS_RECEIVED = "RECEIVED";
  public static final String STATUS_PROCESSED = "PROCESSED";
  public static final String STATUS_FAILED = "FAILED";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "pipeline_job_id")
  private Long pipelineJobId;

  @Column(name = "external_event_id")
  private String externalEventId;

  @Column(name = "webhook_type", nullable = false)
  private String webhookType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "request_headers_json", columnDefinition = "jsonb", nullable = false)
  private String requestHeadersJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "request_body_json", columnDefinition = "jsonb", nullable = false)
  private String requestBodyJson;

  @Column(name = "processing_status", nullable = false)
  private String processingStatus;

  @Column(name = "received_at", nullable = false, updatable = false)
  private OffsetDateTime receivedAt;

  @Column(name = "processed_at")
  private OffsetDateTime processedAt;

  protected WebhookReceipt() {}

  public static WebhookReceipt receive(
      Long pipelineJobId,
      String externalEventId,
      String webhookType,
      String requestHeadersJson,
      String requestBodyJson,
      OffsetDateTime receivedAt) {
    Objects.requireNonNull(webhookType, "webhookType must not be null");
    Objects.requireNonNull(receivedAt, "receivedAt must not be null");

    WebhookReceipt receipt = new WebhookReceipt();
    receipt.pipelineJobId = pipelineJobId;
    receipt.externalEventId = externalEventId;
    receipt.webhookType = webhookType;
    receipt.requestHeadersJson = requestHeadersJson != null ? requestHeadersJson : "{}";
    receipt.requestBodyJson = requestBodyJson != null ? requestBodyJson : "{}";
    receipt.processingStatus = STATUS_RECEIVED;
    receipt.receivedAt = receivedAt;
    return receipt;
  }

  public void markProcessed(OffsetDateTime processedAt) {
    validateTransition(STATUS_PROCESSED);
    this.processingStatus = STATUS_PROCESSED;
    this.processedAt = processedAt;
  }

  public void markFailed(OffsetDateTime processedAt) {
    validateTransition(STATUS_FAILED);
    this.processingStatus = STATUS_FAILED;
    this.processedAt = processedAt;
  }

  public Long getId() {
    return id;
  }

  public Long getPipelineJobId() {
    return pipelineJobId;
  }

  public String getExternalEventId() {
    return externalEventId;
  }

  public String getProcessingStatus() {
    return processingStatus;
  }

  private void validateTransition(String targetStatus) {
    if (STATUS_PROCESSED.equals(this.processingStatus) && !STATUS_PROCESSED.equals(targetStatus)) {
      throw new IllegalStateException(
          "Webhook receipt 상태를 PROCESSED에서 " + targetStatus + "로 변경할 수 없습니다.");
    }
  }
}
