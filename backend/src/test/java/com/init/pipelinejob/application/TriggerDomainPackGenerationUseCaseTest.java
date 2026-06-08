package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceAccessDeniedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.application.quota.WorkspaceQuotaValidator;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("TriggerDomainPackGenerationUseCase")
class TriggerDomainPackGenerationUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DatasetOwnershipPort datasetOwnershipPort;
  @Mock private DatasetRawFileLookupPort datasetRawFileLookupPort;
  @Mock private DomainPackGenerationConcurrencyGuard concurrencyGuard;
  @Mock private DomainPackGenerationTriggerPort triggerPort;
  @Mock private WorkspaceQuotaValidator workspaceQuotaValidator;
  @Mock private PlatformTransactionManager transactionManager;
  @Mock private WorkspaceFreeOnboardingService freeOnboardingService;

  private TriggerDomainPackGenerationUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-05-04T10:00:00Z"), ZoneOffset.UTC);
  private final AtomicReference<PipelineJob> savedJob = new AtomicReference<>();
  private final AtomicReference<String> activeStatus = new AtomicReference<>();

  @BeforeEach
  void setUp() {
    TransactionStatus transactionStatus = new SimpleTransactionStatus();
    lenient()
        .when(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .thenReturn(transactionStatus);
    lenient().when(triggerPort.dagId()).thenReturn("domain_pack_generation");
    lenient()
        .when(pipelineJobRepository.saveAndFlush(any()))
        .thenAnswer(
            invocation -> {
              PipelineJob job = invocation.getArgument(0);
              if (job.getId() == null) {
                job = PipelineJobFixtures.persisted(job, 123L);
              }
              savedJob.set(job);
              return job;
            });
    lenient()
        .when(pipelineJobRepository.findById(123L))
        .thenAnswer(invocation -> Optional.ofNullable(savedJob.get()));

    useCase =
        new TriggerDomainPackGenerationUseCase(
            pipelineJobRepository,
            workspaceMembershipPort,
            datasetOwnershipPort,
            datasetRawFileLookupPort,
            concurrencyGuard,
            triggerPort,
            new ObjectMapper(),
            fixedClock,
            transactionManager,
            workspaceQuotaValidator,
            freeOnboardingService);
  }

  @Test
  @DisplayName("권한과 dataset 검증 후 Airflow trigger 성공이면 RUNNING job을 반환한다")
  void execute_success_marksRunning() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    given(triggerPort.trigger(any()))
        .willReturn(
            new DomainPackGenerationTriggerResult("domain_pack_generation", "pipeline_job_123"));

    TriggerDomainPackGenerationResult result = useCase.execute(command());

    assertThat(result.pipelineJobId()).isEqualTo(123L);
    assertThat(result.status()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(result.airflowDagId()).isEqualTo("domain_pack_generation");
    assertThat(result.airflowRunId()).isEqualTo("pipeline_job_123");
    assertThat(result.requestedAt().toInstant()).isEqualTo(fixedClock.instant());
    assertThat(result.startedAt().toInstant()).isEqualTo(fixedClock.instant());
    assertThat(savedJob.get().getRequestPayloadJson()).contains("\"requestedBy\":55");
    assertThat(savedJob.get().getRequestPayloadJson())
        .contains("\"objectKey\":\"workspaces/1/datasets/travel/raw.json\"");
    verify(concurrencyGuard).lockTriggerCreation(1L, 7L);
    verify(freeOnboardingService).assertCanTriggerDomainPackGeneration(1L, 7L);
    verify(freeOnboardingService).claimGenerationIfNeeded(1L, 7L, 123L);
  }

  @Test
  @DisplayName("admin retry command는 workspace role 검사 없이 원본 object key와 retry 관계를 기록한다")
  void execute_adminRetry_usesProvidedObjectKey() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(datasetOwnershipPort.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    given(triggerPort.trigger(any()))
        .willReturn(
            new DomainPackGenerationTriggerResult("domain_pack_generation", "pipeline_job_123"));

    TriggerDomainPackGenerationResult result =
        useCase.execute(
            TriggerDomainPackGenerationCommand.adminRetry(
                1L, 7L, 99L, "workspaces/1/datasets/7/raw.json", 11L));

    assertThat(result.status()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(savedJob.get().getRetriedFromJobId()).isEqualTo(11L);
    assertThat(savedJob.get().getRequestPayloadJson()).contains("\"requestedBy\":99");
    assertThat(savedJob.get().getRequestPayloadJson()).contains("\"runMode\":\"RETRY\"");
    assertThat(savedJob.get().getRequestPayloadJson())
        .contains("\"objectKey\":\"workspaces/1/datasets/7/raw.json\"");
    verify(workspaceMembershipPort, never()).hasAnyRole(any(), any(), any());
    verify(datasetRawFileLookupPort, never()).findLatestObjectKeyByDatasetId(any());
  }

  @Test
  @DisplayName("workspace role이 부족하면 403 예외를 던진다")
  void execute_reviewer_throwsAccessDenied() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(command()))
        .isInstanceOf(PipelineJobWorkspaceAccessDeniedException.class);

    verify(triggerPort, never()).dagId();
  }

  @Test
  @DisplayName("active job이 있으면 기존 job을 반환하고 새 Airflow trigger를 만들지 않는다")
  void execute_activeJob_returnsExistingJob() {
    allowAccess();
    PipelineJob activeJob = pipelineJob(11L, PipelineJob.STATUS_RUNNING);
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.of(activeJob));

    TriggerDomainPackGenerationResult result = useCase.execute(command());

    assertThat(result.pipelineJobId()).isEqualTo(11L);
    assertThat(result.status()).isEqualTo(PipelineJob.STATUS_RUNNING);
    verify(pipelineJobRepository, never()).saveAndFlush(any());
    verify(triggerPort, never()).dagId();
    verify(triggerPort, never()).trigger(any());
    verify(workspaceQuotaValidator, never()).assertPipelineRunAllowed(any());
    verify(freeOnboardingService, never()).claimGenerationIfNeeded(any(), any(), any());
  }

  @Test
  @DisplayName("대기 콜백 상태까지 active job으로 판단해 기존 job을 반환한다")
  void execute_callbackWaitingStatuses_returnExistingJob() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willAnswer(invocation -> Optional.of(pipelineJob(11L, activeStatus.get())));

    for (String status :
        new String[] {
          PipelineJob.STATUS_QUEUED,
          PipelineJob.STATUS_RUNNING,
          PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION,
          PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK,
          PipelineJob.STATUS_WAITING_INTENT_CALLBACK,
          PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK
        }) {
      activeStatus.set(status);

      TriggerDomainPackGenerationResult result = useCase.execute(command());

      assertThat(result.status()).as("status=%s", status).isEqualTo(status);
    }

    verify(triggerPort, never()).trigger(any());
    verify(pipelineJobRepository, never()).saveAndFlush(any());
    verify(workspaceQuotaValidator, never()).assertPipelineRunAllowed(any());
    verify(freeOnboardingService, times(6)).assertCanTriggerDomainPackGeneration(1L, 7L);
    verify(freeOnboardingService, never()).claimGenerationIfNeeded(any(), any(), any());
  }

  @Test
  @DisplayName("권한 검증 후 Airflow 설정이 유효하지 않으면 job 생성 전에 실패한다")
  void execute_invalidAirflowConfiguration_doesNotCreateJob() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    given(triggerPort.dagId()).willThrow(new AirflowConfigurationInvalidException());

    assertThatThrownBy(() -> useCase.execute(command()))
        .isInstanceOf(AirflowConfigurationInvalidException.class);

    verify(concurrencyGuard).lockTriggerCreation(1L, 7L);
    verify(pipelineJobRepository, never()).saveAndFlush(any());
    verify(triggerPort, never()).trigger(any());
  }

  @Test
  @DisplayName("dataset raw file이 없으면 RAW_FILE_NOT_FOUND 예외를 던지고 job을 만들지 않는다")
  void execute_missingRawFile_throwsNotFound() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    given(datasetRawFileLookupPort.findLatestObjectKeyByDatasetId(7L)).willReturn(Optional.empty());
    TriggerDomainPackGenerationCommand command = command();

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(NotFoundException.class)
        .satisfies(
            throwable ->
                assertThat(((NotFoundException) throwable).getCode())
                    .isEqualTo("RAW_FILE_NOT_FOUND"));

    verify(pipelineJobRepository, never()).saveAndFlush(any());
    verify(triggerPort, never()).trigger(any());
  }

  @Test
  @DisplayName("pipeline run quota 초과 시 job 생성과 Airflow trigger를 실행하지 않는다")
  void execute_quotaExceeded_doesNotCreateJob() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    willThrow(new QuotaExceededException("PIPELINE_RUN", 5, 5))
        .given(workspaceQuotaValidator)
        .assertPipelineRunAllowed(1L);

    TriggerDomainPackGenerationCommand command = command();

    assertThatThrownBy(() -> useCase.execute(command)).isInstanceOf(QuotaExceededException.class);

    verify(pipelineJobRepository, never()).saveAndFlush(any());
    verify(triggerPort, never()).trigger(any());
  }

  @Test
  @DisplayName("Airflow trigger 성공 후 callback이 먼저 job을 종료했으면 현재 상태를 반환한다")
  void execute_triggerSuccessButJobAlreadyFinalized_returnsCurrentJob() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    given(triggerPort.trigger(any()))
        .willAnswer(
            invocation -> {
              savedJob.get().markFailed("Airflow callback failed", savedJob.get().getRequestedAt());
              return new DomainPackGenerationTriggerResult(
                  "domain_pack_generation", "pipeline_job_123");
            });

    TriggerDomainPackGenerationResult result = useCase.execute(command());

    assertThat(result.status()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(result.startedAt()).isNull();
    assertThat(result.airflowRunId()).isEqualTo("pipeline_job_123");
  }

  @Test
  @DisplayName("Airflow trigger 실패면 생성한 job을 FAILED로 남긴다")
  void execute_airflowFailure_marksFailed() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.empty());
    given(triggerPort.trigger(any())).willThrow(new AirflowTriggerFailedException(123L));

    assertThatThrownBy(() -> useCase.execute(command()))
        .isInstanceOf(AirflowTriggerFailedException.class);

    assertThat(savedJob.get().getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(savedJob.get().getFinishedAt().toInstant()).isEqualTo(fixedClock.instant());
    verify(freeOnboardingService).consumeForFinalPipelineJob(1L, 123L, true);
  }

  private void allowAccess() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(datasetOwnershipPort.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
    lenient()
        .when(datasetRawFileLookupPort.findLatestObjectKeyByDatasetId(7L))
        .thenReturn(Optional.of("workspaces/1/datasets/travel/raw.json"));
  }

  private TriggerDomainPackGenerationCommand command() {
    return new TriggerDomainPackGenerationCommand(1L, 7L, 55L);
  }

  private PipelineJob pipelineJob(Long id, String status) {
    return PipelineJobFixtures.domainPackGeneration(id).status(status).build();
  }
}
