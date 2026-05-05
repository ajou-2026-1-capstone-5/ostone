package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadySucceededException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackTargetMismatchException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import java.lang.reflect.Constructor;
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
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("ReceivePipelineJobFailureCallbackUseCase")
class ReceivePipelineJobFailureCallbackUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WebhookReceiptRepository webhookReceiptRepository;
  @Mock private PlatformTransactionManager transactionManager;

  private ReceivePipelineJobFailureCallbackUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-05-04T10:30:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    TransactionStatus transactionStatus = new SimpleTransactionStatus();
    lenient()
        .when(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .thenReturn(transactionStatus);
    lenient()
        .when(webhookReceiptRepository.saveAndFlush(any()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    lenient()
        .when(pipelineJobRepository.saveAndFlush(any()))
        .thenAnswer(invocation -> invocation.getArgument(0));

    useCase =
        new ReceivePipelineJobFailureCallbackUseCase(
            pipelineJobRepository,
            new PipelineJobCallbackSupportService(
                pipelineJobRepository,
                webhookReceiptRepository,
                fixedClock,
                transactionManager,
                "secret-123"));
  }

  @Test
  @DisplayName("active job failure callback이면 job을 FAILED로 종료하고 receipt를 처리한다")
  void execute_activeJob_marksFailed() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_RUNNING);
    WebhookReceipt receipt = receipt("evt-failure-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job), Optional.of(job));

    ReceivePipelineJobFailureCallbackResult result = useCase.execute(command());

    assertThat(result.status()).isEqualTo("PROCESSED");
    assertThat(result.jobStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(job.getLastErrorMessage()).isEqualTo("PII masking failed");
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
  }

  @Test
  @DisplayName("이미 처리한 externalEventId면 duplicate ignored를 반환한다")
  void execute_duplicateReceipt_returnsDuplicateIgnored() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_FAILED);
    WebhookReceipt receipt = receipt("evt-failure-1");
    receipt.markProcessed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.of(receipt));
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job));

    ReceivePipelineJobFailureCallbackResult result = useCase.execute(command());

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(pipelineJobRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("이미 FAILED인 job의 새 failure callback은 상태 변경 없이 처리 완료로 기록한다")
  void execute_alreadyFailedJob_returnsIgnoredAlreadyFailed() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_FAILED);
    WebhookReceipt receipt = receipt("evt-failure-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job), Optional.of(job));

    ReceivePipelineJobFailureCallbackResult result = useCase.execute(command());

    assertThat(result.status()).isEqualTo("IGNORED_ALREADY_FAILED");
    assertThat(result.jobStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
    verify(pipelineJobRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("CANCELLED job의 failure callback은 상태 변경 없이 처리 완료로 기록한다")
  void execute_cancelledJob_returnsIgnoredCancelled() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_CANCELLED);
    WebhookReceipt receipt = receipt("evt-failure-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job), Optional.of(job));

    ReceivePipelineJobFailureCallbackResult result = useCase.execute(command());

    assertThat(result.status()).isEqualTo("IGNORED_CANCELLED");
    assertThat(result.jobStatus()).isEqualTo(PipelineJob.STATUS_CANCELLED);
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
    verify(pipelineJobRepository, never()).saveAndFlush(any());
  }

  @Test
  @DisplayName("dagRunId가 일치하지 않으면 409 예외를 던지고 job 상태를 바꾸지 않는다")
  void execute_targetMismatch_throws() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_RUNNING);
    ReceivePipelineJobFailureCallbackCommand command =
        new ReceivePipelineJobFailureCallbackCommand(
            123L,
            "secret-123",
            "evt-failure-1",
            "domain_pack_generation",
            "wrong-run-id",
            "preprocessing",
            "TASK_FAILED",
            "PII masking failed",
            OffsetDateTime.now(fixedClock),
            "{}",
            "{}");
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.empty());
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(PipelineJobCallbackTargetMismatchException.class);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
  }

  @Test
  @DisplayName("dagId가 일치하지 않으면 409 예외를 던지고 job 상태를 바꾸지 않는다")
  void execute_dagIdMismatch_throws() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_RUNNING);
    ReceivePipelineJobFailureCallbackCommand command =
        new ReceivePipelineJobFailureCallbackCommand(
            123L,
            "secret-123",
            "evt-failure-1",
            "wrong_dag",
            "pipeline_job_123",
            "preprocessing",
            "TASK_FAILED",
            "PII masking failed",
            OffsetDateTime.now(fixedClock),
            "{}",
            "{}");
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.empty());
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(PipelineJobCallbackTargetMismatchException.class);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
  }

  @Test
  @DisplayName("SUCCEEDED job은 failure로 되돌리지 않고 409 예외를 던진다")
  void execute_succeededJob_throws() {
    PipelineJob job = pipelineJob(PipelineJob.STATUS_SUCCEEDED);
    WebhookReceipt receipt = receipt("evt-failure-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-failure-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(123L)).willReturn(Optional.of(job), Optional.of(job));

    assertThatThrownBy(() -> useCase.execute(command()))
        .isInstanceOf(PipelineJobAlreadySucceededException.class);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_SUCCEEDED);
  }

  @Test
  @DisplayName("잘못된 webhook secret이면 401 예외를 던진다")
  void execute_invalidSecret_throwsUnauthorized() {
    ReceivePipelineJobFailureCallbackCommand command =
        new ReceivePipelineJobFailureCallbackCommand(
            123L,
            "wrong-secret",
            "evt-failure-1",
            "domain_pack_generation",
            "pipeline_job_123",
            "preprocessing",
            "TASK_FAILED",
            "PII masking failed",
            OffsetDateTime.now(fixedClock),
            "{}",
            "{}");

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(AirflowWebhookUnauthorizedException.class);
  }

  private ReceivePipelineJobFailureCallbackCommand command() {
    return new ReceivePipelineJobFailureCallbackCommand(
        123L,
        "secret-123",
        "evt-failure-1",
        "domain_pack_generation",
        "pipeline_job_123",
        "preprocessing",
        "TASK_FAILED",
        "PII masking failed",
        OffsetDateTime.now(fixedClock),
        "{}",
        "{}");
  }

  private PipelineJob pipelineJob(String status) {
    PipelineJob job = newPipelineJob();
    ReflectionTestUtils.setField(job, "id", 123L);
    ReflectionTestUtils.setField(job, "workspaceId", 1L);
    ReflectionTestUtils.setField(job, "datasetId", 7L);
    ReflectionTestUtils.setField(job, "jobType", PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);
    ReflectionTestUtils.setField(job, "status", status);
    ReflectionTestUtils.setField(job, "airflowDagId", "domain_pack_generation");
    ReflectionTestUtils.setField(job, "airflowRunId", "pipeline_job_123");
    ReflectionTestUtils.setField(job, "requestPayloadJson", "{}");
    ReflectionTestUtils.setField(job, "resultSummaryJson", "{}");
    return job;
  }

  private WebhookReceipt receipt(String externalEventId) {
    return WebhookReceipt.receive(
        123L,
        externalEventId,
        "PIPELINE_JOB_FAILURE_CALLBACK",
        "{}",
        "{}",
        OffsetDateTime.now(fixedClock));
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
