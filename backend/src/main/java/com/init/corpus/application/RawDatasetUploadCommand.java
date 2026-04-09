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
      String consultingContent) {}

  public RawDatasetUploadCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(datasetKey, "datasetKey must not be null");
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(sourceType, "sourceType must not be null");
    Objects.requireNonNull(createdBy, "createdBy must not be null");
    Objects.requireNonNull(conversations, "conversations must not be null");
    if (conversations.isEmpty()) {
      throw new IllegalArgumentException("conversations must not be empty");
    }
    conversations = List.copyOf(conversations);
  }
}
