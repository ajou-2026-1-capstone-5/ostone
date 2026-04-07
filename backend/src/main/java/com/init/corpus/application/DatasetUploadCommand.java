package com.init.corpus.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

public record DatasetUploadCommand(
    Long workspaceId,
    String datasetKey,
    String name,
    String sourceType,
    Long createdBy,
    List<ConversationData> conversations) {

  public record ConversationData(
      String externalCaseId,
      String channel,
      String languageCode,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt,
      List<TurnData> turns) {
    public ConversationData {
      Objects.requireNonNull(turns, "turns must not be null");
      turns = List.copyOf(turns);
    }
  }

  public record TurnData(
      int turnIndex, String speakerRole, String messageText, OffsetDateTime eventTime) {}

  public DatasetUploadCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(datasetKey, "datasetKey must not be null");
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(sourceType, "sourceType must not be null");
    Objects.requireNonNull(createdBy, "createdBy must not be null");
    Objects.requireNonNull(conversations, "conversations must not be null");
    conversations = List.copyOf(conversations);
  }
}
