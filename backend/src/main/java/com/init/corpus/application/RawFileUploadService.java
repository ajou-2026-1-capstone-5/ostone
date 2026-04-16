package com.init.corpus.application;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.RawDatasetUploadCommand.RawConversationInput;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.RawFileParseException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.application.port.IngestionTriggerPort;
import com.init.corpus.application.port.RawFileStoragePort;
import com.init.corpus.domain.model.DatasetRawFile;
import com.init.corpus.domain.repository.DatasetRawFileRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RawFileUploadService {

  private static final Logger log = LoggerFactory.getLogger(RawFileUploadService.class);

  private final WorkspaceExistenceRepository workspaceExistenceRepository;
  private final WorkspaceMembershipRepository workspaceMembershipRepository;
  private final DatasetRepository datasetRepository;
  private final RawFileStoragePort storagePort;
  private final RawDatasetUploadService rawDatasetUploadService;
  private final DatasetRawFileRepository rawFileRepository;
  private final IngestionTriggerPort triggerPort;
  private final ObjectMapper objectMapper;

  public RawFileUploadService(
      WorkspaceExistenceRepository workspaceExistenceRepository,
      WorkspaceMembershipRepository workspaceMembershipRepository,
      DatasetRepository datasetRepository,
      RawFileStoragePort storagePort,
      RawDatasetUploadService rawDatasetUploadService,
      DatasetRawFileRepository rawFileRepository,
      IngestionTriggerPort triggerPort,
      ObjectMapper objectMapper) {
    this.workspaceExistenceRepository = workspaceExistenceRepository;
    this.workspaceMembershipRepository = workspaceMembershipRepository;
    this.datasetRepository = datasetRepository;
    this.storagePort = storagePort;
    this.rawDatasetUploadService = rawDatasetUploadService;
    this.rawFileRepository = rawFileRepository;
    this.triggerPort = triggerPort;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public RawFileUploadResult upload(RawFileUploadCommand command) {
    // 1. Fail-fast validation before S3 IO
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

    // 2. Build objectKey and compute SHA-256 checksum (U-06: Assumption adopted from Recommended
    //    Default — computed from byte[] before upload)
    String objectKey =
        buildObjectKey(command.workspaceId(), command.datasetKey(), command.originalFilename());
    String checksum = computeChecksumSha256(command.fileBytes());

    // 3. Put file to S3/MinIO
    storagePort.put(objectKey, command.fileBytes(), command.contentType());

    // 4. DB operations with orphan cleanup on failure (U-05: Confirmed)
    // catch(Exception) is intentional here: this is a best-effort compensating transaction
    // that must intercept any throwable — parse errors, DB errors, runtime errors — to delete
    // the already-uploaded S3 object before re-throwing. Restricting to specific types would
    // silently skip orphan cleanup for uncaught subtypes. (spec/114 U-05, error-handling.md 예외)
    try {
      List<RawConversationInput> conversations = parseConversations(command.fileBytes());

      RawDatasetUploadCommand rawCommand =
          new RawDatasetUploadCommand(
              command.workspaceId(),
              command.datasetKey(),
              command.name(),
              command.sourceType(),
              command.createdBy(),
              conversations);

      DatasetUploadResult uploadResult = rawDatasetUploadService.upload(rawCommand);

      DatasetRawFile rawFile =
          DatasetRawFile.create(
              uploadResult.datasetId(),
              objectKey,
              command.originalFilename(),
              command.contentType(),
              command.sizeBytes(),
              checksum);
      rawFileRepository.save(rawFile);

      triggerPort.trigger(uploadResult.datasetId(), objectKey);

      return new RawFileUploadResult(
          uploadResult.datasetId(),
          uploadResult.datasetKey(),
          command.workspaceId(),
          objectKey,
          command.originalFilename(),
          command.sizeBytes(),
          uploadResult.status(),
          uploadResult.piiRedactionStatus(),
          uploadResult.conversationCount());
    } catch (Exception ex) {
      try {
        storagePort.delete(objectKey);
      } catch (Exception deleteEx) {
        log.warn("[orphan] S3 보상 삭제 실패. objectKey={}", objectKey, deleteEx);
      }
      throw ex;
    }
  }

  private String buildObjectKey(Long workspaceId, String datasetKey, String originalFilename) {
    String normalized = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
    String prefix = UUID.randomUUID().toString();
    return String.format(
        "workspaces/%d/datasets/%s/%s_%s", workspaceId, datasetKey, prefix, normalized);
  }

  private String computeChecksumSha256(byte[] data) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(data);
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }

  private List<RawConversationInput> parseConversations(byte[] fileBytes) {
    List<RawConversationJson> jsonItems;
    try {
      jsonItems =
          objectMapper.readValue(
              fileBytes,
              objectMapper
                  .getTypeFactory()
                  .constructCollectionType(List.class, RawConversationJson.class));
    } catch (IOException e) {
      throw new RawFileParseException("JSON 파일을 파싱할 수 없습니다: " + e.getMessage());
    }
    if (jsonItems == null || jsonItems.isEmpty()) {
      throw new RawFileParseException("파일에 상담 데이터가 없습니다.");
    }
    try {
      return jsonItems.stream()
          .map(
              json ->
                  new RawConversationInput(
                      json.sourceId(),
                      json.source(),
                      json.consultingCategory(),
                      json.clientGender(),
                      json.clientAge(),
                      json.consultingContent()))
          .toList();
    } catch (IllegalArgumentException e) {
      throw new RawFileParseException("상담 데이터 형식이 올바르지 않습니다: " + e.getMessage());
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record RawConversationJson(
      @JsonProperty("source_id") String sourceId,
      @JsonProperty("source") String source,
      @JsonProperty("consulting_category") String consultingCategory,
      @JsonProperty("client_gender") String clientGender,
      @JsonProperty("client_age") String clientAge,
      @JsonProperty("consulting_content") String consultingContent) {}
}
