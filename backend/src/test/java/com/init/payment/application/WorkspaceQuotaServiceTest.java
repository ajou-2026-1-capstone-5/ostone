package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.shared.application.exception.QuotaExceededException;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkspaceQuotaService")
class WorkspaceQuotaServiceTest {

  @Mock private WorkspaceQuotaQueryPort quotaQueryPort;
  @Mock private WorkspaceQuotaUsagePort usagePort;

  private WorkspaceQuotaService service;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-06-04T00:00:00Z"), ZoneOffset.UTC);
  private final OffsetDateTime periodStart = OffsetDateTime.parse("2026-06-01T00:00:00Z");
  private final OffsetDateTime periodEnd = OffsetDateTime.parse("2026-07-01T00:00:00Z");
  // QuotaWindow.hourEndingAt(now): [now-1h, now)
  private final OffsetDateTime hourFrom = OffsetDateTime.parse("2026-06-03T23:00:00Z");
  private final OffsetDateTime hourTo = OffsetDateTime.parse("2026-06-04T00:00:00Z");

  @BeforeEach
  void setUp() {
    service = new WorkspaceQuotaService(quotaQueryPort, usagePort, fixedClock);
  }

  // --- dataset upload (per billing period, unchanged) ---

  @Test
  @DisplayName("현재 기간 dataset 사용량이 한도 미만이면 허용한다")
  void assertDatasetUploadAllowed_underLimit_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(10, 3, 5, 1)));
    given(usagePort.countDatasetUploads(1L, periodStart, periodEnd)).willReturn(2L);

    assertThatCode(() -> service.assertDatasetUploadAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("현재 기간 dataset 사용량이 한도에 도달하면 QUOTA_EXCEEDED를 던진다")
  void assertDatasetUploadAllowed_atLimit_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(10, 3, 5, 1)));
    given(usagePort.countDatasetUploads(1L, periodStart, periodEnd)).willReturn(3L);

    assertThatThrownBy(() -> service.assertDatasetUploadAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              assertThat(ex.getResource()).isEqualTo("DATASET_UPLOAD");
              assertThat(ex.getLimit()).isEqualTo(3);
              assertThat(ex.getUsed()).isEqualTo(3);
            });
  }

  // --- domain pack operation (generation + review, hourly) ---

  @Test
  @DisplayName("구독 시 직전 1시간 도메인팩 작업이 시간당 한도 미만이면 허용한다")
  void assertPipelineRunAllowed_subscribedUnderHourlyLimit_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(3, 10, 10, 5)));
    given(usagePort.countDomainPackOperations(1L, hourFrom, hourTo)).willReturn(4L);

    assertThatCode(() -> service.assertPipelineRunAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("구독 시 직전 1시간 도메인팩 작업이 시간당 한도에 도달하면 DOMAIN_PACK_OPERATION을 던진다")
  void assertPipelineRunAllowed_subscribedAtHourlyLimit_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(3, 10, 10, 1)));
    given(usagePort.countDomainPackOperations(1L, hourFrom, hourTo)).willReturn(1L);

    assertThatThrownBy(() -> service.assertPipelineRunAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              assertThat(ex.getResource()).isEqualTo("DOMAIN_PACK_OPERATION");
              assertThat(ex.getLimit()).isEqualTo(1);
              assertThat(ex.getUsed()).isEqualTo(1);
            });
  }

  @Test
  @DisplayName("Enterprise(시간당 한도 -1) 구독은 카운트 조회 없이 도메인팩 작업을 허용한다")
  void assertPipelineRunAllowed_unlimitedPlan_allowsWithoutCounting() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(-1, -1, -1, -1)));

    assertThatCode(() -> service.assertPipelineRunAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("구독이 없어도 무료 온보딩 첫 도메인팩 작업 권리가 남아 있으면 허용한다")
  void assertPipelineRunAllowed_freeOnboardingFirstRun_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.empty());
    given(usagePort.countDomainPackOperations(1L)).willReturn(0L);
    given(quotaQueryPort.hasFreeOnboardingAllowance(1L)).willReturn(true);

    assertThatCode(() -> service.assertPipelineRunAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("구독과 무료 온보딩 권리가 없으면 도메인팩 작업을 차단한다")
  void assertPipelineRunAllowed_noSubscriptionNoFreeAllowance_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.empty());
    given(usagePort.countDomainPackOperations(1L)).willReturn(0L);
    given(quotaQueryPort.hasFreeOnboardingAllowance(1L)).willReturn(false);

    assertThatThrownBy(() -> service.assertPipelineRunAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              assertThat(ex.getResource()).isEqualTo("DOMAIN_PACK_OPERATION");
              assertThat(ex.getLimit()).isZero();
              assertThat(ex.getUsed()).isZero();
            });
  }

  // --- member add ---

  @Test
  @DisplayName("구독 멤버 수가 한도 미만이면 멤버 추가를 허용한다")
  void assertMemberAddAllowed_subscribedUnderLimit_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(3, 10, 10, 1)));
    given(usagePort.countMembers(1L)).willReturn(2L);

    assertThatCode(() -> service.assertMemberAddAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("구독 멤버 수가 한도에 도달하면 MEMBER QUOTA_EXCEEDED를 던진다")
  void assertMemberAddAllowed_subscribedAtLimit_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(3, 10, 10, 1)));
    given(usagePort.countMembers(1L)).willReturn(3L);

    assertThatThrownBy(() -> service.assertMemberAddAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              assertThat(ex.getResource()).isEqualTo("MEMBER");
              assertThat(ex.getLimit()).isEqualTo(3);
              assertThat(ex.getUsed()).isEqualTo(3);
            });
  }

  @Test
  @DisplayName("Enterprise(멤버 한도 -1) 구독은 카운트 조회 없이 멤버 추가를 허용한다")
  void assertMemberAddAllowed_unlimitedPlan_allowsWithoutCounting() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(-1, -1, -1, -1)));

    assertThatCode(() -> service.assertMemberAddAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("미구독(Free) 워크스페이스의 오너 생성(used=0)은 허용한다")
  void assertMemberAddAllowed_freeOwnerCreation_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.empty());
    given(usagePort.countMembers(1L)).willReturn(0L);

    assertThatCode(() -> service.assertMemberAddAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("미구독(Free) 멤버가 1명이면 추가 멤버는 차단한다")
  void assertMemberAddAllowed_freeAtLimit_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.empty());
    given(usagePort.countMembers(1L)).willReturn(1L);

    assertThatThrownBy(() -> service.assertMemberAddAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              assertThat(ex.getResource()).isEqualTo("MEMBER");
              assertThat(ex.getLimit()).isEqualTo(1);
              assertThat(ex.getUsed()).isEqualTo(1);
            });
  }

  private WorkspaceQuota quota(
      int memberLimit, int datasetLimit, int pipelineLimit, int hourlyLimit) {
    return new WorkspaceQuota(
        1L,
        "pro_monthly",
        memberLimit,
        datasetLimit,
        pipelineLimit,
        hourlyLimit,
        periodStart,
        periodEnd);
  }
}
