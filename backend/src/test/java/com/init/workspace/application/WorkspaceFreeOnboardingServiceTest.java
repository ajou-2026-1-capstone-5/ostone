package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.testsupport.PersistenceTestFixtures;
import com.init.workspace.application.exception.FreeOnboardingUnavailableException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.model.FreeOnboardingStatus;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.repository.WorkspaceRepository;
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
@DisplayName("WorkspaceFreeOnboardingService")
class WorkspaceFreeOnboardingServiceTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceSubscriptionStatusPort subscriptionStatusPort;

  private WorkspaceFreeOnboardingService service;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-06-04T00:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    service =
        new WorkspaceFreeOnboardingService(workspaceRepository, subscriptionStatusPort, fixedClock);
  }

  @Test
  @DisplayName("활성 구독이면 raw-file 업로드를 무료권 상태 조회 없이 허용한다")
  void assertCanUploadRawFile_activeSubscription_allowsWithoutLookup() {
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(true);

    assertThatCode(() -> service.assertCanUploadRawFile(1L)).doesNotThrowAnyException();

    verify(workspaceRepository, never()).findById(1L);
  }

  @Test
  @DisplayName("무료권이 AVAILABLE이면 raw-file 업로드를 허용한다")
  void assertCanUploadRawFile_available_allows() {
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace()));

    assertThatCode(() -> service.assertCanUploadRawFile(1L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("무료권이 진행 중이면 추가 raw-file 업로드를 차단한다")
  void assertCanUploadRawFile_inProgress_throws() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));

    assertThatThrownBy(() -> service.assertCanUploadRawFile(1L))
        .isInstanceOf(FreeOnboardingUnavailableException.class)
        .hasMessageContaining("이미 진행 중");
  }

  @Test
  @DisplayName("무료권이 CONSUMED이면 raw-file 업로드를 차단한다")
  void assertCanUploadRawFile_consumed_throws() {
    Workspace workspace = consumedWorkspace();
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));

    assertThatThrownBy(() -> service.assertCanUploadRawFile(1L))
        .isInstanceOf(FreeOnboardingUnavailableException.class)
        .hasMessageContaining("소진");
  }

  @Test
  @DisplayName("무료권이 AVAILABLE이면 업로드 claim으로 IN_PROGRESS가 된다")
  void claimUploadIfNeeded_available_startsOnboarding() {
    Workspace workspace = workspace();
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceRepository.save(workspace)).willReturn(workspace);

    service.claimUploadIfNeeded(1L, 10L);

    assertThat(workspace.getFreeOnboardingStatus()).isEqualTo(FreeOnboardingStatus.IN_PROGRESS);
    assertThat(workspace.getFreeOnboardingDatasetId()).isEqualTo(10L);
    assertThat(workspace.getFreeOnboardingStartedAt()).isEqualTo(now());
    verify(workspaceRepository).save(workspace);
  }

  @Test
  @DisplayName("활성 구독이면 업로드 claim을 건너뛴다")
  void claimUploadIfNeeded_activeSubscription_skips() {
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(true);

    service.claimUploadIfNeeded(1L, 10L);

    verify(workspaceRepository, never()).findById(1L);
    verify(workspaceRepository, never()).save(org.mockito.ArgumentMatchers.any());
  }

  @Test
  @DisplayName("동일 dataset의 IN_PROGRESS 무료권이면 generation trigger를 허용한다")
  void assertCanTriggerDomainPackGeneration_matchingDataset_allows() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));

    assertThatCode(() -> service.assertCanTriggerDomainPackGeneration(1L, 10L))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("AVAILABLE 상태에서는 raw-file 업로드 전 generation trigger를 차단한다")
  void assertCanTriggerDomainPackGeneration_available_throws() {
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace()));

    assertThatThrownBy(() -> service.assertCanTriggerDomainPackGeneration(1L, 10L))
        .isInstanceOf(FreeOnboardingUnavailableException.class)
        .hasMessageContaining("업로드 후");
  }

  @Test
  @DisplayName("다른 dataset의 generation trigger는 차단한다")
  void assertCanTriggerDomainPackGeneration_otherDataset_throws() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));

    assertThatThrownBy(() -> service.assertCanTriggerDomainPackGeneration(1L, 11L))
        .isInstanceOf(FreeOnboardingUnavailableException.class)
        .hasMessageContaining("대상 데이터셋");
  }

  @Test
  @DisplayName("matching dataset이면 generation claim으로 pipeline job을 연결한다")
  void claimGenerationIfNeeded_matchingDataset_attachesJob() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceRepository.save(workspace)).willReturn(workspace);

    service.claimGenerationIfNeeded(1L, 10L, 99L);

    assertThat(workspace.getFreeOnboardingPipelineJobId()).isEqualTo(99L);
    verify(workspaceRepository).save(workspace);
  }

  @Test
  @DisplayName("최종 상태가 아니면 무료권 소진을 건너뛴다")
  void consumeForFinalPipelineJob_notFinalized_skips() {
    service.consumeForFinalPipelineJob(1L, 99L, false);

    verify(workspaceRepository, never()).findById(1L);
  }

  @Test
  @DisplayName("연결된 최종 pipeline job이면 무료권을 CONSUMED로 소진한다")
  void consumeForFinalPipelineJob_matchingJob_consumes() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    workspace.attachFreeOnboardingPipelineJob(10L, 99L);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceRepository.save(workspace)).willReturn(workspace);

    service.consumeForFinalPipelineJob(1L, 99L, true);

    assertThat(workspace.getFreeOnboardingStatus()).isEqualTo(FreeOnboardingStatus.CONSUMED);
    assertThat(workspace.getFreeOnboardingConsumedAt()).isEqualTo(now());
    verify(workspaceRepository).save(workspace);
  }

  @Test
  @DisplayName("연결되지 않은 pipeline job이면 무료권 소진을 건너뛴다")
  void consumeForFinalPipelineJob_otherJob_skipsSave() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    workspace.attachFreeOnboardingPipelineJob(10L, 99L);
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));

    service.consumeForFinalPipelineJob(1L, 100L, true);

    verify(workspaceRepository, never()).save(workspace);
  }

  @Test
  @DisplayName("restore는 무료권 상태와 연결 정보를 초기화하고 결과를 반환한다")
  void restore_resetsAndReturnsResult() {
    Workspace workspace = consumedWorkspace();
    given(workspaceRepository.findById(1L)).willReturn(Optional.of(workspace));
    given(workspaceRepository.save(workspace)).willReturn(workspace);

    WorkspaceFreeOnboardingResult result = service.restore(1L);

    assertThat(result.workspaceId()).isEqualTo(1L);
    assertThat(result.status()).isEqualTo("AVAILABLE");
    assertThat(result.datasetId()).isNull();
    assertThat(result.pipelineJobId()).isNull();
    assertThat(result.startedAt()).isNull();
    assertThat(result.consumedAt()).isNull();
  }

  @Test
  @DisplayName("워크스페이스가 없으면 WorkspaceNotFoundException을 던진다")
  void assertCanUploadRawFile_workspaceNotFound_throws() {
    given(subscriptionStatusPort.hasActiveSubscription(1L)).willReturn(false);
    given(workspaceRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.assertCanUploadRawFile(1L))
        .isInstanceOf(WorkspaceNotFoundException.class);
  }

  private Workspace consumedWorkspace() {
    Workspace workspace = workspace();
    workspace.startFreeOnboarding(10L, now());
    workspace.attachFreeOnboardingPipelineJob(10L, 99L);
    workspace.consumeFreeOnboarding(99L, now());
    return workspace;
  }

  private Workspace workspace() {
    Workspace workspace = Workspace.create(WorkspaceKey.of("cs-team-alpha"), "CS Team", "desc");
    PersistenceTestFixtures.assignGeneratedId(workspace, 1L);
    return workspace;
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(fixedClock);
  }
}
