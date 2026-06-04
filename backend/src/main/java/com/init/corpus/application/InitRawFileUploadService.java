package com.init.corpus.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.application.port.RawFileStoragePort;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import com.init.shared.application.exception.BadRequestException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * presigned 직접 업로드 흐름의 1단계. 워크스페이스/키 검증 후 데이터셋을 {@code UPLOADING} 상태로 만들고, 업로드 세션 메타를 {@code
 * meta_json}에 기록한 뒤 presigned PUT URL을 발급한다. 실제 바이트는 클라이언트가 S3로 직접 업로드한다.
 */
@Service
@Transactional(readOnly = true)
public class InitRawFileUploadService {

  /** presigned 직접 업로드의 최대 객체 크기. */
  public static final long MAX_UPLOAD_BYTES = 4L * 1024 * 1024 * 1024;

  /**
   * presigned 서명에 그대로 쓰이는 contentType을 ZIP MIME으로 제한한다. 프론트는 브라우저가 보고한 {@code file.type}을 보내며
   * {@code .zip} 파일의 일반적인 값이거나, 비어 있으면 {@code application/zip}으로 fallback한다.
   */
  private static final Set<String> ALLOWED_CONTENT_TYPES =
      Set.of("application/zip", "application/x-zip-compressed");

  private static final Logger log = LoggerFactory.getLogger(InitRawFileUploadService.class);
  private static final Duration UPLOAD_URL_TTL = Duration.ofMinutes(15);

  private final WorkspaceExistenceRepository workspaceExistenceRepository;
  private final WorkspaceMembershipRepository workspaceMembershipRepository;
  private final DatasetRepository datasetRepository;
  private final RawFileStoragePort storagePort;
  private final RawFileUploadStorageConfig storageConfig;
  private final ObjectMapper objectMapper;

  public InitRawFileUploadService(
      WorkspaceExistenceRepository workspaceExistenceRepository,
      WorkspaceMembershipRepository workspaceMembershipRepository,
      DatasetRepository datasetRepository,
      RawFileStoragePort storagePort,
      RawFileUploadStorageConfig storageConfig,
      ObjectMapper objectMapper) {
    this.workspaceExistenceRepository = workspaceExistenceRepository;
    this.workspaceMembershipRepository = workspaceMembershipRepository;
    this.datasetRepository = datasetRepository;
    this.storagePort = storagePort;
    this.storageConfig = storageConfig;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public InitRawFileUploadResult init(InitRawFileUploadCommand command) {
    if (!workspaceExistenceRepository.existsById(command.workspaceId())) {
      throw new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }
    if (!workspaceMembershipRepository.existsByWorkspaceIdAndUserId(
        command.workspaceId(), command.createdBy())) {
      throw new UnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }
    if (datasetRepository.existsByWorkspaceIdAndDatasetKey(
        command.workspaceId(), command.datasetKey())) {
      throw new DatasetKeyConflictException("이미 사용 중인 데이터셋 키입니다: " + command.datasetKey());
    }
    if (command.sizeBytes() > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "파일 크기가 최대 허용치(4GB)를 초과했습니다: " + command.sizeBytes());
    }
    if (!ALLOWED_CONTENT_TYPES.contains(command.contentType())) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "ZIP 파일만 업로드할 수 있습니다. contentType=" + command.contentType());
    }

    String objectKey =
        buildPendingObjectKey(command.workspaceId(), command.datasetKey(), command.filename());
    OffsetDateTime expiresAt = OffsetDateTime.now().plus(UPLOAD_URL_TTL);

    Dataset dataset =
        Dataset.createUploading(
            command.workspaceId(),
            command.datasetKey(),
            command.name(),
            command.sourceType(),
            command.createdBy());
    dataset.updateMetaJson(buildUploadSessionMetaJson(command, objectKey, expiresAt));
    Dataset saved;
    try {
      saved = datasetRepository.save(dataset);
    } catch (DataIntegrityViolationException | ConstraintViolationException e) {
      log.warn(
          "[init] 데이터셋 키 중복으로 업로드 세션 생성 실패. workspaceId={}, datasetKey={}",
          command.workspaceId(),
          command.datasetKey(),
          e);
      throw new DatasetKeyConflictException("이미 사용 중인 데이터셋 키입니다: " + command.datasetKey());
    }

    String uploadUrl =
        storagePort.generatePresignedPutUrl(objectKey, command.contentType(), UPLOAD_URL_TTL);

    return new InitRawFileUploadResult(
        saved.getId(),
        saved.getDatasetKey(),
        command.workspaceId(),
        uploadUrl,
        objectKey,
        command.contentType(),
        UPLOAD_URL_TTL.toSeconds(),
        storageConfig.serverSideEncryptionEnabled());
  }

  private String buildPendingObjectKey(Long workspaceId, String datasetKey, String filename) {
    String normalized = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    String prefix = UUID.randomUUID().toString();
    return String.format(
        "pending/workspaces/%d/datasets/%s/%s_%s", workspaceId, datasetKey, prefix, normalized);
  }

  private String buildUploadSessionMetaJson(
      InitRawFileUploadCommand command, String objectKey, OffsetDateTime expiresAt) {
    ObjectNode root = objectMapper.createObjectNode();
    ObjectNode upload = root.putObject(UploadSessionMeta.FIELD);
    upload.put(UploadSessionMeta.OBJECT_KEY, objectKey);
    upload.put(UploadSessionMeta.EXPECTED_SIZE_BYTES, command.sizeBytes());
    upload.put(UploadSessionMeta.FILENAME, command.filename());
    upload.put(UploadSessionMeta.CONTENT_TYPE, command.contentType());
    upload.put(UploadSessionMeta.EXPIRES_AT, expiresAt.toString());
    upload.put(UploadSessionMeta.CREATED_BY, command.createdBy());
    try {
      return objectMapper.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      log.warn("[init] 업로드 세션 메타 직렬화 실패: {}", e.getMessage(), e);
      throw new IllegalStateException("Failed to serialize upload session meta JSON", e);
    }
  }
}
