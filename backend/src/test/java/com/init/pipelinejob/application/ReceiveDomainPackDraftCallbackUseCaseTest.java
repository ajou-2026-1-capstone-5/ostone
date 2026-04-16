package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineResult;
import com.init.domainpack.application.CreateDomainPackDraftFromPipelineUseCase;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobAlreadyFinalizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.PipelineJobConflictException;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
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
@DisplayName("ReceiveDomainPackDraftCallbackUseCase")
class ReceiveDomainPackDraftCallbackUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WebhookReceiptRepository webhookReceiptRepository;
  @Mock private PipelineArtifactRepository pipelineArtifactRepository;

  @Mock private CreateDomainPackDraftFromPipelineUseCase createDomainPackDraftFromPipelineUseCase;

  @Mock private PlatformTransactionManager transactionManager;

  private ReceiveDomainPackDraftCallbackUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-04-14T10:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    TransactionStatus transactionStatus = new SimpleTransactionStatus();
    lenient()
        .when(transactionManager.getTransaction(any(TransactionDefinition.class)))
        .thenReturn(transactionStatus);

    useCase =
        new ReceiveDomainPackDraftCallbackUseCase(
            pipelineJobRepository,
            webhookReceiptRepository,
            pipelineArtifactRepository,
            createDomainPackDraftFromPipelineUseCase,
            fixedClock,
            new ObjectMapper(),
            transactionManager,
            "secret-123");
  }

  @Test
  @DisplayName("정상 callback이면 DomainPack + DRAFT 버전을 생성한다")
  void execute_success_createsDraft() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_RUNNING);
    WebhookReceipt receipt = webhookReceipt(11L, "evt-draft-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(createDomainPackDraftFromPipelineUseCase.execute(any()))
        .willReturn(
            new CreateDomainPackDraftFromPipelineResult(7L, 101L, 3, "refund-pack", true, 11L));

    ReceiveDomainPackDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(result.domainPackId()).isEqualTo(7L);
    assertThat(result.domainPackVersionId()).isEqualTo(101L);
    assertThat(result.versionNo()).isEqualTo(3);
    assertThat(result.packKey()).isEqualTo("refund-pack");
    assertThat(result.createdPack()).isTrue();
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_WAITING_INTENT_CALLBACK);
    assertThat(job.getDomainPackId()).isEqualTo(7L);
    assertThat(job.getResultSummaryJson()).contains("\"domainPackVersionId\":101");
    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
    verify(pipelineArtifactRepository).save(any());
  }

  @Test
  @DisplayName("이미 처리한 externalEventId면 duplicate ignored를 반환한다")
  void execute_duplicateReceipt_returnsDuplicateIgnored() {
    WebhookReceipt processedReceipt = webhookReceipt(11L, "evt-draft-1");
    processedReceipt.markProcessed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.of(processedReceipt));

    ReceiveDomainPackDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(createDomainPackDraftFromPipelineUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("receipt 저장 충돌 후 재조회되면 duplicate ignored를 반환한다")
  void execute_duplicateOnReceiptInsert_returnsDuplicateIgnored() {
    WebhookReceipt receipt = webhookReceipt(11L, "evt-draft-1");
    receipt.markProcessed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty(), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_RUNNING)));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("unique violation"));

    ReceiveDomainPackDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(createDomainPackDraftFromPipelineUseCase, never()).execute(any());
  }

  @Test
  @DisplayName("FAILED receipt면 중복으로 무시하지 않고 재처리한다")
  void execute_failedReceipt_retriesProcessing() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_RUNNING);
    WebhookReceipt failedReceipt = webhookReceipt(11L, "evt-draft-1");
    failedReceipt.markFailed(OffsetDateTime.now(fixedClock));
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.of(failedReceipt), Optional.of(failedReceipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(createDomainPackDraftFromPipelineUseCase.execute(any()))
        .willReturn(
            new CreateDomainPackDraftFromPipelineResult(7L, 101L, 3, "refund-pack", true, 11L));

    ReceiveDomainPackDraftCallbackResult result = useCase.execute(validCommand());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(failedReceipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_PROCESSED);
  }

  @Test
  @DisplayName("job 저장 중 optimistic lock 충돌이 나면 409 예외를 던지고 receipt만 FAILED로 남긴다")
  void execute_jobOptimisticLockFailure_throwsConflict() {
    PipelineJob job = pipelineJob(11L, 3L, PipelineJob.STATUS_RUNNING);
    WebhookReceipt receipt = webhookReceipt(11L, "evt-draft-1");
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty(), Optional.of(receipt), Optional.of(receipt));
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.of(job), Optional.of(job));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(createDomainPackDraftFromPipelineUseCase.execute(any()))
        .willReturn(
            new CreateDomainPackDraftFromPipelineResult(7L, 101L, 3, "refund-pack", true, 11L));
    given(pipelineJobRepository.saveAndFlush(any()))
        .willThrow(new ObjectOptimisticLockingFailureException(PipelineJob.class, 11L));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobConflictException.class);

    assertThat(receipt.getProcessingStatus()).isEqualTo(WebhookReceipt.STATUS_FAILED);
  }

  @Test
  @DisplayName("receipt 저장 예외가 중복으로 확인되지 않으면 예외를 그대로 던진다")
  void execute_nonDuplicateReceiptInsertFailure_throws() {
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty(), Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_RUNNING)));
    given(webhookReceiptRepository.saveAndFlush(any()))
        .willThrow(new DataIntegrityViolationException("unexpected violation"));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  @DisplayName("잘못된 webhook secret이면 401 예외를 던진다")
  void execute_invalidSecret_throwsUnauthorized() {
    ReceiveDomainPackDraftCallbackCommand command =
        new ReceiveDomainPackDraftCallbackCommand(
            11L, "wrong-secret", "evt-draft-1", "refund-pack", "환불 Pack", null, "{}", "{}");

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(AirflowWebhookUnauthorizedException.class);
  }

  @Test
  @DisplayName("pipeline job이 없으면 404 예외를 던진다")
  void execute_missingJob_throwsNotFound() {
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobNotFoundException.class);
  }

  @Test
  @DisplayName("이미 종료된 job이면 409 예외를 던진다")
  void execute_finalizedJob_throwsConflict() {
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_SUCCEEDED)));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobAlreadyFinalizedException.class);
  }

  @Test
  @DisplayName("이미 중간 상태인 job에 domain-pack callback이 다시 오면 409 예외를 던진다")
  void execute_waitingIntentJob_throwsConflict() {
    given(webhookReceiptRepository.findByExternalEventId("evt-draft-1"))
        .willReturn(Optional.empty());
    given(pipelineJobRepository.findById(11L))
        .willReturn(Optional.of(pipelineJob(11L, 3L, PipelineJob.STATUS_WAITING_INTENT_CALLBACK)));

    assertThatThrownBy(() -> useCase.execute(validCommand()))
        .isInstanceOf(PipelineJobCallbackNotAllowedException.class);
  }

  private ReceiveDomainPackDraftCallbackCommand validCommand() {
    return new ReceiveDomainPackDraftCallbackCommand(
        11L,
        "secret-123",
        "evt-draft-1",
        "refund-pack",
        "환불 Pack",
        "{\"clusterCount\":12}",
        "{\"content-type\":\"application/json\"}",
        "{\"packKey\":\"refund-pack\"}");
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
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }

  private WebhookReceipt webhookReceipt(Long jobId, String externalEventId) {
    WebhookReceipt receipt =
        WebhookReceipt.receive(
            jobId,
            externalEventId,
            "DOMAIN_PACK_DRAFT_CALLBACK",
            "{}",
            "{}",
            OffsetDateTime.now(fixedClock));
    ReflectionTestUtils.setField(receipt, "id", 1L);
    return receipt;
  }
}
