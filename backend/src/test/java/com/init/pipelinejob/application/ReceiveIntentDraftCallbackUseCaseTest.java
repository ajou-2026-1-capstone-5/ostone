package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.AddIntentsToDraftVersionResult;
import com.init.domainpack.application.AddIntentsToDraftVersionUseCase;
import com.init.domainpack.application.IntentDraft;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobConflictException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.application.exception.WebhookReceiptTypeConflictException;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("ReceiveIntentDraftCallbackUseCase")
class ReceiveIntentDraftCallbackUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WebhookReceiptRepository webhookReceiptRepository;
  @Mock private AddIntentsToDraftVersionUseCase addIntentsToDraftVersionUseCase;
  @Mock private PlatformTransactionManager transactionManager;

  private ReceiveIntentDraftCallbackUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-04-14T10:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    TransactionStatus transactionStatus = new SimpleTransactionStatus();
    lenient()
        .when(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .thenReturn(transactionStatus);

    useCase =
        new ReceiveIntentDraftCallbackUseCase(
            pipelineJobRepository,
            addIntentsToDraftVersionUseCase,
            new ObjectMapper(),
            new PipelineJobCallbackSupportService(
                pipelineJobRepository,
                webhookReceiptRepository,
                fixedClock,
                transactionManager,
                "secret-123"));
  }

  @Test
  @DisplayName("정상 callback이면 intent 추가 후 receipt를 성공 상태로 갱신한다")
  void execute_success_addsIntents() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK);
    WebhookReceipt receipt = webhookReceipt(11L, "evt-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(addIntentsToDraftVersionUseCase.execute(any()))
        .willReturn(new AddIntentsToDraftVersionResult(101L, 7L, 2, 0, 5));

    ReceiveIntentDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(result.domainPackVersionId()).isEqualTo(101L);
    assertThat(result.addedIntentCount()).isEqualTo(2);
    assertThat(result.skippedIntentCount()).isEqualTo(0);
    assertThat(result.totalIntentCount()).isEqualTo(5);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK);
    assertThat(job.getDomainPackId()).isEqualTo(7L);
    assertThat(job.getFinishedAt()).isNull();
    assertThat(job.getResultSummaryJson()).contains("\"domainPackVersionId\":101");
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
  }

  @Test
  @DisplayName("이미 처리한 externalEventId면 duplicate ignored를 반환한다")
  void execute_duplicateReceipt_returnsDuplicateIgnored() {
    WebhookReceipt processedReceipt = webhookReceipt(11L, "evt-1");
    processedReceipt.markProcessed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.of(processedReceipt));

    ReceiveIntentDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(addIntentsToDraftVersionUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("같은 externalEventId가 다른 webhook type이면 409 예외를 던진다")
  void execute_receiptTypeConflict_throws() {
    WebhookReceipt receipt = receipt(11L, "evt-1", "DOMAIN_PACK_DRAFT_CALLBACK");
    given(webhookReceiptRepository.findByExternalEventId("evt-1")).willReturn(Optional.of(receipt));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(WebhookReceiptTypeConflictException.class);

    verify(addIntentsToDraftVersionUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("receipt 저장 충돌 후 다른 webhook type으로 재조회되면 409 예외를 던진다")
  void execute_receiptInsertTypeConflict_throws() {
    WebhookReceipt receipt = receipt(11L, "evt-1", "DOMAIN_PACK_DRAFT_CALLBACK");
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK)));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("unique violation"));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(WebhookReceiptTypeConflictException.class);

    verify(addIntentsToDraftVersionUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("receipt 저장 충돌 후 재조회되면 duplicate ignored를 반환한다")
  void execute_duplicateOnReceiptInsert_returnsDuplicateIgnored() {
    WebhookReceipt receipt = webhookReceipt(11L, "evt-1");
    receipt.markProcessed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK)));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("unique violation"));

    ReceiveIntentDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(addIntentsToDraftVersionUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("FAILED receipt면 중복으로 무시하지 않고 재처리한다")
  void execute_failedReceipt_retriesProcessing() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK);
    WebhookReceipt failedReceipt = webhookReceipt(11L, "evt-1");
    failedReceipt.markFailed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.of(failedReceipt), Optional.of(failedReceipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(addIntentsToDraftVersionUseCase.execute(any()))
        .willReturn(new AddIntentsToDraftVersionResult(101L, 7L, 1, 0, 3));

    ReceiveIntentDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(failedReceipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
  }

  @Test
  @DisplayName("job 저장 중 optimistic lock 충돌이 나면 409 예외를 던지고 receipt만 FAILED로 남긴다")
  void execute_jobOptimisticLockFailure_throwsConflict() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK);
    WebhookReceipt receipt = webhookReceipt(11L, "evt-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(addIntentsToDraftVersionUseCase.execute(any()))
        .willReturn(new AddIntentsToDraftVersionResult(101L, 7L, 2, 0, 5));
    given(pipelineJobRepository.saveAndFlush(any()))
        .willThrow(new ObjectOptimisticLockingFailureException(PipelineJob.class, 11L));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobConflictException.class);

    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_FAILED);
  }

  @Test
  @DisplayName("receipt 저장 예외가 중복으로 확인되지 않으면 예외를 그대로 던진다")
  void execute_nonDuplicateReceiptInsertFailure_throws() {
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.empty(), Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK)));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("unexpected violation"));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  @DisplayName("잘못된 webhook secret이면 401 예외를 던진다")
  void execute_invalidSecret_throwsUnauthorized() {
    ReceiveIntentDraftCallbackCommand command =
        new ReceiveIntentDraftCallbackCommand(
            11L, "wrong-secret", "evt-1", 101L, List.of(), "{}", "{}");

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(AirflowWebhookUnauthorizedException.class);
  }

  @Test
  @DisplayName("pipeline job이 없으면 404 예외를 던진다")
  void execute_missingJob_throwsNotFound() {
    given(webhookReceiptRepository.findByExternalEventId("evt-1")).willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobNotFoundException.class);
  }

  @Test
  @DisplayName("이미 종료된 job이면 409 예외를 던진다")
  void execute_finalizedJob_throwsConflict() {
    given(webhookReceiptRepository.findByExternalEventId("evt-1")).willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_SUCCEEDED)));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobAlreadyFinalizedException.class);
  }

  @Test
  @DisplayName("중간 상태가 아닌 job에 intent callback이 오면 409 예외를 던진다")
  void execute_nonWaitingJob_throwsConflict() {
    given(webhookReceiptRepository.findByExternalEventId("evt-1")).willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_RUNNING)));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobCallbackNotAllowedException.class);
  }

  @Test
  @DisplayName("intent 추가 실패 시 job과 receipt를 FAILED로 갱신한 뒤 예외를 다시 던진다")
  void execute_addIntentsFailure_marksFailed() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK);
    WebhookReceipt receipt = webhookReceipt(11L, "evt-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(job), Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(addIntentsToDraftVersionUseCase.execute(any()))
        .willThrow(new DomainPackDraftRequestInvalidException("중복된 intentCode 값이 존재합니다."));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DomainPackDraftRequestInvalidException.class);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(job.getLastErrorMessage()).contains("중복된 intentCode");
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_FAILED);
  }

  private ReceiveIntentDraftCallbackCommand validCommand() {
    return new ReceiveIntentDraftCallbackCommand(
        11L,
        "secret-123",
        "evt-1",
        101L,
        List.of(new IntentDraft("refund_request", "환불 요청", null, 1, null, null, null, null, null)),
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

  private WebhookReceipt webhookReceipt(Long jobId, String externalEventId) {
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
