package com.init.corpus.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.exception.DatasetNotFoundException;
import com.init.corpus.application.exception.InvalidUploadStateException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.port.IngestionTriggerPort;
import com.init.corpus.application.port.RawFileStoragePort;
import com.init.corpus.application.port.RawFileStoragePort.ObjectMetadata;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.model.DatasetRawFile;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.repository.DatasetRawFileRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * presigned 직접 업로드 흐름의 2단계. 클라이언트가 S3로 업로드를 마친 뒤 호출한다. 멤버십/소유권/세션 일치/객체 존재를 검증하고 {@code
 * dataset_raw_file}을 기록한 뒤 데이터셋을 {@code PROCESSING}으로 전이하고 ML 인제스천을 트리거한다.
 *
 * <p>멱등: 이미 {@code UPLOADING}이 아닌 데이터셋(이미 처리 중/완료)에 대한 재호출은 DAG를 다시 트리거하지 않고 현재 상태를 그대로 반환한다.
 */
@Service
@Transactional(readOnly = true)
public class CompleteRawFileUploadService {

  private static final Logger log = LoggerFactory.getLogger(CompleteRawFileUploadService.class);

  private final WorkspaceMembershipRepository workspaceMembershipRepository;
  private final DatasetRepository datasetRepository;
  private final DatasetRawFileRepository rawFileRepository;
  private final RawFileStoragePort storagePort;
  private final IngestionTriggerPort triggerPort;
  private final ObjectMapper objectMapper;

  public CompleteRawFileUploadService(
      WorkspaceMembershipRepository workspaceMembershipRepository,
      DatasetRepository datasetRepository,
      DatasetRawFileRepository rawFileRepository,
      RawFileStoragePort storagePort,
      IngestionTriggerPort triggerPort,
      ObjectMapper objectMapper) {
    this.workspaceMembershipRepository = workspaceMembershipRepository;
    this.datasetRepository = datasetRepository;
    this.rawFileRepository = rawFileRepository;
    this.storagePort = storagePort;
    this.triggerPort = triggerPort;
    this.objectMapper = objectMapper;
  }

  /** {@code pending/} 접두사를 {@code completed/}로 치환하기 위한 키 규칙. 나머지 경로는 그대로 유지한다. */
  private static final String PENDING_PREFIX = "pending/";

  private static final String COMPLETED_PREFIX = "completed/";

  /**
   * presigned 업로드를 완료 처리한다. DB 상태 전이(객체 승격, {@code dataset_raw_file} 저장, {@code PROCESSING} 전이)는
   * 트랜잭션 내에서 커밋하고, Airflow 트리거는 커밋이 성공한 뒤(afterCommit)에 수행한다. 트리거가 실패해도 이미 커밋된 DB 상태는 롤백되지 않으며
   * 데이터셋은 {@code PROCESSING}으로 유지된다(재트리거는 별도 재시도 경로).
   */
  @Transactional
  public CompleteRawFileUploadResult complete(CompleteRawFileUploadCommand command) {
    if (!workspaceMembershipRepository.existsByWorkspaceIdAndUserId(
        command.workspaceId(), command.createdBy())) {
      throw new UnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }

    // 비관적 락으로 조회해 동시 complete 호출이 모두 UPLOADING을 읽고 각각 트리거하는 race를 막는다.
    Dataset dataset =
        datasetRepository
            .findByIdAndWorkspaceIdForUpdate(command.datasetId(), command.workspaceId())
            .orElseThrow(
                () -> new DatasetNotFoundException("데이터셋을 찾을 수 없습니다. id=" + command.datasetId()));

    UploadSession session = readUploadSession(dataset);

    // 멱등: 이미 처리 단계로 넘어간 데이터셋은 객체를 다시 승격하거나 DAG를 다시 트리거하지 않고 현재 상태를 그대로 반환한다.
    if (dataset.getStatus() != DatasetStatus.UPLOADING) {
      return new CompleteRawFileUploadResult(
          dataset.getId(),
          dataset.getDatasetKey(),
          command.workspaceId(),
          promotedKey(session.objectKey()),
          session.expectedSizeBytes(),
          dataset.getStatus());
    }

    ObjectMetadata metadata =
        storagePort
            .headObject(session.objectKey())
            .orElseThrow(
                () ->
                    new InvalidUploadStateException("업로드된 객체를 찾을 수 없습니다. 업로드를 완료한 뒤 다시 시도해 주세요."));

    if (metadata.contentLength() > InitRawFileUploadService.MAX_UPLOAD_BYTES) {
      throw new InvalidUploadStateException(
          "업로드된 객체 크기가 최대 허용치(4GB)를 초과했습니다: " + metadata.contentLength());
    }
    if (metadata.contentLength() != session.expectedSizeBytes()) {
      throw new InvalidUploadStateException(
          "업로드된 객체 크기가 init 시점 크기와 일치하지 않습니다. expected="
              + session.expectedSizeBytes()
              + ", actual="
              + metadata.contentLength());
    }

    // pending/ → completed/ 승격: lifecycle은 pending/ 접두사만 만료하므로 completed/ 객체는 ML이 읽을 때까지 보존된다.
    String completedKey = promotedKey(session.objectKey());
    if (completedKey.equals(session.objectKey())) {
      throw new InvalidUploadStateException(
          "업로드 세션 objectKey가 pending/ 접두사를 가져야 합니다. objectKey=" + session.objectKey());
    }
    storagePort.copyObject(session.objectKey(), completedKey);

    DatasetRawFile rawFile =
        DatasetRawFile.createPending(
            dataset.getId(),
            completedKey,
            session.filename(),
            session.contentType(),
            metadata.contentLength(),
            metadata.etag());
    rawFileRepository.save(rawFile);

    dataset.markProcessing();
    Dataset saved = datasetRepository.save(dataset);

    // pending 원본 삭제와 트리거는 트랜잭션 커밋 이후에 수행한다. 트리거 실패가 DB 상태를 롤백하지 않게 한다.
    registerAfterCommitActions(
        command.workspaceId(), saved.getId(), session.objectKey(), completedKey);

    return new CompleteRawFileUploadResult(
        saved.getId(),
        saved.getDatasetKey(),
        command.workspaceId(),
        completedKey,
        metadata.contentLength(),
        saved.getStatus());
  }

  private void registerAfterCommitActions(
      Long workspaceId, Long datasetId, String pendingKey, String completedKey) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      // 트랜잭션 컨텍스트가 없으면(예: 단위 테스트) 즉시 후처리한다.
      deletePendingObject(pendingKey);
      triggerPort.trigger(workspaceId, datasetId, completedKey);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            deletePendingObject(pendingKey);
            triggerPort.trigger(workspaceId, datasetId, completedKey);
          }
        });
  }

  private void deletePendingObject(String pendingKey) {
    try {
      storagePort.delete(pendingKey);
    } catch (RuntimeException ex) {
      log.warn("[complete] pending 원본 객체 삭제 실패. objectKey={}", pendingKey, ex);
    }
  }

  private String promotedKey(String objectKey) {
    if (objectKey.startsWith(PENDING_PREFIX)) {
      return COMPLETED_PREFIX + objectKey.substring(PENDING_PREFIX.length());
    }
    return objectKey;
  }

  private UploadSession readUploadSession(Dataset dataset) {
    JsonNode upload = parseMeta(dataset).path(UploadSessionMeta.FIELD);
    if (!upload.isObject()) {
      throw new InvalidUploadStateException(
          "이 데이터셋에는 presigned 업로드 세션 정보가 없습니다. datasetId=" + dataset.getId());
    }
    String objectKey = upload.path(UploadSessionMeta.OBJECT_KEY).asText(null);
    if (objectKey == null || objectKey.isBlank()) {
      throw new InvalidUploadStateException(
          "업로드 세션에 objectKey가 없습니다. datasetId=" + dataset.getId());
    }
    long expectedSizeBytes = upload.path(UploadSessionMeta.EXPECTED_SIZE_BYTES).asLong(-1L);
    if (expectedSizeBytes < 0) {
      throw new InvalidUploadStateException(
          "업로드 세션에 expectedSizeBytes가 없습니다. datasetId=" + dataset.getId());
    }
    String filename =
        Optional.ofNullable(upload.path(UploadSessionMeta.FILENAME).asText(null))
            .filter(s -> !s.isBlank())
            .orElse("upload.zip");
    String contentType =
        Optional.ofNullable(upload.path(UploadSessionMeta.CONTENT_TYPE).asText(null))
            .filter(s -> !s.isBlank())
            .orElse("application/zip");
    return new UploadSession(objectKey, expectedSizeBytes, filename, contentType);
  }

  private JsonNode parseMeta(Dataset dataset) {
    String metaJson = dataset.getMetaJson();
    if (metaJson == null || metaJson.isBlank()) {
      throw new InvalidUploadStateException(
          "이 데이터셋에는 presigned 업로드 세션 정보가 없습니다. datasetId=" + dataset.getId());
    }
    try {
      return objectMapper.readTree(metaJson);
    } catch (JsonProcessingException e) {
      log.warn("[complete] meta_json 파싱 실패. datasetId={}", dataset.getId(), e);
      throw new InvalidUploadStateException("데이터셋 메타 정보를 읽을 수 없습니다. datasetId=" + dataset.getId());
    }
  }

  private record UploadSession(
      String objectKey, long expectedSizeBytes, String filename, String contentType) {}
}
