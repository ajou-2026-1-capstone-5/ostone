package com.init.payment.application;

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

  @BeforeEach
  void setUp() {
    service = new WorkspaceQuotaService(quotaQueryPort, usagePort, fixedClock);
  }

  @Test
  @DisplayName("현재 기간 dataset 사용량이 한도 미만이면 허용한다")
  void assertDatasetUploadAllowed_underLimit_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(3, 5)));
    given(usagePort.countDatasetUploads(1L, periodStart, periodEnd)).willReturn(2L);

    assertThatCode(() -> service.assertDatasetUploadAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("현재 기간 dataset 사용량이 한도에 도달하면 QUOTA_EXCEEDED를 던진다")
  void assertDatasetUploadAllowed_atLimit_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.of(quota(3, 5)));
    given(usagePort.countDatasetUploads(1L, periodStart, periodEnd)).willReturn(3L);

    assertThatThrownBy(() -> service.assertDatasetUploadAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              org.assertj.core.api.Assertions.assertThat(ex.getResource())
                  .isEqualTo("DATASET_UPLOAD");
              org.assertj.core.api.Assertions.assertThat(ex.getLimit()).isEqualTo(3);
              org.assertj.core.api.Assertions.assertThat(ex.getUsed()).isEqualTo(3);
            });
  }

  @Test
  @DisplayName("구독이 없어도 무료 온보딩 첫 pipeline 실행 권리가 남아 있으면 허용한다")
  void assertPipelineRunAllowed_freeOnboardingFirstRun_allows() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.empty());
    given(usagePort.countPipelineRuns(1L)).willReturn(0L);
    given(quotaQueryPort.hasFreeOnboardingAllowance(1L)).willReturn(true);

    assertThatCode(() -> service.assertPipelineRunAllowed(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("구독과 무료 온보딩 권리가 없으면 pipeline 실행을 차단한다")
  void assertPipelineRunAllowed_noSubscriptionNoFreeAllowance_throws() {
    given(quotaQueryPort.findCurrentQuota(1L, OffsetDateTime.now(fixedClock)))
        .willReturn(Optional.empty());
    given(usagePort.countPipelineRuns(1L)).willReturn(0L);
    given(quotaQueryPort.hasFreeOnboardingAllowance(1L)).willReturn(false);

    assertThatThrownBy(() -> service.assertPipelineRunAllowed(1L))
        .isInstanceOfSatisfying(
            QuotaExceededException.class,
            ex -> {
              org.assertj.core.api.Assertions.assertThat(ex.getResource())
                  .isEqualTo("PIPELINE_RUN");
              org.assertj.core.api.Assertions.assertThat(ex.getLimit()).isZero();
              org.assertj.core.api.Assertions.assertThat(ex.getUsed()).isZero();
            });
  }

  private WorkspaceQuota quota(int datasetLimit, int pipelineLimit) {
    return new WorkspaceQuota(
        1L, "pro_monthly", 10, datasetLimit, pipelineLimit, periodStart, periodEnd);
  }
}
