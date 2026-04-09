package com.init.corpus.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record RawDatasetUploadRequest(
    @NotBlank(message = "datasetKey는 필수입니다.")
        @Size(max = 100, message = "datasetKey는 100자 이하여야 합니다.")
        String datasetKey,
    @NotBlank(message = "name은 필수입니다.") @Size(max = 255, message = "name은 255자 이하여야 합니다.")
        String name,
    @NotBlank(message = "sourceType은 필수입니다.") @Size(max = 50, message = "sourceType은 50자 이하여야 합니다.")
        String sourceType,
    @NotNull(message = "conversations는 필수입니다.") @Size(min = 1, message = "최소 1개의 대화가 필요합니다.")
        List<@Valid RawConversationRequest> conversations) {

  public record RawConversationRequest(
      @NotBlank(message = "source_id는 필수입니다.")
          @Size(max = 255, message = "source_id는 255자 이하여야 합니다.")
          String source_id,
      String source,
      String consulting_category,
      String client_gender,
      String client_age,
      @NotBlank(message = "consulting_content는 필수입니다.") String consulting_content) {}
}
