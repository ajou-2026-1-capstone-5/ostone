package com.init.corpus.application;

import java.util.List;
import java.util.Objects;

public record RawDatasetUploadCommand(
    Long workspaceId,
    String datasetKey,
    String name,
    String sourceType,
    Long createdBy,
    List<RawConversationInput> conversations) {

  public record RawConversationInput(
      String sourceId,
      String source,
      String consultingCategory,
      String clientGender,
      String clientAge,
      String consultingContent) {

    public RawConversationInput {
      if (sourceId == null || sourceId.trim().isEmpty()) {
        throw new IllegalArgumentException("sourceId must not be null or blank");
      }
      if (consultingContent == null || consultingContent.trim().isEmpty()) {
        throw new IllegalArgumentException("consultingContent must not be null or blank");
      }
    }
  }

  public RawDatasetUploadCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(createdBy, "createdBy must not be null");
    if (datasetKey == null || datasetKey.trim().isEmpty()) {
      throw new IllegalArgumentException("datasetKey must not be null or blank");
    }
    if (name == null || name.trim().isEmpty()) {
      throw new IllegalArgumentException("name must not be null or blank");
    }
    if (sourceType == null || sourceType.trim().isEmpty()) {
      throw new IllegalArgumentException("sourceType must not be null or blank");
    }
    Objects.requireNonNull(conversations, "conversations must not be null");
    if (conversations.isEmpty()) {
      throw new IllegalArgumentException("conversations must not be empty");
    }
    for (int i = 0; i < conversations.size(); i++) {
      if (conversations.get(i) == null) {
        throw new IllegalArgumentException("conversations[" + i + "] must not be null");
      }
    }
    conversations = List.copyOf(conversations);
  }
}
