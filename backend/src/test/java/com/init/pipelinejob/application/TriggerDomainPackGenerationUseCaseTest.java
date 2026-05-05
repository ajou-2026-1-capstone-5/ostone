package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyRunningException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import java.lang.reflect.Constructor;
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
import org.springframework.test.util.ReflectionTestUtils;
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
  @Mock private DomainPackGenerationConcurrencyGuard concurrencyGuard;
  @Mock private DomainPackGenerationTriggerPort triggerPort;
  @Mock private PlatformTransactionManager transactionManager;

  private TriggerDomainPackGenerationUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-05-04T10:00:00Z"), ZoneOffset.UTC);
  private final AtomicReference<PipelineJob> savedJob = new AtomicReference<>();

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
                ReflectionTestUtils.setField(job, "id", 123L);
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
            concurrencyGuard,
            triggerPort,
            new ObjectMapper(),
            fixedClock,
            transactionManager);
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
    assertThat(result.startedAt().toInstant()).isEqualTo(fixedClock.instant());
    assertThat(savedJob.get().getRequestPayloadJson()).contains("\"requestedBy\":55");
    verify(concurrencyGuard).lockTriggerCreation(1L, 7L);
  }

  @Test
  @DisplayName("workspace role이 부족하면 403 예외를 던진다")
  void execute_reviewer_throwsAccessDenied() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(() -> useCase.execute(command()))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }

  @Test
  @DisplayName("active job이 있으면 409 예외를 던진다")
  void execute_activeJob_throwsAlreadyRunning() {
    allowAccess();
    given(pipelineJobRepository.findActiveDomainPackGenerationJob(1L, 7L))
        .willReturn(Optional.of(pipelineJob(11L, PipelineJob.STATUS_RUNNING)));

    assertThatThrownBy(() -> useCase.execute(command()))
        .isInstanceOf(PipelineJobAlreadyRunningException.class);
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
  }

  private void allowAccess() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(datasetOwnershipPort.existsByIdAndWorkspaceId(7L, 1L)).willReturn(true);
  }

  private TriggerDomainPackGenerationCommand command() {
    return new TriggerDomainPackGenerationCommand(1L, 7L, 55L);
  }

  private PipelineJob pipelineJob(Long id, String status) {
    PipelineJob job = newPipelineJob();
    ReflectionTestUtils.setField(job, "id", id);
    ReflectionTestUtils.setField(job, "workspaceId", 1L);
    ReflectionTestUtils.setField(job, "datasetId", 7L);
    ReflectionTestUtils.setField(job, "jobType", PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);
    ReflectionTestUtils.setField(job, "status", status);
    return job;
  }

  private PipelineJob newPipelineJob() {
    try {
      Constructor<PipelineJob> constructor = PipelineJob.class.getDeclaredConstructor();
      constructor.setAccessible(true);
      return constructor.newInstance();
    } catch (ReflectiveOperationException ex) {
      throw new RuntimeException("PipelineJob 테스트 인스턴스 생성 실패", ex);
    }
  }
}
