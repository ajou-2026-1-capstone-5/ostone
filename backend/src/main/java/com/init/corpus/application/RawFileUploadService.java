package com.init.corpus.application;

import com.fasterxml.jackson.databind.JsonNode;
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
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class RawFileUploadService {

  private static final Logger log = LoggerFactory.getLogger(RawFileUploadService.class);
  private static final int MAX_ZIP_ENTRY_COUNT = 5_000;
  private static final int MAX_ZIP_ENTRY_BYTES = 20 * 1024 * 1024;
  private static final long MAX_ZIP_TOTAL_BYTES = 100L * 1024 * 1024;
  private static final int ZIP_READ_BUFFER_BYTES = 8 * 1024;

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
    RawFileUploadResult result;
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

      result =
          new RawFileUploadResult(
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

    triggerPort.trigger(command.workspaceId(), result.datasetId(), objectKey);
    return result;
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
    if (isZip(fileBytes)) {
      return parseZipConversations(fileBytes);
    }
    return parseJsonConversations(fileBytes, "file");
  }

  private boolean isZip(byte[] fileBytes) {
    return fileBytes.length >= 4
        && fileBytes[0] == 0x50
        && fileBytes[1] == 0x4b
        && fileBytes[2] == 0x03
        && fileBytes[3] == 0x04;
  }

  @SuppressWarnings("java:S5042") // ZIP entries are path-checked and bounded before parsing.
  private List<RawConversationInput> parseZipConversations(byte[] fileBytes) {
    List<RawConversationInput> conversations = new ArrayList<>();
    int entryCount = 0;
    long totalUncompressedBytes = 0L;
    try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(fileBytes))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        entryCount++;
        if (entryCount > MAX_ZIP_ENTRY_COUNT) {
          throw new RawFileParseException("ZIP 파일의 항목 수가 너무 많습니다.");
        }
        String entryName = entry.getName();
        if (!isSafeZipEntryName(entryName)) {
          throw new RawFileParseException("ZIP 파일에 안전하지 않은 경로가 포함되어 있습니다: " + entryName);
        }
        if (entry.isDirectory() || !isSupportedZipEntry(entryName)) {
          zip.closeEntry();
          continue;
        }
        byte[] entryBytes = readBoundedZipEntry(zip, entryName, totalUncompressedBytes);
        totalUncompressedBytes += entryBytes.length;
        conversations.addAll(parseJsonConversations(entryBytes, entryName));
        zip.closeEntry();
      }
    } catch (IOException e) {
      throw new RawFileParseException("ZIP 파일을 파싱할 수 없습니다: " + e.getMessage());
    }
    if (conversations.isEmpty()) {
      throw new RawFileParseException("ZIP 파일에 상담 데이터가 없습니다.");
    }
    return conversations;
  }

  private byte[] readBoundedZipEntry(
      ZipInputStream zip, String entryName, long totalUncompressedBytes) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    byte[] buffer = new byte[ZIP_READ_BUFFER_BYTES];
    int read;
    while ((read = zip.read(buffer)) != -1) {
      if (bytes.size() + read > MAX_ZIP_ENTRY_BYTES) {
        throw new RawFileParseException("ZIP 항목의 압축 해제 크기가 너무 큽니다: " + entryName);
      }
      if (totalUncompressedBytes + bytes.size() + read > MAX_ZIP_TOTAL_BYTES) {
        throw new RawFileParseException("ZIP 파일의 전체 압축 해제 크기가 너무 큽니다.");
      }
      bytes.write(buffer, 0, read);
    }
    return bytes.toByteArray();
  }

  private boolean isSafeZipEntryName(String entryName) {
    if (entryName == null || entryName.isBlank()) {
      return false;
    }
    String normalized = entryName.replace('\\', '/');
    if (normalized.startsWith("/") || normalized.contains(":")) {
      return false;
    }
    for (String part : normalized.split("/")) {
      if (part.equals("..")) {
        return false;
      }
    }
    return true;
  }

  private boolean isSupportedZipEntry(String entryName) {
    String lowered = entryName.toLowerCase();
    return lowered.endsWith(".json") || lowered.endsWith(".jsonl");
  }

  private List<RawConversationInput> parseJsonConversations(byte[] fileBytes, String sourceName) {
    String text = new String(fileBytes, StandardCharsets.UTF_8).strip();
    if (text.isEmpty()) {
      return List.of();
    }
    if (sourceName.toLowerCase().endsWith(".jsonl")) {
      return parseJsonlConversations(text, sourceName);
    }
    try {
      JsonNode root = objectMapper.readTree(text);
      List<RawConversationInput> conversations = new ArrayList<>();
      for (JsonNode node : conversationNodes(root)) {
        conversations.add(toRawConversationInput(node));
      }
      if (conversations.isEmpty()) {
        throw new RawFileParseException("파일에 상담 데이터가 없습니다.");
      }
      return conversations;
    } catch (IOException e) {
      throw new RawFileParseException(sourceName + " JSON 파일을 파싱할 수 없습니다: " + e.getMessage());
    }
  }

  private List<RawConversationInput> parseJsonlConversations(String text, String sourceName) {
    List<RawConversationInput> conversations = new ArrayList<>();
    String[] lines = text.split("\\R");
    for (int index = 0; index < lines.length; index++) {
      String line = lines[index].strip();
      if (line.isEmpty()) {
        continue;
      }
      try {
        JsonNode node = objectMapper.readTree(line);
        for (JsonNode row : conversationNodes(node)) {
          conversations.add(toRawConversationInput(row));
        }
      } catch (IOException e) {
        throw new RawFileParseException(
            sourceName + " JSONL " + (index + 1) + "번째 줄을 파싱할 수 없습니다: " + e.getMessage());
      }
    }
    if (conversations.isEmpty()) {
      throw new RawFileParseException("파일에 상담 데이터가 없습니다.");
    }
    return conversations;
  }

  private List<JsonNode> conversationNodes(JsonNode root) {
    if (root.isArray()) {
      List<JsonNode> rows = new ArrayList<>();
      root.forEach(rows::add);
      return rows;
    }
    if (root.isObject()) {
      for (String key : List.of("conversations", "data", "items")) {
        JsonNode rows = root.get(key);
        if (rows != null && rows.isArray()) {
          List<JsonNode> nodes = new ArrayList<>();
          rows.forEach(nodes::add);
          return nodes;
        }
      }
      return List.of(root);
    }
    return List.of();
  }

  private RawConversationInput toRawConversationInput(JsonNode node) {
    try {
      return new RawConversationInput(
          firstText(node, "source_id", "id", "consultation_id", "case_id"),
          firstText(node, "source", "channel"),
          firstText(node, "consulting_category"),
          firstText(node, "client_gender"),
          firstText(node, "client_age"),
          consultingContent(node));
    } catch (IllegalArgumentException e) {
      throw new RawFileParseException("상담 데이터 형식이 올바르지 않습니다: " + e.getMessage());
    }
  }

  private String consultingContent(JsonNode node) {
    String content =
        firstText(node, "consulting_content", "content", "text", "full_text", "conversation");
    if (content != null && !content.isBlank()) {
      return content;
    }
    JsonNode turns = node.get("turns");
    if (turns == null || !turns.isArray()) {
      return null;
    }
    List<String> lines = new ArrayList<>();
    for (JsonNode turn : turns) {
      String text = firstText(turn, "message_text", "text", "utterance", "content", "발화");
      if (text == null || text.isBlank()) {
        continue;
      }
      lines.add(
          speakerPrefix(firstText(turn, "speaker_role", "speaker", "role", "화자")) + text.strip());
    }
    return String.join("\n", lines);
  }

  private String speakerPrefix(String speaker) {
    String value = speaker == null ? "" : speaker.toLowerCase();
    if (value.contains("agent") || value.contains("상담") || value.contains("직원")) {
      return "상담사: ";
    }
    return "고객: ";
  }

  private String firstText(JsonNode node, String... fieldNames) {
    if (node == null || !node.isObject()) {
      return null;
    }
    for (String fieldName : fieldNames) {
      JsonNode value = node.get(fieldName);
      if (value == null || value.isNull() || value.isContainerNode()) {
        continue;
      }
      String text = value.asText("").strip();
      if (!text.isEmpty()) {
        return text;
      }
    }
    return null;
  }
}
