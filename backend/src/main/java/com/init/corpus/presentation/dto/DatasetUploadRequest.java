package com.init.corpus.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public record DatasetUploadRequest(
    @NotBlank(message = "datasetKey는 필수입니다.")
        @Size(max = 100, message = "datasetKey는 100자 이하여야 합니다.")
        String datasetKey,
    @NotBlank(message = "name은 필수입니다.") @Size(max = 255, message = "name은 255자 이하여야 합니다.")
        String name,
    @NotBlank(message = "sourceType은 필수입니다.") @Size(max = 50, message = "sourceType은 50자 이하여야 합니다.")
        String sourceType,
    @NotNull(message = "conversations는 필수입니다.") @Size(min = 1, message = "최소 1개의 대화가 필요합니다.")
        List<@Valid ConversationRequest> conversations) {

  public record ConversationRequest(
      @Size(max = 255, message = "externalCaseId는 255자 이하여야 합니다.") String externalCaseId,
      @Size(max = 50, message = "channel은 50자 이하여야 합니다.") String channel,
      @Size(max = 20, message = "languageCode는 20자 이하여야 합니다.") String languageCode,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt,
      @NotNull(message = "turns는 필수입니다.") @Size(min = 1, message = "최소 1개의 턴이 필요합니다.")
          List<@Valid TurnRequest> turns) {}

  public record TurnRequest(
      @Min(value = 0, message = "turnIndex는 0 이상이어야 합니다.") int turnIndex,
      @NotBlank(message = "speakerRole은 필수입니다.")
          @Size(max = 50, message = "speakerRole은 50자 이하여야 합니다.")
          String speakerRole,
      @NotBlank(message = "messageText는 필수입니다.") String messageText,
      OffsetDateTime eventTime) {}
}
