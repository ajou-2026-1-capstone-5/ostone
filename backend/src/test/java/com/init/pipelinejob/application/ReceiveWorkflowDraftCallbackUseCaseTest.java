package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.WorkflowDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionResult;
import com.init.domainpack.application.AddWorkflowDraftToVersionUseCase;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.WebhookReceiptTypeConflictException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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
@DisplayName("ReceiveWorkflowDraftCallbackUseCase")
class ReceiveWorkflowDraftCallbackUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WebhookReceiptRepository webhookReceiptRepository;
  @Mock private PipelineArtifactRepository pipelineArtifactRepository;
  @Mock private AddWorkflowDraftToVersionUseCase addWorkflowDraftToVersionUseCase;
  @Mock private PlatformTransactionManager transactionManager;

  private ReceiveWorkflowDraftCallbackUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-04-14T10:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    TransactionStatus transactionStatus = new SimpleTransactionStatus();
    lenient()
        .when(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .thenReturn(transactionStatus);
    useCase =
        new ReceiveWorkflowDraftCallbackUseCase(
            pipelineJobRepository,
            webhookReceiptRepository,
            pipelineArtifactRepository,
            addWorkflowDraftToVersionUseCase,
            fixedClock,
            new ObjectMapper(),
            transactionManager,
            "secret-123");
  }

  @Test
  @DisplayName("정상 callback이면 workflow draft 적재 후 job을 SUCCEEDED로 종료한다")
  void execute_success_marksJobSucceeded() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK);
    WebhookReceipt receipt = workflowReceipt(11L, "evt-workflow-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-workflow-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(addWorkflowDraftToVersionUseCase.execute(any()))
        .willReturn(new AddWorkflowDraftToVersionResult(101L, 7L, 1, 1, 1, 1, 1, 1));

    ReceiveWorkflowDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.addedWorkflowCount()).isEqualTo(1);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_SUCCEEDED);
    assertThat(job.getFinishedAt()).isEqualTo(OffsetDateTime.now(fixedClock));
    assertThat(job.getResultSummaryJson()).contains("\"addedWorkflowCount\":1");
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
  }

  @Test
  @DisplayName("이미 처리한 같은 type의 externalEventId면 duplicate ignored를 반환한다")
  void execute_processedReceipt_returnsDuplicateIgnored() {
    WebhookReceipt receipt = workflowReceipt(11L, "evt-workflow-1");
    receipt.markProcessed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-workflow-1"))
        .willReturn(Optional.of(receipt));

    ReceiveWorkflowDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(addWorkflowDraftToVersionUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("같은 externalEventId가 다른 webhook type이면 409 예외를 던진다")
  void execute_receiptTypeConflict_throws() {
    WebhookReceipt receipt = intentReceipt(11L, "evt-workflow-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-workflow-1"))
        .willReturn(Optional.of(receipt));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(WebhookReceiptTypeConflictException.class);
  }

  @Test
  @DisplayName("WAITING_WORKFLOW_CALLBACK이 아니면 409 예외를 던진다")
  void execute_notAllowedStatus_throws() {
    given(webhookReceiptRepository.findByExternalEventId("evt-workflow-1"))
        .willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK)));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobCallbackNotAllowedException.class);
  }

  @Test
  @DisplayName("workflow draft 적재 실패 시 job과 receipt를 FAILED로 갱신한다")
  void execute_addWorkflowFailure_marksFailed() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK);
    WebhookReceipt receipt = workflowReceipt(11L, "evt-workflow-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-workflow-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(job), Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(addWorkflowDraftToVersionUseCase.execute(any()))
        .willThrow(new DomainPackDraftRequestInvalidException("중복된 workflowCode 값이 존재합니다."));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DomainPackDraftRequestInvalidException.class);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(job.getLastErrorMessage()).contains("중복된 workflowCode");
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_FAILED);
  }

  private ReceiveWorkflowDraftCallbackCommand validCommand() {
    return new ReceiveWorkflowDraftCallbackCommand(
        11L,
        "secret-123",
        "evt-workflow-1",
        101L,
        List.of(),
        List.of(),
        List.of(),
        List.of(new WorkflowDraft("refund_flow", "환불 플로우", null, "{}", null, null)),
        List.of(),
        List.of(),
        "{\"content-type\":\"application/json\"}",
        "{\"domainPackVersionId\":101}");
  }

  private PipelineJob pipelineJob(Long id, Long workspaceId, String status) {
    PipelineJob job = newPipelineJob();
    ReflectionTestUtils.setField(job, "id", id);
    ReflectionTestUtils.setField(job, "workspaceId", workspaceId);
    ReflectionTestUtils.setField(job, "status", status);
    ReflectionTestUtils.setField(job, "resultSummaryJson", "{}");
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

  private WebhookReceipt workflowReceipt(Long jobId, String externalEventId) {
    return receipt(jobId, externalEventId, "WORKFLOW_DRAFT_CALLBACK");
  }

  private WebhookReceipt intentReceipt(Long jobId, String externalEventId) {
    return receipt(jobId, externalEventId, "INTENT_DRAFT_CALLBACK");
  }

  private WebhookReceipt receipt(Long jobId, String externalEventId, String webhookType) {
    WebhookReceipt receipt =
        WebhookReceipt.receive(
            jobId, externalEventId, webhookType, "{}", "{}", OffsetDateTime.now(fixedClock));
    ReflectionTestUtils.setField(receipt, "id", 1L);
    return receipt;
  }
}
