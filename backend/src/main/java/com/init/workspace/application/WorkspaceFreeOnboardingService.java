package com.init.workspace.application;

import com.init.workspace.application.exception.FreeOnboardingUnavailableException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.model.FreeOnboardingStatus;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkspaceFreeOnboardingService {

  private final WorkspaceRepository workspaceRepository;
  private final WorkspaceSubscriptionStatusPort subscriptionStatusPort;
  private final Clock clock;

  public WorkspaceFreeOnboardingService(
      WorkspaceRepository workspaceRepository,
      WorkspaceSubscriptionStatusPort subscriptionStatusPort,
      Clock clock) {
    this.workspaceRepository = workspaceRepository;
    this.subscriptionStatusPort = subscriptionStatusPort;
    this.clock = clock;
  }

  public void assertCanUploadRawFile(Long workspaceId) {
    if (subscriptionStatusPort.hasActiveSubscription(workspaceId)) {
      return;
    }
    Workspace workspace = findWorkspace(workspaceId);
    if (workspace.canStartFreeOnboarding()) {
      return;
    }
    if (workspace.getFreeOnboardingStatus() == FreeOnboardingStatus.IN_PROGRESS) {
      throw new FreeOnboardingUnavailableException("무료 온보딩이 이미 진행 중입니다.");
    }
    throw new FreeOnboardingUnavailableException("무료 온보딩 권리가 소진되었습니다. 구독 활성화가 필요합니다.");
  }

  @Transactional
  public void claimUploadIfNeeded(Long workspaceId, Long datasetId) {
    if (subscriptionStatusPort.hasActiveSubscription(workspaceId)) {
      return;
    }
    Workspace workspace = findWorkspace(workspaceId);
    if (!workspace.canStartFreeOnboarding()) {
      return;
    }
    workspace.startFreeOnboarding(datasetId, now());
    workspaceRepository.save(workspace);
  }

  public void assertCanTriggerDomainPackGeneration(Long workspaceId, Long datasetId) {
    if (subscriptionStatusPort.hasActiveSubscription(workspaceId)) {
      return;
    }
    Workspace workspace = findWorkspace(workspaceId);
    if (workspace.isFreeOnboardingInProgressForDataset(datasetId)) {
      return;
    }
    if (workspace.getFreeOnboardingStatus() == FreeOnboardingStatus.AVAILABLE) {
      throw new FreeOnboardingUnavailableException("무료 온보딩은 raw-file 업로드 후 실행할 수 있습니다.");
    }
    if (workspace.getFreeOnboardingStatus() == FreeOnboardingStatus.IN_PROGRESS) {
      throw new FreeOnboardingUnavailableException("무료 온보딩 대상 데이터셋만 도메인팩 생성을 실행할 수 있습니다.");
    }
    throw new FreeOnboardingUnavailableException("무료 온보딩 권리가 소진되었습니다. 구독 활성화가 필요합니다.");
  }

  @Transactional
  public void claimGenerationIfNeeded(Long workspaceId, Long datasetId, Long pipelineJobId) {
    if (subscriptionStatusPort.hasActiveSubscription(workspaceId)) {
      return;
    }
    Workspace workspace = findWorkspace(workspaceId);
    if (!workspace.isFreeOnboardingInProgressForDataset(datasetId)) {
      return;
    }
    workspace.attachFreeOnboardingPipelineJob(datasetId, pipelineJobId);
    workspaceRepository.save(workspace);
  }

  @Transactional
  public void consumeForFinalPipelineJob(Long workspaceId, Long pipelineJobId, boolean finalized) {
    if (!finalized) {
      return;
    }
    Workspace workspace = findWorkspace(workspaceId);
    if (workspace.consumeFreeOnboarding(pipelineJobId, now())) {
      workspaceRepository.save(workspace);
    }
  }

  @Transactional
  public WorkspaceFreeOnboardingResult restore(Long workspaceId) {
    Workspace workspace = findWorkspace(workspaceId);
    workspace.restoreFreeOnboarding();
    return WorkspaceFreeOnboardingResult.from(workspaceRepository.save(workspace));
  }

  private Workspace findWorkspace(Long workspaceId) {
    return workspaceRepository
        .findById(workspaceId)
        .orElseThrow(() -> new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다."));
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(clock);
  }
}
