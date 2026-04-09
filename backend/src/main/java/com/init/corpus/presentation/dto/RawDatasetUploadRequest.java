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
    @NotNull(message = "conversations는 필수입니다.") @Size(min = 1, max = 10000, message = "대화는 1개 이상 10000개 이하여야 합니다.")
        List<@Valid RawConversationRequest> conversations) {

  public record RawConversationRequest(
      @NotBlank(message = "source_id는 필수입니다.")
          @Size(max = 255, message = "source_id는 255자 이하여야 합니다.")
          String source_id,
      @Size(max = 255, message = "source는 255자 이하여야 합니다.") String source,
      @Size(max = 100, message = "consulting_category는 100자 이하여야 합니다.") String consulting_category,
      @Size(max = 10, message = "client_gender는 10자 이하여야 합니다.") String client_gender,
      @Size(max = 10, message = "client_age는 10자 이하여야 합니다.") String client_age,
      @NotBlank(message = "consulting_content는 필수입니다.")
          @Size(max = 10000, message = "consulting_content는 10000자 이하여야 합니다.")
          String consulting_content) {}
}
