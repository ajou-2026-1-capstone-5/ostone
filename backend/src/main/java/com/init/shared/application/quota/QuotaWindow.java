package com.init.shared.application.quota;

import java.time.OffsetDateTime;

/**
 * 시간당 rate-limit 강제를 위한 롤링 윈도우. {@code [fromInclusive, toExclusive)} 범위를 표현한다.
 *
 * <p>윈도우 계산 로직을 한 곳에 모아 생성/검토 경로 간 중복을 방지한다.
 */
public record QuotaWindow(OffsetDateTime fromInclusive, OffsetDateTime toExclusive) {

  /** {@code now} 기준 직전 1시간 윈도우 {@code [now-1h, now)}. */
  public static QuotaWindow hourEndingAt(OffsetDateTime now) {
    return new QuotaWindow(now.minusHours(1), now);
  }
}
