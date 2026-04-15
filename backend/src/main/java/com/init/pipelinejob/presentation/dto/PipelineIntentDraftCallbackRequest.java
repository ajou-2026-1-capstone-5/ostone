package com.init.pipelinejob.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PipelineIntentDraftCallbackRequest(
    @NotBlank(message = "externalEventId는 필수입니다.")
        @Size(max = 255, message = "externalEventId는 255자 이하여야 합니다.")
        String externalEventId,
    @NotNull(message = "domainPackVersionId는 필수입니다.") Long domainPackVersionId,
    @NotNull(message = "intents는 필수입니다.")
        @Size(min = 1, max = 200, message = "intents는 1개 이상 200개 이하여야 합니다.")
        List<@Valid IntentDraftRequest> intents) {

  public record IntentDraftRequest(
      @NotBlank(message = "intentCode는 필수입니다.")
          @Size(max = 100, message = "intentCode는 100자 이하여야 합니다.")
          String intentCode,
      @NotBlank(message = "intent name은 필수입니다.")
          @Size(max = 255, message = "intent name은 255자 이하여야 합니다.")
          String name,
      @Size(max = 1000, message = "description은 1000자 이하여야 합니다.") String description,
      Integer taxonomyLevel,
      @Size(max = 100, message = "parentIntentCode는 100자 이하여야 합니다.") String parentIntentCode,
      @Size(max = 5000, message = "sourceClusterRef는 5000자 이하여야 합니다.") String sourceClusterRef,
      @Size(max = 5000, message = "entryConditionJson은 5000자 이하여야 합니다.") String entryConditionJson,
      @Size(max = 5000, message = "evidenceJson은 5000자 이하여야 합니다.") String evidenceJson,
      @Size(max = 5000, message = "metaJson은 5000자 이하여야 합니다.") String metaJson) {}
}
