package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("WebhookEvent 도메인")
class WebhookEventTest {

  @Test
  @DisplayName("생성 시 미처리 상태이다")
  void received_isUnprocessed() {
    WebhookEvent event = WebhookEvent.received("txn_1", "PAYMENT_STATUS", "{}");

    assertThat(event.isProcessed()).isFalse();
    assertThat(event.getTransmissionId()).isEqualTo("txn_1");
    assertThat(event.getEventType()).isEqualTo("PAYMENT_STATUS");
  }

  @Test
  @DisplayName("markProcessed 후 처리됨 상태로 전이한다")
  void markProcessed_setsProcessedAt() {
    WebhookEvent event = WebhookEvent.received("txn_1", "PAYMENT_STATUS", "{}");
    OffsetDateTime processedAt = OffsetDateTime.parse("2026-06-01T00:00:00Z");

    event.markProcessed(processedAt);

    assertThat(event.isProcessed()).isTrue();
    assertThat(event.getProcessedAt()).isEqualTo(processedAt);
  }

  @Test
  @DisplayName("null processedAt으로 markProcessed 시 거부한다 (V-NEW-009)")
  void markProcessed_nullProcessedAt_throws() {
    WebhookEvent event = WebhookEvent.received("txn_1", "PAYMENT_STATUS", "{}");

    assertThatThrownBy(() -> event.markProcessed(null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("transmissionId가 blank이면 received() 생성을 거부한다")
  void received_blankTransmissionId_throws() {
    assertThatThrownBy(() -> WebhookEvent.received("", "TYPE", "{}"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> WebhookEvent.received(null, "TYPE", "{}"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
