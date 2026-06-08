package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.exception.AirflowConfigurationInvalidException;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("TriggerIngestionUseCase")
class TriggerIngestionUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private IngestionAirflowTriggerPort airflowTriggerPort;
  @Mock private IngestionDatasetStatusPort ingestionDatasetStatusPort;
  @Mock private PlatformTransactionManager transactionManager;

  private TriggerIngestionUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-05-14T10:00:00Z"), ZoneOffset.UTC);
  private final AtomicReference<PipelineJob> savedJob = new AtomicReference<>();
  private final AtomicInteger saveCallCount = new AtomicInteger(0);

  @BeforeEach
  void setUp() {
    TransactionStatus txStatus = new SimpleTransactionStatus();
    lenient()
        .when(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .thenReturn(txStatus);
    lenient().when(airflowTriggerPort.dagId()).thenReturn("domain_pack_generation");
    lenient()
        .when(pipelineJobRepository.saveAndFlush(any()))
        .thenAnswer(
            invocation -> {
              PipelineJob job = invocation.getArgument(0);
              if (job.getId() == null) {
                job = PipelineJobFixtures.persisted(job, 99L);
                saveCallCount.set(0);
              }
              savedJob.set(job);
              saveCallCount.incrementAndGet();
              return job;
            });
    lenient()
        .when(pipelineJobRepository.findById(99L))
        .thenAnswer(invocation -> Optional.ofNullable(savedJob.get()));

    useCase =
        new TriggerIngestionUseCase(
            pipelineJobRepository,
            airflowTriggerPort,
            ingestionDatasetStatusPort,
            new ObjectMapper(),
            fixedClock,
            transactionManager);
  }

  @Test
  @DisplayName("execute_성공_시_pipeline_job_RUNNING_전환")
  void execute_success_pipelineJobRunning() {
    useCase.execute(1L, 42L, "workspaces/1/datasets/key/file.json");

    PipelineJob job = savedJob.get();
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(job.getJobType()).isEqualTo(PipelineJob.JOB_TYPE_INGESTION);
    assertThat(job.getAirflowDagId()).isEqualTo("domain_pack_generation");
    assertThat(job.getAirflowRunId()).isEqualTo("pipeline_job_99");
    assertThat(job.getStartedAt().toInstant()).isEqualTo(fixedClock.instant());
    verify(airflowTriggerPort).trigger(any(IngestionTriggerCommand.class));
    verify(ingestionDatasetStatusPort, never()).markIngestionTriggerFailed(any(), any());
  }

  @Test
  @DisplayName("dagRunId_형식이_pipeline_job_더하기_pipelineJobId_이다")
  void execute_dagRunId_formatMatchesPipelineJobId() {
    ArgumentCaptor<IngestionTriggerCommand> captor =
        ArgumentCaptor.forClass(IngestionTriggerCommand.class);

    useCase.execute(1L, 42L, "key.json");

    verify(airflowTriggerPort).trigger(captor.capture());
    IngestionTriggerCommand command = captor.getValue();
    assertThat(command.dagRunId()).isEqualTo("pipeline_job_99");
    assertThat(command.pipelineJobId()).isEqualTo(99L);
    assertThat(command.workspaceId()).isEqualTo(1L);
    assertThat(command.datasetId()).isEqualTo(42L);
    assertThat(command.objectKey()).isEqualTo("key.json");
  }

  @Test
  @DisplayName("execute_Airflow_실패_시_pipeline_job_FAILED_후_예외_전파")
  void execute_airflowFail_pipelineJobFailed() {
    willThrow(new AirflowTriggerFailedException(99L, "Ingestion DAG 실행 요청에 실패했습니다."))
        .given(airflowTriggerPort)
        .trigger(any());

    assertThatThrownBy(() -> useCase.execute(1L, 42L, "key.json"))
        .isInstanceOf(AirflowTriggerFailedException.class);

    assertThat(savedJob.get().getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(savedJob.get().getFinishedAt().toInstant()).isEqualTo(fixedClock.instant());
    verify(ingestionDatasetStatusPort).markIngestionTriggerFailed(1L, 42L);
  }

  @Test
  @DisplayName("execute_REQUIRES_NEW_TX_사용_검증")
  void execute_usesRequiresNewTransaction() {
    ArgumentCaptor<TransactionDefinition> captor =
        ArgumentCaptor.forClass(TransactionDefinition.class);

    useCase.execute(1L, 42L, "key.json");

    verify(transactionManager, org.mockito.Mockito.atLeastOnce()).getTransaction(captor.capture());
    boolean anyRequiresNew =
        captor.getAllValues().stream()
            .anyMatch(
                def ->
                    def.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    assertThat(anyRequiresNew).as("REQUIRES_NEW propagation must be used").isTrue();
  }

  @Test
  @DisplayName("AirflowTriggerFailedException_발생_시_markFailed는_호출되지만_trigger는_한_번만_호출")
  void execute_airflowFail_triggerCalledOnce() {
    willThrow(new AirflowTriggerFailedException(99L, "fail"))
        .given(airflowTriggerPort)
        .trigger(any());

    assertThatThrownBy(() -> useCase.execute(1L, 42L, "key.json"))
        .isInstanceOf(AirflowTriggerFailedException.class);

    verify(airflowTriggerPort).trigger(any());
  }

  @Test
  @DisplayName("execute_payload_JSON에_objectKey가_포함된다")
  void execute_payloadJsonContainsObjectKey() {
    useCase.execute(1L, 42L, "workspaces/1/key.json");

    PipelineJob job = savedJob.get();
    assertThat(job.getRequestPayloadJson()).contains("\"objectKey\"");
    assertThat(job.getRequestPayloadJson()).contains("workspaces/1/key.json");
  }

  @Test
  @DisplayName("AirflowConfigurationInvalidException_발생_시_pipeline_job_미생성")
  void execute_airflowConfigInvalid_doesNotCreateJob() {
    given(airflowTriggerPort.dagId()).willThrow(new AirflowConfigurationInvalidException());

    assertThatThrownBy(() -> useCase.execute(1L, 42L, "key.json"))
        .isInstanceOf(AirflowConfigurationInvalidException.class);

    verify(pipelineJobRepository, never()).saveAndFlush(any());
    verify(airflowTriggerPort, never()).trigger(any());
  }
}
