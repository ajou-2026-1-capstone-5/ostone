package com.init.shared.application.quota;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("QuotaWindow")
class QuotaWindowTest {

  @Test
  @DisplayName("hourEndingAt은 [now-1h, now) 윈도우를 만든다")
  void hourEndingAt_returnsPrecedingHour() {
    OffsetDateTime now = OffsetDateTime.parse("2026-06-04T10:30:00Z");

    QuotaWindow window = QuotaWindow.hourEndingAt(now);

    assertThat(window.fromInclusive()).isEqualTo(OffsetDateTime.parse("2026-06-04T09:30:00Z"));
    assertThat(window.toExclusive()).isEqualTo(now);
  }
}
